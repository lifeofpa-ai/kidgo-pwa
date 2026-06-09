// Scrapes ferienplausch-uster.ch for holiday activity programs and imports
// them into the kidgo events table.
//
// Source:  https://www.ferienplausch-uster.ch
// Dedup:   external_source=ferienplausch-uster + external_id=<url-slug>
// Region:  Zürich / Uster   event_typ: camp   status: approved
// Filter:  only events for ages 0–12; 13+ are skipped
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { parse as parseHtml } from "npm:node-html-parser@6";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const SOURCE_KEY = "ferienplausch-uster";
const BASE_URL   = "https://www.ferienplausch-uster.ch";
const ORT        = "Uster";

// Pages to probe for event listings (most specific first)
const PROBE_PATHS = [
  "/programm",
  "/angebote",
  "/kurse",
  "/ferienprogramm",
  "/angebote-anmeldung",
  "/",
];

// ─── Regexes ────────────────────────────────────────────────────────────────

// Swiss German date: "12.07.2025" or "12.7.2025"
const DATE_RX       = /(\d{1,2})\.(\d{1,2})\.(\d{4})/;
const DATE_RANGE_RX = /(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–bis\s]+\s*(\d{1,2}\.\d{1,2}\.\d{4})/;

// Age: "6-12 Jahre", "ab 5 Jahren", "für 8–10-Jährige", "5 - 12 J."
const AGE_RX = /(?:(?:ab|für|von)\s+)?(\d+)\s*[-–]\s*(\d+)\s*(?:jahre?|j\.?|jährige?)|(?:ab|für)\s+(\d+)\s*(?:jahre?|j\.?)/i;

// Events clearly targeting 13+ (skip these)
const ADULT_RX = /\bab\s*(1[3-9]|[2-9]\d)\s*(?:jahre?|j\.?)/i;

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDateStr(raw: string): string | null {
  const m = DATE_RX.exec(raw.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseAge(text: string): { min: number; max: number } | null {
  const m = AGE_RX.exec(text);
  if (!m) return null;
  if (m[1] && m[2]) return { min: parseInt(m[1]), max: parseInt(m[2]) };
  if (m[3])         return { min: parseInt(m[3]), max: 18 };
  return null;
}

function ageToBuckets(min: number, max: number): string[] {
  return [
    { label: "0-3",   lo: 0,  hi: 3  },
    { label: "4-6",   lo: 4,  hi: 6  },
    { label: "7-9",   lo: 7,  hi: 9  },
    { label: "10-12", lo: 10, hi: 12 },
  ]
    .filter(b => b.lo <= max && b.hi >= min)
    .map(b => b.label);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Stable slug for external_id — derived from URL path or title+date
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function absLink(href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/"))    return `${BASE_URL}${href}`;
  return null;
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function fetchHtml(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch; public event scraper)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Parse ───────────────────────────────────────────────────────────────────

interface ScrapedEvent {
  titel:        string;
  beschreibung: string | null;
  datum:        string | null;
  datum_ende:   string | null;
  alter_min:    number;
  alter_max:    number;
  external_id:  string;
  anmelde_link: string | null;
}

// Ordered list of CSS selectors that commonly wrap individual event/course items
const CONTAINER_SELECTORS = [
  ".event", ".kurs", ".angebot", ".programm-item", ".kursangebot",
  ".course-item", ".activity-item", ".feriencamp-item",
  "[class*='event-item']", "[class*='kurs-item']",
  "article.post", "article.type-post", "article",
  ".wp-block-post", ".jet-listing-grid__item",
  ".card", ".tile", ".item",
];

function parseEventsFromHtml(html: string, pageUrl: string): ScrapedEvent[] {
  const root = parseHtml(html);
  const events: ScrapedEvent[] = [];

  // --- Strategy 1: find repeated event containers ---
  let containers: ReturnType<typeof root.querySelectorAll> = [];

  for (const sel of CONTAINER_SELECTORS) {
    const found = root.querySelectorAll(sel);
    if (found.length >= 2) {
      containers = found;
      break;
    }
  }

  if (containers.length) {
    for (const container of containers) {
      const text = stripHtml(container.innerHTML);
      if (text.length < 10) continue;

      // Skip nav/footer/sidebar noise
      const cls = (container.getAttribute("class") ?? "").toLowerCase();
      if (/nav|menu|footer|sidebar|widget/.test(cls)) continue;

      // Title: first heading or strong
      const titleEl = container.querySelector("h1,h2,h3,h4,h5,h6,.title,.name,strong");
      const titel   = titleEl ? stripHtml(titleEl.innerHTML).slice(0, 150) : text.slice(0, 80);
      if (!titel || titel.length < 3) continue;

      // Skip 13+ events
      if (ADULT_RX.test(text)) continue;

      // Description: first paragraph or .description
      const descEl     = container.querySelector("p,.description,.desc,.text,.content,.excerpt");
      const beschreibung = descEl ? stripHtml(descEl.innerHTML).slice(0, 500) : null;

      // Dates
      let datum:      string | null = null;
      let datum_ende: string | null = null;
      const rangeM = DATE_RANGE_RX.exec(text);
      if (rangeM) {
        datum      = parseDateStr(rangeM[1]);
        datum_ende = parseDateStr(rangeM[2]);
      } else {
        const dm = DATE_RX.exec(text);
        if (dm) datum = parseDateStr(dm[0]);
      }

      // Age
      const age      = parseAge(text);
      const alter_min = age?.min ?? 0;
      const alter_max = age?.max ?? 12;
      if (alter_min > 12) continue;

      // Link
      const href       = container.querySelector("a[href]")?.getAttribute("href");
      const anmelde_link = absLink(href) ?? pageUrl;

      // external_id: prefer URL path, fall back to title slug
      const idBase    = href?.replace(/^https?:\/\/[^/]+/, "") || titel;
      const external_id = slugify(idBase) || slugify(titel + (datum ?? ""));

      events.push({ titel, beschreibung, datum, datum_ende, alter_min, alter_max, external_id, anmelde_link });
    }
    if (events.length) return events;
  }

  // --- Strategy 2: table rows ---
  for (const table of root.querySelectorAll("table")) {
    const rows = table.querySelectorAll("tr");
    if (rows.length < 2) continue;
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll("td, th");
      if (cells.length < 2) continue;
      const rowText = cells.map(c => stripHtml(c.innerHTML)).join(" | ");
      if (!rowText.trim()) continue;
      if (ADULT_RX.test(rowText)) continue;

      const titel = stripHtml(cells[0].innerHTML).slice(0, 150);
      if (!titel || titel.length < 3) continue;

      const age      = parseAge(rowText);
      const alter_min = age?.min ?? 0;
      const alter_max = age?.max ?? 12;
      if (alter_min > 12) continue;

      let datum: string | null = null;
      for (const cell of cells) {
        const m = DATE_RX.exec(stripHtml(cell.innerHTML));
        if (m) { datum = parseDateStr(m[0]); break; }
      }

      events.push({
        titel,
        beschreibung: rowText.slice(0, 500),
        datum,
        datum_ende: null,
        alter_min,
        alter_max,
        external_id: slugify(titel + (datum ?? String(i))),
        anmelde_link: pageUrl,
      });
    }
    if (events.length) return events;
  }

  return events;
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let dryRun = false;
  if (req.method === "POST") {
    try { dryRun = !!(await req.json()).dryRun; } catch { /* body optional */ }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Scrape all probe pages and deduplicate by external_id
    const eventMap  = new Map<string, ScrapedEvent>();
    const pageStats: Record<string, number> = {};

    for (const path of PROBE_PATHS) {
      const html = await fetchHtml(path);
      if (!html) { pageStats[path] = 0; continue; }

      const found = parseEventsFromHtml(html, `${BASE_URL}${path}`);
      let added = 0;
      for (const ev of found) {
        if (!eventMap.has(ev.external_id)) {
          eventMap.set(ev.external_id, ev);
          added++;
        }
      }
      pageStats[path] = added;
    }

    // 2. Map to DB rows
    const rows = [...eventMap.values()].map(ev => {
      const fullText  = `${ev.titel} ${ev.beschreibung ?? ""}`;
      const kategorien = [...new Set(["Feriencamp", ...inferCategories(fullText)])];
      const alters_buckets = (() => {
        const b = ageToBuckets(ev.alter_min, ev.alter_max);
        return b.length ? b : ["4-6", "7-9", "10-12"]; // sensible default
      })();

      return {
        external_id:     ev.external_id,
        external_source: SOURCE_KEY,
        titel:           ev.titel,
        beschreibung:    ev.beschreibung,
        datum:           ev.datum,
        datum_ende:      ev.datum_ende,
        ort:             ORT,
        anmelde_link:    ev.anmelde_link,
        kategorien,
        alters_buckets,
        indoor_outdoor:  inferIndoorOutdoor(fullText),
        event_typ:       "camp",
        status:          "approved",
      };
    });

    const summary = { pages: pageStats, scraped: rows.length };

    if (dryRun) {
      return new Response(
        JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
        { headers: jsonHeaders },
      );
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ...summary, inserted: 0, message: "no events found on any probe page" }),
        { headers: jsonHeaders },
      );
    }

    // 3. Upsert in batches — deduplicate on (external_source, external_id)
    const BATCH = 50;
    let inserted   = 0;
    let duplicates = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error, data } = await supabase
        .from("events")
        .upsert(batch, { onConflict: "external_source,external_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("upsert error:", error.message);
        continue;
      }

      const batchNew  = data?.length ?? 0;
      inserted        += batchNew;
      duplicates      += batch.length - batchNew;
    }

    return new Response(
      JSON.stringify({ ...summary, inserted, duplicates }),
      { headers: jsonHeaders },
    );

  } catch (err) {
    console.error("scrape-ferienplausch-uster fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

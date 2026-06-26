// Scrapes bybalzer.ch (Coop Kindermusicals) for children's theater events in ZH.
//
// Source:   https://bybalzer.ch
// Method:   HTML microdata – schema.org Event items (<li itemscope itemtype="…/Event">)
//           The site embeds structured microdata directly in the listing HTML.
//
// Filter:   Kanton Zürich only (location contains "Zürich" or known ZH venues)
//           Future events only
//
// Duplicate check: external_source="bybalzer" + external_id (stable hash of title|date|venue)
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const SOURCE_KEY = "bybalzer";
const BASE_URL   = "https://bybalzer.ch";

// Try these listing URLs in order; use the first that contains microdata Event items.
const LISTING_URLS = [
  `${BASE_URL}/spielplan/`,
  `${BASE_URL}/veranstaltungen/`,
  `${BASE_URL}/programm/`,
  `${BASE_URL}/`,
];

const FETCH_HEADERS = { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#8211;/g, "–").replace(/&#8230;/g, "…")
    .replace(/\s{2,}/g, " ").trim();
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

// Stable, collision-resistant ID derived from content (no server-side IDs in microdata).
function makeStableId(title: string, date: string, venue: string): string {
  const s = `${title}|${date}|${venue}`;
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

// ─── Microdata extraction ─────────────────────────────────────────────────────

interface MicrodataEvent {
  name:        string | null;
  startDate:   string | null;
  endDate:     string | null;
  location:    string | null;
  description: string | null;
  url:         string | null;
}

/** Read a single itemprop value from an HTML block. */
function getItemprop(html: string, prop: string): string | null {
  // <meta itemprop="…" content="…">
  let m = new RegExp(`<meta[^>]+itemprop="${prop}"[^>]+content="([^"]*)"`, "i").exec(html)
    ?? new RegExp(`<meta[^>]+content="([^"]*)"[^>]+itemprop="${prop}"`, "i").exec(html);
  if (m) return m[1];

  // <time itemprop="…" datetime="…">
  m = new RegExp(`<time[^>]+itemprop="${prop}"[^>]+datetime="([^"]*)"`, "i").exec(html)
    ?? new RegExp(`<time[^>]+datetime="([^"]*)"[^>]+itemprop="${prop}"`, "i").exec(html);
  if (m) return m[1];

  // <img itemprop="…" src="…">  (used for image but we don't persist it)
  if (prop === "image") {
    m = new RegExp(`<img[^>]+itemprop="${prop}"[^>]+src="([^"]*)"`, "i").exec(html)
      ?? new RegExp(`<img[^>]+src="([^"]*)"[^>]+itemprop="${prop}"`, "i").exec(html);
    if (m) return m[1];
  }

  // <a itemprop="…" href="…"> or reverse order
  m = new RegExp(`<a[^>]+itemprop="${prop}"[^>]+href="([^"]*)"`, "i").exec(html)
    ?? new RegExp(`<a[^>]+href="([^"]*)"[^>]+itemprop="${prop}"`, "i").exec(html);
  if (m) return m[1];

  // Generic text content: itemprop="…">text<
  m = new RegExp(`itemprop="${prop}"[^>]*>([^<]+)`, "i").exec(html);
  if (m) return stripHtml(m[1]);

  return null;
}

/**
 * Extract all schema.org Event microdata items from the page HTML.
 * Handles <li itemscope itemtype="http://schema.org/Event"> blocks.
 * Uses a depth counter to correctly close nested <li> tags.
 */
function extractMicrodataEvents(html: string): MicrodataEvent[] {
  const events: MicrodataEvent[] = [];
  const openTagRx = /<li\b[^>]*itemscope[^>]*>/gi;
  let m: RegExpExecArray | null;

  while ((m = openTagRx.exec(html)) !== null) {
    if (!m[0].includes("Event")) continue;

    let depth = 1;
    let pos = m.index + m[0].length;
    let blockEnd = -1;

    while (depth > 0 && pos < html.length) {
      const nextOpen  = html.indexOf("<li", pos);
      const nextClose = html.indexOf("</li>", pos);
      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 3;
      } else {
        depth--;
        pos = nextClose + 5;
        if (depth === 0) blockEnd = pos;
      }
    }

    if (blockEnd === -1) continue;
    const block = html.slice(m.index, blockEnd);

    // Location can be a nested itemscope Place — extract its "name" child
    const locBlockM = /<[^>]+itemprop="location"[^>]*(?:itemscope[^>]*)?>([^]*?)(?=<\/[a-z]+>)/i.exec(block);
    const location = locBlockM
      ? (getItemprop(locBlockM[1], "name") ?? stripHtml(locBlockM[1]).split("\n")[0].trim())
      : getItemprop(block, "location");

    // Prefer explicit ticket/buy link; fall back to first absolute href
    const ticketM =
      block.match(/<a[^>]+href="(https?:[^"]+)"[^>]*>[^<]*(?:ticket|kauf|buy|book|bestell)[^<]*<\/a>/i) ??
      block.match(/<a[^>]+itemprop="url"[^>]+href="([^"]+)"/i) ??
      block.match(/<a[^>]+href="(https?:[^"]+)"/i);

    events.push({
      name:        getItemprop(block, "name"),
      startDate:   getItemprop(block, "startDate"),
      endDate:     getItemprop(block, "endDate"),
      location,
      description: getItemprop(block, "description"),
      url:         ticketM ? ticketM[1] : null,
    });
  }

  return events;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function isFutureOrToday(iso: string): boolean {
  return iso >= new Date().toISOString().slice(0, 10);
}

// ─── ZH filter ────────────────────────────────────────────────────────────────

// Match any location that is in Kanton Zürich.
const ZH_PATTERN =
  /zürich|maag\s*halle|theater\s*(?:11|zürich|züri)|bernhard.theater|opernhaus|hallenstadion|kongresshaus\s*zürich|schiffbau|rote\s*fabrik/i;

function isZurichLocation(loc: string | null): boolean {
  return loc !== null && ZH_PATTERN.test(loc);
}

// ─── Listing page fetch ───────────────────────────────────────────────────────

async function fetchListingHtml(): Promise<{ html: string; url: string } | null> {
  for (const url of LISTING_URLS) {
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS });
      if (!res.ok) continue;
      const html = await res.text();
      if (html.includes("itemscope") && html.includes("Event")) return { html, url };
    } catch { /* try next */ }
  }
  return null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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

    // 1. Fetch the listing page
    const result = await fetchListingHtml();
    if (!result) {
      return new Response(
        JSON.stringify({ error: "Could not find microdata Event page on bybalzer.ch" }),
        { status: 502, headers: jsonHeaders },
      );
    }
    const { html, url: sourceUrl } = result;

    // 2. Extract microdata events
    const allEvents = extractMicrodataEvents(html);

    // 3. Filter: ZH locations + future dates → build DB rows
    const today = new Date().toISOString().slice(0, 10);
    const rows = [];

    for (const ev of allEvents) {
      const datum = parseIsoDate(ev.startDate);
      if (!datum || datum < today) continue;
      if (!isZurichLocation(ev.location)) continue;

      const title = ev.name?.trim().slice(0, 200) ?? "";
      if (!title) continue;

      const venue    = (ev.location ?? "Zürich").trim().slice(0, 200);
      const fullText = `${title} ${ev.description ?? ""}`;

      const kategorien = inferCategories(fullText);

      rows.push({
        external_id:     makeStableId(title, datum, venue),
        external_source: SOURCE_KEY,
        titel:           title,
        beschreibung:    ev.description?.slice(0, 1000) ?? null,
        datum,
        datum_ende:      parseIsoDate(ev.endDate),
        ort:             venue,
        anmelde_link:    ev.url ?? sourceUrl,
        preis_chf:       null as number | null,
        alter_von:       3,
        alter_bis:       12,
        kategorien:      kategorien.length ? kategorien : ["Theater", "Musik"],
        alters_buckets:  ageToBuckets(3, 12),
        indoor_outdoor:  inferIndoorOutdoor(fullText) ?? "indoor",
        event_typ:       "event",
        status:          "approved",
      });
    }

    const summary = {
      sourceUrl,
      extracted:  allEvents.length,
      zhFuture:   rows.length,
      source:     BASE_URL,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
        { headers: jsonHeaders },
      );
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ...summary, inserted: 0, message: "no upcoming ZH events found" }),
        { headers: jsonHeaders },
      );
    }

    // 4. Upsert in batches
    const BATCH = 50;
    let inserted   = 0;
    let duplicates = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("events")
        .upsert(batch, { onConflict: "external_source,external_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        for (const row of batch) {
          const { data: s } = await supabase
            .from("events")
            .upsert(row, { onConflict: "external_source,external_id", ignoreDuplicates: true })
            .select("id");
          inserted += s?.length ?? 0;
        }
        continue;
      }
      inserted   += data?.length ?? 0;
      duplicates += batch.length - (data?.length ?? 0);
    }

    return new Response(
      JSON.stringify({ ...summary, inserted, duplicates }),
      { headers: jsonHeaders },
    );

  } catch (err) {
    console.error("scrape-bybalzer fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

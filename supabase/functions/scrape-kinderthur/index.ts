// Scrapes kinderthur.ch for children's events in Winterthur.
//
// Source:   https://www.kinderthur.ch
// API:      WordPress REST API – custom post type "ajde_events"
//           GET /wp-json/wp/v2/ajde_events?orderby=modified&order=desc
//
// Problem:  The Ajde Events plugin stores event start/end dates as WP post-meta
//           fields that are NOT exposed via the REST API.  The content.rendered
//           field contains only the description text (no dates).
//
// Fix:      For each event, fetch its front-end HTML page and extract the
//           JSON-LD Event schema (injected by the Ajde plugin):
//             "startDate": "2026-9-6T13:00+2:00"
//             "endDate":   "2026-9-6T20:00+2:00"
//
// Strategy: Fetch the 200 most recently modified events per run (ordered by
//           modified desc).  This gives a rolling update that keeps the DB
//           current without fetching all 2500+ historical events each time.
//           HTML pages are fetched with concurrency=8.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true, limit: number }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const SOURCE_KEY = "kinderthur";
const BASE_URL   = "https://www.kinderthur.ch";
const API_BASE   = `${BASE_URL}/wp-json/wp/v2`;

const FETCH_HEADERS = { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" };

// ─── Types ────────────────────────────────────────────────────────────────────

interface AjdeEvent {
  id:         number;
  link:       string;
  slug:       string;
  title:      { rendered: string };
  content:    { rendered: string };
  modified:   string;
  class_list: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim();
}

/**
 * Parse the non-standard ISO date used by Ajde Events JSON-LD:
 *   "2026-9-6T13:00+2:00"  →  "2026-09-06"
 *   "2026-09-06T13:00:00+02:00"  →  "2026-09-06"
 */
function parseAjdeDate(raw: string): string | null {
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function isFutureOrToday(iso: string): boolean {
  return iso >= new Date().toISOString().slice(0, 10);
}

function parsePreisCHF(text: string): number | null {
  const t = text.toLowerCase();
  if (/gratis|kostenlos|frei|umsonst/.test(t)) return 0;
  const m = t.match(/chf\s*([\d.,]+)|fr\.?\s*([\d.,]+)|([\d.,]+)\s*fr/i);
  if (m) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").replace(",", ".");
    const num = parseFloat(raw);
    return isFinite(num) ? num : null;
  }
  return null;
}

function parseAgeMin(text: string): number {
  const m = text.toLowerCase().match(/ab[- _]?(\d+)[- _]?j/);
  return m ? parseInt(m[1], 10) : 0;
}

function ageToBuckets(min: number, max = 12): string[] {
  return [
    { label: "0-3",   lo: 0,  hi: 3  },
    { label: "4-6",   lo: 4,  hi: 6  },
    { label: "7-9",   lo: 7,  hi: 9  },
    { label: "10-12", lo: 10, hi: 12 },
  ]
    .filter(b => b.lo <= max && b.hi >= min)
    .map(b => b.label);
}

// ─── WP REST API fetch ────────────────────────────────────────────────────────

async function fetchRecentEvents(limit: number): Promise<AjdeEvent[]> {
  const all: AjdeEvent[] = [];
  let page = 1;
  const PER_PAGE = 100;

  while (all.length < limit) {
    const res = await fetch(
      `${API_BASE}/ajde_events?status=publish&per_page=${PER_PAGE}&page=${page}` +
      `&orderby=modified&order=desc` +
      `&_fields=id,link,slug,title,content,modified,class_list`,
      { headers: FETCH_HEADERS },
    );
    if (!res.ok) break;

    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
    const items: AjdeEvent[] = await res.json();
    all.push(...items);

    if (page >= totalPages || items.length === 0 || all.length >= limit) break;
    page++;
  }

  return all.slice(0, limit);
}

// ─── HTML page fetch & JSON-LD extraction ─────────────────────────────────────

interface EventDates {
  startDate: string | null;
  endDate:   string | null;
}

/**
 * Fetch the event's front-end HTML page and extract JSON-LD startDate/endDate.
 * The Ajde Events plugin embeds:
 *   <script type="application/ld+json">{"@type":"Event","startDate":"…","endDate":"…"}</script>
 */
async function fetchEventDates(url: string): Promise<EventDates> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) return { startDate: null, endDate: null };
    const html = await res.text();

    // Find JSON-LD blocks containing Event schema
    const jsonldRx = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = jsonldRx.exec(html)) !== null) {
      const raw = m[1];
      if (!raw.includes('"Event"')) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj["@type"] === "Event" && obj.startDate) {
          return {
            startDate: parseAjdeDate(obj.startDate),
            endDate:   obj.endDate ? parseAjdeDate(obj.endDate) : null,
          };
        }
      } catch { /* malformed JSON, try next */ }
    }
    return { startDate: null, endDate: null };
  } catch {
    return { startDate: null, endDate: null };
  }
}

/** Extract venue slug from class_list: "event_location-winterthur-stadtpark" → "Winterthur Stadtpark" */
function extractVenue(classLst: string, fallback: string): string {
  const m = classLst.match(/event_location-([a-z0-9-]+)/);
  if (!m) return fallback;
  return m[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let dryRun = false;
  let limit  = 200; // process the 200 most-recently-modified events per run
  if (req.method === "POST") {
    try {
      const body = await req.json();
      dryRun = !!body.dryRun;
      if (body.limit) limit = Math.min(Number(body.limit), 500);
    } catch { /* body optional */ }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Fetch most recently modified events from WP REST API
    const ajdeEvents = await fetchRecentEvents(limit);

    // 2. Fetch HTML pages in parallel (concurrency = 8) to get JSON-LD dates
    const CONCURRENCY = 8;
    const withDates: Array<AjdeEvent & EventDates> = [];

    for (let i = 0; i < ajdeEvents.length; i += CONCURRENCY) {
      const batch = ajdeEvents.slice(i, i + CONCURRENCY);
      const dates = await Promise.all(batch.map(ev => fetchEventDates(ev.link)));
      for (let j = 0; j < batch.length; j++) {
        withDates.push({ ...batch[j], ...dates[j] });
      }
    }

    // 3. Build DB rows — keep only events with a future start date
    const today = new Date().toISOString().slice(0, 10);
    const rows = [];

    for (const ev of withDates) {
      if (!ev.startDate || ev.startDate < today) continue;

      const title    = stripHtml(ev.title.rendered).slice(0, 200);
      if (!title) continue;

      const rawText  = stripHtml(ev.content.rendered);
      const venue    = extractVenue(ev.class_list ?? "", "Winterthur");
      const preisCHF = parsePreisCHF(rawText);
      const alterVon = parseAgeMin(ev.class_list + " " + rawText);

      const fullText       = `${title} ${rawText.slice(0, 600)}`;
      const kategorien     = inferCategories(fullText);
      const alters_buckets = ageToBuckets(alterVon);

      rows.push({
        external_id:     String(ev.id),
        external_source: SOURCE_KEY,
        titel:           title,
        beschreibung:    rawText.slice(0, 1000) || null,
        datum:           ev.startDate,
        datum_ende:      ev.endDate ?? null,
        ort:             venue.slice(0, 200),
        anmelde_link:    ev.link,
        preis_chf:       preisCHF,
        alter_von:       alterVon,
        alter_bis:       12,
        kategorien:      kategorien.length ? kategorien : ["Ausflug"],
        alters_buckets:  alters_buckets.length ? alters_buckets : ["4-6", "7-9", "10-12"],
        indoor_outdoor:  inferIndoorOutdoor(fullText),
        event_typ:       "event",
        status:          "approved",
      });
    }

    const summary = {
      fetched:    ajdeEvents.length,
      htmlFetched: withDates.length,
      withDate:   rows.length,
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
        JSON.stringify({ ...summary, inserted: 0, message: "no upcoming events found" }),
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
    console.error("scrape-kinderthur fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

// Scrapes kinderthur.ch for children's events in Winterthur.
//
// Source:   https://www.kinderthur.ch
// API:      WordPress REST API – custom post type "ajde_events"
//           GET /wp-json/wp/v2/ajde_events?per_page=100&status=publish
// Method:   WP REST API (ajde_events post type) + regex parsing of
//           content.rendered HTML for date, time, location, price, age.
//
// The site uses the "Ajde Events" plugin.  Event metadata (start/end date,
// venue, cost) is embedded in the rendered HTML output rather than exposed
// as dedicated REST API fields.  The date format used by the plugin is:
//   "DD.MM.YYYY HH:MM" or German long form "So., 11. Apr. 2027 11:00"
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const SOURCE_KEY = "kinderthur";
const BASE_URL   = "https://www.kinderthur.ch";
const API_BASE   = `${BASE_URL}/wp-json/wp/v2`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AjdeEvent {
  id:          number;
  link:        string;
  slug:        string;
  title:       { rendered: string };
  content:     { rendered: string };
  date:        string;  // WP post publish date (not the event date!)
  tags:        number[];
  event_type:  number[];
  event_type_2: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const DE_MONTHS: Record<string, string> = {
  jan: "01", feb: "02", "mär": "03", mar: "03", apr: "04",
  mai: "05", jun: "06", jul: "07", aug: "08",
  sep: "09", okt: "10", nov: "11", dez: "12",
};

/**
 * Extract the first recognisable date from German-formatted text.
 * Handles:
 *   "11.04.2027"  →  "2027-04-11"
 *   "So., 11. Apr. 2027"  →  "2027-04-11"
 */
function extractFirstDate(text: string): string | null {
  // Numeric: 11.04.2027 or 11.4.2027
  const numM = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (numM) {
    const [, d, mo, y] = numM;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Word: So., 11. Apr. 2027 / 11. April 2027
  const wordM = text.toLowerCase().match(
    /(\d{1,2})\.\s*(jan|feb|m[äa]r\.?|apr|mai|jun|jul|aug|sep|okt|nov|dez)\.?\s*(\d{4})/,
  );
  if (wordM) {
    const [, d, mon, y] = wordM;
    const key = mon.replace(/\.$/, "").replace("ä", "ä");
    const mo  = DE_MONTHS[key] ?? null;
    if (!mo) return null;
    return `${y}-${mo}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parsePreisCHF(text: string): number | null {
  const t = text.toLowerCase();
  if (/gratis|kostenlos|frei|umsonst|fast gratis/.test(t)) return 0;
  const m = t.match(/chf\s*([\d.,]+)|fr\.?\s*([\d.,]+)|([\d.,]+)\s*fr/i);
  if (m) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").replace(",", ".");
    const num = parseFloat(raw);
    return isFinite(num) ? num : null;
  }
  return null;
}

function parseAgeMin(text: string): number {
  // "ab 5 Jahren" / "ab-5-jahren" (from CSS class) / "Kinder ab 6 J."
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

/** Paginated fetch of all ajde_events entries. */
async function fetchAllEvents(): Promise<AjdeEvent[]> {
  const all: AjdeEvent[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${API_BASE}/ajde_events?status=publish&per_page=100&page=${page}` +
      `&_fields=id,link,slug,title,content,date,tags,event_type,event_type_2`,
      { headers: { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" } },
    );
    if (!res.ok) break;

    const total = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
    const items: AjdeEvent[] = await res.json();
    all.push(...items);

    if (page >= total || items.length === 0) break;
    page++;
  }

  return all;
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

    // 1. Fetch all ajde_events from WP REST API
    const ajdeEvents = await fetchAllEvents();

    // 2. Parse events into DB rows
    const rows = [];

    for (const ev of ajdeEvents) {
      const title = stripHtml(ev.title.rendered).slice(0, 200);
      if (!title) continue;

      const rawHtml    = ev.content.rendered;
      const rawText    = stripHtml(rawHtml);

      // The Ajde Events plugin embeds the event date in the content HTML.
      // Also check CSS class names like "event_type_2-ab-5-jahren" for age hints.
      const datum = extractFirstDate(rawText);

      // Skip events without a parseable date that are older than today
      // (we keep null-datum events in case they're recurring/evergreen)
      const today = new Date().toISOString().split("T")[0];
      if (datum && datum < today) continue;

      // Extract venue: kinderthur events usually mention "Winterthur" venues
      const venueMatch = rawText.match(/(?:Ort|Venue|Location)[:\s]+([^\n,]{5,80})/i);
      const ort = venueMatch
        ? venueMatch[1].trim()
        : "Winterthur";

      const preis_chf = parsePreisCHF(rawText);

      // Age: parse from CSS class names in HTML (e.g. "event_type_2-ab-5-jahren")
      const cssAge  = (rawHtml.match(/event_type_2-([a-z0-9-]+)/g) ?? []).join(" ");
      const alter_von = parseAgeMin(cssAge + " " + rawText);
      const alter_bis = 12;

      const fullText   = `${title} ${rawText.slice(0, 600)}`;
      const kategorien = inferCategories(fullText);
      const alters_buckets = (() => {
        const b = ageToBuckets(alter_von, alter_bis);
        return b.length ? b : ["4-6", "7-9", "10-12"];
      })();

      rows.push({
        external_id:     String(ev.id),
        external_source: SOURCE_KEY,
        titel:           title,
        beschreibung:    rawText.slice(0, 1000) || null,
        datum:           datum ?? null,
        datum_ende:      null,
        ort:             ort.slice(0, 200),
        anmelde_link:    ev.link,
        preis_chf,
        alter_von,
        alter_bis,
        kategorien:      kategorien.length ? kategorien : ["Ausflug"],
        alters_buckets,
        indoor_outdoor:  inferIndoorOutdoor(fullText),
        event_typ:       "event",
        status:          "approved",
      });
    }

    const summary = {
      fetched:  ajdeEvents.length,
      rows:     rows.length,
      source:   BASE_URL,
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

    // 3. Upsert in batches
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

      const batchNew = data?.length ?? 0;
      inserted       += batchNew;
      duplicates     += batch.length - batchNew;
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

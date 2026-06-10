// Scrapes gz-zh.ch (Gemeinschaftszentren Zürich) for children's events.
//
// Source:   https://gz-zh.ch
// API:      WordPress REST API – standard pages endpoint (no custom event type)
//           GET /wp-json/wp/v2/pages?parent=<angebote-page-id>&per_page=100
// Method:   WP REST API pages + regex parsing of HTML content
//
// The GZ website stores events as WP pages nested under each location's
// "Angebote" sub-page (e.g. /gz-heuried/angebote/).  Each event page
// uses a predictable section structure:
//   – Daten:   "Mo., 15. Juni 2026 09:30–11:30 Uhr"
//   – Ort:     "GZ Heuried, Werkatelier, Döltschiweg 130, 8055 Zürich"
//   – Kosten:  "CHF 5.00" | "gratis"
//   – Alter:   "Für Kinder von 2,5 bis 4 Jahren"
//
// Because the site has no JSON event API, this scraper:
//   1. Fetches all published WP pages (paginated)
//   2. Filters pages whose URL path contains "/angebote/"
//   3. Parses their content.rendered HTML with regex for event fields
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const SOURCE_KEY = "gz-zuerich";
const BASE_URL   = "https://gz-zh.ch";
const API_BASE   = `${BASE_URL}/wp-json/wp/v2`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface WpPage {
  id:      number;
  link:    string;
  slug:    string;
  title:   { rendered: string };
  content: { rendered: string };
  date:    string;
  status:  string;
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

/** Extract a section's text content that follows a German heading keyword. */
function extractSection(text: string, keyword: string): string | null {
  // Match heading variants: "Daten", "## Daten", "Ort:" etc.
  const rx = new RegExp(
    `(?:#{1,3}\\s*|<h[2-4][^>]*>\\s*)?${keyword}\\s*:?\\s*(?:</h[2-4]>)?\\s*([^\\n]{3,200})`,
    "i",
  );
  const m = rx.exec(text);
  return m ? m[1].trim() : null;
}

/**
 * Parse a German date string like "Mo., 15. Juni 2026" → "2026-06-15"
 * or "15.06.2026" → "2026-06-15".
 */
const DE_MONTHS: Record<string, string> = {
  januar: "01", februar: "02", märz: "03", april: "04",
  mai: "05", juni: "06", juli: "07", august: "08",
  september: "09", oktober: "10", november: "11", dezember: "12",
};

function parseDeDate(str: string): string | null {
  // Numeric format: 15.06.2026 or 15.6.2026
  const numMatch = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (numMatch) {
    const [, d, mo, y] = numMatch;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Word format: 15. Juni 2026 / Di., 3. Mai 2026
  const wordMatch = str.toLowerCase().match(
    /(\d{1,2})\.\s*(januar|februar|m[äa]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})/,
  );
  if (wordMatch) {
    const [, d, mon, y] = wordMatch;
    const mo = DE_MONTHS[mon.replace("ä", "ä")] ?? null;
    if (!mo) return null;
    return `${y}-${mo}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parsePreisCHF(text: string | null): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/gratis|kostenlos|frei|ohne kosten/.test(t)) return 0;
  const m = t.match(/chf\s*([\d.,]+)|fr\.?\s*([\d.,]+)|([\d.,]+)\s*fr/i);
  if (m) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").replace(",", ".");
    const num = parseFloat(raw);
    return isFinite(num) ? num : null;
  }
  return null;
}

function parseAgeRange(text: string | null): { min: number; max: number } {
  if (!text) return { min: 0, max: 12 };
  const t = text.toLowerCase();
  // "von 2,5 bis 4 Jahren" / "2-4 Jahre" / "ab 6 Jahren"
  const rangeM = t.match(/von\s+([\d,]+)\s+bis\s+([\d,]+)|(\d+)\s*[-–]\s*(\d+)\s*j/);
  if (rangeM) {
    const min = parseFloat((rangeM[1] ?? rangeM[3] ?? "0").replace(",", "."));
    const max = parseFloat((rangeM[2] ?? rangeM[4] ?? "12").replace(",", "."));
    return { min: Math.floor(min), max: Math.min(Math.ceil(max), 18) };
  }
  const abM = t.match(/ab\s+([\d,]+)\s*j/);
  if (abM) {
    const min = Math.floor(parseFloat(abM[1].replace(",", ".")));
    return { min, max: 12 };
  }
  return { min: 0, max: 12 };
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

/** Fetch all pages from a paginated WP REST endpoint. */
async function fetchAllPages(url: string): Promise<WpPage[]> {
  const all: WpPage[] = [];
  let page = 1;
  const PER_PAGE = 100;

  while (true) {
    const res = await fetch(`${url}&page=${page}&per_page=${PER_PAGE}`, {
      headers: { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" },
    });
    if (!res.ok) break;

    const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
    const items: WpPage[] = await res.json();
    all.push(...items);

    if (page >= totalPages || items.length === 0) break;
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

    // 1. Fetch all published WP pages
    const allPages = await fetchAllPages(
      `${API_BASE}/pages?status=publish&_fields=id,link,slug,title,content,date`,
    );

    // 2. Filter for event/offer pages nested under /angebote/ paths
    const eventPages = allPages.filter((p) =>
      /\/angebote\/[^/]+\/?$/.test(p.link)
    );

    // 3. Parse each page into an event row
    const rows = [];

    for (const page of eventPages) {
      const rawContent = stripHtml(page.content.rendered);
      const title      = stripHtml(page.title.rendered).slice(0, 200);
      if (!title) continue;

      // Extract GZ location from URL: /gz-heuried/angebote/... → "GZ Heuried"
      const locationMatch = page.link.match(/gz-zh\.ch\/(gz-[^/]+)\//);
      const locationSlug  = locationMatch ? locationMatch[1] : null;
      const locationName  = locationSlug
        ? locationSlug.replace("gz-", "GZ ").replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : "Zürich";

      const datenSection = extractSection(rawContent, "Daten");
      const ortSection   = extractSection(rawContent, "Ort");
      const kostenSection = extractSection(rawContent, "Kosten");
      const alterSection  = extractSection(rawContent, "Alter") ??
                            extractSection(rawContent, "Zielgruppe");

      const datum = datenSection ? parseDeDate(datenSection) : null;
      const ort   = ortSection
        ? ortSection.split(",")[0].trim().slice(0, 200)
        : locationName;

      const preis_chf  = parsePreisCHF(kostenSection);
      const { min: alter_von, max: alter_bis } = parseAgeRange(alterSection ?? rawContent.slice(0, 500));

      // Skip entries with no useful event data
      if (!datum && !datenSection) continue;

      const fullText    = `${title} ${rawContent.slice(0, 500)}`;
      const kategorien  = inferCategories(fullText);
      const alters_buckets = (() => {
        const b = ageToBuckets(alter_von, alter_bis);
        return b.length ? b : ["4-6", "7-9", "10-12"];
      })();

      rows.push({
        external_id:     String(page.id),
        external_source: SOURCE_KEY,
        titel:           title,
        beschreibung:    rawContent.slice(0, 1000) || null,
        datum,
        datum_ende:      null,
        ort,
        anmelde_link:    page.link,
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
      pagesTotal:  allPages.length,
      eventPages:  eventPages.length,
      rows:        rows.length,
      source:      BASE_URL,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
        { headers: jsonHeaders },
      );
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ...summary, inserted: 0, message: "no events parsed" }),
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

      const batchNew  = data?.length ?? 0;
      inserted        += batchNew;
      duplicates      += batch.length - batchNew;
    }

    return new Response(
      JSON.stringify({ ...summary, inserted, duplicates }),
      { headers: jsonHeaders },
    );

  } catch (err) {
    console.error("scrape-gz-zuerich fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

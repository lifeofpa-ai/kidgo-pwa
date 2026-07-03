// Scrapes gz-zh.ch (Gemeinschaftszentren Zürich) for children's events.
//
// Source:   https://gz-zh.ch
// Method:   HTML scraping – no public REST API for the "angebote" custom post type
//
// Discovery:
//   1. Fetch the GZ homepage (contains ~28 featured event URLs in data-* attributes)
//   2. Fetch each known location page (each has 2-10 event hrefs)
//   3. Deduplicate and process each unique event URL
//
// Per-event page structure:
//   – Post ID in body class: "postid-XXXX"
//   – Title: <h1>
//   – Date table: <tr><td>Weekday.</td><td>DD.MM.YYYY</td><td>HH:MM-HH:MM</td></tr>
//   – <h3>Daten</h3><p>…</p>          schedule description
//   – <h3>Ort</h3><p>…</p>            venue + address
//   – <h3>Kosten</h3><p>…</p>         price
//   – <h3>Besondere Hinweise</h3><p>…</p>  age / target group
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const BASE_URL   = "https://gz-zh.ch";

// Known GZ location slugs (verified from standorte page + live crawl)
const GZ_LOCATIONS = [
  "gz-affoltern", "gz-bachwiesen", "gz-buchegg", "gz-heuried",
  "gz-hirzenbach", "gz-hoengg", "gz-hottingen", "gz-leimbach",
  "gz-loogarten", "gz-neubuehl", "gz-oerlikon", "gz-riesbach",
  "gz-schindlergut", "gz-seebach", "gz-wipkingen", "gz-witikon", "gz-waidbach",
];

const FETCH_HEADERS = { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" };

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")   // preserve line-breaks for venue parsing
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#8211;/g, "–").replace(/&#8230;/g, "…")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** Extract text after a German <h3> heading keyword. */
function extractH3Section(html: string, keyword: string): string | null {
  const rx = new RegExp(
    `<h3[^>]*>\\s*${keyword}[^<]*</h3>\\s*<p>(.*?)</p>`,
    "is",
  );
  const m = rx.exec(html);
  return m ? stripHtml(m[1]) : null;
}

// ─── Date parsing ─────────────────────────────────────────────────────────────

const DE_MONTHS: Record<string, string> = {
  januar: "01", februar: "02", märz: "03", "marz": "03", april: "04",
  mai: "05", juni: "06", juli: "07", august: "08",
  september: "09", oktober: "10", november: "11", dezember: "12",
};

function parseDeDate(str: string): string | null {
  // Numeric: 15.06.2026 or 15.6.2026
  const num = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (num) {
    const [, d, mo, y] = num;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Word: 15. Juni 2026
  const word = str.toLowerCase().match(
    /(\d{1,2})\.\s*(januar|februar|m[äa]rz|april|mai|juni|juli|august|september|oktober|november|dezember)\s*(\d{4})/,
  );
  if (word) {
    const [, d, mon, y] = word;
    const mo = DE_MONTHS[mon] ?? DE_MONTHS[mon.replace("ä","a")] ?? null;
    return mo ? `${y}-${mo}-${d.padStart(2, "0")}` : null;
  }
  return null;
}

/** Return true if ISO date string >= today. */
function isFutureOrToday(iso: string): boolean {
  return iso >= new Date().toISOString().slice(0, 10);
}

/**
 * Extract the first upcoming date from the dates table.
 * Table rows: <tr><td>Mo.</td><td>10.06.2026</td><td>09:30–11:30 Uhr</td></tr>
 */
function extractFirstUpcomingDate(html: string): string | null {
  const rows = html.matchAll(/<tr>\s*<td>[A-Za-z]+\.<\/td>\s*<td>(\d{1,2}\.\d{1,2}\.\d{4})<\/td>/g);
  for (const row of rows) {
    const iso = parseDeDate(row[1]);
    if (iso && isFutureOrToday(iso)) return iso;
  }
  return null;
}

/**
 * Extract the next date from the data-dates attribute on "Alle Daten anzeigen".
 * Format: "Mo.15.06.202609:30–11:30 Uhr..."
 */
function extractDateFromDataAttr(html: string): string | null {
  const m = html.match(/data-[a-z-]+="[^"]*?(\d{2}\.\d{2}\.\d{4})/);
  if (m) {
    const iso = parseDeDate(m[1]);
    if (iso && isFutureOrToday(iso)) return iso;
  }
  return null;
}

// ─── Price / Age parsing ──────────────────────────────────────────────────────

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

// ─── URL Discovery ────────────────────────────────────────────────────────────

/** Extract all /gz-*/angebote/* URLs from a page's HTML. */
function extractEventUrls(html: string): string[] {
  const urls = new Set<string>();
  // From href attributes
  for (const m of html.matchAll(/href="(https:\/\/gz-zh\.ch\/gz-[^/]+\/angebote\/[^"]+)"/g)) {
    urls.add(m[1]);
  }
  // From data-* attributes
  for (const m of html.matchAll(/data-[a-z-]+="(https:\/\/gz-zh\.ch\/gz-[^/]+\/angebote\/[^"]+)"/g)) {
    urls.add(m[1]);
  }
  return [...urls];
}

async function discoverEventUrls(): Promise<string[]> {
  const all = new Set<string>();

  const fetchHtml = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, { headers: FETCH_HEADERS });
      return res.ok ? await res.text() : null;
    } catch {
      return null;
    }
  };

  // 1. Homepage
  const homeHtml = await fetchHtml(BASE_URL);
  if (homeHtml) extractEventUrls(homeHtml).forEach(u => all.add(u));

  // 2. Each location page
  await Promise.all(
    GZ_LOCATIONS.map(async (loc) => {
      const html = await fetchHtml(`${BASE_URL}/${loc}/`);
      if (html) extractEventUrls(html).forEach(u => all.add(u));
    }),
  );

  return [...all];
}

// ─── Event page parser ────────────────────────────────────────────────────────

interface ParsedEvent {
  postId:      string;
  title:       string;
  description: string | null;
  datum:       string | null;
  ort:         string;
  preisCHF:    number | null;
  alterVon:    number;
  alterBis:    number;
  url:         string;
  locationSlug: string;
}

async function parseEventPage(url: string): Promise<ParsedEvent | null> {
  let html: string;
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // Post ID as stable identifier (not stored directly — anmelde_link is the dedup key)
  const postIdM = html.match(/postid-(\d+)/);
  if (!postIdM) return null;
  const postId = postIdM[1];

  // Title from <h1>
  const titleM = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  const title = titleM ? stripHtml(titleM[1]).slice(0, 200) : "";
  if (!title) return null;

  // First upcoming date from date table or data attribute
  const datum = extractFirstUpcomingDate(html) ?? extractDateFromDataAttr(html);

  // Location from H3 "Ort" section — first line is the venue name
  const ortSection = extractH3Section(html, "Ort");
  const locationSlugM = url.match(/gz-zh\.ch\/(gz-[^/]+)\//);
  const locationSlug  = locationSlugM?.[1] ?? "";
  const locationName  = locationSlug
    .replace("gz-", "GZ ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
  const ort = ortSection
    ? ortSection.split(/[\n\r,]/)[0].trim().slice(0, 200)
    : locationName;

  // Price from H3 "Kosten"
  const kostenSection = extractH3Section(html, "Kosten");
  const preisCHF      = parsePreisCHF(kostenSection);

  // Age from H3 "Besondere Hinweise" or "Zielgruppe"
  const hinweisSection = extractH3Section(html, "Besondere Hinweise")
    ?? extractH3Section(html, "Zielgruppe");

  // Description: Daten section + intro text
  const datenSection = extractH3Section(html, "Daten");
  const description  = [datenSection, hinweisSection].filter(Boolean).join(" | ").slice(0, 1000) || null;

  const { min: alterVon, max: alterBis } = parseAgeRange(hinweisSection ?? description);

  return {
    postId,
    title,
    description,
    datum,
    ort,
    preisCHF,
    alterVon,
    alterBis,
    url,
    locationSlug,
  };
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

    // 1. Discover all event URLs
    const eventUrls = await discoverEventUrls();

    // 2. Parse each event page (with concurrency limit)
    const CONCURRENCY = 5;
    const parsed: ParsedEvent[] = [];

    for (let i = 0; i < eventUrls.length; i += CONCURRENCY) {
      const batch = eventUrls.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(parseEventPage));
      for (const r of results) {
        if (r) parsed.push(r);
      }
    }

    // 3. Build DB rows — skip events with no upcoming date
    const rows = parsed
      .filter(p => p.datum !== null)
      .map(p => {
        const fullText       = `${p.title} ${p.description ?? ""}`;
        const kategorien     = inferCategories(fullText);
        const alters_buckets = ageToBuckets(p.alterVon, p.alterBis);

        return {
          titel:           p.title,
          beschreibung:    p.description,
          datum:           p.datum,
          datum_ende:      null,
          ort:             p.ort,
          anmelde_link:    p.url,
          quelle_url:      p.url,
          preis_chf:       p.preisCHF,
          alter_von:       p.alterVon,
          alter_bis:       p.alterBis,
          kategorien:      kategorien.length ? kategorien : ["Ausflug"],
          alters_buckets:  alters_buckets.length ? alters_buckets : ["4-6", "7-9"],
          indoor_outdoor:  inferIndoorOutdoor(fullText),
          event_typ:       "event",
          status:          "approved",
        };
      });

    const summary = {
      urlsDiscovered: eventUrls.length,
      parsed:         parsed.length,
      withDate:       rows.length,
      source:         BASE_URL,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
        { headers: jsonHeaders },
      );
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ...summary, inserted: 0, message: "no events with dates" }),
        { headers: jsonHeaders },
      );
    }

    // 4. Upsert
    const BATCH = 50;
    let inserted   = 0;
    let duplicates = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("events")
        .upsert(batch, { onConflict: "anmelde_link", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("scrape-gz-zuerich batch upsert error:", error);
        for (const row of batch) {
          const { data: s, error: rowErr } = await supabase
            .from("events")
            .upsert(row, { onConflict: "anmelde_link", ignoreDuplicates: true })
            .select("id");
          if (rowErr) console.error("scrape-gz-zuerich row upsert error:", rowErr, row.anmelde_link);
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

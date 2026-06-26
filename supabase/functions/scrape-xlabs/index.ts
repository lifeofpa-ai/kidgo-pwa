// Scrapes xlabs.ch for holiday coding camps (Ferienkurse) in Zürich.
//
// Source:   https://xlabs.ch/de/zuerich/ferienkurse
// Method:   JSON-LD extraction from listing page + individual course pages.
//           Falls back to checking /de/zuerich/ferienkurse/ and /de/kurse/zuerich/.
//
// Filter:   Future dates only (2023 archive entries are excluded)
// event_typ: "camp"
// Location: Büttenweg 16, 8050 Zürich (X Labs Zürich)
//
// Duplicate check: external_source="xlabs" + external_id (URL slug + start date)
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories } from "../_shared/category-map.ts";

const SOURCE_KEY   = "xlabs";
const BASE_URL     = "https://xlabs.ch";
const ORT          = "X Labs Zürich, Büttenweg 16, 8050 Zürich";

// Try listing URL variants in order
const LISTING_URLS = [
  `${BASE_URL}/de/zuerich/ferienkurse`,
  `${BASE_URL}/de/zuerich/ferienkurse/`,
  `${BASE_URL}/de/kurse/zuerich/`,
  `${BASE_URL}/de/zuerich/`,
];

const FETCH_HEADERS = { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim();
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

function parseIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function isFutureOrToday(iso: string): boolean {
  return iso >= new Date().toISOString().slice(0, 10);
}

function parsePreisCHF(text: string): number | null {
  const t = String(text).toLowerCase();
  if (/gratis|kostenlos/.test(t)) return 0;
  const m = t.match(/chf\s*([\d.,]+)|fr\.?\s*([\d.,]+)|([\d.,]+)\s*(?:chf|fr\.?)\b/i);
  if (m) {
    const raw = (m[1] ?? m[2] ?? m[3] ?? "").replace(",", ".");
    const n = parseFloat(raw);
    return isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function parseAgeRange(text: string): { min: number; max: number } {
  const rangeM = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:jahre?|j\.?\b|years?)/i);
  if (rangeM) {
    return { min: parseInt(rangeM[1]), max: Math.min(parseInt(rangeM[2]), 18) };
  }
  const abM = text.match(/ab\s*(\d+)\s*(?:jahre?|j\.?\b)/i);
  if (abM) return { min: parseInt(abM[1]), max: 16 };
  return { min: 8, max: 16 };  // typical X Labs target range
}

// ─── JSON-LD extraction ───────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type JsonLd = Record<string, any>;

function extractJsonLd(html: string): JsonLd[] {
  const results: JsonLd[] = [];
  const rx = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (Array.isArray(obj)) results.push(...obj);
      else results.push(obj);
    } catch { /* skip malformed */ }
  }
  return results;
}

const EVENT_TYPES = new Set([
  "Event", "EducationEvent", "Course", "CourseInstance",
  "SportsEvent", "SocialEvent", "BusinessEvent",
]);

function findEventItem(items: JsonLd[]): JsonLd | null {
  for (const item of items) {
    if (EVENT_TYPES.has(item["@type"])) return item;
    if (Array.isArray(item["@graph"])) {
      const found = findEventItem(item["@graph"]);
      if (found) return found;
    }
  }
  return null;
}

/** Collect all Event/Course items from an ItemList or flat array. */
function collectAllEvents(items: JsonLd[]): JsonLd[] {
  const found: JsonLd[] = [];
  for (const item of items) {
    if (EVENT_TYPES.has(item["@type"])) {
      found.push(item);
    } else if (item["@type"] === "ItemList" && Array.isArray(item.itemListElement)) {
      for (const el of item.itemListElement) {
        const sub = el.item ?? el;
        if (sub && EVENT_TYPES.has(sub["@type"])) found.push(sub);
      }
    } else if (Array.isArray(item["@graph"])) {
      found.push(...collectAllEvents(item["@graph"]));
    }
  }
  return found;
}

// ─── Course parsing ───────────────────────────────────────────────────────────

interface CourseRow {
  externalId:  string;
  title:       string;
  description: string | null;
  datum:       string;
  datumEnde:   string | null;
  preisCHF:    number | null;
  alterVon:    number;
  alterBis:    number;
  url:         string;
}

function parseEventItem(item: JsonLd, pageUrl: string): CourseRow | null {
  const title = typeof item.name === "string" ? item.name.trim().slice(0, 200) : "";
  if (!title) return null;

  let startDate: string | null = parseIsoDate(item.startDate);
  let endDate: string | null   = parseIsoDate(item.endDate);

  // Course type: look for future CourseInstance
  if (!startDate && item.hasCourseInstance) {
    const instances: JsonLd[] = Array.isArray(item.hasCourseInstance)
      ? item.hasCourseInstance
      : [item.hasCourseInstance];
    for (const inst of instances) {
      const d = parseIsoDate(inst.startDate);
      if (d && isFutureOrToday(d)) {
        startDate = d;
        endDate   = parseIsoDate(inst.endDate);
        break;
      }
    }
  }

  if (!startDate || !isFutureOrToday(startDate)) return null;

  const rawDesc   = typeof item.description === "string" ? item.description : "";
  const desc      = rawDesc ? stripHtml(rawDesc).slice(0, 1000) : null;
  const fullText  = `${title} ${desc ?? ""}`;

  // Price from offers
  let preisCHF: number | null = null;
  if (item.offers) {
    const offers: JsonLd[] = Array.isArray(item.offers) ? item.offers : [item.offers];
    for (const o of offers) {
      if (typeof o.price === "number") { preisCHF = o.price; break; }
      if (typeof o.price === "string") { preisCHF = parsePreisCHF(o.price); break; }
    }
  }
  // Fall back to parsing from description
  if (preisCHF === null && desc) preisCHF = parsePreisCHF(desc);

  const { min: alterVon, max: alterBis } = parseAgeRange(fullText);

  // Stable external ID: URL slug + start date avoids clashes when same slug runs again
  const slugM      = pageUrl.match(/\/([^/?#]+)\/?(?:[?#].*)?$/);
  const slug       = slugM?.[1] ?? title.slice(0, 30).replace(/\W+/g, "-").toLowerCase();
  const externalId = `${slug}-${startDate}`;

  return {
    externalId,
    title,
    description: desc,
    datum:    startDate,
    datumEnde: endDate,
    preisCHF,
    alterVon,
    alterBis,
    url: (typeof item.url === "string" && item.url.startsWith("http"))
      ? item.url
      : pageUrl,
  };
}

// ─── URL discovery ────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Extract course detail page links from the listing HTML. */
function extractCourseLinks(html: string, listingUrl: string): string[] {
  const links = new Set<string>();
  const patterns = [
    // Deep course pages under zuerich
    /href="((?:https?:\/\/xlabs\.ch)?\/de\/zuerich\/[^"#?\/][^"#?]*)"/gi,
    // Ferienkurs pages
    /href="((?:https?:\/\/xlabs\.ch)?\/de\/[^"#?]*ferienkurs[^"#?]*)"/gi,
  ];
  for (const rx of patterns) {
    for (const m of html.matchAll(rx)) {
      const href = m[1];
      const abs  = href.startsWith("http") ? href : `${BASE_URL}${href}`;
      // Skip the listing page itself and parent paths
      if (abs === listingUrl || abs === `${listingUrl}/`) continue;
      if (LISTING_URLS.some(u => abs === u || abs === `${u}/`)) continue;
      links.add(abs);
    }
  }
  return [...links];
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

    // 1. Fetch the listing page (try URL variants)
    let listingHtml: string | null = null;
    let listingUrl  = LISTING_URLS[0];

    for (const url of LISTING_URLS) {
      listingHtml = await fetchHtml(url);
      if (listingHtml) { listingUrl = url; break; }
    }

    if (!listingHtml) {
      return new Response(
        JSON.stringify({ error: "Could not fetch X Labs Ferienkurse listing page" }),
        { status: 502, headers: jsonHeaders },
      );
    }

    // 2. Extract JSON-LD from listing page
    const listingJsonLd   = extractJsonLd(listingHtml);
    const listingEvents   = collectAllEvents(listingJsonLd);
    const listingCourses  = listingEvents
      .map(item => parseEventItem(item, item.url ?? listingUrl))
      .filter((r): r is CourseRow => r !== null);

    // 3. Discover and crawl individual course pages
    const courseUrls    = extractCourseLinks(listingHtml, listingUrl);
    const CONCURRENCY   = 5;
    const pageCourses: CourseRow[] = [];

    for (let i = 0; i < courseUrls.length; i += CONCURRENCY) {
      const batch   = courseUrls.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(async (url) => {
        const html = await fetchHtml(url);
        if (!html) return null;
        const found = findEventItem(extractJsonLd(html));
        return found ? parseEventItem(found, url) : null;
      }));
      for (const r of results) if (r) pageCourses.push(r);
    }

    // 4. Merge, page-level rows win over listing-level rows
    const byId = new Map<string, CourseRow>();
    for (const r of [...listingCourses, ...pageCourses]) byId.set(r.externalId, r);
    const parsed = [...byId.values()];

    // 5. Build DB rows
    const rows = parsed.map(p => {
      const fullText       = `${p.title} ${p.description ?? ""}`;
      const kategorien     = inferCategories(fullText);
      const alters_buckets = ageToBuckets(p.alterVon, p.alterBis);

      return {
        external_id:     p.externalId,
        external_source: SOURCE_KEY,
        titel:           p.title,
        beschreibung:    p.description,
        datum:           p.datum,
        datum_ende:      p.datumEnde,
        ort:             ORT,
        anmelde_link:    p.url,
        preis_chf:       p.preisCHF,
        alter_von:       p.alterVon,
        alter_bis:       p.alterBis,
        kategorien:      kategorien.length ? kategorien : ["Wissenschaft", "Bildung"],
        alters_buckets:  alters_buckets.length ? alters_buckets : ["7-9", "10-12"],
        indoor_outdoor:  "indoor" as const,
        event_typ:       "camp",
        status:          "approved",
      };
    });

    const summary = {
      listingUrl,
      courseUrlsFound: courseUrls.length,
      parsed:          parsed.length,
      rows:            rows.length,
      source:          BASE_URL,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
        { headers: jsonHeaders },
      );
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ...summary, inserted: 0, message: "no upcoming camps found" }),
        { headers: jsonHeaders },
      );
    }

    // 6. Upsert in batches
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
    console.error("scrape-xlabs fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

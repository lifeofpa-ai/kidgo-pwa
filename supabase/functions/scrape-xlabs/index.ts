// Scrapes xlabs.ch for holiday coding/science camps (Ferienkurse) in Zürich.
// Bundled single-file deploy (shared cors/category-map helpers inlined) —
// matches the deploy convention used by scrape-gz-zuerich / scrape-sport-events.
//
// Source:   https://xlabs.ch/de/zuerich/ferienkurse
// Method:   JSON-LD extraction (Event/EducationEvent/Course items).
//
// Dedup:    anmelde_link (unique index events_anmelde_link_unique).
//           FIX (2026-07-02): the previous deployed version fell back to the bare
//           listing/base URL when item.url was missing, so distinct courses could
//           collapse onto the same anmelde_link and silently stop importing after
//           the first insert. Now every event gets a stable, unique anmelde_link
//           via a content hash fragment when no real course URL is present.
// Age:      sets altersgruppen (not just alter_von/alter_bis) because
//           normalize_age_on_upsert trigger derives alter_von/alter_bis/alters_buckets
//           FROM altersgruppen on every INSERT and overwrites direct alter_von/alter_bis
//           with NULL if altersgruppen is empty.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron. Optional body { dryRun: true }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const KEYWORD_MAP: Array<[string, RegExp]> = [
  ["Kreativ",      /\b(basteln|malen|kreativ|workshop|werkstatt|atelier|zeichnen|kunst)\b/i],
  ["Sport",        /\b(sport|fussball|fußball|hockey|schwimmen|klettern|turnen|velo|skating|kletter|baseball|tennis)\b/i],
  ["Theater",      /\b(theater|puppen|figuren|schauspiel|bühne)\b/i],
  ["Musik",        /\b(musik|konzert|gesang|chor|instrument)\b/i],
  ["Wissenschaft", /\b(experiment|technik|forscher|robotik|wissenschaft|naturwissenschaft|robot|coding|programm|chemi|physik|science)\b/i],
  ["Bildung",      /\b(lesen|geschichte|lernen|sprache|bildung|führung|vortrag)\b/i],
];
function inferCategories(text: string): string[] {
  const found = new Set<string>();
  for (const [cat, rx] of KEYWORD_MAP) if (rx.test(text)) found.add(cat);
  if (!found.size) { found.add("Wissenschaft"); found.add("Bildung"); }
  return [...found];
}
function stripHtml(h: string): string {
  return h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h).toString(36);
}

const BASE_URL = "https://xlabs.ch";
const ORT      = "X Labs Zürich, Büttenweg 16, 8050 Zürich";
const URLS = [
  `${BASE_URL}/de/zuerich/ferienkurse`,
  `${BASE_URL}/de/zuerich`,
  `${BASE_URL}/de/zuerich/kurse`,
];
const FETCH_HEADERS = { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" };
const EVENT_TYPES = new Set(["Event", "EducationEvent", "Course", "CourseInstance"]);

// deno-lint-ignore no-explicit-any
type JsonLd = Record<string, any>;

function parsePreisCHF(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") { const n = parseFloat(v.replace(",", ".")); return isFinite(n) ? n : null; }
  return null;
}
function parseAgeRange(text: string): { min: number; max: number } {
  const rangeM = text.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:jahre?|j\.?\b|years?)/i);
  if (rangeM) return { min: parseInt(rangeM[1]), max: Math.min(parseInt(rangeM[2]), 18) };
  const abM = text.match(/ab\s*(\d+)\s*(?:jahre?|j\.?\b)/i);
  if (abM) return { min: parseInt(abM[1]), max: 16 };
  return { min: 8, max: 16 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let dryRun = false;
  if (req.method === "POST") { try { dryRun = !!(await req.json()).dryRun; } catch { /* body optional */ } }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString().slice(0, 10);
    const stats = { urls_tried: 0, jsonld_found: 0, skipped_past: 0, rows: 0 };

    let html = "";
    let listingUrl = URLS[0];
    for (const url of URLS) {
      stats.urls_tried++;
      try {
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.includes("application/ld+json")) { html = text; listingUrl = url; break; }
      } catch { /* try next */ }
    }

    if (!html) {
      return new Response(JSON.stringify({ error: "Could not fetch X Labs Ferienkurse listing page" }), { status: 502, headers: jsonHeaders });
    }

    const rows: Record<string, unknown>[] = [];
    const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

    for (const block of ldBlocks) {
      const jsonStr = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
      let ld: JsonLd;
      try { ld = JSON.parse(jsonStr); } catch { continue; }
      const items: JsonLd[] = ld["@graph"] ?? (Array.isArray(ld) ? ld : [ld]);

      for (const item of items) {
        if (!EVENT_TYPES.has(item["@type"])) continue;
        const title = typeof item.name === "string" ? item.name.trim() : "";
        if (!title || title.length < 3) continue;
        stats.jsonld_found++;

        let datum: string | null = item.startDate ? String(item.startDate).split("T")[0] : null;
        let datumEnde: string | null = item.endDate ? String(item.endDate).split("T")[0] : null;

        if (!datum && item.hasCourseInstance) {
          const instances = Array.isArray(item.hasCourseInstance) ? item.hasCourseInstance : [item.hasCourseInstance];
          for (const inst of instances) {
            const sd = inst.startDate ? String(inst.startDate).split("T")[0] : null;
            if (sd && sd >= now) { datum = sd; datumEnde = inst.endDate ? String(inst.endDate).split("T")[0] : null; break; }
          }
        }
        if (!datum || datum < now) { stats.skipped_past++; continue; }

        const desc = stripHtml(typeof item.description === "string" ? item.description : "").slice(0, 1000);
        let preisCHF: number | null = null;
        if (item.offers) {
          const offers = Array.isArray(item.offers) ? item.offers : [item.offers];
          for (const o of offers) { const p = parsePreisCHF(o?.price); if (p !== null) { preisCHF = p; break; } }
        }

        const { min: alterVon, max: alterBis } = parseAgeRange(`${title} ${desc}`);
        const fullText   = `${title} ${desc}`;
        const kategorien = inferCategories(fullText);

        const stableId = djb2(`${title}|${datum}`);
        const eventUrl = (typeof item.url === "string" && item.url.startsWith("http"))
          ? item.url
          : `${listingUrl}#xlabs-${stableId}`;

        rows.push({
          titel:           title.slice(0, 200),
          beschreibung:    desc || null,
          datum,
          datum_ende:      datumEnde,
          ort:             ORT,
          anmelde_link:    eventUrl,
          quelle_url:      eventUrl,
          preis_chf:       preisCHF,
          altersgruppen:   [`${alterVon}-${Math.min(alterBis, 12)} Jahre`],
          kategorien,
          indoor_outdoor:  "indoor",
          event_typ:       "camp",
          status:          "approved",
          scrape_datum:    new Date().toISOString(),
        });
      }
    }

    stats.rows = rows.length;
    const summary = { listingUrl, ...stats };

    if (dryRun) {
      return new Response(JSON.stringify({ ...summary, sample: rows.slice(0, 5) }), { headers: jsonHeaders });
    }
    if (!rows.length) {
      return new Response(JSON.stringify({ ...summary, inserted: 0, message: "no upcoming camps found" }), { headers: jsonHeaders });
    }

    const BATCH = 50;
    let inserted = 0, duplicates = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase.from("events").upsert(batch, { onConflict: "anmelde_link", ignoreDuplicates: true }).select("id");
      if (error) {
        console.error("scrape-xlabs batch upsert error:", error);
        for (const row of batch) {
          const { data: s, error: rowErr } = await supabase.from("events").upsert(row, { onConflict: "anmelde_link", ignoreDuplicates: true }).select("id");
          if (rowErr) console.error("scrape-xlabs row upsert error:", rowErr, row.anmelde_link);
          inserted += s?.length ?? 0;
        }
        continue;
      }
      const batchNew = data?.length ?? 0;
      inserted += batchNew;
      duplicates += batch.length - batchNew;
    }

    return new Response(JSON.stringify({ ...summary, inserted, duplicates }), { headers: jsonHeaders });
  } catch (err) {
    console.error("scrape-xlabs fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});

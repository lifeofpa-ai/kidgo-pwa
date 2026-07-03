// Scrapes bybalzer.ch (Coop Kindermusicals) for children's theater events in ZH.
// Bundled single-file deploy (shared cors/category-map helpers inlined) —
// matches the deploy convention used by scrape-gz-zuerich / scrape-sport-events.
//
// Source:   https://bybalzer.ch
// Method:   HTML microdata – schema.org Event items (<li itemscope itemtype="…/Event">)
//
// Dedup:    anmelde_link (unique index events_anmelde_link_unique).
//           FIX (2026-07-02): the previous deployed version fell back to the bare
//           listing URL whenever no per-event ticket link was found, so every event
//           collapsed onto the SAME anmelde_link and only the first one ever inserted
//           (all others silently became "duplicates" against that one row forever).
//           Now every event gets a stable, unique anmelde_link via a content hash
//           fragment when no real ticket link is present.
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
  ["Natur",        /\b(natur|wald|garten|park|wandern|outdoor|spielplatz)\b/i],
  ["Tiere",        /\b(tier|zoo|bauernhof|reiten|pony|aquarium)\b/i],
  ["Sport",        /\b(sport|fussball|fußball|hockey|schwimmen|klettern|turnen|velo|skating|kletter|baseball|tennis)\b/i],
  ["Tanz",         /\b(tanz|ballet|hip[- ]?hop|breakdance)\b/i],
  ["Theater",      /\b(theater|puppen|figuren|schauspiel|bühne)\b/i],
  ["Musik",        /\b(musik|konzert|gesang|chor|instrument)\b/i],
  ["Wissenschaft", /\b(experiment|technik|forscher|robotik|wissenschaft|naturwissenschaft)\b/i],
  ["Bildung",      /\b(lesen|geschichte|lernen|sprache|bildung|führung|vortrag)\b/i],
  ["Ausflug",      /\b(ausflug|wanderung|tagestrip|exkursion|besuch)\b/i],
  ["Feriencamp",   /\b(camp|ferienlager|ferien[- ]?pass)\b/i],
];
function inferCategories(text: string): string[] {
  const found = new Set<string>();
  for (const [cat, rx] of KEYWORD_MAP) if (rx.test(text)) found.add(cat);
  return [...found];
}
function inferIndoorOutdoor(text: string): "indoor" | "outdoor" | null {
  if (/\b(spielplatz|park|garten|outdoor|draußen|freibad|wald|wandern|ausflug)\b/i.test(text)) return "outdoor";
  if (/\b(indoor|drinnen|hallenbad|theater|museum|bibliothek|kino)\b/i.test(text)) return "indoor";
  return null;
}

const BASE_URL = "https://bybalzer.ch";
const LISTING_URLS = [
  `${BASE_URL}/spielplan/`,
  `${BASE_URL}/veranstaltungen/`,
  `${BASE_URL}/programm/`,
  `${BASE_URL}/`,
];
const FETCH_HEADERS = { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" };
const ZH_VENUES = /zürich|maag.*halle|theater\s*11|bernhard.*theater|opernhaus|tonhalle|volkshaus|hallenstadion|samsung.*hall|x-tra|kaufleuten|moods|plaza|casinotheater|winterthur|uster|kloten|stäfa|illnau|effretikon|bäretswil|schluefweg/i;

function stripHtml(h: string): string {
  return h.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h).toString(36);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let dryRun = false;
  if (req.method === "POST") { try { dryRun = !!(await req.json()).dryRun; } catch { /* body optional */ } }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date().toISOString().slice(0, 10);
    const stats = { urls_tried: 0, events_found: 0, skipped_location: 0, skipped_past: 0, rows: 0 };

    let html = "";
    let sourceUrl = LISTING_URLS[0];
    for (const url of LISTING_URLS) {
      stats.urls_tried++;
      try {
        const res = await fetch(url, { headers: FETCH_HEADERS });
        if (!res.ok) continue;
        const text = await res.text();
        if (text.includes("itemscope") && text.includes("Event")) { html = text; sourceUrl = url; break; }
      } catch { /* try next */ }
    }

    if (!html) {
      return new Response(JSON.stringify({ error: "Could not find microdata Event page on bybalzer.ch" }), { status: 502, headers: jsonHeaders });
    }

    // Split on Event microdata blocks
    const blocks = html.split(/itemtype=["']https?:\/\/schema\.org\/Event["']/i);
    const rows: Record<string, unknown>[] = [];

    for (let i = 1; i < blocks.length; i++) {
      const block = (blocks[i].split(/itemtype=/i)[0]) || blocks[i];
      const getProp = (name: string): string => {
        const m =
          block.match(new RegExp(`itemprop=["']${name}["'][^>]*content=["']([^"']+)`, "i")) ||
          block.match(new RegExp(`itemprop=["']${name}["'][^>]*datetime=["']([^"']+)`, "i")) ||
          block.match(new RegExp(`itemprop=["']${name}["'][^>]*>([^<]+)`, "i"));
        return m ? stripHtml(m[1]) : "";
      };

      const title = getProp("name");
      if (!title || title.length < 3) continue;
      stats.events_found++;

      const startDate = getProp("startDate");
      const endDate   = getProp("endDate");
      const location  = getProp("location") || getProp("address");
      const desc      = getProp("description");

      if (location && !ZH_VENUES.test(location)) { stats.skipped_location++; continue; }

      const datum = startDate ? startDate.split("T")[0] : null;
      if (datum && datum < now) { stats.skipped_past++; continue; }

      // Real ticket link if present, else a per-event unique fallback URL
      const ticketM =
        block.match(/<a[^>]+href=["'](https?:[^"']+)["'][^>]*>[^<]*(?:ticket|kauf|buy|book|bestell)[^<]*<\/a>/i) ||
        block.match(/itemprop=["']url["'][^>]*href=["']([^"']+)/i) ||
        block.match(/<a[^>]+href=["'](https?:[^"']+)["']/i);
      const venue    = (location || "Zürich").trim().slice(0, 200);
      const stableId = djb2(`${title}|${datum ?? ""}|${venue}`);
      const anmeldeLink = ticketM ? ticketM[1] : `${sourceUrl}#bybalzer-${stableId}`;

      const fullText   = `${title} ${desc}`;
      const kategorien = inferCategories(fullText);

      rows.push({
        titel:           title.slice(0, 200),
        beschreibung:    desc ? desc.slice(0, 1000) : null,
        datum,
        datum_ende:      endDate ? endDate.split("T")[0] : null,
        ort:             venue,
        anmelde_link:    anmeldeLink,
        quelle_url:      anmeldeLink,
        preis_chf:       null,
        altersgruppen:   ["3-12 Jahre"],
        kategorien:      kategorien.length ? kategorien : ["Theater", "Musik"],
        indoor_outdoor:  inferIndoorOutdoor(fullText) ?? "indoor",
        event_typ:       "event",
        status:          "approved",
        scrape_datum:    new Date().toISOString(),
      });
    }

    stats.rows = rows.length;
    const summary = { sourceUrl, ...stats };

    if (dryRun) {
      return new Response(JSON.stringify({ ...summary, sample: rows.slice(0, 5) }), { headers: jsonHeaders });
    }
    if (!rows.length) {
      return new Response(JSON.stringify({ ...summary, inserted: 0, message: "no upcoming ZH events found" }), { headers: jsonHeaders });
    }

    const BATCH = 50;
    let inserted = 0, duplicates = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase.from("events").upsert(batch, { onConflict: "anmelde_link", ignoreDuplicates: true }).select("id");
      if (error) {
        console.error("scrape-bybalzer batch upsert error:", error);
        for (const row of batch) {
          const { data: s, error: rowErr } = await supabase.from("events").upsert(row, { onConflict: "anmelde_link", ignoreDuplicates: true }).select("id");
          if (rowErr) console.error("scrape-bybalzer row upsert error:", rowErr, row.anmelde_link);
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
    console.error("scrape-bybalzer fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});

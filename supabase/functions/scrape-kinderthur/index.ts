// Scrapes kinderthur.ch for children's events in Winterthur.
//
// QA-Fix 2026-07-03: the previously DEPLOYED version (v1) regex-matched
// TT.MM.JJJJ anywhere in the WP REST API's content.rendered field. That field
// is free-text description only and almost never contains a date, so 533 of
// 534 events ended up with datum = NULL. The real date lives in schema.org
// JSON-LD/microdata Event markup on each event's own detail page
// ("startDate"/"endDate", format "2026-9-6T13:00+2:00", not zero-padded).
// This bundled version (matching this project's deploy convention: shared
// helpers inlined, not imported from ../_shared/) fetches each candidate's
// detail page for the real date instead of guessing from listing content.
//
// v2->v3 fix: WP API's class_list field is an ARRAY of strings, not a single
// string -- extractVenue()/parseAgeMin() crashed calling .match() on an array.
//
// Dedup: external_source/external_id (unique index events_external_uniq).
//
// Backfill note: existing rows inserted by v1 (datum NULL) were fixed via a
// one-off function `backfill-kinderthur-dates` (Supabase-only, not in this
// repo -- same convention as backfill-gz-zuerich-ages). ~88% fixed in one
// session; kinderthur.ch started rate-limiting after ~450 detail-page fetches,
// remainder will self-heal as this scraper's weekly cron re-visits recently
// modified events.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Trigger: HTTP POST or cron (kinderthur-weekly, Mo 04:30 UTC).
// Optional body { dryRun: true, limit: number }.

import { createClient } from "npm:@supabase/supabase-js@2";

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

const BASE_URL = "https://www.kinderthur.ch";
const API_BASE = `${BASE_URL}/wp-json/wp/v2`;
const FETCH_HEADERS = { "User-Agent": "KidgoBot/1.0 (+https://kidgo.ch)" };

interface AjdeEvent {
  id: number;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  class_list?: string[] | string;
}

function classListToStr(cl: string[] | string | undefined): string {
  if (!cl) return "";
  return Array.isArray(cl) ? cl.join(" ") : cl;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim();
}

function parseAjdeDate(raw: string): string | null {
  const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
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
    { label: "0-3", lo: 0, hi: 3 },
    { label: "4-6", lo: 4, hi: 6 },
    { label: "7-9", lo: 7, hi: 9 },
    { label: "10-12", lo: 10, hi: 12 },
  ].filter((b) => b.lo <= max && b.hi >= min).map((b) => b.label);
}

function extractVenue(classLst: string, fallback: string): string {
  const m = classLst.match(/event_location-([a-z0-9-]+)/);
  if (!m) return fallback;
  return m[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchRecentEvents(limit: number): Promise<AjdeEvent[]> {
  const all: AjdeEvent[] = [];
  let page = 1;
  const PER_PAGE = 100;
  while (all.length < limit) {
    const res = await fetch(
      `${API_BASE}/ajde_events?status=publish&per_page=${PER_PAGE}&page=${page}` +
      `&orderby=modified&order=desc&_fields=id,link,title,content,class_list`,
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

interface EventDates { startDate: string | null; endDate: string | null }

async function fetchEventDates(url: string): Promise<EventDates> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) return { startDate: null, endDate: null };
    const html = await res.text();
    const s = html.match(/itemprop=['"]startDate['"][^>]*content=["']([^"']+)["']/i);
    const e = html.match(/itemprop=['"]endDate['"][^>]*content=["']([^"']+)["']/i);
    return {
      startDate: s ? parseAjdeDate(s[1]) : null,
      endDate: e ? parseAjdeDate(e[1]) : null,
    };
  } catch {
    return { startDate: null, endDate: null };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let dryRun = false;
  let limit = 200;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      dryRun = !!body.dryRun;
      if (body.limit) limit = Math.min(Number(body.limit), 500);
    } catch { /* body optional */ }
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const ajdeEvents = await fetchRecentEvents(limit);

    const CONCURRENCY = 8;
    const withDates: Array<AjdeEvent & EventDates> = [];
    for (let i = 0; i < ajdeEvents.length; i += CONCURRENCY) {
      const batch = ajdeEvents.slice(i, i + CONCURRENCY);
      const dates = await Promise.all(batch.map((ev) => fetchEventDates(ev.link)));
      for (let j = 0; j < batch.length; j++) withDates.push({ ...batch[j], ...dates[j] });
    }

    const today = new Date().toISOString().slice(0, 10);
    const rows = [];

    for (const ev of withDates) {
      if (!ev.startDate || ev.startDate < today) continue;
      const title = stripHtml(ev.title.rendered).slice(0, 200);
      if (!title) continue;

      const rawText = stripHtml(ev.content.rendered);
      const classListStr = classListToStr(ev.class_list);
      const venue = extractVenue(classListStr, "Winterthur");
      const preisCHF = parsePreisCHF(rawText);
      const alterVon = parseAgeMin(classListStr + " " + rawText);
      const fullText = `${title} ${rawText.slice(0, 600)}`;
      const kategorien = inferCategories(fullText);
      const alters_buckets = ageToBuckets(alterVon);

      rows.push({
        external_id: String(ev.id),
        external_source: "kinderthur",
        titel: title,
        beschreibung: rawText.slice(0, 1000) || null,
        datum: ev.startDate,
        datum_ende: ev.endDate ?? null,
        ort: venue.slice(0, 200),
        anmelde_link: ev.link,
        quelle_url: ev.link,
        preis_chf: preisCHF,
        alter_von: alterVon,
        alter_bis: 12,
        kategorien: kategorien.length ? kategorien : ["Ausflug"],
        alters_buckets: alters_buckets.length ? alters_buckets : ["4-6", "7-9", "10-12"],
        indoor_outdoor: inferIndoorOutdoor(fullText),
        event_typ: "event",
        status: "approved",
        scrape_datum: new Date().toISOString(),
      });
    }

    const summary = { fetched: ajdeEvents.length, htmlFetched: withDates.length, withDate: rows.length, source: BASE_URL };

    if (dryRun) {
      return new Response(JSON.stringify({ ...summary, sample: rows.slice(0, 5) }), { headers: jsonHeaders });
    }
    if (!rows.length) {
      return new Response(JSON.stringify({ ...summary, inserted: 0, message: "no upcoming events found" }), { headers: jsonHeaders });
    }

    const BATCH = 50;
    let inserted = 0, duplicates = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { data, error } = await supabase.from("events").upsert(batch, { onConflict: "external_source,external_id", ignoreDuplicates: true }).select("id");
      if (error) {
        for (const row of batch) {
          const { data: s } = await supabase.from("events").upsert(row, { onConflict: "external_source,external_id", ignoreDuplicates: true }).select("id");
          inserted += s?.length ?? 0;
        }
        continue;
      }
      inserted += data?.length ?? 0;
      duplicates += batch.length - (data?.length ?? 0);
    }

    return new Response(JSON.stringify({ ...summary, inserted, duplicates }), { headers: jsonHeaders });
  } catch (err) {
    console.error("scrape-kinderthur fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});

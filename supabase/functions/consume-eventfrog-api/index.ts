// Eventfrog public API consumer for Kinder/Familie events in Kanton Zürich.
// API docs: https://api.eventfrog.net / https://docs.api.eventfrog.net/
// Trigger: HTTP POST or cron job. Optional body { dryRun: true } for a dry run.
//
// Required Supabase Secrets:
//   EVENTFROG_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const EVENTFROG_BASE = "https://api.eventfrog.net";
const SOURCE_KEY = "eventfrog";

// An emblem image used by events with this many different titles is a generic
// placeholder (e.g. one AI picture on 189 unrelated events), not an event image.
const GENERIC_IMAGE_TITLE_THRESHOLD = 5;

// Kinder/Familie rubric IDs
const RUBRIC_IDS = [47, 48, 51, 52, 53, 54, 55, 99];

// Rubric ID → Kidgo category (merged with text-based inference)
const RUBRIC_CATEGORY: Record<number, string> = {
  47: "Ausflug",   // Babys
  48: "Ausflug",   // Familienveranstaltungen
  51: "Ausflug",   // Kinderfest
  52: "Bildung",   // Kinderführung
  53: "Ausflug",   // Kinderparty
  54: "Theater",   // Kindertheater
  55: "Theater",   // Kinderzirkus
  99: "Bildung",   // Familienweiterbildung
};

// Skip events clearly targeting 13+ / adult audiences
const ADULT_RX = /\bab\s*(1[3-9]|[2-9]\d)\s*(jahre?|j\.?)?|\bjugendliche\b|\bteenager\b/i;
// Classify as camp instead of generic event
const CAMP_RX = /\b(ferienlager|feriencamp|sommercamp|ferien[- ]?pass)\b/i;

// Kanton Zürich PLZ (8000–8999 covers the canton reliably enough)
const ZH_ZIP_RX = /^8\d{3}$/;
const ZH_CITY_RX =
  /zürich|zurich|winterthur|uster|wädenswil|horgen|schlieren|opfikon|wallisellen|dübendorf|kloten|dietikon|regensdorf|bülach|wetzikon|volketswil|thalwil|adliswil|küsnacht|männedorf|meilen|rüti|pfäffikon|illnau/i;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Localized {
  de?: string;
  fr?: string;
  en?: string;
  it?: string;
  [key: string]: string | undefined;
}

interface EfLocation {
  id: string;
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
  canton?: string;        // "ZH" | "BE" | …
  countryCode?: string;
  lat?: number;
  lng?: number;
  latitude?: number;      // some API versions use these
  longitude?: number;
}

interface EfEvent {
  id: string;
  title?: Localized | string;
  shortDescription?: Localized | string;
  begin?: string;
  end?: string;
  url?: string;
  presaleLink?: string;
  emblemToShow?: { url?: string; copyright?: string; credit?: string } | null;
  locationIds?: string[];
  rubricIds?: number[];
  cancelled?: boolean;
  published?: boolean;
  visible?: boolean;
}

interface PagedResponse<T> {
  data?: T[];
  items?: T[];
  results?: T[];
  total?: number;
  count?: number;
  totalCount?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeHtmlEntities(s: string): string {
  if (!s) return s;
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function pickDe(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return String(v[0] ?? "");
  if (typeof v === "object") {
    const o = v as Localized;
    return o.de || o.en || o.fr || o.it || Object.values(o).find(Boolean) || "";
  }
  return "";
}

function unpackPage<T>(json: unknown): { items: T[]; total: number } {
  if (Array.isArray(json)) return { items: json as T[], total: (json as T[]).length };
  const r = json as PagedResponse<T>;
  const items = r.data ?? r.items ?? r.results ?? [];
  const total = r.total ?? r.totalCount ?? r.count ?? items.length;
  return { items, total };
}

function isInZurich(loc: EfLocation | undefined): boolean {
  if (!loc) return false;
  if (loc.canton === "ZH") return true;
  if (loc.zip && ZH_ZIP_RX.test(loc.zip)) return true;
  if (loc.city && ZH_CITY_RX.test(loc.city)) return true;
  return false;
}

function fmtOrt(loc: EfLocation | undefined): string {
  if (!loc) return "Zürich";
  const zip  = loc.zip  || "";
  const city = loc.city || "";
  const addr = [loc.name, loc.street, [zip, city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return addr || "Zürich";
}

function locLatLng(loc: EfLocation | undefined): { lat: number | null; lng: number | null } {
  if (!loc) return { lat: null, lng: null };
  return {
    lat: loc.lat ?? loc.latitude ?? null,
    lng: loc.lng ?? loc.longitude ?? null,
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function apiFetch(url: string, apiKey: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Eventfrog ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchEventPage(
  apiKey: string,
  rubricId: number,
  offset: number,
  limit: number,
): Promise<{ items: EfEvent[]; total: number }> {
  const u = new URL(`${EVENTFROG_BASE}/public/v1/events`);
  u.searchParams.set("rubricId", String(rubricId));
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("offset", String(offset));
  u.searchParams.set("canton", "ZH");
  u.searchParams.set("fromDate", new Date().toISOString().slice(0, 10));
  return unpackPage<EfEvent>(await apiFetch(u.toString(), apiKey));
}

async function fetchLocations(apiKey: string, ids: string[]): Promise<Map<string, EfLocation>> {
  const cache = new Map<string, EfLocation>();
  if (!ids.length) return cache;

  // Batch in chunks of 50 to avoid query-string overflow
  const CHUNK = 50;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const u = new URL(`${EVENTFROG_BASE}/public/v1/locations`);
      u.searchParams.set("limit", String(CHUNK));
      for (const id of chunk) u.searchParams.append("ids[]", id);
      const { items } = unpackPage<EfLocation>(await apiFetch(u.toString(), apiKey));
      for (const loc of items) if (loc.id) cache.set(loc.id, loc);
    } catch (e) {
      // Location lookup is best-effort; log and continue
      console.warn("Location fetch failed for chunk:", e);
    }
  }
  return cache;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("EVENTFROG_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "EVENTFROG_API_KEY missing" }), {
        status: 500, headers: jsonHeaders,
      });
    }

    let dryRun = false;
    if (req.method === "POST") {
      try { dryRun = !!(await req.json()).dryRun; } catch { /* body is optional */ }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const LIMIT = 100;
    const now = new Date();

    // 1. Fetch all events from all rubrics (deduplicated by event ID)
    const eventMap = new Map<string, { ev: EfEvent; rubricId: number }>();
    const rubricStats: Record<number, number> = {};
    let totalFetched = 0;
    let fetchComplete = true;

    for (const rubricId of RUBRIC_IDS) {
      let offset = 0;
      let rubricCount = 0;

      while (true) {
        let page: { items: EfEvent[]; total: number };
        try {
          page = await fetchEventPage(apiKey, rubricId, offset, LIMIT);
        } catch (err) {
          console.error(`Rubric ${rubricId} @ offset ${offset}:`, err);
          fetchComplete = false;
          break;
        }

        for (const ev of page.items) {
          if (ev.id && !eventMap.has(ev.id)) {
            eventMap.set(ev.id, { ev, rubricId });
          }
        }

        rubricCount += page.items.length;
        totalFetched += page.items.length;
        offset += page.items.length;

        if (page.items.length < LIMIT || offset >= page.total) break;
      }

      rubricStats[rubricId] = rubricCount;
    }

    // 2. Resolve location data
    const locationIds = new Set<string>();
    for (const { ev } of eventMap.values()) {
      for (const id of ev.locationIds ?? []) locationIds.add(id);
    }
    const locationCache = await fetchLocations(apiKey, [...locationIds]);

    // 2b. Load shared relevance blocklist (manually curated, see event_blocklist table)
    const { data: blockRows } = await supabase.from("event_blocklist").select("pattern");
    const blocklist = (blockRows ?? []).map((b: { pattern: string }) => String(b.pattern).toLowerCase());

    // Emblem URLs reused across many different titles are generic placeholders
    const titlesByImage = new Map<string, Set<string>>();
    for (const { ev } of eventMap.values()) {
      const url = ev.emblemToShow?.url;
      if (!url) continue;
      const t = decodeHtmlEntities(pickDe(ev.title).trim()).toLowerCase();
      if (!titlesByImage.has(url)) titlesByImage.set(url, new Set());
      titlesByImage.get(url)!.add(t);
    }
    const isGenericImage = (url: string | undefined): boolean =>
      !!url && (titlesByImage.get(url)?.size ?? 0) >= GENERIC_IMAGE_TITLE_THRESHOLD;

    // 3. Filter + map to DB rows
    const inactiveIds = new Set<string>();
    let skippedPast = 0;
    let skippedAdult = 0;
    let skippedOutsideZH = 0;
    let skippedBlocklist = 0;
    const rows: Record<string, unknown>[] = [];

    for (const [, { ev, rubricId }] of eventMap) {
      // Skip cancelled / invisible
      if (ev.cancelled || ev.published === false || ev.visible === false) {
        inactiveIds.add(String(ev.id));
        continue;
      }

      // Skip past events
      if (ev.begin && new Date(ev.begin) < now) { skippedPast++; continue; }

      const titel = decodeHtmlEntities(pickDe(ev.title).trim());
      if (!titel) continue;

      const beschreibung = decodeHtmlEntities(pickDe(ev.shortDescription)) || null;
      const fullText = `${titel} ${beschreibung ?? ""}`;
      const fullTextLower = fullText.toLowerCase();

      // Skip events targeting 13+ audience
      if (ADULT_RX.test(fullText)) { skippedAdult++; continue; }

      // Skip events matching the manually-curated relevance blocklist
      // (QA 2026-07-06: eventfrog's own rubric IDs are trusted for the
      // base category, but not independently checked for kid-relevance —
      // this let business/academic content like "Symposium ..." or
      // "Angular Camp ..." through whenever eventfrog listed it under a
      // Kinder-rubric. The blocklist is shared with scrape-eventfrog.)
      if (blocklist.some((p) => fullTextLower.includes(p))) { skippedBlocklist++; continue; }

      // Resolve primary location
      const locId = ev.locationIds?.[0];
      const loc = locId ? locationCache.get(locId) : undefined;

      // Filter to Kanton Zürich when we have location data to check
      if (loc !== undefined && !isInZurich(loc)) { skippedOutsideZH++; continue; }

      // Categories: rubric base + text inference, deduplicated
      const baseCategory = RUBRIC_CATEGORY[rubricId];
      const inferred = inferCategories(fullText);
      const kategorien = [...new Set([...(baseCategory ? [baseCategory] : []), ...inferred])];

      const { lat, lng } = locLatLng(loc);

      rows.push({
        external_id:        String(ev.id),
        external_source:    SOURCE_KEY,
        titel,
        beschreibung,
        datum:              ev.begin ? ev.begin.slice(0, 10) : null,
        datum_ende:         ev.end   ? ev.end.slice(0, 10)   : null,
        ort:                fmtOrt(loc),
        lat,
        lng,
        anmelde_link:       ev.presaleLink || ev.url || null,
        kategorie_bild_url: isGenericImage(ev.emblemToShow?.url) ? null : (ev.emblemToShow?.url || null),
        bild_nachweis:      ev.emblemToShow?.copyright || ev.emblemToShow?.credit || null,
        kategorien,
        indoor_outdoor:     inferIndoorOutdoor(fullText),
        event_typ:          CAMP_RX.test(fullText) ? "camp" : "event",
        status:             "approved",
      });
    }

    const summary = {
      fetched:         totalFetched,
      matched:         rows.length,
      skippedPast,
      skippedAdult,
      skippedOutsideZH,
      skippedBlocklist,
      rubrics:         rubricStats,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
        { headers: jsonHeaders },
      );
    }

    // 4. Existing rows: new ones are inserted as approved; known ones get refreshed
    //    content but keep their status, so manual admin rejections survive.
    const { data: existing } = await supabase
      .from("events")
      .select("id, external_id, status, datum")
      .eq("external_source", SOURCE_KEY);
    const existingByExt = new Map<string, { id: string; status: string; datum: string | null }>();
    for (const e of existing ?? []) {
      existingByExt.set(String(e.external_id), { id: e.id, status: e.status, datum: e.datum });
    }

    const newRows = rows.filter((r) => !existingByExt.has(String(r.external_id)));
    const updateRows = rows
      .filter((r) => existingByExt.has(String(r.external_id)))
      .map(({ status: _status, ...rest }) => rest);

    const BATCH = 50;
    let inserted = 0;
    let updated = 0;
    let retired = 0;

    for (let i = 0; i < newRows.length; i += BATCH) {
      const { error, data } = await supabase
        .from("events")
        .upsert(newRows.slice(i, i + BATCH), { onConflict: "external_source,external_id", ignoreDuplicates: true })
        .select("id");
      if (error) { console.error("DB insert error:", error.message); continue; }
      inserted += data?.length ?? 0;
    }

    for (let i = 0; i < updateRows.length; i += BATCH) {
      const { error, data } = await supabase
        .from("events")
        .upsert(updateRows.slice(i, i + BATCH), { onConflict: "external_source,external_id" })
        .select("id");
      if (error) { console.error("DB update error:", error.message); continue; }
      updated += data?.length ?? 0;
    }

    // 5. Retire upcoming events that Eventfrog no longer lists or has cancelled/hidden.
    //    Only after a complete fetch, otherwise a failed rubric would hide real events.
    const todayIso = now.toISOString().slice(0, 10);
    if (fetchComplete) {
      const goneIds = (existing ?? [])
        .filter((e) => ["approved", "review", "pending"].includes(e.status))
        .filter((e) => !e.datum || e.datum >= todayIso)
        .filter((e) => !eventMap.has(String(e.external_id)) || inactiveIds.has(String(e.external_id)))
        .map((e) => e.id);

      for (let i = 0; i < goneIds.length; i += BATCH) {
        const { error, data } = await supabase
          .from("events")
          .update({ status: "rejected", review_comment: "Bei Eventfrog nicht mehr gelistet oder abgesagt – automatisch entfernt" })
          .in("id", goneIds.slice(i, i + BATCH))
          .select("id");
        if (error) { console.error("DB retire error:", error.message); continue; }
        retired += data?.length ?? 0;
      }
    }

    return new Response(
      JSON.stringify({ ...summary, inserted, updated, retired, fetchComplete }),
      { headers: jsonHeaders },
    );

  } catch (err) {
    console.error("consume-eventfrog-api fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

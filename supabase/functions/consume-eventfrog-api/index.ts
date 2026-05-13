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
  emblemToShow?: { url?: string } | null;
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

    for (const rubricId of RUBRIC_IDS) {
      let offset = 0;
      let rubricCount = 0;

      while (true) {
        let page: { items: EfEvent[]; total: number };
        try {
          page = await fetchEventPage(apiKey, rubricId, offset, LIMIT);
        } catch (err) {
          console.error(`Rubric ${rubricId} @ offset ${offset}:`, err);
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

    // 3. Filter + map to DB rows
    let skippedPast = 0;
    let skippedAdult = 0;
    let skippedOutsideZH = 0;
    const rows: Record<string, unknown>[] = [];

    for (const [, { ev, rubricId }] of eventMap) {
      // Skip cancelled / invisible
      if (ev.cancelled || ev.published === false || ev.visible === false) continue;

      // Skip past events
      if (ev.begin && new Date(ev.begin) < now) { skippedPast++; continue; }

      const titel = pickDe(ev.title).trim();
      if (!titel) continue;

      const beschreibung = pickDe(ev.shortDescription) || null;
      const fullText = `${titel} ${beschreibung ?? ""}`;

      // Skip events targeting 13+ audience
      if (ADULT_RX.test(fullText)) { skippedAdult++; continue; }

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
        kategorie_bild_url: ev.emblemToShow?.url || null,
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
      rubrics:         rubricStats,
    };

    if (dryRun) {
      return new Response(
        JSON.stringify({ ...summary, sample: rows.slice(0, 5) }),
        { headers: jsonHeaders },
      );
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({ ...summary, inserted: 0, duplicates: 0, message: "no events to import" }),
        { headers: jsonHeaders },
      );
    }

    // 4. Upsert in batches — ignore duplicates, count new inserts
    const BATCH = 50;
    let inserted = 0;
    let duplicates = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error, data } = await supabase
        .from("events")
        .upsert(batch, { onConflict: "external_source,external_id", ignoreDuplicates: true })
        .select("id");

      if (error) {
        console.error("DB upsert error:", error.message);
        continue;
      }

      const batchNew = data?.length ?? 0;
      inserted  += batchNew;
      duplicates += batch.length - batchNew;
    }

    return new Response(
      JSON.stringify({ ...summary, inserted, duplicates }),
      { headers: jsonHeaders },
    );

  } catch (err) {
    console.error("consume-eventfrog-api fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});

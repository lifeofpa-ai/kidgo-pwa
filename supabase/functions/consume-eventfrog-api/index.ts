// Eventfrog API consumer — replaces the legacy HTML scraper.
// Docs: https://docs.api.eventfrog.net/
// Endpoint: https://api.eventfrog.net/api/v1/events.json
//
// Trigger: invoke via cron or HTTP POST. Optional body { dryRun: true } returns
// the events that would be inserted without writing to the DB.
//
// Required env vars (set in Supabase dashboard > Edge Functions > Secrets):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - EVENTFROG_API_KEY     (free, register at eventfrog.ch/de/kooperationen)

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";
import { inferCategories, inferIndoorOutdoor } from "../_shared/category-map.ts";

const EVENTFROG_BASE = "https://api.eventfrog.net/api/v1";
const SOURCE_KEY     = "eventfrog";

// Zurich region lat/lng bbox (rough rectangle covering Kanton Zürich)
const ZH_BBOX = { minLat: 47.16, maxLat: 47.70, minLng: 8.36, maxLng: 8.98 };

// Family-friendly keywords used to filter events for kids.
const FAMILY_RX = /\b(kind|kinder|familie|family|jugend|teen|baby|schul|spiel|bastel|kreativ|workshop|theater|zoo|tier|spielplatz|ferien|camp)\b/i;

interface EventfrogEvent {
  id?: string;
  title?: string | Record<string, string> | string[];
  summary?: string | Record<string, string> | string[];
  html?: string | Record<string, string> | string[];
  startDate?: string;
  endDate?: string;
  link?: string;
  cancelled?: boolean;
  visible?: boolean;
  published?: boolean;
  image?: { url?: string } | null;
  location?: {
    name?: string;
    city?: string;
    zip?: string;
    street?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
  organizer?: { name?: string; website?: string };
}

// Pull a string from the multi-lingual fields the Eventfrog API returns.
function pickLocalized(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return String(v[0] ?? "");
  if (typeof v === "object") {
    const obj = v as Record<string, string>;
    return obj.de || obj.en || obj.fr || obj.it || Object.values(obj)[0] || "";
  }
  return "";
}

function inZurich(ev: EventfrogEvent): boolean {
  const lat = ev.location?.latitude;
  const lng = ev.location?.longitude;
  if (lat != null && lng != null) {
    return lat >= ZH_BBOX.minLat && lat <= ZH_BBOX.maxLat &&
           lng >= ZH_BBOX.minLng && lng <= ZH_BBOX.maxLng;
  }
  // Fallback: city-name heuristic
  const city = (ev.location?.city || "").toLowerCase();
  return /zürich|zurich|winterthur|uster|wädenswil|horgen|schlieren|opfikon|wallisellen|dübendorf/.test(city);
}

function isFamilyEvent(ev: EventfrogEvent): boolean {
  const haystack = [
    pickLocalized(ev.title), pickLocalized(ev.summary), pickLocalized(ev.html),
  ].join(" ");
  return FAMILY_RX.test(haystack);
}

function fmtOrt(ev: EventfrogEvent): string {
  const loc = ev.location;
  if (!loc) return "Zürich";
  return [loc.name, [loc.zip, loc.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function mapToEventRow(ev: EventfrogEvent) {
  const titel        = pickLocalized(ev.title).trim();
  const beschreibung = pickLocalized(ev.summary) || pickLocalized(ev.html) || null;
  const fullText     = `${titel} ${beschreibung || ""}`;
  const kategorien   = inferCategories(fullText);
  const indoor_outdoor = inferIndoorOutdoor(fullText);

  return {
    external_id: String(ev.id),
    external_source: SOURCE_KEY,
    titel,
    beschreibung,
    datum:        ev.startDate ? ev.startDate.slice(0, 10) : null,
    datum_ende:   ev.endDate   ? ev.endDate.slice(0, 10)   : null,
    ort:          fmtOrt(ev),
    lat:          ev.location?.latitude  ?? null,
    lng:          ev.location?.longitude ?? null,
    anmelde_link: ev.link || null,
    kategorie_bild_url: ev.image?.url || null,
    kategorien,
    indoor_outdoor,
    event_typ: "event",
    status: "approved", // Auto-Approved Pipeline
  };
}

async function fetchPage(apiKey: string, page: number, perPage: number): Promise<EventfrogEvent[]> {
  const url = new URL(`${EVENTFROG_BASE}/events.json`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(perPage));
  url.searchParams.set("fromDate", new Date().toISOString().slice(0, 10));

  const res = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
  if (!res.ok) throw new Error(`Eventfrog ${res.status}: ${await res.text()}`);
  const json = await res.json();
  // Eventfrog returns either { events: [...] } or { data: [...] } depending on version
  if (Array.isArray(json))                 return json;
  if (Array.isArray(json.events))          return json.events;
  if (Array.isArray(json.data))            return json.data;
  if (Array.isArray(json.items))           return json.items;
  return [];
}

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
      try { dryRun = !!(await req.json()).dryRun; } catch { /* ignore */ }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const all: EventfrogEvent[] = [];
    for (let page = 1; page <= 5; page++) {
      const batch = await fetchPage(apiKey, page, 100);
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 100) break;
    }

    const filtered = all.filter((ev) =>
      ev.id && ev.published !== false && !ev.cancelled &&
      pickLocalized(ev.title).trim() &&
      inZurich(ev) && isFamilyEvent(ev)
    );

    const rows = filtered.map(mapToEventRow);

    if (dryRun) {
      return new Response(JSON.stringify({ fetched: all.length, matched: rows.length, sample: rows.slice(0, 3) }), { headers: jsonHeaders });
    }

    if (!rows.length) {
      return new Response(JSON.stringify({ fetched: all.length, inserted: 0, message: "no family events in Zurich found" }), { headers: jsonHeaders });
    }

    const { error, data } = await supabase
      .from("events")
      .upsert(rows, { onConflict: "external_source,external_id", ignoreDuplicates: false })
      .select("id");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({
      fetched: all.length, matched: rows.length, upserted: data?.length ?? 0,
    }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});

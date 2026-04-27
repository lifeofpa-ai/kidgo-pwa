// Imports playgrounds, swimming pools and parks-with-playground from
// OpenStreetMap (Overpass API) for the Kanton Zürich area.
//
// Trigger: invoke once via HTTP POST, then re-run monthly (cron) for refresh.
// Optional body: { dryRun: true, type: "playground" | "swimming_pool" | "park" }
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (no API key for Overpass)

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SOURCE_KEY   = "osm";

// Overpass QL queries for Kanton Zürich
const QUERIES: Record<string, string> = {
  playground: `
    [out:json][timeout:60];
    area["ISO3166-2"="CH-ZH"]->.zh;
    (
      node["leisure"="playground"](area.zh);
      way["leisure"="playground"](area.zh);
    );
    out center tags;`,
  swimming_pool: `
    [out:json][timeout:60];
    area["ISO3166-2"="CH-ZH"]->.zh;
    (
      node["leisure"="swimming_pool"]["access"!="private"](area.zh);
      way["leisure"="swimming_pool"]["access"!="private"](area.zh);
      node["sport"="swimming"]["access"!="private"](area.zh);
      way["sport"="swimming"]["access"!="private"](area.zh);
      node["amenity"="swimming_pool"](area.zh);
      way["amenity"="swimming_pool"](area.zh);
    );
    out center tags;`,
  park: `
    [out:json][timeout:60];
    area["ISO3166-2"="CH-ZH"]->.zh;
    (
      way["leisure"="park"]["playground"](area.zh);
      relation["leisure"="park"]["playground"](area.zh);
    );
    out center tags;`,
};

interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function elementCoords(el: OsmElement): [number, number] | null {
  if (el.lat != null && el.lon != null) return [el.lat, el.lon];
  if (el.center)                         return [el.center.lat, el.center.lon];
  return null;
}

function buildAddress(tags: Record<string, string> = {}): string | null {
  const parts = [
    [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" "),
    [tags["addr:postcode"], tags["addr:city"]].filter(Boolean).join(" "),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

async function runQuery(type: string, query: string) {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass ${type} ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const elements: OsmElement[] = json.elements || [];

  return elements
    .map((el) => {
      const coords = elementCoords(el);
      if (!coords) return null;
      const [lat, lng] = coords;
      const tags = el.tags || {};
      const name = tags.name || tags["name:de"] || (type === "playground" ? "Spielplatz" : type === "swimming_pool" ? "Schwimmbad" : "Park");
      return {
        external_id:     `${el.type}/${el.id}`,
        external_source: SOURCE_KEY,
        name,
        place_type:      type,
        lat,
        lng,
        address:         buildAddress(tags),
        city:            tags["addr:city"] || null,
        tags,
        status:          "approved",
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let dryRun = false;
  let onlyType: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      dryRun   = !!body.dryRun;
      onlyType = body.type || null;
    } catch { /* ignore */ }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const types = onlyType ? [onlyType] : Object.keys(QUERIES);
    const summary: Record<string, { fetched: number; upserted: number }> = {};

    for (const type of types) {
      const query = QUERIES[type];
      if (!query) continue;
      const rows = await runQuery(type, query);
      summary[type] = { fetched: rows.length, upserted: 0 };

      if (dryRun || !rows.length) continue;

      // Chunk to keep request size sane (Overpass can return thousands)
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { error, data } = await supabase
          .from("places")
          .upsert(chunk, { onConflict: "external_source,external_id" })
          .select("id");
        if (error) throw new Error(`Upsert ${type}: ${error.message}`);
        summary[type].upserted += data?.length ?? 0;
      }
    }

    return new Response(JSON.stringify({ dryRun, summary }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});

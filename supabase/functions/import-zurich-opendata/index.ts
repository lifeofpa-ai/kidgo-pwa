// Imports official "POI öffentliche Spielplätze" GeoJSON from Stadt Zürich
// Open Data and writes to the `places` table. Complements OSM data with the
// city's own authoritative dataset.
//
// Datasource: https://data.stadt-zuerich.ch/dataset/geo_poi_oeffentliche_spielplaetze
// GeoJSON:    https://www.stadt-zuerich.ch/geodaten/download/POI_oeffentliche_Spielplaetze?format=10009
// License:    CC0
//
// Trigger: invoke once via HTTP POST. Optional body { dryRun: true }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, jsonHeaders } from "../_shared/cors.ts";

const SOURCE_KEY = "stadt-zuerich-ogd";

const DATASETS: Array<{ url: string; place_type: string; name_fallback: string }> = [
  {
    url: "https://www.stadt-zuerich.ch/geodaten/download/POI_oeffentliche_Spielplaetze?format=10009",
    place_type: "playground",
    name_fallback: "Spielplatz",
  },
];

interface GeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point" | "Polygon" | "MultiPolygon";
    coordinates: number[] | number[][] | number[][][] | number[][][][];
  };
  properties: Record<string, unknown>;
}

// Returns [lat, lng] from any of: Point, Polygon (use first ring centroid),
// MultiPolygon (first polygon's first ring centroid).
function featureCoords(feat: GeoJsonFeature): [number, number] | null {
  const g = feat.geometry;
  if (!g) return null;
  if (g.type === "Point") {
    const [lng, lat] = g.coordinates as number[];
    return [lat, lng];
  }
  const ring =
    g.type === "Polygon"      ? (g.coordinates as number[][][])[0] :
    g.type === "MultiPolygon" ? (g.coordinates as number[][][][])[0]?.[0] :
    null;
  if (!ring || !ring.length) return null;
  let sumLat = 0, sumLng = 0;
  for (const [lng, lat] of ring) { sumLat += lat; sumLng += lng; }
  return [sumLat / ring.length, sumLng / ring.length];
}

function pickName(props: Record<string, unknown>, fallback: string): string {
  for (const key of ["name", "Name", "BEZEICHNUNG", "bezeichnung", "title", "ANLAGENAME"]) {
    const v = props[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return fallback;
}

function pickAddress(props: Record<string, unknown>): string | null {
  for (const key of ["adresse", "ADRESSE", "address", "STRASSE"]) {
    const v = props[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function externalId(feat: GeoJsonFeature, idx: number): string {
  const props = feat.properties || {};
  for (const key of ["id", "ID", "OBJECTID", "fid", "FID", "objectid"]) {
    const v = props[key];
    if (v != null) return String(v);
  }
  return `idx-${idx}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let dryRun = false;
  if (req.method === "POST") {
    try { dryRun = !!(await req.json()).dryRun; } catch { /* ignore */ }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const summary: Record<string, { fetched: number; upserted: number }> = {};

    for (const ds of DATASETS) {
      const res = await fetch(ds.url, { headers: { "Accept": "application/json" } });
      if (!res.ok) throw new Error(`Stadt ZH ${ds.place_type} ${res.status}: ${await res.text()}`);
      const json = await res.json();
      const features: GeoJsonFeature[] = json.features || [];

      const rows = features
        .map((feat, idx) => {
          const coords = featureCoords(feat);
          if (!coords) return null;
          const [lat, lng] = coords;
          const props = feat.properties || {};
          return {
            external_id:     `${ds.place_type}-${externalId(feat, idx)}`,
            external_source: SOURCE_KEY,
            name:            pickName(props, ds.name_fallback),
            place_type:      ds.place_type,
            lat, lng,
            address:         pickAddress(props),
            city:            "Zürich",
            tags:            props,
            status:          "approved",
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      summary[ds.place_type] = { fetched: rows.length, upserted: 0 };
      if (dryRun || !rows.length) continue;

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const { error, data } = await supabase
          .from("places")
          .upsert(rows.slice(i, i + CHUNK), { onConflict: "external_source,external_id" })
          .select("id");
        if (error) throw new Error(`Upsert ${ds.place_type}: ${error.message}`);
        summary[ds.place_type].upserted += data?.length ?? 0;
      }
    }

    return new Response(JSON.stringify({ dryRun, summary }), { headers: jsonHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: jsonHeaders });
  }
});

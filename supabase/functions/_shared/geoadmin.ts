// Edge Function helper: Swiss federal geocoding via geo-admin SearchServer.
// Used by importers to resolve a free-text "ort" string to coordinates when
// the upstream API doesn't provide them.

const ENDPOINT = "https://api3.geo.admin.ch/rest/services/api/SearchServer";

export interface Geo { lat: number; lng: number; label: string }

interface ServerHit {
  attrs?: { lat?: number; lon?: number; label?: string };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function geocode(query: string): Promise<Geo | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = new URL(ENDPOINT);
  url.searchParams.set("type", "locations");
  url.searchParams.set("searchText", trimmed);
  url.searchParams.set("sr", "4326");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const json: { results?: ServerHit[] } = await res.json();
  const hit = json.results?.[0]?.attrs;
  if (!hit?.lat || !hit?.lon) return null;
  return {
    lat: hit.lat,
    lng: hit.lon,
    label: hit.label ? stripHtml(hit.label) : trimmed,
  };
}

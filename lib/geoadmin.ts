// Client-side wrapper for the Swiss federal geo-admin SearchServer.
// Docs:    https://api3.geo.admin.ch/services/sdiservices.html#search
// No API key required.

const ENDPOINT = "https://api3.geo.admin.ch/rest/services/api/SearchServer";

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string; // human-readable, may contain <i>/<b> HTML tags
}

interface SearchServerHit {
  attrs?: {
    lat?: number;
    lon?: number;
    label?: string;
  };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export async function geocode(query: string, signal?: AbortSignal): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = new URL(ENDPOINT);
  url.searchParams.set("type", "locations");
  url.searchParams.set("searchText", trimmed);
  url.searchParams.set("sr", "4326");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return null;
  const json: { results?: SearchServerHit[] } = await res.json();
  const hit = json.results?.[0]?.attrs;
  if (!hit?.lat || !hit?.lon) return null;
  return {
    lat: hit.lat,
    lng: hit.lon,
    label: hit.label ? stripHtml(hit.label) : trimmed,
  };
}

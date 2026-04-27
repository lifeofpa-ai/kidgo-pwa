// Wrapper for transport.opendata.ch — the free Swiss public transport API.
// Docs: https://transport.opendata.ch/docs.html
// No API key required.

export interface TransitConnection {
  from: string;
  to: string;
  durationMinutes: number;          // total travel time
  departure: string;                 // ISO datetime
  arrival: string;                   // ISO datetime
  transfers: number;
  products: string[];                // ['Tram', 'S-Bahn', 'Bus', ...]
}

interface OpendataConnection {
  from: { station?: { name?: string }; departure?: string };
  to:   { station?: { name?: string }; arrival?:   string };
  duration?: string;                 // 'dd:HH:mm:ss'
  transfers?: number;
  products?: string[];
}

// transport.opendata.ch uses the format 'dd:HH:mm:ss'. Convert to minutes.
function parseDurationToMinutes(d: string | undefined): number {
  if (!d) return 0;
  const parts = d.split(":").map(Number);
  if (parts.length !== 4) return 0;
  const [days, hours, minutes] = parts;
  return days * 1440 + hours * 60 + minutes;
}

export async function fetchNextConnection(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<TransitConnection | null> {
  const url = new URL("https://transport.opendata.ch/v1/connections");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), { signal });
  if (!res.ok) return null;
  const data: { connections?: OpendataConnection[] } = await res.json();
  const c = data.connections?.[0];
  if (!c?.from?.departure || !c.to?.arrival) return null;

  return {
    from: c.from.station?.name || from,
    to:   c.to.station?.name   || to,
    departure: c.from.departure,
    arrival:   c.to.arrival,
    durationMinutes: parseDurationToMinutes(c.duration),
    transfers: c.transfers ?? 0,
    products:  c.products  ?? [],
  };
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Min.`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

export function formatDepartureTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

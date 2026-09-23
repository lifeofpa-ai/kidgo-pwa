// Supabase/PostgREST kappt jede Antwort serverseitig bei 1000 Zeilen
// (max-rows), auch wenn .limit() höher gesetzt ist. Bei >1000 aktuellen
// Events fielen dadurch still Einträge weg (Explore: alles nach ~Zeile 1000,
// Sitemap: ~640 Event-Seiten). Dieser Helper lädt seitenweise nach.
//
// `build` muss bei jedem Aufruf eine FRISCHE Query liefern (ein Supabase-
// Query-Builder ist nach dem Ausführen verbraucht) und eine stabile
// Sortierung haben (z. B. zusätzlich .order("id")), sonst können Zeilen
// zwischen den Seiten doppelt vorkommen oder fehlen.

const PAGE = 1000;
const MAX_PAGES = 20; // Sicherheitsnetz: max. 20'000 Zeilen

type RangeQuery<T> = {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

export async function fetchAllRows<T>(
  build: () => RangeQuery<T>
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) return { data: rows, error };
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGE) break;
  }
  return { data: rows, error: null };
}

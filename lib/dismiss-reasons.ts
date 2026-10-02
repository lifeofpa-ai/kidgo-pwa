"use client";

// ============================================================
// Dismissals — "Nicht für uns" ohne Begründung (02.10.2026)
// ============================================================
// Früher fragte ein Overlay nach dem Ablehnungsgrund. Jetzt reicht ein Wisch:
// Kidgo lernt aus den Event-Merkmalen (siehe lib/swipe-signals.ts). Dieses
// Modul verwaltet nur noch, WELCHE Events weggewischt wurden:
//  - Weggewischte Events verschwinden aus der Hauptansicht, kommen aber nach
//    HIDE_DAYS Tagen wieder (Geschmack und Lage ändern sich).
//  - "Alle Events" (Explore) zeigt sie immer weiter an.
// Dateiname bleibt aus Kompatibilitätsgründen bestehen.

export interface DismissalRecord {
  eventId: string;
  /** Legacy: früher Ablehnungsgründe. Neu: ["swipe_skip"]. */
  reasons: string[];
  eventMeta: EventMeta;
  dismissedAt: string;
}

export interface EventMeta {
  kategorien: string[] | null;
  preis_chf: number | null;
  indoor_outdoor: string | null;
  alter_von: number | null;
  alter_bis: number | null;
  distanceKm: number | null;
}

/** So lange bleibt ein weggewischtes Event in der Hauptansicht ausgeblendet. */
export const HIDE_DAYS = 90;

const LOCAL_DISMISSALS_KEY = "kidgo_dismissals";
const DISMISSED_IDS_KEY = "kidgo_dismissed_event_ids"; // Legacy: Array<string>
const SKIP_UNTIL_KEY = "kidgo_skip_until"; // Record<eventId, epochMs>

function readSkipUntil(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SKIP_UNTIL_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const legacyRaw = localStorage.getItem(DISMISSED_IDS_KEY);
    if (legacyRaw) {
      // Einmalige Migration: alte, undatierte Ablehnungen bekommen ab jetzt 90 Tage.
      const legacy = JSON.parse(legacyRaw) as string[];
      const until = Date.now() + HIDE_DAYS * 86400000;
      for (const id of legacy) if (!(id in map)) map[id] = until;
      localStorage.setItem(SKIP_UNTIL_KEY, JSON.stringify(map));
      localStorage.removeItem(DISMISSED_IDS_KEY);
    }
    return map;
  } catch {
    return {};
  }
}

function writeSkipUntil(map: Record<string, number>) {
  try { localStorage.setItem(SKIP_UNTIL_KEY, JSON.stringify(map)); } catch {}
}

export function getPastDismissals(): DismissalRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DISMISSALS_KEY);
    return raw ? (JSON.parse(raw) as DismissalRecord[]) : [];
  } catch { return []; }
}

/** IDs, die aktuell in der Hauptansicht ausgeblendet bleiben sollen. */
export function getDismissedEventIds(): string[] {
  const now = Date.now();
  const map = readSkipUntil();
  return Object.entries(map).filter(([, until]) => until > now).map(([id]) => id);
}

export function saveDismissalLocally(
  eventId: string,
  reasons: string[],
  eventMeta: EventMeta
): void {
  try {
    const map = readSkipUntil();
    map[eventId] = Date.now() + HIDE_DAYS * 86400000;
    writeSkipUntil(map);

    const record: DismissalRecord = {
      eventId,
      reasons,
      eventMeta,
      dismissedAt: new Date().toISOString(),
    };
    const all = getPastDismissals().filter((d) => d.eventId !== eventId);
    localStorage.setItem(LOCAL_DISMISSALS_KEY, JSON.stringify([record, ...all].slice(0, 200)));
  } catch {}
}

/** Rückgängig: Event wieder zulassen. */
export function removeDismissalLocally(eventId: string): void {
  try {
    const map = readSkipUntil();
    delete map[eventId];
    writeSkipUntil(map);
    localStorage.setItem(
      LOCAL_DISMISSALS_KEY,
      JSON.stringify(getPastDismissals().filter((d) => d.eventId !== eventId))
    );
  } catch {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveDismissalToSupabase(
  supabase: any,
  userId: string,
  eventId: string,
  reasons: string[],
  eventMeta: EventMeta
): Promise<void> {
  try {
    await supabase.from("event_dismissals").insert({
      user_id: userId,
      event_id: eventId,
      reasons,
      event_meta: eventMeta,
    });
  } catch {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function removeDismissalFromSupabase(
  supabase: any,
  userId: string,
  eventId: string
): Promise<void> {
  try {
    await supabase.from("event_dismissals").delete().eq("user_id", userId).eq("event_id", eventId);
  } catch {}
}

/** Load dismissals for the logged-in user from Supabase (jüngste zuerst). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadDismissalsFromSupabase(
  supabase: any,
  userId: string
): Promise<DismissalRecord[]> {
  try {
    const { data } = await supabase
      .from("event_dismissals")
      .select("event_id,reasons,event_meta,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!data) return [];
    return (data as Array<{ event_id: string; reasons: string[]; event_meta: EventMeta; created_at: string }>).map((row) => ({
      eventId: row.event_id,
      reasons: Array.isArray(row.reasons) ? row.reasons : [],
      eventMeta: row.event_meta ?? ({} as EventMeta),
      dismissedAt: row.created_at,
    }));
  } catch { return []; }
}

/** Server-Ablehnungen, die noch nicht abgelaufen sind (für das Merge beim Login). */
export function activeDismissalIds(records: DismissalRecord[]): string[] {
  const cutoff = Date.now() - HIDE_DAYS * 86400000;
  return records.filter((d) => new Date(d.dismissedAt).getTime() > cutoff).map((d) => d.eventId);
}

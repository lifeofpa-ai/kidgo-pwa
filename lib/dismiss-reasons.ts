"use client";

// ============================================================
// Dismiss-Reasons — Kontextuelle Ablehn-Gründe für Events
// ============================================================

export interface DismissReason {
  id: string;
  label: string;
  icon?: string; // SVG path string or emoji
}

export interface DismissalRecord {
  eventId: string;
  reasons: string[]; // reason IDs
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

export interface DismissReasonOptions {
  distanceKm?: number | null;
  weatherCode?: number | null;
  selectedBuckets?: string[];
  pastDismissals?: DismissalRecord[];
}

const LOCAL_DISMISSALS_KEY = "kidgo_dismissals";
const DISMISSED_IDS_KEY = "kidgo_dismissed_event_ids";

// Age buckets → min/max ages
const BUCKET_AGES: Record<string, [number, number]> = {
  "0-3":   [0, 3],
  "4-6":   [4, 6],
  "7-9":   [7, 9],
  "10-12": [10, 12],
};

function childAgeRange(selectedBuckets: string[]): { min: number; max: number } | null {
  if (selectedBuckets.length === 0) return null;
  let min = Infinity, max = -Infinity;
  for (const b of selectedBuckets) {
    const range = BUCKET_AGES[b];
    if (range) { min = Math.min(min, range[0]); max = Math.max(max, range[1]); }
  }
  return min < Infinity ? { min, max } : null;
}

/**
 * Generate 3–5 contextual dismiss reasons for an event.
 * Learning: reasons the user picked often are pushed to the back;
 * fresh reasons are promoted to the front.
 */
export function generateDismissReasons(
  event: {
    id: string;
    kategorien: string[] | null;
    kategorie: string | null;
    preis_chf: number | null;
    indoor_outdoor: string | null;
    alter_von: number | null;
    alter_bis: number | null;
    datum: string | null;
  },
  opts: DismissReasonOptions = {}
): DismissReason[] {
  const { distanceKm, weatherCode, selectedBuckets = [], pastDismissals = [] } = opts;

  const candidates: DismissReason[] = [];

  // 1 — Distanz
  if (distanceKm !== null && distanceKm !== undefined && distanceKm > 10) {
    candidates.push({ id: "too_far", label: "Zu weit weg", icon: "📍" });
  }

  // 2 — Preis
  const price = event.preis_chf;
  if (price !== null && price > 30) {
    candidates.push({ id: "too_expensive", label: "Zu teuer", icon: "💰" });
  }

  // 3 — Alter passt nicht
  const childRange = childAgeRange(selectedBuckets);
  if (childRange) {
    const evMin = event.alter_von;
    const evMax = event.alter_bis;
    const ageMismatch =
      (evMin !== null && evMin > childRange.max) ||
      (evMax !== null && evMax < childRange.min);
    if (ageMismatch) {
      candidates.push({ id: "wrong_age", label: "Passt nicht zum Alter", icon: "🎂" });
    }
  }

  // 4 — Zeitlich ungünstig (Wochentag vor 15 Uhr)
  const now = new Date();
  const dow = now.getDay(); // 0=So, 1=Mo … 5=Fr, 6=Sa
  if (dow >= 1 && dow <= 5 && now.getHours() < 15) {
    candidates.push({ id: "bad_timing", label: "Zeitlich ungünstig", icon: "⏰" });
  }

  // 5 — Kategorie-basiert
  const cats = event.kategorien ?? (event.kategorie ? [event.kategorie] : []);
  if (cats.length > 0) {
    const cat = cats[0];
    candidates.push({
      id: `not_interested_${cat.toLowerCase().replace(/[^a-z]/g, "_")}`,
      label: `Kein Interesse an ${cat}`,
      icon: "😐",
    });
  }

  // 6 — Wetter passt nicht
  if (weatherCode !== null && weatherCode !== undefined) {
    const isSunny = weatherCode <= 2;
    const isRainy = weatherCode >= 51;
    const isIndoor = event.indoor_outdoor === "indoor";
    const isOutdoor = event.indoor_outdoor === "outdoor";
    if ((isIndoor && isSunny) || (isOutdoor && isRainy)) {
      candidates.push({ id: "weather_mismatch", label: "Wetter passt nicht", icon: "🌦️" });
    }
  }

  // 7 — Fallbacks (immer anbieten)
  candidates.push({ id: "not_my_taste",  label: "Nicht mein Geschmack", icon: "👎" });
  candidates.push({ id: "already_known", label: "Schon bekannt",         icon: "👀" });

  // --- Learning: count how often each reason was chosen previously ---
  const usageCounts: Record<string, number> = {};
  for (const d of pastDismissals) {
    for (const r of d.reasons) {
      usageCounts[r] = (usageCounts[r] || 0) + 1;
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // Sort: rarely/never chosen first, often chosen last
  unique.sort((a, b) => (usageCounts[a.id] || 0) - (usageCounts[b.id] || 0));

  return unique.slice(0, 5);
}

// ============================================================
// Storage helpers — localStorage (anonym) + Supabase (eingeloggt)
// ============================================================

export function getPastDismissals(): DismissalRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DISMISSALS_KEY);
    return raw ? (JSON.parse(raw) as DismissalRecord[]) : [];
  } catch { return []; }
}

export function getDismissedEventIds(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

export function saveDismissalLocally(
  eventId: string,
  reasons: string[],
  eventMeta: EventMeta
): void {
  try {
    // Dismissed IDs (für schnelles Filtern)
    const ids = getDismissedEventIds();
    if (!ids.includes(eventId)) {
      localStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify([...ids, eventId]));
    }

    // Full record (für Lernlogik)
    const record: DismissalRecord = {
      eventId,
      reasons,
      eventMeta,
      dismissedAt: new Date().toISOString(),
    };
    const all = getPastDismissals();
    // Keep max 200 records
    const next = [record, ...all].slice(0, 200);
    localStorage.setItem(LOCAL_DISMISSALS_KEY, JSON.stringify(next));
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

/** Load dismissals for the logged-in user from Supabase. */
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
      eventMeta: row.event_meta ?? {},
      dismissedAt: row.created_at,
    }));
  } catch { return []; }
}

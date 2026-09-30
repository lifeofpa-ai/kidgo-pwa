import type { KidgoEvent, UserLocation, CompactEvent } from "@/types/home";
import { scoreEvent } from "@/lib/scoring";
import {
  buildDismissProfile,
  buildPreferenceProfile,
  getRatedEvents,
  type PreferenceProfile,
  type DismissProfile,
  type RatedEventData,
} from "@/lib/preferences";
import {
  getDismissedEventIds,
  getPastDismissals,
} from "@/lib/dismiss-reasons";

// ============================================================
// Gemeinsame Relevanz-Logik für Home und Explore (30.09.2026)
// ============================================================
// Eine Quelle für "welche Signale kennen wir über diese Familie" und "wie
// sortieren wir danach", damit Explore nicht eine zweite, abweichende
// Sortierung neben der Home-Empfehlung bekommt. Der eigentliche Score bleibt
// in lib/scoring.ts (scoreEvent).

/** Bereits abgelehnte Events rutschen nach unten, verschwinden aber nicht. */
export const DISMISSED_EVENT_PENALTY = 20;

export interface RelevanceSignals {
  interests: string[];
  preferenceProfile: PreferenceProfile | null;
  dismissProfile: DismissProfile | null;
  dismissedIds: Set<string>;
  /** Merkliste-Events (kompakt) — positives Signal, auch ohne explizites Like. */
  bookmarks: CompactEvent[];
}

export const EMPTY_SIGNALS: RelevanceSignals = {
  interests: [],
  preferenceProfile: null,
  dismissProfile: null,
  dismissedIds: new Set(),
  bookmarks: [],
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Merkliste zählt wie ein "Like" für das Präferenzprofil: wer ein Event merkt,
 * signalisiert Interesse. Explizite Ratings haben Vorrang (kein Doppelzählen).
 */
export function mergeBookmarksIntoRatings(
  rated: RatedEventData[],
  bookmarks: CompactEvent[]
): RatedEventData[] {
  const known = new Set(rated.map((r) => r.eventId));
  const fromBookmarks: RatedEventData[] = bookmarks
    .filter((b) => !known.has(b.id))
    .map((b) => ({
      eventId: b.id,
      rating: "like" as const,
      kategorien: b.kategorien ?? null,
      ort: b.ort ?? null,
      indoor_outdoor: null,
      alters_buckets: null,
      ratedAt: new Date(0).toISOString(),
    }));
  return [...rated, ...fromBookmarks];
}

/** Liest alle lokal bekannten Signale (nur im Browser aufrufen). */
export function loadRelevanceSignals(): RelevanceSignals {
  const interests = readJson<string[]>("kidgo_interests", []);
  const bookmarks = readJson<CompactEvent[]>("kidgo_bookmarks", []);
  let preferenceProfile: PreferenceProfile | null = null;
  try {
    preferenceProfile = buildPreferenceProfile(
      mergeBookmarksIntoRatings(getRatedEvents(), Array.isArray(bookmarks) ? bookmarks : [])
    );
  } catch {}
  let dismissProfile: DismissProfile | null = null;
  let dismissedIds = new Set<string>();
  try {
    dismissedIds = new Set(getDismissedEventIds());
    const past = getPastDismissals();
    if (past.length > 0) dismissProfile = buildDismissProfile(past);
  } catch {}
  return {
    interests: Array.isArray(interests) ? interests : [],
    preferenceProfile,
    dismissProfile,
    dismissedIds,
    bookmarks: Array.isArray(bookmarks) ? bookmarks : [],
  };
}

export interface RelevanceInput {
  buckets: string[];
  weatherCode: number | null;
  userLocation: UserLocation | null;
  radiusKm: number | null;
  signals: RelevanceSignals;
  now?: Date;
}

/** Score pro Event-ID. */
export function computeRelevanceScores(
  events: KidgoEvent[],
  input: RelevanceInput
): Map<string, number> {
  const now = input.now ?? new Date();
  const { signals } = input;
  const out = new Map<string, number>();
  for (const e of events) {
    let { score } = scoreEvent(
      e,
      input.buckets,
      input.weatherCode,
      now,
      signals.interests,
      signals.preferenceProfile,
      signals.dismissProfile,
      input.userLocation,
      input.radiusKm
    );
    if (signals.dismissedIds.has(e.id)) score -= DISMISSED_EVENT_PENALTY;
    out.set(e.id, score);
  }
  return out;
}

/**
 * Stabile, deterministische Reihenfolge: höherer Score zuerst, bei Gleichstand
 * früheres Datum, dann id. Kein Zufall — die Liste springt beim Zurückblättern
 * (Explore-Zustand wiederherstellen) nicht.
 */
export function compareByRelevance(
  a: { id: string; datum?: string | null },
  b: { id: string; datum?: string | null },
  scores: Map<string, number>
): number {
  const diff = (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0);
  if (diff !== 0) return diff;
  const da = a.datum || "9999-12-31";
  const db = b.datum || "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function rankByRelevance<T extends KidgoEvent>(events: T[], input: RelevanceInput): T[] {
  const scores = computeRelevanceScores(events, input);
  return [...events].sort((a, b) => compareByRelevance(a, b, scores));
}

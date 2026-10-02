export type EventRating = "like" | "superlike" | "dislike";

export interface RatedEventData {
  eventId: string;
  rating: EventRating;
  kategorien: string[] | null;
  ort: string | null;
  indoor_outdoor: string | null;
  alters_buckets: string[] | null;
  ratedAt: string;
}

export interface PreferenceProfile {
  preferredCategories: string[];
  preferredLocations: string[];
  preferredSetting: "indoor" | "outdoor" | null;
  likedCount: number;
}

export function getRatedEvents(): RatedEventData[] {
  try {
    const raw = localStorage.getItem("kidgo_liked_events");
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getEventRating(eventId: string): EventRating | null {
  const entry = getRatedEvents().find((e) => e.eventId === eventId);
  return entry?.rating ?? null;
}

export function setEventRating(
  event: {
    id: string;
    kategorien: string[] | null;
    ort: string | null;
    indoor_outdoor: string | null;
    alters_buckets: string[] | null;
  },
  rating: EventRating | null
): void {
  const all = getRatedEvents();
  const filtered = all.filter((e) => e.eventId !== event.id);
  const next = rating
    ? [
        ...filtered,
        {
          eventId: event.id,
          rating,
          kategorien: event.kategorien,
          ort: event.ort,
          indoor_outdoor: event.indoor_outdoor,
          alters_buckets: event.alters_buckets,
          ratedAt: new Date().toISOString(),
        },
      ]
    : filtered;
  try { localStorage.setItem("kidgo_liked_events", JSON.stringify(next)); } catch {}
}

export function buildPreferenceProfile(rated: RatedEventData[]): PreferenceProfile | null {
  const liked = rated.filter((e) => e.rating === "like" || e.rating === "superlike");
  if (liked.length === 0) return null;

  const catCounts: Record<string, number> = {};
  for (const e of liked) {
    const weight = e.rating === "superlike" ? 2 : 1;
    for (const cat of e.kategorien || []) {
      catCounts[cat] = (catCounts[cat] || 0) + weight;
    }
  }
  const preferredCategories = Object.entries(catCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat);

  const locationCounts: Record<string, number> = {};
  for (const e of liked) {
    if (e.ort) {
      const city = e.ort.split(",")[0].trim().split(" ")[0];
      if (city.length > 2) locationCounts[city] = (locationCounts[city] || 0) + 1;
    }
  }
  const preferredLocations = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([city]) => city);

  let indoorCount = 0;
  let outdoorCount = 0;
  for (const e of liked) {
    if (e.indoor_outdoor === "indoor") indoorCount++;
    if (e.indoor_outdoor === "outdoor") outdoorCount++;
  }
  const preferredSetting: "indoor" | "outdoor" | null =
    indoorCount > outdoorCount * 1.5 ? "indoor" :
    outdoorCount > indoorCount * 1.5 ? "outdoor" : null;

  return { preferredCategories, preferredLocations, preferredSetting, likedCount: liked.length };
}

export function scoreWithPreferences(
  event: {
    kategorien: string[] | null;
    ort: string | null;
    indoor_outdoor: string | null;
  },
  profile: PreferenceProfile
): number {
  let bonus = 0;
  const cats = event.kategorien || [];
  if (cats.some((c) => profile.preferredCategories.includes(c))) bonus += 4;
  if (
    event.ort &&
    profile.preferredLocations.some((loc) =>
      event.ort!.toLowerCase().includes(loc.toLowerCase())
    )
  ) bonus += 3;
  if (profile.preferredSetting && event.indoor_outdoor === profile.preferredSetting) bonus += 2;
  return bonus;
}

// ============================================================
// Swipe-basierte Signale (02.10.2026)
// ============================================================
// Früher: Ablehnungsgründe ("not_interested_*", "too_far", ...). Jetzt lernt
// Kidgo ohne Begründung aus den Event-Merkmalen (lib/swipe-signals.ts).
// Die alten Namen bleiben als dünne Wrapper erhalten, damit Aufrufer
// (Home, Explore-Relevanz, Scoring) unverändert bleiben.

import {
  buildSwipeProfile,
  getSignals,
  swipeAffinityScore,
  type SwipeProfile,
  type SwipeSignal,
} from "@/lib/swipe-signals";
import type { DismissalRecord } from "@/lib/dismiss-reasons";

export type DismissProfile = SwipeProfile;

/**
 * Profil aus lokalen Signalen + (optional) Server-Ablehnungen anderer Geräte.
 * Server-Records zählen als "skip", sofern lokal nicht schon vorhanden.
 */
export function buildDismissProfile(dismissals: Array<DismissalRecord> = []): DismissProfile | null {
  const local = getSignals();
  const known = new Set(local.filter((s) => s.kind === "skip").map((s) => s.eventId));
  const fromServer: SwipeSignal[] = dismissals
    .filter((d) => !known.has(d.eventId))
    .map((d) => ({ eventId: d.eventId, kind: "skip" as const, meta: d.eventMeta, at: d.dismissedAt }));
  return buildSwipeProfile([...local, ...fromServer]);
}

/** Score-Beitrag aus dem Swipe-Profil (± bis 10 Punkte). */
export function dismissPenalty(
  event: {
    kategorien: string[] | null;
    kategorie: string | null;
    preis_chf?: number | null;
    indoor_outdoor?: string | null;
  },
  profile: DismissProfile,
  distanceKm: number | null = null
): number {
  return swipeAffinityScore(event, profile, distanceKm);
}

// Gamification: badges and explorer levels

export interface GamificationStats {
  visitedEventIds: string[];
  bookmarkCount: number;
  geheimtippsFound: string[];
  hasReviewed: boolean;
  challengeCompleted: boolean;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  requirement: string;
}

export const BADGE_DEFS: BadgeDef[] = [
  {
    id: "first_review",
    name: "Erste Bewertung",
    description: "Deine erste Event-Bewertung abgegeben",
    requirement: "1 Bewertung schreiben",
  },
  {
    id: "events_5",
    name: "5 Events besucht",
    description: "Fünf Events entdeckt",
    requirement: "5 Events besuchen",
  },
  {
    id: "bookmarks_10",
    name: "Merkliste-Fan",
    description: "Zehn Events auf die Merkliste gesetzt",
    requirement: "10 Events merken",
  },
  {
    id: "secrets_3",
    name: "Geheimtipp-Finder",
    description: "Drei Geheimtipps entdeckt",
    requirement: "3 Geheimtipps merken",
  },
  {
    id: "challenge_done",
    name: "Challenge-Held",
    description: "Eine wöchentliche Challenge abgeschlossen",
    requirement: "Challenge annehmen",
  },
];

function checkBadge(id: string, stats: GamificationStats): boolean {
  switch (id) {
    case "first_review":   return stats.hasReviewed;
    case "events_5":       return stats.visitedEventIds.length >= 5;
    case "bookmarks_10":   return stats.bookmarkCount >= 10;
    case "secrets_3":      return stats.geheimtippsFound.length >= 3;
    case "challenge_done": return stats.challengeCompleted;
    default:               return false;
  }
}

export function getEarnedBadgeIds(stats: GamificationStats): string[] {
  return BADGE_DEFS.filter((b) => checkBadge(b.id, stats)).map((b) => b.id);
}

export type LevelKey = "anfaenger" | "entdecker" | "experte" | "meister";

export interface LevelDef {
  key: LevelKey;
  label: string;
  minEvents: number;
}

export const LEVELS: LevelDef[] = [
  { key: "anfaenger", label: "Anfänger",  minEvents: 0  },
  { key: "entdecker", label: "Entdecker", minEvents: 6  },
  { key: "experte",   label: "Experte",   minEvents: 16 },
  { key: "meister",   label: "Meister",   minEvents: 31 },
];

export function getCurrentLevel(visitedCount: number): LevelDef {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (visitedCount >= l.minEvents) level = l;
  }
  return level;
}

export function getNextLevel(current: LevelKey): LevelDef | null {
  const idx = LEVELS.findIndex((l) => l.key === current);
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function getLevelProgress(visitedCount: number): {
  current: LevelDef;
  next: LevelDef | null;
  progress: number;
  eventsToNext: number;
} {
  const current = getCurrentLevel(visitedCount);
  const next = getNextLevel(current.key);
  if (!next) return { current, next: null, progress: 100, eventsToNext: 0 };
  const range = next.minEvents - current.minEvents;
  const done = visitedCount - current.minEvents;
  return {
    current,
    next,
    progress: Math.min(100, Math.round((done / range) * 100)),
    eventsToNext: next.minEvents - visitedCount,
  };
}

const LS_VISITED    = "kidgo_visited_event_ids";
const LS_GEHEIMTIPPS = "kidgo_geheimtipps_found";

export function getLocalStats(bookmarkCount: number): GamificationStats {
  if (typeof window === "undefined") {
    return {
      visitedEventIds: [],
      bookmarkCount,
      geheimtippsFound: [],
      hasReviewed: false,
      challengeCompleted: false,
    };
  }
  let visitedEventIds: string[] = [];
  let geheimtippsFound: string[] = [];
  try {
    const v = localStorage.getItem(LS_VISITED);
    if (v) visitedEventIds = JSON.parse(v);
    const g = localStorage.getItem(LS_GEHEIMTIPPS);
    if (g) geheimtippsFound = JSON.parse(g);
  } catch {}
  const hasReviewed      = localStorage.getItem("kidgo_has_reviewed") === "true";
  const challengeCompleted = localStorage.getItem("kidgo_challenge_accepted") === "true";
  return { visitedEventIds, bookmarkCount, geheimtippsFound, hasReviewed, challengeCompleted };
}

export function trackVisit(eventId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw  = localStorage.getItem(LS_VISITED);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(eventId)) {
      ids.push(eventId);
      localStorage.setItem(LS_VISITED, JSON.stringify(ids));
    }
  } catch {}
}

export function trackGeheimtipp(eventId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw  = localStorage.getItem(LS_GEHEIMTIPPS);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(eventId)) {
      ids.push(eventId);
      localStorage.setItem(LS_GEHEIMTIPPS, JSON.stringify(ids));
    }
  } catch {}
}

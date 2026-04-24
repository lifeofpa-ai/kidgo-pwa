// Gamification: badges and explorer levels for Kidgo Sprint 15

export interface GamificationStats {
  visitedEventIds: string[];
  bookmarkCount: number;
  geheimtippsFound: string[];
  ratedCount: number;
  weeklyStreak: number;
  dayPlanCount: number;
  mapOpened: boolean;
  chatCount: number;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  requirement: string;
  emoji: string;
}

export const BADGE_DEFS: BadgeDef[] = [
  {
    id: "entdecker",
    name: "Entdecker",
    description: "5 verschiedene Events angeschaut",
    requirement: "5 Events besuchen",
    emoji: "🔭",
  },
  {
    id: "bewerter",
    name: "Bewerter",
    description: "3 Events bewertet (Daumen hoch/runter)",
    requirement: "3 Events bewerten",
    emoji: "👍",
  },
  {
    id: "stammgast",
    name: "Stammgast",
    description: "3 Wochen in Folge aktiv",
    requirement: "3 Wochen in Folge aktiv sein",
    emoji: "🔥",
  },
  {
    id: "geheimtipp_jaeger",
    name: "Geheimtipp-Jäger",
    description: "3 Events mit Geheimtipp-Badge gefunden",
    requirement: "3 Geheimtipps besuchen",
    emoji: "🤫",
  },
  {
    id: "planer",
    name: "Planer",
    description: "\"Plan meinen Tag\" 3× genutzt",
    requirement: "\"Plan meinen Tag\" 3× verwenden",
    emoji: "📅",
  },
  {
    id: "kartograph",
    name: "Kartograph",
    description: "Kartenansicht geöffnet",
    requirement: "Karte öffnen",
    emoji: "🗺️",
  },
  {
    id: "frag_experte",
    name: "Frag-Experte",
    description: "\"Frag Kidgo\" 5× genutzt",
    requirement: "Chat 5× nutzen",
    emoji: "💬",
  },
];

function checkBadge(id: string, stats: GamificationStats): boolean {
  switch (id) {
    case "entdecker":         return stats.visitedEventIds.length >= 5;
    case "bewerter":          return stats.ratedCount >= 3;
    case "stammgast":         return stats.weeklyStreak >= 3;
    case "geheimtipp_jaeger": return stats.geheimtippsFound.length >= 3;
    case "planer":            return stats.dayPlanCount >= 3;
    case "kartograph":        return stats.mapOpened;
    case "frag_experte":      return stats.chatCount >= 5;
    default:                  return false;
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

// ISO year-week key, e.g. "2026-W17"
function getWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${now.getFullYear()}-W${week}`;
}

const LS_VISITED     = "kidgo_visited_event_ids";
const LS_GEHEIMTIPPS = "kidgo_geheimtipps_found";

export function getLocalStats(bookmarkCount: number): GamificationStats {
  if (typeof window === "undefined") {
    return {
      visitedEventIds: [],
      bookmarkCount,
      geheimtippsFound: [],
      ratedCount: 0,
      weeklyStreak: 0,
      dayPlanCount: 0,
      mapOpened: false,
      chatCount: 0,
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

  let ratedCount = 0;
  try {
    const raw = localStorage.getItem("kidgo_liked_events");
    if (raw) ratedCount = (JSON.parse(raw) as unknown[]).length;
  } catch {}

  let weeklyStreak = 0;
  try {
    const raw = localStorage.getItem("kidgo_weekly_activity");
    if (raw) {
      const weeks: string[] = JSON.parse(raw);
      const [yearStr, weekStr] = getWeekKey().split("-W");
      const currentYear = parseInt(yearStr, 10);
      const currentWeekNum = parseInt(weekStr, 10);
      let streak = 0;
      for (let i = 0; i < 52; i++) {
        let w = currentWeekNum - i;
        let y = currentYear;
        if (w <= 0) { w += 52; y -= 1; }
        if (weeks.includes(`${y}-W${w}`)) streak++;
        else break;
      }
      weeklyStreak = streak;
    }
  } catch {}

  const dayPlanCount = parseInt(localStorage.getItem("kidgo_day_plan_count") || "0", 10);
  const mapOpened = localStorage.getItem("kidgo_map_opened") === "true";
  const chatCount = parseInt(localStorage.getItem("kidgo_chat_count") || "0", 10);

  return { visitedEventIds, bookmarkCount, geheimtippsFound, ratedCount, weeklyStreak, dayPlanCount, mapOpened, chatCount };
}

export function trackVisit(eventId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LS_VISITED);
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
    const raw = localStorage.getItem(LS_GEHEIMTIPPS);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(eventId)) {
      ids.push(eventId);
      localStorage.setItem(LS_GEHEIMTIPPS, JSON.stringify(ids));
    }
  } catch {}
}

export function trackWeeklyActivity(): void {
  if (typeof window === "undefined") return;
  try {
    const key = getWeekKey();
    const raw = localStorage.getItem("kidgo_weekly_activity");
    const weeks: string[] = raw ? JSON.parse(raw) : [];
    if (!weeks.includes(key)) {
      weeks.push(key);
      localStorage.setItem("kidgo_weekly_activity", JSON.stringify(weeks));
    }
  } catch {}
}

export function trackDayPlanUsed(): void {
  if (typeof window === "undefined") return;
  try {
    const count = parseInt(localStorage.getItem("kidgo_day_plan_count") || "0", 10) + 1;
    localStorage.setItem("kidgo_day_plan_count", String(count));
  } catch {}
}

export function trackMapOpened(): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem("kidgo_map_opened", "true"); } catch {}
}

export function trackChatUsed(): void {
  if (typeof window === "undefined") return;
  try {
    const count = parseInt(localStorage.getItem("kidgo_chat_count") || "0", 10) + 1;
    localStorage.setItem("kidgo_chat_count", String(count));
  } catch {}
}

// Returns badges newly earned since last popup — also marks them as shown
export function popNewBadges(stats: GamificationStats): BadgeDef[] {
  if (typeof window === "undefined") return [];
  const allEarned = getEarnedBadgeIds(stats);
  let shown: string[] = [];
  try {
    const raw = localStorage.getItem("kidgo_shown_badges");
    if (raw) shown = JSON.parse(raw);
  } catch {}
  const newIds = allEarned.filter((id) => !shown.includes(id));
  if (newIds.length > 0) {
    try {
      localStorage.setItem("kidgo_shown_badges", JSON.stringify([...shown, ...newIds]));
    } catch {}
  }
  return newIds.map((id) => BADGE_DEFS.find((b) => b.id === id)!).filter(Boolean);
}

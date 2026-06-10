"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { restoreScrollPosition } from "@/lib/interactions";
import { AuthButton } from "@/components/AuthButton";
import { ProfileSetupModal } from "@/components/ProfileSetupModal";
import { useAuth } from "@/lib/auth-context";
import { useUserPrefs } from "@/lib/user-prefs-context";
import {
  getLocalStats,
  getLevelProgress,
  trackGeheimtipp,
  trackDayPlanUsed,
  trackWeeklyActivity,
  popNewBadges,
  type BadgeDef,
} from "@/lib/gamification";
import { BadgePopup } from "@/components/BadgePopup";
import { HexIcon } from "@/components/HexIcon";
import {
  getRatedEvents,
  buildPreferenceProfile,
  buildDismissProfile,
  type PreferenceProfile,
  type DismissProfile,
} from "@/lib/preferences";
import { ChatSheet } from "@/components/home/ChatSheet";
import { ChatFAB } from "@/components/home/ChatFAB";
import {
  type DismissReason,
  type EventMeta,
  generateDismissReasons,
  getPastDismissals,
  getDismissedEventIds,
  saveDismissalLocally,
  saveDismissalToSupabase,
} from "@/lib/dismiss-reasons";
import { trackEvent, trackFirstBookmark } from "@/lib/analytics";
import { PhoneIcon, WifiOffIcon } from "@/components/Icons";
import {
  getContextMode,
  getContextBadge,
  getContextLabel,
  applyContextSort,
  type ContextMode,
} from "@/lib/context-mode";
import type { KidgoEvent, ScoredEvent, CompactEvent, DayPlanResult } from "@/types/home";
import {
  AGE_BUCKETS,
  getWeekStart,
  getHeadline,
  ageToBucket,
  localDateStr,
  haversine,
  ZH_CITIES,
} from "@/lib/home-constants";
import { scoreEvent } from "@/lib/scoring";
import { SkeletonCard, EventImage, RecommendationCard } from "@/components/home/EventCards";
import { HeroSection } from "@/components/home/HeroSection";
import { CardStack } from "@/components/home/CardStack";
import { WeekendSection } from "@/components/home/WeekendSection";
import { SeasonalSection } from "@/components/home/SeasonalSection";

// Types imported from @/types/home

interface ParsedQuery {
  ageBuckets: string[];
  indoor: boolean | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  keywords: string[];
  freeOnly: boolean;
  childNames: Array<{ name: string; bucket: string }>;
}

// Constants, types, and utility functions are imported from @/lib/home-constants, @/types/home, @/lib/scoring

function WeatherIcon({ code, size = 24 }: { code: number; size?: number }) {
  // Regen / Schauer (Drizzle, Rain, Showers)
  if (code >= 51) return (
    <HexIcon size={size}>
      <path d="M7 13.5a2.4 2.4 0 0 1 .5-4.7 3.4 3.4 0 0 1 6.5-1A2.9 2.9 0 1 1 14 14H7.5z"/>
      <circle cx="9" cy="16.5" r="0.7"/>
      <circle cx="12" cy="17.2" r="0.7"/>
      <circle cx="15" cy="16.5" r="0.7"/>
    </HexIcon>
  );
  // Wolke (Cloudy / Overcast)
  if (code >= 3) return (
    <HexIcon size={size}>
      <path d="M7 16a2.6 2.6 0 0 1 .5-5 3.6 3.6 0 0 1 6.9-1A3 3 0 1 1 14.4 17H7.5z"/>
    </HexIcon>
  );
  // Sonne (Clear / Mostly clear)
  return (
    <HexIcon size={size}>
      <circle cx="12" cy="12" r="2.8"/>
      <path d="M12 6.5v1.6M12 15.9v1.6M6.5 12h1.6M15.9 12h1.6M8 8l1.1 1.1M14.9 14.9L16 16M16 8l-1.1 1.1M9.1 14.9L8 16" stroke="#5BBAA7" strokeWidth="1.4" strokeLinecap="round"/>
    </HexIcon>
  );
}

// CHAT NLP
// ============================================================

function parseNaturalQuery(query: string): ParsedQuery {
  const q = query.toLowerCase();
  const ageBuckets: string[] = [];
  const childNames: Array<{ name: string; bucket: string }> = [];

  const namedRegex = /([A-ZÃ„Ã–Ãœ][a-zÃ¤Ã¶Ã¼ÃŸ]+)\s*\((\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = namedRegex.exec(query)) !== null) {
    const bucket = ageToBucket(parseInt(m[2]));
    if (bucket) {
      childNames.push({ name: m[1], bucket });
      if (!ageBuckets.includes(bucket)) ageBuckets.push(bucket);
    }
  }

  if (ageBuckets.length === 0) {
    const ageNumRegex = /(\d+)\s*[-â€“]?\s*j[Ã¤a]hr/gi;
    while ((m = ageNumRegex.exec(query)) !== null) {
      const bucket = ageToBucket(parseInt(m[1]));
      if (bucket && !ageBuckets.includes(bucket)) ageBuckets.push(bucket);
    }
  }

  if (ageBuckets.length === 0) {
    if (/kleinkind|baby|sÃ¤ugling/i.test(q)) ageBuckets.push("0-3");
    if (/vorschul|kindergarten/i.test(q)) ageBuckets.push("4-6");
    if (/schulkind|grundschul/i.test(q)) ageBuckets.push("7-9");
  }

  let indoor: boolean | null = null;
  if (/regen|regnet|indoor|drinnen/i.test(q)) indoor = true;
  if (/sonne|sonnig|schÃ¶nes?\s*wetter|outdoor|drauÃŸen|aussen/i.test(q)) indoor = false;

  const now = new Date();
  let dateFrom: Date | null = null;
  let dateTo: Date | null = null;
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  if (/\bheute\b/i.test(q)) {
    dateFrom = todayStart;
    dateTo = new Date(todayStart);
    dateTo.setHours(23, 59, 59, 999);
  } else if (/\bmorgen\b/i.test(q)) {
    dateFrom = new Date(todayStart);
    dateFrom.setDate(dateFrom.getDate() + 1);
    dateTo = new Date(dateFrom);
    dateTo.setHours(23, 59, 59, 999);
  } else if (/wochenende/i.test(q)) {
    const dow = now.getDay();
    const toSat = dow === 0 ? 6 : (6 - dow) || 7;
    dateFrom = new Date(todayStart);
    dateFrom.setDate(dateFrom.getDate() + toSat);
    dateTo = new Date(dateFrom);
    dateTo.setDate(dateTo.getDate() + 1);
    dateTo.setHours(23, 59, 59, 999);
  } else if (/nÃ¤chste\s*woche/i.test(q)) {
    const dow = now.getDay();
    const toMon = (8 - dow) % 7 || 7;
    dateFrom = new Date(todayStart);
    dateFrom.setDate(dateFrom.getDate() + toMon);
    dateTo = new Date(dateFrom);
    dateTo.setDate(dateTo.getDate() + 6);
    dateTo.setHours(23, 59, 59, 999);
  }

  const kwMap: Record<string, string[]> = {
    Kreativ:     ["bastel", "malen", "kreativ", "kunst", "zeichn", "tÃ¶pfer"],
    Sport:       ["sport", "turnen", "klettern", "schwimm", "fussball", "fuÃŸball"],
    Natur:       ["natur", "wald", "tiere", "zoo", "bauernhof"],
    Ausflug:     ["museum", "ausflug", "ausstellung"],
    Theater:     ["theater", "zirkus", "puppentheater"],
    Musik:       ["musik", "konzert", "singen"],
    Tanz:        ["tanz", "tanzen"],
    Feriencamp:  ["camp", "ferienlager", "ferien"],
  };
  const keywords: string[] = [];
  for (const [cat, kws] of Object.entries(kwMap)) {
    if (kws.some((kw) => q.includes(kw))) keywords.push(cat);
  }

  const freeOnly = /gratis|kostenlos|umsonst|gÃ¼nstig/i.test(q);

  return { ageBuckets, indoor, dateFrom, dateTo, keywords, freeOnly, childNames };
}

function filterByQuery(events: KidgoEvent[], parsed: ParsedQuery): KidgoEvent[] {
  return events.filter((event) => {
    if (parsed.ageBuckets.length > 0) {
      const ok =
        !event.alters_buckets ||
        event.alters_buckets.length === 0 ||
        parsed.ageBuckets.some((b) => event.alters_buckets!.includes(b));
      if (!ok) return false;
    }
    if (parsed.indoor === true && event.indoor_outdoor === "outdoor") return false;
    if (parsed.indoor === false && event.indoor_outdoor === "indoor") return false;
    if (event.datum) {
      const ed = new Date(event.datum + "T00:00:00");
      if (parsed.dateFrom && ed < parsed.dateFrom) return false;
      if (parsed.dateTo && ed > parsed.dateTo) return false;
    }
    if (parsed.keywords.length > 0) {
      const cats = event.kategorien || (event.kategorie ? [event.kategorie] : []);
      const dl = (event.beschreibung || "").toLowerCase();
      const tl = event.titel.toLowerCase();
      const match = parsed.keywords.some(
        (kw) => cats.includes(kw) || dl.includes(kw.toLowerCase()) || tl.includes(kw.toLowerCase())
      );
      if (!match) return false;
    }
    if (parsed.freeOnly) {
      const dl = (event.beschreibung || "").toLowerCase();
      const tl = event.titel.toLowerCase();
      const free =
        event.preis_chf === 0 ||
        ["gratis", "kostenlos", "freier eintritt"].some((kw) => dl.includes(kw) || tl.includes(kw));
      if (!free) return false;
    }
    return true;
  });
}

function buildChatResponse(parsed: ParsedQuery, total: number, weatherCode: number | null, now: Date): string {
  if (total === 0) {
    const alts = [["Museum", "Outdoor"], ["Theater", "Gratis"], ["Sport", "Kreativ"], ["Ausflug", "Natur"]];
    const pair = alts[Math.floor(Date.now() / 1000) % alts.length];
    return `Dazu habe ich leider nichts gefunden. Versuch mal "${pair[0]}" oder "${pair[1]}" â€” oder schau in alle Events.`;
  }
  const n = Math.min(3, total);
  const h = now.getHours();
  const dow = now.getDay();
  const isRainy = weatherCode !== null && weatherCode >= 51;
  const weatherCtx = isRainy ? " bei Regen" : "";

  if (parsed.childNames.length >= 2) {
    const names = parsed.childNames.map((c) => c.name).join(" und ");
    return `FÃ¼r ${names}${weatherCtx} habe ich ${n} ${n === 1 ? "Idee" : "Ideen"} gefunden:`;
  }

  if (parsed.dateFrom) {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const diff = Math.round((parsed.dateFrom.getTime() - today.getTime()) / 86400000);
    const dateLabel = diff === 0 ? "heute" : diff === 1 ? "morgen" :
      parsed.dateFrom.toLocaleDateString("de-CH", { weekday: "long" });
    const kwCtx = parsed.keywords.length > 0 ? ` ${parsed.keywords[0].toLowerCase()}` : "";
    return `FÃ¼r euren ${dateLabel}${kwCtx} habe ich ${n} ${n === 1 ? "Idee" : "Ideen"} gefunden:`;
  }

  if (parsed.keywords.length > 0) {
    const kw = parsed.keywords[0].toLowerCase();
    const ageCtx = parsed.ageBuckets.length > 0
      ? ` fÃ¼r ${parsed.ageBuckets.map((b) => AGE_BUCKETS.find((a) => a.key === b)?.label ?? b).join(" & ")}`
      : "";
    return `${n} ${kw}${ageCtx ? `-Ideen${ageCtx}` : " Tipps"} gefunden:`;
  }

  if (parsed.ageBuckets.length > 0) {
    const labels = parsed.ageBuckets.map((b) => AGE_BUCKETS.find((a) => a.key === b)?.label ?? b).join(" & ");
    const timeCtx = dow === 3 && h >= 11 && h <= 18 ? "Mittwochnachmittag" :
      (dow === 0 || dow === 6) ? "Wochenende" :
      h < 12 ? "Vormittag" : h < 17 ? "Nachmittag" : "Abend";
    return `FÃ¼r ${labels}${weatherCtx} â€” ${n} ${n === 1 ? "Tipp" : "Tipps"} fÃ¼r euren ${timeCtx}:`;
  }

  if (parsed.freeOnly) {
    return `${n} kostenlose ${n === 1 ? "Idee" : "Ideen"} gefunden:`;
  }

  const timeCtx = dow === 3 && h >= 11 && h <= 18 ? "Mittwochnachmittag" :
    (dow === 0 || dow === 6) ? "Wochenende" :
    h < 12 ? "Vormittag" : h < 17 ? "Nachmittag" : "Abend";
  return `${n} ${n === 1 ? "Tipp" : "Tipps"} fÃ¼r euren ${timeCtx}${weatherCtx}:`;
}

// ============================================================
// DAY PLAN
// ============================================================

function buildDayPlan(
  events: KidgoEvent[],
  selectedBuckets: string[],
  weatherCode: number | null,
  interests: string[] = []
): DayPlanResult {
  const now = new Date();
  const scored = [...events]
    .map((e) => ({ ...e, score: scoreEvent(e, selectedBuckets, weatherCode, now, interests).score }))
    .sort(() => Math.random() - 0.5)
    .sort((a, b) => b.score - a.score);

  const morning = scored[0] ?? null;
  if (!morning) return { morning: null, afternoon: null };

  const morningCats = new Set([
    ...(morning.kategorien ?? []),
    ...(morning.kategorie ? [morning.kategorie] : []),
  ]);

  const afternoon =
    scored.find((e) => {
      if (e.id === morning.id) return false;
      const cats = [...(e.kategorien ?? []), ...(e.kategorie ? [e.kategorie] : [])];
      return cats.length === 0 || !cats.some((c) => morningCats.has(c));
    }) ??
    scored[1] ??
    null;

  return { morning, afternoon };
}


// ============================================================
// MODULE-LEVEL 5-MINUTE EVENT CACHE
// ============================================================

let _eventsCache: KidgoEvent[] | null = null;
let _sourcesCache: { id: string; url: string | null; latitude: number | null; longitude: number | null }[] | null = null;
let _cacheTimestamp = 0;
const EVENTS_CACHE_TTL = 5 * 60 * 1000;

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Home() {
  const { user, profile, loading: authLoading } = useAuth();
  const { prefs, mounted: prefsMounted } = useUserPrefs();
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"age-select" | "recommendations">("age-select");
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([]);
  const [multiChild, setMultiChild] = useState(false);

  const [allEvents, setAllEvents] = useState<KidgoEvent[]>([]);
  const [allEventsPool, setAllEventsPool] = useState<KidgoEvent[]>([]);
  const [recommendations, setRecommendations] = useState<ScoredEvent[]>([]);
  const [surpriseEvent, setSurpriseEvent] = useState<KidgoEvent | null>(null);
  const [showSurprise, setShowSurprise] = useState(false);
  const [surpriseAnimKey, setSurpriseAnimKey] = useState(0);

  // Sprint 9C: Swipe gesture state for recommendation cards
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeHint, setSwipeHint] = useState<"left" | "right" | null>(null);
  const swipeTouchStart = useRef<{ x: number; y: number } | null>(null);

  // Sprint 12: Card stack animation
  const [cardExiting, setCardExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right">("left");
  const [cardIndex, setCardIndex] = useState(0);

  // Sprint 12: Pull-to-refresh
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pullTouchStartY = useRef<number>(0);
  const PULL_THRESHOLD = 80;

  // Sprint 9D: Page transition direction
  const [transitionClass, setTransitionClass] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<
    { id: string; url: string | null; latitude: number | null; longitude: number | null }[]
  >([]);

  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);
  const [contextMode, setContextMode] = useState<ContextMode>("normal");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
    label: string;
    approximate: boolean;
  } | null>(null);

  // Feature C: Day plan
  const [dayPlan, setDayPlan] = useState<DayPlanResult | null>(null);
  const [showDayPlan, setShowDayPlan] = useState(false);

  // Feature 1: Smart Collections
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [seriesParentIds, setSeriesParentIds] = useState<Set<string>>(new Set());

  // Feature 2: Entdecker-Score
  const [sourceCountMap, setSourceCountMap] = useState<Map<string, number>>(new Map());
  const [smallSourceIds, setSmallSourceIds] = useState<Set<string>>(new Set());

  // Sprint 11: Interests
  const [userInterests, setUserInterests] = useState<string[]>([]);

  // Sprint 11: Preference profile from liked events
  const [preferenceProfile, setPreferenceProfile] = useState<PreferenceProfile | null>(null);

  // Dismiss feature: dismissed event IDs (session + persisted), overlay state, dismiss profile
  const [dismissedEventIds, setDismissedEventIds] = useState<Set<string>>(new Set());
  const [dismissingEventId, setDismissingEventId] = useState<string | null>(null);
  const [dismissReasons, setDismissReasons] = useState<DismissReason[]>([]);
  const [dismissProfile, setDismissProfile] = useState<DismissProfile | null>(null);

  // Sprint 11: Collapsible sections (all closed by default)
  const [wochenplanerOpen, setWochenplanerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  // Feature 4: Streak
  const [visitCount, setVisitCount] = useState(0);

  // Sprint 3: Challenge
  const [challengeAccepted, setChallengeAccepted] = useState(false);
  const [showChallengeEvents, setShowChallengeEvents] = useState(false);

  // Sprint 3: Offline + PWA install
  const [isOffline, setIsOffline] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Sprint 4: Theme toggle + scroll-to-top
  const [isDark, setIsDark] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Sprint 9A: Tomorrow reminder banner
  const [tomorrowReminders, setTomorrowReminders] = useState<{ id: string; titel: string; ort: string | null }[]>([]);
  const [showReminderBanner, setShowReminderBanner] = useState(false);

  // Sprint 6: Week planner, recent visits, bookmarks
  const [selectedWeekDay, setSelectedWeekDay] = useState<number | null>(null);
  const [recentVisits, setRecentVisits] = useState<CompactEvent[]>([]);
  const [bookmarks, setBookmarks] = useState<CompactEvent[]>([]);

  // Sprint 11: Social proof, countdown
  const [bookmarkCounts, setBookmarkCounts] = useState<Map<string, number>>(new Map());
  const [countdownTick, setCountdownTick]   = useState(0);

  // Sprint 15: Badge popups + notification prompt
  const [badgePopup, setBadgePopup]         = useState<BadgeDef | null>(null);
  const [badgeQueue, setBadgeQueue]         = useState<BadgeDef[]>([]);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  // Sprint 10: Show profile setup when user logs in without profile
  useEffect(() => {
    if (!authLoading && user && profile === null) {
      setShowProfileSetup(true);
    }
  }, [authLoading, user, profile]);

  // Sprint 10: Sync bookmarks from Supabase when user logs in
  useEffect(() => {
    if (!user) return;
    
    supabase
      .from("user_bookmarks")
      .select("event_id, events(id, titel, datum, ort, kategorie_bild_url, kategorien)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const serverBookmarks: CompactEvent[] = data
          .map((row: { event_id: string; events: unknown }) => {
            const ev = row.events as CompactEvent | null;
            return ev;
          })
          .filter((ev): ev is CompactEvent => ev !== null);
        setBookmarks((prev) => {
          const existingIds = new Set(prev.map((b) => b.id));
          const merged = [
            ...prev,
            ...serverBookmarks.filter((b) => !existingIds.has(b.id)),
          ];
          return merged;
        });
      });
  }, [user]);

  // Sprint 21: Restore scroll position when returning from detail page
  const scrollRestored = useRef(false);
  useEffect(() => {
    if (!mounted) return;
    if (loading) return;
    if (recommendations.length === 0) return;
    if (scrollRestored.current) return;
    scrollRestored.current = true;
    restoreScrollPosition(window.location.pathname);
  }, [mounted, loading, recommendations.length]);

  // Sprint 21: Listen for "/" keyboard shortcut to open + focus chat
  useEffect(() => {
    const onFocusSearch = () => {
      setChatOpen(true);
      setTimeout(() => {
        document.getElementById("kidgo-chat-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
        setTimeout(() => document.getElementById("kidgo-chat-input")?.focus(), 220);
      }, 100);
    };
    window.addEventListener("kidgo:shortcut:focus-search", onFocusSearch);
    return () => window.removeEventListener("kidgo:shortcut:focus-search", onFocusSearch);
  }, []);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
    // OnboardingGate (ClientProviders) handles first-visit age collection via OnboardingFlow.
    // page.tsx reads the saved buckets and jumps straight to recommendations.
    try {
      const saved = localStorage.getItem("kidgo_age_buckets");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedBuckets(parsed);
          if (parsed.length > 1) setMultiChild(true);
          setStep("recommendations");
        }
      }
    } catch {}
    try {
      const raw = localStorage.getItem("kidgo_visit_streak");
      if (raw) {
        const streak = JSON.parse(raw);
        if (streak.weekStart === getWeekStart(new Date())) setVisitCount(streak.count);
      }
    } catch {}
    try {
      if (localStorage.getItem("kidgo_challenge_accepted") === "true") setChallengeAccepted(true);
    } catch {}
    try {
      const raw = localStorage.getItem("kidgo_recent_visits");
      if (raw) setRecentVisits(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem("kidgo_bookmarks");
      if (raw) setBookmarks(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem("kidgo_interests");
      if (raw) setUserInterests(JSON.parse(raw));
    } catch {}
    try {
      const rated = getRatedEvents();
      const profile = buildPreferenceProfile(rated);
      setPreferenceProfile(profile);
    } catch {}
    try {
      const ids = getDismissedEventIds();
      if (ids.length > 0) setDismissedEventIds(new Set(ids));
      const pastDismissals = getPastDismissals();
      if (pastDismissals.length > 0) setDismissProfile(buildDismissProfile(pastDismissals));
    } catch {}

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Track weekly activity for Stammgast badge
    trackWeeklyActivity();

    // Notification permission: elegant prompt after 6s (first visit, not yet granted/denied)
    if ("Notification" in window && Notification.permission === "default") {
      const dismissed = localStorage.getItem("kidgo_notif_prompt_dismissed");
      if (!dismissed) {
        setTimeout(() => setShowNotifPrompt(true), 6000);
      }
    }

    // Push notifications â€” max once per day (spam protection)
    if ("Notification" in window && Notification.permission === "granted") {
      const today = new Date().toISOString().split("T")[0];
      const lastSent = localStorage.getItem("kidgo_push_last_sent");
      if (lastSent !== today) {
        navigator.serviceWorker.ready.then((reg) => {
          // Event reminders for today / tomorrow
          try {
            const raw = localStorage.getItem("kidgo_reminders");
            if (raw) {
              const reminders: { id: string; titel: string; datum: string; ort: string }[] = JSON.parse(raw);
              const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
              for (const r of reminders) {
                if (r.datum === today || r.datum === tomorrow) {
                  reg.active?.postMessage({ type: "SHOW_REMINDER", ...r });
                }
              }
            }
          } catch {}
          localStorage.setItem("kidgo_push_last_sent", today);
        }).catch(() => {});
      }
    }

    // Sprint 9A: In-app banner for tomorrow's reminders
    try {
      const raw = localStorage.getItem("kidgo_reminders");
      if (raw) {
        const reminders: { id: string; titel: string; datum: string; ort: string | null }[] = JSON.parse(raw);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
        const hits = reminders.filter((r) => r.datum === tomorrow);
        if (hits.length > 0) {
          setTomorrowReminders(hits);
          setShowReminderBanner(true);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=47.37&longitude=8.54&current=weather_code,temperature_2m"
    )
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.current?.weather_code === "number") {
          setWeatherCode(d.current.weather_code);
          setContextMode(getContextMode(d.current.weather_code));
        } else {
          setContextMode(getContextMode(null));
        }
        if (typeof d?.current?.temperature_2m === "number") setWeatherTemp(d.current.temperature_2m);
      })
      .catch(() => { setContextMode(getContextMode(null)); });
  }, []);

  // Sprint 3: Offline detection
  useEffect(() => {
    if (!mounted) return;
    setIsOffline(!navigator.onLine);
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [mounted]);

  // Sprint 4: Scroll-to-top visibility
  useEffect(() => {
    if (!mounted) return;
    const handleScroll = () => setShowScrollTop(window.scrollY > 350);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mounted]);

  // Sprint 11: Live countdown tick every minute
  useEffect(() => {
    const interval = setInterval(() => setCountdownTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  // Sprint 15: Weekend preview push â€” Friday 16:00+, max once per day
  useEffect(() => {
    if (!mounted || allEventsPool.length === 0) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    if (now.getDay() !== 5 || now.getHours() < 16) return;
    const today = now.toISOString().split("T")[0];
    const lastSent = localStorage.getItem("kidgo_push_last_sent");
    if (lastSent === today) return;
    const sat = new Date(now); sat.setDate(now.getDate() + (6 - now.getDay()));
    const sun = new Date(now); sun.setDate(now.getDate() + (7 - now.getDay()));
    const satStr = sat.toISOString().split("T")[0];
    const sunStr = sun.toISOString().split("T")[0];
    const weekendEvents = allEventsPool
      .filter((e) => e.datum && (e.datum === satStr || e.datum === sunStr))
      .slice(0, 3);
    if (weekendEvents.length === 0) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: "SHOW_WEEKEND_PREVIEW", events: weekendEvents });
      localStorage.setItem("kidgo_push_last_sent", today);
    }).catch(() => {});
  }, [mounted, allEventsPool]);

  // Sprint 3: PWA install banner
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
      try {
        if (!localStorage.getItem("kidgo_install_dismissed")) setShowInstallBanner(true);
      } catch {}
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      const cached = localStorage.getItem("kidgo_location");
      if (cached) {
        const loc = JSON.parse(cached);
        if (loc.lat && loc.lon) setUserLocation(loc);
      }
    } catch {}

    const snapToZH = (lat: number, lon: number): { label: string; lat: number; lon: number } => {
      let nearest = "ZÃ¼rich";
      let minDist = Infinity;
      for (const [city, [clat, clon]] of Object.entries(ZH_CITIES)) {
        const d = haversine(lat, lon, clat, clon);
        if (d < minDist) { minDist = d; nearest = city; }
      }
      const [slat, slon] = ZH_CITIES[nearest];
      return { label: nearest, lat: slat, lon: slon };
    };

    if (!navigator.geolocation) {
      fetch("https://ipapi.co/json/")
        .then((r) => r.json())
        .then((d) => {
          if (d.latitude && d.longitude) {
            const snapped = snapToZH(parseFloat(d.latitude), parseFloat(d.longitude));
            const loc = { ...snapped, approximate: true };
            setUserLocation(loc);
            localStorage.setItem("kidgo_location", JSON.stringify(loc));
          }
        })
        .catch(() => {});
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Dein Standort",
          approximate: false,
        };
        setUserLocation(loc);
        localStorage.setItem("kidgo_location", JSON.stringify(loc));
      },
      () => {
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then((d) => {
            if (d.latitude && d.longitude) {
              const snapped = snapToZH(parseFloat(d.latitude), parseFloat(d.longitude));
              const loc = { ...snapped, approximate: true };
              setUserLocation(loc);
              localStorage.setItem("kidgo_location", JSON.stringify(loc));
            }
          })
          .catch(() => {});
      },
      { timeout: 5000 }
    );
  }, [mounted]);

  // After OnboardingFlow completes, sync age buckets from UserPrefsContext into local state.
  // Note: advance to "recommendations" even when no ages were selected (show all events).
  useEffect(() => {
    if (!prefsMounted || !prefs.onboarded) return;
    if (prefs.ageBuckets.length > 0) {
      setSelectedBuckets((prev) => (prev.length > 0 ? prev : prefs.ageBuckets));
      if (prefs.ageBuckets.length > 1) setMultiChild(true);
    }
    setStep("recommendations");
  // prefs.ageBuckets.join ensures the effect re-runs when the array content changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsMounted, prefs.onboarded, prefs.ageBuckets.join(",")]);

  useEffect(() => {
    if (step !== "recommendations") return;
    fetchAndScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedBuckets, weatherCode]);

  const fetchAndScore = async () => {
    setLoading(true);
    setSurpriseEvent(null);
    setShowSurprise(false);
    setDayPlan(null);
    setShowDayPlan(false);

    // Dismissed IDs â€” read fresh from storage so fetch is always consistent
    const currentDismissedIds = new Set([...getDismissedEventIds(), ...dismissedEventIds]);

    // Sprint 3: Offline â€” serve cached events
    if (isOffline) {
      try {
        const cached = localStorage.getItem("kidgo_cached_events");
        if (cached) {
          const eventsData = JSON.parse(cached) as KidgoEvent[];
          setAllEventsPool(eventsData);
          const ageFiltered = eventsData.filter(
            (e) => !e.alters_buckets || e.alters_buckets.length === 0 || selectedBuckets.some((b) => e.alters_buckets!.includes(b))
          );
          setAllEvents(ageFiltered);
          const now = new Date();
          const scored: ScoredEvent[] = ageFiltered
            .filter((e) => !currentDismissedIds.has(e.id))
            .map((event) => {
              const { score, reasons } = scoreEvent(event, selectedBuckets, weatherCode, now, userInterests, preferenceProfile, dismissProfile);
              return { ...event, score, reasons };
            });
          scored.sort((a, b) => b.score - a.score);
          setRecommendations(scored.slice(0, 3));
        }
      } catch {}
      setLoading(false);
      return;
    }

    // Sprint 4: 5-minute in-memory cache
    if (_eventsCache && _sourcesCache && Date.now() - _cacheTimestamp < EVENTS_CACHE_TTL) {
      setSources(_sourcesCache);
      setAllEventsPool(_eventsCache);
      const ageFiltered = _eventsCache.filter(
        (e) => !e.alters_buckets || e.alters_buckets.length === 0 || selectedBuckets.some((b) => e.alters_buckets!.includes(b))
      );
      setAllEvents(ageFiltered);
      const now = new Date();
      const scored: ScoredEvent[] = ageFiltered
        .filter((e) => !currentDismissedIds.has(e.id))
        .map((event) => {
          const { score, reasons } = scoreEvent(event, selectedBuckets, weatherCode, now, userInterests, preferenceProfile, dismissProfile);
          return { ...event, score, reasons };
        });
      scored.sort((a, b) => b.score - a.score);
      setRecommendations(scored.slice(0, 3));
      setLoading(false);
      return;
    }

    try {
      const todayStr = new Date().toISOString().split("T")[0];

      const { data: sourcesData } = await supabase
        .from("quellen")
        .select("id, url, latitude, longitude");
      setSources(sourcesData || []);

      const { data: serieData } = await supabase
        .from("events")
        .select("serie_id")
        .not("serie_id", "is", null)
        .eq("status", "approved");
      setSeriesParentIds(new Set((serieData || []).map((e: { serie_id: string }) => e.serie_id)));

      const { data: eventsData } = await supabase
        .from("events")
        .select("id,titel,datum,datum_ende,ort,beschreibung,kategorie_bild_url,status,event_typ,altersgruppen,alters_buckets,alter_von,alter_bis,indoor_outdoor,kategorie,kategorien,preis_chf,anmelde_link,quelle_id,created_at,serie_id")
        .eq("status", "approved")
        .is("serie_id", null)
        .or(`datum.is.null,datum.gte.${todayStr}`)
        .order("datum", { ascending: true, nullsFirst: false });

      if (!eventsData || eventsData.length === 0) {
        setAllEvents([]);
        setAllEventsPool([]);
        setRecommendations([]);
        setLoading(false);
        return;
      }

      setAllEventsPool(eventsData);

      // Sprint 4: Populate module-level cache
      _eventsCache = eventsData;
      _sourcesCache = sourcesData || [];
      _cacheTimestamp = Date.now();

      // Sprint 9B: Cache last 50 events for offline use
      try {
        localStorage.setItem("kidgo_cached_events", JSON.stringify(eventsData.slice(0, 50)));
      } catch {}

      // Sprint 11: Social proof â€” aggregate bookmark counts
      try {
        
        const { data: bkData } = await supabase.rpc("get_event_bookmark_counts");
        if (bkData) {
          const bkMap = new Map<string, number>();
          for (const row of bkData as { event_id: string; bookmark_count: number }[]) {
            bkMap.set(row.event_id, row.bookmark_count);
          }
          setBookmarkCounts(bkMap);
        }
      } catch {}

      const countMap = new Map<string, number>();
      for (const e of eventsData) {
        if (e.quelle_id) countMap.set(e.quelle_id, (countMap.get(e.quelle_id) || 0) + 1);
      }
      setSourceCountMap(countMap);
      const smallIds = new Set<string>();
      for (const [sid, cnt] of countMap) {
        if (cnt < 10) smallIds.add(sid);
      }
      setSmallSourceIds(smallIds);

      const ageFiltered = eventsData.filter(
        (e) =>
          !e.alters_buckets ||
          e.alters_buckets.length === 0 ||
          selectedBuckets.some((b) => e.alters_buckets.includes(b))
      );
      setAllEvents(ageFiltered);

      const now = new Date();
      const scored: ScoredEvent[] = ageFiltered
        .filter((e) => !currentDismissedIds.has(e.id))
        .map((event) => {
          const { score, reasons } = scoreEvent(event, selectedBuckets, weatherCode, now, userInterests, preferenceProfile, dismissProfile);
          return { ...event, score, reasons };
        });

      const shuffled = [...scored].sort(() => Math.random() - 0.5);
      shuffled.sort((a, b) => b.score - a.score);

      const geheimtipps = shuffled.filter((e) => e.quelle_id && smallIds.has(e.quelle_id));
      const regular = shuffled.filter((e) => !e.quelle_id || !smallIds.has(e.quelle_id));
      let recs: ScoredEvent[];
      if (geheimtipps.length > 0 && regular.length >= 2) {
        recs = [regular[0], regular[1], geheimtipps[0]];
      } else {
        recs = shuffled.slice(0, 3);
      }
      setRecommendations(recs);
    } catch (e) {
      console.error("Fehler beim Laden der Empfehlungen:", e);
    }
    setLoading(false);
  };

  const triggerBadgeCheck = () => {
    const stats = getLocalStats(bookmarks.length);
    const newBadges = popNewBadges(stats);
    if (newBadges.length > 0) {
      setBadgePopup(newBadges[0]);
      setBadgeQueue(newBadges.slice(1));
    }
  };

  const handleBadgePopupClose = () => {
    setBadgePopup(null);
    setBadgeQueue((prev) => {
      if (prev.length === 0) return prev;
      const [next, ...rest] = prev;
      setTimeout(() => { setBadgePopup(next); setBadgeQueue(rest); }, 400);
      return [];
    });
  };

  const handleGenerateDayPlan = () => {
    if (allEvents.length === 0) return;
    const plan = buildDayPlan(allEvents, selectedBuckets, weatherCode, userInterests);
    setDayPlan(plan);
    setShowDayPlan(true);
    trackDayPlanUsed();
    triggerBadgeCheck();
    setTimeout(() => {
      document.getElementById("day-plan")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("kidgo_theme", next ? "dark" : "light"); } catch {}
  };

  const navigateForward = (target: "age-select" | "recommendations") => {
    setTransitionClass("page-slide-in");
    setStep(target);
  };

  const navigateBack = (target: "age-select" | "recommendations") => {
    setTransitionClass("page-slide-back");
    setStep(target);
  };

  const handleAgeSelect = (bucket: string) => {
    if (multiChild) {
      setSelectedBuckets((prev) =>
        prev.includes(bucket) ? prev.filter((b) => b !== bucket) : [...prev, bucket]
      );
    } else {
      const newBuckets = [bucket];
      setSelectedBuckets(newBuckets);
      localStorage.setItem("kidgo_age_buckets", JSON.stringify(newBuckets));
      navigateForward("recommendations");
    }
  };

  const handleMultiChildConfirm = () => {
    if (selectedBuckets.length === 0) return;
    localStorage.setItem("kidgo_age_buckets", JSON.stringify(selectedBuckets));
    navigateForward("recommendations");
  };

  const handleChangeAge = () => {
    navigateBack("age-select");
    setSelectedBuckets([]);
    setMultiChild(false);
    setRecommendations([]);
    setAllEvents([]);
    setAllEventsPool([]);
    setSurpriseEvent(null);
    setShowSurprise(false);
    setDayPlan(null);
    setShowDayPlan(false);
    setActiveCollection(null);
    localStorage.removeItem("kidgo_age_buckets");
  };

  const handleSurprise = () => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const in14Str = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const pool = allEvents.filter((e) => e.datum && e.datum >= todayStr && e.datum <= in14Str);
    const source = pool.length > 0 ? pool : allEvents;
    const picked = source[Math.floor(Math.random() * source.length)];
    setSurpriseEvent(picked || null);
    setShowSurprise(true);
    setSurpriseAnimKey((k) => k + 1);
    setTimeout(() => {
      document.getElementById("surprise-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // ---- Dismiss handlers ----
  const handleDismissOpen = (event: KidgoEvent) => {
    const past = getPastDismissals();
    let distanceKm: number | null = null;
    if (userLocation) {
      const src = sources.find((s) => s.id === event.quelle_id);
      if (src?.latitude && src?.longitude) {
        distanceKm = haversine(userLocation.lat, userLocation.lon, src.latitude, src.longitude);
      }
    }
    const reasons = generateDismissReasons(event, {
      distanceKm,
      weatherCode,
      selectedBuckets,
      pastDismissals: past,
    });
    setDismissReasons(reasons);
    setDismissingEventId(event.id);
  };

  const handleDismissSubmit = (eventId: string, selectedReasonIds: string[]) => {
    const event =
      allEventsPool.find((e) => e.id === eventId) ??
      recommendations.find((e) => e.id === eventId);

    const src = event?.quelle_id ? sources.find((s) => s.id === event.quelle_id) : undefined;
    let distanceKm: number | null = null;
    if (userLocation && src?.latitude && src?.longitude) {
      distanceKm = haversine(userLocation.lat, userLocation.lon, src.latitude, src.longitude);
    }

    const eventMeta: EventMeta = {
      kategorien: event?.kategorien ?? null,
      preis_chf: event?.preis_chf ?? null,
      indoor_outdoor: event?.indoor_outdoor ?? null,
      alter_von: event?.alter_von ?? null,
      alter_bis: event?.alter_bis ?? null,
      distanceKm,
    };

    trackEvent("event_dismiss", { event_id: eventId, reasons: selectedReasonIds.join(",") });
    saveDismissalLocally(eventId, selectedReasonIds, eventMeta);

    if (user) {
      saveDismissalToSupabase(supabase, user.id, eventId, selectedReasonIds, eventMeta);
    }

    setDismissedEventIds((prev) => new Set([...prev, eventId]));
    setRecommendations((prev) => prev.filter((e) => e.id !== eventId));

    const updated = getPastDismissals();
    if (updated.length > 0) setDismissProfile(buildDismissProfile(updated));

    setDismissingEventId(null);
  };

  // Sprint 12: Card stack â€” animated swipe handlers
  const handleSwipeLeft = () => {
    if (recommendations.length === 0 || cardExiting || dismissingEventId) return;
    setSwipeOffset(0);
    setSwipeHint(null);
    // Open dismiss overlay instead of silently cycling
    handleDismissOpen(recommendations[0]);
  };

  // Cycle card without dismiss (used by explicit "next" button when overlay is not wanted)
  const handleCycleCard = () => {
    if (recommendations.length < 2 || cardExiting) return;
    setExitDirection("left");
    setCardExiting(true);
    setSwipeOffset(0);
    setSwipeHint(null);
    setTimeout(() => {
      setRecommendations((prev) => [...prev.slice(1), prev[0]]);
      setCardIndex((i) => (i + 1) % Math.max(1, recommendations.length));
      setCardExiting(false);
    }, 340);
  };

  const handleSwipeRight = () => {
    if (recommendations.length === 0 || cardExiting) return;
    setSwipeHint(null);
    const top = recommendations[0];
    try { (navigator as any).vibrate?.(10); } catch {}
    toggleBookmark(top, { preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.MouseEvent);
    setExitDirection("right");
    setCardExiting(true);
    setSwipeOffset(0);
    setTimeout(() => {
      setRecommendations((prev) => [...prev.slice(1), prev[0]]);
      setCardIndex((i) => (i + 1) % Math.max(1, recommendations.length));
      setCardExiting(false);
    }, 340);
  };

  const handleRecTouchStart = (e: React.TouchEvent) => {
    if (cardExiting) return;
    const t = e.touches[0];
    swipeTouchStart.current = { x: t.clientX, y: t.clientY };
    setSwipeOffset(0);
    setSwipeHint(null);
  };

  const handleRecTouchMove = (e: React.TouchEvent) => {
    if (!swipeTouchStart.current || cardExiting) return;
    const dx = e.touches[0].clientX - swipeTouchStart.current.x;
    const dy = e.touches[0].clientY - swipeTouchStart.current.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    setSwipeOffset(dx);
    setSwipeHint(dx < -30 ? "left" : dx > 30 ? "right" : null);
  };

  const handleRecTouchEnd = (e: React.TouchEvent) => {
    if (!swipeTouchStart.current || cardExiting) return;
    const dx = e.changedTouches[0].clientX - swipeTouchStart.current.x;
    const dy = e.changedTouches[0].clientY - swipeTouchStart.current.y;
    swipeTouchStart.current = null;
    setSwipeOffset(0);
    setSwipeHint(null);
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 60) return;
    if (dx < 0) handleSwipeLeft();
    else handleSwipeRight();
  };

  // Sprint 12: Pull-to-refresh handlers
  const handlePageTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      pullTouchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handlePageTouchMove = (e: React.TouchEvent) => {
    if (!isPulling) return;
    const dy = e.touches[0].clientY - pullTouchStartY.current;
    if (dy > 0 && window.scrollY === 0) {
      setPullY(Math.min(dy * 0.55, 100));
    } else {
      setIsPulling(false);
      setPullY(0);
    }
  };

  const handlePageTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullY >= PULL_THRESHOLD) {
      setPullY(0);
      setIsRefreshing(true);
      _eventsCache = null;
      _sourcesCache = null;
      _cacheTimestamp = 0;
      await fetchAndScore();
      setIsRefreshing(false);
    } else {
      setPullY(0);
    }
  };

  const toggleBookmark = (event: KidgoEvent, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { (navigator as any).vibrate?.(10); } catch {}
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === event.id);
      if (!exists && event.quelle_id && smallSourceIds.has(event.quelle_id)) {
        trackGeheimtipp(event.id);
      }
      trackEvent("event_bookmark", { event_id: event.id, action: exists ? "remove" : "add" });
      if (!exists) trackFirstBookmark(event.id);
      const next: CompactEvent[] = exists
        ? prev.filter((b) => b.id !== event.id)
        : [{ id: event.id, titel: event.titel, datum: event.datum, ort: event.ort, kategorie_bild_url: event.kategorie_bild_url, kategorien: event.kategorien }, ...prev];
      try { localStorage.setItem("kidgo_bookmarks", JSON.stringify(next)); } catch {}
      // Sync to Supabase if logged in
      if (user) {
        
        if (exists) {
          supabase.from("user_bookmarks").delete().eq("user_id", user.id).eq("event_id", event.id);
        } else {
          supabase.from("user_bookmarks").upsert({ user_id: user.id, event_id: event.id });
        }
      }
      return next;
    });
  };

  const removeBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      try { localStorage.setItem("kidgo_bookmarks", JSON.stringify(next)); } catch {}
      if (user) {
        
        supabase.from("user_bookmarks").delete().eq("user_id", user.id).eq("event_id", id);
      }
      return next;
    });
  };

  // Sprint 3: Complete onboarding

  const now = new Date();
  const headline = getHeadline(now);

  // Sprint 11: Gamification
  const gamificationStats = mounted ? getLocalStats(bookmarks.length) : null;
  const levelInfo = gamificationStats ? getLevelProgress(gamificationStats.visitedEventIds.length) : null;

  // useMemo must be called before any conditional return (Rules of Hooks)
  const contextRecs = useMemo(
    () => applyContextSort([...recommendations], contextMode) as ScoredEvent[],
    [recommendations, contextMode]
  );
  const contextBadge = getContextBadge(contextMode);
  const contextLabel = getContextLabel(contextMode);

  if (!mounted) return null;


  // ===== STEP 1: AGE SELECTION =====
  if (step === "age-select") {
    return (
      <main className={`min-h-screen bg-[#5BBAA7] flex flex-col items-center justify-center p-4 ${transitionClass}`}>
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="mb-4 flex justify-center"><KidgoLogo size="md" /></div>
            <h1 className="text-3xl font-bold text-white mb-2">Willkommen bei Kidgo</h1>
            <p className="text-white/80 text-lg">Wie alt ist dein Kind?</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {AGE_BUCKETS.map((bucket) => {
              const selected = selectedBuckets.includes(bucket.key);
              return (
                <button
                  key={bucket.key}
                  onClick={() => handleAgeSelect(bucket.key)}
                  aria-label={`Altersgruppe ${bucket.label} auswÃ¤hlen`}
                  aria-pressed={selected}
                  className={`relative p-5 rounded-2xl border-2 transition-all duration-200 text-left shadow-sm hover:shadow-md active:scale-95 bounce-hover ${
                    selected && multiChild
                      ? "border-kidgo-400 bg-kidgo-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-kidgo-300 hover:bg-kidgo-50/50"
                  }`}
                >
                  <div className="mb-2 text-kidgo-500">
                    {bucket.key === "0-3"   && <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M3 20c0-4 4-7 9-7s9 3 9 7"/><path d="M9 8h.01M15 8h.01"/><path d="M9.5 10.5 Q12 12 14.5 10.5"/></svg>}
                    {bucket.key === "4-6"   && <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"/><path d="M12 8v8M9 12h6M9 21l3-5 3 5"/></svg>}
                    {bucket.key === "7-9"   && <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="2.5"/><path d="M14 10l3 4-2 1M10 10l-3 4 2 1M12 10v5M10 21l2-6 2 6"/></svg>}
                    {bucket.key === "10-12" && <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="13" r="4"/><path d="M16 13h6M14.5 10.5L20 5M5 14H2M3 8l5 5"/></svg>}
                  </div>
                  <div className="font-bold text-gray-800 text-lg leading-tight">{bucket.label}</div>
                  <div className="text-gray-500 text-sm mt-0.5">{bucket.desc}</div>
                  {selected && multiChild && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-kidgo-400 rounded-full flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {!multiChild ? (
            <button
              onClick={() => { setMultiChild(true); setSelectedBuckets([]); }}
              className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-medium hover:border-kidgo-300 hover:text-kidgo-500 transition text-sm"
            >
              <span className="flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6"/><path d="M17 14c2.5 0 5 1.5 5 5"/></svg>
                Mehrere Kinder
              </span>
            </button>
          ) : (
            <div className="space-y-2 mt-1">
              <button
                onClick={handleMultiChildConfirm}
                disabled={selectedBuckets.length === 0}
                className="w-full py-3.5 bg-kidgo-400 text-white rounded-2xl font-bold text-lg hover:bg-kidgo-500 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              >
                Empfehlungen anzeigen â†’
              </button>
              <button
                onClick={() => { setMultiChild(false); setSelectedBuckets([]); }}
                className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition"
              >
                Abbrechen
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ===== STEP 2: RECOMMENDATIONS =====

  // Weekend events for Layer 2
  const weekendEventsForLayer2 = (() => {
    const dow2 = now.getDay();
    const toSat = dow2 === 0 ? 6 : dow2 === 6 ? 0 : (6 - dow2);
    const sat = new Date(now); sat.setDate(sat.getDate() + toSat); sat.setHours(0, 0, 0, 0);
    const sun = new Date(sat); sun.setDate(sun.getDate() + 1);
    const satStr = localDateStr(sat);
    const sunStr = localDateStr(sun);
    return allEventsPool
      .filter((e) => e.datum === satStr || e.datum === sunStr)
      .map((e) => { const { score } = scoreEvent(e, selectedBuckets, weatherCode, now, userInterests, preferenceProfile); return { ...e, score }; })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  })();

  // Seasonal config for Layer 2
  const campCount = allEventsPool.filter((e) => {
    const desc = (e.beschreibung || "").toLowerCase();
    const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
    return e.event_typ === "camp" || cats.includes("Feriencamp") || desc.includes("camp") || desc.includes("ferienlager");
  }).length;

  return (
    <>
    {showProfileSetup && (
      <ProfileSetupModal onComplete={() => setShowProfileSetup(false)} />
    )}
    <main
      id="main-content"
      role="main"
      className={`min-h-screen bg-[#F8F5F0] dark:bg-[#1A1D1C] ${transitionClass}`}
      onTouchStart={handlePageTouchStart}
      onTouchMove={handlePageTouchMove}
      onTouchEnd={handlePageTouchEnd}
    >
      {/* Sprint 12: Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div
          className="flex justify-center items-center overflow-hidden"
          style={{
            height: isRefreshing ? "64px" : `${Math.min(pullY * 0.85, 64)}px`,
            transition: isRefreshing ? "none" : "height 0.1s linear",
          }}
        >
          <div
            className={isRefreshing ? "logo-spin" : ""}
            style={{ transform: !isRefreshing ? `rotate(${pullY * 2.8}deg)` : undefined }}
          >
            <KidgoLogo size="xs" />
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 pb-24 md:pb-10">

        {/* Sprint 3: PWA Install Banner */}
        {showInstallBanner && (
          <div className="mb-5 bg-gradient-to-r from-kidgo-400 to-kidgo-300 preserve-gradient text-white rounded-2xl px-5 py-4 shadow-md card-enter">
            <div className="flex items-center gap-3">
              <PhoneIcon size={28} color="white" />
              <div className="flex-1">
                <p className="font-bold text-sm">Als App installieren</p>
                <p className="text-kidgo-100 text-xs mt-0.5">Schneller Zugriff direkt vom Homescreen</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (installPrompt) {
                      (installPrompt as any).prompt();
                      setShowInstallBanner(false);
                    }
                  }}
                  className="bg-white text-kidgo-500 text-xs font-bold px-3 py-2 rounded-xl hover:bg-kidgo-50 transition active:scale-95"
                >
                  Installieren
                </button>
                <button
                  onClick={() => {
                    setShowInstallBanner(false);
                    try { localStorage.setItem("kidgo_install_dismissed", "true"); } catch {}
                  }}
                  className="text-kidgo-200 hover:text-white text-xl leading-none w-7 h-7 flex items-center justify-center"
                >
                  âœ•
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sprint 9A: Tomorrow reminder banner */}
        {showReminderBanner && tomorrowReminders.length > 0 && (
          <div className="mb-5 bg-[var(--bg-card)] border border-kidgo-200 rounded-2xl px-5 py-4 shadow-sm card-enter">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-kidgo-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="16" height="16" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7.5 1.5a5 5 0 0 1 5 5v3l1 1.5H1.5L2.5 9.5v-3a5 5 0 0 1 5-5z"/>
                  <path d="M6 12.5a1.5 1.5 0 0 0 3 0"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[var(--text-primary)]">Morgen steht an:</p>
                {tomorrowReminders.map((r) => (
                  <Link
                    key={r.id}
                    href={`/events/${r.id}`}
                    className="block mt-1"
                  >
                    <p className="text-sm font-semibold text-kidgo-500 hover:text-kidgo-400 transition truncate">{r.titel}</p>
                    {r.ort && <p className="text-xs text-[var(--text-muted)] truncate">{r.ort.split(",")[0].trim()}</p>}
                  </Link>
                ))}
              </div>
              <button
                onClick={() => setShowReminderBanner(false)}
                aria-label="Banner schliessen"
                className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] w-6 h-6 flex items-center justify-center flex-shrink-0 transition"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2 2l6 6M8 2l-6 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Sprint 15: Badge popup */}
        <BadgePopup badge={badgePopup} onClose={handleBadgePopupClose} />

        {/* Sprint 15: Notification permission prompt */}
        {showNotifPrompt && (
          <div className="mb-4 bg-[var(--bg-card)] border border-[var(--accent)]/30 rounded-2xl px-4 py-3.5 flex items-center gap-3 card-enter shadow-sm">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)] flex-shrink-0"><path d="M9 2a5 5 0 0 1 5 5v3l1 1.5H3L4 10V7a5 5 0 0 1 5-5z"/><path d="M7.5 14a1.5 1.5 0 0 0 3 0"/></svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Events nicht verpassen</p>
              <p className="text-xs text-[var(--text-muted)]">Erhalte Erinnerungen fÃ¼r gemerkten Events</p>
            </div>
            <button
              onClick={() => {
                Notification.requestPermission().then((p) => {
                  if (p === "denied") {
                    try { localStorage.setItem("kidgo_notif_prompt_dismissed", "true"); } catch {}
                  }
                });
                setShowNotifPrompt(false);
              }}
              className="bg-[var(--accent)] text-white rounded-xl px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition flex-shrink-0"
            >
              Ja, gerne
            </button>
            <button
              onClick={() => {
                setShowNotifPrompt(false);
                try { localStorage.setItem("kidgo_notif_prompt_dismissed", "true"); } catch {}
              }}
              aria-label="Schliessen"
              className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] w-6 h-6 flex items-center justify-center flex-shrink-0 transition"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 2l6 6M8 2l-6 6"/>
              </svg>
            </button>
          </div>
        )}

        {/* Sprint 3: Offline Banner */}
        {isOffline && (
          <div className="mb-5 bg-gray-700 text-white rounded-2xl px-5 py-3.5 shadow-md flex items-center gap-3 card-enter">
            <WifiOffIcon size={22} color="white" />
            <div>
              <p className="font-bold text-sm">Du bist offline</p>
              <p className="text-gray-300 text-xs mt-0.5">Zuletzt gesehene Events werden angezeigt</p>
            </div>
          </div>
        )}

        {/* Sprint 12: Glassmorphism sticky header bar */}
        <div className="sticky top-0 z-30 -mx-4 px-4 py-2.5 mb-5 glass-header">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <Link href="/" aria-label="Startseite">
              <KidgoLogo size="sm" animated />
            </Link>
            <div className="flex items-center gap-2">
              {weatherCode !== null && (
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl pl-1 pr-3 py-1 text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5 border border-gray-100 dark:border-gray-700">
                  <WeatherIcon code={weatherCode} size={26} />
                  {weatherTemp !== null && (
                    <span className="font-medium">{Math.round(weatherTemp)}Â°C</span>
                  )}
                </div>
              )}
              <AuthButton level={levelInfo ? levelInfo.current.label : undefined} />
              <button
                onClick={toggleTheme}
                aria-label={isDark ? "Helles Design aktivieren" : "Dunkles Design aktivieren"}
                className="bg-white/80 dark:bg-gray-800/80 rounded-xl w-9 h-9 flex items-center justify-center border border-gray-100 dark:border-gray-700 hover:border-gray-200 transition text-gray-500 dark:text-gray-400"
              >
                {isDark ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="3.5"/>
                    <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M12.8 3.2l-1 1M4.2 11.8l-1 1"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 9A6 6 0 1 1 7 3a4.5 4.5 0 0 0 6 6z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <header className="mb-8">
          {/* Contextual mode badge */}
          {contextBadge && (
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-kidgo-50 text-kidgo-600 border border-kidgo-100 dark:bg-kidgo-900/20 dark:text-kidgo-400 dark:border-kidgo-800">
                {contextBadge}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{contextLabel}</span>
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 leading-tight mb-1">
            {contextMode === "evening" ? "FÃ¼r morgen geplant" : headline.title}
          </h1>
          <p className="text-gray-500 text-sm mb-3">{headline.subtitle}</p>

          <div className="flex flex-wrap items-center gap-2">
            {selectedBuckets.map((b) => {
              const bucket = AGE_BUCKETS.find((a) => a.key === b)!;
              return (
                <span key={b} className="bg-kidgo-100 text-kidgo-600 text-sm font-medium px-3 py-1 rounded-full">
                  {bucket.label}
                </span>
              );
            })}
            <button
              onClick={handleChangeAge}
              aria-label="Altersgruppe Ã¤ndern"
              className="text-xs text-gray-400 hover:text-kidgo-500 transition"
            >
              Alter Ã¤ndern
            </button>
          </div>

          {userLocation?.approximate && (
            <div className="mt-2.5 text-xs text-gray-400 flex items-start gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 text-gray-400 flex-shrink-0">
                <path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3z"/><circle cx="6" cy="4" r="1"/>
              </svg>
              <span>
                UngefÃ¤hr in {userLocation.label} â€”{" "}
                <button
                  onClick={() =>
                    navigator.geolocation?.getCurrentPosition((pos) =>
                      setUserLocation({
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        label: "Dein Standort",
                        approximate: false,
                      })
                    )
                  }
                  className="underline hover:text-gray-600 transition"
                >
                  Standort aktivieren
                </button>{" "}
                fÃ¼r genauere Tipps
              </span>
            </div>
          )}
        </header>

        {/* ===== LAYER 1: HERO SECTION (above the fold) ===== */}

        {/* Loading state */}
        {loading && (
          <div className="space-y-4" role="status" aria-label="Events werden geladen">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-enter" style={{ animationDelay: `${i * 120}ms` }}>
                <SkeletonCard />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && recommendations.length === 0 && !isOffline && (
          <div className="text-center py-14 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="empty-float mx-auto mb-5 w-20 h-20 flex items-center justify-center">
              <HexIcon size={80}>
                <rect x="6.5" y="8.5" width="11" height="9" rx="1.2"/>
                <rect x="6.5" y="8.5" width="11" height="2.4"/>
                <rect x="8.5" y="6.8" width="1.2" height="3.2" rx="0.4"/>
                <rect x="14.3" y="6.8" width="1.2" height="3.2" rx="0.4"/>
                <rect x="11.4" y="12" width="1.2" height="4" rx="0.3" fill="#F5F0E8"/>
                <rect x="10" y="13.4" width="4" height="1.2" rx="0.3" fill="#F5F0E8"/>
              </HexIcon>
            </div>
            <p className="text-[var(--text-primary)] font-semibold mb-1">Keine aktuellen Events gefunden</p>
            <p className="text-[var(--text-muted)] text-sm mb-5">Schau im Katalog nach weiteren AktivitÃ¤ten</p>
            <Link href="/explore" className="bg-kidgo-400 text-white px-6 py-3 rounded-xl font-semibold hover:bg-kidgo-500 transition">
              Alle Events entdecken
            </Link>
          </div>
        )}

        {!loading && contextRecs.length > 0 && (
          <HeroSection
            contextRecs={contextRecs}
            recommendations={recommendations}
            bookmarks={bookmarks}
            dismissingEventId={dismissingEventId}
            dismissReasons={dismissReasons}
            now={now}
            onDismissOpen={handleDismissOpen}
            onDismissSubmit={handleDismissSubmit}
            onDismissCancel={() => setDismissingEventId(null)}
            onBookmark={toggleBookmark}
          />
        )}

        {/* ===== LAYER 2: MEHR ENTDECKEN (below the fold) ===== */}

        {!loading && recommendations.length > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex-shrink-0">Mehr entdecken</p>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
        )}

        {!loading && recommendations.length > 0 && (
          <CardStack
            recommendations={recommendations}
            contextRecs={contextRecs}
            sources={sources}
            userLocation={userLocation}
            selectedBuckets={selectedBuckets}
            seriesParentIds={seriesParentIds}
            smallSourceIds={smallSourceIds}
            sourceCountMap={sourceCountMap}
            bookmarkCounts={bookmarkCounts}
            bookmarks={bookmarks}
            swipeOffset={swipeOffset}
            swipeHint={swipeHint}
            cardExiting={cardExiting}
            exitDirection={exitDirection}
            cardIndex={cardIndex}
            dismissingEventId={dismissingEventId}
            dismissReasons={dismissReasons}
            onRecTouchStart={handleRecTouchStart}
            onRecTouchMove={handleRecTouchMove}
            onRecTouchEnd={handleRecTouchEnd}
            onCycleCard={handleCycleCard}
            onSwipeRight={handleSwipeRight}
            onDismissSubmit={handleDismissSubmit}
            onDismissCancel={() => setDismissingEventId(null)}
            onBookmark={toggleBookmark}
          />
        )}

        {/* Spacer for card stack action buttons â€” mobile only */}
        {!loading && recommendations.length > 0 && <div className="mt-28 md:hidden" />}

        {/* ===== DIESES WOCHENENDE ===== */}
        {!loading && <WeekendSection weekendEvents={weekendEventsForLayer2} />}

        {/* ===== SAISONALE LANDING ===== */}
        {!loading && allEventsPool.length > 0 && (
          <SeasonalSection allEventsPool={allEventsPool} now={now} />
        )}

        {/* Link to explore */}
        <div className="mt-10 text-center">
          <Link
            href="/explore"
            className="text-[var(--text-muted)] hover:text-kidgo-500 text-sm transition underline decoration-dotted underline-offset-4"
          >
            Alle Events entdecken â†’
          </Link>
        </div>

      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Nach oben scrollen"
          className="fixed bottom-24 right-4 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md rounded-full w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:shadow-lg transition-all card-enter"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}

      {/* Chat FAB */}
      <ChatFAB onClick={() => setChatOpen(true)} />
    </main>

    <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} weatherCode={weatherCode} />
    </>
  );
}

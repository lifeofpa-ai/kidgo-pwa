"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { QuickActionsPopup, QuickActionIcons, type QuickAction } from "@/components/QuickActionsPopup";
import { HeartBurst } from "@/components/HeartBurst";
import {
  vibrate,
  toggleLike,
  isLiked,
  saveScrollPosition,
  restoreScrollPosition,
  shareEvent,
  downloadEventICS,
  openRouteForEvent,
  broadcastClosePopups,
  isTouchDevice,
  LONG_PRESS_MS,
  DOUBLE_TAP_MS,
  QUICK_ACTIONS_CLOSE_EVENT,
} from "@/lib/interactions";
import { AuthButton } from "@/components/AuthButton";
import { ProfileSetupModal } from "@/components/ProfileSetupModal";
import { useAuth } from "@/lib/auth-context";
import { useUserPrefs } from "@/lib/user-prefs-context";
import {
  getLocalStats,
  getLevelProgress,
  trackGeheimtipp,
  trackChatUsed,
  trackDayPlanUsed,
  trackWeeklyActivity,
  popNewBadges,
  type BadgeDef,
} from "@/lib/gamification";
import { BadgePopup } from "@/components/BadgePopup";
import { HexIcon } from "@/components/HexIcon";
import { eventMatchesInterests } from "@/lib/interests";
import {
  getRatedEvents,
  buildPreferenceProfile,
  scoreWithPreferences,
  buildDismissProfile,
  dismissPenalty,
  type PreferenceProfile,
  type DismissProfile,
} from "@/lib/preferences";
import { DismissOverlay } from "@/components/home/DismissOverlay";
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
import { trackEvent, trackFirstEventClick, trackFirstBookmark } from "@/lib/analytics";
import {
  getCategoryIcon,
  GiftIcon,
  KreativIcon,
  TentIcon,
  TreeIcon,
  SparkleIcon,
  MuseumIcon,
  SportIcon,
  MapIcon,
  PhoneIcon,
  WifiOffIcon,
} from "@/components/Icons";
import {
  getContextMode,
  getContextBadge,
  getContextLabel,
  applyContextSort,
  type ContextMode,
} from "@/lib/context-mode";
import { LazySection } from "@/components/home/LazySection";

// ============================================================
// TYPES
// ============================================================

interface KidgoEvent {
  id: string;
  titel: string;
  datum: string | null;
  datum_ende: string | null;
  ort: string | null;
  beschreibung: string | null;
  kategorie_bild_url: string | null;
  status: string;
  event_typ: string | null;
  altersgruppen: string[] | null;
  alters_buckets: string[] | null;
  alter_von: number | null;
  alter_bis: number | null;
  indoor_outdoor: string | null;
  kategorie: string | null;
  kategorien: string[] | null;
  preis_chf: number | null;
  anmelde_link: string | null;
  quelle_id: string | null;
  created_at: string;
  serie_id: string | null;
}

interface ScoredEvent extends KidgoEvent {
  score: number;
  reasons: string[];
}

interface CompactEvent {
  id: string;
  titel: string;
  datum: string | null;
  ort: string | null;
  kategorie_bild_url: string | null;
  kategorien: string[] | null;
}

interface ParsedQuery {
  ageBuckets: string[];
  indoor: boolean | null;
  dateFrom: Date | null;
  dateTo: Date | null;
  keywords: string[];
  freeOnly: boolean;
  childNames: Array<{ name: string; bucket: string }>;
}

interface DayPlanResult {
  morning: KidgoEvent | null;
  afternoon: KidgoEvent | null;
}

interface SmartCollection {
  id: string;
  label: string;
  emoji?: string;
  filter: (e: KidgoEvent, now: Date) => boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const AGE_BUCKETS = [
  { key: "0-3",   label: "0–3 Jahre",   emoji: "👶", desc: "Baby & Kleinkind" },
  { key: "4-6",   label: "4–6 Jahre",   emoji: "🧒", desc: "Vorschule" },
  { key: "7-9",   label: "7–9 Jahre",   emoji: "🏃", desc: "Schulkind" },
  { key: "10-12", label: "10–12 Jahre", emoji: "🔭", desc: "Entdecker" },
];

const CHAT_CHIPS = [
  "Was machen wir heute?",
  "Indoor mit 2 Kindern",
  "Gratis am Wochenende",
  "Basteln für 5-Jährige",
];

const SMART_COLLECTIONS: SmartCollection[] = [
  {
    id: "gratis",
    emoji: "🎁",
    label: "Gratis diese Woche",
    filter: (e, now) => {
      const desc = (e.beschreibung || "").toLowerCase();
      const title = e.titel.toLowerCase();
      const free =
        e.preis_chf === 0 ||
        ["gratis", "kostenlos", "freier eintritt"].some((kw) => desc.includes(kw) || title.includes(kw));
      if (!free) return false;
      if (!e.datum) return true;
      const today = new Date(now); today.setHours(0, 0, 0, 0);
      const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const ed = new Date(e.datum + "T00:00:00");
      return ed >= today && ed <= in7;
    },
  },
  {
    id: "kreativ-wochenende",
    emoji: "🎨",
    label: "Kreativ-Wochenende",
    filter: (e, now) => {
      const desc = (e.beschreibung || "").toLowerCase();
      const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
      const isCreative =
        cats.some((c) => ["Kreativ", "Theater", "Musik", "Tanz"].includes(c)) ||
        ["bastel", "malen", "kreativ", "kunst", "zeichn", "töpfer"].some((kw) => desc.includes(kw));
      if (!isCreative || !e.datum) return false;
      const dow = now.getDay();
      const toSat = dow === 0 ? 6 : (6 - dow) || 7;
      const sat = new Date(now); sat.setHours(0, 0, 0, 0); sat.setDate(sat.getDate() + toSat);
      const sun = new Date(sat); sun.setDate(sun.getDate() + 1); sun.setHours(23, 59, 59, 999);
      const ed = new Date(e.datum + "T00:00:00");
      return ed >= sat && ed <= sun;
    },
  },
  {
    id: "camps",
    emoji: "⛺",
    label: "Camps im Sommer",
    filter: (e) => {
      const desc = (e.beschreibung || "").toLowerCase();
      const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
      const isCamp =
        e.event_typ === "camp" ||
        cats.includes("Feriencamp") ||
        desc.includes("camp") ||
        desc.includes("ferienlager");
      if (!isCamp || !e.datum) return false;
      const m = new Date(e.datum + "T00:00:00").getMonth() + 1;
      return m >= 6 && m <= 8;
    },
  },
  {
    id: "outdoor",
    emoji: "🌳",
    label: "Outdoor-Abenteuer",
    filter: (e) => e.indoor_outdoor === "outdoor" || e.indoor_outdoor === "beides",
  },
  {
    id: "neu",
    emoji: "✨",
    label: "Neu entdeckt",
    filter: (e, now) =>
      !!e.created_at &&
      new Date(e.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
  },
];

// Sprint 3: Weekly challenges — rotate by ISO week number
const WEEKLY_CHALLENGES = [
  {
    id: "museum",
    emoji: "🏛️",
    title: "Besuche diese Woche ein Museum!",
    filter: (e: KidgoEvent) => {
      const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
      const desc = (e.beschreibung || "").toLowerCase();
      const t = e.titel.toLowerCase();
      return (
        cats.some((c) => ["Ausflug", "Bildung", "Wissenschaft"].includes(c)) ||
        ["museum", "ausstellung", "galerie"].some((kw) => desc.includes(kw) || t.includes(kw))
      );
    },
  },
  {
    id: "outdoor",
    emoji: "🌳",
    title: "Outdoor-Abenteuer erleben!",
    filter: (e: KidgoEvent) => {
      const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
      return e.indoor_outdoor === "outdoor" || e.indoor_outdoor === "beides" || cats.includes("Natur");
    },
  },
  {
    id: "kreativ",
    emoji: "🎨",
    title: "Kreativ-Workshop besuchen!",
    filter: (e: KidgoEvent) => {
      const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
      const desc = (e.beschreibung || "").toLowerCase();
      return (
        cats.some((c) => ["Kreativ", "Theater", "Musik"].includes(c)) ||
        ["bastel", "malen", "kreativ", "töpfer", "zeichn"].some((kw) => desc.includes(kw))
      );
    },
  },
  {
    id: "sport",
    emoji: "⚽",
    title: "Sport-Event für die Kinder!",
    filter: (e: KidgoEvent) => {
      const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
      const desc = (e.beschreibung || "").toLowerCase();
      return (
        cats.includes("Sport") ||
        ["sport", "turnen", "klettern", "schwimm", "fussball", "fußball"].some((kw) => desc.includes(kw))
      );
    },
  },
  {
    id: "gratis",
    emoji: "🎁",
    title: "Gratis-Event entdecken!",
    filter: (e: KidgoEvent) => {
      const desc = (e.beschreibung || "").toLowerCase();
      const t = e.titel.toLowerCase();
      return (
        e.preis_chf === 0 ||
        ["gratis", "kostenlos", "freier eintritt"].some((kw) => desc.includes(kw) || t.includes(kw))
      );
    },
  },
  {
    id: "quartier",
    emoji: "🗺️",
    title: "Neues Quartier entdecken!",
    filter: (e: KidgoEvent) => {
      const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
      return cats.includes("Ausflug") || !!e.ort;
    },
  },
];

const CATEGORY_BG_COLORS: Record<string, string> = {
  Kreativ: "#EC4899", Natur: "#22C55E", Tiere: "#22C55E", Sport: "#3B82F6",
  Tanz: "#8B5CF6", Theater: "#EF4444", Musik: "#8B5CF6", "Mode & Design": "#F43F5E",
  Wissenschaft: "#06B6D4", Bildung: "#F59E0B", Ausflug: "#14B8A6", Feriencamp: "#06B6D4",
};

const CATEGORY_COLORS: Record<string, string> = {
  Sport:      "#3B82F6",
  Kreativ:    "#EC4899",
  Musik:      "#8B5CF6",
  Tanz:       "#8B5CF6",
  Natur:      "#22C55E",
  Tiere:      "#22C55E",
  Museum:     "#F59E0B",
  Bildung:    "#F59E0B",
  Wissenschaft: "#F59E0B",
  Theater:    "#EF4444",
  Feriencamp: "#06B6D4",
};

function getCategoryColor(kategorien: string[] | null, kategorie: string | null): string {
  const cats = kategorien ?? (kategorie ? [kategorie] : []);
  for (const c of cats) {
    if (CATEGORY_COLORS[c]) return CATEGORY_COLORS[c];
  }
  return "#5BBAA7";
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

const ZH_HOLIDAYS_2026 = [
  { name: "Frühlingsferien",  from: "2026-04-11", to: "2026-04-25" },
  { name: "Sommerferien",     from: "2026-07-11", to: "2026-08-15" },
  { name: "Herbstferien",     from: "2026-10-10", to: "2026-10-24" },
  { name: "Weihnachtsferien", from: "2026-12-19", to: "2027-01-02" },
];

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getActiveHoliday(date: Date): string | null {
  const ds = localDateStr(date);
  for (const h of ZH_HOLIDAYS_2026) {
    if (ds >= h.from && ds <= h.to) return h.name;
  }
  return null;
}

function isSchoolHoliday(date: Date): boolean {
  return getActiveHoliday(date) !== null;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return localDateStr(d);
}

function getWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function computeEntdeckerScore(count: number): number {
  if (count <= 1) return 10;
  if (count <= 3) return 9;
  if (count <= 5) return 8;
  if (count <= 7) return 7;
  if (count <= 9) return 6;
  if (count <= 15) return 5;
  if (count <= 25) return 4;
  if (count <= 40) return 3;
  return 2;
}

// Sprint 3: ISO week number for challenge rotation
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Sprint 3: Upcoming holiday within 14 days
function getUpcomingHoliday(now: Date): { name: string; daysUntil: number } | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ds = localDateStr(today);
  for (const h of ZH_HOLIDAYS_2026) {
    if (h.from > ds) {
      const daysUntil = Math.round(
        (new Date(h.from + "T00:00:00").getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntil <= 14) return { name: h.name, daysUntil };
      break;
    }
  }
  return null;
}

// Sprint 3: Remaining days of active holiday
function getRemainingHolidayDays(now: Date): { name: string; daysLeft: number } | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ds = localDateStr(today);
  for (const h of ZH_HOLIDAYS_2026) {
    if (ds >= h.from && ds <= h.to) {
      const daysLeft = Math.round(
        (new Date(h.to + "T00:00:00").getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { name: h.name, daysLeft };
    }
  }
  return null;
}

function getHeadline(now: Date): { title: string; subtitle: string } {
  const dow = now.getDay();
  const h = now.getHours();
  const holiday = getActiveHoliday(now);
  if (holiday)
    return { title: "Ferientipp für euch", subtitle: `${holiday} — Zeit für Abenteuer!` };
  if (dow === 6 || dow === 0 || (dow === 5 && h >= 15))
    return { title: "Dieses Wochenende für euch", subtitle: "Passend ausgewählt für dein Kind" };
  if (dow === 3 && h >= 11 && h <= 18)
    return { title: "Mittwochnachmittag-Tipps", subtitle: "Heute Nachmittag was Tolles unternehmen" };
  if (h >= 6 && h < 12)
    return { title: "Guten Morgen! Was unternehmt ihr heute?", subtitle: "Passend ausgewählt für dein Kind" };
  if (h >= 12 && h < 17)
    return { title: "Nachmittagsprogramm gesucht?", subtitle: "Passend ausgewählt für dein Kind" };
  if (h >= 17 && h < 21)
    return { title: "Für morgen planen?", subtitle: "Schau was morgen passt" };
  return { title: "Schlaf gut! Hier sind Ideen für morgen.", subtitle: "Schon mal für morgen planen" };
}

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

function HexDivider() {
  return (
    <div className="flex items-center justify-center my-3" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" fill="rgba(91,186,167,0.3)" stroke="none"/>
      </svg>
    </div>
  );
}

function ageToBucket(age: number): string | null {
  if (age <= 3) return "0-3";
  if (age <= 6) return "4-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  return null;
}

// ============================================================
// SCORING
// ============================================================

function scoreEvent(
  event: KidgoEvent,
  selectedBuckets: string[],
  weatherCode: number | null,
  now: Date,
  interests: string[] = [],
  profile: PreferenceProfile | null = null,
  dProfile: DismissProfile | null = null
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (event.alters_buckets && selectedBuckets.some((b) => event.alters_buckets!.includes(b))) {
    score += 10;
  }

  if (
    selectedBuckets.length > 1 &&
    event.alters_buckets &&
    selectedBuckets.every((b) => event.alters_buckets!.includes(b))
  ) {
    score += 5;
    reasons.push("Passt für alle Kinder");
  }

  const isRain = weatherCode !== null && weatherCode >= 51;
  const isSun  = weatherCode !== null && weatherCode <= 2;
  if (isRain && event.indoor_outdoor === "indoor") {
    score += 8;
    reasons.push("Indoor-Tipp — heute regnet es");
  } else if (isSun && event.indoor_outdoor === "outdoor") {
    score += 8;
    reasons.push("Perfekt bei diesem Wetter");
  } else if (isRain && event.indoor_outdoor === "beides") {
    score += 4;
  }

  if (event.datum) {
    const eventDate = new Date(event.datum + "T00:00:00");
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= 3) {
      score += 5;
      if (diff === 0) reasons.push("Heute!");
      else if (diff === 1) reasons.push("Morgen!");
      else reasons.push(`Nur noch ${diff} Tage!`);
    }
  }

  const descLow = (event.beschreibung || "").toLowerCase();
  const titleLow = event.titel.toLowerCase();
  const isFree =
    event.preis_chf === 0 ||
    ["gratis", "kostenlos", "freier eintritt"].some(
      (kw) => descLow.includes(kw) || titleLow.includes(kw)
    );
  if (isFree) { score += 3; reasons.push("Gratis!"); }

  if (
    event.created_at &&
    new Date(event.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  ) {
    score += 3;
    reasons.push("Neu entdeckt");
  }

  const m = now.getMonth() + 1;
  const cats = event.kategorien || (event.kategorie ? [event.kategorie] : []);
  if (m >= 3 && m <= 5 && (event.indoor_outdoor === "outdoor" || cats.includes("Natur") || descLow.includes("natur"))) score += 3;
  if (m >= 6 && m <= 8 && (cats.some((k) => ["Sport", "Ausflug"].includes(k)) || descLow.includes("schwimm") || descLow.includes("camp") || descLow.includes("freibad"))) score += 3;
  if (m >= 9 && m <= 11 && (cats.some((k) => ["Kreativ", "Musik", "Theater"].includes(k)) || event.indoor_outdoor === "indoor" || descLow.includes("bastel") || titleLow.includes("bastel"))) score += 3;
  if ((m === 12 || m <= 2) && (descLow.includes("weihnacht") || descLow.includes("eis") || descLow.includes("advent") || cats.includes("Kreativ"))) score += 3;

  if (isSchoolHoliday(now)) {
    const isCamp =
      event.event_typ === "camp" ||
      cats.includes("Feriencamp") ||
      descLow.includes("camp") ||
      descLow.includes("ferienlager");
    if (isCamp) { score += 5; reasons.push("Ferientipp!"); }
  }

  const hour = now.getHours();
  if (hour >= 6 && hour < 12 && !event.datum) score += 3;
  else if (hour >= 12 && hour < 17 && event.datum && !event.datum_ende) score += 2;

  if (
    event.created_at &&
    new Date(event.created_at) < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  ) {
    score -= 5;
  }

  if (interests.length > 0 && eventMatchesInterests(event, interests)) {
    score += 5;
  }

  if (profile) {
    score += scoreWithPreferences(event, profile);
  }

  if (dProfile) {
    score += dismissPenalty(event, dProfile);
  }

  return { score, reasons };
}

// ============================================================
// CHAT NLP
// ============================================================

function parseNaturalQuery(query: string): ParsedQuery {
  const q = query.toLowerCase();
  const ageBuckets: string[] = [];
  const childNames: Array<{ name: string; bucket: string }> = [];

  const namedRegex = /([A-ZÄÖÜ][a-zäöüß]+)\s*\((\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = namedRegex.exec(query)) !== null) {
    const bucket = ageToBucket(parseInt(m[2]));
    if (bucket) {
      childNames.push({ name: m[1], bucket });
      if (!ageBuckets.includes(bucket)) ageBuckets.push(bucket);
    }
  }

  if (ageBuckets.length === 0) {
    const ageNumRegex = /(\d+)\s*[-–]?\s*j[äa]hr/gi;
    while ((m = ageNumRegex.exec(query)) !== null) {
      const bucket = ageToBucket(parseInt(m[1]));
      if (bucket && !ageBuckets.includes(bucket)) ageBuckets.push(bucket);
    }
  }

  if (ageBuckets.length === 0) {
    if (/kleinkind|baby|säugling/i.test(q)) ageBuckets.push("0-3");
    if (/vorschul|kindergarten/i.test(q)) ageBuckets.push("4-6");
    if (/schulkind|grundschul/i.test(q)) ageBuckets.push("7-9");
  }

  let indoor: boolean | null = null;
  if (/regen|regnet|indoor|drinnen/i.test(q)) indoor = true;
  if (/sonne|sonnig|schönes?\s*wetter|outdoor|draußen|aussen/i.test(q)) indoor = false;

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
  } else if (/nächste\s*woche/i.test(q)) {
    const dow = now.getDay();
    const toMon = (8 - dow) % 7 || 7;
    dateFrom = new Date(todayStart);
    dateFrom.setDate(dateFrom.getDate() + toMon);
    dateTo = new Date(dateFrom);
    dateTo.setDate(dateTo.getDate() + 6);
    dateTo.setHours(23, 59, 59, 999);
  }

  const kwMap: Record<string, string[]> = {
    Kreativ:     ["bastel", "malen", "kreativ", "kunst", "zeichn", "töpfer"],
    Sport:       ["sport", "turnen", "klettern", "schwimm", "fussball", "fußball"],
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

  const freeOnly = /gratis|kostenlos|umsonst|günstig/i.test(q);

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
    return `Dazu habe ich leider nichts gefunden. Versuch mal "${pair[0]}" oder "${pair[1]}" — oder schau in alle Events.`;
  }
  const n = Math.min(3, total);
  const h = now.getHours();
  const dow = now.getDay();
  const isRainy = weatherCode !== null && weatherCode >= 51;
  const weatherCtx = isRainy ? " bei Regen" : "";

  if (parsed.childNames.length >= 2) {
    const names = parsed.childNames.map((c) => c.name).join(" und ");
    return `Für ${names}${weatherCtx} habe ich ${n} ${n === 1 ? "Idee" : "Ideen"} gefunden:`;
  }

  if (parsed.dateFrom) {
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const diff = Math.round((parsed.dateFrom.getTime() - today.getTime()) / 86400000);
    const dateLabel = diff === 0 ? "heute" : diff === 1 ? "morgen" :
      parsed.dateFrom.toLocaleDateString("de-CH", { weekday: "long" });
    const kwCtx = parsed.keywords.length > 0 ? ` ${parsed.keywords[0].toLowerCase()}` : "";
    return `Für euren ${dateLabel}${kwCtx} habe ich ${n} ${n === 1 ? "Idee" : "Ideen"} gefunden:`;
  }

  if (parsed.keywords.length > 0) {
    const kw = parsed.keywords[0].toLowerCase();
    const ageCtx = parsed.ageBuckets.length > 0
      ? ` für ${parsed.ageBuckets.map((b) => AGE_BUCKETS.find((a) => a.key === b)?.label ?? b).join(" & ")}`
      : "";
    return `${n} ${kw}${ageCtx ? `-Ideen${ageCtx}` : " Tipps"} gefunden:`;
  }

  if (parsed.ageBuckets.length > 0) {
    const labels = parsed.ageBuckets.map((b) => AGE_BUCKETS.find((a) => a.key === b)?.label ?? b).join(" & ");
    const timeCtx = dow === 3 && h >= 11 && h <= 18 ? "Mittwochnachmittag" :
      (dow === 0 || dow === 6) ? "Wochenende" :
      h < 12 ? "Vormittag" : h < 17 ? "Nachmittag" : "Abend";
    return `Für ${labels}${weatherCtx} — ${n} ${n === 1 ? "Tipp" : "Tipps"} für euren ${timeCtx}:`;
  }

  if (parsed.freeOnly) {
    return `${n} kostenlose ${n === 1 ? "Idee" : "Ideen"} gefunden:`;
  }

  const timeCtx = dow === 3 && h >= 11 && h <= 18 ? "Mittwochnachmittag" :
    (dow === 0 || dow === 6) ? "Wochenende" :
    h < 12 ? "Vormittag" : h < 17 ? "Nachmittag" : "Abend";
  return `${n} ${n === 1 ? "Tipp" : "Tipps"} für euren ${timeCtx}${weatherCtx}:`;
}

// ============================================================
// PRICE HELPERS
// ============================================================

function extractPrice(beschreibung: string | null): number | null {
  if (!beschreibung) return null;
  const patterns = [
    /CHF\s*(\d+(?:[.,]\d+)?)/i,
    /Fr\.\s*(\d+(?:[.,]\d+)?)/i,
    /(\d+(?:[.,]\d+)?)\.[-–—]+/,
    /(\d+(?:[.,]\d+)?)\s*Franken/i,
  ];
  for (const pat of patterns) {
    const m = beschreibung.match(pat);
    if (m) return parseFloat(m[1].replace(",", "."));
  }
  return null;
}

function isFreeEvent(event: KidgoEvent): boolean {
  const desc = (event.beschreibung || "").toLowerCase();
  const title = event.titel.toLowerCase();
  return (
    event.preis_chf === 0 ||
    ["gratis", "kostenlos", "freier eintritt", "free"].some(
      (kw) => desc.includes(kw) || title.includes(kw)
    )
  );
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
// LOCATION
// ============================================================

const ZH_CITIES: Record<string, [number, number]> = {
  Zürich:      [47.37, 8.54],
  Winterthur:  [47.50, 8.72],
  Uster:       [47.35, 8.72],
  Wädenswil:   [47.23, 8.67],
  Horgen:      [47.26, 8.60],
  Schlieren:   [47.40, 8.45],
  Volketswil:  [47.39, 8.69],
  Opfikon:     [47.43, 8.57],
  Rümlang:     [47.45, 8.53],
  Wallisellen: [47.41, 8.60],
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// COMPONENTS
// ============================================================

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden" aria-hidden="true">
      <div className="h-48 skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-3.5 skeleton w-2/3" />
        <div className="h-5 skeleton w-full" />
        <div className="h-3.5 skeleton w-1/2" />
        <div className="h-3 skeleton w-1/3" />
      </div>
    </div>
  );
}

function EventImage({
  url,
  kategorien,
  className,
  title,
}: {
  url?: string | null;
  kategorien?: string[] | null;
  className?: string;
  title?: string;
}) {
  const [err, setErr] = useState(false);
  const cat = kategorien?.[0] || "";
  const cls = className ?? "h-48 w-full overflow-hidden";
  const altText = title || cat || "Event";
  const iconColor = CATEGORY_BG_COLORS[cat] || "#5BBAA7";

  if (url && !err) {
    return (
      <div className={`${cls} photo-cell`}>
        <img
          src={url}
          alt={altText}
          className="w-full h-full object-cover group-hover:scale-[1.03] group-hover:brightness-105 dark:brightness-90 transition-all duration-300 ease-out"
          loading="lazy"
          onError={() => setErr(true)}
        />
      </div>
    );
  }
  return (
    <div className={`${cls} flex items-center justify-center`} style={{ backgroundColor: "#F5F0E8" }} aria-label={altText}>
      <div className="opacity-30" style={{ color: iconColor }}>
        {getCategoryIcon(cat, { size: 60 })}
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("de-CH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getCountdownLabel(dateStr: string, now: Date): { label: string; urgent: boolean } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(dateStr + "T00:00:00");
  const diff = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { label: formatDateShort(dateStr), urgent: false };
  if (diff === 0) return { label: "Heute", urgent: true };
  if (diff === 1) return { label: "Morgen", urgent: true };
  if (diff === 2) return { label: "Übermorgen", urgent: false };
  if (diff <= 6) return { label: `In ${diff} Tagen`, urgent: false };
  if (diff <= 13) return { label: "Nächste Woche", urgent: false };
  return { label: formatDateShort(dateStr), urgent: false };
}

function RecommendationCard({
  event,
  reasons,
  sources,
  userLocation,
  animIndex,
  selectedBuckets = [],
  isSeriesParent = false,
  isGeheimtipp = false,
  entdeckerScore,
  isBookmarked = false,
  onBookmark,
  bookmarkCount,
}: {
  event: KidgoEvent;
  reasons: string[];
  sources: { id: string; url: string | null; latitude: number | null; longitude: number | null }[];
  userLocation: { lat: number; lon: number; approximate: boolean } | null;
  animIndex: number;
  selectedBuckets?: string[];
  isSeriesParent?: boolean;
  isGeheimtipp?: boolean;
  entdeckerScore?: number;
  isBookmarked?: boolean;
  onBookmark?: (e: React.MouseEvent) => void;
  bookmarkCount?: number;
}) {
  const source = sources.find((s) => s.id === event.quelle_id);

  let distanceLabel: string | null = null;
  if (userLocation && source?.latitude && source?.longitude) {
    const km = haversine(userLocation.lat, userLocation.lon, source.latitude, source.longitude);
    if (km < 50) distanceLabel = km < 1 ? "< 1 km entfernt" : `~${Math.round(km)} km entfernt`;
  }

  const displayReasons = [...reasons];
  if (distanceLabel && !displayReasons.some((r) => r.includes("km")))
    displayReasons.push(distanceLabel);
  const shownReasons = displayReasons.slice(0, 2);

  const matchingBuckets =
    selectedBuckets.length > 1 && event.alters_buckets
      ? selectedBuckets.filter((b) => event.alters_buckets!.includes(b))
      : [];

  // Sprint 21 — interaction state
  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const lastTap = useRef(0);
  const suppressClick = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => { setLiked(isLiked(event.id)); }, [event.id]);

  useEffect(() => {
    const onClose = () => setPopupOpen(false);
    window.addEventListener(QUICK_ACTIONS_CLOSE_EVENT, onClose);
    return () => window.removeEventListener(QUICK_ACTIONS_CLOSE_EVENT, onClose);
  }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openPopup = () => {
    broadcastClosePopups();
    setPopupOpen(true);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    longPressFired.current = false;
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      suppressClick.current = true;
      vibrate(15);
      openPopup();
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartPos.current.x);
    const dy = Math.abs(t.clientY - touchStartPos.current.y);
    if (dx > 8 || dy > 8) cancelLongPress();
  };

  const onTouchEnd = () => {
    cancelLongPress();
    if (longPressFired.current) {
      // The long-press already opened the popup; click is suppressed.
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      suppressClick.current = true;
      const newLiked = toggleLike(event.id);
      setLiked(newLiked);
      setBurstKey((k) => k + 1);
      vibrate(15);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    // Desktop right-click → show popup instead of native menu
    if (isTouchDevice()) return;
    e.preventDefault();
    suppressClick.current = true;
    openPopup();
  };

  const onLinkClick = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
      return;
    }
    try { saveScrollPosition(window.location.pathname); } catch {}
  };

  const popupActions: QuickAction[] = [
    {
      key: "bookmark",
      label: isBookmarked ? "Gemerkt" : "Merken",
      icon: QuickActionIcons.bookmark(isBookmarked),
      active: isBookmarked,
      onClick: () => {
        if (onBookmark) {
          const fakeEvent = {
            preventDefault: () => {},
            stopPropagation: () => {},
          } as unknown as React.MouseEvent;
          onBookmark(fakeEvent);
        }
      },
    },
    {
      key: "share",
      label: "Teilen",
      icon: QuickActionIcons.share,
      onClick: () => shareEvent(event),
    },
    {
      key: "calendar",
      label: "Kalender",
      icon: QuickActionIcons.calendar,
      onClick: () => downloadEventICS(event),
    },
    {
      key: "route",
      label: "Route",
      icon: QuickActionIcons.route,
      onClick: () => openRouteForEvent(event),
    },
  ];

  return (
    <>
    <Link
      href={`/events/${event.id}`}
      className="block group card-enter"
      style={{ animationDelay: `${animIndex * 80}ms` }}
      onClick={onLinkClick}
      onContextMenu={onContextMenu}
    >
      <div
        ref={cardRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelLongPress}
        className="bg-[var(--bg-card)] rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ease-out overflow-hidden border border-[var(--border)] group-hover:border-kidgo-200 group-hover:scale-[1.01] relative select-none"
        style={{ borderLeft: `3px solid ${getCategoryColor(event.kategorien, event.kategorie)}`, boxShadow: "0 2px 12px rgba(91,186,167,0.08)", WebkitTouchCallout: "none" }}
      >
        <HeartBurst trigger={burstKey} />
        {liked && (
          <div className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md" aria-label="Geliked">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 12 C 2.5 8.5, 1 5, 3 3.5 C 4.5 2.5, 6 3.5, 7 5 C 8 3.5, 9.5 2.5, 11 3.5 C 13 5, 11.5 8.5, 7 12 Z" />
            </svg>
          </div>
        )}
          {onBookmark && (
            <button
              onClick={onBookmark}
              aria-label={isBookmarked ? "Aus Merkliste entfernen" : "Event merken"}
              className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full shadow-sm transition-all ${
                isBookmarked
                  ? "bg-kidgo-400 text-white"
                  : "bg-white/90 text-gray-300 hover:text-kidgo-500"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2h10v11L7 10 2 13V2z"/>
              </svg>
            </button>
          )}
        <EventImage
          url={event.kategorie_bild_url}
          kategorien={event.kategorien}
          className="h-48 md:h-60 w-full overflow-hidden"
          title={event.titel}
        />
        <div className="p-4">
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {isGeheimtipp && (
              <span className="bg-purple-50 text-purple-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-purple-100">
                Geheimtipp
              </span>
            )}
            {shownReasons.map((r) => (
              <span
                key={r}
                className="bg-kidgo-50 text-kidgo-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-kidgo-100"
              >
                {r}
              </span>
            ))}
          </div>

          <h3 className="font-bold text-[var(--text-primary)] text-lg leading-snug mb-1.5 group-hover:text-kidgo-500 transition-colors duration-200">
            {event.titel}
          </h3>

          {(() => {
            const badges: { label: string; cls: string }[] = [];
            if (isSeriesParent) badges.push({ label: "Regelmässig", cls: "bg-kidgo-50 text-kidgo-500 border border-kidgo-100" });
            if (isFreeEvent(event)) {
              badges.push({ label: "Gratis", cls: "bg-green-50 text-green-700 border border-green-100" });
            } else {
              const p = extractPrice(event.beschreibung);
              if (p !== null) badges.push({ label: `ab CHF ${p % 1 === 0 ? p : p.toFixed(2)}`, cls: "bg-sky-50 text-sky-600 border border-sky-100" });
            }
            if (badges.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {badges.map((b) => (
                  <span key={b.label} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${b.cls}`}>{b.label}</span>
                ))}
              </div>
            );
          })()}

          {matchingBuckets.length > 1 && (
            <p className="text-xs text-emerald-600 font-semibold mb-2 flex items-center gap-1">
              <span>✓</span>
              <span>
                Passt für{" "}
                {matchingBuckets
                  .map((b) => AGE_BUCKETS.find((a) => a.key === b)?.label ?? b)
                  .join(" und ")}
              </span>
            </p>
          )}

          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
              {event.datum && (() => {
                const { label, urgent } = getCountdownLabel(event.datum, new Date());
                return (
                  <span className={`flex items-center gap-1.5 ${urgent ? "font-semibold" : ""}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${urgent ? "text-kidgo-500" : "text-kidgo-400"}`}>
                      <rect x="0.5" y="1.5" width="11" height="9" rx="1.2"/><path d="M0.5 4.5h11M4 0.5v2M8 0.5v2"/>
                    </svg>
                    <span className={urgent ? "text-kidgo-500" : ""}>{label}</span>
                  </span>
                );
              })()}
              {!event.datum && (
                <span className="text-emerald-600 font-medium">Ganzjährig</span>
              )}
              {event.ort && (
                <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-kidgo-400 flex-shrink-0">
                    <path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3z"/><circle cx="6" cy="4" r="1"/>
                  </svg>
                  {event.ort}
                </span>
              )}
            </div>
            {entdeckerScore !== undefined && (
              <span className="flex-shrink-0 text-xs text-kidgo-400 font-medium">{entdeckerScore}/10</span>
            )}
          </div>

          {bookmarkCount && bookmarkCount > 1 && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <div className="flex -space-x-1">
                {[...Array(Math.min(3, bookmarkCount))].map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full bg-kidgo-100 border border-white"
                    style={{ zIndex: 3 - i }}
                  />
                ))}
              </div>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {bookmarkCount} {bookmarkCount === 1 ? "Familie" : "Familien"} interessiert
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
    {popupOpen && (
      <QuickActionsPopup
        actions={popupActions}
        onClose={() => setPopupOpen(false)}
        anchorRef={cardRef}
      />
    )}
    </>
  );
}

// ============================================================
// SWIPE HOOK
// ============================================================

function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dy) > Math.abs(dx) || Math.abs(dx) < 50) return;
    if (dx < 0) onSwipeLeft();
    else onSwipeRight();
  };

  return { onTouchStart, onTouchEnd };
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

    // Push notifications — max once per day (spam protection)
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

  // Sprint 15: Weekend preview push — Friday 16:00+, max once per day
  useEffect(() => {
    if (!mounted || allEventsPool.length === 0) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    if (now.getDay() !== 5 || now.getHours() < 16) return;
    const today = now.toISOString().split("T")[0];
    const lastSent = localStorage.getItem("kidgo_push_last_sent");
    if (lastSent === today) return;
    const weekend = [now.getDay() === 5 ? 6 : 0, now.getDay() === 5 ? 0 : 0];
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
      let nearest = "Zürich";
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

    // Dismissed IDs — read fresh from storage so fetch is always consistent
    const currentDismissedIds = new Set([...getDismissedEventIds(), ...dismissedEventIds]);

    // Sprint 3: Offline — serve cached events
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

      // Sprint 11: Social proof — aggregate bookmark counts
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

  // Sprint 12: Card stack — animated swipe handlers
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
                  aria-label={`Altersgruppe ${bucket.label} auswählen`}
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
                Empfehlungen anzeigen →
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

  // Context-sorted recommendations: rain → indoor first, holiday → camps first
  const contextRecs = useMemo(
    () => applyContextSort([...recommendations], contextMode) as ScoredEvent[],
    [recommendations, contextMode]
  );
  const contextBadge = getContextBadge(contextMode);
  const contextLabel = getContextLabel(contextMode);

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
                  ✕
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
              <p className="text-xs text-[var(--text-muted)]">Erhalte Erinnerungen für gemerkten Events</p>
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
                    <span className="font-medium">{Math.round(weatherTemp)}°C</span>
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
            {contextMode === "evening" ? "Für morgen geplant" : headline.title}
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
              aria-label="Altersgruppe ändern"
              className="text-xs text-gray-400 hover:text-kidgo-500 transition"
            >
              Alter ändern
            </button>
          </div>

          {userLocation?.approximate && (
            <div className="mt-2.5 text-xs text-gray-400 flex items-start gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 text-gray-400 flex-shrink-0">
                <path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3z"/><circle cx="6" cy="4" r="1"/>
              </svg>
              <span>
                Ungefähr in {userLocation.label} —{" "}
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
                für genauere Tipps
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
            <p className="text-[var(--text-muted)] text-sm mb-5">Schau im Katalog nach weiteren Aktivitäten</p>
            <Link href="/explore" className="bg-kidgo-400 text-white px-6 py-3 rounded-xl font-semibold hover:bg-kidgo-500 transition">
              Alle Events entdecken
            </Link>
          </div>
        )}

        {/* Hero + 2 sub-cards */}
        {!loading && contextRecs.length > 0 && (
          <div className="mb-8">
            {/* Hero card — first recommendation, context-sorted */}
            {(() => {
              const event = contextRecs[0];
              const isBookmarkedHero = bookmarks.some((b) => b.id === event.id);
              const isDismissingHero = dismissingEventId === event.id;
              return (
                <div className="relative mb-3">
                  {/* Dimmed wrapper — card dims when dismiss overlay is open */}
                  <div className={isDismissingHero ? "card-dimmed" : undefined}>
                    <Link
                      href={`/events/${event.id}`}
                      className="block group"
                      onClick={() => { try { saveScrollPosition(window.location.pathname); } catch {}; trackEvent("event_click", { event_id: event.id, source: "home_hero" }); trackFirstEventClick(event.id, event.titel); }}
                    >
                      <div className="relative rounded-2xl overflow-hidden" style={{ boxShadow: "0 4px 24px rgba(91,186,167,0.2)" }}>
                        <EventImage
                          url={event.kategorie_bild_url}
                          kategorien={event.kategorien}
                          className="h-64 sm:h-72 w-full overflow-hidden"
                          title={event.titel}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                        {/* Reason badges top-left */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                          {event.reasons.slice(0, 2).map((r) => (
                            <span key={r} className="bg-white/90 text-kidgo-600 text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm shadow-sm">
                              {r}
                            </span>
                          ))}
                        </div>
                        {/* Bookmark button top-right */}
                        <button
                          onClick={(e) => toggleBookmark(event, e)}
                          aria-label={isBookmarkedHero ? "Aus Merkliste entfernen" : "Event merken"}
                          className={`absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full shadow-md transition-all active:scale-90 ${
                            isBookmarkedHero
                              ? "bg-kidgo-400 text-white"
                              : "bg-white/90 text-gray-400 hover:text-kidgo-500"
                          }`}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill={isBookmarkedHero ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 2h10v11L7 10 2 13V2z"/>
                          </svg>
                        </button>
                        {/* Text overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 pb-5">
                          <h2 className="text-white font-bold text-xl sm:text-2xl leading-tight mb-2 drop-shadow-sm line-clamp-2 group-hover:text-kidgo-100 transition-colors">
                            {event.titel}
                          </h2>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80 text-sm mb-3">
                            {event.datum && (() => {
                              const { label, urgent } = getCountdownLabel(event.datum, now);
                              return (
                                <span className={`flex items-center gap-1 ${urgent ? "text-kidgo-200 font-semibold" : ""}`}>
                                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="0.5" y="1.5" width="11" height="9" rx="1.2"/><path d="M0.5 4.5h11M4 0.5v2M8 0.5v2"/></svg>
                                  {label}
                                </span>
                              );
                            })()}
                            {!event.datum && <span className="text-green-300 font-semibold">Ganzjährig</span>}
                            {event.ort && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]">
                                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3z"/><circle cx="6" cy="4" r="1"/></svg>
                                {event.ort.split(",")[0].trim()}
                              </span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1.5 bg-white text-kidgo-600 text-xs font-bold px-3.5 py-2 rounded-full group-hover:bg-kidgo-50 transition shadow-sm">
                            Details ansehen
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4-4-4-4"/></svg>
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                  {/* Dismiss button — outside Link so it doesn't navigate */}
                  {!isDismissingHero && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDismissOpen(event); }}
                      aria-label="Nicht interessiert"
                      className="absolute top-3 right-14 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm transition-all active:scale-90"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8"/>
                      </svg>
                    </button>
                  )}
                  {/* Dismiss overlay */}
                  {isDismissingHero && (
                    <DismissOverlay
                      reasons={dismissReasons}
                      onSubmit={(ids) => handleDismissSubmit(event.id, ids)}
                      onCancel={() => setDismissingEventId(null)}
                    />
                  )}
                </div>
              );
            })()}

            {/* Sub-cards — recs 2 + 3 */}
            {recommendations.length > 1 && (
              <div className="grid grid-cols-2 gap-3">
                {recommendations.slice(1, 3).map((event) => {
                  const isDismissingSub = dismissingEventId === event.id;
                  return (
                    <div key={event.id} className="relative">
                      <div className={isDismissingSub ? "card-dimmed" : undefined}>
                        <Link
                          href={`/events/${event.id}`}
                          className="group block"
                          onClick={() => { try { saveScrollPosition(window.location.pathname); } catch {}; trackEvent("event_click", { event_id: event.id, source: "home_sub" }); trackFirstEventClick(event.id, event.titel); }}
                        >
                          <div
                            className="rounded-xl overflow-hidden border border-[var(--border)] hover:border-kidgo-200 hover:shadow-md transition-all bg-[var(--bg-card)]"
                            style={{ borderLeft: `3px solid ${getCategoryColor(event.kategorien, event.kategorie)}` }}
                          >
                            <EventImage
                              url={event.kategorie_bild_url}
                              kategorien={event.kategorien}
                              className="h-28 w-full overflow-hidden"
                              title={event.titel}
                            />
                            <div className="p-3">
                              <h3 className="font-bold text-[var(--text-primary)] text-xs leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors mb-1.5">
                                {event.titel}
                              </h3>
                              <div className="flex items-center gap-1 text-[10px]">
                                {event.datum ? (
                                  <span className={`font-semibold ${getCountdownLabel(event.datum, now).urgent ? "text-kidgo-500" : "text-[var(--text-muted)]"}`}>
                                    {getCountdownLabel(event.datum, now).label}
                                  </span>
                                ) : (
                                  <span className="text-green-600 font-semibold">Ganzjährig</span>
                                )}
                              </div>
                              {event.reasons.length > 0 && (
                                <span className="mt-1.5 inline-block text-[10px] font-semibold text-kidgo-500 bg-kidgo-50 px-2 py-0.5 rounded-full">
                                  {event.reasons[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                      {/* Sub-card dismiss button */}
                      {!isDismissingSub && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDismissOpen(event); }}
                          aria-label="Nicht interessiert"
                          className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/25 text-white hover:bg-black/45 backdrop-blur-sm transition-all active:scale-90"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M2 2l6 6M8 2l-6 6"/>
                          </svg>
                        </button>
                      )}
                      {isDismissingSub && (
                        <DismissOverlay
                          reasons={dismissReasons}
                          onSubmit={(ids) => handleDismissSubmit(event.id, ids)}
                          onCancel={() => setDismissingEventId(null)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== LAYER 2: MEHR ENTDECKEN (below the fold) ===== */}

        {!loading && recommendations.length > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex-shrink-0">Mehr entdecken</p>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>
        )}

        {/* Card Stack — Tinder-style (mobile only) */}
        {!loading && recommendations.length > 0 && (
          <div className="md:hidden relative select-none min-h-[420px] mb-4">
            {/* Background stacked cards */}
            {recommendations.slice(1).map((event, ri) => {
              const stackPos = ri + 1;
              const cnt = sourceCountMap.get(event.quelle_id || "") ?? 0;
              return (
                <div
                  key={`stack-${event.id}`}
                  className="absolute inset-x-0 top-0 pointer-events-none"
                  aria-hidden="true"
                  style={{
                    zIndex: recommendations.length - stackPos,
                    transform: `scale(${1 - stackPos * 0.035}) translateY(${stackPos * 13}px)`,
                    transformOrigin: "center top",
                    opacity: 1 - stackPos * 0.07,
                  }}
                >
                  <RecommendationCard
                    event={event}
                    reasons={event.reasons}
                    sources={sources}
                    userLocation={userLocation}
                    animIndex={0}
                    selectedBuckets={selectedBuckets}
                    isSeriesParent={seriesParentIds.has(event.id)}
                    isGeheimtipp={!!event.quelle_id && smallSourceIds.has(event.quelle_id)}
                    entdeckerScore={computeEntdeckerScore(sourceCountMap.get(event.quelle_id || "") ?? 0)}
                    isBookmarked={bookmarks.some((b) => b.id === event.id)}
                    bookmarkCount={bookmarkCounts.get(event.id)}
                  />
                </div>
              );
            })}

            {/* Top card */}
            {(() => {
              const event = recommendations[0];
              const cnt = sourceCountMap.get(event.quelle_id || "") ?? 0;
              const isDismissingStack = dismissingEventId === event.id;
              return (
                <div
                  className="absolute inset-x-0 top-0 card-stack-top"
                  style={{
                    zIndex: recommendations.length + 1,
                    transform: cardExiting
                      ? `translateX(${exitDirection === "left" ? "-130%" : "130%"}) rotate(${exitDirection === "left" ? -13 : 13}deg)`
                      : `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.024}deg)`,
                    transition: cardExiting
                      ? "transform 0.34s cubic-bezier(0.4,0,0.2,1)"
                      : swipeOffset === 0 ? "transform 0.2s ease" : "none",
                  }}
                  onTouchStart={isDismissingStack ? undefined : handleRecTouchStart}
                  onTouchMove={isDismissingStack ? undefined : handleRecTouchMove}
                  onTouchEnd={isDismissingStack ? undefined : handleRecTouchEnd}
                >
                  <div className="relative">
                    <div className={isDismissingStack ? "card-dimmed" : undefined}>
                      <RecommendationCard
                        key={event.id}
                        event={event}
                        reasons={event.reasons}
                        sources={sources}
                        userLocation={userLocation}
                        animIndex={0}
                        selectedBuckets={selectedBuckets}
                        isSeriesParent={seriesParentIds.has(event.id)}
                        isGeheimtipp={!!event.quelle_id && smallSourceIds.has(event.quelle_id)}
                        entdeckerScore={computeEntdeckerScore(cnt)}
                        isBookmarked={bookmarks.some((b) => b.id === event.id)}
                        onBookmark={(e) => toggleBookmark(event, e)}
                        bookmarkCount={bookmarkCounts.get(event.id)}
                      />
                    </div>
                    {isDismissingStack && (
                      <DismissOverlay
                        reasons={dismissReasons}
                        onSubmit={(ids) => handleDismissSubmit(event.id, ids)}
                        onCancel={() => setDismissingEventId(null)}
                      />
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Swipe hint */}
            {swipeHint && (
              <div
                className={`absolute top-0 left-0 right-0 rounded-2xl pointer-events-none flex items-center ${swipeHint === "left" ? "justify-end pr-6" : "justify-start pl-6"}`}
                style={{ height: "200px", zIndex: recommendations.length + 2 }}
              >
                <div className={`px-4 py-2 rounded-full text-white text-sm font-bold shadow-lg ${swipeHint === "left" ? "bg-red-400" : "bg-green-500"}`}>
                  {swipeHint === "left" ? "Nicht interessiert" : "Gemerkt"}
                </div>
              </div>
            )}

            {/* Counter + action buttons */}
            <div className="absolute left-0 right-0 flex items-center justify-center gap-6" style={{ bottom: "-56px" }}>
              <button
                onClick={handleCycleCard}
                aria-label="Nächste Karte"
                className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center text-gray-400 hover:text-kidgo-500 hover:border-kidgo-300 hover:shadow-lg transition-all active:scale-90"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9H4M4 9l5-5M4 9l5 5"/>
                </svg>
              </button>
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 min-w-[36px] text-center tabular-nums">
                {(cardIndex % recommendations.length) + 1}/{recommendations.length}
              </span>
              <button
                onClick={handleSwipeRight}
                aria-label={bookmarks.some((b) => b.id === recommendations[0].id) ? "Event bereits gemerkt" : "Event merken"}
                className={`w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-all active:scale-90 ${
                  bookmarks.some((b) => b.id === recommendations[0].id)
                    ? "bg-kidgo-400 text-white border border-kidgo-300"
                    : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-kidgo-500 hover:border-kidgo-300 hover:shadow-lg"
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill={bookmarks.some((b) => b.id === recommendations[0].id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3h12v13.5L9 13.5 3 16.5V3z"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Desktop grid */}
        {!loading && contextRecs.length > 0 && (
          <div className="hidden md:grid md:grid-cols-2 gap-5 mb-8">
            {contextRecs.map((event, i) => {
              const cnt = sourceCountMap.get(event.quelle_id || "") ?? 0;
              return (
                <RecommendationCard
                  key={event.id}
                  event={event}
                  reasons={event.reasons}
                  sources={sources}
                  userLocation={userLocation}
                  animIndex={i}
                  selectedBuckets={selectedBuckets}
                  isSeriesParent={seriesParentIds.has(event.id)}
                  isGeheimtipp={!!event.quelle_id && smallSourceIds.has(event.quelle_id)}
                  entdeckerScore={computeEntdeckerScore(cnt)}
                  isBookmarked={bookmarks.some((b) => b.id === event.id)}
                  onBookmark={(e) => toggleBookmark(event, e)}
                  bookmarkCount={bookmarkCounts.get(event.id)}
                />
              );
            })}
          </div>
        )}

        {/* Spacer for card stack action buttons — mobile only */}
        {!loading && recommendations.length > 0 && <div className="mt-28 md:hidden" />}

        {/* ===== DIESES WOCHENENDE ===== */}
        {!loading && weekendEventsForLayer2.length > 0 && (
          <LazySection className="mt-8" fallback={<div className="mt-8 h-48 skeleton rounded-2xl" />}><div>
            <div className="flex items-center justify-between mb-3 px-0.5">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Dieses Wochenende</p>
              <Link href="/explore" className="text-xs font-semibold text-kidgo-500 hover:text-kidgo-600 transition">
                Alle →
              </Link>
            </div>
            <div
              className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
            >
              {weekendEventsForLayer2.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="flex-shrink-0 w-44 group"
                  onClick={() => { try { saveScrollPosition(window.location.pathname); } catch {} }}
                >
                  <div className="rounded-2xl overflow-hidden border border-[var(--border)] hover:border-[#5BBAA7]/40 transition-all hover:shadow-md" style={{ boxShadow: "0 2px 8px rgba(91,186,167,0.08)" }}>
                    <div className="h-28 bg-gradient-to-br from-[#F5F0E8] to-kidgo-50 relative overflow-hidden">
                      {event.kategorie_bild_url ? (
                        <img src={event.kategorie_bild_url} alt={event.titel} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                        </div>
                      )}
                      {event.datum && (
                        <div className="absolute bottom-2 left-2">
                          <span className="text-[10px] font-bold text-white bg-[#5BBAA7] rounded-full px-2 py-0.5">
                            {new Date(event.datum + "T00:00:00").toLocaleDateString("de-CH", { weekday: "short", day: "numeric" })}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-[var(--bg-card)]">
                      <p className="text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[#5BBAA7] transition-colors">{event.titel}</p>
                      {event.ort && <p className="text-[10px] text-[var(--text-muted)] mt-1 truncate">{event.ort.split(",")[0].trim()}</p>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div></LazySection>
        )}

        {/* ===== SAISONALE LANDING ===== */}
        {!loading && allEventsPool.length > 0 && <LazySection fallback={<div className="mt-10 h-56 skeleton rounded-2xl" />}>{(() => {
          const month = now.getMonth();
          type SeasonCfg = { title: string; subtitle: string; gradFrom: string; gradTo: string; cats: string[]; io: string | null };
          const cfg: SeasonCfg =
            month <= 1  ? { title: "Gemütliche Wintertage",   subtitle: "Die schönsten Indoor-Aktivitäten für Kinder", gradFrom: "from-indigo-500", gradTo: "to-blue-400",    cats: ["Kreativ","Theater","Musik","Bildung"],           io: "indoor"  }
          : month <= 2  ? { title: "Frühling naht!",           subtitle: "Natur erwacht — raus und entdecken",          gradFrom: "from-green-500",  gradTo: "to-emerald-400",  cats: ["Natur","Ausflug","Sport","Tiere"],                io: "outdoor" }
          : month <= 4  ? { title: "Raus in die Natur",        subtitle: "Frühling in Zürich — beste Zeit für Abenteuer", gradFrom: "from-emerald-500", gradTo: "to-teal-400", cats: ["Natur","Ausflug","Sport","Tiere"],                io: "outdoor" }
          : month <= 7  ? { title: "Sommer in Zürich",         subtitle: "Camps, Abenteuer & lange Sonnentage",         gradFrom: "from-amber-500",  gradTo: "to-orange-400",   cats: ["Feriencamp","Ausflug","Sport","Natur"],          io: "outdoor" }
          : month <= 9  ? { title: "Goldener Herbst",          subtitle: "Herbstfarben entdecken und erleben",          gradFrom: "from-orange-500", gradTo: "to-amber-400",    cats: ["Natur","Ausflug","Bildung","Museum"],            io: null      }
          :               { title: "Drinnen & Kreativ",        subtitle: "Warme Stunden mit Kunst, Musik und Theater",  gradFrom: "from-purple-500", gradTo: "to-rose-400",     cats: ["Kreativ","Theater","Musik","Tanz"],              io: "indoor"  };

          const monthNames = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

          const seasonEvents = allEventsPool
            .filter((e) => {
              const catOk = e.kategorien?.some((c) => cfg.cats.includes(c));
              const ioOk = !cfg.io || !e.indoor_outdoor || e.indoor_outdoor === cfg.io || e.indoor_outdoor === "beides";
              return catOk && ioOk;
            })
            .sort((a, b) => {
              if (a.datum && !b.datum) return -1;
              if (!a.datum && b.datum) return 1;
              if (a.datum && b.datum) return a.datum.localeCompare(b.datum);
              return 0;
            })
            .slice(0, 6);

          if (seasonEvents.length === 0) return null;

          return (
            <div className="mt-8 card-enter">
              <div className={`bg-gradient-to-r ${cfg.gradFrom} ${cfg.gradTo} rounded-2xl px-5 pt-5 pb-4 mb-3`}>
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                  Saisontipp · {monthNames[month]}
                </p>
                <h2 className="text-xl font-bold text-white mb-0.5">{cfg.title}</h2>
                <p className="text-white/80 text-sm">{cfg.subtitle}</p>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
                {seasonEvents.map((e, idx) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    className="flex-shrink-0 w-48 snap-start bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] hover:border-kidgo-200 hover:shadow-md transition-all overflow-hidden group"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className="h-24 overflow-hidden bg-[var(--bg-subtle)]">
                      {e.kategorie_bild_url ? (
                        <img src={e.kategorie_bild_url} alt={e.titel} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-xs text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors mb-1">{e.titel}</p>
                      {e.datum ? (
                        <p className="text-xs font-medium text-kidgo-500">
                          {new Date(e.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                        </p>
                      ) : (
                        <p className="text-xs text-green-600 font-medium">Ganzjährig</p>
                      )}
                      {e.ort && <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{e.ort.split(",")[0]}</p>}
                    </div>
                  </Link>
                ))}
                <Link
                  href="/explore"
                  className="flex-shrink-0 w-28 snap-start bg-[var(--bg-subtle)] border border-dashed border-[var(--border)] rounded-2xl flex flex-col items-center justify-center gap-2 p-3 hover:border-kidgo-300 transition-all group"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-hover:text-kidgo-500 transition-colors">
                    <path d="M9 3v12M3 9h12"/>
                  </svg>
                  <p className="text-xs font-medium text-[var(--text-muted)] group-hover:text-kidgo-500 transition-colors text-center leading-tight">Alle entdecken</p>
                </Link>
              </div>
            </div>
          );
        })()}</LazySection>}

        {/* Link to explore */}
        <div className="mt-10 text-center">
          <Link
            href="/explore"
            className="text-[var(--text-muted)] hover:text-kidgo-500 text-sm transition underline decoration-dotted underline-offset-4"
          >
            Alle Events entdecken →
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

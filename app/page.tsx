"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { AuthButton } from "@/components/AuthButton";
import { ProfileSetupModal } from "@/components/ProfileSetupModal";
import { useAuth } from "@/lib/auth-context";
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
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { InterestsModal } from "@/components/InterestsModal";
import { eventMatchesInterests } from "@/lib/interests";
import {
  getRatedEvents,
  buildPreferenceProfile,
  scoreWithPreferences,
  type PreferenceProfile,
} from "@/lib/preferences";

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
  emoji: string;
  label: string;
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

const categoryEmojis: Record<string, string> = {
  Kreativ: "🎨", Natur: "🌿", Tiere: "🐾", Sport: "⚽",
  Tanz: "💃", Theater: "🎭", Musik: "🎵", "Mode & Design": "👗",
  Wissenschaft: "🔬", Bildung: "📚", Ausflug: "🗺️", Feriencamp: "🏕️",
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
    return { title: "Ferientipp für euch 🏖️", subtitle: `${holiday} — Zeit für Abenteuer!` };
  if (dow === 6 || dow === 0 || (dow === 5 && h >= 15))
    return { title: "Dieses Wochenende für euch", subtitle: "Passend ausgewählt für dein Kind" };
  if (dow === 3 && h >= 11 && h <= 18)
    return { title: "Mittwochnachmittag-Tipps 🎒", subtitle: "Heute Nachmittag was Tolles unternehmen" };
  if (h >= 6 && h < 12)
    return { title: "Guten Morgen! Was unternehmt ihr heute?", subtitle: "Passend ausgewählt für dein Kind" };
  if (h >= 12 && h < 17)
    return { title: "Nachmittagsprogramm gesucht?", subtitle: "Passend ausgewählt für dein Kind" };
  if (h >= 17 && h < 21)
    return { title: "Für morgen planen?", subtitle: "Schau was morgen passt" };
  return { title: "Schlaf gut! Hier sind Ideen für morgen.", subtitle: "Schon mal für morgen planen" };
}

function weatherIcon(code: number): string {
  if (code >= 80) return "⛈️";
  if (code >= 61) return "🌧️";
  if (code >= 51) return "🌦️";
  if (code >= 3)  return "⛅";
  return "☀️";
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
  profile: PreferenceProfile | null = null
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
    reasons.push("👨‍👩‍👧‍👦 Passt für alle Kinder");
  }

  const isRain = weatherCode !== null && weatherCode >= 51;
  const isSun  = weatherCode !== null && weatherCode <= 2;
  if (isRain && event.indoor_outdoor === "indoor") {
    score += 8;
    reasons.push("🌧️ Indoor-Tipp — heute regnet es");
  } else if (isSun && event.indoor_outdoor === "outdoor") {
    score += 8;
    reasons.push("☀️ Perfekt bei diesem Wetter");
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
      if (diff === 0) reasons.push("🔥 Heute!");
      else if (diff === 1) reasons.push("⚡ Morgen!");
      else reasons.push(`⏰ Nur noch ${diff} Tage!`);
    }
  }

  const descLow = (event.beschreibung || "").toLowerCase();
  const titleLow = event.titel.toLowerCase();
  const isFree =
    event.preis_chf === 0 ||
    ["gratis", "kostenlos", "freier eintritt"].some(
      (kw) => descLow.includes(kw) || titleLow.includes(kw)
    );
  if (isFree) { score += 3; reasons.push("🎉 Gratis!"); }

  if (
    event.created_at &&
    new Date(event.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  ) {
    score += 3;
    reasons.push("✨ Neu entdeckt");
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
    if (isCamp) { score += 5; reasons.push("🏖️ Ferientipp!"); }
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" aria-hidden="true">
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
  const emoji = categoryEmojis[cat] || "🎪";
  const cls = className ?? "h-48 w-full overflow-hidden";
  const altText = title || cat || "Event";

  if (url && !err) {
    return (
      <div className={cls}>
        <img
          src={url}
          alt={altText}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setErr(true)}
        />
      </div>
    );
  }
  return (
    <div className={`${cls} bg-gradient-to-br from-kidgo-100 to-kidgo-50 flex items-center justify-center`}>
      <span className="text-6xl" role="img" aria-label={altText}>{emoji}</span>
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

  return (
    <Link
      href={`/events/${event.id}`}
      className="block group card-enter"
      style={{ animationDelay: `${animIndex * 80}ms` }}
    >
      <div
        className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 group-hover:border-kidgo-200 group-hover:-translate-y-0.5 relative"
        style={{ borderLeft: `3px solid ${getCategoryColor(event.kategorien, event.kategorie)}` }}
      >
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
            {shownReasons.map((r, i) => (
              <span
                key={i}
                className="bg-kidgo-50 text-kidgo-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-kidgo-100"
              >
                {r}
              </span>
            ))}
          </div>

          <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1.5 group-hover:text-kidgo-500 transition-colors">
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
                {badges.map((b, i) => (
                  <span key={i} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${b.cls}`}>{b.label}</span>
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
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
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
              <span className="text-xs text-gray-400 font-medium">
                {bookmarkCount} {bookmarkCount === 1 ? "Familie" : "Familien"} interessiert
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
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
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"welcome" | "age-select" | "location-ask" | "recommendations">("age-select");
  const [isFirstVisit, setIsFirstVisit] = useState(false);
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
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
    label: string;
    approximate: boolean;
  } | null>(null);

  // Feature A: Chat
  const [chatInput, setChatInput] = useState("");
  const [chatResult, setChatResult] = useState<{ message: string; events: KidgoEvent[] } | null>(null);
  const chatResultRef = useRef<HTMLDivElement>(null);

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
  const [showInterestsModal, setShowInterestsModal] = useState(false);

  // Sprint 11: Preference profile from liked events
  const [preferenceProfile, setPreferenceProfile] = useState<PreferenceProfile | null>(null);

  // Sprint 11: Collapsible sections (all closed by default)
  const [wochenplanerOpen, setWochenplanerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  // Feature 4: Streak
  const [visitCount, setVisitCount] = useState(0);

  // Sprint 3: Challenge
  const [challengeAccepted, setChallengeAccepted] = useState(false);
  const [showChallengeEvents, setShowChallengeEvents] = useState(false);

  // Sprint 13: Onboarding tutorial overlay
  const [showTutorial, setShowTutorial] = useState(false);

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

  // Sprint 7: Search history
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Sprint 11: Social proof, countdown, AI
  const [bookmarkCounts, setBookmarkCounts] = useState<Map<string, number>>(new Map());
  const [countdownTick, setCountdownTick]   = useState(0);
  const [aiLoading, setAiLoading]           = useState(false);

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
    const supabaseBrowser = createClient();
    supabaseBrowser
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

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
    const onboarded = localStorage.getItem("kidgo_onboarded");
    if (!onboarded) {
      setIsFirstVisit(true);
      setStep("welcome");
    } else {
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
    }
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
      const raw = localStorage.getItem("kidgo_search_history");
      if (raw) setSearchHistory(JSON.parse(raw));
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
        if (typeof d?.current?.weather_code === "number") setWeatherCode(d.current.weather_code);
        if (typeof d?.current?.temperature_2m === "number") setWeatherTemp(d.current.temperature_2m);
      })
      .catch(() => {});
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

  useEffect(() => {
    if (step !== "recommendations" || selectedBuckets.length === 0) return;
    fetchAndScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedBuckets, weatherCode]);

  const fetchAndScore = async () => {
    setLoading(true);
    setSurpriseEvent(null);
    setShowSurprise(false);
    setChatResult(null);
    setDayPlan(null);
    setShowDayPlan(false);

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
          const scored: ScoredEvent[] = ageFiltered.map((event) => {
            const { score, reasons } = scoreEvent(event, selectedBuckets, weatherCode, now, userInterests, preferenceProfile);
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
      const scored: ScoredEvent[] = ageFiltered.map((event) => {
        const { score, reasons } = scoreEvent(event, selectedBuckets, weatherCode, now, userInterests, preferenceProfile);
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
        const supabaseBrowser = createClient();
        const { data: bkData } = await supabaseBrowser.rpc("get_event_bookmark_counts");
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
      const scored: ScoredEvent[] = ageFiltered.map((event) => {
        const { score, reasons } = scoreEvent(event, selectedBuckets, weatherCode, now, userInterests, preferenceProfile);
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

  const handleChatQuery = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setChatInput(q);
    trackChatUsed();
    triggerBadgeCheck();

    const parsed = parseNaturalQuery(q);
    const effectiveBuckets = parsed.ageBuckets.length > 0 ? parsed.ageBuckets : selectedBuckets;
    const parsedWithBuckets = { ...parsed, ageBuckets: effectiveBuckets };

    const pool = parsed.ageBuckets.length > 0 ? allEventsPool : allEvents;
    const filtered = filterByQuery(pool, parsedWithBuckets);

    const now = new Date();
    const scored = [...filtered]
      .map((e) => ({ ...e, score: scoreEvent(e, effectiveBuckets, weatherCode, now, userInterests, preferenceProfile).score }))
      .sort(() => Math.random() - 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const message = buildChatResponse(parsedWithBuckets, filtered.length, weatherCode, now);
    setChatResult({ message, events: scored });

    setSearchHistory((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, 5);
      try { localStorage.setItem("kidgo_search_history", JSON.stringify(next)); } catch {}
      return next;
    });

    setTimeout(() => {
      chatResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  };

  const handleAiQuery = async () => {
    const q = chatInput.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    trackChatUsed();

    // Liked categories from preference profile
    const likedCats = preferenceProfile?.preferredCategories?.slice(0, 5) ?? [];

    try {
      const supabaseBrowser = createClient();

      // 8-second timeout with fallback to client-side
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      let succeeded = false;
      try {
        const { data, error } = await supabaseBrowser.functions.invoke("ask-kidgo", {
          body: {
            question: q,
            context: {
              age_buckets: selectedBuckets,
              weather_code: weatherCode,
              hour: new Date().getHours(),
              liked_categories: likedCats,
              standort: userLocation ? "Zürich" : null,
            },
          },
        });
        clearTimeout(timeout);
        if (data && !error) {
          // Edge function returns matched events directly; fall back to allEventsPool lookup
          const returnedEvents: KidgoEvent[] = Array.isArray(data.events) && data.events.length > 0
            ? data.events
            : ((data.ids || []) as string[])
                .map((id: string) => allEventsPool.find((e) => e.id === id))
                .filter((e): e is KidgoEvent => !!e);
          setChatResult({ message: data.answer, events: returnedEvents });
          succeeded = true;
          setTimeout(() => chatResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
        }
      } catch {
        clearTimeout(timeout);
      }

      // Fallback: client-side parse
      if (!succeeded) {
        handleChatQuery(q);
      }
    } catch {}

    triggerBadgeCheck();
    setAiLoading(false);
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

  const navigateForward = (target: "welcome" | "age-select" | "location-ask" | "recommendations") => {
    setTransitionClass("page-slide-in");
    setStep(target);
  };

  const navigateBack = (target: "welcome" | "age-select" | "location-ask" | "recommendations") => {
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
      navigateForward(isFirstVisit ? "location-ask" : "recommendations");
    }
  };

  const handleMultiChildConfirm = () => {
    if (selectedBuckets.length === 0) return;
    localStorage.setItem("kidgo_age_buckets", JSON.stringify(selectedBuckets));
    navigateForward(isFirstVisit ? "location-ask" : "recommendations");
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
    setChatResult(null);
    setChatInput("");
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

  // Sprint 12: Card stack — animated swipe handlers
  const handleSwipeLeft = () => {
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
      const next: CompactEvent[] = exists
        ? prev.filter((b) => b.id !== event.id)
        : [{ id: event.id, titel: event.titel, datum: event.datum, ort: event.ort, kategorie_bild_url: event.kategorie_bild_url, kategorien: event.kategorien }, ...prev];
      try { localStorage.setItem("kidgo_bookmarks", JSON.stringify(next)); } catch {}
      // Sync to Supabase if logged in
      if (user) {
        const supabaseBrowser = createClient();
        if (exists) {
          supabaseBrowser.from("user_bookmarks").delete().eq("user_id", user.id).eq("event_id", event.id);
        } else {
          supabaseBrowser.from("user_bookmarks").upsert({ user_id: user.id, event_id: event.id });
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
        const supabaseBrowser = createClient();
        supabaseBrowser.from("user_bookmarks").delete().eq("user_id", user.id).eq("event_id", id);
      }
      return next;
    });
  };

  // Sprint 3: Complete onboarding
  const finishOnboarding = () => {
    try { localStorage.setItem("kidgo_onboarded", "true"); } catch {}
    setIsFirstVisit(false);
    // Sprint 13: Show tutorial on first visit
    try {
      if (!localStorage.getItem("kidgo_tutorial_seen")) setShowTutorial(true);
    } catch {}
    navigateForward("recommendations");
    // Sprint 11: Show interests modal if not yet set
    try {
      const existing = localStorage.getItem("kidgo_interests");
      if (!existing) setShowInterestsModal(true);
    } catch {}
  };

  const handleTutorialComplete = () => {
    try { localStorage.setItem("kidgo_tutorial_seen", "true"); } catch {}
    setShowTutorial(false);
  };

  const now = new Date();
  const headline = getHeadline(now);

  // Sprint 11: Gamification
  const gamificationStats = mounted ? getLocalStats(bookmarks.length) : null;
  const levelInfo = gamificationStats ? getLevelProgress(gamificationStats.visitedEventIds.length) : null;

  if (!mounted) return null;

  // ===== STEP: WELCOME (first-time only) =====
  if (step === "welcome") {
    return (
      <main className={`min-h-screen bg-[#5BBAA7] flex flex-col items-center justify-center p-4 ${transitionClass}`}>
        <div className="w-full max-w-md mx-auto text-center card-enter">
          <div className="mb-8 flex justify-center">
            <KidgoLogo size="lg" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3 leading-tight">
            Willkommen bei Kidgo!
          </h1>
          <p className="text-white/80 text-lg mb-2 leading-relaxed">
            Dein persönlicher Begleiter für die besten Kinder-Events in Zürich
          </p>
          <p className="text-white/60 text-sm mb-10">
            Passend fürs Alter, Wetter und deine Ferien ✨
          </p>
          <button
            onClick={() => navigateForward("age-select")}
            className="w-full bg-white text-[#5BBAA7] py-4 rounded-2xl font-bold text-xl hover:bg-kidgo-50 transition shadow-lg active:scale-95"
          >
            Los geht&apos;s! 👋
          </button>
        </div>
      </main>
    );
  }

  // ===== STEP: LOCATION ASK (first-time only) =====
  if (step === "location-ask") {
    return (
      <main className={`min-h-screen bg-[#5BBAA7] flex flex-col items-center justify-center p-4 ${transitionClass}`}>
        <div className="w-full max-w-md mx-auto card-enter">
          <div className="text-center mb-8">
            <div className="mb-4 flex justify-center"><KidgoLogo size="md" /></div>
            <h1 className="text-2xl font-bold text-white mb-2">Standort für dich</h1>
            <p className="text-white/80 leading-relaxed">
              Mit deinem Standort zeigen wir Events in deiner Nähe und berechnen die Entfernung.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-5 mb-5 shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600 flex items-start gap-2">
              <span className="mt-0.5">🔒</span>
              <span>Dein Standort wird nur lokal auf deinem Gerät gespeichert — niemals weitergegeben.</span>
            </p>
          </div>
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const loc = {
                      lat: pos.coords.latitude,
                      lon: pos.coords.longitude,
                      label: "Dein Standort",
                      approximate: false,
                    };
                    setUserLocation(loc);
                    try { localStorage.setItem("kidgo_location", JSON.stringify(loc)); } catch {}
                  },
                  () => {}
                );
              }
              finishOnboarding();
            }}
            className="w-full bg-white text-[#5BBAA7] py-4 rounded-2xl font-bold text-lg hover:bg-kidgo-50 transition shadow-lg active:scale-95 mb-3"
          >
            📍 Standort erlauben
          </button>
          <button
            onClick={finishOnboarding}
            className="w-full py-3 text-white/60 text-sm hover:text-white/80 transition"
          >
            Überspringen
          </button>
        </div>
      </main>
    );
  }

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
                  <div className="text-4xl mb-2">{bucket.emoji}</div>
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
              👨‍👩‍👧‍👦 Mehrere Kinder
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

  // Sprint 3: Compute current challenge
  const weekNum = Math.floor(Date.now() / 604800000) % 6;
  const currentChallenge = WEEKLY_CHALLENGES[weekNum];
  const challengeEvents = allEventsPool.filter(currentChallenge.filter);

  // Sprint 3: Season countdown
  const holidayRemaining = getRemainingHolidayDays(now);
  const holidayUpcoming = !holidayRemaining ? getUpcomingHoliday(now) : null;
  const campCount = allEventsPool.filter((e) => {
    const desc = (e.beschreibung || "").toLowerCase();
    const cats = e.kategorien || (e.kategorie ? [e.kategorie] : []);
    return e.event_typ === "camp" || cats.includes("Feriencamp") || desc.includes("camp") || desc.includes("ferienlager");
  }).length;

  return (
    <>
    {showTutorial && (
      <OnboardingTutorial onComplete={handleTutorialComplete} />
    )}
    {showProfileSetup && (
      <ProfileSetupModal onComplete={() => setShowProfileSetup(false)} />
    )}
    {showInterestsModal && (
      <InterestsModal
        onComplete={(interests) => {
          setUserInterests(interests);
          setShowInterestsModal(false);
        }}
      />
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
            <KidgoLogo size="sm" />
          </div>
        </div>
      )}
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 pb-24 md:pb-10">

        {/* Sprint 3: PWA Install Banner */}
        {showInstallBanner && (
          <div className="mb-5 bg-gradient-to-r from-kidgo-400 to-kidgo-300 text-white rounded-2xl px-5 py-4 shadow-md card-enter">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📱</span>
              <div className="flex-1">
                <p className="font-bold text-sm">📱 Als App installieren</p>
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
            <span className="text-xl flex-shrink-0">🔔</span>
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
            <span className="text-2xl">📡</span>
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
              <KidgoLogo size="sm" />
            </Link>
            <div className="flex items-center gap-2">
              {weatherCode !== null && (
                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5 border border-gray-100 dark:border-gray-700">
                  <span aria-hidden="true">{weatherIcon(weatherCode)}</span>
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 leading-tight mb-1">
            {headline.title}
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

        {/* ===== SPRINT 16: SAISONALE LANDING ===== */}
        {!loading && allEventsPool.length > 0 && (() => {
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
            <div className="mb-6 card-enter">
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
        })()}

        {/* Holiday banner */}
        {isSchoolHoliday(now) && (
          <div className="mb-5 bg-gradient-to-r from-kidgo-50 to-kidgo-50 border border-kidgo-100 text-kidgo-800 rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-kidgo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-kidgo-500">
                <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM8 5v3l2 2"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm">Ferienzeit — Entdecke Camps und Ausflüge</p>
              <p className="text-kidgo-500 text-xs mt-0.5">{getActiveHoliday(now)} · Zürich</p>
            </div>
          </div>
        )}

        {/* Sprint 3: Saison-Countdown */}
        {!loading && allEventsPool.length > 0 && holidayRemaining && (
          <div className="mb-5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-2xl px-5 py-4 flex items-center gap-3 card-enter">
            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-500">
                <path d="M7 1v6l3 3M7 13A6 6 0 1 0 7 1a6 6 0 0 0 0 12z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-[var(--text-primary)]">
                Noch {holidayRemaining.daysLeft} {holidayRemaining.daysLeft === 1 ? "Ferientag" : "Ferientage"}!
              </p>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{holidayRemaining.name}</p>
            </div>
          </div>
        )}
        {!loading && allEventsPool.length > 0 && holidayUpcoming && (
          <div className="mb-5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-2xl px-5 py-4 flex items-center gap-3 card-enter">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <rect x="1" y="2" width="12" height="11" rx="1.5"/>
                <path d="M1 6h12M5 1v3M9 1v3"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-[var(--text-primary)]">
                Noch {holidayUpcoming.daysUntil} {holidayUpcoming.daysUntil === 1 ? "Tag" : "Tage"} bis {holidayUpcoming.name}
              </p>
              {campCount > 0 && (
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{campCount} Camp-Ideen</p>
              )}
            </div>
          </div>
        )}

        {/* Sprint 3: Challenge der Woche */}
        {!loading && allEventsPool.length > 0 && (
          <div className="mb-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-5 py-4 card-enter" style={{ borderLeft: "3px solid #7c3aed" }}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-purple-500 uppercase tracking-wider mb-1">Challenge der Woche</p>
                <p className="font-semibold text-[var(--text-primary)] text-sm leading-snug">{currentChallenge.title}</p>
                {challengeEvents.length > 0 && (
                  <p className="text-[var(--text-muted)] text-xs mt-0.5">{challengeEvents.length} passende Events</p>
                )}
              </div>
              {challengeAccepted ? (
                <div className="flex-shrink-0 bg-purple-100 rounded-full w-8 h-8 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                    <path d="M2 7l4 4 6-7"/>
                  </svg>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setChallengeAccepted(true);
                    setShowChallengeEvents(true);
                    try {
                      localStorage.setItem("kidgo_challenge_accepted", "true");
                    } catch {}
                    setTimeout(() => document.getElementById("challenge-events")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
                  }}
                  className="flex-shrink-0 bg-purple-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-purple-600 transition active:scale-95"
                >
                  Annehmen
                </button>
              )}
            </div>
            {challengeAccepted && (
              <button
                onClick={() => setShowChallengeEvents((v) => !v)}
                className="mt-3 text-xs text-purple-500 hover:text-purple-700 transition underline underline-offset-2"
              >
                {showChallengeEvents ? "Events ausblenden" : "Passende Events anzeigen →"}
              </button>
            )}
          </div>
        )}

        {/* Challenge events */}
        {showChallengeEvents && (
          <div id="challenge-events" className="mb-5 card-enter">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span>Challenge-Events</span>
                <span className="text-sm font-normal text-gray-400">({challengeEvents.length})</span>
              </h3>
              <button
                onClick={() => setShowChallengeEvents(false)}
                className="text-gray-400 text-sm w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition"
              >
                ✕
              </button>
            </div>
            {challengeEvents.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
                <p className="text-4xl mb-2">🔍</p>
                <p className="text-gray-400 text-sm">Aktuell keine passenden Events</p>
              </div>
            ) : (
              <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                {challengeEvents.slice(0, 5).map((event, i) => (
                  <RecommendationCard
                    key={event.id}
                    event={event}
                    reasons={[]}
                    sources={sources}
                    userLocation={userLocation}
                    animIndex={i}
                    selectedBuckets={selectedBuckets}
                    isSeriesParent={seriesParentIds.has(event.id)}
                    isBookmarked={bookmarks.some((b) => b.id === event.id)}
                    onBookmark={(e) => toggleBookmark(event, e)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading state — skeleton cards */}
        {loading && (
          <div className="space-y-4" role="status" aria-label="Events werden geladen">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Sprint 12: Animated empty state */}
        {!loading && recommendations.length === 0 && !isOffline && (
          <div className="text-center py-14 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="empty-float mx-auto mb-5 w-20 h-20">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="80" height="80" rx="20" fill="var(--bg-subtle)"/>
                <rect x="16" y="20" width="36" height="40" rx="3" stroke="#5BBAA7" strokeWidth="2" fill="none"/>
                <path d="M16 30h36" stroke="#5BBAA7" strokeWidth="2"/>
                <path d="M24 24v-6M44 24v-6" stroke="#5BBAA7" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="56" cy="24" r="10" fill="var(--bg-page)" stroke="#b2bec3" strokeWidth="1.5"/>
                <path d="M52 24h8M56 20v8" stroke="#b2bec3" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-[var(--text-primary)] font-semibold mb-1">Keine aktuellen Events gefunden</p>
            <p className="text-[var(--text-muted)] text-sm mb-5">Schau im Katalog nach weiteren Aktivitäten</p>
            <Link
              href="/explore"
              className="bg-kidgo-400 text-white px-6 py-3 rounded-xl font-semibold hover:bg-kidgo-500 transition"
            >
              Alle Events entdecken
            </Link>
          </div>
        )}

        {/* Sprint 12: Card Stack — Tinder-style stacked cards */}
        {!loading && recommendations.length > 0 && (
          <div className="relative select-none min-h-[420px] md:min-h-[520px]">

            {/* Background stacked cards (peek behind top card) */}
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
                    entdeckerScore={computeEntdeckerScore(cnt)}
                    isBookmarked={bookmarks.some((b) => b.id === event.id)}
                    bookmarkCount={bookmarkCounts.get(event.id)}
                  />
                </div>
              );
            })}

            {/* Top card — interactive, draggable */}
            {(() => {
              const event = recommendations[0];
              const cnt = sourceCountMap.get(event.quelle_id || "") ?? 0;
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
                  onTouchStart={handleRecTouchStart}
                  onTouchMove={handleRecTouchMove}
                  onTouchEnd={handleRecTouchEnd}
                >
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
              );
            })()}

            {/* Swipe hint badge */}
            {swipeHint && (
              <div
                className={`absolute top-0 left-0 right-0 rounded-2xl pointer-events-none flex items-center ${swipeHint === "left" ? "justify-end pr-6" : "justify-start pl-6"}`}
                style={{ height: "200px", zIndex: recommendations.length + 2 }}
              >
                <div
                  className={`px-4 py-2 rounded-full text-white text-sm font-bold shadow-lg ${swipeHint === "left" ? "bg-kidgo-500" : "bg-green-500"}`}
                >
                  {swipeHint === "left" ? "Weiter" : "Gemerkt"}
                </div>
              </div>
            )}

            {/* Counter + action buttons */}
            <div className="absolute left-0 right-0 flex items-center justify-center gap-6" style={{ bottom: "-56px" }}>
              <button
                onClick={handleSwipeLeft}
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
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill={bookmarks.some((b) => b.id === recommendations[0].id) ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3h12v13.5L9 13.5 3 16.5V3z"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Spacer for card stack action buttons — 112px prevents overlap on all phone sizes */}
        {!loading && recommendations.length > 0 && <div className="mt-28" />}

        {/* ===== SPRINT 11: QUICK ACTIONS ===== */}
        {!loading && (
          <div className="mt-6">
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
              {/* Karte */}
              <Link href="/map" className="flex-shrink-0 flex flex-col items-center gap-1.5 group">
                <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center justify-center group-hover:border-[#5BBAA7]/40 group-hover:shadow-md transition-all active:scale-95">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#5BBAA7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 2a6 6 0 0 1 6 6c0 5.5-6 13-6 13S5 13.5 5 8a6 6 0 0 1 6-6z"/>
                    <circle cx="11" cy="8" r="2"/>
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-gray-500 group-hover:text-[#5BBAA7] transition-colors">Karte</span>
              </Link>

              {/* Gratis */}
              <button
                onClick={() => {
                  setCollectionsOpen(true);
                  setActiveCollection("gratis");
                  setTimeout(() => {
                    document.getElementById("smart-collections")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
              >
                <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center justify-center group-hover:border-[#5BBAA7]/40 group-hover:shadow-md transition-all active:scale-95">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#5BBAA7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M8 11h6M11 8v6"/>
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-gray-500 group-hover:text-[#5BBAA7] transition-colors">Gratis</span>
              </button>

              {/* Camps */}
              <button
                onClick={() => {
                  setCollectionsOpen(true);
                  setActiveCollection("camps");
                  setTimeout(() => {
                    document.getElementById("smart-collections")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 50);
                }}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
              >
                <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center justify-center group-hover:border-[#5BBAA7]/40 group-hover:shadow-md transition-all active:scale-95">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#5BBAA7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 18L11 4l7 14H4z"/>
                    <path d="M11 4v6M8.5 12h5"/>
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-gray-500 group-hover:text-[#5BBAA7] transition-colors">Camps</span>
              </button>

              {/* Frag Kidgo */}
              <button
                onClick={() => {
                  setChatOpen(true);
                  setTimeout(() => {
                    document.getElementById("kidgo-chat-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    setTimeout(() => document.getElementById("kidgo-chat-input")?.focus(), 200);
                  }, 400);
                }}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
              >
                <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center justify-center group-hover:border-[#5BBAA7]/40 group-hover:shadow-md transition-all active:scale-95">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#5BBAA7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 18V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7L4 18z"/>
                    <path d="M8 9h6M8 12h4"/>
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-gray-500 group-hover:text-[#5BBAA7] transition-colors">Frag Kidgo</span>
              </button>

              {/* Verlauf */}
              <Link href="/history" className="flex-shrink-0 flex flex-col items-center gap-1.5 group">
                <div className="w-14 h-14 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center justify-center group-hover:border-[#5BBAA7]/40 group-hover:shadow-md transition-all active:scale-95">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#5BBAA7" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M11 7v4l3 2"/>
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-gray-500 group-hover:text-[#5BBAA7] transition-colors">Verlauf</span>
              </Link>
            </div>
          </div>
        )}

        {/* ===== SPRINT 6A: WOCHENPLANER (collapsible) ===== */}
        {!loading && allEventsPool.length > 0 && (() => {
          const todayNow = new Date();
          const dow = todayNow.getDay();
          const mondayOffset = dow === 0 ? -6 : 1 - dow;
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(todayNow);
            d.setDate(d.getDate() + mondayOffset + i);
            d.setHours(0, 0, 0, 0);
            return d;
          });
          const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
          const eventsByDay = weekDays.map((day) => {
            const dayStr = localDateStr(day);
            return allEventsPool.filter((e) => e.datum === dayStr);
          });
          const selectedDayEvents = selectedWeekDay !== null ? eventsByDay[selectedWeekDay] : [];
          const todayStr = localDateStr(todayNow);

          return (
            <div className="mt-8">
              <button
                onClick={() => setWochenplanerOpen((o) => !o)}
                className="w-full flex items-center justify-between mb-3 px-0.5"
              >
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Deine Woche</p>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform duration-200 ${wochenplanerOpen ? "rotate-180" : ""}`}>
                  <path d="M3 5l4 4 4-4"/>
                </svg>
              </button>
              <div style={{ maxHeight: wochenplanerOpen ? "600px" : "0", overflow: "hidden", transition: "max-height 0.35s ease" }}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex">
                  {weekDays.map((day, i) => {
                    const isToday = localDateStr(day) === todayStr;
                    const hasEvents = eventsByDay[i].length > 0;
                    const selected = selectedWeekDay === i;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedWeekDay(selected ? null : i)}
                        className={`flex-1 py-3 flex flex-col items-center gap-1 transition-colors ${
                          selected ? "bg-kidgo-50" : "hover:bg-gray-50"
                        } ${isToday ? "border-b-2 border-kidgo-400" : "border-b-2 border-transparent"}`}
                      >
                        <span className={`text-xs font-semibold ${
                          isToday ? "text-kidgo-500" : selected ? "text-kidgo-500" : "text-gray-400"
                        }`}>
                          {dayLabels[i]}
                        </span>
                        <span className={`text-sm font-bold ${
                          isToday ? "text-kidgo-500" : selected ? "text-gray-800" : "text-gray-600"
                        }`}>
                          {day.getDate()}
                        </span>
                        <div className="h-1.5 flex items-center">
                          {hasEvents ? (
                            <span className={`w-1.5 h-1.5 rounded-full ${isToday ? "bg-kidgo-400" : "bg-gray-300"}`} />
                          ) : (
                            <span className="w-1.5 h-1.5" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedWeekDay !== null && (
                  <div className="border-t border-gray-100 p-4">
                    {selectedDayEvents.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-3">Keine Events an diesem Tag</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedDayEvents.slice(0, 5).map((ev) => (
                          <Link
                            key={ev.id}
                            href={`/events/${ev.id}`}
                            className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-kidgo-50 transition group"
                          >
                            <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-kidgo-100">
                              {ev.kategorie_bild_url ? (
                                <img src={ev.kategorie_bild_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-kidgo-300 text-xs font-bold">
                                  {(ev.kategorien?.[0] || "K").slice(0, 1)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-kidgo-500 transition-colors">{ev.titel}</p>
                              {ev.ort && <p className="text-xs text-gray-400 truncate">{ev.ort}</p>}
                            </div>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-kidgo-400 flex-shrink-0 transition">
                              <path d="M4 9l3-3-3-3"/>
                            </svg>
                          </Link>
                        ))}
                        {selectedDayEvents.length > 5 && (
                          <Link href="/explore" className="block text-center text-xs text-kidgo-500 hover:text-kidgo-500 pt-2 transition">
                            +{selectedDayEvents.length - 5} weitere Events
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>
            </div>
          );
        })()}

        {/* ===== FEATURE A: FRAG KIDGO CHAT (collapsible) ===== */}
        {!loading && allEventsPool.length > 0 && (
          <div id="kidgo-chat-section" className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setChatOpen((o) => !o)}
              className="w-full flex items-center justify-between p-5 pb-4 text-left"
            >
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Frag Kidgo</h2>
                <p className="text-gray-400 text-sm">Beschreib was du suchst</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 flex-shrink-0 ml-3 transition-transform duration-200 ${chatOpen ? "rotate-180" : ""}`}>
                <path d="M3 5l4 4 4-4"/>
              </svg>
            </button>
            <div style={{ maxHeight: chatOpen ? "800px" : "0", overflow: "hidden", transition: "max-height 0.35s ease" }}>
            <div className="px-5 pb-5">
              <p className="text-gray-400 text-sm mb-4">
                Beschreib was du suchst — ich filtere passende Events für dich
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {CHAT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleChatQuery(chip)}
                    className="text-xs font-medium bg-kidgo-50 text-kidgo-500 border border-kidgo-200 px-3 py-1.5 rounded-full hover:bg-kidgo-100 hover:border-kidgo-300 transition active:scale-95"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Search history — shown when input is empty */}
              {chatInput.trim() === "" && searchHistory.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-400 font-medium">Letzte Suchen:</span>
                    <button
                      onClick={() => {
                        setSearchHistory([]);
                        try { localStorage.removeItem("kidgo_search_history"); } catch {}
                      }}
                      className="text-xs text-gray-300 hover:text-gray-400 transition ml-auto"
                    >
                      Verlauf löschen
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {searchHistory.map((h) => (
                      <div key={h} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
                        <button
                          onClick={() => handleChatQuery(h)}
                          className="text-xs text-gray-600 hover:text-kidgo-500 transition"
                        >
                          {h}
                        </button>
                        <button
                          onClick={() => {
                            setSearchHistory((prev) => {
                              const next = prev.filter((x) => x !== h);
                              try { localStorage.setItem("kidgo_search_history", JSON.stringify(next)); } catch {}
                              return next;
                            });
                          }}
                          className="text-gray-300 hover:text-gray-500 transition leading-none"
                          aria-label="Entfernen"
                        >
                          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2 2l6 6M8 2l-6 6"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <input
                  id="kidgo-chat-input"
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChatQuery(chatInput)}
                  placeholder="Frag Kidgo..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kidgo-300 focus:border-transparent transition"
                />
                <button
                  onClick={() => handleChatQuery(chatInput)}
                  disabled={!chatInput.trim()}
                  aria-label="Suchen"
                  className="bg-kidgo-400 text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:bg-kidgo-500 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7h8M7 3l4 4-4 4"/>
                  </svg>
                </button>
                <button
                  onClick={handleAiQuery}
                  disabled={!chatInput.trim() || aiLoading}
                  aria-label="AI-Empfehlung von Kidgo"
                  title="AI-Empfehlung"
                  className="bg-[var(--bg-subtle)] border border-kidgo-200 text-kidgo-600 rounded-xl px-3 py-2.5 text-xs font-bold hover:bg-kidgo-50 hover:border-kidgo-300 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex-shrink-0 flex items-center gap-1.5"
                >
                  {aiLoading ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="animate-spin">
                      <path d="M7 1.5A5.5 5.5 0 1 1 1.5 7"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 1l1.5 3 3.3.5-2.4 2.3.6 3.2L7 8.5l-3 1.5.6-3.2-2.4-2.3 3.3-.5z"/>
                    </svg>
                  )}
                  <span className="hidden sm:inline">AI</span>
                </button>
              </div>
            </div>

            {chatResult && (
              <div ref={chatResultRef} className="border-t border-gray-100 p-5 bg-kidgo-50/40">
                <p className="text-sm font-semibold text-gray-700 mb-4">{chatResult.message}</p>
                {chatResult.events.length > 0 ? (
                  <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                    {chatResult.events.map((event, i) => (
                      <RecommendationCard
                        key={event.id}
                        event={event}
                        reasons={[]}
                        sources={sources}
                        userLocation={userLocation}
                        animIndex={i}
                        selectedBuckets={selectedBuckets}
                        isBookmarked={bookmarks.some((b) => b.id === event.id)}
                        onBookmark={(e) => toggleBookmark(event, e)}
                      />
                    ))}
                  </div>
                ) : (
                  <Link
                    href="/explore"
                    className="inline-block text-sm text-kidgo-500 underline underline-offset-2 hover:text-kidgo-500 transition"
                  >
                    Alle Events durchsuchen →
                  </Link>
                )}
              </div>
            )}
            </div>{/* end collapsible */}
          </div>
        )}

        {/* ===== SPRINT 11: KARTEN-KACHEL ===== */}
        {!loading && allEventsPool.length > 0 && (
          <div className="mt-6 card-enter">
            <Link href="/map" className="block group">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-kidgo-200 transition-all">
                <div className="relative h-24 bg-gradient-to-br from-kidgo-50 to-kidgo-100 overflow-hidden">
                  {/* Decorative map grid lines */}
                  <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 96" preserveAspectRatio="xMidYMid slice">
                    <line x1="0" y1="32" x2="400" y2="32" stroke="#5BBAA7" strokeWidth="1"/>
                    <line x1="0" y1="64" x2="400" y2="64" stroke="#5BBAA7" strokeWidth="1"/>
                    <line x1="80" y1="0" x2="80" y2="96" stroke="#5BBAA7" strokeWidth="1"/>
                    <line x1="160" y1="0" x2="160" y2="96" stroke="#5BBAA7" strokeWidth="1"/>
                    <line x1="240" y1="0" x2="240" y2="96" stroke="#5BBAA7" strokeWidth="1"/>
                    <line x1="320" y1="0" x2="320" y2="96" stroke="#5BBAA7" strokeWidth="1"/>
                    <circle cx="160" cy="48" r="6" fill="#5BBAA7" opacity="0.5"/>
                    <circle cx="240" cy="32" r="4" fill="#5BBAA7" opacity="0.4"/>
                    <circle cx="200" cy="64" r="5" fill="#5BBAA7" opacity="0.4"/>
                    <circle cx="120" cy="24" r="3" fill="#5BBAA7" opacity="0.3"/>
                    <circle cx="300" cy="56" r="4" fill="#5BBAA7" opacity="0.35"/>
                  </svg>
                  {/* Pin icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-white/90 rounded-full shadow-md flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#5BBAA7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 1.5a5 5 0 0 1 5 5c0 4.2-5 10-5 10S4 10.7 4 6.5a5 5 0 0 1 5-5z"/>
                        <circle cx="9" cy="6.5" r="2"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-bold text-gray-900 text-sm group-hover:text-kidgo-500 transition-colors">
                      Events auf der Karte
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {allEventsPool.length} Events in der Region Zürich
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-kidgo-500 group-hover:gap-2.5 transition-all">
                    <span>Karte öffnen</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l3-3-3-3M6 9l3-3-3-3" opacity="0.5"/>
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* ===== ACTION BUTTONS: SURPRISE + DAY PLAN ===== */}
        {!loading && allEvents.length > 0 && (
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <button
              onClick={handleSurprise}
              aria-label="Zufälliges Event entdecken"
              className="bg-white border-2 border-kidgo-200 text-kidgo-500 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-kidgo-50 hover:border-kidgo-400 transition shadow-sm hover:shadow-md active:scale-95"
            >
              {showSurprise ? "Nochmal" : "Zufällige Empfehlung"}
            </button>

            <button
              onClick={handleGenerateDayPlan}
              aria-label="Tagesplan für Kinder generieren"
              className="bg-white border-2 border-kidgo-200 text-kidgo-500 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-kidgo-50 hover:border-kidgo-400 transition shadow-sm hover:shadow-md active:scale-95"
            >
              Plan meinen Tag
            </button>
          </div>
        )}

        {/* ===== FEATURE 1: SMART COLLECTIONS (collapsible) ===== */}
        {!loading && allEventsPool.length > 0 && (
          <div id="smart-collections" className="mt-6">
            <button
              onClick={() => setCollectionsOpen((o) => !o)}
              className="w-full flex items-center justify-between mb-3 px-0.5"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sammlungen</p>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform duration-200 ${collectionsOpen ? "rotate-180" : ""}`}>
                <path d="M3 5l4 4 4-4"/>
              </svg>
            </button>
            <div style={{ maxHeight: collectionsOpen ? "400px" : "0", overflow: "hidden", transition: "max-height 0.35s ease" }}>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
              {SMART_COLLECTIONS.map((col) => {
                const colNow = new Date();
                const count = allEventsPool.filter((e) => col.filter(e, colNow)).length;
                const active = activeCollection === col.id;
                return (
                  <button
                    key={col.id}
                    onClick={() => setActiveCollection(active ? null : col.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 font-semibold text-sm transition-all whitespace-nowrap active:scale-95 ${
                      active
                        ? "bg-kidgo-400 text-white border-kidgo-400 shadow-md"
                        : "bg-white text-gray-700 border-gray-200 hover:border-kidgo-300 hover:bg-kidgo-50"
                    }`}
                  >
                    <span>{col.label}</span>
                    {count > 0 && (
                      <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${active ? "bg-white/25 text-white" : "bg-kidgo-100 text-kidgo-500"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            </div>{/* end collapsible */}
          </div>
        )}

        {activeCollection && collectionsOpen && (() => {
          const col = SMART_COLLECTIONS.find((c) => c.id === activeCollection)!;
          const colNow = new Date();
          const filtered = allEventsPool.filter((e) => col.filter(e, colNow));
          return (
            <div className="mt-4 card-enter">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <span>{col.label}</span>
                  <span className="text-sm font-normal text-gray-400">({filtered.length})</span>
                </h3>
                <button
                  onClick={() => setActiveCollection(null)}
                  className="text-sm text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-7 h-7 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>
              {filtered.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
                  <p className="text-4xl mb-3">🔍</p>
                  <p className="text-gray-500">Gerade keine Events in dieser Sammlung</p>
                </div>
              ) : (
                <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                  {filtered.map((event, i) => (
                    <RecommendationCard
                      key={event.id}
                      event={event}
                      reasons={[]}
                      sources={sources}
                      userLocation={userLocation}
                      animIndex={i}
                      selectedBuckets={selectedBuckets}
                      isSeriesParent={seriesParentIds.has(event.id)}
                      isBookmarked={bookmarks.some((b) => b.id === event.id)}
                      onBookmark={(e) => toggleBookmark(event, e)}
                      bookmarkCount={bookmarkCounts.get(event.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Surprise card */}
        {showSurprise && surpriseEvent && (
          <div key={surpriseAnimKey} id="surprise-card" className="mt-5 flip-in">
            <p className="text-center text-sm font-semibold text-kidgo-500 mb-3">
              Zufällige Entdeckung
            </p>
            <RecommendationCard
              event={surpriseEvent}
              reasons={["Zufällig für euch ausgewählt"]}
              sources={sources}
              userLocation={userLocation}
              animIndex={0}
              selectedBuckets={selectedBuckets}
              isBookmarked={bookmarks.some((b) => b.id === surpriseEvent.id)}
              onBookmark={(e) => toggleBookmark(surpriseEvent, e)}
            />
          </div>
        )}

        {/* ===== FEATURE C: DAY PLAN ===== */}
        {showDayPlan && dayPlan && (dayPlan.morning || dayPlan.afternoon) && (
          <div id="day-plan" className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-enter">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-lg">Dein Tagesplan</h2>
              <p className="text-gray-400 text-xs mt-0.5">Zwei abwechslungsreiche Events für euren Tag</p>
            </div>

            <div className="p-5">
              <div className="relative pl-7">
                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-kidgo-300 via-kidgo-200 to-kidgo-300 rounded-full" />

                {dayPlan.morning && (
                  <div className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 bg-kidgo-400 rounded-full border-2 border-white shadow-sm" />
                    <div className="text-xs font-bold text-kidgo-500 mb-1.5 tracking-wide">
                      10:00 – 12:00 Uhr · Vormittag
                    </div>
                    <Link
                      href={`/events/${dayPlan.morning.id}`}
                      className="block bg-kidgo-50 border border-kidgo-100 rounded-xl p-3.5 hover:bg-kidgo-100 hover:border-kidgo-200 transition group"
                    >
                      <div className="font-bold text-gray-800 text-sm group-hover:text-kidgo-600 transition leading-snug">
                        {dayPlan.morning.titel}
                      </div>
                      {dayPlan.morning.ort && (
                        <div className="text-gray-500 text-xs mt-1">{dayPlan.morning.ort}</div>
                      )}
                      {dayPlan.morning.datum && (
                        <div className="text-gray-400 text-xs mt-0.5">{formatDateShort(dayPlan.morning.datum)}</div>
                      )}
                    </Link>
                  </div>
                )}

                <div className="relative mb-6">
                  <div className="absolute -left-4 top-1 w-4 h-4 bg-kidgo-200 rounded-full border-2 border-white" />
                  <div className="text-xs font-bold text-kidgo-400 mb-1.5 tracking-wide">
                    12:00 – 14:00 Uhr · Mittagspause
                  </div>
                  <div className="bg-kidgo-50 border border-kidgo-100 rounded-xl p-3.5">
                    <div className="text-gray-500 text-sm">Mittagessen & Erholung</div>
                    <div className="text-gray-400 text-xs mt-0.5">Zeit zum Entspannen und Auftanken</div>
                  </div>
                </div>

                {dayPlan.afternoon && (
                  <div className="relative">
                    <div className="absolute -left-4 top-1 w-4 h-4 bg-kidgo-400 rounded-full border-2 border-white shadow-sm" />
                    <div className="text-xs font-bold text-kidgo-400 mb-1.5 tracking-wide">
                      14:00 – 16:00 Uhr · Nachmittag
                    </div>
                    <Link
                      href={`/events/${dayPlan.afternoon.id}`}
                      className="block bg-kidgo-50 border border-kidgo-100 rounded-xl p-3.5 hover:bg-kidgo-100 hover:border-kidgo-200 transition group"
                    >
                      <div className="font-bold text-gray-800 text-sm group-hover:text-kidgo-600 transition leading-snug">
                        {dayPlan.afternoon.titel}
                      </div>
                      {dayPlan.afternoon.ort && (
                        <div className="text-gray-500 text-xs mt-1">{dayPlan.afternoon.ort}</div>
                      )}
                      {dayPlan.afternoon.datum && (
                        <div className="text-gray-400 text-xs mt-0.5">{formatDateShort(dayPlan.afternoon.datum)}</div>
                      )}
                    </Link>
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerateDayPlan}
                className="mt-5 w-full py-2.5 text-sm text-kidgo-400 font-semibold border border-kidgo-200 rounded-xl hover:bg-kidgo-50 transition"
              >
                Anderen Plan generieren
              </button>
            </div>
          </div>
        )}

        {/* ===== SPRINT 6B: KÜRZLICH ANGESCHAUT ===== */}
        {recentVisits.length > 0 && !loading && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-0.5">Kürzlich angeschaut</p>
            <div
              className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
            >
              {recentVisits.slice(0, 3).map((visit) => (
                <Link
                  key={visit.id}
                  href={`/events/${visit.id}`}
                  className="flex-shrink-0 w-36 sm:w-44 group"
                >
                  <div className="w-full h-24 rounded-xl overflow-hidden bg-gray-100 mb-2">
                    {visit.kategorie_bild_url ? (
                      <img src={visit.kategorie_bild_url} alt={visit.titel} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-kidgo-100 to-kidgo-50 flex items-center justify-center">
                        <span className="text-kidgo-300 text-xs font-bold">{(visit.kategorien?.[0] || "K").slice(0, 1)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors">{visit.titel}</p>
                  {visit.datum && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(visit.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ===== SPRINT 11: NÄCHSTES EVENT COUNTDOWN ===== */}
        {bookmarks.length > 0 && !loading && (() => {
          void countdownTick; // re-render every minute
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const nextBm = bookmarks
            .filter((bm) => bm.datum)
            .map((bm) => ({ ...bm, dateObj: new Date(bm.datum! + "T00:00:00") }))
            .filter((bm) => bm.dateObj >= today)
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())[0];
          if (!nextBm) return null;
          const diffMs   = nextBm.dateObj.getTime() - now.getTime();
          const diffDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          let countdownLabel: string;
          if (diffDays === 0 && diffHours <= 0) countdownLabel = "Heute";
          else if (diffDays === 0) countdownLabel = `Heute in ${diffHours} Std.`;
          else if (diffDays === 1 && diffHours === 0) countdownLabel = "Morgen";
          else if (diffDays === 1) countdownLabel = `In 1 Tag, ${diffHours} Std.`;
          else countdownLabel = `In ${diffDays} Tagen${diffHours > 0 ? `, ${diffHours} Std.` : ""}`;
          return (
            <div className="mt-8 card-enter">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-0.5">
                Nächstes Event
              </p>
              <Link href={`/events/${nextBm.id}`} className="block group">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-kidgo-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-base leading-snug truncate group-hover:text-kidgo-500 transition-colors">
                        {nextBm.titel}
                      </p>
                      {nextBm.ort && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{nextBm.ort}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-extrabold text-kidgo-500 leading-tight">{countdownLabel}</p>
                      {nextBm.datum && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(nextBm.datum + "T00:00:00").toLocaleDateString("de-CH", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          );
        })()}

        {/* ===== SPRINT 6E: GEMERKTE EVENTS ===== */}
        {bookmarks.length > 0 && !loading && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-0.5">Gemerkte Events</p>
            <div
              className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
            >
              {bookmarks.map((bm) => (
                <Link
                  key={bm.id}
                  href={`/events/${bm.id}`}
                  className="flex-shrink-0 w-36 sm:w-44 group"
                >
                  <div className="relative w-full h-24 rounded-xl overflow-hidden bg-gray-100 mb-2">
                    {bm.kategorie_bild_url ? (
                      <img src={bm.kategorie_bild_url} alt={bm.titel} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-kidgo-100 to-kidgo-50" />
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeBookmark(bm.id); }}
                      aria-label="Merker entfernen"
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 transition"
                    >
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l6 6M8 2l-6 6"/>
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors">{bm.titel}</p>
                  {bm.datum && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(bm.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/explore"
            className="text-gray-400 hover:text-gray-600 text-sm transition underline decoration-dotted underline-offset-4"
          >
            Alle Events entdecken →
          </Link>
        </div>

        {visitCount > 0 && (
          <div className="mt-4 text-center">
            {visitCount >= 3 ? (
              <span className="text-sm text-kidgo-500 font-semibold">
                Kidgo-Entdecker — {visitCount} Events diese Woche angeschaut
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {visitCount} {visitCount === 1 ? "Event" : "Events"} diese Woche angeschaut
                {" — "}noch {3 - visitCount} bis zum Wochenend-Entdecker!
              </span>
            )}
          </div>
        )}

        {/* Kidgo in Zahlen — only show when events are loaded */}
        {!loading && allEventsPool.length > 0 && (() => {
          const now = new Date();
          const dayOfWeek = now.getDay();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          const ws = startOfWeek.toISOString().split("T")[0];
          const we = endOfWeek.toISOString().split("T")[0];
          const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
          const eventsThisWeek = allEventsPool.filter((e) => e.datum && e.datum >= ws && e.datum <= we).length;
          const newEvents = allEventsPool.filter((e) => e.created_at > oneWeekAgo).length;
          const uniqueSources = new Set(allEventsPool.map((e) => e.quelle_id).filter(Boolean)).size;
          return (
            <div className="mt-8 border-t border-gray-100 pt-6">
              <p className="text-xs text-gray-400 uppercase tracking-wider text-center mb-4 font-semibold">
                Kidgo in Zahlen
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-700">{eventsThisWeek}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">Events<br/>diese Woche</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-700">{newEvents}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">Neue<br/>Events</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-700">{uniqueSources}</p>
                  <p className="text-xs text-gray-400 mt-0.5 leading-tight">Quellen<br/>verknüpft</p>
                </div>
              </div>
            </div>
          );
        })()}

        <footer className="mt-10 border-t border-gray-100 pt-6 pb-8 text-center">
          <p className="text-xs text-gray-400 mb-2">© 2026 kidgo · Zürich</p>
          <nav aria-label="Footer-Navigation" className="flex items-center justify-center gap-4 text-xs text-gray-400">
            <Link href="/map"       className="hover:text-gray-600 transition">Karte</Link>
            <span aria-hidden="true">·</span>
            <Link href="/badges"    className="hover:text-gray-600 transition">Abzeichen</Link>
            <span aria-hidden="true">·</span>
            <Link href="/dashboard" className="hover:text-gray-600 transition">Dashboard</Link>
            <span aria-hidden="true">·</span>
            <Link href="/impressum" className="hover:text-gray-600 transition">Impressum</Link>
            <span aria-hidden="true">·</span>
            <a href="/admin"        className="hover:text-gray-500 transition">Admin</a>
          </nav>
        </footer>
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Nach oben scrollen"
          className="fixed bottom-6 right-4 z-50 bg-white border border-gray-200 shadow-md rounded-full w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:shadow-lg transition-all card-enter"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 12V4M4 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </main>
    </>
  );
}

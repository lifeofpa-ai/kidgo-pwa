"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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

const categoryEmojis: Record<string, string> = {
  Kreativ: "🎨", Natur: "🌿", Tiere: "🐾", Sport: "⚽",
  Tanz: "💃", Theater: "🎭", Musik: "🎵", "Mode & Design": "👗",
  Wissenschaft: "🔬", Bildung: "📚", Ausflug: "🗺️", Feriencamp: "🏕️",
};

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
  now: Date
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // +10: any age bucket match
  if (event.alters_buckets && selectedBuckets.some((b) => event.alters_buckets!.includes(b))) {
    score += 10;
  }

  // +5 multi-child bonus: event fits ALL selected buckets
  if (
    selectedBuckets.length > 1 &&
    event.alters_buckets &&
    selectedBuckets.every((b) => event.alters_buckets!.includes(b))
  ) {
    score += 5;
    reasons.push("👨‍👩‍👧‍👦 Passt für alle Kinder");
  }

  // Weather scoring
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

  // +5: event in next 3 days
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

  // +3: free entry
  const descLow = (event.beschreibung || "").toLowerCase();
  const titleLow = event.titel.toLowerCase();
  const isFree =
    event.preis_chf === 0 ||
    ["gratis", "kostenlos", "freier eintritt"].some(
      (kw) => descLow.includes(kw) || titleLow.includes(kw)
    );
  if (isFree) { score += 3; reasons.push("🎉 Gratis!"); }

  // +3: newly added (<7 days)
  if (
    event.created_at &&
    new Date(event.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  ) {
    score += 3;
    reasons.push("✨ Neu entdeckt");
  }

  // +3: seasonal fit
  const m = now.getMonth() + 1;
  const cats = event.kategorien || (event.kategorie ? [event.kategorie] : []);
  if (m >= 3 && m <= 5 && (event.indoor_outdoor === "outdoor" || cats.includes("Natur") || descLow.includes("natur"))) score += 3;
  if (m >= 6 && m <= 8 && (cats.some((k) => ["Sport", "Ausflug"].includes(k)) || descLow.includes("schwimm") || descLow.includes("camp") || descLow.includes("freibad"))) score += 3;
  if (m >= 9 && m <= 11 && (cats.some((k) => ["Kreativ", "Musik", "Theater"].includes(k)) || event.indoor_outdoor === "indoor" || descLow.includes("bastel") || titleLow.includes("bastel"))) score += 3;
  if ((m === 12 || m <= 2) && (descLow.includes("weihnacht") || descLow.includes("eis") || descLow.includes("advent") || cats.includes("Kreativ"))) score += 3;

  // +5: holiday camp boost
  if (isSchoolHoliday(now)) {
    const isCamp =
      event.event_typ === "camp" ||
      cats.includes("Feriencamp") ||
      descLow.includes("camp") ||
      descLow.includes("ferienlager");
    if (isCamp) { score += 5; reasons.push("🏖️ Ferientipp!"); }
  }

  // Time-of-day bonus
  const hour = now.getHours();
  if (hour >= 6 && hour < 12 && !event.datum) score += 3;
  else if (hour >= 12 && hour < 17 && event.datum && !event.datum_ende) score += 2;

  // -5: old (>30 days)
  if (
    event.created_at &&
    new Date(event.created_at) < new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  ) {
    score -= 5;
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

  // Named children: "Anna (5) und Liam (8)"
  const namedRegex = /([A-ZÄÖÜ][a-zäöüß]+)\s*\((\d+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = namedRegex.exec(query)) !== null) {
    const bucket = ageToBucket(parseInt(m[2]));
    if (bucket) {
      childNames.push({ name: m[1], bucket });
      if (!ageBuckets.includes(bucket)) ageBuckets.push(bucket);
    }
  }

  // Age numbers: "5-jährig", "mit meinem 8-Jährigen"
  if (ageBuckets.length === 0) {
    const ageNumRegex = /(\d+)\s*[-–]?\s*j[äa]hr/gi;
    while ((m = ageNumRegex.exec(query)) !== null) {
      const bucket = ageToBucket(parseInt(m[1]));
      if (bucket && !ageBuckets.includes(bucket)) ageBuckets.push(bucket);
    }
  }

  // Age keywords
  if (ageBuckets.length === 0) {
    if (/kleinkind|baby|säugling/i.test(q)) ageBuckets.push("0-3");
    if (/vorschul|kindergarten/i.test(q)) ageBuckets.push("4-6");
    if (/schulkind|grundschul/i.test(q)) ageBuckets.push("7-9");
  }

  // Indoor/outdoor
  let indoor: boolean | null = null;
  if (/regen|regnet|indoor|drinnen/i.test(q)) indoor = true;
  if (/sonne|sonnig|schönes?\s*wetter|outdoor|draußen|aussen/i.test(q)) indoor = false;

  // Date ranges
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

  // Category keywords
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

function buildChatResponse(parsed: ParsedQuery, total: number): string {
  if (total === 0) {
    return "Hmm, da habe ich gerade nichts Passendes. Versuch's mit anderen Worten oder schau in alle Events.";
  }
  const parts: string[] = [];
  if (parsed.childNames.length >= 2) {
    const names = parsed.childNames.map((c) => `${c.name} (${c.bucket})`).join(" und ");
    parts.push(`Für ${names}`);
  } else if (parsed.ageBuckets.length > 0) {
    const labels = parsed.ageBuckets
      .map((b) => AGE_BUCKETS.find((a) => a.key === b)?.label ?? b)
      .join(" und ");
    parts.push(`Für ${labels}`);
  }
  if (parsed.indoor === true) parts.push("bei Regen");
  if (parsed.indoor === false) parts.push("bei schönem Wetter");
  if (parsed.freeOnly) parts.push("gratis");
  if (parsed.keywords.length > 0) parts.push(parsed.keywords.join(" & "));
  const ctx = parts.length ? parts.join(", ") + " — " : "";
  const n = Math.min(3, total);
  return `${ctx}${n} ${n === 1 ? "Tipp" : "Tipps"} gefunden:`;
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
  weatherCode: number | null
): DayPlanResult {
  const now = new Date();
  const scored = [...events]
    .map((e) => ({ ...e, score: scoreEvent(e, selectedBuckets, weatherCode, now).score }))
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

function EventImage({
  url,
  kategorien,
  className,
}: {
  url?: string | null;
  kategorien?: string[] | null;
  className?: string;
}) {
  const [err, setErr] = useState(false);
  const cat = kategorien?.[0] || "";
  const emoji = categoryEmojis[cat] || "🎪";
  const cls = className ?? "h-48 w-full overflow-hidden";

  if (url && !err) {
    return (
      <div className={cls}>
        <img
          src={url}
          alt={cat || "Event"}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setErr(true)}
        />
      </div>
    );
  }
  return (
    <div className={`${cls} bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center`}>
      <span className="text-6xl">{emoji}</span>
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
}) {
  const source = sources.find((s) => s.id === event.quelle_id);

  let distanceLabel: string | null = null;
  if (userLocation && source?.latitude && source?.longitude) {
    const km = haversine(userLocation.lat, userLocation.lon, source.latitude, source.longitude);
    if (km < 50) distanceLabel = km < 1 ? "< 1 km entfernt" : `~${Math.round(km)} km entfernt`;
  }

  const displayReasons = [...reasons];
  if (distanceLabel && !displayReasons.some((r) => r.includes("km")))
    displayReasons.push(`📍 ${distanceLabel}`);
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
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 group-hover:border-orange-200 group-hover:-translate-y-0.5">
        <EventImage
          url={event.kategorie_bild_url}
          kategorien={event.kategorien}
          className="h-48 w-full overflow-hidden"
        />
        <div className="p-4">
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {isGeheimtipp && (
              <span className="bg-purple-50 text-purple-700 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-200">
                💎 Geheimtipp
              </span>
            )}
            {shownReasons.map((r, i) => (
              <span
                key={i}
                className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-100"
              >
                {r}
              </span>
            ))}
          </div>

          <h3 className="font-bold text-gray-900 text-lg leading-snug mb-1.5 group-hover:text-orange-600 transition-colors">
            {event.titel}
          </h3>

          {(() => {
            const badges: { label: string; cls: string }[] = [];
            if (isSeriesParent) badges.push({ label: "🔄 Regelmässig", cls: "bg-indigo-50 text-indigo-600 border border-indigo-100" });
            if (isFreeEvent(event)) {
              badges.push({ label: "🎁 Gratis", cls: "bg-green-50 text-green-700 border border-green-100" });
            } else {
              const p = extractPrice(event.beschreibung);
              if (p !== null) badges.push({ label: `💰 ab CHF ${p % 1 === 0 ? p : p.toFixed(2)}`, cls: "bg-sky-50 text-sky-600 border border-sky-100" });
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
              {event.datum && (
                <span className="flex items-center gap-1">
                  <span className="text-orange-400">📅</span>
                  {formatDateShort(event.datum)}
                </span>
              )}
              {!event.datum && (
                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                  <span>🎢</span> Ganzjährig geöffnet
                </span>
              )}
              {event.ort && (
                <span className="flex items-center gap-1 truncate max-w-[200px]">
                  <span className="text-orange-400">📍</span>
                  {event.ort}
                </span>
              )}
            </div>
            {entdeckerScore !== undefined && (
              <span className="flex-shrink-0 text-xs text-amber-500 font-medium">⭐ {entdeckerScore}/10</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Home() {
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

  // Feature 4: Streak
  const [visitCount, setVisitCount] = useState(0);

  useEffect(() => {
    setMounted(true);
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
        .select("*")
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

      // Compute source event counts for Entdecker-Score
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
        const { score, reasons } = scoreEvent(event, selectedBuckets, weatherCode, now);
        return { ...event, score, reasons };
      });

      const shuffled = [...scored].sort(() => Math.random() - 0.5);
      shuffled.sort((a, b) => b.score - a.score);

      // Ensure 1 of top 3 is a Geheimtipp if available
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

  // Feature A: Chat handler
  const handleChatQuery = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setChatInput(q);

    const parsed = parseNaturalQuery(q);
    const effectiveBuckets = parsed.ageBuckets.length > 0 ? parsed.ageBuckets : selectedBuckets;
    const parsedWithBuckets = { ...parsed, ageBuckets: effectiveBuckets };

    const pool = parsed.ageBuckets.length > 0 ? allEventsPool : allEvents;
    const filtered = filterByQuery(pool, parsedWithBuckets);

    const now = new Date();
    const scored = [...filtered]
      .map((e) => ({ ...e, score: scoreEvent(e, effectiveBuckets, weatherCode, now).score }))
      .sort(() => Math.random() - 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const message = buildChatResponse(parsedWithBuckets, filtered.length);
    setChatResult({ message, events: scored });

    setTimeout(() => {
      chatResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  };

  // Feature C: Day plan handler
  const handleGenerateDayPlan = () => {
    if (allEvents.length === 0) return;
    const plan = buildDayPlan(allEvents, selectedBuckets, weatherCode);
    setDayPlan(plan);
    setShowDayPlan(true);
    setTimeout(() => {
      document.getElementById("day-plan")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
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
      setStep("recommendations");
    }
  };

  const handleMultiChildConfirm = () => {
    if (selectedBuckets.length === 0) return;
    localStorage.setItem("kidgo_age_buckets", JSON.stringify(selectedBuckets));
    setStep("recommendations");
  };

  const handleChangeAge = () => {
    setStep("age-select");
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

  const now = new Date();
  const headline = getHeadline(now);

  if (!mounted) return null;

  // ===== STEP 1: AGE SELECTION =====
  if (step === "age-select") {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">🎪</div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Willkommen bei Kidgo</h1>
            <p className="text-gray-500 text-lg">Wie alt ist dein Kind?</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {AGE_BUCKETS.map((bucket) => {
              const selected = selectedBuckets.includes(bucket.key);
              return (
                <button
                  key={bucket.key}
                  onClick={() => handleAgeSelect(bucket.key)}
                  className={`relative p-5 rounded-2xl border-2 transition-all duration-200 text-left shadow-sm hover:shadow-md active:scale-95 ${
                    selected && multiChild
                      ? "border-orange-400 bg-orange-50 shadow-md"
                      : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/50"
                  }`}
                >
                  <div className="text-4xl mb-2">{bucket.emoji}</div>
                  <div className="font-bold text-gray-800 text-lg leading-tight">{bucket.label}</div>
                  <div className="text-gray-500 text-sm mt-0.5">{bucket.desc}</div>
                  {selected && multiChild && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center">
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
              className="w-full py-3.5 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 font-medium hover:border-orange-300 hover:text-orange-500 transition text-sm"
            >
              👨‍👩‍👧‍👦 Mehrere Kinder
            </button>
          ) : (
            <div className="space-y-2 mt-1">
              <button
                onClick={handleMultiChildConfirm}
                disabled={selectedBuckets.length === 0}
                className="w-full py-3.5 bg-orange-400 text-white rounded-2xl font-bold text-lg hover:bg-orange-500 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
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
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10">

        {/* Header */}
        <header className="mb-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-orange-500 font-semibold text-xs mb-1 uppercase tracking-wider">Kidgo</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 leading-tight">
                {headline.title}
              </h1>
              <p className="text-gray-500 mt-1 text-sm">{headline.subtitle}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              {weatherCode !== null && (
                <div className="bg-white rounded-xl px-3 py-1.5 shadow-sm text-sm text-gray-600 flex items-center gap-1.5 border border-gray-100">
                  <span>{weatherIcon(weatherCode)}</span>
                  {weatherTemp !== null && (
                    <span className="font-medium">{Math.round(weatherTemp)}°C</span>
                  )}
                </div>
              )}
              <button
                onClick={handleChangeAge}
                className="text-xs text-gray-400 hover:text-orange-500 transition"
              >
                Alter ändern
              </button>
            </div>
          </div>

          {/* Selected age badges */}
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedBuckets.map((b) => {
              const bucket = AGE_BUCKETS.find((a) => a.key === b)!;
              return (
                <span key={b} className="bg-orange-100 text-orange-700 text-sm font-medium px-3 py-1 rounded-full">
                  {bucket.emoji} {bucket.label}
                </span>
              );
            })}
          </div>

          {/* Approximate location hint */}
          {userLocation?.approximate && (
            <div className="mt-2.5 text-xs text-gray-400 flex items-start gap-1">
              <span className="mt-0.5">📍</span>
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

        {/* Feature 1: Holiday banner */}
        {isSchoolHoliday(now) && (
          <div className="mb-5 bg-gradient-to-r from-amber-400 to-orange-400 text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-md">
            <span className="text-3xl">🏖️</span>
            <div>
              <p className="font-bold text-base">Ferienzeit! Entdecke Camps und Ausflüge</p>
              <p className="text-amber-100 text-sm mt-0.5">{getActiveHoliday(now)} — Zürich</p>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-400 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Suche passende Events...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && recommendations.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-100">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-700 font-semibold mb-1">Keine aktuellen Events gefunden</p>
            <p className="text-gray-400 text-sm mb-5">Schau im Katalog nach weiteren Aktivitäten</p>
            <Link
              href="/explore"
              className="bg-orange-400 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-500 transition"
            >
              Alle Events entdecken
            </Link>
          </div>
        )}

        {/* Recommendation cards */}
        {!loading && recommendations.length > 0 && (
          <div className="space-y-4">
            {recommendations.map((event, i) => {
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
                />
              );
            })}
          </div>
        )}

        {/* ===== FEATURE A: FRAG KIDGO CHAT ===== */}
        {!loading && allEventsPool.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💬</span>
                <h2 className="font-bold text-gray-800 text-lg">Frag Kidgo</h2>
              </div>
              <p className="text-gray-400 text-sm mb-4">
                Beschreib was du suchst — ich filtere passende Events für dich
              </p>

              {/* Example chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {CHAT_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => handleChatQuery(chip)}
                    className="text-xs font-medium bg-orange-50 text-orange-600 border border-orange-200 px-3 py-1.5 rounded-full hover:bg-orange-100 hover:border-orange-300 transition active:scale-95"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Input row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChatQuery(chatInput)}
                  placeholder="Frag Kidgo..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition"
                />
                <button
                  onClick={() => handleChatQuery(chatInput)}
                  disabled={!chatInput.trim()}
                  className="bg-orange-400 text-white rounded-xl px-4 py-2.5 font-bold text-sm hover:bg-orange-500 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
                >
                  →
                </button>
              </div>
            </div>

            {/* Chat results */}
            {chatResult && (
              <div ref={chatResultRef} className="border-t border-gray-100 p-5 bg-amber-50/40">
                <p className="text-sm font-semibold text-gray-700 mb-4 flex items-start gap-2">
                  <span className="text-base mt-0.5">🤖</span>
                  <span>{chatResult.message}</span>
                </p>
                {chatResult.events.length > 0 ? (
                  <div className="space-y-3">
                    {chatResult.events.map((event, i) => (
                      <RecommendationCard
                        key={event.id}
                        event={event}
                        reasons={[]}
                        sources={sources}
                        userLocation={userLocation}
                        animIndex={i}
                        selectedBuckets={selectedBuckets}
                      />
                    ))}
                  </div>
                ) : (
                  <Link
                    href="/explore"
                    className="inline-block text-sm text-orange-500 underline underline-offset-2 hover:text-orange-600 transition"
                  >
                    Alle Events durchsuchen →
                  </Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== ACTION BUTTONS: SURPRISE + DAY PLAN ===== */}
        {!loading && allEvents.length > 0 && (
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <button
              onClick={handleSurprise}
              className="bg-white border-2 border-orange-200 text-orange-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-orange-50 hover:border-orange-400 transition shadow-sm hover:shadow-md active:scale-95"
            >
              {showSurprise ? "🎲 Nochmal!" : "🎲 Überrasch mich!"}
            </button>

            <button
              onClick={handleGenerateDayPlan}
              className="bg-white border-2 border-indigo-200 text-indigo-600 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-indigo-50 hover:border-indigo-400 transition shadow-sm hover:shadow-md active:scale-95"
            >
              📋 Plan meinen Tag
            </button>
          </div>
        )}

        {/* ===== FEATURE 1: SMART COLLECTIONS ===== */}
        {!loading && allEventsPool.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-0.5">Sammlungen</p>
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
                        ? "bg-orange-400 text-white border-orange-400 shadow-md"
                        : "bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50"
                    }`}
                  >
                    <span>{col.emoji}</span>
                    <span>{col.label}</span>
                    {count > 0 && (
                      <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${active ? "bg-white/25 text-white" : "bg-orange-100 text-orange-600"}`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Collection detail view */}
        {activeCollection && (() => {
          const col = SMART_COLLECTIONS.find((c) => c.id === activeCollection)!;
          const colNow = new Date();
          const filtered = allEventsPool.filter((e) => col.filter(e, colNow));
          return (
            <div className="mt-4 card-enter">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <span>{col.emoji}</span>
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
                <div className="space-y-4">
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
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Surprise card */}
        {showSurprise && surpriseEvent && (
          <div key={surpriseAnimKey} id="surprise-card" className="mt-5 card-enter">
            <p className="text-center text-sm font-semibold text-orange-500 mb-3">
              🎲 Zufällige Entdeckung
            </p>
            <RecommendationCard
              event={surpriseEvent}
              reasons={["🎲 Zufällig für euch ausgewählt"]}
              sources={sources}
              userLocation={userLocation}
              animIndex={0}
              selectedBuckets={selectedBuckets}
            />
          </div>
        )}

        {/* ===== FEATURE C: DAY PLAN ===== */}
        {showDayPlan && dayPlan && (dayPlan.morning || dayPlan.afternoon) && (
          <div id="day-plan" className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-enter">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <span>📋</span> Dein Tagesplan
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">Zwei abwechslungsreiche Events für euren Tag</p>
            </div>

            <div className="p-5">
              <div className="relative pl-7">
                {/* Timeline line */}
                <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-orange-300 via-amber-200 to-indigo-300 rounded-full" />

                {/* Morning slot */}
                {dayPlan.morning && (
                  <div className="relative mb-6">
                    <div className="absolute -left-4 top-1 w-4 h-4 bg-orange-400 rounded-full border-2 border-white shadow-sm" />
                    <div className="text-xs font-bold text-orange-500 mb-1.5 tracking-wide">
                      10:00 – 12:00 Uhr · Vormittag
                    </div>
                    <Link
                      href={`/events/${dayPlan.morning.id}`}
                      className="block bg-orange-50 border border-orange-100 rounded-xl p-3.5 hover:bg-orange-100 hover:border-orange-200 transition group"
                    >
                      <div className="font-bold text-gray-800 text-sm group-hover:text-orange-700 transition leading-snug">
                        {dayPlan.morning.titel}
                      </div>
                      {dayPlan.morning.ort && (
                        <div className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                          <span>📍</span>{dayPlan.morning.ort}
                        </div>
                      )}
                      {dayPlan.morning.datum && (
                        <div className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                          <span>📅</span>{formatDateShort(dayPlan.morning.datum)}
                        </div>
                      )}
                    </Link>
                  </div>
                )}

                {/* Midday break */}
                <div className="relative mb-6">
                  <div className="absolute -left-4 top-1 w-4 h-4 bg-amber-200 rounded-full border-2 border-white" />
                  <div className="text-xs font-bold text-amber-500 mb-1.5 tracking-wide">
                    12:00 – 14:00 Uhr · Mittagspause
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
                    <div className="text-gray-500 text-sm">🍕 Mittagessen & Erholung</div>
                    <div className="text-gray-400 text-xs mt-0.5">Zeit zum Entspannen und Auftanken</div>
                  </div>
                </div>

                {/* Afternoon slot */}
                {dayPlan.afternoon && (
                  <div className="relative">
                    <div className="absolute -left-4 top-1 w-4 h-4 bg-indigo-400 rounded-full border-2 border-white shadow-sm" />
                    <div className="text-xs font-bold text-indigo-500 mb-1.5 tracking-wide">
                      14:00 – 16:00 Uhr · Nachmittag
                    </div>
                    <Link
                      href={`/events/${dayPlan.afternoon.id}`}
                      className="block bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 hover:bg-indigo-100 hover:border-indigo-200 transition group"
                    >
                      <div className="font-bold text-gray-800 text-sm group-hover:text-indigo-700 transition leading-snug">
                        {dayPlan.afternoon.titel}
                      </div>
                      {dayPlan.afternoon.ort && (
                        <div className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                          <span>📍</span>{dayPlan.afternoon.ort}
                        </div>
                      )}
                      {dayPlan.afternoon.datum && (
                        <div className="text-gray-400 text-xs mt-0.5 flex items-center gap-1">
                          <span>📅</span>{formatDateShort(dayPlan.afternoon.datum)}
                        </div>
                      )}
                    </Link>
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerateDayPlan}
                className="mt-5 w-full py-2.5 text-sm text-indigo-500 font-semibold border border-indigo-200 rounded-xl hover:bg-indigo-50 transition"
              >
                🔄 Anderen Plan generieren
              </button>
            </div>
          </div>
        )}

        {/* Explore link */}
        <div className="mt-10 text-center">
          <Link
            href="/explore"
            className="text-gray-400 hover:text-gray-600 text-sm transition underline decoration-dotted underline-offset-4"
          >
            Alle Events entdecken →
          </Link>
        </div>

        {/* Feature 4: Weekly visit streak */}
        {visitCount > 0 && (
          <div className="mt-4 text-center">
            {visitCount >= 3 ? (
              <span className="text-sm text-orange-500 font-semibold">
                🔥 Du bist ein Kidgo-Entdecker! {visitCount} Events diese Woche angeschaut
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {visitCount} {visitCount === 1 ? "Event" : "Events"} diese Woche angeschaut
                {" — "}noch {3 - visitCount} bis zum Wochenend-Entdecker!
              </span>
            )}
          </div>
        )}

        <footer className="mt-6 text-center text-xs text-gray-300 pb-4">
          <a href="/admin" className="hover:text-gray-400 transition">Admin</a>
        </footer>
      </div>
    </main>
  );
}

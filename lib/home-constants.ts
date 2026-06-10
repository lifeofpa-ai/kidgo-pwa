import type { KidgoEvent, SmartCollection } from "@/types/home";

// ============================================================
// AGE BUCKETS
// ============================================================

export const AGE_BUCKETS = [
  { key: "0-3",   label: "0–3 Jahre",   emoji: "👶", desc: "Baby & Kleinkind" },
  { key: "4-6",   label: "4–6 Jahre",   emoji: "🧒", desc: "Vorschule" },
  { key: "7-9",   label: "7–9 Jahre",   emoji: "🏃", desc: "Schulkind" },
  { key: "10-12", label: "10–12 Jahre", emoji: "🔭", desc: "Entdecker" },
];

export const CHAT_CHIPS = [
  "Was machen wir heute?",
  "Indoor mit 2 Kindern",
  "Gratis am Wochenende",
  "Basteln für 5-Jährige",
];

// ============================================================
// SMART COLLECTIONS
// ============================================================

export const SMART_COLLECTIONS: SmartCollection[] = [
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

// ============================================================
// WEEKLY CHALLENGES
// ============================================================

export const WEEKLY_CHALLENGES = [
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

// ============================================================
// CATEGORY COLORS
// ============================================================

export const CATEGORY_BG_COLORS: Record<string, string> = {
  Kreativ: "#EC4899", Natur: "#22C55E", Tiere: "#22C55E", Sport: "#3B82F6",
  Tanz: "#8B5CF6", Theater: "#EF4444", Musik: "#8B5CF6", "Mode & Design": "#F43F5E",
  Wissenschaft: "#06B6D4", Bildung: "#F59E0B", Ausflug: "#14B8A6", Feriencamp: "#06B6D4",
};

export const CATEGORY_COLORS: Record<string, string> = {
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

export function getCategoryColor(kategorien: string[] | null, kategorie: string | null): string {
  const cats = kategorien ?? (kategorie ? [kategorie] : []);
  for (const c of cats) {
    if (CATEGORY_COLORS[c]) return CATEGORY_COLORS[c];
  }
  return "#5BBAA7";
}

// ============================================================
// HOLIDAY / DATE UTILITIES
// ============================================================

export const ZH_HOLIDAYS_2026 = [
  { name: "Frühlingsferien",  from: "2026-04-11", to: "2026-04-25" },
  { name: "Sommerferien",     from: "2026-07-11", to: "2026-08-15" },
  { name: "Herbstferien",     from: "2026-10-10", to: "2026-10-24" },
  { name: "Weihnachtsferien", from: "2026-12-19", to: "2027-01-02" },
];

export function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getActiveHoliday(date: Date): string | null {
  const ds = localDateStr(date);
  for (const h of ZH_HOLIDAYS_2026) {
    if (ds >= h.from && ds <= h.to) return h.name;
  }
  return null;
}

export function isSchoolHoliday(date: Date): boolean {
  return getActiveHoliday(date) !== null;
}

export function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return localDateStr(d);
}

export function getWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getUpcomingHoliday(now: Date): { name: string; daysUntil: number } | null {
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

export function getRemainingHolidayDays(now: Date): { name: string; daysLeft: number } | null {
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

export function getHeadline(now: Date): { title: string; subtitle: string } {
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

export function computeEntdeckerScore(count: number): number {
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

export function ageToBucket(age: number): string | null {
  if (age <= 3) return "0-3";
  if (age <= 6) return "4-6";
  if (age <= 9) return "7-9";
  if (age <= 12) return "10-12";
  return null;
}

// ============================================================
// EVENT / PRICE UTILITIES
// ============================================================

export function extractPrice(beschreibung: string | null): number | null {
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

export function isFreeEvent(event: KidgoEvent): boolean {
  const desc = (event.beschreibung || "").toLowerCase();
  const title = event.titel.toLowerCase();
  return (
    event.preis_chf === 0 ||
    ["gratis", "kostenlos", "freier eintritt", "free"].some(
      (kw) => desc.includes(kw) || title.includes(kw)
    )
  );
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("de-CH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function getCountdownLabel(dateStr: string, now: Date): { label: string; urgent: boolean } {
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

// ============================================================
// GEO UTILITIES
// ============================================================

export const ZH_CITIES: Record<string, [number, number]> = {
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

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

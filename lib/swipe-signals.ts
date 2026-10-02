"use client";

// ============================================================
// Swipe- & Interaktions-Signale — Kidgo lernt ohne Ablehnungsgrund (02.10.2026)
// ============================================================
// Jede Interaktion (weggewischt, gefällt, Detail geöffnet, geteilt, gemerkt,
// geplant) ist ein Signal für Merkmale des Events: Kategorie, Indoor/Outdoor,
// Preisklasse, Distanz. Das Profil bewertet pro Merkmal das VERHÄLTNIS aus
// positiven und negativen Signalen (nicht die blosse Anzahl), lässt ältere
// Signale zerfallen und greift erst ab genug Datenpunkten. Ein einzelner Swipe
// bestraft nie ein ganzes Merkmal, und nichts wird hart ausgeblendet — es
// ändert nur die Reihenfolge der Hauptansicht ("Alle Events" bleibt neutral).

import type { EventMeta } from "@/lib/dismiss-reasons";

export type SignalKind = "skip" | "like" | "open" | "share" | "plan" | "bookmark";

export interface SwipeSignal {
  eventId: string;
  kind: SignalKind;
  meta: EventMeta;
  at: string; // ISO
}

const SIGNALS_KEY = "kidgo_swipe_signals";
const MAX_SIGNALS = 500;

/** Gewicht je Signalart: negativ = weniger davon, positiv = mehr davon. */
export const SIGNAL_WEIGHTS: Record<SignalKind, number> = {
  skip: -1,
  like: 1.5,
  open: 0.5,
  share: 1.5,
  plan: 2,
  bookmark: 2,
};

/** Halbwertszeit: nach 60 Tagen zählt ein Signal nur noch halb. */
const HALF_LIFE_DAYS = 60;
/** Pseudo-Zähler: dämpft kleine Stichproben (Shrinkage). */
const SHRINKAGE = 3;
/** Mindestanzahl Signale pro Merkmal, bevor es überhaupt gewichtet wird. */
const MIN_SIGNALS_PER_FEATURE = 5;
/** Maximaler Einfluss (± Punkte) auf den Relevanz-Score. */
const MAX_EFFECT = 10;

export function getSignals(): SwipeSignal[] {
  try {
    const raw = localStorage.getItem(SIGNALS_KEY);
    const list = raw ? (JSON.parse(raw) as SwipeSignal[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordSignal(kind: SignalKind, eventId: string, meta: EventMeta): void {
  try {
    const all = getSignals();
    // Gleiche Art pro Event nur einmal pro Tag zählen (z. B. Detail mehrfach öffnen).
    const today = new Date().toISOString().slice(0, 10);
    if (all.some((s) => s.eventId === eventId && s.kind === kind && s.at.slice(0, 10) === today)) return;
    const next = [{ eventId, kind, meta, at: new Date().toISOString() }, ...all].slice(0, MAX_SIGNALS);
    localStorage.setItem(SIGNALS_KEY, JSON.stringify(next));
  } catch {}
}

/** Nimmt ein Signal zurück (Rückgängig-Toast). */
export function removeSignal(kind: SignalKind, eventId: string): void {
  try {
    const next = getSignals().filter((s) => !(s.eventId === eventId && s.kind === kind));
    localStorage.setItem(SIGNALS_KEY, JSON.stringify(next));
  } catch {}
}

export function clearSignals(): void {
  try { localStorage.removeItem(SIGNALS_KEY); } catch {}
}

export function metaFromEvent(
  event: {
    kategorien: string[] | null;
    preis_chf: number | null;
    indoor_outdoor: string | null;
    alter_von: number | null;
    alter_bis: number | null;
  },
  distanceKm: number | null = null
): EventMeta {
  return {
    kategorien: event.kategorien ?? null,
    preis_chf: event.preis_chf ?? null,
    indoor_outdoor: event.indoor_outdoor ?? null,
    alter_von: event.alter_von ?? null,
    alter_bis: event.alter_bis ?? null,
    distanceKm,
  };
}

// ------------------------------------------------------------
// Merkmale
// ------------------------------------------------------------

function priceClass(chf: number | null | undefined): string | null {
  if (chf == null) return null;
  if (chf === 0) return "price:free";
  if (chf <= 20) return "price:cheap";
  return "price:expensive";
}

function distClass(km: number | null | undefined): string | null {
  if (km == null) return null;
  if (km <= 10) return "dist:near";
  if (km <= 25) return "dist:mid";
  return "dist:far";
}

function settingClass(s: string | null | undefined): string | null {
  return s === "indoor" || s === "outdoor" ? `setting:${s}` : null;
}

function categoryFeatures(cats: string[] | null | undefined): string[] {
  return (cats ?? []).map((c) => `cat:${c}`);
}

function featuresOf(meta: {
  kategorien?: string[] | null;
  preis_chf?: number | null;
  indoor_outdoor?: string | null;
  distanceKm?: number | null;
}): string[] {
  const f = [...categoryFeatures(meta.kategorien)];
  const s = settingClass(meta.indoor_outdoor);
  const p = priceClass(meta.preis_chf);
  const d = distClass(meta.distanceKm);
  if (s) f.push(s);
  if (p) f.push(p);
  if (d) f.push(d);
  return f;
}

// ------------------------------------------------------------
// Profil
// ------------------------------------------------------------

export interface SwipeProfile {
  /** Merkmal → Affinität in [-1, 1] (0 = neutral / zu wenig Daten). */
  affinity: Record<string, number>;
  signalCount: number;
}

export function buildSwipeProfile(signals: SwipeSignal[], now: Date = new Date()): SwipeProfile | null {
  if (signals.length === 0) return null;
  const pos: Record<string, number> = {};
  const neg: Record<string, number> = {};
  const count: Record<string, number> = {};

  for (const s of signals) {
    const w = SIGNAL_WEIGHTS[s.kind];
    if (!w) continue;
    const ageDays = Math.max(0, (now.getTime() - new Date(s.at).getTime()) / 86400000);
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    for (const f of featuresOf(s.meta ?? ({} as EventMeta))) {
      count[f] = (count[f] || 0) + 1;
      if (w > 0) pos[f] = (pos[f] || 0) + w * decay;
      else neg[f] = (neg[f] || 0) + -w * decay;
    }
  }

  const affinity: Record<string, number> = {};
  for (const f of Object.keys(count)) {
    if (count[f] < MIN_SIGNALS_PER_FEATURE) continue;
    const p = pos[f] || 0;
    const n = neg[f] || 0;
    affinity[f] = (p - n) / (p + n + SHRINKAGE);
  }
  return { affinity, signalCount: signals.length };
}

/** Score-Beitrag (±MAX_EFFECT) eines Events laut Profil. */
export function swipeAffinityScore(
  event: {
    kategorien: string[] | null;
    kategorie?: string | null;
    preis_chf?: number | null;
    indoor_outdoor?: string | null;
  },
  profile: SwipeProfile,
  distanceKm: number | null = null
): number {
  const cats = event.kategorien ?? (event.kategorie ? [event.kategorie] : []);
  const catVals = categoryFeatures(cats).map((f) => profile.affinity[f] ?? 0);
  const catScore = catVals.length ? catVals.reduce((a, b) => a + b, 0) / catVals.length : 0;

  const setting = settingClass(event.indoor_outdoor);
  const price = priceClass(event.preis_chf);
  const dist = distClass(distanceKm);

  const total =
    catScore * 8 +
    (setting ? (profile.affinity[setting] ?? 0) * 2.5 : 0) +
    (price ? (profile.affinity[price] ?? 0) * 2 : 0) +
    (dist ? (profile.affinity[dist] ?? 0) * 2 : 0);

  return Math.max(-MAX_EFFECT, Math.min(MAX_EFFECT, total));
}

/** Für die Anzeige im Profil: was Kidgo bisher gelernt hat (Klartext). */
export function describeLearnings(profile: SwipeProfile | null): { more: string[]; less: string[] } {
  const more: string[] = [];
  const less: string[] = [];
  if (!profile) return { more, less };
  const label = (f: string): string | null => {
    if (f.startsWith("cat:")) return f.slice(4);
    if (f === "setting:indoor") return "Indoor";
    if (f === "setting:outdoor") return "Draussen";
    if (f === "price:free") return "Gratis";
    if (f === "price:expensive") return "Teure Events";
    if (f === "dist:far") return "Weite Wege";
    if (f === "dist:near") return "Nähe";
    return null;
  };
  for (const [f, a] of Object.entries(profile.affinity)) {
    const l = label(f);
    if (!l) continue;
    if (a >= 0.25) more.push(l);
    else if (a <= -0.25) less.push(l);
  }
  return { more, less };
}

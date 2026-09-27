import type { KidgoEvent, UserLocation } from "@/types/home";
import { isSchoolHoliday, haversine } from "@/lib/home-constants";
import { eventMatchesInterests } from "@/lib/interests";
import {
  scoreWithPreferences,
  dismissPenalty,
  type PreferenceProfile,
  type DismissProfile,
} from "@/lib/preferences";

// ============================================================
// DISTANZ — weiche Gewichtung statt harter Radius-Grenze (27.09.2026)
// ============================================================
// Event-Typen, bei denen Familien bewusst weitere Wege in Kauf nehmen
// (Ferienlager, Dauerangebote/Ausflugsziele) — der eingestellte Radius greift
// dort deutlich grosszügiger als bei spontanen Alltags-Events.
const DISTANCE_LENIENT_TYPES = new Set(["camp", "dauerangebot", "wanderung_ausnahme"]);

export interface DistanceResult {
  /** Reale Distanz in km, oder null wenn Standort/Koordinaten fehlen. */
  km: number | null;
  score: number;
  reason?: string;
}

/**
 * Distanz fliesst als Score-Faktor ein, nicht als Ausschlusskriterium: ein
 * Event knapp ausserhalb des bevorzugten Radius verschwindet nicht, es rutscht
 * nur in der Reihenfolge nach unten ("eher nah oder irrelevant statt hart
 * gefiltert" — Patricks Vorgabe). Fehlen Standort oder Koordinaten, bleibt die
 * Distanz score-neutral (0), statt Events grundlos abzuwerten.
 */
export function computeDistanceScore(
  event: Pick<KidgoEvent, "lat" | "lng" | "event_typ">,
  userLocation: UserLocation | null,
  radiusKm: number | null,
  isSun: boolean
): DistanceResult {
  if (!userLocation || !radiusKm || event.lat == null || event.lng == null) {
    return { km: null, score: 0 };
  }

  const km = haversine(userLocation.lat, userLocation.lon, Number(event.lat), Number(event.lng));

  const lenient = !!event.event_typ && DISTANCE_LENIENT_TYPES.has(event.event_typ);
  // An sonnigen Tagen sind Familien erfahrungsgemäss eher bereit, weiter zu
  // fahren — der Radius "atmet" leicht mit dem Wetter statt starr zu bleiben.
  const sunFactor = isSun ? 1.3 : 1;
  const effectiveRadius = radiusKm * (lenient ? 2.5 : 1) * sunFactor;

  if (km <= effectiveRadius * 0.4) {
    return { km, score: 6, reason: "Ganz in der Nähe" };
  }
  if (km <= effectiveRadius) {
    return { km, score: 2 };
  }

  // Jenseits der Vorliebe: zunehmend unwahrscheinlicher, nie hart auf 0.
  const over = km - effectiveRadius;
  const decayRangeKm = lenient ? 60 : 25;
  const penalty = Math.min(9, (over / decayRangeKm) * 9);
  return { km, score: -penalty };
}

export function scoreEvent(
  event: KidgoEvent,
  selectedBuckets: string[],
  weatherCode: number | null,
  now: Date,
  interests: string[] = [],
  profile: PreferenceProfile | null = null,
  dProfile: DismissProfile | null = null,
  userLocation: UserLocation | null = null,
  radiusKm: number | null = null
): { score: number; reasons: string[]; distanceKm: number | null } {
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

  const distance = computeDistanceScore(event, userLocation, radiusKm, isSun);
  score += distance.score;
  if (distance.reason) reasons.push(distance.reason);

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

  return { score, reasons, distanceKm: distance.km };
}

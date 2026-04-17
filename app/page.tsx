"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

// --- Types ---
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

// --- Age Buckets ---
const AGE_BUCKETS = [
  { key: "0-3",   label: "0–3 Jahre",   emoji: "👶", desc: "Baby & Kleinkind" },
  { key: "4-6",   label: "4–6 Jahre",   emoji: "🧒", desc: "Vorschule" },
  { key: "7-9",   label: "7–9 Jahre",   emoji: "🏃", desc: "Schulkind" },
  { key: "10-12", label: "10–12 Jahre", emoji: "🔭", desc: "Entdecker" },
];

// --- Zürich school holidays ---
function isSchoolHoliday(date: Date): boolean {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return (
    (m === 4 && d >= 11 && d <= 25) ||
    (m === 7 && d >= 11) ||
    (m === 8 && d <= 15) ||
    (m === 10 && d >= 10 && d <= 24) ||
    (m === 12 && d >= 19) ||
    (m === 1 && d <= 2)
  );
}

// --- Dynamic headline based on time/day ---
function getHeadline(now: Date): { title: string; subtitle: string } {
  const dow = now.getDay(); // 0=Sun, 6=Sat
  const h = now.getHours();

  if (isSchoolHoliday(now)) {
    return {
      title: "Ferientipp für euch",
      subtitle: "Schulferien — Zeit für Abenteuer!",
    };
  }
  if (dow === 6 || dow === 0 || (dow === 5 && h >= 15)) {
    return {
      title: "Dieses Wochenende für euch",
      subtitle: "Passend ausgewählt für dein Kind",
    };
  }
  if (dow === 3 && h >= 12) {
    return {
      title: "Mittwochnachmittag-Tipp",
      subtitle: "Heute Nachmittag was Tolles unternehmen",
    };
  }
  return {
    title: "Heute für euch",
    subtitle: "Passend ausgewählt für dein Kind",
  };
}

// --- Weather icon ---
function weatherIcon(code: number): string {
  if (code >= 80) return "⛈️";
  if (code >= 61) return "🌧️";
  if (code >= 51) return "🌦️";
  if (code >= 3)  return "⛅";
  return "☀️";
}

// --- Score a single event ---
function scoreEvent(
  event: KidgoEvent,
  selectedBuckets: string[],
  weatherCode: number | null,
  now: Date
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // +10: age bucket matches
  if (
    event.alters_buckets &&
    selectedBuckets.some((b) => event.alters_buckets!.includes(b))
  ) {
    score += 10;
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
    const diffMs = eventDate.getTime() - today.getTime();
    const diff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
  if (isFree) {
    score += 3;
    reasons.push("🎉 Gratis!");
  }

  // +3: newly added (< 7 days)
  if (
    event.created_at &&
    new Date(event.created_at) >
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  ) {
    score += 3;
    reasons.push("✨ Neu entdeckt");
  }

  // +2: seasonal fit
  const m = now.getMonth() + 1;
  const cats = event.kategorien || (event.kategorie ? [event.kategorie] : []);
  if (
    m >= 3 && m <= 5 &&
    (event.indoor_outdoor === "outdoor" || cats.includes("Natur") || descLow.includes("natur"))
  ) score += 2;
  if (
    m >= 6 && m <= 8 &&
    (cats.some((k) => ["Sport", "Ausflug"].includes(k)) || descLow.includes("schwimm") || descLow.includes("camp"))
  ) score += 2;
  if (
    m >= 9 && m <= 11 &&
    (cats.some((k) => ["Kreativ", "Musik", "Theater"].includes(k)) || event.indoor_outdoor === "indoor")
  ) score += 2;
  if (
    (m === 12 || m === 1) &&
    (descLow.includes("weihnacht") || descLow.includes("eis") || cats.includes("Kreativ"))
  ) score += 2;

  // -5: old (> 30 days, freshness decay)
  if (
    event.created_at &&
    new Date(event.created_at) <
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  ) {
    score -= 5;
  }

  return { score, reasons };
}

// --- Haversine distance in km ---
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

// --- Category visuals ---
const categoryEmojis: Record<string, string> = {
  Kreativ: "🎨", Natur: "🌿", Tiere: "🐾", Sport: "⚽",
  Tanz: "💃", Theater: "🎭", Musik: "🎵", "Mode & Design": "👗",
  Wissenschaft: "🔬", Bildung: "📚", Ausflug: "🗺️", Feriencamp: "🏕️",
};

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
    <div
      className={`${cls} bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center`}
    >
      <span className="text-6xl">{emoji}</span>
    </div>
  );
}

// --- Format date short ---
function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("de-CH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// ===== RECOMMENDATION CARD =====
function RecommendationCard({
  event,
  reasons,
  sources,
  userLocation,
  animIndex,
}: {
  event: KidgoEvent;
  reasons: string[];
  sources: { id: string; url: string | null; latitude: number | null; longitude: number | null }[];
  userLocation: { lat: number; lon: number; approximate: boolean } | null;
  animIndex: number;
}) {
  const source = sources.find((s) => s.id === event.quelle_id);

  // Distance label
  let distanceLabel: string | null = null;
  if (userLocation && source?.latitude && source?.longitude) {
    const km = haversine(
      userLocation.lat, userLocation.lon,
      source.latitude, source.longitude
    );
    if (km < 50) {
      distanceLabel = km < 1 ? "< 1 km entfernt" : `~${Math.round(km)} km entfernt`;
    }
  }

  const displayReasons = [...reasons];
  if (distanceLabel && !displayReasons.some((r) => r.includes("km"))) {
    displayReasons.push(`📍 ${distanceLabel}`);
  }
  const shownReasons = displayReasons.slice(0, 2);

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
          {shownReasons.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {shownReasons.map((r, i) => (
                <span
                  key={i}
                  className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-100"
                >
                  {r}
                </span>
              ))}
            </div>
          )}

          <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2 group-hover:text-orange-600 transition-colors">
            {event.titel}
          </h3>

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
        </div>
      </div>
    </Link>
  );
}

// ===== MAIN COMPONENT =====
export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<"age-select" | "recommendations">("age-select");
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([]);
  const [multiChild, setMultiChild] = useState(false);

  const [allEvents, setAllEvents] = useState<KidgoEvent[]>([]);
  const [recommendations, setRecommendations] = useState<ScoredEvent[]>([]);
  const [surpriseEvent, setSurpriseEvent] = useState<KidgoEvent | null>(null);
  const [showSurprise, setShowSurprise] = useState(false);
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

  // Restore age from localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("kidgo_age_buckets");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedBuckets(parsed);
          setStep("recommendations");
        }
      }
    } catch {}
  }, []);

  // Fetch weather
  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=47.37&longitude=8.54&current=weather_code,temperature_2m"
    )
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.current?.weather_code === "number")
          setWeatherCode(d.current.weather_code);
        if (typeof d?.current?.temperature_2m === "number")
          setWeatherTemp(d.current.temperature_2m);
      })
      .catch(() => {});
  }, []);

  // Get user location
  useEffect(() => {
    if (!mounted) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Dein Standort",
          approximate: false,
        });
      },
      () => {
        fetch("https://ipapi.co/json/")
          .then((r) => r.json())
          .then((d) => {
            if (d.latitude && d.longitude) {
              setUserLocation({
                lat: parseFloat(d.latitude),
                lon: parseFloat(d.longitude),
                label: d.city || "Zürich",
                approximate: true,
              });
            }
          })
          .catch(() => {});
      },
      { timeout: 5000 }
    );
  }, [mounted]);

  // Fetch and score events when entering recommendations step
  useEffect(() => {
    if (step !== "recommendations" || selectedBuckets.length === 0) return;
    fetchAndScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedBuckets, weatherCode]);

  const fetchAndScore = async () => {
    setLoading(true);
    setSurpriseEvent(null);
    setShowSurprise(false);
    try {
      const todayStr = new Date().toISOString().split("T")[0];

      const { data: sourcesData } = await supabase
        .from("quellen")
        .select("id, url, latitude, longitude");
      setSources(sourcesData || []);

      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .eq("status", "approved")
        .is("serie_id", null)
        .or(`datum.is.null,datum.gte.${todayStr}`)
        .order("datum", { ascending: true, nullsFirst: false });

      if (!eventsData || eventsData.length === 0) {
        setAllEvents([]);
        setRecommendations([]);
        setLoading(false);
        return;
      }

      // Filter to events matching selected age buckets
      const ageFiltered = eventsData.filter(
        (e) =>
          !e.alters_buckets ||
          e.alters_buckets.length === 0 ||
          selectedBuckets.some((b) => e.alters_buckets.includes(b))
      );

      setAllEvents(ageFiltered);

      const now = new Date();
      const scored: ScoredEvent[] = ageFiltered.map((event) => {
        const { score, reasons } = scoreEvent(
          event,
          selectedBuckets,
          weatherCode,
          now
        );
        return { ...event, score, reasons };
      });

      // Shuffle ties randomly, then sort by score descending
      const shuffled = [...scored].sort(() => Math.random() - 0.5);
      shuffled.sort((a, b) => b.score - a.score);
      setRecommendations(shuffled.slice(0, 3));
    } catch (e) {
      console.error("Fehler beim Laden der Empfehlungen:", e);
    }
    setLoading(false);
  };

  const handleAgeSelect = (bucket: string) => {
    if (multiChild) {
      setSelectedBuckets((prev) =>
        prev.includes(bucket)
          ? prev.filter((b) => b !== bucket)
          : [...prev, bucket]
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
    setSurpriseEvent(null);
    setShowSurprise(false);
    localStorage.removeItem("kidgo_age_buckets");
  };

  const handleSurprise = () => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const in14Str = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const pool = allEvents.filter(
      (e) => e.datum && e.datum >= todayStr && e.datum <= in14Str
    );
    const source = pool.length > 0 ? pool : allEvents;
    const picked = source[Math.floor(Math.random() * source.length)];
    setSurpriseEvent(picked || null);
    setShowSurprise(true);
    setTimeout(() => {
      document
        .getElementById("surprise-card")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Willkommen bei Kidgo
            </h1>
            <p className="text-gray-500 text-lg">
              Wie alt ist dein Kind?
            </p>
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
                  <div className="font-bold text-gray-800 text-lg leading-tight">
                    {bucket.label}
                  </div>
                  <div className="text-gray-500 text-sm mt-0.5">
                    {bucket.desc}
                  </div>
                  {selected && multiChild && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
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
              <p className="text-orange-500 font-semibold text-xs mb-1 uppercase tracking-wider">
                Kidgo
              </p>
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
                <span
                  key={b}
                  className="bg-orange-100 text-orange-700 text-sm font-medium px-3 py-1 rounded-full"
                >
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
            <p className="text-gray-700 font-semibold mb-1">
              Keine aktuellen Events gefunden
            </p>
            <p className="text-gray-400 text-sm mb-5">
              Schau im Katalog nach weiteren Aktivitäten
            </p>
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
            {recommendations.map((event, i) => (
              <RecommendationCard
                key={event.id}
                event={event}
                reasons={event.reasons}
                sources={sources}
                userLocation={userLocation}
                animIndex={i}
              />
            ))}
          </div>
        )}

        {/* Surprise me button */}
        {!loading && allEvents.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={handleSurprise}
              className="bg-white border-2 border-orange-200 text-orange-600 px-8 py-3.5 rounded-2xl font-bold text-base hover:bg-orange-50 hover:border-orange-400 transition shadow-sm hover:shadow-md active:scale-95"
            >
              🎲 Überrasch mich!
            </button>
          </div>
        )}

        {/* Surprise card */}
        {showSurprise && surpriseEvent && (
          <div id="surprise-card" className="mt-5 card-enter">
            <p className="text-center text-sm font-semibold text-orange-500 mb-3">
              🎲 Zufällige Entdeckung
            </p>
            <RecommendationCard
              event={surpriseEvent}
              reasons={["🎲 Zufällig für euch ausgewählt"]}
              sources={sources}
              userLocation={userLocation}
              animIndex={0}
            />
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

        <footer className="mt-6 text-center text-xs text-gray-300 pb-4">
          <a href="/admin" className="hover:text-gray-400 transition">
            Admin
          </a>
        </footer>
      </div>
    </main>
  );
}

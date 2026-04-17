"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

const PAGE_SIZE = 15;

function applyWeatherSort(evts: any[], badWeather: boolean): any[] {
  const rank = (v: string | null | undefined): number => {
    if (badWeather) {
      if (v === "indoor") return 0;
      if (v === "beides") return 1;
      if (!v) return 2;
      return 3;
    } else {
      if (v === "outdoor") return 0;
      if (v === "beides") return 1;
      if (!v) return 2;
      return 3;
    }
  };
  return [...evts].sort((a, b) => {
    if (a.datum && b.datum) {
      const dateDiff = a.datum.localeCompare(b.datum);
      if (dateDiff !== 0) return dateDiff;
    }
    return rank(a.indoor_outdoor) - rank(b.indoor_outdoor);
  });
}

const categoryEmojis: Record<string, string> = {
  "Kreativ": "🎨", "Natur": "🌿", "Tiere": "🐾", "Sport": "⚽",
  "Tanz": "💃", "Theater": "🎭", "Musik": "🎵", "Mode & Design": "👗",
  "Wissenschaft": "🔬", "Bildung": "📚", "Ausflug": "🗺️", "Feriencamp": "🏕️",
};

const categoryColors: Record<string, string> = {
  "Kreativ": "bg-pink-100 text-pink-600",
  "Natur": "bg-green-100 text-green-600",
  "Tiere": "bg-yellow-100 text-yellow-600",
  "Sport": "bg-blue-100 text-blue-600",
  "Tanz": "bg-purple-100 text-purple-600",
  "Theater": "bg-red-100 text-red-600",
  "Musik": "bg-indigo-100 text-indigo-600",
  "Mode & Design": "bg-rose-100 text-rose-600",
  "Wissenschaft": "bg-cyan-100 text-cyan-600",
  "Bildung": "bg-orange-100 text-orange-600",
  "Ausflug": "bg-teal-100 text-teal-600",
  "Feriencamp": "bg-amber-100 text-amber-600",
};

function CategoryImage({
  url,
  kategorien,
  containerClassName,
}: {
  url?: string | null;
  kategorien?: string[];
  containerClassName?: string;
}) {
  const [imgError, setImgError] = useState(false);
  const cat = kategorien?.[0] || "";
  const emoji = categoryEmojis[cat] || "🎪";
  const colors = categoryColors[cat] || "bg-indigo-100 text-indigo-600";
  const containerClass =
    containerClassName ?? "h-36 -mx-4 -mt-4 mb-3 rounded-t-lg overflow-hidden";

  if (url && !imgError) {
    return (
      <div className={containerClass}>
        <img
          src={url}
          alt={cat || "Event"}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  return (
    <div className={`${containerClass} flex items-center justify-center ${colors}`}>
      <span className="text-6xl">{emoji}</span>
    </div>
  );
}

export default function ExplorePage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "weekend" | "week" | "month">("all");
  const [serienCounts, setSerienCounts] = useState<Record<string, number>>({});
  const [visibleCountFuture, setVisibleCountFuture] = useState(PAGE_SIZE);
  const [visibleCountAllYear, setVisibleCountAllYear] = useState(PAGE_SIZE);
  const [selectedAgeBuckets, setSelectedAgeBuckets] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=47.37&longitude=8.54&current=weather_code,temperature_2m"
    )
      .then((res) => res.json())
      .then((data) => {
        const code = data?.current?.weather_code;
        if (typeof code === "number") setWeatherCode(code);
      })
      .catch(() => {});
  }, []);

  const categories = [
    "Kreativ", "Natur", "Tiere", "Sport", "Tanz",
    "Theater", "Musik", "Mode & Design", "Wissenschaft", "Bildung", "Ausflug", "Feriencamp",
  ];

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    setEvents([]);
    setSources([]);
    setVisibleCountFuture(PAGE_SIZE);
    setVisibleCountAllYear(PAGE_SIZE);

    try {
      const { data: sourcesData, error: sourcesError } = await supabase
        .from("quellen")
        .select("*");
      if (sourcesError) throw sourcesError;
      setSources(sourcesData || []);

      let eventsQuery = supabase.from("events").select("*");

      if (selectedCategories.length > 0) {
        eventsQuery = eventsQuery.overlaps("kategorien", selectedCategories);
      }
      if (search.trim()) {
        eventsQuery = eventsQuery.or(
          `titel.ilike.%${search}%,ort.ilike.%${search}%`
        );
      }
      if (selectedAgeBuckets.length > 0) {
        eventsQuery = eventsQuery.overlaps("alters_buckets", selectedAgeBuckets);
      }

      eventsQuery = eventsQuery.is("serie_id", null);

      const todayStr = new Date().toISOString().split("T")[0];
      eventsQuery = eventsQuery.or(
        `datum.is.null,datum.gte.${todayStr},datum_ende.gte.${todayStr}`
      );

      const { data: serienData } = await supabase
        .from("events")
        .select("serie_id")
        .not("serie_id", "is", null);
      const counts: Record<string, number> = {};
      serienData?.forEach((e) => {
        if (e.serie_id) counts[e.serie_id] = (counts[e.serie_id] || 0) + 1;
      });
      setSerienCounts(counts);

      const { data: allEvents, error: eventsError } = await eventsQuery.order(
        "datum",
        { ascending: true, nullsFirst: true }
      );
      if (eventsError) throw eventsError;
      if (allEvents) setEvents(allEvents);
    } catch (err) {
      console.error("Fehler bei Suche:", err);
      setError("Unerwarteter Fehler bei der Suche");
      setEvents([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!mounted) return;
    setVisibleCountFuture(PAGE_SIZE);
    setVisibleCountAllYear(PAGE_SIZE);
    const timer = setTimeout(() => handleSearch(), search ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, selectedCategories, dateFilter, search, selectedAgeBuckets]);

  const formatDate = (dateStr: string, dateEndStr?: string | null) => {
    const date = new Date(dateStr + "T00:00:00");
    if (dateEndStr) {
      const dateEnd = new Date(dateEndStr + "T00:00:00");
      const startFormatted = date.toLocaleDateString("de-CH", { day: "numeric", month: "short" });
      const endFormatted = dateEnd.toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" });
      return `${startFormatted} – ${endFormatted}`;
    }
    return date.toLocaleDateString("de-CH", {
      weekday: "short", day: "numeric", month: "long", year: "numeric",
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Back link */}
        <div className="mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-medium transition text-sm"
          >
            ← Zurück zu meinen Empfehlungen
          </Link>
        </div>

        {/* Search Section */}
        <section className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-3">
          <h2 className="text-xl font-bold text-gray-800 mb-4">🗺️ Alle Events entdecken</h2>
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔍 Event-Name oder Ort:
            </label>
            <input
              type="text"
              placeholder="z.B. 'Sport', 'Zürich', 'Schwimmen'..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          <div className="mb-3">
            <div className="flex flex-wrap gap-2 items-center">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setSelectedCategories((prev) =>
                      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                    )
                  }
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex-shrink-0 ${
                    selectedCategories.includes(cat)
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {categoryEmojis[cat] ? `${categoryEmojis[cat]} ` : ""}{cat}
                </button>
              ))}
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-600 transition"
                >
                  ✕ Alle Kategorien
                </button>
              )}
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "⏳ Lädt..." : "✅ Suchen"}
          </button>
        </section>

        {/* Date Quick Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {[
            { key: "all",     label: "📅 Alle Daten" },
            { key: "today",   label: "☀️ Heute" },
            { key: "weekend", label: "🏖️ Wochenende" },
            { key: "week",    label: "🗓️ Diese Woche" },
            { key: "month",   label: "📆 Diesen Monat" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key as typeof dateFilter)}
              className={`px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex-shrink-0 ${
                dateFilter === key
                  ? "bg-indigo-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Age Bucket Filter */}
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">👶 Alter:</span>
          {[
            { key: "0-3",   label: "0–3 J.",   title: "Babys & Kleinkinder" },
            { key: "4-6",   label: "4–6 J.",   title: "Vorschule" },
            { key: "7-9",   label: "7–9 J.",   title: "Unterstufe" },
            { key: "10-12", label: "10–12 J.", title: "Mittelstufe" },
          ].map(({ key, label, title }) => (
            <button
              key={key}
              title={title}
              onClick={() =>
                setSelectedAgeBuckets((prev) =>
                  prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key]
                )
              }
              className={`px-2 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition flex-shrink-0 ${
                selectedAgeBuckets.includes(key)
                  ? "bg-purple-600 text-white shadow"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
          {selectedAgeBuckets.length > 0 && (
            <button
              onClick={() => setSelectedAgeBuckets([])}
              className="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-600 transition"
            >
              ✕ Alle Altersgruppen
            </button>
          )}
        </div>

        {/* Results */}
        <section className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="mb-4">
            <h3 className="text-2xl font-bold">
              🗓️ Events {events.length > 0 && `(${events.length})`}
            </h3>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">⏳ Events werden geladen...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg mb-4">
                {search || selectedCategories.length > 0
                  ? "😢 Keine Events gefunden"
                  : "🎯 Nutze die Suchfunktion oben, um Events zu finden!"}
              </p>
            </div>
          ) : (
            (() => {
              const now2 = new Date();
              now2.setHours(0, 0, 0, 0);
              const endOfWeek = new Date(now2); endOfWeek.setDate(now2.getDate() + 7);
              const endOfMonth = new Date(now2); endOfMonth.setDate(now2.getDate() + 30);

              const dateFiltered = events.filter((e) => {
                if (!e.datum || dateFilter === "all") return true;
                const d = new Date(e.datum + "T00:00:00");
                if (dateFilter === "today") return d >= now2 && d <= now2;
                if (dateFilter === "weekend") {
                  const dayOfWeek = now2.getDay();
                  const daysUntilSat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
                  const daysUntilSun = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
                  const nextSat = new Date(now2); nextSat.setDate(now2.getDate() + daysUntilSat);
                  const nextSun = new Date(now2); nextSun.setDate(now2.getDate() + daysUntilSun);
                  return d >= nextSat && d <= nextSun;
                }
                if (dateFilter === "week") return d <= endOfWeek;
                if (dateFilter === "month") return d <= endOfMonth;
                return true;
              });

              const isBadWeather = weatherCode !== null && weatherCode >= 51;
              const futureEvents = applyWeatherSort(
                dateFiltered.filter((e) => e.datum),
                isBadWeather
              );
              const allYearActivities = applyWeatherSort(
                dateFiltered.filter((e) => !e.datum),
                isBadWeather
              );

              const getSource = (sourceId: string) =>
                sources.find((s) => s.id === sourceId);

              return (
                <>
                  {futureEvents.length > 0 && (
                    <div className="mb-8">
                      <h4 className="text-xl font-bold text-indigo-600 mb-4">
                        🗓️ Anstehende Events ({futureEvents.length})
                      </h4>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {futureEvents.slice(0, visibleCountFuture).map((event: any) => {
                          const source = getSource(event.quelle_id);
                          return (
                            <div
                              key={event.id}
                              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer hover:border-indigo-400 relative group bg-gradient-to-br from-blue-50 to-white"
                            >
                              <CategoryImage url={event.kategorie_bild_url} kategorien={event.kategorien} />
                              {event.created_at &&
                                new Date(event.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && (
                                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded mb-1">
                                    ✨ Neu
                                  </span>
                                )}
                              <Link
                                href={`/events/${event.id}`}
                                className="block hover:text-indigo-600 transition"
                              >
                                <h5 className="font-bold text-lg mb-2 text-gray-900 pr-8">
                                  {event.titel}
                                </h5>
                              </Link>
                              <p className="text-sm font-semibold text-indigo-600 mb-1">
                                📅 {formatDate(event.datum, event.datum_ende)}
                              </p>
                              {serienCounts[event.id] ? (
                                <p className="text-xs text-indigo-400 mb-1">
                                  🔄 +{serienCounts[event.id]} weitere Termine
                                </p>
                              ) : null}
                              {event.ort && (
                                <p className="text-sm text-gray-700 mb-2">📍 {event.ort}</p>
                              )}
                              {event.event_typ === "camp" && (
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                                  🏕️ Camp
                                </span>
                              )}
                              {event.kategorien?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {event.kategorien.slice(0, 2).map((cat: string) => (
                                    <span key={cat} className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-1 rounded">
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {event.altersgruppen?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {event.altersgruppen.map((ag: string) => (
                                    <span key={ag} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                      👶 {ag}{!ag.includes("Jahr") && " Jahre"}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {event.preis_chf != null && (
                                <p className="text-xs text-gray-600 mb-2">
                                  {event.preis_chf === 0 ? (
                                    <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                                      🎉 Kostenlos
                                    </span>
                                  ) : (
                                    <>💰 CHF {event.preis_chf}</>
                                  )}
                                </p>
                              )}
                              {event.beschreibung && (
                                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{event.beschreibung}</p>
                              )}
                              {(event.anmelde_link || source?.url) && (
                                <div className="flex gap-2 flex-wrap mt-2">
                                  <a
                                    href={event.anmelde_link || source?.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                                  >
                                    🌐 Zur Webseite
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {visibleCountFuture < futureEvents.length && (
                        <div className="text-center mt-6">
                          <button
                            onClick={() => setVisibleCountFuture((v) => v + PAGE_SIZE)}
                            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
                          >
                            ⬇️ Mehr laden ({futureEvents.length - visibleCountFuture} weitere)
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {allYearActivities.length > 0 && (
                    <div className="mb-8">
                      <h4 className="text-xl font-bold text-green-600 mb-4">
                        🎢 Ganzjährig geöffnet ({allYearActivities.length})
                      </h4>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {allYearActivities.slice(0, visibleCountAllYear).map((activity: any) => {
                          const source = getSource(activity.quelle_id);
                          return (
                            <div
                              key={activity.id}
                              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer hover:border-green-400 relative group bg-gradient-to-br from-green-50 to-white"
                            >
                              <CategoryImage url={activity.kategorie_bild_url} kategorien={activity.kategorien} />
                              {activity.created_at &&
                                new Date(activity.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) && (
                                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded mb-1">
                                    ✨ Neu
                                  </span>
                                )}
                              <Link
                                href={`/events/${activity.id}`}
                                className="block hover:text-green-700 transition"
                              >
                                <h5 className="font-bold text-lg mb-2 text-gray-900 pr-8">
                                  {activity.titel}
                                </h5>
                              </Link>
                              {activity.ort && (
                                <p className="text-sm text-gray-700 mb-2">📍 {activity.ort}</p>
                              )}
                              {activity.kategorien?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {activity.kategorien.slice(0, 2).map((cat: string) => (
                                    <span key={cat} className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {activity.altersgruppen?.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {activity.altersgruppen.map((ag: string) => (
                                    <span key={ag} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                                      👶 {ag}{!ag.includes("Jahr") && " Jahre"}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {activity.preis_chf != null && (
                                <p className="text-xs text-gray-600 mb-2">
                                  {activity.preis_chf === 0 ? (
                                    <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">
                                      🎉 Kostenlos
                                    </span>
                                  ) : (
                                    <>💰 CHF {activity.preis_chf}</>
                                  )}
                                </p>
                              )}
                              {activity.beschreibung && (
                                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{activity.beschreibung}</p>
                              )}
                              {(activity.anmelde_link || source?.url) && (
                                <div className="flex gap-2 flex-wrap mt-2">
                                  <a
                                    href={activity.anmelde_link || source?.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
                                  >
                                    🌐 Zur Webseite
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {visibleCountAllYear < allYearActivities.length && (
                        <div className="text-center mt-6">
                          <button
                            onClick={() => setVisibleCountAllYear((v) => v + PAGE_SIZE)}
                            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition"
                          >
                            ⬇️ Mehr laden ({allYearActivities.length - visibleCountAllYear} weitere)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()
          )}
        </section>

        <footer className="mt-12 text-center text-gray-600 text-sm">
          <p>🚀 Kidgo PWA – Alpha Version | Powered by Next.js + Supabase</p>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            <a href="/admin" className="text-gray-400 hover:underline">🛠️ Admin</a>
            <Link href="/" className="text-gray-400 hover:underline">← Zurück zu meinen Empfehlungen</Link>
          </div>
        </footer>
      </div>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-4 z-50 bg-indigo-600 text-white rounded-full w-11 h-11 flex items-center justify-center shadow-lg hover:bg-indigo-700 transition"
          title="Nach oben"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      )}
    </main>
  );
}

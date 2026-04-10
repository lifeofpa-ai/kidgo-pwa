"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getFavorites, toggleFavorite, isFavorite } from "@/lib/favorites";
import Link from "next/link";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-200 rounded-lg animate-pulse" />,
});

const PAGE_SIZE = 15;

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

function CategoryImage({ url, kategorien }: { url?: string | null; kategorien?: string[] }) {
  const [imgError, setImgError] = useState(false);
  const cat = kategorien?.[0] || "";
  const emoji = categoryEmojis[cat] || "🎪";
  const colors = categoryColors[cat] || "bg-indigo-100 text-indigo-600";

  if (url && !imgError) {
    return (
      <div className="h-36 -mx-4 -mt-4 mb-3 rounded-t-lg overflow-hidden">
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
    <div className={`h-36 -mx-4 -mt-4 mb-3 rounded-t-lg overflow-hidden flex items-center justify-center ${colors}`}>
      <span className="text-6xl">{emoji}</span>
    </div>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alle");
  const [sources, setSources] = useState<any[]>([]); // Quellen für Link-Buttons
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "weekend" | "week" | "month">("all");
  const [eventType, setEventType] = useState<"all" | "event" | "camp">("all");
  const [serienCounts, setSerienCounts] = useState<Record<string, number>>({});
  const [visibleCountFuture, setVisibleCountFuture] = useState(PAGE_SIZE);
  const [visibleCountAllYear, setVisibleCountAllYear] = useState(PAGE_SIZE);

  useEffect(() => {
    setMounted(true);
    setFavorites(getFavorites());
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const categories = [
    "Alle", "Kreativ", "Natur", "Tiere", "Sport", "Tanz",
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
      // 1. Fetch all Quellen (for linking)
      const { data: sourcesData, error: sourcesError } = await supabase
        .from("quellen")
        .select("*");

      if (sourcesError) throw sourcesError;
      setSources(sourcesData || []);

      // 2. Fetch Events with filtering
      let eventsQuery = supabase.from("events").select("*");

      // Filter by category if not "Alle"
      if (category !== "Alle") {
        eventsQuery = eventsQuery.contains("kategorien", [category]);
      }

      // Filter by event type
      if (eventType !== "all") {
        eventsQuery = eventsQuery.eq("event_typ", eventType);
      }

      // Filter by search text if provided
      if (search.trim()) {
        eventsQuery = eventsQuery.or(
          `titel.ilike.%${search}%,ort.ilike.%${search}%`
        );
      }

      // Only load main events (Einzel-Events + Haupt-Events von Serien)
      eventsQuery = eventsQuery.is("serie_id", null);

      // C) Filter past events server-side: only future events or all-year (datum IS NULL)
      const todayStr = new Date().toISOString().split("T")[0];
      eventsQuery = eventsQuery.or(
        `datum.is.null,datum.gte.${todayStr},datum_ende.gte.${todayStr}`
      );

      // Load serie counts (how many follow-up events per main event)
      const { data: serienData } = await supabase
        .from("events")
        .select("serie_id")
        .not("serie_id", "is", null);
      const counts: Record<string, number> = {};
      serienData?.forEach((e) => {
        if (e.serie_id) counts[e.serie_id] = (counts[e.serie_id] || 0) + 1;
      });
      setSerienCounts(counts);

      // Fetch all events first, then filter in-memory for date range
      const { data: allEvents, error: eventsError } = await eventsQuery.order(
        "datum",
        { ascending: true, nullsFirst: true }
      );

      if (eventsError) throw eventsError;

      if (allEvents) {
        setEvents(allEvents);
        console.log(`Gefunden: ${allEvents.length} Events`);
      }
    } catch (error) {
      console.error("Fehler bei Suche:", error);
      setError("Unerwarteter Fehler bei der Suche");
      setEvents([]);
    }

    setLoading(false);
  };

  // Auto-search on mount and whenever filters change; debounce only for free-text search
  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      handleSearch();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, category, dateFilter, eventType, search]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Hero Section */}
        <section className="text-center mb-3 pt-4 pb-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
            🎪 Entdecke Events für deine Kinder
          </h2>
          <p className="text-sm text-gray-500">
            Finde die besten Aktivitäten in der Region Zürich
          </p>
        </section>

        {/* Search Section */}
        <section className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-3">
          {/* Search Input */}
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

          {/* Category Filter */}
          <div className="mb-3 sticky top-2 bg-white z-10 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kategorie:
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-4 py-2 rounded-lg font-medium transition transform hover:scale-105 ${
                    category === cat
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {categoryEmojis[cat] ? `${categoryEmojis[cat]} ` : ""}{cat}
                </button>
              ))}
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "⏳ Lädt..." : "✅ Suchen"}
          </button>
        </section>

        {/* Event Type Tabs */}
        <div className="flex gap-2 mb-2">
          {[
            { key: "all", label: "📌 Alle" },
            { key: "event", label: "🎪 Events" },
            { key: "camp", label: "🏕️ Camps & Ferienlager" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setEventType(key as "all" | "event" | "camp")}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                eventType === key
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date Quick Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {[
            { key: "all", label: "📅 Alle Daten" },
            { key: "today", label: "☀️ Heute" },
            { key: "weekend", label: "🏖️ Wochenende" },
            { key: "week", label: "🗓️ Diese Woche" },
            { key: "month", label: "📆 Diesen Monat" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateFilter(key as "all" | "today" | "weekend" | "week" | "month")}
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

        {/* Results Section */}
        <section className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h3 className="text-2xl font-bold">
              🗓️ Events {(()=>{
              const _f=events.filter(e=>showOnlyFavorites?favorites.includes(e.id):true);
              const _n=new Date();_n.setHours(0,0,0,0);
              const _ew=new Date(_n);_ew.setDate(_n.getDate()+7);
              const _em=new Date(_n);_em.setDate(_n.getDate()+30);
              const _d=_f.filter(e=>{
                if(!e.datum||dateFilter==="all")return true;
                const d=new Date(e.datum+"T00:00:00");
                if(dateFilter==="today")return d>=_n&&d<=_n;
                if(dateFilter==="weekend"){
                  const dow=_n.getDay();
                  const sat=new Date(_n);sat.setDate(_n.getDate()+(dow===6?7:6-dow));
                  const sun=new Date(_n);sun.setDate(_n.getDate()+(dow===0?7:7-dow));
                  return d>=sat&&d<=sun;
                }
                if(dateFilter==="week")return d<=_ew;
                if(dateFilter==="month")return d<=_em;
                return true;
              });
              return _d.length>0&&`(${_d.length})`;
            })()}
            </h3>

            <div className="flex gap-2">
              {/* View Toggle */}
              <div className="flex gap-1 bg-gray-200 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-2 rounded text-sm font-semibold transition ${
                    viewMode === "list"
                      ? "bg-indigo-600 text-white"
                      : "bg-transparent text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  📋 Liste
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`px-3 py-2 rounded text-sm font-semibold transition ${
                    viewMode === "map"
                      ? "bg-indigo-600 text-white"
                      : "bg-transparent text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  🗺️ Karte
                </button>
              </div>

              {/* Favorites Filter */}
              {events.length > 0 && (
                <button
                  onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                  className={`px-3 py-2 rounded text-sm font-semibold transition ${
                    showOnlyFavorites
                      ? "bg-red-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  ❤️ Favoriten {favorites.length > 0 && `(${favorites.length})`}
                </button>
              )}
            </div>
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
                {search || category !== "Alle"
                  ? "😢 Keine Events gefunden"
                  : "🎯 Nutze die Suchfunktion oben, um Events zu finden!"}
              </p>
            </div>
          ) : viewMode === "map" ? (
            <MapView
              sources={sources.filter((s) =>
                showOnlyFavorites ? favorites.includes(s.id) : true
              )}
            />
          ) : (
            <>
              {/* Separate sections: Events with date vs. All-year activities */}
              {(() => {
                const filteredEvents = events.filter((e) =>
                  showOnlyFavorites ? favorites.includes(e.id) : true
                );

                // Apply date quick filter
            const now2 = new Date();
            now2.setHours(0, 0, 0, 0);
            const endOfWeek = new Date(now2); endOfWeek.setDate(now2.getDate() + 7);
            const endOfMonth = new Date(now2); endOfMonth.setDate(now2.getDate() + 30);
            const dateFiltered = filteredEvents.filter((e) => {
              if (!e.datum || dateFilter === "all") return true;
              const d = new Date(e.datum + "T00:00:00");
              if (dateFilter === "today") {
              return d >= now2 && d <= now2;
            }
            if (dateFilter === "weekend") {
              const today = new Date(now2);
              const dayOfWeek = today.getDay(); // 0=Sun,6=Sat
              const daysUntilSat = dayOfWeek === 6 ? 7 : (6 - dayOfWeek);
              const daysUntilSun = dayOfWeek === 0 ? 7 : (7 - dayOfWeek);
              const nextSat = new Date(today); nextSat.setDate(today.getDate() + daysUntilSat);
              const nextSun = new Date(today); nextSun.setDate(today.getDate() + daysUntilSun);
              return d >= nextSat && d <= nextSun;
            }
            if (dateFilter === "week") return d <= endOfWeek;
              if (dateFilter === "month") return d <= endOfMonth;
              return true;
            });
            const futureEvents = dateFiltered.filter((e) => e.datum);
                const allYearActivities = dateFiltered.filter((e) => !e.datum);

                // Helper function to format date
                const formatDate = (dateStr: string, dateEndStr?: string | null) => {
                  const date = new Date(dateStr + "T00:00:00");
                  if (dateEndStr) {
                    const dateEnd = new Date(dateEndStr + "T00:00:00");
                    const startFormatted = date.toLocaleDateString("de-CH", { day: "numeric", month: "short" });
                    const endFormatted = dateEnd.toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" });
                    return `${startFormatted} – ${endFormatted}`;
                  }
                  return date.toLocaleDateString("de-CH", {
                    weekday: "short",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  });
                };

                // Get source details for an event
                const getSource = (sourceId: string) =>
                  sources.find((s) => s.id === sourceId);

                return (
                  <>
                    {/* Section 1: Future Events with dates */}
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
                                {/* Category Image with fallback */}
                                <CategoryImage url={event.kategorie_bild_url} kategorien={event.kategorien} />
                            {/* Favorite Heart Button */}
                                <button
                                  onClick={() => {
                                    toggleFavorite(event.id);
                                    setFavorites(getFavorites());
                                  }}
                                  className="absolute top-2 right-2 text-2xl transition transform hover:scale-125"
                                  title={
                                    isFavorite(event.id)
                                      ? "Aus Favoriten entfernen"
                                      : "Zu Favoriten hinzufügen"
                                  }
                                >
                                  {isFavorite(event.id) ? "❤️" : "🤍"}
                                </button>

                                                                {event.created_at && new Date(event.created_at) > new Date(Date.now() - 7*24*60*60*1000) && (
                                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded mb-1">✨ Neu</span>
                                )}
<Link href={`/events/${event.id}`} className="block hover:text-indigo-600 transition">
                                  <h5 className="font-bold text-lg mb-2 text-gray-900 pr-8">
                                    {event.titel}
                                  </h5>
                                </Link>

                                {/* Date */}
                                <p className="text-sm font-semibold text-indigo-600 mb-1">
                                  📅 {formatDate(event.datum, event.datum_ende)}
                                </p>

                                {/* Serie Badge */}
                                {serienCounts[event.id] ? (
                                  <p className="text-xs text-indigo-400 mb-1">🔄 +{serienCounts[event.id]} weitere Termine</p>
                                ) : null}

                                {/* Location */}
                                {event.ort && (
                                  <p className="text-sm text-gray-700 mb-2">
                                    📍 {event.ort}
                                  </p>
                                )}

                                {/* Camp Badge */}
                                {event.event_typ === "camp" && (
                                  <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                                    🏕️ Camp
                                  </span>
                                )}

                                {/* Categories */}
                                {event.kategorien?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {event.kategorien.slice(0, 2).map((cat: string) => (
                                      <span
                                        key={cat}
                                        className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-1 rounded"
                                      >
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Altersgruppen */}
                                {event.altersgruppen?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {event.altersgruppen.map((ag: string) => (
                                      <span key={ag} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">👶 {ag}{!ag.includes('Jahr') && ' Jahre'}</span>
                                    ))}
                                  </div>
                                )}

                                {/* Price */}
                                {event.preis_chf != null && (
                                <p className="text-xs text-gray-600 mb-2">
                                  {event.preis_chf === 0
                                    ? <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">🎉 Kostenlos</span>
                                    : <>💰 CHF {event.preis_chf}</>
                                  }
                                </p>
                              )}

                                {/* Beschreibung */}
                                {event.beschreibung && (
                                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">{event.beschreibung}</p>
                                )}
                                {/* Website Link */}
                                {(event.anmelde_link || source?.url) && (
                                  <div className="flex gap-2 flex-wrap mt-2">
                                    <a href={event.anmelde_link || source?.url} target="_blank" rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                                    >
                      🌐 Zur Webseite
                    </a>
                                    {typeof navigator !== "undefined" && navigator.share && (
                                      <button onClick={() => navigator.share({ title: event.titel, url: event.anmelde_link || source?.url || window.location.href })}
                                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-200 transition"
                                      ><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Teilen</button>
                                    )}
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

                    {/* Section 2: All-year activities (no date) */}
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
                                {/* Category Image with fallback */}
                                <CategoryImage url={activity.kategorie_bild_url} kategorien={activity.kategorien} />
                            {/* Favorite Heart Button */}
                                <button
                                  onClick={() => {
                                    toggleFavorite(activity.id);
                                    setFavorites(getFavorites());
                                  }}
                                  className="absolute top-2 right-2 text-2xl transition transform hover:scale-125"
                                  title={
                                    isFavorite(activity.id)
                                      ? "Aus Favoriten entfernen"
                                      : "Zu Favoriten hinzufügen"
                                  }
                                >
                                  {isFavorite(activity.id) ? "❤️" : "🤍"}
                                </button>

                                                                {activity.created_at && new Date(activity.created_at) > new Date(Date.now() - 7*24*60*60*1000) && (
                                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded mb-1">✨ Neu</span>
                                )}
<Link href={`/events/${activity.id}`} className="block hover:text-green-700 transition">
                                  <h5 className="font-bold text-lg mb-2 text-gray-900 pr-8">
                                    {activity.titel}
                                  </h5>
                                </Link>

                                {/* Location */}
                                {activity.ort && (
                                  <p className="text-sm text-gray-700 mb-2">
                                    📍 {activity.ort}
                                  </p>
                                )}

                                {/* Categories */}
                                {activity.kategorien?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {activity.kategorien.slice(0, 2).map((cat: string) => (
                                      <span
                                        key={cat}
                                        className="inline-block bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded"
                                      >
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Altersgruppen */}
                                {activity.altersgruppen?.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-2">
                                    {activity.altersgruppen.map((ag: string) => (
                                      <span key={ag} className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">👶 {ag}{!ag.includes('Jahr') && ' Jahre'}</span>
                                    ))}
                                  </div>
                                )}

                                {/* Price */}
                                {activity.preis_chf != null && (
                                <p className="text-xs text-gray-600 mb-2">
                                  {activity.preis_chf === 0
                                    ? <span className="inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded">🎉 Kostenlos</span>
                                    : <>💰 CHF {activity.preis_chf}</>
                                  }
                                </p>
                              )}

                                {/* Beschreibung */}
                                {activity.beschreibung && (
                                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">{activity.beschreibung}</p>
                                )}
                                {/* Website Link */}
                                {(activity.anmelde_link || source?.url) && (
                                  <div className="flex gap-2 flex-wrap mt-2">
                                    <a href={activity.anmelde_link || source?.url} target="_blank" rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
                                    >
                      🌐 Zur Webseite
                    </a>
                                    {typeof navigator !== "undefined" && navigator.share && (
                                      <button onClick={() => navigator.share({ title: activity.titel, url: activity.anmelde_link || source?.url || window.location.href })}
                                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-200 transition"
                                      ><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Teilen</button>
                                    )}
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
              })()}
            </>
          )}
        </section>

        {/* Footer Info */}
        <footer className="mt-12 text-center text-gray-600 text-sm">
          <p>🚀 Kidgo PWA - Alpha Version | Powered by Next.js + Supabase</p>
        <div className="mt-2 flex justify-center gap-4 text-xs">
          <a href="/admin" className="text-gray-400 hover:underline">🛠️ Admin</a>
        </div>
        </footer>
      </div>

      {/* Scroll to Top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-4 z-50 bg-indigo-600 text-white rounded-full w-11 h-11 flex items-center justify-center shadow-lg hover:bg-indigo-700 transition"
          title="Nach oben"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
        </button>
      )}
    </main>
  );
}

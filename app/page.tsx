"use client";
// Deployment trigger - force Vercel rebuild

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getFavorites, toggleFavorite, isFavorite } from "@/lib/favorites";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-200 rounded-lg animate-pulse" />,
});

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

  useEffect(() => {
    setMounted(true);
    setFavorites(getFavorites());
  }, []);

  const categoryEmojis: Record<string, string> = {
    "Kreativ": "🎨", "Natur": "🌿", "Tiere": "🐾", "Sport": "⚽",
    "Tanz": "💃", "Theater": "🎭", "Musik": "🎵", "Mode & Design": "👗",
    "Wissenschaft": "🔬", "Bildung": "📚", "Ausflug": "🗺️", "Feriencamp": "🏕️",
  };
  const categories = [
    "Alle", "Kreativ", "Natur", "Tiere", "Sport", "Tanz",
    "Theater", "Musik", "Mode & Design", "Wissenschaft", "Bildung", "Ausflug", "Feriencamp",
  ];

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    setEvents([]);
    setSources([]);

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

      // Filter by search text if provided
      if (search.trim()) {
        eventsQuery = eventsQuery.or(
          `titel.ilike.%${search}%,ort.ilike.%${search}%`
        );
      }

      // Fetch all events first, then filter in-memory for date range
      const { data: allEvents, error: eventsError } = await eventsQuery.order(
        "datum",
        { ascending: true, nullsFirst: true }
      );

      if (eventsError) throw eventsError;

      if (allEvents) {
        // Filter: Only show future events or events without date
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const filteredEvents = allEvents.filter((event) => {
          if (!event.datum) return true; // Include all-year activities
          return new Date(event.datum) >= now; // Only future events
        });

        setEvents(filteredEvents);
        console.log(`Gefunden: ${filteredEvents.length} Events`);
      }
    } catch (error) {
      console.error("Fehler bei Suche:", error);
      setError("Unerwarteter Fehler bei der Suche");
      setEvents([]);
    }

    setLoading(false);
  };

  // Auto-load all sources on mount
  useEffect(() => {
    if (mounted) {
      handleSearch();
    }
  }, [mounted]);

  // Reset events when filters change
  useEffect(() => {
    if (mounted && !loading) {
      setEvents([]);
    }
  }, [search, category, mounted]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Hero Section */}
        <section className="text-center mb-12 py-8">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            🎪 Entdecke Events für deine Kinder
          </h2>
          <p className="text-lg text-gray-600">
            Finde die besten Aktivitäten in der Region Zürich
          </p>
        </section>

        {/* Search Section */}
        <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8 mb-8">
          <h3 className="text-2xl font-bold mb-6">🔍 Events suchen</h3>

          {/* Search Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event-Name oder Ort:
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
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
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

        {/* Results Section */}
        <section className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-2xl font-bold">
              🗓️ Events {events.length > 0 && `(${events.length})`}
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
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">⏳ Events werden geladen...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
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

                const futureEvents = filteredEvents.filter((e) => e.datum);
                const allYearActivities = filteredEvents.filter((e) => !e.datum);

                // Helper function to format date
                const formatDate = (dateStr: string) => {
                  const date = new Date(dateStr + "T00:00:00");
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
                          {futureEvents.map((event: any) => {
                            const source = getSource(event.quelle_id);
                            return (
                              <div
                                key={event.id}
                                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer hover:border-indigo-400 relative group bg-gradient-to-br from-blue-50 to-white"
                              >
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

                                <h5 className="font-bold text-lg mb-2 text-gray-900 pr-8">
                                  {event.titel}
                                </h5>

                                {/* Date */}
                                <p className="text-sm font-semibold text-indigo-600 mb-1">
                                  📅 {formatDate(event.datum)}
                                </p>

                                {/* Location */}
                                {event.ort && (
                                  <p className="text-sm text-gray-700 mb-2">
                                    📍 {event.ort}
                                  </p>
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

                                {/* Price */}
                                {event.preis_chf && (
                                  <p className="text-xs text-gray-600 mb-2">
                                    💰 CHF {event.preis_chf}
                                  </p>
                                )}

                                {/* Website Link */}
                                {(event.anmelde_link || source?.url) && (
                                  <a
                                    href={event.anmelde_link || source?.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                                  >
                                    🔗 Zur Webseite
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 2: All-year activities (no date) */}
                    {allYearActivities.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-xl font-bold text-green-600 mb-4">
                          🎢 Ganzjährig geöffnet ({allYearActivities.length})
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {allYearActivities.map((activity: any) => {
                            const source = getSource(activity.quelle_id);
                            return (
                              <div
                                key={activity.id}
                                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer hover:border-green-400 relative group bg-gradient-to-br from-green-50 to-white"
                              >
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

                                <h5 className="font-bold text-lg mb-2 text-gray-900 pr-8">
                                  {activity.titel}
                                </h5>

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

                                {/* Price */}
                                {activity.preis_chf && (
                                  <p className="text-xs text-gray-600 mb-2">
                                    💰 CHF {activity.preis_chf}
                                  </p>
                                )}

                                {/* Website Link */}
                                {(activity.anmelde_link || source?.url) && (
                                  <a
                                    href={activity.anmelde_link || source?.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mt-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition"
                                  >
                                    🔗 Zur Webseite
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
        </footer>
      </div>
    </main>
  );
}

"use client";

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
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  useEffect(() => {
    setMounted(true);
    setFavorites(getFavorites());
  }, []);

  const categories = [
    "Alle",
    "Sport",
    "Kultur & Bildung",
    "Öffentliche Stelle",
    "Jugendverband",
    "Kommerziell",
    "Nische",
  ];

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    setSources([]);

    try {
      let query = supabase.from("quellen").select("*");

      // Filter by category if not "Alle"
      if (category !== "Alle") {
        query = query.eq("kategorie", category);
      }

      // Filter by search text if provided
      if (search.trim()) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error: fetchError } = await query.order("name", {
        ascending: true,
      });

      if (fetchError) {
        console.error("Supabase error:", fetchError);
        setError(
          `Fehler beim Laden: ${fetchError.message}`
        );
        setSources([]);
      } else if (data) {
        setSources(data);
        console.log(`Gefunden: ${data.length} Events`);
      }
    } catch (error) {
      console.error("Fehler bei Suche:", error);
      setError("Unerwarteter Fehler bei der Suche");
      setSources([]);
    }

    setLoading(false);
  };

  // Auto-load all sources on mount
  useEffect(() => {
    if (mounted) {
      handleSearch();
    }
  }, [mounted]);

  // Reset sources when filters change
  useEffect(() => {
    if (mounted && !loading) {
      setSources([]);
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
                  {cat}
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
              📍 Ergebnisse {sources.length > 0 && `(${sources.length})`}
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
              {sources.length > 0 && (
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
          ) : sources.length === 0 ? (
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sources
                .filter((s) =>
                  showOnlyFavorites ? favorites.includes(s.id) : true
                )
                .map((source: any) => (
                  <div
                    key={source.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer hover:border-indigo-400 relative group"
                  >
                    {/* Favorite Heart Button */}
                    <button
                      onClick={() => {
                        toggleFavorite(source.id);
                        setFavorites(getFavorites());
                      }}
                      className="absolute top-2 right-2 text-2xl transition transform hover:scale-125"
                      title={
                        isFavorite(source.id)
                          ? "Aus Favoriten entfernen"
                          : "Zu Favoriten hinzufügen"
                      }
                    >
                      {isFavorite(source.id) ? "❤️" : "🤍"}
                    </button>

                    <h4 className="font-bold text-lg mb-2 text-gray-900 pr-8">
                      {source.name}
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-semibold px-2 py-1 rounded">
                        {source.kategorie}
                      </span>
                      {source.scraping_aufwand && (
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                          {source.scraping_aufwand}
                        </span>
                      )}
                    </div>
                    {source.ort && (
                      <p className="text-sm text-gray-700 mb-2">
                        📍 <span className="font-semibold">{source.ort}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mb-3">
                      Status:{" "}
                      <span className="font-semibold">{source.status}</span>
                    </p>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                      >
                        🔗 Zur Webseite
                      </a>
                    )}
                  </div>
                ))}
            </div>
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

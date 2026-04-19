"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";

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

const categoryColors: Record<string, string> = {
  "Kreativ": "bg-pink-50 text-pink-600 border-pink-100",
  "Natur": "bg-green-50 text-green-600 border-green-100",
  "Tiere": "bg-yellow-50 text-yellow-600 border-yellow-100",
  "Sport": "bg-blue-50 text-blue-600 border-blue-100",
  "Tanz": "bg-purple-50 text-purple-600 border-purple-100",
  "Theater": "bg-red-50 text-red-600 border-red-100",
  "Musik": "bg-indigo-50 text-indigo-600 border-indigo-100",
  "Mode & Design": "bg-rose-50 text-rose-600 border-rose-100",
  "Wissenschaft": "bg-cyan-50 text-cyan-600 border-cyan-100",
  "Bildung": "bg-orange-50 text-orange-600 border-orange-100",
  "Ausflug": "bg-teal-50 text-teal-600 border-teal-100",
  "Feriencamp": "bg-amber-50 text-amber-600 border-amber-100",
};

const categoryFallback: Record<string, string> = {
  "Kreativ": "from-pink-100 to-rose-50",
  "Natur": "from-green-100 to-emerald-50",
  "Tiere": "from-yellow-100 to-amber-50",
  "Sport": "from-blue-100 to-sky-50",
  "Tanz": "from-purple-100 to-violet-50",
  "Theater": "from-red-100 to-rose-50",
  "Musik": "from-indigo-100 to-violet-50",
  "Mode & Design": "from-rose-100 to-pink-50",
  "Wissenschaft": "from-cyan-100 to-sky-50",
  "Bildung": "from-orange-100 to-amber-50",
  "Ausflug": "from-teal-100 to-green-50",
  "Feriencamp": "from-amber-100 to-orange-50",
};

function EventCard({ event, source, serienCount, formatDate }: {
  event: any;
  source: any;
  serienCount: number;
  formatDate: (d: string, e?: string | null) => string;
}) {
  const [imgErr, setImgErr] = useState(false);
  const cat = event.kategorien?.[0] || event.kategorie || "";
  const isNew = event.created_at && new Date(event.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const isFree = event.preis_chf === 0;
  const isCamp = event.event_typ === "camp" || event.kategorien?.includes("Feriencamp");
  const ctaUrl = event.anmelde_link || source?.url;

  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] hover:border-orange-200 hover:shadow-md transition-all duration-200 overflow-hidden group">
      {/* Image */}
      <div className="h-40 overflow-hidden bg-[var(--bg-subtle)]">
        {event.kategorie_bild_url && !imgErr ? (
          <img
            src={event.kategorie_bild_url}
            alt={event.titel}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${categoryFallback[cat] || "from-orange-100 to-amber-50"}`} />
        )}
      </div>

      <div className="p-4">
        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {isNew && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 border border-orange-100">Neu</span>
          )}
          {isFree && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">Gratis</span>
          )}
          {isCamp && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Camp</span>
          )}
        </div>

        {/* Title */}
        <Link href={`/events/${event.id}`} className="block">
          <h3 className="font-bold text-[var(--text-primary)] text-base leading-snug mb-2 group-hover:text-orange-600 transition-colors line-clamp-2">
            {event.titel}
          </h3>
        </Link>

        {/* Date + location */}
        <div className="space-y-1 text-xs text-[var(--text-secondary)] mb-3">
          {event.datum && (
            <p className="font-medium text-orange-500">{formatDate(event.datum, event.datum_ende)}</p>
          )}
          {!event.datum && (
            <p className="font-medium text-green-600">Ganzjährig geöffnet</p>
          )}
          {serienCount > 0 && (
            <p className="text-[var(--text-muted)]">+{serienCount} weitere Termine</p>
          )}
          {event.ort && <p className="text-[var(--text-muted)] truncate">{event.ort}</p>}
        </div>

        {/* Category tags */}
        {event.kategorien?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {event.kategorien.slice(0, 2).map((c: string) => (
              <span key={c} className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[c] || "bg-gray-50 text-gray-500 border-gray-100"}`}>{c}</span>
            ))}
          </div>
        )}

        {/* Price */}
        {event.preis_chf != null && event.preis_chf > 0 && (
          <p className="text-xs text-[var(--text-muted)] mb-3">CHF {event.preis_chf}</p>
        )}

        {/* Description snippet */}
        {event.beschreibung && (
          <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-3">{event.beschreibung}</p>
        )}

        {ctaUrl && (
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold text-orange-600 hover:text-orange-700 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-full transition"
          >
            Zur Webseite →
          </a>
        )}
      </div>
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
    fetch("https://api.open-meteo.com/v1/forecast?latitude=47.37&longitude=8.54&current=weather_code,temperature_2m")
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
      const { data: sourcesData, error: sourcesError } = await supabase.from("quellen").select("*");
      if (sourcesError) throw sourcesError;
      setSources(sourcesData || []);

      let eventsQuery = supabase.from("events").select("*").eq("status", "approved");

      if (selectedCategories.length > 0) {
        eventsQuery = eventsQuery.overlaps("kategorien", selectedCategories);
      }
      if (search.trim()) {
        eventsQuery = eventsQuery.or(`titel.ilike.%${search}%,ort.ilike.%${search}%`);
      }
      if (selectedAgeBuckets.length > 0) {
        eventsQuery = eventsQuery.overlaps("alters_buckets", selectedAgeBuckets);
      }

      eventsQuery = eventsQuery.is("serie_id", null);
      const todayStr = new Date().toISOString().split("T")[0];
      eventsQuery = eventsQuery.or(`datum.is.null,datum.gte.${todayStr},datum_ende.gte.${todayStr}`);

      const { data: serienData } = await supabase
        .from("events")
        .select("serie_id")
        .not("serie_id", "is", null);
      const counts: Record<string, number> = {};
      serienData?.forEach((e) => {
        if (e.serie_id) counts[e.serie_id] = (counts[e.serie_id] || 0) + 1;
      });
      setSerienCounts(counts);

      const { data: allEvents, error: eventsError } = await eventsQuery.order("datum", { ascending: true, nullsFirst: true });
      if (eventsError) throw eventsError;
      if (allEvents) setEvents(allEvents);
    } catch (err) {
      console.error("Fehler bei Suche:", err);
      setError("Fehler beim Laden der Events");
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
      return `${date.toLocaleDateString("de-CH", { day: "numeric", month: "short" })} – ${dateEnd.toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return date.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  };

  const getSource = (sourceId: string) => sources.find((s) => s.id === sourceId);

  return (
    <main className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/" className="flex-shrink-0">
              <KidgoLogo className="h-6 w-auto" />
            </Link>
            <div className="h-4 w-px bg-[var(--border)]" />
            <Link
              href="/"
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 10L4 6l4-4"/>
              </svg>
              Empfehlungen
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Events entdecken</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Alle Kinderaktivitäten in der Region Zürich</p>
        </header>

        {/* Search & Filters */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 mb-6 space-y-4">
          {/* Search input */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/>
            </svg>
            <input
              type="text"
              placeholder="Event, Ort oder Aktivität suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-transparent transition"
            />
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setSelectedCategories((prev) =>
                    prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                  )
                }
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                  selectedCategories.includes(cat)
                    ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-orange-300 hover:text-orange-600"
                }`}
              >
                {cat}
              </button>
            ))}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="px-3 py-1.5 rounded-full text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
              >
                Alle
              </button>
            )}
          </div>

          {/* Date + Age filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: "all", label: "Alle Daten" },
                { key: "today", label: "Heute" },
                { key: "weekend", label: "Wochenende" },
                { key: "week", label: "Diese Woche" },
                { key: "month", label: "Diesen Monat" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDateFilter(key as typeof dateFilter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    dateFilter === key
                      ? "bg-[var(--text-primary)] text-[var(--bg-card)] border-[var(--text-primary)]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-xs text-[var(--text-muted)] font-medium">Alter:</span>
              {[
                { key: "0-3", label: "0–3 J." },
                { key: "4-6", label: "4–6 J." },
                { key: "7-9", label: "7–9 J." },
                { key: "10-12", label: "10–12 J." },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() =>
                    setSelectedAgeBuckets((prev) =>
                      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key]
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                    selectedAgeBuckets.includes(key)
                      ? "bg-[var(--text-primary)] text-[var(--bg-card)] border-[var(--text-primary)]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
              {selectedAgeBuckets.length > 0 && (
                <button
                  onClick={() => setSelectedAgeBuckets([])}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                >
                  Alle
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="h-40 skeleton" />
                <div className="p-4 space-y-2">
                  <div className="h-3 skeleton w-1/3" />
                  <div className="h-4 skeleton w-full" />
                  <div className="h-3 skeleton w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[var(--text-secondary)] text-base mb-1">
              {search || selectedCategories.length > 0 ? "Keine Events gefunden" : "Suchbegriff eingeben oder Kategorie wählen"}
            </p>
            <p className="text-[var(--text-muted)] text-sm">Passe die Filter oben an</p>
          </div>
        ) : (() => {
          const now2 = new Date();
          now2.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(now2); endOfWeek.setDate(now2.getDate() + 7);
          const endOfMonth = new Date(now2); endOfMonth.setDate(now2.getDate() + 30);

          const dateFiltered = events.filter((e) => {
            if (!e.datum || dateFilter === "all") return true;
            const d = new Date(e.datum + "T00:00:00");
            if (dateFilter === "today") return d.toDateString() === now2.toDateString();
            if (dateFilter === "weekend") {
              const dow = now2.getDay();
              const nextSat = new Date(now2); nextSat.setDate(now2.getDate() + (dow === 6 ? 7 : 6 - dow));
              const nextSun = new Date(now2); nextSun.setDate(now2.getDate() + (dow === 0 ? 7 : 7 - dow));
              return d >= nextSat && d <= nextSun;
            }
            if (dateFilter === "week") return d <= endOfWeek;
            if (dateFilter === "month") return d <= endOfMonth;
            return true;
          });

          const isBadWeather = weatherCode !== null && weatherCode >= 51;
          const futureEvents = applyWeatherSort(dateFiltered.filter((e) => e.datum), isBadWeather);
          const allYearActivities = applyWeatherSort(dateFiltered.filter((e) => !e.datum), isBadWeather);

          return (
            <div className="space-y-10">
              {futureEvents.length > 0 && (
                <section>
                  <div className="flex items-baseline gap-2 mb-5">
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">Anstehende Events</h2>
                    <span className="text-sm text-[var(--text-muted)]">{futureEvents.length}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {futureEvents.slice(0, visibleCountFuture).map((event: any) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        source={getSource(event.quelle_id)}
                        serienCount={serienCounts[event.id] || 0}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                  {visibleCountFuture < futureEvents.length && (
                    <div className="text-center mt-6">
                      <button
                        onClick={() => setVisibleCountFuture((v) => v + PAGE_SIZE)}
                        className="px-6 py-2.5 border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] text-sm font-medium rounded-xl hover:border-orange-300 hover:text-orange-600 transition"
                      >
                        {futureEvents.length - visibleCountFuture} weitere laden
                      </button>
                    </div>
                  )}
                </section>
              )}

              {allYearActivities.length > 0 && (
                <section>
                  <div className="flex items-baseline gap-2 mb-5">
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">Ganzjährig geöffnet</h2>
                    <span className="text-sm text-[var(--text-muted)]">{allYearActivities.length}</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {allYearActivities.slice(0, visibleCountAllYear).map((activity: any) => (
                      <EventCard
                        key={activity.id}
                        event={activity}
                        source={getSource(activity.quelle_id)}
                        serienCount={serienCounts[activity.id] || 0}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                  {visibleCountAllYear < allYearActivities.length && (
                    <div className="text-center mt-6">
                      <button
                        onClick={() => setVisibleCountAllYear((v) => v + PAGE_SIZE)}
                        className="px-6 py-2.5 border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] text-sm font-medium rounded-xl hover:border-orange-300 hover:text-orange-600 transition"
                      >
                        {allYearActivities.length - visibleCountAllYear} weitere laden
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
          );
        })()}

        <footer className="mt-14 pt-6 border-t border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
          <p className="mb-2">© 2026 kidgo · Zürich</p>
          <nav className="flex justify-center gap-4">
            <Link href="/" className="hover:text-[var(--text-secondary)] transition">Empfehlungen</Link>
            <Link href="/impressum" className="hover:text-[var(--text-secondary)] transition">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-[var(--text-secondary)] transition">Datenschutz</Link>
            <a href="/admin" className="hover:text-[var(--text-secondary)] transition">Admin</a>
          </nav>
        </footer>
      </div>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-4 z-50 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:shadow-lg hover:border-orange-300 hover:text-orange-500 transition-all"
          title="Nach oben"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12V4M4 8l4-4 4 4"/>
          </svg>
        </button>
      )}
    </main>
  );
}

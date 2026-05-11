"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { getCategoryIcon } from "@/components/Icons";
import { safeExternalUrl } from "@/lib/safe-url";
import { ExploreMapView } from "@/components/ExploreMapView";
import { LazySection } from "@/components/home/LazySection";

const PAGE_SIZE = 15;

type ViewMode     = "list" | "map";
type SortMode     = "date-asc" | "date-desc" | "newest";
type IndoorOutdoor = "all" | "indoor" | "outdoor";

const categoryColors: Record<string, string> = {
  "Kreativ":       "bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-950/30 dark:text-pink-400 dark:border-pink-900",
  "Natur":         "bg-green-50 text-green-700 border-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900",
  "Tiere":         "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900",
  "Sport":         "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900",
  "Tanz":          "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-900",
  "Theater":       "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900",
  "Musik":         "bg-kidgo-50 text-kidgo-600 border-kidgo-100 dark:bg-kidgo-950/30 dark:text-kidgo-400 dark:border-kidgo-900",
  "Mode & Design": "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900",
  "Wissenschaft":  "bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900",
  "Bildung":       "bg-kidgo-50 text-kidgo-600 border-kidgo-100 dark:bg-kidgo-950/30 dark:text-kidgo-400 dark:border-kidgo-900",
  "Ausflug":       "bg-teal-50 text-teal-600 border-teal-100 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900",
  "Feriencamp":    "bg-kidgo-50 text-kidgo-600 border-kidgo-100 dark:bg-kidgo-950/30 dark:text-kidgo-400 dark:border-kidgo-900",
};

const categoryBgColors: Record<string, string> = {
  "Kreativ":       "#EC4899",
  "Natur":         "#22C55E",
  "Tiere":         "#22C55E",
  "Sport":         "#3B82F6",
  "Tanz":          "#8B5CF6",
  "Theater":       "#EF4444",
  "Musik":         "#8B5CF6",
  "Mode & Design": "#F43F5E",
  "Wissenschaft":  "#06B6D4",
  "Bildung":       "#F59E0B",
  "Ausflug":       "#14B8A6",
  "Feriencamp":    "#06B6D4",
};

function EventCard({ event, source, serienCount, formatDate }: {
  event: any;
  source: any;
  serienCount: number;
  formatDate: (d: string, e?: string | null) => string;
}) {
  const [imgErr, setImgErr] = useState(false);
  const cat    = event.kategorien?.[0] || event.kategorie || "";
  const isNew  = event.created_at && new Date(event.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const isFree = event.preis_chf === 0;
  const isCamp = event.event_typ === "camp" || event.kategorien?.includes("Feriencamp");
  const ctaUrl = safeExternalUrl(event.anmelde_link || source?.url);

  const catBorderColors: Record<string, string> = {
    "Sport": "#3B82F6", "Kreativ": "#EC4899", "Musik": "#8B5CF6",
    "Tanz": "#8B5CF6", "Natur": "#22C55E", "Tiere": "#22C55E",
    "Theater": "#EF4444", "Feriencamp": "#06B6D4",
    "Bildung": "#F59E0B", "Wissenschaft": "#F59E0B", "Ausflug": "#14B8A6",
  };
  const leftBorderColor = catBorderColors[cat] || "var(--kidgo-teal)";

  return (
    <div
      className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] hover:shadow-md transition-all duration-200 ease-out overflow-hidden group flex flex-col hover:-translate-y-0.5 active:scale-[0.99]"
      style={{ borderLeft: `3px solid ${leftBorderColor}` }}
    >
      <div className="h-48 overflow-hidden bg-[var(--bg-subtle)] flex-shrink-0 rounded-t-xl photo-cell">
        {event.kategorie_bild_url && !imgErr ? (
          <img
            src={event.kategorie_bild_url}
            alt={event.titel}
            className="w-full h-full object-cover group-hover:scale-[1.03] group-hover:brightness-105 dark:brightness-90 transition-all duration-300 ease-out"
            loading="lazy"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full bg-[var(--bg-subtle)] flex items-center justify-center">
            <div className="opacity-20" style={{ color: categoryBgColors[cat] || "#5BBAA7" }}>
              {getCategoryIcon(cat, { size: 56 })}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {isNew  && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-kidgo-50 text-kidgo-500 border border-kidgo-100">Neu</span>}
          {isFree && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">Gratis</span>}
          {isCamp && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-kidgo-50 text-kidgo-600 border border-kidgo-100">Camp</span>}
          {event.indoor_outdoor === "indoor"  && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 border border-blue-100">Indoor</span>}
          {event.indoor_outdoor === "outdoor" && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-100">Outdoor</span>}
        </div>

        <Link href={`/events/${event.id}`} className="block flex-1">
          <h3 className="font-bold text-[var(--text-primary)] text-base leading-snug mb-2 group-hover:text-kidgo-500 transition-colors line-clamp-2">
            {event.titel}
          </h3>
        </Link>

        <div className="space-y-1 text-xs text-[var(--text-secondary)] mb-3">
          {event.datum  && <p className="font-medium text-kidgo-500">{formatDate(event.datum, event.datum_ende)}</p>}
          {!event.datum && <p className="font-medium text-green-600">Ganzjährig geöffnet</p>}
          {serienCount > 0 && <p className="text-[var(--text-muted)]">+{serienCount} weitere Termine</p>}
          {event.ort && <p className="text-[var(--text-muted)] truncate">{event.ort}</p>}
        </div>

        {event.kategorien?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {event.kategorien.slice(0, 2).map((c: string) => (
              <span key={c} className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[c] || "bg-gray-50 text-gray-500 border-gray-100"}`}>{c}</span>
            ))}
          </div>
        )}

        {event.preis_chf != null && event.preis_chf > 0 && (
          <p className="text-xs text-[var(--text-muted)] mb-3">CHF {event.preis_chf}</p>
        )}

        {event.beschreibung && (
          <p className="text-xs text-[var(--text-muted)] line-clamp-2 mb-3">{event.beschreibung}</p>
        )}

        {ctaUrl && (
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-block text-xs font-semibold text-kidgo-500 hover:text-kidgo-600 border border-kidgo-200 bg-kidgo-50 hover:bg-kidgo-100 px-3 py-1.5 rounded-full transition"
          >
            Zur Webseite
          </a>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <div className="h-40 skeleton" />
      <div className="p-4 space-y-2">
        <div className="h-3 skeleton w-1/3" />
        <div className="h-4 skeleton w-full" />
        <div className="h-3 skeleton w-2/3" />
        <div className="h-3 skeleton w-1/4" />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [mounted, setMounted]     = useState(false);
  const [viewMode, setViewMode]   = useState<ViewMode>("list");
  const [search, setSearch]       = useState("");
  const [sources, setSources]     = useState<any[]>([]);
  const [events, setEvents]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "weekend" | "week" | "month">("all");
  const [serienCounts, setSerienCounts]   = useState<Record<string, number>>({});
  const [visibleCountFuture, setVisibleCountFuture]   = useState(PAGE_SIZE);
  const [visibleCountAllYear, setVisibleCountAllYear] = useState(PAGE_SIZE);
  const [selectedAgeBuckets, setSelectedAgeBuckets]   = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories]   = useState<string[]>([]);
  const [indoorOutdoor, setIndoorOutdoor] = useState<IndoorOutdoor>("all");
  const [gratisOnly, setGratisOnly]       = useState(false);
  const [sortMode, setSortMode]           = useState<SortMode>("date-asc");
  const [weatherCode, setWeatherCode]     = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);

    // Read ?view=map from URL without Suspense
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "map") setViewMode("map");

    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=47.37&longitude=8.54&current=weather_code,temperature_2m")
      .then((r) => r.json())
      .then((d) => { if (typeof d?.current?.weather_code === "number") setWeatherCode(d.current.weather_code); })
      .catch(() => {});
  }, []);

  const categories = [
    "Kreativ", "Natur", "Tiere", "Sport", "Tanz",
    "Theater", "Musik", "Mode & Design", "Wissenschaft", "Bildung", "Ausflug", "Feriencamp",
  ];

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError("");
    setEvents([]);
    setSources([]);
    setVisibleCountFuture(PAGE_SIZE);
    setVisibleCountAllYear(PAGE_SIZE);

    try {
      const { data: sourcesData } = await supabase.from("quellen").select("*");
      setSources(sourcesData || []);

      let q = supabase.from("events").select("*").eq("status", "approved");

      if (selectedCategories.length > 0) q = q.overlaps("kategorien", selectedCategories);
      if (search.trim()) {
        const escaped = search.replace(/[\\%_,()*]/g, (m) => `\\${m}`);
        q = q.or(`titel.ilike.%${escaped}%,ort.ilike.%${escaped}%`);
      }
      if (selectedAgeBuckets.length > 0) q = q.overlaps("alters_buckets", selectedAgeBuckets);
      if (indoorOutdoor !== "all") q = q.or(`indoor_outdoor.eq.${indoorOutdoor},indoor_outdoor.eq.beides`);
      if (gratisOnly) q = q.eq("preis_chf", 0);

      q = q.is("serie_id", null);
      const todayStr = new Date().toISOString().split("T")[0];
      q = q.or(`datum.is.null,datum.gte.${todayStr},datum_ende.gte.${todayStr}`);

      const { data: serienData } = await supabase.from("events").select("serie_id").not("serie_id", "is", null);
      const counts: Record<string, number> = {};
      serienData?.forEach((e) => { if (e.serie_id) counts[e.serie_id] = (counts[e.serie_id] || 0) + 1; });
      setSerienCounts(counts);

      const { data: allEvents, error: eventsError } = await q.order("datum", { ascending: true, nullsFirst: true });
      if (eventsError) throw eventsError;
      if (allEvents) setEvents(allEvents);
    } catch (err) {
      console.error(err);
      setError("Fehler beim Laden der Events");
    }

    setLoading(false);
  }, [selectedCategories, search, selectedAgeBuckets, indoorOutdoor, gratisOnly]);

  useEffect(() => {
    if (!mounted) return;
    setVisibleCountFuture(PAGE_SIZE);
    setVisibleCountAllYear(PAGE_SIZE);
    const timer = setTimeout(handleSearch, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [mounted, handleSearch]);

  const formatDate = (dateStr: string, dateEndStr?: string | null) => {
    const date = new Date(dateStr + "T00:00:00");
    if (dateEndStr) {
      const end = new Date(dateEndStr + "T00:00:00");
      return `${date.toLocaleDateString("de-CH", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return date.toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  };

  const getSource = (sourceId: string) => sources.find((s) => s.id === sourceId);

  const applySort = (evts: any[]): any[] => {
    const arr = [...evts];
    if (sortMode === "date-asc")  return arr.sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
    if (sortMode === "date-desc") return arr.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
    if (sortMode === "newest")    return arr.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return arr;
  };

  const filterByDate = (evts: any[]) => {
    if (dateFilter === "all") return evts;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return evts.filter((e) => {
      if (!e.datum) return true;
      const d = new Date(e.datum + "T00:00:00");
      if (dateFilter === "today") return d.toDateString() === now.toDateString();
      if (dateFilter === "weekend") {
        const dow  = now.getDay();
        const sat  = new Date(now); sat.setDate(now.getDate() + (dow === 6 ? 7 : 6 - dow));
        const sun  = new Date(now); sun.setDate(now.getDate() + (dow === 0 ? 7 : 7 - dow));
        return d >= sat && d <= sun;
      }
      const endOfWeek  = new Date(now); endOfWeek.setDate(now.getDate() + 7);
      const endOfMonth = new Date(now); endOfMonth.setDate(now.getDate() + 30);
      if (dateFilter === "week")  return d <= endOfWeek;
      if (dateFilter === "month") return d <= endOfMonth;
      return true;
    });
  };

  const activeFilters = [
    ...selectedCategories,
    ...(selectedAgeBuckets.length > 0 ? [`${selectedAgeBuckets.length} Alter`] : []),
    ...(indoorOutdoor !== "all" ? [indoorOutdoor === "indoor" ? "Indoor" : "Outdoor"] : []),
    ...(gratisOnly ? ["Gratis"] : []),
    ...(dateFilter !== "all" ? [{ today: "Heute", weekend: "Wochenende", week: "Diese Woche", month: "Diesen Monat" }[dateFilter]!] : []),
  ];

  const clearAll = () => {
    setSelectedCategories([]);
    setSelectedAgeBuckets([]);
    setIndoorOutdoor("all");
    setGratisOnly(false);
    setDateFilter("all");
    setSearch("");
  };

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    const url = new URL(window.location.href);
    if (mode === "map") url.searchParams.set("view", "map");
    else url.searchParams.delete("view");
    window.history.replaceState({}, "", url.toString());
  };

  const isBadWeather = weatherCode !== null && weatherCode >= 51;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 pb-24 md:pb-10">

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="flex-shrink-0">
              <KidgoLogo size="sm" />
            </Link>
            <div className="h-4 w-px bg-[var(--border)]" />
            <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10L4 6l4-4"/></svg>
              Empfehlungen
            </Link>

            {/* View mode toggle */}
            <div className="ml-auto flex items-center bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-1 gap-0.5">
              <button
                onClick={() => switchView("list")}
                title="Listenansicht"
                aria-pressed={viewMode === "list"}
                className={`p-1.5 rounded-lg transition ${viewMode === "list" ? "bg-[var(--bg-card)] shadow-sm text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 4h12M2 8h12M2 12h12"/>
                </svg>
              </button>
              <button
                onClick={() => switchView("map")}
                title="Kartenansicht"
                aria-pressed={viewMode === "map"}
                className={`p-1.5 rounded-lg transition ${viewMode === "map" ? "bg-[var(--bg-card)] shadow-sm text-kidgo-500" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 3l5 2 4-2 5 2v10l-5-2-4 2-5-2V3z"/>
                  <path d="M6 5v10M10 3v10"/>
                </svg>
              </button>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Events entdecken</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {viewMode === "map" ? "Alle Events auf der Karte — Karte anklicken für Details" : "Alle Kinderaktivitäten in der Region Zürich"}
          </p>
        </header>

        {/* Search & Filters — always visible, apply to both views */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4 mb-5 space-y-4">

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/>
            </svg>
            <input
              id="kidgo-explore-search"
              type="text"
              placeholder="Event, Ort oder Aktivität suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 focus:border-transparent transition"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategories((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                  selectedCategories.includes(cat)
                    ? `${categoryColors[cat]?.split(" ").slice(0, 3).join(" ")} border-current shadow-sm font-semibold`
                    : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-kidgo-300 hover:text-kidgo-500"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Row 2: Age + Indoor/Outdoor + Gratis */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-xs text-[var(--text-muted)] font-medium">Alter:</span>
              {[{ key: "0-3", label: "0–3" }, { key: "4-6", label: "4–6" }, { key: "7-9", label: "7–9" }, { key: "10-12", label: "10–12" }].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedAgeBuckets((prev) => prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key])}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition border ${
                    selectedAgeBuckets.includes(key)
                      ? "bg-[var(--text-primary)] text-[var(--bg-card)] border-[var(--text-primary)]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[var(--bg-subtle)] rounded-xl p-1 border border-[var(--border)]">
              {([["all", "Alle"], ["indoor", "Indoor"], ["outdoor", "Outdoor"]] as [IndoorOutdoor, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setIndoorOutdoor(val)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    indoorOutdoor === val
                      ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setGratisOnly((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition border flex items-center gap-1.5 ${
                gratisOnly
                  ? "bg-green-500 text-white border-green-500 shadow-sm"
                  : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-green-400 hover:text-green-600"
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="5" r="4"/><path d="M3.5 5h3M5 3.5v3"/></svg>
              Gratis
            </button>
          </div>

          {/* Row 3: Date + Sort */}
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {([["all", "Alle"], ["today", "Heute"], ["weekend", "Wochenende"], ["week", "Woche"], ["month", "Monat"]] as ["all"|"today"|"weekend"|"week"|"month", string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDateFilter(key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition border ${
                    dateFilter === key
                      ? "bg-[var(--text-primary)] text-[var(--bg-card)] border-[var(--text-primary)]"
                      : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-gray-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {viewMode === "list" && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-[var(--text-muted)]">Sortierung:</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="text-xs bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg px-2 py-1 text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-kidgo-300 transition"
                >
                  <option value="date-asc">Datum auf.</option>
                  <option value="date-desc">Datum ab.</option>
                  <option value="newest">Neueste</option>
                </select>
              </div>
            )}
          </div>

          {/* Active filter pills */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[var(--border)]">
              <span className="text-xs text-[var(--text-muted)] self-center">Aktiv:</span>
              {activeFilters.map((f) => (
                <span key={f} className="text-xs bg-kidgo-50 text-kidgo-600 border border-kidgo-100 px-2 py-0.5 rounded-full">{f}</span>
              ))}
              <button onClick={clearAll} className="text-xs text-[var(--text-muted)] hover:text-red-500 transition ml-auto">Alle löschen</button>
            </div>
          )}

          {/* Weather hint */}
          {isBadWeather && viewMode === "list" && (
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 1v1M7 12v1M1 7h1M12 7h1M3 3l.7.7M10.3 10.3l.7.7M3 11l.7-.7M10.3 3.7l.7-.7"/><circle cx="7" cy="7" r="3"/></svg>
              Regnerisches Wetter — Indoor-Events werden bevorzugt
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">{error}</div>
        )}

        {/* MAP VIEW */}
        {viewMode === "map" && (
          <div className="mb-5">
            {loading ? (
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center" style={{ height: "58vh" }}>
                <div className="w-8 h-8 border-2 border-kidgo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ExploreMapView events={events} height="58vh" />
            )}
          </div>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card-enter" style={{ animationDelay: `${i * 80}ms` }}>
                  <SkeletonCard />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <div className="empty-float mx-auto mb-5 w-20 h-20">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="80" height="80" rx="20" fill="var(--accent-light)"/>
                  <circle cx="36" cy="38" r="14" stroke="#5BBAA7" strokeWidth="2.2" fill="none"/>
                  <path d="M46 48l10 10" stroke="#5BBAA7" strokeWidth="2.2" strokeLinecap="round"/>
                  <path d="M30 38h12M36 32v12" stroke="#5BBAA7" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.5"/>
                </svg>
              </div>
              <p className="text-[var(--text-primary)] font-semibold mb-1">
                {search || selectedCategories.length > 0 || activeFilters.length > 0
                  ? "Keine Events für diese Filter"
                  : "Suchbegriff eingeben oder Kategorie wählen"}
              </p>
              <p className="text-[var(--text-muted)] text-sm mb-4">Passe die Filter oben an</p>
              {activeFilters.length > 0 && (
                <button onClick={clearAll} className="text-sm text-kidgo-500 hover:text-kidgo-600 transition underline">
                  Filter zurücksetzen
                </button>
              )}
            </div>
          ) : (() => {
            const dateFiltered     = filterByDate(events);
            const futureEvents     = applySort(dateFiltered.filter((e) => e.datum));
            const allYearActivities = applySort(dateFiltered.filter((e) => !e.datum));

            return (
              <div className="space-y-10">
                {futureEvents.length > 0 && (
                  <section>
                    <div className="flex items-baseline gap-2 mb-4">
                      <h2 className="text-base font-semibold text-[var(--text-primary)]">Anstehende Events</h2>
                      <span className="text-sm text-[var(--text-muted)]">{futureEvents.length}</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {futureEvents.slice(0, visibleCountFuture).map((event: any, i: number) => (
                        <div key={event.id} className="card-enter" style={{ animationDelay: `${i * 40}ms` }}>
                          <EventCard event={event} source={getSource(event.quelle_id)} serienCount={serienCounts[event.id] || 0} formatDate={formatDate} />
                        </div>
                      ))}
                    </div>
                    {visibleCountFuture < futureEvents.length && (
                      <div className="text-center mt-6">
                        <button
                          onClick={() => setVisibleCountFuture((v) => v + PAGE_SIZE)}
                          className="px-6 py-2.5 border border-[var(--kidgo-teal)] text-[var(--kidgo-teal)] text-sm font-semibold rounded-full hover:bg-[var(--accent-light)] transition-all duration-200 ease-out"
                        >
                          {futureEvents.length - visibleCountFuture} weitere laden
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {allYearActivities.length > 0 && (
                  <LazySection>
                    <section>
                      <div className="flex items-baseline gap-2 mb-4">
                        <h2 className="text-base font-semibold text-[var(--text-primary)]">Ganzjährig geöffnet</h2>
                        <span className="text-sm text-[var(--text-muted)]">{allYearActivities.length}</span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {allYearActivities.slice(0, visibleCountAllYear).map((activity: any, i: number) => (
                          <div key={activity.id} className="card-enter" style={{ animationDelay: `${i * 40}ms` }}>
                            <EventCard event={activity} source={getSource(activity.quelle_id)} serienCount={serienCounts[activity.id] || 0} formatDate={formatDate} />
                          </div>
                        ))}
                      </div>
                      {visibleCountAllYear < allYearActivities.length && (
                        <div className="text-center mt-6">
                          <button
                            onClick={() => setVisibleCountAllYear((v) => v + PAGE_SIZE)}
                            className="px-6 py-2.5 border border-[var(--kidgo-teal)] text-[var(--kidgo-teal)] text-sm font-semibold rounded-full hover:bg-[var(--accent-light)] transition-all duration-200 ease-out"
                          >
                            {allYearActivities.length - visibleCountAllYear} weitere laden
                          </button>
                        </div>
                      )}
                    </section>
                  </LazySection>
                )}
              </div>
            );
          })()
        )}
      </div>

      {showScrollTop && viewMode === "list" && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-20 right-4 z-50 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] rounded-full w-10 h-10 flex items-center justify-center shadow-md hover:shadow-lg hover:border-kidgo-300 hover:text-kidgo-500 transition-all"
          title="Nach oben"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 12V4M4 8l4-4 4 4"/></svg>
        </button>
      )}
    </main>
  );
}

"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { trackMapOpened } from "@/lib/gamification";

const ZH_CITIES: Record<string, [number, number]> = {
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

function getCoords(ort: string | null): [number, number] | null {
  if (!ort) return null;
  const lower = ort.toLowerCase();
  for (const [city, coords] of Object.entries(ZH_CITIES)) {
    if (lower.includes(city.toLowerCase())) return coords;
  }
  return null;
}

const CITY_SEARCH = Object.entries(ZH_CITIES).reduce(
  (acc, [name, coords]) => ({ ...acc, [name.toLowerCase()]: coords }),
  {} as Record<string, [number, number]>
);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function findCityCoords(query: string): [number, number] | null {
  const q = query.toLowerCase().trim();
  for (const [name, coords] of Object.entries(CITY_SEARCH)) {
    if (name.includes(q) || q.includes(name)) return coords;
  }
  return null;
}

function MapPageInner() {
  const searchParams  = useSearchParams();
  const mapRef        = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [events, setEvents]       = useState<any[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [mapReady, setMapReady]   = useState(false);
  const [search, setSearch]       = useState(searchParams.get("city") ?? "");
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  useEffect(() => {
    trackMapOpened();
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("events")
      .select("id, titel, datum, ort")
      .eq("status", "approved")
      .gte("datum", today)
      .order("datum", { ascending: true })
      .limit(300)
      .then(({ data }) => {
        setEvents(data || []);
      });
  }, []);

  useEffect(() => {
    if (!mapRef.current || events.length === 0) return;

    const isDark = document.documentElement.classList.contains("dark");

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapRef.current, {
        center: [47.37, 8.54],
        zoom: 10,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      if (isDark) {
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
          }
        ).addTo(map);
      } else {
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
      }

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:#f97316;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.35)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -8],
      });

      let placed = 0;
      const coordCount: Record<string, number> = {};

      for (const ev of events) {
        const coords = getCoords(ev.ort);
        if (!coords) continue;

        const key = coords.join(",");
        const n = coordCount[key] || 0;
        coordCount[key] = n + 1;

        // Small spiral offset so markers at same city don't perfectly overlap
        const angle = n * 1.2;
        const radius = n === 0 ? 0 : 0.003 + n * 0.002;
        const lat = coords[0] + radius * Math.cos(angle);
        const lon = coords[1] + radius * Math.sin(angle);

        const dateStr = ev.datum
          ? new Date(ev.datum + "T00:00:00").toLocaleDateString("de-CH", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "";

        const safeTitel = escapeHtml(ev.titel ?? "");
        const safeOrt = ev.ort ? escapeHtml(ev.ort) : "";
        const safeId = encodeURIComponent(ev.id);
        const popup = `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:220px;line-height:1.4">
            <p style="font-weight:700;font-size:13px;margin:0 0 5px;color:#111">${safeTitel}</p>
            ${dateStr ? `<p style="font-size:11px;color:#6b7280;margin:0 0 2px">${dateStr}</p>` : ""}
            ${safeOrt ? `<p style="font-size:11px;color:#6b7280;margin:0 0 8px">${safeOrt}</p>` : ""}
            <a href="/events/${safeId}" style="font-size:12px;color:#f97316;font-weight:600;text-decoration:none">Details ansehen →</a>
          </div>
        `;

        L.marker([lat, lon], { icon }).bindPopup(popup).addTo(map);
        placed++;
      }

      setEventCount(placed);
      setMapReady(true);

      // Auto-pan if city param provided
      const cityParam = searchParams.get("city");
      if (cityParam) {
        const coords = findCityCoords(cityParam);
        if (coords) map.flyTo(coords, 13, { duration: 1 });
      }
    };

    if ((window as any).L) {
      initMap();
      return;
    }

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const existing = document.getElementById("leaflet-js");
    if (existing) {
      existing.addEventListener("load", initMap);
      return;
    }

    const script = document.createElement("script");
    script.id = "leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = initMap;
    document.head.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [events]);

  const handleSearch = () => {
    const q = search.trim();
    if (!q || !mapInstanceRef.current) return;
    const coords = findCityCoords(q);
    if (coords) {
      mapInstanceRef.current.flyTo(coords, 13, { duration: 0.8 });
      setSearchMsg(null);
    } else {
      setSearchMsg(`"${q}" nicht gefunden. Versuche: ${Object.keys(ZH_CITIES).join(", ")}`);
    }
  };

  return (
    <main id="main-content" className="min-h-screen pb-14 md:pb-0 bg-[var(--bg-page)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-card)] z-10">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11L5 7l4-4" />
            </svg>
            Zurück
          </Link>
          <h1 className="font-bold text-[var(--text-primary)] text-base flex-shrink-0">
            Events auf der Karte
          </h1>
          {mapReady && (
            <span className="ml-auto text-xs text-[var(--text-muted)] flex-shrink-0">
              {eventCount} Events
            </span>
          )}
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSearchMsg(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Stadt oder Ort suchen — z.B. Winterthur"
              className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] transition"
            />
            <button
              onClick={handleSearch}
              disabled={!search.trim()}
              aria-label="Karte zentrieren"
              className="bg-[var(--accent)] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 flex-shrink-0 flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="4"/><path d="M10 10l2.5 2.5"/>
              </svg>
              <span className="hidden sm:inline">Suchen</span>
            </button>
          </div>
          {searchMsg && (
            <p className="text-xs text-[var(--text-muted)] mt-1.5 px-1">{searchMsg}</p>
          )}
          {/* Quick city chips */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {Object.keys(ZH_CITIES).slice(0, 5).map((city) => (
              <button
                key={city}
                onClick={() => {
                  setSearch(city);
                  setSearchMsg(null);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo(ZH_CITIES[city], 13, { duration: 0.8 });
                  }
                }}
                className="text-xs bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-1 rounded-full hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
              >
                {city}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map container */}
      <div
        ref={mapRef}
        style={{ flex: 1, minHeight: "calc(100dvh - 53px)" }}
      />

      {!mapReady && events.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-8 h-8 border-2 border-kidgo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </main>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-kidgo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MapPageInner />
    </Suspense>
  );
}

"use client";

import { useRef, useEffect, useState } from "react";

const ZH_CITIES: Record<string, [number, number]> = {
  Zürich:      [47.37, 8.54],
  Winterthur:  [47.50, 8.72],
  Uster:       [47.35, 8.72],
  Wädenswil:   [47.23, 8.67],
  Horgen:      [47.26, 8.60],
  Schlieren:   [47.40, 8.45],
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findCity(q: string): [number, number] | null {
  const lower = q.toLowerCase().trim();
  for (const [name, coords] of Object.entries(ZH_CITIES)) {
    if (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase())) return coords;
  }
  return null;
}

interface ExploreMapViewProps {
  events: any[];
  height?: string;
}

export function ExploreMapView({ events, height = "58vh" }: ExploreMapViewProps) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const instanceRef    = useRef<any>(null);
  const [placed, setPlaced]       = useState(0);
  const [ready, setReady]         = useState(false);
  const [search, setSearch]       = useState("");
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const isDark = document.documentElement.classList.contains("dark");

    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapRef.current) return;

      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }

      const map = L.map(mapRef.current, { center: [47.37, 8.54], zoom: 10 });
      instanceRef.current = map;

      if (isDark) {
        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap &copy; CARTO",
          subdomains: "abcd",
        }).addTo(map);
      } else {
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap",
        }).addTo(map);
      }

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;background:#5BBAA7;border-radius:50%;border:2.5px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.3)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -8],
      });

      const coordCount: Record<string, number> = {};
      let count = 0;

      for (const ev of events) {
        const coords = getCoords(ev.ort);
        if (!coords) continue;
        const key = coords.join(",");
        const n = coordCount[key] || 0;
        coordCount[key] = n + 1;
        const angle  = n * 1.2;
        const r      = n === 0 ? 0 : 0.003 + n * 0.002;
        const lat    = coords[0] + r * Math.cos(angle);
        const lon    = coords[1] + r * Math.sin(angle);

        const safeTitel = escapeHtml(ev.titel ?? "");
        const safeOrt   = ev.ort ? escapeHtml(ev.ort) : "";
        const dateStr   = ev.datum
          ? new Date(ev.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })
          : "";

        const popup = `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:220px;line-height:1.4">
            <p style="font-weight:700;font-size:13px;margin:0 0 4px;color:#111">${safeTitel}</p>
            ${dateStr ? `<p style="font-size:11px;color:#6b7280;margin:0 0 2px">${dateStr}</p>` : ""}
            ${safeOrt ? `<p style="font-size:11px;color:#6b7280;margin:0 0 8px">${safeOrt}</p>` : ""}
            <a href="/events/${encodeURIComponent(ev.id)}" style="font-size:12px;color:#5BBAA7;font-weight:600;text-decoration:none">Details →</a>
          </div>`;

        L.marker([lat, lon], { icon }).bindPopup(popup).addTo(map);
        count++;
      }

      setPlaced(count);
      setReady(true);
    };

    if ((window as any).L) {
      initMap();
    } else {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id   = "leaflet-css";
        link.rel  = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const existing = document.getElementById("leaflet-js");
      if (existing) {
        existing.addEventListener("load", initMap, { once: true });
      } else {
        const script    = document.createElement("script");
        script.id       = "leaflet-js";
        script.src      = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload   = initMap;
        document.head.appendChild(script);
      }
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.remove();
        instanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const handleCityClick = (city: string) => {
    setSearch(city);
    setSearchMsg(null);
    if (instanceRef.current && ZH_CITIES[city]) {
      instanceRef.current.flyTo(ZH_CITIES[city], 13, { duration: 0.8 });
    }
  };

  const handleSearch = () => {
    const coords = findCity(search);
    if (coords && instanceRef.current) {
      instanceRef.current.flyTo(coords, 13, { duration: 0.8 });
      setSearchMsg(null);
    } else {
      setSearchMsg(`"${search}" nicht gefunden.`);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-card)]">
      {/* Controls */}
      <div className="px-4 pt-3 pb-2 border-b border-[var(--border)]">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchMsg(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Stadt suchen..."
            className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 transition"
          />
          <button
            onClick={handleSearch}
            aria-label="Suchen"
            className="bg-[var(--accent)] text-white rounded-xl px-3 py-2 hover:opacity-90 transition"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="4" /><path d="M10 10l2.5 2.5" />
            </svg>
          </button>
        </div>
        {searchMsg && <p className="text-xs text-red-500 mb-1.5">{searchMsg}</p>}
        <div className="flex gap-1.5 flex-wrap items-center">
          {Object.keys(ZH_CITIES).slice(0, 6).map((city) => (
            <button
              key={city}
              onClick={() => handleCityClick(city)}
              className="text-xs bg-[var(--bg-subtle)] border border-[var(--border)] text-[var(--text-secondary)] px-2.5 py-0.5 rounded-full hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              {city}
            </button>
          ))}
          {ready && (
            <span className="text-xs text-[var(--text-muted)] ml-auto">{placed} Events</span>
          )}
        </div>
      </div>

      {/* Map container */}
      <div style={{ position: "relative" }}>
        <div ref={mapRef} style={{ height, minHeight: "320px" }} />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-subtle)] pointer-events-none">
            <div className="w-8 h-8 border-2 border-kidgo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

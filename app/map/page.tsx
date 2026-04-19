"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [mapReady, setMapReady] = useState(false);

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

        const popup = `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:220px;line-height:1.4">
            <p style="font-weight:700;font-size:13px;margin:0 0 5px;color:#111">${ev.titel}</p>
            ${dateStr ? `<p style="font-size:11px;color:#6b7280;margin:0 0 2px">${dateStr}</p>` : ""}
            ${ev.ort ? `<p style="font-size:11px;color:#6b7280;margin:0 0 8px">${ev.ort}</p>` : ""}
            <a href="/events/${ev.id}" style="font-size:12px;color:#f97316;font-weight:600;text-decoration:none">Details ansehen →</a>
          </div>
        `;

        L.marker([lat, lon], { icon }).bindPopup(popup).addTo(map);
        placed++;
      }

      setEventCount(placed);
      setMapReady(true);
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

  return (
    <main className="min-h-screen bg-[var(--bg-page)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-card)] z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11L5 7l4-4" />
          </svg>
          Zurück
        </Link>
        <h1 className="font-bold text-[var(--text-primary)] text-base">
          Events auf der Karte
        </h1>
        {mapReady && (
          <span className="ml-auto text-xs text-[var(--text-muted)]">
            {eventCount} Events
          </span>
        )}
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

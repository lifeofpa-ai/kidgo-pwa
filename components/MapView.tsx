"use client";

import { useEffect, useRef } from "react";

const L = typeof window !== "undefined" ? require("leaflet") : null;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface Source {
  id: string;
  name: string;
  kategorie: string;
  latitude?: number;
  longitude?: number;
}

interface MapViewProps {
  sources: Source[];
  onSourceClick?: (source: Source) => void;
}

export default function MapView({ sources, onSourceClick }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapContainer.current || !L) return;

    // Initialize map (centered on Zürich)
    const map = L.map(mapContainer.current).setView([47.3769, 8.5472], 12);

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    // Category colors
    const categoryColors: { [key: string]: string } = {
      Sport: "#ef4444",
      "Kultur & Bildung": "#3b82f6",
      "Öffentliche Stelle": "#8b5cf6",
      Jugendverband: "#ec4899",
      Kommerziell: "#f59e0b",
      Nische: "#6366f1",
    };

    // Add markers for sources
    sources.forEach((source) => {
      const lat = source.latitude || 47.3769;
      const lng = source.longitude || 8.5472;
      const color = categoryColors[source.kategorie] || "#6366f1";

      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        fillColor: color,
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .addTo(map)
        .bindPopup(
          `<div class="p-2">
            <strong>${escapeHtml(source.name ?? "")}</strong><br/>
            <span class="text-sm text-gray-600">${escapeHtml(source.kategorie ?? "")}</span>
          </div>`
        );

      marker.on("click", () => {
        if (onSourceClick) onSourceClick(source);
      });

      markersRef.current.push(marker);
    });

    // Cleanup
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      mapInstance.current?.remove();
    };
  }, [sources, onSourceClick]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-96 rounded-lg border border-gray-300 shadow-lg"
      style={{ zIndex: 10 }}
    />
  );
}

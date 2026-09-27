"use client";

import { useCallback, useEffect, useState } from "react";
import { haversine, ZH_CITIES } from "@/lib/home-constants";
import type { UserLocation } from "@/types/home";

const STORAGE_KEY = "kidgo_location";

function snapToZH(lat: number, lon: number): { label: string; lat: number; lon: number } {
  let nearest = "Zürich";
  let minDist = Infinity;
  for (const [city, [clat, clon]] of Object.entries(ZH_CITIES)) {
    const d = haversine(lat, lon, clat, clon);
    if (d < minDist) { minDist = d; nearest = city; }
  }
  const [slat, slon] = ZH_CITIES[nearest];
  return { label: nearest, lat: slat, lon: slon };
}

function persist(loc: UserLocation) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch {}
}

/**
 * Echter Standort des Nutzers — GPS mit IP-Fallback (auf die nächstgelegene
 * ZH-Stadt "gesnapped", damit eine ungenaue IP-Ortung nicht mitten im Feld
 * landet). Aus app/page.tsx herausgelöst (27.09.2026), damit Explore, die
 * Ich-Seite und das Onboarding denselben realen Standort verwenden können,
 * statt weiterhin mit einem fix verdrahteten "ab Zürich" zu rechnen — das war
 * der Kernbefund der Radius-UX-Analyse vom 27.09.2026.
 */
export function useUserLocation() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  const requestPreciseLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Dein Standort",
          approximate: false,
        };
        setUserLocation(loc);
        persist(loc);
      },
      () => {},
      { timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const loc = JSON.parse(cached);
        if (loc?.lat && loc?.lon) setUserLocation(loc);
      }
    } catch {}

    const fallbackToIp = () => {
      fetch("https://ipapi.co/json/")
        .then((r) => r.json())
        .then((d) => {
          if (d.latitude && d.longitude) {
            const snapped = snapToZH(parseFloat(d.latitude), parseFloat(d.longitude));
            const loc: UserLocation = { ...snapped, approximate: true };
            setUserLocation(loc);
            persist(loc);
          }
        })
        .catch(() => {});
    };

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      fallbackToIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc: UserLocation = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Dein Standort",
          approximate: false,
        };
        setUserLocation(loc);
        persist(loc);
      },
      fallbackToIp,
      { timeout: 5000 }
    );
    // Einmalig beim Mount — ein manueller Refresh läuft über requestPreciseLocation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { userLocation, requestPreciseLocation };
}

"use client";

import Link from "next/link";
import type { KidgoEvent } from "@/types/home";
import { LazySection } from "@/components/home/LazySection";
import { hasSpecificHours, isDauerangebot, openingHours } from "@/lib/dauerangebot";

// "Heute spontan" — Dauerangebote (Museen, Parks, Erlebniswege …), die ohne
// Termin jederzeit funktionieren. Wetterbewusst: bei Regen (WMO-Code >= 51,
// gleiche Schwelle wie buildChatResponse in app/page.tsx) nur Indoor/"beides",
// sonst Outdoor zuerst. Alter: Überschneidung mit den gewählten Altersgruppen,
// falls welche gesetzt sind.

interface SpontanSectionProps {
  allEventsPool: KidgoEvent[];
  weatherCode: number | null;
  selectedBuckets: string[];
  now: Date;
}

const MAX_ITEMS = 8;

/** Deterministischer Tages-Shuffle, damit die Auswahl täglich wechselt, aber
 *  innerhalb eines Tages stabil bleibt (kein Springen bei Re-Render). */
function daySeedHash(id: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

export function SpontanSection({ allEventsPool, weatherCode, selectedBuckets, now }: SpontanSectionProps) {
  const isRainy = weatherCode !== null && weatherCode >= 51;
  const seed = Number(`${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`);

  const items = allEventsPool
    .filter((e) => isDauerangebot(e))
    .filter((e) => {
      if (!isRainy) return true;
      return e.indoor_outdoor === "indoor" || e.indoor_outdoor === "beides";
    })
    .filter((e) => {
      if (selectedBuckets.length === 0 || !e.alters_buckets?.length) return true;
      return e.alters_buckets.some((b) => selectedBuckets.includes(b));
    })
    .map((e) => {
      let rank = 0;
      if (hasSpecificHours(e)) rank += 2; // konkrete Öffnungszeiten zuerst
      if (e.kategorie_bild_url) rank += 1;
      if (!isRainy && e.indoor_outdoor === "outdoor") rank += 1;
      return { e, rank, tie: daySeedHash(e.id, seed) };
    })
    .sort((a, b) => b.rank - a.rank || a.tie - b.tie)
    .slice(0, MAX_ITEMS)
    .map((x) => x.e);

  if (items.length === 0) return null;

  const title = isRainy ? "Heute spontan – auch bei Regen" : "Heute spontan";
  const subtitle = isRainy
    ? "Drinnen-Tipps ohne Termin: einfach hingehen"
    : "Ohne Termin, ohne Anmeldung: einfach losziehen";

  return (
    <LazySection fallback={<div className="mt-10 h-56 skeleton rounded-2xl" />}>
      <div className="mt-8 card-enter">
        <div className="bg-gradient-to-r from-sky-500 to-cyan-400 rounded-2xl px-5 pt-5 pb-4 mb-3">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
            Immer offen
          </p>
          <h2 className="text-xl font-bold text-white mb-0.5">{title}</h2>
          <p className="text-white/80 text-sm">{subtitle}</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
          {items.map((e) => {
            const hours = openingHours(e);
            return (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="flex-shrink-0 w-48 snap-start bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] hover:border-kidgo-200 hover:shadow-md transition-all overflow-hidden group"
              >
                <div className="h-32 overflow-hidden relative">
                  {e.kategorie_bild_url ? (
                    <img src={e.kategorie_bild_url} alt={e.titel} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-sky-100 to-cyan-50 dark:from-sky-900/40 dark:to-cyan-900/40" />
                  )}
                  <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 text-sky-700">
                    Immer offen
                  </span>
                </div>
                <div className="p-3">
                  <p className="font-bold text-xs text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors mb-1">{e.titel}</p>
                  {hours && <p className="text-xs text-sky-700 dark:text-sky-300 font-medium line-clamp-2">{hours}</p>}
                  {e.ort && <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{e.ort.split(",")[0]}</p>}
                </div>
              </Link>
            );
          })}
          <Link
            href="/explore"
            className="flex-shrink-0 w-28 snap-start bg-[var(--bg-subtle)] border border-dashed border-[var(--border)] rounded-2xl flex flex-col items-center justify-center gap-2 p-3 hover:border-kidgo-300 transition-all group"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-hover:text-kidgo-500 transition-colors">
              <path d="M9 3v12M3 9h12"/>
            </svg>
            <p className="text-xs font-medium text-[var(--text-muted)] group-hover:text-kidgo-500 transition-colors text-center leading-tight">Alle entdecken</p>
          </Link>
        </div>
      </div>
    </LazySection>
  );
}

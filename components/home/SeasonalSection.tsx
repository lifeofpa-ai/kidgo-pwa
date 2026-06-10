"use client";

import Link from "next/link";
import type { KidgoEvent } from "@/types/home";
import { LazySection } from "@/components/home/LazySection";

interface SeasonalSectionProps {
  allEventsPool: KidgoEvent[];
  now: Date;
}

type SeasonCfg = {
  title: string;
  subtitle: string;
  gradFrom: string;
  gradTo: string;
  cats: string[];
  io: string | null;
};

const MONTH_NAMES = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function getSeasonConfig(month: number): SeasonCfg {
  if (month <= 1)  return { title: "Gemütliche Wintertage",   subtitle: "Die schönsten Indoor-Aktivitäten für Kinder", gradFrom: "from-indigo-500", gradTo: "to-blue-400",    cats: ["Kreativ","Theater","Musik","Bildung"],           io: "indoor"  };
  if (month <= 2)  return { title: "Frühling naht!",           subtitle: "Natur erwacht — raus und entdecken",          gradFrom: "from-green-500",  gradTo: "to-emerald-400",  cats: ["Natur","Ausflug","Sport","Tiere"],                io: "outdoor" };
  if (month <= 4)  return { title: "Raus in die Natur",        subtitle: "Frühling in Zürich — beste Zeit für Abenteuer", gradFrom: "from-emerald-500", gradTo: "to-teal-400", cats: ["Natur","Ausflug","Sport","Tiere"],                io: "outdoor" };
  if (month <= 7)  return { title: "Sommer in Zürich",         subtitle: "Camps, Abenteuer & lange Sonnentage",         gradFrom: "from-amber-500",  gradTo: "to-orange-400",   cats: ["Feriencamp","Ausflug","Sport","Natur"],          io: "outdoor" };
  if (month <= 9)  return { title: "Goldener Herbst",          subtitle: "Herbstfarben entdecken und erleben",          gradFrom: "from-orange-500", gradTo: "to-amber-400",    cats: ["Natur","Ausflug","Bildung","Museum"],            io: null      };
  return             { title: "Drinnen & Kreativ",        subtitle: "Warme Stunden mit Kunst, Musik und Theater",  gradFrom: "from-purple-500", gradTo: "to-rose-400",     cats: ["Kreativ","Theater","Musik","Tanz"],              io: "indoor"  };
}

export function SeasonalSection({ allEventsPool, now }: SeasonalSectionProps) {
  if (allEventsPool.length === 0) return null;

  const month = now.getMonth();
  const cfg = getSeasonConfig(month);

  const seasonEvents = allEventsPool
    .filter((e) => {
      const catOk = e.kategorien?.some((c) => cfg.cats.includes(c));
      const ioOk = !cfg.io || !e.indoor_outdoor || e.indoor_outdoor === cfg.io || e.indoor_outdoor === "beides";
      return catOk && ioOk;
    })
    .sort((a, b) => {
      if (a.datum && !b.datum) return -1;
      if (!a.datum && b.datum) return 1;
      if (a.datum && b.datum) return a.datum.localeCompare(b.datum);
      return 0;
    })
    .slice(0, 6);

  if (seasonEvents.length === 0) return null;

  return (
    <LazySection fallback={<div className="mt-10 h-56 skeleton rounded-2xl" />}>
      <div className="mt-8 card-enter">
        <div className={`bg-gradient-to-r ${cfg.gradFrom} ${cfg.gradTo} rounded-2xl px-5 pt-5 pb-4 mb-3`}>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
            Saisontipp · {MONTH_NAMES[month]}
          </p>
          <h2 className="text-xl font-bold text-white mb-0.5">{cfg.title}</h2>
          <p className="text-white/80 text-sm">{cfg.subtitle}</p>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
          {seasonEvents.map((e) => (
            <Link
              key={e.id}
              href={`/events/${e.id}`}
              className="flex-shrink-0 w-48 snap-start bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] hover:border-kidgo-200 hover:shadow-md transition-all overflow-hidden group"
            >
              <div className="h-32 overflow-hidden">
                {e.kategorie_bild_url ? (
                  <img src={e.kategorie_bild_url} alt={e.titel} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40" />
                )}
              </div>
              <div className="p-3">
                <p className="font-bold text-xs text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors mb-1">{e.titel}</p>
                {e.datum ? (
                  <p className="text-xs font-medium text-kidgo-500">
                    {new Date(e.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                  </p>
                ) : (
                  <p className="text-xs text-green-600 font-medium">Ganzjährig</p>
                )}
                {e.ort && <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{e.ort.split(",")[0]}</p>}
              </div>
            </Link>
          ))}
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

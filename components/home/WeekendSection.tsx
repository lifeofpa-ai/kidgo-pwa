"use client";

import Link from "next/link";
import type { KidgoEvent } from "@/types/home";
import { saveScrollPosition } from "@/lib/interactions";
import { LazySection } from "@/components/home/LazySection";

interface WeekendSectionProps {
  weekendEvents: KidgoEvent[];
}

export function WeekendSection({ weekendEvents }: WeekendSectionProps) {
  if (weekendEvents.length === 0) return null;

  return (
    <LazySection className="mt-8" fallback={<div className="mt-8 h-48 skeleton rounded-2xl" />}>
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Dieses Wochenende</p>
          <Link href="/explore" className="text-xs font-semibold text-kidgo-500 hover:text-kidgo-600 transition">
            Alle →
          </Link>
        </div>
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
        >
          {weekendEvents.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="flex-shrink-0 w-44 group"
              onClick={() => { try { saveScrollPosition(window.location.pathname); } catch {} }}
            >
              <div className="rounded-2xl overflow-hidden border border-[var(--border)] hover:border-[#5BBAA7]/40 transition-all hover:shadow-md" style={{ boxShadow: "0 2px 8px rgba(91,186,167,0.08)" }}>
                <div className="h-28 bg-gradient-to-br from-[#F5F0E8] to-kidgo-50 relative overflow-hidden">
                  {event.kategorie_bild_url ? (
                    <img src={event.kategorie_bild_url} alt={event.titel} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                      </svg>
                    </div>
                  )}
                  {event.datum && (
                    <div className="absolute bottom-2 left-2">
                      <span className="text-[10px] font-bold text-white bg-[#5BBAA7] rounded-full px-2 py-0.5">
                        {new Date(event.datum + "T00:00:00").toLocaleDateString("de-CH", { weekday: "short", day: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3 bg-[var(--bg-card)]">
                  <p className="text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[#5BBAA7] transition-colors">{event.titel}</p>
                  {event.ort && <p className="text-[10px] text-[var(--text-muted)] mt-1 truncate">{event.ort.split(",")[0].trim()}</p>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </LazySection>
  );
}

"use client";

import Link from "next/link";
import type { ScoredEvent, CompactEvent, EventSource, UserLocation } from "@/types/home";
import { getCategoryColor, getCountdownLabel } from "@/lib/home-constants";
import { saveScrollPosition } from "@/lib/interactions";
import { trackEvent, trackFirstEventClick } from "@/lib/analytics";
import { EventImage } from "@/components/home/EventCards";

interface HeroSectionProps {
  contextRecs: ScoredEvent[];
  recommendations: ScoredEvent[];
  bookmarks: CompactEvent[];
  now: Date;
  /** "Nicht für uns" — direkt, ohne Begründung (Toast mit Rückgängig übernimmt die Page). */
  onDismiss: (event: ScoredEvent) => void;
  onBookmark: (event: ScoredEvent, e: React.MouseEvent) => void;
}

export function HeroSection({
  contextRecs,
  recommendations,
  bookmarks,
  now,
  onDismiss,
  onBookmark,
}: HeroSectionProps) {
  if (contextRecs.length === 0) return null;

  const heroEvent = contextRecs[0];
  const isBookmarkedHero = bookmarks.some((b) => b.id === heroEvent.id);

  return (
    <div className="mb-8">
      {/* Hero card — first recommendation */}
      <div className="relative mb-3">
        <div>
          <Link
            href={`/events/${heroEvent.id}`}
            className="block group"
            onClick={() => {
              try { saveScrollPosition(window.location.pathname); } catch {}
              trackEvent("event_click", { event_id: heroEvent.id, source: "home_hero" });
              trackFirstEventClick(heroEvent.id, heroEvent.titel);
            }}
          >
            <div className="relative rounded-2xl overflow-hidden" style={{ boxShadow: "0 4px 24px rgba(91,186,167,0.2)" }}>
              <EventImage
                url={heroEvent.kategorie_bild_url}
                kategorien={heroEvent.kategorien}
                className="h-64 sm:h-72 w-full overflow-hidden"
                title={heroEvent.titel}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
              {/* Bookmark button top-right */}
              <button
                onClick={(e) => onBookmark(heroEvent, e)}
                aria-label={isBookmarkedHero ? "Aus Merkliste entfernen" : "Event merken"}
                className={`absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full shadow-md transition-all active:scale-90 ${
                  isBookmarkedHero
                    ? "bg-kidgo-400 text-white"
                    : "bg-white/90 text-gray-400 hover:text-kidgo-500"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill={isBookmarkedHero ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 2h10v11L7 10 2 13V2z"/>
                </svg>
              </button>
              {/* Text overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-4 pb-5">
                <h2 className="text-white font-bold text-xl sm:text-2xl leading-tight mb-2 drop-shadow-sm line-clamp-2 group-hover:text-kidgo-100 transition-colors">
                  {heroEvent.titel}
                </h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80 text-sm mb-3">
                  {heroEvent.datum && (() => {
                    const { label, urgent } = getCountdownLabel(heroEvent.datum, now);
                    return (
                      <span className={`flex items-center gap-1 ${urgent ? "text-kidgo-200 font-semibold" : ""}`}>
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="0.5" y="1.5" width="11" height="9" rx="1.2"/><path d="M0.5 4.5h11M4 0.5v2M8 0.5v2"/></svg>
                        {label}
                      </span>
                    );
                  })()}
                  {!heroEvent.datum && <span className="text-green-300 font-semibold">Ganzjährig</span>}
                  {heroEvent.ort && (
                    <span className="flex items-center gap-1 truncate max-w-[200px]">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3z"/><circle cx="6" cy="4" r="1"/></svg>
                      {heroEvent.ort.split(",")[0].trim()}
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 bg-white text-kidgo-600 text-xs font-bold px-3.5 py-2 rounded-full group-hover:bg-kidgo-50 transition shadow-sm">
                  Details ansehen
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4-4-4-4"/></svg>
                </span>
              </div>
            </div>
          </Link>
        </div>
        {/* Dismiss button */}
        {(
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(heroEvent); }}
            aria-label="Nicht für uns"
            title="Nicht für uns"
            className="absolute top-3 right-14 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 backdrop-blur-sm transition-all active:scale-90"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8"/>
            </svg>
          </button>
        )}
      </div>

      {/* Sub-cards — recs 2 + 3 */}
      {recommendations.length > 1 && (
        <div className="grid grid-cols-2 gap-3">
          {recommendations.slice(1, 3).map((event) => {
            return (
              <div key={event.id} className="relative">
                <div>
                  <Link
                    href={`/events/${event.id}`}
                    className="group block"
                    onClick={() => {
                      try { saveScrollPosition(window.location.pathname); } catch {}
                      trackEvent("event_click", { event_id: event.id, source: "home_sub" });
                      trackFirstEventClick(event.id, event.titel);
                    }}
                  >
                    <div
                      className="rounded-xl overflow-hidden border border-[var(--border)] hover:border-kidgo-200 hover:shadow-md transition-all bg-[var(--bg-card)]"
                      style={{ borderLeft: `3px solid ${getCategoryColor(event.kategorien, event.kategorie)}` }}
                    >
                      <EventImage
                        url={event.kategorie_bild_url}
                        kategorien={event.kategorien}
                        className="h-28 w-full overflow-hidden"
                        title={event.titel}
                      />
                      <div className="p-3">
                        <h3 className="font-bold text-[var(--text-primary)] text-xs leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors mb-1.5">
                          {event.titel}
                        </h3>
                        <div className="flex items-center gap-1 text-xs">
                          {event.datum ? (
                            <span className={`font-semibold ${getCountdownLabel(event.datum, now).urgent ? "text-kidgo-500" : "text-[var(--text-muted)]"}`}>
                              {getCountdownLabel(event.datum, now).label}
                            </span>
                          ) : (
                            <span className="text-green-600 font-semibold">Ganzjährig</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
                {(
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(event); }}
                    aria-label="Nicht für uns"
                    className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-black/25 text-white hover:bg-black/45 backdrop-blur-sm transition-all active:scale-90"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2l-6 6"/>
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

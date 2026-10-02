"use client";

import type { ScoredEvent, CompactEvent, EventSource, UserLocation } from "@/types/home";
import { computeEntdeckerScore } from "@/lib/home-constants";
import { RecommendationCard } from "@/components/home/EventCards";

interface CardStackProps {
  recommendations: ScoredEvent[];
  contextRecs: ScoredEvent[];
  sources: EventSource[];
  userLocation: UserLocation | null;
  selectedBuckets: string[];
  seriesParentIds: Set<string>;
  smallSourceIds: Set<string>;
  sourceCountMap: Map<string, number>;
  bookmarkCounts: Map<string, number>;
  bookmarks: CompactEvent[];
  swipeOffset: number;
  swipeHint: "left" | "right" | null;
  showSwipeOnboarding?: boolean;
  showPersistentSwipeHint?: boolean;
  cardExiting: boolean;
  exitDirection: "left" | "right";
  /** Events, die der Nutzer per Swipe/♥ als "gefällt mir" markiert hat. */
  likedIds: Set<string>;
  onRecTouchStart: (e: React.TouchEvent) => void;
  onRecTouchMove: (e: React.TouchEvent) => void;
  onRecTouchEnd: (e: React.TouchEvent) => void;
  /** ✕ — "Nicht für uns" (gleiche Aktion wie Swipe nach links). */
  onSwipeLeft: () => void;
  /** ♥ — "Gefällt mir" (gleiche Aktion wie Swipe nach rechts). */
  onSwipeRight: () => void;
  onBookmark: (event: ScoredEvent, e: React.MouseEvent) => void;
}

export function CardStack({
  recommendations,
  contextRecs,
  sources,
  userLocation,
  selectedBuckets,
  seriesParentIds,
  smallSourceIds,
  sourceCountMap,
  bookmarkCounts,
  bookmarks,
  swipeOffset,
  swipeHint,
  showSwipeOnboarding = false,
  showPersistentSwipeHint = false,
  cardExiting,
  exitDirection,
  likedIds,
  onRecTouchStart,
  onRecTouchMove,
  onRecTouchEnd,
  onSwipeLeft,
  onSwipeRight,
  onBookmark,
}: CardStackProps) {
  if (recommendations.length === 0) return null;

  return (
    <>
      {/* Mobile card stack */}
      <div className="md:hidden relative select-none min-h-[420px] mb-4">
        {/* Background stacked cards */}
        {recommendations.slice(1, 3).map((event, ri) => {
          const stackPos = ri + 1;
          return (
            <div
              key={`stack-${event.id}`}
              className="absolute inset-x-0 top-0 pointer-events-none"
              aria-hidden="true"
              style={{
                zIndex: recommendations.length - stackPos,
                transform: `scale(${1 - stackPos * 0.035}) translateY(${stackPos * 13}px)`,
                transformOrigin: "center top",
                opacity: 1 - stackPos * 0.07,
              }}
            >
              <RecommendationCard
                event={event}
                reasons={event.reasons}
                sources={sources}
                userLocation={userLocation}
                animIndex={0}
                selectedBuckets={selectedBuckets}
                isSeriesParent={seriesParentIds.has(event.id)}
                isGeheimtipp={!!event.quelle_id && smallSourceIds.has(event.quelle_id)}
                entdeckerScore={computeEntdeckerScore(sourceCountMap.get(event.quelle_id || "") ?? 0)}
                isBookmarked={bookmarks.some((b) => b.id === event.id)}
                bookmarkCount={bookmarkCounts.get(event.id)}
              />
            </div>
          );
        })}

        {/* Top card */}
        {(() => {
          const event = recommendations[0];
          const cnt = sourceCountMap.get(event.quelle_id || "") ?? 0;
          return (
            <div
              className="absolute inset-x-0 top-0 card-stack-top"
              style={{
                zIndex: recommendations.length + 1,
                transform: cardExiting
                  ? `translateX(${exitDirection === "left" ? "-130%" : "130%"}) rotate(${exitDirection === "left" ? -13 : 13}deg)`
                  : `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.024}deg)`,
                transition: cardExiting
                  ? "transform 0.34s cubic-bezier(0.4,0,0.2,1)"
                  : swipeOffset === 0 ? "transform 0.2s ease" : "none",
              }}
              onTouchStart={onRecTouchStart}
              onTouchMove={onRecTouchMove}
              onTouchEnd={onRecTouchEnd}
            >
              <div className="relative">
                <div className={showSwipeOnboarding && !swipeHint ? "card-wiggle" : undefined}>
                  <RecommendationCard
                    key={event.id}
                    event={event}
                    reasons={event.reasons}
                    sources={sources}
                    userLocation={userLocation}
                    animIndex={0}
                    selectedBuckets={selectedBuckets}
                    isSeriesParent={seriesParentIds.has(event.id)}
                    isGeheimtipp={!!event.quelle_id && smallSourceIds.has(event.quelle_id)}
                    entdeckerScore={computeEntdeckerScore(cnt)}
                    isBookmarked={bookmarks.some((b) => b.id === event.id)}
                    onBookmark={(e) => onBookmark(event, e)}
                    bookmarkCount={bookmarkCounts.get(event.id)}
                  />
                </div>

                {/* Real-time swipe feedback (18.09.2026): stamp + color wash live
                    on the card itself, scaling with drag distance — attached to
                    the card's own transform (not a fixed-position overlay like
                    the old pill), so it visibly tracks the drag like a Tinder
                    stamp. Shows on every swipe, every time, not just first-use. */}
                {swipeHint && (() => {
                  const intensity = Math.min(Math.abs(swipeOffset) / 100, 1);
                  const isRight = swipeHint === "right";
                  return (
                    <>
                      <div
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        aria-hidden="true"
                        style={{
                          backgroundColor: isRight ? "rgb(34,197,94)" : "rgb(107,114,128)",
                          opacity: intensity * 0.28,
                          transition: "opacity 0.05s linear",
                        }}
                      />
                      <div
                        className={`absolute top-5 ${isRight ? "right-5" : "left-5"} pointer-events-none select-none`}
                        aria-hidden="true"
                        style={{
                          opacity: intensity,
                          transform: `scale(${0.8 + intensity * 0.2}) rotate(${isRight ? 10 : -10}deg)`,
                          transition: "opacity 0.05s linear, transform 0.05s linear",
                        }}
                      >
                        <div
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border-[3px] bg-white/95 font-extrabold text-base uppercase tracking-wide shadow-lg ${
                            isRight ? "border-green-500 text-green-500" : "border-gray-500 text-gray-600"
                          }`}
                        >
                          <span aria-hidden="true">{isRight ? "♥" : "✕"}</span>
                          <span>{isRight ? "Gefällt mir" : "Nicht für uns"}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {/* Persistent swipe affordance (21.09.2026): the one-time
                    onboarding overlay below is cancelled by the very first
                    touch, even a tap that never becomes a drag, so it often
                    never gets to teach anything. These small edge chevrons
                    are far subtler but stay on every card — not just once —
                    until the user has completed one real swipe, so the
                    "this card can be swiped" signal doesn't vanish before
                    it's been learned. */}
                {showPersistentSwipeHint && !swipeHint && !cardExiting && (
                  <>
                    <span className="swipe-affordance-edge swipe-affordance-left" aria-hidden="true">‹</span>
                    <span className="swipe-affordance-edge swipe-affordance-right" aria-hidden="true">›</span>
                  </>
                )}

              </div>
            </div>
          );
        })()}

        {/* Geste erklärt in Klartext (02.10.2026): bleibt sichtbar, bis der Nutzer
            zweimal wirklich gewischt hat — nicht nur beim allerersten Touch. */}
        {showPersistentSwipeHint && (
          <div
            className="absolute left-0 right-0 flex items-center justify-between px-4 text-xs font-bold text-[var(--text-muted)] pointer-events-none"
            style={{ bottom: "-26px" }}
            aria-hidden="true"
          >
            <span>← Nicht für uns</span>
            <span>Gefällt mir →</span>
          </div>
        )}

        {/* Zwei klare Buttons — antippen oder wischen, gleiche Wirkung */}
        <div className="absolute left-0 right-0 flex items-center justify-center gap-6" style={{ bottom: "-84px" }}>
          <button
            onClick={onSwipeLeft}
            aria-label="Nicht für uns"
            className="w-14 h-14 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:shadow-lg transition-all active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M4 4l12 12M16 4L4 16"/>
            </svg>
          </button>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 min-w-[56px] text-center tabular-nums">
            noch {recommendations.length}
          </span>
          <button
            onClick={onSwipeRight}
            aria-label={likedIds.has(recommendations[0].id) ? "Gefällt dir bereits" : "Gefällt mir"}
            className={`w-14 h-14 rounded-full shadow-md flex items-center justify-center transition-all active:scale-90 ${
              likedIds.has(recommendations[0].id)
                ? "bg-green-500 text-white border-2 border-green-400"
                : "bg-white dark:bg-gray-800 border-2 border-green-400 text-green-500 hover:shadow-lg"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop grid */}
      <div className="hidden md:grid md:grid-cols-2 gap-5 mb-8">
        {contextRecs.map((event, i) => {
          const cnt = sourceCountMap.get(event.quelle_id || "") ?? 0;
          return (
            <RecommendationCard
              key={event.id}
              event={event}
              reasons={event.reasons}
              sources={sources}
              userLocation={userLocation}
              animIndex={i}
              selectedBuckets={selectedBuckets}
              isSeriesParent={seriesParentIds.has(event.id)}
              isGeheimtipp={!!event.quelle_id && smallSourceIds.has(event.quelle_id)}
              entdeckerScore={computeEntdeckerScore(cnt)}
              isBookmarked={bookmarks.some((b) => b.id === event.id)}
              onBookmark={(e) => onBookmark(event, e)}
              bookmarkCount={bookmarkCounts.get(event.id)}
            />
          );
        })}
      </div>
    </>
  );
}

"use client";

import type { ScoredEvent, CompactEvent, EventSource, UserLocation } from "@/types/home";
import type { DismissReason } from "@/lib/dismiss-reasons";
import { computeEntdeckerScore } from "@/lib/home-constants";
import { RecommendationCard } from "@/components/home/EventCards";
import { DismissOverlay } from "@/components/home/DismissOverlay";

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
  cardExiting: boolean;
  exitDirection: "left" | "right";
  cardIndex: number;
  dismissingEventId: string | null;
  dismissReasons: DismissReason[];
  onRecTouchStart: (e: React.TouchEvent) => void;
  onRecTouchMove: (e: React.TouchEvent) => void;
  onRecTouchEnd: (e: React.TouchEvent) => void;
  onCycleCard: () => void;
  onSwipeRight: () => void;
  onDismissSubmit: (eventId: string, selectedReasonIds: string[]) => void;
  onDismissCancel: () => void;
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
  cardExiting,
  exitDirection,
  cardIndex,
  dismissingEventId,
  dismissReasons,
  onRecTouchStart,
  onRecTouchMove,
  onRecTouchEnd,
  onCycleCard,
  onSwipeRight,
  onDismissSubmit,
  onDismissCancel,
  onBookmark,
}: CardStackProps) {
  if (recommendations.length === 0) return null;

  return (
    <>
      {/* Mobile card stack */}
      <div className="md:hidden relative select-none min-h-[420px] mb-4">
        {/* Background stacked cards */}
        {recommendations.slice(1).map((event, ri) => {
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
          const isDismissingStack = dismissingEventId === event.id;
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
              onTouchStart={isDismissingStack ? undefined : onRecTouchStart}
              onTouchMove={isDismissingStack ? undefined : onRecTouchMove}
              onTouchEnd={isDismissingStack ? undefined : onRecTouchEnd}
            >
              <div className="relative">
                <div className={isDismissingStack ? "card-dimmed" : undefined}>
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
                {swipeHint && !isDismissingStack && (() => {
                  const intensity = Math.min(Math.abs(swipeOffset) / 100, 1);
                  const isRight = swipeHint === "right";
                  return (
                    <>
                      <div
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        aria-hidden="true"
                        style={{
                          backgroundColor: isRight ? "rgb(34,197,94)" : "rgb(248,113,113)",
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
                            isRight ? "border-green-500 text-green-500" : "border-red-400 text-red-400"
                          }`}
                        >
                          <span aria-hidden="true">{isRight ? "♥" : "✕"}</span>
                          <span>{isRight ? "Gemerkt" : "Nope"}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {isDismissingStack && (
                  <DismissOverlay
                    reasons={dismissReasons}
                    onSubmit={(ids) => onDismissSubmit(event.id, ids)}
                    onCancel={onDismissCancel}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* First-time swipe gesture hint (Sprint B, 17.09.2026): shown once
            so new users learn cards can be swiped, not just tapped via the
            buttons below. Hidden as soon as a real drag starts (swipeHint
            takes over) or the parent's own timer/first-touch clears it. */}
        {showSwipeOnboarding && !swipeHint && (
          <div
            className="swipe-hint-onboarding absolute inset-x-0 top-0 rounded-2xl pointer-events-none flex items-center justify-between px-5"
            style={{ height: "200px", zIndex: recommendations.length + 3 }}
            aria-hidden="true"
          >
            <div className="swipe-hint-nudge-left flex flex-col items-start gap-1.5">
              <span className="text-2xl leading-none text-red-400">←</span>
              <span className="px-3 py-1 rounded-full bg-red-400 text-white text-xs font-bold shadow-lg whitespace-nowrap">
                Nicht interessiert
              </span>
            </div>
            <div className="swipe-hint-nudge-right flex flex-col items-end gap-1.5">
              <span className="text-2xl leading-none text-green-500">→</span>
              <span className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-bold shadow-lg whitespace-nowrap">
                Gemerkt
              </span>
            </div>
          </div>
        )}

        {/* Counter + action buttons */}
        <div className="absolute left-0 right-0 flex items-center justify-center gap-6" style={{ bottom: "-56px" }}>
          <button
            onClick={onCycleCard}
            aria-label="Nächste Karte"
            className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md flex items-center justify-center text-gray-400 hover:text-kidgo-500 hover:border-kidgo-300 hover:shadow-lg transition-all active:scale-90"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9H4M4 9l5-5M4 9l5 5"/>
            </svg>
          </button>
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 min-w-[36px] text-center tabular-nums">
            {(cardIndex % recommendations.length) + 1}/{recommendations.length}
          </span>
          <button
            onClick={onSwipeRight}
            aria-label={bookmarks.some((b) => b.id === recommendations[0].id) ? "Event bereits gemerkt" : "Event merken"}
            className={`w-12 h-12 rounded-full shadow-md flex items-center justify-center transition-all active:scale-90 ${
              bookmarks.some((b) => b.id === recommendations[0].id)
                ? "bg-kidgo-400 text-white border border-kidgo-300"
                : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-kidgo-500 hover:border-kidgo-300 hover:shadow-lg"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill={bookmarks.some((b) => b.id === recommendations[0].id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h12v13.5L9 13.5 3 16.5V3z"/>
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

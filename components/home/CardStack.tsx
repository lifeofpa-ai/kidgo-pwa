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

        {/* Swipe hint */}
        {swipeHint && (
          <div
            className={`absolute top-0 left-0 right-0 rounded-2xl pointer-events-none flex items-center ${swipeHint === "left" ? "justify-end pr-6" : "justify-start pl-6"}`}
            style={{ height: "200px", zIndex: recommendations.length + 2 }}
          >
            <div className={`px-4 py-2 rounded-full text-white text-sm font-bold shadow-lg ${swipeHint === "left" ? "bg-red-400" : "bg-green-500"}`}>
              {swipeHint === "left" ? "Nicht interessiert" : "Gemerkt"}
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

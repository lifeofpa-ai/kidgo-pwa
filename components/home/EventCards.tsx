"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { KidgoEvent, EventSource, UserLocation } from "@/types/home";
import {
  AGE_BUCKETS,
  CATEGORY_BG_COLORS,
  getCategoryColor,
  extractPrice,
  isFreeEvent,
  getCountdownLabel,
  haversine,
} from "@/lib/home-constants";
import { getCategoryIcon } from "@/components/Icons";
import { HeartBurst } from "@/components/HeartBurst";
import { QuickActionsPopup, QuickActionIcons, type QuickAction } from "@/components/QuickActionsPopup";
import {
  vibrate,
  toggleLike,
  isLiked,
  saveScrollPosition,
  shareEvent,
  downloadEventICS,
  openRouteForEvent,
  broadcastClosePopups,
  isTouchDevice,
  LONG_PRESS_MS,
  DOUBLE_TAP_MS,
  QUICK_ACTIONS_CLOSE_EVENT,
} from "@/lib/interactions";

// ============================================================
// SKELETON CARD
// ============================================================

export function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] overflow-hidden" aria-hidden="true">
      <div className="h-48 skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-3.5 skeleton w-2/3" />
        <div className="h-5 skeleton w-full" />
        <div className="h-3.5 skeleton w-1/2" />
        <div className="h-3 skeleton w-1/3" />
      </div>
    </div>
  );
}

// ============================================================
// EVENT IMAGE
// ============================================================

export function EventImage({
  url,
  kategorien,
  className,
  title,
}: {
  url?: string | null;
  kategorien?: string[] | null;
  className?: string;
  title?: string;
}) {
  const [err, setErr] = useState(false);
  const cat = kategorien?.[0] || "";
  const cls = className ?? "h-48 w-full overflow-hidden";
  const altText = title || cat || "Event";
  const iconColor = CATEGORY_BG_COLORS[cat] || "#5BBAA7";

  if (url && !err) {
    return (
      <div className={`${cls} photo-cell`}>
        <img
          src={url}
          alt={altText}
          className="w-full h-full object-cover group-hover:scale-[1.03] group-hover:brightness-105 dark:brightness-90 transition-all duration-300 ease-out"
          loading="lazy"
          onError={() => setErr(true)}
        />
      </div>
    );
  }
  return (
    <div className={`${cls} flex items-center justify-center`} style={{ backgroundColor: "#F5F0E8" }} aria-label={altText}>
      <div className="opacity-30" style={{ color: iconColor }}>
        {getCategoryIcon(cat, { size: 60 })}
      </div>
    </div>
  );
}

// ============================================================
// RECOMMENDATION CARD
// ============================================================

export function RecommendationCard({
  event,
  reasons,
  sources,
  userLocation,
  animIndex,
  selectedBuckets = [],
  isSeriesParent = false,
  isGeheimtipp = false,
  entdeckerScore,
  isBookmarked = false,
  onBookmark,
  bookmarkCount,
}: {
  event: KidgoEvent;
  reasons: string[];
  sources: EventSource[];
  userLocation: UserLocation | null;
  animIndex: number;
  selectedBuckets?: string[];
  isSeriesParent?: boolean;
  isGeheimtipp?: boolean;
  entdeckerScore?: number;
  isBookmarked?: boolean;
  onBookmark?: (e: React.MouseEvent) => void;
  bookmarkCount?: number;
}) {
  const source = sources.find((s) => s.id === event.quelle_id);

  let distanceLabel: string | null = null;
  if (userLocation && source?.latitude && source?.longitude) {
    const km = haversine(userLocation.lat, userLocation.lon, source.latitude, source.longitude);
    if (km < 50) distanceLabel = km < 1 ? "< 1 km entfernt" : `~${Math.round(km)} km entfernt`;
  }

  const displayReasons = [...reasons];
  if (distanceLabel && !displayReasons.some((r) => r.includes("km")))
    displayReasons.push(distanceLabel);
  const shownReasons = displayReasons.slice(0, 2);

  const matchingBuckets =
    selectedBuckets.length > 1 && event.alters_buckets
      ? selectedBuckets.filter((b) => event.alters_buckets!.includes(b))
      : [];

  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const lastTap = useRef(0);
  const suppressClick = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => { setLiked(isLiked(event.id)); }, [event.id]);

  useEffect(() => {
    const onClose = () => setPopupOpen(false);
    window.addEventListener(QUICK_ACTIONS_CLOSE_EVENT, onClose);
    return () => window.removeEventListener(QUICK_ACTIONS_CLOSE_EVENT, onClose);
  }, []);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const openPopup = () => {
    broadcastClosePopups();
    setPopupOpen(true);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
    longPressFired.current = false;
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      suppressClick.current = true;
      vibrate(15);
      openPopup();
    }, LONG_PRESS_MS);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartPos.current.x);
    const dy = Math.abs(t.clientY - touchStartPos.current.y);
    if (dx > 8 || dy > 8) cancelLongPress();
  };

  const onTouchEnd = () => {
    cancelLongPress();
    if (longPressFired.current) {
      return;
    }
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      suppressClick.current = true;
      const newLiked = toggleLike(event.id);
      setLiked(newLiked);
      setBurstKey((k) => k + 1);
      vibrate(15);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (isTouchDevice()) return;
    e.preventDefault();
    suppressClick.current = true;
    openPopup();
  };

  const onLinkClick = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
      return;
    }
    try { saveScrollPosition(window.location.pathname); } catch {}
  };

  const popupActions: QuickAction[] = [
    {
      key: "bookmark",
      label: isBookmarked ? "Gemerkt" : "Merken",
      icon: QuickActionIcons.bookmark(isBookmarked),
      active: isBookmarked,
      onClick: () => {
        if (onBookmark) {
          const fakeEvent = {
            preventDefault: () => {},
            stopPropagation: () => {},
          } as unknown as React.MouseEvent;
          onBookmark(fakeEvent);
        }
      },
    },
    {
      key: "share",
      label: "Teilen",
      icon: QuickActionIcons.share,
      onClick: () => shareEvent(event),
    },
    {
      key: "calendar",
      label: "Kalender",
      icon: QuickActionIcons.calendar,
      onClick: () => downloadEventICS(event),
    },
    {
      key: "route",
      label: "Route",
      icon: QuickActionIcons.route,
      onClick: () => openRouteForEvent(event),
    },
  ];

  return (
    <>
    <Link
      href={`/events/${event.id}`}
      className="block group card-enter"
      style={{ animationDelay: `${animIndex * 80}ms` }}
      onClick={onLinkClick}
      onContextMenu={onContextMenu}
    >
      <div
        ref={cardRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelLongPress}
        className="bg-[var(--bg-card)] rounded-xl shadow-sm hover:shadow-md transition-all duration-200 ease-out overflow-hidden border border-[var(--border)] group-hover:border-kidgo-200 group-hover:scale-[1.01] relative select-none"
        style={{ borderLeft: `3px solid ${getCategoryColor(event.kategorien, event.kategorie)}`, boxShadow: "0 2px 12px rgba(91,186,167,0.08)", WebkitTouchCallout: "none" }}
      >
        <HeartBurst trigger={burstKey} />
        {liked && (
          <div className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md" aria-label="Geliked">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 12 C 2.5 8.5, 1 5, 3 3.5 C 4.5 2.5, 6 3.5, 7 5 C 8 3.5, 9.5 2.5, 11 3.5 C 13 5, 11.5 8.5, 7 12 Z" />
            </svg>
          </div>
        )}
          {onBookmark && (
            <button
              onClick={onBookmark}
              aria-label={isBookmarked ? "Aus Merkliste entfernen" : "Event merken"}
              className={`absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full shadow-sm transition-all ${
                isBookmarked
                  ? "bg-kidgo-400 text-white"
                  : "bg-white/90 text-gray-300 hover:text-kidgo-500"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 2h10v11L7 10 2 13V2z"/>
              </svg>
            </button>
          )}
        <EventImage
          url={event.kategorie_bild_url}
          kategorien={event.kategorien}
          className="h-48 md:h-60 w-full overflow-hidden"
          title={event.titel}
        />
        <div className="p-4">
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {isGeheimtipp && (
              <span className="bg-purple-50 text-purple-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-purple-100">
                Geheimtipp
              </span>
            )}
            {shownReasons.map((r) => (
              <span
                key={r}
                className="bg-kidgo-50 text-kidgo-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-kidgo-100"
              >
                {r}
              </span>
            ))}
          </div>

          <h3 className="font-bold text-[var(--text-primary)] text-lg leading-snug mb-1.5 group-hover:text-kidgo-500 transition-colors duration-200">
            {event.titel}
          </h3>

          {(() => {
            const badges: { label: string; cls: string }[] = [];
            if (isSeriesParent) badges.push({ label: "Regelmässig", cls: "bg-kidgo-50 text-kidgo-500 border border-kidgo-100" });
            if (isFreeEvent(event)) {
              badges.push({ label: "Gratis", cls: "bg-green-50 text-green-700 border border-green-100" });
            } else {
              const p = extractPrice(event.beschreibung);
              if (p !== null) badges.push({ label: `ab CHF ${p % 1 === 0 ? p : p.toFixed(2)}`, cls: "bg-sky-50 text-sky-600 border border-sky-100" });
            }
            if (badges.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {badges.map((b) => (
                  <span key={b.label} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${b.cls}`}>{b.label}</span>
                ))}
              </div>
            );
          })()}

          {matchingBuckets.length > 1 && (
            <p className="text-xs text-emerald-600 font-semibold mb-2 flex items-center gap-1">
              <span>✓</span>
              <span>
                Passt für{" "}
                {matchingBuckets
                  .map((b) => AGE_BUCKETS.find((a) => a.key === b)?.label ?? b)
                  .join(" und ")}
              </span>
            </p>
          )}

          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
              {event.datum && (() => {
                const { label, urgent } = getCountdownLabel(event.datum, new Date());
                return (
                  <span className={`flex items-center gap-1.5 ${urgent ? "font-semibold" : ""}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className={`flex-shrink-0 ${urgent ? "text-kidgo-500" : "text-kidgo-400"}`}>
                      <rect x="0.5" y="1.5" width="11" height="9" rx="1.2"/><path d="M0.5 4.5h11M4 0.5v2M8 0.5v2"/>
                    </svg>
                    <span className={urgent ? "text-kidgo-500" : ""}>{label}</span>
                  </span>
                );
              })()}
              {!event.datum && (
                <span className="text-emerald-600 font-medium">Ganzjährig</span>
              )}
              {event.ort && (
                <span className="flex items-center gap-1.5 truncate max-w-[200px]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="text-kidgo-400 flex-shrink-0">
                    <path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3z"/><circle cx="6" cy="4" r="1"/>
                  </svg>
                  {event.ort}
                </span>
              )}
            </div>
            {entdeckerScore !== undefined && (
              <span className="flex-shrink-0 text-xs text-kidgo-400 font-medium">{entdeckerScore}/10</span>
            )}
          </div>

          {bookmarkCount && bookmarkCount > 1 && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <div className="flex -space-x-1">
                {[...Array(Math.min(3, bookmarkCount))].map((_, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full bg-kidgo-100 border border-white"
                    style={{ zIndex: 3 - i }}
                  />
                ))}
              </div>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {bookmarkCount} {bookmarkCount === 1 ? "Familie" : "Familien"} interessiert
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
    {popupOpen && (
      <QuickActionsPopup
        actions={popupActions}
        onClose={() => setPopupOpen(false)}
        anchorRef={cardRef}
      />
    )}
    </>
  );
}

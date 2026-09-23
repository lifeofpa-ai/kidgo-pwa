"use client";

import Link from "next/link";
import type { KidgoEvent } from "@/types/home";
import { saveScrollPosition } from "@/lib/interactions";
import { LazySection } from "@/components/home/LazySection";
import { AGE_BUCKETS } from "@/lib/home-constants";

// Popularity signal: real Merkliste-Saves (user_bookmarks), the only
// concrete cross-user interaction stored in the DB (GA4 events in
// lib/analytics.ts never land in Supabase). Same source already powers
// the "X Familien interessiert" social-proof badge on regular cards
// (components/home/EventCards.tsx) and is fetched once per page load via
// the get_event_bookmark_counts() RPC into page.tsx's `bookmarkCounts`.
// Both sections below simply rank by that count and return null when
// nothing has a bookmark yet, matching every other home section's
// "hide, don't show an empty/arbitrary list" convention (WeekendSection,
// SeasonalSection) — they start appearing on their own once real usage
// produces bookmarks.

type RankedEvent = KidgoEvent & { _count: number };

function rankTop3(events: KidgoEvent[], bookmarkCounts: Map<string, number>): RankedEvent[] {
  return events
    .map((e) => ({ ...e, _count: bookmarkCounts.get(e.id) ?? 0 }))
    .filter((e) => e._count > 0)
    .sort((a, b) => b._count - a._count)
    .slice(0, 3);
}

const RANK_BADGE_STYLES = [
  "bg-[#E8A94A] text-white",   // #1
  "bg-gray-300 text-gray-700", // #2
  "bg-[#C08552] text-white",   // #3
];

function PopularCard({ event, rank }: { event: RankedEvent; rank: number }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex-shrink-0 w-44 group"
      onClick={() => { try { saveScrollPosition(window.location.pathname); } catch {} }}
    >
      <div
        className="rounded-2xl overflow-hidden border border-[var(--border)] hover:border-[#5BBAA7]/40 transition-all hover:shadow-md"
        style={{ boxShadow: "0 2px 8px rgba(91,186,167,0.08)" }}
      >
        <div className="h-28 bg-gradient-to-br from-[#F5F0E8] to-kidgo-50 relative overflow-hidden">
          {event.kategorie_bild_url ? (
            <img
              src={event.kategorie_bild_url}
              alt={event.titel}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
          )}
          <div
            className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shadow-sm ${RANK_BADGE_STYLES[rank] ?? RANK_BADGE_STYLES[2]}`}
          >
            {rank + 1}
          </div>
        </div>
        <div className="p-3 bg-[var(--bg-card)]">
          <p className="text-xs font-bold text-[var(--text-primary)] leading-snug line-clamp-2 group-hover:text-[#5BBAA7] transition-colors">
            {event.titel}
          </p>
          {event.ort && <p className="text-[10px] text-[var(--text-muted)] mt-1 truncate">{event.ort.split(",")[0].trim()}</p>}
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-kidgo-600 font-semibold">
            <svg width="10" height="10" viewBox="0 0 14 14" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2h10v11L7 10 2 13V2z" />
            </svg>
            {event._count} {event._count === 1 ? "Familie" : "Familien"} interessiert
          </div>
        </div>
      </div>
    </Link>
  );
}

function PopularRow({ events }: { events: RankedEvent[] }) {
  return (
    <div
      className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
    >
      {events.map((event, i) => (
        <PopularCard key={event.id} event={event} rank={i} />
      ))}
    </div>
  );
}

interface PopularSectionProps {
  allEventsPool: KidgoEvent[];
  bookmarkCounts: Map<string, number>;
}

/** "Beliebt bei Kidgo" — Top 3 Events plattformweit nach Merkliste-Saves. */
export function PopularSection({ allEventsPool, bookmarkCounts }: PopularSectionProps) {
  if (allEventsPool.length === 0) return null;
  const top3 = rankTop3(allEventsPool, bookmarkCounts);
  if (top3.length === 0) return null;

  return (
    <LazySection className="mt-8" fallback={<div className="mt-8 h-48 skeleton rounded-2xl" />}>
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Beliebt bei Kidgo</p>
          <Link href="/explore" className="text-xs font-semibold text-kidgo-500 hover:text-kidgo-600 transition">
            Alle →
          </Link>
        </div>
        <PopularRow events={top3} />
      </div>
    </LazySection>
  );
}

interface PopularAgeGroupSectionProps {
  ageGroupEvents: KidgoEvent[];
  bookmarkCounts: Map<string, number>;
  selectedBuckets: string[];
}

/**
 * "Beliebt in deiner Altersklasse" — Top 3 Events nach Merkliste-Saves,
 * eingeschränkt auf die aktuell gewählte(n) Altersgruppe(n) (gleiche
 * "passt für diese Altersgruppe ODER hat keine Altersangabe"-Logik wie
 * überall sonst im Home-Feed, siehe `ageFiltered` in page.tsx). Ohne
 * gewählte Altersgruppe (selectedBuckets leer) gäbe es keine sinnvolle
 * Abgrenzung zu "Beliebt bei Kidgo" — Sektion bleibt dann ausgeblendet.
 */
export function PopularAgeGroupSection({ ageGroupEvents, bookmarkCounts, selectedBuckets }: PopularAgeGroupSectionProps) {
  if (selectedBuckets.length === 0) return null;
  const top3 = rankTop3(ageGroupEvents, bookmarkCounts);
  if (top3.length === 0) return null;

  const ageLabel = selectedBuckets
    .map((b) => AGE_BUCKETS.find((a) => a.key === b)?.label ?? b)
    .join(" & ");

  return (
    <LazySection className="mt-8" fallback={<div className="mt-8 h-48 skeleton rounded-2xl" />}>
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Beliebt in deiner Altersklasse</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{ageLabel}</p>
          </div>
          <Link href="/explore" className="text-xs font-semibold text-kidgo-500 hover:text-kidgo-600 transition">
            Alle →
          </Link>
        </div>
        <PopularRow events={top3} />
      </div>
    </LazySection>
  );
}

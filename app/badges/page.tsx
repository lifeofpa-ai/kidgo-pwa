"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import {
  BADGE_DEFS,
  LEVELS,
  getLocalStats,
  getEarnedBadgeIds,
  getLevelProgress,
  popNewBadges,
  type BadgeDef,
} from "@/lib/gamification";
import { BadgePopup } from "@/components/BadgePopup";

export default function BadgesPage() {
  const [mounted, setMounted]               = useState(false);
  const [bookmarks, setBookmarks]           = useState<string[]>([]);
  const [isDark, setIsDark]                 = useState(false);
  const [currentPopup, setCurrentPopup]     = useState<BadgeDef | null>(null);
  const [popupQueue, setPopupQueue]         = useState<BadgeDef[]>([]);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
    try {
      const raw = localStorage.getItem("kidgo_bookmarks");
      if (raw) {
        const parsed = JSON.parse(raw);
        setBookmarks(parsed.map((b: { id: string }) => b.id));
      }
    } catch {}
  }, []);

  // Check for newly earned badges on mount
  useEffect(() => {
    if (!mounted) return;
    const bm = (() => {
      try {
        const raw = localStorage.getItem("kidgo_bookmarks");
        return raw ? (JSON.parse(raw) as { id: string }[]).length : 0;
      } catch { return 0; }
    })();
    const stats = getLocalStats(bm);
    const newBadges = popNewBadges(stats);
    if (newBadges.length > 0) {
      setCurrentPopup(newBadges[0]);
      setPopupQueue(newBadges.slice(1));
    }
  }, [mounted]);

  const handlePopupClose = () => {
    setCurrentPopup(null);
    if (popupQueue.length > 0) {
      const [next, ...rest] = popupQueue;
      setTimeout(() => {
        setCurrentPopup(next);
        setPopupQueue(rest);
      }, 400);
    }
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("kidgo_theme", next ? "dark" : "light"); } catch {}
  };

  if (!mounted) return null;

  const stats      = getLocalStats(bookmarks.length);
  const earnedIds  = getEarnedBadgeIds(stats);
  const { current, next, progress, eventsToNext } = getLevelProgress(stats.visitedEventIds.length);
  const earnedCount = earnedIds.length;

  return (
    <main className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-10 pb-24 md:pb-10">

        {/* Badge popup */}
        <BadgePopup badge={currentPopup} onClose={handlePopupClose} />

        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <Link href="/" aria-label="Zurück zur Startseite">
            <KidgoLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
            >
              Zurück
            </Link>
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Helles Design" : "Dunkles Design"}
              className="bg-[var(--bg-card)] rounded-xl w-9 h-9 flex items-center justify-center shadow-sm border border-[var(--border)] hover:border-[var(--border-strong)] transition text-[var(--text-secondary)]"
            >
              {isDark ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="3.5"/>
                  <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M12.8 3.2l-1 1M4.2 11.8l-1 1"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 9A6 6 0 1 1 7 3a4.5 4.5 0 0 0 6 6z"/>
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Page title */}
        <div className="mb-8 card-enter">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight mb-1">
            Deine Erfolge
          </h1>
          <p className="text-[var(--text-muted)] text-sm">
            {earnedCount} von {BADGE_DEFS.length} Abzeichen freigeschaltet
          </p>
        </div>

        {/* Level card */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 mb-6 card-enter">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">
                Dein Level
              </p>
              <p className="text-2xl font-extrabold text-[var(--text-primary)]">
                {current.label}
              </p>
              {next ? (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Noch {eventsToNext} {eventsToNext === 1 ? "Event" : "Events"} bis {next.label}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Höchstes Level erreicht</p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-extrabold text-[var(--accent)]">
                {stats.visitedEventIds.length}
              </p>
              <p className="text-xs text-[var(--text-muted)]">Events besucht</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[var(--text-muted)]">{current.label}</span>
              {next && <span className="text-xs text-[var(--text-muted)]">{next.label}</span>}
            </div>
            <div className="w-full bg-[var(--bg-subtle)] rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, backgroundColor: "var(--accent)" }}
              />
            </div>
          </div>

          {/* Level milestones */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {LEVELS.map((level) => {
              const reached = stats.visitedEventIds.length >= level.minEvents;
              return (
                <span
                  key={level.key}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    reached
                      ? "bg-[var(--accent)] text-white border-transparent"
                      : "bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border)]"
                  }`}
                >
                  {level.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Badges */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-0.5">
            Abzeichen
          </p>
        </div>

        <div className="space-y-3">
          {BADGE_DEFS.map((badge, i) => {
            const earned = earnedIds.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`bg-[var(--bg-card)] rounded-2xl border p-5 transition-all card-enter ${
                  earned
                    ? "border-[var(--accent)] shadow-sm"
                    : "border-[var(--border)] opacity-60"
                }`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start gap-4">
                  {/* Badge emoji icon */}
                  <div
                    className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center border text-2xl ${
                      earned
                        ? "border-[var(--accent)] bg-[var(--accent-light)]"
                        : "border-[var(--border)] bg-[var(--bg-subtle)]"
                    }`}
                  >
                    {badge.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`font-bold text-sm ${earned ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                        {badge.name}
                      </p>
                      {earned && (
                        <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">
                          Verdient
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-snug mb-1">
                      {badge.description}
                    </p>
                    {!earned && (
                      <p className="text-xs text-[var(--text-muted)] font-medium">
                        Voraussetzung: {badge.requirement}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats summary */}
        <div className="mt-8 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 card-enter">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Deine Statistik
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { value: stats.visitedEventIds.length, label: "Events besucht" },
              { value: bookmarks.length,              label: "Gemerkt"        },
              { value: stats.geheimtippsFound.length, label: "Geheimtipps"   },
              { value: earnedCount,                   label: "Abzeichen"      },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-extrabold text-[var(--text-primary)]">{value}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-10 border-t border-[var(--border)] pt-6 pb-8 text-center">
          <p className="text-xs text-[var(--text-muted)] mb-2">© 2026 kidgo · Zürich</p>
          <nav className="flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
            <Link href="/"          className="hover:text-[var(--text-secondary)] transition">Start</Link>
            <span aria-hidden>·</span>
            <Link href="/explore"   className="hover:text-[var(--text-secondary)] transition">Entdecken</Link>
            <span aria-hidden>·</span>
            <Link href="/dashboard" className="hover:text-[var(--text-secondary)] transition">Dashboard</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}

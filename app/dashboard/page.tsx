"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase-browser";
import {
  getLocalStats,
  getLevelProgress,
  getEarnedBadgeIds,
  BADGE_DEFS,
} from "@/lib/gamification";
import {
  getRatedEvents,
  buildPreferenceProfile,
} from "@/lib/preferences";
import { InterestsModal } from "@/components/InterestsModal";

interface CompactEvent {
  id: string;
  titel: string;
  datum: string | null;
  ort: string | null;
  kategorie_bild_url: string | null;
  kategorien: string[] | null;
}

interface Review {
  id: string;
  event_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  events?: { titel: string } | { titel: string }[] | null;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className ?? ""}`} aria-hidden />;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 12 12"
          fill={i <= rating ? "var(--accent)" : "none"}
          stroke={i <= rating ? "var(--accent)" : "var(--text-muted)"}
          strokeWidth="1.2">
          <path d="M6 1l1.3 2.6 2.9.4-2.1 2 .5 2.9L6 7.5l-2.6 1.4.5-2.9-2.1-2 2.9-.4z" />
        </svg>
      ))}
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("de-CH", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function getGreeting(name: string): string {
  const h = new Date().getHours();
  if (h < 11) return `Guten Morgen, ${name}`;
  if (h < 17) return `Hallo, ${name}`;
  if (h < 21) return `Guten Abend, ${name}`;
  return `Hallo, ${name}`;
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  "Kreativ":       { bg: "bg-pink-50",   text: "text-pink-600",   border: "border-pink-100" },
  "Natur":         { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-100" },
  "Tiere":         { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-100" },
  "Sport":         { bg: "bg-blue-50",   text: "text-blue-600",   border: "border-blue-100" },
  "Tanz":          { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100" },
  "Theater":       { bg: "bg-red-50",    text: "text-red-600",    border: "border-red-100" },
  "Musik":         { bg: "bg-teal-50",   text: "text-teal-600",   border: "border-teal-100" },
  "Ausflug":       { bg: "bg-teal-50",   text: "text-teal-600",   border: "border-teal-100" },
  "Feriencamp":    { bg: "bg-kidgo-50",  text: "text-kidgo-600",  border: "border-kidgo-100" },
  "Bildung":       { bg: "bg-kidgo-50",  text: "text-kidgo-600",  border: "border-kidgo-100" },
  "Wissenschaft":  { bg: "bg-cyan-50",   text: "text-cyan-600",   border: "border-cyan-100" },
  "Mode & Design": { bg: "bg-rose-50",   text: "text-rose-600",   border: "border-rose-100" },
};

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [mounted, setMounted]             = useState(false);
  const [isDark, setIsDark]               = useState(false);
  const [bookmarks, setBookmarks]         = useState<CompactEvent[]>([]);
  const [reviews, setReviews]             = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [showInterestsModal, setShowInterestsModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
    try {
      const raw = localStorage.getItem("kidgo_bookmarks");
      if (raw) setBookmarks(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem("kidgo_interests");
      if (raw) setUserInterests(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    setReviewsLoading(true);
    const supabase = createClient();
    supabase
      .from("event_reviews")
      .select("id, event_id, rating, comment, created_at, events(titel)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setReviews((data as unknown as Review[]) || []);
        setReviewsLoading(false);
      });
  }, [user]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("kidgo_theme", next ? "dark" : "light"); } catch {}
  };

  const handleInterestsComplete = (interests: string[]) => {
    setUserInterests(interests);
    setShowInterestsModal(false);
  };

  if (!mounted || authLoading) return null;
  if (!user) return null;

  const displayName    = profile?.display_name ?? user.email?.split("@")[0] ?? "Kidgo-Nutzer";
  const children       = profile?.children ?? [];
  const stats          = getLocalStats(bookmarks.length);
  const { current, next, progress, eventsToNext } = getLevelProgress(stats.visitedEventIds.length);
  const earnedIds      = getEarnedBadgeIds(stats);

  // Preference profile top-3 categories
  const ratedEvents     = getRatedEvents();
  const prefProfile     = buildPreferenceProfile(ratedEvents);
  const topCategories   = prefProfile?.preferredCategories ?? [];

  // Next bookmarked event
  const today     = new Date(); today.setHours(0, 0, 0, 0);
  const nextEvent = bookmarks
    .filter((bm) => bm.datum)
    .map((bm) => ({ ...bm, dateObj: new Date(bm.datum! + "T00:00:00") }))
    .filter((bm) => bm.dateObj >= today)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())[0];

  return (
    <>
      {showInterestsModal && (
        <InterestsModal
          onComplete={handleInterestsComplete}
          onSkip={() => setShowInterestsModal(false)}
        />
      )}

      <main className="min-h-screen bg-[var(--bg-page)]">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 pb-24 md:pb-10">

          {/* Header */}
          <header className="flex items-center justify-between mb-8">
            <Link href="/" aria-label="Startseite"><KidgoLogo size="sm" animated /></Link>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition">Zurück</Link>
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

          {/* Greeting */}
          <div className="mb-8 card-enter">
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] leading-tight mb-1">
              {getGreeting(displayName)}
            </h1>
            <p className="text-[var(--text-muted)] text-sm">Dein persönliches Familien-Dashboard</p>
          </div>

          {/* Level + Badges */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4 card-enter" style={{ animationDelay: "40ms" }}>
              <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">Level</p>
              <p className="text-xl font-extrabold text-[var(--text-primary)]">{current.label}</p>
              <div className="mt-2 w-full bg-[var(--bg-subtle)] rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${progress}%`, backgroundColor: "var(--accent)" }} />
              </div>
              {next && (
                <p className="text-xs text-[var(--text-muted)] mt-1">{eventsToNext} bis {next.label}</p>
              )}
            </div>

            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4 card-enter" style={{ animationDelay: "80ms" }}>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">Abzeichen</p>
              <p className="text-xl font-extrabold text-[var(--text-primary)]">
                {earnedIds.length}
                <span className="text-sm font-normal text-[var(--text-muted)]"> / {BADGE_DEFS.length}</span>
              </p>
              <Link href="/badges" className="text-xs text-[var(--accent)] hover:underline mt-2 block transition">
                Alle ansehen
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { value: stats.visitedEventIds.length, label: "Besucht" },
              { value: reviews.length,               label: "Bewertungen" },
              { value: bookmarks.length,             label: "Gemerkt" },
            ].map(({ value, label }, i) => (
              <div
                key={label}
                className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4 text-center card-enter"
                style={{ animationDelay: `${120 + i * 40}ms` }}
              >
                <p className="text-2xl font-extrabold text-[var(--text-primary)]">{value}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {/* Top-3 Kategorien aus Präferenzprofil */}
          {topCategories.length > 0 && (
            <div className="mb-6 card-enter" style={{ animationDelay: "200ms" }}>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-0.5">
                Deine Lieblingsthemen
              </p>
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4">
                <p className="text-xs text-[var(--text-muted)] mb-3">Basierend auf deinen Bewertungen</p>
                <div className="flex flex-wrap gap-2">
                  {topCategories.map((cat, i) => {
                    const colors = categoryColors[cat] ?? { bg: "bg-kidgo-50", text: "text-kidgo-600", border: "border-kidgo-100" };
                    return (
                      <span
                        key={cat}
                        className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
                      >
                        <span className="text-xs font-bold text-[var(--text-muted)]">#{i + 1}</span>
                        {cat}
                      </span>
                    );
                  })}
                </div>
                {prefProfile?.preferredSetting && (
                  <p className="text-xs text-[var(--text-muted)] mt-3">
                    Du bevorzugst <strong className="text-[var(--text-secondary)]">{prefProfile.preferredSetting === "indoor" ? "Indoor-Aktivitäten" : "Outdoor-Aktivitäten"}</strong>
                  </p>
                )}
                <Link href="/explore" className="inline-block mt-3 text-xs text-[var(--accent)] hover:underline transition">
                  Passende Events entdecken
                </Link>
              </div>
            </div>
          )}

          {/* Interessen */}
          <div className="mb-6 card-enter" style={{ animationDelay: "220ms" }}>
            <div className="flex items-center justify-between mb-3 px-0.5">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Interessen</p>
              <button
                onClick={() => setShowInterestsModal(true)}
                className="text-xs text-[var(--accent)] hover:underline transition flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 1v8M1 5h8"/></svg>
                Ändern
              </button>
            </div>
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4">
              {userInterests.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {userInterests.map((interest) => (
                    <span key={interest} className="text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border)]">
                      {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-[var(--text-muted)] mb-2">Noch keine Interessen ausgewählt</p>
                  <button
                    onClick={() => setShowInterestsModal(true)}
                    className="text-xs text-[var(--accent)] hover:underline transition"
                  >
                    Interessen festlegen
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kinder */}
          {children.length > 0 && (
            <div className="mb-6 card-enter" style={{ animationDelay: "240ms" }}>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-0.5">
                Deine Kinder
              </p>
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
                {children.map((child, i) => (
                  <div key={`${child.name}-${child.age_bucket}-${i}`} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[var(--accent-light)] rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-[var(--accent)]">{child.name.slice(0, 1).toUpperCase()}</span>
                      </div>
                      <span className="font-semibold text-sm text-[var(--text-primary)]">{child.name}</span>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2.5 py-1 rounded-full">
                      {child.age_bucket} J.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nächstes Event */}
          {nextEvent && (
            <div className="mb-6 card-enter" style={{ animationDelay: "280ms" }}>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-0.5">
                Nächstes Event
              </p>
              <Link href={`/events/${nextEvent.id}`} className="block group">
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] hover:border-[var(--accent)] p-5 transition-all hover:shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-subtle)]">
                      {nextEvent.kategorie_bild_url ? (
                        <img src={nextEvent.kategorie_bild_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--text-muted)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="2" width="14" height="12" rx="1.5"/><path d="M1 6h14M5 1v3M11 1v3"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">{nextEvent.titel}</p>
                      {nextEvent.ort && <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{nextEvent.ort}</p>}
                    </div>
                    {nextEvent.datum && (
                      <span className="flex-shrink-0 text-xs font-semibold text-[var(--accent)] bg-[var(--accent-light)] px-2.5 py-1 rounded-full">
                        {formatDateShort(nextEvent.datum)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Gemerkte Events */}
          {bookmarks.length > 0 && (
            <div className="mb-6 card-enter" style={{ animationDelay: "320ms" }}>
              <div className="flex items-center justify-between mb-3 px-0.5">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                  Gemerktes ({bookmarks.length})
                </p>
                <Link href="/" className="text-xs text-[var(--accent)] hover:underline transition">Alle</Link>
              </div>
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                {bookmarks.slice(0, 5).map((bm) => (
                  <Link key={bm.id} href={`/events/${bm.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--bg-subtle)] transition group">
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-subtle)]">
                      {bm.kategorie_bild_url ? (
                        <img src={bm.kategorie_bild_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-xs font-bold">
                          {(bm.kategorien?.[0] || "K").slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">{bm.titel}</p>
                      {bm.datum && <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatDateShort(bm.datum)}</p>}
                    </div>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 group-hover:stroke-[var(--accent)] transition">
                      <path d="M4 9l3-3-3-3"/>
                    </svg>
                  </Link>
                ))}
                {bookmarks.length > 5 && (
                  <div className="px-5 py-3 text-center">
                    <span className="text-xs text-[var(--text-muted)]">+{bookmarks.length - 5} weitere Events</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bewertungen */}
          <div className="mb-6 card-enter" style={{ animationDelay: "360ms" }}>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3 px-0.5">
              Deine Bewertungen
            </p>
            {reviewsLoading ? (
              <div className="space-y-3">
                <SkeletonBlock className="h-16 w-full" />
                <SkeletonBlock className="h-16 w-full" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 text-center">
                <p className="text-sm text-[var(--text-muted)]">Noch keine Bewertungen</p>
                <Link href="/explore" className="text-xs text-[var(--accent)] hover:underline mt-2 block transition">
                  Events entdecken und bewerten
                </Link>
              </div>
            ) : (
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-hidden">
                {reviews.map((review) => (
                  <Link key={review.id} href={`/events/${review.event_id}`} className="flex items-start gap-3 px-5 py-4 hover:bg-[var(--bg-subtle)] transition group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                        {Array.isArray(review.events) ? review.events[0]?.titel ?? "Event" : review.events?.titel ?? "Event"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={review.rating} />
                        {review.comment && <p className="text-xs text-[var(--text-muted)] truncate">{review.comment}</p>}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-xs text-[var(--text-muted)] mt-0.5">
                      {new Date(review.created_at).toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-3 mb-6 card-enter" style={{ animationDelay: "400ms" }}>
            <Link href="/badges" className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4 hover:border-[var(--accent)] transition group">
              <div className="w-9 h-9 bg-[var(--accent-light)] rounded-xl flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="4"/><path d="M5 12.5L9 16l4-3.5"/>
                </svg>
              </div>
              <p className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">Abzeichen</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{earnedIds.length} / {BADGE_DEFS.length} verdient</p>
            </Link>
            <Link href="/explore" className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-4 hover:border-[var(--accent)] transition group">
              <div className="w-9 h-9 bg-[var(--accent-light)] rounded-xl flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="9" r="7"/><path d="M9 5v4l2.5 2.5"/>
                </svg>
              </div>
              <p className="font-bold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">Events entdecken</p>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Neue Aktivitäten finden</p>
            </Link>
          </div>

          <footer className="mt-10 border-t border-[var(--border)] pt-6 pb-8 text-center">
            <p className="text-xs text-[var(--text-muted)] mb-2">© 2026 kidgo · Zürich</p>
            <nav className="flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
              <Link href="/" className="hover:text-[var(--text-secondary)] transition">Start</Link>
              <span aria-hidden>·</span>
              <Link href="/explore" className="hover:text-[var(--text-secondary)] transition">Entdecken</Link>
              <span aria-hidden>·</span>
              <Link href="/badges" className="hover:text-[var(--text-secondary)] transition">Abzeichen</Link>
            </nav>
          </footer>
        </div>
      </main>
    </>
  );
}

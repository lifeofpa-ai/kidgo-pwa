"use client";

import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { useAuth } from "@/lib/auth-context";
import { AuthButton } from "@/components/AuthButton";
import { getLocalStats, getLevelProgress } from "@/lib/gamification";
import { useState, useEffect } from "react";

export default function IchPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("kidgo_bookmarks");
      if (raw) setBookmarkCount(JSON.parse(raw).length);
    } catch {}
  }, []);

  const stats = mounted ? getLocalStats(bookmarkCount) : null;
  const levelInfo = stats ? getLevelProgress(stats.visitedEventIds.length) : null;

  const sections = [
    {
      href: "/bookmarks",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2h12a1 1 0 0 1 1 1v14l-7-4-7 4V3a1 1 0 0 1 1-1z"/>
        </svg>
      ),
      label: "Merkliste",
      desc: `${bookmarkCount} gemerkte Events`,
      color: "#5BBAA7",
    },
    {
      href: "/badges",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="8" r="5"/>
          <path d="M6.5 13L10 18l3.5-5"/>
        </svg>
      ),
      label: "Erfolge & Badges",
      desc: levelInfo ? `Level ${levelInfo.current.label}` : "Entdecker-Fortschritt",
      color: "#8B5CF6",
    },
    {
      href: "/history",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="8"/>
          <path d="M10 6v4l3 3"/>
        </svg>
      ),
      label: "Verlauf",
      desc: "Zuletzt angeschaute Events",
      color: "#F59E0B",
    },
    {
      href: "/dashboard",
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="7" height="7" rx="1.5"/>
          <rect x="11" y="2" width="7" height="7" rx="1.5"/>
          <rect x="2" y="11" width="7" height="7" rx="1.5"/>
          <rect x="11" y="11" width="7" height="7" rx="1.5"/>
        </svg>
      ),
      label: "Dashboard",
      desc: "Community & Statistiken",
      color: "#3B82F6",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F8F5F0] dark:bg-[#1A1D1C] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1e2221]/95 backdrop-blur-md border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Startseite">
              <KidgoLogo size="sm" animated />
            </Link>
            <div>
              <h1 className="font-bold text-[var(--text-primary)] text-base leading-tight">Mein Bereich</h1>
              {profile?.display_name && (
                <p className="text-xs text-[var(--text-muted)]">Hallo, {profile.display_name}!</p>
              )}
            </div>
          </div>
          {!authLoading && <AuthButton level={levelInfo?.current.label} />}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Profile card */}
        {user && profile && (
          <div
            className="mb-6 rounded-2xl p-5 text-white"
            style={{ background: "linear-gradient(135deg, #5BBAA7 0%, #4A9E8E 100%)" }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                {(profile.display_name || user.email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg leading-tight truncate">
                  {profile.display_name || user.email?.split("@")[0] || "Nutzer"}
                </p>
                {levelInfo && (
                  <div className="mt-1.5">
                    <p className="text-white/80 text-xs mb-1">
                      Level {levelInfo.current.label} · {stats?.visitedEventIds.length ?? 0} Events entdeckt
                    </p>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(levelInfo.progress, 100)}%` }}
                      />
                    </div>
                    <p className="text-white/60 text-[10px] mt-0.5">
                      {levelInfo.next ? `Noch ${levelInfo.eventsToNext} bis ${levelInfo.next.label}` : "Maximales Level!"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Not logged in hint */}
        {!authLoading && !user && (
          <div className="mb-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 text-center">
            <p className="font-semibold text-[var(--text-primary)] mb-1">Konto erstellen</p>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Speichere Events, verdiene Badges und synchronisiere deine Merkliste.
            </p>
            <Link
              href="/login"
              className="inline-block bg-kidgo-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-kidgo-500 transition"
            >
              Anmelden / Registrieren
            </Link>
          </div>
        )}

        {/* Navigation sections */}
        <div className="space-y-3">
          {sections.map(({ href, icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 hover:border-kidgo-200 hover:shadow-md transition-all group"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[var(--text-primary)] text-sm group-hover:text-kidgo-500 transition-colors">
                  {label}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-hover:text-kidgo-400 flex-shrink-0 transition">
                <path d="M5 10l4-4-4-4"/>
              </svg>
            </Link>
          ))}
        </div>

        {/* App info */}
        <div className="mt-8 text-center text-xs text-[var(--text-muted)] space-y-1">
          <div className="flex items-center justify-center gap-4">
            <Link href="/datenschutz" className="hover:text-kidgo-500 transition">Datenschutz</Link>
            <span>·</span>
            <Link href="/impressum" className="hover:text-kidgo-500 transition">Impressum</Link>
          </div>
          <p>Kidgo — Familien-Events Zürich</p>
        </div>
      </div>
    </main>
  );
}

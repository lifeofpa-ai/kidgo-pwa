"use client";

import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { useAuth } from "@/lib/auth-context";
import { AuthButton } from "@/components/AuthButton";
import { getLocalStats, getLevelProgress } from "@/lib/gamification";
import { useState, useEffect, useRef } from "react";
import { INTERESTS } from "@/lib/interests";
import { getCategoryIcon } from "@/components/Icons";
import { useUserPrefs } from "@/lib/user-prefs-context";
import { supabase } from "@/lib/supabase-browser";

const AGE_OPTIONS = [
  { key: "0-3", label: "0–3" },
  { key: "4-6", label: "4–6" },
  { key: "7-9", label: "7–9" },
  { key: "10-12", label: "10–12" },
];
const RADIUS_OPTIONS = [5, 10, 15, 25];
const INTEREST_ICON_MAP: Record<string, string> = {
  sport: "Sport", kreativ: "Kreativ", musik: "Musik", theater: "Theater",
  natur: "Natur", wissen: "Wissenschaft", schwimmen: "Sport", camp: "Feriencamp",
  indoor: "Bildung", kochen: "Kreativ", zirkus: "Tanz",
};

interface Child {
  name: string;
  age_bucket: string;
}

export default function IchPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { prefs, setPrefs, mounted: prefsMounted } = useUserPrefs();

  const [mounted, setMounted]           = useState(false);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [editMode, setEditMode]         = useState(false);
  const [saving, setSaving]             = useState(false);
  const [isDark, setIsDark]             = useState(false);
  const prefsRef = useRef(prefs);

  // Edit state
  const [children, setChildren]         = useState<Child[]>([]);
  const [interests, setInterests]       = useState<string[]>([]);
  const [radius, setRadius]             = useState(15);

  // Keep ref current so we can read latest prefs in effects without including it in deps
  useEffect(() => { prefsRef.current = prefs; });

  // Supabase profile wins on conflict — sync remote interests to local prefs once on load
  useEffect(() => {
    if (!profile || !prefsMounted) return;
    const remoteInterests = Array.isArray(profile.interests) ? (profile.interests as string[]) : null;
    if (remoteInterests && remoteInterests.length > 0) {
      setPrefs({ ...prefsRef.current, interests: remoteInterests });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id, prefsMounted]);

  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains("dark"));
    try {
      const raw = localStorage.getItem("kidgo_bookmarks");
      if (raw) setBookmarkCount(JSON.parse(raw).length);
    } catch {}
  }, []);

  // Sync edit state from prefs when opening edit mode
  useEffect(() => {
    if (editMode && prefsMounted) {
      // Load children from profile or prefs
      const profileChildren = (profile?.children as unknown as Child[]) || [];
      setChildren(profileChildren.length > 0 ? profileChildren : []);
      setInterests(prefs.interests);
      setRadius(prefs.radius);
    }
  }, [editMode, prefsMounted, profile, prefs]);

  const stats     = mounted ? getLocalStats(bookmarkCount) : null;
  const levelInfo = stats ? getLevelProgress(stats.visitedEventIds.length) : null;

  const toggleTheme = () => {
    const html = document.documentElement;
    const dark = html.classList.toggle("dark");
    setIsDark(dark);
    try { localStorage.setItem("kidgo_theme", dark ? "dark" : "light"); } catch {}
  };

  const addChild = () => setChildren((prev) => [...prev, { name: "", age_bucket: "4-6" }]);
  const removeChild = (i: number) => setChildren((prev) => prev.filter((_, idx) => idx !== i));
  const updateChild = (i: number, field: keyof Child, val: string) =>
    setChildren((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c));

  const toggleInterest = (id: string) =>
    setInterests((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSave = async () => {
    setSaving(true);
    const updatedPrefs = { ...prefs, interests, radius };
    setPrefs(updatedPrefs);

    // Persist to Supabase if logged in
    if (user) {
      try {
        await supabase
          .from("user_profiles")
          .upsert({ user_id: user.id, children, interests }, { onConflict: "user_id" });
      } catch (err) {
        console.error("Profile save error:", err);
      }
    }

    setSaving(false);
    setEditMode(false);
  };

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
          <div className="flex items-center gap-2">
            {/* Dark mode toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                aria-label={isDark ? "Helles Design" : "Dunkles Design"}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-kidgo-300 transition"
              >
                {isDark ? (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="7.5" cy="7.5" r="3"/><path d="M7.5 1v1M7.5 13v1M1 7.5h1M13 7.5h1M3 3l.7.7M11.3 11.3l.7.7M11.3 3.7l.7-.7M3.7 11.3L3 12"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 8.5A5 5 0 1 1 6.5 3 4 4 0 0 0 12 8.5z"/>
                  </svg>
                )}
              </button>
            )}
            {!authLoading && <AuthButton level={levelInfo?.current.label} />}
          </div>
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

        {/* Familienprofil — always visible, inline editable */}
        {prefsMounted && (
          <div className="mb-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-kidgo-50 flex items-center justify-center" style={{ color: "#5BBAA7" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="6" cy="5" r="2.5"/>
                    <path d="M1 14c0-3 2.2-5 5-5"/>
                    <circle cx="12" cy="7" r="2"/>
                    <path d="M9 14c0-2.2 1.3-3.5 3-3.5s3 1.3 3 3.5"/>
                  </svg>
                </div>
                <p className="font-bold text-[var(--text-primary)] text-sm">Familienprofil</p>
              </div>
              <button
                onClick={() => setEditMode((v) => !v)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${
                  editMode
                    ? "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                    : "bg-kidgo-50 text-kidgo-600 hover:bg-kidgo-100"
                }`}
              >
                {editMode ? "Abbrechen" : "Bearbeiten"}
              </button>
            </div>

            {!editMode ? (
              /* Summary view */
              <div className="px-5 py-4 space-y-3">
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1.5">Altersgruppen</p>
                  <div className="flex flex-wrap gap-1.5">
                    {prefs.ageBuckets.length > 0
                      ? prefs.ageBuckets.map((b) => (
                          <span key={b} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-kidgo-400 text-white">{b}</span>
                        ))
                      : <span className="text-xs text-[var(--text-muted)]">Keine gewählt</span>
                    }
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-1">Umkreis</p>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{prefs.radius} km</p>
                </div>
                {prefs.interests.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1">Interessen</p>
                    <p className="text-sm text-[var(--text-secondary)]">{prefs.interests.length} ausgewählt</p>
                  </div>
                )}
              </div>
            ) : (
              /* Edit view */
              <div className="px-5 py-5 space-y-6">

                {/* Children */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Kinder</p>
                    <button
                      onClick={addChild}
                      className="text-xs text-kidgo-500 hover:text-kidgo-600 font-semibold flex items-center gap-1 transition"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1v10M1 6h10"/></svg>
                      Kind hinzufügen
                    </button>
                  </div>
                  <div className="space-y-2">
                    {children.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] italic">Noch keine Kinder eingetragen.</p>
                    )}
                    {children.map((child, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={child.name}
                          onChange={(e) => updateChild(i, "name", e.target.value)}
                          placeholder="Name (optional)"
                          className="flex-1 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 transition"
                        />
                        <select
                          value={child.age_bucket}
                          onChange={(e) => updateChild(i, "age_bucket", e.target.value)}
                          className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl px-2 py-2 text-sm text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 transition"
                        >
                          {AGE_OPTIONS.map(({ key, label }) => (
                            <option key={key} value={key}>{label}</option>

                          ))}
                        </select>
                        <button
                          onClick={() => removeChild(i)}
                          aria-label="Kind entfernen"
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interessen */}
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Interessen</p>
                  <div className="grid grid-cols-2 gap-2">
                    {INTERESTS.map((interest) => {
                      const active  = interests.includes(interest.id);
                      const catIcon = INTEREST_ICON_MAP[interest.id] ?? "Sport";
                      return (
                        <button
                          key={interest.id}
                          onClick={() => toggleInterest(interest.id)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all active:scale-95 ${
                            active
                              ? "border-kidgo-400 bg-kidgo-50 dark:bg-kidgo-900/20"
                              : "border-[var(--border)] bg-[var(--bg-subtle)] hover:border-kidgo-200"
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: active ? "rgba(91,186,167,0.15)" : "transparent", color: active ? "#5BBAA7" : "var(--text-muted)" }}
                          >
                            {getCategoryIcon(catIcon, { size: 18 })}
                          </div>
                          <span className={`text-xs font-semibold leading-tight ${active ? "text-kidgo-600 dark:text-kidgo-400" : "text-[var(--text-secondary)]"}`}>
                            {interest.label}
                          </span>
                          {active && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#5BBAA7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto flex-shrink-0">
                              <path d="M2 5l2.5 2.5L8 2"/>
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Umkreis */}
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Umkreis</p>
                  <div className="flex gap-2">
                    {RADIUS_OPTIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRadius(r)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
                          radius === r
                            ? "border-kidgo-400 bg-kidgo-50 text-kidgo-600 dark:bg-kidgo-900/20 dark:text-kidgo-400"
                            : "border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-kidgo-200"
                        }`}
                      >
                        {r} km
                      </button>
                    ))}
                  </div>
                </div>

                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm bg-kidgo-400 text-white hover:bg-kidgo-500 transition active:scale-95 disabled:opacity-60"
                >
                  {saving ? "Speichern…" : "Änderungen speichern"}
                </button>
              </div>
            )}
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

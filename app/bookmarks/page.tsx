"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

interface BookmarkEntry {
  id: string;
  titel: string;
  datum: string | null;
  datum_ende: string | null;
  ort: string | null;
  kategorie_bild_url: string | null;
  kategorien: string[] | null;
  preis_chf: number | null;
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("kidgo_bookmarks");
      if (raw) setBookmarks(JSON.parse(raw));
    } catch {}
  }, []);

  const remove = (id: string) => {
    const next = bookmarks.filter((b) => b.id !== id);
    setBookmarks(next);
    try { localStorage.setItem("kidgo_bookmarks", JSON.stringify(next)); } catch {}
  };

  const clearAll = () => {
    setBookmarks([]);
    try { localStorage.removeItem("kidgo_bookmarks"); } catch {}
  };

  if (!mounted) return null;

  return (
    <main id="main-content" role="main" className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-10">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 bg-[var(--bg-card)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all duration-200 shadow-sm"
              aria-label="Zurück"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11L5 7l4-4"/>
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] leading-tight">Merkliste</h1>
              <p className="text-xs text-[var(--text-muted)]">{bookmarks.length} {bookmarks.length === 1 ? "Event" : "Events"} gespeichert</p>
            </div>
          </div>
          {bookmarks.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              Alle löschen
            </button>
          )}
        </div>

        {bookmarks.length === 0 ? (
          <EmptyState
            type="bookmarks-empty"
            title="Noch nichts gemerkt"
            message="Entdecke Events — tippe auf das Lesezeichen-Icon."
            actionHref="/"
          />
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bm) => {
              const now = new Date();
              const isPast = bm.datum
                ? new Date(bm.datum + "T23:59:59") < now
                : false;
              return (
                <div
                  key={bm.id}
                  className={`relative bg-[var(--bg-card)] rounded-xl shadow-sm border overflow-hidden transition-all duration-200 group ${
                    isPast
                      ? "border-[var(--border)] opacity-60"
                      : "border-[var(--border)] hover:border-[var(--accent)] hover:shadow-md"
                  }`}
                >
                  <Link href={`/events/${bm.id}`} className="flex items-center gap-4 p-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-subtle)]">
                      {bm.kategorie_bild_url ? (
                        <img
                          src={bm.kategorie_bild_url}
                          alt={bm.titel}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full bg-[var(--accent-light)] flex items-center justify-center">
                          <span className="text-[var(--accent)] text-sm font-bold">
                            {(bm.kategorien?.[0] || bm.titel).slice(0, 1)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--text-primary)] text-sm leading-snug truncate group-hover:text-[var(--accent)] transition-colors duration-200">
                        {bm.titel}
                      </p>
                      {bm.ort && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{bm.ort.split(",")[0]}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {bm.datum && (
                          <span className={`text-xs ${isPast ? "text-red-400" : "text-[var(--text-muted)]"}`}>
                            {isPast ? "Vergangen · " : ""}
                            {new Date(bm.datum + "T00:00:00").toLocaleDateString("de-CH", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                        {bm.preis_chf === 0 && (
                          <span className="text-xs font-semibold text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded-full">Gratis</span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={() => remove(bm.id)}
                    aria-label="Aus Merkliste entfernen"
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M2 2l10 10M12 2L2 12"/>
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-[var(--accent)] hover:text-[var(--kidgo-teal-dark)] transition-colors duration-200 font-medium">
            Zurück zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}

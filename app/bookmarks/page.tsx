"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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
    <main id="main-content" role="main" className="min-h-screen bg-[#F8F5F0] dark:bg-[#1A1D1C]">
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 transition shadow-sm"
              aria-label="Zurück"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11L5 7l4-4"/>
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Merkliste</h1>
              <p className="text-xs text-gray-400">{bookmarks.length} {bookmarks.length === 1 ? "Event" : "Events"} gespeichert</p>
            </div>
          </div>
          {bookmarks.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-gray-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              Alle löschen
            </button>
          )}
        </div>

        {bookmarks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 3h14a1 1 0 0 1 1 1v17l-8-4.5L4 21V4a1 1 0 0 1 1-1z"/>
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-300 font-semibold mb-1">Noch keine Events gespeichert</p>
            <p className="text-gray-400 text-sm mb-6">Tippe auf das Lesezeichen-Icon bei einem Event</p>
            <Link
              href="/"
              className="inline-block bg-[#5BBAA7] text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-[#4da896] transition"
            >
              Events entdecken
            </Link>
          </div>
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
                  className={`relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border overflow-hidden transition group ${
                    isPast ? "border-gray-100 dark:border-gray-700 opacity-60" : "border-gray-100 dark:border-gray-700 hover:border-[#5BBAA7]/40 hover:shadow-md"
                  }`}
                >
                  <Link href={`/events/${bm.id}`} className="flex items-center gap-4 p-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                      {bm.kategorie_bild_url ? (
                        <img
                          src={bm.kategorie_bild_url}
                          alt={bm.titel}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-[#5BBAA7]/20 to-[#5BBAA7]/10 flex items-center justify-center">
                          <span className="text-[#5BBAA7] text-sm font-bold">
                            {(bm.kategorien?.[0] || bm.titel).slice(0, 1)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug truncate group-hover:text-[#5BBAA7] transition-colors">
                        {bm.titel}
                      </p>
                      {bm.ort && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{bm.ort.split(",")[0]}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        {bm.datum && (
                          <span className={`text-xs ${isPast ? "text-red-400" : "text-gray-400"}`}>
                            {isPast ? "Vergangen · " : ""}
                            {new Date(bm.datum + "T00:00:00").toLocaleDateString("de-CH", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                        {bm.preis_chf === 0 && (
                          <span className="text-xs font-semibold text-[#5BBAA7] bg-[#5BBAA7]/10 px-2 py-0.5 rounded-full">Gratis</span>
                        )}
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={() => remove(bm.id)}
                    aria-label="Aus Merkliste entfernen"
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition"
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
          <Link href="/" className="text-sm text-[#5BBAA7] hover:text-[#4da896] transition font-medium">
            Zurück zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}

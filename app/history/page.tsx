"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface VisitEntry {
  id: string;
  titel: string;
  datum: string | null;
  ort: string | null;
  kategorie_bild_url: string | null;
  kategorien: string[] | null;
  visitedAt?: string;
}

export default function HistoryPage() {
  const [visits, setVisits] = useState<VisitEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem("kidgo_recent_visits");
      if (raw) setVisits(JSON.parse(raw));
    } catch {}
  }, []);

  const clearHistory = () => {
    try { localStorage.removeItem("kidgo_recent_visits"); } catch {}
    setVisits([]);
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
              <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">Verlauf</h1>
              <p className="text-xs text-gray-400">Zuletzt angeschaute Events</p>
            </div>
          </div>
          {visits.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-gray-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              Verlauf löschen
            </button>
          )}
        </div>

        {visits.length === 0 ? (
          <div className="text-center py-14">
            <div className="empty-float mx-auto mb-5 w-24 h-24">
              <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="96" height="96" rx="24" fill="#EFF8F6"/>
                <circle cx="48" cy="48" r="22" stroke="#5BBAA7" strokeWidth="2.2" fill="none"/>
                <path d="M48 30v4M48 62v4M30 48h4M62 48h4" stroke="#5BBAA7" strokeWidth="2" strokeLinecap="round"/>
                <path d="M40 40l16 6-6 16-16-6z" fill="#5BBAA7" fillOpacity="0.25" stroke="#5BBAA7" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="48" cy="48" r="4" fill="#5BBAA7"/>
              </svg>
            </div>
            <p className="text-gray-700 dark:text-gray-200 font-semibold mb-1">Dein Abenteuer beginnt hier</p>
            <p className="text-gray-400 text-sm mb-6">Besuchte Event-Seiten erscheinen hier</p>
            <Link
              href="/"
              className="inline-block bg-[#5BBAA7] text-white px-6 py-3 rounded-2xl font-bold text-sm hover:bg-[#4da896] transition"
            >
              Events entdecken
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {visits.map((visit, i) => (
              <Link
                key={`${visit.id}-${i}`}
                href={`/events/${visit.id}`}
                className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover:border-[#5BBAA7]/40 hover:shadow-md transition group"
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                  {visit.kategorie_bild_url ? (
                    <img
                      src={visit.kategorie_bild_url}
                      alt={visit.titel}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#5BBAA7]/20 to-[#5BBAA7]/10 flex items-center justify-center">
                      <span className="text-[#5BBAA7] text-sm font-bold">
                        {(visit.kategorien?.[0] || visit.titel).slice(0, 1)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug truncate group-hover:text-[#5BBAA7] transition-colors">
                    {visit.titel}
                  </p>
                  {visit.ort && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{visit.ort.split(",")[0]}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {visit.datum && (
                      <span className="text-xs text-gray-400">
                        {new Date(visit.datum + "T00:00:00").toLocaleDateString("de-CH", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    )}
                    {visit.visitedAt && (
                      <>
                        <span className="text-gray-200 text-xs">·</span>
                        <span className="text-xs text-gray-300">
                          Besucht {new Date(visit.visitedAt).toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-[#5BBAA7] flex-shrink-0 transition">
                  <path d="M5 10l3-3-3-3"/>
                </svg>
              </Link>
            ))}
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

"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { ChatFAB } from "@/components/home/ChatFAB";
import { ChatSheet } from "@/components/home/ChatSheet";

interface KidgoEvent {
  id: string;
  titel: string;
  datum: string | null;
  ort: string | null;
  kategorie_bild_url: string | null;
  kategorien: string[] | null;
}

function localDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function PlanerPage() {
  const [events, setEvents] = useState<KidgoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + mondayOffset + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const todayStr = localDateStr(now);

  useEffect(() => {
    setMounted(true);
    const todayIdx = dow === 0 ? 6 : dow - 1;
    setSelectedDay(todayIdx);
  }, [dow]);

  useEffect(() => {
    const weekStart = localDateStr(weekDays[0]);
    const weekEnd = localDateStr(weekDays[6]);

    supabase
      .from("events")
      .select("id,titel,datum,ort,kategorie_bild_url,kategorien")
      .eq("status", "approved")
      .gte("datum", weekStart)
      .lte("datum", weekEnd)
      .order("datum", { ascending: true })
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventsByDay = weekDays.map((day) => {
    const ds = localDateStr(day);
    return events.filter((e) => e.datum === ds);
  });

  const selectedDayEvents = selectedDay !== null ? eventsByDay[selectedDay] : [];
  const selectedDate = selectedDay !== null ? weekDays[selectedDay] : null;

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#F8F5F0] dark:bg-[#1A1D1C] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-[#1e2221]/95 backdrop-blur-md border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/" aria-label="Startseite">
            <KidgoLogo size="sm" animated />
          </Link>
          <div>
            <h1 className="font-bold text-[var(--text-primary)] text-base leading-tight">Planer</h1>
            <p className="text-xs text-[var(--text-muted)]">Deine Woche auf einen Blick</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Week strip */}
        <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden mb-6">
          <div className="flex">
            {weekDays.map((day, i) => {
              const isToday = localDateStr(day) === todayStr;
              const hasEvents = eventsByDay[i].length > 0;
              const selected = selectedDay === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDay(selected ? null : i)}
                  className={`flex-1 py-3.5 flex flex-col items-center gap-1 transition-colors ${
                    selected ? "bg-kidgo-50 dark:bg-kidgo-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  } ${isToday ? "border-b-2 border-kidgo-400" : "border-b-2 border-transparent"}`}
                >
                  <span className={`text-[10px] font-semibold uppercase ${
                    isToday ? "text-kidgo-500" : selected ? "text-kidgo-500" : "text-[var(--text-muted)]"
                  }`}>
                    {DAY_LABELS[i]}
                  </span>
                  <span className={`text-base font-bold ${
                    isToday ? "text-kidgo-500" : selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                  }`}>
                    {day.getDate()}
                  </span>
                  <div className="h-1.5 flex items-center">
                    {hasEvents ? (
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        isToday ? "bg-kidgo-400" : selected ? "bg-kidgo-300" : "bg-gray-300 dark:bg-gray-600"
                      }`} />
                    ) : (
                      <span className="w-1.5 h-1.5" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day events */}
        {selectedDate && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[var(--text-primary)] text-lg">
                {selectedDate.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" })}
              </h2>
              {selectedDayEvents.length > 0 && (
                <span className="text-xs font-semibold text-kidgo-500 bg-kidgo-50 px-2.5 py-1 rounded-full">
                  {selectedDayEvents.length} Events
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="text-center py-12 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]">
                <div className="w-12 h-12 bg-kidgo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="16" height="16" rx="2"/>
                    <path d="M2 8h16M7 1v4M13 1v4"/>
                  </svg>
                </div>
                <p className="font-semibold text-[var(--text-primary)] mb-1">Nichts geplant</p>
                <p className="text-sm text-[var(--text-muted)] mb-4">An diesem Tag gibt es keine Events.</p>
                <Link
                  href="/explore"
                  className="inline-block bg-kidgo-400 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-kidgo-500 transition"
                >
                  Events entdecken →
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/events/${ev.id}`}
                    className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 hover:border-kidgo-200 hover:shadow-md transition-all group"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-kidgo-50">
                      {ev.kategorie_bild_url ? (
                        <img src={ev.kategorie_bild_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[var(--text-primary)] text-sm leading-snug line-clamp-2 group-hover:text-kidgo-500 transition-colors">
                        {ev.titel}
                      </p>
                      {ev.ort && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 1a3 3 0 0 1 3 3c0 2.5-3 7-3 7S3 6.5 3 4a3 3 0 0 1 3-3z"/>
                            <circle cx="6" cy="4" r="1"/>
                          </svg>
                          {ev.ort.split(",")[0].trim()}
                        </p>
                      )}
                      {ev.kategorien && ev.kategorien.length > 0 && (
                        <span className="mt-1 inline-block text-[10px] font-semibold text-kidgo-500 bg-kidgo-50 px-2 py-0.5 rounded-full">
                          {ev.kategorien[0]}
                        </span>
                      )}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)] group-hover:text-kidgo-400 flex-shrink-0 transition">
                      <path d="M5 10l4-4-4-4"/>
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Link to explore for next week */}
        <div className="mt-8 text-center">
          <Link
            href="/explore"
            className="text-sm text-[var(--text-muted)] hover:text-kidgo-500 transition underline decoration-dotted underline-offset-4"
          >
            Alle Events entdecken →
          </Link>
        </div>
      </div>

      <ChatFAB onClick={() => setChatOpen(true)} />
      <ChatSheet open={chatOpen} onClose={() => setChatOpen(false)} />
    </main>
  );
}

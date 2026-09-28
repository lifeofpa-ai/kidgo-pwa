"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { EventImage } from "@/components/home/EventCards";
import { supabase } from "@/lib/supabase-browser";
import { trackEvent } from "@/lib/analytics";
import { localDateStr } from "@/lib/home-constants";

interface PreviewEvent {
  id: string;
  titel: string;
  ort: string | null;
  kategorie_bild_url: string | null;
  kategorien: string[] | null;
}

const BENEFITS = [
  {
    title: "Wetter- & ortsbewusst",
    desc: "Kidgo zeigt, was JETZT in deiner Nähe passt — drinnen bei Regen, draussen bei Sonne.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    title: "Passend zum Alter",
    desc: "Filtert automatisch auf die Altersgruppen deiner Kinder — keine Erwachsenenevents dazwischen.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="3" /><circle cx="17" cy="8" r="2.5" />
        <path d="M2 21c0-4 3-6 7-6s7 2 7 6" /><path d="M17 14c2.5 0 5 1.5 5 5" />
      </svg>
    ),
  },
  {
    title: "Garantiert aktuell",
    desc: "Täglich geprüfte Daten aus über hundert Quellen — keine veralteten oder toten Links.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
];

const STEPS = [
  { title: "Swipen", desc: "Events entdecken — nach rechts merken, nach links weiter." },
  { title: "Merken", desc: "Gemerkte Events landen auf deiner Merkliste, jederzeit griffbereit." },
  { title: "Planen", desc: "Im Planer siehst du alles Kommende auf einen Blick." },
];

export function Landingpage({ onContinue }: { onContinue: () => void }) {
  const [previewEvents, setPreviewEvents] = useState<PreviewEvent[] | null>(null);

  useEffect(() => {
    trackEvent("landing_view");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = localDateStr(new Date());
        const { data, error } = await supabase
          .from("events")
          .select("id,titel,ort,kategorie_bild_url,kategorien,datum")
          .eq("status", "approved")
          .or(`datum.gte.${today},datum.is.null`)
          .not("kategorie_bild_url", "is", null)
          .order("datum", { ascending: true, nullsFirst: false })
          .limit(15);
        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setPreviewEvents([]);
          return;
        }
        const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 3);
        setPreviewEvents(shuffled);
      } catch {
        if (!cancelled) setPreviewEvents([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleContinue = () => {
    trackEvent("landing_cta_click");
    onContinue();
  };

  return (
    <div
      className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain"
      style={{ background: "#FAFAF8" }}
      aria-modal="true"
      role="dialog"
    >
      {/* HERO */}
      <div
        className="px-6 pt-14 pb-16 text-center"
        style={{ background: "linear-gradient(160deg, #0d2e2a 0%, #1a4a42 55%, #0d2e2a 100%)" }}
      >
        <div className="flex justify-center mb-6">
          <KidgoLogo size="md" mono animated />
        </div>
        <h1 className="text-white font-bold text-2xl leading-snug mb-3 max-w-sm mx-auto">
          Spontan die passende Kinderaktivität finden — heute, in deiner Nähe.
        </h1>
        <p className="text-white/60 text-sm max-w-xs mx-auto mb-8">
          Wetter-, saison- und ortsbewusst — passend zu deinen Kindern, mit garantiert aktuellen Daten.
        </p>
        <button
          onClick={handleContinue}
          className="px-8 py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #5BBAA7, #4A9E8E)",
            color: "white",
            boxShadow: "0 8px 32px rgba(91,186,167,0.35)",
          }}
        >
          Jetzt entdecken →
        </button>
      </div>

      {/* LIVE PREVIEW */}
      {previewEvents === null || previewEvents.length > 0 ? (
        <div className="px-5 pt-8 pb-2">
          <h2 className="text-[var(--text-primary,#2D3436)] font-bold text-lg mb-1">Das ist heute los</h2>
          <p className="text-gray-500 text-sm mb-4">Ein Ausschnitt aus dem aktuellen Angebot</p>
          <div className="grid grid-cols-1 gap-3">
            {previewEvents === null
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex" aria-hidden="true">
                    <div className="w-24 h-24 skeleton flex-shrink-0" />
                    <div className="p-3 flex-1 space-y-2">
                      <div className="h-3.5 skeleton w-2/3" />
                      <div className="h-3 skeleton w-1/2" />
                    </div>
                  </div>
                ))
              : previewEvents.map((ev) => (
                  <div key={ev.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex">
                    <EventImage
                      url={ev.kategorie_bild_url}
                      kategorien={ev.kategorien}
                      title={ev.titel}
                      className="w-24 h-24 flex-shrink-0"
                    />
                    <div className="p-3 flex-1 min-w-0">
                      <p className="font-bold text-gray-800 text-sm leading-tight truncate">{ev.titel}</p>
                      {ev.ort && <p className="text-gray-500 text-xs mt-1 truncate">{ev.ort}</p>}
                    </div>
                  </div>
                ))}
          </div>
        </div>
      ) : null}

      {/* BENEFITS */}
      <div className="px-5 pt-8 pb-2">
        <div className="grid grid-cols-1 gap-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex items-start gap-3 bg-[#EFF8F6] rounded-xl p-4">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0 text-[#4A9E8E]">
                {b.icon}
              </div>
              <div>
                <p className="font-bold text-gray-800 text-sm">{b.title}</p>
                <p className="text-gray-500 text-xs mt-0.5 leading-snug">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="px-5 pt-8 pb-2">
        <h2 className="text-[var(--text-primary,#2D3436)] font-bold text-lg mb-4">So funktioniert&apos;s</h2>
        <div className="grid grid-cols-3 gap-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="text-center">
              <div className="w-10 h-10 rounded-full bg-[#5BBAA7] text-white font-bold flex items-center justify-center mx-auto mb-2">
                {i + 1}
              </div>
              <p className="font-bold text-gray-800 text-xs mb-1">{s.title}</p>
              <p className="text-gray-500 text-[11px] leading-snug">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* TRUST */}
      <div className="px-5 pt-8 pb-4 text-center">
        <div className="flex items-center justify-center gap-4 text-gray-400 text-xs mb-3 flex-wrap">
          <span>Kostenlos</span>
          <span aria-hidden="true">·</span>
          <span>Ohne Werbung</span>
          <span aria-hidden="true">·</span>
          <Link href="/datenschutz" className="underline hover:text-gray-600">Datenschutz</Link>
        </div>
        <p className="text-gray-400 text-xs mb-6">
          Kidgo ist in der Beta — <Link href="/feedback" className="underline hover:text-gray-600">dein Feedback zählt</Link>.
        </p>
        <button
          onClick={handleContinue}
          className="w-full max-w-sm mx-auto block py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #5BBAA7, #4A9E8E)",
            color: "white",
            boxShadow: "0 8px 32px rgba(91,186,167,0.25)",
          }}
        >
          Jetzt entdecken →
        </button>
      </div>

      {/* INSTALL HINT */}
      <div className="px-5 pb-10 pt-2 text-center">
        <p className="text-gray-400 text-[11px]">
          Tipp: Über &quot;Zum Startbildschirm hinzufügen&quot; im Browser-Menü installierst du Kidgo wie eine App.
        </p>
      </div>
    </div>
  );
}

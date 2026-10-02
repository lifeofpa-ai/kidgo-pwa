"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { setEventRating } from "@/lib/preferences";
import { recordSignal, metaFromEvent } from "@/lib/swipe-signals";
import { INTERESTS } from "@/lib/interests";

// Geschmackstest im Onboarding (02.10.2026): 6 echte Events aus verschiedenen
// Kategorien, je ein Tipp auf "Gefällt uns" oder "Eher nicht". Bringt Kidgo in
// ~20 Sekunden das erste Profil: "Gefällt uns" zählt wie ein Like (Präferenzprofil
// + Lernsignal), passende Interessen werden automatisch ergänzt. "Eher nicht"
// ist nur ein Lernsignal — es blendet das Event nirgends aus.

interface TasteEvent {
  id: string;
  titel: string;
  kategorien: string[] | null;
  kategorie_bild_url: string | null;
  preis_chf: number | null;
  indoor_outdoor: string | null;
  alter_von: number | null;
  alter_bis: number | null;
  alters_buckets: string[] | null;
  ort: string | null;
}

const MAIN_CATEGORIES = ["Kreativ", "Natur", "Sport", "Theater", "Musik", "Wissenschaft", "Ausflug", "Tiere", "Tanz"];

function pickDiverse(events: TasteEvent[], ages: string[], n: number): TasteEvent[] {
  const fits = (e: TasteEvent) =>
    ages.length === 0 || !e.alters_buckets || e.alters_buckets.length === 0 || ages.some((a) => e.alters_buckets!.includes(a));
  const pool = events.filter(fits).sort(() => Math.random() - 0.5);
  const picked: TasteEvent[] = [];
  const used = new Set<string>();
  for (const cat of MAIN_CATEGORIES) {
    const e = pool.find((x) => x.kategorien?.[0] === cat && !used.has(x.id));
    if (e) { picked.push(e); used.add(e.id); }
    if (picked.length >= n) break;
  }
  return picked.sort(() => Math.random() - 0.5);
}

export function TasteTest({
  ages,
  onInterestsFound,
  onDone,
}: {
  ages: string[];
  onInterestsFound: (interestIds: string[]) => void;
  onDone: () => void;
}) {
  const [cards, setCards] = useState<TasteEvent[] | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data } = await supabase
          .from("events")
          .select("id,titel,kategorien,kategorie_bild_url,preis_chf,indoor_outdoor,alter_von,alter_bis,alters_buckets,ort")
          .eq("status", "approved")
          .not("kategorie_bild_url", "is", null)
          .or(`datum.is.null,datum.gte.${today}`)
          .limit(400);
        if (!alive) return;
        setCards(pickDiverse((data ?? []) as TasteEvent[], ages, 6));
      } catch {
        if (alive) setCards([]);
      }
    })();
    return () => { alive = false; };
  }, [ages]);

  const answer = (liked: boolean) => {
    if (!cards) return;
    const e = cards[idx];
    const meta = metaFromEvent(e, null);
    if (liked) {
      setEventRating(e, "like");
      recordSignal("like", e.id, meta);
      const ids = INTERESTS.filter((i) => i.categories.some((c) => e.kategorien?.includes(c))).map((i) => i.id);
      if (ids.length) onInterestsFound(ids);
    } else {
      recordSignal("skip", e.id, meta);
    }
    try { (navigator as any).vibrate?.(8); } catch {}
    if (idx + 1 >= cards.length) onDone();
    else setIdx(idx + 1);
  };

  if (cards === null) {
    return <p className="text-white/60 text-sm py-16 text-center">Einen Moment …</p>;
  }
  if (cards.length < 3) {
    return (
      <div className="text-center py-10">
        <p className="text-white/70 text-sm mb-4">Heute gibt es keine Beispiele – Kidgo lernt beim Stöbern.</p>
        <button onClick={onDone} className="text-[#5BBAA7] font-bold text-sm">Weiter</button>
      </div>
    );
  }

  const e = cards[idx];
  return (
    <div style={{ animation: "tutorialSlideIn 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
      <h1 className="text-white font-bold text-2xl mb-1">Was gefällt euch?</h1>
      <p className="text-white/60 text-sm mb-5">{idx + 1} von {cards.length} – so lernt Kidgo euren Geschmack</p>
      <div className="rounded-2xl overflow-hidden border-2" style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.kategorie_bild_url ?? ""} alt={e.titel} className="w-full h-44 object-cover" />
        <div className="p-4">
          <p className="text-white font-bold text-base leading-snug mb-1">{e.titel}</p>
          <p className="text-white/60 text-xs">{[e.kategorien?.[0], e.ort?.split(",")[0]].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="flex gap-3 mt-5">
        <button
          onClick={() => answer(false)}
          className="flex-1 py-3.5 rounded-2xl font-bold text-sm border-2 text-white/80 transition-all active:scale-95"
          style={{ borderColor: "rgba(255,255,255,0.25)" }}
        >
          ✕ Eher nicht
        </button>
        <button
          onClick={() => answer(true)}
          className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #5BBAA7, #4A9E8E)" }}
        >
          ♥ Gefällt uns
        </button>
      </div>
    </div>
  );
}

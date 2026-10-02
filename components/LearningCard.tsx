"use client";

import { useEffect, useState } from "react";
import { buildDismissProfile } from "@/lib/preferences";
import { describeLearnings, clearSignals } from "@/lib/swipe-signals";
import { getPastDismissals } from "@/lib/dismiss-reasons";

/**
 * "Was Kidgo über euch gelernt hat" (02.10.2026): macht das Lernen sichtbar
 * und lässt es zurücksetzen. Alle Daten bleiben auf dem Gerät bzw. im eigenen
 * Konto — kein Profiling durch Dritte.
 */
export function LearningCard() {
  const [learn, setLearn] = useState<{ more: string[]; less: string[] } | null>(null);
  const [count, setCount] = useState(0);

  const load = () => {
    try {
      const profile = buildDismissProfile(getPastDismissals());
      setCount(profile?.signalCount ?? 0);
      setLearn(describeLearnings(profile));
    } catch {
      setLearn({ more: [], less: [] });
    }
  };
  useEffect(load, []);

  if (!learn) return null;
  const hasInsight = learn.more.length > 0 || learn.less.length > 0;

  const reset = () => {
    clearSignals();
    try {
      localStorage.removeItem("kidgo_dismissals");
      localStorage.removeItem("kidgo_skip_until");
    } catch {}
    load();
  };

  return (
    <div className="mb-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
      <p className="font-bold text-[var(--text-primary)] text-sm mb-1">So lernt Kidgo</p>
      {hasInsight ? (
        <div className="text-sm text-[var(--text-secondary)] space-y-1">
          {learn.more.length > 0 && <p>Mehr davon: <span className="font-semibold">{learn.more.join(", ")}</span></p>}
          {learn.less.length > 0 && <p>Weniger davon: <span className="font-semibold">{learn.less.join(", ")}</span></p>}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          Wische Karten nach links («Nicht für uns») oder rechts («Gefällt mir») – Kidgo lernt daraus und macht immer bessere Vorschläge.
          {count > 0 ? ` Bisher ${count} Rückmeldungen – noch zu wenig für ein klares Bild.` : ""}
        </p>
      )}
      {count > 0 && (
        <button type="button" onClick={reset} className="mt-3 text-xs font-semibold text-[var(--text-muted)] underline hover:text-kidgo-500">
          Gelerntes zurücksetzen
        </button>
      )}
    </div>
  );
}

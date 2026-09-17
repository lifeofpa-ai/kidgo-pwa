// components/OnboardingWalkthrough.tsx
//
// Konzept: 3 Screens, einmalig gezeigt (localStorage-Flag), bewusst KEINE
// DB-Migration - kostet nichts, funktioniert sofort, auch fuer nicht
// eingeloggte Nutzende. Jeder Screen traegt dezent EIN USP, ohne es als
// "Feature" zu labeln - reine Ich-Perspektive der Nutzenden.
//
// USP-Zuordnung (Quelle: Miro "USP-Schärfung Teil 2", CEO-Entscheid 14.07.2026):
//  1. Spontan/Jetzt-Modus  2. Aktualitaet & Saison-Relevanz  3. Merkliste/Erfolge
//
// CEO-Entscheid 15.09.2026: Wird bewusst ERST nach Abschluss der bestehenden
// Praeferenz-Abfrage (OnboardingFlow/OnboardingGate, prefs.onboarded) gezeigt,
// nicht parallel/davor - sonst zwei Vollbild-Screens direkt nacheinander fuer
// neue Nutzende.

"use client";
import { useEffect, useState } from "react";
import { useUserPrefs } from "@/lib/user-prefs-context";

const STORAGE_KEY = "kidgo_onboarding_seen_v1";

const slides = [
  {
    headline: "Spontan das Richtige finden",
    text: "Kidgo zeigt dir, was gerade jetzt in deiner Nähe für deine Kinder läuft – ohne stundenlanges Suchen.",
  },
  {
    headline: "Immer aktuell, immer passend",
    text: "Über 1'500 Aktivitäten und Ferienlager aus der Region Zürich – täglich aktualisiert, damit dir im Sommer keine Skikurse angezeigt werden.",
  },
  {
    headline: "Merken & entdecken",
    text: "Speichere Favoriten auf deiner Merkliste und sammle mit deiner Familie neue Erfolge.",
  },
];

export function OnboardingWalkthrough() {
  const { prefs, mounted: prefsMounted } = useUserPrefs();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!prefsMounted || !prefs.onboarded) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Private-Mode o.ä. - Onboarding einfach nicht blockierend anzeigen
    }
  }, [prefsMounted, prefs.onboarded]);

  const close = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  };

  if (!visible) return null;

  const isLast = step === slides.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Willkommen bei Kidgo"
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="relative w-full md:max-w-sm bg-white dark:bg-[#1e2221] rounded-t-2xl md:rounded-2xl px-6 pt-6 pb-8 md:pb-6">
        <button
          onClick={close}
          className="absolute top-4 right-4 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          Überspringen
        </button>

        <div className="mt-6 mb-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {slides[step].headline}
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
            {slides[step].text}
          </p>
        </div>

        {/* Dezente Punkt-Navigation */}
        <div className="flex items-center justify-center gap-1.5 mb-6">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-5 bg-[var(--kidgo-teal)]" : "w-1.5 bg-[var(--border)]"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => (isLast ? close() : setStep((s) => s + 1))}
          className="w-full rounded-xl py-3 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(to right, #5BBAA7, #4A9E8E)" }}
        >
          {isLast ? "Los geht's" : "Weiter"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useUserPrefs } from "@/lib/user-prefs-context";
import { INTERESTS } from "@/lib/interests";
import { getCategoryIcon } from "@/components/Icons";

const AGE_OPTIONS = [
  { key: "0-3",   label: "0–3",   desc: "Kleinkind" },
  { key: "4-6",   label: "4–6",   desc: "Vorschule" },
  { key: "7-9",   label: "7–9",   desc: "Schulkind" },
  { key: "10-12", label: "10–12", desc: "Entdecker" },
];

const INTEREST_ICON_MAP: Record<string, string> = {
  sport:     "Sport",
  kreativ:   "Kreativ",
  musik:     "Musik",
  theater:   "Theater",
  natur:     "Natur",
  wissen:    "Wissenschaft",
  schwimmen: "Sport",
  camp:      "Feriencamp",
  indoor:    "Bildung",
  kochen:    "Kreativ",
  zirkus:    "Tanz",
};

const RADIUS_OPTIONS = [5, 10, 15, 25] as const;
const TOTAL_STEPS = 4;

export function OnboardingFlow() {
  const { prefs, setPrefs, markOnboarded } = useUserPrefs();
  const [step, setStep]           = useState(0);
  const [ages, setAges]           = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [radius, setRadius]       = useState(15);

  const toggleAge = (key: string) =>
    setAges((p) => p.includes(key) ? p.filter((a) => a !== key) : [...p, key]);

  const toggleInterest = (id: string) =>
    setInterests((p) => p.includes(id) ? p.filter((i) => i !== id) : [...p, id]);

  const next = useCallback(() => {
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
  }, [step]);

  const prev = useCallback(() => {
    if (step > 0) setStep((s) => s - 1);
  }, [step]);

  const finish = useCallback(() => {
    const updated = { ...prefs, ageBuckets: ages, interests, radius, onboarded: true };
    setPrefs(updated);
    try {
      localStorage.setItem("kidgo_onboarded", "true");
      localStorage.setItem("kidgo_tutorial_seen", "true");
      if (ages.length > 0) localStorage.setItem("kidgo_age_buckets", JSON.stringify(ages));
      if (interests.length > 0) localStorage.setItem("kidgo_interests", JSON.stringify(interests));
    } catch {}
    markOnboarded();
  }, [prefs, setPrefs, ages, interests, radius, markOnboarded]);

  const glassCard = (active: boolean) => ({
    background: active ? "rgba(91,186,167,0.2)" : "rgba(255,255,255,0.05)",
    borderColor: active ? "#5BBAA7" : "rgba(255,255,255,0.12)",
    backdropFilter: "blur(12px)",
  });

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(160deg, #0d2e2a 0%, #1a4a42 50%, #0d2e2a 100%)" }}
      aria-modal="true"
      role="dialog"
    >
      {/* Progress dots */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === step ? 24 : 8,
              height: 8,
              background: i <= step ? "#5BBAA7" : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>

      {/* Skip */}
      {step < TOTAL_STEPS - 1 && (
        <button
          onClick={next}
          className="absolute top-7 right-6 text-white/50 hover:text-white/80 text-sm font-medium transition-colors z-10"
        >
          Überspringen
        </button>
      )}

      {/* Slide content */}
      <div className="w-full max-w-md px-6 pt-20 pb-6 overflow-y-auto" style={{ maxHeight: "100dvh" }}>

        {/* Step 1 — Alter */}
        {step === 0 && (
          <div style={{ animation: "tutorialSlideIn 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
            <h1 className="text-white font-bold text-2xl mb-1">Wie alt sind eure Kinder?</h1>
            <p className="text-white/50 text-sm mb-7">Mehrere Altersgruppen wählbar</p>
            <div className="grid grid-cols-2 gap-3">
              {AGE_OPTIONS.map(({ key, label, desc }) => {
                const active = ages.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleAge(key)}
                    className="relative p-5 rounded-2xl border-2 text-left transition-all active:scale-95"
                    style={glassCard(active)}
                  >
                    {active && (
                      <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-[#5BBAA7] rounded-full flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 5l2.5 2.5L8 2" />
                        </svg>
                      </span>
                    )}
                    <p className="text-white font-bold text-2xl">{label}</p>
                    <p className="text-white/50 text-xs mt-0.5">{desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2 — Interessen */}
        {step === 1 && (
          <div style={{ animation: "tutorialSlideIn 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
            <h1 className="text-white font-bold text-2xl mb-1">Was interessiert euch?</h1>
            <p className="text-white/50 text-sm mb-5">Wähle alles was passt</p>
            <div className="grid grid-cols-2 gap-2.5 pb-2" style={{ maxHeight: "52vh", overflowY: "auto", scrollbarWidth: "none" }}>
              {INTERESTS.map((interest) => {
                const active  = interests.includes(interest.id);
                const catIcon = INTEREST_ICON_MAP[interest.id] ?? "Sport";
                return (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    className="flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition-all active:scale-95"
                    style={glassCard(active)}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: active ? "rgba(91,186,167,0.3)" : "rgba(255,255,255,0.1)" }}
                    >
                      <div style={{ color: active ? "#5BBAA7" : "rgba(255,255,255,0.55)", transform: "scale(0.8)" }}>
                        {getCategoryIcon(catIcon, { size: 20 })}
                      </div>
                    </div>
                    <span className="text-white text-xs font-semibold leading-tight">{interest.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3 — Umkreis */}
        {step === 2 && (
          <div style={{ animation: "tutorialSlideIn 0.35s cubic-bezier(0.4,0,0.2,1) both" }}>
            <h1 className="text-white font-bold text-2xl mb-1">Wie weit reist ihr?</h1>
            <p className="text-white/50 text-sm mb-10">Maximaler Umkreis ab Zürich</p>
            <div className="flex justify-center gap-4 flex-wrap mb-8">
              {RADIUS_OPTIONS.map((r) => {
                const active = radius === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className="w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center transition-all active:scale-95"
                    style={glassCard(active)}
                  >
                    <span className="text-white font-bold text-xl">{r}</span>
                    <span className="text-white/40 text-xs">km</span>
                  </button>
                );
              })}
            </div>
            <div
              className="rounded-2xl p-4 text-center"
              style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(8px)" }}
            >
              <p className="text-white/80 text-sm">
                Bis zu{" "}
                <span className="text-[#5BBAA7] font-bold">{radius} km</span>
                {" "}rund um Zürich
              </p>
            </div>
          </div>
        )}

        {/* Step 4 — Los geht's */}
        {step === 3 && (
          <div
            style={{ animation: "tutorialSlideIn 0.35s cubic-bezier(0.4,0,0.2,1) both" }}
            className="text-center"
          >
            <div
              className="w-24 h-24 rounded-3xl mx-auto mb-8 flex items-center justify-center"
              style={{ background: "rgba(91,186,167,0.2)", border: "2px solid rgba(91,186,167,0.5)" }}
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#5BBAA7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="24" cy="24" r="20" strokeOpacity="0.3" />
                <path d="M16 24l6 6 10-12" />
              </svg>
            </div>
            <h1 className="text-white font-bold text-2xl mb-4">Alles bereit!</h1>
            <div className="space-y-1.5 mb-10">
              <p className="text-white/60 text-sm">
                {ages.length > 0 ? `Alter: ${ages.join(", ")}` : "Alle Altersgruppen"}
              </p>
              {interests.length > 0 && (
                <p className="text-white/60 text-sm">{interests.length} Interessen gewählt</p>
              )}
              <p className="text-white/60 text-sm">Umkreis: {radius} km</p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 space-y-3">
          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={next}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #5BBAA7, #4A9E8E)",
                color: "white",
                boxShadow: "0 8px 32px rgba(91,186,167,0.35)",
              }}
            >
              Weiter
            </button>
          ) : (
            <button
              onClick={finish}
              className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #5BBAA7, #4A9E8E)",
                color: "white",
                boxShadow: "0 8px 32px rgba(91,186,167,0.35)",
              }}
            >
              Los geht&apos;s!
            </button>
          )}
          {step > 0 && (
            <button
              onClick={prev}
              className="w-full py-2 text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              Zurück
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

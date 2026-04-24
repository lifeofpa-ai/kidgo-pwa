"use client";

import { useState, useRef, useCallback } from "react";

interface OnboardingTutorialProps {
  onComplete: () => void;
}

const slides = [
  {
    id: 1,
    title: "Willkommen bei Kidgo",
    subtitle: "Dein intelligenter Familien-Assistent für Zürich",
    illustration: (
      <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Kidgo logo mark — stylised K in teal circle */}
        <circle cx="80" cy="80" r="64" stroke="#5BBAA7" strokeWidth="2.5" />
        <circle cx="80" cy="80" r="50" stroke="#5BBAA7" strokeWidth="1.2" strokeDasharray="4 4" />
        <path d="M56 52v56M56 80l30-28M56 80l30 28" stroke="#5BBAA7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="80" cy="80" r="8" fill="#5BBAA7" fillOpacity="0.15" stroke="#5BBAA7" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    id: 2,
    title: "Kidgo versteht euch",
    subtitle: "Bewerte Events — und Kidgo lernt euren Geschmack. Je mehr ihr bewertet, desto besser werden die Empfehlungen.",
    illustration: (
      <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Thumbs up / down */}
        <rect x="28" y="58" width="40" height="50" rx="8" stroke="#5BBAA7" strokeWidth="2.2"/>
        <path d="M68 88V68a12 12 0 0 0-12-12v0a12 12 0 0 1-12 12v28" stroke="#5BBAA7" strokeWidth="2.2" strokeLinecap="round"/>
        <rect x="28" y="88" width="16" height="20" rx="4" stroke="#5BBAA7" strokeWidth="2"/>
        {/* Right side thumbs down (mirrored, lighter) */}
        <rect x="92" y="52" width="40" height="50" rx="8" stroke="#5BBAA7" strokeWidth="2.2" strokeOpacity="0.45"/>
        <path d="M92 72v20a12 12 0 0 0 12 12v0a12 12 0 0 1 12-12V64" stroke="#5BBAA7" strokeWidth="2.2" strokeLinecap="round" strokeOpacity="0.45"/>
        <rect x="116" y="52" width="16" height="20" rx="4" stroke="#5BBAA7" strokeWidth="2" strokeOpacity="0.45"/>
        {/* sparkle */}
        <path d="M80 30v8M80 38l4-4M80 38l-4-4" stroke="#5BBAA7" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6"/>
        <circle cx="80" cy="138" r="4" fill="#5BBAA7" fillOpacity="0.3"/>
      </svg>
    ),
  },
  {
    id: 3,
    title: "Immer passend",
    subtitle: "Empfehlungen basierend auf Wetter, Tageszeit, Saison und Schulferien. Automatisch — ohne dass ihr etwas tun müsst.",
    illustration: (
      <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Sun */}
        <circle cx="55" cy="52" r="18" stroke="#5BBAA7" strokeWidth="2.2"/>
        <path d="M55 28v6M55 70v6M31 52h6M73 52h6M38.5 35.5l4.2 4.2M67.3 64.3l4.2 4.2M38.5 68.5l4.2-4.2M67.3 39.7l4.2-4.2" stroke="#5BBAA7" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6"/>
        {/* Clock */}
        <circle cx="105" cy="52" r="20" stroke="#5BBAA7" strokeWidth="2.2"/>
        <path d="M105 38v14l8 6" stroke="#5BBAA7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Calendar */}
        <rect x="36" y="90" width="88" height="52" rx="8" stroke="#5BBAA7" strokeWidth="2.2"/>
        <path d="M36 106h88" stroke="#5BBAA7" strokeWidth="1.5" strokeOpacity="0.5"/>
        <path d="M56 84v8M104 84v8" stroke="#5BBAA7" strokeWidth="2.2" strokeLinecap="round"/>
        <circle cx="60" cy="122" r="3" fill="#5BBAA7" fillOpacity="0.5"/>
        <circle cx="80" cy="122" r="3" fill="#5BBAA7"/>
        <circle cx="100" cy="122" r="3" fill="#5BBAA7" fillOpacity="0.5"/>
        <circle cx="60" cy="112" r="3" fill="#5BBAA7" fillOpacity="0.3"/>
        <circle cx="80" cy="112" r="3" fill="#5BBAA7" fillOpacity="0.5"/>
        <circle cx="100" cy="112" r="3" fill="#5BBAA7" fillOpacity="0.3"/>
      </svg>
    ),
  },
  {
    id: 4,
    title: "Geheimtipps entdecken",
    subtitle: "Kidgo findet Events die sonst niemand kennt — direkt aus 38+ Zürcher Gemeinden.",
    illustration: (
      <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Compass */}
        <circle cx="80" cy="80" r="52" stroke="#5BBAA7" strokeWidth="2.2"/>
        <circle cx="80" cy="80" r="6" fill="#5BBAA7"/>
        <path d="M80 32v12M80 116v12M32 80h12M116 80h12" stroke="#5BBAA7" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.5"/>
        {/* North needle */}
        <path d="M80 80l-16-28 16 10z" fill="#5BBAA7"/>
        {/* South needle */}
        <path d="M80 80l16 28-16-10z" fill="#5BBAA7" fillOpacity="0.3"/>
        {/* Cardinal labels */}
        <text x="76" y="27" fontSize="10" fill="#5BBAA7" fontWeight="600">N</text>
        <text x="76" y="148" fontSize="10" fill="#5BBAA7" fontWeight="600" fillOpacity="0.5">S</text>
      </svg>
    ),
  },
  {
    id: 5,
    title: "Bereit?",
    subtitle: null,
    illustration: (
      <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Concentric circles — launch motif */}
        <circle cx="80" cy="80" r="64" stroke="#5BBAA7" strokeWidth="2.5"/>
        <circle cx="80" cy="80" r="44" stroke="#5BBAA7" strokeWidth="1.8" strokeOpacity="0.6"/>
        <circle cx="80" cy="80" r="24" stroke="#5BBAA7" strokeWidth="1.5" strokeOpacity="0.4"/>
        <circle cx="80" cy="80" r="10" fill="#5BBAA7"/>
        {/* Star accents */}
        <path d="M80 16l2 6-6-2 6 2-2 6 2-6 6 2-6-2z" fill="#5BBAA7" fillOpacity="0.4"/>
        <path d="M144 80l-6 2 2-6-2 6-6-2 6 2z" fill="#5BBAA7" fillOpacity="0.3"/>
      </svg>
    ),
  },
];

export function OnboardingTutorial({ onComplete }: OnboardingTutorialProps) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const next = useCallback(() => {
    if (current < slides.length - 1) setCurrent((c) => c + 1);
    else onComplete();
  }, [current, onComplete]);

  const prev = useCallback(() => {
    if (current > 0) setCurrent((c) => c - 1);
  }, [current]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 48) {
      if (dx < 0) next();
      else prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "linear-gradient(160deg, #0d2e2a 0%, #1a4a42 50%, #0d2e2a 100%)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-modal="true"
      role="dialog"
      aria-label="Kidgo Tutorial"
    >
      {/* Skip button */}
      {!isLast && (
        <button
          onClick={onComplete}
          className="absolute top-5 right-5 text-white/50 hover:text-white/80 text-sm font-medium transition-colors z-10"
        >
          Überspringen
        </button>
      )}

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center" key={current}>
        <div
          className="mb-10"
          style={{ animation: "tutorialSlideIn 0.4s cubic-bezier(0.4,0,0.2,1) both" }}
        >
          {slide.illustration}
        </div>

        <h1
          className="text-white font-bold text-2xl mb-3 leading-tight"
          style={{ animation: "tutorialSlideIn 0.4s cubic-bezier(0.4,0,0.2,1) 60ms both" }}
        >
          {slide.title}
        </h1>

        {slide.subtitle && (
          <p
            className="text-white/70 text-base leading-relaxed max-w-xs"
            style={{ animation: "tutorialSlideIn 0.4s cubic-bezier(0.4,0,0.2,1) 120ms both" }}
          >
            {slide.subtitle}
          </p>
        )}
      </div>

      {/* Bottom nav */}
      <div className="pb-10 px-8 flex flex-col items-center gap-6">
        {/* Dots */}
        <div className="flex gap-2 items-center">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Slide ${i + 1}`}
              className="transition-all duration-300"
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === current ? "#5BBAA7" : "rgba(255,255,255,0.25)",
              }}
            />
          ))}
        </div>

        {/* Action button */}
        <button
          onClick={next}
          className="w-full max-w-xs py-4 rounded-2xl font-semibold text-base transition-all active:scale-95"
          style={{
            background: "#5BBAA7",
            color: "#fff",
            boxShadow: "0 8px 32px rgba(91,186,167,0.35)",
          }}
        >
          {isLast ? "Los geht's!" : "Weiter"}
        </button>

        {/* Back link (not on first slide) */}
        {current > 0 && (
          <button
            onClick={prev}
            className="text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            Zurück
          </button>
        )}
      </div>
    </div>
  );
}

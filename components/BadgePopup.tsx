"use client";

import { useEffect, useRef, useState } from "react";
import type { BadgeDef } from "@/lib/gamification";

interface BadgePopupProps {
  badge: BadgeDef | null;
  onClose: () => void;
}

const CONFETTI_COLORS = ["#5BBAA7", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F97316"];

function BadgeIcon({ id }: { id: string }) {
  const p = { width: 48, height: 48, viewBox: "0 0 24 24", fill: "none" as const, stroke: "#5BBAA7", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "entdecker": return <svg {...p}><circle cx="10" cy="13" r="4"/><path d="M16 13h6M14.5 10.5L20 5M5 14H2M3 8l5 5"/></svg>;
    case "bewerter": return <svg {...p}><path d="M7 10V4a1 1 0 0 1 1-1h1l3 4v6H7z"/><path d="M7 10H4a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h3"/><path d="M14 14h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1h-3"/></svg>;
    case "stammgast": return <svg {...p}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>;
    case "geheimtipp_jaeger": return <svg {...p}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>;
    case "planer": return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>;
    case "kartograph": return <svg {...p}><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15"/></svg>;
    case "frag_experte": return <svg {...p}><path d="M4 18V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7L4 18z"/><path d="M9 9h6M9 12h4"/></svg>;
    default: return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
  }
}

export function BadgePopup({ badge, onClose }: BadgePopupProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (badge) {
      setVisible(true);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300);
      }, 4000);
    }
    return () => clearTimeout(timerRef.current);
  }, [badge, onClose]);

  if (!badge) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-20 z-[100] flex justify-center px-4 pointer-events-none transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="pointer-events-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 px-6 py-5 text-center w-full max-w-xs relative overflow-hidden">
        {/* Confetti particles */}
        {visible && Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="kidgo-confetti"
            style={{
              left: `${(i / 16) * 100}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 4) * 0.08}s`,
            }}
          />
        ))}

        <div className="mb-2 relative z-10 flex justify-center">
          <BadgeIcon id={badge.id} />
        </div>
        <p className="text-[10px] font-bold text-kidgo-500 uppercase tracking-widest mb-1 relative z-10">
          Neues Abzeichen!
        </p>
        <p className="text-base font-extrabold text-gray-800 dark:text-white mb-0.5 relative z-10">
          {badge.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 relative z-10">{badge.description}</p>
        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 300); }}
          className="mt-3 text-xs text-gray-300 hover:text-gray-400 transition relative z-10"
          aria-label="Schliessen"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

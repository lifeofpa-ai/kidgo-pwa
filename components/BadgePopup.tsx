"use client";

import { useEffect, useRef, useState } from "react";
import type { BadgeDef } from "@/lib/gamification";

interface BadgePopupProps {
  badge: BadgeDef | null;
  onClose: () => void;
}

const CONFETTI_COLORS = ["#5BBAA7", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F97316"];

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

        <div className="text-5xl mb-2 relative z-10">{badge.emoji}</div>
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

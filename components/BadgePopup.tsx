"use client";

import { useEffect, useRef, useState } from "react";
import type { BadgeDef } from "@/lib/gamification";
import { HexIcon } from "@/components/HexIcon";

interface BadgePopupProps {
  badge: BadgeDef | null;
  onClose: () => void;
}

const CONFETTI_COLORS = ["#5BBAA7", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F97316"];

function BadgeIcon({ id }: { id: string }) {
  switch (id) {
    case "entdecker":
      return (
        <HexIcon size={56}>
          <circle cx="11" cy="13" r="3.5"/>
          <path d="M13.6 10.4l3.4-3.4 1.1 1.1-3.4 3.4z"/>
          <circle cx="11" cy="13" r="1.4" fill="#F5F0E8"/>
        </HexIcon>
      );
    case "bewerter":
      return (
        <HexIcon size={56}>
          <path d="M9 17v-5.2h1.8l1.7-3.5c.2-.5.8-.6 1.1-.2.2.3.3.7.2 1.1l-.6 2.3h2.6c.7 0 1.2.7 1 1.4l-.8 3c-.1.5-.6.8-1.1.8H9z"/>
          <rect x="6.6" y="11.8" width="1.7" height="5.2" rx="0.4"/>
        </HexIcon>
      );
    case "stammgast":
      return (
        <HexIcon size={56}>
          <path d="M12 7l1.6 3.3 3.6.5-2.6 2.5.6 3.6L12 15.2 8.8 16.9l.6-3.6-2.6-2.5 3.6-.5z"/>
        </HexIcon>
      );
    case "geheimtipp_jaeger":
      return (
        <HexIcon size={56}>
          <circle cx="12" cy="12" r="5"/>
          <rect x="11.4" y="11" width="1.2" height="3.4" rx="0.3" fill="#F5F0E8"/>
          <circle cx="12" cy="9.5" r="0.7" fill="#F5F0E8"/>
        </HexIcon>
      );
    case "planer":
      return (
        <HexIcon size={56}>
          <rect x="6.5" y="8.5" width="11" height="9" rx="1.2"/>
          <rect x="6.5" y="8.5" width="11" height="2.4"/>
          <rect x="8.5" y="6.8" width="1.2" height="3.2" rx="0.4"/>
          <rect x="14.3" y="6.8" width="1.2" height="3.2" rx="0.4"/>
          <rect x="8.5" y="13" width="1.2" height="1.2" rx="0.2" fill="#F5F0E8"/>
          <rect x="11.4" y="13" width="1.2" height="1.2" rx="0.2" fill="#F5F0E8"/>
          <rect x="14.3" y="13" width="1.2" height="1.2" rx="0.2" fill="#F5F0E8"/>
        </HexIcon>
      );
    case "kartograph":
      return (
        <HexIcon size={56}>
          <path d="M6.5 9l3.5-1.2 4 1.4 3.5-1.2v8L14 17.2l-4-1.4L6.5 17z"/>
          <path d="M10 7.8v8M14 9.2v8" stroke="#F5F0E8" strokeWidth="0.7"/>
        </HexIcon>
      );
    case "frag_experte":
      return (
        <HexIcon size={56}>
          <path d="M6.5 8.5h11a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-3.5l-2.2 2.2v-2.2H6.5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z"/>
          <rect x="8" y="11" width="6" height="0.9" rx="0.4" fill="#F5F0E8"/>
          <rect x="8" y="12.6" width="4" height="0.9" rx="0.4" fill="#F5F0E8"/>
        </HexIcon>
      );
    default:
      return (
        <HexIcon size={56}>
          <path d="M12 7l1.6 3.3 3.6.5-2.6 2.5.6 3.6L12 15.2 8.8 16.9l.6-3.6-2.6-2.5 3.6-.5z"/>
        </HexIcon>
      );
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

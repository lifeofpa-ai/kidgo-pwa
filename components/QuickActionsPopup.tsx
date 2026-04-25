"use client";

import { useEffect, useRef } from "react";

export interface QuickAction {
  key: "bookmark" | "share" | "calendar" | "route";
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}

export function QuickActionsPopup({
  actions,
  onClose,
  anchorRef,
}: {
  actions: QuickAction[];
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}) {
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay so the same touch that opened the popup doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 50);
    document.addEventListener("keydown", handleEscape);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Position popup centered above the anchor card
  let style: React.CSSProperties = { position: "fixed", zIndex: 60 };
  if (anchorRef.current) {
    const rect = anchorRef.current.getBoundingClientRect();
    const top = Math.max(8, rect.top - 8);
    const centerX = rect.left + rect.width / 2;
    style = {
      ...style,
      top: top,
      left: centerX,
      transform: "translate(-50%, -100%)",
    };
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[2px] quick-popup-backdrop"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={popupRef}
        role="menu"
        aria-label="Schnellaktionen"
        style={style}
        className="quick-popup flex items-center gap-1 bg-white/95 dark:bg-[var(--bg-card)]/95 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-[var(--border)] shadow-xl px-2 py-2"
      >
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              a.onClick();
              onClose();
            }}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl transition-all min-w-[56px] active:scale-95 ${
              a.active
                ? "bg-kidgo-50 text-kidgo-600"
                : "text-gray-600 hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center">{a.icon}</div>
            <span className="text-[10px] font-medium leading-none">{a.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export const QuickActionIcons = {
  bookmark: (filled: boolean) => (
    <svg width="18" height="18" viewBox="0 0 18 18" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2h12v14L9 12 3 16V2z" />
    </svg>
  ),
  share: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="4" r="2" />
      <circle cx="14" cy="14" r="2" />
      <circle cx="4" cy="9" r="2" />
      <path d="M5.7 8 12.3 5M5.7 10l6.6 3" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="13" height="11" rx="1.5" />
      <path d="M2.5 7h13M6 2v3M12 2v3" />
    </svg>
  ),
  route: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 1.5a4.5 4.5 0 0 1 4.5 4.5c0 4-4.5 10.5-4.5 10.5S4.5 10 4.5 6A4.5 4.5 0 0 1 9 1.5z" />
      <circle cx="9" cy="6" r="1.5" />
    </svg>
  ),
};

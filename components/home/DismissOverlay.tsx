"use client";

import { useState, useEffect, useRef } from "react";
import type { DismissReason } from "@/lib/dismiss-reasons";

interface DismissOverlayProps {
  reasons: DismissReason[];
  onSubmit: (selectedReasonIds: string[]) => void;
  onCancel: () => void;
  autoSubmitMs?: number; // default 2000
}

/**
 * Glassmorphism-overlay with teal chip selection.
 * Mounts below the dimmed card. Auto-submits after `autoSubmitMs` idle ms.
 */
export function DismissOverlay({
  reasons,
  onSubmit,
  onCancel,
  autoSubmitMs = 2000,
}: DismissOverlayProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-submit after 2s of no interaction
  const resetAutoTimer = () => {
    if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    autoSubmitTimerRef.current = setTimeout(() => {
      handleSubmit();
    }, autoSubmitMs);
  };

  useEffect(() => {
    resetAutoTimer();
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleReason = (id: string) => {
    resetAutoTimer();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = () => {
    if (isExiting) return;
    setIsExiting(true);
    // Slide-out: let CSS animation run, then call onSubmit
    timerRef.current = setTimeout(() => {
      onSubmit(Array.from(selected));
    }, 300);
  };

  const handleCancel = () => {
    if (isExiting) return;
    setIsExiting(true);
    timerRef.current = setTimeout(onCancel, 280);
  };

  return (
    <div
      className={`dismiss-overlay ${isExiting ? "dismiss-overlay--exit" : "dismiss-overlay--enter"}`}
      role="dialog"
      aria-label="Warum nicht interessiert?"
    >
      <p className="dismiss-overlay__label">Warum nicht interessiert?</p>

      <div className="dismiss-overlay__chips">
        {reasons.map((reason) => {
          const active = selected.has(reason.id);
          return (
            <button
              key={reason.id}
              onClick={() => toggleReason(reason.id)}
              className={`dismiss-chip ${active ? "dismiss-chip--active" : ""}`}
              type="button"
            >
              {reason.icon && (
                <span className="dismiss-chip__icon" aria-hidden="true">
                  {reason.icon}
                </span>
              )}
              {reason.label}
            </button>
          );
        })}
      </div>

      <div className="dismiss-overlay__actions">
        <button
          onClick={handleCancel}
          className="dismiss-overlay__cancel"
          type="button"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSubmit}
          className="dismiss-overlay__submit"
          type="button"
        >
          Fertig
        </button>
      </div>
    </div>
  );
}

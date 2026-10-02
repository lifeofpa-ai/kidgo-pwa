"use client";

import type { KidgoEvent } from "@/types/home";

export interface SwipeToastState {
  kind: "skip" | "like" | "bookmarked";
  event: KidgoEvent;
}

interface SwipeToastProps {
  toast: SwipeToastState | null;
  onUndo: () => void;
  onBookmark: () => void;
}

/**
 * Feedback nach jedem Wisch (02.10.2026): sagt, was passiert ist, und macht es
 * mit einem Tipp rückgängig — dadurch braucht es keine Begründungsabfrage mehr.
 * Bei "Gefällt mir" kann das Event zusätzlich in die Merkliste gelegt werden.
 */
export function SwipeToast({ toast, onUndo, onBookmark }: SwipeToastProps) {
  if (!toast) return null;
  return (
    <div className="swipe-toast" role="status" aria-live="polite">
      {toast.kind === "skip" && (
        <>
          <span>Nicht für uns</span>
          <button type="button" onClick={onUndo}>Rückgängig</button>
        </>
      )}
      {toast.kind === "like" && (
        <>
          <span>♥ Gefällt dir</span>
          <button type="button" onClick={onBookmark}>Merken</button>
          <button type="button" onClick={onUndo}>Rückgängig</button>
        </>
      )}
      {toast.kind === "bookmarked" && <span>✓ In der Merkliste</span>}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Swipe from the left edge of the screen to navigate back.
 * Mobile-only. Provides a subtle visual translation while swiping.
 */
export function SwipeBack({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const trackingRef = useRef(false);
  const [dragX, setDragX] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const isTouch =
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
    if (!isTouch) return;

    const EDGE_THRESHOLD = 30;
    const COMMIT_THRESHOLD = 100;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX > EDGE_THRESHOLD) {
        startRef.current = null;
        return;
      }
      startRef.current = { x: t.clientX, y: t.clientY };
      trackingRef.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!startRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - startRef.current.x;
      const dy = t.clientY - startRef.current.y;
      if (!trackingRef.current) {
        // Decide once if this is a horizontal swipe from edge
        if (Math.abs(dy) > Math.abs(dx) || dx < 8) {
          startRef.current = null;
          return;
        }
        trackingRef.current = true;
      }
      if (dx > 0) setDragX(Math.min(dx, 200));
    };

    const onEnd = (e: TouchEvent) => {
      if (!startRef.current || !trackingRef.current) {
        startRef.current = null;
        trackingRef.current = false;
        setDragX(0);
        return;
      }
      const t = e.changedTouches[0];
      const dx = t ? t.clientX - startRef.current.x : 0;
      startRef.current = null;
      trackingRef.current = false;
      if (dx > COMMIT_THRESHOLD) {
        // animate out then navigate
        setDragX(window.innerWidth);
        setTimeout(() => {
          router.back();
        }, 150);
      } else {
        setDragX(0);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, router]);

  if (dragX <= 0) return null;
  return (
    <>
      {/* Visual translation overlay */}
      <style jsx global>{`
        body {
          transform: translateX(${dragX * 0.4}px);
          transition: transform 0ms;
        }
      `}</style>
      <div
        className="fixed inset-y-0 left-0 z-[55] pointer-events-none flex items-center"
        style={{
          width: dragX,
          background:
            "linear-gradient(to right, rgba(91,186,167,0.18), rgba(91,186,167,0))",
        }}
      >
        <div
          className="ml-2 flex items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-md text-kidgo-500"
          style={{ opacity: Math.min(1, dragX / 80) }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12 6 8l4-4" />
          </svg>
        </div>
      </div>
    </>
  );
}

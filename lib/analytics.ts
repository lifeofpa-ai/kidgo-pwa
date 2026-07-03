declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

// Phase 4 (ux-audit.md) measurement prep, 2026-07-03: the audit's Analytics-
// Review (4.3) and A/B-Test (4.1) both need "Scroll-Tiefe" and "Time-to-
// first-click", which nothing tracked before this. Fires alongside GA4's
// existing event stream — no new infra, just closes the gap so the metrics
// exist once there's real traffic to look at.
let firstInteractionTracked = false;
const PRIMARY_INTERACTIONS = new Set(["event_click", "search", "chat_open", "tab_switch", "explore_filter"]);

export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params ?? {});

  if (!firstInteractionTracked && PRIMARY_INTERACTIONS.has(eventName) && typeof performance !== "undefined") {
    firstInteractionTracked = true;
    window.gtag("event", "time_to_first_interaction", { source: eventName, ms: Math.round(performance.now()) });
  }
}

/**
 * Scroll-depth tracking for a page view. Fires once per threshold
 * (25/50/75/100%) per mount. Call from a useEffect on mount, use the
 * returned cleanup function to remove the listener on unmount.
 */
export function initScrollDepthTracking(pageName: string): () => void {
  if (typeof window === "undefined") return () => {};
  const thresholds = [25, 50, 75, 100];
  const fired = new Set<number>();
  const onScroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const pct = Math.round((window.scrollY / scrollable) * 100);
    for (const t of thresholds) {
      if (pct >= t && !fired.has(t)) {
        fired.add(t);
        trackEvent("scroll_depth", { page: pageName, depth: t });
      }
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

export function trackFirstEventClick(eventId: string, eventTitle?: string): void {
  try {
    if (sessionStorage.getItem("_kidgo_fec")) return;
    sessionStorage.setItem("_kidgo_fec", "1");
    trackEvent("first_event_click", { event_id: eventId, event_title: eventTitle });
  } catch {}
}

export function trackFirstBookmark(eventId: string): void {
  try {
    if (localStorage.getItem("_kidgo_fbm")) return;
    localStorage.setItem("_kidgo_fbm", "1");
    trackEvent("first_bookmark", { event_id: eventId });
  } catch {}
}

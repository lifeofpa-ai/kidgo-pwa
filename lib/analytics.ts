declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params ?? {});
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

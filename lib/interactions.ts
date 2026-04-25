"use client";

/**
 * Sprint 21 — Interaction primitives.
 * Long-press / double-tap / swipe-back / scroll-restore / shortcuts.
 */

export const LIKED_EVENTS_KEY = "kidgo_liked_events";
export const SCROLL_KEY = "kidgo_scroll_position";
export const LONG_PRESS_MS = 500;
export const DOUBLE_TAP_MS = 280;

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)
  );
}

export function vibrate(ms: number) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {}
}

/**
 * Toggle like state for an event in localStorage.
 * Returns the new like state (true = liked, false = unliked).
 */
export function toggleLike(eventId: string): boolean {
  try {
    const raw = localStorage.getItem(LIKED_EVENTS_KEY);
    const list: Array<{ eventId: string; rating: string; ratedAt: string }> = raw ? JSON.parse(raw) : [];
    const existing = list.find((e) => e.eventId === eventId);
    let next: typeof list;
    let liked: boolean;
    if (existing) {
      next = list.filter((e) => e.eventId !== eventId);
      liked = false;
    } else {
      next = [
        ...list,
        { eventId, rating: "like", ratedAt: new Date().toISOString() },
      ];
      liked = true;
    }
    localStorage.setItem(LIKED_EVENTS_KEY, JSON.stringify(next));
    return liked;
  } catch {
    return false;
  }
}

export function isLiked(eventId: string): boolean {
  try {
    const raw = localStorage.getItem(LIKED_EVENTS_KEY);
    if (!raw) return false;
    const list: Array<{ eventId: string }> = JSON.parse(raw);
    return list.some((e) => e.eventId === eventId);
  } catch {
    return false;
  }
}

/** Save scroll-Y position before leaving a list page. */
export function saveScrollPosition(key: string) {
  try {
    sessionStorage.setItem(`${SCROLL_KEY}:${key}`, String(window.scrollY));
  } catch {}
}

/** Restore scroll-Y position when returning to a list page. */
export function restoreScrollPosition(key: string) {
  try {
    const raw = sessionStorage.getItem(`${SCROLL_KEY}:${key}`);
    if (!raw) return;
    const y = parseInt(raw, 10);
    if (!isNaN(y) && y > 0) {
      // Wait one frame so the DOM is laid out
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  } catch {}
}

interface ShareableEvent {
  id: string;
  titel: string;
  datum: string | null;
  datum_ende: string | null;
  ort: string | null;
  beschreibung: string | null;
}

export function shareEvent(event: ShareableEvent) {
  const url = `${window.location.origin}/events/${event.id}`;
  const dateStr = event.datum
    ? new Date(event.datum + "T00:00:00").toLocaleDateString("de-CH", { day: "numeric", month: "long" })
    : null;
  const loc = event.ort ? ` in ${event.ort.split(",")[0].trim()}` : "";
  const text = `Schau dir das an: ${event.titel}${dateStr ? ` am ${dateStr}` : ""}${loc} — gefunden auf Kidgo! ${url}`;
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : null;
  if (nav && typeof nav.share === "function") {
    nav.share({ title: event.titel, text, url }).catch(() => {});
  } else if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
    nav.clipboard.writeText(text).catch(() => {});
  }
}

export function downloadEventICS(event: ShareableEvent) {
  const esc = (s: string) => s.replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const toICSDate = (d: string) => d.replace(/-/g, "");
  const startDate = event.datum
    ? toICSDate(event.datum)
    : toICSDate(new Date().toISOString().split("T")[0]);
  const endDate = event.datum_ende
    ? toICSDate(event.datum_ende)
    : event.datum
      ? toICSDate(new Date(new Date(event.datum + "T12:00:00").getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      : startDate;
  const url = `${window.location.origin}/events/${event.id}`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kidgo//Kidgo Events//DE",
    "BEGIN:VEVENT",
    `UID:${event.id}@kidgo.ch`,
    `SUMMARY:${esc(event.titel)}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    event.ort ? `LOCATION:${esc(event.ort)}` : "",
    event.beschreibung ? `DESCRIPTION:${esc(event.beschreibung.slice(0, 500))}` : "",
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `${event.titel.replace(/[^a-z0-9äöü]/gi, "_").toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

export function openRouteForEvent(event: { ort: string | null; titel: string }) {
  if (!event.ort) {
    window.open("https://www.google.com/maps", "_blank", "noopener");
    return;
  }
  const q = encodeURIComponent(event.ort);
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noopener");
}

/**
 * Broadcast a "close all open quick-action popups" event so that
 * opening a new popup auto-closes any other.
 */
export const QUICK_ACTIONS_CLOSE_EVENT = "kidgo:close-quickactions";
export function broadcastClosePopups() {
  try {
    window.dispatchEvent(new CustomEvent(QUICK_ACTIONS_CLOSE_EVENT));
  } catch {}
}

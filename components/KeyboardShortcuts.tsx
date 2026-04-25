"use client";

import { useEffect } from "react";

/**
 * Global keyboard shortcuts (Desktop):
 *   "/"      → focus the search/chat input
 *   "Escape" → close any open modal/popup
 *   "b"      → toggle bookmark on currently focused/visible event detail
 *
 * Components opt in by:
 *   - giving an input an id that matches one of the focus targets, OR
 *   - listening on `window` for the custom events:
 *       "kidgo:shortcut:close"      (Escape)
 *       "kidgo:shortcut:bookmark"   ("b")
 */
export function KeyboardShortcuts() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SEARCH_TARGET_IDS = [
      "kidgo-search-input",
      "kidgo-chat-input",
      "kidgo-explore-search",
    ];

    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      // Escape always works, even inside inputs
      if (e.key === "Escape") {
        window.dispatchEvent(new CustomEvent("kidgo:shortcut:close"));
        return;
      }

      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        for (const id of SEARCH_TARGET_IDS) {
          const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
          if (el && el.offsetParent !== null) {
            e.preventDefault();
            el.focus();
            try {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            } catch {}
            return;
          }
        }
        // No visible search input – ask the page to reveal one
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("kidgo:shortcut:focus-search"));
        return;
      }

      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("kidgo:shortcut:bookmark"));
        return;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}

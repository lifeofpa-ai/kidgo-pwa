"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useUserPrefs } from "@/lib/user-prefs-context";

const AGE_BUCKETS = ["0-3", "4-6", "7-9", "10-12"] as const;
const AGE_LABELS: Record<string, string> = {
  "0-3": "0–3",
  "4-6": "4–6",
  "7-9": "7–9",
  "10-12": "10–12",
};
const SHOW_ON: string[] = ["/", "/explore", "/ich", "/bookmarks", "/planer"];

export function AgeChipsBar() {
  const { prefs, mounted, toggleAgeBucket } = useUserPrefs();
  const pathname = usePathname();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!mounted) return null;
  if (!SHOW_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) return null;
  if (!prefs.onboarded && prefs.ageBuckets.length === 0) return null;
  if (prefs.ageBuckets.length === 0 && !pickerOpen) return null;

  const available = AGE_BUCKETS.filter((b) => !prefs.ageBuckets.includes(b));

  return (
    <div className="sticky top-0 z-40 md:hidden bg-[var(--bg-card)]/95 backdrop-blur-md border-b border-[var(--border)] px-4 py-2 flex flex-wrap items-center gap-1.5">
      {prefs.ageBuckets.map((b) => (
        <button
          key={b}
          onClick={() => toggleAgeBucket(b)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-kidgo-400 text-white active:scale-95 transition"
          aria-label={`Altersgruppe ${AGE_LABELS[b]} entfernen`}
        >
          {AGE_LABELS[b]}
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1.5 1.5l6 6M7.5 1.5l-6 6" />
          </svg>
        </button>
      ))}

      {/* + button */}
      {available.length > 0 && (
        <button
          onClick={() => setPickerOpen((v) => !v)}
          aria-label="Altersgruppe hinzufügen"
          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:border-kidgo-300 hover:text-kidgo-500 transition text-sm font-bold"
        >
          +
        </button>
      )}

      {/* Dropdown picker */}
      {pickerOpen && available.length > 0 && (
        <div className="flex gap-1.5 flex-wrap w-full mt-0.5">
          {available.map((b) => (
            <button
              key={b}
              onClick={() => { toggleAgeBucket(b); setPickerOpen(false); }}
              className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:border-kidgo-300 hover:text-kidgo-500 transition active:scale-95"
            >
              {AGE_LABELS[b]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

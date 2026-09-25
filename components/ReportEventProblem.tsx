"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackEvent } from "@/lib/analytics";

// Kontext-Feedback auf der Event-Detailseite (25.09.2026):
// dezenter Text-Link "Stimmt etwas nicht? Melden" -> Bottom-Sheet mit
// Schnellauswahl-Gruenden. Die Event-ID wird automatisch mitgeschickt,
// Freitext und E-Mail sind optional.

const REASONS: { value: string; label: string }[] = [
  { value: "date_wrong", label: "Datum oder Zeit falsch" },
  { value: "cancelled", label: "Findet nicht statt" },
  { value: "link_broken", label: "Link funktioniert nicht" },
  { value: "place_wrong", label: "Ort stimmt nicht" },
  { value: "not_for_kids", label: "Nicht für Kinder" },
  { value: "other", label: "Anderes" },
];

export function ReportEventProblem({ eventId, eventTitle }: { eventId: string; eventTitle?: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // Escape schliesst, Body-Scroll sperren solange offen
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const openSheet = () => {
    setReason(null);
    setMessage("");
    setStatus("idle");
    setOpen(true);
    trackEvent("event_report_open", { event_id: eventId });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "event_problem",
          eventId,
          reason,
          message,
          email,
          pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      trackEvent("event_report_sent", { event_id: eventId, reason });
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <div className="text-center pt-1">
        <button
          ref={triggerRef}
          type="button"
          onClick={openSheet}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition py-2"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 14V2.5M3 2.5h8.5l-1.8 3 1.8 3H3" />
          </svg>
          Stimmt etwas nicht? <span className="underline underline-offset-2 text-[var(--text-secondary)]">Melden</span>
        </button>
      </div>

      {/* Portal an <body>: Seiten-Wrapper mit transform/animation bilden einen
          eigenen Stacking-Context, darin koennte z-[100] die BottomNav (z-50)
          nicht ueberdecken. */}
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 fade-in"
            onClick={close}
            aria-hidden="true"
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-event-title"
            tabIndex={-1}
            className="relative w-full sm:max-w-md bg-[var(--bg-card)] rounded-t-3xl sm:rounded-3xl shadow-xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 max-h-[90vh] overflow-y-auto outline-none"
          >
            <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border)]" aria-hidden="true" />

            {status === "sent" ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5BBAA7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </div>
                <p id="report-event-title" className="font-semibold text-[var(--text-primary)] mb-1">Danke für den Hinweis!</p>
                <p className="text-sm text-[var(--text-muted)] mb-5">Wir schauen uns das Event an und korrigieren es.</p>
                <button
                  type="button"
                  onClick={close}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-kidgo-500 text-white hover:bg-kidgo-400 transition"
                >
                  Schliessen
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 id="report-event-title" className="text-base font-bold text-[var(--text-primary)]">
                    Was stimmt nicht?
                  </h2>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Schliessen"
                    className="-mr-1 -mt-1 p-1.5 rounded-full text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                      <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" />
                    </svg>
                  </button>
                </div>
                {eventTitle && (
                  <p className="text-xs text-[var(--text-muted)] mb-4 line-clamp-1">{eventTitle}</p>
                )}

                <div className="flex flex-wrap gap-2 mb-4" role="radiogroup" aria-label="Grund">
                  {REASONS.map((r) => {
                    const active = reason === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setReason(r.value)}
                        className={`px-3.5 py-2 rounded-full text-sm font-medium border transition ${
                          active
                            ? "border-[var(--kidgo-teal)] bg-[var(--accent-light)] text-[var(--text-primary)]"
                            : "border-[var(--border)] text-[var(--text-secondary)] hover:border-kidgo-300"
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>

                {reason && (
                  <div className="space-y-3 mb-4 fade-in">
                    <textarea
                      rows={3}
                      maxLength={4000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        reason === "date_wrong"
                          ? "Was ist das richtige Datum? (optional)"
                          : reason === "other"
                            ? "Was ist dir aufgefallen?"
                            : "Weitere Details (optional)"
                      }
                      required={reason === "other"}
                      minLength={reason === "other" ? 3 : undefined}
                      className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 resize-none"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="E-Mail für Rückfragen (optional)"
                      className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300"
                    />
                  </div>
                )}

                {status === "error" && (
                  <p className="text-xs text-red-500 mb-3">Konnte nicht gesendet werden. Bitte nochmal versuchen.</p>
                )}

                <button
                  type="submit"
                  disabled={!reason || status === "sending"}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-white bg-kidgo-500 hover:bg-kidgo-400 transition disabled:opacity-40"
                >
                  {status === "sending" ? "Wird gesendet…" : "Meldung senden"}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

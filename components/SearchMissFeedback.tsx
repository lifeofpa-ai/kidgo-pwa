"use client";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";

// Kontext-Feedback bei leerer Suche (25.09.2026): "Nichts gefunden? Sag uns,
// was du suchst." Klappt inline auf, Suchbegriff + aktive Filter werden
// automatisch mitgeschickt. Hilft beim Finden von Luecken im Scouting.

export function SearchMissFeedback({ query, filters }: { query: string; filters: string[] }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Neue Suche -> Formular zuruecksetzen, damit ein "Danke" nicht an einem
  // anderen Suchbegriff haengen bleibt.
  const key = `${query}|${filters.join(",")}`;
  useEffect(() => {
    setStatus((s) => (s === "sent" ? "idle" : s));
    setOpen(false);
  }, [key]);

  const trimmedQuery = query.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "search_miss",
          message: message.trim() || `Nichts gefunden für "${trimmedQuery || filters.join(", ")}"`,
          email,
          searchQuery: trimmedQuery,
          searchFilters: filters,
          pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setMessage("");
      trackEvent("search_miss_feedback_sent", { query: trimmedQuery });
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <p className="mt-6 text-sm text-[var(--text-secondary)] fade-in">
        Danke! Wir halten die Augen offen.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-6 pt-5 border-t border-[var(--border)] max-w-sm mx-auto">
        <p className="text-sm text-[var(--text-secondary)] mb-2">Nichts gefunden?</p>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            trackEvent("search_miss_feedback_open", { query: trimmedQuery });
          }}
          className="px-4 py-2 rounded-full text-sm font-medium border border-[var(--kidgo-teal)] text-[var(--kidgo-teal)] hover:bg-[var(--accent-light)] transition"
        >
          Sag uns, was du suchst
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 pt-5 border-t border-[var(--border)] max-w-sm mx-auto text-left space-y-3 fade-in">
      <p className="text-sm font-semibold text-[var(--text-primary)]">Was hast du gesucht?</p>
      {(trimmedQuery || filters.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {trimmedQuery && (
            <span className="px-2.5 py-1 rounded-full text-xs bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              «{trimmedQuery}»
            </span>
          )}
          {filters.map((f) => (
            <span key={f} className="px-2.5 py-1 rounded-full text-xs bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
              {f}
            </span>
          ))}
        </div>
      )}
      <textarea
        rows={3}
        maxLength={4000}
        autoFocus
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="z.B. Kinderyoga in Winterthur am Mittwochnachmittag (optional)"
        className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 resize-none"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-Mail, falls wir etwas finden (optional)"
        className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300"
      />
      {status === "error" && (
        <p className="text-xs text-red-500">Konnte nicht gesendet werden. Bitte nochmal versuchen.</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl py-2.5 text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={status === "sending"}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white bg-kidgo-500 hover:bg-kidgo-400 transition disabled:opacity-50"
        >
          {status === "sending" ? "Wird gesendet…" : "Senden"}
        </button>
      </div>
    </form>
  );
}

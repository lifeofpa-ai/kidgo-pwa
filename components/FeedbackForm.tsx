"use client";
import { useState } from "react";

const categories = [
  { value: "idea", label: "Idee" },
  { value: "bug", label: "Fehler" },
  { value: "other", label: "Sonstiges" },
];

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("idea");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, email, category }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setMessage("");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <p className="text-[15px] text-[var(--text-primary)]">
        Danke! Wir haben deine Nachricht erhalten.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        {categories.map((c) => (
          <button
            type="button"
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              category === c.value
                ? "border-[var(--kidgo-teal)] text-[var(--kidgo-teal)]"
                : "border-[var(--border)] text-[var(--text-muted)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <textarea
        required
        minLength={3}
        maxLength={4000}
        rows={5}
        placeholder="Deine Idee oder dein Feedback…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] text-[var(--text-primary)]"
      />

      <input
        type="email"
        placeholder="Deine E-Mail (optional, für Rückfragen)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] text-[var(--text-primary)]"
      />

      {status === "error" && (
        <p className="text-xs text-red-500">
          Konnte nicht gesendet werden. Bitte nochmal versuchen.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "linear-gradient(to right, #5BBAA7, #4A9E8E)" }}
      >
        {status === "sending" ? "Wird gesendet…" : "Absenden"}
      </button>
    </form>
  );
}

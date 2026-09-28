"use client";
import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "duplicate" | "not_recognized" | "error";

export function SubmitEventForm() {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  // Honeypot: unsichtbares Feld, das nur Bots ausfüllen. Bleibt es leer,
  // ist die Einsendung vermutlich von einem Menschen.
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const reset = () => {
    setStatus("idle");
    setMessage(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/submit-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, note, website }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error ?? "Konnte nicht gesendet werden. Bitte nochmal versuchen.");
        return;
      }

      if (data.duplicate) {
        setStatus("duplicate");
        setMessage(data.message ?? "Das kennen wir schon!");
        return;
      }

      if (!data.success) {
        setStatus("not_recognized");
        setMessage(
          data.message ??
            "Wir konnten daraus kein Kinder-Event erkennen. Tipp: Link zur konkreten Event-Seite senden, nicht zur Startseite."
        );
        return;
      }

      setStatus("sent");
      setUrl("");
      setNote("");
    } catch {
      setStatus("error");
      setMessage("Konnte nicht gesendet werden. Bitte nochmal versuchen.");
    }
  };

  if (status === "sent") {
    return (
      <div className="text-[15px] text-[var(--text-primary)]">
        <p>Danke! Wir prüfen den Vorschlag und schalten ihn frei, sobald er passt.</p>
        <button
          onClick={reset}
          className="mt-4 text-sm text-[var(--kidgo-teal)] hover:underline"
        >
          Noch einen Link einreichen
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        type="url"
        required
        placeholder="https://…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] text-[var(--text-primary)]"
      />

      <textarea
        maxLength={500}
        rows={3}
        placeholder="Kurze Notiz (optional) – z.B. warum es passt"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] text-[var(--text-primary)]"
      />

      {/* Honeypot – für Menschen unsichtbar, für Bots verlockend */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] w-px h-px opacity-0"
      />

      {(status === "error" || status === "duplicate" || status === "not_recognized") && (
        <p
          className={`text-xs ${
            status === "error" ? "text-red-500" : "text-[var(--text-muted)]"
          }`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "linear-gradient(to right, #5BBAA7, #4A9E8E)" }}
      >
        {status === "sending" ? "Wird geprüft…" : "Einreichen"}
      </button>
    </form>
  );
}

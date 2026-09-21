"use client";

import { useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";

export default function ForgotPasswordPage() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // Aus Datenschutzgründen (keine E-Mail-Enumeration) zeigen wir bei den
    // meisten Fehlern trotzdem die Erfolgsmeldung an — nur echte, dem Nutzer
    // zurechenbare Probleme (z.B. ungültiges Format oder Rate-Limit) melden wir.
    if (error && (error.status === 429 || error.message.toLowerCase().includes("valid email"))) {
      setError(
        error.status === 429
          ? "Zu viele Versuche. Bitte warte einen Moment und versuche es erneut."
          : "Bitte gib eine gültige E-Mail-Adresse ein."
      );
    } else {
      setSent(true);
    }

    setLoading(false);
  };

  return (
    <main id="main-content" className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] p-8 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Link href="/" aria-label="Startseite">
            <KidgoLogo size="sm" animated />
          </Link>
        </div>

        {!configured && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
            Supabase nicht konfiguriert.
          </div>
        )}

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-3">📬</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              E-Mail gesendet!
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Falls für <strong className="text-[var(--text-primary)]">{email}</strong> ein Konto existiert, erhältst du gleich einen Link zum Zurücksetzen deines Passworts.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block text-xs text-[var(--accent)] hover:underline"
            >
              Zurück zur Anmeldung
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">
              Passwort vergessen?
            </h1>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Gib deine E-Mail ein — wir schicken dir einen Link, mit dem du ein neues Passwort setzen kannst.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.ch"
                required
                autoFocus
                autoComplete="email"
                className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm mb-3 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition"
              />
              {error && (
                <p className="text-red-500 text-xs mb-3">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading || !configured}
                className="w-full bg-[var(--accent)] text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Wird gesendet…" : "Link senden"}
              </button>
            </form>
          </>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            ← Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </main>
  );
}

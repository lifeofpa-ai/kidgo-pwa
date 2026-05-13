"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";

function LoginInner() {
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(callbackError ? decodeURIComponent(callbackError) : "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
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
            Supabase nicht konfiguriert. <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in .env.local setzen.
          </div>
        )}

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-3">📬</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              E-Mail gesendet!
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Prüfe <strong className="text-[var(--text-primary)]">{email}</strong> und klicke auf den Link um dich anzumelden.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">
              Anmelden
            </h1>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Gib deine E-Mail ein — wir schicken dir einen Login-Link.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.ch"
                required
                autoFocus
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
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
                    </svg>
                    Wird gesendet…
                  </span>
                ) : "Magic Link senden"}
              </button>
            </form>
          </>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main id="main-content" className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4" />
    }>
      <LoginInner />
    </Suspense>
  );
}

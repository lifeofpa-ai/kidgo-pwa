"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const configured = isSupabaseConfigured();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exchanging, setExchanging] = useState(true);
  const [linkError, setLinkError] = useState(false);
  const exchangedRef = useRef(false);

  // Der Reset-Link landet mit ?code=... auf dieser Seite (PKCE-Flow).
  // Den Code tauschen wir hier direkt gegen eine Session ein — dieselbe
  // Technik wie in app/auth/callback/route.ts, nur clientseitig, da wir
  // ohne Query-Parameter auf der Redirect-URL-Allowlist bleiben wollen.
  useEffect(() => {
    if (exchangedRef.current) return;
    exchangedRef.current = true;

    const code = searchParams.get("code");
    if (!code) {
      setExchanging(false);
      return;
    }

    const supabase = createClient();
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setLinkError(true);
      setExchanging(false);
    });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(
        error.message === "Password should be at least 6 characters."
          ? "Das Passwort muss mindestens 6 Zeichen haben."
          : error.message
      );
    } else {
      setDone(true);
    }
    setLoading(false);
  };

  const stillLoading = authLoading || exchanging;

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

        {stillLoading ? null : done ? (
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              Passwort gesetzt!
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Du kannst dich ab jetzt mit deinem neuen Passwort anmelden.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-[var(--accent)] text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition"
            >
              Weiter zum Dashboard
            </button>
          </div>
        ) : linkError || !user ? (
          <div className="text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              Link ungültig oder abgelaufen
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Dieser Link zum Zurücksetzen des Passworts ist nicht mehr gültig. Fordere einfach einen neuen an.
            </p>
            <Link
              href="/forgot-password"
              className="w-full inline-block bg-[var(--accent)] text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition"
            >
              Neuen Link anfordern
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">
              Neues Passwort setzen
            </h1>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Wähle ein neues Passwort für dein Konto.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Neues Passwort"
                required
                minLength={6}
                autoFocus
                autoComplete="new-password"
                className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm mb-3 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Neues Passwort bestätigen"
                required
                minLength={6}
                autoComplete="new-password"
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
                {loading ? "Wird gespeichert…" : "Passwort speichern"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main id="main-content" className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4" />
    }>
      <ResetPasswordInner />
    </Suspense>
  );
}

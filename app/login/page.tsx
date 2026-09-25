"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";
import { readLocalIntroState } from "@/lib/intro-state";

function translateAuthError(message: string): string {
  const known: Record<string, string> = {
    "Invalid login credentials": "E-Mail oder Passwort ist falsch.",
    "Email not confirmed": "Bitte bestätige zuerst deine E-Mail-Adresse — schau in deinem Posteingang nach der Bestätigungsmail.",
    "User already registered": "Für diese E-Mail existiert bereits ein Konto. Bitte melde dich an oder setze dein Passwort zurück.",
    "Password should be at least 6 characters.": "Das Passwort muss mindestens 6 Zeichen haben.",
    "email rate limit exceeded": "Zu viele E-Mails in kurzer Zeit verschickt. Bitte versuche es in ein paar Minuten nochmals.",
  };
  if (known[message]) return known[message];
  if (/for security purposes, you can only request this after/i.test(message)) {
    return "Bitte warte kurz (ca. 1 Minute), bevor du die Bestätigungsmail erneut anforderst.";
  }
  return message;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = searchParams.get("error");

  const configured = isSupabaseConfigured();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(callbackError ? decodeURIComponent(callbackError) : "");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const resendConfirmation = async () => {
    if (!email) return;
    setResendState("sending");
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(translateAuthError(error.message));
      setResendState("idle");
    } else {
      setResendState("sent");
    }
  };

  const resetFormError = () => {
    setError("");
    setNeedsConfirmation(false);
    setResendState("idle");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormError();

    if (mode === "register" && password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          // Gast-Onboarding (Alter/Interessen/Radius) mitgeben, damit es auch ankommt,
          // wenn der Bestätigungslink in einem anderen Browser geöffnet wird.
          data: { kidgo_onboarding: readLocalIntroState() },
        },
      });

      if (error) {
        setError(translateAuthError(error.message));
      } else if (data.user && (data.user.identities?.length ?? 0) === 0) {
        // Supabase meldet bei bereits registrierter E-Mail "Erfolg", verschickt aber
        // keine Mail (Schutz vor Konto-Enumeration). identities=[] verrät den Fall.
        setError("Für diese E-Mail existiert bereits ein Konto. Bitte melde dich an oder setze dein Passwort zurück. Falls du die Bestätigungsmail nie erhalten hast, kannst du sie unten erneut anfordern.");
        setNeedsConfirmation(true);
      } else if (data.session) {
        // E-Mail-Bestätigung ist deaktiviert -> Nutzer ist sofort eingeloggt
        router.push("/dashboard");
        return;
      } else {
        setSent(true);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setError(translateAuthError(error.message));
        if (error.message === "Email not confirmed") setNeedsConfirmation(true);
      } else {
        router.push("/dashboard");
        return;
      }
    }

    setLoading(false);
  };

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    resetFormError();
    setSent(false);
    setPassword("");
    setConfirmPassword("");
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
              Prüfe <strong className="text-[var(--text-primary)]">{email}</strong> und klicke auf den Bestätigungslink, um dein Konto zu aktivieren.
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-3">
              Keine Mail erhalten? Schau auch im Spam-Ordner nach.
            </p>
            {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resendState !== "idle"}
              className="mt-4 text-xs font-semibold text-[var(--accent)] hover:underline disabled:opacity-60 disabled:no-underline"
            >
              {resendState === "sending" ? "Wird gesendet…" : resendState === "sent" ? "Neue Bestätigungsmail gesendet ✓" : "Bestätigungsmail erneut senden"}
            </button>
            <div>
              <button
                onClick={() => switchMode("login")}
                className="mt-4 text-xs text-[var(--accent)] hover:underline"
              >
                Zurück zur Anmeldung
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex mb-6 rounded-xl bg-[var(--bg-subtle)] p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  mode === "login"
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)]"
                }`}
              >
                Anmelden
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                  mode === "register"
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-muted)]"
                }`}
              >
                Registrieren
              </button>
            </div>

            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">
              {mode === "login" ? "Willkommen zurück" : "Konto erstellen"}
            </h1>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              {mode === "login"
                ? "Melde dich mit deiner E-Mail und deinem Passwort an."
                : "Registriere dich mit E-Mail und Passwort — dauert nur eine Minute."}
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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm mb-3 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition"
              />
              {mode === "register" && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Passwort bestätigen"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-sm mb-3 bg-[var(--bg-subtle)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition"
                />
              )}

              {mode === "login" && (
                <div className="text-right mb-3">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Passwort vergessen?
                  </Link>
                </div>
              )}

              {error && (
                <p className="text-red-500 text-xs mb-3">{error}</p>
              )}

              {needsConfirmation && (
                <button
                  type="button"
                  onClick={resendConfirmation}
                  disabled={resendState !== "idle" || !email}
                  className="w-full mb-3 border border-[var(--accent)] text-[var(--accent)] rounded-xl py-2.5 font-semibold text-xs hover:bg-[var(--accent)]/10 transition disabled:opacity-60"
                >
                  {resendState === "sending" ? "Wird gesendet…" : resendState === "sent" ? "Bestätigungsmail gesendet ✓ – bitte Posteingang prüfen" : "Bestätigungsmail erneut senden"}
                </button>
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
                    Einen Moment…
                  </span>
                ) : mode === "login" ? "Anmelden" : "Registrieren"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
              {mode === "login" ? (
                <>
                  Noch kein Konto?{" "}
                  <button onClick={() => switchMode("register")} className="text-[var(--accent)] hover:underline font-medium">
                    Jetzt registrieren
                  </button>
                </>
              ) : (
                <>
                  Schon ein Konto?{" "}
                  <button onClick={() => switchMode("login")} className="text-[var(--accent)] hover:underline font-medium">
                    Anmelden
                  </button>
                </>
              )}
            </p>
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

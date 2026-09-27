"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";

// Diese Seite ersetzt den direkten Link auf Supabases eigenen /auth/v1/verify-
// Endpoint in den E-Mail-Templates (Confirm signup + Reset Password). Grund:
// wenn die Mail den Nutzer direkt auf /auth/v1/verify schickt, verifiziert
// JEDER GET-Request dieses Einweg-Token sofort — auch ein automatischer
// Link-Scan durch Outlook Safe Links, Gmail-Vorabruf oder einen Firmen-
// Mailfilter. Das Token ist dann schon "verbraucht", bevor der Mensch selbst
// klickt -> "Email link is invalid or has expired" beim echten Klick.
// Fix: die Mail zeigt hierhin (mit token_hash + type als Parameter), die Seite
// verifiziert erst nach einem echten Klick auf den Button per JS
// (supabase.auth.verifyOtp) — ein reiner GET/Prefetch der Seite loest das
// nicht aus.

type Step = "idle" | "verifying" | "done" | "error";

function labelForType(type: EmailOtpType | null): { title: string; cta: string; success: string } {
  if (type === "recovery") {
    return {
      title: "Passwort zurücksetzen",
      cta: "Bestätigen & Passwort setzen",
      success: "Bestätigt! Du wirst weitergeleitet …",
    };
  }
  if (type === "email_change") {
    return {
      title: "Neue E-Mail-Adresse bestätigen",
      cta: "E-Mail-Adresse bestätigen",
      success: "E-Mail-Adresse bestätigt!",
    };
  }
  return {
    title: "Konto bestätigen",
    cta: "E-Mail bestätigen",
    success: "Konto bestätigt! Willkommen bei Kidgo 🎉",
  };
}

function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const configured = isSupabaseConfigured();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState("");
  const redirectedRef = useRef(false);

  const copy = labelForType(type);

  const handleConfirm = async () => {
    if (!tokenHash || !type) return;
    setStep("verifying");
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      setStep("error");
      setError(
        error.message === "Email link is invalid or has expired" || error.message === "Token has expired or is invalid"
          ? "Dieser Link ist nicht mehr gültig. Fordere einfach einen neuen an."
          : error.message
      );
      return;
    }

    setStep("done");
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    setTimeout(() => {
      if (type === "recovery") {
        router.push(next ?? "/reset-password");
      } else {
        router.push(next ?? "/dashboard?welcome=1");
      }
    }, 900);
  };

  const missingParams = !tokenHash || !type;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] p-8 w-full max-w-sm text-center">
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

        {missingParams || step === "error" ? (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              Link ungültig oder abgelaufen
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              {missingParams
                ? "Dieser Link ist unvollständig. Fordere einfach einen neuen an."
                : error}
            </p>
            <Link
              href={type === "recovery" ? "/forgot-password" : "/login"}
              className="w-full inline-block bg-[var(--accent)] text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition"
            >
              Neuen Link anfordern
            </Link>
          </>
        ) : step === "done" ? (
          <>
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">{copy.success}</h2>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-1">{copy.title}</h1>
            <p className="text-sm text-[var(--text-muted)] mb-6">
              Klicke auf den Button, um fortzufahren.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={step === "verifying" || !configured}
              className="w-full bg-[var(--accent)] text-white rounded-xl py-3 font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {step === "verifying" ? "Wird bestätigt…" : copy.cta}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={
      <main id="main-content" className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4" />
    }>
      <ConfirmInner />
    </Suspense>
  );
}

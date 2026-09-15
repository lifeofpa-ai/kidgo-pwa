"use client";

import { type ReactNode, useEffect } from "react";
import { UserPrefsProvider } from "@/lib/user-prefs-context";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { OnboardingWalkthrough } from "@/components/OnboardingWalkthrough";
import { AgeChipsBar } from "@/components/AgeChipsBar";

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <UserPrefsProvider>
      <ServiceWorkerRegistrar />
      <OnboardingGate />
      {/* Zeigt sich erst NACH Abschluss von OnboardingGate/OnboardingFlow
          (prefs.onboarded) - CEO-Entscheid 15.09.2026, kein Stapeln zweier
          Vollbild-Screens fuer neue Nutzende. */}
      <OnboardingWalkthrough />
      <AgeChipsBar />
      {children}
    </UserPrefsProvider>
  );
}

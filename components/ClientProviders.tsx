"use client";

import { type ReactNode, useEffect } from "react";
import { UserPrefsProvider } from "@/lib/user-prefs-context";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
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
      <AgeChipsBar />
      {children}
    </UserPrefsProvider>
  );
}

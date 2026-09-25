"use client";

import { type ReactNode, useEffect } from "react";
import { UserPrefsProvider, useUserPrefs } from "@/lib/user-prefs-context";
import { useAuth } from "@/lib/auth-context";
import { WALKTHROUGH_STORAGE_KEY } from "@/lib/intro-state";
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

// Sobald jemand angemeldet ist, gelten die Intro-Screens als erledigt — lokal
// (damit sie auch nach einem Logout auf diesem Gerät nicht wieder erscheinen)
// und im Konto (onboarding_state), damit das auf allen Geräten gilt.
function IntroAccountSync() {
  const { user, profile, loading, markOnboardingFlag } = useAuth();
  const { mounted, prefs, markOnboarded } = useUserPrefs();
  useEffect(() => {
    if (loading || !user || !mounted) return;
    if (!prefs.onboarded) markOnboarded();
    try {
      localStorage.setItem(WALKTHROUGH_STORAGE_KEY, "1");
      localStorage.setItem("kidgo_onboarded", "true");
    } catch {}
    if (!profile) return; // Profil noch nicht geladen – später erneut
    const st = profile.onboarding_state || {};
    if (!st.flow_completed || !st.walkthrough_seen) {
      markOnboardingFlag(["flow_completed", "walkthrough_seen"]);
    }
  }, [loading, user, mounted, prefs.onboarded, markOnboarded, profile, markOnboardingFlag]);
  return null;
}

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <UserPrefsProvider>
      <ServiceWorkerRegistrar />
      <IntroAccountSync />
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

"use client";

import { useUserPrefs } from "@/lib/user-prefs-context";
import { OnboardingFlow } from "./OnboardingFlow";

export function OnboardingGate() {
  const { prefs, mounted } = useUserPrefs();
  if (!mounted || prefs.onboarded) return null;
  return <OnboardingFlow />;
}

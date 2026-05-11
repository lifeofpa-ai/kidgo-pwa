"use client";

import { type ReactNode } from "react";
import { UserPrefsProvider } from "@/lib/user-prefs-context";
import { OnboardingGate } from "@/components/onboarding/OnboardingGate";
import { AgeChipsBar } from "@/components/AgeChipsBar";

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <UserPrefsProvider>
      <OnboardingGate />
      <AgeChipsBar />
      {children}
    </UserPrefsProvider>
  );
}

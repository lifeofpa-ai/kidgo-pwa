"use client";

import { usePathname } from "next/navigation";
import { useUserPrefs } from "@/lib/user-prefs-context";
import { useAuth } from "@/lib/auth-context";
import { OnboardingFlow } from "./OnboardingFlow";
import { isAuthRoute } from "@/lib/intro-state";

export function OnboardingGate() {
  const { prefs, mounted } = useUserPrefs();
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  if (!mounted) return null;
  // Auth-Status abwarten, sonst blitzt das Intro bei angemeldeten Nutzern kurz auf.
  if (authLoading) return null;
  // Intro-Screens gibt es nur einmalig für neue Besucher/innen (vor bzw. bei der
  // Registrierung). Angemeldete Nutzer/innen sehen sie nie wieder — auf keinem
  // Gerät, auch nicht nach Klick auf den Bestätigungslink in einem anderen Browser.
  if (user) return null;
  // Login/Registrierung/Passwort-Reset nie durch das Vollbild-Intro blockieren.
  if (isAuthRoute(pathname)) return null;
  if (prefs.onboarded) return null;
  return <OnboardingFlow />;
}

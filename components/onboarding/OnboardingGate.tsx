"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUserPrefs } from "@/lib/user-prefs-context";
import { useAuth } from "@/lib/auth-context";
import { OnboardingFlow } from "./OnboardingFlow";
import { Landingpage } from "./Landingpage";
import { isAuthRoute } from "@/lib/intro-state";

// 28.09.2026 (Patrick): neue Besucher landeten direkt auf der Alters-/
// Interessen-Auswahl, ohne zu wissen, was Kidgo überhaupt ist. Landingpage
// läuft der bestehenden OnboardingFlow (Alter/Interessen/Radius) jetzt
// einmalig voraus — eigener localStorage-Flag, damit OnboardingFlow selbst
// unverändert bleibt und wiederkehrende Geräte die Landingpage nicht erneut
// sehen.
const LANDING_SEEN_KEY = "kidgo_landing_seen";

export function OnboardingGate() {
  const { prefs, mounted } = useUserPrefs();
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  // null = noch nicht aus localStorage gelesen (verhindert Aufblitzen der
  // Landingpage bei wiederkehrenden Besuchern, analog zu authLoading unten).
  const [landingSeen, setLandingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setLandingSeen(localStorage.getItem(LANDING_SEEN_KEY) === "1");
    } catch {
      // Kein localStorage verfügbar (z.B. strikter Privatmodus) - Landingpage
      // überspringen statt den Einstieg zu blockieren.
      setLandingSeen(true);
    }
  }, []);

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
  if (landingSeen === null) return null;

  if (!landingSeen) {
    return (
      <Landingpage
        onContinue={() => {
          try {
            localStorage.setItem(LANDING_SEEN_KEY, "1");
          } catch {}
          setLandingSeen(true);
        }}
      />
    );
  }

  return <OnboardingFlow />;
}

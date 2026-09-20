"use client";

import { useUserPrefs } from "@/lib/user-prefs-context";
import { useAuth } from "@/lib/auth-context";
import { OnboardingFlow } from "./OnboardingFlow";

export function OnboardingGate() {
  const { prefs, mounted } = useUserPrefs();
  const { user, profile, loading: authLoading } = useAuth();
  if (!mounted) return null;
  // Angemeldete Nutzer: kurz warten bis das Profil geladen ist, sonst würde
  // das Intro kurz aufblitzen, obwohl der Account es schon als erledigt kennt.
  if (user && authLoading) return null;
  // Wiedererkennung übers Konto: einmal auf irgendeinem Gerät abgeschlossen,
  // nie wieder anzeigen — auch nicht auf einem neuen Gerät nach Login.
  const recognizedViaAccount = !!profile?.onboarding_state?.flow_completed;
  if (prefs.onboarded || recognizedViaAccount) return null;
  return <OnboardingFlow />;
}

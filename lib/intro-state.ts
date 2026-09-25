// Gemeinsame Helfer für die einmaligen Intro-Screens (OnboardingFlow +
// OnboardingWalkthrough). Regel (Patrick, 25.09.2026): Intro nur einmalig bei
// der Registrierung — angemeldete Nutzer/innen sehen es nie wieder.

export const WALKTHROUGH_STORAGE_KEY = "kidgo_onboarding_seen_v1";

const AUTH_ROUTES = ["/login", "/auth", "/forgot-password", "/reset-password"];

export function isAuthRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

/** Liest den lokalen Intro-/Präferenz-Stand (Gast-Onboarding) für die Registrierung. */
export function readLocalIntroState(): {
  flow_completed: boolean;
  walkthrough_seen: boolean;
  age_buckets?: string[];
  interests?: string[];
  radius_km?: number;
} {
  try {
    const raw = localStorage.getItem("user_preferences");
    const p: { onboarded?: boolean; ageBuckets?: string[]; interests?: string[]; radius?: number } =
      raw ? JSON.parse(raw) : {};
    return {
      flow_completed: !!p.onboarded || localStorage.getItem("kidgo_onboarded") === "true",
      walkthrough_seen: !!localStorage.getItem(WALKTHROUGH_STORAGE_KEY),
      ...(p.ageBuckets?.length ? { age_buckets: p.ageBuckets } : {}),
      ...(p.interests?.length ? { interests: p.interests } : {}),
      ...(p.radius ? { radius_km: p.radius } : {}),
    };
  } catch {
    return { flow_completed: false, walkthrough_seen: false };
  }
}

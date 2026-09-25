"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";

// Account-weite Onboarding-Erkennung (2026-09-20): Flags, die verhindern, dass
// bereits gesehene Intros/Hinweise auf einem neuen Gerät nach Login erneut
// erscheinen. Ergänzt die geräte-lokalen localStorage-Flags, ersetzt sie nicht.
export interface OnboardingState {
  flow_completed?: boolean; // OnboardingFlow (Alter/Interessen/Radius)
  walkthrough_seen?: boolean; // OnboardingWalkthrough (3 USP-Slides)
  swipe_hint_seen?: boolean; // Swipe-Hinweis auf den Empfehlungs-Karten
  profile_setup_dismissed?: boolean; // ProfileSetupModal übersprungen
  age_buckets?: string[]; // Gast-Onboarding-Praeferenz, beim ersten Login uebernommen
  radius_km?: number; // Gast-Onboarding-Praeferenz, beim ersten Login uebernommen
  [key: string]: boolean | string[] | number | undefined;
}

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  children: Array<{ name: string; age_bucket: string }>;
  interests: string[] | null;
  created_at: string;
  onboarding_state: OnboardingState | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markOnboardingFlag: (flag: keyof OnboardingState | Array<keyof OnboardingState>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  markOnboardingFlag: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    setProfile(data ?? null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Beim ersten Login/Registrierung: lokale Praeferenzen (aus Gast-Onboarding)
        // in den Account uebernehmen, falls dort noch kein Profil existiert (ignoreDuplicates:
        // true -> reiner Insert-Fall, ruehrt ein bereits vorhandenes Profil nie an).
        // INITIAL_SESSION deckt den Fall ab, dass die Session erst nach Klick auf den
        // E-Mail-Bestaetigungslink entsteht (Server-Redirect via /auth/callback, Confirm-Email
        // ist aktiv) -- dort feuert im Browser kein SIGNED_IN, nur INITIAL_SESSION beim Laden
        // der Session aus den Cookies.
        if (_event === "SIGNED_IN" || _event === "INITIAL_SESSION") {
          try {
            const raw = typeof localStorage !== "undefined" ? localStorage.getItem("user_preferences") : null;
            let parsed: { interests?: string[]; ageBuckets?: string[]; radius?: number } = raw ? JSON.parse(raw) : {};
            // Bestätigungslink in anderem Browser geöffnet (z.B. Mail-App): dort ist
            // localStorage leer -> bei der Registrierung mitgegebene Präferenzen nutzen.
            const meta = (session.user.user_metadata?.kidgo_onboarding ?? null) as
              | { interests?: string[]; age_buckets?: string[]; radius_km?: number }
              | null;
            if (meta && !parsed.ageBuckets?.length && !parsed.interests?.length) {
              parsed = { interests: meta.interests, ageBuckets: meta.age_buckets, radius: meta.radius_km };
            }
            await supabase.from("user_profiles").upsert(
              {
                user_id: session.user.id,
                interests: parsed.interests ?? [],
                children: [],
                onboarding_state: {
                  // Wer ein Konto hat, hat die Intro-Screens hinter sich (einmalig bei Registrierung).
                  flow_completed: true,
                  walkthrough_seen: true,
                  ...(parsed.ageBuckets?.length ? { age_buckets: parsed.ageBuckets } : {}),
                  ...(parsed.radius ? { radius_km: parsed.radius } : {}),
                },
              },
              { onConflict: "user_id", ignoreDuplicates: true }
            );
          } catch {}
        }
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // Account-weite Onboarding-Erkennung: Flag optimistisch lokal setzen und
  // in user_profiles.onboarding_state mergen, damit ein zurückkehrender
  // Nutzer dasselbe Intro/den Hinweis auf einem anderen Gerät nicht erneut
  // sieht. Schreibt NUR die onboarding_state-Spalte, andere Profilfelder
  // bleiben unangetastet.
  const markOnboardingFlag = async (flag: keyof OnboardingState | Array<keyof OnboardingState>) => {
    if (!user) return;
    const flags = Array.isArray(flag) ? flag : [flag];
    const patch = Object.fromEntries(flags.map((f) => [f, true])) as OnboardingState;
    setProfile((prev) => {
      const nextState = { ...(prev?.onboarding_state || {}), ...patch };
      if (prev) return { ...prev, onboarding_state: nextState };
      return prev;
    });
    try {
      const currentState = profile?.onboarding_state || {};
      await supabase.from("user_profiles").upsert(
        { user_id: user.id, onboarding_state: { ...currentState, ...patch } },
        { onConflict: "user_id" }
      );
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, signOut, refreshProfile, markOnboardingFlag }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

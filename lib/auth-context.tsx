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
  [key: string]: boolean | undefined;
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
  markOnboardingFlag: (flag: keyof OnboardingState) => Promise<void>;
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
        // On first sign-in: push localStorage prefs to Supabase if no profile exists yet
        if (_event === "SIGNED_IN") {
          try {
            const raw = typeof localStorage !== "undefined" ? localStorage.getItem("user_preferences") : null;
            const parsed: { interests?: string[] } = raw ? JSON.parse(raw) : {};
            await supabase.from("user_profiles").upsert(
              { user_id: session.user.id, interests: parsed.interests ?? [], children: [] },
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
  const markOnboardingFlag = async (flag: keyof OnboardingState) => {
    if (!user) return;
    setProfile((prev) => {
      const nextState = { ...(prev?.onboarding_state || {}), [flag]: true };
      if (prev) return { ...prev, onboarding_state: nextState };
      return prev;
    });
    try {
      const currentState = profile?.onboarding_state || {};
      await supabase.from("user_profiles").upsert(
        { user_id: user.id, onboarding_state: { ...currentState, [flag]: true } },
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

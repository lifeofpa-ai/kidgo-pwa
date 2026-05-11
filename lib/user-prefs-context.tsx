"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface UserPreferences {
  ageBuckets: string[];
  interests: string[];
  radius: number;
  onboarded: boolean;
}

const DEFAULT: UserPreferences = {
  ageBuckets: [],
  interests: [],
  radius: 15,
  onboarded: false,
};

const STORAGE_KEY = "user_preferences";

interface UserPrefsCtx {
  prefs: UserPreferences;
  mounted: boolean;
  setPrefs: (p: UserPreferences) => void;
  toggleAgeBucket: (b: string) => void;
  updateInterests: (i: string[]) => void;
  updateRadius: (r: number) => void;
  markOnboarded: () => void;
}

const UserPrefsContext = createContext<UserPrefsCtx>({
  prefs: DEFAULT,
  mounted: false,
  setPrefs: () => {},
  toggleAgeBucket: () => {},
  updateInterests: () => {},
  updateRadius: () => {},
  markOnboarded: () => {},
});

export function UserPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<UserPreferences>(DEFAULT);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefsState({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {}
    setMounted(true);
  }, []);

  const setPrefs = useCallback((p: UserPreferences) => {
    setPrefsState(p);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  }, []);

  const toggleAgeBucket = useCallback((b: string) => {
    setPrefsState((prev) => {
      const next = {
        ...prev,
        ageBuckets: prev.ageBuckets.includes(b)
          ? prev.ageBuckets.filter((x) => x !== b)
          : [...prev.ageBuckets, b],
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const updateInterests = useCallback((interests: string[]) => {
    setPrefsState((prev) => {
      const next = { ...prev, interests };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const updateRadius = useCallback((radius: number) => {
    setPrefsState((prev) => {
      const next = { ...prev, radius };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const markOnboarded = useCallback(() => {
    setPrefsState((prev) => {
      const next = { ...prev, onboarded: true };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return (
    <UserPrefsContext.Provider
      value={{ prefs, mounted, setPrefs, toggleAgeBucket, updateInterests, updateRadius, markOnboarded }}
    >
      {children}
    </UserPrefsContext.Provider>
  );
}

export const useUserPrefs = () => useContext(UserPrefsContext);

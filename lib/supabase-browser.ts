import { createBrowserClient } from "@supabase/ssr";

const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

function isMissing(key: string | undefined): boolean {
  return !key || key === "DEIN_ANON_KEY_HIER" || key === "your-anon-key-here";
}

export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !isMissing(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

let warned = false;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || isMissing(key)) {
    if (typeof window !== "undefined" && !warned) {
      warned = true;
      console.warn(
        "Supabase-Konfiguration fehlt. NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local setzen (siehe LOGIN_SETUP.md)."
      );
    }
    return createBrowserClient(PLACEHOLDER_URL, PLACEHOLDER_KEY);
  }

  return createBrowserClient(url, key!);
}

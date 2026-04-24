import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || key === "DEIN_ANON_KEY_HIER" || key === "your-anon-key-here") {
    throw new Error(
      "Supabase-Konfiguration fehlt. Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local setzen (siehe LOGIN_SETUP.md)."
    );
  }

  return createBrowserClient(url, key);
}

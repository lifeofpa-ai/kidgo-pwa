"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export function AuthButton() {
  const { user, profile, loading, signOut } = useAuth();

  if (loading) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="bg-kidgo-500 text-white rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-kidgo-600 transition"
      >
        Anmelden
      </Link>
    );
  }

  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "Ich";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
        {displayName}
      </span>
      <button
        onClick={() => signOut()}
        className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:border-gray-300 transition"
      >
        Abmelden
      </button>
    </div>
  );
}

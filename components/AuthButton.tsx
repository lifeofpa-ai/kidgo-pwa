"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export function AuthButton({ level }: { level?: string }) {
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
      <Link
        href="/dashboard"
        className="flex items-center gap-1.5 hover:opacity-80 transition"
        aria-label="Dashboard öffnen"
      >
        {level && (
          <span className="hidden sm:inline-flex items-center bg-[var(--accent-light)] text-[var(--accent)] text-xs font-bold px-2 py-0.5 rounded-full border border-[var(--accent)]/20">
            {level}
          </span>
        )}
        <span className="text-xs text-[var(--text-secondary)] hidden sm:block">
          {displayName}
        </span>
      </Link>
      <button
        onClick={() => signOut()}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--border-strong)] transition"
      >
        Abmelden
      </button>
    </div>
  );
}

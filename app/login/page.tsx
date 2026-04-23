"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <KidgoLogo size="sm" />
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-3">📬</div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
              E-Mail gesendet!
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Prüfe dein Postfach und klicke auf den Link um dich anzumelden.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-1">
              Anmelden
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Gib deine E-Mail ein — wir schicken dir einen Login-Link.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.ch"
                required
                className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-kidgo-300 bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400"
              />
              {error && (
                <p className="text-red-500 text-xs mb-3">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-kidgo-500 text-white rounded-xl py-3 font-semibold text-sm hover:bg-kidgo-600 transition disabled:opacity-50"
              >
                {loading ? "Wird gesendet…" : "Magic Link senden ✉️"}
              </button>
            </form>
          </>
        )}

        <div className="mt-4 text-center">
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
          >
            ← Zurück zur Startseite
          </Link>
        </div>
      </div>
    </main>
  );
}

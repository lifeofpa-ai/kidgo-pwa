import Link from "next/link";
import type { Metadata } from "next";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback – kidgo",
  description: "Teile deine Idee oder melde einen Fehler.",
};

export default function FeedbackPage() {
  return (
    <main id="main-content" role="main" className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12 sm:py-16 pb-24 md:pb-16">
        <Link
          href="/ich"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition mb-10"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Zurück
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Feedback</h1>
        <p className="text-sm text-gray-400 mb-10">
          Fehlt dir etwas oder hast du eine Idee? Wir freuen uns über jede Nachricht.
        </p>

        <FeedbackForm />
      </div>
    </main>
  );
}

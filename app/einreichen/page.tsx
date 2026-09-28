import Link from "next/link";
import type { Metadata } from "next";
import { SubmitEventForm } from "@/components/SubmitEventForm";

export const metadata: Metadata = {
  title: "Event einreichen – kidgo",
  description: "Kennst du ein Kinder-Event, ein Camp oder eine Attraktion, das/die bei uns fehlt? Schick uns den Link.",
};

export default function EinreichenPage() {
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

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Event einreichen</h1>
        <p className="text-sm text-gray-400 mb-10">
          Kennst du ein Kinder-Event, ein Camp oder eine Attraktion, das/die bei uns fehlt?
          Schick uns einfach den Link – wir prüfen und schalten es frei.
        </p>

        <SubmitEventForm />
      </div>
    </main>
  );
}

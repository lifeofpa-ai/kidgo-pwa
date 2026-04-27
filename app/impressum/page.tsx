import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressum – kidgo",
  description: "Rechtliche Angaben und Kontaktinformationen von kidgo.",
};

export default function ImpressumPage() {
  return (
    <main id="main-content" role="main" className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12 sm:py-16 pb-24 md:pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition mb-10"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Zurück
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Impressum</h1>
        <p className="text-sm text-gray-400 mb-10">Angaben gemäss Art. 238 ZGB und DSG</p>

        <div className="space-y-8 text-sm text-gray-600 leading-relaxed">
          <section aria-labelledby="betreiber-heading">
            <h2 id="betreiber-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Betreiber</h2>
            <div className="space-y-1">
              <p className="font-medium text-gray-800">Kidgo</p>
              <p>Zürich</p>
              <p>
                <a
                  href="mailto:contact@kidgo.ch"
                  className="text-kidgo-500 hover:text-kidgo-600 transition underline underline-offset-2"
                >
                  contact@kidgo.ch
                </a>
              </p>
            </div>
          </section>

          <div className="border-t border-gray-100" role="separator" />

          <section aria-labelledby="angebot-heading">
            <h2 id="angebot-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Angebot</h2>
            <p>
              kidgo ist ein privates, nicht-kommerzielles Projekt. Es werden Events und Aktivitäten
              für Kinder in der Region Zürich aggregiert und aufbereitet. Alle Angaben sind ohne
              Gewähr.
            </p>
          </section>

          <div className="border-t border-gray-100" role="separator" />

          <section aria-labelledby="haftung-heading">
            <h2 id="haftung-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Haftungsausschluss</h2>
            <p>
              Die auf kidgo angezeigten Event-Informationen stammen aus öffentlich zugänglichen
              Quellen. Trotz sorgfältiger Prüfung können Fehler, Änderungen und Absagen vorkommen.
              Kidgo übernimmt keine Haftung für die Richtigkeit, Vollständigkeit oder Aktualität
              der Informationen. Für die Inhalte verlinkter externer Seiten sind ausschliesslich
              deren Betreiber verantwortlich.
            </p>
          </section>

          <div className="border-t border-gray-100" role="separator" />

          <section aria-labelledby="urheberrecht-heading">
            <h2 id="urheberrecht-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Urheberrecht</h2>
            <p>
              Die auf dieser Website verwendeten Fotos werden über die Pexels API bezogen
              (pexels.com). Die Nutzung erfolgt gemäss den Pexels-Lizenzbedingungen. Alle sonstigen
              Inhalte und Darstellungen sind urheberrechtlich geschützt.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100">
          <p className="text-xs text-gray-300">© 2026 kidgo · Zürich</p>
        </div>
      </div>
    </main>
  );
}

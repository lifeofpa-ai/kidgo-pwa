import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutz – kidgo",
  description: "Datenschutzerklärung von kidgo: Welche Daten werden gespeichert und wie werden sie verwendet.",
};

export default function DatenschutzPage() {
  return (
    <main id="main-content" role="main" className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition mb-10"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Zurück
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Datenschutzerklärung</h1>
        <p className="text-sm text-gray-400 mb-10">Stand: April 2026 · Gemäss Schweizer DSG</p>

        <div className="space-y-8 text-sm text-gray-600 leading-relaxed">
          <section aria-labelledby="grundsatz-heading">
            <h2 id="grundsatz-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Grundsatz</h2>
            <p>
              kidgo erhebt keine personenbezogenen Daten und betreibt kein Tracking oder Analytics.
              Es gibt keine Nutzerkonten, keine Registrierung und keine Cookies von Drittanbietern.
              Alle Einstellungen werden ausschliesslich lokal auf deinem Gerät gespeichert.
            </p>
          </section>

          <div className="border-t border-gray-100" role="separator" />

          <section aria-labelledby="localstorage-heading">
            <h2 id="localstorage-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Lokaler Speicher (localStorage)</h2>
            <p className="mb-3">
              Folgende Daten werden im localStorage deines Browsers gespeichert — ausschliesslich
              auf deinem Gerät, nicht auf unseren Servern:
            </p>
            <ul className="space-y-2">
              {[
                { key: "kidgo_age_buckets", desc: "Deine gewählte Altersgruppe" },
                { key: "kidgo_theme", desc: "Hell- oder Dunkel-Design-Einstellung" },
                { key: "kidgo_location", desc: "Ungefährer Standort (nur wenn erlaubt)" },
                { key: "kidgo_onboarded", desc: "Ob das Onboarding abgeschlossen wurde" },
                { key: "kidgo_favorites", desc: "Deine gespeicherten Favoriten" },
                { key: "kidgo_visit_streak", desc: "Besuchsanzahl für die Wochenwertung" },
                { key: "kidgo_cached_events", desc: "Zuletzt geladene Events für Offline-Nutzung" },
                { key: "kidgo_challenge_accepted", desc: "Ob du die Wochenchallenge angenommen hast" },
                { key: "kidgo_install_dismissed", desc: "Ob der App-Installations-Banner abgelehnt wurde" },
              ].map(({ key, desc }) => (
                <li key={key} className="flex items-start gap-3">
                  <code className="flex-shrink-0 bg-gray-50 border border-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded font-mono">
                    {key}
                  </code>
                  <span className="text-gray-500">{desc}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-gray-400">
              Du kannst diese Daten jederzeit löschen, indem du den Browsercache deines Browsers
              löschst oder in den Entwicklertools unter „Application → Local Storage" entfernst.
            </p>
          </section>

          <div className="border-t border-gray-100" role="separator" />

          <section aria-labelledby="drittdienste-heading">
            <h2 id="drittdienste-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Drittdienste</h2>
            <div className="space-y-5">
              <div>
                <h3 className="font-medium text-gray-700 mb-1">Supabase</h3>
                <p>
                  Die Event-Daten werden in einer Supabase-Datenbank (Supabase Inc., USA) gespeichert.
                  Bei der Nutzung der App wird eine anonyme Datenbankabfrage gesendet. Es werden
                  keine personenbezogenen Daten übertragen. Datenschutzerklärung:{" "}
                  <a
                    href="https://supabase.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-kidgo-500 hover:text-kidgo-600 transition underline underline-offset-2"
                  >
                    supabase.com/privacy
                  </a>
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-1">Open-Meteo</h3>
                <p>
                  Für die Wetteranzeige wird die Open-Meteo API (open-meteo.com) verwendet. Es
                  werden die fixen Koordinaten von Zürich übermittelt — keine persönlichen
                  Standortdaten. Open-Meteo ist DSGVO-konform und datenschutzfreundlich.
                  Datenschutzerklärung:{" "}
                  <a
                    href="https://open-meteo.com/en/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-kidgo-500 hover:text-kidgo-600 transition underline underline-offset-2"
                  >
                    open-meteo.com/en/terms
                  </a>
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-1">Pexels</h3>
                <p>
                  Event-Bilder werden über die Pexels API (pexels.com) bereitgestellt. Beim Laden
                  von Bildern wird eine Verbindung zu den Pexels-Servern hergestellt. Datenschutzerklärung:{" "}
                  <a
                    href="https://www.pexels.com/privacy-policy/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-kidgo-500 hover:text-kidgo-600 transition underline underline-offset-2"
                  >
                    pexels.com/privacy-policy
                  </a>
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-1">Vercel</h3>
                <p>
                  kidgo wird auf Vercel (Vercel Inc., USA) gehostet. Vercel kann technische
                  Zugriffslogs speichern (IP-Adresse, Zeitstempel). Diese Logs werden automatisch
                  gelöscht. Datenschutzerklärung:{" "}
                  <a
                    href="https://vercel.com/legal/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-kidgo-500 hover:text-kidgo-600 transition underline underline-offset-2"
                  >
                    vercel.com/legal/privacy-policy
                  </a>
                </p>
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100" role="separator" />

          <section aria-labelledby="standort-heading">
            <h2 id="standort-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Standortdaten</h2>
            <p>
              kidgo kann optional deinen Standort verwenden, um Entfernungen zu Events anzuzeigen.
              Dies geschieht nur nach ausdrücklicher Erlaubnis über die Browser-Standortabfrage.
              Dein Standort wird nicht an Server übertragen, sondern ausschliesslich lokal im
              Browser verarbeitet und im localStorage gespeichert.
            </p>
          </section>

          <div className="border-t border-gray-100" role="separator" />

          <section aria-labelledby="kontakt-heading">
            <h2 id="kontakt-heading" className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kontakt</h2>
            <p>
              Bei Fragen zum Datenschutz wende dich an:{" "}
              <a
                href="mailto:contact@kidgo.ch"
                className="text-kidgo-500 hover:text-kidgo-600 transition underline underline-offset-2"
              >
                contact@kidgo.ch
              </a>
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

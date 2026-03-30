"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Tab = "event" | "quelle";

export default function SubmitPage() {
  const [tab, setTab] = useState<Tab>("event");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [eventForm, setEventForm] = useState({
    titel: "", datum: "", datum_ende: "", ort: "",
    anmelde_link: "", beschreibung: "", preis_chf: "",
    altersgruppen: "", kontakt_email: "",
  });

  const [quelleForm, setQuelleForm] = useState({
    name: "", url: "", notizen: "", kontakt_email: "",
  });

  const submitEvent = async () => {
    if (!eventForm.titel || !eventForm.ort) {
      setError("Bitte fülle alle Pflichtfelder aus (*)");
      return;
    }
    setLoading(true);
    setError("");
    const altersArr = eventForm.altersgruppen
      ? [eventForm.altersgruppen]
      : [];
    const { error: dbError } = await supabase.from("events").insert({
      titel: eventForm.titel,
      datum: eventForm.datum || null,
      datum_ende: eventForm.datum_ende || null,
      ort: eventForm.ort,
      anmelde_link: eventForm.anmelde_link || null,
      beschreibung: eventForm.beschreibung || null,
      preis_chf: eventForm.preis_chf ? parseFloat(eventForm.preis_chf) : null,
      altersgruppen: altersArr,
      kontakt_email: eventForm.kontakt_email || null,
      status: "pending",
      kategorien: [],
    });
    if (dbError) setError("Fehler: " + dbError.message);
    else setSuccess(true);
    setLoading(false);
  };

  const submitQuelle = async () => {
    if (!quelleForm.name || !quelleForm.url) {
      setError("Bitte fülle alle Pflichtfelder aus (*)");
      return;
    }
    setLoading(true);
    setError("");
    const { error: dbError } = await supabase.from("quellen").insert({
      name: quelleForm.name,
      url: quelleForm.url,
      notizen: quelleForm.notizen || null,
      kontakt_email: quelleForm.kontakt_email || null,
      status: "pending",
    });
    if (dbError) setError("Fehler: " + dbError.message);
    else setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Danke für deinen Beitrag!</h2>
          <p className="text-gray-600 mb-6">
            {tab === "event"
              ? "Dein Event wurde eingereicht und wird von uns geprüft."
              : "Deine Quellen-Empfehlung wird von uns geprüft."}
          </p>
          <button
            onClick={() => {
              setSuccess(false);
              setEventForm({ titel: "", datum: "", datum_ende: "", ort: "", anmelde_link: "", beschreibung: "", preis_chf: "", altersgruppen: "", kontakt_email: "" });
              setQuelleForm({ name: "", url: "", notizen: "", kontakt_email: "" });
            }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold mr-3"
          >
            Weiteres einreichen
          </button>
          <a href="/" className="inline-block mt-2 text-indigo-600 hover:underline">← Zurück zur App</a>
        </div>
      </main>
    );
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-8 py-4">
          <a href="/" className="inline-block mb-3 text-indigo-600 hover:underline text-sm">← Zurück zu Kidgo</a>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">📮 Beitrag leisten</h1>
          <p className="text-gray-500 text-sm">Kennst du ein tolles Kinder-Event oder eine gute Quelle?<br />Teile es — wir prüfen und schalten es frei.</p>
        </div>

        <div className="flex gap-2 mb-5">
          <button onClick={() => { setTab("event"); setError(""); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition ${tab === "event" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm"}`}>
            📅 Event einreichen
          </button>
          <button onClick={() => { setTab("quelle"); setError(""); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition ${tab === "quelle" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm"}`}>
            🔗 Quelle vorschlagen
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
          {tab === "event" ? (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Event-Titel *</label>
                <input type="text" placeholder="z.B. Malkurs für Kinder im Kunsthaus" value={eventForm.titel}
                  onChange={(e) => setEventForm({ ...eventForm, titel: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Startdatum</label>
                  <input type="date" value={eventForm.datum}
                    onChange={(e) => setEventForm({ ...eventForm, datum: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Enddatum</label>
                  <input type="date" value={eventForm.datum_ende}
                    onChange={(e) => setEventForm({ ...eventForm, datum_ende: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Ort / Adresse *</label>
                <input type="text" placeholder="z.B. Kunsthaus Zürich, Heimplatz 1" value={eventForm.ort}
                  onChange={(e) => setEventForm({ ...eventForm, ort: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Website oder Anmelde-Link</label>
                <input type="url" placeholder="https://..." value={eventForm.anmelde_link}
                  onChange={(e) => setEventForm({ ...eventForm, anmelde_link: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Beschreibung</label>
                <textarea placeholder="Kurze Beschreibung des Events..." rows={3} value={eventForm.beschreibung}
                  onChange={(e) => setEventForm({ ...eventForm, beschreibung: e.target.value })} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Preis (CHF)</label>
                  <input type="number" placeholder="0 = kostenlos" value={eventForm.preis_chf}
                    onChange={(e) => setEventForm({ ...eventForm, preis_chf: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Altersgruppe</label>
                  <input type="text" placeholder="z.B. 6–12 Jahre" value={eventForm.altersgruppen}
                    onChange={(e) => setEventForm({ ...eventForm, altersgruppen: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Deine E-Mail (optional, für Rückfragen)</label>
                <input type="email" placeholder="name@beispiel.ch" value={eventForm.kontakt_email}
                  onChange={(e) => setEventForm({ ...eventForm, kontakt_email: e.target.value })} className={inputClass} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                💡 Eine <strong>Quelle</strong> ist eine Organisation oder Website, die regelmässig Kinder-Events anbietet — z.B. ein Museum, eine Bibliothek oder ein Sportverein.
              </div>
              <div>
                <label className={labelClass}>Name der Organisation / Website *</label>
                <input type="text" placeholder="z.B. Stadtbibliothek Zürich" value={quelleForm.name}
                  onChange={(e) => setQuelleForm({ ...quelleForm, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Website-URL *</label>
                <input type="url" placeholder="https://..." value={quelleForm.url}
                  onChange={(e) => setQuelleForm({ ...quelleForm, url: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Warum ist diese Quelle interessant?</label>
                <textarea placeholder="z.B. bietet monatliche Gratis-Workshops für Kinder ab 5 Jahren an..." rows={3} value={quelleForm.notizen}
                  onChange={(e) => setQuelleForm({ ...quelleForm, notizen: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Deine E-Mail (optional, für Rückfragen)</label>
                <input type="email" placeholder="name@beispiel.ch" value={quelleForm.kontakt_email}
                  onChange={(e) => setQuelleForm({ ...quelleForm, kontakt_email: e.target.value })} className={inputClass} />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">⚠️ {error}</div>
          )}

          <button onClick={tab === "event" ? submitEvent : submitQuelle} disabled={loading}
            className="w-full mt-6 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-base">
            {loading ? "⏳ Wird eingereicht..." : "📮 Einreichen"}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 pb-8">
          Alle Einreichungen werden von unserem Team geprüft. Nur freigeschaltete Events erscheinen in der App.
        </p>
      </div>
    </main>
  );
                }

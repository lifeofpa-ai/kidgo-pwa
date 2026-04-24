"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";

type Tab = "event" | "quelle";

const CATEGORIES = [
  "Kreativ", "Natur", "Tiere", "Sport", "Tanz",
  "Theater", "Musik", "Mode & Design", "Wissenschaft", "Bildung", "Ausflug", "Feriencamp",
];

function generateMathQuestion(): { q: string; answer: number } {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const ops = [
    { q: `${a} + ${b}`, answer: a + b },
    { q: `${a + b} − ${b}`, answer: a },
    { q: `${a} × ${Math.min(b, 4)}`, answer: a * Math.min(b, 4) },
  ];
  return ops[Math.floor(Math.random() * ops.length)];
}

const inputClass = "w-full px-4 py-2.5 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 focus:border-transparent transition";
const labelClass = "block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelClass}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function SubmitPage() {
  const [tab, setTab] = useState<Tab>("event");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [spamAnswer, setSpamAnswer] = useState("");

  const mathQ = useMemo(() => generateMathQuestion(), []);

  const [eventForm, setEventForm] = useState({
    titel: "",
    datum: "",
    datum_ende: "",
    ort: "",
    anmelde_link: "",
    beschreibung: "",
    preis_chf: "",
    kategorien: [] as string[],
    altersgruppen: "",
    kontakt_email: "",
  });

  const [quelleForm, setQuelleForm] = useState({
    name: "",
    url: "",
    notizen: "",
    kontakt_email: "",
  });

  const setE = (k: keyof typeof eventForm, v: string) => setEventForm((f) => ({ ...f, [k]: v }));
  const setQ = (k: keyof typeof quelleForm, v: string) => setQuelleForm((f) => ({ ...f, [k]: v }));

  const toggleCat = (cat: string) =>
    setEventForm((f) => ({
      ...f,
      kategorien: f.kategorien.includes(cat)
        ? f.kategorien.filter((c) => c !== cat)
        : [...f.kategorien, cat],
    }));

  const validateSpam = () => {
    const ans = parseInt(spamAnswer.trim(), 10);
    if (isNaN(ans) || ans !== mathQ.answer) {
      setError("Bitte beantworte die Sicherheitsfrage korrekt.");
      return false;
    }
    return true;
  };

  const submitEvent = async () => {
    if (!eventForm.titel || !eventForm.ort) {
      setError("Bitte fülle alle Pflichtfelder aus.");
      return;
    }
    if (!validateSpam()) return;
    setLoading(true);
    setError("");
    const { error: dbError } = await supabase.from("events").insert({
      titel: eventForm.titel,
      datum: eventForm.datum || null,
      datum_ende: eventForm.datum_ende || null,
      ort: eventForm.ort,
      anmelde_link: eventForm.anmelde_link || null,
      beschreibung: eventForm.beschreibung || null,
      preis_chf: eventForm.preis_chf ? parseFloat(eventForm.preis_chf) : null,
      kategorien: eventForm.kategorien,
      altersgruppen: eventForm.altersgruppen ? [eventForm.altersgruppen] : [],
      kontakt_email: eventForm.kontakt_email || null,
      status: "pending",
    });
    if (dbError) setError("Fehler: " + dbError.message);
    else setSuccess(true);
    setLoading(false);
  };

  const submitQuelle = async () => {
    if (!quelleForm.name || !quelleForm.url) {
      setError("Bitte fülle alle Pflichtfelder aus.");
      return;
    }
    if (!validateSpam()) return;
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
      <main className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center p-4">
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-md p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-kidgo-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Danke für deinen Beitrag!</h2>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            {tab === "event"
              ? "Dein Event wurde eingereicht und wird von uns geprüft. Nach Freischaltung erscheint es in der App."
              : "Deine Quellen-Empfehlung wird von uns geprüft — danke!"}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setSuccess(false);
                setSpamAnswer("");
                setEventForm({ titel: "", datum: "", datum_ende: "", ort: "", anmelde_link: "", beschreibung: "", preis_chf: "", kategorien: [], altersgruppen: "", kontakt_email: "" });
                setQuelleForm({ name: "", url: "", notizen: "", kontakt_email: "" });
              }}
              className="w-full py-2.5 bg-kidgo-500 text-white rounded-xl font-semibold text-sm hover:bg-kidgo-600 transition"
            >
              Weiteres einreichen
            </button>
            <Link href="/" className="block w-full py-2.5 bg-[var(--bg-subtle)] text-[var(--text-secondary)] rounded-xl font-medium text-sm hover:bg-[var(--border)] transition text-center">
              Zurück zur App
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 pb-24 md:pb-10">

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/" className="flex-shrink-0"><KidgoLogo size="sm" /></Link>
            <div className="h-4 w-px bg-[var(--border)]" />
            <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10L4 6l4-4"/></svg>
              Zurück
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Beitrag leisten</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">Kennst du ein tolles Kinder-Event oder eine gute Quelle? Teile es — wir prüfen und schalten es frei.</p>
        </header>

        {/* Tab toggle */}
        <div className="bg-[var(--bg-subtle)] rounded-2xl p-1 flex gap-1 mb-5 border border-[var(--border)]">
          <button
            onClick={() => { setTab("event"); setError(""); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${tab === "event" ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="2" width="12" height="11" rx="1.5"/><path d="M1 6h12M4 1v3M10 1v3"/>
            </svg>
            Event einreichen
          </button>
          <button
            onClick={() => { setTab("quelle"); setError(""); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${tab === "quelle" ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm border border-[var(--border)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="5"/><path d="M7 4v6M4 7h6"/>
            </svg>
            Quelle vorschlagen
          </button>
        </div>

        {/* Form card */}
        <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 sm:p-6 space-y-4">

          {tab === "event" ? (
            <>
              <Field label="Event-Titel" required>
                <input type="text" placeholder="z.B. Malkurs im Kunsthaus Zürich" value={eventForm.titel} onChange={(e) => setE("titel", e.target.value)} className={inputClass} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Startdatum">
                  <input type="date" value={eventForm.datum} onChange={(e) => setE("datum", e.target.value)} className={inputClass} />
                </Field>
                <Field label="Enddatum">
                  <input type="date" value={eventForm.datum_ende} onChange={(e) => setE("datum_ende", e.target.value)} className={inputClass} />
                </Field>
              </div>

              <Field label="Ort / Adresse" required>
                <input type="text" placeholder="z.B. Kunsthaus Zürich, Heimplatz 1" value={eventForm.ort} onChange={(e) => setE("ort", e.target.value)} className={inputClass} />
              </Field>

              <Field label="Kategorie">
                <div className="flex flex-wrap gap-2 mt-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCat(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                        eventForm.kategorien.includes(cat)
                          ? "bg-kidgo-500 text-white border-kidgo-500 shadow-sm"
                          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)] hover:border-kidgo-300 hover:text-kidgo-500"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Preis (CHF)">
                  <input type="number" placeholder="0 = kostenlos" min="0" value={eventForm.preis_chf} onChange={(e) => setE("preis_chf", e.target.value)} className={inputClass} />
                </Field>
                <Field label="Altersgruppe">
                  <input type="text" placeholder="z.B. 6–12 Jahre" value={eventForm.altersgruppen} onChange={(e) => setE("altersgruppen", e.target.value)} className={inputClass} />
                </Field>
              </div>

              <Field label="Website oder Anmelde-Link">
                <input type="url" placeholder="https://..." value={eventForm.anmelde_link} onChange={(e) => setE("anmelde_link", e.target.value)} className={inputClass} />
              </Field>

              <Field label="Beschreibung">
                <textarea placeholder="Kurze Beschreibung des Events..." rows={3} value={eventForm.beschreibung} onChange={(e) => setE("beschreibung", e.target.value)} className={inputClass} />
              </Field>

              <Field label="Deine E-Mail (optional)">
                <input type="email" placeholder="name@beispiel.ch" value={eventForm.kontakt_email} onChange={(e) => setE("kontakt_email", e.target.value)} className={inputClass} />
              </Field>
            </>
          ) : (
            <>
              <div className="bg-[var(--bg-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-secondary)] border border-[var(--border)]">
                Eine <strong className="text-[var(--text-primary)]">Quelle</strong> ist eine Organisation oder Website, die regelmässig Kinder-Events anbietet — z.B. ein Museum, eine Bibliothek oder ein Sportverein.
              </div>

              <Field label="Name der Organisation" required>
                <input type="text" placeholder="z.B. Stadtbibliothek Zürich" value={quelleForm.name} onChange={(e) => setQ("name", e.target.value)} className={inputClass} />
              </Field>

              <Field label="Website-URL" required>
                <input type="url" placeholder="https://..." value={quelleForm.url} onChange={(e) => setQ("url", e.target.value)} className={inputClass} />
              </Field>

              <Field label="Warum ist diese Quelle interessant?">
                <textarea placeholder="z.B. bietet monatliche Gratis-Workshops für Kinder ab 5 Jahren an..." rows={3} value={quelleForm.notizen} onChange={(e) => setQ("notizen", e.target.value)} className={inputClass} />
              </Field>

              <Field label="Deine E-Mail (optional)">
                <input type="email" placeholder="name@beispiel.ch" value={quelleForm.kontakt_email} onChange={(e) => setQ("kontakt_email", e.target.value)} className={inputClass} />
              </Field>
            </>
          )}

          {/* Spam protection */}
          <div className="bg-[var(--bg-subtle)] rounded-xl px-4 py-3 border border-[var(--border)]">
            <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Sicherheitsfrage
            </label>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono font-semibold text-[var(--text-primary)] bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1.5 rounded-lg">
                {mathQ.q} = ?
              </span>
              <input
                type="number"
                placeholder="Ergebnis"
                value={spamAnswer}
                onChange={(e) => setSpamAnswer(e.target.value)}
                className="w-24 px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-kidgo-300 transition"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
                <circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 11h.01"/>
              </svg>
              {error}
            </div>
          )}

          <button
            onClick={tab === "event" ? submitEvent : submitQuelle}
            disabled={loading}
            className="w-full py-3 bg-kidgo-500 text-white rounded-xl font-semibold text-sm hover:bg-kidgo-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2a6 6 0 0 1 6 6"/></svg>
                Wird eingereicht...
              </>
            ) : "Einreichen"}
          </button>
        </div>

        <p className="text-center text-xs text-[var(--text-muted)] mt-4">
          Alle Einreichungen werden von unserem Team geprüft. Nur freigeschaltete Events erscheinen in der App.
        </p>
      </div>
    </main>
  );
}

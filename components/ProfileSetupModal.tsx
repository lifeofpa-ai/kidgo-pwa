"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";
import { INTERESTS } from "@/lib/interests";

const AGE_BUCKETS = [
  { key: "0-3",   label: "0–3 Jahre" },
  { key: "4-6",   label: "4–6 Jahre" },
  { key: "7-9",   label: "7–9 Jahre" },
  { key: "10-12", label: "10–12 Jahre" },
];

interface Child {
  name: string;
  age_bucket: string;
}

interface Props {
  onComplete: () => void;
}

// SVG icons for each interest — one per id
function InterestIcon({ id, selected }: { id: string; selected: boolean }) {
  const stroke = selected ? "white" : "var(--accent)";
  const w = 28;
  const sw = 1.6;
  switch (id) {
    case "sport":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="14" cy="6" r="2.5"/>
          <path d="M14 9v7l-4 5M14 16l4 5"/>
          <path d="M9 13h10"/>
        </svg>
      );
    case "kreativ":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 21l3-3 9-9-3-3-9 9-3 3h3z"/>
          <path d="M18 4l3 3"/>
          <circle cx="22" cy="22" r="2"/>
          <path d="M19 22a3 3 0 0 0-3-3"/>
        </svg>
      );
    case "musik":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 20V8l12-3v12"/>
          <circle cx="8" cy="20" r="2"/>
          <circle cx="20" cy="17" r="2"/>
        </svg>
      );
    case "theater":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7h7l-3.5 8a5 5 0 0 1-3.5-8z"/>
          <path d="M16 7h7a5 5 0 0 1-3.5 8L16 7z"/>
          <path d="M11.5 22a5 5 0 0 0 5 0"/>
        </svg>
      );
    case "natur":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 22V14"/>
          <path d="M6 14c0-4.4 3.6-8 8-8s8 3.6 8 8H6z"/>
          <path d="M10 14c0-2.2 1.8-4 4-4"/>
        </svg>
      );
    case "wissen":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22h20"/>
          <rect x="8" y="10" width="5" height="12" rx="0.5"/>
          <rect x="15" y="6" width="5" height="16" rx="0.5"/>
          <path d="M6 10V7l2-1"/>
        </svg>
      );
    case "schwimmen":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2"/>
          <path d="M4 21c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2"/>
          <path d="M9 13l3-4 4 2 3-4"/>
          <circle cx="20" cy="8" r="1.5" fill={stroke}/>
        </svg>
      );
    case "camp":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 5L4 22h20L14 5z"/>
          <path d="M10 22v-5a4 4 0 0 1 8 0v5"/>
          <path d="M4 22h20"/>
        </svg>
      );
    case "indoor":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12L14 4l10 8"/>
          <path d="M8 12v10h12V12"/>
          <path d="M11 22v-5h6v5"/>
          <circle cx="20" cy="9" r="2"/>
          <path d="M19 11v4"/>
        </svg>
      );
    case "kochen":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 14h12v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-4z"/>
          <path d="M6 14h16"/>
          <path d="M10 14V10a1 1 0 0 1 2 0M14 14V9a1 1 0 0 1 2 0M18 14v-3a1 1 0 0 1 2 0"/>
          <path d="M12 22v1M16 22v1"/>
        </svg>
      );
    case "zirkus":
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 4l2.4 4.9 5.4.8-3.9 3.8.9 5.3L14 16.2l-4.8 2.6.9-5.3L6.2 9.7l5.4-.8z"/>
        </svg>
      );
    default:
      return (
        <svg width={w} height={w} viewBox="0 0 28 28" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="14" cy="14" r="9"/>
        </svg>
      );
  }
}

export function ProfileSetupModal({ onComplete }: Props) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep]                 = useState<"profile" | "interests">("profile");
  const [displayName, setDisplayName]   = useState("");
  const [children, setChildren]         = useState<Child[]>([{ name: "", age_bucket: "4-6" }]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [saving, setSaving]             = useState(false);

  const addChild = () => setChildren((prev) => [...prev, { name: "", age_bucket: "4-6" }]);
  const removeChild = (i: number) => setChildren((prev) => prev.filter((_, idx) => idx !== i));
  const updateChild = (i: number, field: keyof Child, value: string) =>
    setChildren((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const save = async (interests: string[]) => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    const validChildren = children.filter((c) => c.name.trim().length > 0);
    const { error } = await supabase.from("user_profiles").upsert({
      user_id: user.id,
      display_name: displayName.trim() || null,
      children: validChildren,
      interests: interests.length > 0 ? interests : null,
    });
    if (!error) await refreshProfile();
    setSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Step indicator */}
        <div className="flex gap-1.5 px-6 pt-5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors duration-300"
              style={{
                backgroundColor:
                  (i === 0 && step === "profile") || (i === 1 && step === "interests")
                    ? "var(--accent)"
                    : i === 0 && step === "interests"
                    ? "var(--accent)"
                    : "var(--border)",
              }}
            />
          ))}
        </div>

        {/* ── Step 1: Profile ── */}
        {step === "profile" && (
          <div className="p-6">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
              Willkommen bei Kidgo
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Sag uns kurz, wie du heisst und wie alt deine Kinder sind.
            </p>

            {/* Display name */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-1.5 block">
                Dein Name (optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="z.B. Sandra"
                className="w-full border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] transition"
              />
            </div>

            {/* Children */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] mb-2 block">
                Deine Kinder
              </label>
              <div className="space-y-2">
                {children.map((child, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={child.name}
                      onChange={(e) => updateChild(i, "name", e.target.value)}
                      placeholder={`Kind ${i + 1}`}
                      className="flex-1 border border-[var(--border)] rounded-xl px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 focus:border-[var(--accent)] transition"
                    />
                    <select
                      value={child.age_bucket}
                      onChange={(e) => updateChild(i, "age_bucket", e.target.value)}
                      className="border border-[var(--border)] rounded-xl px-2 py-2 text-sm bg-[var(--bg-input)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition"
                    >
                      {AGE_BUCKETS.map((b) => (
                        <option key={b.key} value={b.key}>{b.label}</option>
                      ))}
                    </select>
                    {children.length > 1 && (
                      <button
                        onClick={() => removeChild(i)}
                        aria-label="Kind entfernen"
                        className="text-[var(--text-muted)] hover:text-red-400 transition w-7 h-7 flex items-center justify-center"
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M2 2l10 10M12 2L2 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {children.length < 4 && (
                <button
                  onClick={addChild}
                  className="mt-2 text-xs text-[var(--accent)] hover:opacity-80 font-semibold transition"
                >
                  + Weiteres Kind
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={onComplete}
                className="flex-1 border border-[var(--border)] rounded-xl py-2.5 text-sm text-[var(--text-muted)] hover:border-[var(--border-strong)] transition"
              >
                Überspringen
              </button>
              <button
                onClick={() => setStep("interests")}
                className="flex-1 bg-[var(--accent)] text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-1.5"
              >
                Weiter
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 11l4-4-4-4"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Interests ── */}
        {step === "interests" && (
          <div className="p-6">
            <button
              onClick={() => setStep("profile")}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition mb-4"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11L5 7l4-4"/>
              </svg>
              Zurück
            </button>

            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-1">
              Was interessiert euch?
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-5">
              Wähle mindestens 2 aus — wir passen deine Empfehlungen an.
            </p>

            {/* Interest grid */}
            <div className="grid grid-cols-3 gap-2 mb-5 max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {INTERESTS.map((interest) => {
                const selected = selectedInterests.includes(interest.id);
                return (
                  <button
                    key={interest.id}
                    onClick={() => toggleInterest(interest.id)}
                    aria-pressed={selected}
                    className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 active:scale-95 min-h-[88px] ${
                      selected
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white shadow-md"
                        : "bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:bg-[var(--accent-light)]"
                    }`}
                  >
                    {/* Checkmark */}
                    {selected && (
                      <span className="absolute top-2 right-2 w-4 h-4 bg-white/25 rounded-full flex items-center justify-center">
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 5l2.5 2.5 4-4"/>
                        </svg>
                      </span>
                    )}
                    <InterestIcon id={interest.id} selected={selected} />
                    <span className="text-xs font-semibold leading-tight text-center">{interest.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selection count */}
            <p className="text-xs text-[var(--text-muted)] text-center mb-4">
              {selectedInterests.length === 0
                ? "Noch nichts ausgewählt"
                : `${selectedInterests.length} ausgewählt${selectedInterests.length < 2 ? " — noch " + (2 - selectedInterests.length) + " weitere" : ""}`}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => save([])}
                disabled={saving}
                className="flex-1 border border-[var(--border)] rounded-xl py-2.5 text-sm text-[var(--text-muted)] hover:border-[var(--border-strong)] transition disabled:opacity-50"
              >
                Überspringen
              </button>
              <button
                onClick={() => save(selectedInterests)}
                disabled={saving || selectedInterests.length < 2}
                className="flex-1 bg-[var(--accent)] text-white rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Speichern…" : "Fertig"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

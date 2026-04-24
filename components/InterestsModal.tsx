"use client";
import { useState, useEffect } from "react";
import { INTERESTS } from "@/lib/interests";

interface InterestsModalProps {
  onComplete: (interests: string[]) => void;
  onSkip?: () => void;
}

export function InterestsModal({ onComplete, onSkip }: InterestsModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    try { localStorage.setItem("kidgo_interests", JSON.stringify(selected)); } catch {}
    onComplete(selected);
  };

  const handleSkip = () => {
    try { localStorage.setItem("kidgo_interests", JSON.stringify([])); } catch {}
    onSkip?.();
    onComplete([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleSkip} />

      <div className="relative bg-white dark:bg-[#1e2221] rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Was interessiert euch?
          </h2>
          <p className="text-sm text-gray-400 mb-5">
            Wähle mindestens 2 — wir zeigen passende Events zuerst
          </p>

          <div className="grid grid-cols-2 gap-2.5 max-h-[52vh] overflow-y-auto -mx-1 px-1 pb-1" style={{ scrollbarWidth: "none" }}>
            {INTERESTS.map((interest) => {
              const active = selected.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  onClick={() => toggle(interest.id)}
                  className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all active:scale-95 ${
                    active
                      ? "bg-[#5BBAA7] border-[#5BBAA7] text-white shadow-md"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-[#5BBAA7]/40"
                  }`}
                >
                  {active && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-white/30 rounded-full flex items-center justify-center">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1.5 4L3.5 6 6.5 2"/>
                      </svg>
                    </span>
                  )}
                  <span className="text-sm font-semibold leading-tight">{interest.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          <button
            onClick={handleSkip}
            className="flex-shrink-0 text-sm text-gray-400 hover:text-gray-600 px-4 py-3 transition"
          >
            Überspringen
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.length < 2}
            className="flex-1 bg-[#5BBAA7] text-white py-3 rounded-2xl font-bold text-sm hover:bg-[#4da896] transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            {selected.length < 2
              ? `Noch ${2 - selected.length} auswählen`
              : `${selected.length} Interessen speichern`}
          </button>
        </div>
      </div>
    </div>
  );
}

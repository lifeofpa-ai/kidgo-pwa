"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useAuth } from "@/lib/auth-context";

const AGE_BUCKETS = [
  { key: "0-3", label: "0–3 Jahre", emoji: "👶" },
  { key: "4-6", label: "4–6 Jahre", emoji: "🧒" },
  { key: "7-9", label: "7–9 Jahre", emoji: "🏃" },
  { key: "10-12", label: "10–12 Jahre", emoji: "🔭" },
];

interface Child {
  name: string;
  age_bucket: string;
}

interface Props {
  onComplete: () => void;
}

export function ProfileSetupModal({ onComplete }: Props) {
  const { user, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [children, setChildren] = useState<Child[]>([{ name: "", age_bucket: "4-6" }]);
  const [saving, setSaving] = useState(false);

  const addChild = () => {
    setChildren((prev) => [...prev, { name: "", age_bucket: "4-6" }]);
  };

  const removeChild = (index: number) => {
    setChildren((prev) => prev.filter((_, i) => i !== index));
  };

  const updateChild = (index: number, field: keyof Child, value: string) => {
    setChildren((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const supabase = createClient();
    const validChildren = children.filter((c) => c.name.trim().length > 0);

    const { error } = await supabase.from("user_profiles").upsert({
      user_id: user.id,
      display_name: displayName.trim() || null,
      children: validChildren,
    });

    if (!error) {
      await refreshProfile();
      onComplete();
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="text-2xl mb-2">👋</div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
          Willkommen bei Kidgo!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Sag uns kurz, wie du heisst und wie alt deine Kinder sind — damit wir
          passende Events zeigen können.
        </p>

        {/* Display name */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">
            Dein Name / Alias (optional)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="z.B. Sandra"
            className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kidgo-300"
          />
        </div>

        {/* Children */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2 block">
            Deine Kinder
          </label>
          <div className="space-y-2">
            {children.map((child, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={child.name}
                  onChange={(e) => updateChild(i, "name", e.target.value)}
                  placeholder={`Kind ${i + 1} Name`}
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kidgo-300"
                />
                <select
                  value={child.age_bucket}
                  onChange={(e) => updateChild(i, "age_bucket", e.target.value)}
                  className="border border-gray-200 dark:border-gray-600 rounded-xl px-2 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-kidgo-300"
                >
                  {AGE_BUCKETS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.emoji} {b.label}
                    </option>
                  ))}
                </select>
                {children.length > 1 && (
                  <button
                    onClick={() => removeChild(i)}
                    className="text-gray-400 hover:text-red-400 transition text-lg leading-none"
                    aria-label="Kind entfernen"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {children.length < 4 && (
            <button
              onClick={addChild}
              className="mt-2 text-xs text-kidgo-500 hover:text-kidgo-600 font-medium transition"
            >
              + Weiteres Kind hinzufügen
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={onComplete}
            className="flex-1 border border-gray-200 dark:border-gray-600 rounded-xl py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:border-gray-300 transition"
          >
            Überspringen
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-kidgo-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-kidgo-600 transition disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}

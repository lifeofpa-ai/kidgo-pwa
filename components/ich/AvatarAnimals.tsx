"use client";

export interface AnimalDef {
  id: string;
  label: string;
  color: string;
}

export const ANIMALS: AnimalDef[] = [
  { id: "fuchs", label: "Fuchs", color: "#F97316" },
  { id: "eule", label: "Eule", color: "#D97706" },
  { id: "baer", label: "Bär", color: "#92400E" },
  { id: "hase", label: "Hase", color: "#EC4899" },
  { id: "igel", label: "Igel", color: "#78716C" },
  { id: "schmetterling", label: "Schmetterling", color: "#7C3AED" },
];

function FoxSVG() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="10,21 7,5 18,14" fill="#F97316" />
      <polygon points="30,21 33,5 22,14" fill="#F97316" />
      <polygon points="10.5,19.5 8.5,8 16.5,14" fill="#FBBF9A" />
      <polygon points="29.5,19.5 31.5,8 23.5,14" fill="#FBBF9A" />
      <circle cx="20" cy="23" r="13" fill="#F97316" />
      <ellipse cx="20" cy="27.5" rx="7.5" ry="6.5" fill="#FCD9A8" />
      <circle cx="15.5" cy="21" r="2.8" fill="white" />
      <circle cx="24.5" cy="21" r="2.8" fill="white" />
      <circle cx="16" cy="21.5" r="1.6" fill="#1C1917" />
      <circle cx="25" cy="21.5" r="1.6" fill="#1C1917" />
      <circle cx="16.5" cy="21" r="0.6" fill="white" />
      <circle cx="25.5" cy="21" r="0.6" fill="white" />
      <ellipse cx="20" cy="27" rx="2.2" ry="1.8" fill="#7C2D12" />
      <path d="M18 29 Q20 30.5 22 29" stroke="#7C2D12" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function OwlSVG() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14,13 L11,3 L18,10 Z" fill="#92400E" />
      <path d="M26,13 L29,3 L22,10 Z" fill="#92400E" />
      <ellipse cx="20" cy="28" rx="12" ry="11" fill="#B45309" />
      <circle cx="20" cy="17" r="13" fill="#D97706" />
      <ellipse cx="20" cy="31" rx="8" ry="7" fill="#FEF3C7" />
      <circle cx="14.5" cy="17" r="5.5" fill="#FEF3C7" />
      <circle cx="25.5" cy="17" r="5.5" fill="#FEF3C7" />
      <circle cx="14.5" cy="17" r="3.8" fill="#1C1917" />
      <circle cx="25.5" cy="17" r="3.8" fill="#1C1917" />
      <circle cx="14.5" cy="17" r="1.8" fill="#78350F" />
      <circle cx="25.5" cy="17" r="1.8" fill="#78350F" />
      <circle cx="14.5" cy="17" r="0.8" fill="#1C1917" />
      <circle cx="25.5" cy="17" r="0.8" fill="#1C1917" />
      <circle cx="15" cy="16.3" r="0.7" fill="white" />
      <circle cx="26" cy="16.3" r="0.7" fill="white" />
      <polygon points="18,21 20,24 22,21 20,22.5" fill="#F59E0B" />
    </svg>
  );
}

function BearSVG() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="12" r="6" fill="#92400E" />
      <circle cx="29" cy="12" r="6" fill="#92400E" />
      <circle cx="11" cy="12" r="3.5" fill="#B45309" />
      <circle cx="29" cy="12" r="3.5" fill="#B45309" />
      <circle cx="20" cy="23" r="15" fill="#92400E" />
      <ellipse cx="20" cy="28" rx="7.5" ry="6" fill="#B45309" />
      <circle cx="14.5" cy="21" r="2.5" fill="#1C1917" />
      <circle cx="25.5" cy="21" r="2.5" fill="#1C1917" />
      <circle cx="15" cy="20.5" r="0.8" fill="white" />
      <circle cx="26" cy="20.5" r="0.8" fill="white" />
      <ellipse cx="20" cy="26.5" rx="2.5" ry="2" fill="#1C1917" />
      <path d="M17.5 29 Q20 31 22.5 29" stroke="#1C1917" strokeWidth="1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function RabbitSVG() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="13.5" cy="9" rx="4" ry="11" fill="#FCE7F3" />
      <ellipse cx="26.5" cy="9" rx="4" ry="11" fill="#FCE7F3" />
      <ellipse cx="13.5" cy="9" rx="2" ry="8.5" fill="#FBCFE8" />
      <ellipse cx="26.5" cy="9" rx="2" ry="8.5" fill="#FBCFE8" />
      <circle cx="20" cy="25" r="13" fill="#FCE7F3" />
      <circle cx="15" cy="23" r="2.5" fill="#1C1917" />
      <circle cx="25" cy="23" r="2.5" fill="#1C1917" />
      <circle cx="15.5" cy="22.5" r="0.8" fill="white" />
      <circle cx="25.5" cy="22.5" r="0.8" fill="white" />
      <ellipse cx="20" cy="27.5" rx="2.2" ry="1.8" fill="#EC4899" />
      <path d="M20 27.5 L20 29.5" stroke="#EC4899" strokeWidth="1" strokeLinecap="round" />
      <path d="M18.5 29.5 Q20 31 21.5 29.5" stroke="#EC4899" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <ellipse cx="13.5" cy="27.5" rx="3.5" ry="2.5" fill="#FBCFE8" opacity="0.6" />
      <ellipse cx="26.5" cy="27.5" rx="3.5" ry="2.5" fill="#FBCFE8" opacity="0.6" />
    </svg>
  );
}

function HedgehogSVG() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12,22 Q12,14 13,12 L15,16 Q17,10 19,9 L19.5,14 Q21,8 22.5,9 L23,14 Q25,10 27,12 L27,18 Q23,16 20,16 Q16,16 12,22 Z"
        fill="#78716C"
      />
      <circle cx="20" cy="26" r="11" fill="#A8A29E" />
      <ellipse cx="20" cy="28" rx="7.5" ry="6.5" fill="#E7E5E4" />
      <circle cx="16" cy="24" r="2" fill="#1C1917" />
      <circle cx="24" cy="24" r="2" fill="#1C1917" />
      <circle cx="16.5" cy="23.5" r="0.7" fill="white" />
      <circle cx="24.5" cy="23.5" r="0.7" fill="white" />
      <ellipse cx="20" cy="27.5" rx="1.8" ry="1.4" fill="#57534E" />
    </svg>
  );
}

function ButterflySVG() {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="11" cy="15" rx="9" ry="8" fill="#7C3AED" transform="rotate(-15 11 15)" />
      <ellipse cx="29" cy="15" rx="9" ry="8" fill="#5BBAA7" transform="rotate(15 29 15)" />
      <ellipse cx="12" cy="27" rx="7" ry="5.5" fill="#A78BFA" transform="rotate(15 12 27)" />
      <ellipse cx="28" cy="27" rx="7" ry="5.5" fill="#7CCBB9" transform="rotate(-15 28 27)" />
      <ellipse cx="11" cy="14" rx="4" ry="3.5" fill="#DDD6FE" opacity="0.6" transform="rotate(-15 11 14)" />
      <ellipse cx="29" cy="14" rx="4" ry="3.5" fill="#CCFBF1" opacity="0.6" transform="rotate(15 29 14)" />
      <ellipse cx="20" cy="21" rx="2.2" ry="8.5" fill="#374151" />
      <circle cx="20" cy="12" r="2" fill="#374151" />
      <path d="M20 12 Q16 6 14 4" stroke="#374151" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M20 12 Q24 6 26 4" stroke="#374151" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="14" cy="4" r="1.5" fill="#7C3AED" />
      <circle cx="26" cy="4" r="1.5" fill="#5BBAA7" />
    </svg>
  );
}

export function AnimalSVG({ id }: { id: string }) {
  switch (id) {
    case "fuchs": return <FoxSVG />;
    case "eule": return <OwlSVG />;
    case "baer": return <BearSVG />;
    case "hase": return <RabbitSVG />;
    case "igel": return <HedgehogSVG />;
    case "schmetterling": return <ButterflySVG />;
    default: return null;
  }
}

export function getUserAvatarId(): string | null {
  try {
    const raw = localStorage.getItem("user_preferences");
    if (!raw) return null;
    return JSON.parse(raw)?.avatar ?? null;
  } catch { return null; }
}

export function saveUserAvatarId(id: string): void {
  try {
    const raw = localStorage.getItem("user_preferences");
    const current = raw ? JSON.parse(raw) : {};
    localStorage.setItem("user_preferences", JSON.stringify({ ...current, avatar: id }));
  } catch {}
}

interface AvatarPickerProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function AvatarPicker({ selectedId, onSelect, onClose }: AvatarPickerProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-5 bg-[var(--bg-card)]"
        style={{
          border: "1px solid rgba(91,186,167,0.35)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-[var(--text-primary)] text-base">Avatar wählen</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Welches Tier passt zu eurer Familie?</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l8 8M9 1l-8 8" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {ANIMALS.map((animal) => {
            const active = selectedId === animal.id;
            return (
              <button
                key={animal.id}
                onClick={() => { onSelect(animal.id); onClose(); }}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 active:scale-95 ${
                  active
                    ? "border-[#5BBAA7] bg-[rgba(91,186,167,0.08)]"
                    : "border-transparent bg-[var(--bg-subtle)] hover:border-[rgba(91,186,167,0.4)]"
                }`}
              >
                {active && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#5BBAA7] flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4l2 2 4-4" />
                    </svg>
                  </div>
                )}
                <div className="w-12 h-12">
                  <AnimalSVG id={animal.id} />
                </div>
                <span className={`text-xs font-semibold ${active ? "text-[#5BBAA7]" : "text-[var(--text-secondary)]"}`}>
                  {animal.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

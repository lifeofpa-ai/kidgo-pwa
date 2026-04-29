"use client";

export function ChatFAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Frag Kidgo"
      className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90 hover:scale-105 hover:shadow-xl"
      style={{
        background: "linear-gradient(135deg, #5BBAA7 0%, #4A9E8E 100%)",
        boxShadow: "0 4px 20px rgba(91,186,167,0.45)",
      }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5h14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8l-4 4V6a1 1 0 0 1 1-1z"/>
      </svg>
    </button>
  );
}

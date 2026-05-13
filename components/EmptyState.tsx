"use client";

import Link from "next/link";

type EmptyType = "no-events" | "network-error" | "not-found" | "bookmarks-empty";

interface EmptyStateProps {
  type?: EmptyType;
  title?: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  actionHref?: string;
  className?: string;
}

function CalendarIllustration() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <rect x="8" y="14" width="40" height="34" rx="5" fill="#5BBAA7" fillOpacity="0.15" stroke="#5BBAA7" strokeWidth="1.5"/>
      <rect x="8" y="14" width="40" height="10" rx="5" fill="#5BBAA7" fillOpacity="0.3"/>
      <rect x="8" y="19" width="40" height="5" fill="#5BBAA7" fillOpacity="0.3"/>
      <line x1="19" y1="10" x2="19" y2="18" stroke="#5BBAA7" strokeWidth="2" strokeLinecap="round"/>
      <line x1="37" y1="10" x2="37" y2="18" stroke="#5BBAA7" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="21" cy="34" r="2.5" fill="#5BBAA7" fillOpacity="0.4"/>
      <circle cx="28" cy="34" r="2.5" fill="#5BBAA7" fillOpacity="0.4"/>
      <circle cx="35" cy="34" r="2.5" fill="#5BBAA7" fillOpacity="0.4"/>
      <circle cx="21" cy="41" r="2.5" fill="#5BBAA7" fillOpacity="0.3"/>
      <circle cx="28" cy="41" r="2.5" fill="#5BBAA7" fillOpacity="0.3"/>
      <path d="M39 44l4 4m0 0l4-4m-4 4V36" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.5"/>
    </svg>
  );
}

function NetworkErrorIllustration() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <path d="M12 28c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4"/>
      <path d="M18 34c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6"/>
      <circle cx="28" cy="40" r="3" fill="#5BBAA7"/>
      <path d="M6 10l44 36" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6"/>
    </svg>
  );
}

function NotFoundIllustration() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <path d="M28 8C19.163 8 12 15.163 12 24c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" fill="#5BBAA7" fillOpacity="0.15" stroke="#5BBAA7" strokeWidth="1.5"/>
      <circle cx="28" cy="24" r="5" fill="#5BBAA7" fillOpacity="0.5"/>
      <text x="27" y="27" textAnchor="middle" fontFamily="system-ui" fontWeight="700" fontSize="7" fill="#5BBAA7">?</text>
    </svg>
  );
}

function BookmarksEmptyIllustration() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <path d="M16 10h24a3 3 0 0 1 3 3v30l-15-8-15 8V13a3 3 0 0 1 3-3z" fill="#5BBAA7" fillOpacity="0.15" stroke="#5BBAA7" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M22 26h12M28 20v12" stroke="#5BBAA7" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

const CONFIGS: Record<EmptyType, { illustration: React.ReactNode; title: string; message: string }> = {
  "no-events": {
    illustration: <CalendarIllustration />,
    title: "Keine Events gefunden",
    message: "Schau später nochmal oder erweitere deine Filter.",
  },
  "network-error": {
    illustration: <NetworkErrorIllustration />,
    title: "Verbindung unterbrochen",
    message: "Bitte überprüfe deine Internetverbindung.",
  },
  "not-found": {
    illustration: <NotFoundIllustration />,
    title: "Nicht gefunden",
    message: "Diese Seite existiert leider nicht.",
  },
  "bookmarks-empty": {
    illustration: <BookmarksEmptyIllustration />,
    title: "Noch keine gespeicherten Events",
    message: "Merke interessante Events mit dem Herz-Button.",
  },
};

export function EmptyState({
  type = "no-events",
  title,
  message,
  action,
  actionHref,
  className = "",
}: EmptyStateProps) {
  const cfg = CONFIGS[type];

  return (
    <div className={`text-center py-14 px-6 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] ${className}`}>
      <div className="empty-float mx-auto mb-5 w-20 h-20 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center">
        {cfg.illustration}
      </div>
      <p className="font-bold text-[var(--text-primary)] text-base mb-1.5">
        {title ?? cfg.title}
      </p>
      <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xs mx-auto">
        {message ?? cfg.message}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 bg-[var(--accent)] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition active:scale-95"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1v6m0 0l-3-3m3 3l3-3M1 10h12"/>
          </svg>
          {action.label}
        </button>
      )}
      {!action && actionHref && (
        <Link
          href={actionHref}
          className="inline-block bg-[var(--accent)] text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition active:scale-95"
        >
          Alle Events entdecken
        </Link>
      )}
    </div>
  );
}

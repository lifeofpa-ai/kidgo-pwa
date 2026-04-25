"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const tabs = [
    {
      href: "/",
      label: "Entdecken",
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10L11 3l8 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9z"/>
          <path d="M8 21V13h6v8"/>
        </svg>
      ),
    },
    {
      href: "/explore",
      label: "Suchen",
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="10" cy="10" r="7"/>
          <path d="M19 19l-4-4"/>
        </svg>
      ),
    },
    {
      href: "/bookmarks",
      label: "Merkliste",
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 3h12a1 1 0 0 1 1 1v15.5l-7-4-7 4V4a1 1 0 0 1 1-1z"/>
        </svg>
      ),
    },
    {
      href: "/badges",
      label: "Erfolge",
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="9" r="5"/>
          <path d="M7.5 14.5L11 20l3.5-5.5"/>
        </svg>
      ),
    },
    {
      href: "/dashboard",
      label: "Profil",
      icon: (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="8" r="3.5"/>
          <path d="M3 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Hauptnavigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-[#1e2221]/95 backdrop-blur-md border-t border-[var(--border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-14 max-w-2xl mx-auto">
        {tabs.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-2 relative transition-colors duration-200 ${
                active
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {icon}
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
                  style={{ background: "linear-gradient(to right, #5BBAA7, #4A9E8E)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

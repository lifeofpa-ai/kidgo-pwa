"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KidgoLogo } from "@/components/KidgoLogo";

const tabs = [
  {
    href: "/",
    label: "Entdecken",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10L11 3l8 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9z"/>
        <path d="M8 21V13h6v8"/>
      </svg>
    ),
  },
  {
    href: "/explore",
    label: "Suchen",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="10" r="7"/>
        <path d="M19 19l-4-4"/>
      </svg>
    ),
  },
  {
    href: "/bookmarks",
    label: "Merkliste",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 3h12a1 1 0 0 1 1 1v15.5l-7-4-7 4V4a1 1 0 0 1 1-1z"/>
      </svg>
    ),
  },
  {
    href: "/badges",
    label: "Erfolge",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="9" r="5"/>
        <path d="M7.5 14.5L11 20l3.5-5.5"/>
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Profil",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="8" r="3.5"/>
        <path d="M3 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
      </svg>
    ),
  },
];

export function DesktopSideNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      aria-label="Seitennavigation"
      className="hidden md:flex flex-col fixed left-0 top-0 h-full w-56 z-40 border-r border-[var(--border)] bg-white/95 dark:bg-[#1e2221]/95 backdrop-blur-md hex-texture"
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-[var(--border)]">
        <Link href="/" aria-label="Startseite">
          <KidgoLogo size="sm" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 flex-1">
        {tabs.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                active
                  ? "text-[var(--text-primary)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              {active && (
                <span
                  className="absolute left-3 top-2.5 bottom-2.5 w-0.5 rounded-full"
                  style={{ background: "linear-gradient(to bottom, #5BBAA7, #4A9E8E)" }}
                  aria-hidden="true"
                />
              )}
              <span className={`transition-colors ${active ? "text-[var(--kidgo-teal)]" : "group-hover:text-[var(--kidgo-teal)]"}`}>
                {icon}
              </span>
              <span className="text-sm">{label}</span>
              {active && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #5BBAA7, #4A9E8E)" }}
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t border-[var(--border)]">
        <p className="text-[10px] text-[var(--text-muted)] text-center">Kidgo · Zürich</p>
      </div>
    </aside>
  );
}

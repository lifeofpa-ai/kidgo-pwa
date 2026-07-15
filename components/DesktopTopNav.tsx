"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KidgoLogo } from "@/components/KidgoLogo";

// Same 5 destinations/icons as the old DesktopSideNav — only the layout
// changes (horizontal top bar instead of fixed left rail), per the UX
// sprint decision to move the side menu to a horizontal top nav.
const tabs = [
  {
    href: "/",
    label: "Entdecken",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10L11 3l8 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9z" />
        <path d="M8 21V13h6v8" />
      </svg>
    ),
  },
  {
    href: "/explore",
    label: "Suchen",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="10" cy="10" r="7" />
        <path d="M19 19l-4-4" />
      </svg>
    ),
  },
  {
    href: "/bookmarks",
    label: "Merkliste",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 3h12a1 1 0 0 1 1 1v15.5l-7-4-7 4V4a1 1 0 0 1 1-1z" />
      </svg>
    ),
  },
  {
    href: "/badges",
    label: "Erfolge",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="9" r="5" />
        <path d="M7.5 14.5L11 20l3.5-5.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard",
    label: "Profil",
    icon: (
      <svg width="20" height="20" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="8" r="3.5" />
        <path d="M3 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      </svg>
    ),
  },
];

export function DesktopTopNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      aria-label="Hauptnavigation"
      className="hidden md:flex items-center fixed top-0 inset-x-0 z-40 h-16 border-b border-[var(--border)] bg-white/95 dark:bg-[#1e2221]/95 backdrop-blur-md hex-texture px-5 gap-2"
    >
      {/* Logo */}
      <Link href="/" aria-label="Startseite" className="flex items-center gap-2 mr-6 flex-shrink-0">
        <KidgoLogo size="sm" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Kidgo</span>
      </Link>

      {/* Navigation */}
      <nav className="flex items-center gap-1 flex-1">
        {tabs.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-200 group ${
                active
                  ? "text-[var(--text-primary)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              <span className={`transition-colors ${active ? "text-[var(--kidgo-teal)]" : "group-hover:text-[var(--kidgo-teal)]"}`}>
                {icon}
              </span>
              <span className="text-sm">{label}</span>
              {active && (
                <span
                  className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full"
                  style={{ background: "linear-gradient(to right, #5BBAA7, #4A9E8E)" }}
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Tagline — same spot the sidebar footer occupied, hidden on narrower desktop widths */}
      <p className="text-[10px] text-[var(--text-muted)] hidden lg:block flex-shrink-0">Kidgo · Zürich</p>
    </header>
  );
}

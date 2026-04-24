"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const tabCls = (href: string) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors ${
      isActive(href) ? "text-[#5BBAA7]" : "text-gray-400 hover:text-gray-500"
    }`;

  return (
    <nav
      aria-label="Hauptnavigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 dark:bg-[#1e2221]/95 backdrop-blur-md border-t border-gray-100 dark:border-gray-800"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-14 max-w-2xl mx-auto">

        <Link href="/" className={tabCls("/")} aria-label="Entdecken">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10L11 3l8 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9z"/>
            <path d="M8 21V13h6v8"/>
          </svg>
          <span className="text-[10px] font-medium">Entdecken</span>
        </Link>

        <Link href="/explore" className={tabCls("/explore")} aria-label="Suchen">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="7"/>
            <path d="M19 19l-4-4"/>
          </svg>
          <span className="text-[10px] font-medium">Suchen</span>
        </Link>

        <Link href="/bookmarks" className={tabCls("/bookmarks")} aria-label="Merkliste">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 3h12a1 1 0 0 1 1 1v15.5l-7-4-7 4V4a1 1 0 0 1 1-1z"/>
          </svg>
          <span className="text-[10px] font-medium">Merkliste</span>
        </Link>

        <Link href="/dashboard" className={tabCls("/dashboard")} aria-label="Profil">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="8" r="3.5"/>
            <path d="M3 20c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
          </svg>
          <span className="text-[10px] font-medium">Profil</span>
        </Link>

      </div>
    </nav>
  );
}

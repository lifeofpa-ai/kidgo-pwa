import Link from "next/link";
import { KidgoLogo } from "@/components/KidgoLogo";

export function KidgoFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-page)] pb-24 md:pb-0">
      <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KidgoLogo size="xs" />
          <span className="text-xs text-[var(--text-muted)] font-medium">Kidgo · Zürich</span>
        </div>
        <nav className="flex items-center gap-4 text-xs" aria-label="Footer">
          <Link
            href="/impressum"
            className="text-[var(--kidgo-teal)] hover:text-[var(--kidgo-teal-dark)] transition-colors duration-200"
          >
            Impressum
          </Link>
          <Link
            href="/datenschutz"
            className="text-[var(--kidgo-teal)] hover:text-[var(--kidgo-teal-dark)] transition-colors duration-200"
          >
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  );
}

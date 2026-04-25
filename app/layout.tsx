import type { Metadata } from "next";
import Script from "next/script";
import { Nunito } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { BottomNav } from "@/components/BottomNav";
import { DesktopSideNav } from "@/components/DesktopSideNav";
import { KidgoFooter } from "@/components/KidgoFooter";
import { PageTransitionWrapper } from "@/components/PageTransitionWrapper";
import { SwipeBackGate } from "@/components/SwipeBackGate";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Kidgo – Events & Aktivitäten für Kinder in der Schweiz",
  description: "Entdecke die besten Events, Kurse und Ausflüge für Kinder in der Region Zürich. Täglich aktuell, kostenlos und einfach filterbar.",
  keywords: ["Kinder", "Events", "Zürich", "Aktivitäten", "Familie", "Ausflug", "Feriencamp", "Schweiz"],
  openGraph: {
    title: "Kidgo – Events für Kinder",
    description: "Die besten Kinder-Events & Aktivitäten in der Region Zürich. Jetzt entdecken!",
    url: "https://kidgo-app.vercel.app",
    siteName: "Kidgo",
    locale: "de_CH",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kidgo – Events für Kinder",
    description: "Die besten Kinder-Events & Aktivitäten in der Region Zürich.",
  },
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kidgo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Prevent flash of unstyled content on theme switch */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('kidgo_theme');
                var dark = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (dark) document.documentElement.classList.add('dark');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className={`${nunito.variable} ${nunito.className} antialiased`}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-LFZ63YFTRR"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-LFZ63YFTRR');`}
        </Script>
        <a href="#main-content" className="skip-to-content">
          Zum Inhalt springen
        </a>
        <AuthProvider>
          <DesktopSideNav />
          <div className="md:pl-56">
            <PageTransitionWrapper>{children}</PageTransitionWrapper>
          </div>
        </AuthProvider>
        <KidgoFooter />
        <BottomNav />
        <SwipeBackGate />
        <KeyboardShortcuts />
      </body>
    </html>
  );
}

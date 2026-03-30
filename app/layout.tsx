import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  manifest: "/manifest.json",
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}

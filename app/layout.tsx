import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kidgo - Events für Kinder",
  description: "Finde die besten Events für deine Kinder in der Region Zürich",
  viewport: "width=device-width, initial-scale=1",
  icons: "/icon.png",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <head>
        <meta name="theme-color" content="#6366f1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased">
        <nav className="bg-indigo-600 text-white p-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold">🎪 Kidgo</h1>
            <p className="text-sm">Events für Kinder</p>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

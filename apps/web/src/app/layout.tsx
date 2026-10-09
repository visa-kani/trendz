import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
const STORE = process.env.NEXT_PUBLIC_STORE_NAME ?? "Trendz";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${STORE} — Streetwear. Redefined.`, template: `%s | ${STORE}` },
  description: "Bold looks. Clean fits. Built to stand out anywhere.",
  openGraph: { type: "website", siteName: STORE, locale: "en_IN" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#111111", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-offwhite font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

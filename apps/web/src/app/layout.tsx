import type { Metadata, Viewport } from "next";
import { Cinzel, Great_Vibes, Inter, Playfair_Display } from "next/font/google";
import { Providers } from "@/components/providers";
import { BRAND } from "@/lib/brand";
import { getAppearance } from "@/lib/server-api";
import { themeStyle, themeVars } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Editorial serif for headings.
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
// Engraved capitals, like the lettering in the Trendz logo (wordmark, small labels).
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap", weight: ["500", "600", "700"] });
// Script used for the tagline.
const greatVibes = Great_Vibes({ subsets: ["latin"], variable: "--font-greatvibes", display: "swap", weight: "400" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";
const STORE = process.env.NEXT_PUBLIC_STORE_NAME ?? BRAND.fullName;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${STORE} — ${BRAND.tagline}`, template: `%s | ${STORE}` },
  description: `${BRAND.promise}: kurti sets, anarkalis, lehengas, party wear, western wear and kids wear from ${BRAND.fullName}.`,
  openGraph: { type: "website", siteName: STORE, locale: "en_IN" },
  robots: { index: true, follow: true },
};

// Browser chrome follows the saved theme (Admin → Appearance).
export async function generateViewport(): Promise<Viewport> {
  const appearance = await getAppearance();
  return { themeColor: themeVars(appearance)["--color-offwhite"], colorScheme: appearance.mode, width: "device-width", initialScale: 1 };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every colour token is set here, on <html>, so the first paint already has the saved theme.
  const appearance = await getAppearance();
  return (
    <html lang="en-IN" className={`${inter.variable} ${playfair.variable} ${cinzel.variable} ${greatVibes.variable}`} style={themeStyle(appearance)}>
      <body className="min-h-screen bg-offwhite font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

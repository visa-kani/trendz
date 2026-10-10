import { Navbar } from "@/components/store/navbar";
import { Footer } from "@/components/store/footer";
import { StoreProviders } from "@/components/store/store-providers";
import { money } from "@/lib/format";
import { serverGet } from "@/lib/server-api";
import type { CategoryNode, StoreConfig } from "@/lib/types";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [categories, config] = await Promise.all([
    serverGet<CategoryNode[]>("/store/categories", 120).catch(() => [] as CategoryNode[]),
    serverGet<StoreConfig>("/store/config", 60).catch(() => null),
  ]);
  // Announcement ticker, built from live store settings (nothing hard-coded about money).
  const announcements = [
    config?.shipping.freeShippingThreshold ? `Free shipping on orders above ${money(config.shipping.freeShippingThreshold)}` : "Tracked delivery across India",
    `${config?.returns.windowDays ?? 7}-day easy returns`,
    "New drops every week",
    "Secure UPI, card & netbanking checkout",
  ];
  return (
    <StoreProviders>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white">
        Skip to content
      </a>
      <Navbar categories={categories} announcements={announcements} />
      <main id="main" className="overflow-x-clip">
        {children}
      </main>
      <Footer categories={categories} />
    </StoreProviders>
  );
}

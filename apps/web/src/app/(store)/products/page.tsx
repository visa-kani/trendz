import type { Metadata } from "next";
import { Listing, type SearchParams } from "@/components/store/listing";

export async function generateMetadata({ searchParams }: { searchParams: Promise<SearchParams> }): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : null;
  return {
    title: q ? `Search: ${q}` : "Shop all",
    alternates: { canonical: "/products" },
    // Search result pages should not compete with category pages in search engines.
    robots: q ? { index: false, follow: true } : undefined,
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : null;
  const eyebrow = q ? "Search results" : sp.featured === "true" ? "Most loved" : "The collection";
  return (
    <Listing
      searchParams={sp}
      title={q ? `Results for “${q}”` : "Shop all"}
      eyebrow={eyebrow}
      breadcrumb={[{ name: "Home", href: "/" }, q ? { name: "Shop all", href: "/products" } : { name: "Shop all" }, ...(q ? [{ name: "Search" }] : [])]}
    />
  );
}

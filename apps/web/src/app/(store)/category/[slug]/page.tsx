import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Listing, type SearchParams } from "@/components/store/listing";
import type { Crumb } from "@/components/store/shop-breadcrumbs";
import { NotFoundError, serverGet } from "@/lib/server-api";

interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  children: { id: string; name: string; slug: string }[];
  breadcrumb: { id: string; name: string; slug: string }[];
}

async function load(slug: string) {
  try {
    return await serverGet<CategoryDetail>(`/store/categories/${encodeURIComponent(slug)}`, 120);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await load((await params).slug);
  return {
    title: c.seoTitle ?? c.name,
    description: c.seoDescription ?? c.description ?? `Shop ${c.name} at Trendz.`,
    keywords: c.seoKeywords ?? undefined,
    alternates: { canonical: `/category/${c.slug}` },
    openGraph: { title: c.seoTitle ?? c.name, url: `/category/${c.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await load(slug);

  // Home / …parents / this category (the last crumb is the current page).
  const trail: Crumb[] = [{ name: "Home", href: "/" }, ...c.breadcrumb.map((b) => ({ name: b.name, href: `/category/${b.slug}` }))];
  if (c.breadcrumb.at(-1)?.slug !== c.slug) trail.push({ name: c.name });
  const parent = c.breadcrumb.filter((b) => b.slug !== c.slug).at(-1);

  return (
    <Listing
      searchParams={sp}
      category={c.slug}
      title={c.name}
      eyebrow={parent?.name ?? "Collection"}
      description={c.description ?? undefined}
      breadcrumb={trail}
      subcategories={c.children}
    />
  );
}

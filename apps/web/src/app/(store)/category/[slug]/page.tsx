import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Listing, type SearchParams } from "@/components/store/listing";
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
    description: c.seoDescription ?? c.description ?? `Shop ${c.name} at Drift.`,
    keywords: c.seoKeywords ?? undefined,
    alternates: { canonical: `/category/${c.slug}` },
    openGraph: { title: c.seoTitle ?? c.name, url: `/category/${c.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await load(slug);
  return (
    <>
      <div className="container-x pt-8">
        <nav aria-label="Breadcrumb" className="text-xs text-ink/50">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          {c.breadcrumb.map((b) => (
            <span key={b.id}>
              {" / "}
              <Link href={`/category/${b.slug}`} className="hover:text-ink">
                {b.name}
              </Link>
            </span>
          ))}
        </nav>
        {c.children.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {c.children.map((child) => (
              <Link key={child.id} href={`/category/${child.slug}`} className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm hover:border-ink/40">
                {child.name}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Listing searchParams={sp} category={c.slug} title={c.name} subtitle={c.description ?? undefined} />
    </>
  );
}

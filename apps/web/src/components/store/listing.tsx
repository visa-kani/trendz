import Link from "next/link";
import { Suspense } from "react";
import { Filters, SortSelect, type Facets } from "./filters";
import { ProductGrid } from "./product-card";
import { serverGet, serverPage } from "@/lib/server-api";
import type { ProductCard } from "@/lib/types";

export type SearchParams = Record<string, string | string[] | undefined>;

const PASS_THROUGH = ["q", "brand", "minPrice", "maxPrice", "inStock", "sort", "page", "featured"];

/** Builds the API query from page search params (only known keys are forwarded). */
function apiQuery(sp: SearchParams, category?: string) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (!value) continue;
    if (PASS_THROUGH.includes(k) || k.startsWith("opt.")) q.set(k, value);
  }
  if (category) q.set("category", category);
  q.set("limit", "24");
  return q;
}

export async function Listing({ searchParams, category, title, subtitle }: { searchParams: SearchParams; category?: string; title: string; subtitle?: string }) {
  const query = apiQuery(searchParams, category);
  const facetQuery = new URLSearchParams(query);
  facetQuery.delete("page");
  facetQuery.delete("sort");
  facetQuery.delete("limit");

  const [{ data: products, meta }, facets] = await Promise.all([
    serverPage<ProductCard[]>(`/store/products?${query.toString()}`, 30),
    serverGet<Facets>(`/store/products/facets?${facetQuery.toString()}`, 60).catch(() => ({ brands: [], price: { min: 0, max: 0 }, options: [] })),
  ]);

  const pageHref = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v) p.set(k, v);
    p.set("page", String(page));
    return `?${p.toString()}`;
  };

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-ink/55">{subtitle ?? `${meta.total} ${meta.total === 1 ? "product" : "products"}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="lg:hidden">
            <Suspense fallback={null}>
              <Filters facets={facets} />
            </Suspense>
          </div>
          <Suspense fallback={null}>
            <SortSelect />
          </Suspense>
        </div>
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <div className="hidden lg:block">
          <Suspense fallback={null}>
              <Filters facets={facets} />
            </Suspense>
        </div>
        <div>
          {products.length ? (
            <ProductGrid products={products} priorityCount={4} />
          ) : (
            <div className="card flex flex-col items-center gap-2 p-14 text-center">
              <p className="font-semibold">No products match</p>
              <p className="text-sm text-ink/55">Try removing a filter or searching for something else.</p>
              <Link href="/products" className="link mt-2 text-sm">
                Browse everything
              </Link>
            </div>
          )}
          {meta.totalPages > 1 && (
            <nav aria-label="Pages" className="mt-12 flex items-center justify-center gap-2">
              {meta.page > 1 && (
                <Link href={pageHref(meta.page - 1)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm">
                  Previous
                </Link>
              )}
              <span className="px-3 text-sm text-ink/55">
                Page {meta.page} of {meta.totalPages}
              </span>
              {meta.page < meta.totalPages && (
                <Link href={pageHref(meta.page + 1)} className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm">
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

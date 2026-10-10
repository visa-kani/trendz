import Link from "next/link";
import { clsx } from "clsx";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { ActiveFilters, FilterSidebar, ListingCount, ListingEmpty, ListingProvider, ListingResults, MobileFilters, SortSelect, type Facets } from "./filters";
import { Reveal, Stagger, StaggerItem } from "./motion";
import { ProductGrid } from "./product-card";
import { Breadcrumbs, type Crumb } from "./shop-breadcrumbs";
import { MaskedHeading } from "./shop-heading";
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

/** The page's own query string (plain string params), used for filter state and pagination links. */
function pageParams(sp: SearchParams) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
  return p;
}

/** Page numbers around the current one, with gaps: 1 … 4 5 6 … 12. */
function pageWindow(page: number, total: number): (number | "gap")[] {
  const pages = [...new Set([1, total, page - 1, page, page + 1])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (const n of pages) {
    if (n - prev === 2) out.push(prev + 1);
    else if (n - prev > 2) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

const ROUND_LINK =
  "grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white transition duration-300 hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite";

function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  return (
    <nav aria-label="Pages" className="mt-16 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" aria-label="Previous page" className={ROUND_LINK}>
          <ArrowLeft size={16} />
        </Link>
      ) : (
        <span aria-hidden="true" className={clsx(ROUND_LINK, "pointer-events-none opacity-35")}>
          <ArrowLeft size={16} />
        </span>
      )}
      <ol className="hidden items-center gap-1 rounded-full bg-white p-1 shadow-neu sm:flex">
        {pageWindow(page, totalPages).map((n, i) =>
          n === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1.5 text-sm text-ink/30">
              …
            </li>
          ) : (
            <li key={n}>
              <Link
                href={href(n)}
                aria-label={`Page ${n}`}
                aria-current={n === page ? "page" : undefined}
                className={clsx(
                  "grid h-9 min-w-9 place-items-center rounded-full px-2.5 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
                  n === page ? "bg-ink text-white" : "text-ink/55 hover:bg-black/5 hover:text-ink",
                )}
              >
                {n}
              </Link>
            </li>
          ),
        )}
      </ol>
      <span className="px-2 text-sm tabular-nums text-ink/55 sm:hidden">
        Page <strong className="text-ink">{page}</strong> of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} rel="next" aria-label="Next page" className={ROUND_LINK}>
          <ArrowRight size={16} />
        </Link>
      ) : (
        <span aria-hidden="true" className={clsx(ROUND_LINK, "pointer-events-none opacity-35")}>
          <ArrowRight size={16} />
        </span>
      )}
    </nav>
  );
}

export async function Listing({
  searchParams,
  category,
  title,
  eyebrow = "The collection",
  description,
  breadcrumb,
  subcategories,
}: {
  searchParams: SearchParams;
  category?: string;
  title: string;
  eyebrow?: string;
  description?: string;
  breadcrumb?: Crumb[];
  subcategories?: { id: string; name: string; slug: string }[];
}) {
  const query = apiQuery(searchParams, category);
  const facetQuery = new URLSearchParams(query);
  facetQuery.delete("page");
  facetQuery.delete("sort");
  facetQuery.delete("limit");

  const [{ data: products, meta }, facets] = await Promise.all([
    serverPage<ProductCard[]>(`/store/products?${query.toString()}`, 30),
    serverGet<Facets>(`/store/products/facets?${facetQuery.toString()}`, 60).catch(() => ({ brands: [], price: { min: 0, max: 0 }, options: [] })),
  ]);

  const current = pageParams(searchParams);
  const pageHref = (page: number) => {
    const p = new URLSearchParams(current);
    p.set("page", String(page));
    return `?${p.toString()}`;
  };
  const from = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <ListingProvider query={current.toString()}>
      {/* Editorial header */}
      <header className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-32 h-96 w-96 rounded-full bg-sand/60 blur-3xl" />
        <div className="container-x relative pb-8 pt-8 md:pb-12 md:pt-12">
          {breadcrumb && <Breadcrumbs items={breadcrumb} />}
          <div className={clsx("flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12", breadcrumb && "mt-8 md:mt-12")}>
            <div className="min-w-0 max-w-4xl">
              <Reveal y={10}>
                <p className="eyebrow">{eyebrow}</p>
              </Reveal>
              <MaskedHeading className="mt-3 text-[clamp(2.75rem,8vw,6.5rem)] font-bold leading-[0.9] tracking-tighter [overflow-wrap:anywhere]" delay={0.05}>
                {title}
                <sup aria-hidden="true" className="ml-2 align-super text-[0.24em] font-semibold tracking-normal text-ink/35 tabular-nums">
                  ({meta.total})
                </sup>
              </MaskedHeading>
            </div>
            {description && (
              <Reveal delay={0.25} y={14} className="max-w-sm lg:pb-2">
                <p className="text-sm leading-relaxed text-ink/60 md:text-base">{description}</p>
              </Reveal>
            )}
          </div>
          {subcategories && subcategories.length > 0 && (
            <Stagger className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" gap={0.04} amount={0}>
              <StaggerItem className="shrink-0">
                <span aria-current="page" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">
                  All {title}
                </span>
              </StaggerItem>
              {subcategories.map((child) => (
                <StaggerItem key={child.id} className="shrink-0">
                  <Link
                    href={`/category/${child.slug}`}
                    className="group inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white pl-5 pr-3 text-sm font-medium transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-offwhite"
                  >
                    {child.name}
                    <ArrowUpRight size={14} className="transition-transform duration-500 group-hover:rotate-45" />
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </header>

      <div className="container-x">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 border-y border-black/[0.07] py-3">
          <div className="flex min-w-0 items-center gap-3">
            <MobileFilters facets={facets} total={meta.total} />
            <ListingCount from={from} to={to} total={meta.total} />
          </div>
          <SortSelect />
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-14">
          <aside aria-label="Product filters" className="hidden lg:block">
            <div className="no-scrollbar sticky top-28 -mx-1 max-h-[calc(100svh-8rem)] overflow-y-auto px-1 pb-10">
              <FilterSidebar facets={facets} />
            </div>
          </aside>

          <div className="min-w-0">
            <ActiveFilters facets={facets} />
            <ListingResults>
              {/* Keyed by the query: each new result set fades in (CSS) and gets fresh scroll reveals. */}
              <div key={current.toString()} className="animate-fade">
                {products.length ? <ProductGrid products={products} priorityCount={3} columns={3} /> : <ListingEmpty />}
              </div>
            </ListingResults>
            {meta.totalPages > 1 && <Pagination page={meta.page} totalPages={meta.totalPages} href={pageHref} />}
          </div>
        </div>
      </div>
    </ListingProvider>
  );
}

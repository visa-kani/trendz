"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { SlidersHorizontal, X } from "lucide-react";
import { money } from "@/lib/format";

export interface Facets {
  brands: { name: string; slug: string; count: number }[];
  price: { min: number; max: number };
  options: { name: string; values: { value: string; count: number }[] }[];
}

const SORTS = [
  { value: "", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name" },
];

export function SortSelect() {
  const params = useSearchParams();
  const update = useUpdateParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink/55 sm:inline">Sort</span>
      <select value={params.get("sort") ?? ""} onChange={(e) => update({ sort: e.target.value || null, page: null })} className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm outline-none">
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function useUpdateParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, start] = useTransition();
  return (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };
}

export function Filters({ facets }: { facets: Facets }) {
  const params = useSearchParams();
  const update = useUpdateParams();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(params.get("minPrice") ? String(Number(params.get("minPrice")) / 100) : "");
  const [max, setMax] = useState(params.get("maxPrice") ? String(Number(params.get("maxPrice")) / 100) : "");

  const brands = (params.get("brand") ?? "").split(",").filter(Boolean);
  const toggleBrand = (slug: string) => {
    const next = brands.includes(slug) ? brands.filter((b) => b !== slug) : [...brands, slug];
    update({ brand: next.join(",") || null, page: null });
  };
  const toggleOption = (name: string, value: string) => {
    const key = `opt.${name}`;
    const current = (params.get(key) ?? "").split(",").filter(Boolean);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.join(",") || null, page: null });
  };
  const activeCount = [...params.keys()].filter((k) => ["brand", "minPrice", "maxPrice", "inStock"].includes(k) || k.startsWith("opt.")).length;

  const panel = (
    <div className="space-y-7">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink/50">Availability</h3>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-ink" checked={params.get("inStock") === "true"} onChange={(e) => update({ inStock: e.target.checked ? "true" : null, page: null })} />
          In stock only
        </label>
      </section>

      {facets.options.map((o) => (
        <section key={o.name}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-ink/50">{o.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {o.values.map((v) => {
              const active = (params.get(`opt.${o.name}`) ?? "").split(",").includes(v.value);
              return (
                <button
                  key={v.value}
                  onClick={() => toggleOption(o.name, v.value)}
                  aria-pressed={active}
                  className={clsx("rounded-full border px-3 py-1.5 text-xs font-medium transition", active ? "border-ink bg-ink text-white" : "border-black/10 bg-white hover:border-ink/40")}
                >
                  {v.value}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {facets.brands.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-ink/50">Brand</h3>
          <div className="mt-3 space-y-2">
            {facets.brands.map((b) => (
              <label key={b.slug} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-ink" checked={brands.includes(b.slug)} onChange={() => toggleBrand(b.slug)} />
                <span className="flex-1">{b.name}</span>
                <span className="text-xs text-ink/40">{b.count}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink/50">Price</h3>
        <p className="mt-1 text-xs text-ink/45">
          {money(facets.price.min)} – {money(facets.price.max)}
        </p>
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ minPrice: min ? String(Math.round(Number(min) * 100)) : null, maxPrice: max ? String(Math.round(Number(max) * 100)) : null, page: null });
          }}
        >
          <input aria-label="Minimum price" value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder="Min ₹" className="input py-2" />
          <input aria-label="Maximum price" value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder="Max ₹" className="input py-2" />
          <button className="rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white">Go</button>
        </form>
      </section>

      {activeCount > 0 && (
        <button
          onClick={() => update(Object.fromEntries([...params.keys()].filter((k) => !["q", "sort"].includes(k)).map((k) => [k, null])))}
          className="text-sm font-medium text-ink/60 underline underline-offset-4 hover:text-ink"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium lg:hidden">
        <SlidersHorizontal size={15} /> Filters{activeCount ? ` (${activeCount})` : ""}
      </button>
      <aside className="hidden lg:block">{panel}</aside>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="h-full w-80 max-w-[90vw] animate-rise overflow-y-auto bg-offwhite p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-semibold">Filters</span>
              <button aria-label="Close filters" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-black/5">
                <X size={18} />
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}
    </>
  );
}

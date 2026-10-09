import Link from "next/link";
import { ArrowUpRight, Globe, Package, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { ProductGrid, ProductImage } from "@/components/store/product-card";
import { serverGet, serverPage } from "@/lib/server-api";
import { money } from "@/lib/format";
import type { CategoryNode, ProductCard, StoreConfig } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const [featured, latest, categories, config] = await Promise.all([
    serverPage<ProductCard[]>("/store/products?featured=true&limit=8").catch(() => ({ data: [] as ProductCard[] })),
    serverPage<ProductCard[]>("/store/products?sort=newest&limit=8").catch(() => ({ data: [] as ProductCard[] })),
    serverGet<CategoryNode[]>("/store/categories", 120).catch(() => [] as CategoryNode[]),
    serverGet<StoreConfig>("/store/config", 60).catch(() => null),
  ]);
  const hero = featured.data[0] ?? latest.data[0];
  const freeShipping = config?.shipping.freeShippingThreshold;

  return (
    <>
      {/* Hero — Trendz's original design, without the heavy video keying. */}
      <section className="relative overflow-hidden bg-white">
        <div className="container-x grid min-h-[calc(100svh-4rem)] items-center gap-10 py-12 lg:grid-cols-12">
          <div className="flex flex-col gap-7 lg:col-span-7">
            <span className="inline-flex w-fit animate-rise items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold tracking-wider shadow-neu">
              NEW DROP <span aria-hidden="true">✦</span>
            </span>
            <h1 className="flex flex-col text-[clamp(3rem,8.5vw,7.25rem)] font-bold leading-[0.92] tracking-tighter">
              <span className="overflow-hidden">
                <span className="block animate-rise [animation-delay:120ms]">Streetwear.</span>
              </span>
              <span className="overflow-hidden">
                <span className="block animate-rise text-ink/50 [animation-delay:220ms]">Redefined.</span>
              </span>
            </h1>
            <p className="max-w-sm animate-rise text-base text-ink/60 [animation-delay:320ms] md:text-lg">Bold looks. Clean fits. Built to stand out anywhere.</p>
            <div className="flex animate-rise flex-wrap items-center gap-5 [animation-delay:420ms]">
              <Link href="/products" className="group flex items-center gap-6 rounded-full bg-white py-2 pl-6 pr-2 text-sm font-semibold shadow-neu-lg transition-transform hover:scale-[1.02]">
                Explore Collection
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-white transition-transform group-hover:rotate-45">
                  <ArrowUpRight size={16} />
                </span>
              </Link>
              <Link href="/offers" className="text-sm font-semibold text-ink/70 underline-offset-4 hover:text-ink hover:underline">
                See today&apos;s offers
              </Link>
            </div>
            <div className="mt-4 flex w-fit animate-rise divide-x divide-black/10 rounded-3xl bg-white/85 shadow-neu-lg [animation-delay:520ms]">
              {[
                { icon: Package, value: `${latest.data.length ? "New" : "—"}`, label: "Arrivals weekly" },
                { icon: Truck, value: freeShipping ? money(freeShipping) : "Fast", label: freeShipping ? "Free shipping above" : "Delivery" },
                { icon: Globe, value: "India", label: "Designed & shipped" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-3 px-5 py-4">
                  <Icon size={18} className="text-ink/70" strokeWidth={1.75} />
                  <div className="leading-tight">
                    <p className="text-sm font-bold">{value}</p>
                    <p className="text-xs text-ink/50">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {hero && (
            <Link href={`/products/${hero.slug}`} className="relative mx-auto block w-full max-w-md animate-fade lg:col-span-5">
              <div className="aspect-[4/5] overflow-hidden rounded-4xl bg-offwhite shadow-neu-lg">
                <ProductImage image={hero.image} alt={hero.name} priority sizes="(min-width: 1024px) 40vw, 90vw" className="h-full w-full object-cover" />
              </div>
              <div className="absolute -bottom-5 left-6 right-6 flex items-center justify-between rounded-2xl border border-white/50 bg-white/80 p-4 shadow-neu backdrop-blur-md">
                <div>
                  <p className="text-sm font-semibold">{hero.name}</p>
                  <p className="text-xs text-ink/55">{hero.category.name}</p>
                </div>
                <span className="text-sm font-bold">{money(hero.sellingPrice)}</span>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="container-x mt-20">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Shop by category</h2>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {categories.map((c, i) => (
              <Link key={c.id} href={`/category/${c.slug}`} className="group card flex items-end justify-between overflow-hidden p-6 transition hover:shadow-neu-lg" style={{ background: ["#efe9df", "#e6e9e4", "#ece7ee"][i % 3] }}>
                <div>
                  <p className="text-2xl font-bold tracking-tight">{c.name}</p>
                  <p className="mt-1 text-xs text-ink/55">{c.children.map((x) => x.name).join(" · ")}</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white transition group-hover:rotate-45">
                  <ArrowUpRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.data.length > 0 && (
        <section className="container-x mt-20">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Popular picks</h2>
            <Link href="/products?featured=true" className="link text-sm">
              View all
            </Link>
          </div>
          <ProductGrid products={featured.data} />
        </section>
      )}

      {/* Promise strip */}
      <section className="container-x mt-20 grid gap-4 md:grid-cols-3">
        {[
          { icon: Truck, title: "Tracked delivery", body: "Every order ships with live tracking updates by SMS and email." },
          { icon: RotateCcw, title: `${config?.returns.windowDays ?? 7}-day returns`, body: "Changed your mind? Request a return from your account." },
          { icon: ShieldCheck, title: "Secure checkout", body: "UPI, cards and netbanking through Razorpay." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="card flex gap-4 p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-offwhite">
              <Icon size={18} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-ink/55">{body}</p>
            </div>
          </div>
        ))}
      </section>

      {latest.data.length > 0 && (
        <section className="container-x mt-20">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">New arrivals</h2>
            <Link href="/products?sort=newest" className="link text-sm">
              Shop new
            </Link>
          </div>
          <ProductGrid products={latest.data} />
        </section>
      )}
    </>
  );
}

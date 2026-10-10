import Link from "next/link";
import { ArrowUpRight, RotateCcw, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { Magnetic, Parallax, Reveal, SplitWords, Stagger, StaggerItem } from "@/components/store/motion";
import { ProductGrid, ProductImage } from "@/components/store/product-card";
import { ProductRail } from "@/components/store/product-rail";
import { BRAND } from "@/lib/brand";
import { serverGet, serverPage } from "@/lib/server-api";
import { money } from "@/lib/format";
import type { CategoryNode, ImageView, ProductCard, StoreConfig } from "@/lib/types";

export const revalidate = 60;

/** Circular pink "new arrivals" seal that slowly spins. */
function SpinBadge() {
  return (
    <div className="on-dark ribbon relative grid h-28 w-28 place-items-center rounded-full text-white ring-1 ring-gold/60">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-spin-slow" aria-hidden="true">
        <defs>
          <path id="badge-circle" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" />
        </defs>
        <text className="fill-white text-[9px] font-semibold uppercase">
          <textPath href="#badge-circle" textLength="228" lengthAdjust="spacing">New arrivals ✦ Trendz ✦ New arrivals ✦</textPath>
        </text>
      </svg>
      <ArrowUpRight size={22} />
    </div>
  );
}

export default async function HomePage() {
  const [featured, latest, categories, config] = await Promise.all([
    serverPage<ProductCard[]>("/store/products?featured=true&limit=10").catch(() => ({ data: [] as ProductCard[] })),
    serverPage<ProductCard[]>("/store/products?sort=newest&limit=8").catch(() => ({ data: [] as ProductCard[] })),
    serverGet<CategoryNode[]>("/store/categories", 120).catch(() => [] as CategoryNode[]),
    serverGet<StoreConfig>("/store/config", 60).catch(() => null),
  ]);
  const all = [...featured.data, ...latest.data];
  const hero = featured.data[0] ?? latest.data[0];
  const sideKick = all.find((p) => p.id !== hero?.id && p.image);
  const editorial = all.find((p) => p.id !== hero?.id && p.id !== sideKick?.id && p.image) ?? sideKick;
  const freeShipping = config?.shipping.freeShippingThreshold;

  // A representative product photo for each top-level category (category images win when set).
  const imageFor = (cat: CategoryNode): ImageView | string | null => {
    if (cat.imageUrl) return cat.imageUrl;
    const slugs = new Set([cat.slug, ...cat.children.map((c) => c.slug)]);
    // Prefer a photo that is not already the hero image.
    const inCat = all.filter((p) => slugs.has(p.category.slug) && p.image);
    return (inCat.find((p) => p.id !== hero?.id) ?? inCat[0])?.image ?? null;
  };

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 top-10 h-[30rem] w-[30rem] animate-float rounded-full bg-accent/20 blur-[110px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-[26rem] w-[26rem] animate-float rounded-full bg-gold/10 blur-[110px] [animation-delay:-3s]" />

        <div className="container-x relative grid min-h-[calc(100svh-6.5rem)] items-center gap-12 py-12 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-7">
            <div className="animate-rise">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-gold/35 bg-white/60 px-4 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-bright backdrop-blur">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" /> {BRAND.fullName}
              </span>
            </div>
            <h1 className="text-[clamp(3rem,8.2vw,7.25rem)] leading-[0.95]">
              <SplitWords text="Luxury in" className="block" delay={0.1} wordClassName="text-gold-shine" />
              <SplitWords text="Every Stitch." className="block" delay={0.3} wordClassName="text-accent" />
            </h1>
            <p className="animate-rise font-script text-4xl text-accent-bright [animation-delay:420ms] md:text-5xl">{BRAND.promise}</p>
            <div className="animate-rise [animation-delay:500ms]">
              <p className="max-w-md text-base leading-relaxed text-ink/65 md:text-lg">
                Kurti sets, anarkalis, lehengas, party wear and more — thoughtfully chosen pieces for every celebration and every day.
              </p>
            </div>
            <div className="flex animate-rise flex-wrap items-center gap-6 [animation-delay:600ms]">
              <Magnetic>
                <Link href="/products" className="group flex items-center gap-6 rounded-full bg-ink py-2 pl-7 pr-2 text-sm font-semibold text-white">
                  Explore collection
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-45">
                    <ArrowUpRight size={17} />
                  </span>
                </Link>
              </Magnetic>
              <Link href="/offers" className="link-draw text-sm font-semibold text-gold-bright">
                See today&apos;s offers
              </Link>
            </div>
            <div className="animate-rise [animation-delay:720ms]">
              <dl className="mt-2 grid w-full grid-cols-3 divide-x divide-gold/20 rounded-3xl border border-gold/25 bg-white/70 backdrop-blur sm:flex sm:w-fit">
                {[
                  { icon: Sparkles, value: "Weekly", label: "New arrivals" },
                  { icon: Truck, value: freeShipping ? money(freeShipping) : "Tracked", label: freeShipping ? "Free shipping above" : "Delivery" },
                  { icon: RotateCcw, value: `${config?.returns.windowDays ?? 7} days`, label: "Easy returns" },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex flex-col items-start gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
                    <Icon size={18} className="text-accent" strokeWidth={1.75} />
                    <div className="leading-tight">
                      <dd className="text-sm font-bold text-gold-bright">{value}</dd>
                      <dt className="text-xs text-ink/55">{label}</dt>
                    </div>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {hero && (
            <div className="relative mx-auto w-full max-w-md lg:col-span-5">
              <div className="relative animate-rise [animation-delay:200ms]">
                <Link href={`/products/${hero.slug}`} className="group block">
                  {/* Arched frame with a gold border, like a boutique display. */}
                  <Parallax offset={30} className="gold-frame aspect-[4/5] rounded-t-[14rem] rounded-b-[2.5rem] bg-white">
                    <ProductImage image={hero.image} alt={hero.name} priority sizes="(min-width: 1024px) 40vw, 90vw" className="h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105" />
                  </Parallax>
                  <div className="absolute -bottom-6 left-6 right-6 flex items-center justify-between rounded-2xl border border-gold/30 bg-white/85 p-4 shadow-neu-lg backdrop-blur-md transition-transform duration-500 group-hover:-translate-y-1">
                    <div>
                      <p className="text-sm font-semibold">{hero.name}</p>
                      <p className="text-xs text-ink/55">{hero.category.name}</p>
                    </div>
                    <span className="text-sm font-bold text-accent">{money(hero.sellingPrice)}</span>
                  </div>
                </Link>
              </div>
              <div className="absolute -left-10 top-16 hidden sm:block">
                <div className="animate-fade [animation-delay:900ms]">
                  <Link href="/products?sort=newest" aria-label="Shop new arrivals">
                    <SpinBadge />
                  </Link>
                </div>
              </div>
              {sideKick && (
                <div className="absolute -right-6 top-1/3 hidden w-36 animate-float lg:block [animation-delay:-2s]">
                  <div className="animate-rise [animation-delay:1000ms]">
                    <Link href={`/products/${sideKick.slug}`} className="block rounded-2xl border border-gold/30 bg-white p-2 shadow-neu-lg transition hover:-rotate-2">
                      <div className="aspect-square overflow-hidden rounded-xl bg-offwhite">
                        <ProductImage image={sideKick.image} alt={sideKick.name} sizes="144px" className="h-full w-full object-cover" />
                      </div>
                      <p className="mt-2 truncate px-1 text-[11px] font-semibold">{sideKick.name}</p>
                      <p className="px-1 pb-1 text-[11px] text-accent">{money(sideKick.sellingPrice)}</p>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* -------------------------------------------------------- Categories */}
      {categories.length > 0 && (
        <section className="container-x mt-28">
          <Reveal className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Collections</p>
              <h2 className="mt-2 text-4xl md:text-5xl">Shop by category</h2>
            </div>
            <Link href="/products" className="link-draw text-sm font-semibold text-gold-bright">
              Browse everything
            </Link>
          </Reveal>
          <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" gap={0.1}>
            {categories.map((c) => {
              const img = imageFor(c);
              return (
                <StaggerItem key={c.id}>
                  <Link href={`/category/${c.slug}`} className="on-dark gold-frame group relative block h-full min-h-80 overflow-hidden rounded-[2rem] bg-sand lg:min-h-[28rem]">
                    {img &&
                      (typeof img === "string" ? (
                        <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110" />
                      ) : (
                        <ProductImage image={img} alt="" sizes="(min-width: 1024px) 33vw, 100vw" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110" />
                      ))}
                    <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/15 to-transparent" />
                    <div className="absolute inset-x-6 bottom-6 flex items-end justify-between text-white">
                      <div>
                        <p className="font-serif text-3xl font-bold text-gold-bright md:text-4xl">{c.name}</p>
                        <p className="mt-1 max-h-0 overflow-hidden text-xs text-white/80 opacity-0 transition-all duration-500 group-hover:max-h-10 group-hover:opacity-100">
                          {c.children.map((x) => x.name).join(" · ")}
                        </p>
                      </div>
                      <span className="ribbon grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-45">
                        <ArrowUpRight size={18} />
                      </span>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>
      )}

      {/* ----------------------------------------------------- Popular picks */}
      {featured.data.length > 0 && (
        <section className="container-x mt-28">
          <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Most loved</p>
              <h2 className="mt-2 text-4xl md:text-5xl">Popular picks</h2>
            </div>
            <Link href="/products?featured=true" className="link-draw text-sm font-semibold text-gold-bright">
              View all
            </Link>
          </Reveal>
          <ProductRail products={featured.data} label="Popular picks" />
        </section>
      )}

      {/* --------------------------------------------------------- Editorial */}
      {editorial && (
        <section className="container-x mt-28">
          <div className="gold-frame grid items-center gap-10 overflow-hidden rounded-[2.5rem] bg-white p-6 md:p-10 lg:grid-cols-2 lg:gap-16 lg:p-14">
            <Parallax offset={40} className="aspect-[4/5] rounded-[2rem] bg-offwhite lg:aspect-square">
              <ProductImage image={editorial.image} alt={editorial.name} sizes="(min-width: 1024px) 45vw, 100vw" className="h-full w-full object-cover" />
            </Parallax>
            <div>
              <Reveal>
                <p className="eyebrow">The Trendz edit</p>
                <h2 className="mt-3 text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.02]">
                  Made for every occasion.
                  <br />
                  <span className="text-accent">Styled your way.</span>
                </h2>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-md text-base leading-relaxed text-ink/65">
                  Graceful silhouettes, rich fabrics and colours that flatter — so every piece you pick feels special, whether it is a festival, a function or an ordinary day.
                </p>
              </Reveal>
              <Stagger className="mt-8 grid gap-3 sm:grid-cols-3" gap={0.08}>
                {["Festive edits", "Everyday elegance", "Perfect fits"].map((t) => (
                  <StaggerItem key={t} className="rounded-2xl border border-gold/25 bg-offwhite px-4 py-3 text-sm font-semibold text-gold-bright">
                    {t}
                  </StaggerItem>
                ))}
              </Stagger>
              <Reveal delay={0.2}>
                <Link href={`/products/${editorial.slug}`} className="group mt-10 inline-flex items-center gap-3 text-sm font-semibold">
                  <span className="ribbon grid h-12 w-12 place-items-center rounded-full transition-transform duration-500 group-hover:rotate-45">
                    <ArrowUpRight size={17} />
                  </span>
                  Shop {editorial.name}
                </Link>
              </Reveal>
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------- Promises */}
      <section className="container-x mt-28">
        <Stagger className="grid gap-4 md:grid-cols-3" gap={0.1}>
          {[
            { icon: Truck, title: freeShipping ? `Free shipping above ${money(freeShipping)}` : "Tracked delivery", body: "Every order ships with live tracking updates by SMS and email." },
            { icon: RotateCcw, title: `${config?.returns.windowDays ?? 7}-day returns`, body: "Changed your mind? Request a return from your account in a few taps." },
            { icon: ShieldCheck, title: "Secure checkout", body: "Pay with UPI, cards or netbanking through Razorpay." },
          ].map(({ icon: Icon, title, body }) => (
            <StaggerItem key={title} className="group card flex gap-4 p-7 transition duration-500 hover:-translate-y-1 hover:shadow-neu-lg">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-gold/25 bg-offwhite text-gold-bright transition-colors duration-500 group-hover:border-accent group-hover:text-accent">
                <Icon size={19} strokeWidth={1.75} />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink/55">{body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ------------------------------------------------------ New arrivals */}
      {latest.data.length > 0 && (
        <section className="container-x mt-28">
          <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Just landed</p>
              <h2 className="mt-2 text-4xl md:text-5xl">New arrivals</h2>
            </div>
            <Link href="/products?sort=newest" className="link-draw text-sm font-semibold text-gold-bright">
              Shop new
            </Link>
          </Reveal>
          <ProductGrid products={latest.data} />
        </section>
      )}

      {/* ---------------------------------------------------------- Closing */}
      <section className="container-x mt-28">
        <Reveal>
          <div className="on-dark gold-frame relative overflow-hidden rounded-[2.5rem] bg-ink px-8 py-14 text-center text-white md:px-16 md:py-20">
            <div aria-hidden="true" className="absolute -left-24 -top-24 h-80 w-80 animate-float rounded-full bg-accent/35 blur-[90px]" />
            <div aria-hidden="true" className="absolute -bottom-28 -right-20 h-80 w-80 animate-float rounded-full bg-gold/20 blur-[90px] [animation-delay:-3s]" />
            <img src={BRAND.logo} alt={`${BRAND.fullName} — ${BRAND.tagline}`} width={1030} height={724} loading="lazy" className="relative mx-auto w-full max-w-sm mix-blend-screen" />
            <p className="ornament relative mt-2">❖</p>
            <h2 className="relative mx-auto mt-6 max-w-2xl text-[clamp(2rem,5vw,3.75rem)] leading-[1.05]">Find the outfit that feels like you.</h2>
            <div className="relative mt-9 flex flex-wrap justify-center gap-4">
              <Magnetic>
                <Link href="/products" className="group flex items-center gap-4 rounded-full bg-ink py-2 pl-7 pr-2 text-sm font-semibold text-white">
                  Shop the collection
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-45">
                    <ArrowUpRight size={17} />
                  </span>
                </Link>
              </Magnetic>
              <a href={BRAND.whatsappHref} target="_blank" rel="noopener noreferrer" className="rounded-full border border-gold/50 px-7 py-4 text-sm font-semibold text-gold-bright transition hover:border-gold-bright hover:bg-white/5">
                Chat on WhatsApp
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

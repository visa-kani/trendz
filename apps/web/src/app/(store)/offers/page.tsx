import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BadgePercent, Copy, ShoppingBag, Ticket } from "lucide-react";
import { Marquee, Reveal, Stagger, StaggerItem } from "@/components/store/motion";
import { CopyCodeButton } from "@/components/store/shop-copy-code";
import { MaskedHeading } from "@/components/store/shop-heading";
import { serverGet } from "@/lib/server-api";
import { date, money, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Offers & coupons", alternates: { canonical: "/offers" } };
export const revalidate = 120;

interface PublicCoupon {
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  expiresAt: string | null;
}

const valueOf = (c: PublicCoupon) => (c.discountType === "PERCENTAGE" ? percent(c.value) : money(c.value));

const STEPS = [
  { icon: Copy, title: "Copy a code", body: "Tap “Copy code” on the offer you want." },
  { icon: ShoppingBag, title: "Fill your bag", body: "Add the pieces you love to your bag." },
  { icon: BadgePercent, title: "Apply it in your bag", body: "Apply a code in your bag. One coupon per order." },
];

/** Ticket-style coupon: value stub on the left (top on phones), perforated notches, terms and a copy button. */
function CouponCard({ coupon: c }: { coupon: PublicCoupon }) {
  const terms = [
    c.minOrderAmount ? `On orders above ${money(c.minOrderAmount)}` : null,
    c.maxDiscountAmount ? `Up to ${money(c.maxDiscountAmount)}` : null,
    c.expiresAt ? `Valid till ${date(c.expiresAt)}` : null,
  ].filter((t): t is string => !!t);

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-white shadow-neu transition duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:shadow-neu-lg sm:flex-row">
      <div className="relative flex shrink-0 items-end justify-between gap-4 bg-ink p-6 text-white sm:w-48 sm:flex-col sm:items-start">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-transform duration-500 group-hover:-rotate-12">
          <Ticket size={18} />
        </span>
        <div className="text-right sm:text-left">
          <p className="text-[2.6rem] font-bold leading-none tracking-tighter">{valueOf(c)}</p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">off</p>
        </div>
        {/* Ticket notches where the stub meets the body. */}
        <span aria-hidden="true" className="absolute -bottom-3 -left-3 h-6 w-6 rounded-full bg-offwhite sm:-right-3 sm:-top-3 sm:bottom-auto sm:left-auto" />
        <span aria-hidden="true" className="absolute -bottom-3 -right-3 h-6 w-6 rounded-full bg-offwhite" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-6 sm:pl-8">
        <p className="text-lg font-bold tracking-tight">{c.discountType === "PERCENTAGE" ? `${percent(c.value)} off` : `${money(c.value)} off`}</p>
        {c.description && <p className="mt-1 text-sm leading-relaxed text-ink/60">{c.description}</p>}
        {terms.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {terms.map((t) => (
              <li key={t} className="rounded-full bg-offwhite px-3 py-1 text-[11px] font-medium text-ink/60">
                {t}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
          <span className="rounded-xl border border-dashed border-ink/25 px-4 py-2 font-mono text-sm font-bold tracking-[0.2em]">{c.code}</span>
          <CopyCodeButton code={c.code} />
        </div>
      </div>
    </article>
  );
}

export default async function OffersPage() {
  const coupons = await serverGet<PublicCoupon[]>("/store/coupons", 120).catch(() => [] as PublicCoupon[]);
  // Repeat the codes so the ticker is always wider than the screen.
  const ticker = coupons.length ? Array.from({ length: Math.ceil(6 / coupons.length) }, () => coupons).flat() : [];

  return (
    <>
      {/* ------------------------------------------------------------ Hero */}
      <section className="container-x pt-6 md:pt-10">
        <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-ink px-6 pb-12 pt-10 text-white sm:px-10 md:px-16 md:pb-20 md:pt-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 -z-10 h-80 w-80 animate-float rounded-full bg-accent/30 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -left-20 -z-10 h-72 w-72 animate-float rounded-full bg-sand/15 blur-3xl [animation-delay:-3s]" />

          <span className="inline-flex animate-rise items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" />
            {coupons.length ? `${coupons.length} live ${coupons.length === 1 ? "code" : "codes"}` : "Offers"}
          </span>
          <MaskedHeading className="mt-8 text-[clamp(3rem,11vw,9rem)] font-bold leading-[0.86] tracking-tighter" delay={0.1}>
            Offers &amp;
            <br />
            <span className="text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.85)]">coupons</span>
          </MaskedHeading>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-8">
            <p className="max-w-sm animate-rise text-base leading-relaxed text-white/60 [animation-delay:250ms] md:text-lg">Apply a code in your bag. One coupon per order.</p>
            <Link
              href="/products"
              className="group flex animate-rise items-center gap-4 rounded-full bg-white py-2 pl-6 pr-2 text-sm font-semibold text-ink [animation-delay:350ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              Start shopping
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white transition-transform duration-500 group-hover:rotate-45">
                <ArrowUpRight size={17} />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Code ticker */}
      {ticker.length > 0 && (
        <div aria-hidden="true" className="container-x mt-6">
          <div className="overflow-hidden rounded-full bg-white py-4 shadow-neu">
            <Marquee>
              {ticker.map((c, i) => (
                <span key={`${c.code}-${i}`} className="flex items-center gap-5 pr-5 text-xl font-bold uppercase tracking-tighter md:text-3xl">
                  <span>{valueOf(c)} off</span>
                  <span className="font-mono text-base tracking-[0.2em] text-ink/35 md:text-xl">{c.code}</span>
                  <span className="text-accent">✦</span>
                </span>
              ))}
            </Marquee>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- Codes */}
      <section className="container-x mt-20">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Live now</p>
            <h2 className="mt-2 text-4xl font-bold tracking-tighter md:text-5xl">Pick your code</h2>
          </div>
          <p className="max-w-xs text-sm text-ink/55">Copy a code, then apply it in your bag before you check out.</p>
        </Reveal>

        {coupons.length === 0 ? (
          <Reveal className="mt-10">
            <div className="relative overflow-hidden rounded-[2rem] bg-white px-6 py-16 text-center shadow-neu md:py-24">
              <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 animate-float rounded-full bg-sand/60 blur-3xl" />
              <span className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-offwhite">
                <Ticket size={30} strokeWidth={1.5} className="animate-float" />
              </span>
              <p className="relative mt-6 text-3xl font-bold tracking-tighter">No public offers right now.</p>
              <p className="relative mt-2 text-sm text-ink/55">Check back soon — new drops land every week.</p>
              <Link href="/products" className="group relative mt-8 inline-flex h-12 items-center gap-3 rounded-full bg-ink py-1 pl-6 pr-1 text-sm font-semibold text-white">
                Keep shopping
                <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink transition-transform duration-500 group-hover:rotate-45">
                  <ArrowUpRight size={16} />
                </span>
              </Link>
            </div>
          </Reveal>
        ) : (
          <Stagger className="mt-10 grid gap-5 lg:grid-cols-2" gap={0.08}>
            {coupons.map((c) => (
              <StaggerItem key={c.code} className="h-full">
                <CouponCard coupon={c} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      {/* ---------------------------------------------------- How it works */}
      <section className="container-x mt-24">
        <Reveal>
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tighter md:text-5xl">Three taps to save</h2>
        </Reveal>
        <Stagger className="mt-10 grid gap-4 md:grid-cols-3" gap={0.1}>
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <StaggerItem key={title} className="group card relative overflow-hidden p-7 transition duration-500 hover:-translate-y-1 hover:shadow-neu-lg">
              <span aria-hidden="true" className="absolute -right-2 -top-6 text-[7rem] font-bold leading-none tracking-tighter text-ink/[0.04]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-offwhite transition-colors duration-500 group-hover:bg-ink group-hover:text-white">
                <Icon size={19} strokeWidth={1.75} />
              </span>
              <p className="relative mt-5 font-semibold">{title}</p>
              <p className="relative mt-1 text-sm leading-relaxed text-ink/55">{body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </>
  );
}

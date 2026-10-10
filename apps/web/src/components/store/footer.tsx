import Link from "next/link";
import { ArrowUp, AtSign, MapPin, MessageCircle, Phone } from "lucide-react";
import { BRAND } from "@/lib/brand";
import type { CategoryNode } from "@/lib/types";
import { Reveal, Stagger, StaggerItem } from "./motion";

export function Footer({ categories }: { categories: CategoryNode[] }) {
  const columns = [
    {
      title: "Shop",
      links: [{ label: "Shop all", href: "/products" }, ...categories.map((c) => ({ label: c.name, href: `/category/${c.slug}` })), { label: "Offers", href: "/offers" }],
    },
    {
      title: "Help",
      links: [
        { label: "Track an order", href: "/account/orders" },
        { label: "Returns & refunds", href: "/account/returns" },
        { label: "My account", href: "/account" },
        { label: "Wishlist", href: "/account/wishlist" },
      ],
    },
  ];

  return (
    <footer className="on-dark relative mt-32 overflow-hidden border-t border-gold/30 bg-night text-white">
      {/* Stage-light glows. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-accent/20 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-gold/10 blur-[110px]" />

      <div className="container-x relative grid gap-12 pb-12 pt-16 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr]">
        <Reveal>
          <img src={BRAND.logo} alt={`${BRAND.fullName} — ${BRAND.tagline}`} width={1030} height={724} loading="lazy" className="-ml-3 w-56 mix-blend-screen" />
          <p className="mt-1 font-script text-3xl text-accent-bright">{BRAND.promise}</p>
          <a href="#main" className="group mt-7 inline-flex items-center gap-3 text-sm font-semibold text-gold-bright hover:text-white">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-gold/40 transition-transform duration-500 group-hover:-translate-y-1 group-hover:border-gold-bright">
              <ArrowUp size={16} />
            </span>
            Back to top
          </a>
        </Reveal>

        {columns.map((col) => (
          <div key={col.title}>
            <p className="eyebrow">{col.title}</p>
            <Stagger className="mt-5 space-y-3 text-sm" gap={0.04}>
              {col.links.map((l) => (
                <StaggerItem key={l.href}>
                  <Link href={l.href} className="link-draw text-white/70 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        ))}

        <div>
          <p className="eyebrow">Visit &amp; contact</p>
          <ul className="mt-5 space-y-4 text-sm text-white/75">
            <li className="flex gap-3">
              <MapPin size={17} className="mt-0.5 shrink-0 text-accent" />
              <address className="not-italic leading-relaxed">
                {BRAND.address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </li>
            <li>
              <a href={BRAND.whatsappHref} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 hover:text-white">
                <MessageCircle size={17} className="shrink-0 text-accent" />
                <span className="link-draw">WhatsApp {BRAND.phone}</span>
              </a>
            </li>
            <li>
              <a href={BRAND.phoneHref} className="group flex items-center gap-3 hover:text-white">
                <Phone size={17} className="shrink-0 text-accent" />
                <span className="link-draw">Call {BRAND.phone}</span>
              </a>
            </li>
            <li>
              <a href={BRAND.instagramHref} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 hover:text-white">
                <AtSign size={17} className="shrink-0 text-accent" />
                <span className="link-draw">{BRAND.instagram}</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Oversized gold wordmark that rises in as the footer appears. */}
      <div aria-hidden="true" className="container-x relative select-none overflow-hidden">
        <Reveal y={120} amount={0.1}>
          <p className="text-gold-shine -mb-[0.16em] text-center font-display text-[clamp(4.5rem,21vw,20rem)] font-bold leading-none tracking-wide opacity-25">TRENDZ</p>
        </Reveal>
      </div>

      <div className="relative border-t border-gold/20">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-white/50 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.fullName}. All prices in INR.
          </p>
          <p>Secure payments by Razorpay</p>
        </div>
      </div>
    </footer>
  );
}

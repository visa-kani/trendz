import Link from "next/link";
import { ArrowUp } from "lucide-react";
import type { CategoryNode } from "@/lib/types";
import { Reveal, Stagger, StaggerItem } from "./motion";
import { LogoMark } from "./navbar";

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
    <footer className="relative mt-32 overflow-hidden rounded-t-[2.5rem] bg-ink text-white">
      <div className="container-x grid gap-12 pb-10 pt-16 md:grid-cols-[2fr_1fr_1fr]">
        <Reveal>
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="text-sm font-bold tracking-[0.3em]">TRENDZ</span>
          </div>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">Bold looks. Clean fits. Built to stand out anywhere. Designed and shipped from India.</p>
          <a href="#main" className="group mt-8 inline-flex items-center gap-3 text-sm font-semibold text-white/80 hover:text-white">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 transition-transform duration-500 group-hover:-translate-y-1 group-hover:border-white">
              <ArrowUp size={16} />
            </span>
            Back to top
          </a>
        </Reveal>
        {columns.map((col) => (
          <div key={col.title}>
            <p className="eyebrow text-white/40">{col.title}</p>
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
      </div>

      {/* Oversized wordmark that rises in as the footer appears. */}
      <div aria-hidden="true" className="container-x select-none overflow-hidden">
        <Reveal y={120} amount={0.1}>
          <p className="-mb-[0.18em] text-center text-[clamp(5rem,23vw,22rem)] font-bold leading-none tracking-tighter text-accent/20">TRENDZ</p>
        </Reveal>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col gap-2 py-6 text-xs text-white/45 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Trendz. All prices in INR.</p>
          <p>Secure payments by Razorpay</p>
        </div>
      </div>
    </footer>
  );
}

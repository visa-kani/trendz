import Link from "next/link";
import { LogoMark } from "./navbar";
import type { CategoryNode } from "@/lib/types";

export function Footer({ categories }: { categories: CategoryNode[] }) {
  return (
    <footer className="mt-24 bg-ink text-white">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="text-sm font-semibold tracking-[0.25em]">TRENDZ</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-white/60">Bold looks. Clean fits. Built to stand out anywhere. Designed and shipped from India.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Shop</p>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/category/${c.slug}`} className="hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/offers" className="hover:text-white">
                Offers
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Help</p>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            <li>
              <Link href="/account/orders" className="hover:text-white">
                Track an order
              </Link>
            </li>
            <li>
              <Link href="/account/returns" className="hover:text-white">
                Returns &amp; refunds
              </Link>
            </li>
            <li>
              <Link href="/account" className="hover:text-white">
                My account
              </Link>
            </li>
          </ul>
        </div>
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

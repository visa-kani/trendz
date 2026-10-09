"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import type { CategoryNode } from "@/lib/types";

export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2 L13.8 9.2 21 11 13.8 12.8 12 20 10.2 12.8 3 11 10.2 9.2 Z" fill="currentColor" />
    </svg>
  );
}

function SearchBox({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => api.get<{ name: string; slug: string; sellingPrice: number; image: string | null }[]>("/store/search/suggest", { q: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    onDone?.();
    router.push(`/products?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <input
        id="site-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search products or SKU…"
        className="w-full rounded-full bg-black/[0.04] py-2.5 pl-4 pr-10 text-sm shadow-neu-inset outline-none placeholder:text-ink/45 focus:bg-white focus:ring-4 focus:ring-ink/5"
        autoComplete="off"
      />
      <button type="submit" aria-label="Search" className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/50">
        <Search size={16} />
      </button>
      {open && debounced.length >= 2 && data && data.length > 0 && (
        <ul className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-2xl bg-white p-1 shadow-neu-lg">
          {data.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/products/${s.slug}`}
                onClick={() => {
                  setOpen(false);
                  onDone?.();
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-black/[0.03]"
              >
                {s.image ? <img src={s.image} alt="" className="h-10 w-10 rounded-lg bg-offwhite object-cover" /> : <span className="h-10 w-10 rounded-lg bg-offwhite" />}
                <span className="flex-1 truncate text-sm">{s.name}</span>
                <span className="text-sm font-semibold">{money(s.sellingPrice)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function Navbar({ categories }: { categories: CategoryNode[] }) {
  const pathname = usePathname();
  const { user, status } = useAuth();
  const { data: cart } = useCart();
  const [mobile, setMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // Close the mobile menu on navigation (adjusting state during render, not in an effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobile(false);
  }

  const links = [{ label: "Shop all", href: "/products" }, ...categories.map((c) => ({ label: c.name, href: `/category/${c.slug}` })), { label: "Offers", href: "/offers" }];

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-offwhite/85 backdrop-blur-md">
      <div className="container-x flex h-16 items-center gap-4">
        <button className="-ml-2 rounded-full p-2 lg:hidden" aria-label="Open menu" onClick={() => setMobile(true)}>
          <Menu size={20} />
        </button>
        <Link href="/" className="flex items-center gap-2 text-ink" aria-label="Drift home">
          <LogoMark />
          <span className="text-sm font-semibold tracking-[0.25em]">DRIFT</span>
        </Link>
        <nav aria-label="Main" className="ml-6 hidden items-center gap-7 text-sm font-medium text-ink/65 lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={clsx("transition-colors hover:text-ink", pathname === l.href && "text-ink")}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden w-72 md:block">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <Link
            href={status === "authenticated" ? (user?.isStaff ? "/account" : "/account") : "/login"}
            aria-label={status === "authenticated" ? "Your account" : "Sign in"}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/[0.04]"
          >
            <User size={19} strokeWidth={1.75} />
          </Link>
          <Link href="/cart" aria-label={`Cart, ${cart?.itemCount ?? 0} items`} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-black/[0.04]">
            <ShoppingBag size={19} strokeWidth={1.75} />
            {!!cart?.itemCount && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold text-white">{cart.itemCount}</span>
            )}
          </Link>
        </div>
      </div>

      {mobile && (
        <div className="fixed inset-0 z-50 bg-black/40 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setMobile(false)}>
          <div ref={menuRef} className="h-full w-80 max-w-[85vw] animate-rise overflow-y-auto bg-offwhite p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold tracking-[0.25em]">DRIFT</span>
              <button aria-label="Close menu" onClick={() => setMobile(false)} className="rounded-full p-2 hover:bg-black/5">
                <X size={20} />
              </button>
            </div>
            <SearchBox onDone={() => setMobile(false)} />
            <nav aria-label="Mobile" className="mt-6 flex flex-col gap-1">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-black/[0.04]">
                  {l.label}
                </Link>
              ))}
              <Link href={status === "authenticated" ? "/account" : "/login"} className="rounded-xl px-3 py-3 text-base font-medium hover:bg-black/[0.04]">
                {status === "authenticated" ? "My account" : "Sign in"}
              </Link>
              {user?.isStaff && (
                <Link href="/admin" className="rounded-xl px-3 py-3 text-base font-medium hover:bg-black/[0.04]">
                  Admin
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

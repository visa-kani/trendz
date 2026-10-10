"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, m, useMotionValueEvent, useScroll } from "motion/react";
import { clsx } from "clsx";
import { ArrowRight, ChevronDown, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import type { CategoryNode } from "@/lib/types";
import { useCartDrawer } from "./cart-drawer";
import { EASE_OUT, Marquee } from "./motion";

export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2 L13.8 9.2 21 11 13.8 12.8 12 20 10.2 12.8 3 11 10.2 9.2 Z" fill="currentColor" />
    </svg>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="group flex items-center gap-2 text-ink" aria-label="Trendz home">
      <span className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:rotate-[180deg]">
        <LogoMark />
      </span>
      <span className="text-sm font-bold tracking-[0.3em]">TRENDZ</span>
    </Link>
  );
}

type Suggestion = { name: string; slug: string; sellingPrice: number; image: string | null };

/** Full-width search panel with live suggestions. */
function SearchPanel({ categories, onClose }: { categories: CategoryNode[]; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const { data, isFetching } = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () => api.get<Suggestion[]>("/store/search/suggest", { q: debounced }),
    enabled: debounced.length >= 2,
    staleTime: 60_000,
  });
  const results = debounced.length >= 2 ? (data ?? []) : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    onClose();
    router.push(`/products?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      <m.div className="fixed inset-0 top-0 z-30 bg-ink/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <m.div
        className="absolute inset-x-0 top-full z-40 border-b border-black/5 bg-offwhite shadow-neu-lg"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        <div className="container-x py-8">
          <form role="search" onSubmit={submit} className="relative">
            <label htmlFor="site-search" className="sr-only">
              Search products
            </label>
            <Search size={22} className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-ink/40" />
            <input
              ref={input}
              id="site-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tees, denim, hoodies…"
              autoComplete="off"
              className="w-full border-b-2 border-ink/10 bg-transparent py-4 pl-10 pr-28 text-2xl font-semibold tracking-tight outline-none transition placeholder:font-normal placeholder:text-ink/30 focus:border-ink md:text-3xl"
            />
            <button type="submit" className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white">
              Search <ArrowRight size={14} />
            </button>
          </form>

          {results.length > 0 ? (
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {results.map((s, i) => (
                <m.li key={s.slug} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.45, ease: EASE_OUT }}>
                  <Link href={`/products/${s.slug}`} onClick={onClose} className="group block">
                    <span className="block aspect-[4/5] overflow-hidden rounded-2xl bg-white">
                      {s.image ? <img src={s.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <span className="block h-full w-full bg-mist" />}
                    </span>
                    <span className="mt-2 line-clamp-1 block text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-ink/55">{money(s.sellingPrice)}</span>
                  </Link>
                </m.li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="eyebrow mr-2">{debounced.length >= 2 && !isFetching ? "No matches — try" : "Popular"}</span>
              {categories.flatMap((c) => [c, ...c.children]).slice(0, 8).map((c) => (
                <Link key={c.id} href={`/category/${c.slug}`} onClick={onClose} className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-sm transition hover:border-ink hover:bg-ink hover:text-white">
                  {c.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </m.div>
    </>
  );
}

function MobileMenu({ links, categories, onClose }: { links: { label: string; href: string }[]; categories: CategoryNode[]; onClose: () => void }) {
  const { user, status } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  const item = { hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: EASE_OUT } } };

  return (
    <div className="fixed inset-0 z-[55] lg:hidden">
      <m.div className="absolute inset-0 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <m.nav
        aria-label="Mobile"
        className="absolute inset-y-0 left-0 flex w-[22rem] max-w-[88vw] flex-col overflow-y-auto bg-offwhite p-6"
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
      >
        <div className="mb-8 flex items-center justify-between">
          <Wordmark />
          <button aria-label="Close menu" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full transition hover:rotate-90 hover:bg-black/5">
            <X size={20} />
          </button>
        </div>
        <m.ul className="flex flex-col" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } }}>
          {links.map((l) => {
            const cat = categories.find((c) => `/category/${c.slug}` === l.href);
            const open = expanded === l.href;
            return (
              <m.li key={l.href} variants={item} className="border-b border-black/5">
                <div className="flex items-center">
                  <Link href={l.href} onClick={onClose} className="flex-1 py-4 text-2xl font-bold tracking-tight">
                    {l.label}
                  </Link>
                  {!!cat?.children.length && (
                    <button aria-label={`${open ? "Hide" : "Show"} ${l.label} categories`} aria-expanded={open} onClick={() => setExpanded(open ? null : l.href)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5">
                      <ChevronDown size={18} className={clsx("transition-transform duration-300", open && "rotate-180")} />
                    </button>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {open && cat && (
                    <m.ul className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
                      {cat.children.map((c) => (
                        <li key={c.id}>
                          <Link href={`/category/${c.slug}`} onClick={onClose} className="block py-2 pl-3 text-sm text-ink/65 hover:text-ink">
                            {c.name}
                          </Link>
                        </li>
                      ))}
                      <li className="pb-3" />
                    </m.ul>
                  )}
                </AnimatePresence>
              </m.li>
            );
          })}
        </m.ul>
        <div className="mt-auto space-y-2 pt-8 text-sm">
          <Link href={status === "authenticated" ? "/account" : "/login"} onClick={onClose} className="flex items-center gap-2 font-semibold">
            <User size={16} /> {status === "authenticated" ? "My account" : "Sign in / Register"}
          </Link>
          {user?.isStaff && (
            <Link href="/admin" onClick={onClose} className="block text-ink/60">
              Admin panel
            </Link>
          )}
        </div>
      </m.nav>
    </div>
  );
}

export function Navbar({ categories, announcements = [] }: { categories: CategoryNode[]; announcements?: string[] }) {
  const pathname = usePathname();
  const { status } = useAuth();
  const { data: cart } = useCart();
  const { openCart } = useCartDrawer();
  const [mobile, setMobile] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [megaFor, setMegaFor] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeSearch = useCallback(() => setSearching(false), []);
  const closeMobile = useCallback(() => setMobile(false), []);

  // Close menus on navigation (adjusting state during render, not in an effect).
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobile(false);
    setSearching(false);
    setMegaFor(null);
  }

  // Hide the bar while scrolling down, bring it back on the way up.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 8);
    setHidden(y > 160 && y > prev && !searching && !megaFor);
  });

  // "/" opens search from anywhere (except while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.key === "/" && !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const links = [{ label: "Shop all", href: "/products" }, ...categories.map((c) => ({ label: c.name, href: `/category/${c.slug}` })), { label: "Offers", href: "/offers" }];
  const mega = categories.find((c) => c.slug === megaFor && c.children.length);
  const openMega = (slug: string | null) => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMegaFor(slug), slug ? 80 : 160);
  };
  const count = cart?.itemCount ?? 0;

  return (
    <m.header className="sticky top-0 z-40" animate={{ y: hidden ? "-100%" : "0%" }} transition={{ duration: 0.4, ease: EASE_OUT }}>
      {announcements.length > 0 && (
        <div className="bg-ink py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-white/85">
          <Marquee>
            {announcements.map((a) => (
              <span key={a} className="flex items-center gap-8 pr-8">
                {a}
                <span className="text-accent">✦</span>
              </span>
            ))}
          </Marquee>
        </div>
      )}
      <div className={clsx("relative border-b transition-[background-color,box-shadow,border-color] duration-500", scrolled || searching || megaFor ? "border-black/5 bg-offwhite/90 shadow-[0_8px_30px_-20px_rgba(17,17,17,0.25)] backdrop-blur-xl" : "border-transparent bg-offwhite")}>
        <div className="container-x flex h-16 items-center gap-4">
          <button className="-ml-2 grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 lg:hidden" aria-label="Open menu" onClick={() => setMobile(true)}>
            <Menu size={20} />
          </button>
          <Wordmark />

          <nav aria-label="Main" className="ml-8 hidden items-center lg:flex" onMouseLeave={() => { setHovered(null); openMega(null); }}>
            {links.map((l) => {
              const cat = categories.find((c) => `/category/${c.slug}` === l.href);
              const active = pathname === l.href || (l.href !== "/products" && pathname.startsWith(l.href));
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onMouseEnter={() => {
                    setHovered(l.href);
                    openMega(cat?.children.length ? cat.slug : null);
                  }}
                  onFocus={() => setHovered(l.href)}
                  className={clsx("relative flex items-center gap-1 px-3.5 py-2 text-sm font-medium transition-colors", active || hovered === l.href ? "text-ink" : "text-ink/60")}
                >
                  {l.label}
                  {!!cat?.children.length && <ChevronDown size={13} className={clsx("transition-transform duration-300", megaFor === cat.slug && "rotate-180")} />}
                  {(hovered ?? (active ? l.href : null)) === l.href && (
                    <m.span layoutId="nav-underline" className="absolute inset-x-3.5 -bottom-0.5 h-[2px] rounded-full bg-accent" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setSearching((s) => !s)}
              aria-label={searching ? "Close search" : "Search"}
              aria-expanded={searching}
              className="group flex h-10 items-center gap-2 rounded-full px-3 text-sm text-ink/60 transition hover:bg-black/5 hover:text-ink md:w-56 md:justify-between md:border md:border-black/10 md:bg-white"
            >
              <span className="hidden md:inline">Search…</span>
              <span className="flex items-center gap-2">
                <kbd className="hidden rounded-md border border-black/10 px-1.5 text-[10px] font-semibold text-ink/40 md:inline">/</kbd>
                {searching ? <X size={18} /> : <Search size={18} strokeWidth={1.75} />}
              </span>
            </button>
            <Link href={status === "authenticated" ? "/account" : "/login"} aria-label={status === "authenticated" ? "Your account" : "Sign in"} className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5">
              <User size={19} strokeWidth={1.75} />
            </Link>
            <button onClick={openCart} aria-label={`Open bag, ${count} items`} className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-black/5">
              <ShoppingBag size={19} strokeWidth={1.75} />
              <AnimatePresence>
                {count > 0 && (
                  <m.span
                    key={count}
                    className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: [1.45, 1], opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  >
                    {count}
                  </m.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Category mega menu */}
        <AnimatePresence>
          {mega && (
            <m.div
              key={mega.slug}
              className="absolute inset-x-0 top-full hidden border-b border-black/5 bg-offwhite shadow-neu-lg lg:block"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              onMouseEnter={() => openMega(mega.slug)}
              onMouseLeave={() => openMega(null)}
            >
              <div className="container-x grid grid-cols-[1fr_2fr] gap-10 py-10">
                <div>
                  <p className="eyebrow">Collection</p>
                  <p className="mt-2 text-4xl font-bold tracking-tighter">{mega.name}</p>
                  {mega.description && <p className="mt-2 max-w-xs text-sm text-ink/55">{mega.description}</p>}
                  <Link href={`/category/${mega.slug}`} className="group mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                    Shop all {mega.name}
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
                <m.ul className="grid grid-cols-3 gap-3" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04 } } }}>
                  {mega.children.map((c) => (
                    <m.li key={c.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                      <Link href={`/category/${c.slug}`} className="group flex items-center justify-between rounded-2xl bg-white px-5 py-4 text-sm font-semibold shadow-neu transition hover:-translate-y-0.5 hover:shadow-neu-lg">
                        {c.name}
                        <ArrowRight size={14} className="-translate-x-2 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    </m.li>
                  ))}
                </m.ul>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence>{searching && <SearchPanel categories={categories} onClose={closeSearch} />}</AnimatePresence>
      </div>

      <AnimatePresence>{mobile && <MobileMenu links={links} categories={categories} onClose={closeMobile} />}</AnimatePresence>
    </m.header>
  );
}

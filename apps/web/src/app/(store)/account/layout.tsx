"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Bell, Heart, LayoutDashboard, LogOut, MapPin, Package, RotateCcw, Shield, UserCog } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/returns", label: "Returns & refunds", icon: RotateCcw },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
  { href: "/account/profile", label: "Profile & security", icon: UserCog },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  return (
    <RequireAuth>
      <div className="container-x py-10">
        <div className="grid gap-8 lg:grid-cols-[230px_1fr]">
          <aside>
            <p className="text-xs text-ink/50">Signed in as</p>
            <p className="truncate font-semibold">{user?.name ?? user?.email ?? user?.phone}</p>
            <nav aria-label="Account" className="mt-5 flex gap-1 overflow-x-auto lg:flex-col">
              {NAV.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx("flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition", active ? "bg-white shadow-neu" : "text-ink/60 hover:bg-black/[0.03] hover:text-ink")}
                  >
                    <Icon size={16} strokeWidth={1.75} /> {label}
                  </Link>
                );
              })}
              {user?.isStaff && (
                <Link href="/admin" className="flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-ink/60 hover:bg-black/[0.03] hover:text-ink">
                  <Shield size={16} strokeWidth={1.75} /> Admin panel
                </Link>
              )}
              <button onClick={() => void logout()} className="flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink/60 hover:bg-black/[0.03] hover:text-ink">
                <LogOut size={16} strokeWidth={1.75} /> Sign out
              </button>
            </nav>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </RequireAuth>
  );
}

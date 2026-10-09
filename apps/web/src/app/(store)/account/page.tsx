"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, Spinner, StatusBadge } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth";
import { date, money } from "@/lib/format";
import type { OrderListItem } from "@/lib/types";

export default function AccountOverview() {
  const { user } = useAuth();
  const orders = useQuery({ queryKey: ["my-orders", 1], queryFn: () => api.page<OrderListItem[]>("/account/orders", { page: 1, limit: 5 }) });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Hi {user?.name?.split(" ")[0] ?? "there"} 👋</h1>
      {!user?.emailVerified && user?.email && <VerifyBanner />}
      <Card title="Recent orders" actions={<Link href="/account/orders" className="link text-xs">View all</Link>} padded={false}>
        {orders.isLoading ? (
          <Spinner />
        ) : !orders.data?.data.length ? (
          <EmptyState title="No orders yet" body="When you place an order it will appear here." action={<Link href="/products" className="link text-sm">Start shopping</Link>} />
        ) : (
          <ul className="divide-y divide-black/5">
            {orders.data.data.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.orderNumber}`} className="flex items-center gap-4 px-5 py-4 hover:bg-black/[0.02]">
                  <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-offwhite">{o.items[0]?.imageUrl && <img src={o.items[0].imageUrl} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{o.orderNumber}</p>
                    <p className="truncate text-xs text-ink/55">
                      {date(o.placedAt)} · {o._count.items} item{o._count.items === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                  <span className="hidden text-sm font-semibold sm:block">{money(o.grandTotal)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function VerifyBanner() {
  const toast = useToast();
  const send = async () => {
    try {
      await api.post("/auth/verify-email/request");
      toast("Verification email sent. Check your inbox.");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning/10 px-5 py-4 text-sm text-warning">
      <span>Please verify your email address to receive order updates.</span>
      <button onClick={send} className="font-semibold underline underline-offset-4">
        Resend verification email
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, ErrorState, Pagination, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date, money } from "@/lib/format";
import type { OrderListItem } from "@/lib/types";

export default function MyOrdersPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["my-orders", page], queryFn: () => api.page<OrderListItem[]>("/account/orders", { page, limit: 10 }) });
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Your orders</h1>
      <Card padded={false}>
        {q.isLoading ? (
          <Spinner />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : !q.data?.data.length ? (
          <EmptyState title="No orders yet" action={<Link href="/products" className="link text-sm">Start shopping</Link>} />
        ) : (
          <ul className="divide-y divide-black/5">
            {q.data.data.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.orderNumber}`} className="flex items-center gap-4 px-5 py-4 hover:bg-black/[0.02]">
                  <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-offwhite">{o.items[0]?.imageUrl && <img src={o.items[0].imageUrl} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{o.orderNumber}</p>
                    <p className="truncate text-xs text-ink/55">
                      {date(o.placedAt)} · {o.items[0]?.productName}
                      {o._count.items > 1 ? ` + ${o._count.items - 1} more` : ""}
                    </p>
                    {o.status === "PENDING" && o.paymentStatus !== "PAID" && <p className="mt-1 text-xs font-semibold text-warning">Payment pending</p>}
                  </div>
                  <StatusBadge status={o.status} />
                  <span className="hidden w-24 text-right text-sm font-semibold sm:block">{money(o.grandTotal)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, Pagination, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { date } from "@/lib/format";

interface ReturnRow {
  id: string;
  returnNumber: string;
  status: string;
  reason: string;
  createdAt: string;
  order: { orderNumber: string };
  items: { quantity: number }[];
}

export default function MyReturnsPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["my-returns", page], queryFn: () => api.page<ReturnRow[]>("/account/returns", { page, limit: 10 }) });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Returns &amp; refunds</h1>
        <p className="mt-1 text-sm text-ink/55">To start a return, open a delivered order and choose “Return items”.</p>
      </div>
      <Card padded={false}>
        {q.isLoading ? (
          <Spinner />
        ) : !q.data?.data.length ? (
          <EmptyState title="No returns" body="Returns you request will appear here with their refund status." />
        ) : (
          <ul className="divide-y divide-black/5">
            {q.data.data.map((r) => (
              <li key={r.id}>
                <Link href={`/account/returns/${r.returnNumber}`} className="flex items-center gap-4 px-5 py-4 hover:bg-black/[0.02]">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{r.returnNumber}</p>
                    <p className="truncate text-xs text-ink/55">
                      Order {r.order.orderNumber} · {date(r.createdAt)} · {r.items.reduce((s, i) => s + i.quantity, 0)} item(s) · {r.reason}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
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

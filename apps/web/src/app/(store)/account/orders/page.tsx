"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { AccountHeader, EmptyPanel, OrderRow, Panel, RowsSkeleton, StaggerList, StaggerRow } from "@/components/store/account-ui";
import { CtaLink } from "@/components/store/checkout-ui";
import { ErrorState, Pagination } from "@/components/ui";
import { api } from "@/lib/api";
import { date } from "@/lib/format";
import type { OrderListItem } from "@/lib/types";

export default function MyOrdersPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["my-orders", page], queryFn: () => api.page<OrderListItem[]>("/account/orders", { page, limit: 10 }) });
  const empty = !q.isLoading && !q.error && !q.data?.data.length;

  return (
    <div className="space-y-8">
      <AccountHeader eyebrow="Orders" title="Your orders" description="Every order you've placed, newest first. Open one to track it, pay, return or download the invoice." />
      {empty ? (
        <EmptyPanel icon={<Package size={28} strokeWidth={1.5} />} title="No orders yet" body="Your first order will show up here." action={<CtaLink href="/products">Start shopping</CtaLink>} />
      ) : (
        <Panel padded={false}>
          {q.isLoading ? (
            <RowsSkeleton rows={4} label="Loading your orders" />
          ) : q.error ? (
            <ErrorState error={q.error} retry={() => q.refetch()} />
          ) : (
            <StaggerList key={page} className="divide-y divide-black/5 py-1">
              {q.data?.data.map((o) => (
                <StaggerRow key={o.id}>
                  <OrderRow
                    order={o}
                    meta={
                      <>
                        {date(o.placedAt)} · {o.items[0]?.productName}
                        {o._count.items > 1 ? ` + ${o._count.items - 1} more` : ""}
                      </>
                    }
                  />
                </StaggerRow>
              ))}
            </StaggerList>
          )}
        </Panel>
      )}
      <Pagination meta={q.data?.meta} onPage={setPage} />
    </div>
  );
}

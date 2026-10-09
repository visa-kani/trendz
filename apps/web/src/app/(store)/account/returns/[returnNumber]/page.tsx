"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, Spinner, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { dateTime, money } from "@/lib/format";

interface ReturnDetail {
  returnNumber: string;
  status: string;
  reason: string;
  customerNotes: string | null;
  adminNotes: string | null;
  requestedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  order: { orderNumber: string };
  items: { id: string; quantity: number; condition: string | null; refundAmount: number; orderItem: { productName: string; variantTitle: string; imageUrl: string | null } }[];
  refunds: { id: string; refundNumber: string; amount: number; status: string; createdAt: string }[];
}

const STEPS = ["REQUESTED", "APPROVED", "RECEIVED", "REFUNDED"];

export default function ReturnDetailPage({ params }: { params: Promise<{ returnNumber: string }> }) {
  const { returnNumber } = use(params);
  const q = useQuery({ queryKey: ["return", returnNumber], queryFn: () => api.get<ReturnDetail>(`/account/returns/${encodeURIComponent(returnNumber)}`) });
  if (q.isLoading || !q.data) return <Spinner />;
  const r = q.data;
  const step = STEPS.indexOf(r.status === "CLOSED" ? "REFUNDED" : r.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account/returns" className="text-xs text-ink/50 hover:text-ink">
          ← All returns
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Return {r.returnNumber}</h1>
          <StatusBadge status={r.status} />
        </div>
        <p className="text-sm text-ink/55">
          For order{" "}
          <Link href={`/account/orders/${r.order.orderNumber}`} className="link">
            {r.order.orderNumber}
          </Link>{" "}
          · requested {dateTime(r.requestedAt)}
        </p>
      </div>
      {r.status !== "REJECTED" && r.status !== "CANCELLED" && (
        <Card title="Progress">
          <ol className="grid grid-cols-4 gap-2 text-center text-[11px] font-medium">
            {STEPS.map((s, i) => (
              <li key={s} className="flex flex-col gap-2">
                <span className={`h-2 rounded-full ${i <= step ? "bg-ink" : "bg-black/10"}`} />
                <span className={i <= step ? "" : "text-ink/40"}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {r.adminNotes && (
        <Card title="Message from our team">
          <p className="text-sm text-ink/70">{r.adminNotes}</p>
        </Card>
      )}
      <Card title="Items" padded={false}>
        <ul className="divide-y divide-black/5">
          {r.items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 px-5 py-4 text-sm">
              <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-offwhite">{i.orderItem.imageUrl && <img src={i.orderItem.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
              <span className="flex-1">
                {i.orderItem.productName} <span className="text-ink/50">· {i.orderItem.variantTitle} × {i.quantity}</span>
              </span>
              {i.condition && <StatusBadge status={i.condition} />}
            </li>
          ))}
        </ul>
      </Card>
      {r.refunds.length > 0 && (
        <Card title="Refund">
          {r.refunds.map((f) => (
            <div key={f.id} className="flex items-center justify-between text-sm">
              <span>
                {f.refundNumber} · {money(f.amount)} · {dateTime(f.createdAt)}
              </span>
              <StatusBadge status={f.status} />
            </div>
          ))}
          <p className="mt-3 text-xs text-ink/50">Refunds to cards and UPI usually reach your account in 5–7 business days.</p>
        </Card>
      )}
    </div>
  );
}

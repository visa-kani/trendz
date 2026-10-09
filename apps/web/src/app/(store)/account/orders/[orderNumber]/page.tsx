"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Download, ExternalLink, RotateCcw, XCircle } from "lucide-react";
import { PayButton } from "@/components/store/pay-button";
import { Button, Card, ConfirmDialog, Spinner, StatusBadge, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, download, errorMessage } from "@/lib/api";
import { date, dateTime, money } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

const FLOW: OrderStatus[] = ["CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const LABEL: Partial<Record<OrderStatus, string>> = { CONFIRMED: "Confirmed", PACKED: "Packed", SHIPPED: "Shipped", OUT_FOR_DELIVERY: "Out for delivery", DELIVERED: "Delivered" };

export default function OrderDetailPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["order", orderNumber], queryFn: () => api.get<Order>(`/account/orders/${orderNumber}`) });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useMutation({
    mutationFn: () => api.post<Order>(`/account/orders/${orderNumber}/cancel`, { reason }),
    onSuccess: (o) => {
      qc.setQueryData(["order", orderNumber], o);
      setCancelOpen(false);
      toast(o.paymentStatus === "PAID" || o.amountRefunded ? "Order cancelled. Your refund has been initiated." : "Order cancelled");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (q.isLoading || !q.data) return <Spinner />;
  const o = q.data;
  const reached = FLOW.indexOf(o.status);
  const cancelled = o.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-xs text-ink/50 hover:text-ink">
            ← All orders
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Order {o.orderNumber}</h1>
          <p className="text-sm text-ink/55">Placed {dateTime(o.placedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={o.status} />
          <StatusBadge status={o.paymentStatus} />
        </div>
      </div>

      {o.canPay && (
        <Card title="Complete your payment">
          <p className="mb-4 text-sm text-ink/60">
            This order is reserved until {o.reservationExpiresAt ? dateTime(o.reservationExpiresAt) : "shortly"}. Pay now to confirm it.
          </p>
          <div className="max-w-sm">
            <PayButton orderId={o.id} amount={o.grandTotal} onOutcome={(r) => (r.status === "paid" ? q.refetch() : r.status === "failed" ? toast(r.message, "error") : undefined)} />
          </div>
        </Card>
      )}

      {!cancelled && o.status !== "PENDING" && (
        <Card title="Progress">
          <ol className="grid grid-cols-5 gap-2">
            {FLOW.map((s, i) => (
              <li key={s} className="flex flex-col items-center gap-2 text-center">
                <span className={clsx("h-2 w-full rounded-full", i <= reached ? "bg-ink" : "bg-black/10")} />
                <span className={clsx("text-[11px] font-medium", i <= reached ? "text-ink" : "text-ink/40")}>{LABEL[s]}</span>
              </li>
            ))}
          </ol>
          {o.shipments.map((s) => (
            <div key={s.id} className="mt-5 rounded-2xl bg-offwhite p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="font-semibold">{s.courierName ?? "Courier"}</span> · AWB {s.awb ?? "pending"}
                </p>
                {s.trackingUrl && (
                  <a href={s.trackingUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-xs font-semibold underline">
                    Track <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <ul className="mt-3 space-y-2 border-l border-black/10 pl-4">
                {s.events.slice(0, 6).map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="font-medium">{e.rawStatus}</span>
                    {e.location ? ` · ${e.location}` : ""} <span className="text-ink/45">· {dateTime(e.occurredAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}

      <Card title="Items" padded={false}>
        <ul className="divide-y divide-black/5">
          {o.items.map((i) => (
            <li key={i.id} className="flex items-center gap-4 px-5 py-4">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-offwhite">{i.imageUrl && <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{i.productName}</p>
                <p className="text-ink/55">
                  {i.variantTitle} · Qty {i.quantity} · SKU {i.sku}
                </p>
                {i.returnedQuantity > 0 && <p className="text-xs text-ink/50">{i.returnedQuantity} returned</p>}
              </div>
              <span className="text-sm font-semibold">{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-black/5 px-5 py-4 text-sm">
          <Row label="Subtotal" value={money(o.subtotal)} />
          {o.discountTotal > 0 && <Row label={`Discounts${o.couponCode ? ` (${o.couponCode})` : ""}`} value={`− ${money(o.discountTotal)}`} />}
          <Row label="Shipping" value={o.shippingTotal ? money(o.shippingTotal) : "Free"} />
          <Row label="GST included" value={money(o.taxTotal)} />
          <Row label="Total" value={money(o.grandTotal)} strong />
          {o.amountRefunded > 0 && <Row label="Refunded" value={money(o.amountRefunded)} />}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {o.shippingAddress && (
          <Card title="Delivery address">
            <p className="text-sm">
              <span className="font-semibold">{o.shippingAddress.fullName}</span>
              <br />
              {[o.shippingAddress.line1, o.shippingAddress.line2, o.shippingAddress.landmark].filter(Boolean).join(", ")}
              <br />
              {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}
              <br />
              {o.shippingAddress.phone}
            </p>
          </Card>
        )}
        <Card title="Payment & documents">
          <ul className="space-y-2 text-sm">
            {o.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3">
                <span>
                  {p.method ?? p.provider} {p.paidAt ? `· ${date(p.paidAt)}` : ""}
                </span>
                <StatusBadge status={p.status} />
              </li>
            ))}
            {o.refunds.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 text-ink/70">
                <span>
                  Refund {r.refundNumber} · {money(r.amount)}
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
          {o.invoice && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              icon={<Download size={14} />}
              onClick={() => download(`/account/orders/${o.orderNumber}/invoice.pdf`, `${o.invoice!.invoiceNumber.replace(/\//g, "-")}.pdf`).catch((e) => toast(errorMessage(e), "error"))}
            >
              Download invoice {o.invoice.invoiceNumber}
            </Button>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        {o.canReturn && (
          <Link href={`/account/returns/new?order=${o.orderNumber}`}>
            <Button variant="outline" icon={<RotateCcw size={15} />}>
              Return items
            </Button>
          </Link>
        )}
        {o.canCancel && (
          <Button variant="outline" icon={<XCircle size={15} />} onClick={() => setCancelOpen(true)}>
            Cancel order
          </Button>
        )}
        {o.returnWindowEnds && o.status === "DELIVERED" && <p className="self-center text-xs text-ink/50">Returns accepted until {date(o.returnWindowEnds)}</p>}
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        body={o.paymentStatus === "PAID" ? "You will receive a full refund to your original payment method." : "Your reserved items will be released."}
        confirmLabel="Cancel order"
        tone="danger"
        loading={cancel.isPending}
        onConfirm={() => (reason.trim().length >= 3 ? cancel.mutate() : toast("Tell us why you are cancelling", "info"))}
        onClose={() => setCancelOpen(false)}
      >
        <label htmlFor="reason" className="label mt-4">
          Reason
        </label>
        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. ordered the wrong size" className="min-h-16" />
      </ConfirmDialog>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={clsx("flex justify-between", strong && "pt-1 text-base font-bold")}>
      <span className={strong ? "" : "text-ink/60"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

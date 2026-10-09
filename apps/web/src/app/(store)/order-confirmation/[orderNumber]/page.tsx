"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Button, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import type { Order } from "@/lib/types";

export default function ConfirmationPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = use(params);
  return (
    <RequireAuth>
      <Confirmation orderNumber={orderNumber} />
    </RequireAuth>
  );
}

function Confirmation({ orderNumber }: { orderNumber: string }) {
  const { data: order, isLoading } = useQuery({ queryKey: ["order", orderNumber], queryFn: () => api.get<Order>(`/account/orders/${orderNumber}`) });
  if (isLoading || !order) return <Spinner className="py-32" />;
  return (
    <div className="container-x max-w-2xl py-16">
      <div className="card p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto text-success" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Thank you! Your order is confirmed.</h1>
        <p className="mt-2 text-sm text-ink/60">
          Order <strong>{order.orderNumber}</strong> · {money(order.grandTotal)} paid. A confirmation has been sent to {order.customerEmail ?? order.customerPhone ?? "you"}.
        </p>
        <ul className="mt-8 divide-y divide-black/5 text-left">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 py-3 text-sm">
              <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-offwhite">{i.imageUrl && <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
              <span className="flex-1">
                {i.productName} <span className="text-ink/50">· {i.variantTitle} × {i.quantity}</span>
              </span>
              <span className="font-semibold">{money(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={`/account/orders/${order.orderNumber}`}>
            <Button className="w-full">Track this order</Button>
          </Link>
          <Link href="/products">
            <Button variant="outline" className="w-full">
              Continue shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

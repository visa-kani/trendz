"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button, Card, Field, Select, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import type { Order } from "@/lib/types";

const REASONS = ["Size too small", "Size too large", "Damaged or defective", "Not as described", "Wrong item received", "Changed my mind"];

export default function NewReturnPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewReturn />
    </Suspense>
  );
}

function NewReturn() {
  const orderNumber = useSearchParams().get("order") ?? "";
  const router = useRouter();
  const toast = useToast();
  const q = useQuery({ queryKey: ["order", orderNumber], queryFn: () => api.get<Order>(`/account/orders/${orderNumber}`), enabled: !!orderNumber });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(REASONS[0]!);
  const [notes, setNotes] = useState("");

  const submit = useMutation({
    mutationFn: () =>
      api.post<{ returnNumber: string }>("/account/returns", {
        orderNumber,
        reason,
        notes: notes || undefined,
        items: Object.entries(qty)
          .filter(([, n]) => n > 0)
          .map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      }),
    onSuccess: (r) => {
      toast(`Return ${r.returnNumber} requested`);
      router.replace(`/account/returns/${r.returnNumber}`);
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  if (q.isLoading || !q.data) return <Spinner />;
  const o = q.data;
  if (!o.canReturn) return <p className="text-sm text-ink/60">This order is not eligible for return.</p>;

  // Units already in another return request cannot be requested again.
  const inReturn = (itemId: string) => o.returnRequests.filter((r) => !["REJECTED", "CANCELLED"].includes(r.status)).flatMap((r) => r.items).filter((i) => i.orderItemId === itemId).reduce((s, i) => s + i.quantity, 0);
  const selected = Object.values(qty).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Return items from {o.orderNumber}</h1>
      <Card title="Choose items">
        <ul className="divide-y divide-black/5">
          {o.items.map((i) => {
            const max = i.quantity - inReturn(i.id);
            return (
              <li key={i.id} className="flex items-center gap-4 py-3">
                <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-offwhite">{i.imageUrl && <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{i.productName}</p>
                  <p className="text-ink/55">
                    {i.variantTitle} · paid {money(Math.round(i.lineTotal / i.quantity))} each
                  </p>
                </div>
                <Select aria-label={`Quantity to return for ${i.productName}`} className="w-24" value={qty[i.id] ?? 0} disabled={max <= 0} onChange={(e) => setQty((s) => ({ ...s, [i.id]: Number(e.target.value) }))}>
                  {Array.from({ length: Math.max(0, max) + 1 }, (_, n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title="Why are you returning?">
        <div className="space-y-4">
          <Field label="Reason" htmlFor="reason">
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Anything else? (optional)" htmlFor="notes">
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </Field>
        </div>
      </Card>
      <Button size="lg" disabled={!selected} loading={submit.isPending} onClick={() => submit.mutate()}>
        Request return ({selected} item{selected === 1 ? "" : "s"})
      </Button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Check, MapPin, Plus, ShieldCheck } from "lucide-react";
import { AddressForm } from "@/components/store/address-form";
import { OrderSummary } from "@/components/store/order-summary";
import { PayButton } from "@/components/store/pay-button";
import { RequireAuth } from "@/components/require-auth";
import { Button, Card, Spinner, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, ApiError, errorMessage, newIdempotencyKey } from "@/lib/api";
import { CART_KEY, useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import type { Address, Order, PricedLine, QuoteTotals } from "@/lib/types";

type Quote = QuoteTotals & { lines: PricedLine[]; issues: string[]; canPlaceOrder: boolean };

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <Checkout />
    </RequireAuth>
  );
}

function Checkout() {
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: cart, isLoading: cartLoading } = useCart();
  const addresses = useQuery({ queryKey: ["addresses"], queryFn: () => api.get<Address[]>("/account/addresses") });
  const [chosenAddressId, setAddressId] = useState<string | null>(null);
  const [addingNew, setAdding] = useState(false);
  // Default to the default shipping address; with no saved address, show the form.
  const addressId = chosenAddressId ?? (addresses.data?.find((a) => a.isDefaultShipping) ?? addresses.data?.[0])?.id ?? null;
  const adding = addingNew || (!!addresses.data && !addresses.data.length);
  const [notes, setNotes] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // One key per order attempt: retries/double clicks reuse it, so only one order is created.
  const attemptKey = useRef(newIdempotencyKey());

  const quote = useQuery({
    queryKey: ["checkout-quote", addressId, cart?.coupon?.code, cart?.itemCount, cart?.grandTotal],
    queryFn: () => api.post<Quote>("/checkout/quote", { shippingAddressId: addressId }),
    enabled: !!addressId && !!cart?.itemCount && !order,
  });

  const place = useMutation({
    mutationFn: () =>
      api.post<Order>("/orders", { shippingAddressId: addressId, notes: notes || undefined, expectedGrandTotal: quote.data?.grandTotal }, { idempotencyKey: attemptKey.current }),
    onSuccess: (o) => {
      setOrder(o);
      void qc.invalidateQueries({ queryKey: CART_KEY });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === "PRICE_CHANGED") {
        toast(err.message, "info");
        attemptKey.current = newIdempotencyKey();
        void quote.refetch();
      } else toast(errorMessage(err), "error");
    },
  });

  if (cartLoading || addresses.isLoading) return <Spinner className="py-32" />;
  if (!order && !cart?.itemCount) {
    return (
      <div className="container-x py-24 text-center">
        <p className="font-semibold">Your bag is empty</p>
        <Link href="/products" className="link mt-2 inline-block text-sm">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="container-x py-10">
      <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title={<Step n={1} done={!!addressId && !adding} label="Delivery address" />}>
            {adding ? (
              <AddressForm
                onSaved={(a) => {
                  void qc.invalidateQueries({ queryKey: ["addresses"] });
                  setAddressId(a.id);
                  setAdding(false);
                }}
                onCancel={addresses.data?.length ? () => setAdding(false) : undefined}
              />
            ) : (
              <div className="space-y-3">
                {addresses.data?.map((a) => (
                  <label key={a.id} className={clsx("flex cursor-pointer gap-3 rounded-2xl border p-4 transition", addressId === a.id ? "border-ink bg-offwhite" : "border-black/10 hover:border-ink/30")}>
                    <input type="radio" name="address" className="mt-1 accent-ink" checked={addressId === a.id} onChange={() => setAddressId(a.id)} disabled={!!order} />
                    <div className="text-sm">
                      <p className="font-semibold">
                        {a.fullName} <span className="font-normal text-ink/50">· {a.phone}</span>
                      </p>
                      <p className="text-ink/65">
                        {[a.line1, a.line2, a.landmark].filter(Boolean).join(", ")}, {a.city}, {a.state} {a.postalCode}
                      </p>
                    </div>
                  </label>
                ))}
                {!order && (
                  <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
                    Add a new address
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card title={<Step n={2} done={!!order} label="Review items" />}>
            {quote.isLoading && <Spinner label="Calculating totals" />}
            {quote.data && (
              <ul className="divide-y divide-black/5">
                {quote.data.lines.map((l) => (
                  <li key={l.variantId} className="flex items-center gap-3 py-3">
                    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-offwhite">{l.imageUrl && <img src={l.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="text-ink/55">
                        {l.variantTitle} × {l.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">{money(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            )}
            {!!quote.data?.issues.length && (
              <ul className="mt-3 space-y-1 rounded-xl bg-warning/10 p-3 text-sm text-warning">
                {quote.data.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
            {!order && (
              <div className="mt-4">
                <label htmlFor="notes" className="label">
                  Delivery notes (optional)
                </label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="min-h-16" placeholder="e.g. call before delivery" />
              </div>
            )}
          </Card>

          <Card title={<Step n={3} done={false} label="Payment" />}>
            {order ? (
              <div className="space-y-3">
                <p className="text-sm text-ink/65">
                  Order <strong>{order.orderNumber}</strong> is reserved for you
                  {order.reservationExpiresAt ? ` until ${new Date(order.reservationExpiresAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : ""}. Complete the payment to confirm it.
                </p>
                {paymentError && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{paymentError}</p>}
                <PayButton
                  orderId={order.id}
                  amount={order.grandTotal}
                  label={paymentError ? "Try again" : "Pay now"}
                  onOutcome={(o) => {
                    if (o.status === "paid") router.replace(`/order-confirmation/${o.orderNumber}`);
                    else if (o.status === "failed") setPaymentError(o.message);
                  }}
                />
              </div>
            ) : (
              <p className="text-sm text-ink/55">Pay securely with UPI, cards, netbanking or wallets after placing the order.</p>
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          {quote.data ? <OrderSummary totals={quote.data} /> : cart && <OrderSummary totals={cart} shippingLabel="Shipping (estimated)" />}
          {!order && (
            <Button size="lg" className="w-full" loading={place.isPending} disabled={!quote.data?.canPlaceOrder || adding} onClick={() => place.mutate()}>
              Place order
            </Button>
          )}
          <p className="flex items-center justify-center gap-2 text-xs text-ink/45">
            <ShieldCheck size={14} /> Prices and stock are confirmed by our servers.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Step({ n, label, done }: { n: number; label: string; done: boolean }) {
  return (
    <h2 className="flex items-center gap-3 text-sm font-semibold">
      <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full text-xs", done ? "bg-success text-white" : "bg-ink text-white")}>{done ? <Check size={13} /> : n}</span>
      {label}
      {n === 1 && <MapPin size={14} className="text-ink/30" />}
    </h2>
  );
}

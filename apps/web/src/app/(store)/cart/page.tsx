"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Tag, Trash2, X } from "lucide-react";
import { Button, EmptyState, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api";
import { useApplyCoupon, useCart, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from "@/lib/cart";
import { money } from "@/lib/format";
import { OrderSummary } from "@/components/store/order-summary";

export default function CartPage() {
  const { data: cart, isLoading } = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const apply = useApplyCoupon();
  const removeCoupon = useRemoveCoupon();
  const toast = useToast();
  const [code, setCode] = useState("");

  if (isLoading || !cart) return <Spinner className="py-32" label="Loading your bag" />;
  if (!cart.items.length) {
    return (
      <div className="container-x py-20">
        <div className="card">
          <EmptyState title="Your bag is empty" body="Find something you love and it will show up here." action={<Link href="/products" className="link text-sm">Start shopping</Link>} />
        </div>
      </div>
    );
  }

  const hasIssues = cart.items.some((i) => i.issue);

  return (
    <div className="container-x py-10">
      <h1 className="text-3xl font-bold tracking-tight">Your bag</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li key={item.itemId} className="card flex gap-4 p-4">
              <Link href={`/products/${item.slug}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-offwhite">
                {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/products/${item.slug}`} className="line-clamp-1 font-medium hover:underline">
                      {item.name}
                    </Link>
                    <p className="text-sm text-ink/55">{item.variantTitle}</p>
                    {item.autoDiscountName && <p className="mt-1 text-xs font-medium text-success">{item.autoDiscountName} applied</p>}
                  </div>
                  <button aria-label={`Remove ${item.name}`} onClick={() => remove.mutate(item.itemId)} className="rounded-full p-2 text-ink/40 hover:bg-black/5 hover:text-ink">
                    <Trash2 size={16} />
                  </button>
                </div>
                {item.issue && <p className="mt-2 rounded-lg bg-warning/10 px-2 py-1 text-xs font-medium text-warning">{item.issue}</p>}
                <div className="mt-auto flex items-end justify-between pt-3">
                  <div className="flex items-center rounded-full border border-black/10">
                    <button
                      aria-label="Decrease"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ itemId: item.itemId, quantity: item.quantity - 1 }, { onError: (e) => toast(errorMessage(e), "error") })}
                      className="p-2 text-ink/60 hover:text-ink"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-7 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                    <button
                      aria-label="Increase"
                      disabled={update.isPending || item.quantity >= item.maxQuantity}
                      onClick={() => update.mutate({ itemId: item.itemId, quantity: item.quantity + 1 }, { onError: (e) => toast(errorMessage(e), "error") })}
                      className="p-2 text-ink/60 hover:text-ink disabled:opacity-30"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{money(item.lineTotal)}</p>
                    {item.discountAmount > 0 && <s className="text-xs text-ink/40">{money(item.gross)}</s>}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="card p-5">
            {cart.coupon?.valid ? (
              <div className="flex items-center justify-between rounded-xl bg-success/10 px-3 py-2 text-sm">
                <span className="flex items-center gap-2 font-semibold text-success">
                  <Tag size={14} /> {cart.coupon.code} — saved {money(cart.coupon.discount)}
                </span>
                <button aria-label="Remove coupon" onClick={() => removeCoupon.mutate()} className="text-ink/50 hover:text-ink">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!code.trim()) return;
                  apply.mutate(code.trim(), { onSuccess: () => toast("Coupon applied"), onError: (err) => toast(errorMessage(err), "error") });
                }}
              >
                <label htmlFor="coupon" className="sr-only">
                  Coupon code
                </label>
                <input id="coupon" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code" className="input" />
                <Button type="submit" variant="outline" loading={apply.isPending}>
                  Apply
                </Button>
              </form>
            )}
            {cart.coupon && !cart.coupon.valid && cart.coupon.message && <p className="mt-2 text-xs text-warning">{cart.coupon.message}</p>}
            <Link href="/offers" className="mt-3 inline-block text-xs text-ink/55 underline underline-offset-4">
              See available offers
            </Link>
          </div>
          <OrderSummary totals={cart} shippingLabel="Shipping (estimated)" />
          {hasIssues && <p className="text-sm text-warning">Some items need attention before checkout.</p>}
          <Link href="/checkout" aria-disabled={hasIssues} className={hasIssues ? "pointer-events-none opacity-50" : ""}>
            <Button size="lg" className="w-full" disabled={hasIssues}>
              Checkout
            </Button>
          </Link>
        </aside>
      </div>
    </div>
  );
}

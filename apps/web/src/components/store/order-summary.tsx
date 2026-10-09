import { money } from "@/lib/format";
import type { QuoteTotals } from "@/lib/types";

/** Server-calculated totals. The browser never computes money. */
export function OrderSummary({ totals, shippingLabel = "Shipping" }: { totals: QuoteTotals; shippingLabel?: string }) {
  const row = (label: string, value: string, strong = false, tone?: "success") => (
    <div className={`flex justify-between gap-4 ${strong ? "text-base font-bold" : "text-sm"} ${tone === "success" ? "text-success" : ""}`}>
      <span className={strong ? "" : "text-ink/60"}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="card space-y-2.5 p-5">
      {row(`Subtotal (${totals.itemCount} ${totals.itemCount === 1 ? "item" : "items"})`, money(totals.subtotal))}
      {totals.autoDiscountTotal > 0 && row("Offers", `− ${money(totals.autoDiscountTotal)}`, false, "success")}
      {totals.couponDiscountTotal > 0 && row(`Coupon ${totals.coupon?.code ?? ""}`, `− ${money(totals.couponDiscountTotal)}`, false, "success")}
      {row(shippingLabel, totals.shipping.total === 0 ? "Free" : money(totals.shipping.total))}
      {!totals.pricesIncludeTax && row("GST", money(totals.taxTotal))}
      {totals.roundOff !== 0 && row("Round off", money(totals.roundOff))}
      <div className="my-1 border-t border-black/5" />
      {row("Total", money(totals.grandTotal), true)}
      {totals.pricesIncludeTax && totals.taxTotal > 0 && <p className="text-xs text-ink/45">Includes {money(totals.taxTotal)} GST</p>}
      {totals.shipping.amountToFreeShipping > 0 && totals.shipping.freeShippingThreshold != null && (
        <p className="rounded-xl bg-offwhite px-3 py-2 text-xs text-ink/65">Add {money(totals.shipping.amountToFreeShipping)} more for free shipping</p>
      )}
      {totals.savings > 0 && <p className="text-xs font-medium text-success">You save {money(totals.savings)} on this order</p>}
    </div>
  );
}

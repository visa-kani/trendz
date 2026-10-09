import type { Metadata } from "next";
import Link from "next/link";
import { Tag } from "lucide-react";
import { serverGet } from "@/lib/server-api";
import { date, money, percent } from "@/lib/format";

export const metadata: Metadata = { title: "Offers & coupons", alternates: { canonical: "/offers" } };
export const revalidate = 120;

interface PublicCoupon {
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  minOrderAmount: number | null;
  maxDiscountAmount: number | null;
  expiresAt: string | null;
}

export default async function OffersPage() {
  const coupons = await serverGet<PublicCoupon[]>("/store/coupons", 120).catch(() => [] as PublicCoupon[]);
  return (
    <div className="container-x py-12">
      <h1 className="text-3xl font-bold tracking-tight">Offers &amp; coupons</h1>
      <p className="mt-1 text-sm text-ink/55">Apply a code in your bag. One coupon per order.</p>
      {coupons.length === 0 ? (
        <div className="card mt-8 p-12 text-center text-sm text-ink/60">
          No public offers right now.{" "}
          <Link href="/products" className="link">
            Keep shopping
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {coupons.map((c) => (
            <div key={c.code} className="card flex gap-4 p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
                <Tag size={18} />
              </span>
              <div>
                <p className="text-lg font-bold">{c.discountType === "PERCENTAGE" ? `${percent(c.value)} off` : `${money(c.value)} off`}</p>
                {c.description && <p className="text-sm text-ink/65">{c.description}</p>}
                <p className="mt-2 text-xs text-ink/50">
                  {c.minOrderAmount ? `On orders above ${money(c.minOrderAmount)}. ` : ""}
                  {c.maxDiscountAmount ? `Up to ${money(c.maxDiscountAmount)}. ` : ""}
                  {c.expiresAt ? `Valid till ${date(c.expiresAt)}.` : ""}
                </p>
                <p className="mt-3 inline-block rounded-lg border border-dashed border-ink/30 px-3 py-1 font-mono text-sm font-semibold tracking-widest">{c.code}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

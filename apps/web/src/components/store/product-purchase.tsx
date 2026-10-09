"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Heart, Minus, Plus, RotateCcw, ShoppingBag, Truck } from "lucide-react";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAddToCart } from "@/lib/cart";
import { money } from "@/lib/format";
import type { ProductDetail } from "@/lib/types";
import { Price, ProductImage } from "./product-card";

const COLOR_HEX: Record<string, string> = {
  Black: "#111111", White: "#f4f4f2", Cream: "#E7DFCF", Ecru: "#E7DFCF", Navy: "#2C3A4B", Forest: "#33422F", Grey: "#8C8C88", Ink: "#1b1f24", Sage: "#7C8570",
  Berry: "#8C2B4F", Pink: "#D98FA0", Charcoal: "#3A3A3A", Maroon: "#5C1F1A", Stone: "#B8AFA0", Brown: "#6b4a35", Olive: "#6b6e45", Indigo: "#2f3d63", "Light Wash": "#9fb3c8",
  Red: "#b3261e", Teal: "#1f5f5b", Khaki: "#b7a77a", Crimson: "#8f1d2c", Rust: "#b4502b", Camel: "#c19a6b", Blue: "#3a5a8c",
};

export function ProductPurchase({ product }: { product: ProductDetail }) {
  const toast = useToast();
  const { status } = useAuth();
  const add = useAddToCart();
  const qc = useQueryClient();
  const initial = product.variants.find((v) => v.isDefault && v.inStock) ?? product.variants.find((v) => v.inStock) ?? product.variants[0]!;
  const [selected, setSelected] = useState<Record<string, string>>(initial.options);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  const variant = useMemo(
    () => product.variants.find((v) => product.options.every((o) => v.options[o.name] === selected[o.name])) ?? (product.options.length ? undefined : product.variants[0]),
    [product, selected],
  );

  // Is a value selectable given the other current selections?
  const available = (optionName: string, value: string) =>
    product.variants.some((v) => v.options[optionName] === value && v.inStock && product.options.every((o) => o.name === optionName || v.options[o.name] === selected[o.name]));

  const images = product.images.length ? product.images : [null];
  const current = images[imageIndex] ?? images[0];

  const wishlist = useQuery({
    queryKey: ["wishlist"],
    queryFn: () => api.get<{ productId: string }[]>("/account/wishlist"),
    enabled: status === "authenticated",
  });
  const saved = !!wishlist.data?.some((w) => w.productId === product.id);
  const toggleWishlist = useMutation({
    mutationFn: () => (saved ? api.delete(`/account/wishlist/${product.id}`) : api.post("/account/wishlist", { productId: product.id })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["wishlist"] });
      toast(saved ? "Removed from wishlist" : "Saved to wishlist");
    },
    onError: (e) => toast(errorMessage(e), "error"),
  });

  const addToCart = () => {
    if (!variant) return toast("Choose your options first", "info");
    add.mutate(
      { variantId: variant.id, quantity: qty },
      {
        onSuccess: () => toast(`Added ${product.name} to your bag`),
        onError: (e) => toast(errorMessage(e), "error"),
      },
    );
  };

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* Gallery */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto sm:flex-col">
            {images.map((img, i) => (
              <button
                key={img?.id ?? i}
                onClick={() => setImageIndex(i)}
                aria-label={`Show image ${i + 1}`}
                className={clsx("h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-white ring-2 transition", i === imageIndex ? "ring-ink" : "ring-transparent")}
              >
                <ProductImage image={img} alt="" sizes="64px" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="aspect-[4/5] flex-1 overflow-hidden rounded-4xl bg-white shadow-neu">
          <ProductImage image={current} alt={product.name} priority sizes="(min-width: 1024px) 45vw, 100vw" className="h-full w-full object-cover" />
        </div>
      </div>

      {/* Buy box */}
      <div className="lg:pt-4">
        {product.brand && <p className="text-sm text-ink/50">{product.brand.name}</p>}
        <h1 className="mt-1 text-3xl font-bold tracking-tight md:text-4xl">{product.name}</h1>
        <div className="mt-4 text-xl">
          <Price price={variant?.sellingPrice ?? product.sellingPrice} mrp={variant?.mrp ?? product.mrp} />
        </div>
        <p className="mt-1 text-xs text-ink/45">Inclusive of all taxes</p>
        {product.shortDescription && <p className="mt-5 text-sm leading-relaxed text-ink/65">{product.shortDescription}</p>}

        {product.options.map((o) => (
          <fieldset key={o.name} className="mt-6">
            <legend className="text-sm font-semibold">
              {o.name}: <span className="font-normal text-ink/60">{selected[o.name]}</span>
            </legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {o.values.map((value) => {
                const isColor = o.name.toLowerCase() === "color" && COLOR_HEX[value];
                const active = selected[o.name] === value;
                const enabled = available(o.name, value);
                return (
                  <button
                    key={value}
                    onClick={() => setSelected((s) => ({ ...s, [o.name]: value }))}
                    aria-pressed={active}
                    title={enabled ? value : `${value} — out of stock`}
                    className={clsx(
                      "relative flex h-10 min-w-10 items-center justify-center rounded-full border text-sm font-medium transition",
                      isColor ? "w-10" : "px-4",
                      active ? "border-ink ring-2 ring-ink ring-offset-2" : "border-black/15 hover:border-ink/50",
                      !enabled && "opacity-40",
                    )}
                    style={isColor ? { backgroundColor: COLOR_HEX[value] } : undefined}
                  >
                    {isColor ? <span className="sr-only">{value}</span> : value}
                    {!enabled && <span aria-hidden className="absolute inset-x-1 top-1/2 h-px -rotate-12 bg-ink/50" />}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center rounded-full border border-black/10 bg-white">
            <button aria-label="Decrease quantity" onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-3 text-ink/60 hover:text-ink">
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button aria-label="Increase quantity" onClick={() => setQty((q) => Math.min(10, q + 1))} className="p-3 text-ink/60 hover:text-ink">
              <Plus size={14} />
            </button>
          </div>
          <Button size="lg" className="flex-1" icon={<ShoppingBag size={16} />} loading={add.isPending} disabled={!variant?.inStock} onClick={addToCart}>
            {!variant ? "Select options" : variant.inStock ? "Add to bag" : "Out of stock"}
          </Button>
          <button
            onClick={() => (status === "authenticated" ? toggleWishlist.mutate() : toast("Sign in to save items to your wishlist", "info"))}
            aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
            aria-pressed={saved}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-black/10 bg-white hover:border-ink/40"
          >
            <Heart size={18} className={saved ? "fill-ink" : ""} />
          </button>
        </div>
        {variant?.lowStock && <p className="mt-3 text-sm font-medium text-warning">Only a few left in this size</p>}
        {variant && <p className="mt-3 text-xs text-ink/40">SKU {variant.sku}</p>}
        {add.isSuccess && (
          <Link href="/cart" className="link mt-3 inline-block text-sm">
            View bag and checkout →
          </Link>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm shadow-neu">
            <Truck size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Tracked delivery</p>
              <p className="text-xs text-ink/55">Shipping calculated at checkout</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm shadow-neu">
            <RotateCcw size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Easy returns</p>
              <p className="text-xs text-ink/55">Request from your account</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink/40">Prices from {money(Math.min(...product.variants.map((v) => v.sellingPrice)))}</p>
      </div>
    </div>
  );
}

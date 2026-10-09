"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { ProductImage, Price } from "@/components/store/product-card";
import { Card, EmptyState, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { ImageView } from "@/lib/types";

interface WishItem {
  productId: string;
  name: string;
  slug: string;
  available: boolean;
  mrp: number;
  sellingPrice: number;
  image: ImageView | null;
}

export default function WishlistPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["wishlist"], queryFn: () => api.get<WishItem[]>("/account/wishlist") });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/account/wishlist/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }) });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Wishlist</h1>
      {q.isLoading ? (
        <Spinner />
      ) : !q.data?.length ? (
        <Card>
          <EmptyState title="Nothing saved yet" body="Tap the heart on any product to save it here." action={<Link href="/products" className="link text-sm">Browse products</Link>} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
          {q.data.map((w) => (
            <div key={w.productId} className="group relative">
              <Link href={`/products/${w.slug}`} className="block">
                <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-white shadow-neu">
                  <ProductImage image={w.image} alt={w.name} className="h-full w-full object-cover" />
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-medium">{w.name}</p>
                {w.available ? <Price price={w.sellingPrice} mrp={w.mrp} className="text-sm" /> : <p className="text-sm text-ink/50">No longer available</p>}
              </Link>
              <button aria-label={`Remove ${w.name}`} onClick={() => remove.mutate(w.productId)} className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-ink/60 shadow-neu hover:text-ink">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

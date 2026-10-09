import Link from "next/link";
import { clsx } from "clsx";
import { money } from "@/lib/format";
import type { ImageView, ProductCard as Card } from "@/lib/types";

/** Responsive product image: AVIF first, WebP fallback, lazy by default. */
export function ProductImage({ image, alt, sizes = "(min-width: 1024px) 25vw, 50vw", className, priority = false }: { image: ImageView | null; alt: string; sizes?: string; className?: string; priority?: boolean }) {
  if (!image?.medium && !image?.url) {
    return <div className={clsx("flex items-center justify-center bg-gradient-to-br from-sand/60 to-offwhite text-xs text-ink/30", className)}>No image</div>;
  }
  const webp = [image.thumb && `${image.thumb} 320w`, image.medium && `${image.medium} 800w`, image.large && `${image.large} 1600w`].filter(Boolean).join(", ");
  const avif = [image.avif.medium && `${image.avif.medium} 800w`, image.avif.large && `${image.avif.large} 1600w`].filter(Boolean).join(", ");
  return (
    <picture>
      {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
      <source type="image/webp" srcSet={webp} sizes={sizes} />
      <img
        src={image.medium ?? image.url ?? undefined}
        alt={image.altText ?? alt}
        width={image.width ?? 800}
        height={image.height ?? 1000}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={className}
      />
    </picture>
  );
}

export function Price({ price, mrp, className }: { price: number; mrp?: number; className?: string }) {
  const off = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <span className={clsx("inline-flex flex-wrap items-baseline gap-x-2", className)}>
      <span className="font-semibold">{money(price)}</span>
      {off > 0 && (
        <>
          <s className="text-xs text-ink/40">{money(mrp)}</s>
          <span className="text-xs font-semibold text-success">{off}% off</span>
        </>
      )}
    </span>
  );
}

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  const colors = product.options.find((o) => o.name.toLowerCase() === "color")?.values ?? [];
  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-white shadow-neu">
        <ProductImage image={product.image} alt={product.name} priority={priority} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        {product.hoverImage && (
          <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
            <ProductImage image={product.hoverImage} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.discountPercent > 0 && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-white">−{product.discountPercent}%</span>}
          {!product.inStock && <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink/70">Sold out</span>}
        </div>
      </div>
      <div className="mt-3 px-1">
        <p className="text-xs text-ink/45">{product.brand?.name ?? product.category.name}</p>
        <h3 className="mt-0.5 line-clamp-1 text-sm font-medium">{product.name}</h3>
        <div className="mt-1 flex items-center justify-between gap-2">
          <Price price={product.sellingPrice} mrp={product.mrp} className="text-sm" />
          {colors.length > 1 && <span className="text-[11px] text-ink/45">{colors.length} colours</span>}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: Card[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

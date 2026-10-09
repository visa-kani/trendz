import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/store/product-card";
import { ProductPurchase } from "@/components/store/product-purchase";
import { NotFoundError, serverGet, SITE_URL } from "@/lib/server-api";
import type { ProductDetail } from "@/lib/types";

async function load(slug: string) {
  try {
    return await serverGet<ProductDetail>(`/store/products/${encodeURIComponent(slug)}`, 30);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await load((await params).slug);
  const image = p.images[0]?.large ?? p.images[0]?.url ?? undefined;
  return {
    title: p.seo.title,
    description: p.seo.description ?? undefined,
    keywords: p.seo.keywords ?? undefined,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: "website", title: p.seo.title, description: p.seo.description ?? undefined, url: `/products/${p.slug}`, images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title: p.seo.title, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = await load((await params).slug);
  const inStock = p.variants.some((v) => v.inStock);
  const prices = p.variants.map((v) => v.sellingPrice);

  // schema.org Product structured data for rich results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.baseSku,
    description: p.shortDescription ?? undefined,
    image: p.images.map((i) => i.large ?? i.url).filter(Boolean),
    brand: p.brand ? { "@type": "Brand", name: p.brand.name } : undefined,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: (Math.min(...prices) / 100).toFixed(2),
      highPrice: (Math.max(...prices) / 100).toFixed(2),
      offerCount: p.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `${SITE_URL}/products/${p.slug}`,
    },
  };

  return (
    <div className="container-x py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-ink/50">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        {p.breadcrumb.map((b) => (
          <span key={b.id}>
            {" / "}
            <Link href={`/category/${b.slug}`} className="hover:text-ink">
              {b.name}
            </Link>
          </span>
        ))}
        <span className="text-ink/70"> / {p.name}</span>
      </nav>

      <ProductPurchase product={p} />

      {p.description && (
        <section className="mt-16 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="text-lg font-semibold">Details</h2>
            {/* Descriptions are authored by staff in the admin panel. */}
            <div className="prose-sm mt-3 max-w-none space-y-3 text-sm leading-relaxed text-ink/70 [&_li]:ml-5 [&_li]:list-disc" dangerouslySetInnerHTML={{ __html: sanitize(p.description) }} />
          </div>
          <dl className="card h-fit space-y-3 p-5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink/50">Style code</dt>
              <dd className="font-medium">{p.baseSku}</dd>
            </div>
            {p.productType && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink/50">Type</dt>
                <dd className="font-medium">{p.productType}</dd>
              </div>
            )}
            {p.brand && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink/50">Brand</dt>
                <dd className="font-medium">{p.brand.name}</dd>
              </div>
            )}
            {p.hsnCode && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink/50">HSN</dt>
                <dd className="font-medium">{p.hsnCode}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {p.related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">You may also like</h2>
          <ProductGrid products={p.related.slice(0, 4)} />
        </section>
      )}
    </div>
  );
}

/** Allows only simple formatting tags in product descriptions (defence in depth against stored XSS). */
function sanitize(html: string) {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[\s\S]*?(<\s*\/\s*\1\s*>|\/?>)/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "")
    .replace(/<(?!\/?(p|ul|ol|li|strong|b|em|i|br|h3|h4|span)\b)[^>]*>/gi, "");
}

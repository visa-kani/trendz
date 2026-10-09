import type { MetadataRoute } from "next";
import { serverGet, SITE_URL } from "@/lib/server-api";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await serverGet<{ products: { slug: string; updatedAt: string }[]; categories: { slug: string }[] }>("/store/sitemap", 3600).catch(() => ({ products: [], categories: [] }));
  return [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/offers`, changeFrequency: "weekly", priority: 0.5 },
    ...data.categories.map((c) => ({ url: `${SITE_URL}/category/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...data.products.map((p) => ({ url: `${SITE_URL}/products/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}

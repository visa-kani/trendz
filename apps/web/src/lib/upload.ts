"use client";

import { api } from "./api";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/** PUTs a file directly to object storage using a presigned URL (no API proxying). */
export async function putToStorage(url: string, file: File, headers: Record<string, string>) {
  const res = await fetch(url, { method: "PUT", headers, body: file });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

/** Category / brand images: presign → PUT → returns the storage key to save on the record. */
export async function uploadSimpleImage(purpose: "category" | "brand", file: File): Promise<{ key: string; publicUrl: string }> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use a JPEG, PNG, WebP or AVIF image");
  const p = await api.post<{ key: string; uploadUrl: string; headers: Record<string, string>; publicUrl: string }>("/uploads/presign", { purpose, contentType: file.type, size: file.size });
  await putToStorage(p.uploadUrl, file, p.headers);
  return { key: p.key, publicUrl: p.publicUrl };
}

/** Product images: presign → PUT → complete (the API then optimises into WebP/AVIF sizes). */
export async function uploadProductImage(productId: string, file: File, opts: { variantId?: string | null; altText?: string | null } = {}) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Use a JPEG, PNG, WebP or AVIF image");
  const p = await api.post<{ image: { id: string }; uploadUrl: string; headers: Record<string, string> }>(`/products/${productId}/images/upload-url`, {
    fileName: file.name,
    contentType: file.type,
    size: file.size,
    variantId: opts.variantId ?? null,
    altText: opts.altText ?? null,
  });
  await putToStorage(p.uploadUrl, file, p.headers);
  return api.post(`/products/${productId}/images/${p.image.id}/complete`);
}

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma, withTransaction } from "../../database/prisma";
import { invalidate } from "../../database/redis";
import { badRequest, notFound } from "../../common/errors/app-error";
import { logger } from "../../config/logger";
import { enqueue, QUEUE_NAMES } from "../../jobs/queues";
import { ALLOWED_IMAGE_TYPES, MAX_PRODUCT_IMAGE_BYTES, storage } from "../../integrations/r2/storage";
import { audit, type AuditContext } from "../audit/audit.service";
import { IMAGE_SIZES, imageKeys, imageView, type ImageSizes, type SizeInfo } from "./image-view";

export const MAX_IMAGES_PER_PRODUCT = 30;

export const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_PRODUCT_IMAGE_BYTES, `Images must be at most ${MAX_PRODUCT_IMAGE_BYTES / 1024 / 1024} MB`),
  variantId: z.uuid().nullable().optional(),
  altText: z.string().trim().max(200).nullable().optional(),
});

export const imageUpdateSchema = z.object({
  altText: z.string().trim().max(200).nullable().optional(),
  variantId: z.uuid().nullable().optional(),
});

export const reorderSchema = z.object({ imageIds: z.array(z.uuid()).min(1).max(MAX_IMAGES_PER_PRODUCT) });

async function productSlug(productId: string) {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (!p) throw notFound("Product");
  return p.slug;
}

async function assertVariant(productId: string, variantId: string | null | undefined) {
  if (!variantId) return;
  const v = await prisma.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
  if (!v) throw badRequest("Variant does not belong to this product");
}

async function getOwnedImage(productId: string, imageId: string) {
  const img = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!img) throw notFound("Image");
  return img;
}

const uploadKey = (productId: string, imageId: string) => `uploads/products/${productId}/${imageId}/${Date.now().toString(36)}`;

/** Step 1: create the image record and a presigned PUT URL. */
export async function requestUpload(productId: string, input: z.infer<typeof uploadRequestSchema>, ctx: AuditContext) {
  await productSlug(productId);
  await assertVariant(productId, input.variantId);
  const count = await prisma.productImage.count({ where: { productId } });
  if (count >= MAX_IMAGES_PER_PRODUCT) throw badRequest(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);

  const id = randomUUID();
  const objectKey = uploadKey(productId, id);
  const image = await withTransaction(async (tx) => {
    const img = await tx.productImage.create({
      data: {
        id,
        productId,
        variantId: input.variantId ?? null,
        objectKey,
        altText: input.altText ?? null,
        sortOrder: count,
        mimeType: input.contentType,
        bytes: input.size,
        status: "PENDING_UPLOAD",
      },
    });
    await audit(tx, ctx, { action: "product.image.upload", entityType: "product", entityId: productId, newValue: { imageId: id, fileName: input.fileName } });
    return img;
  });
  const uploadUrl = await storage().presignPut(objectKey, input.contentType, input.size);
  return { image: imageView(image), uploadUrl, method: "PUT" as const, headers: { "Content-Type": input.contentType } };
}

/** Step 2: the browser finished uploading; verify and queue processing. */
export async function completeUpload(productId: string, imageId: string) {
  const img = await getOwnedImage(productId, imageId);
  if (img.status !== "PENDING_UPLOAD" && img.status !== "FAILED") return imageView(img);
  const head = await storage().head(img.objectKey);
  if (!head) throw badRequest("The upload has not finished. Upload the file first.", "UPLOAD_MISSING");
  if (head.size > MAX_PRODUCT_IMAGE_BYTES) throw badRequest("Uploaded file is too large");
  const updated = await prisma.productImage.update({ where: { id: imageId }, data: { status: "PROCESSING", error: null } });
  await enqueue(QUEUE_NAMES.media, "image.process", { imageId }, { jobId: `img-${imageId}-${img.objectKey.split("/").pop()}` });
  return imageView(updated);
}

/** Replace the file behind an existing image (keeps id, alt text and position). */
export async function requestReplace(productId: string, imageId: string, input: z.infer<typeof uploadRequestSchema>, ctx: AuditContext) {
  const img = await getOwnedImage(productId, imageId);
  const objectKey = uploadKey(productId, imageId);
  // The previous sizes stay live until the new file has been processed.
  const updated = await withTransaction(async (tx) => {
    const u = await tx.productImage.update({
      where: { id: imageId },
      data: { objectKey, status: "PENDING_UPLOAD", mimeType: input.contentType, bytes: input.size, error: null },
    });
    await audit(tx, ctx, { action: "product.image.replace", entityType: "product", entityId: productId, oldValue: { imageId, objectKey: img.objectKey }, newValue: { objectKey } });
    return u;
  });
  const uploadUrl = await storage().presignPut(objectKey, input.contentType, input.size);
  return { image: imageView(updated), uploadUrl, method: "PUT" as const, headers: { "Content-Type": input.contentType } };
}

export async function updateImage(productId: string, imageId: string, input: z.infer<typeof imageUpdateSchema>) {
  await getOwnedImage(productId, imageId);
  await assertVariant(productId, input.variantId);
  const img = await prisma.productImage.update({ where: { id: imageId }, data: input });
  await invalidate(`catalog:product:${await productSlug(productId)}`);
  return imageView(img);
}

export async function reorderImages(productId: string, imageIds: string[]) {
  const existing = await prisma.productImage.findMany({ where: { productId }, select: { id: true } });
  if (existing.length !== imageIds.length || !existing.every((e) => imageIds.includes(e.id))) {
    throw badRequest("Send every image id of the product exactly once");
  }
  await prisma.$transaction(imageIds.map((id, sortOrder) => prisma.productImage.update({ where: { id }, data: { sortOrder } })));
  await invalidate(`catalog:product:${await productSlug(productId)}`);
}

export async function deleteImage(productId: string, imageId: string, ctx: AuditContext) {
  const img = await getOwnedImage(productId, imageId);
  await withTransaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    const rest = await tx.productImage.findMany({ where: { productId }, orderBy: { sortOrder: "asc" }, select: { id: true } });
    for (const [i, r] of rest.entries()) await tx.productImage.update({ where: { id: r.id }, data: { sortOrder: i } });
    await audit(tx, ctx, { action: "product.image.delete", entityType: "product", entityId: productId, oldValue: { imageId } });
  });
  await enqueue(QUEUE_NAMES.media, "image.delete-objects", { keys: imageKeys(img) });
  await invalidate(`catalog:product:${await productSlug(productId)}`);
}

// ---------------------------------------------------------------------------
// Worker side
// ---------------------------------------------------------------------------

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);

/** Converts an upload into WebP (3 sizes) + AVIF (2 sizes); deletes the original. */
export async function processImage(imageId: string): Promise<void> {
  const img = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!img || img.status !== "PROCESSING") return;

  const original = await storage().get(img.objectKey);
  const input = sharp(original, { failOn: "error", limitInputPixels: 60_000_000 });
  const meta = await input.metadata();
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new Error(`Unsupported image format: ${meta.format ?? "unknown"}`);

  const version = img.objectKey.split("/").pop()!;
  const base = `public/products/${img.productId}/${img.id}/${version}`;
  const sizes: ImageSizes = {};

  async function render(name: keyof ImageSizes, width: number, format: "webp" | "avif"): Promise<SizeInfo> {
    const pipeline = sharp(original, { failOn: "error", limitInputPixels: 60_000_000 })
      .rotate() // honour EXIF orientation, then strip metadata
      .resize({ width, height: width, fit: "inside", withoutEnlargement: true });
    const { data, info } = await (format === "webp" ? pipeline.webp({ quality: 80 }) : pipeline.avif({ quality: 50, effort: 4 })).toBuffer({ resolveWithObject: true });
    const key = `${base}/${name}.${format}`;
    await storage().put(key, data, `image/${format}`);
    return { key, url: storage().publicUrl(key), width: info.width, height: info.height };
  }

  sizes.thumb = await render("thumb", IMAGE_SIZES.thumb, "webp");
  sizes.medium = await render("medium", IMAGE_SIZES.medium, "webp");
  sizes.large = await render("large", IMAGE_SIZES.large, "webp");
  sizes.mediumAvif = await render("mediumAvif", IMAGE_SIZES.medium, "avif");
  sizes.largeAvif = await render("largeAvif", IMAGE_SIZES.large, "avif");

  const previousKeys = Object.values((img.sizes ?? {}) as ImageSizes).map((s) => s.key).filter((k) => !k.startsWith(base));
  const updated = await prisma.productImage.updateMany({
    where: { id: imageId, objectKey: img.objectKey }, // a newer replacement wins
    data: {
      sizes: sizes as unknown as Prisma.InputJsonValue,
      url: sizes.large.url,
      width: sizes.large.width,
      height: sizes.large.height,
      mimeType: "image/webp",
      status: "READY",
      error: null,
    },
  });
  // The original upload is never kept (only optimised derivatives are stored).
  await storage().delete(updated.count ? [img.objectKey, ...previousKeys] : [img.objectKey, ...Object.values(sizes).map((s) => s.key)]);
  await invalidate(`catalog:product:${await productSlug(img.productId)}`);
}

export async function markImageFailed(imageId: string, error: string) {
  await prisma.productImage.updateMany({ where: { id: imageId, status: "PROCESSING" }, data: { status: "FAILED", error: error.slice(0, 500) } });
}

/** Removes abandoned uploads and re-queues stuck processing. */
export async function sweepImages() {
  const abandoned = await prisma.productImage.findMany({
    where: { status: "PENDING_UPLOAD", url: null, createdAt: { lt: new Date(Date.now() - 24 * 3600_000) } },
    take: 200,
  });
  if (abandoned.length) {
    await storage().delete(abandoned.map((a) => a.objectKey));
    await prisma.productImage.deleteMany({ where: { id: { in: abandoned.map((a) => a.id) } } });
  }
  const stuck = await prisma.productImage.findMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 30 * 60_000) } },
    select: { id: true },
    take: 100,
  });
  for (const s of stuck) await enqueue(QUEUE_NAMES.media, "image.process", { imageId: s.id }, { jobId: `img-${s.id}-sweep-${Date.now()}` });
  if (abandoned.length || stuck.length) logger.info({ abandoned: abandoned.length, requeued: stuck.length }, "image sweep");
  return { abandoned: abandoned.length, requeued: stuck.length };
}

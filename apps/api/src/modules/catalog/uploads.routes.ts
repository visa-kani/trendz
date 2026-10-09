import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { authenticate, requireStaff } from "../../common/middleware/authenticate";
import { forbidden } from "../../common/errors/app-error";
import { ok } from "../../common/utils/http";
import { ALLOWED_IMAGE_TYPES, MAX_SIMPLE_IMAGE_BYTES, storage } from "../../integrations/r2/storage";

/**
 * Presigned uploads for small, directly-served images (category images, brand
 * logos). Product images use the processing pipeline in /products/:id/images.
 */
export const uploadsRouter = Router();
uploadsRouter.use(authenticate, requireStaff);

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const PURPOSE_PERMISSION = { category: "categories.write", brand: "brands.write" } as const;

const presignSchema = z.object({
  purpose: z.enum(["category", "brand"]),
  contentType: z.enum(ALLOWED_IMAGE_TYPES),
  size: z.number().int().positive().max(MAX_SIMPLE_IMAGE_BYTES, `Images must be at most ${MAX_SIMPLE_IMAGE_BYTES / 1024 / 1024} MB`),
});

uploadsRouter.post("/presign", async (req, res) => {
  const input = presignSchema.parse(req.body);
  if (!req.auth!.permissions.includes(PURPOSE_PERMISSION[input.purpose])) throw forbidden();
  const key = `public/${input.purpose === "category" ? "categories" : "brands"}/${randomUUID()}.${EXT[input.contentType]}`;
  const uploadUrl = await storage().presignPut(key, input.contentType, input.size);
  ok(res, { key, uploadUrl, method: "PUT", headers: { "Content-Type": input.contentType }, publicUrl: storage().publicUrl(key) });
});

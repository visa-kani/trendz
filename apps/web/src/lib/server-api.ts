import "server-only";
import { cache } from "react";
import { DEFAULT_APPEARANCE, normaliseAppearance, type Appearance } from "./theme";
import type { StoreConfig } from "./types";

/**
 * Server-side fetch for public storefront data (server components, metadata,
 * sitemap). Talks to the API directly; responses are cached briefly by Next.
 */
const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4100";

export class NotFoundError extends Error {}

/** Cache tag of a GET path, so its cached copy can be dropped on demand (see updateTag). */
const apiTag = (path: string) => `api:${path.split("?")[0]}`;
export const STORE_CONFIG_TAG = apiTag("/store/config");

export async function serverGet<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API}/api${path}`, { next: { revalidate, tags: [apiTag(path)] }, headers: { Accept: "application/json" } });
  if (res.status === 404) throw new NotFoundError(path);
  const body = (await res.json().catch(() => null)) as { success: boolean; data: T; message?: string } | null;
  if (!res.ok || !body?.success) throw new Error(body?.message ?? `API ${path} failed with ${res.status}`);
  return body.data;
}

export async function serverPage<T>(path: string, revalidate = 30): Promise<{ data: T; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const res = await fetch(`${API}/api${path}`, { next: { revalidate }, headers: { Accept: "application/json" } });
  const body = (await res.json().catch(() => null)) as { success: boolean; data: T; meta: { page: number; limit: number; total: number; totalPages: number }; message?: string } | null;
  if (!res.ok || !body?.success) throw new Error(body?.message ?? `API ${path} failed with ${res.status}`);
  return { data: body.data, meta: body.meta };
}

/**
 * The theme saved in Admin → Appearance. Falls back to the default look when
 * the API cannot be reached, so pages always render.
 */
export const getAppearance = cache(async (): Promise<Appearance> => {
  try {
    return normaliseAppearance((await serverGet<StoreConfig>("/store/config", 60)).appearance);
  } catch {
    return DEFAULT_APPEARANCE;
  }
});

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3100";

import IORedis, { type RedisOptions } from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

/** Connection options shared by the app client and BullMQ connections. */
export function redisOptions(): RedisOptions {
  return {
    // Required by BullMQ for blocking connections; harmless for the app client.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  };
}

export const redis = new IORedis(env.REDIS_URL, { ...redisOptions(), maxRetriesPerRequest: 3 });
redis.on("error", (err) => logger.error({ err: err.message }, "redis error"));

/** Read-through JSON cache helper. Redis is never the source of truth. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err: (err as Error).message, key }, "cache read failed; falling back to source");
  }
  const value = await load();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err: (err as Error).message, key }, "cache write failed");
  }
  return value;
}

export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.warn({ err: (err as Error).message, keys }, "cache invalidation failed");
  }
}

/** Deletes keys by pattern using SCAN (never KEYS in production). */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    logger.warn({ err: (err as Error).message, pattern }, "cache pattern invalidation failed");
  }
}

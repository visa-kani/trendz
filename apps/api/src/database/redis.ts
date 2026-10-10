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

// The app client fails fast: if Redis stops answering, cache reads fall back to the
// database and rate limits to their in-memory insurance limiter instead of hanging
// every request. (BullMQ connections use redisOptions() without a command timeout,
// because blocking queue commands legitimately wait.)
export const redis = new IORedis(env.REDIS_URL, { ...redisOptions(), maxRetriesPerRequest: 3, commandTimeout: 1500, connectTimeout: 5000 });
redis.on("error", (err) => logger.error({ err: err.message }, "redis error"));

/*
 * Circuit breaker: after a Redis failure (error or command timeout) cache reads
 * and rate limiting skip Redis for a short while and go straight to the source,
 * so a struggling Redis costs one timeout instead of one per call.
 * Cache invalidations are always attempted, so no stale data survives recovery.
 */
const BYPASS_MS = 30_000;
let bypassUntil = 0;

export const redisAvailable = () => Date.now() >= bypassUntil;

export function markRedisFailure(err: unknown, context: string) {
  const wasAvailable = redisAvailable();
  bypassUntil = Date.now() + BYPASS_MS;
  if (wasAvailable) logger.warn({ err: (err as Error)?.message, context }, `redis unavailable; bypassing it for ${BYPASS_MS / 1000}s`);
}

/** Read-through JSON cache helper. Redis is never the source of truth. */
export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  if (!redisAvailable()) return load();
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit) as T;
  } catch (err) {
    markRedisFailure(err, `cache read ${key}`);
    return load();
  }
  const value = await load();
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    markRedisFailure(err, `cache write ${key}`);
  }
  return value;
}

export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    markRedisFailure(err, "cache invalidation");
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

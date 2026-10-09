import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const QUEUE_NAMES = {
  notifications: "notifications",
  media: "media",
  invoices: "invoices",
  webhooks: "webhooks",
  shipping: "shipping",
  maintenance: "maintenance",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 6,
  backoff: { type: "exponential", delay: 5_000 }, // 5s, 10s, 20s, 40s, 80s
  removeOnComplete: { age: 24 * 3600, count: 5_000 },
  removeOnFail: { age: 14 * 24 * 3600 },
};

let connection: IORedis | null = null;
const queues = new Map<QueueName, Queue>();

export function bullConnection(): IORedis {
  connection ??= new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection: bullConnection(), defaultJobOptions: DEFAULT_JOB_OPTIONS });
    queues.set(name, q);
  }
  return q;
}

/**
 * Adds a job. `jobId` makes the add idempotent: adding the same id twice while
 * the first job is still retained is a no-op. Enqueue failures are logged and
 * swallowed — every job type has a database-backed sweeper that re-enqueues
 * work that was committed but never queued (transactional outbox).
 */
export async function enqueue<T extends object>(
  queue: QueueName,
  name: string,
  data: T,
  opts: JobsOptions & { jobId?: string } = {},
): Promise<void> {
  try {
    await getQueue(queue).add(name, data, opts);
  } catch (err) {
    logger.error({ err, queue, name, jobId: opts.jobId }, "failed to enqueue job");
  }
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
  if (connection) {
    await connection.quit().catch(() => undefined);
    connection = null;
  }
}

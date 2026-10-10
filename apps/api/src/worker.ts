import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./database/prisma";
import { closeRedis } from "./database/redis";
import { closeQueues, getQueue, type QueueName } from "./jobs/queues";
import { handlersFor, registeredQueues, schedules } from "./jobs/registry";
import "./jobs";

const CONCURRENCY: Partial<Record<QueueName, number>> = {
  notifications: 10,
  media: 2, // image processing is CPU bound
  invoices: 4,
  webhooks: 5,
  shipping: 4,
  maintenance: 1,
};

async function main() {
  const workers: Worker[] = [];
  for (const queue of registeredQueues()) {
    const handlers = handlersFor(queue);
    const worker = new Worker(
      queue,
      async (job) => {
        const handler = handlers.get(job.name);
        if (!handler) throw new Error(`No handler for ${queue}/${job.name}`);
        return handler(job);
      },
      {
        connection: new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }),
        concurrency: CONCURRENCY[queue] ?? 2,
      },
    );
    worker.on("failed", (job, err) =>
      logger.warn({ queue, job: job?.name, jobId: job?.id, attempt: job?.attemptsMade, err: err.message }, "job failed"),
    );
    worker.on("error", (err) => logger.error({ queue, err: err.message }, "worker error"));
    workers.push(worker);
  }

  // Idempotent: re-running upserts the same schedulers.
  for (const s of schedules) {
    await getQueue(s.queue).upsertJobScheduler(
      `${s.queue}:${s.name}`,
      s.every ? { every: s.every } : { pattern: s.pattern! },
      { name: s.name, data: s.data ?? {} },
    );
  }

  logger.info({ queues: registeredQueues(), schedules: schedules.map((s) => s.name) }, "worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "shutting down worker");
    await Promise.allSettled(workers.map((w) => w.close()));
    await Promise.allSettled([closeQueues(), prisma.$disconnect(), closeRedis()]);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "worker failed to start");
  process.exit(1);
});

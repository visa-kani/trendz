import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./database/prisma";
import { closeRedis } from "./database/redis";
import { closeQueues } from "./jobs/queues";

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Keep-alive slightly above the Nginx upstream timeout to avoid 502s on reuse.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down API");
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), closeRedis(), closeQueues()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error({ reason }, "unhandled promise rejection"));

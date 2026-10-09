/**
 * PM2 process file for a single Lightsail instance.
 * deploy.sh runs `TRENDZ_ROOT=/srv/trendz/current pm2 startOrReload ...` so every
 * path below goes through the `current` symlink: a reload starts the processes
 * from whichever release `current` points at (deploys and rollbacks alike).
 *
 * Secrets are NOT stored here: the API reads apps/api/.env and the web app reads
 * apps/web/.env.production.local, both symlinked from /srv/trendz/shared.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = process.env.TRENDZ_ROOT || path.resolve(__dirname, "../..");
// npm workspaces normally hoist `next` to the repository root.
const nextBin =
  ["apps/web/node_modules/next/dist/bin/next", "node_modules/next/dist/bin/next"].map((p) => path.join(root, p)).find((p) => fs.existsSync(p)) ??
  path.join(root, "node_modules/next/dist/bin/next");

module.exports = {
  apps: [
    {
      name: "trendz-api",
      cwd: path.join(root, "apps/api"),
      script: "dist/server.js",
      // Stateless (sessions in Postgres, rate limits and queues in Redis): cluster mode gives zero-downtime reloads.
      exec_mode: "cluster",
      instances: Number(process.env.TRENDZ_API_INSTANCES || 2),
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      kill_timeout: 15000,
      listen_timeout: 15000,
      time: true,
    },
    {
      name: "trendz-worker",
      cwd: path.join(root, "apps/api"),
      script: "dist/worker.js",
      // A single worker process; BullMQ concurrency is configured per queue.
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      kill_timeout: 30000,
      time: true,
    },
    {
      name: "trendz-web",
      cwd: path.join(root, "apps/web"),
      script: nextBin,
      args: "start --port 3100 --hostname 127.0.0.1",
      exec_mode: "fork",
      instances: 1,
      env: { NODE_ENV: "production" },
      max_memory_restart: "700M",
      time: true,
    },
  ],
};

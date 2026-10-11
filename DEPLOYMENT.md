# Deployment — AWS Lightsail

Trendz runs as a **modular monolith on one Lightsail instance**: Nginx, the Next.js web app, the Express API (2 cluster processes), one background worker, PostgreSQL 16 and Redis 7. Cloudflare R2 holds product images and backups. Payment, shipping, SMS and email use external providers.

```
            Cloudflare (DNS, TLS, cache, WAF)
                 │                         │
   shop.example.com                 media.example.com ──► R2 bucket trendz-media (public/ only)
                 │
   ┌─────────────▼───────────── Lightsail (Ubuntu 24.04) ─────────────────────────┐
   │ Nginx :443 ── /api/* ──► trendz-api  :4100  (PM2 cluster ×2)                  │
   │          └─ /*      ──► trendz-web  :3100  (Next.js)                          │
   │ trendz-worker (BullMQ: notifications, images, invoices, reservations, …)     │
   │ PostgreSQL 16 (localhost) · Redis 7 (localhost, AOF, noeviction)            │
   └──────────────────────────────────────────────────────────────────────────────┘
        │ nightly pg_dump ──► R2 bucket trendz-backups (private)
        └─► Razorpay · Shiprocket · MSG91 · Brevo / SES
```

The repository ships everything this guide uses:

| File | Purpose |
| --- | --- |
| `infra/scripts/provision-ubuntu.sh` | One-time server setup: packages, users, Postgres, Redis, firewall, cron, env templates |
| `infra/scripts/deploy.sh` | Release: build → backup → migrate → reload → health check → automatic rollback |
| `infra/scripts/backup-postgres.sh` / `restore-postgres.sh` | Verified backups to R2, and restores into a new database |
| `infra/scripts/cloudflare-ips.sh` | Real visitor IPs behind Cloudflare |
| `infra/nginx/trendz.conf` | Nginx site: TLS, rate limits, webhook passthrough, static caching |
| `infra/pm2/ecosystem.config.cjs` | PM2 processes: API, worker, web |
| `.github/workflows/ci.yml` | CI (lint, typecheck, tests, build) and SSH deploy on `main` |

---

## 1. Instance

| Size | When |
| --- | --- |
| **4 GB RAM / 2 vCPU** (minimum) | Launch, up to ~3,000 products and a few hundred orders a day |
| 8 GB RAM / 2 vCPU | More traffic, larger catalogues, or faster builds |

1. Create an instance: Linux/Unix → **Ubuntu 24.04 LTS**, in the region closest to your customers (Mumbai `ap-south-1` for India).
2. Attach a **static IP**.
3. In Networking, allow only **22, 80 and 443**. If you can, restrict 22 to your office IP.
4. Enable **automatic snapshots** (daily; keep 7). They complement the database backups.
5. SSH in with the Lightsail key. Add your own key to `~/.ssh/authorized_keys`, and keep `PasswordAuthentication no` in sshd.

## 2. DNS and Cloudflare

1. Add the domain to Cloudflare.
2. Create an `A` record `shop` → static IP, **proxied**. Optionally redirect `www` with a CNAME.
3. Set SSL/TLS mode to **Full (strict)**, turn on Always Use HTTPS, and set minimum TLS to 1.2.
4. Add a cache rule: bypass cache for `/api/*`, `/admin*`, `/pos*`, `/account*`, `/checkout*` and `/cart*`. Static assets are cached automatically.

## 3. Cloudflare R2

Create two buckets:

| Bucket | Access | Settings |
| --- | --- | --- |
| `trendz-media` | Public **only** through a custom domain: connect `media.example.com` and leave the r2.dev URL disabled | CORS: see below |
| `trendz-backups` | Private | Lifecycle rule: delete objects after 35 days (or your retention policy) |

CORS for `trendz-media` (R2 → Settings → CORS policy):

```json
[{ "AllowedOrigins": ["https://shop.example.com"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
```

Create two **R2 API tokens** ("Object Read & Write"), each limited to one bucket. One is for the app (`trendz-media`) and one is for backups (`trendz-backups`).

Uploaded originals and private files (invoices, labels) live outside `public/`, so the custom domain only serves optimised images under `public/`.

### Cloudinary instead of R2 for images

The pictures can be kept on Cloudinary instead of the `trendz-media` bucket (the `trendz-backups` bucket is still needed for database backups).

1. In the Cloudinary console → Settings → API Keys, copy the cloud name, the API key and the API secret (or the single "API environment variable" line).
2. In `api.env`: `STORAGE_PROVIDER=cloudinary`, `CLOUDINARY_URL=cloudinary://<api key>:<api secret>@<cloud name>` and `CLOUDINARY_FOLDER=trendz` (a different folder for staging).
3. In the web env: `NEXT_PUBLIC_MEDIA_ORIGIN="https://res.cloudinary.com https://api.cloudinary.com"`, then rebuild the web app. These are the only outside addresses the browser may load pictures from and upload them to (Content-Security-Policy).
4. `npm run storage:check -w apps/api` on the server. If the environment already has pictures on R2, keep the `R2_*` values and run `npm run storage:migrate -w apps/api -- --apply`.

Nothing is set up on the Cloudinary side: no bucket, CORS rule or upload preset. Leave "Strict transformations" off (the default), because category, brand and content pictures are resized through their address.

## 4. Provision the server

```bash
# on the server, as root
git clone https://github.com/<org>/trendz.git /tmp/trendz && cd /tmp/trendz
DOMAIN=shop.example.com REPO_URL=git@github.com:<org>/trendz.git bash infra/scripts/provision-ubuntu.sh
```

The script installs Node 22, PostgreSQL 16, Redis 7, Nginx, Certbot, PM2, AWS CLI, UFW, fail2ban and unattended upgrades. It also:

- creates the `trendz` user and `/srv/trendz/{releases,shared,backups,bin}`
- creates the database role and database
- configures Redis: localhost only, password, AOF, `noeviction` (which BullMQ needs)
- generates a 2 GB swap file
- registers PM2 to start on boot, with log rotation
- schedules the nightly backup cron
- writes **env templates** with generated DB, Redis, JWT and OTP secrets to `/srv/trendz/shared/` (mode 600)

At the end it prints a deploy key. Add it to the Git repository as a **read-only deploy key**.

### Environment files

| File | Used by | Notes |
| --- | --- | --- |
| `/srv/trendz/shared/api.env` | API + worker | Symlinked to `apps/api/.env`; all variables are documented in `apps/api/.env.example` |
| `/srv/trendz/shared/web.env` | Next.js (build and runtime) | Symlinked to `apps/web/.env.production.local`. `NEXT_PUBLIC_*` values are compiled in at build time: redeploy after changing them |
| `/srv/trendz/shared/backup.env` | Backup and restore scripts | Backup bucket credentials |

Fill in the provider credentials (section 7) with `sudo -u trendz nano /srv/trendz/shared/api.env`. The API **refuses to start** in production if any of these apply:

- a mock provider is configured
- `COOKIE_SECURE` is not `true`
- a webhook secret is missing
- the image storage settings are missing (the `R2_*` values, or the Cloudinary ones when `STORAGE_PROVIDER=cloudinary`)
- the JWT/OTP secrets are placeholders

PostgreSQL tuning for 4 GB (`/etc/postgresql/16/main/conf.d/trendz.conf`, then `systemctl restart postgresql`):

```
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 16MB
maintenance_work_mem = 256MB
random_page_cost = 1.1
max_connections = 100
```

Each PM2 process opens at most `connection_limit` (10) connections: 2 API processes plus the worker use about 30.

## 5. First deploy

```bash
sudo -u trendz -H bash
cp /tmp/trendz/infra/scripts/deploy.sh /srv/trendz/bin/deploy.sh && chmod +x /srv/trendz/bin/deploy.sh
/srv/trendz/bin/deploy.sh main
```

Then create the roles, permissions, default warehouse, tax classes and the first super admin. Demo data is skipped in production.

1. Set `SEED_ADMIN_EMAIL` and a strong `SEED_ADMIN_PASSWORD` (at least 12 characters) in `api.env`.
2. Run the seed:
   ```bash
   cd /srv/trendz/current && npm run db:seed --workspace apps/api
   ```
3. Remove `SEED_ADMIN_PASSWORD` from `api.env`. Sign in at `/login` and change the password.

## 6. Nginx and TLS

```bash
sudo cp /srv/trendz/current/infra/nginx/trendz.conf /etc/nginx/sites-available/trendz
sudo sed -i 's/shop.example.com/<your-domain>/g' /etc/nginx/sites-available/trendz
sudo ln -sf /etc/nginx/sites-available/trendz /etc/nginx/sites-enabled/trendz
sudo bash /srv/trendz/current/infra/scripts/cloudflare-ips.sh     # or: cloudflare-ips.sh --none (no Cloudflare proxy)
```

Choose one certificate option:

- **Let's Encrypt**:
  ```bash
  sudo certbot certonly --webroot -w /var/www/certbot -d <your-domain>
  ```
  Certbot renews automatically through its systemd timer. Before the certificate exists, comment out the 443 server block, reload Nginx, issue the certificate, then restore the block.
- **Cloudflare Origin Certificate** (when the site is always proxied): create a 15-year certificate in Cloudflare and save it as `/etc/ssl/trendz/origin.pem` and `origin.key`. Point `ssl_certificate` and `ssl_certificate_key` at those files.

Finally:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 7. Provider configuration

| Provider | Dashboard steps | `api.env` |
| --- | --- | --- |
| **Razorpay** | Use **live** keys (test keys on staging). Add a webhook at `https://<domain>/api/payments/webhook` with events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` and `refund.failed`, and set a webhook secret. | `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| **Shiprocket** | Create an API user. Configure the pickup location (its nickname goes in `SHIPPING_PICKUP_LOCATION`). Set the tracking webhook to `https://<domain>/api/shipping/webhook` with header `x-api-key: <SHIPPING_WEBHOOK_TOKEN>`. | `SHIPPING_PROVIDER=shiprocket`, `SHIPPING_API_KEY` (email), `SHIPPING_API_SECRET` (password), `SHIPPING_WEBHOOK_TOKEN` |
| **MSG91 (SMS)** | Register a DLT entity, sender id and templates for the OTP, order and shipping messages. Register the three template texts listed in `apps/api/src/integrations/sms/sms.types.ts`, with the same variable names (`otp`, `minutes`, `order`, `message`, `status`, `url`). | `SMS_PROVIDER=msg91`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_TEMPLATE_*` |
| **Brevo** or **Amazon SES** | Verify the sending domain and publish SPF, DKIM and DMARC records in Cloudflare DNS. SES also needs production access (out of the sandbox). | `EMAIL_PROVIDER=brevo` + `EMAIL_API_KEY`, or `EMAIL_PROVIDER=ses` + `AWS_*`; `EMAIL_FROM_ADDRESS` |
| **R2** | Section 3 | `R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, keys, `R2_BUCKET_NAME=trendz-media`, `R2_PUBLIC_URL=https://media.<domain>`, `R2_FORCE_PATH_STYLE=false` |
| **Cloudinary** (images, instead of R2) | Section 3 → "Cloudinary instead of R2 for images" | `STORAGE_PROVIDER=cloudinary`, `CLOUDINARY_URL`, `CLOUDINARY_FOLDER` |

After editing `api.env`, reload the processes:

```bash
pm2 reload trendz-api trendz-worker --update-env
```

Then confirm the providers work in **Admin**:

- Notifications → **Send test** for email and SMS.
- Place a ₹1 test order.
- Create a test shipment.

**Business settings** (Admin → Settings) are configurable rather than hard-coded. Have the store owner and accountant confirm them before launch:

- store legal name, GSTIN and state
- tax classes and rates
- whether prices include tax
- shipping rates
- return window
- POS discount cap
- invoice prefixes

## 8. CI/CD

`.github/workflows/ci.yml` runs on every push and PR:

1. `npm ci`
2. lint and typecheck
3. the full API test suite, against real Postgres, Redis and S3-compatible storage, including the concurrency tests
4. the production build

On `main`, if CI passes and `DEPLOY_ENABLED=true`, it SSHes into the server and runs `/srv/trendz/bin/deploy.sh <sha>`.

Setup:

1. Create a deploy user key pair and append the public key to `/srv/trendz/.ssh/authorized_keys`.
2. Add these GitHub secrets: `LIGHTSAIL_HOST`, `LIGHTSAIL_USER=trendz`, `LIGHTSAIL_SSH_KEY` and `LIGHTSAIL_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 <host>`).
3. Add the variable `DEPLOY_ENABLED=true`.
4. Add required reviewers to the `production` environment for a manual approval step.

### What `deploy.sh` does

1. Exports the commit to `/srv/trendz/releases/<time>-<sha>` and links the shared env files.
2. Runs `npm ci`, `prisma generate` and `npm run build`. The live site keeps running the old release during this.
3. **Backs up the database** (`pre-deploy-<sha>`).
4. Runs `prisma migrate deploy`. This applies committed migrations only, and never resets, drops or pushes the schema.
   When a release adds permissions (for example `reviews.read` and `reviews.moderate`), run the seed once afterwards (`npm run db:seed --workspace apps/api`): it registers them and grants them to the system roles that have them by default. It is safe to re-run and never touches roles a shop has edited beyond that first grant.
5. Points `current` at the new release and runs `pm2 startOrReload`. API processes reload one by one with no downtime; the web process restarts in a second or two.
6. Polls `/api/health/ready` and the home page for 60 seconds. If either check fails, it **switches back to the previous release automatically** and exits non-zero.
7. Keeps the last 5 releases.

### The database on Supabase instead of the instance

PostgreSQL can run in a Supabase project instead of on the Lightsail instance. Nothing in the application changes; only `DATABASE_URL` does.

1. Create the project in the region closest to the server (Mumbai, `ap-south-1`, for India) and keep the database password.
2. In `api.env`: `DATABASE_URL` = the session pooler string (Connect → Session pooler, port 5432) with `?schema=public&connection_limit=5&connect_timeout=30`. With two API processes and one worker that is 15 connections, which is the session pooler's default limit on the smallest plan: raise the pool size in Supabase (Database → Connection pooling) or lower `connection_limit` before adding processes.
3. `npm run db:deploy --workspace apps/api` creates the tables and closes them to Supabase's REST API (see README → Database on Supabase). `deploy.sh` runs the same command on every deploy.
4. Do not use `prisma migrate dev`, `db push` or `migrate reset` against it; `npm run db:migrate` refuses a hosted database by design.

Before using it for the live shop:

- **Backups**: the Free plan has none. Either use a paid plan (daily backups, point-in-time recovery as an add-on) or keep `infra/scripts/backup-postgres.sh` running against the Supabase `DATABASE_URL` (it uses `pg_dump`, which works through the session pooler; the server's `pg_dump` must be at least the Supabase PostgreSQL version).
- **Pausing**: Free projects are paused after about a week without activity, which takes the shop offline until someone resumes it.
- **Latency**: every query crosses the network, so keep the server and the project in the same region.

### Migration rules

- Never run `prisma migrate reset`, `prisma db push` or `--accept-data-loss` against production.
- A rollback restores code, not the schema, so every migration must work with the **previous** release:
  - Add columns as nullable or with defaults.
  - Backfill in a job.
  - Remove or rename columns only in a later release (expand → deploy → contract).
- Destructive data changes need an explicit, reviewed migration and a fresh backup.

## 9. Operations

| Task | Command |
| --- | --- |
| Status | `pm2 status` · `curl -s localhost:4100/api/health/ready` |
| Logs | `pm2 logs trendz-api` (or `trendz-worker`, `trendz-web`) · `/var/log/nginx/*.log` · `/var/log/trendz/backup.log` |
| Restart | `pm2 reload trendz-api` (zero downtime) · `pm2 restart trendz-worker trendz-web` |
| Deploy a specific commit | `/srv/trendz/bin/deploy.sh <sha>` |
| Roll back | `/srv/trendz/bin/deploy.sh <previous-sha>`, or `ln -sfn /srv/trendz/releases/<previous> /srv/trendz/current && TRENDZ_ROOT=/srv/trendz/current pm2 startOrReload /srv/trendz/current/infra/pm2/ecosystem.config.cjs` |
| Manual backup | `bash /srv/trendz/current/infra/scripts/backup-postgres.sh manual` |
| DB shell | `psql "$(grep ^DATABASE_URL /srv/trendz/shared/backup.env \| cut -d= -f2-)"` |

## 10. Backups and restore

**What is backed up:**

- PostgreSQL: nightly at 02:30 and before every deploy. Uses `pg_dump --format=custom`, verified with `pg_restore --list`, with a SHA-256 checksum. Kept locally for 7 days and uploaded to the private `trendz-backups` R2 bucket.
- The instance: Lightsail automatic snapshots, daily.
- Product images: these are already in R2. R2 is durable, but enable bucket versioning or a periodic `rclone sync` to a second bucket if you need protection from accidental deletion.
- Redis holds only queues and caches. AOF persistence keeps pending jobs across restarts, and nothing in Redis needs a backup.

**Restore.** The script never touches the live database:

```bash
sudo -u trendz -H bash
bash /srv/trendz/current/infra/scripts/restore-postgres.sh postgres/2026/10/trendz-20261009T023000Z-nightly.dump trendz_restore
# inspect: psql …/trendz_restore  (orders, products, last migration are printed)
```

To switch the live site to the restored database:

1. Run `pm2 stop all`.
2. As the postgres user, rename the databases:
   ```sql
   ALTER DATABASE trendz RENAME TO trendz_old_<date>;
   ALTER DATABASE trendz_restore RENAME TO trendz;
   ```
3. Run `pm2 start all`.
4. Check the site.
5. Drop `trendz_old_<date>` only once you are sure.

Rehearse a restore every quarter.

## 11. Monitoring

- **Uptime**: point an external monitor (UptimeRobot, Better Stack, Cloudflare Health Checks) at `https://<domain>/api/health/ready` (checks DB + Redis) and at the home page.
- **Lightsail alarms**: CPU > 80% for 10 minutes, and status check failures. Add a disk check, because the default disk fills up from releases, logs and backups:
  ```bash
  echo '0 * * * * root [ $(df --output=pcent / | tail -1 | tr -dc 0-9) -gt 85 ] && logger -p user.crit "trendz: disk above 85%"' | sudo tee /etc/cron.d/trendz-disk
  ```
- **Application**:
  - Admin → Notifications shows failed email/SMS with retry.
  - Admin → Payments → Reconcile resolves stuck payments.
  - The dashboard shows low stock and pending orders.
  - `pm2 monit` shows live memory and CPU.
- **Logs**: PM2 logs rotate at 50 MB (14 kept). Nginx logs rotate via logrotate. Ship them to a log service if you need search or alerting.

## 12. Performance

- Cloudflare caches `/_next/static/*` (immutable) and R2 images (each upload gets a new, versioned key, so they can be cached forever).
- Storefront pages are rendered per request, because the shopper's language (English / Tamil) is a cookie; they are sent `private, no-store`, so Cloudflare never serves one shopper's language to another. The catalogue data behind them is still cached by Next.js for 30–60 s, so they rarely hit the API.
- Search uses PostgreSQL `pg_trgm` GIN indexes. The API caches categories, settings and store config in Redis, and invalidates them on change.
- Images are converted to WebP and AVIF in several sizes by the worker. Pages request only the size they need.
- To grow, in order:
  1. Move to a larger instance (vertical scaling).
  2. Move PostgreSQL to a Lightsail managed database.
  3. Run the worker on a second instance (point `REDIS_URL`/`DATABASE_URL` at the shared services).
  4. Put a load balancer in front of two app instances.

  The application is stateless, so none of these steps need code changes.

## 13. Troubleshooting

| Symptom | Check |
| --- | --- |
| API won't start: "Unsafe production configuration" | The message lists what to fix in `api.env` |
| 502 from Nginx | `pm2 status`; `pm2 logs trendz-api --lines 100` |
| Payments stuck "pending" | Webhook URL and secret in Razorpay. Admin → Payments → Reconcile |
| Images stuck "processing" | `pm2 logs trendz-worker`; R2 credentials and CORS, or `npm run storage:check -w apps/api` on Cloudinary |
| Emails or SMS not arriving | Admin → Notifications → failed rows show the provider error; check SPF/DKIM and DLT templates |
| Wrong client IPs in audit logs | Run `cloudflare-ips.sh`; keep `TRUST_PROXY=1` |
| Build killed on deploy | Out of memory: confirm swap is active (`swapon --show`) or move to 8 GB |

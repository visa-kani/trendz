# Deployment — AWS Lightsail

Drift runs as a **modular monolith on one Lightsail instance**: Nginx, the Next.js web app, the Express API (2 cluster processes), one background worker, PostgreSQL 16 and Redis 7. Cloudflare R2 holds product images and backups. Payment, shipping, SMS and email use external providers.

```
            Cloudflare (DNS, TLS, cache, WAF)
                 │                         │
   shop.example.com                 media.example.com ──► R2 bucket drift-media (public/ only)
                 │
   ┌─────────────▼───────────── Lightsail (Ubuntu 24.04) ─────────────────────────┐
   │ Nginx :443 ── /api/* ──► drift-api  :4100  (PM2 cluster ×2)                  │
   │          └─ /*      ──► drift-web  :3100  (Next.js)                          │
   │ drift-worker (BullMQ: notifications, images, invoices, reservations, …)     │
   │ PostgreSQL 16 (localhost) · Redis 7 (localhost, AOF, noeviction)            │
   └──────────────────────────────────────────────────────────────────────────────┘
        │ nightly pg_dump ──► R2 bucket drift-backups (private)
        └─► Razorpay · Shiprocket · MSG91 · Brevo / SES
```

The repository ships everything this guide uses:

| File | Purpose |
| --- | --- |
| `infra/scripts/provision-ubuntu.sh` | One-time server setup: packages, users, Postgres, Redis, firewall, cron, env templates |
| `infra/scripts/deploy.sh` | Release: build → backup → migrate → reload → health check → automatic rollback |
| `infra/scripts/backup-postgres.sh` / `restore-postgres.sh` | Verified backups to R2, and restores into a new database |
| `infra/scripts/cloudflare-ips.sh` | Real visitor IPs behind Cloudflare |
| `infra/nginx/drift.conf` | Nginx site: TLS, rate limits, webhook passthrough, static caching |
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
| `drift-media` | Public **only** through a custom domain: connect `media.example.com` and leave the r2.dev URL disabled | CORS: see below |
| `drift-backups` | Private | Lifecycle rule: delete objects after 35 days (or your retention policy) |

CORS for `drift-media` (R2 → Settings → CORS policy):

```json
[{ "AllowedOrigins": ["https://shop.example.com"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
```

Create two **R2 API tokens** ("Object Read & Write"), each limited to one bucket. One is for the app (`drift-media`) and one is for backups (`drift-backups`).

Uploaded originals and private files (invoices, labels) live outside `public/`, so the custom domain only serves optimised images under `public/`.

## 4. Provision the server

```bash
# on the server, as root
git clone https://github.com/<org>/drift-commerce.git /tmp/drift && cd /tmp/drift
DOMAIN=shop.example.com REPO_URL=git@github.com:<org>/drift-commerce.git bash infra/scripts/provision-ubuntu.sh
```

The script installs Node 22, PostgreSQL 16, Redis 7, Nginx, Certbot, PM2, AWS CLI, UFW, fail2ban and unattended upgrades. It also:

- creates the `drift` user and `/srv/drift/{releases,shared,backups,bin}`
- creates the database role and database
- configures Redis: localhost only, password, AOF, `noeviction` (which BullMQ needs)
- generates a 2 GB swap file
- registers PM2 to start on boot, with log rotation
- schedules the nightly backup cron
- writes **env templates** with generated DB, Redis, JWT and OTP secrets to `/srv/drift/shared/` (mode 600)

At the end it prints a deploy key. Add it to the Git repository as a **read-only deploy key**.

### Environment files

| File | Used by | Notes |
| --- | --- | --- |
| `/srv/drift/shared/api.env` | API + worker | Symlinked to `apps/api/.env`; all variables are documented in `apps/api/.env.example` |
| `/srv/drift/shared/web.env` | Next.js (build and runtime) | Symlinked to `apps/web/.env.production.local`. `NEXT_PUBLIC_*` values are compiled in at build time: redeploy after changing them |
| `/srv/drift/shared/backup.env` | Backup and restore scripts | Backup bucket credentials |

Fill in the provider credentials (section 7) with `sudo -u drift nano /srv/drift/shared/api.env`. The API **refuses to start** in production if any of these apply:

- a mock provider is configured
- `COOKIE_SECURE` is not `true`
- a webhook secret is missing
- R2 settings are missing
- the JWT/OTP secrets are placeholders

PostgreSQL tuning for 4 GB (`/etc/postgresql/16/main/conf.d/drift.conf`, then `systemctl restart postgresql`):

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
sudo -u drift -H bash
cp /tmp/drift/infra/scripts/deploy.sh /srv/drift/bin/deploy.sh && chmod +x /srv/drift/bin/deploy.sh
/srv/drift/bin/deploy.sh main
```

Then create the roles, permissions, default warehouse, tax classes and the first super admin. Demo data is skipped in production.

1. Set `SEED_ADMIN_EMAIL` and a strong `SEED_ADMIN_PASSWORD` (at least 12 characters) in `api.env`.
2. Run the seed:
   ```bash
   cd /srv/drift/current && npm run db:seed --workspace apps/api
   ```
3. Remove `SEED_ADMIN_PASSWORD` from `api.env`. Sign in at `/login` and change the password.

## 6. Nginx and TLS

```bash
sudo cp /srv/drift/current/infra/nginx/drift.conf /etc/nginx/sites-available/drift
sudo sed -i 's/shop.example.com/<your-domain>/g' /etc/nginx/sites-available/drift
sudo ln -sf /etc/nginx/sites-available/drift /etc/nginx/sites-enabled/drift
sudo bash /srv/drift/current/infra/scripts/cloudflare-ips.sh     # or: cloudflare-ips.sh --none (no Cloudflare proxy)
```

Choose one certificate option:

- **Let's Encrypt**:
  ```bash
  sudo certbot certonly --webroot -w /var/www/certbot -d <your-domain>
  ```
  Certbot renews automatically through its systemd timer. Before the certificate exists, comment out the 443 server block, reload Nginx, issue the certificate, then restore the block.
- **Cloudflare Origin Certificate** (when the site is always proxied): create a 15-year certificate in Cloudflare and save it as `/etc/ssl/drift/origin.pem` and `origin.key`. Point `ssl_certificate` and `ssl_certificate_key` at those files.

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
| **R2** | Section 3 | `R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, keys, `R2_BUCKET_NAME=drift-media`, `R2_PUBLIC_URL=https://media.<domain>`, `R2_FORCE_PATH_STYLE=false` |

After editing `api.env`, reload the processes:

```bash
pm2 reload drift-api drift-worker --update-env
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

On `main`, if CI passes and `DEPLOY_ENABLED=true`, it SSHes into the server and runs `/srv/drift/bin/deploy.sh <sha>`.

Setup:

1. Create a deploy user key pair and append the public key to `/srv/drift/.ssh/authorized_keys`.
2. Add these GitHub secrets: `LIGHTSAIL_HOST`, `LIGHTSAIL_USER=drift`, `LIGHTSAIL_SSH_KEY` and `LIGHTSAIL_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 <host>`).
3. Add the variable `DEPLOY_ENABLED=true`.
4. Add required reviewers to the `production` environment for a manual approval step.

### What `deploy.sh` does

1. Exports the commit to `/srv/drift/releases/<time>-<sha>` and links the shared env files.
2. Runs `npm ci`, `prisma generate` and `npm run build`. The live site keeps running the old release during this.
3. **Backs up the database** (`pre-deploy-<sha>`).
4. Runs `prisma migrate deploy`. This applies committed migrations only, and never resets, drops or pushes the schema.
5. Points `current` at the new release and runs `pm2 startOrReload`. API processes reload one by one with no downtime; the web process restarts in a second or two.
6. Polls `/api/health/ready` and the home page for 60 seconds. If either check fails, it **switches back to the previous release automatically** and exits non-zero.
7. Keeps the last 5 releases.

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
| Logs | `pm2 logs drift-api` (or `drift-worker`, `drift-web`) · `/var/log/nginx/*.log` · `/var/log/drift/backup.log` |
| Restart | `pm2 reload drift-api` (zero downtime) · `pm2 restart drift-worker drift-web` |
| Deploy a specific commit | `/srv/drift/bin/deploy.sh <sha>` |
| Roll back | `/srv/drift/bin/deploy.sh <previous-sha>`, or `ln -sfn /srv/drift/releases/<previous> /srv/drift/current && DRIFT_ROOT=/srv/drift/current pm2 startOrReload /srv/drift/current/infra/pm2/ecosystem.config.cjs` |
| Manual backup | `bash /srv/drift/current/infra/scripts/backup-postgres.sh manual` |
| DB shell | `psql "$(grep ^DATABASE_URL /srv/drift/shared/backup.env \| cut -d= -f2-)"` |

## 10. Backups and restore

**What is backed up:**

- PostgreSQL: nightly at 02:30 and before every deploy. Uses `pg_dump --format=custom`, verified with `pg_restore --list`, with a SHA-256 checksum. Kept locally for 7 days and uploaded to the private `drift-backups` R2 bucket.
- The instance: Lightsail automatic snapshots, daily.
- Product images: these are already in R2. R2 is durable, but enable bucket versioning or a periodic `rclone sync` to a second bucket if you need protection from accidental deletion.
- Redis holds only queues and caches. AOF persistence keeps pending jobs across restarts, and nothing in Redis needs a backup.

**Restore.** The script never touches the live database:

```bash
sudo -u drift -H bash
bash /srv/drift/current/infra/scripts/restore-postgres.sh postgres/2026/10/drift-20261009T023000Z-nightly.dump drift_restore
# inspect: psql …/drift_restore  (orders, products, last migration are printed)
```

To switch the live site to the restored database:

1. Run `pm2 stop all`.
2. As the postgres user, rename the databases:
   ```sql
   ALTER DATABASE drift RENAME TO drift_old_<date>;
   ALTER DATABASE drift_restore RENAME TO drift;
   ```
3. Run `pm2 start all`.
4. Check the site.
5. Drop `drift_old_<date>` only once you are sure.

Rehearse a restore every quarter.

## 11. Monitoring

- **Uptime**: point an external monitor (UptimeRobot, Better Stack, Cloudflare Health Checks) at `https://<domain>/api/health/ready` (checks DB + Redis) and at the home page.
- **Lightsail alarms**: CPU > 80% for 10 minutes, and status check failures. Add a disk check, because the default disk fills up from releases, logs and backups:
  ```bash
  echo '0 * * * * root [ $(df --output=pcent / | tail -1 | tr -dc 0-9) -gt 85 ] && logger -p user.crit "drift: disk above 85%"' | sudo tee /etc/cron.d/drift-disk
  ```
- **Application**:
  - Admin → Notifications shows failed email/SMS with retry.
  - Admin → Payments → Reconcile resolves stuck payments.
  - The dashboard shows low stock and pending orders.
  - `pm2 monit` shows live memory and CPU.
- **Logs**: PM2 logs rotate at 50 MB (14 kept). Nginx logs rotate via logrotate. Ship them to a log service if you need search or alerting.

## 12. Performance

- Cloudflare caches `/_next/static/*` (immutable) and R2 images (each upload gets a new, versioned key, so they can be cached forever).
- The storefront uses Next.js ISR: catalogue pages revalidate every 30–60 s, so they rarely hit the API.
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
| 502 from Nginx | `pm2 status`; `pm2 logs drift-api --lines 100` |
| Payments stuck "pending" | Webhook URL and secret in Razorpay. Admin → Payments → Reconcile |
| Images stuck "processing" | `pm2 logs drift-worker`; R2 credentials and CORS |
| Emails or SMS not arriving | Admin → Notifications → failed rows show the provider error; check SPF/DKIM and DLT templates |
| Wrong client IPs in audit logs | Run `cloudflare-ips.sh`; keep `TRUST_PROXY=1` |
| Build killed on deploy | Out of memory: confirm swap is active (`swapon --show`) or move to 8 GB |

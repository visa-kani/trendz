# Trendz

E-commerce storefront, admin panel, POS billing, inventory and GST invoicing in one TypeScript monorepo. It is designed to run on a single AWS Lightsail instance.

| | |
| --- | --- |
| **Web** (`apps/web`) | Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query, React Hook Form + zod: storefront, customer account, admin, and `/pos` |
| **API** (`apps/api`) | Express 5, Prisma 6 / PostgreSQL 16, Redis + BullMQ worker, zod: REST under `/api` |
| **Integrations** | Razorpay · Shiprocket · MSG91 · Brevo / Amazon SES / SMTP · Cloudflare R2. Each has a clearly separated **mock adapter for local development**. Production refuses the mock adapters. |

What it covers:

- **Catalogue**: products with option/variant matrices, images, categories and brands.
- **Inventory**: multiple warehouses, a stock ledger, reservations, transfers, suppliers, purchase orders and goods receipts.
- **Selling**: storefront with Postgres search, cart, checkout, payments, orders, shipping, returns and refunds.
- **Documents**: GST invoices and credit notes.
- **Promotions**: coupons and automatic discounts.
- **Codes and POS**: QR/barcodes with label printing, and POS billing with USB or camera scanning.
- **Operations**: notifications, reports with CSV/Excel/PDF export, RBAC and audit logs.

Documentation:

| Doc | Contents |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, modules, critical flows, configurable business rules |
| [DATABASE.md](DATABASE.md) | Schema, constraints, triggers, numbering |
| [API.md](API.md) | Endpoints, auth, errors, idempotency |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Lightsail, Nginx, PM2, TLS, Cloudflare/R2, CI/CD, backups, monitoring |
| [SECURITY.md](SECURITY.md) | Threat model, controls, operator checklist |

---

## Local development

### Prerequisites

- **Node.js 22** (≥ 20.11) and npm 10
- **PostgreSQL 16+** installed locally, for example with the Windows installer, which includes **pgAdmin 4**. The app is developed against PostgreSQL 18 on port 5432.
- **Docker** (Desktop on Windows/macOS) for Redis, MinIO (R2 stand-in) and Mailpit

The local stack uses non-default ports so it can run beside other projects:

| Service | Address |
| --- | --- |
| Web | http://localhost:3100 |
| API | http://127.0.0.1:4100/api |
| PostgreSQL (local server, pgAdmin) | `127.0.0.1:5432` (user `trendz`, password `trendz_local_pw`, databases `trendz` and `trendz_test`) |
| Redis | `127.0.0.1:6390` |
| MinIO (S3 / R2 stand-in) | API http://localhost:9100 · console http://localhost:9101 (`trendz_minio` / `trendz_minio_secret`) |
| Mailpit (catches all email) | SMTP `1125` · inbox http://localhost:8125 |

### First run

```bash
npm install                                  # installs both workspaces
npm run infra:up                             # docker compose: redis, minio, mailpit

cp apps/api/.env.example apps/api/.env       # local defaults work as-is; set JWT_SECRET / OTP_SECRET
cp apps/web/.env.example apps/web/.env.local

# once: create the trendz role and databases in your local PostgreSQL (see "Database in pgAdmin")
npm run db:migrate                           # prisma migrate dev (creates the schema + extensions)
npm run storage:init --workspace apps/api    # creates the MinIO bucket, public/ read policy, CORS
npm run db:seed                              # roles, permissions, warehouses, tax classes, admin + demo catalogue
```

### Database in pgAdmin

The app uses the PostgreSQL server installed on this machine, so you can browse and query its data in pgAdmin.

1. **Create the role and databases** (once). In pgAdmin, right-click your PostgreSQL server, choose **PSQL Tool**, and run:
   ```
   \i 'C:/Projects/e-commerce/trendz/infra/postgres/local-setup.sql'
   ```
   This creates the `trendz` login (password `trendz_local_pw`, local only) and the `trendz` and `trendz_test` databases. It is safe to run again.
2. **Create the tables and data**: `npm run db:migrate`, then `npm run db:seed`.
3. **View it in pgAdmin**: the `trendz` database appears under your existing server. You can also register a separate connection: host `127.0.0.1`, port `5432`, user `trendz`. Tables are under *trendz → Schemas → public → Tables*.

The local `trendz` role is a superuser, because the test suite suspends triggers while it resets `trendz_test`. Production uses a normal role.

To use a throwaway Docker database instead, run `docker compose --profile docker-db up -d` and change `DATABASE_URL` to port `5544`.

Generate the two secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Then run the three processes, each in its own terminal:

```bash
npm run dev:api       # API on :4100 (tsx watch)
npm run dev:worker    # background jobs: email/SMS, image processing, invoices, reservation expiry
npm run dev:web       # Next.js on :3100
```

On a slow machine, skip watch mode: `npx tsx src/server.ts` and `npx tsx src/worker.ts` in `apps/api`.

### Signing in

| Who | How |
| --- | --- |
| Super admin | `admin@trendz.local` / `ChangeMe!2026` (from `SEED_ADMIN_*` in `apps/api/.env`, **local only**) → http://localhost:3100/admin |
| Cashier / staff | Create them in Admin → Users, with the `CASHIER`, `MANAGER`, `INVENTORY_MANAGER`, `SALES_MANAGER` or `SUPPORT` role |
| Customer | Register at `/register`. The verification email lands in Mailpit. For phone OTP sign-in, the code is printed in the API console (console SMS adapter) |

The demo seed adds:

- 20 products with colour × size variants and images
- two warehouses: `WH-001` (online fulfilment) and `WH-002` (City Store, used for POS)
- stock, one supplier and an approved purchase order

### Development adapters (no credentials needed)

| Integration | Local adapter | What it does |
| --- | --- | --- |
| Payments | `PAYMENT_PROVIDER=mock` | A "Test payment" dialog replaces Razorpay Checkout. The server still verifies HMAC signatures and processes signed webhooks through the real pipeline. |
| SMS | `SMS_PROVIDER=console` | Logs the message to the API console. OTPs are masked in `sms_logs`. |
| Email | `EMAIL_PROVIDER=smtp` → Mailpit | Real SMTP delivery to a local inbox |
| Shipping | `SHIPPING_PROVIDER=mock` | Creates AWBs and labels. Admin → Order → "Simulate next courier status" walks a shipment through the lifecycle. |
| Storage | MinIO | The same S3 API calls the app makes against Cloudflare R2 |

### Switching to real providers

Set the variables in `apps/api/.env` (all documented in `.env.example`) and restart the API and worker.

| Provider | Variables / steps |
| --- | --- |
| **Razorpay** | `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. For local webhooks, expose port 4100 with a tunnel (e.g. `cloudflared tunnel --url http://localhost:4100`) and register `<tunnel>/api/payments/webhook`. |
| **Cloudflare R2** | `R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (custom domain), `R2_FORCE_PATH_STYLE=false`. Set the bucket CORS as in DEPLOYMENT.md §3, and set `NEXT_PUBLIC_MEDIA_ORIGIN` in the web env. |
| **MSG91** | `SMS_PROVIDER=msg91`, `SMS_API_KEY`, `SMS_SENDER_ID`, and `SMS_TEMPLATE_OTP/ORDER/SHIPPING` (DLT template ids; texts in `apps/api/src/integrations/sms/sms.types.ts`) |
| **Brevo** | `EMAIL_PROVIDER=brevo`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS` (a verified sender) |
| **Amazon SES** | `EMAIL_PROVIDER=ses`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| **Shiprocket** | `SHIPPING_PROVIDER=shiprocket`, `SHIPPING_API_KEY` (API user email), `SHIPPING_API_SECRET` (password), `SHIPPING_PICKUP_LOCATION`, `SHIPPING_WEBHOOK_TOKEN` |

Check delivery from Admin → Notifications → **Send test**.

### Business rules to confirm

Money, tax and stock rules are **settings**, not code: Admin → Settings and Admin → Settings → Tax classes. The seeded values are examples only, and the store owner or accountant must confirm them:

- store legal name, GSTIN and state
- whether prices include GST
- the apparel tax slab
- flat shipping fee and free-shipping threshold
- reservation timeout
- return window
- POS manual-discount cap
- coupon stacking
- invoice prefixes

ARCHITECTURE.md §7 lists every configurable rule and its default.

## Testing

```bash
npm run test --workspace apps/api     # vitest + supertest against the trendz_test DB, Redis DB 1 and MinIO
npm run lint
npm run typecheck
```

The API suite resets the test database between tests and covers:

- auth, RBAC, catalogue and codes
- pricing and tax
- **concurrent stock allocation (no overselling)**
- checkout, idempotent payments and webhooks
- reservations, refunds and credit notes
- returns, shipping and POS
- reports

CI (`.github/workflows/ci.yml`) runs the same suite on every push.

## Useful scripts

| Command | What it does |
| --- | --- |
| `npm run infra:up` / `infra:down` | Start / stop the local Docker services |
| `npm run db:migrate` | Create and apply a migration in development (`prisma migrate dev`) |
| `npm run db:deploy --workspace apps/api` | Apply committed migrations only (what production runs) |
| `npm run db:seed` | Seed core data, plus demo data outside production |
| `npm run db:studio --workspace apps/api` | Prisma Studio |
| `npm run build` | Production build of both apps |

## Repository layout

```
apps/
  api/   src/modules/<domain>   routes · service · schemas per business module
         src/integrations/      razorpay · shipping · sms · email · r2 (each with a mock/ adapter)
         src/jobs/              BullMQ queues and job definitions (src/worker.ts runs them)
         prisma/                schema, migrations (with CHECK constraints and triggers), seeds
         tests/                 integration tests
  web/   src/app/(store)        storefront and customer account
         src/app/admin          admin panel
         src/app/pos            counter billing
         src/components         ui kit, store, admin and pos components
infra/   nginx, pm2, provisioning / deploy / backup scripts
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Can't reach database server` | Check that the PostgreSQL service is running (Windows Services → `postgresql-x64-18`) and that `infra/postgres/local-setup.sql` has been run. Use `127.0.0.1` rather than `localhost`. |
| Port already in use | Another project is using 3100, 4100 or the Docker ports. Change the port mapping in `docker-compose.yml` and the matching URLs in both env files. |
| Images stay "Processing" | The worker is not running (`npm run dev:worker`), or MinIO is down |
| No verification or OTP message | Email: check Mailpit at http://localhost:8125. SMS: check the API console output. |
| Camera scanning does not start on another device | Browsers allow the camera only on `https://` or `localhost`. Use a tunnel with HTTPS, or a USB scanner. |
| Prisma client out of date after pulling | `npm run db:generate --workspace apps/api` |
| `next build` fails on Windows with `node process exited … 0xc0000142` | Turbopack could not start its CSS worker process (seen under heavy memory pressure). Build with webpack instead: `npm run build:webpack --workspace apps/web` |
| API requests hang, or `docker` commands stop responding | Docker Desktop has stalled. Restart it, then run `npm run infra:up`. The API fails fast on a stalled Redis (1.5 s command timeout) and falls back to the database. |

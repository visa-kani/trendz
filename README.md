# Trendz

E-commerce storefront, admin panel, POS billing, inventory and GST invoicing in one TypeScript monorepo. It is designed to run on a single AWS Lightsail instance.

| | |
| --- | --- |
| **Web** (`apps/web`) | Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query, React Hook Form + zod: storefront, customer account, admin, and `/pos` |
| **API** (`apps/api`) | Express 5, Prisma 6 / PostgreSQL 16, Redis + BullMQ worker, zod: REST under `/api` |
| **Integrations** | Razorpay · Shiprocket · MSG91 · Brevo / Amazon SES / SMTP · Cloudflare R2 or Cloudinary (images). Each has a clearly separated **mock adapter for local development**. Production refuses the mock adapters. |

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
| Customer | Register at `/register`, then sign in with the email (or mobile number) and password. The verification email lands in Mailpit |

The storefront header follows the session: a signed-in shopper sees the wishlist, the bag and a round mark with their initials (it opens My account); a visitor sees one Login button instead. On phones the wishlist link is in the menu, where the bar has no room for it. A visitor can still add to the bag (the bag opens when they do) and is asked to sign in at checkout, as before.

The demo seed adds:

- the shop's six collections as categories: Kurti Sets, Anarkali, Western Wear, Lehenga, Party Wear and Kids Wear
- 12 women's wear products with colour × size variants and images, in Western Wear and Party Wear (the other collections start empty, ready for the shop's own range)
- two warehouses: `WH-001` (online fulfilment) and `WH-002` (City Store, used for POS)
- stock, one supplier and an approved purchase order

### Appearance & theme

Admin → Appearance (`/admin/appearance`, needs `settings.read`; saving needs `settings.write`) sets the look of the whole app: storefront, admin and POS.

- **Two values are saved**: a mode (light or dark) and one brand colour, plus an optional text colour. They live in the `appearance` setting; the default is dark with brand pink `#ff3d9a`.
- **Everything else is generated** from them in `apps/web/src/lib/theme.ts` (surfaces, hovers, soft tints, shadows, text on the brand colour) and set as CSS variables on `<html>`. `globals.css` holds the token names and the fallback values.
- **A save is live immediately.** The root layout paints the saved theme on the server, and saving drops the cached pages, so no visitor sees the old colours.
- **Shoppers can pick light or dark for themselves** with the sun / moon icon in the storefront header. The choice is kept in that browser's `localStorage` (key `trendz_theme`) and applies to storefront pages only: the saved mode is just what everyone sees first, and the admin and POS always use it. A small script at the top of `<body>` applies the choice before the first paint.
- **Writing new UI**: use the tokens (`bg-white` for cards, `text-ink`, `bg-accent`, `text-on-accent`, `border-black/10` …), never fixed colours, so it follows both modes. Blocks that must stay dark in light mode (footer, bands over photos) take the `on-dark` class.
- **Scrollbars** are thin and themed everywhere (storefront, admin, POS): 4px wide, or 4px high for sideways scrolling, in the brand colour, so they follow Appearance and light / dark mode, with rounded ends (`globals.css`; the curve is stretched along the bar, because a 4px bar is too narrow for an ordinary rounded corner to show). Firefox cannot size a scrollbar in pixels and shows its own thin one in the same colour. Carousels marked `no-scrollbar` still hide theirs.
- **Doodles (storefront only)**: big line drawings of a hanger, a dress, a needle and thread and so on sit behind every storefront page. `DoodleField` (`apps/web/src/components/store/doodles.tsx`) is rendered once by the store layout; cards and photographs cover it, so it shows in the open parts of a page. The not-found and error pages sit outside that layout and are also shown for admin and POS addresses, so they use `StandaloneDoodles`, which adds the doodles in the browser for storefront addresses only. Where a large panel would hide it (the category and About banners, the sign-in card, the empty bag, the offers banner, the footer; the home page banner is kept plain) a single `<Doodle art="hanger" className="absolute w-64 text-gold/30 …" />` from `doodle.tsx` is placed inside the panel. They are drawn in the theme's gold and brand colour, are hidden from screen readers and never take a click. The admin and POS do not have them. To add a drawing, add it to `SHEET` (a 200 × 200 grid) and to the `DoodleArt` type.
- **Select inputs**: every dropdown in the storefront, admin and POS is `Select` from `@/components/ui`, drawn with [react-select](https://react-select.com) (`apps/web/src/components/ui/select.tsx`). Use it like a native `<select>`: `<option>` children, `value` / `onChange={(e) => e.target.value}`, or react-hook-form's `{...register("field")}`. A hidden native `<select>` stays the real form control, so nothing else is needed. Size it with utilities on the component (`className="w-40"`, `h-8 text-xs`); lists of nine or more options can be typed into.

### Image storage (R2 or Cloudinary)

Every picture the application stores (product photos, category pictures, brand logos, the home page, offer and About pictures) is kept by one service, chosen with `STORAGE_PROVIDER` in `apps/api/.env`. The code is in `apps/api/src/integrations/object-storage/`; the rest of the API only knows storage keys.

- **`r2`** (the default; MinIO locally): the browser uploads the file with a presigned `PUT`, the worker makes the WebP and AVIF sizes with sharp, and the upload is deleted.
- **`cloudinary`**: the browser posts the file to Cloudinary with a form the API has signed, the photo is kept there, and Cloudinary makes the same sizes from it (requested once, when the upload completes). Category, brand and content pictures are served as `f_auto,q_auto`, at most 1600px wide. No bucket to create and no worker CPU spent on resizing.
- **The API secret never reaches the browser.** It signs each upload on the server; the browser gets a signature that is good for one picture under one name.
- **One folder per environment.** `CLOUDINARY_FOLDER` (for example `trendz-dev` and `trendz`) keeps environments apart inside one Cloudinary account.
- **Where the keys go locally**: `apps/api/.env.keys`, a short uncommitted file with just the keys a developer has to obtain (Cloudinary now, the Supabase connection strings for the planned database move). The API reads it together with `.env`, and a value in it wins. On a server the same names go in `api.env`.
- **Checking a new account**: `npm run storage:check -w apps/api` uploads a test picture from the server and the way a browser does, reads it back, makes the sizes and deletes it again.
- **Switching an environment that already has pictures**: set the Cloudinary values, keep the `R2_*` ones, and run `npm run storage:migrate -w apps/api` (a dry run; add `-- --apply` to move them). It copies the pictures to Cloudinary and updates the addresses in the database; the files on R2 / MinIO are left in place.
- **Limits**: every picture (product photos, category images, brand logos, content pictures) may be at most 2 MB, in JPEG, PNG, WebP or AVIF. The admin says so beside each upload control and refuses a larger file before sending anything; the API gives no upload ticket for a larger size (`MAX_IMAGE_BYTES` in `apps/api/src/integrations/object-storage/storage.types.ts`, mirrored in `apps/web/src/lib/upload.ts`). R2 then refuses a file that is not the size the ticket was given for. Cloudinary cannot, so there the stored size is checked when the picture is put to use (a product photo's upload is completed; a category, brand or content record is saved with a new picture), and an oversized picture is refused and deleted (`apps/api/src/modules/media/upload-limit.ts`).
- **Tests** always use the local MinIO bucket (`tests/setup-env.ts`), so a test run never writes to a real Cloudinary account. `tests/cloudinary.test.ts` runs the Cloudinary code against a stand-in for its API.

### Database on Supabase

The application can keep its data in a Supabase project instead of a PostgreSQL on the same machine. Supabase is used as a plain PostgreSQL server: the application has its own sign-in and does not use Supabase Auth, Storage or its REST API.

- **Connection**: `DATABASE_URL` in `apps/api/.env` is the **session pooler** string (Supabase → Connect, port 5432) ending in `?schema=public&connection_limit=5&connect_timeout=30`. The API and the worker are long-running processes, which is what the session pooler is for; the transaction pooler (port 6543) is not used. Supabase's anon key, service_role key and JWT secret are not needed.
- **Creating the tables**: `npm run db:deploy -w apps/api` applies the committed migrations (it only ever adds) and then runs `scripts/db-lockdown.ts`.
- **The tables are closed to Supabase's own REST API.** By default the roles behind a Supabase project's public key may read and write every table in `public`. The lock-down takes every privilege away from them and switches row level security on for every table, with no policy; the application signs in as the tables' owner and is not affected. It runs after every `db:deploy`, so tables added later are covered, and does nothing on a PostgreSQL that is not Supabase.
- **Writing a new migration**: `npm run db:migrate` never runs `prisma migrate dev` against a hosted database (that command can ask to wipe a database that does not match). When `DATABASE_URL` is not a local address it uses `LOCAL_DATABASE_URL`, the PostgreSQL on this machine; apply the result to Supabase with `npm run db:deploy -w apps/api`.
- **Tests never touch it.** They run against `trendz_test` on the local PostgreSQL (`tests/setup-env.ts`), and the helper that empties the tables refuses any database whose name does not end in `_test`.
- **Free plan**: a project is paused after about a week without activity (resume it in the Supabase dashboard), and backups are not included; see DEPLOYMENT.md before using it for the live shop.

### Languages (English / Tamil)

The storefront has a language switch on the announcement strip at the top of every page (and in the mobile menu). The admin and POS are English only.

- **The choice is a cookie** (`trendz_lang`, one year). The store layout reads it on the server, so a page arrives already translated. Reading a cookie means storefront pages are rendered per request rather than served from the full-page cache; the API responses behind them are still cached.
- **The English sentence is the key.** Write `t("Add to bag")`; Tamil for it lives in `apps/web/src/lib/i18n/ta/` (one file per area). A sentence with no Tamil entry is a TypeScript error.
  - Client components: `const { t, tn, tr, tx, ts, locale } = useI18n()` from `@/lib/i18n/client`.
  - Server components and metadata: `const { t } = await getI18n()` from `@/lib/i18n/server`.
  - `tn(count, "{n} item", "{n} items")` for plurals, `tr()` when a placeholder is an element, `msg()` for text defined outside a component, `date(value, locale)` for dates.
  - The not-found and error pages sit outside the store layout, so they use `useStandaloneI18n()`, which reads the cookie in the browser. Do not read it on the server there: that makes every route, the admin included, render per request.
- **Catalogue data is shown as typed in the admin.** Product names and descriptions are not translated. Category, option and colour names are translated when they are listed in `ta/data.ts` (looked up with `tx()`), as are order and payment statuses (`ts()`). Messages that come from the API (for example a validation error) are in English.
- **Tamil type**: Noto Sans Tamil and Noto Serif Tamil load only when Tamil is shown. `globals.css` drops Latin letter-spacing and loosens heading line height under `:lang(ta)`; use the `ta:` Tailwind variant (`ta:text-3xl`) where a Tamil heading needs its own size.
- `npm run i18n:check -w apps/web` lists text in the code that has no Tamil entry, translations that lost a `{placeholder}`, and unused entries.

### CMS (home page, about, contact, legal pages)

The CMS group in the admin sidebar holds what the storefront says. Every screen needs `settings.read`, saving needs `settings.write`, and a save shows on the store straight away.

| Admin screen | Edits | Storefront |
|---|---|---|
| Home page (`/admin/cms/home`) | The shop's logo (shown on every storefront page), then the home page sections from top to bottom: banner (headline, tagline, buttons, optional picture), Shop by category, Popular picks, the "about the collection" card, the delivery / returns / payment cards, New arrivals and the closing band. Each section below the banner can be switched off | `/` |
| Home page offers (`/admin/home-offers`) | The offers section under the banner (next heading) | `/` |
| About us (`/admin/cms/about`) | The About us page: the banner (small heading, heading, introduction, optional picture; the logo is shown without one) and the page text, written in a rich text editor. The page can be switched off | `/about` and its links in the header menu and the footer |
| Contact us (`/admin/cms/contact`) | Phone, WhatsApp number, email, Instagram handle, address, opening hours, a directions link and the contact page's heading | `/contact`, the footer of every page and every WhatsApp button |
| Terms & Conditions, Privacy Policy (`/admin/cms/terms`, `/admin/cms/privacy`) | A title and the page text, written in a rich text editor | `/terms`, `/privacy` and their footer links |

- **Two languages.** Every text is entered in English and Tamil; a shopper sees their language, and an empty one falls back to the other. A text left empty in both is left out of the page.
- **Legal pages start empty and unpublished.** Until a page is published, `/terms` or `/privacy` answers "not found" and the footer does not link to it. The shop writes its own wording; nothing is pre-filled.
- **The About us page starts written and shown.** Its starting text only repeats what the store already says (the collections, weekly arrivals, WhatsApp help, the shop and home delivery); the shop's own history is for the shop to add. Switched off, `/about` answers "not found" and the header and footer links disappear.
- **The shop's logo is uploaded on the Home page screen.** It replaces the logo that ships with the app in the header, the footer, the home page's closing band and the About banner (when that has no picture of its own); removing it brings the built-in one back. The store shows the logo on dark panels, so one drawn for a black or transparent background looks best. JPEG, PNG, WebP or AVIF, up to 2 MB, like every other picture. The admin and POS screens and the emails do not show a logo picture.
- **It is content only.** The delivery and returns headings on the home page state the free-shipping amount and the return window, so they are built from Settings rather than typed here, and can never disagree with checkout.
- **Contact details are not the invoice identity.** The legal name, GSTIN and address printed on invoices stay under Admin → Settings (`store`).
- **Where it lives**: the `homePage`, `contact`, `termsPage`, `privacyPage` and `aboutPage` settings (`apps/api/src/modules/settings/cms.ts`). Their defaults are the text the storefront had before it became editable. The home page and contact details reach the storefront through `/store/config`; a legal page's text through `/store/pages/:slug` and the About us page through `/store/about`. Links are limited to paths on this site, pictures to files uploaded through the editor, and page text to an allow-list of tags (`apps/api/src/common/utils/html.ts`).
- **If the API cannot supply it** (unreachable, or an older build), the storefront falls back to the same text from `apps/web/src/lib/cms.ts`.
- **Adding another page** (for example a shipping policy): add its schema and slug to `PAGE_SETTINGS` in `cms.ts` and to `settingSchemas`, extend `PageSlug` in `apps/web/src/lib/types.ts`, and add a storefront route, an admin route and a nav entry like the ones for `terms`.

### Home page offers

Admin → CMS → Home page offers (`/admin/home-offers`, needs `settings.read`; saving needs `settings.write`) edits the offers section under the banner on the home page.

- **What it holds**: a heading, up to four offer cards (ribbon, title, a line above the price, price, link, optional picture), a gift banner and a sale banner with a big figure such as "20%". Every text is entered in English and Tamil; a shopper sees their language, and an empty one falls back to the other.
- **Offer period**: the start and end dates are printed on the sale banner, and the whole section leaves the home page the day after the end date (India time). Clear the end date to keep it up.
- **It is content only.** Nothing here changes a price. A discount that should apply at checkout or at the billing counter is set up under Admin → Discounts or Coupons.
- **Where it lives**: the `homeOffers` setting (`apps/api/src/modules/settings/home-offers.ts`, whose defaults are the shop's grand-opening flyer), served to the storefront through `/store/config`. Links are limited to paths on this site and pictures to files uploaded through the editor. A save shows on the home page straight away.
- The section itself is `apps/web/src/components/store/home-offers.tsx`. It is laid out with container queries, so the editor's preview and the home page render the same component.

### Product lists (infinite scroll)

Shop all, the category pages and search results load their products as the shopper scrolls (`apps/web/src/components/store/listing-products.tsx`).

- **The first 24 products come with the page** (server-rendered, so they are there without JavaScript and for search engines). The next 24 are fetched from `/api/store/products` when the end of the list is about one screen away, and so on to the end.
- **The "Load more products" link under the list is a real link** to `?page=2`, `?page=3` …: it loads the next page on click, works without JavaScript, and gives search engines a path through the whole list. A page opened that way starts at that page and offers "Show products from the start".
- **Coming back from a product returns to the same place.** The loaded pages are kept by React Query (five minutes), so the list is as long as it was and the browser can restore the scroll position.
- **The counter in the toolbar** ("Showing 1–48 of 120") follows what is on the page, and the end of the list says so. A page that fails to load shows "Try again" instead of retrying by itself.
- Changing a filter or the sort order starts the list again from the top. The page size is the `limit` set in `components/store/listing.tsx`.

### Customer reviews

Customers rate and review products they have received.

- **Who can review**: a signed-in customer with a delivered order that contains the product. That makes every review a verified purchase. One review per customer and product; they can edit or remove it.
- **Where**: "Write a review" appears on each item of a delivered order (Account → Orders), on Account → Reviews (which lists delivered products still waiting for a review) and on the product page. The "order delivered" email and notification invite the customer to review.
- **Product page**: average rating, a breakdown by stars and the reviews, with the customer's first name and last initial only. The average is also in the page's structured data for search engines.
- **Moderation**: Admin → Reviews (permissions `reviews.read` and `reviews.moderate`; store manager, sales manager and support have them by default). Staff publish, reject (with an internal note) or delete; the customer is notified either way and can edit a rejected review and send it again.
- **Two settings**, Admin → Settings → Reviews: switch reviews on or off, and whether a review needs approval before it is shown (default: it does).
- After pulling this change run `npm run db:migrate` (new `product_reviews` table) and `npm run db:seed` (registers the two permissions and grants them to the system roles above).

### Phone numbers

Every phone field in the storefront, admin and billing screen is the same component, `PhoneInput` (`apps/web/src/components/ui/phone-input.tsx`), built on the `react-phone-number-input` package.

- **India only.** The country is fixed: the flag and `+91` are always in the field and cannot be removed. Digits are spaced as they are typed (`+91 98765 43210`), and a pasted number may come with or without the country code.
- **One stored form.** A field gives the form `+919876543210`, which is what the API keeps for customers and staff. A number saved earlier in another way (`98765 43210`, `0421 2241234`) is shown in the field's own form and left as it is until someone edits it.
- **Where a mobile is required** (sign-up, sign-in by code, addresses, staff users) the number must be an Indian mobile; supplier and warehouse contacts may be landlines.
- **Size.** Only India's numbering rules are shipped, in `apps/web/src/lib/phone-metadata.in.json` (5 KB instead of the library's 80–150 KB for every country). After upgrading the package, run `npm run phone:metadata -w apps/web` to write that file again.
- Pages that only print a number (footer, contact, about) space it with `displayPhone` in `apps/web/src/lib/cms.ts`.

### Development adapters (no credentials needed)

| Integration | Local adapter | What it does |
| --- | --- | --- |
| Payments | `PAYMENT_PROVIDER=mock` | A "Test payment" dialog replaces Razorpay Checkout. The server still verifies HMAC signatures and processes signed webhooks through the real pipeline. |
| SMS | `SMS_PROVIDER=console` | Logs the message to the API console. OTPs are masked in `sms_logs`. |
| Email | `EMAIL_PROVIDER=smtp` → Mailpit | Real SMTP delivery to a local inbox |
| Shipping | `SHIPPING_PROVIDER=mock` | Creates AWBs and labels. Admin → Order → "Simulate next courier status" walks a shipment through the lifecycle. |
| Storage | MinIO (`STORAGE_PROVIDER=r2`) | The same S3 API calls the app makes against Cloudflare R2 |

### Switching to real providers

Set the variables in `apps/api/.env` (all documented in `.env.example`) and restart the API and worker.

| Provider | Variables / steps |
| --- | --- |
| **Razorpay** | `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. For local webhooks, expose port 4100 with a tunnel (e.g. `cloudflared tunnel --url http://localhost:4100`) and register `<tunnel>/api/payments/webhook`. |
| **Cloudflare R2** | `R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (custom domain), `R2_FORCE_PATH_STYLE=false`. Set the bucket CORS as in DEPLOYMENT.md §3, and set `NEXT_PUBLIC_MEDIA_ORIGIN` in the web env. |
| **Cloudinary** (instead of R2) | `STORAGE_PROVIDER=cloudinary` and `CLOUDINARY_URL` (the one line the Cloudinary console shows under Settings → API Keys) or `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; `CLOUDINARY_FOLDER` (one folder per environment). In the web env set `NEXT_PUBLIC_MEDIA_ORIGIN="https://res.cloudinary.com https://api.cloudinary.com"` and rebuild the web app. Then `npm run storage:check -w apps/api`, and `npm run storage:migrate -w apps/api` to move pictures that are already on R2 / MinIO. See "Image storage" below. |
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
- whether customer reviews need approval before they are shown
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
| `npm run db:migrate` | Create and apply a migration in development (`prisma migrate dev`), always against a PostgreSQL on this machine |
| `npm run db:deploy --workspace apps/api` | Apply committed migrations only (what production runs), then close the tables to Supabase's REST API when the database is on Supabase |
| `npm run db:seed` | Seed core data, plus demo data outside production |
| `npm run db:studio --workspace apps/api` | Prisma Studio |
| `npm run phone:metadata --workspace apps/web` | Write India's phone numbering rules for the phone fields again (after upgrading `react-phone-number-input`) |
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
| Controls look broken right after a rebuild (for example dropdowns with repeated arrows) | The tab was opened before the rebuild and is still running the old code. Reload it. Each web build has its own identifier (`deploymentId` in `apps/web/next.config.ts`, kept in `apps/web/.deployment-id`), so a tab opened on an identified build reloads itself on its next click after a newer build |
| Images stay "Processing" | The worker is not running (`npm run dev:worker`), or MinIO is down |
| No verification email or SMS | Email: check Mailpit at http://localhost:8125. SMS: check the API console output. |
| Camera scanning does not start on another device | Browsers allow the camera only on `https://` or `localhost`. Use a tunnel with HTTPS, or a USB scanner. |
| Prisma client out of date after pulling | `npm run db:generate --workspace apps/api` |
| `next build` fails on Windows with `node process exited … 0xc0000142` | Turbopack could not start its CSS worker process (seen under heavy memory pressure). Build with webpack instead: `npm run build:webpack --workspace apps/web` |
| API requests hang, or `docker` commands stop responding | Docker Desktop has stalled. Restart it, then run `npm run infra:up`. The API fails fast on a stalled Redis (1.5 s command timeout) and falls back to the database. |

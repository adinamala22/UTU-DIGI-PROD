# UTU Store: URL Tune Up Digital Products

A storefront built for high-urgency sales, with an admin dashboard where you can change every part of the store. Payments go through a self-hosted **YouPI-PG** (UPI), with **Razorpay** as a fallback.

Built with Next.js 15, Prisma and Postgres, Tailwind v4 and Framer Motion.

## Quick start (local)

```bash
npm install
npx prisma dev -n utu-store --detach   # local Postgres (or point DATABASE_URL at Neon/Supabase)
cp .env.example .env                    # fill in AUTH_SECRET, ADMIN_PASSWORD, DATABASE_URL
npm run db:push && npm run db:seed
npm run dev                             # http://localhost:3000  ·  admin: /admin
```

### Test payments without a real gateway

```bash
npm run mock:youpi                                  # fake YouPI on :6100 (sends signed webhooks)
npx tsx --env-file=.env scripts/e2e-youpi.ts        # full end-to-end payment checks
npm test                                            # unit tests
```

In `.env`, set `YOUPI_API_URL=http://localhost:6100`. After you check out, the mock's checkout page has a **"Simulate UPI payment"** button.

> **Local `prisma dev` only:** keep `pgbouncer=true` in `DATABASE_URL`. Without it you get "prepared statement already exists" errors.

## End-to-end tests (Playwright)

```bash
npx playwright install chromium   # once
npm run test:e2e                  # full suite: 82 tests, about 3 min
npm run test:e2e:ui               # interactive runner
npm run test:e2e:report           # open the last HTML report
npm run test:e2e:prod             # READ-ONLY smoke test of https://shop.urltuneup.com
```

The suite runs on its own, so it can't touch real data:
- `scripts/e2e-db.mjs` starts a **throwaway PostgreSQL** on port 54329, pushes the schema, and seeds it fresh on every run.
- The mock YouPI gateway runs on :6200.
- A production build of the app runs on :3100 and builds into `.next-e2e/`.
- Real emails and Razorpay are switched off.

| Spec | Covers |
|---|---|
| `storefront.spec.ts` | Hero, products, lazy video embeds, FAQ, announcement bar, real-only purchase toasts, product page, 404 and draft protection, SEO tags |
| `checkout.spec.ts` | Summary, invalid and valid coupons, `?coupon=` links, order bump, validation. Full purchase through the mock gateway for LINK and LICENSE products, coupon usage, expired, pending→paid and under-review flows, access-key protection |
| `api-security.spec.ts` | Server-side pricing, input validation, rate limiting. Webhook signature, replay window, spoof re-check, dedupe and reconcile. Download-token revocation, admin route protection, security headers |
| `admin.spec.ts` | Login and logout, every admin page renders. Product create, edit, duplicate and delete reflected on the store. FAQ and coupon CRUD, settings, page builder publish. Approve, revoke, reconcile, CSV export, audit log |
| `mobile.spec.ts` | No horizontal overflow, sticky buy bar, checkout on a phone viewport |
| `prod-smoke.spec.ts` | Live site: pages load, a payment gateway is configured, admin is locked, webhooks reject unsigned calls, HTTPS headers |

CI (`.github/workflows/test.yml`) runs typecheck, lint, unit tests and the e2e suite on every push. After a push to `main`, it also runs the live smoke test.

## How payments work

1. `/api/checkout` recomputes the price on the server and creates a `PENDING` order. It then calls YouPI `POST /api/v1/payments` (or creates a Razorpay order) and redirects the buyer.
2. The gateway webhook arrives at `/api/webhooks/youpi` or `/api/webhooks/razorpay`, and the handler:
   - verifies the HMAC on the raw body (YouPI V2 signatures also get a 5-minute timestamp window);
   - deduplicates on the delivery id;
   - **re-checks the payment status with the gateway** and confirms the amount matches.
3. If everything checks out, the order becomes `FULFILLED` and the buyer is delivered:
   - **FILE**: a signed download link that expires and has a download limit;
   - **LINK**: the external access URL is revealed;
   - **LICENSE**: a key from the pool, or a generated one;
   - plus an email with everything.
4. The order page polls `/api/orders/:id/status`. It also pulls the status from the gateway itself, in case a webhook is lost.

YouPI events and what the store does:

| YouPI event | Store action |
|---|---|
| `OBSERVED_SUCCESS` (UPI with UTR) | Deliver now, flagged **NOT_RECONCILED** |
| `RECONCILED` | Mark reconciled |
| `MANUAL_REVIEW` | Order goes to `REVIEW`; approve it in Admin → Orders |
| `FAILED`, `EXPIRED`, `CANCELLED` | Order is closed |

From the admin you can **revoke** an order, which kills its download links, and **approve** a payment after checking the UTR in your bank app.

## Deploying

**Shop** (Vercel or any Node host), at `shop.urltuneup.com`:
- Set every variable from `.env.example`.
- On serverless hosts, use R2 for storage (`S3_*` and `S3_PUBLIC_*`), because local disk isn't persistent there.

**YouPI-PG** (always-on VPS), at `pay.urltuneup.com`:
- Run it from https://github.com/youpi-pg/YouPI-PG and enrol the Android SMS observer.
- Set its webhook URL to `https://shop.urltuneup.com/api/webhooks/youpi`, and copy the merchant webhook secret into `YOUPI_WEBHOOK_SECRET`.
- Brand its checkout page with its own env vars:
  - `DEFAULT_APP_NAME="URL Tune Up Pay"`
  - `DEFAULT_PRIMARY_COLOR=#7e5bff`
  - `DEFAULT_LOGO_URL=…`
  - `DEFAULT_HIDE_POWERED_BY=true`
- Restrict return origins with `YOUPI_ALLOWED_RETURN_ORIGINS=https://shop.urltuneup.com`.
- Firewall its admin ports (6001 and 8090).

**Razorpay**:
- Set the webhook to `/api/webhooks/razorpay` with the events `payment.captured` and `order.paid`.

⚠️ **Before you go live:**
- YouPI-PG calls itself experimental (it suggests about 20 transactions per day per VPA), and it has no license file. Get written permission from its authors before using it commercially.
- Replace `/terms` and the sample testimonial with your real content.

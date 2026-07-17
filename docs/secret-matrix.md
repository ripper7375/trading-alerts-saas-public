# Secret Matrix

**Session:** 0-4 · **Generated:** 2026-07-17 · **Scope:** names only, never values.

Catalogs every secret/env-var **name** referenced across the 5 files the Session 0-4 order
specifies: `vercel.json`, `.env*` (`.env`, `.env.example`, `.env.local`, `.env.staging`),
`docker-compose.yml`, `railway-worker.json`, `railway-gateway/.env.example`. Live-value files
(`.env`, `.env.local`) were read with a names-only extraction (`grep -oE '^[A-Z_]+=' | sed
's/=$//'`) — their actual values were never loaded into this session.

Consumer mappings (which route/service reads each name) were confirmed by grepping the live
`app/api/**` and `lib/**` source — **excluding** `frontend/` and `seed-code/` (out-of-scope
mirror/template dirs per `CLAUDE.md`'s standing do-not-touch list) and `mt5-service/`
(SEPARATE_STACK, out of scope for this migration — its variable names are still catalogued
below because they appear in in-scope files, but its code was not read).

## Authentication

| Name                                            | Consumed by                                                                                                                                            | Found in                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `NEXTAUTH_SECRET`                               | NextAuth JWT/session signing — `lib/auth/auth-options.ts`                                                                                              | `.env.example`, `.env`, `.env.local`, `docker-compose.yml` (web) |
| `NEXTAUTH_URL`                                  | Auth callback base URL; also reused as the link base in `lib/email/email.ts` templates and `lib/dlocal/dlocal-payment.service.ts`'s `notification_url` | `.env.example`, `.env`, `.env.local`, `docker-compose.yml` (web) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`     | Google OAuth provider — `lib/auth/auth-options.ts`                                                                                                     | `.env.example`, `.env`, `.env.local`                             |
| `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET`   | Twitter/X OAuth provider — `lib/auth/auth-options.ts`                                                                                                  | `.env.example`, `.env`, `.env.local`                             |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth provider — `lib/auth/auth-options.ts` (code path is live and conditional on the vars being set)                                         | `.env.example` only, and commented out there                     |

## Database / Cache

| Name                                           | Consumed by                                                                                                                              | Found in                                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                 | Primary Postgres via Prisma — used app-wide                                                                                              | `.env.example`, `.env`, `.env.local`, `docker-compose.yml` (web, mt5-service, alert-worker)                 |
| `POSTGRESQL_URI`                               | Part 20 TimescaleDB candle data — `lib/candle-data-helpers.ts`, `app/api/candles/[symbol]/route.ts`, `scripts/verify-sync-deployment.ts` | `.env.example`, `.env`, `.env.local`                                                                        |
| `REDIS_URL`                                    | Cache / BullMQ / rate limiting — `lib/jobs/*`, `scripts/verify-sync-deployment.ts`                                                       | `.env.example`, `.env`, `.env.local`, `docker-compose.yml` (mt5-service, web, alert-worker), `.env.staging` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | `railway-gateway`'s own Redis connection (Bull queue + rate limiting)                                                                    | `railway-gateway/.env.example` only                                                                         |

## Payments — Stripe

| Name                                 | Consumed by                                                                                                              | Found in                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                  | Server-side Stripe API calls — `lib/stripe/stripe.ts`                                                                    | `.env.example`, `.env`, `.env.local`                        |
| `STRIPE_WEBHOOK_SECRET`              | Webhook signature verification (`constructWebhookEvent`) — `app/api/webhooks/stripe/route.ts` via `lib/stripe/stripe.ts` | `.env.example`, `.env`, `.env.local` — **confirmed-live ✓** |
| `STRIPE_PRO_PRICE_ID`                | Pro-tier Stripe Price ID (identifier, not a credential) — `lib/stripe/stripe.ts`                                         | `.env.example`, `.env`, `.env.local`                        |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public, client-side Stripe key                                                                                           | `.env.example`, `.env`, `.env.local`                        |

## Payments — dLocal

| Name                    | Consumed by                                                                                                 | Found in                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `DLOCAL_API_KEY`        | dLocal API authentication — `lib/dlocal/dlocal-payment.service.ts`                                          | **not found in any of the 5 files — gap**                                                         |
| `DLOCAL_SECRET_KEY`     | dLocal API authentication — `lib/dlocal/dlocal-payment.service.ts`                                          | **not found in any of the 5 files — gap**                                                         |
| `DLOCAL_WEBHOOK_SECRET` | dLocal webhook HMAC verification (`verifyWebhookSignature`), consumed by `app/api/webhooks/dlocal/route.ts` | **not found in any of the 5 files — gap** — **confirmed-live ✓** (this is "dLocal's HMAC secret") |
| `DLOCAL_API_URL`        | dLocal API base URL (not a credential) — `lib/dlocal/dlocal-payment.service.ts`                             | **not found in any of the 5 files — gap**                                                         |

## Payments — RiseWorks

| Name                  | Consumed by                                                                      | Found in                                                         |
| --------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `RISE_WEBHOOK_SECRET` | RiseWorks webhook signature verification — `app/api/webhooks/riseworks/route.ts` | **not found in any of the 5 files — gap** — **confirmed-live ✓** |

## Cron

| Name          | Consumed by                                                            | Found in                                                         |
| ------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `CRON_SECRET` | Bearer-token authorization on all 8 `app/api/cron/*/route.ts` handlers | **not found in any of the 5 files — gap** — **confirmed-live ✓** |

## Email

| Name                | Consumed by                                                        | Found in                              |
| ------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| `RESEND_API_KEY`    | Transactional email — `lib/email/email.ts`                         | `.env.example`, `.env`, `.env.local`  |
| `RESEND_FROM_EMAIL` | Sender address (config, not a credential) — `lib/email/email.ts`   | not in any of the 5 files — minor gap |
| `RESEND_REPLY_TO`   | Reply-to address (config, not a credential) — `lib/email/email.ts` | not in any of the 5 files — minor gap |

## MT5 Flask service (`mt5-service/` — SEPARATE_STACK, out of scope for this migration)

Cataloged only because these names appear in in-scope files (`.env.example`, `docker-compose.yml`).

| Name                         | Found in                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `MT5_API_KEY`                | `.env.example`, `.env`, `.env.local`                                                                           |
| `MT5_ADMIN_API_KEY`          | `.env.example` only (not in live `.env`/`.env.local`)                                                          |
| `MT5_LOGIN` / `MT5_PASSWORD` | `.env.example` only — live files use `MT5_LOGIN_01` / `MT5_PASSWORD_01` instead (naming drift, see Gaps below) |
| `MT5_SERVER`                 | `.env.example`, `.env`, `.env.local`                                                                           |
| `MT5_SERVICE_URL`            | `.env.example`, `.env`, `.env.local`                                                                           |
| `MT5_API_URL`                | `.env.example` only                                                                                            |
| `NEXT_PUBLIC_MT5_WS_URL`     | `.env.example` only                                                                                            |
| `USE_FLASK_MT5`              | `.env.example` only                                                                                            |
| `USE_MOCK_MT5`               | `docker-compose.yml` only (mt5-service container)                                                              |
| `FLASK_ENV`                  | `docker-compose.yml` only (mt5-service container)                                                              |
| `FLASK_MT5_URL`              | `docker-compose.yml` only (web container — same concept as `MT5_SERVICE_URL` under a different name)           |

## Admin / maintenance

| Name                             | Consumed by                                                        | Found in                                              |
| -------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| `ADMIN_API_KEY`                  | Maintenance endpoints; read by `scripts/verify-sync-deployment.ts` | `.env.example` only (not in live `.env`/`.env.local`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Prisma seed script defaults                                        | `.env.example` only, commented out                    |

## Dev tooling (not consumed by application runtime)

| Name                                 | Consumed by                                                                                                                                          | Found in                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `OPENAI_API_KEY` / `OPENAI_API_BASE` | MiniMax endpoint for the Aider AI coding assistant — **no reference found in live `app/**`/`lib/**` code**, only in unrelated `seed-code/` templates | `.env.example`, `.env`, `.env.local` |
| `GITHUB_TOKEN`                       | Aider's GitHub push integration (dev tooling)                                                                                                        | `.env.example` only, commented out   |

## Misc / config (non-secret or feature-flag env vars picked up by the same enumeration)

| Name                                                  | Found in                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                                            | `.env.staging`, `docker-compose.yml`, `railway-gateway/.env.example`                                   |
| `PORT`                                                | `railway-gateway/.env.example` only                                                                    |
| `ENABLE_REDIS_SYNC`, `LOG_LEVEL`                      | `.env`, `.env.local` only — not in `.env.example`                                                      |
| `NEXT_PUBLIC_PRO_PRICE_MONTHLY`                       | `.env`, `.env.local` only — not in `.env.example`                                                      |
| `NEXT_PUBLIC_PRO_PRICE_YEARLY`                        | Referenced in `lib/utils/constants.ts` with a code-level default; not present in any of the 5 files    |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `docker-compose.yml` only (local Postgres container bootstrap, not an app-level secret)                |
| `API_KEYS`                                            | `railway-gateway/.env.example` — per-sender keys (Push Worker, MT5 Relay) gating gateway ingest writes |
| `RATE_LIMIT_MAX`, `ALLOWED_ORIGINS`                   | `railway-gateway/.env.example` — config, not credentials                                               |

## `railway-worker.json`

Declares **no environment variable names at all** — only `build`/`deploy` config
(`startCommand: npm run worker:alerts`, restart policy). The alert-worker's actual runtime
secrets (`DATABASE_URL`, `REDIS_URL`, `NODE_ENV`) are set directly in Railway's dashboard;
the only place they're mirrored in-repo is `docker-compose.yml`'s `alert-worker` service
block (used for local dev only).

## Cross-reference against the 4 confirmed-live secrets (Session 0-3)

| Secret                      | Actual env-var name     | Present in the 5 catalog files?            |
| --------------------------- | ----------------------- | ------------------------------------------ |
| Cron bearer auth            | `CRON_SECRET`           | **No**                                     |
| RiseWorks webhook signature | `RISE_WEBHOOK_SECRET`   | **No**                                     |
| Stripe webhook signature    | `STRIPE_WEBHOOK_SECRET` | Yes (`.env.example`, `.env`, `.env.local`) |
| dLocal HMAC signature       | `DLOCAL_WEBHOOK_SECRET` | **No**                                     |

All 4 appear in this matrix (via live-code grep, per the order's verify step), satisfying
"every secret referenced in Session 0-3's specs appears in the matrix." 3 of the 4 are absent
from every one of the 5 source files — see Gaps below.

## Gaps found (documented, not fixed — read-only session)

1. **`.env.example` is missing several secrets the live code requires to function:**
   `CRON_SECRET`, `RISE_WEBHOOK_SECRET`, `DLOCAL_API_KEY`, `DLOCAL_SECRET_KEY`,
   `DLOCAL_WEBHOOK_SECRET`, `DLOCAL_API_URL`. A new contributor following `.env.example`
   alone could not stand up cron auth, RiseWorks, or dLocal payments.
2. **Naming drift between the template and live env:** `.env.example` declares
   `MT5_LOGIN`/`MT5_PASSWORD`; the live `.env`/`.env.local` instead set
   `MT5_LOGIN_01`/`MT5_PASSWORD_01`. Same drift for `FLASK_MT5_URL`
   (`docker-compose.yml`) vs. `MT5_SERVICE_URL` (`.env.example`) — two names for what
   looks like the same concept.
3. **`MT5_ADMIN_API_KEY` and `ADMIN_API_KEY`** are declared in `.env.example` but absent
   from the live `.env`/`.env.local` — either unused now or set only in the Vercel/Railway
   dashboard, not locally.
4. **`OPENAI_API_KEY`/`OPENAI_API_BASE`** are documented as "Required for AI Development"
   in `.env.example` but have zero references anywhere in live `app/**`/`lib/**` — they're
   Aider tooling config, not an application runtime dependency. Worth a comment update in
   `.env.example` at some point (not this session — cataloging only).
5. **`RESEND_FROM_EMAIL`/`RESEND_REPLY_TO`** are read by `lib/email/email.ts` but never
   documented in `.env.example`.

None of these were fixed — per this order's rules, `.env.example` and the other 4 files are
not modified this session.

# Money Service Migration Blueprint

**Extracting Parts 12–17–18–19 into an independent backend microservice**

|                     |                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Scope**           | Part 12 (E-commerce & Billing / Stripe), Part 17 (Affiliate), Part 18 (dLocal Payments), Part 19 (RiseWorks Disbursement) |
| **Target backend**  | NestJS v11 on Railway ("money-service")                                                                                   |
| **Target frontend** | Next.js v16 on Vercel (UI for 17/18/19 folded into the main frontend app)                                                 |
| **Phase 1**         | Shared PostgreSQL with all other parts (MVP)                                                                              |
| **Phase 2**         | Dedicated PostgreSQL for the money service                                                                                |
| **Date**            | 2026-07-04                                                                                                                |

---

## 1. Rationale & Goals

1. **Scalability** — payment webhooks, batch payouts (up to 100 payments with retries), and 8 cron jobs are long-running, stateful workloads that fit a persistent Node process better than serverless functions.
2. **Attack-surface reduction** — dLocal secrets, RiseWorks wallet keys, and CRON_SECRET move off the Vercel edge onto one hardened Railway service with a narrow ingress.
3. **Failover isolation** — the marketing/trading UI degrades gracefully if the money service is down; the money service is unaffected by frontend deploys.
4. **Financial data security** — a single audited enforcement point for HMAC verification, rate limiting, role gates, and (Phase 2) physically separated financial data.

**Non-goal:** splitting 12/17/18/19 into separate services. They share one transaction boundary (checkout → charge → code → commission → payout) and heavily share code (Part 12 and 18 share the dLocal services, both webhooks, and checkout validation). They must remain **one** service.

**Why Part 12 belongs in scope:** Part 12 IS the Stripe half of the payment stack. Its checkout creates the sessions whose webhooks create Part 17 commissions; its subscription/invoice APIs read the same Payment and Subscription tables Part 18 writes. Leaving it in the core app would put the money domain's primary revenue path outside the money service — the exact seam this migration exists to close.

---

## 2. Target Architecture (End State)

```
┌────────────────────────────┐        ┌─────────────────────────────────┐
│  VERCEL — Next.js 16 (UI)  │        │  RAILWAY — NestJS 11            │
│  frontend microservice     │  HTTPS │  "money-service"                │
│                            │──────▶ │                                 │
│  /pricing /settings/billing│  JWT   │  BillingModule (Stripe, P12)    │
│  /checkout  /affiliate/*   │        │  AffiliateModule (P17)          │
│  /admin/affiliates/*       │        │  PaymentModule (dLocal, P18)    │
│  /admin/disbursement/*     │        │  DisbursementModule (Rise, P19) │
│  (all other product UI)    │        │  ReportsModule                  │
└────────────┬───────────────┘        │  @nestjs/schedule (8 crons)     │
             │                        │  BullMQ (webhooks, payouts)     │
             │ core reads             └──────┬──────────┬───────────────┘
             ▼                               │          │ webhooks (HMAC)
┌────────────────────────────┐               │          ▼
│  CORE BACKEND (other parts)│               │   Stripe · dLocal · RiseWorks
│  users, auth, trading, …   │               │
└────────────┬───────────────┘               │
             ▼                               ▼
      PostgreSQL  ◀── Phase 1: one instance, two roles/schemas
                  ◀── Phase 2: core DB  +  money DB (separate instances)
```

---

## 3. Service Boundary — What Moves, What Stays

### Moves to money-service (NestJS)

| Domain  | Assets                                                                                                                                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Part 12 | `lib/stripe/*` (client, `createCheckoutSession` with coupon discounts, webhook-handlers), `/api/checkout`, `/api/subscription` + `/cancel`, `/api/invoices`, `/api/webhooks/stripe`, `lib/email/subscription-emails.ts`, `types/payment.ts` |
| Part 17 | `lib/affiliate/*` (incl. `conversion-processor.ts`), `lib/admin/affiliate-management.ts`, `lib/admin/code-distribution.ts`, all `/api/affiliate/*`, `/api/admin/affiliates/*`, `/api/checkout/validate-code`, affiliate email templates     |
| Part 18 | `lib/dlocal/*`, `lib/geo/detect-country.ts`, all `/api/payments/dlocal/*`, `/api/webhooks/dlocal`, fraud-alert APIs, subscription-lifecycle crons (files shared with Part 12 move once — they are the same files)                           |
| Part 19 | `lib/disbursement/*` (providers, services, webhook, cron), all `/api/disbursement/*`, `/api/webhooks/riseworks`                                                                                                                             |
| Cross   | All 8 cron jobs, `lib/rate-limit.ts` (or Nest ThrottlerModule + Redis), SystemConfig read/write for money keys                                                                                                                              |

### Stays in the core app / frontend

- User, Auth (NextAuth), trading features, notifications
- All React pages/components (pricing/billing UI, affiliate portal UI, checkout UI, admin dashboards) — they become pure API consumers

### Boundary-straddler decisions (make these first)

| Object           | Decision                                                                                                                                                                                                                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**         | Owned by core. Money service stores `userId` as opaque string; no FK; user data fetched via core API when needed (emails)                                                                                                                                                                       |
| **Subscription** | Written by money service, read constantly by core for PRO gating. **Decision: money service publishes tier changes to core** (`POST /internal/users/{id}/tier`), core persists a denormalized `tier` on User (it already does). Eventual consistency ≤ seconds; no latency added to gate checks |
| **Notification** | Owned by core. Money service calls core internal API instead of writing the table directly                                                                                                                                                                                                      |
| **SystemConfig** | Money keys (`affiliate_*`, disbursement) owned by money service; core keys stay core. Table stays shared in Phase 1; split by ownership in Phase 2                                                                                                                                              |

---

## 4. Phase 0 — Prerequisites (before any code moves)

1. **Contract-first:** write the OpenAPI spec for every endpoint the frontend consumes today (the route inventory in `docs/files-completion-list/` is the checklist). The Nest service must be a drop-in: same paths, same JSON shapes, so the frontend change is only a base-URL swap.
2. **Auth bridge:** NextAuth issues JWTs (`session.strategy = 'jwt'`). Money service validates the same JWT (shared `NEXTAUTH_SECRET` or JWKS) via a Nest `JwtAuthGuard` + `RolesGuard('ADMIN')`. No cookie sharing across domains — the frontend sends `Authorization: Bearer`.
3. **Internal service auth:** core ↔ money calls use a dedicated service token (`SVC_TOKEN`), never user JWTs.
4. **CORS:** money service allows the Vercel origin(s) only.
5. **Seed SystemConfig:** `affiliate_commission_approval_days = 14` (used by the auto-approval added in the 2026-07 audit).

---

## 5. Phase 1 — Split Compute, Share Database (MVP)

### 5.1 Database discipline (the rules that make Phase 2 cheap)

1. **Two PostgreSQL roles on the one instance:**
   - `money_svc` — ALL on: AffiliateProfile, AffiliateCode, Commission, Payment, Subscription, SystemConfig(+History), FraudAlert, AffiliateRiseAccount, PaymentBatch, DisbursementTransaction, RiseWorksWebhookEvent, DisbursementAuditLog. SELECT on **nothing else**.
   - `core_app` — no privileges on the money tables above (read-only grant on Subscription during transition if needed, revoked at cutover).
2. **No cross-domain joins or writes.** Money service never queries User; core never queries Commission. Violations = migration debt.
3. **Opaque references only.** Drop reliance on FKs between money tables and User.
4. **Connection pooling:** PgBouncer in front (transaction mode). Railway service gets a modest steady pool (10–20); Vercel functions use the pooler.

### 5.2 NestJS 11 project skeleton

```
money-service/
├── src/
│   ├── main.ts                    # helmet, CORS, pino logger
│   ├── app.module.ts
│   ├── common/                    # guards (Jwt, Roles, CronSecret, RateLimit),
│   │                              # interceptors (audit-log), prisma.service
│   ├── affiliate/                 # Part 17
│   │   ├── affiliate.module.ts
│   │   ├── controllers/           # affiliate.dashboard, admin.affiliates, reports (incl. code-flows)
│   │   └── services/              # code-generator, commission-calculator,
│   │                              # conversion-processor, report-builder, registration
│   ├── billing/                   # Part 12 (Stripe)
│   │   ├── billing.module.ts
│   │   ├── controllers/           # checkout, subscription (+cancel), invoices, stripe.webhook
│   │   └── services/              # stripe.service (sessions + coupon discounts),
│   │                              # stripe-webhook-handlers, subscription-emails
│   ├── payments/                  # Part 18 (dLocal)
│   │   ├── payments.module.ts
│   │   ├── controllers/           # dlocal.payments, dlocal.webhook, fraud-alerts
│   │   └── services/              # dlocal-payment, currency-converter,
│   │                              # payment-methods, three-day-validator
│   ├── disbursement/              # Part 19
│   │   ├── disbursement.module.ts
│   │   ├── controllers/           # affiliates, batches, riseworks, webhook, reports, config, health
│   │   ├── services/              # batch-manager, orchestrator, aggregator, retry, tx-logger
│   │   └── providers/             # base, mock, rise (siwe-auth, webhook-verifier, amount-converter)
│   ├── scheduler/                 # @nestjs/schedule — all 8 crons (replaces vercel.json)
│   └── internal/                  # core-app client (tier updates, notifications, user lookups)
├── prisma/schema.prisma           # money models only; datasource = shared DB (Phase 1)
└── test/                          # ported Jest suites (they carry over nearly 1:1)
```

**Porting notes**

- The `lib/*` service layers are framework-free TypeScript — they become Nest `@Injectable()` services with constructor-injected `PrismaService`. Route handlers become thin controllers.
- Crons move from Vercel Cron to `@nestjs/schedule` `@Cron()` decorators — same UTC expressions as `vercel.json`. CRON_SECRET auth becomes unnecessary (no public cron endpoints) but keep the guard for manual triggers.
- Webhooks: register **raw-body** parsing for the three webhook controllers (HMAC verification needs the exact bytes).
- Long work (batch execution, email sends) goes to BullMQ queues (Railway Redis) so webhook responses stay <1s.

### 5.3 Railway deployment

- Service: `money-service` (Dockerfile or Nixpacks), min 1 replica always-on; horizontal scale on CPU.
- Attach: Railway Redis (BullMQ + rate limiting), shared PostgreSQL via `money_svc` role through PgBouncer.
- Secrets: `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET` (JWT verify), `DLOCAL_*`, `RISE_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `SVC_TOKEN`, `RESEND_API_KEY`.
- Health: expose `/health` (already implemented) for Railway healthchecks.
- Observability: pino JSON logs; alerts on failed transactions >5/24h and webhook silence >24h (mirrors existing health thresholds).

### 5.4 Frontend consolidation (Vercel, Next.js 16)

- All 17/18/19 pages remain in the main Next.js app; data hooks point at `NEXT_PUBLIC_MONEY_API_URL`.
- Remove the `frontend/` **mirror files** for dLocal services/routes — the mirror pattern dissolves once the backend is a real service (single source of truth).
- Frontend keeps zero money secrets. It renders; the money service decides.

### 5.5 Cutover sequence (strangler, per slice; each slice is reversible)

| Slice | What moves                                                                                                                      | Cutover mechanism                                   | Rollback                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------ |
| 1     | 8 cron jobs                                                                                                                     | Enable Nest scheduler; empty `crons` in vercel.json | Re-add vercel.json crons |
| 2     | RiseWorks + dLocal webhooks                                                                                                     | Update endpoint URLs in provider dashboards         | Point URLs back          |
| 3     | Read APIs (dashboards, reports, admin lists)                                                                                    | Frontend base-URL swap behind env flag              | Flip flag                |
| 4     | Write APIs (Stripe checkout + subscription/cancel + invoices, dLocal create, code distribution, batch execute) + Stripe webhook | Same flag; Stripe webhook URL swap                  | Flip back                |
| 5     | Tier-update event path (money → core)                                                                                           | Core stops reading Subscription directly            | Re-enable direct read    |

**Verification per slice:** shadow-run (call both old and new, diff responses) for 48h on read APIs; webhook replay tests with recorded signed payloads; the ported Jest suites must be green before each slice.

### 5.6 Phase 1 exit criteria

- All money endpoints served from Railway for 30 days, error rate < 0.1%
- Zero direct cross-domain table access (verified by role grants + query logs)
- Batch payouts and all crons executing on schedule
- Core reads tier only from its own User table

---

## 6. Phase 2 — Dedicated Money Database

**Trigger (observable, not calendar):** cross-domain contention (reporting queries slowing checkout, migration lock conflicts), compliance requirement for physically separated financial data, or backup/PITR policies diverging.

### 6.1 Steps

1. Provision `money-db` PostgreSQL on Railway (private network only; no public ingress). Enable PITR; daily encrypted snapshots, ≥35-day retention (financial audit trail).
2. Split the Prisma schema: money models → money-service repo (they already are, Phase 1); remove them from the core schema.
3. **Migrate data** (small tables; minutes of write-freeze is acceptable):
   - Freeze writes (maintenance flag; webhooks queue in BullMQ during freeze — they are idempotent and retried).
   - `pg_dump --table=<money tables>` → restore into `money-db`.
   - Reconcile row counts + checksums; run the code-flows and P&L reports against both and diff.
   - Swap `DATABASE_URL`, unfreeze; queued webhooks drain.
4. Drop money tables from the core DB (after a 2-week safety window with the old tables renamed `_migrated_*`).
5. SystemConfig: money keys now live only in money-db; core keys only in core DB.

### 6.2 What changes operationally

- Two backup/restore pipelines, two migration pipelines (Prisma Migrate per service).
- Cross-domain reporting (e.g., LTV joining user attributes with payments) becomes API composition or a read-only analytics replica fed from both DBs — never direct cross-DB queries from app code.
- Distributed consistency: keep the **outbox pattern** for money → core events (tier updates) so a core outage never loses an upgrade; BullMQ retries with backoff (the retry-handler pattern from Part 19 generalizes).

---

## 7. Security Checklist (both phases)

- [x] HMAC-SHA256 verification on Stripe, dLocal, RiseWorks webhooks (raw body)
- [x] JWT validation + role guards (ADMIN) on all admin/disbursement routes
- [x] Rate limiting on code-validation endpoints (added 2026-07 audit); extend Nest Throttler to auth-sensitive routes
- [ ] Railway private networking: DB + Redis unreachable from public internet
- [ ] Secrets only in Railway env (wallet keys never in Vercel); quarterly rotation for SVC_TOKEN and CRON/webhook secrets
- [ ] Audit interceptors: every mutating admin action → DisbursementAuditLog / SystemConfigHistory (pattern already exists — make it a global Nest interceptor)
- [ ] Egress allow-list from money-service: dLocal, Stripe, RiseWorks, exchangerate-api, Resend only
- [ ] WAF/IP allow-list option for `/webhooks/*` (provider IP ranges where published)

## 8. Risk Register

| Risk                                      | Likelihood | Impact              | Mitigation                                                                                        |
| ----------------------------------------- | ---------- | ------------------- | ------------------------------------------------------------------------------------------------- |
| JWT drift between NextAuth and Nest guard | Medium     | Auth outages        | Contract tests on token claims; shared JWKS                                                       |
| Webhook loss during URL cutover           | Low        | Missed payments     | Providers retry; slice-2 window with both endpoints live; idempotent handlers                     |
| Connection pool exhaustion (shared DB)    | Medium     | Checkout errors     | PgBouncer + per-service caps before slice 3                                                       |
| Money service downtime blocks checkout    | Low        | Revenue             | Always-on replica, health-gated deploys, Stripe path can fail over to core temporarily in Phase 1 |
| Data-migration divergence (Phase 2)       | Low        | Financial integrity | Freeze + checksum + report-diff + 2-week soft-delete window                                       |
| Team velocity: two repos/pipelines        | Certain    | Slower iteration    | Shared types package for API contracts; OpenAPI-generated client                                  |

## 9. Sizing (indicative)

| Workstream                                     | Estimate                 |
| ---------------------------------------------- | ------------------------ |
| Phase 0 contracts + auth bridge                | 1–2 weeks                |
| Nest skeleton + service-layer port + test port | 2–3 weeks                |
| Slices 1–2 (crons, webhooks)                   | 1 week incl. soak        |
| Slices 3–4 (APIs) + frontend swap              | 2 weeks incl. shadow-run |
| Slice 5 + Phase 1 hardening                    | 1 week                   |
| **Phase 1 total**                              | **~7–9 weeks**           |
| Phase 2 (when triggered)                       | 1–2 weeks                |

---

_Companion documents: `docs/audit/part17-18-19-system-audit.md` (pre-migration fixes), `docs/files-completion-list/files-inventory/` (route/file inventory used as the porting checklist)._

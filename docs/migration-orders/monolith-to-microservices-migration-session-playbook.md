# Migration Session Playbook — Development & Deployment Sessions for Claude Code

**Purpose:** The operational companion to
`docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2). That document says
_what_ to build and in _what order_; this one divides the work into discrete Claude Code
**sessions** — each one a verifiable unit of work you can start, supervise, and close in a
single sitting.

**The rule every session obeys:** one session = one verifiable unit of work. It ends with
tests green and documents updated — never mid-cutover, never with something half-deployed.

**Session numbering:** `Session P-N` = phase P, session N. Sessions within a phase run in
order. `⏸ WAIT` entries are wall-clock waiting periods (shadow-runs, stability windows) — no
session runs during them; you simply wait, watch dashboards, and start the next session when
the clock is done.

**Session count summary:** ~50–60 sessions total. Phase 4 dominates (~25–30); the exact count
there depends on how cleanly each slice ports.

---

## 0. How to run every session (the ritual — chained migration orders)

Every session executes a **migration order** (`docs/migration-orders/` — read
`00-SKELETON-AND-RULES.md` for the shared skeleton, the six template variants, and the
Autonomy & Deviation clause). The chain: session N ends by DRAFTING the order for session
N+1; session N+1 begins by CONFIRMING that draft against the live codebase. You (Davin)
review and approve each draft between sessions.

**Open every session with:**

> Read CLAUDE.md, docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md, and the
> DRAFT migration order for this session in docs/migration-orders/. Re-verify the draft
> against the current codebase (file paths, line counts, flag states, entry criteria) and
> mark it CONFIRMED — show me what changed since it was drafted, and this session's "done
> when" checks, before executing anything. If no draft exists, generate one from the correct
> template variant first and wait for my approval.

**Close every session with:**

> Run the tests relevant to this session and show me the results. Fill in the Deviations
> section of this session's order. Then update CLAUDE.md (current phase/session, what was
> completed, what's next), the Decision Log if any flag was touched, the cutover table if
> any route moved, and — if this session created, moved, or deleted files — the affected
> entries in docs/migration-orders/migration-stack-analysis.md (the file inventory the
> Advisor plans from). If any error cost >30 minutes, recurred, or reached CI/production,
> distill it into a rule in docs/migration-orders/LESSONS-LEARNED.md. Finally, PRE-DRAFT
> the migration order for the next session (correct template variant, informed by today's
> deviations) and show it to me for approval.

**Abort rule:** if a session hits a blocker it can't resolve, it ends by _documenting the
blocker_ in CLAUDE.md — it does not push on into a half-done state. The next session starts
at the blocker.

**CLAUDE.md starter** (create in repo root during Session 0-1):

```markdown
# Migration state

- Plan: docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md (v1.2)
- Playbook: docs/migration-orders/monolith-to-microservices-migration-session-playbook.md
- Migration orders: docs/migration-orders/ (rules: 00-SKELETON-AND-RULES.md)
- Current: Phase 0, Session 0-1
- Current order: docs/migration-orders/<session>-<slug>.migration-order.md (DRAFT|CONFIRMED)
- Open flags: F1–F19 (see plan §11)
- Cutover table: docs/migration-orders/migration-cutover-table.md (created in Session 4A-1)
- Last session did: —
- Next session must: —
```

---

## Phase 0 — Foundations (5 sessions)

### Session 0-1 — Orientation & reference study

- **Tasks:** Verify root CLAUDE.md + `docs/migration-orders/EXECUTOR-PROTOCOL.md` are in
  place and current (both pre-scaffolded 2026-07-11). Read `railway-gateway/` end-to-end and write
  `docs/railway-gateway-reference-notes.md`: project layout, Prisma service wiring, guard
  pattern, health module, `railway.toml`, BullMQ worker — the template every new service
  copies. Read plan §2 flags; resolve **F2/F19 npm checks** (verify next@16.2.10,
  @nestjs/core 11.1.28, prisma@7.8.0 exist; record pins in Decision Log).
- **Done when:** notes file committed; version pins recorded; CLAUDE.md live.
- **You provide:** nothing yet — this is read-only.

### Session 0-2 — OpenAPI contracts, batch 1 (operation domain)

- **Tasks:** Resolve **F1** scope (PUBLIC endpoints only). Generate OpenAPI specs from the
  live route handlers for: auth, alerts, drawings, notifications, tier, user, market-data
  channel. Commit to `docs/open-api-documents/`.
- **Done when:** every listed route group has a spec that matches its real handler
  (spot-check 5 routes by reading the code side-by-side).

### Session 0-3 — OpenAPI contracts, batch 2 (money domain)

- **Tasks:** Same for: checkout, subscription, invoices, payments/dlocal, admin/affiliates,
  affiliate, disbursement, webhooks (stripe/dlocal/riseworks), cron. Reconcile with the 5
  existing part-XX specs.
- **Done when:** all 99 `app/api/**` routes are covered by a spec or explicitly marked
  internal-only; F1 closed in the Decision Log.

### Session 0-4 — Secret matrix + test baseline

- **Tasks:** Build the per-service secret matrix (plan 0.4) from `vercel.json`, `.env*`,
  `docker-compose.yml`, `railway-worker.json`, `railway-gateway/.env.example`. Run the FULL
  existing test suite; commit results as `docs/migration-test-baseline.md`.
- **Done when:** matrix committed; baseline recorded with pass/fail counts per suite.
- **You provide:** access to actual env values where files reference them (or confirm Claude
  Code should only catalog names, not values — recommended).

### Session 0-5 — Staging + local dev (CC-A, CC-I openers)

- **Tasks:** Create root `docker-compose.dev.yml` (Postgres, Redis, Next.js dev; PgBouncer +
  services join later). Set up the staging environment shells (Railway staging
  environment/project + a Vercel preview branch). Decide **F17** (staging data: recommend
  synthetic seed, never unmasked money data).
- **Done when:** `docker-compose up` boots the monolith locally against seeded Postgres;
  staging shells exist; F17 in Decision Log. **Phase 0 exit criteria reviewed and checked.**
- **You provide:** Railway + Vercel account access; F17 decision approval.

---

## Phase 1 — Railway PostgreSQL (4 sessions)

### Session 1-1 — Find the database + rehearse restore (F3, CC-G)

- **Tasks:** Resolve **F3**: inspect live `DATABASE_URL`s / Railway dashboard; document where
  the monolith's Postgres actually lives. Take a backup and restore it to a scratch instance;
  verify row counts and that the app boots against the restore. Record **F18** (your RPO/RTO
  answer) in the Decision Log.
- **Done when:** F3 answered; restore rehearsal documented with checksums; F18 recorded.
- **You provide:** database credentials/dashboard access; your F18 decision (how much
  data-loss/downtime is acceptable — e.g. "≤24h RPO, ≤1h RTO").

### Session 1-2 — (CONDITIONAL) Relocate database to Railway

- **Runs only if F3 found the DB off-Railway; otherwise skip.**
- **Tasks:** Provision Railway Postgres + backups; maintenance-window `pg_dump`/restore;
  re-point monolith `DATABASE_URL`; verify counts/checksums; keep old instance read-only 7 days.
- **Done when:** monolith fully functional on Railway Postgres; baseline tests green;
  rollback path (old instance) documented.
- **You provide:** approval of the maintenance window (brief downtime).

### Session 1-3 — Roles

- **Tasks:** Write idempotent `prisma/roles/roles.sql` creating `money_svc` and `core_app` with the plan §3 grants; apply it to the production database.
- **Done when:** grant script committed & applied; direct connections proven.

### Session 1-3b — PgBouncer Deployment

- **Tasks:** Deploy PgBouncer (transaction mode) as a custom image with pass-through auth utilizing the SCRAM verifiers from 1-3.
- **Done when:** PgBouncer is live; pass-through auth proven to preserve grants; prisma runtime works through the pooler.

### Session 1-4 — Enforcement smoke test

- **Tasks:** Connect as each role and prove the fences: `money_svc` cannot read User;
  `core_app` cannot read Commission; `gateway_ingest` can only write market data. Confirm
  `railway-gateway` ingest never blipped. Check Phase 1 exit criteria.
- **Done when:** documented pass on all denial tests; production monolith unaffected.

---

## Phase 2 — Prisma 7.8.0 + non_market_data schema (4 sessions)

### Session 2-1 — Prisma upgrade in isolation (step 2.0, F19)

- **Tasks:** Read official Prisma 6 & 7 upgrade guides; audit codebase per F19 checklist
  (client output/ESM, previewFeatures, PgBouncer semantics, `$use`, Decimal/JSON typings,
  Node minimums). Bump to 7.8.0, regenerate client, fix breakages, full test suite vs
  baseline, deploy staging → production.
- **Done when:** production on Prisma 7.8.0 with tests green; F19 audit in Decision Log.
  **No schema changes in this session.**
- **You provide:** approval for the production deploy.

### Session 2-2 — Model census + schema split (F4, F5)

- **Tasks:** Enumerate every model in live `schema.prisma`; assign each to
  market/non-market (**F4**). Decide file layout (**F5** — two schema files/two clients
  recommended; validate under Prisma 7). Create `prisma/market-data/schema.prisma` +
  `prisma/non-market-data/schema.prisma`. Add `RefreshToken` model.
- **Done when:** both schema files committed; census table in Decision Log; `prisma validate`
  passes on both.

### Session 2-3 — Baseline migration + FK audit

- **Tasks:** Baseline both schemas against the existing DB (no-op first migration via
  `migrate diff`). Cross-domain FK audit: drop money↔User FK constraints, keep indexed
  columns; document each drop.
- **Done when:** migration history clean; FK changes applied in staging and verified.

### Session 2-4 — Rewire the monolith

- **Tasks:** Split `lib/db/prisma.ts` into two client singletons; update imports; split
  `prisma/seed.ts`. Full test suite; deploy staging → production. Check Phase 2 exit criteria.
- **Done when:** production runs on split clients, tests green, zero behavior change.

---

## Phase 3 — Hybrid JWT auth (5 sessions)

### Session 3-1 — Auth decisions + operation-service skeleton + bridge

- **Tasks:** Resolve **F6** (locate/read the 3 missing auth docs if they exist; decide
  OpenAuth vs bridge-first vs hand-rolled — plan recommends bridge-first) and **F7** (HS256
  now, JWKS trigger point). Scaffold `operation-service` NestJS app from the 0-1 reference
  notes; implement `JwtAuthGuard` verifying the NextAuth JWT (`session.strategy='jwt'`,
  claims: sub/email/role/tier).
- **Done when:** a protected NestJS `/health-auth` endpoint on staging returns 200 with a
  NextAuth-issued JWT, 401 without.
- **You provide:** F6/F7 sign-off; `NEXTAUTH_SECRET` availability to the Railway service.

### Session 3-2 — Token endpoints

- **Tasks:** Implement `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`,
  `/auth/me` in NestJS, reusing `lib/auth/*` logic (password verify, 2FA, lockout).
  RefreshToken persistence (hashed, revocable) in Prisma.
- **Done when:** ported auth unit tests green; refresh + revocation proven by test.

### Session 3-3 — Next.js side

- **Tasks:** Cookie-set API route, middleware guard on protected matchers, ~14-min silent
  refresh loop, SSR fetch helpers forwarding the bearer token.
- **Done when:** staging walkthrough: login → dashboard SSR → browser call → logout, all via
  the new token path (NextAuth still untouched in production).

### Session 3-4 — CORS + secondary flows

- **Tasks:** NestJS CORS (Vercel origins + localhost, credentials). Re-point 2FA, email
  verification, and password reset flows to NestJS endpoints in the staging build.
- **Done when:** all three flows pass manual + automated tests on staging.

### Session 3-5 — Three-path verification (phase exit)

- **Tasks:** Automated e2e proving a protected endpoint works via (a) SSR, (b) browser,
  (c) service-to-service `SVC_TOKEN`; token expiry/refresh/revocation e2e; confirm NextAuth
  production regression-free. Check Phase 3 exit criteria.
- **Done when:** all e2e green; Decision Log updated; dual-auth running.

---

## Phase 4 — Backend move to NestJS (~25–30 sessions, pattern-based)

Phase 4 is repetitive by design. Two session _templates_ repeat per slice:

> **BUILD session (per slice):** port the slice's `lib/*` + routes to NestJS matching the
> OpenAPI contract → ported Jest suites green → deploy to staging → contract tests pass →
> start production shadow-run (reads) or replay tests (webhooks). Old code is now
> **change-frozen** (CC-F). Ends with shadow-run STARTED, not finished.
>
> **⏸ WAIT: 48h shadow-run.**
>
> **CUTOVER session (per slice):** review shadow-diff (must be explained-clean) → you approve
> → flip the env flag → monitor → update cutover table. Rollback = flip back. Small session
> on purpose — never combine with new build work.

### 4A — money-service (its blueprint's 5 slices)

- **Session 4A-1 — Skeleton + deploy:** money-service NestJS skeleton (blueprint §5.2),
  Railway deploy with `money_svc` role via PgBouncer, `/health` live, secrets from the 0-4
  matrix. Populate `docs/migration-orders/migration-cutover-table.md` (pre-scaffolded) with real slice rows. Also resolve **F16** (URL scheme +
  `/v1` prefix) and **F15** (Redis namespacing) — they must precede the first cutover.
- **Sessions 4A-2/3 — Slice 1 (8 cron jobs):** BUILD then CUTOVER (empty `vercel.json` crons).
- **Sessions 4A-4/5 — Slice 2 (RiseWorks + dLocal webhooks):** BUILD (replay tests with
  recorded signed payloads) then CUTOVER (you update provider dashboard URLs).
- **Sessions 4A-6/7 — Slice 3 (read APIs):** BUILD then ⏸ 48h ➜ CUTOVER.
- **Sessions 4A-W1…W8 — Part 19.5: RiseWorks → Wise disbursement** _(inserted 2026-07-25, Davin's
  call; suffix numbering per 00-SKELETON-AND-RULES §5 — nothing renumbered)_. Governing docset:
  `docs/migration-orders/replace-rise-with-wise/`.
  - **4A-W1 — Contracts & decisions** (CONTRACT): resolve **F36** (integration model — resolved
    Model A, Business + personal token) / **F37** (funding mode — resolved `MANUAL`, region-gated);
    register F38–F41; freeze the OpenAPI spec + the Wise-state mapping table; check for Business
    Payment Approval rules (confirmed absent). No code. Executed 2026-07-26.
  - **4A-W2 — Additive schema** (INFRA+PORT): 5 new tables + the `WISE` enum value, authored in
    `prisma/non-market-data/schema.prisma` and mirrored as a subset into money-service
    (`prisma generate` only — **L1**). Nothing dropped or renamed.
  - **4A-W3a — BUILD recipient onboarding backend** (PORT): Wise API client, RSA signature
    verifier, recipient service (`money-service`), requirements schema endpoint, PII redaction.
  - **4A-W3b — BUILD recipient onboarding UI** (UI-BUILD): Dynamic schema-driven React form
    component, admin recipient list page (`monolith`).
  - **4A-W4 — CC-C/CC-D hardening gate for the money surface** (CONTRACT + small INFRA): closes the
    plan §13 gate _"CC-C idempotency + CC-D rate limits before the first Phase 4 write-API
    cutover"_ — because the Wise cutover **is** that cutover in substance. Audits (does **not**
    fix) idempotency keys on every existing money write endpoint; verifies the dLocal webhook
    dedupe table; adds `enableShutdownHooks()` (**pre-existing defect** — `PrismaService.onModuleDestroy`
    is dead code today); replaces the implicit global throttle on `/v1/webhooks/dlocal` with an
    explicit generous per-route limit (**pre-existing defect** on live money traffic); writes the
    BullMQ job-ID policy before the first queue exists; registers **F43**.
    **F14/outbox and the Stripe/dLocal write-path fixes stay 4A-8's.**
  - **4A-W5 — BUILD Wise webhook + reducer** (PORT): `/v1/webhooks/wise`, `X-Delivery-Id` dedupe,
    `occurred_at` ordering, store-then-process via BullMQ, at-most-once accounting.
    **Verification is REPLAY with real Wise-signed payloads captured from the sandbox Simulation
    API — not a 48h shadow-run.**
  - **4A-W6 — BUILD payout engine + funding gate** (PORT): quote/transfer/batch-group services,
    the `isFundable` orchestrator branch, admin funding gate, reconciliation cron.
  - **4A-W7 — CUTOVER to Wise** (VERIFY-RETIRE) ⚠️ **REAL MONEY**: subscribe production webhooks,
    flip `DISBURSEMENT_PROVIDER` (archive switch **A3** — the flip _is_ the cutover mechanism), ONE
    small smoke payout with Davin funding live. **No code changes in this session** — A1/A2 moved to
    W8 per `TEMPLATE-VERIFY-RETIRE.md`'s near-zero dial.
  - **4A-W8 — Archive RiseWorks** (VERIFY-RETIRE, **ARCHIVE not RETIRE — nothing is deleted**):
    archive switches A1/A2, banners, flag-gated UI, schema comments, dormancy verification, restore
    dry-run, inventories.
  - **⚠️ CC-C/CC-D:** the requirements are **plan §13's**, written at Phase 0 and _"enforced
    throughout Phase 4"_ — 4A-8 audits and completes them, it does not author them. `4A-W4` closes
    the gate for the Wise scope before any money code; **4A-8 keeps its number, slot and scope**
    (F14 outbox + Stripe/dLocal write paths) and then _verifies_ rather than rebuilds.
  - **REVOKED:** `4A-5-RW` (RiseWorks webhook cutover) — will never run.
- **Session 4A-8 — CC-C hardening gate:** idempotency keys on write endpoints, webhook dedupe
  tables verified/added, outbox decision (**F14**) implemented, rate limits (CC-D) on money
  routes. _Required before slice 4._
- **Sessions 4A-9/10 — Slice 4 (write APIs + Stripe webhook):** BUILD then ⏸ ➜ CUTOVER
  (highest-risk moment of the whole migration — your explicit approval).
- **Sessions 4A-11/12 — Slice 5 (tier-update event path):** BUILD (outbox + reconciliation
  cron) then CUTOVER.
- **⏸ WAIT: 30-day stability window begins (blueprint §5.6); overlaps 4B work.**

### 4B — operation-service (easiest first, riskiest last)

- **Session 4B-1 — Types package:** extract `@trading-alerts/types` (**F9**: choose workspace
  mechanics); both services + monolith consume it.
- **Sessions 4B-2/3 — Alert engine:** port `lib/alert-engine/*` + worker to
  operation-service; BUILD then CUTOVER (Redis pub/sub in, BullMQ out — verify with CC-B
  correlation IDs).
- **Session 4B-4 — Shared infra:** redis/cache/logger/errors/monitoring as Nest providers +
  interceptors; OTel + correlation-ID middleware (**F13** resolved here if not earlier).
- **Sessions 4B-5…16 — Domain slices**, BUILD/CUTOVER pairs in this order: alerts CRUD →
  drawings + drawing-alerts → notifications → tier (guard) → user/profile/2FA/sessions →
  market-data channel proxy.
- **Session 4B-17 — Realtime (F8):** read the two realtime spec docs FIRST, decide socket
  architecture, then BUILD; CUTOVER in 4B-18.
- **Session 4B-19 — Email rendering:** CORE `emails/*` + `lib/email/email.ts` port.
- **Sessions 4B-20/21 — Auth cutover (LAST):** retire `[...nextauth]`, swap login/register
  forms to NestJS endpoints, delete `auth-options.ts`. BUILD/verify on staging then CUTOVER.
  NextAuth is gone only after this.
- **Session 4B-22 — Phase 4 exit review:** cutover table 100% complete, monolith `app/api/**`
  reduced to intentional keepers, both services stable. Check §5.6-style exit criteria.
- **⏸ WAIT: operation-service 30-day stability window.**

---

## Phase 5 — Next.js 16 upgrade (4 sessions, may interleave with Phase 4)

### Session 5-1 — Audit + baseline (F10)

- **Tasks:** Fetch official 15→16 upgrade guide; enumerate breaking changes against this
  codebase; record bundle/CWV/build-time baselines.
- **Done when:** written upgrade audit; baselines committed.

### Session 5-2 — Upgrade + codemods

- **Tasks:** `next@16.2.10` + peer deps; run codemods; fix breakages; full tests; Vercel
  preview deploy.
- **Done when:** preview builds and passes tests on 16.2.10.

### Session 5-3 — Bundle + component optimizations

- **Tasks:** Apply `bundle-size-optimization/**` docs: code-splitting, dynamic imports,
  client→server component conversions per the 01012026 guide.
- **Done when:** bundle ≤ baseline (target: smaller); bundle-monitor workflow green.

### Session 5-4 — Fonts + streaming + phase exit

- **Tasks:** `next/font` per FONT-OPTIMIZATION doc; Suspense/streaming on dashboard + charts
  routes per STREAMING doc; verify `vercel.json` still valid; visual smoke of all route
  groups; production deploy.
- **Done when:** Phase 5 exit criteria met (tests green, bundle ≤ baseline, no CWV
  regression).

---

## Phase 6 — Frontend redesign (~9 sessions)

### Session 6-1 — Gap matrix (F11)

- **Tasks:** Mechanically map every operation/money endpoint to its UI consumer; produce the
  gap matrix; triage with you into: build / internal-only / out-of-scope.
- **Done when:** matrix committed with your triage decisions.
- **You provide:** product judgment — which gaps matter (this is your session as much as
  Claude Code's).

### Session 6-2 — IA + design system prep

- **Tasks:** Reconcile the three shells (dashboard/admin/affiliate): shared layout
  primitives, nav, role-gating from JWT claims. Extend `components/ui/*` for backlog needs.
  Codify CC-C timeout/retry/fallback policy in interim typed fetch wrappers (OpenAPI-generated
  types).
- **Done when:** shared shell renders all three areas on staging; wrappers in place.

### Sessions 6-3…6-8 — Surface rebuilds (one per session)

Order: alerts/charts (incl. MTF + V8 variant UI) → notifications UX → settings/user → admin →
affiliate → payments. Each session: build behind flag → component tests green → staging
review by you → flip.

- **Done when (each):** surface live behind completed flag; `__tests__/components/*` updated.

### Session 6-9 — A11y + responsive audit (phase exit)

- **Tasks:** Audit changed surfaces; fix; final gap-matrix sweep (every endpoint consumed,
  internal-only, or ticketed).
- **Done when:** Phase 6 exit criteria met.

---

## Phase 7 — API client rewrite (3 sessions)

### Session 7-1 — Re-verify + generate

- **Tasks:** Re-read the `lib/api/` flag's mismatch list vs the NEW NestJS routes; regenerate
  the unified client from the OpenAPI specs (`operationApi`, `moneyApi`), JWT injection, env
  base URLs.
- **Done when:** generated client compiles; old mismatches all accounted for.

### Session 7-2 — Migrate consumers

- **Tasks:** Move Phase 6 interim wrappers onto the unified client; delete/gate
  `app/api-test/page.tsx`.
- **Done when:** zero direct `fetch()` to API base URLs outside the client (lint rule added
  and passing).

### Session 7-3 — Contract tests + docs (phase exit)

- **Tasks:** Rewrite the 2 client test files as contract tests against recorded real
  responses; update/retire the 3 stale api-client design docs.
- **Done when:** contract tests green against live staging services.

---

## Phase 8 — Decommission & final verification (5 sessions)

### Session 8-1 — Deletion sweep

- **Tasks:** Delete migrated `app/api/**` routes (except keepers), `frontend/` mirror dLocal
  slice, empty `vercel.json` crons. Full tests.
- **Done when:** monolith contains only UI + intentional keepers; production stable.

### Session 8-2 — Gateway deployment & schema dedup

- **Tasks:** Deploy the `railway-gateway` backend to the `postgre for staging` Railway project (which contains the required Postgres and Redis infrastructure). Point it at the shared market-data schema/types package; align its Prisma to 7.8.0; verify ingest.
- **Done when:** `railway-gateway` is live on `postgre for staging`, one source of truth for `MarketDataV6`; ingest verified end-to-end.

### Session 8-3 — Full-system e2e

- **Tasks:** The plan 8.3 journeys: ingest, auth/2FA, alert fire→notify (websocket+email),
  Stripe + dLocal test-mode checkout, affiliate→commission→batch (mock provider), tier gating.
- **Done when:** all journeys pass, recorded in a signed-off test report.

### Session 8-4 — Load test + capacity (CC-H)

- **Tasks:** Run load-test workflow against split architecture; verify PgBouncer under
  Vercel burst; size replicas; document monthly cost.
- **Done when:** load report + capacity/cost sheet committed.

### Session 8-5 — Runbooks + documentation close-out

- **Tasks:** Complete `docs/runbooks/*` (CC-G) incl. DLQ/paging; regenerate
  `migration-stack-analysis.md` via the categorization script; update architecture diagrams;
  close the Decision Log (all F1–F19 resolved).
- **⏸ WAIT: 30-day joint stability window (if not already elapsed) → then declare done.**
- **Done when:** Phase 8 exit criteria met. Migration complete.

---

## Quick reference: where YOU are required

| Session                           | Your input                                                                |
| --------------------------------- | ------------------------------------------------------------------------- |
| 0-4, 0-5                          | Dashboard access; F17 staging-data decision                               |
| 1-1, 1-2                          | DB credentials; F18 RPO/RTO; maintenance-window approval                  |
| 2-1                               | Production deploy approval (Prisma 7.8.0)                                 |
| 3-1                               | F6/F7 auth strategy sign-off                                              |
| 4A-1                              | F16 URL scheme decision                                                   |
| Every CUTOVER session             | Review shadow-diff → approve flag-flip                                    |
| 4A-5                              | Update webhook URLs in provider dashboards                                |
| 4A-W1                             | F36/F37 decisions; Wise account access; confirm no payment-approval rules |
| 4A-W2                             | Production Prisma migration approval                                      |
| 4A-W3a                            | F39 (who fills the recipient form) + F41 (PII retention)                  |
| 4A-W6                             | Promote `WISE_API_TOKEN` to full access; money-path review                |
| 4A-W7                             | **Cutover + fund the first real batch in the Wise app**                   |
| Every payout cycle (F37 = MANUAL) | **Fund the completed batch in the Wise app** — ongoing, not one-off       |
| 4A-9/10                           | Explicit approval — real payments cut over                                |
| 6-1                               | Product triage of the gap matrix                                          |
| All ⏸ WAITs                       | Patience — do not skip the clock                                          |

---

**Status:** v1.1 — companion to plan v1.2, now wired to the chained migration-order system
(`docs/migration-orders/`): each playbook entry describes WHAT a session does; its migration
order (drafted by the previous session, confirmed at start) describes HOW. Session counts
are estimates; splitting a session that grows too large is always correct, merging two is
almost never.

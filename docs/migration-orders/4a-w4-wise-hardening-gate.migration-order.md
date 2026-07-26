# Migration Order — CONTRACT variant (+ small INFRA edits)

> For sessions that **research, specify, audit or gap-analyse**, with a small amount of
> narrowly-scoped code. Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at
> **Medium** for the audit, **Low** for the two INFRA fixes (single-line, well-understood
> changes to already-live code).

**Session:** 4A-W4 · **Variant:** CONTRACT + small INFRA · **Status:** PRE-DRAFT
**Generated:** 2026-07-26 (Executor, at 4A-W3b's close) · **Estimated time:** 2–3h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 4 of 9
(rev 2 — inserted 2026-07-25 per Davin's sequencing call; closes the plan §13 money gate before
any Wise session writes money state)
**Flags touched:** none resolved this session; **F43** (funding-SLA alert delivery channel)
registered OPEN, owner Davin, due 4A-W6
**Target service:** money-service (`src/main.ts`, `src/app.module.ts`, dLocal webhook route) — no
Wise-specific code
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md`
§3.1–3.2 and §4 "4A-W4"

---

## Why this session, why now

Both W3 sessions are closed (4A-W3a backend, 4A-W3b frontend, both 2026-07-26). Before 4A-W5
gives money-service its **first BullMQ consumer** and 4A-W6 writes the **first real money state**
(`Commission → PAID`), the plan's own CC-C (idempotency) / CC-D (rate limiting) money gate needs
to close — otherwise the first thing that can go wrong about money ships with the gate still
open. Two pre-existing defects on **already-live** code were found 2026-07-25 and are folded into
this session rather than left for a future one:

1. **Graceful shutdown is absent** — `money-service/src/main.ts` never calls
   `app.enableShutdownHooks()`, so `PrismaService.onModuleDestroy()` has never fired on a Railway
   redeploy. This affects the crons and dLocal webhook that are **already cut over**.
2. **The live dLocal webhook has no explicit rate limit** — it inherits the app-wide
   `ThrottlerGuard` default (`{ ttl: 60000, limit: 100 }`) with no per-route override, so a retry
   burst can be 429'd and read by dLocal as delivery failure.

**Touching the live dLocal route is a change to already-cut-over money code** —
`EXECUTOR-PROTOCOL.md` §7 requires Davin present and explicit approval before this session
touches it.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] `4A-W3a` and `4A-W3b` both closed CONFIRMED (this file's own predecessor sessions).
- [ ] Davin available and has explicitly approved touching the live dLocal webhook route before
      Step 4 starts (`EXECUTOR-PROTOCOL.md` §7) — do not proceed past the audit steps without it.
- [ ] Read plan §13 (CC-C/CC-D) in full before starting — it, not this order, is the standard
      being applied.
- [ ] Re-verify live: `money-service/src/main.ts` still lacks `enableShutdownHooks()`, and
      `/v1/webhooks/dlocal` still has no route-level `@Throttle()` override — both confirmed at
      drafting time (2026-07-25), re-check neither was already fixed by an intervening session.

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Ordered steps

1. **Idempotency audit — do not fix.** For every money write endpoint that exists today (Stripe
   checkout, subscription cancel, invoices, dLocal create, code distribution,
   `batches/[batchId]/execute`), record whether it has an idempotency key and what the key is.
   Produce a table, one row per endpoint, verdict `has key` / `no key` / `n/a` — no "TBD" rows.
   Fixing Stripe/dLocal write paths stays **4A-8's** job; this step only audits.
2. **Webhook dedupe verification.** Plan §13 names `RiseWorksWebhookEvent` as the template.
   Confirm dLocal has an equivalent dedupe mechanism (or doesn't) — this is the highest-value
   check this session since dLocal is live — and record Stripe's status too. Add what's missing
   **for live paths only**.
3. **Graceful shutdown fix.** Add `app.enableShutdownHooks()` to `money-service/src/main.ts`;
   prove `PrismaService.onModuleDestroy()` now actually fires on SIGTERM (capture the log line,
   don't just assert it). Write the BullMQ drain policy 4A-W5's queue will need.
4. **Webhook throttling fix** (requires Davin present, §7). Replace the implicit global limit on
   `/v1/webhooks/dlocal` with an explicit `@Throttle({ default: { ttl: 60_000, limit: 300 } })`,
   recorded as the standing policy every future provider webhook (including Wise's) inherits.
   Verify with a replayed dLocal payload **before and after** the change — reasoning is not
   evidence on a live money path.
5. **BullMQ job-ID policy.** Write the rule before the first queue exists: job IDs derive from
   business keys so a retry can never double-fire a payout. Confirm money-service still has
   `BullModule.forRoot` but no `registerQueue`/`@Processor` yet (verified 2026-07-25 — re-check).
6. **Register F43** (funding-SLA alert delivery channel) as OPEN in `DECISION-LOG.md`, owner
   Davin, due 4A-W6.
7. **Explicitly out of scope:** F14/outbox, Stripe/dLocal write-path _fixes_ (audit only, per
   Step 1), Slice 5 mechanics, anything Wise-specific. This session hardens the existing surface
   so 4A-W5/W6 land on solid ground.

---

## Rules specific to this variant

- Ground truth priority: live code > live dashboards > recent docs > old build-orders.
- Mark assumptions explicitly in the audit table — they become entry-criteria checks for
  whoever consumes it next (4A-8).
- Step 4 is the one money/auth-adjacent change in this session — everything else is read-only
  or additive.

---

## Done when

- [ ] Idempotency audit table committed, one row per money write endpoint, no "TBD" verdicts.
- [ ] dLocal's webhook dedupe status evidenced (a query or code citation, not an assertion).
- [ ] `enableShutdownHooks()` in place; `PrismaService.onModuleDestroy` observed firing on a
      SIGTERM (log line captured).
- [ ] Explicit `@Throttle()` on `/v1/webhooks/dlocal`; a replayed dLocal payload still verifies
      and processes identically to before the change.
- [ ] BullMQ job-ID policy written into this order's Deviations _and_ into
      `01-part-19.5-wise-disbursement-architecture-design.md` §8 so 4A-W5 inherits it.
- [ ] F43 registered in `DECISION-LOG.md`.
- [ ] Full money-service test suite green; monolith `npm run validate` green (unaffected by this
      session, but re-verify since Step 4 touches shared infra).

---

## Rollback

`enableShutdownHooks()` and the `@Throttle()` decorator are both single-line changes — revert +
redeploy. No schema change, no money moved, no provider flip.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — this session touches shared
  infrastructure (shutdown hooks, throttling), not the disbursement provider itself.
- **Step 4 touches already-cut-over money code** — requires Davin present per
  `EXECUTOR-PROTOCOL.md` §7; do not proceed past Step 3 without him.

---

## Next-session handoff

_(PRE-DRAFT `4a-w5-wise-webhook-reducer.migration-order.md` at this session's close — variant
`PORT`, seeded from `04-rise-to-wise-migration-plan.md` §4 "4A-W5":_

- _Builds the Wise webhook receiver + reducer, verified via replay with recorded signed payloads
  (not a 48h shadow-run)._
- _Resolves F40 (webhook subscription level: profile vs application)._
- _Entry criteria include: a sandbox transfer can be created and funded (needed to drive the
  Simulation API) — if sandbox funding is unavailable, stop and re-plan rather than build against
  synthetic-only fixtures._
- _Inherits 4A-W4's BullMQ job-ID policy and throttling standard for its own webhook route.)_

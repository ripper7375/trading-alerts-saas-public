# Migration Order — PORT variant

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS). Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: behavior preservation
> IS the deliverable. The current monolith code is ground truth.

**Session:** 4A-9 · **Variant:** PORT · **Status:** PRE-DRAFT
**Generated:** 2026-07-27 (Executor, at 4A-8's close) · **Flags touched:** new (`MIGRATE_WRITE_APIS_MONEY_*`, name TBD by Advisor) · **Estimated time:** TBD — likely 2 sessions' worth of scope (see note below)
**Target service:** money-service
**Contract:** ⚠️ **REAL MONEY.** Per `04-rise-to-wise-migration-plan.md`'s own roadmap, Slice 4 does NOT get the VERIFY-RETIRE fast-path — needs a full Advisor DRAFT → Davin APPROVED cycle before CONFIRM, same bar as 4A-W7's Wise cutover.

---

## Why this session, why now

4A-8 (Slice 4 Hardening Gate, CONFIRMED and closed 2026-07-27) hardened the monolith's own Stripe/dLocal/admin write paths with idempotency guards and built a reusable `IdempotencyInterceptor` in money-service — but deliberately did NOT move any write endpoint, because none exist in money-service yet. This session is the actual PORT: bringing Slice 4's write surface (Stripe checkout, Stripe sub/cancel, dLocal payment creation, admin code distribution, disbursement batch execution) into money-service as NestJS controllers, with the interceptor and Outbox infrastructure 4A-8 already built ready to attach.

Cutover itself (flipping traffic) should be a SEPARATE later session (4A-10, mirroring the 4A-7a/4A-7b BUILD-then-CUTOVER split), not this one — this order is BUILD only, zero live traffic.

---

## Entry criteria

- [ ] 4A-8 CONFIRMED and closed (re-verify: `money-service` test suite green, `OutboxEvent` live in production with `money_svc` grants, `IdempotencyInterceptor`/`IdempotencyStore` exist and are unit-tested).
- [ ] File inventory below re-verified against live codebase (paths + line counts — all 7 confirmed to exist as of 4A-8's close, but CONFIRM at this session's own open, not from this PRE-DRAFT's numbers).
- [ ] Davin has decided this session's actual scope split — the file list below is large enough that the Advisor may want to split it (e.g., Stripe-only vs. dLocal-only vs. admin/disbursement) rather than one 5-endpoint session.

## Integration points

- **In:** Nothing new — same callers (frontend checkout/subscription/payment UI, admin dashboard) once cutover happens (later session).
- **Out:** Stripe SDK, dLocal API (via a new money-service-side HTTP client — doesn't exist yet, `lib/dlocal/dlocal-payment.service.ts`'s API-calling half needs porting too, not just the route).
- **Owns:** New NestJS write controllers under `/v1/*`; zero live traffic until 4A-10.

## File Port Order (draft — Advisor to confirm scope/split)

_(dependency order: services/clients first, controllers last, tests throughout)_

1. **SOURCE:** `lib/stripe/stripe.ts` (~297 lines as of 4A-8's close, includes 4A-8's own idempotency-key additions) → **TARGET:** `money-service/src/stripe/stripe.service.ts` — pure port + adapt (env-var config → NestJS `ConfigService` or direct `process.env`, matching money-service's own convention).
2. **SOURCE:** `app/api/checkout/route.ts` (~186 lines) → **TARGET:** `money-service/src/stripe/stripe-checkout.controller.ts` — attach 4A-8's `IdempotencyInterceptor` here (its first real consumer).
3. **SOURCE:** `app/api/subscription/cancel/route.ts` (154 lines) → **TARGET:** `money-service/src/stripe/stripe-subscription.controller.ts` — 4A-W4's audit found this one idempotent by construction already; port behavior unchanged, no new guard needed.
4. **SOURCE:** `app/api/webhooks/stripe/route.ts` (149 lines) → **TARGET:** `money-service/src/stripe/stripe-webhook.controller.ts` — NEW dashboard URL swap is this order's own cutover concern (4A-10), not this session's; build only.
5. **SOURCE:** `lib/dlocal/dlocal-payment.service.ts`'s API-calling functions (already partially touched by 4A-8's `acquireCreatePaymentLock`) → **TARGET:** `money-service/src/dlocal/dlocal-payment.service.ts` (money-service already has a `dlocal-payment.service.ts`, but only the webhook-side pieces from 4A-4 — this session adds the payment-CREATION half, currently missing).
6. **SOURCE:** `app/api/payments/dlocal/create/route.ts` (285 lines, includes 4A-8's own idempotency guard) → **TARGET:** `money-service/src/dlocal/dlocal-payment.controller.ts` — the exact file the original (wrong) 4A-8 DRAFT thought already existed; this is where it actually gets built.
7. **SOURCE:** `lib/admin/code-distribution.ts` + `app/api/admin/affiliates/[id]/distribute-codes/route.ts` (127 lines, includes 4A-8's own idempotency guard) → **TARGET:** money-service's existing `admin/` module (already has `admin-affiliates.controller.ts` — likely a new method there, not a whole new controller).
8. **SOURCE:** `app/api/disbursement/batches/[batchId]/execute/route.ts` (148 lines) → **TARGET:** money-service's existing `disbursement/` module — **NOTE:** `payment-orchestrator.service.ts`'s `executeBatch` is the SAME code path 4A-W6's `isFundable` branch already modified (Waiting-on item from that session, #57 in the old numbering) — re-read 4A-W6's Deviations before touching this file.

## Rules specific to this variant

- Every ported route gets `@UseInterceptors(IdempotencyInterceptor)` if it's a genuine write with side effects worth deduping — decide per-route, don't blanket-apply.
- SOURCE files (the monolith routes) become change-frozen (CC-F) once this session's shadow/mirror mechanism starts, per F34/CC-A's own not-yet-built-staging constraint (same shape as every prior slice — a real parallel staging run isn't available; expect this session to define its own shadow-run substitute, mirroring F35/F44's precedent).
- This session ends with the new endpoints BUILT, zero flag flipped ON — cutover is 4A-10.

## Slice-level verification (done when)

- [ ] All ported endpoints exist in money-service, unit tested, `nest build` clean.
- [ ] `money-service` full suite green; monolith suites still green (source untouched).
- [ ] Zero production traffic reaches any of these new money-service routes (no flag flipped, dashboards/URLs unchanged).

## Cutover & rollback (4A-10's own order — reference only)

- **Mechanism:** new flags, one per route group (mirroring 4A-7a/4A-7b's `MIGRATE_READ_APIS_MONEY_*` split) — Advisor to name at DRAFT time.
- **Precondition:** Davin's explicit live approval per endpoint group, given real money moves the moment any of these flip ON.

## Known wrinkles / do-not-touch

- `lib/api/index.ts` — standing do-not-touch, unrelated to this slice.
- 4A-W6's `isFundable`/`executeBatch` interaction (File 8 above) — re-read that session's Deviations before editing `payment-orchestrator.service.ts`.
- `POST /api/subscription/cancel` needs no NEW idempotency guard when ported (4A-W4: idempotent by construction) — don't add one just because its siblings have one.

## Deviations

_(filled during execution)_

## Next-session handoff

DRAFT order for 4A-10 (Slice 4 cutover, TEMPLATE-VERIFY-RETIRE) — flags flip ON, one route group at a time, Davin present for each.

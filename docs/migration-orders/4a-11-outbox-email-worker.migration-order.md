# Migration Order — PORT variant

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS;
> monolith rewiring): all Phase 4 BUILD sessions, 2-2…2-4, 3-2. Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: behavior
> preservation IS the deliverable; treat every "improvement" instinct as suspect. The current
> code is ground truth, the OpenAPI contract is the law, old `docs/build-orders/part-XX` is
> background for _why_ only. Worked example: `4B-2-alert-engine.migration-order.md`.

**Session:** 4A-11 · **Variant:** PORT (BUILD — zero traffic cut over this session) · **Status:** CONFIRMED
**Generated:** 2026-07-30 (Advisor-approved DRAFT, converting PRE-DRAFT into executable DRAFT order) ·
**Approved:** 2026-07-30, Davin, live in chat (DRAFT → APPROVED). **Confirmed:** 2026-07-30, Executor —
file inventory (paths + line counts) re-verified against live code, both services' full test suites
re-run green (money-service 59/59 suites/506/506 tests, operation-service 7/7 suites/56/56 tests,
both matching baseline), `OUTBOX_PUBLISHER_ENABLED`/`OUTBOX_PUBLISHER_TARGET_URL` confirmed absent
(value-blind) on money-service production, all 5 entry criteria PASS. Two minor SOURCE-path citation
drifts found in File 3's own prose (real files: `money-service/src/wise/controllers/wise-webhook.controller.ts`

- the actual "unknown eventType" convention lives in the sibling
  `money-service/src/wise/queue/wise-webhook.processor.ts:87-94`, not the controller) — both already
  anticipated by the order's own "verify exact line at build time" hedge, non-blocking. Full CONFIRM
  report delivered to Davin in chat before execution began. ·
  **Estimated time:** likely >4h of real scope — see "Split candidate?" note below; the Advisor should
  decide whether to split before APPROVED.
  **Target service:** operation-service (new consumer) + money-service (small, surgical change to an
  already-built cron)
  **Contract:** No frozen OpenAPI — this is a single internal service-to-service call, not a
  public/multi-consumer surface. Message shape is `OutboxEvent`'s own fields, exactly as
  `OutboxPublisherCron.deliver()` already sends them today (verified, `money-service/src/outbox/outbox-publisher.cron.ts:63-107`):
  `POST <target>` with body `{ id, aggregateType, aggregateId, eventType, payload }`, no auth header
  currently attached (see File 4 below — that's this session's own job to fix).
  **Flags touched:** `OUTBOX_PUBLISHER_ENABLED`, `OUTBOX_PUBLISHER_TARGET_URL` (money-service, both
  already exist as env vars but unset/false, built 4A-8 — this session does NOT flip either; that's
  4A-12's job). New: `SVC_TOKEN` (both services — see File 2/File 4; this resolves **F31**,
  "descoped for now" since Session 3-5, for real).

---

## Why this session exists (read before the file list)

Money-service has written `OutboxEvent` rows since Session 4A-8 (Stripe/dLocal tier changes,
subscription cancellations, payment success/failure, commission credits) because money-service has
**zero email-sending capability** — the intent, recorded in 4A-9's own Deviations, was always for
operation-service (which already has a Resend-backed email module, ported in Session 3-4 / F29) to
consume these events and send the actual customer emails. `OutboxPublisherCron` (built 4A-8) already
polls `PENDING` rows and POSTs them somewhere — but nothing exists on the receiving end, and the
gate (`OUTBOX_PUBLISHER_ENABLED`) has been `false`/unset since it was built. This session builds the
receiving end. **4A-12 is the actual cutover** (flip `OUTBOX_PUBLISHER_ENABLED=true`, set
`OUTBOX_PUBLISHER_TARGET_URL`, watch the first real event flow end-to-end) — this session ships
code only, same BUILD/CUTOVER split as 4A-9/4A-10 and 4A-10a/4A-10b before it.

**This PRE-DRAFT corrects three things CLAUDE.md's own prose gets wrong or overstates** — found by
reading the actual code, not trusting the summary (per this migration's own repeat-offender lesson,
`LESSONS-LEARNED.md` L27/L35):

1. **There are 6 `eventType` values emitted today, not 5.** CLAUDE.md (line ~304, the 4A-9 close-out
   note) lists `TIER_UPGRADED`/`SUBSCRIPTION_CANCELLED`/`PAYMENT_FAILED`/`PAYMENT_SUCCEEDED`/
   `COMMISSION_CREDITED` — it omits **`TIER_DOWNGRADED`**, emitted from
   `money-service/src/crons/subscription.service.ts:307` (the cron-driven expiry-downgrade path, a
   DIFFERENT code path than the Stripe-cancellation one).
2. **Admin code distribution does NOT emit any `OutboxEvent` today**, contrary to what
   `davin-operational-manual/manual-smoke-tests-4A-10a/3.3-admin-code-distribution-smoke-test.md`
   claims should happen ("`OutboxEvent({ eventType: 'CODES_DISTRIBUTED' })` written to DB"). Grepped
   `money-service/src/admin/admin-code-distribution.service.ts` (75 lines) and
   `money-service/src/affiliate/code-generator.service.ts` (130 lines) in full: neither references
   `OutboxService` at all. **This session does not add that instrumentation** — it's a distinct,
   separate scope (a money-service change, not an operation-service consumer change) and "codes
   distributed" isn't really a tier-update event anyway. Flagged for the Advisor/Davin as a
   candidate follow-up, not silently folded in here.
3. **`SUBSCRIPTION_CANCELLED` has two different payload shapes from two different call sites,
   mapping to two different monolith email functions with two different signatures** — see File 1's
   own Invariants note. A consumer cannot treat this eventType as having one fixed template.

---

## Entry criteria

- [ ] File inventory below re-verified against live codebase (paths + line counts) — all counts
      below were verified 2026-07-30; re-check at CONFIRM since this PRE-DRAFT may sit a while.
- [ ] `money-service`'s Outbox infra (4A-8) still present and still gated OFF in production:
      `OUTBOX_PUBLISHER_ENABLED` and `OUTBOX_PUBLISHER_TARGET_URL` both absent/false (value-blind
      check, `LESSONS-LEARNED.md` L17 method) — this session must not accidentally go live.
- [ ] `money-service` full suite green (baseline 59/59 suites, 506/506 tests, confirmed 2026-07-30)
      and `operation-service` full suite green (baseline 7/7 suites, 56/56 tests, confirmed
      2026-07-30) before any new code is added.
- [ ] **Does NOT depend on Group B (dLocal)/`DECISION-LOG.md` F49 being resolved** — Slice 5 is
      independent of dLocal specifically (dLocal has no monolith email precedent at all — see File 1
      — so F49's eventual fix doesn't add any new email requirement here). Confirmed with Davin this
      is authorized to proceed in parallel.
- [ ] **Davin/Advisor decision needed before CONFIRM** (see "Open design questions" below) — at
      least the `SVC_TOKEN` vs. bespoke-secret naming question should be settled before File 2/4 are
      built, since it's a security-mechanism choice this order's own Autonomy clause reserves for
      explicit approval, not an Executor judgment call.

---

## Design decisions (Advisor-Resolved)

1. **Auth mechanism naming:** Resolved to use `SVC_TOKEN` (activates and closes **F31**). Mirrors `money-service/src/crons/cron-secret.guard.ts` using `Authorization: Bearer <secret>` and failing closed (401 on mismatch or missing secret).
2. **`SUBSCRIPTION_CANCELLED` template handling:** Resolved to discriminate by `payload.cancelAt`. If `payload.cancelAt` is present (Stripe webhook path), dispatch to `sendSubscriptionCanceledEmail(email, name, plan, cancelAt)`. If absent (user-initiated cancel path), dispatch to `sendCancellationEmail(email, name)`.
3. **`TIER_DOWNGRADED` copy handling:** Resolved to reuse `sendCancellationEmail` with tier downgrade context.
4. **Session scope:** Resolved to keep as a single unified Session **4A-11**.

---

## Integration points

- **In:** `money-service`'s `OutboxPublisherCron.publishPendingEvents()` → `deliver()` (existing,
  4A-8) — currently sends an unauthenticated `POST` to `OUTBOX_PUBLISHER_TARGET_URL`
  (`money-service/src/outbox/outbox-publisher.cron.ts:63-107`). This session adds the `SVC_TOKEN`
  bearer header there (File 4) and builds the receiving endpoint (File 3).
- **Out:** the new operation-service consumer calls its own already-ported email functions
  (`operation-service/src/email/email.util.ts`, 1004 lines, F29) plus this session's newly-ported
  `subscription-email.util.ts` (File 1) — both are plain async functions, not injected services, per
  F29's established precedent (no `EmailModule`/`EmailService` exists in operation-service today —
  confirmed, `operation-service/src/email/` has no `.module.ts`).
- **Owns:** a new `operation-service/src/outbox/` module (controller + service + guard) — the first
  genuinely new top-level NestJS module in operation-service since `HealthModule`/`AuthModule`.
  operation-service's own `User` table (`operation-service/prisma/schema.prisma:38-58`, confirmed has
  `email`/`name`/`tier` fields) is read (not written) to resolve `aggregateId` → email/name for the
  send call — no schema change needed on either side.

---

## File Port Order

_(dependency order: pure/leaf modules → stateful adapters → orchestration → entrypoints →
tests last, ported with assertions UNCHANGED where a prior test exists)_

### File 1/5

- **SOURCE:** `lib/email/subscription-emails.ts` (865 lines) → **TARGET:**
  `operation-service/src/email/subscription-email.util.ts` (new file)
- **Kind:** port + adapt. SOURCE already imports `sendEmail` from its own sibling `./email` (line 14) rather than instantiating its own Resend client — TARGET does the same, importing `sendEmail`
  from the already-ported `operation-service/src/email/email.util.ts` (matches F29's established
  free-function convention; no injectable `EmailService` exists to extend).
- **Port scope — 5 of 8 SOURCE functions, not all 8:**
  - `getCancellationEmailTemplate`/`sendCancellationEmail` (SOURCE lines 140/425) — port verbatim.
  - `getPaymentFailedEmailTemplate`/`sendPaymentFailedEmail` (217/444) — port verbatim.
  - `getPaymentReceiptEmailTemplate`/`sendPaymentReceiptEmail` (296/466) — port verbatim.
  - `getSubscriptionCanceledEmailTemplate`/`sendSubscriptionCanceledEmail` (500/590) — port verbatim.
  - `getAffiliateCommissionEmailTemplate`/`sendAffiliateCommissionEmail` (761/848) — port verbatim.
  - **`getUpgradeEmailTemplate`/`sendUpgradeEmail`** (SOURCE lines 52/406) — **do NOT port**.
    Confirmed dead code in the monolith itself (zero call sites anywhere in `app/`/`lib/`) —
    porting genuinely-dead code would just move the deadness, not preserve behavior. Record as
    "absorbed (dropped, confirmed dead SOURCE)" per this template's own Kind vocabulary.
  - **`getRenewalReminderEmailTemplate`/`sendRenewalReminderEmail`** (619/725) — **not ported this
    session**; no `OutboxEvent` eventType exists that would trigger it (it's a proactive
    reminder-before-expiry email, not a reaction to a state-change event) — genuinely out of Slice
    5's own scope (event-reaction, not scheduled reminders). Note for a future session if renewal
    reminders get their own cron/event.
  - Also port the `EmailResult` interface (SOURCE line 26) as the shared return type.
- **Invariants:** every ported function's SIGNATURE and TEMPLATE HTML must stay byte-for-byte — this
  is customer-facing copy the ported test suite (below) should assert against literally, not
  paraphrase.
- **Parity proof:** new `operation-service/src/email/subscription-email.util.spec.ts` — mirror
  `lib/email` test conventions if a SOURCE spec exists (check
  `__tests__/lib/email/subscription-emails.test.ts` at build time; if absent, this is the same L28
  gap class — build the safety net, don't assume it exists).
- **Commit:** `migrate(slice5): port subscription email templates to operation-service`

### File 2/5

- **SOURCE:** `money-service/src/crons/cron-secret.guard.ts` (36 lines, full file — pattern to
  mirror, NOT a literal port target) → **TARGET:** `operation-service/src/outbox/svc-token.guard.ts`
  (new file)
- **Kind:** new glue, pattern-matched to an existing proven mechanism (justify: this is the ONLY
  existing shared-secret-guard shape in the codebase; inventing a different mechanism for the same
  problem would be needless divergence).
- **Port steps:** same shape — read `Authorization` header, compare against
  `process.env['SVC_TOKEN']` (pending Open Question 1's resolution on the exact name) via exact
  string match on `` `Bearer ${secret}` ``, throw `UnauthorizedException` on missing-secret-config OR
  mismatch (both cases, matching `CronSecretGuard`'s own fail-closed behavior — a missing secret
  must never silently allow the request through).
- **Invariants:** fail-closed on unset secret (same as `CronSecretGuard` — do not weaken this for
  "convenience" in dev).
- **Parity proof:** new `svc-token.guard.spec.ts`, same test shape as
  `money-service/src/crons/cron-secret.guard.spec.ts` (mirror its cases: valid token → pass, wrong
  token → 401, missing header → 401, unset env var → 401).
- **Commit:** `migrate(slice5): add SVC_TOKEN guard to operation-service`

### File 3/5

- **SOURCE:** none (genuinely new — the "orchestration" layer this event-consumption pattern has
  never had before) → **TARGET:** `operation-service/src/outbox/outbox-consumer.controller.ts` +
  `outbox-consumer.service.ts` + `outbox.module.ts` (new files)
- **Kind:** new glue.
- **Port steps:**
  - Controller: `POST /v1/outbox/events`, guarded by `SvcTokenGuard` (File 2), body validated against
    the shape money-service's `deliver()` already sends (`{ id, aggregateType, aggregateId,
eventType, payload }` — no DTO class needed if this repo's convention is plain interfaces;
    match whatever `AdminAffiliatesController`-style DTOs already do in this codebase for
    consistency, check at build time).
  - Service: dispatch by `eventType` — a `switch`/lookup covering all 6 known values
    (`TIER_UPGRADED`, `SUBSCRIPTION_CANCELLED`, `PAYMENT_FAILED`, `PAYMENT_SUCCEEDED`,
    `COMMISSION_CREDITED`, `TIER_DOWNGRADED`); look up the target `User` via
    `prisma.user.findUnique({ where: { id: aggregateId } })` for `email`/`name`; call the matching
    ported/existing send function; an unrecognized `eventType` logs a warning and returns success
    (never a 500/retry-storm for a forward-compatible new event type money-service might add later)
    — mirrors `WiseWebhookController`'s own "unknown event → 200, no-op" convention
    (`money-service/src/wise/wise-webhook.controller.ts`, verify exact line at build time) rather
    than inventing a new "unknown event" policy.
  - Module: register `OutboxConsumerController`/`OutboxConsumerService` as
    `operation-service/src/outbox/outbox.module.ts`, then add it to `AppModule.imports`
    (`operation-service/src/app.module.ts:1-20` — currently only `ConfigModule`/`PrismaModule`/
    `ThrottlerModule`/`HealthModule`/`AuthModule` are registered; this is the first module addition
    since the service was scaffolded).
- **Invariants:** never let an email-send failure (Resend API error, missing user, etc.) leave the
  HTTP response looking like a retry-worthy failure if the event itself was structurally valid and
  processed — `OutboxPublisherCron`'s own retry logic (§2 research: 3 attempts within one delivery
  tick, 5 total across ticks before dead-lettering to `FAILED`) means a transient email-provider
  error SHOULD 5xx (so the cron retries), but "user not found" or "unrecognized eventType" should
  NOT (that will never succeed on retry — dead air, not a real failure). Get this distinction right;
  it's the difference between the outbox's dead-letter queue being meaningful or spammed with
  unrecoverable rows forever.
- **Parity proof:** new `outbox-consumer.service.spec.ts` (one case per eventType, plus the
  unknown-eventType-is-a-no-op case, plus the user-not-found case) and a thin
  `outbox-consumer.controller.spec.ts` (guard applied, delegates to service).
- **Commit:** `migrate(slice5): build operation-service outbox-event consumer`

### File 4/5

- **SOURCE/TARGET (same file, modified in place):**
  `money-service/src/outbox/outbox-publisher.cron.ts` (183 lines) — `deliver()` method,
  lines 63-107.
- **Kind:** port + adapt (small, surgical — this is NOT a change-frozen file, no cutover has
  happened on this slice yet, so this is a normal in-scope edit, not a CC-F violation).
- **Port steps:** add `Authorization: Bearer ${process.env['SVC_TOKEN']}` to the existing `fetch()`
  call's `headers` object (currently only `Content-Type: application/json`, confirmed — see
  Integration Points). Read the secret once at call time (matching how `DLOCAL_LOGIN` etc. are read
  in `dlocal-payment.service.ts`, not module-load time, so a Railway env var change doesn't need a
  full redeploy to take effect... verify this repo's actual convention at build time, don't assume).
- **Invariants:** every other field/behavior of `deliver()` (retry/backoff, error handling, status
  transitions) stays unchanged — this file's Prisma-writing logic is money-moving-adjacent
  (dead-letters real customer-facing emails) and already has its own spec (`outbox-publisher.cron.spec.ts`,
  176 lines) that must stay green.
- **Parity proof:** extend the existing `outbox-publisher.cron.spec.ts` with one new assertion (the
  `fetch` mock receives the expected `Authorization` header) — do not rewrite the file's existing
  cases.
- **Commit:** `migrate(slice5): add SVC_TOKEN auth header to OutboxPublisherCron`

### File 5/5

- **SOURCE:** none → **TARGET:** `.env.example` updates on both services (doc-hygiene, found as a
  real gap this session's research turned up: `OUTBOX_PUBLISHER_ENABLED`/`OUTBOX_PUBLISHER_TARGET_URL`
  are read live in money-service code but appear in NEITHER `.env.example` file; `SVC_TOKEN` is only
  present, commented-out, in money-service's).
- **Kind:** new glue (documentation only, zero behavior change).
- **Port steps:** add `OUTBOX_PUBLISHER_ENABLED=false` (commented, default-off, matching this
  session's own "BUILD, not cutover" posture), `OUTBOX_PUBLISHER_TARGET_URL=` (commented, to be set
  at 4A-12), and un-comment/document `SVC_TOKEN=` to `money-service/.env.example`; add the mirrored
  `SVC_TOKEN=` entry to `operation-service/.env.example` (currently has none at all — verify exact
  file exists and check its current content at build time, per `LESSONS-LEARNED.md` L21's own
  "don't assume the doc matches the target env" principle — this step only touches the example
  file, not any real Railway environment).
- **Commit:** `migrate(slice5): document SVC_TOKEN/OUTBOX_PUBLISHER_* env vars`

---

## Rules specific to this variant

- Changing a ported test's assertion requires a written justification in Deviations.
- Wrong Prisma client = boundary violation (market vs non-market; role grants will bite) — not
  applicable here (no schema change), noted for completeness per the template.
- SOURCE files become **change-frozen (CC-F)** the moment shadow-run starts — not applicable yet;
  this session builds code that carries ZERO production traffic (`OUTBOX_PUBLISHER_ENABLED` stays
  `false`/unset in every environment throughout this session).
- This session ends with the new code built and unit-tested, but the delivery mechanism NOT yet
  exercised end-to-end against a live event — cutover (flipping `OUTBOX_PUBLISHER_ENABLED=true` +
  setting `OUTBOX_PUBLISHER_TARGET_URL` + watching the first real event process) is 4A-12.

---

## Slice-level verification (done when)

- [ ] `operation-service` new suites green (subscription-email util, guard, consumer
      controller/service) — target coverage: one case per eventType + unknown-eventType + user-not-found.
- [ ] `operation-service` full suite still green (baseline 7/7 suites, 56/56 tests + new suites).
- [ ] `money-service`'s `outbox-publisher.cron.spec.ts` still green with the new auth-header
      assertion added (baseline 59/59 suites, 506/506 tests + the extended assertion, net zero new
      suites on the money-service side since File 4 only modifies an existing file).
- [ ] `tsc --noEmit` clean both services; `nest build` clean both services.
- [ ] `OUTBOX_PUBLISHER_ENABLED` and `OUTBOX_PUBLISHER_TARGET_URL` confirmed STILL unset/false in
      Railway production after this session (value-blind) — zero traffic cut over, by design.
- [ ] `SVC_TOKEN` (or whatever Open Question 1 resolves to) set on BOTH services' Railway production
      as a real, matching value (needed for 4A-12 to have anything to test against) — but the guard
      itself stays unexercised by real traffic until 4A-12 flips the enable flag.

---

## Cutover & rollback (next session's order — reference only)

- **Mechanism:** set `OUTBOX_PUBLISHER_TARGET_URL` to operation-service's real `/v1/outbox/events`
  URL, flip `OUTBOX_PUBLISHER_ENABLED=true` on money-service, redeploy, watch the next 5s poll tick
  process at least one real `PENDING` row (likely a `TIER_DOWNGRADED` from the hourly expiry cron, or
  trigger a real `TIER_UPGRADED` via an actual test purchase) — confirm `OutboxEvent.status` reaches
  `PROCESSED` and the customer's inbox (or Resend's dashboard, per this repo's own `simulated: true`
  dev-mode convention in `email.util.ts`) actually receives it.
- **Precondition:** this session (4A-11) CONFIRMED and closed; `SVC_TOKEN` verified present and
  matching on both services (value-blind).
- **Rollback:** `OUTBOX_PUBLISHER_ENABLED=false` + redeploy money-service — `PENDING` rows simply
  accumulate again (harmless, same as today), zero customer-facing regression since nothing was
  reading them before either.

---

## Retire (after cutover proves stable)

- [ ] Nothing to retire this session — this is new functionality, not a port of a live monolith
      code path that then gets deleted. (The monolith's OWN synchronous email-sending in
      `lib/stripe/webhook-handlers.ts` stays exactly as-is; it is not this migration's job to make
      the monolith stop sending emails synchronously while Stripe write-APIs still run on the
      monolith side for any traffic not yet forwarded to money-service — that question belongs to
      whichever future session fully retires the monolith's Stripe webhook route.)

---

## Deviations

_(filled during execution — what/why/impact)_

---

## Known wrinkles / do-not-touch

- **Admin code distribution's missing `OutboxEvent` emission is explicitly OUT of this session's
  scope** — see "Why this session exists" point 2. Do not add it as a drive-by; it needs its own
  money-service-side instrumentation step and isn't a tier-update event.
- **dLocal has no monolith email precedent** — the `TIER_UPGRADED`-via-`DLOCAL` outbox event
  (`dlocal-webhook.controller.ts:286`) is genuinely new email-sending territory. Don't assume a
  "port" exists for this specific case; File 1's `sendSubscriptionConfirmationEmail` (already live
  in operation-service since F29) is reused for BOTH the Stripe and dLocal `TIER_UPGRADED` cases —
  the payload's `provider` field (`'STRIPE'` vs `'DLOCAL'`) is available if the copy ever needs to
  differ, but doesn't today.
- **The orphaned `emails/*.tsx` React-Email components** (`emails/index.ts` + 4 template files,
  ~908 lines total) are dead code with zero import sites anywhere — do not port these; they are not
  the active templates (the active ones are the HTML-string-returning functions in
  `lib/email/subscription-emails.ts`/`email.ts`).
- **`lib/api/index.ts`** — standing do-not-touch, unrelated to this session, noted per
  `EXECUTOR-PROTOCOL.md` §5 boilerplate.

---

## Next-session handoff

**4A-12 (Slice 5 CUTOVER, VERIFY-RETIRE variant)** — flip `OUTBOX_PUBLISHER_ENABLED=true`, set
`OUTBOX_PUBLISHER_TARGET_URL`, verify a real event flows end-to-end (money-service `OutboxEvent`
row → operation-service consumer → actual email send), per the Cutover & rollback section above.
Entry criteria: this order (4A-11) CONFIRMED and closed, `SVC_TOKEN` present and matching on both
services (value-blind), Davin present for the live flip per this migration's own standing
money/auth escalation rule.

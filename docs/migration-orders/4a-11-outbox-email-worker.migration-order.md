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
drifts found in File 3's own prose (real file is `money-service/src/wise/controllers/wise-webhook.controller.ts`,
and the actual "unknown eventType" convention lives in the sibling
`money-service/src/wise/queue/wise-webhook.processor.ts:87-94`, not the controller) — both already
anticipated by the order's own "verify exact line at build time" hedge, non-blocking. Full CONFIRM
report delivered to Davin in chat before execution began.
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

- [x] File inventory below re-verified against live codebase (paths + line counts) — re-checked at
      CONFIRM 2026-07-30: all 7 cited SOURCE line counts exact matches. Two path citations in File
      3's prose were loose (see header note) — non-blocking, already hedged by the order itself.
- [x] `money-service`'s Outbox infra (4A-8) still present and still gated OFF in production:
      `OUTBOX_PUBLISHER_ENABLED` and `OUTBOX_PUBLISHER_TARGET_URL` both confirmed absent (value-blind
      check, `LESSONS-LEARNED.md` L17 method, re-run at CONFIRM 2026-07-30).
- [x] `money-service` full suite green (59/59 suites, 506/506 tests, re-run 2026-07-30 — exact
      baseline match) and `operation-service` full suite green (7/7 suites, 56/56 tests, re-run
      2026-07-30 — exact baseline match), both before any new code was added.
- [x] **Does NOT depend on Group B (dLocal)/`DECISION-LOG.md` F49 being resolved** — re-confirmed at
      CONFIRM; F49 stays OPEN, unrelated to this session's code paths.
- [x] **Davin/Advisor decision needed before CONFIRM** — resolved in "Design decisions
      (Advisor-Resolved)" below, ratified by Davin's live approval 2026-07-30.

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

- [x] `operation-service` new suites green (subscription-email util, guard, consumer
      controller/service) — 12 + 4 + 12 + 2 = 30 new tests across 4 new suites, one case per
      eventType + unknown-eventType + user-not-found + email-send-failure-throws, plus the
      COMMISSION_CREDITED-skips-without-lookup case (see Deviations).
- [x] `operation-service` full suite still green — 11/11 suites, 86/86 tests (was 7/7, 56/56).
- [x] `money-service`'s `outbox-publisher.cron.spec.ts` still green with the new auth-header
      assertion added — 9/9 tests in that file (was 8), full suite 59/59 suites, 507/507 tests (was
      506/506) — net +1 test, zero new suites, matching the order's own prediction exactly.
- [x] `tsc --noEmit` clean both services; `nest build` clean both services.
- [x] `OUTBOX_PUBLISHER_ENABLED` and `OUTBOX_PUBLISHER_TARGET_URL` confirmed STILL unset/false in
      Railway production after this session (value-blind, re-checked at close) — zero traffic cut
      over, by design.
- [ ] `SVC_TOKEN` set on BOTH services' Railway production as a real, matching value — **NOT done
      this session** (value-blind confirmed absent on both at close). Setting a real secret value is
      a live action reserved for Davin (`EXECUTOR-PROTOCOL.md` §7); needed before 4A-12 has anything
      to test against.

---

## Cutover & rollback (next session's order — reference only)

- **Mechanism:** set `OUTBOX_PUBLISHER_TARGET_URL` to operation-service's real `/outbox/events` URL
  (corrected from this order's own original `/v1/outbox/events` — operation-service has no global
  `/v1` prefix, see Deviations), flip `OUTBOX_PUBLISHER_ENABLED=true` on money-service, redeploy,
  watch the next 5s poll tick
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

1. **Route path corrected: `POST /outbox/events`, not `/v1/outbox/events`.** File 3's own text
   assumed money-service's global `/v1` prefix convention applies to operation-service too. Reading
   `operation-service/src/main.ts` (no `setGlobalPrefix` call) and every existing controller
   (`@Controller('auth')`, `@Controller()` for health — routes at `/auth/*`, `/health`, no `/v1`
   anywhere) confirmed operation-service has no such prefix. Built the controller at
   `@Controller('outbox')` + `@Post('events')`, the real correct route for this service. Zero code
   impact beyond the controller decorator itself — `OUTBOX_PUBLISHER_TARGET_URL` is a Railway env
   var either way, corrected in the Cutover & rollback section above for 4A-12's benefit.
2. **`COMMISSION_CREDITED` is deliberately skipped, not dispatched — new finding, `DECISION-LOG.md`
   F50 (OPEN).** File 3's own text treated "resolve the recipient via `aggregateId` -> `User.id`" as
   a universal step for all 6 eventTypes. Reading `stripe-webhook.service.ts`'s actual
   `emitOutboxEvent(userId, 'COMMISSION_CREDITED', {...})` call site showed `userId` there is the
   PAYING SUBSCRIBER (from the checkout session's own metadata), not the affiliate who earned the
   commission — sending to `aggregateId` would email the wrong person. The payload
   (`{ commissionId, commissionAmount, provider }`) has no affiliate identity to resolve from
   either, and operation-service's Prisma schema subset has no `Commission`/`AffiliateProfile`
   model (by design, L1) to join through even if it did. `OutboxConsumerService.processEvent`
   special-cases this eventType to log + skip (`{ status: 'skipped', reason:
'commission-recipient-unresolvable' }`) before ever touching `prisma.user.findUnique`, rather
   than guessing or silently sending to the subscriber. Zero production impact today (gated off).
   Needs its own follow-up before 4A-12 can call this eventType done — see F50.
3. **`TIER_UPGRADED`'s `billingPeriod` defaults to `'monthly'` when absent from the payload.**
   Stripe's `TIER_UPGRADED` payload includes `billingPeriod` (`stripe-webhook.service.ts:132`), but
   dLocal's (`dlocal-webhook.controller.ts:287`) does not — dLocal has no recurring monthly/yearly
   concept the way Stripe does. `sendSubscriptionConfirmationEmail` requires a `'monthly' | 'yearly'`
   argument regardless, so the dispatcher defaults to `'monthly'` rather than reject or throw.
   Cosmetic only (affects displayed pricing text in the confirmation email), and this consumer
   carries zero production traffic until 4A-12. Not registered as its own flag — low enough impact
   to fold into this order's Deviations rather than DECISION-LOG.md, but worth revisiting if dLocal's
   short-cycle plans (e.g. `THREE_DAY`) ever need their own copy.
4. **`plan` is hardcoded `'PRO'` for `SUBSCRIPTION_CANCELLED`'s 4-arg (Stripe-webhook) branch and
   omitted entirely from the 2-arg (user-initiated) branch** — verified against the monolith's own
   original caller (`lib/stripe/webhook-handlers.ts:269`, `sendSubscriptionCanceledEmail(email, name,
'PRO', cancelAt)` — a literal, not derived from any payload field), not guessed. This event only
   ever fires on a PRO subscription being canceled, so the hardcode is behavior-preserving, not a new
   assumption.
5. **`svc-token.guard.spec.ts`'s guard-metadata test relies on `Reflect.getMetadata` (`reflect-
metadata`)** — not previously exercised this way anywhere in operation-service's existing spec
   suite (per an `Explore`-style check before writing it). Confirmed working (the suite passes) since
   `@nestjs/core`'s own bootstrap chain already side-effect-imports `reflect-metadata`; flagged here
   only because it was a genuine "does this even work in this environment" question at write time,
   not because it caused a failure.
6. **Two incidents during this session's CONFIRM step, both disclosed immediately, neither
   repeated:** (a) a formatting mistake — prettier's pre-commit pass turned a plain sentence in this
   order's own header into an unintended nested markdown list after the CONFIRM edit; caught and
   fixed in a follow-up commit before any file content was touched. (b) a real secret exposure — a
   `head -c 300` sanity-check on raw Railway variable JSON output (meant only to verify `SVC_TOKEN`'s
   absence) printed operation-service's real `DATABASE_URL` (full connection string, including
   password) and `NEXTAUTH_SECRET` into the session transcript. Disclosed to Davin the moment it was
   noticed, not reproduced again, no further raw-content reads attempted for the rest of the session
   (switched to grep-boolean-only checks throughout, per `LESSONS-LEARNED.md` L17). Both values need
   rotation, added to the same outstanding list as CLAUDE.md's existing Waiting-on #66. New
   `LESSONS-LEARNED.md` entry recorded (see below) since this is L17's SECOND recurrence within the
   same class of "value-blind check accidentally isn't."

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

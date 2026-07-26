# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force
> until Davin lifts it further):** chain-length-one originally read as "webhooks cut
> over FIRST (both providers), before 4A-7 or any Slice 4 work." **Davin confirmed
> live, 2026-07-24, that this narrows to dLocal-cutover-first**: with dLocal now
> CUT-OVER (Session 4A-5, see Current below), 4A-7/Slice 4 work is unblocked — it does
> NOT need to wait for RiseWorks. RiseWorks's own cutover (`4A-5-RW`) trails
> independently, gated on RiseWorks replying with webhook/API settings (see Waiting on).
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of this question — not itself a lifting
> of the standing instruction.** With dLocal cut over too, Slice 3/4 BUILD work (4A-7
> onward) may now proceed; RiseWorks-specific work stays gated on `4A-5-RW`'s own entry
> criteria.

- **Current:** Session 4A-W6 CLOSED, executed as PORT — Part 19.5 (Wise) payout engine (`isFundable`
  branch), zero traffic cut over — 2026-07-26.
  **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again** (order file
  modified-but-uncommitted, `PRE-DRAFT → APPROVED`, no Advisor-DRAFT/Davin-approval commit trail,
  paired with a full content rewrite condensing the order's own prose) — asked Davin directly per
  the established pattern rather than trusting or silently correcting it; confirmed live as his own
  authentic edit, including the intentional drop of the original PRE-DRAFT's Admin UI file (deferred
  to a future UI-BUILD session). **Found and corrected FIVE ground-truth drifts before Step 1**
  (`LESSONS-LEARNED.md` L27, now a repeat-offender pattern — recorded in full in the order's own
  Deviations): `WISE_FUNDING_SLA_HOURS` default is 72h, not the 24h the order's Hard Invariant #6
  and Done-when cited (design §6.2/§7.2 and the frozen OpenAPI both say 72); File 1's own prose
  invented a `FundableProvider` shape (`isFundable: boolean` + `getPayInDetails()`/`markFunded()`)
  that doesn't match design §3.3's real interface (`fundingMode`/`prepareBatch`/`completeBatch`/
  `fundBatchFromBalance`/`cancelBatch`, structural type guard); `wise-quote.service.ts`'s quote
  direction followed F38's LATER, binding `DECISION-LOG.md` resolution (quote by `targetAmount`,
  platform absorbs the fee) rather than design §6.2's own now-superseded `sourceAmount` example — a
  new variant where ground truth itself is split across two documents that disagree by date; File
  6's admin controller was built against the frozen OpenAPI's real 7-endpoint surface, not the
  order's own undercounted 3; two files' TARGET paths (`wise/providers/` vs. `disbursement/
providers/`, `crons/` vs. `wise/services/`) diverge from design §8's suggested module layout —
  followed the order's own stated paths.
  **Resolved F43 live** (Davin, this session, due this session per its own registration at 4A-W4):
  Option (a) — Resend REST called directly from money-service (native `fetch`, no new npm
  dependency), not operation-service's own `resend` package.
  **Built all 8 files** (dependency order, committed per file):
  `wise/providers/provider-capabilities.ts` (File 1, `FundableProvider`/`isFundable()` per design
  §3.3 verbatim), `wise/services/{wise-quote,wise-transfer,wise-batch-group}.service.ts` (File 2 —
  the transfer service satisfies Hard Invariant #5's "persist `customerTransactionId` before the
  Wise call" against `WiseTransfer.wiseTransferId`'s real required-`@unique` schema constraint via
  a self-referential placeholder, overwritten once Wise responds), `wise/providers/wise-payment.provider.ts`
  (File 3, `WisePaymentProvider extends PaymentProvider implements FundableProvider`,
  `base-provider.ts` untouched), the `isFundable` branch in `payment-orchestrator.service.ts`
  (File 4, Hard Invariant #1 — a fundable provider never sets `Commission.status = 'PAID'` or
  touches the balance, that stays 4A-W5's reducer's job), `commission-aggregator.service.ts`'s new
  additive `getAllPayableAffiliatesForProvider()` + the `payment-orchestrator.service.ts`
  §3.5(a) `affiliateId` empty-string fix (File 5), `wise/controllers/wise-batches.controller.ts`
  (File 6, full 7-endpoint admin surface), `crons/wise-reconciliation.service.ts` (File 7, hourly,
  same reducer as 4A-W5 fed synthetic dedupe-safe events, REQUIRED funding-SLA alarm via Resend),
  and `wise-payout-engine.spec.ts` + `wise-payout.e2e.spec.ts` (File 8, composed integration
  through real DI-wired services plus an RSA-signed sandbox test payload for the mark-funded →
  reducer → `Commission=PAID` path, per Davin's live CONFIRM-time verification-method call — same
  Option-2 class as 4A-W5's own downgrade, live write-scope access still unresolved, #47).
  **A NEW class of gap found while building, not anticipated by the order or the design doc:** no
  test file existed anywhere in the tree for `payment-orchestrator.service.ts` OR
  `commission-aggregator.service.ts` before this session, despite Hard Invariant #4 and this
  order's own Rules assuming the former already existed as "the parity oracle for non-Wise
  branches." Built both this session (new `LESSONS-LEARNED.md` **L28**). **Writing the
  orchestrator's first-ever real `MockPaymentProvider` test surfaced a genuine pre-existing bug,
  deliberately NOT fixed** (out of scope for a Wise session, and possibly accidentally
  load-bearing): `MockPaymentProvider.sendPayment()` mints its own `transactionId` instead of
  echoing the caller's, so `executeBatch`'s existing result-matching never succeeds for `MOCK` —
  "successful" Mock payments are silently skipped, yet the batch still reports `success: true` and
  gets marked `COMPLETED`. Since `DISBURSEMENT_PROVIDER` stays `MOCK` in production throughout
  Part 19.5 specifically as a no-real-money safety rail, this may be accidentally desirable —
  flagged for Davin/Advisor rather than changed as a drive-by.
  **A second, more severe compound finding surfaced while PRE-DRAFTing 4A-W7 (see Waiting-on #54):**
  design §8.1's own file-inventory table names `disbursement.types.ts`/`disbursement.constants.ts`/
  `providers/provider-factory.ts` as needing a `'WISE'` case — none is in this order's own 8-file
  list, and none was touched (real DI-construction surgery, not an additive fix: `provider-factory.ts`'s
  plain function can't build a `WisePaymentProvider` with 7 injected collaborators). Combined with
  the `MockPaymentProvider` bug above, **4A-W7's own literal Checklist step 4 ("flip
  `DISBURSEMENT_PROVIDER=MOCK → WISE`, redeploy") would currently be a silent no-op** —
  `getDefaultProvider()` doesn't recognize `'WISE'` and would keep returning `'MOCK'`, and a smoke
  payout would silently process through Mock instead of reaching Wise, with the batch still
  reporting green. Recorded as 4A-W7's own new Entry criterion 0 — **that order must not proceed
  past it.**
  **Full verification:** `money-service` test suite 44/44 suites, 366/366 tests (was 33/33, 326/326
  at 4A-W5's close — +11 suites, +40 tests). `npm run build`/`tsc --noEmit` clean both sides.
  `base-provider.ts` verified untouched (0 line changes) via `git diff --stat` against the session's
  start commit. `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session builds the payout
  engine only, no provider flip, no money moved (and per the finding above, the flip mechanism
  itself isn't wired yet regardless).
  **Artifacts updated:** `4a-w6-wise-payout-engine.migration-order.md` (Status → CONFIRMED,
  Deviations filled in full, Done-when checked), `DECISION-LOG.md` (F43 resolution + full findings
  entry), `LESSONS-LEARNED.md` (L27 recurrence note, new **L28**), `migration-stack-analysis.md`
  (new money-service entries), this file. `4a-w7-wise-cutover.migration-order.md` PRE-DRAFTed
  (VERIFY-RETIRE, CUTOVER block — carries the new Entry criterion 0 blocker forward).
- _(superseded-by-above, retained for context)_ Session 4A-W5 CLOSED, executed as PORT — Part 19.5 (Wise) webhook receiver +
  state reducer, money-service's first BullMQ queue, zero traffic cut over — 2026-07-26.
  **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again** (order file
  modified-but-uncommitted, `PRE-DRAFT → APPROVED`, no Advisor-DRAFT/Davin-approval commit
  trail) — 10th+ recurrence — but this time paired with a full content rewrite (5→8 files,
  "Ordered steps" replaced by "Ordered File Breakdown") and a real dropped safety gate: the
  committed PRE-DRAFT's sandbox-funding entry criterion ("if unavailable, stop and re-plan,"
  lifted verbatim from `04-rise-to-wise-migration-plan.md`'s own W5 entry criteria) was absent
  from the rewrite. Re-raised it at CONFIRM because Wise's Simulation API requires a **funded**
  transfer before state simulation, and Waiting-on #47 (still OPEN) already showed the sandbox
  `WISE_API_TOKEN` is read-only — likely blocking transfer creation/funding too. Stopped and
  asked Davin directly: confirmed the rewrite was his own edit, confirmed funding availability
  is genuinely unknown, and chose **Option 2** — verification downgraded from "real payloads
  captured from Wise's Simulation API" to "hand-constructed RSA-signed sandbox test payloads"
  (same keypair-substitution technique `wise-signature.verifier.spec.ts` already uses, 4A-W3a).
  F40 resolved `PROFILE`-level in the same rewrite (Davin, ahead of CONFIRM). All other entry
  criteria (4A-W4 shutdown-hooks/job-ID-policy re-verify, `wise-signature.verifier.ts`
  existence/tests, all 4 cited line counts, zero `registerQueue()`/`@Processor()` calls)
  verified live and passed — a first for this series, zero drift found on any of them. Order
  marked CONFIRMED, executed.
  **Four real order-text-vs-ground-truth mismatches found and corrected while building** (full
  detail in the order's own Deviations, also recorded as `LESSONS-LEARNED.md` **L27**): (1) Hard
  Invariant #3/Rules/Known-wrinkles all said `@SkipThrottle()` on the webhook route; design
  §7.5 was corrected 2026-07-25 (rev 2) — one session earlier — to the opposite (explicit
  generous `@Throttle()`, matching L26); built with the corrected throttle. (2) File 1/8's own
  state-mapping prose diverged from design §5.2's frozen table: `bounced_back` isn't a distinct
  terminal state (stays `PROCESSING` + `hasActiveIssues`, Commission left `PAID`, admin alert,
  not reverted — reverting would flap the balance for a transfer Wise says may still deliver);
  `cancelled` must revert if it was already `PAID` (order said pure no-op); `charged_back` was
  missing entirely despite being a real §5.2 row that can follow any state;
  `incoming_payment_initiated` was also missing. Built the mapper against the real, full table
  (10 states + unrecognised-fallback). (3) File 2/8's text (and File 7/8's own test-case
  description) said the reversal path sets `Commission.status = 'FAILED'` — no such enum member
  exists (`PENDING`/`APPROVED`/`PAID`/`CANCELLED` only, schema-verified); design §5.2's own
  table says `revert PAID → APPROVED`; built against that. (4) File 5/8's text said
  `handleBalanceUpdate` updates `WiseBatchGroup.fundingDetected` — no such field exists, the
  real field is `fundingSource` (enum `WiseFundingSource`); built against the real field, and
  scoped the handler to setting it only, never transitioning `status` to `FUNDED` (reserved for
  4A-W6's batch/funding-gate services, not built yet — flipping it here would be scope creep
  into that session's own job). Separately, File 8/8's own text and Done-when both said the
  `X-Test-Notification` ping should process "without DB write" — design §5.5 explicitly says
  the opposite ("persist, mark processed, 200, do nothing else"); built and tested against
  ground truth (persists).
  **Built all 8 files** (dependency order, committed per file): `wise-state.mapper.ts` (File 1,
  pure §5.2 table), `wise-transfer-state.reducer.ts` (File 2, staleness guard + atomic
  `balanceAppliedAt`/`balanceRevertedAt` locks, the ONLY writer of `Commission.status = 'PAID'`),
  `wise-event-handlers.ts` (File 5, built ahead of File 3 since the processor depends on it —
  `handlePayoutFailure`/`handleBalanceUpdate`, neither ever touches Commission or balance),
  `wise-webhook.processor.ts` (File 3, money-service's first `@Processor`/`WorkerHost`, routes
  by `eventType`, `onModuleDestroy` → `worker.close()`, `attemptCount`/`processed=false` on
  `WiseWebhookEvent` itself is the dead-letter surface — no new infrastructure), FILE 4
  (`wise-webhook.controller.ts`, `POST /v1/webhooks/wise`, store-then-process per §5.5), File 6
  (`wise.module.ts` — `BullModule.registerQueue`; `app.module.ts` needed no change, `WiseModule`
  was already imported since 4A-W3a, contrary to the order's own assumption), File 7
  (`wise-state.reducer.spec.ts`, mapper + reducer unit suite), File 8
  (`wise-webhook.replay.spec.ts`, RSA-signed replay suite) — plus two test files beyond the
  order's own 8-file count (`wise-webhook.processor.spec.ts`, `wise-event-handlers.spec.ts`) to
  actually fulfill Files 3/8 and 5/8's own per-file "Verification" promises, which the order's
  file count never allocated a home for.
  **Full verification:** `money-service` test suite 33/33 suites, 326/326 tests (was 29/29,
  288/288 at 4A-W4's close — +4 suites, +38 tests). `npm run build` clean. Monolith
  `tsc --noEmit` clean (unaffected — no monolith code changed this session). Schema fields
  verified directly against `money-service/prisma/schema.prisma` before writing the
  reducer/handlers, not assumed from the order's prose. `DISBURSEMENT_PROVIDER` stays `MOCK` in
  production — this session builds the webhook receiver only, no provider flip, no money moved,
  no production Wise webhook subscription (Safety Gate, 4A-W7 cuts over).
  **Not fully closed:** the replay suite proves the signature/dedupe/reduction pipeline against
  hand-constructed fixtures, not Wise's real Sandbox Simulation API — closing that gap needs a
  write-scoped sandbox `WISE_API_TOKEN` (same ask as Waiting-on #47).
  **Artifacts updated:** `4a-w5-wise-webhook-reducer.migration-order.md` (Status → CONFIRMED,
  Deviations filled in full, Done-when checked), `DECISION-LOG.md` (F40 resolution + full
  findings entry), `LESSONS-LEARNED.md` (new **L27** — order text can drift from its own cited
  ground truth, silently and more than once, within a single order), `migration-stack-analysis.md`
  (new `money-service/src/wise/*` webhook entries), this file.
  `4a-w6-wise-payout-engine.migration-order.md` PRE-DRAFTed (PORT).
- _(superseded-by-above, retained for context)_ Session 4A-W4 CLOSED, executed as CONTRACT + small INFRA — Part 19.5 (Wise)
  money-service CC-C/CC-D hardening gate, zero traffic cut over, no Wise-specific code —
  2026-07-26.
  **CONFIRM found the order file modified-but-uncommitted again** (header `PRE-DRAFT →
APPROVED`, no Advisor-DRAFT/Davin-approval commit trail) — the same `LESSONS-LEARNED.md` L11
  pattern, 9th recurrence (see L11's own recurrence log for the 8th, at 4A-W3b). Unlike the
  W1/W2 recurrences, none of the order's own cited line-count evidence had drifted this time
  (`main.ts` 51, `app.module.ts` 81, `dlocal-webhook.controller.ts` 415 — all exact live
  matches), and unlike 4A-W3b no open design question had been silently resolved in the
  rewrite — the one new substantive addition (a `Contract:` line citing
  `07-migration-process-change-proposal.md` P1/P2/P3) checked out against that doc's actual
  content (P1/P2/P3 are literally "insert this session" / "fix shutdown" / "fix throttling").
  Stopped and asked Davin directly per the established pattern; confirmed live as his own
  authentic edit. All other entry criteria (4A-W3a/b both CONFIRMED, both defects still live,
  Davin present and explicitly approving Step 4 before it started) verified live and passed.
  Order marked CONFIRMED, executed.
  **Step 1 (idempotency audit, no fixes):** audited all 6 cited money write endpoints. Verdicts:
  Stripe checkout (`app/api/checkout/route.ts`) — no key; subscription cancel — n/a, idempotent
  by construction; `GET /api/invoices` — n/a, read-only (no write path exists under
  `app/api/invoices/*`, correcting the order's own cautious `GET/POST` framing); dLocal payment
  creation (`app/api/payments/dlocal/create/route.ts`) — no key; admin code distribution
  (`app/api/admin/affiliates/[id]/distribute-codes/route.ts`) — no key; payment batch execution
  (`app/api/disbursement/batches/[batchId]/execute/route.ts`) — has an indirect guard
  (`PaymentBatch.status` state machine + `DisbursementTransaction.commissionId`/`.transactionId`
  both `@unique`), not a request-level key but a real DB-enforced one. No fixes applied — audit
  only, per this session's own scope rule; Stripe/dLocal write-path fixes stay 4A-8's.
  **Step 2 (webhook dedupe audit) found a real gap in Plan §13's own cited template:** dLocal
  and Stripe webhooks both dedupe via downstream business-state checks (a status field that
  transitions once), not a webhook-delivery-ID table — no `DlocalWebhookEvent` model exists at
  all, and Stripe's `event.id` is never persisted or checked. Plan §13 names
  `RiseWorksWebhookEvent` as the dedupe template, but that model's own `hash`/`signature`
  fields carry **no unique constraint** (only non-unique indexes) — RiseWorks's actual dedup is
  the same business-state-check shape, not a lookup by hash. The only model in either schema
  with a real DB-enforced dedupe key is `WiseWebhookEvent.deliveryId String @unique` (built
  4A-W2, not yet wired to a live receiver). Flagged for 4A-W5 to inherit `WiseWebhookEvent`'s
  pattern rather than `RiseWorksWebhookEvent`'s; flagged for 4A-8's outbox/idempotency work to
  see the broader gap (see Waiting-on #52).
  **Step 3 (graceful shutdown fix, Defect 1):** added `app.enableShutdownHooks()` to
  `money-service/src/main.ts`; added a previously-missing observable log line to
  `PrismaService.onModuleDestroy()`. Verified with a new test
  (`money-service/src/prisma/prisma.shutdown.spec.ts`) that boots a real `NestApplication`,
  calls the real `enableShutdownHooks()`, and delivers a synthetic in-process `SIGTERM` — the
  first unstubbed attempt genuinely killed the Jest worker mid-test, because Nest's own
  `listenToShutdownSignals()` re-sends the OS signal via `process.kill(process.pid, signal)`
  after cleanup finishes (confirmed by reading `@nestjs/core`'s own source); stubbed
  `process.kill`/`process.exit` to observe the hook firing without dying. Documented the BullMQ
  worker drain policy (`worker.close()` on shutdown) 4A-W5's first queue consumer must follow.
  **Step 4 (dLocal webhook throttling fix, Defect 2 — Davin present, live approval given per
  `EXECUTOR-PROTOCOL.md` §7 before touching this already-cut-over live money route):** added
  `@Throttle({ default: { ttl: 60_000, limit: 300 } })` to `handleWebhook`. Verified two ways:
  the existing 12-test behavioral suite passes unchanged (decorator is metadata-only); and a new
  real-`ThrottlerGuard` burst test (`dlocal-webhook.throttle.spec.ts`) proves the actual effect —
  150 sequential requests through the real guard hit zero 429s on this route, while a control
  route on the identical global default does 429 past 100 in the same run (proving throttling
  is genuinely active, not silently inert). First attempt used `Promise.all` and hit spurious
  `ECONNRESET` from the ephemeral test server's socket pool; switched to sequential requests,
  which also better mirrors how a real dLocal retry burst actually arrives.
  **Step 5:** documented the BullMQ job-ID derivation policy (`jobId = wise:event:<deliveryId>`,
  `jobId = wise:transfer:<customerTransactionId>`) in
  `01-part-19.5-wise-disbursement-architecture-design.md` §8.0 (which had already anticipated
  this session's two prerequisites in outline) and this order's Deviations.
  **Step 6:** registered **F43** (funding-SLA alert delivery channel) OPEN in
  `DECISION-LOG.md`, owner Davin, due 4A-W6.
  **Full verification:** `money-service` test suite 29/29 suites, 288/288 tests (was 27/285 at
  4A-W3a's close — +2 suites/+3 tests: the shutdown spec and the throttle spec). `npm run build`
  clean. Monolith `tsc --noEmit` clean (unaffected — no monolith code changed this session,
  audit-only reads). `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session hardened
  shared infrastructure only, no provider flip, no money moved.
  **Artifacts updated:** `4a-w4-wise-hardening-gate.migration-order.md` (Status → CONFIRMED,
  Deviations filled in full, Done-when checked), `DECISION-LOG.md` (F43 registered),
  `01-part-19.5-wise-disbursement-architecture-design.md` (§8.0 job-ID policy filled in),
  `migration-stack-analysis.md` (new money-service entry), `LESSONS-LEARNED.md` (new **L25**
  — `enableShutdownHooks()` not optional, new **L26** — global `APP_GUARD` throttler also
  throttles provider webhooks; both per `replace-rise-with-wise/05-artifact-amendments.md`
  §10's two pre-drafted entries, renumbered from that doc's stated L12/L13 to the live file's
  actual next numbers since 5 more sessions' lessons landed since either number was written —
  the doc's own text explicitly warns to re-check before trusting it), this file.
  `4a-w5-wise-webhook-reducer.migration-order.md` PRE-DRAFTed (PORT).
- _(superseded-by-above, retained for context)_ Session 4A-W3b CLOSED, executed as UI-BUILD — Part 19.5 (Wise) recipient
  form & admin UI (monolith `app/api/wise/recipients/*`, `app/affiliate/settings/payout`,
  `app/(dashboard)/admin/disbursement/recipients`), zero traffic cut over — 2026-07-26.
  **CONFIRM found the order file modified-but-uncommitted again** (header `PRE-DRAFT →
APPROVED`, no Advisor-DRAFT/Davin-approval commit trail, paired with a matching
  uncommitted edit to this file) — the same `LESSONS-LEARNED.md` L11 pattern, 8th+
  recurrence. Also found two open design questions the PRE-DRAFT had explicitly left for
  CONFIRM (File 1: flag vs flag-less; File 3: revalidate-button scope) silently resolved
  in the rewrite with no visible decision recorded. Stopped and asked Davin directly:
  status flip confirmed as his own edit, flag-less confirmed, revalidate-button scope
  confirmed (later superseded mid-build, see below). All 5 entry criteria (4A-W3a live
  401 check, F39/F41 resolved, 3 file line counts, `tsc --noEmit`) verified live and
  PASSED — a first for this series, zero drift found. Order marked CONFIRMED, executed.
  **Built (Files 1–4/5, dependency order, committed per step):** `lib/money-service/routes.ts`
  extended with 6 typed Wise recipient wrappers (+`lib/money-service/wise-types.ts`,
  frontend mirror of money-service's own `wise.types.ts`) and 5 new Next.js route
  handlers under `app/api/wise/recipients/*` (File 1); `components/affiliate/wise-recipient-form.tsx`
  (2-step schema-driven form: currency/country → dynamic fields from
  `AccountRequirementGroup[]`, client-side validation, graceful 403/500 handling) +
  `app/affiliate/settings/payout/page.tsx` (File 2); `app/(dashboard)/admin/disbursement/recipients/page.tsx`
  read-only paginated table (File 3); 17 route tests + 6 component tests, all passing
  (File 4).
  **Real auth-semantics mismatch found and escalated mid-build (File 1's last route):**
  the order's own text guarded `POST /api/wise/recipients/[id]/revalidate` with
  `requireAdmin()` and put a "Revalidate" button on the ADMIN page (File 3) — but the
  live `wise-recipients.controller.ts` (frozen at 4A-W3a) guards
  `POST /wise/recipients/:id/revalidate` with `AffiliateGuard` self-service only,
  deriving the recipient from the CALLER's own token (`:id` is only used for an
  ownership check, never to select the target). An admin-guarded proxy would either
  403 or silently revalidate the admin's OWN recipient instead of the target
  affiliate's — a real bug class, not a style choice. Escalated per
  `EXECUTOR-PROTOCOL.md` §5 rather than building it as specified; Davin's live call:
  move Revalidate to the affiliate's own payout settings page
  (`requireAffiliate()`-guarded, matching the backend); the admin page stays strictly
  view-only, no actions at all.
  **Order text vs. live tree drift found:** File 2's TARGET
  (`app/(dashboard)/affiliate/settings/payout`) doesn't exist — the live `(dashboard)`
  route group has no `affiliate/` subtree at all (affiliate pages live at
  `app/affiliate/*`, their own separate layout with its own auth-check). Built at
  `app/affiliate/settings/payout/page.tsx` instead, matching F39's actual recorded URL
  (`DECISION-LOG.md`, Session 4A-W3a) with its own thin layout mirroring
  `app/affiliate/dashboard/layout.tsx`'s auth pattern; added one nav-link entry to that
  layout so the new page is actually discoverable. Also added one nav-link entry to
  `app/(dashboard)/admin/disbursement/layout.tsx` for the new admin page.
  **File 1's own route list omitted `POST /wise/recipients/requirements/refresh`** even
  though the Contract section documents it and File 2's `refreshRequirementsOnChange`
  interaction needs it — added the wrapper + route as a deviation (already-frozen,
  already-documented endpoint, not scope creep). The interaction itself still can't be
  proven live (`GET requirements` still returns `quoteId: null`, 4A-W3a's known gap) —
  wired up but skips the network call when `quoteId` is null (guaranteed 400
  otherwise), tested against a mocked `quoteId` instead.
  **Full test suite:** `test:ci` 119/119 suites green (2105/2105 tests, +2 suites/+23
  tests over the 4A-W3a baseline). `tsc --noEmit` clean throughout. `DISBURSEMENT_PROVIDER`
  stays `MOCK` in production — this session shipped UI only, no provider flip, no money
  moved; the write path (`POST /wise/recipients`) still 403s in production on the
  read-only token, handled gracefully in the form's UI per 4A-W3a's carried-forward gap.
  **Artifacts updated:** `4a-w3b-wise-recipient-ui.migration-order.md` (Status →
  CONFIRMED, Deviations filled in full), `DECISION-LOG.md` (new Session 4A-W3b findings
  entry), `migration-stack-analysis.md` (new frontend-surface entry), this file.
  `4a-w4-wise-hardening-gate.migration-order.md` PRE-DRAFTed (CONTRACT + small INFRA).
- _(superseded-by-above, retained for context)_ Session 4A-W3a CLOSED, executed as PORT — Part 19.5 (Wise) recipient
  onboarding backend module (`money-service/src/wise/*`), zero traffic cut over — 2026-07-26.
  **CONFIRM (two passes):** first pass found 4/6 entry criteria FAILING against live state —
  F39/F41 still OPEN, `WISE_API_TOKEN` absent from Railway (value-blind check), and all
  three cited line counts stale by up to +212 lines (the order had been drafted from a
  mid-session snapshot before 4A-W2's own migration commit landed). Reported in full,
  execution declined. Second pass, after Davin resolved F39 (Option A — affiliate
  self-service, `/affiliate/settings/payout`) and F41 (Option A — Wise-managed PII, local
  `accountTail`/`detailsFingerprint` only), corrected the line counts, and confirmed the
  split/`APPROVED` status was his own intentional edit (no git commit trail existed for
  it — same `LESSONS-LEARNED.md` L11 shape as prior recurrences, resolved by asking
  directly): all 6 criteria re-verified live and passed, order marked CONFIRMED.
  **Built (Files 1–8/10, dependency order, committed per step):** `wise.config.ts`
  (`ConfigService`-backed typed settings), `wise.constants.ts`, `wise.types.ts`,
  `wise-api.client.ts` (native `fetch`, exponential back-off on 429/5xx, PII body
  redaction — 5 unit tests), `wise-signature.constants.ts` (Wise's real published
  sandbox/production RSA public keys, copied verbatim from the reference doc),
  `wise-signature.verifier.ts` (`crypto.verify('RSA-SHA256', ...)` — 6 unit tests, built
  ahead of 4A-W5), `wise-recipient.service.ts` (SHA-256 `detailsFingerprint` + last-4
  `accountTail` only, zero raw PII persisted — 14 unit tests),
  `wise-recipients.controller.ts` + `wise.module.ts` (`/v1/wise/recipients/*` per the
  frozen OpenAPI, F39 guards: `AffiliateGuard` on every affiliate route, `AdminGuard` only
  on the admin list, `:id`-scoped routes verify ownership explicitly), registered in
  `app.module.ts`.
  **Mid-build correction (`2d954e12`):** reading the frozen OpenAPI while building the
  controller found `CreateRecipientDto` (File 3/10, mirrors Wise's own `POST /v1/accounts`
  body) is a DIFFERENT shape than the OpenAPI's actual `POST /wise/recipients` request
  (`targetCurrency`/`recipientCountry`/`legalType`/`accountHolderName`/`requirementsType`/
  `details`) — `createRecipient` corrected to take `recipientCountry`/`legalType` as
  explicit caller-supplied fields instead of guessing from `details`; also added
  `revalidateRecipient` (required by the frozen `/revalidate` endpoint, absent from File
  7/10's own method list) and `DELETE /wise/recipients/{id}` (in the OpenAPI, missing from
  the order's own File 8/10 prose). **Unresolved, flagged for Davin/Advisor:** the OpenAPI
  says replacing a recipient should archive the old row; `AffiliateWiseRecipient
.affiliateProfileId` is `@unique` in the 4A-W2 schema (out of scope to change here), so
  this session upserts in place instead — needs a decision.
  **File 9 (THB production fixture) blocked, Davin deferred it:** tested the configured
  token against `api.wise.com` (`railway run`, token never exposed) → `401 invalid_token`
  — confirmed sandbox-only, not just labeled that way. Carried forward as Waiting-on.
  **Deploy blocked twice, then fixed:** `railway up` CLI failed both without
  `--path-as-root` (438MB upload, 413 — couldn't resolve `.gitignore` from the
  subdirectory) and with it ("Failed to read app source directory" — Root Directory
  mismatch). Found the working path: `git push origin main` (money-service has a connected
  GitHub source) — auto-deployed cleanly twice this session, confirmed live both times
  (all 6 new routes registered, unauthenticated `GET /v1/wise/recipients` and
  `/requirements` and `/me` all → 401). New `LESSONS-LEARNED.md` L23.
  **E2E testing against live production** (real minted NextAuth JWE for the existing
  `affiliate-test@trading-alerts.test` fixture, mirroring 4A-7a's precedent — no new
  production data written): found and fixed a real bug (`f100296a`) — the discouraged
  non-quote-scoped requirements fallback 422s without `sourceAmount`
  (`validation.failure.only.source.or.target.amount`), missed from the reference doc's own
  example on the first pass. Fixed, redeployed, re-verified: `GET requirements?
targetCurrency=GBP` → real `200`, 3 groups from Wise sandbox. **Full recipient-creation
  E2E NOT achieved:** `POST /v1/accounts` confirmed live `403 unauthorized` — isolated via
  a direct call to Wise sandbox, a genuine token read-only-scope limitation, not a code
  bug (the entry criterion "read-only is sufficient" holds for reads, not for recipient
  creation). Davin's call: accept as a confirmed external blocker rather than provide a
  write-scoped token this session — carried forward as Waiting-on.
  **Artifacts updated:** `4a-w3a-wise-recipient-backend.migration-order.md` (Status →
  CONFIRMED, Done-when checked/unchecked accurately, Deviations filled in full),
  `DECISION-LOG.md` (F39/F41 resolution entries + a full findings entry),
  `migration-stack-analysis.md` (new `money-service/src/wise/*` entry),
  `LESSONS-LEARNED.md` (new L23), this file.
  `4a-w3b-wise-recipient-ui.migration-order.md` already PRE-DRAFTed (from 4A-W2's close).
- _(superseded-by-above, retained for context)_ Session 4A-W2 CLOSED, executed as INFRA+PORT — Part 19.5 (Wise) additive
  production schema migration, zero traffic cut over — 2026-07-26.
  **CONFIRM found the order file itself mid-edit again:** `git status` showed
  `4a-w2-wise-additive-schema.migration-order.md` modified-but-uncommitted; `git diff` against
  the last commit showed `Status: PRE-DRAFT → APPROVED` with no Advisor-DRAFT/Davin-approval
  commit trail, and all four of the order's own line-count entry-criteria numbers had shifted
  `+1` away from both the committed version and the live codebase
  (`prisma/non-market-data/schema.prisma` 1023→1024, `money-service/prisma/schema.prisma`
  583→584) — the same `LESSONS-LEARNED.md` L11 pattern, 6th recurrence. Stopped and asked Davin
  live rather than trusting or silently correcting; Davin confirmed the edit was his own, kept
  `APPROVED`, and asked for the four numbers corrected back to the `wc -l` baseline (done).
  **Steps 1–2:** authored the 5 new models (`AffiliateWiseRecipient`, `WiseTransfer`,
  `WiseBatchGroup`, `WiseWebhookEvent`, `WiseWebhookSubscription`) + 3 new enums + `WISE` enum
  value + 3 back-relations verbatim from `01-…design.md` §4.1–4.2 in
  `prisma/non-market-data/schema.prisma`; `prisma validate` clean, diff additions-only.
  **Near-miss on SQL generation:** the order's literal `prisma migrate dev --create-only`
  command hit live drift detection against production (pre-existing untracked drift from past
  `db push` usage, unrelated to this session) and printed "We need to reset the 'public'
  schema... All data will be lost" — it only stopped short of the confirmation prompt because
  stdin wasn't a TTY (exit 130). Verified immediately via a real query against production: no
  data lost. Stopped, reported the near-miss in full, got Davin's explicit go before touching
  the DB connection again. **Fix:** generated the SQL via `prisma migrate diff --from-schema
<pre-edit snapshot> --to-schema prisma/non-market-data/schema.prisma --script` instead — pure
  datamodel diff, zero DB connection, can never propose a reset. Output verified clean (zero
  `DROP`/`ALTER COLUMN`/`RENAME`), written to
  `prisma/migrations/20260726000000_wise_disbursement_additive/migration.sql`.
  **DATABASE_URL vs DIRECT_URL confusion:** post-verification querying via `DATABASE_URL`
  (matching `lib/db/prisma.ts`'s runtime pattern) showed the new tables didn't exist — traced to
  `DATABASE_URL` (`turntable.proxy.rlwy.net`) and `DIRECT_URL` (`maglev.proxy.rlwy.net`) being
  genuinely different databases (different `User`/`Subscription` counts), not two proxy fronts
  to one instance. Stopped and asked Davin rather than guessing; confirmed live:
  `maglev`/`DIRECT_URL` is real production, `turntable`/`DATABASE_URL` is this checkout's
  staging target. New `LESSONS-LEARNED.md` L22 + a recurrence note on L19.
  **F38 resolved** (Davin, live): **Option A** — the platform bears the Wise fee
  (`feeBearer = 'PLATFORM'`), affiliates receive their exact earned commission with no fee
  deduction. Logged in full in `DECISION-LOG.md`.
  **Step 4 (apply to production, Davin present):** `prisma migrate deploy` against
  `DIRECT_URL`/production — clean, all 5 tables + `WISE` enum value confirmed via direct query,
  pre-existing table row counts confirmed unchanged (the applied SQL contains zero
  `UPDATE`/`DELETE`/`ALTER TABLE` statements capable of touching existing rows in the first
  place). Monolith's own Prisma client regenerated to match.
  **Step 5:** hand-mirrored the 5 models + 3 enums into `money-service/prisma/schema.prisma` as
  a subset — FKs to the 3 pre-existing shared models (`AffiliateProfile`, `PaymentBatch`,
  `DisbursementTransaction`) kept as bare scalars (no money-service code traverses them yet,
  same convention as `AffiliateCode<->Commission`); FKs _within_ the new Wise set kept as real
  relations. `prisma generate` only (never `db push`/`migrate deploy`, L1) — money-service
  builds clean, generated client confirmed to include all 5 models.
  **Step 6 (grant check):** proved via `SET ROLE money_svc` + a real
  INSERT/SELECT/UPDATE/DELETE cycle (rolled back, zero residue) against production — found
  `money_svc` had **zero** grants on all 5 new tables, exactly the risk register's predicted
  "most likely silent failure." Role-grant change → escalated to Davin per
  `EXECUTOR-PROTOCOL.md` §7 rather than just applying the order's own suggested fix; Davin
  approved. `GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE` applied,
  re-verified clean via the same real-query method (not a grant listing alone).
  **Step 7:** re-audited `amountRiseUnits`/`payeeRiseId` null-tolerance — the order's own text
  cited `report-builder.service.ts`/`admin-affiliate-reports.controller.ts`, but neither file
  references either field (checked); design §3.5(b) actually names 5 different files
  (`transaction.service.ts`, `payment-orchestrator.service.ts`, one API route, two admin
  pages) — verified all 5 against the live tree, all still null-safe exactly as the design doc
  claims, no reader needed editing.
  **Step 8:** added the archived-block banner (F42) to both schema files — comment-only, both
  re-validated clean.
  **Step 9:** fixed one real `tsc` error caused by the schema change (`types/disbursement.ts`'s
  hand-written `DisbursementProvider` union didn't include `'WISE'` — both dispatch functions in
  `lib/disbursement/providers/provider-factory.ts` already default to unavailable/throw for any
  unhandled provider, so this was a type-only, zero-behavior-change fix). `tsc --noEmit` clean;
  `eslint app components lib hooks --max-warnings 0` clean (0 errors, 0 warnings — a first,
  naive `eslint .` invocation wrongly scanned `e2e/archive/`, the separate
  `frontend-and-backend-python-stack/`, and `.next/` build output, producing 9534 unrelated
  problems; corrected to the project's own `validate:lint` scope); monolith `test:ci` 117/117
  suites, 2082/2082 tests (matches Session 5-4's baseline exactly); money-service has no `lint`
  script (order text inaccuracy) — `npm run test` 24/24 suites, 260/260 tests, `npm run build`
  clean.
  **Artifacts updated:** `4a-w2-wise-additive-schema.migration-order.md` (Status → CONFIRMED,
  line counts corrected, Deviations filled in full), `DECISION-LOG.md` (F38 register row +
  resolution entry), `LESSONS-LEARNED.md` (L19 recurrence, new L22),
  `migration-stack-analysis.md` (new schema/migration/type-fix entries), this file.
  `4a-w3-wise-recipient-onboarding.migration-order.md` PRE-DRAFTed (PORT + UI-BUILD).
- \_(superseded-by-above, retained for context) Session 4A-W1 CLOSED, executed as CONTRACT — Part 19.5 (Wise) contracts &
  decisions, no code, no schema, no money moved — 2026-07-26.
  **CONFIRM found the order file itself mid-edit:** `git status` showed
  `4a-w1-wise-contracts-and-decisions.migration-order.md` as modified-but-uncommitted;
  `git diff` against the last commit revealed the header had been flipped `DRAFT → APPROVED`
  with no Advisor/Davin approval commit trail, and — independently — all five of the order's
  own cited line-count entry-criteria numbers had each shifted by exactly `+1` away from both
  the committed version and the live codebase (`base-provider.ts` 174→175,
  `provider-factory.ts` 105→106, `payment-orchestrator.service.ts` 333→334, `app.module.ts`
  75→76, `non-market-data/schema.prisma` 1023→1024 — plus a sixth, non-entry-criterion number
  in the handoff section, `transaction.service.ts` 310→311). This is the same shape as
  `LESSONS-LEARNED.md` L11's four prior recurrences (self-contradicting/uncommitted order
  status) — stopped and reported to Davin rather than trusting or silently correcting either
  field. Davin confirmed live: the `DRAFT→APPROVED` edit was his own intentional approval, and
  he separately restored all five line-count numbers to the correct `wc -l` baseline before
  saying go. Re-verified live: paths exist, line counts hold exactly (174/105/333/75/1023),
  zero drift against the design doc. Order then marked CONFIRMED and executed.
  **Steps executed:** read the full docset (`00`→`07`, `01`, `02`, `04` in full per the
  order's own reading order; `03`/`05`/`06` read in full rather than skimmed, since `05`'s
  paste-ready blocks were needed verbatim and `02`/`03`/`06` fed the OpenAPI freeze/secret
  matrix directly). Business Payment Approval rules: **confirmed absent** on the Wise business
  account (Davin, live) — no action needed before 4A-W6. **F36 resolved: Model A** (Business +
  personal API token) — Davin's 2026-07-25 "design for both" superseded by an explicit live
  choice this session; funding stays `MANUAL` regardless (Thailand region gate), and F36 also
  fixes the webhook subscription level as profile-level for F40. **F37 resolved: `MANUAL`** —
  Thailand region re-confirmed live. Sandbox identity bootstrapped: `GET /v1/profiles`
  (Davin ran it himself, response body shared back, token never entered this session) →
  business `WISE_PROFILE_ID` = `29617748` (type `business`; a sibling personal profile
  `29617747` also exists and was **not** recorded as the business ID). `WISE_SOURCE_CURRENCY`
  = `USD`, balance confirmed to exist on the account (Davin). F38–F41 registered OPEN in
  `DECISION-LOG.md`'s flag register with owners/due sessions (F43 deliberately **not**
  registered — stays deferred to 4A-W4 per the order's own scope). F42 recorded RESOLVED
  (RiseWorks archive-not-delete) with the full entry from the docset template.
  `4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md` marked **REVOKED**
  (file retained). `part19.5-wise-disbursement-openapi.yaml` reviewed against live
  money-service code — guard names (`JwtAuthGuard`/`AdminGuard`/`AffiliateGuard`), the global
  `/v1` prefix excluding `health`/`health-auth` (`main.ts`, 51 lines), and a route-collision
  check against all 8 registered controllers: zero drift, zero collisions — `info.description`
  marked `Status: CONTRACT (frozen at 4A-W1)`. The §5.2 Wise-state mapping table in
  `01-…architecture-design.md` marked invariant. `docs/secret-matrix.md` extended with all
  `WISE_*` variables and the token promotion plan (read-only 4A-W1/W3/W5, full access only from
  4A-W6). THB-not-testable-in-sandbox limitation recorded in this order's Deviations and
  carried into the `4A-W2` PRE-DRAFT.
  **Artifacts updated:** `4a-w1-wise-contracts-and-decisions.migration-order.md` (Status →
  CONFIRMED, Deviations filled), `DECISION-LOG.md` (flag-register rows F36–F42 + full
  resolution entries for F36/F37/F42 + the payment-approval finding),
  `4a-5-rw-…migration-order.md` (REVOKED), `part19.5-wise-disbursement-openapi.yaml` (frozen),
  `01-…architecture-design.md` (§5.2 invariant marker), `docs/secret-matrix.md` (Wise section),
  `monolith-to-microservices-migration-session-playbook.md` (Part 19.5 session block + quick-
  reference rows), `SESSION-PROMPT-SCRIPT.md` (4A-W1…W8 rows), this file.
  `4a-w2-wise-additive-schema.migration-order.md` PRE-DRAFTed (INFRA+PORT).
- \_(superseded-by-above, retained for context) Session 4A-7b CLOSED, executed as VERIFY-RETIRE — money-service Slice 3
  read-API CUTOVER, both flag groups flipped ON in production — 2026-07-26.
  **CONFIRM found entry criterion #2 FAILED, not just unverified:** value-blind
  `vercel env ls` (all environments) showed `MONEY_SERVICE_URL`,
  `MIGRATE_READ_APIS_MONEY_AFFILIATE`, and `MIGRATE_READ_APIS_MONEY_ADMIN` did not exist
  anywhere in Vercel — 4A-7a's close-out claim of "added to `.env.example`" was accurate
  but never carried into the real environment. This was not benign: `MONEY_SERVICE_URL`
  absent means `lib/money-service/client.ts:15`'s `?? 'http://localhost:3002'` fallback
  would have hard-failed 100% of a flipped group's traffic against an unreachable local
  address, with no graceful degradation (the flag itself disables the monolith
  fallback). Stopped and reported to Davin rather than silently fixing or silently
  proceeding; Davin approved the fix live. **Fix executed:** added all 3 vars to Vercel
  production (`MONEY_SERVICE_URL` set to money-service's real Railway address, both
  flags `false`), redeployed to establish a genuine OFF baseline
  (`trading-alerts-saas-frontend-bt69dabys.vercel.app`), re-verified value-blind, then
  smoke-tested both route groups unauthenticated before touching the checklist.
  Order then marked CONFIRMED. **Cutover executed:** Group (a)
  `MIGRATE_READ_APIS_MONEY_AFFILIATE=true` + redeploy, confirmed clean, then Group (b)
  `MIGRATE_READ_APIS_MONEY_ADMIN=true` + redeploy, confirmed clean. Unauthenticated
  smoke test after each flip: all 4 affiliate routes → 500, confirmed as the
  pre-existing L12 bug (`error.message`-vs-`.code`, present identically in all 4 route
  files — the flag check runs after `requireAffiliate()`, so it can't be caused by the
  flip); all 8 admin routes → 401, guards correct, no L12-class bug on this group. No
  code changed anywhere this session — 3 env var writes + 3 redeploys only, per this
  VERIFY-RETIRE order's near-zero creativity dial. **Not fully closed:** no real
  authenticated request has yet been observed reaching money-service post-cutover in
  either group (see Waiting-on #40) — same open-monitoring-caveat class as Slices 1/2.
  **Artifacts updated:** `4a-7b-money-service-read-apis-cutover.migration-order.md`
  (Status → CONFIRMED, entry criteria checked, Deviations recorded in full),
  `DECISION-LOG.md` (new Session 4A-7b entry), `migration-cutover-table.md` (Slice 3 row
  → `CUT-OVER`), this file.
- \_(superseded-by-above, retained for context) Session 4A-7a CLOSED, executed as
  UI-BUILD (+CONTRACT) — money-service
  Slice 3 read-API transport BUILD, zero traffic cut over — 2026-07-25.
  **CONFIRM:** re-verified Blocker-1's httpOnly evidence live (all four points held
  exactly at their cited lines); re-verified Session 4A-6's 12 GET routes still 401
  unauthenticated (live spot-check); reviewed the parity baseline
  (`4a-6_test-results_ready_to_proceed_with_4a-7a.md`, 12/12 green). Audited Waiting-on
  #36/#38 against live Railway deployment history rather than trusting the existing
  CLAUDE.md claims: **#36 closed clean** (deployment `b401bc62`'s natural `[CRON]` ticks
  across the full 2026-07-23 UTC 00:00–04:00 window, `errorCount: 0`, zero duplicate
  rows). **#38 found NOT closed** — walked every deployment since the signature fix and
  found the "confirmed live — correct DB writes, second replay idempotent" language in
  this file and `migration-cutover-table.md` unsupported by the logs (the only two
  logged deliveries were pre-replay-guard-fix synthetic payloads that both 404'd on
  `Payment record not found`, zero DB writes). Raised this live with Davin rather than
  silently resolving either way; Davin's correction: that verification never actually
  happened against a live DB record, only unit/integration-tested in development — #38
  stays OPEN with this corrected context (see Waiting-on below), non-blocking for this
  BUILD-only session. Also found `npm run validate`'s `validate:format` step failing on
  287 files — traced to `core.autocrlf=true` on this Windows checkout (CRLF vs.
  prettier's LF default), a pre-existing environmental artifact, not a regression;
  Davin's live ruling: `tsc --noEmit` + `eslint --max-warnings 0` (both re-verified
  clean after every edit) is the code baseline for this repo on Windows, not the full
  `validate:format`/`validate:policies` chain — `prettier --write` across 287 files was
  explicitly declined as an out-of-scope drive-by.
  **F45 resolved** (Davin, live): Option (a) server-side proxy — Next.js route handlers
  read the httpOnly session cookie server-side and forward it as `Authorization: Bearer`
  to money-service, mirroring `lib/operation-service/client.ts`'s proven pattern.
  money-service's `ALLOWED_ORIGINS` CORS allowlist becomes dead config under this
  decision — do not widen it later "to fix CORS." **F44 resolved** (Davin, live):
  Option (a) manual parity verification (the 12/12-route parity check already on file)
  stands in for the 48h shadow-run, matching the F35 precedent. Both logged in full in
  `DECISION-LOG.md`.
  **Built:** `lib/money-service/client.ts` (mirrors operation-service's
  `MoneyServiceError`/error-mapping shape), `lib/money-service/routes.ts` (server-only
  cookie read + typed wrappers for all 12 Slice-3 routes), `lib/money-service/flags.ts`
  (`MIGRATE_READ_APIS_MONEY_AFFILIATE` / `_ADMIN`, both default OFF — split per-group so
  4A-7b's own per-group flip order and its "no code work" constraint both hold). Wired
  the flag check into all 12 existing Next.js API route handlers — the monolith's own
  `requireAffiliate()`/`requireAdmin()` check always runs first, unchanged; only on a
  pass does the flag gate a branch to money-service, falling through to the existing
  Prisma logic when OFF (the default in every environment, including production).
  `MONEY_SERVICE_URL` + both flags added to `.env.example`.
  **Step 5 (prove one signed-in call end-to-end):** per Davin's explicit direction, used
  a temporary scratch script minting a real NextAuth v4 session token (via
  `next-auth/jwt`'s own `encode()`, same `NEXTAUTH_SECRET`) for the project's canonical
  `affiliate-test@trading-alerts.test` / `free-test@trading-alerts.test` fixtures
  (seeded via the existing dev-only `/api/test/seed` endpoint — no real customer data
  touched), run against a local dev server with the affiliate flag on and
  `MONEY_SERVICE_URL` pointed at live production money-service. Confirmed in Railway's
  HTTP logs that the forwarded request genuinely reached money-service (not the
  monolith fallback); `JwtAuthGuard` correctly decoded the forwarded Bearer JWE and
  `AffiliateGuard` correctly authorized it. The response was a `404` rather than `200`
  — traced to local dev's `DATABASE_URL` (likely the F34 staging Postgres project)
  being a **different database** than money-service's production `DATABASE_URL`
  (confirmed by querying each directly) — the seeded test fixture genuinely doesn't
  exist in the DB money-service reads, so the 404 is money-service's Prisma layer
  working correctly against real data, not a transport failure. 403 negative case
  (non-affiliate token) verified correct. 401 negative case (no cookie) surfaced a
  **pre-existing, unrelated bug**: `LESSONS-LEARNED.md` L12 (the monolith's
  `stats/route.ts` catch block checks `error.message` for a marker `AuthError` only
  ever sets on `.code`) — falls through to a generic 500 instead of 401; untouched by
  this session's edits, out of scope to fix here. Davin's live call: this evidence is
  sufficient proof of the F45 transport/auth-bridge working end-to-end — did not write
  test data into production to force a literal 200. Scratch script + local dev server
  both cleaned up after use.
  **Artifacts updated:** `4a-7-money-service-read-apis-cutover.migration-order.md`
  (already SUPERSEDED by the Advisor when 4A-7a was drafted), `DECISION-LOG.md` (F44/F45
  full entries), `migration-cutover-table.md` (Slice 3 row), `migration-stack-analysis.md`
  (new `lib/money-service/*` files + 12 modified route handlers), this file.
  `4a-7b-money-service-read-apis-cutover.migration-order.md` PRE-DRAFTed (VERIFY-RETIRE).
- \_(superseded-by-above, retained for context) Session 4A-5 CLOSED, executed as
  money-service webhooks Slice 2 CUTOVER (dLocal-only, scope-amended 2026-07-24) —
  2026-07-24.
  **CONFIRM (two live passes this session):** first pass found the order's own header
  read `DRAFT (scope-amended, awaiting Davin's approval)` — not APPROVED, contrary to
  the initial framing — and found no evidence yet of Entry Criterion #2 (a real signed
  dLocal webhook verified against the new endpoint); stopped and asked Davin live
  rather than assume, per the order's own explicit gate. Second pass, after Davin's own
  shadow-run/debugging work landed: found two real bugs already fixed and recorded as
  Deviations, both explicit Davin-authorized scoped exceptions (EXECUTOR-PROTOCOL.md §7
  money/auth escalation) — `8e681297` (signature verification read a `x-signature`
  header dLocal never sends; real signature is `Authorization: V2-HMAC-SHA256,
Signature: <hex>` over `X-Login+X-Date+body`, not the raw body alone) and `1cc31b24`
  (webhook replay of an already-COMPLETED payment created a duplicate "Welcome to
  PRO!" `Notification` row — `Payment`/`Subscription`/`Commission` writes were already
  idempotent, only `notification.create()` lacked a guard). The order's own Deviations
  notes explicitly flagged that neither fix alone satisfied Entry Criterion #2 — asked
  Davin live whether the actual post-fix real-signed-payload replay had been verified;
  confirmed yes (correct `Payment`/`Subscription` DB writes, second replay idempotent).
  Also confirmed live: chain-length-one narrows to dLocal-cutover-first (see standing
  instruction above).
  **Flip executed** (order's Checklist step 3, dashboard-side, by Davin): dLocal
  Merchant Dashboard webhook URL updated to
  `https://money-service-production.up.railway.app/v1/webhooks/dlocal`. Railway logs
  checked immediately after: clean boot, no errors, but no real payment webhook had
  landed in that log window yet.
  **Monitoring caveat (order's Checklist step 4, not fully closed this session):** the
  first live post-flip delivery hasn't been directly observed — spot-check `railway
logs` for money-service on the next real dLocal payment (expect no errors, correct
  `Payment`/`Subscription` row updates) before treating dLocal as fully stable.
  Recorded in `migration-cutover-table.md`'s Slice 2 row.
  **Process note:** a `railway variables --kv` check (to confirm `DLOCAL_WEBHOOK_SECRET`
  was set) printed the actual secret value into the session transcript — should have
  been a value-blind existence check instead. Value not reproduced in any artifact;
  Davin may want to weigh rotation given it now sits in a transcript. New
  `LESSONS-LEARNED.md` entry recorded.
  **Artifacts updated:** `migration-cutover-table.md` (Slice 2 row →
  `CUT-OVER (dLocal only)`, RiseWorks portion noted separately), `CLAUDE.md` (this
  block, chain-length-one narrowing, Waiting-on). `DECISION-LOG.md` — no flag applies
  to this specific cutover mechanism, left unchanged.
- **Current order:**
  `docs/migration-orders/4a-w6-wise-payout-engine.migration-order.md` (CONFIRMED and executed by
  Executor 2026-07-26). Predecessor `4a-w5-wise-webhook-reducer.migration-order.md` stays
  CONFIRMED/executed (see historical block below). Predecessor `4a-w4-wise-hardening-gate.migration-order.md` stays
  CONFIRMED/executed (see historical block below). Predecessor
  `4a-w3b-wise-recipient-ui.migration-order.md` stays
  CONFIRMED/executed (see historical block below). Predecessor
  `4a-w3a-wise-recipient-backend.migration-order.md` stays CONFIRMED/executed (see historical
  block below — split from the unsplit `4A-W3` PRE-DRAFT into `4A-W3a` backend + `4A-W3b` UI).
  The unsplit `4a-w3-wise-recipient-onboarding.migration-order.md` is now SUPERSEDED (stub
  pointing to the split files). Predecessor `4a-w2-wise-additive-schema.migration-order.md`
  stays CONFIRMED/executed (see historical block below). Predecessor
  `4a-w1-wise-contracts-and-decisions.migration-order.md` stays CONFIRMED/executed (see
  historical block below). Predecessor money-service order
  `4a-7b-money-service-read-apis-cutover.migration-order.md` stays CUT-OVER/closed, superseding
  `4a-7-…`/`4a-7a-…` (both SUPERSEDED, retained as audit trail).
  `4a-5-rw-money-service-riseworks-webhook-cutover.migration-order.md` stays **REVOKED**
  (2026-07-26, Session 4A-W1) — RiseWorks replaced by Wise per F42, file retained.
- **Order status (4A-W6):** payout engine (`isFundable` branch) built and verified clean — all 8
  files shipped plus 3 extra test files (11 total), `money-service` 44/44 suites, 366/366 tests
  (was 33/33, 326/326 at 4A-W5's close). Monolith `tsc --noEmit` clean. F43 RESOLVED (Resend REST
  direct). Five order-text-vs-ground-truth mismatches found and corrected (SLA default,
  `FundableProvider` shape, quote direction, endpoint count, file locations — see Current above,
  `LESSONS-LEARNED.md` L27 recurrence). New **L28**: two core files had no test suite at all before
  this session, contrary to what Hard Invariant #4 assumed — built both. Real
  `MockPaymentProvider` transactionId bug found, deliberately not fixed (out of scope, possibly
  load-bearing). **Critical carry-forward finding (Waiting-on #54): 4A-W7's own literal cutover
  step ("flip `DISBURSEMENT_PROVIDER=MOCK → WISE`") would currently be a silent no-op** —
  `provider-factory.ts`/`disbursement.constants.ts` were deliberately not touched this session
  (real DI-construction surgery, not additive), so `getDefaultProvider()` still can't return
  `'WISE'`. 4A-W7's own PRE-DRAFT carries a new Entry criterion 0 blocking on this. Standing note
  unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session built the payout
  engine only, no provider flip, no money moved.
- **Order status (4A-W5, historical):** webhook receiver + state reducer built and verified clean — all 8
  files shipped plus 2 extra test files (10 total), `money-service` 33/33 suites, 326/326 tests
  (was 29/29, 288/288 at 4A-W4's close). Monolith `tsc --noEmit` clean (unaffected). F40
  RESOLVED (`PROFILE`-level). Four order-text-vs-ground-truth mismatches found and corrected
  (throttle, state table, `CommissionStatus` enum, `WiseBatchGroup` field name — see Current
  above, `LESSONS-LEARNED.md` L27). Verification method downgraded from real-Wise-Simulation-API
  capture to hand-constructed RSA-signed test payloads (Davin's Option 2 — sandbox funding
  availability unknown, same root cause as Waiting-on #47). Standing note unchanged:
  `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session built the webhook receiver
  only, no provider flip, no money moved, no production Wise webhook subscription.
- **Order status (4A-W4, historical):** CC-C/CC-D hardening gate closed clean — idempotency audit (6
  endpoints, no "TBD" verdicts) and webhook-dedupe audit (dLocal/Stripe/RiseWorks, real gap
  found in Plan §13's own template) both committed to the order's Deviations; both live defects
  fixed and verified (`enableShutdownHooks()` + a real end-to-end shutdown test;
  `@Throttle()` on the dLocal webhook + a real-guard burst test); BullMQ job-ID policy
  documented for 4A-W5; F43 registered OPEN. `money-service` 29/29 suites, 288/288 tests;
  monolith `tsc --noEmit` clean. Standing note unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK`
  in production — this session hardened shared infrastructure only, no provider flip, no money
  moved.
- **Order status (4A-W3b, historical):** frontend surface built and verified clean — all 5 files shipped
  (server-side proxy layer, dynamic recipient form + affiliate payout page, admin read-only
  list page, 23 new tests, artefact updates). `tsc --noEmit` clean throughout; monolith
  `test:ci` 119/119 suites (2105/2105 tests). Ships flag-less (Davin, live). Real
  auth-semantics mismatch found and resolved mid-build (revalidate moved from the admin page
  to the affiliate's own payout page — see Current above and `DECISION-LOG.md`). Standing
  note unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK` in production — this session shipped
  UI only, no provider flip, no money moved.
- **Order status (4A-W3a, historical):** backend module built and deployed clean — 8 of 10 files' worth
  of scope shipped (Files 1-8 built; File 9 deferred by Davin, File 10's full write-path E2E
  blocked by token scope, both carried forward). 27/27 money-service test suites green
  (285/285 tests), monolith `test:ci` re-verified 117/117 (2082/2082) via the pre-push hook.
  Live-verified in production: all 6 `/v1/wise/recipients/*` routes registered, unauthenticated
  requests → 401, `GET requirements` → real `200` with live Wise sandbox data. F39/F41
  RESOLVED. Standing note unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK` in production —
  this session created recipient endpoints but did not flip the active provider or move any
  money; the one write-path call attempted (a test recipient creation) 403'd on token scope,
  never reached Wise as a successful write.
- **Order status (4A-W2, historical):** additive migration applied to production clean — 5 new tables +
  `WISE` enum value confirmed live via direct query, pre-existing table row counts unchanged,
  `money_svc` grant gap found and fixed (Davin-approved), money-service schema mirrored and
  builds clean, F38 RESOLVED (Option A — platform bears fee), full test suites green both
  sides. Standing note unchanged: `DISBURSEMENT_PROVIDER` stays `MOCK` in production until
  `4A-W7` cuts over — **no real affiliate payout goes out through money-service before then;
  any order that would create a real payment batch before 4A-W7 is out of order, stop and ask
  Davin.**
- **Order status (4A-W1, historical):** all-green — no code written, no schema changed, no money
  touched, `git diff --stat` shows documentation/order-file changes only. F36/F37 RESOLVED,
  F38–F41 registered OPEN (F38 now RESOLVED at 4A-W2, see above), F42 RESOLVED, Business Payment
  Approval confirmed absent, `WISE_PROFILE_ID` (sandbox business) captured, OpenAPI + state
  table frozen.
- **Order status (4A-7b, historical):** CUT-OVER — both `MIGRATE_READ_APIS_MONEY_AFFILIATE` and
  `MIGRATE_READ_APIS_MONEY_ADMIN` are `true` in Vercel production, redeployed and
  smoke-tested clean (see the 4A-7b historical block below for the CONFIRM-time gap
  found/fixed and the monitoring caveat carried to Waiting-on #40). CC-F freeze on the
  monolith's own affiliate/admin route + `lib/` logic stays until a future RETIRE session.
- **Order status (4A-7a, historical):** BUILT, zero traffic cut over — flags default
  OFF in every environment at the time. **What shipped:** transport module
  (`lib/money-service/client.ts`, `routes.ts`, `flags.ts`), flag wiring into all 12
  existing Slice-3 route handlers, F44/F45 resolved and logged, end-to-end
  proxy+auth-bridge proof. Superseded by 4A-7b's cutover above.
- **Prior order (4A-5, historical):** dLocal CUT-OVER, all-green (monitoring caveat
  above). RiseWorks portion not started. **What shipped (dLocal only):**
  - Two live-escalated bugfixes (full detail in Current above): dLocal webhook
    signature verification (`8e681297`) and a replay-guard on webhook completion side
    effects (`1cc31b24`). Both documented as Deviations in the order itself, both
    tested (34/34 then full-suite 260/260 pass, `tsc --noEmit` clean).
  - dLocal's provider-dashboard webhook URL repointed to money-service's
    `/v1/webhooks/dlocal` endpoint — the cutover moment itself, per this order's own
    framing (no code flag, no redeploy).
  - RiseWorks's route stays deployed-but-silent exactly as 4A-4 left it — untouched,
    unweakened, zero live traffic, dashboard still pointed at the monolith.
- **Last session did:** Session 5-4 ("Fonts, Streaming & Phase 5 Exit Review",
  `next@16.2.10`) — closed 2026-07-23. Phase 5 (Next.js 16 Optimization) fully closed &
  verified (F10 RESOLVED): Google `Inter` font loader with system-font fallbacks,
  React 19 `<Suspense>` streaming boundaries verified across dynamic routes,
  `vercel.json`/`next.config.js` deployment rules validated. Full exit suite green:
  `type-check` 0 errors, `validate:lint` 0 errors, `build` 127/127 routes (29.82 MB
  bundle vs <340MB ceiling), `test:ci` 117/117 suites, 2082/2082 tests. Live Vercel
  production deployment verified (commit `be62d87f`).
- **Waiting on:** all Session 4A-4 items unchanged except where noted below (renumbered
  continuation). (1)-(6), (11)-(12), (17)-(20), (23), (27)-(29) unchanged — see prior
  closes for full text. **(26, PARTIALLY RESOLVED Session 4A-5)** `DLOCAL_WEBHOOK_SECRET`
  now confirmed set on Railway production (this session) — `RISE_WEBHOOK_SECRET` still
  not set, moves to `4A-5-RW`'s own entry criteria; Stripe/Resend secrets status
  unchanged/unverified this session. **(31, RESOLVED Session 4A-5)** Session 4A-5's real
  signed-payload replay requirement — done: real dLocal webhook traffic verified against
  the fixed signature-verification code, correct `Payment`/`Subscription` writes,
  second replay confirmed idempotent (Davin, live). **(37, CLOSED BY REVOCATION, Session
  4A-W1)** `4A-5-RW` (RiseWorks webhook cutover) is now **REVOKED**, not merely still
  PRE-DRAFT — RiseWorks is being replaced by Wise (Part 19.5, F42 RESOLVED), so its blocking
  entry criterion (RiseWorks replying with webhook/API settings) is moot. Closed by
  revocation, not resolution — no reply from RiseWorks was ever received or needed.
  **(38, still OPEN, audited Session 4A-7a —
  narrowed and corrected)** dLocal's cutover flipped the dashboard URL, but the
  completion/replay-guard execution path against a live database record has still never
  been exercised by a real HTTP request in production. 4A-7a walked every Railway
  deployment from the signature fix (`8e681297`, live 2026-07-24 11:58 UTC) through the
  current deployment (HTTP edge logs + app stdout logs): the only two deliveries logged
  anywhere are `shadow-run-cash`-labeled synthetic payloads (12:02/12:23 UTC on
  deployment `ea69c732`) that both hit `Payment record not found for webhook`
  (zero DB writes) and both predate the replay-guard fix (`1cc31b24`, live 13:48 UTC) —
  every deployment since shows zero webhook activity of any kind. This corrects the
  "confirmed live by Davin — correct Payment/Subscription DB writes, second replay
  idempotent" language recorded under Session 4A-5 above and in
  `migration-cutover-table.md`'s Slice 2 row: **Davin's live clarification (4A-7a,
  2026-07-25) is that no such verification against a live DB record has actually
  happened yet — only unit/integration-tested during development.** Per Davin's call
  this is non-blocking for 4A-7a (BUILD-only, zero traffic cut over) and carries forward;
  it remains a real open item before dLocal Slice 2 can be called fully stable — spot-check
  `railway logs` on the next real (or deliberately-run realistic synthetic) dLocal
  payment. **(39, NEW)** `npm run validate`'s `validate:format` step (`prettier --check
.`) fails on 287 files repo-wide — traced this session to `core.autocrlf=true` on this
  Windows checkout (files carry CRLF line terminators, prettier's default expects LF),
  not a content/style regression. Davin's live ruling let 4A-7a proceed on
  `tsc --noEmit` + `eslint --max-warnings 0` alone, but the underlying gap (no
  `.gitattributes` line-ending normalization, `validate:format`/`validate:policies`
  effectively unenforceable on Windows) is still there — worth a future session's
  attention (likely a `.gitattributes` fix + one-time `prettier --write` pass on a
  dedicated branch, not a drive-by inside a feature session) before relying on
  `validate:format` again. **(30, unresolved, now 3
  sessions running)** `LESSONS-LEARNED.md` still at 40 active lessons (L1-L40) — AT the
  stated cap; this session found 2 more genuinely new lessons (recorded in the 4A-6
  order's own Deviations + LESSONS-LEARNED.md's header note instead of as new numbered
  entries, per the file's own "pause before adding another" instruction) without a
  consolidation pass happening. Flagged in Sessions 4A-2, 4A-4, and now 4A-6 — this is
  no longer a one-off, it needs the Advisor's attention before the next order that
  touches this file. **RESOLVED same-day by Davin**: the Advisor ran the consolidation
  pass 2026-07-22 — old lessons moved to `LESSONS-ARCHIVE.md`, active file is now clean
  (L1-L10), and L1 codifies item #32 below. **(32, CORRECTED — was wrongly framed as
  CRITICAL/actionable by this session, corrected same-day by Davin):** money-service does
  **NOT** have its own database — per blueprint §5.1 ("Phase 1: one instance, two
  roles/schemas"), it shares the MONOLITH's single Postgres instance via the `money_svc`
  role (L36) and only ever defines a schema SUBSET. Sessions 4A-2/4A-4/4A-6 running only
  `prisma generate` (never `db push`/`migrate deploy`) from money-service was therefore
  the CORRECT and ONLY safe behavior, not a gap — running either from money-service would
  risk dropping the monolith's own tables that aren't in money-service's subset. The
  monolith remains the sole owner of all schema migrations; money-service's schema.prisma
  subset just needs to keep matching whatever the monolith's migration history already
  established. New `LESSONS-LEARNED.md` L1 (Session 4A-6, Advisor review) makes this a
  hard rule — read it before ever considering a Prisma migration command from
  money-service again. **(33, RESOLVED same-day by Davin — chain-length-one invoked)**
  Session 4A-6's own predecessor order arrived APPROVED with an internally contradicted,
  untracked, no-git-history file while Session 4A-5 was still unresolved at DRAFT, so two
  cutover orders (4A-5, 4A-7) ended up pending simultaneously. Davin's ruling: invoke
  "chain-length-one" — **stop all BUILD work**; Davin is manually running 4A-5's
  shadow-run verification himself and webhooks (Slice 2) will cut over FIRST, before
  anything else (including 4A-7) proceeds. No further Slice 3/4 work until Davin says so.
  **(34, RESOLVED same-day by Davin)** 4A-7's browser-auth design question: blueprint
  §4.2 — "No cookie sharing across domains — the frontend sends `Authorization: Bearer`."
  The Next.js frontend will manually extract its JWT and attach it as a Bearer header
  when calling money-service's Read APIs. `JwtAuthGuard`/`AdminGuard`/`AffiliateGuard`
  (already built, Session 4A-6) need no changes — confirmed correct as-is by Davin. 4A-7's
  order updated to reflect this; still blocked on chain-length-one (#33) regardless.
  **(35, NEW)**
  `migration-stack-analysis.md`'s money-service section was never updated after Session
  4A-1 — Sessions 4A-2 and 4A-4's new files (crons/dlocal/riseworks/disbursement/
  affiliate-support modules) were never recorded there, a standing gap this session
  found and flagged but did not backfill (out of scope, full regen is an 8.6-only task
  per `00-SKELETON-AND-RULES.md` §5) — only this session's own additions were appended.
  **(29, RESOLVED Session 4A-3)** money-service's own unfinished manual-trigger
  verification step (4A-2's blocker for the crons cutover) — completed and confirmed
  live with Davin this session, all 8 jobs idempotent. **(36, RESOLVED Session 4A-7a)**
  Session 4A-3's cutover landed; this item tracked the scheduler's own natural tick
  (not the manual-trigger bypass) under the new live regime. Confirmed clean at 4A-7a
  CONFIRM: Railway deployment `b401bc62` ran continuously 2026-07-22 10:12 UTC →
  2026-07-24 05:34 UTC, spanning the natural 2026-07-23 UTC 00:00–04:00 window. All five
  hourly `[CRON]` ticks fired and completed with `errorCount: 0`, zero duplicate
  `PaymentBatch`/`DisbursementTransaction` rows. Slice 1 is fully stable. **(40, NEW)**
  Slice 3's read-API cutover (4A-7b, 2026-07-26) is live in production for both flag
  groups, but no real authenticated request has yet been directly observed reaching
  money-service through either group — this session's verification was build health,
  unauthenticated-guard smoke tests, and absence-of-errors in logs, not a live
  authenticated round trip (minting a production auth token was judged out of this
  VERIFY-RETIRE session's scope — touches secrets/auth semantics beyond the order's
  explicit steps). Same open-monitoring-caveat class as #36 (resolved) and #38 (still
  open) — spot-check Railway money-service logs + Vercel function logs the next time a
  real affiliate or admin actually loads their dashboard, before calling Slice 3 fully
  stable. **(41, NEW)** Part 19.5 (Wise) replaces RiseWorks as the disbursement provider —
  `docs/migration-orders/replace-rise-with-wise/` is the governing docset (`00`–`07` + the
  OpenAPI spec). Sessions `4A-W1…4A-W8` are inserted between 4A-7 and 4A-8 (Davin,
  2026-07-25); `4A-W1` executed 2026-07-26. **(42, NEW — commercial, shapes everything
  downstream)** The Wise business account is registered in **Thailand**, not on Wise's
  API-funding allowlist (US, CA, AU, NZ, SG, MY) for personal API tokens, and F36 resolved to
  **Model A** (personal token, not a Platform partnership) — so **every payout cycle needs
  one manual funding action by Davin in the Wise app**, indefinitely, unless F36 is revisited.
  The architecture handles this (funding is a batch _state_, not a method call) and a
  funding-SLA alarm (F43, registered at 4A-W4) prevents silent stalls. **(43, NEW)**
  `WISE_API_TOKEN` is a money-moving secret. Plan: **read-only** token for 4A-W1/W3/W5,
  promoted to **full access** only at 4A-W6. Verify presence **value-blind** — never
  `railway variables --kv` (L17). This session's own sandbox `GET /v1/profiles` call was run
  by Davin outside this chat; only the response body (profile IDs `29617747`
  personal/`29617748` business, types) was shared back — no token value entered this
  transcript. **(44, NEW)** THB cannot be exercised end-to-end in Wise's sandbox (UK-region,
  stable only for GBP/USD/EUR) — recorded in `4a-w1-…`'s Deviations, unchanged at 4A-W2 (no
  Wise API calls happen in a schema-only session). Consequence unchanged: `4A-W3` must fetch
  the real THB account-requirements schema from **production** (read-only, no money); `4A-W6`'s
  E2E runs on a sandbox-supported currency pair; `4A-W7`'s single smoke payout is the first
  real proof of the THB route. **(45, NEW)** `4a-w2-…`'s own order text contained two
  inaccuracies caught during execution, neither blocking: Step 7 cited
  `report-builder.service.ts`/`admin-affiliate-reports.controller.ts` as needing a
  null-tolerance re-check, but neither file references `amountRiseUnits`/`payeeRiseId` at all
  (checked) — design §3.5(b), the order's own cited source, actually names 5 different files,
  which were the ones actually re-audited. Step 9 said money-service has its own `lint` script;
  it doesn't (`npm run` lists `build`/`start*`/`test*`/`prisma:generate` only, no ESLint config
  exists in that package). Worth the Advisor's attention on how order text drifts from its own
  cited sources between drafting and execution — same general shape as L11 (self-contradicting
  order metadata), but on body content rather than the header status field.
  **(46, NEW)** THB production account-requirements fixture (File 9 of `4a-w3a-…`) still not
  fetched — the configured `WISE_API_TOKEN` confirmed sandbox-only (live `401 invalid_token`
  against `api.wise.com`), Davin deferred rather than provide a production-scoped token this
  session. Needed before `4A-W3a` can be called fully done; not currently blocking `4A-W3b`
  (UI work doesn't need the fixture) or `4A-W4`.
  **(47, NEW — revisits #43's own plan assumption)** The full sandbox GBP recipient-creation
  E2E proof (`4a-w3a-…`'s own Done-when item) is **not achieved** — confirmed live,
  `POST /v1/accounts` 403s "unauthorized" with the current read-only-scoped token, isolated via
  a direct call to Wise sandbox (not a code bug). **#43's plan ("read-only token sufficient for
  4A-W1/W3/W5") assumed recipient creation doesn't need write scope — this session found that
  assumption is wrong**: Wise's own permission model treats `POST /v1/accounts` as a write
  operation, distinct from reads (`GET /v1/profiles`, `GET /v1/account-requirements` both
  worked fine with the same token). Worth the Advisor rechecking whether `4A-W5` (webhook
  receiver — receive-only, likely still fine) is affected by the same assumption before it
  runs. Needs a write-scoped (still sandbox, zero real money) `WISE_API_TOKEN` to close.
  **(48, NEW)** `refreshRequirementsOnChange` (quote-scoped field-refresh) is built and unit
  tested but not proven against a real live quote — this session's `GET requirements` uses
  the discouraged non-quote-scoped Wise fallback (fixed this session, `f100296a`, now
  confirmed working live) specifically to avoid building quote-creation
  (`POST /v3/profiles/{id}/quotes`), which isn't in `4a-w3a-…`'s own 10-file scope. A future
  session (likely `4A-W3b` if the form needs live field-refresh, or `4A-W6`) needs to either
  build quote creation or confirm the non-quote-scoped path is good enough long-term.
  **(49, NEW — needs a decision)** `part19.5-wise-disbursement-openapi.yaml`'s `POST
/wise/recipients` description says replacing an existing recipient should archive the old
  row, not mutate it — `AffiliateWiseRecipient.affiliateProfileId` is `@unique` in the schema
  frozen at 4A-W2, so `4a-w3a-…`'s `createRecipient` upserts in place instead (schema change
  is out of scope for a PORT session). Needs Davin/Advisor to pick one: accept upsert
  semantics and fix the OpenAPI text, or schema-change to support archive-and-recreate.
  **(51, NEW)** `GET /v1/wise/recipients` (admin list)'s live response has no affiliate-name
  field at all — `wise-recipients.controller.ts`'s `list()` returns raw `AffiliateWiseRecipient`
  rows (not `toSummaryDto()`-mapped), and neither shape carries a joined affiliate display name.
  `4a-w3b-…`'s admin page renders `accountHolderName` (the bank recipient's own name) plus a
  truncated `affiliateProfileId` instead — not a security issue (no raw bank details either
  way, F41), just a UX gap. A future session could add a small enrichment join (money-service
  or the monolith's own Prisma) if admins need to search/identify by affiliate name specifically.
  **(50, NEW)** `railway up` CLI is unreliable for `money-service` from this checkout — 413
  payload-too-large without `--path-as-root` (can't resolve `.gitignore` from the
  subdirectory), "Failed to read app source directory" with it (likely a Root Directory
  dashboard-setting mismatch, not inspectable via this CLI version). Working path found and
  used this session: `git push origin main` (money-service has a connected GitHub source,
  auto-deploys cleanly). New `LESSONS-LEARNED.md` L23. Worth Davin checking the Railway
  dashboard's Root Directory setting for `money-service` directly if `railway up` is ever
  needed again (e.g. for a deploy that shouldn't go through a git push).
  **(52, NEW)** 4A-W4's idempotency audit (Step 1) found no idempotency key at all on 3
  customer/admin-facing money write endpoints: Stripe checkout session creation
  (`app/api/checkout/route.ts`), dLocal payment creation
  (`app/api/payments/dlocal/create/route.ts`), and admin code distribution
  (`app/api/admin/affiliates/[id]/distribute-codes/route.ts`) — a double form-submit or retry on
  any of these creates a duplicate row/session/code batch (full detail and exact line citations
  in `4a-w4-…`'s Deviations). Explicitly out of scope to fix this session (stays 4A-8's job per
  this order's own scope rule) — flagging so 4A-8 has the full list rather than re-discovering
  it. Separately, the same audit found Plan §13's own dedupe template
  (`RiseWorksWebhookEvent`) carries no unique constraint on its `hash`/`signature` fields — only
  `WiseWebhookEvent.deliveryId` does — so 4A-W5 should build the new Wise webhook receiver on
  `WiseWebhookEvent`'s pattern, not RiseWorks's (already reflected in
  `01-...architecture-design.md` §8.0 and `4a-w5-…`'s own PRE-DRAFT, this session's close).
  **(47, updated Session 4A-W5)** The write-scoped-sandbox-token gap now also blocks 4A-W5's own
  verification depth, not just 4A-W3a's recipient-creation E2E: Wise's Simulation API requires a
  **funded** transfer before state simulation, and a funded transfer needs a recipient
  (`POST /v1/accounts`, still 403-blocked on the read-only token per this item). 4A-W5 worked
  around this with hand-constructed RSA-signed test payloads (Davin's Option 2) rather than
  real Wise sandbox captures — genuinely proves the signature/dedupe/reduction code paths, but
  not that Wise's real Simulation API produces byte-identical payloads. Still needs a
  write-scoped (sandbox, zero real money) `WISE_API_TOKEN` to close for good. **(53, NEW)**
  4A-W5's own order text disagreed with its own cited ground truth in FOUR separate places
  within a single order (throttle decorator, state-mapping table completeness, a
  non-existent `CommissionStatus` enum value, a non-existent `WiseBatchGroup` field name) — a
  more severe recurrence of the class #45 first flagged (order text drifting from its own cited
  sources between drafting and execution). All four were caught by re-reading the actual design
  doc sections and Prisma schema before writing code, not by the order's own CONFIRM checklist.
  Recorded as `LESSONS-LEARNED.md` **L27**. Worth the Advisor's attention on whether order
  drafting should diff against the cited ground truth sections automatically, since this is now
  a repeat-offender pattern rather than a one-off. **(54, NEW — CRITICAL, blocks 4A-W7)**
  `DISBURSEMENT_PROVIDER=WISE` is not actually constructible yet. Verified live at 4A-W6's close:
  `money-service/src/disbursement/providers/provider-factory.ts` has no `case 'WISE'` (only
  `'MOCK'`, and a `throw` for `'RISE'`); `disbursement.constants.ts`'s `SUPPORTED_PROVIDERS` and
  `getDefaultProvider()` don't recognize `'WISE'` at all, so `getDefaultProvider()` would silently
  keep returning `'MOCK'` even with the env var set to `'WISE'`. Design §8.1's own file-inventory
  table names these two files (plus `disbursement.types.ts`) as needing a `'WISE'` entry; none is
  in 4A-W6's own 8-file order, and none was touched this session — wiring it properly needs real
  DI-construction surgery (`WisePaymentProvider` has 7 injected collaborators a bare `new` can't
  resolve), not an additive fix. Combined with item below, this means 4A-W7's own literal cutover
  checklist ("flip `DISBURSEMENT_PROVIDER=MOCK → WISE`, redeploy, smoke payout") would currently
  do nothing observable — no error, batch still reports green, zero real money moves. 4A-W7's own
  PRE-DRAFT carries this as a new, hard-blocking Entry criterion 0. **(55, NEW)** A genuine
  pre-existing bug, found (not fixed) while building 4A-W6's first-ever real test of the
  Mock-provider code path: `MockPaymentProvider.sendPayment()` mints its own random
  `transactionId` instead of echoing back the caller's `PaymentRequest.metadata.transactionId`, so
  `payment-orchestrator.service.ts`'s existing (unmodified) result-matching
  (`pendingTransactions.find(t => t.transactionId === paymentResult.transactionId)`) can never
  succeed for `MOCK` — every "successful" Mock payment is silently skipped (logged via
  `console.error`, not thrown), yet the batch still reports `success: true` and gets marked
  `COMPLETED`. Since `DISBURSEMENT_PROVIDER` stays `MOCK` in production throughout Part 19.5
  specifically as a no-real-money safety rail, this may be accidentally desirable behavior (a
  "fixed" matcher would start marking commissions `PAID` in production under a provider that sends
  nothing) — needs a deliberate Davin/Advisor decision, not a drive-by fix inside an unrelated
  session. Full detail on both in `4a-w6-…`'s own Deviations.
- **Next session:** Davin's call, per `4a-w6-…`'s own Next-session-handoff note.
  `4a-w7-wise-cutover.migration-order.md` (REAL MONEY CUTOVER, VERIFY-RETIRE variant) is
  PRE-DRAFTed at status `PRE-DRAFT` — carries a NEW **Entry criterion 0** that must close before
  the order can proceed at all (Waiting-on #54: the `DISBURSEMENT_PROVIDER` flip mechanism isn't
  wired yet). Requires Davin present for every step once it does proceed
  (`EXECUTOR-PROTOCOL.md` §7). Carry forward from 4A-W4: the 3-endpoint idempotency gap (#52) and
  `RiseWorksWebhookEvent`'s missing unique constraint stay flagged for 4A-8, not blocking. Carry
  forward from 4A-W3a/4A-W5: THB production fixture still needed (#46); the write-scoped sandbox
  `WISE_API_TOKEN` gap (#47) is unresolved — 4A-W6 worked around it (Option 2, RSA-signed test
  payloads) rather than closing it, so 4A-W7 needs a real production-scoped token regardless
  (different token, per §7.2's two-tokens-promoted-per-session plan); the OpenAPI's
  archive-vs-upsert conflict on recipient replacement needs a decision (#49); `railway up` stays
  unreliable for money-service, use `git push origin main` (#50, L23); the admin list's missing
  affiliate-name field is a minor UX gap, not blocking (#51). Separately, unchanged from prior
  sessions: a future RETIRE
  session can delete the monolith's now-orphaned `app/api/affiliate/dashboard/*`,
  `app/api/admin/{affiliates,analytics}/*` routes and their `lib/` logic once Davin agrees
  Slice 3 (4A-7b) has been stable long enough — not yet scheduled. `4A-5-RW` (RiseWorks) stays
  REVOKED (Waiting-on #37), not pending. `Session 6-1` (Phase 6 Gap Matrix,
  `docs/migration-orders/6-1-gap-matrix-f11.migration-order.md`) was PRE-DRAFTed at 5-4's
  close, a separate track — Davin to decide ordering against Slice 4 (4A-8), the
  Slice-3-RETIRE session, and the now-active `4A-W*` series.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · **F19 fully RESOLVED (Session
  2-1)** — audit + bump + codemods + production deploy, all verified · **F20 fully
  RESOLVED (Session 2-3)** — migration history baselined, `drop_watchlists`
  strip-and-orphaned per Davin, FK audit applied to production · **F4 fully
  RESOLVED (Session 2-2)** — model census, 1 market + 26 non-market + `RefreshToken`
  stub · **F5 fully RESOLVED (Session 2-4)** — split clients live in production code,
  every consumer repointed, old schema retired · **F21 OPEN** (24h Account-Deletion
  GDPR gap — requires Davin's product decision on hard-delete vs anonymize, scheduled
  for a future session) · **F22 fully RESOLVED (Session 2-4)** · **F6 fully
  RESOLVED (Session 3-1)** — bridge-first confirmed, the 3 "missing" reference docs
  found but explicitly disregarded (superseded OpenAuth seed material) · **F7 fully
  RESOLVED (Session 3-1)** — Path B (`JwtAuthGuard` decrypts NextAuth's JWE
  directly), proven via a real round-trip before the guard was built · **F23 fully
  RESOLVED (Session 3-2)** — `RefreshToken` hardened (hashed-at-rest via SHA-256,
  revocable, `userAgent`/`ipAddress`), applied to production as a pure `CREATE
TABLE` (the table never actually existed before) · **F24 fully RESOLVED (Session
  3-2)** — `/auth/login` issues NextAuth-compatible JWEs, same format `JwtAuthGuard`
  already verifies · **F25 fully RESOLVED (Session 3-3)** — test locally + deploy
  directly to production, Davin's call; a repeatable local-testing recipe now exists
  (L31/L32) · **F26 fully RESOLVED (Session 3-3)** — reuse NextAuth's exact cookie
  (corrected to the real per-environment name/attributes at CONFIRM, not the
  Decision Log's dev-mode shorthand) · **F27 fully RESOLVED (Session 3-3)** — defer
  `/auth/register` routing until email-sending is ported, unchanged from Davin's
  call · **F28 fully RESOLVED (Session 3-4)** — continue the F25 local-testing
  precedent, using real Resend API keys · **F29 fully RESOLVED (Session 3-4)** —
  port `lib/email/email.ts` in full into operation-service · **F30 fully RESOLVED
  (Session 3-4)** — CORS confirmed unnecessary, server-side proxying continues ·
  **F31 fully RESOLVED (Session 3-5)** — SVC_TOKEN leg descoped, pure VERIFY-RETIRE
  for SSR + browser legs · **F32 fully RESOLVED (Session 3-5)** — Davin set both
  missing Railway env vars, confirmed live at CONFIRM · **F33 fully RESOLVED
  (Session 3-5)** — production check completed same-session against the live
  Vercel URL, NextAuth confirmed unregressed, no outstanding items · **F15 fully
  RESOLVED (Session 4A-1, Davin)** — money-service reuses the existing shared
  Railway Redis instance, `op.*`/`money.*` namespaces, not a dedicated instance ·
  **F16 fully RESOLVED (Session 4A-1, Davin)** — public URL scheme
  `<api.domain/v1 + money.domain/v1>` · **F34 fully RESOLVED (Session 3-5, Davin)** —
  reuse the existing "postgre for staging" Railway project whenever CC-A's staging
  gap is actually addressed (base Postgres/Redis already provisioned there; nothing
  else built yet) · **F35 fully RESOLVED (Session 4A-2, Davin) — cutover EXECUTED
  Session 4A-3** — money-service crons Slice 1's shadow-run mechanism given F34/CC-A
  isn't ready: `CRON_ENABLED` gate + manual-trigger verification, not a literal parallel
  staging run; 4A-3 flipped the gate and emptied `vercel.json`'s crons, Slice 1 is now
  CUT-OVER (monitoring caveat, Waiting-on #36) ·
  **F36 fully RESOLVED (Session 4A-W1, Davin)** — Wise integration Model A (Business +
  personal API token); funding stays `MANUAL` regardless (Thailand region gate) ·
  **F37 fully RESOLVED (Session 4A-W1, Davin)** — `WISE_FUNDING_MODE=MANUAL`, Thailand not on
  Wise's API-funding allowlist ·
  **F38 fully RESOLVED (Session 4A-W2, Davin)** — Option A, platform bears the Wise fee
  (`feeBearer = 'PLATFORM'`), affiliates receive their exact earned commission ·
  **F39 fully RESOLVED (Session 4A-W3a, Davin)** — Option A, affiliate self-service form (`/affiliate/settings/payout`), admin views summary ·
  **F40 fully RESOLVED (Session 4A-W5, Davin)** — Profile-level subscription
  (`WISE_WEBHOOK_SCOPE = 'PROFILE'`), following Model A ·
  **F41 fully RESOLVED (Session 4A-W3a, Davin)** — Option A, Wise-managed PII; store only `accountTail` last 4 digits and `detailsFingerprint` SHA-256 hash ·
  **F42 fully RESOLVED (2026-07-25, Davin; recorded 4A-W1)** — RiseWorks archived, not
  deleted: dormant in repo AND database, restorable per `replace-rise-with-wise/03-…` ·
  **F43 fully RESOLVED (Session 4A-W6, Davin)** — Option (a), Resend REST called directly from
  money-service (native `fetch`, no new dependency); needs `RESEND_API_KEY` +
  `WISE_FUNDING_ALERT_EMAIL` added to money-service's Railway env before it actually delivers
  (confirmed absent this session) ·
  F8–F14 OPEN (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

# Migration Order — Session 4A-13 — Stripe Webhook Cutover (Slice 4 remainder)

> For **cutovers, deletions, and exit reviews**: read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **near zero**. PRE-DRAFTed by the Executor at Session 4B-22's close
> (Phase 4 Exit Review, 2026-08-04), upgraded to DRAFT by the Advisor (2026-08-21).
> Closes `DECISION-LOG.md` **F60** (OPEN) and advances `migration-cutover-table.md` Slice 4.

**Session:** 4A-13 (Stripe Webhook Cutover) · **Variant:** VERIFY-RETIRE (CUTOVER block) ·
**Status:** CONFIRMED, executed, CLOSED SUCCESSFUL 2026-08-21
**Generated:** 2026-08-04 (Executor, PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-21 (Advisor) · **Approved:** 2026-08-21 (Davin) · **Confirmed & closed:** 2026-08-21 (Executor)
**Flags touched:** F60 (OPEN → RESOLVED), F75 (new, found + RESOLVED same session)
**Estimated time:** ~1–2h (verification, live test payload, dashboard repoint, live delivery observation)
**Target service:** `money-service` (`StripeWebhookController` / `StripeWebhookService` at `POST /v1/webhooks/stripe`) + Stripe Dashboard Webhook configuration (external repoint)

---

## Decisions taken

> Four technical choices made by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 / `DECISION-LOG.md` PD1.
> Items touching real money movement, secrets, and production cutover carry **`⚠ NEEDS EXPLICIT SIGN-OFF`**.

1. **Dual-endpoint shadow window vs. single-step repoint `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Register money-service's webhook URL (`https://money-service-production.up.railway.app/v1/webhooks/stripe` or custom domain) as an additional, concurrent endpoint in Stripe's dashboard alongside the monolith, test with a synthetic event, and observe at least one real production lifecycle event (or soak for 24h) before removing the monolith endpoint.
   - **Rejected:** Immediate hard cutover (deleting/repointing the monolith URL in a single step with zero dual-delivery verification).
   - **Why:** Stripe natively delivers events to all registered active endpoints. Dual-delivery provides zero-downtime shadow verification where money-service's business logic, idempotency, and Outbox event emissions are proven under real traffic while the monolith maintains operational continuity.
   - **How hard to undo:** Trivial — delete or disable the money-service endpoint in Stripe Dashboard.

2. **Per-endpoint signing secret generation and value-blind verification `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Davin registers the new endpoint in Stripe Dashboard to generate a new signing secret (`whsec_...`), then sets `STRIPE_WEBHOOK_SECRET` on money-service's Railway production environment. The Executor verifies variable existence value-blind per `LESSONS-LEARNED.md` L17 (no logging/printing secret values).
   - **Rejected:** Reusing the monolith's existing `STRIPE_WEBHOOK_SECRET`.
   - **Why:** Stripe generates a unique HMAC signing secret per webhook endpoint URL. The monolith's signing secret will cryptographically fail on all payloads sent to money-service's endpoint (producing 100% 400 signature verification failures).
   - **How hard to undo:** Trivial — update or remove the environment variable in Railway.

3. **Concrete definition of "first real event proven" `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Proof requires all four of: (a) Stripe Dashboard delivery log for money-service URL shows HTTP `200 OK` with response payload `{"received":true}`; (b) `money-service` Railway runtime log shows `[Webhook] Received event` with matching event type and no signature/handler errors; (c) HTTP access log records `POST /v1/webhooks/stripe 200`; (d) Database / state inspection confirms the expected atomic state write (e.g. `User.tier`, `Subscription` row, or `OutboxEvent` row created).
   - **Rejected:** Relying solely on HTTP 200 status code without log/state verification, or assuming functionality from static tests.
   - **Why:** Protects real customer tier access and billing states. Matches `LESSONS-LEARNED.md` L18 ("never trust the response body alone").
   - **How hard to undo:** Pure verification gate; non-destructive.

4. **Monolith webhook handler preservation for instant rollback `⚠ NEEDS EXPLICIT SIGN-OFF`**
   - **Chosen:** Monolith `app/api/webhooks/stripe/route.ts` and `lib/stripe/webhook-handlers.ts` remain 100% intact, deployed, and unmodified in the codebase.
   - **Rejected:** Deleting or stubbing out the monolith handler in this session.
   - **Why:** The monolith handler is the verified rollback target (mirroring the dLocal 4A-5 precedent). If money-service encounters degradation, Davin can immediately re-enable/re-point the monolith endpoint in Stripe Dashboard without any code redeploy. Deletion of the monolith route is deferred to Phase 8A (Session 8-1 Decommission).
   - **How hard to undo:** Trivial — files remain in git HEAD.

---

## Why this session exists

The migration implementation plan (§6, Phase 4 Slice 4) explicitly scopes: "Write APIs **+ Stripe webhook** (rollback: flip back)." Sessions 4A-9/10/10b/10c migrated Stripe checkout, subscription cancel, admin code distribution, and disbursement batch execution — but the Stripe **webhook receiver** was never cut over.

`app/api/webhooks/stripe/route.ts` remains 100% monolith-native (raw body read, `constructWebhookEvent`, and `lib/stripe/webhook-handlers.ts`). Meanwhile, `money-service`'s `StripeWebhookController` and `StripeWebhookService` (built in Session 4A-9 on 2026-07-27) have been deployed and dormant for 25 days, never receiving live traffic. No in-code feature flag exists for this route; the Stripe Dashboard endpoint registration is the cutover mechanism (matching the dLocal 4A-5 precedent).

This session executes the cutover, validates real event handling, closes `DECISION-LOG.md` **F60**, and advances Slice 4 in `migration-cutover-table.md`.

---

## Entry criteria

- [x] `DECISION-LOG.md` **F60** reviewed directly — confirmed OPEN, scope unchanged, at CONFIRM.
- [x] **Git drift check re-measured live**:
      `git log --oneline 37700b51..HEAD -- lib/stripe/ app/api/webhooks/stripe/ money-service/src/stripe/`
      returned 2 commits, neither a real drift: `48e12a87` is the same-session tail commit of the
      4A-9 port itself (module registration, same calendar day, "Zero traffic cutover" per its own
      message); `86ef2299` (Session 6-8) only touched `stripe-checkout.controller.ts`'s
      `successUrl`, not webhook logic. The actual webhook-handler files (`lib/stripe/
webhook-handlers.ts`, `money-service/src/stripe/stripe-webhook.{controller,service}.ts`) are
      byte-unchanged since 2026-07-27 (confirmed via `git log` per-file). Zero real drift.
- [x] **Codebase test baselines re-measured at CONFIRM**: monolith `tsc --noEmit` clean;
      `eslint app components lib hooks --max-warnings 0` → 0 errors, 5 pre-existing warnings;
      `test:ci` **160/160 suites, 2399/2399 tests** — exact match to Session 7-3's closing
      baseline. `money-service`: **62/62 suites, 522/522 tests** clean (isolated re-run; one
      timeout on `prisma.shutdown.spec.ts` when run in parallel with the monolith suite was
      resource contention, L24, not a regression).
- [x] **Live "before" baseline established**: Davin confirmed live that production Stripe webhook
      events were reaching the monolith at CONFIRM time.
- [x] **Davin present and available**: present throughout — dashboard registration, secret
      rotation, Money-Audit, cutover authorization, real-event trigger, and the incident fix below
      were all his own live actions.
- [x] **Value-blind secret check (`LESSONS-LEARNED.md` L17)**: `STRIPE_WEBHOOK_SECRET` key
      presence confirmed on `money-service` Railway production via `railway variables --kv | cut
-d'=' -f1` (key names only, value never displayed). Davin separately rotated it to the new
      per-endpoint secret when he registered the dashboard endpoint; correctness proven
      functionally by both the synthetic test and the real event's signature verification
      succeeding — value itself never seen by the Executor at any point.
- [x] **Scope isolation confirmed**: dLocal and Wise/outbox untouched throughout.

---

## Checklist

**CUTOVER block**

1. ✅ **Register money-service webhook endpoint in Stripe Dashboard (Dual-delivery configuration)**:
   Davin registered `https://money-service-production.up.railway.app/v1/webhooks/stripe` as a
   second, concurrent Stripe endpoint; obtained its endpoint-specific signing secret and set
   `STRIPE_WEBHOOK_SECRET` on money-service's Railway production; redeployed (confirmed
   Online, route mapped in boot logs). Value-blind throughout — Executor never saw the secret.

2. ✅ **Synthetic test verification (Option B, not Dashboard UI)**:
   Stripe Workbench's "Send test event" required the Stripe CLI per Davin's live observation; the
   CLI wasn't installed and its browser-pairing login isn't completable non-interactively here.
   Davin explicitly authorized a self-signed synthetic `checkout.session.completed` payload
   instead: `STRIPE_WEBHOOK_SECRET` injected only into a short-lived Node subprocess's environment
   via `railway run` (never printed/logged), used in-memory to compute the HMAC signature, payload
   deliberately carried no real `userId` so the handler's own guard guaranteed a safe no-op.
   Result: HTTP 200, `[Webhook] Received event type="checkout.session.completed"`, no signature
   errors, guard fired as designed, zero DB writes. See Deviations.

3. ✅ **Davin Money-Audit & Cutover Authorization**:
   Full write-path/idempotency/crash-recovery walkthrough given (every write path's transaction
   boundary, idempotency mechanism, and dies-halfway behavior for all 5 event types — see this
   session's chat record). Davin authorized the cutover after review.

4. ✅ **Production observation** — with a real incident and fix in between (see Deviations):
   Davin's real test-mode Stripe Checkout produced a genuine `checkout.session.completed` event.
   First delivery + Stripe's automatic retry both **failed** (`42501: permission denied for table
"User"` — new finding, `DECISION-LOG.md` **F75**). Davin authorized and specified the exact
   GRANT fix; Executor applied and verified it; Davin resent the event from Stripe Dashboard.
   **Retry succeeded cleanly**: HTTP 200, `[Webhook] User upgraded to PRO`, and direct read-only DB
   verification confirmed `User.tier='PRO'`, `Subscription` `ACTIVE` with correct Stripe IDs, and
   an `OutboxEvent(TIER_UPGRADED)` row — all four of Decision #3's proof points satisfied.
   **Monolith endpoint NOT disabled this session** — see Deviations 8; deliberately deferred to
   Davin, one extra real-traffic cycle first.

5. ✅ **Session Close-out & Governance records** — this pass: `migration-cutover-table.md` Slice 4
   row moved; `DECISION-LOG.md` F60 → RESOLVED, F75 registered and RESOLVED; `CLAUDE.md` updated;
   `LESSONS-LEARNED.md` L33 added; Session 4A-14 PRE-DRAFTed.

---

## Rollback

- **Rollback procedure:**
  1. In Stripe Dashboard, immediately re-enable / re-add the monolith webhook endpoint URL (`https://<monolith-domain>/api/webhooks/stripe`).
  2. Disable or delete the `money-service` webhook endpoint URL in Stripe Dashboard.
  3. Verify monolith logs show resumption of `[Webhook] Received event`.
- **Zero code changes required:** Monolith handler `app/api/webhooks/stripe/route.ts` remains intact and deployed throughout this session.

---

## Rules specific to this variant

- **Dial near zero:** Observation, dashboard configuration, and verification only. No speculative code changes or drive-by refactoring.
- **Do not edit `lib/stripe/webhook-handlers.ts` or monolith webhook routes:** Any discovered logic drift or bug is a finding that halts cutover and requires a separate PORT/fix order.
- **Value-blind secret handling (`LESSONS-LEARNED.md` L17):** Never echo, log, or commit Stripe signing secrets.
- **Any failure = stop and revert immediately:** Do not leave an unverified endpoint receiving live payments.

---

## Deviations

1. **L3/L11 pattern recurred**: order arrived with the full DRAFT→APPROVED upgrade (`Decisions
taken`, rewritten entry criteria/checklist) uncommitted over committed HEAD's bare PRE-DRAFT
   stub. Reported before CONFIRM proceeded; Davin confirmed live it was his authentic edit,
   corroborated independently — `HANDOVER-PROMPT-phase-4X.md` (also uncommitted, same batch)
   reproduces the exact `[B]` command Davin's opening chat message sent verbatim, including its
   closing sentence.
2. **Git-drift entry criterion's literal command is non-empty but non-drifting**: `git log
--oneline 37700b51..HEAD -- lib/stripe/ app/api/webhooks/stripe/ money-service/src/stripe/`
   returns 2 commits, not 0 — `48e12a87` (same-session tail commit of the 4A-9 port itself) and
   `86ef2299` (Session 6-8, `successUrl` only). Zero real webhook-logic drift; corrects
   `CLAUDE.md`'s own prior "zero commits since 37700b51" citation to "zero commits with real logic
   changes."
3. **Money-Audit performed and disclosed two pre-existing, non-blocking findings**, both
   byte-identical between monolith and money-service (not migration-introduced, not fixed this
   session per the variant's own "no drive-by fixes" rule): (a) `handleCheckoutCompleted`/
   `handleInvoiceSucceeded` compute the next billing period from wall-clock time at call time
   rather than Stripe's own period-end field — a delayed duplicate delivery would extend paid-
   through date again, not double-charge; (b) `handleSubscriptionUpdated` is not `$transaction`-
   wrapped, so a crash between its two writes could leave subscription status updated without the
   paired tier downgrade; (c) `invoice.payment_succeeded` is outside the controller's `isCritical`
   bucket, so a handler error there still returns `200` and suppresses Stripe's retry. Worth a
   dedicated future PORT/fix session; not registered as a new flag since it changes nothing about
   this cutover's own scope or risk (same behavior, same risk, both before and after the repoint).
4. **Stripe Workbench's "Send test event" required the CLI**, per Davin's live observation; not
   installed, and its browser-pairing login isn't completable non-interactively here. Davin
   explicitly authorized (Option B) a self-signed synthetic `checkout.session.completed` payload
   instead: `STRIPE_WEBHOOK_SECRET` injected only into a short-lived Node subprocess's environment
   via `railway run --service money-service` (never printed/logged/committed anywhere), used
   in-memory to compute the HMAC signature, then discarded; payload deliberately carried no real
   `userId` so the handler's own guard (`stripe-webhook.service.ts:65-70`) guaranteed a safe no-op
   regardless of outcome. Proved signature verification, dispatch, and the guard rail; produced
   zero DB writes by design.
5. **Real production incident, found live via the real-event proof itself**: Davin's genuine
   test-mode Stripe Checkout produced a real `checkout.session.completed` delivery. Both the
   initial delivery and Stripe's automatic retry **failed** with `Database error. Code: 42501.
Message: permission denied for table "User"`. Root cause: money-service's `money_svc` Postgres
   role (`prisma.service.ts`'s own header comment names it a deliberately narrower role than the
   monolith's) had never been granted `UPDATE` on `User`. This was invisible until this exact
   moment — `StripeWebhookController`'s write path had never executed against real production
   credentials before (built Session 4A-9, dormant 25 days; Davin's own words opening this session:
   "has never received a single real event"). Registered as new `DECISION-LOG.md` **F75**.
6. **F75 fix, Davin-directed and Davin-authorized explicitly**: Davin specified the exact SQL
   (`GRANT SELECT, UPDATE ON "User" TO money_svc; GRANT SELECT, INSERT, UPDATE ON "Subscription",
"OutboxEvent", "Payment", "AffiliateCode", "AffiliateProfile", "Commission" TO money_svc;`).
   Executor applied it via a scoped script using Postgres's own connection (value handled
   in-memory only via `railway run`, never printed), then independently verified via direct
   `information_schema.role_table_grants` introspection — confirmed `User` gained exactly
   `SELECT, UPDATE`; the other six tables already held broader grants (only `User` was actually
   missing, consistent with the error only ever naming `User`). A prior attempt to read the same
   DB state read-only, before Davin gave the exact fix, using the same elevated connection was
   blocked by the platform's own auto-mode safety classifier — reported to Davin rather than
   worked around; the classifier did not block the same class of action once Davin's direction was
   explicit and specific.
7. **Retry succeeded cleanly**: Davin resent the event from Stripe Dashboard. HTTP 200,
   `[Webhook] User upgraded to PRO` (`userId=cmkp6ftxd0000hr5xnjly47a3`), no errors. Direct
   read-only DB verification: `User.tier='PRO'`, `hasUsedFreeTrial=true`, `trialStatus=CONVERTED`;
   `Subscription` `ACTIVE`, correct `stripeCustomerId`/`stripeSubscriptionId`, `MONTHLY`/`$29`,
   period end `2026-09-20`; `OutboxEvent(TIER_UPGRADED)` created. All four of Decision #3's proof
   points satisfied on the real event.
8. **Monolith endpoint intentionally NOT disabled this session.** Checklist step 4 authorizes
   disabling it once a real event is proven — technically satisfied — but given a real, previously
   undetected defect was just found and fixed on the FIRST real write this route ever attempted,
   the Executor recommended (not unilaterally decided) observing at least one further clean real
   event before retiring the safety net, per L11's own pattern ("fixing the first bug can unmask a
   second"). Flagged to Davin as an open recommendation, not resolved as of this order's close —
   see the session close-out message.
9. **A synthetic and a real `checkout.session.completed` both landed in production `OutboxEvent`
   rows.** The synthetic test produced zero rows (guarded no-op, by design). The real event
   produced exactly one (`TIER_UPGRADED`), status `PROCESSED` — `OutboxPublisherCron` is gated off
   by default (`OUTBOX_PUBLISHER_ENABLED`, F14/Slice 5 not yet shipped); not investigated further
   as out of scope for this session, noted for whoever builds Slice 5.
10. **money-service `test` showed 1 flaky failure** (`prisma.shutdown.spec.ts`, a 5s-budget
    SIGTERM/shutdown test) when run in parallel with the monolith's own suite twice in this
    session (CONFIRM and CLOSE). Confirmed both times as resource contention (L24), not a
    regression, by an isolated re-run passing clean (~7-24s). Final baseline both times:
    money-service 62/62 suites, 522/522 tests; monolith 160/160 suites, 2399/2399 tests.

---

## Next-session handoff

- **Next session:** `4A-14` — dLocal Write-API Group B Cutover (Slice 4 completion, closing **F49**).
- **Variant:** PORT + CUTOVER.
- **Prerequisite:** 4A-13 CLOSED SUCCESSFUL.

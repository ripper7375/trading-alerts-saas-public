# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session, 8-1 deletion sweep,
> 8-5 close-out, phase-exit checks. Read `00-SKELETON-AND-RULES.md` first — §4 applies with
> the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10
> lines for a cutover). If executing it uncovers real work, STOP — that work gets its own
> session with the right variant.

> **Status: PRE-DRAFT** — written by the Executor at Session 4A-4's close, per
> `EXECUTOR-PROTOCOL.md` §3.5. Needs the Advisor to produce the DRAFT, then Davin's
> APPROVAL. No fast-path here (fast-path is only for a VERIFY-RETIRE whose PRE-DRAFT
> already looks CONFIRMABLE as-is — this one has two real open blockers, see Entry
> criteria).

**Session:** 4A-5 · **Variant:** VERIFY-RETIRE · **Status:** DRAFT
**Generated:** 2026-07-22 · **Estimated time:** <1h (if entry criteria hold)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 Slice 2 (of 5), CUTOVER half
**Target service:** money-service / dLocal + RiseWorks provider dashboards

## Why this session, why now

Session 4A-4 (this close) BUILT both webhook receivers (`POST /v1/webhooks/dlocal`,
`POST /v1/webhooks/riseworks`) into money-service and deployed them to Railway
production — but at unique paths neither provider's dashboard points at yet (Safety
Gate), so they carry zero live traffic. 4A-5 is the small, separate cutover session
that repoints each provider's webhook URL. Per the playbook, never combine BUILD and
CUTOVER — same reasoning 4A-2/4A-3 already established for Slice 1.

Unlike Slice 1's crons, this cutover has no dual-execution-path risk to gate against:
a payment provider only ever POSTs to the one URL configured in its dashboard, so
there is no `CRON_ENABLED`-style flag needed — the cutover moment IS the dashboard URL
change itself, and rollback is just reverting that URL.

## Entry criteria

- [ ] **`DLOCAL_WEBHOOK_SECRET` and `RISE_WEBHOOK_SECRET` are set on money-service's
      Railway production environment.** Confirmed NOT set as of 4A-4's close
      (`railway variables --kv`, Waiting-on #26) — every real signed request would
      currently fail verification. Davin to set both directly on Railway (this
      environment's standing policy: secrets are Davin's action, never
      generated/typed by the Executor).
- [ ] **At least one real signed test event per provider has been sent to the NEW
      money-service endpoint and produced the expected result**, per the playbook's own
      framing for this slice ("BUILD (replay tests with recorded signed payloads) then
      CUTOVER"). 4A-4's own deploy verification only proved the routes are registered
      and reject _unsigned_/_invalid-signature_ requests (400/401) — it did not exercise
      a real signed payload end-to-end (no secrets were set yet to do so). Use each
      provider's own dashboard "send test webhook" feature if available, or a
      Davin-provided recorded real payload + its real signature, POSTed by hand to
      `https://money-service-production.up.railway.app/v1/webhooks/<dlocal|riseworks>`.
      Confirm: correct DB writes (`Payment`/`Subscription`/`RiseWorksWebhookEvent`
      rows), and a second identical replay is idempotent (no duplicate processing).
- [ ] Davin present/available — cutovers require his live approval (per this variant's
      own standing rule).
- [ ] Money-service's production deploy is still the 4A-4 commit (or newer, but nothing
      that changed webhook logic without its own port order) — `railway logs`/`git log`
      cross-check before flipping.

## Checklist

**CUTOVER block**

1. Present the real-signed-payload verification evidence for both providers (Entry
   criteria above) — not a shadow-run diff in the traditional sense, closer to 4A-3's
   own manual-trigger precedent. Either missing → abort, this session cannot proceed.
2. Davin approves. His question ritual: "what's the rollback?" — answer: revert the
   provider dashboard's webhook URL back to the monolith's
   `https://<monolith-domain>/api/webhooks/<dlocal|riseworks>` — a dashboard-side
   config change, no money-service redeploy needed, no code flag to flip.
3. Flip, one provider at a time (not both simultaneously — confirm one is stable
   before touching the other):
   a. dLocal dashboard: update the webhook URL to
   `https://money-service-production.up.railway.app/v1/webhooks/dlocal` (or the
   custom domain, if bound by then — Waiting-on #27 still open as of 4A-4's close).
   b. Monitor for at least one real payment webhook to land correctly (Railway logs,
   no errors; `Payment`/`Subscription` rows updated as expected) before touching
   RiseWorks.
   c. RiseWorks dashboard: update the webhook URL to
   `https://money-service-production.up.railway.app/v1/webhooks/riseworks`.
   d. Monitor for at least one real disbursement event to land correctly.
4. Record: `migration-cutover-table.md` (Slice 2 row → CUT-OVER), CLAUDE.md,
   DECISION-LOG.md if any flag closes. Freeze (CC-F on
   `app/api/webhooks/{dlocal,riseworks}/route.ts` + their `lib/dlocal/*`/
   `lib/disbursement/*`/`lib/affiliate/conversion-processor.ts` logic) stays until the
   RETIRE session (later, separate — deleting the monolith's own copies is explicitly
   NOT this session's job, per this order's own "Retire" section below).

- **Rollback:** revert the provider dashboard's webhook URL back to the monolith route
  (dashboard-side config change only — instant, no redeploy, no data migration). Not
  pre-verified in a staging environment (none exists, CC-A/F34, same standing gap 4A-3
  noted) — the rollback mechanism itself is reasoned-about, not rehearsed.

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only. If the
  real-signed-payload verification reveals a genuine bug, STOP — that's a finding, gets
  its own BUILD-variant fix session, not a patch bolted onto this cutover.
- Any red result = stop and document, never "probably fine".

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

**2026-07-24 — out-of-band bugfix, explicit scoped exception (Davin, live in chat).**
Live Railway log inspection (real dLocal traffic hitting `/v1/webhooks/dlocal`, e.g.
2026-07-24T09:23:38.899Z, retried 10:23:38.891Z) surfaced a genuine bug ahead of this
order's own real-signed-payload verification step (Entry criterion #2):
`DlocalWebhookController` read the signature from an `x-signature` header dLocal never
sends (real signature arrives in `Authorization: V2-HMAC-SHA256, Signature: <hex>`),
and `verifyWebhookSignature()` HMAC'd only the raw body instead of dLocal's actual
`X-Login + X-Date + body` construction — every real signed webhook was failing
verification and being rejected with 400, dLocal was retrying.

Per this order's own "Rules specific to this variant" ("if the real-signed-payload
verification reveals a genuine bug, STOP — that's a finding, gets its own BUILD-variant
fix session, not a patch bolted onto this cutover"), this should by default have become
its own PRE-DRAFT→DRAFT→APPROVED→CONFIRMED session. Davin authorized fixing it directly
as an explicit, scoped exception in chat instead — same pattern as Session 4A-3's crons
exception — given it's a pure bugfix blocking this order's own Entry criterion #2 and
money/auth-adjacent (EXECUTOR-PROTOCOL.md §7 escalation). Also confirmed live: secret
precedence for `verifyWebhookSignature()` is `DLOCAL_SECRET_KEY` (dLocal uses one
merchant secret for both outbound signing and inbound verification, no separate webhook
secret per their docs) falling back to `DLOCAL_WEBHOOK_SECRET` — this order's own Entry
criterion #1 (`DLOCAL_WEBHOOK_SECRET` set on Railway by Davin) remains valid as the
fallback path.

**What changed:** `money-service/src/dlocal/dlocal-webhook.controller.ts` (read
signature + `X-Date`/`X-Login` from the real headers) and
`dlocal-payment.service.ts`'s `verifyWebhookSignature()` (HMAC over
`X-Login + X-Date + body`, `crypto.timingSafeEqual` comparison). Both spec files
updated to match — 34/34 tests pass, `tsc --noEmit` clean. Commit `8e681297`.

**Impact on this order:** does NOT itself satisfy Entry criterion #2 — a real signed
test event still needs to be sent and verified against the FIXED code before CUTOVER.
CONFIRM must re-verify that criterion live, against this new commit, not assume it from
this deviation note.

## Next-session handoff

_(DRAFT order for the RETIRE session — delete
`app/api/webhooks/{dlocal,riseworks}/route.ts` + their now-orphaned
`lib/dlocal/*`/`lib/affiliate/conversion-processor.ts`/
`lib/disbursement/providers/rise/webhook-verifier.ts`/
`lib/disbursement/webhook/event-processor.ts` source once this slice has been stable
in production for a Davin-agreed duration; update `migration-stack-analysis.md`'s
money-service file inventory accordingly. Not yet scheduled — depends on this
session's own stability window. Note: `lib/dlocal/constants.ts` and
`types/dlocal.ts` may still be needed by Slice 4's dLocal payment-creation
endpoints — check before deleting.)_

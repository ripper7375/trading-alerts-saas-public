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

**Session:** 4A-5 · **Variant:** VERIFY-RETIRE · **Status:** CONFIRMED (2026-07-24, live in chat — scope amendment approved, all 5 entry criteria re-verified against codebase + runtime state; see checkboxes and Deviations below)
**Generated:** 2026-07-22 · **Amended:** 2026-07-24 (Advisor, at Davin's request — RiseWorks is
unresponsive on webhook/API settings and blocking downstream Session-4 work; dLocal
credentials are already in hand)
**Estimated time:** <1h (if entry criteria hold)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 Slice 2 (of 5), CUTOVER half
**Target service:** money-service / **dLocal provider dashboard only this session** —
RiseWorks split out to a follow-up session (see Scope Amendment)

## Scope Amendment (2026-07-24, Advisor, pending Davin's approval)

Splitting Slice 2 into two independent cutover sessions instead of one combined one:

- **4A-5 (this session, amended): dLocal only.** Everything below (Entry criteria,
  Checklist) is narrowed to dLocal. RiseWorks's rows/steps are struck from this
  session's scope — not skipped, just moved out.
- **4A-5-RW (new, PRE-DRAFT, not yet written): RiseWorks only.** Opens once Riseworks
  replies with webhook/API settings. Tracked as a new Waiting-on item in CLAUDE.md
  until then. Reuses this order's original RiseWorks-specific Entry criteria and
  Checklist steps 3c-3d verbatim — nothing about RiseWorks's requirements changes,
  it's just deferred rather than blocking dLocal.

**Why this is safe to split:** the original checklist already treated the two
providers as independently-flippable ("one provider at a time — confirm one is stable
before touching the other," step 3). The only thing that changes is step 1's gate,
which required evidence for _both_ providers before either could flip. That combined
gate is what's removed — dLocal's own verification is unaffected by RiseWorks being
unavailable.

**What does NOT change:** money-service's RiseWorks route
(`POST /v1/webhooks/riseworks`) stays exactly as-is — deployed, registered, rejecting
unsigned/invalid-signature requests, zero live traffic, RiseWorks's dashboard still
pointed at the monolith. Nothing about it is touched, weakened, or exposed by cutting
dLocal over alone.

**Governance note — does not itself resolve:** CLAUDE.md's 2026-07-22 standing
instruction ("chain-length-one invoked... webhooks cut over FIRST, before 4A-7 or any
Slice 4 work") was written when Slice 2 meant _both_ providers. Davin narrowing that to
"dLocal-cutover-first is enough to unblock 4A-7; RiseWorks can trail" is itself a
standing-instruction change and needs to be recorded as one — see the chat response
for the exact language to confirm. This order does not assume that narrowing on its
own.

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

## Entry criteria (dLocal-only, per Scope Amendment above)

- [x] **`DLOCAL_WEBHOOK_SECRET` is set on money-service's Railway production
      environment.** Confirmed set via `railway variables --kv` this session (2026-07-24;
      value not reproduced in any artifact per standing secret-handling policy).
      (`RISE_WEBHOOK_SECRET` moves to 4A-5-RW — not required for this session.)
- [x] **At least one real signed test event for dLocal has been sent to the NEW
      money-service endpoint and produced the expected result.** Real dLocal webhook
      traffic (`2026-07-24T09:23:38.899Z`, retried `10:23:38.891Z`) initially failed
      against buggy signature-verification code (see Deviations — fixed in `8e681297`)
      and a latent replay/duplicate-notification bug (fixed in `1cc31b24`). Davin
      confirmed live in this session (2026-07-24) that a post-fix real signed webhook
      was verified against the corrected code: correct `Payment`/`Subscription` DB
      writes, and a second replay confirmed idempotent. (RiseWorks's equivalent moves
      to 4A-5-RW — not required for this session.)
- [x] Davin present/available — confirmed, live in this chat.
- [x] Money-service's production deploy is still the 4A-4 commit (or newer, but nothing
      that changed webhook logic without its own port order). Two webhook-logic changes
      did land since 4A-4's close (`8e681297`, `1cc31b24`) — both via the documented,
      live-escalated Deviation path below, not unreviewed drift; no other money-service
      commits since 4A-4 touch webhook/dlocal/riseworks code (verified via
      `git log 6861e86f..HEAD`).
- [x] **Davin has confirmed, live in this session, that the 2026-07-22 CLAUDE.md
      standing instruction ("webhooks cut over FIRST, before 4A-7") is narrowed to mean
      dLocal-cutover-first — not full Slice 2.** Confirmed live 2026-07-24: dLocal
      cutover alone satisfies the standing instruction; 4A-7/Slice 4 may proceed once
      dLocal (not RiseWorks) is cut over. RiseWorks trails independently via 4A-5-RW.
      CLAUDE.md's standing instruction should be updated to reflect this narrowing at
      session close.

## Checklist (dLocal-only, per Scope Amendment above)

**CUTOVER block**

1. Present the real-signed-payload verification evidence for **dLocal** (Entry
   criteria above) — not a shadow-run diff in the traditional sense, closer to 4A-3's
   own manual-trigger precedent. Missing → abort, this session cannot proceed.
   (RiseWorks evidence is not required and not gated on here — that's 4A-5-RW.)
2. Davin approves. His question ritual: "what's the rollback?" — answer: revert the
   provider dashboard's webhook URL back to the monolith's
   `https://<monolith-domain>/api/webhooks/dlocal` — a dashboard-side config change,
   no money-service redeploy needed, no code flag to flip.
3. Flip dLocal only:
   a. dLocal dashboard: update the webhook URL to
   `https://money-service-production.up.railway.app/v1/webhooks/dlocal` (or the
   custom domain, if bound by then — Waiting-on #27 still open as of 4A-4's close).
   b. Monitor for at least one real payment webhook to land correctly (Railway logs,
   no errors; `Payment`/`Subscription` rows updated as expected).
   c. ~~RiseWorks dashboard: update the webhook URL~~ — **out of scope this session,
   moved to 4A-5-RW.** RiseWorks's dashboard stays pointed at the monolith; its
   money-service route stays deployed-but-silent exactly as 4A-4 left it.
   d. ~~Monitor for at least one real disbursement event~~ — **moved to 4A-5-RW.**
4. Record: `migration-cutover-table.md` (Slice 2 row → status reflects **dLocal
   CUT-OVER / RiseWorks still MONOLITH**, not a blanket CUT-OVER — the row covers both
   providers, so its Notes column needs to spell out the split), CLAUDE.md (new
   Waiting-on item for 4A-5-RW, plus the standing-instruction narrowing from the Entry
   criteria above), DECISION-LOG.md if any flag closes. Freeze (CC-F on
   `app/api/webhooks/dlocal/route.ts` + `lib/dlocal/*` logic) stays until the RETIRE
   session — RiseWorks's own freeze/retire is untouched and separately tracked.

- **Rollback:** revert dLocal's dashboard webhook URL back to the monolith route
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

**2026-07-24 — second out-of-band bugfix, explicit scoped exception (Davin, live in
chat). Duplicate-Notification on webhook replay.**
Code-level review of `DlocalWebhookController.handlePaymentCompleted` (requested
directly in chat, ahead of Entry criterion #2's live real-payload test, as a safer
alternative to creating a real dLocal-sandbox payment against the shared production
database) found a second, independent bug: none of the top-level webhook-completion
side effects were guarded against replay. `Payment`/`Subscription`/`User.tier` writes
are all safe (idempotent upserts — `Subscription` keyed on unique `userId`; `Commission`
creation already self-guards via `ConversionProcessorService`'s
`affiliateCode.status === 'USED'` check), but `prisma.notification.create()` had no
existence check at all — every replay of an already-COMPLETED payment's webhook created
a second "Welcome to PRO!" `Notification` row for the user. Confirmed with a new mocked
(no live DB) replay test before fixing: two deliveries of the same payload produced
`notification.create` called twice against one `subscription.create` + one
`subscription.update`.

Same authorization pattern as the signature-verification fix above — explicit, scoped
exception authorized directly in chat rather than its own BUILD session, given it's a
pure bugfix discovered during this order's own verification work and money-adjacent
(EXECUTOR-PROTOCOL.md §7 escalation).

**What changed:** `money-service/src/dlocal/dlocal-webhook.controller.ts` —
`handlePaymentCompleted` now captures `alreadyCompleted = payment.status === 'COMPLETED'`
before its transaction runs, and gates the one-time completion side effects (3-day-plan
mark, affiliate-conversion call, notification creation) behind `!alreadyCompleted`. The
`Payment`/`Subscription`/`User.tier` transaction itself is unchanged — it was already
correctly idempotent. `PaymentRecord`'s local interface gained a `status: string` field
(the Prisma row already carried it; the interface just hadn't declared it). Two new
tests added to `dlocal-webhook.controller.spec.ts` covering the replay scenario and the
already-COMPLETED skip path. Full money-service suite: 260/260 pass, `tsc --noEmit`
clean.

**Known, deliberately untouched:** `app/api/webhooks/dlocal/route.ts` (the monolith) has
byte-identical logic and the same latent gap. Per this order's own CC-F freeze on that
file (see Next-session handoff below), it was NOT touched — it's slated for deletion at
the RETIRE session rather than a parallel fix, and dLocal's dashboard is not yet pointed
at it exclusively pending this order's cutover.

**Impact on this order:** does not touch Entry criterion #2's own requirement (a real
signed payload replay against money-service) — that live verification is still Davin's
to run. This fix only makes that eventual replay test (and any real-world webhook retry
after cutover) safe from creating a duplicate Notification row.

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

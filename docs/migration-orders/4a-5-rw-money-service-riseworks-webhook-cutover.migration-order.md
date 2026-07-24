# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**: every CUTOVER session, 8-1 deletion sweep,
> 8-5 close-out, phase-exit checks. Read `00-SKELETON-AND-RULES.md` first — §4 applies with
> the dial at **near zero**: checklists exist to be obeyed. Keep this order SHORT (~10
> lines for a cutover). If executing it uncovers real work, STOP — that work gets its own
> session with the right variant.

> **Status: PRE-DRAFT** — written by the Advisor 2026-07-24, split out of
> `4a-5-money-service-webhooks-cutover.migration-order.md`'s Scope Amendment (that order's
> RiseWorks-specific Entry criteria and Checklist steps 3c-3d, moved here verbatim, not
> rewritten). Needs Davin's APPROVAL once Riseworks actually replies with webhook/API
> settings — do not approve or execute before then.
>
> **Gate on DRAFT/APPROVAL (binding on the Advisor, not just a suggestion):** whichever
> session Davin brings this back to the Advisor in will have no memory of this one. Before
> moving this file's Status past PRE-DRAFT to DRAFT/APPROVED, the Advisor MUST have, in
> that conversation, either (a) the actual RiseWorks webhook/API settings Davin received
> (signature header format/scheme, v1-vs-v2 confirmation, and the real event schema —
> specifically whether events use `event` or `event_type`), or (b) Davin's explicit
> confirmation of those same points from what Riseworks sent. **If Davin says "approved"
> without that information present in the conversation, the Advisor must stop and ask for
> it — not approve blind, and not treat silence or a bare "approved" as sufficient.** This
> is a repeat of the exact gap Session 4A-6/4A-3 already flagged elsewhere in this repo
> (status claims outrunning verified evidence) — don't reproduce it here.

**Session:** 4A-5-RW · **Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT
**Generated:** 2026-07-24 (split from 4A-5) · **Estimated time:** <1h (if entry criteria hold)
**Phase / plan section:** Phase 4A — money-service, blueprint §5.5 Slice 2 (of 5), CUTOVER half
**Target service:** money-service / RiseWorks provider dashboard only

## Why this session, why now

4A-5 cut dLocal over alone (Scope Amendment, 2026-07-24) because Riseworks was
unresponsive on webhook/API settings and that was blocking downstream Session-4 work.
RiseWorks's own money-service route (`POST /v1/webhooks/riseworks`) has been deployed
since Session 4A-4 — registered, rejecting unsigned/invalid-signature requests, zero
live traffic, dashboard still pointed at the monolith. This session is the second half
of Slice 2, opened once Riseworks actually sends webhook/API settings back.

## Entry criteria

- [ ] **`RISE_WEBHOOK_SECRET` is set on money-service's Railway production
      environment.** Davin sets this directly on Railway himself once Riseworks sends
      it — standing policy: secrets are never generated/typed by the Executor, and the
      raw value must not be pasted into a Claude Code prompt or committed anywhere.
- [ ] **At least one real signed test event from RiseWorks has been sent to the NEW
      money-service endpoint and produced the expected result.** Use RiseWorks's own
      dashboard "send test webhook" feature if available, or a Davin-provided recorded
      real payload + its real signature, POSTed by hand to
      `https://money-service-production.up.railway.app/v1/webhooks/riseworks`. Confirm:
      correct DB writes (`RiseWorksWebhookEvent` rows, downstream
      `DisbursementTransaction`/`Commission`/`AffiliateProfile` updates), and a second
      identical replay is idempotent (no duplicate processing).
- [ ] **Known open question — verify, don't assume:** money-service's event processor
      (`webhook-event-processor.service.ts`) switches on a field named `event`
      (`webhookData.event`). Rise's own webhooks documentation (as of the 2026-07-23
      deck research) shows real v2 payloads using `event_type` instead — e.g.
      `"event_type": "payment.sent"`, not `"event": "payment.completed"`. This has
      **not** been confirmed against a real signed payload yet. If the first real test
      event confirms the field-name mismatch, that is a genuine bug, not a cutover
      task — per this variant's own rule below, STOP and open a BUILD session to fix
      `riseworks-webhook.controller.ts`'s parsing (`webhookData.event ||
    'unknown'`) and the processor's `switch (eventType)` before any cutover
      proceeds. Do not patch it inline here.
- [ ] Confirm which webhook spec version Riseworks is actually giving you (v1 vs v2 —
      both are referenced in their docs) and get the current event schema + signature
      header format directly from them, not assumed from documentation alone.
- [ ] Davin present/available — cutovers require his live approval (per this variant's
      own standing rule).
- [ ] Money-service's production deploy is still the 4A-4 commit (or newer, but nothing
      that changed webhook logic without its own port order) — `railway logs`/`git log`
      cross-check before flipping.

## Checklist

**CUTOVER block**

1. Present the real-signed-payload verification evidence for RiseWorks (Entry criteria
   above), including explicit confirmation the `event`/`event_type` field question is
   resolved one way or the other. Missing or unresolved → abort, this session cannot
   proceed.
2. Davin approves. His question ritual: "what's the rollback?" — answer: revert
   RiseWorks's dashboard webhook URL back to the monolith's
   `https://<monolith-domain>/api/webhooks/riseworks` — a dashboard-side config change,
   no money-service redeploy needed, no code flag to flip.
3. Flip RiseWorks:
   a. RiseWorks dashboard: update the webhook URL to
   `https://money-service-production.up.railway.app/v1/webhooks/riseworks`.
   b. Monitor for at least one real disbursement event to land correctly (Railway
   logs, no errors; `DisbursementTransaction`/`Commission`/`AffiliateProfile` rows
   updated as expected).
4. Record: `migration-cutover-table.md` (Slice 2 row → CUT-OVER, both providers now
   complete), CLAUDE.md (close out the 4A-5-RW Waiting-on item), DECISION-LOG.md if any
   flag closes. Freeze (CC-F on `app/api/webhooks/riseworks/route.ts` +
   `lib/disbursement/providers/rise/*`/`lib/disbursement/webhook/event-processor.ts`
   logic) stays until the RETIRE session.

- **Rollback:** revert RiseWorks's dashboard webhook URL back to the monolith route
  (dashboard-side config change only — instant, no redeploy, no data migration). Not
  pre-verified in a staging environment (none exists, CC-A/F34) — the rollback
  mechanism itself is reasoned-about, not rehearsed.

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only. If the
  real-signed-payload verification reveals a genuine bug (including the
  `event`/`event_type` question above), STOP — that's a finding, gets its own
  BUILD-variant fix session, not a patch bolted onto this cutover.
- Any red result = stop and document, never "probably fine".

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

_(Once both dLocal (4A-5) and RiseWorks (4A-5-RW) are CUT-OVER, Slice 2 as a whole is
complete — update `migration-cutover-table.md`'s Slice 2 row accordingly. RETIRE session
deletes `app/api/webhooks/{dlocal,riseworks}/route.ts` + their now-orphaned
`lib/dlocal/*`/`lib/affiliate/conversion-processor.ts`/
`lib/disbursement/providers/rise/webhook-verifier.ts`/
`lib/disbursement/webhook/event-processor.ts` source once stable in production for a
Davin-agreed duration; update `migration-stack-analysis.md` accordingly. Note:
`lib/dlocal/constants.ts` and `types/dlocal.ts` may still be needed by Slice 4's dLocal
payment-creation endpoints — check before deleting.)_

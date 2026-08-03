# Migration Order — Session 4A-13 — Stripe Webhook Cutover (Slice 4 remainder)

> For **cutovers, deletions, and exit reviews**: read `00-SKELETON-AND-RULES.md` first — §4
> applies with the dial at **near zero**. PRE-DRAFTed by the Executor at Session 4B-22's close
> (Phase 4 Exit Review), per that order's own explicit Rule ("if the audit finds a genuine gap
> requiring code changes... PRE-DRAFT a dedicated follow-up session for it"). Not anticipated by
> any prior session — `DECISION-LOG.md` **F60** (OPEN) is the finding this order exists to close.

**Session:** 4A-13 (Stripe Webhook Cutover) · **Variant:** VERIFY-RETIRE (CUTOVER block) ·
**Status:** PRE-DRAFT
**Generated:** 2026-08-04 (Executor, at Session 4B-22's close)
**Estimated time:** likely 1-2h (mostly verification — the receiving side has been fully built
since Session 4A-9, 2026-07-27, but has never been exercised against a real Stripe event; the
~8-day gap since it was built needs a fresh compatibility check before flipping anything live)
**Target service:** money-service (`StripeWebhookController`/`StripeWebhookService`, already
built) + Stripe's own dashboard webhook subscription (external repoint, not a code change)

## Why this session exists

The plan's own Phase 4 §6 text scopes Slice 4 explicitly as "Write APIs **+ Stripe webhook**
(rollback: flip back)." Sessions 4A-9/10/10a/10b/10c cut over Stripe checkout + subscription
cancel, dLocal create (blocked on F49), admin code distribution, and disbursement batch execute
— but the Stripe **webhook receiver** itself was never touched. `app/api/webhooks/stripe/route.ts`
is still 100% monolith-native (raw body read, `constructWebhookEvent`, the full
`lib/stripe/webhook-handlers.ts` tier/subscription/commission logic) — the exact code path that
processes every real Stripe subscription-lifecycle event in production today.

money-service's `StripeWebhookController`/`StripeWebhookService` (Session 4A-9) has been fully
built, deployed, and sitting completely dormant since 2026-07-27 — Stripe's own dashboard webhook
subscription was never repointed at it (unlike dLocal's explicit dashboard repoint at Session
4A-5), and no `MIGRATE_*`/`shouldUseMoneyServiceFor*` flag exists for this specific route anywhere
in the codebase (confirmed via grep, Session 4B-22).

This session closes `DECISION-LOG.md` F60. Found by Session 4B-22's Phase 4 Exit Review, a fresh
`app/api/**` census — not by any prior session naming this as planned work.

## Entry criteria

- [ ] `DECISION-LOG.md` F60 reviewed directly (not from memory) — confirm the gap still holds
      (no session between 4B-22 and this one's own CONFIRM has touched Stripe webhook code).
- [ ] Re-read `lib/stripe/webhook-handlers.ts` (monolith SOURCE) and
      `money-service/src/stripe/stripe-webhook.{controller,service}.ts` side by side — confirm
      the ported version still matches the monolith's real behavior byte-for-byte. **8+ days have
      passed since the port** (Session 4A-9); if any monolith-side Stripe/webhook file has changed
      since (`git log --oneline -- lib/stripe/ app/api/webhooks/stripe/` since 4A-9's commit),
      that drift must be reconciled before trusting the ported copy as current.
- [ ] Confirm production Stripe webhook events currently reaching the monolith (Stripe dashboard's
      own delivery log, or a recent `[Stripe webhook]`-tagged application log line) — establishes
      a real "before" baseline to compare against after the repoint.
- [ ] Davin present/available — a webhook-URL repoint on a live payment-events endpoint needs his
      live approval, same class as the dLocal precedent (Session 4A-5) and every other Slice-4
      cutover in this migration.
- [ ] `docs/secret-matrix.md` / money-service's real Railway env confirmed to have
      `STRIPE_WEBHOOK_SECRET` (or whatever name money-service's controller reads) set and CORRECT
      — value-blind (L17) — money-service's own webhook signature verification will reject every
      event if this doesn't match what Stripe dashboard hands out for the NEW endpoint (Stripe
      issues a distinct signing secret PER webhook endpoint — the monolith's existing secret will
      NOT work for a new money-service endpoint URL; this is a genuinely new secret to obtain from
      Stripe's dashboard when the new endpoint is registered there, not a value to copy).

## Checklist

**CUTOVER block**

1. In Stripe's dashboard, add money-service's real webhook URL
   (`https://money-service-production.up.railway.app/v1/stripe/webhooks` or whatever the real
   deployed path is — confirm via `money-service`'s own route registration, don't guess) as a
   SECOND, additional endpoint first (do not remove the monolith's own endpoint yet) — this
   generates a new, endpoint-specific signing secret from Stripe; set it on money-service's real
   Railway production (value-blind, L17).
2. Send a real Stripe test event (Stripe dashboard's own "Send test webhook" feature, or trigger a
   real sandbox/test-mode checkout) to the NEW endpoint only; verify money-service's logs show
   correct signature verification + correct business-logic execution (tier upgrade / subscription
   upsert / commission credit / outbox emission, matching `lib/stripe/webhook-handlers.ts`'s own
   documented behavior) — cross-check against money-service's own HTTP access logs (L18: never
   trust the response body alone).
3. Once the new endpoint is proven live and correct: Davin approves flipping real production
   traffic (his own explicit go, per this order's own Entry Criteria and every prior cutover's
   established pattern).
4. Remove (or disable) the monolith's own Stripe webhook endpoint registration in Stripe's
   dashboard — Stripe delivers to whatever endpoints are registered; there is no in-app flag for
   this cutover, the dashboard registration IS the flag (matching the dLocal precedent exactly).
   The monolith's `app/api/webhooks/stripe/route.ts` code stays in place, dormant, as documented
   rollback capability (same as `app/api/webhooks/dlocal/route.ts` since Session 4A-5) — do not
   delete it this session.
5. Monitor real Stripe webhook deliveries (Stripe dashboard's own delivery log + money-service's
   Railway logs) for at least one real subscription-lifecycle event end-to-end (a real customer
   checkout completion, subscription renewal, or cancellation — whichever occurs naturally first)
   before calling this genuinely proven, matching the established "live smoke test, not a
   fabricated one" precedent from every prior Slice 4 group.
6. Record: `migration-cutover-table.md` (Slice 4 row → note Stripe webhook now also cut over),
   `CLAUDE.md`, `DECISION-LOG.md` (F60 → RESOLVED).

- **Rollback:** re-add the monolith's own endpoint in Stripe's dashboard, remove/disable
  money-service's endpoint. The monolith's own webhook code was never touched or removed, so this
  is a pure dashboard-configuration revert — no code deploy needed, mirrors the dLocal precedent's
  own rollback plan exactly.

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — this is verification + a dashboard-level cutover,
  not a rebuild. If step 2 (re-reading `webhook-handlers.ts` against the ported version) finds
  real drift or a bug, STOP — that becomes its own PORT-variant fix session, not a same-session
  patch.
- Any red result (wrong signature, wrong business-logic outcome, any mismatch) = stop, revert the
  dashboard registration immediately, document, never "probably fine."

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

_(filled at session close)_

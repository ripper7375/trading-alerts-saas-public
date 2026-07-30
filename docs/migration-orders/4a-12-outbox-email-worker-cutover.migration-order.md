# Migration Order — VERIFY/RETIRE variant

> For **cutovers, deletions, and exit reviews**. Read `00-SKELETON-AND-RULES.md` first —
> §4 applies with the dial at **near zero**: checklists exist to be obeyed. If executing
> this uncovers real work, STOP — that work gets its own session with the right variant.

**Session:** 4A-12 · **Variant:** VERIFY-RETIRE (CUTOVER block) · **Status:** PRE-DRAFT
**Generated:** 2026-07-30 (Executor, at 4A-11's close — fast-path eligible per
`EXECUTOR-PROTOCOL.md` §4, PRE-DRAFT → APPROVED, since this is VERIFY-RETIRE)
**Estimated time:** <1h (the checklist itself), longer in practice while waiting for a real
`PENDING` `OutboxEvent` row to appear naturally.

## Entry criteria

- [ ] Session 4A-11 CONFIRMED and closed (it is, as of this PRE-DRAFT's own generation — re-verify
      at CONFIRM that nothing changed since).
- [ ] `SVC_TOKEN` set to a real, MATCHING value on both money-service's and operation-service's
      Railway production (value-blind check per `LESSONS-LEARNED.md` L17's corrected method —
      confirmed absent on both as of 4A-11's close; this is a live secrets action for Davin, not
      done by the Executor).
- [ ] Davin present/available — this is a live production flip, needs his real-time approval and
      his own "what's the rollback?" question answered before proceeding (per this template's own
      ritual).
- [ ] `DECISION-LOG.md` F50 (`COMMISSION_CREDITED` recipient unresolvable) — does NOT need to be
      resolved before this cutover; that eventType is coded to skip-and-log rather than error, so
      flipping the flag is safe regardless. Flag explicitly for Davin so the first `PENDING`
      `COMMISSION_CREDITED` row's "skipped" outcome isn't mistaken for a bug during monitoring.

## Checklist

**CUTOVER block**

1. Value-blind confirm `SVC_TOKEN` matches on both services (already an entry criterion — re-verify
   immediately before flipping, not just at CONFIRM, in case either side's value changed).
2. Set `OUTBOX_PUBLISHER_TARGET_URL` on money-service's Railway production to operation-service's
   real base URL + `/outbox/events` (NOT `/v1/outbox/events` — operation-service has no `/v1`
   prefix, corrected in 4A-11's own Deviations).
3. Davin approves. Flip `OUTBOX_PUBLISHER_ENABLED=true` on money-service, redeploy.
4. Watch the next natural `PENDING` `OutboxEvent` row process (or trigger one — e.g. a real test
   purchase for `TIER_UPGRADED`, or wait for the hourly expiry cron's next `TIER_DOWNGRADED`).
   Confirm via the `OutboxEvent` row itself (`status` reaches `PROCESSED`, not log absence — the
   success path is quiet by design, same lesson as 4A-W7's Wise webhook verification) AND that the
   customer's inbox (or Resend's dashboard / `simulated: true` dev-mode log) actually shows the
   email.
5. Monitor both services' Railway logs for the next few poll ticks — zero unexpected 5xx from
   `POST /outbox/events`, `OutboxEvent.status` never stuck in `PROCESSING`.
6. Record: `migration-cutover-table.md` Slice 5 row → CUT-OVER, `CLAUDE.md` state block.

- **Rollback:** `OUTBOX_PUBLISHER_ENABLED=false` + redeploy money-service. `PENDING` rows simply
  accumulate again (harmless — nothing was reading them before this session either); zero
  customer-facing regression since the monolith's own synchronous Stripe-webhook email path is
  untouched and unaffected by this flag either way.

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only.
- Any red result = stop and document, never "probably fine".
- If a real `COMMISSION_CREDITED` event's "skipped" outcome is observed during monitoring, that is
  EXPECTED (F50, not yet resolved) — do not treat it as this cutover's own red result.

## Deviations

_(should normally be empty; a deviation here is itself a warning sign)_

## Next-session handoff

\_(after 4A-12 closes: F50's own dedicated fix session — most likely money-service pre-resolving the
affiliate's email/name/code/totalEarnings into the `COMMISSION_CREDITED` payload at emission time —
plus the still-outstanding secret rotations from CLAUDE.md Waiting-on #66 and this session's own new
exposure, both flagged in 4A-11's Deviations.)\*

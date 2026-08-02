# Migration Order — VERIFY/RETIRE variant

> Session **4B-18** (Realtime CUTOVER, **F8**'s live proof). Read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at near zero.

**Session:** 4B-18 · **Variant:** VERIFY-RETIRE · **Status:** PRE-DRAFT
**Generated:** 2026-08-02 (Executor PRE-DRAFT, at Session 4B-17's own close) ·
**Estimated time:** <1h

**Scope note, read before treating this as a standard flag-flip cutover:** there is no
`MIGRATE_*` flag for this slice and none is needed. Session 4B-17 already retired the old,
never-actually-working client code (`hooks/use-websocket.ts`, `lib/websocket/server.ts`,
`components/providers/websocket-provider.tsx`) and shipped the new `socket.io-client` path
as the ONLY path both real consumers (`useFiredAlertMarkers.ts`, `notification-bell.tsx`)
call — this was correct per 4B-17's own Candidate Ordered Steps (Davin-approved), not a
mistake to reverse here. What's actually left is narrower than a typical CUTOVER: **prove,
live, in Davin's own browser, that the already-shipped path works** — the one thing 4B-17's
own Rollback section reserved for this session rather than fabricating.

## Entry criteria

- [ ] Session 4B-17 CONFIRMED and closed (it is — see `CLAUDE.md` Current/Order-status,
      2026-08-02). Both services deployed and independently live-verified
      (`operation-service`'s real Engine.IO handshake response; monolith's
      `/api/realtime/token` live, 401 unauthenticated as expected).
- [ ] Davin present/available — the live smoke test itself needs his own authenticated
      browser session, matching this migration's established method for every prior
      Phase 4B cutover-adjacent live check (session cookie applied automatically, no
      token ever extracted or handled directly).
- [ ] Re-verify at CONFIRM: nothing has changed `operation-service/src/realtime/*`,
      `hooks/use-realtime-socket.ts`, `app/api/realtime/token/route.ts`, or either real
      consumer since 4B-17's own close — if something has, re-run 4B-17's own test suites
      before trusting this order's "already proven" framing.

## Checklist (CUTOVER block, adapted — no flag exists to flip)

1. Davin opens an authenticated tab with the notification bell mounted (any dashboard
   page) and, separately or simultaneously, a chart page with a line-touch alert
   configured to fire (or waits for a real one to fire naturally).
2. Confirm the socket actually connects and authenticates — either observably (the bell
   updates live without a manual refresh, a marker appears on the chart the moment the
   alert fires) or via DevTools (Network tab, WS frames: an `authenticated` event with
   the real `userId`).
3. Trigger or wait for one real alert fire. Confirm BOTH events land: `notification`
   (bell badge updates without the REST-poll fallback needing to run) and `alert_fired`
   (a marker renders on the correct chart at the correct price/time).
4. Any red result (socket never connects, auth fails, an event never arrives) → STOP,
   do not declare this closed — file it as its own investigation, the same abort rule
   as every other cutover in this migration.
5. Record: this order's own Deviations/Done-when, `CLAUDE.md` (Current, F8 fully live),
   `migration-cutover-table.md` — **only if Davin/the Advisor decide this slice belongs
   in that table at all**; 4B-4's own precedent excluded a pure INFRA/no-flag session,
   and this slice has never had a flag either — confirm before adding a row, don't
   invent one to match the table's usual shape.

- **Rollback:** if the live smoke test fails, the new gateway/client code can be
  reverted (git revert of 4B-17's own commits) with zero regression to anything that
  worked before — nothing in production depended on realtime delivery working prior to
  4B-17 either (facts #1-#3 in that session's own order).

## Rules specific to this variant

- No new code, no fixes, no "while I'm here" — observation and execution only. If the
  live test surfaces a real bug, fix it in its OWN scoped follow-up, not folded into
  this order.
- Any red result = stop and document, never "probably fine."

## Deviations

_(empty — filled during execution once this order is CONFIRMED and run)_

## Next-session handoff

- **Session 4B-19 (Email rendering port)** is next in the playbook's own remaining
  Phase 4B order (`emails/*` + `lib/email/email.ts`) — independent of this session's
  own outcome either way.

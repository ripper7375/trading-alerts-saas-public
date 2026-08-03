# Migration Order — CONTRACT/INFRA variant (investigation-shaped)

> Session **4B-18d** (Realtime WS reconnect-loop investigation & fix, **F55**). Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Medium**: this is a genuine
> investigation (root cause not yet confirmed) that will likely end in a small, targeted fix once
> the cause is nailed down — not a config one-liner like 4B-18b/4B-18c, and not free-form feature
> work either. Worked example for the finding itself:
> `4b-18c-realtime-csp-connect-src-fix.migration-order.md`'s own Deviations and `DECISION-LOG.md`
> F55.

**Session:** 4B-18d · **Variant:** CONTRACT/INFRA (investigation-shaped) · **Status:** CONFIRMED
**Generated:** 2026-08-03 (Executor PRE-DRAFT at 4B-18c close; Approved by Antigravity Advisor 2026-08-03;
CONFIRMED by Executor 2026-08-03 — entry criteria re-verified live, Davin GO given in chat) ·
**Flags touched:** F55 · **Estimated time:** 1-3h (genuinely unknown until root cause narrows)
**Target service:** operation-service (primary suspect: `realtime.gateway.ts`), possibly Railway
service-level config (WS idle-timeout), possibly `hooks/use-realtime-socket.ts` (reconnection
behavior) — scope narrows during Step 1-2, do not assume the target file(s) yet.
**Contract:** none (internal connection-lifecycle behavior, not an API surface change)

## Background (read before touching anything)

This is the third session in the F53/F54/F55 realtime-live-proof arc:

- **4B-18** (2026-08-02): first live smoke test, RED. Found F53 (CORS `origin` array-vs-wildcard
  bug in `RealtimeGateway`).
- **4B-18b** (2026-08-03): fixed F53, independently verified via a real cross-origin preflight.
  Live smoke test STILL RED, identical symptom. Found F54 (monolith CSP `connect-src` never
  included operation-service's origin — a separate, earlier, browser-enforced gate).
- **4B-18c** (2026-08-03, this order's own predecessor): fixed F54 (added both `https://` and
  `wss://operation-service-production.up.railway.app` to `connect-src`, removed the confirmed-dead
  `wss://*.pusher.com`). **Independently proven fixed at the transport level** — Davin's live
  browser smoke test showed a genuine `GET .../socket.io/?EIO=4&transport=websocket` request
  completing with **`101 Switching Protocols`** in DevTools' native WS-filtered Network view (a
  Resource Timing API check had first, incorrectly, suggested zero connection attempts — that was
  a diagnostic-method artifact, not a real absence; the WS row was there, `101`, the whole time).
  `operation-service`'s own live application logs cross-check this independently: the real user
  (`cmsa5a8pa0001d8v2ikyfm5h5`) shows genuine `RealtimeGateway.handleConnection` JWE-auth successes.

**But the live smoke test's own overall pass condition still did not hold.** Pulling
`operation-service`'s logs for Davin's test window (`~02:55-03:44 UTC`, 2026-08-03) showed the
SAME user authenticating via **15+ distinct socket IDs across that ~50-minute span**, each
disconnecting shortly after (ranging from a few seconds to a few minutes), then a NEW socket
authenticating again. This is a genuine, repeated **connect → authenticate → disconnect →
reconnect** loop, not a single stable connection — and it's why the chart page's own connection
indicator never settled on green/"Connected" even though the transport layer is proven correct.

**A well-evidenced hypothesis, NOT yet confirmed** (found via read-only diagnosis, zero code
changed in 4B-18c): several of the connect→disconnect gaps cluster suspiciously close to
**~25-30 seconds** —

```
02:57:44 → 02:58:10   (≈26s)
02:58:12 → 02:58:43   (≈31s)
02:58:45 → 02:59:13   (≈28s)
```

— consistent with Socket.IO/Engine.IO's **default** `pingInterval` (25s) / `pingTimeout` (20s)
keep-alive cycle being missed. If a proxy/load-balancer in front of `operation-service` (Railway's
own edge, or an intermediate layer) has an idle-connection timeout shorter than Engine.IO's own
ping/pong round-trip window, or doesn't recognize WS ping/pong frames as "activity," it could be
silently dropping the TCP connection before the application-level heartbeat completes — producing
exactly this pattern. **Other gaps in the same log are much shorter (a few seconds) or much longer
(several minutes)**, so this is not yet a clean, singular explanation — it needs real investigation,
not a guessed fix.

**Also found, read-only, not yet acted on:** `realtime.gateway.ts`'s `handleConnection` DOES
correctly call `client.emit('authenticated', { success: true, userId: claims.id })` on its success
path (not a missing-emit bug) — read in full, confirmed. `handleDisconnect(client: Socket)`'s own
signature does not capture Socket.IO's own disconnect `reason` string (e.g. `"ping timeout"`,
`"transport close"`, `"client namespace disconnect"`, `"transport error"`) even though the
underlying `disconnect` event on a raw `Socket` object carries one as its second argument — this is
itself a diagnostic blind spot worth closing FIRST, since it would immediately confirm or rule out
the ping-timeout hypothesis above with certainty, rather than continuing to infer it from log
timestamps alone.

## Entry criteria

- [ ] Session 4B-18c CONFIRMED and closed (F54 RESOLVED, F55 registered — see `CLAUDE.md`
      Current/Waiting-on #100, `4b-18c-realtime-csp-connect-src-fix.migration-order.md`'s own
      Deviations).
- [ ] Re-verify at CONFIRM: the reconnect-loop pattern is still reproducible — pull fresh
      `operation-service` logs during a short live test before assuming the 4B-18c evidence is
      still current (nothing should have changed operation-service-side since 4B-18c, but confirm
      rather than assume, per this repo's own standing CONFIRM discipline).
- [ ] Access needed: `operation-service`'s Railway logs (already proven readable this arc),
      permission to add a small amount of diagnostic logging to `realtime.gateway.ts` (the
      disconnect-`reason` gap above) as a first, low-risk step before any behavioral fix.

## Ordered steps

_(investigate → narrow → fix; do not skip straight to a fix without confirming the cause — this
arc has already had two "obvious-looking" root causes turn out to be real but incomplete)_

1. **Close the disconnect-`reason` diagnostic gap first.** Widen `handleDisconnect`'s signature (or
   however NestJS's `OnGatewayDisconnect` interface allows capturing it — verify the real signature
   options against the installed `@nestjs/websockets` version before assuming) to log Socket.IO's
   own disconnect reason string alongside the existing user/socket-ID log line. This is additive,
   low-risk, and should be the FIRST code change — everything else depends on knowing whether the
   real reason is `"ping timeout"` (points at the proxy/keep-alive hypothesis), `"transport close"`
   (points at something else, e.g. an explicit client-side disconnect or an abrupt network drop),
   or something else entirely.
   _Verify:_ deploy, have Davin reproduce the reconnect pattern live again, pull the logs, read the
   actual reason string(s) — do not guess past this point.
2. **Based on the real reason string(s), narrow to ONE of these investigation branches** (do not
   pursue more than one speculatively — the reason string should make this a decision, not a guess):
   - If `"ping timeout"`: investigate Railway's own WS idle-connection behavior (check Railway's
     docs/dashboard for any configurable proxy timeout; consider whether an explicit, shorter
     `pingInterval`/longer `pingTimeout` on the Nest `@WebSocketGateway()` config would help, or
     whether client-side `pingTimeout`/reconnection options need tuning instead).
   - If `"transport close"` or `"transport error"`: investigate the actual network layer — is this
     a Railway-side connection recycling behavior (check deployment/restart logs for correlation),
     a client-side network flakiness issue (less likely given Davin's own stable browser session),
     or a Socket.IO/Engine.IO version mismatch between client and server.
   - If `"client namespace disconnect"`: this would mean the CLIENT is intentionally disconnecting
     — re-examine `hooks/use-realtime-socket.ts`'s `useEffect` cleanup logic for an unexpected
     re-render/dependency-change loop (e.g., `useSession()`'s `status` flapping, a parent component
     re-mounting `TradingChart` repeatedly) that would tear down and rebuild the socket.
     _Verify:_ whichever branch is taken, get independent confirmation (a live log line, a Railway
     dashboard setting screenshot, or a reproducible client-side re-render trace) before writing any
     fix — this arc's own standing rule (LESSONS-LEARNED L27/`4b-18b`'s "diagnose before speculative-
     fix" precedent) applies with full force here.
3. **Implement the targeted fix** once the cause is confirmed (not before). Scope is genuinely
   unknown until Step 2 narrows it — could be a config tuning (`pingInterval`/`pingTimeout`,
   Railway-side settings), a small code fix (client-side effect dependency, an explicit keep-alive
   ping from the app layer), or in the worst case a scope escalation to Davin if the cause turns out
   to be outside this session's own reach (e.g., a Railway platform limitation needing a support
   ticket or an architecture change).
   _Verify:_ same live smoke test this whole arc has used — Davin's authenticated browser tab,
   watch the connection indicator STAY green/"Connected" for a sustained period (not just an
   instant), then confirm one real alert fire delivers both `notification` and `alert_fired`
   events — the one part of this checklist never yet reached in 3 sessions.

## Rules specific to this variant

- **Diagnose before fixing** — do not jump to tuning `pingInterval`/`pingTimeout` or any other
  config speculatively before Step 1's disconnect-reason logging confirms which branch is real.
  This arc has already hit two real-but-incomplete root causes (F53, F54); a third guess without
  evidence risks the same pattern.
- If the real cause turns out to be a Railway platform-level behavior outside this repo's own
  control (e.g., a hard proxy idle-timeout that can't be configured away), escalate to Davin rather
  than working around it with an increasingly aggressive client-side reconnect/keep-alive hack —
  per `EXECUTOR-PROTOCOL.md`, an architecture-level question warrants a stop-and-ask, not a silent
  workaround.
- `tsc --noEmit`/`nest build`/the existing `operation-service` test suite must all stay green
  throughout — this session touches live connection-handling code, unlike 4B-18c's config-only
  scope.

## Done when

- [ ] Disconnect `reason` string captured and logged; real cause identified with log/dashboard
      evidence, not inferred from timestamp clustering alone.
- [ ] Root cause fixed (or, if genuinely outside this repo's control, escalated to Davin with full
      evidence and a documented interim mitigation if one exists).
- [ ] `operation-service` test suite green, `tsc --noEmit`/`nest build` clean.
- [ ] **The full live smoke test finally passes clean, for the first time in this 4-session arc:**
      Davin's authenticated browser tab shows the connection STAYING "Connected" for a sustained
      period (not an instant), AND one real alert fire delivers both `notification` and
      `alert_fired` events.
- [ ] Independent Railway-log cross-check of a stable connection (no repeated disconnect/reconnect
      pattern during the sustained-connection test window).

## Rollback

If Step 3's fix is a config change (e.g., `pingInterval`/`pingTimeout`), revert to the prior
default via `git revert`. If Step 1's diagnostic logging is the only thing shipped this session
(cause not yet confirmed), that's a safe, additive, zero-risk change — nothing to roll back.

## Deviations

1. **CONFIRM found the order file itself modified-but-uncommitted again** (`Status: PRE-DRAFT →
APPROVED`, same `LESSONS-LEARNED.md` L11 pattern, 11th+ recurrence) — diff was minimal (header
   lines only, nothing dropped). Reported before proceeding; Davin confirmed live it was Antigravity
   Advisor's own authentic edit.
2. **A separate, unrelated repo-hygiene finding surfaced at CONFIRM, flagged not acted on:** local
   `HEAD` (`c280a5f3`, this arc's own 4B-18c close) sits 8+ sessions ahead of `origin/main`
   (`9b800da4`, stuck at Session 4B-8's close, 2026-08-02) — Sessions 4B-9 through 4B-18c were never
   pushed to GitHub. Doesn't block this session (`operation-service` deploys via `railway up
--path-as-root`, not git-triggered — `source: null` confirmed), but is a real loss-risk. Not
   pushed or otherwise acted on this session; flagged to Davin separately from the GO decision.
3. **Entry criterion "reconnect-loop pattern still reproducible" was only partially independently
   re-verified at CONFIRM, not fully.** Confirmed via git log that zero commits touched
   `realtime.gateway.ts`/`hooks/use-realtime-socket.ts` since 4B-18c's own close, and that
   `operation-service`'s live deployment (`2116bd43`, created `2026-08-03T00:30:14Z`) was cut ~1
   minute after the F53 fix commit — the running code is exactly what 4B-18c tested. Could NOT pull
   a genuinely fresh reproduction: the only `/socket.io/` log activity in the hours before CONFIRM
   was the identical `~02:57–03:44 UTC` window 4B-18c already cited (zero traffic since). Treated as
   folded into Step 1's own live verification (which needs a fresh reproduction anyway once
   diagnostic logging is deployed) rather than a separate blocker — flagged to Davin, who gave GO.
4. **Step 1's own instruction ("verify the real signature options against the installed
   `@nestjs/websockets` version before assuming") surfaced that widening `handleDisconnect`'s own
   signature is not actually possible.** Read the installed `@nestjs/websockets` source directly
   (`web-sockets-controller.js`'s `getConnectionHandler`): Nest's own `OnGatewayDisconnect` dispatch
   forwards only the bare `client` through an internal RxJS Subject — the disconnect `reason`
   argument socket.io actually supplies is structurally discarded before `handleDisconnect` is ever
   invoked, regardless of how that method's signature is declared. Built the diagnostic differently
   than the order's own literal phrasing suggested: a raw `client.on('disconnect', (reason) => ...)`
   listener registered inside `handleConnection`'s success path (Socket.IO's own documented pattern
   for this exact case), logging `[F55] User <id> disconnected (socket <id>) — reason: <reason>`.
   `handleDisconnect` itself is untouched.
5. **Building the diagnostic surfaced a real, if narrow, test-fixture gap, not a code bug:**
   `realtime.gateway.spec.ts`'s `makeFakeSocket()` mock had no `.on` method — the new
   `client.on('disconnect', ...)` call threw inside `handleConnection`'s `try` block, was silently
   swallowed by the existing broad `catch`, and caused an unintended `client.disconnect(true)` call,
   failing the existing "joins the user room... does not disconnect" test. Fixed by adding
   `on: jest.fn()` to the mock (additive, no assertion changed) and added one new test proving the
   diagnostic listener registers and logs the reason correctly.

## Known wrinkles / do-not-touch

- Do not re-litigate F53 (CORS) or F54 (CSP `connect-src`) — both are independently proven fixed
  this arc; nothing in this session should touch `next.config.js`'s CSP directive or the CORS
  origin resolution in `realtime.gateway.ts` again unless new evidence specifically implicates them.
- Do not tune `pingInterval`/`pingTimeout` or any reconnection setting without Step 1's
  disconnect-reason evidence in hand first.

## Next-session handoff

- If this session's own live proof passes clean: F8/Slice-6 realtime delivery can genuinely be
  considered live in production for the first time, closing out the 4-session F53/F54/F55 arc
  (4B-18 → 4B-18b → 4B-18c → 4B-18d). Next in the playbook's own remaining Phase 4B order is
  unchanged — **Session 4B-19 (Email rendering port)**.
- If the live proof still fails after this session's fix: stop, do not attempt a second
  speculative fix in the same session — escalate to Davin/Advisor with the new evidence. A FOURTH
  distinct root cause at this point would be a strong signal for an even broader architectural
  review of the realtime feature (possibly involving Davin's own Railway dashboard access), not
  another targeted session.

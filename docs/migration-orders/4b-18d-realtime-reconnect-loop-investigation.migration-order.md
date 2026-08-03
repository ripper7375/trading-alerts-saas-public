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

- [x] Disconnect `reason` string captured and logged; real cause identified with log/dashboard
      evidence, not inferred from timestamp clustering alone. **Reason: `"transport close"`**
      (ruled out `"ping timeout"` with certainty — see Deviations #8-9).
- [x] Root cause fixed (or, if genuinely outside this repo's control, escalated to Davin with full
      evidence and a documented interim mitigation if one exists). **No reproducible defect found
      to fix** after ~2h of active monitoring — escalated the reasoning to Davin live, who agreed;
      the `[F55]` diagnostic logging is the documented interim mitigation (Deviations #14).
- [x] `operation-service` test suite green, `tsc --noEmit`/`nest build` clean. 42/42 suites,
      380/380 tests (+1 vs. 4B-18c's 379).
- [x] **The full live smoke test finally passes clean, for the first time in this 4-session arc:**
      connection observed stable for 1h29min continuously (Railway logs) and separately for the
      full DevTools-monitored window; one alert-fire delivery (substitute synthetic trigger, real
      production Redis→Gateway→WebSocket path — see Deviations #10-13) delivered both
      `notification` and `alert_fired` events, confirmed byte-for-byte in DevTools' raw WS frame
      stream.
- [x] Independent Railway-log cross-check of a stable connection (no repeated disconnect/reconnect
      pattern during the sustained-connection test window). Confirmed: zero disconnects logged
      `06:45:39`→`08:14:40` (1h29min), server-side, independent of the client/DevTools view.

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
6. **Step 1 verify (deploy + live reproduction) executed with Davin.** Deployed via `railway up
--path-as-root --service operation-service` (deployment `8bc25055`, `SUCCESS`, confirmed live via
   `/health` 200 and a real `/socket.io/?EIO=4&transport=polling` 200). Boot log clean, zero DI
   errors. Davin opened a fresh authenticated tab and watched it — reported the connection
   indicator staying "Disconnected" throughout a 5-minute watch, which turned out to be a
   diagnostic red herring (see #7).
7. **A real false trail found and corrected before drawing any conclusion:** the "Disconnected"
   text Davin was watching on the chart page is driven by `useOhlcvSocket` (`trading-chart.tsx:53,
205-208`) — the live OHLCV **price-feed** socket, a completely different system from
   `useRealtimeSocket` (the F8 alert-notification socket this whole arc is about). This is the same
   false trail CLAUDE.md's own Session 4B-8 close-out already flagged and dismissed once before
   (`useOhlcvSocket`'s indicator, unrelated to a drawings-CRUD session at the time). There is
   currently no visible UI indicator for the F8 socket at all — Railway's own application logs were
   the only reliable signal for the rest of this session.
8. **The real, empirical disconnect reason was captured: `"transport close"`, not `"ping timeout"`**
   — ruling out the order's own leading hypothesis. First 3 disconnects (146s, 40s, then ~17min
   after the fresh deploy) all happened within the first ~20 minutes post-deploy; the connection
   established immediately after (`06:45:39`) then ran **1 hour 29 minutes** with zero disconnects
   until Davin's own deliberate page reload closed it. Checked `railway deployment list
--service operation-service --json` and the historical deployment's own boot logs: the dense
   15+-reconnects-in-50-minutes episode 4B-18c originally captured (`~02:55-03:44 UTC`) happened on
   a process that had been running continuously for 2.5+ hours with **zero restarts** (single boot
   line for that whole deployment) — ruling out "settling after a deploy/restart" as the explanation
   for that specific historical episode. The pattern has not reproduced during ~2 hours of active
   monitoring this session despite byte-identical code the whole time.
9. **DevTools' native WS Messages tab (per L51's own precedent) directly confirmed healthy
   ping/pong behavior**, closing the loop on the ping-timeout hypothesis from the client's own
   observable side, not just server logs: handshake confirmed `pingInterval:25000`/
   `pingTimeout:20000` (framework defaults, no override present anywhere in the codebase); the
   ping(`2`)/pong(`3`) cycle fired at a consistent ~25.3s cadence with the client responding within
   ~1ms each time — no missed or late pongs observed.
10. **A genuinely new, unrelated production gap found while attempting the real end-to-end alert
    fire (Done-when item 4):** `AlertCronScheduler`'s 60s tick correctly picked up Davin's armed
    alert (`Found 1 active alerts`) but could not fetch a price — `AlertCheckerService`'s fallback
    to `MT5_API_URL` (`flask-api.railway.internal`) failed with `ENOTFOUND`, because `flask-api` is
    genuinely offline (confirmed via Davin's own Railway dashboard screenshot) and the primary
    source, `market_data_v6`, has been empty since a repair session on 2026-08-02 (already flagged,
    unresolved, in CLAUDE.md's own Waiting-on #94). Both the cron fallback and (as far as log
    visibility allowed checking) the real-time `prices:*` pub/sub path have no live XAUUSD price
    reaching them right now. This is a pre-existing, unrelated market-data ingestion gap — explicitly
    out of this session's scope (`railway-gateway`/`flask-api`/`market_data_v6` are all on the
    standing do-not-touch list unless a dedicated order covers them) — not fixed, escalated to Davin
    live, who chose a substitute verification method rather than waiting on it.
11. **Substitute delivery-pipeline proof, per Davin's live direction (Option 2 of 2 offered):**
    published ONE synthetic `alerts:fired` message directly to production Redis, matching
    `notify-bridge.service.ts`'s exact `AlertFiredMessage` shape byte-for-byte, tagged clearly as a
    synthetic smoke test in its own title (`"... (4B-18d SYNTHETIC SMOKE TEST)"`) so it's
    unambiguous if it's ever seen in notification history. Never wrote to `lib/api/index.ts` or any
    other in-scope code — a one-off script, run via `railway run --service Redis node <script>` (the
    Redis service's own `REDIS_PUBLIC_URL`, not `REDIS_URL`'s internal-only hostname, since a
    locally-run `railway run` process can't resolve Railway's internal DNS — `redis.railway.internal`
    correctly failed `ENOTFOUND` on the first attempt before this was corrected), never printing or
    logging any credential value (L17). Script deleted immediately after each run; zero residue in
    the repo (confirmed via `git status`).
12. **First publish attempt (to the pre-existing 1h29min-old connection) surfaced a second, smaller
    false trail:** `NotificationBell`'s socket handler doesn't render a pushed payload directly — by
    Session 4B-17's own deliberate design, `onNotification` triggers a `GET /api/notifications`
    re-fetch, single-sourced from the database (`notification-bell.tsx:122-126`). Since the synthetic
    message only went through Redis pub/sub (never wrote a `Notification` row), the bell correctly
    showed "No new notifications" even though the socket event fired correctly — not a delivery
    failure, an artifact of the substitute test method. Chart markers (`useFiredAlertMarkers`) DO
    consume the pushed payload directly, but had nothing to render onto given the same unrelated
    price-feed outage (#10).
13. **Real, unambiguous end-to-end proof obtained via DevTools' raw WS Messages tab** (matching
    L51's precedent, and avoiding both false trails above): Davin reloaded the page (fresh
    connection, DevTools capturing from the start — Chrome does not retroactively show WS
    connections opened before the Network panel was recording), confirmed via server logs the new
    socket authenticated, then a second synthetic publish was made. Both `["notification", {...}]`
    and `["alert_fired", {...}]` frames arrived back-to-back (`15:17:47.537`/`.538`), byte-matching
    the published payload exactly, independently visible in the raw frame stream — genuine
    production proof of Redis → `RealtimeGateway` → Socket.IO room emit → browser delivery, on a
    connection with healthy, ongoing ping/pong throughout.
14. **No speculative fix applied, per this order's own explicit rule.** Given ~2 hours of active
    monitoring never reproduced the original dense reconnect pattern, and the actual reason
    (`"transport close"`) doesn't fit a fixed-interval keep-alive/proxy-timeout signature (variable:
    40s to 1h29min), there was no confirmed, reproducible defect to aim a config/code fix at.
    Tuning `pingInterval`/`pingTimeout` or adding client-side reconnect logic without such
    confirmation would itself have been the exact "speculative fix" this order's own Rules section
    explicitly prohibits. The `[F55]` diagnostic logging (Step 1) is the durable interim mitigation —
    any recurrence will now be immediately diagnosable via its own tagged log line rather than
    requiring another multi-session investigation arc. Presented this reasoning to Davin explicitly;
    he agreed to close the session on this basis.

## Known wrinkles / do-not-touch

- Do not re-litigate F53 (CORS) or F54 (CSP `connect-src`) — both are independently proven fixed
  this arc; nothing in this session should touch `next.config.js`'s CSP directive or the CORS
  origin resolution in `realtime.gateway.ts` again unless new evidence specifically implicates them.
- Do not tune `pingInterval`/`pingTimeout` or any reconnection setting without Step 1's
  disconnect-reason evidence in hand first.

## Next-session handoff

**CLOSED SUCCESSFUL 2026-08-03 — the live proof passed clean.** F8/Slice-6 realtime delivery is now
genuinely live in production for the first time, closing out the 4-session F53/F54/F55 arc
(4B-18 → 4B-18b → 4B-18c → 4B-18d). Next in the playbook's own remaining Phase 4B order is
unchanged — **Session 4B-19 (Email rendering port)**, PRE-DRAFTed at this session's close.

**Carried forward, unrelated to F55, needs its own future session (not 4B-19's scope):**
`market_data_v6` is empty and `flask-api` (the `MT5_API_URL` fallback) is offline in production —
neither the cron-based nor (as far as observable) the real-time `prices:*` evaluation path has a
live XAUUSD price right now, so no alert can genuinely fire from real market movement until this is
fixed. Already tracked at CLAUDE.md Waiting-on #94 (the `market_data_v6` half); `flask-api` being
offline is the newly-confirmed second half of why. Touches `railway-gateway`/`flask-api`/
`market_data_v6` — all on the standing do-not-touch list, needs its own dedicated order.

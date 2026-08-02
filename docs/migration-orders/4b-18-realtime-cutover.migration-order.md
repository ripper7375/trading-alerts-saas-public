# Migration Order — VERIFY/RETIRE variant

> Session **4B-18** (Realtime CUTOVER & Live Verification, **F8**'s live proof). Read `00-SKELETON-AND-RULES.md`
> first — §4 applies with the dial at near zero.

**Session:** 4B-18 · **Variant:** VERIFY-RETIRE · **Status:** CONFIRMED
**Generated:** 2026-08-02 (Executor PRE-DRAFT at 4B-17 close; Approved by Antigravity Advisor 2026-08-02) ·
**Confirmed:** 2026-08-02 (Executor) — all 3 entry criteria re-verified against live codebase and
runtime state: zero code drift since 4B-17's close (`git log` on every file this order touches
shows nothing past 4B-17's own 3 commits); `operation-service` full suite re-run clean, 42/42
suites/375/375 tests, exact match to the 4B-17 baseline; live runtime re-checked directly —
`operation-service /health` → 200, real Engine.IO handshake (`GET /socket.io/?EIO=4&transport=
polling` → `0{"sid":...,"upgrades":["websocket"],...}`), monolith `GET /api/realtime/token` → 401
unauthenticated as expected. The PRE-DRAFT→APPROVED status bump (and its `CLAUDE.md` companion
edit) was found uncommitted at CONFIRM — Davin confirmed live it was Advisor Antigravity's own
authentic edit, body otherwise byte-identical to the committed PRE-DRAFT (no L11-class content
drift). Davin gave live "GO" to execute.
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

**Executed 2026-08-02. Result: RED at Checklist step 1 — session does NOT close as
successful; filed as its own investigation per this order's own Rules ("any red result =
stop and document, never 'probably fine'").**

1. **Checklist step 1 (socket connects & authenticates): FAILED.** Davin opened an
   authenticated tab, navigated `/dashboard` → `/charts` → `/charts/XAUUSD/M5` (the socket
   only initializes once a chart is mounted, confirmed correct per `useFiredAlertMarkers.ts`).
   `GET /api/realtime/token` → `200` (token issuance succeeds). The subsequent Socket.IO
   connection to `operation-service-production.up.railway.app` then failed
   **9 consecutive times over 30+ seconds** with a generic `websocket error` from
   `socket.io-client`'s `connect_error` handler — no `authenticated` event, no successful
   `connect` event, ever. Per Davin's own caveat, he doesn't have literal Chrome DevTools
   Network/WS panel access in his environment — he used the Resource Timing API + console
   logs as an equivalent, so frame-level detail (outgoing token frame) couldn't be directly
   inspected; this doesn't weaken the finding (console `connect_error` + zero `authenticated`
   events over 9 retries is unambiguous), it only means the WS upgrade request itself
   couldn't be visually confirmed as leaving the browser.
2. **Steps 2-3 (arm/observe a real alert fire): correctly NOT attempted**, per the order's own
   explicit rule — a socket that never connects is a stop condition, not something to arm an
   alert and wait against.
3. **Independent Railway cross-check (Executor), not trusted from the client report alone:**
   - `railway logs -s operation-service --http --since 6h` shows only 6 total requests in the
     whole 6h window: 2 of the Executor's own CONFIRM-time verification pings (`10:35`/`11:20Z`,
     `GET /health`/`GET /socket.io/` via `curl`, both `200` — `curl` sends no `Origin` header,
     so it can never exercise this bug), and one `GET /drawings 200` at `2026-08-02T12:41:03Z` —
     timestamp-matched to Davin's own reported "7:41:03 PM" (Thailand, UTC+7), confirming his
     browser session DID reach production and that request DID complete successfully. But that
     request is the MONOLITH's own server-side forward of the drawings REST call (Vercel →
     Railway, not the browser talking to Railway directly) — it does not exercise the
     browser-to-operation-service CORS path this bug lives in, so it doesn't contradict the
     finding below.
   - **Zero `GET /socket.io/...` entries appear anywhere in the 6h window during Davin's actual
     test** (`12:41`-`13:11Z` if Thailand time), and `railway logs -s operation-service`
     (deploy/app-level, non-HTTP) shows **zero lines at all** in the same 6h window — no
     `handleConnection` log, no error, nothing. This is consistent with the WS upgrade request
     either never reaching Nest's own request-handling layer, or being rejected by the `cors`
     middleware before Express/Engine.IO's own access-log line is ever written.
4. **Root cause identified, confirmed by reading the installed library code directly, NOT
   fixed (per this variant's own "no new code, no fixes" rule):**
   `operation-service/src/realtime/realtime.gateway.ts:36-41`:
   ```ts
   @WebSocketGateway({
     cors: {
       origin: (process.env['ALLOWED_ORIGINS'] ?? '*').split(','),
       credentials: true,
     },
   })
   ```
   Live production value (value-blind-appropriate to state — this is public CORS config, not a
   secret): `ALLOWED_ORIGINS=*` on `operation-service`. `'*'.split(',')` produces the **array**
   `['*']`, never the bare string `'*'`. `engine.io` (`node_modules/engine.io/build/server.js:61-62`)
   passes this straight to the standalone `cors` npm package: `this.use(require("cors")(this.opts.cors))`.
   That package's own `configureOrigin()` (`node_modules/cors/lib/index.js:41-58`) only treats
   the origin as "allow any" when `options.origin === '*'` (the bare string) or falsy — an
   ARRAY falls through to `isOriginAllowed(requestOrigin, options.origin)`, which (for a
   string element) does `return origin === allowedOrigin` — i.e., checks whether the real
   browser `Origin` header literally equals the string `'*'`. It never does (real origins are
   `https://trading-alerts-saas-frontend.vercel.app` etc.), so `Access-Control-Allow-Origin` is
   never set and the browser's own same-origin policy blocks the WebSocket/polling handshake
   before it completes — genuinely cross-origin (`*.vercel.app` monolith → `*.up.railway.app`
   operation-service), so this was never latent-but-harmless; it fails on every real browser.
   This also explains why the Executor's own 4B-17/4B-18 CONFIRM-time `curl` verification never
   caught it: `curl` sends no `Origin` header and doesn't enforce CORS at all, so it always got
   a clean `200` regardless of whether `Access-Control-Allow-Origin` was ever correctly set —
   a real gap in how this migration's live-verification method (`curl`-based Engine.IO
   handshake checks) exercises CORS-gated paths.
5. **Not fixed in this session** — this is a real, well-understood, narrowly-scoped bug, but
   fixing it is explicit new code, forbidden by this VERIFY-RETIRE order's own Rules. Registered
   `DECISION-LOG.md` **F53** (OPEN), new `4b-18b-realtime-cors-origin-fix.migration-order.md`
   PRE-DRAFTed (PORT variant, tiny scope) to fix and re-run this exact smoke test.
6. **Session does not close as "CUT-OVER & LIVE."** F8 stays architecturally RESOLVED (the
   decision and the build are sound) but its live-production proof — the entire point of this
   session — is now a confirmed FAIL, not a pass. `CLAUDE.md`/`migration-cutover-table.md`
   updated to reflect this honestly; no row added to the cutover table for this slice (matching
   this order's own Checklist item 5 caveat — a slice that's never had a flag and has now failed
   its own live-proof session has even less claim to a "cut-over" row than a green one would).

## Next-session handoff

- **Session 4B-19 (Email rendering port)** is next in the playbook's own remaining
  Phase 4B order (`emails/*` + `lib/email/email.ts`) — independent of this session's
  own outcome either way.

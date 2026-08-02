# Migration Order: Realtime Socket.IO Architecture Decision & Build (Session 4B-17)

> Migration Order for Session **4B-17** (Realtime/Websocket Delivery — **F8**).
> Variant: **PORT/INFRA** (F8's architecture decision itself is resolved below — see
> "F8 decision"). Target: **`operation-service`'s existing HTTP process**
> (`@nestjs/websockets` + `socket.io`), scope **alert-fired notifications only**.

**Session:** 4B-17 · **Phase/plan section:** Phase 4B, plan §F8 / playbook line 326-327
**Variant:** PORT/INFRA (F8 pre-decided) · **Status:** CONFIRMED (2026-08-02)
**Generated:** 2026-08-02 (Executor PRE-DRAFT, Davin APPROVED 2026-08-02)
**Flags touched:** none required by design (ships the new path parallel; 4B-18 is cutover)
**Estimated time:** ~3-4h

**F8 decision — resolved by Davin, live, 2026-08-02** (this prep conversation, per the
script's own "present socket-architecture options for my decision before any porting"
instruction). This is Davin's real architecture call, made directly in chat before the
PRE-DRAFT was finalized — the formal `DECISION-LOG.md` F8 entry gets written when this
session itself is CONFIRMED and executed (matching this repo's own convention: a
decision made ahead of a session is carried in that session's own order text, and
logged to the registry at execution time alongside the real build evidence, not
pre-emptively before any code exists). The full option set considered, and why each
loser lost, is kept below (`## F8 decision detail`) so nothing is silently dropped.

- **Server location:** `operation-service`'s existing HTTP process (`main.ts`) —
  rejected: a new dedicated gateway service (higher setup cost, no isolation benefit
  judged necessary yet) and a managed realtime provider (new vendor/cost, not needed).
- **Client protocol:** real `socket.io-client` — rejected: hand-rolled raw-WebSocket
  server (throws away the Redis-adapter multi-node story for no benefit).
- **Scope:** alert-fired notifications only — rejected: also reviving market-tick
  streaming (that's `hooks/use-ohlcv-socket.ts` → Flask MT5's job, unrelated system).
- **Handshake auth:** verify the real NextAuth JWE via `JwtAuthGuard`'s existing
  HS256-secret path — rejected: a separate short-lived-ticket scheme (more moving
  parts, no clear benefit here).
- **Session boundary:** keep 4B-17 as one combined decide+build session, cutover stays
  4B-18 — rejected: splitting off a decision-only session first (the decision is small
  enough it doesn't need its own session).

**Provenance note:** Session 4B-12's own Next-session handoff mislabeled this slot as a
"Phase 4B Completion Review." That is stale — the playbook (line 326-327) and
`SESSION-PROMPT-SCRIPT.md` (line 187) both already fix Session 4B-17's identity as the
realtime/F8 decision-and-build session, unrelated to a completion review. This order
follows the playbook/script, not 4B-12's own drifted note. Flagged here rather than
silently reconciled, per this repo's own convention for provenance drift.

---

## Entry criteria

- [x] All 7 Phase 4B domain-slice extractions CUT-OVER & LIVE as of Session 4B-12
      (2026-08-02) — Alerts, Drawings, Notifications, Tier, User/Profile/2FA/Sessions,
      Market-Data Channel Proxy. 4B-13..16 correctly SUPERSEDED (nothing to do there).
- [x] `docs/PHASE-5-DELIVERY-AND-REALTIME-SPEC.md` (54 lines) read in full.
- [x] `docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md` (54 lines) read in full.
- [x] **Davin's live F8 decision captured** (server location, client protocol, scope,
      handshake auth, session boundary — see "F8 decision" above) — the script's own
      hard gate before any build step runs is satisfied.
- [ ] Re-verify at CONFIRM: the "raw facts" below still hold against the live codebase
      (nothing in this area is flagged as touched by any session between now and CONFIRM,
      but re-check rather than assume, per protocol — in particular re-confirm facts
      #1-#4 haven't been touched by an unrelated session in the interim).
- [ ] `DECISION-LOG.md` F8 row still reads OPEN at CONFIRM time (if some other session
      already resolved it differently in the interim, stop and reconcile before
      building against a stale decision).

---

## Raw facts found reading the two spec docs against the LIVE codebase (not the docs' own claims)

The two spec docs describe an **intended** design. Reading the actual code they cite
turns up a materially different, and more urgent, starting position than "decide where
Socket.IO lives." In order of how load-bearing each is:

1. **Nothing in production today ever calls `initWebSocketServer()`.** It is exported
   from `lib/websocket/server.ts` (349 lines) and defined nowhere else. The monolith's
   own `package.json` `start` script is plain `next start` (`package.json:11`) — no
   custom server file wraps the Next.js HTTP server to pass it into
   `initWebSocketServer(httpServer)`. A repo-wide search for the call site (excluding
   `node_modules`) finds only the function's own definition and the two spec docs
   describing it. **On Vercel specifically, this was never going to work anyway** —
   Vercel serverless functions cannot host a persistent Socket.IO server process at all;
   whatever `initWebSocketServer` was meant to attach to would need an always-on host
   Vercel doesn't provide.
2. **The browser client and the intended server speak incompatible wire protocols.**
   `lib/websocket/server.ts` is built on `socket.io` (`new Server(httpServer, {...})`) —
   Socket.IO's own Engine.IO framing, not plain WebSocket text frames. The client that's
   actually mounted in the live component tree, `hooks/use-websocket.ts` (347 lines,
   consumed by `components/charts/drawing/useFiredAlertMarkers.ts:21`, which
   `components/charts/trading-chart.tsx:59` calls on every chart render), uses the raw
   browser `WebSocket` API (`new WebSocket(wsUrl)`) and sends plain
   `JSON.stringify({type:'authenticate',...})` text frames. A real Socket.IO server does
   not understand a plain-JSON raw-WebSocket client's handshake — even if #1 were fixed
   and a real `socket.io` server were listening, this client could not complete a
   connection to it.
3. **`NEXT_PUBLIC_WS_URL` has never been set or documented for any real deployment.**
   Not in `.env.example`, not in `docs/secret-matrix.md`. Both `hooks/use-websocket.ts:136`
   and a second, unrelated file (`components/providers/websocket-provider.tsx:81`)
   default it to `ws://localhost:3001` — meaning every real production browser session
   today attempts to open a WebSocket to **the visitor's own machine**, fails, and
   silently retries with exponential backoff up to 10 times before giving up
   (`hooks/use-websocket.ts:114,232-245`). This is a live, quietly-broken feature, not a
   theoretical gap — `useFiredAlertMarkers` runs this on every mounted chart today.
4. **A second, fully orphaned realtime implementation exists.**
   `components/providers/websocket-provider.tsx` (250 lines) defines its own
   `WebSocketProvider` + a second, differently-shaped `useWebSocket()` export — a name
   collision with `hooks/use-websocket.ts`'s own export. A repo-wide search found zero
   consumers of `WebSocketProvider` anywhere (not mounted in any layout). Genuinely dead
   code, not a second code path in use.
5. **The publisher half is real and live; only the browser-delivery half is missing.**
   `operation-service/src/alert-engine/notify-bridge.service.ts` (110 lines, built
   Session 4B-2/3) correctly publishes fired-alert messages to Redis channel
   `alerts:fired` today, on every real alert fire, from `operation-service-worker`. Its
   own header (lines 6-11) says as much: _"The subscriber half (re-emit to the user's
   Socket.IO room) STAYS in the monolith web process until Session 4B-17 (F8 realtime
   decision) — this service only builds and publishes the message."_ Per fact #1-#3
   above, that "subscriber half" is not merely "still in the monolith" — it was never
   actually reachable by a real browser in production. The message shape is otherwise
   stable and worth keeping (`AlertFiredMessage { userId, notification, marker }`).
6. **Notifications already work without any of this — realtime is additive, not a hard
   dependency.** `components/notifications/notification-bell.tsx` (490 lines) fetches
   `GET /api/notifications` (Session 4B-9's now-cut-over operation-service endpoint) on
   mount and on popover-open only — plain REST polling, no socket involved. The bell
   badge is simply stale until the next fetch; the chart's "fired here" marker
   (`useFiredAlertMarkers`) is the one piece with no non-realtime fallback at all
   (there's no REST endpoint for "alerts fired since I last looked" that the chart
   polls). This lowers urgency but doesn't remove the F8 decision.
7. **A separate, unrelated, apparently-working Socket.IO client already exists — don't
   confuse it with F8's scope.** `hooks/use-ohlcv-socket.ts` uses real
   `socket.io-client` (`import { io } from 'socket.io-client'`) to stream OHLCV candle
   updates from the **Flask/Python MT5 service** (`NEXT_PUBLIC_MT5_WS_URL`, "Part 6" per
   `.env.example`), a fully separate subsystem from the Next.js/operation-service stack
   this migration is porting. `lib/websocket/server.ts`'s own `subscribe_market`/
   `broadcastMarketData` handlers (lines 143-164, 288-304) appear to have been a second,
   redundant, never-wired attempt at the same V8 market-tick-streaming idea — also dead
   per fact #1. F8's scope is decided below (Q3) to exclude market-tick streaming.
8. **`socket.io`, `socket.io-client`, and `@socket.io/redis-adapter` are all already
   monolith dependencies** (`package.json:114,136-137` — `^4.8.1`/`^4.8.3`/`^8.3.0`).
   `operation-service` has **none** of these today (`operation-service/package.json`
   checked in full) — whichever architecture is chosen, Socket.IO support there is
   net-new infrastructure, not a port of existing code.
9. **Adjacent, out-of-scope dead reference — flagged, not fixed:** the repo-root
   `railway-worker.json` (`startCommand: "npm run worker:alerts"`) and `package.json`'s
   own `worker:alerts` script both still point at `tsx scripts/alert-worker.ts` — a file
   Session 4B-3 deleted when the monolith's own alert-engine code was retired (confirmed:
   `scripts/alert-worker.ts` no longer exists). This is unrelated to F8's own scope
   (it's the OLD alert-_evaluation_ worker, not realtime _delivery_) but worth a
   deliberate decision (delete both, or leave as inert legacy) whenever someone next
   touches Railway service configs — possibly this session, if a new gateway/worker
   service is provisioned and the root-level Railway config files are touched anyway
   (Session 4B-7's own incident, `railway.json`/`.railwayignore` collisions, is the
   precedent for why root-level Railway config deserves care, not silent copying).
10. **The SCALING doc's BullMQ half is moot; only its Redis-adapter half is still live
    guidance.** `docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md` §1 describes the monolith's
    OLD `lib/alert-engine/queue.ts`/`worker.ts` BullMQ queue (`alert-fire`) — retired at
    Session 4B-3 along with the rest of the old alert-engine. The NEW operation-service
    alert engine already has its own BullMQ queue (`op.alerts.fire`, Session 4B-2/3),
    unrelated to realtime _delivery_. Only §2 (`@socket.io/redis-adapter` for multi-node
    fan-out) is still relevant to this session's decision.
11. **Auth on the (currently unreachable) `authenticate` handshake is a real, if
    currently-inert, design gap.** `lib/websocket/server.ts:120-122`'s own comment says
    _"In production, verify the token against NextAuth session / For now, we use the
    token as the userId"_ — the handshake never actually verifies anything; a connecting
    client can claim to be any `userId` and join that user's room. Since fact #1-#3 mean
    this has never been reachable in production, there's no live exposure today — but a
    rebuild must not reproduce this design. `operation-service` already has a real
    NextAuth-JWE verification path (`JwtAuthGuard`, Session 3-1) usable for a real
    handshake-time check.

---

## F8 decision detail

Presented to Davin as 5 questions before this order was finalized; each recommended
option was chosen. Full option sets kept here for the audit trail (matches this repo's
own convention of recording rejected alternatives, not just the winner — see F36/F38
in `DECISION-LOG.md` for precedent).

**Q1 — Where does the realtime server process live? → `operation-service`'s existing
HTTP process.**

- _Chosen:_ `operation-service`'s existing HTTP process (`main.ts`) via
  `@nestjs/websockets` + `socket.io`, using the already-built `RedisService`/
  `RedisModule` (Session 4B-4) as the Socket.IO Redis adapter for multi-replica
  fan-out. Lowest new-infrastructure cost — reuses the existing auth guard, logger,
  correlation-ID middleware, and deploy pipeline.
- _Rejected — new dedicated "gateway" Railway service:_ its own always-on process,
  isolated blast radius from the REST API and from `operation-service-worker`. Higher
  setup cost (new `railway.json`, new deploy target, the exact class of root-config
  collision Session 4B-7 hit) for isolation not judged necessary yet.
- _Rejected — managed realtime provider_ (Pusher/Ably/Supabase Realtime): offloads
  sticky-connection scaling entirely, but adds an external vendor, cost, and a new
  secret with no clear present need.

**Q2 — Client protocol? → real `socket.io-client`.**

- _Chosen:_ real `socket.io-client`, matching the server. Already a monolith
  dependency and already proven working elsewhere in this exact codebase
  (`hooks/use-ohlcv-socket.ts`, fact #7). Retire the incompatible raw-`WebSocket`
  `hooks/use-websocket.ts`.
- _Rejected — hand-rolled raw-WebSocket server_ compatible with the existing client:
  avoids a client-side change but means hand-maintaining framing/heartbeat/reconnect
  logic Socket.IO already solves, and throws away the `@socket.io/redis-adapter`
  multi-node story from the SCALING doc.

**Q3 — Scope? → alert-fired notifications only.**

- _Chosen:_ alert-fired/notification delivery only — matches F8's literal
  `DECISION-LOG.md` description and the Notification Bell's live-badge-update gap.
- _Rejected — also revive `subscribe_market`/`broadcastMarketData`_ (V8 XAUUSD M5/M15
  tick broadcast, dead per fact #1/#7): that's `hooks/use-ohlcv-socket.ts` → Flask
  MT5's already-working, entirely separate job — bundling it in multiplies scope/risk
  for no clear benefit.

**Q4 — Handshake auth? → verify the real NextAuth JWE.**

- _Chosen:_ verify the caller's real NextAuth JWE at connection time, reusing the same
  HS256-secret verification `JwtAuthGuard` already performs for REST calls (Session
  3-1) — a socket `auth` payload carrying the session token, checked before the socket
  joins any user-specific room. Closes fact #11's placeholder-auth gap as part of the
  rebuild rather than reproducing it.
- _Rejected — short-lived server-issued ticket_ (fetched over an authenticated REST
  call first, presented at socket-connect): avoids repeated JWE-decrypt cost per
  reconnect, but adds a new ticket-issuing endpoint/store for no requested benefit.

**Q5 — Session boundary? → keep 4B-17 combined.**

- _Chosen:_ one combined decision+build session (matching the playbook's own line
  326-327 and the script's line 187), cutover deferred to 4B-18 as already scheduled.
- _Rejected — split a decision-only CONTRACT session first_ (mirroring 4A-W1): the
  decision itself turned out small enough not to need its own session once presented
  as a clear option set.

---

## Candidate ordered steps

_(Per 00-SKELETON-AND-RULES.md — a PRE-DRAFT gives candidate steps, not a committed
plan; the Advisor upgrades this into the real DRAFT's Ordered Steps, with exact file
targets/line counts re-verified at that time. Content below is now single-branch,
since Davin's F8 decision above fixes the architecture — no more conditionals.)_

1. **`operation-service`: add Socket.IO support.** New dependencies
   (`@nestjs/websockets`, `socket.io`, `@socket.io/redis-adapter` — none exist there
   today, fact #8); a `RealtimeGateway` (`@WebSocketGateway`) using the existing
   `RedisService`/`RedisModule` (4B-4) as the adapter for multi-replica fan-out.
2. **Handshake auth.** The gateway's `handleConnection` verifies
   `socket.handshake.auth.token` as a real NextAuth JWE via the same HS256-secret path
   `JwtAuthGuard` already uses (Session 3-1); on success, `socket.join(`user:${sub}`)`;
   on failure, disconnect. Closes fact #11 — no bare-userId placeholder trust.
3. **Subscriber half.** A Redis subscriber on channel `alerts:fired` (the shape
   `operation-service/src/alert-engine/notify-bridge.service.ts` already publishes,
   fact #5 — `AlertFiredMessage { userId, notification, marker }`, unchanged) that
   re-emits to `user:<id>`'s room as a `notification` event (bell payload) and an
   `alert_fired` event (chart marker payload) — mirrors the old
   `lib/websocket/server.ts`'s emit shapes so the client-side event names/payloads
   need minimal rework.
4. **New client.** Real `socket.io-client` replacing `hooks/use-websocket.ts` in both
   consumers: `components/charts/drawing/useFiredAlertMarkers.ts` (chart marker) and
   `components/notifications/notification-bell.tsx` (live badge update, additive to
   its existing REST-poll-on-open, which stays as the durable fallback per fact #6).
   Connects to `operation-service`'s already-documented public URL
   (`OPERATION_SERVICE_URL`-adjacent), not a new `NEXT_PUBLIC_WS_URL` var — the socket
   auth payload carries the session token the same way `getOperationServiceToken()`
   already bridges it for REST calls.
5. **Retire dead code (fact #1-#4):** `lib/websocket/server.ts`,
   `hooks/use-websocket.ts`, `components/providers/websocket-provider.tsx` (the fully
   orphaned duplicate — zero consumers, confirmed), and the monolith-side subscriber
   half of `lib/alert-engine/notify-bridge.ts` (its publisher half already moved to
   operation-service at 4B-2/3; nothing in the monolith should still claim ownership
   of "the subscriber half stays here").
6. **Housekeeping (Davin-agreed, fact #9):** delete `railway-worker.json` and the
   `worker:alerts` npm script — both reference `scripts/alert-worker.ts`, deleted at
   4B-3; dead references, unrelated to F8 but cheap to clear out now.
7. **Tests.** A real e2e proof (matching this migration's established "prove it
   against the real transport, not mocks" discipline) — a real `socket.io-client`
   connecting to a real, in-process `RealtimeGateway` (via `Test.createTestingModule`
   - an actual HTTP listener, not a mocked gateway), authenticating with a real
     minted JWE, and receiving a message published to `alerts:fired` end-to-end.
8. **Do not flip any cutover-style flag this session.** 4B-18 is the named cutover
   session; 4B-17 ships the new path dormant/parallel — matches every prior Phase 4B
   PORT session's "build now, cut over later" shape. Since nothing today actually
   delivers real-time alerts in production (facts #1-#3), "parallel" here effectively
   means: deploy it, prove it live via a manual test, but don't yet make it the only
   path the shipped client code calls until 4B-18's own explicit go-ahead.

---

## Done when

- [x] F8 resolved in `DECISION-LOG.md`, recording Davin's actual decision (captured
      above) plus every rejected alternative with its one-line reason — not just the
      winner.
- [x] `operation-service`'s new gateway code builds/tests clean (`tsc --noEmit`/
      `nest build`/service test suite); monolith `tsc --noEmit`/`test:ci` clean after
      the client-side swap and dead-code retirement.
- [~] A real, live smoke test — one genuine fired alert reaching a connected,
  JWE-authenticated browser as both a notification (bell) and a chart marker —
  succeeds against `operation-service`'s new gateway, deployed but not yet the
  only path the shipped client calls (see Step 8). **Partial**: both services are
  deployed and independently live-verified (real Engine.IO handshake response from
  `operation-service`'s production URL; `/api/realtime/token` live on the monolith,
  401 unauthenticated as expected) — this session's own real e2e suite proves the
  full pipeline (auth → room join → alerts:fired delivery) end-to-end against a
  real socket.io-client and a real minted JWE. The literal browser-session portion
  (Davin's own authenticated tab, a real fired alert) was NOT run this session —
  per this migration's own established method for every prior Phase 4B live smoke
  test, that step needs Davin's own browser, not fabricated or skipped. Carried to
  this session's Next-session handoff / 4B-18's entry criteria.
- [x] Dead code from facts #1-#4 retired (`lib/websocket/server.ts`,
      `hooks/use-websocket.ts`, `components/providers/websocket-provider.tsx`, the
      monolith-side half of `lib/alert-engine/notify-bridge.ts`) — or, if any piece
      isn't reached this session, explicitly carried to 4B-18 with a stated reason.

## Rollback

Nothing is live/cut-over as of this PRE-DRAFT — there is no existing behavior to
protect (facts #1-#3 establish that real-time delivery has never actually worked in
production). Once built:

- The new `operation-service` gateway code stays unreferenced by any live traffic path
  until 4B-18's own explicit go-ahead — matching every prior Phase 4B PORT session's
  "build now, cut over later" shape.
- `operation-service`'s existing REST traffic is unaffected by the added gateway
  provider unless/until the client is repointed — rollback is simply not shipping (or
  reverting) the client-side swap if the new gateway proves unstable during this
  session's own smoke test or at 4B-18.
- If the smoke test in Step 7 fails, the old (already-broken) client code can stay in
  place with zero regression — nothing currently depends on realtime delivery working
  (fact #6, notifications degrade to REST-poll-only, which is how they already behave
  today).

## Deviations

1. **Steps 1-3 committed as one unit, not three separate commits.** All three
   (Socket.IO support, handshake auth, alerts:fired subscriber) live in one file,
   `realtime.gateway.ts` — splitting them into 3 partial commits would each leave the
   file non-compiling/non-functional. Committed together (`10924fc2`) with 11 unit
   tests covering all three concerns; recorded here per the protocol's "record every
   deviation as you make it" rule rather than silently batching.
2. **Client→browser token bridge design not fully specified by the order — resolved
   during Step 4.** The order's own text said the socket auth payload should carry the
   token "the same way `getOperationServiceToken()` already bridges it for REST
   calls," but that function is server-only (reads an `httpOnly` cookie via
   `next/headers`) — a persistent client-initiated Socket.IO connection can't be
   proxied through a Next.js route handler the way a REST call's response can. Built
   `GET /api/realtime/token` (new, monolith) as the minimal conduit: an
   authenticated-only, same-origin endpoint that hands the browser the same raw
   session token, plus `OPERATION_SERVICE_URL` to connect to. This is a direct,
   necessary consequence of the F8 Q4 decision itself (verify the real JWE at the
   socket handshake, explicitly REJECTING a short-lived ticket scheme) — exposing the
   raw token to authenticated client JS is the accepted trade-off of that choice, not
   a new one introduced here. Deliberately did NOT add a new `NEXT_PUBLIC_*` env var
   for the URL (order's own instruction) — the same endpoint serves both facts the
   client needs from one source of truth.
3. **`lib/alert-engine/notify-bridge.ts`/`types.ts` deleted in full, not just the
   "subscriber half."** The order's Step 5 text named only "the monolith-side
   subscriber half" for retirement. Verified via grep before touching anything: once
   `lib/websocket/server.ts` (the file's only remaining importer, publisher-half
   already moved to operation-service at 4B-2/3) is deleted, BOTH files have zero
   importers left anywhere in the monolith — a fully dead pair, not a file that still
   needs its publisher half kept. Deleted both, plus their test
   (`__tests__/alert-engine/notify-bridge.test.ts`), rather than leaving a
   provably-unused file behind.
4. **`lib/monitoring/system-monitor.ts` required an unplanned edit to safely execute
   Step 5.** Not named anywhere in the order — found via grep before deleting
   `lib/websocket/server.ts`: `checkWebSocket()`/`checkUserConnection()` imported
   `getConnectedUsersCount`/`isUserConnected` from it, a real (if functionally
   vacuous) consumer. `checkWebSocket()` rewritten to not depend on the deleted file,
   preserving its EXACT prior externally-observable behavior (always `healthy` —
   `initWebSocketServer()` was never called in production, so the old call always ran
   against a permanently-empty Map and could never throw). `checkUserConnection()`
   removed entirely (dead export, zero callers anywhere, confirmed via grep). Required
   to keep `tsc --noEmit`/`next build` green after Step 5 — not scope creep, a
   necessary consequence of the order's own explicit deletion target.
5. **Missing `socket.io-client` devDependency broke the first Railway deploy attempt,
   found and fixed mid-Step-8.** `realtime.gateway.e2e.spec.ts` (Step 7) imports the
   real `socket.io-client` package to drive a genuine client connection, but it was
   never added to `operation-service/package.json` — it only resolved locally via
   Node's `node_modules` directory walk-up into this monorepo's root (which has it as
   a monolith dependency). Railway's isolated single-directory build has no parent
   `node_modules` to walk up to; the first deploy attempt (`87841e61-...`) FAILED with
   `TS2307` at `nest build` time. Found via `railway logs --service operation-service
--latest --build` (the DEFAULT `railway logs` invocation — no `--latest` — silently
   showed the PRIOR successful deployment's stale logs, a new manifestation of the
   established "don't trust `railway logs`'s default target" class, see the new
   unpromoted lesson candidate below). Fixed: added `socket.io-client@^4.8.3` as a
   devDependency (matching the monolith's own pinned version, L30), redeployed clean
   (`47b093b1-...`, genuinely `SUCCESS`, independently re-verified via
   `railway service list --json`'s `latestDeployment` field, not the stale top-level
   field).
6. **Could not obtain `operation-service`'s own boot/application logs for the
   successful deployment via any `railway logs` flag combination tried this
   session** (`--latest --deployment`, `-s <id>`, `--since 15m`, plain `-n 300`, with
   and without `--latest`) — all returned empty, even though the service is
   independently confirmed healthy and serving real traffic (`GET /health` → 200,
   `GET /notifications` unauthenticated → 401, and critically a real Engine.IO
   handshake response from `GET /socket.io/?EIO=4&transport=polling` →
   `0{"sid":...,"upgrades":["websocket"],...}` — direct, unambiguous proof
   `RealtimeGateway` is attached to the live production HTTP server, independent of
   and arguably stronger evidence than a boot-log read would have been). Did not spend
   further session time chasing this CLI gap once independent live verification
   succeeded by other means; recorded as a new unpromoted `LESSONS-LEARNED.md`
   candidate below rather than promoted (file past its stated ~40 active cap).
7. **The literal browser-session live smoke test was not run this session** — see
   "Done when" above and Next-session handoff below. This is a deliberate scope
   boundary, not an oversight: minting a token against PRODUCTION's real
   `NEXTAUTH_SECRET` via a scratch script (the alternative to a real browser) would
   touch a live secret directly for a step this migration has consistently reserved
   for Davin's own browser session across every prior Phase 4B cutover-adjacent
   verification.

**New unpromoted `LESSONS-LEARNED.md` candidate** (file past its ~40 active cap, per
its own header note — not promoted to a new numbered entry without explicit
direction): `railway logs`'s default target (no `--latest`) silently shows the
**previous successful deployment's** logs when the most recent deployment failed —
already partially known (Session 4B-8's own stale-cache finding), but this session
found `--latest --build` DOES correctly surface the failed deployment's real build
error, while `--latest --deployment` (and every other flag combination tried) still
returns nothing for a deployment that DID succeed. The working combination for a
FAILED deploy's own error is specifically `--latest --build`; no combination tried
this session reliably surfaced application/boot-log output for either a failed or a
freshly-succeeded deployment — independent live HTTP/protocol-level checks (health
endpoint, a route's expected 401, or here, a raw Engine.IO handshake request) remain
the more reliable verification method than `railway logs` for confirming what's
actually running in production right now.

## Next-session handoff

- **Session 4B-18 (CUTOVER: realtime)** is already named in the playbook (line 328) and
  `SESSION-PROMPT-SCRIPT.md` (line 188: _"drain existing socket connections gracefully;
  prove one live alert → toast + chart marker end-to-end before I approve"_) — its own
  entry criteria must now include the literal browser-session live smoke test this
  session left undone (Deviation 7): Davin opens an authenticated tab with the
  notification bell and/or a chart mounted, and either waits for/triggers a real
  alert fire or verifies via DevTools that the socket connects, authenticates
  (`authenticated` event), and joins its room — before 4B-18 flips anything.
- Every rejected alternative from the F8 decision (new gateway service, managed
  provider, raw-WebSocket protocol, market-tick scope, ticket-based auth, split
  session) has landed in `DECISION-LOG.md`'s F8 entry alongside the winner — done
  this session, matching this repo's own convention for every prior multi-option
  flag resolution (F36, F38, etc.).

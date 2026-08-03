# Migration Order — PORT variant (tiny scope)

> Session **4B-18b** (Realtime CORS origin fix + live re-verification, **F53**'s fix). Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: this is a one-file,
> well-understood config fix, not new feature work. Worked example for the finding itself:
> `4b-18-realtime-cutover.migration-order.md`'s own Deviations and `DECISION-LOG.md` F53.

**Session:** 4B-18b · **Variant:** PORT (tiny scope) · **Status:** CONFIRMED
**Generated:** 2026-08-02 (Executor PRE-DRAFT at 4B-18 close; Approved by Antigravity Advisor 2026-08-03;
CONFIRMED by Executor 2026-08-03 — all 3 entry criteria re-verified live and PASSED, zero drift on
the order body since PRE-DRAFT; Davin gave live GO) ·
**Flags touched:** F53 · **Estimated time:** <30min
**Target service:** operation-service
**Contract:** none (internal gateway config, not an API surface change)

## Background (read before touching anything)

Session 4B-18's own live browser smoke test (Davin, real authenticated tab, `/charts/XAUUSD/M5`)
found the realtime socket never connects or authenticates in production — 9 consecutive
`connect_error: websocket error` failures, no `authenticated` event, ever. Root-caused with
certainty by reading the installed library code directly (`node_modules/cors/lib/index.js`,
`node_modules/engine.io/build/server.js`), not just inferred from symptoms — full chain in
`DECISION-LOG.md` **F53**:

`operation-service/src/realtime/realtime.gateway.ts:36-41`:

```ts
@WebSocketGateway({
  cors: {
    origin: (process.env['ALLOWED_ORIGINS'] ?? '*').split(','),
    credentials: true,
  },
})
```

Live production has `ALLOWED_ORIGINS=*`. `'*'.split(',')` always produces the **array** `['*']`,
never the bare string `'*'`. The standalone `cors` npm package (which `engine.io` delegates to
directly) only treats the origin as "allow any" when it is **exactly** the bare string `'*'` or
falsy (`node_modules/cors/lib/index.js:41`); an array falls through to an exact-match check
against the real browser `Origin` header, which never literally equals `'*'` — so
`Access-Control-Allow-Origin` is never set and every genuinely cross-origin browser connection
(`*.vercel.app` monolith → `*.up.railway.app` operation-service) is silently rejected.

This was invisible to every prior verification because those checks used `curl`, which sends no
`Origin` header and does not enforce CORS at all.

## Entry criteria

- [x] Session 4B-18 CONFIRMED and closed (RED result, F53 registered — see `CLAUDE.md`
      Current/Waiting-on #98, `4b-18-realtime-cutover.migration-order.md`'s own Deviations).
      Verified via commit `8a46fb71` and `DECISION-LOG.md`'s full F53 entry (still OPEN).
- [x] Re-verify at CONFIRM: `ALLOWED_ORIGINS` is still `*` on operation-service production (or,
      if Davin has since set it to a real explicit origin list, re-read this order's own fix
      against whatever the live value now is — the fix must handle BOTH cases correctly, not
      just the wildcard one). Confirmed live via Railway (`ALLOWED_ORIGINS=*`) — public CORS
      config, not a secret, per `DECISION-LOG.md` F53's own note.
- [x] Re-verify at CONFIRM: `realtime.gateway.ts`'s `cors` config is unchanged since 4B-18's own
      close (nobody else touched it in the interim). Confirmed via `git log 8a46fb71..HEAD` —
      zero commits touch this file (HEAD is still `8a46fb71`, zero commits landed at all since
      4B-18 closed).

## File Port Order

### File 1/1

- **SOURCE / TARGET:** `operation-service/src/realtime/realtime.gateway.ts` (same file, in place —
  not a cross-stack port, a targeted bugfix to code shipped this session's own predecessor, 4B-17)
- **Kind:** port + adapt (fix a CORS option so it behaves correctly for BOTH the wildcard case
  and a real explicit allow-list, not a rewrite)
- **Fix steps:**
  1. Read `ALLOWED_ORIGINS` once; if it is unset or literally `'*'`, pass the **bare string**
     `'*'` as `cors.origin` (matching `cors` package's own documented wildcard contract). Only
     when it holds a real comma-separated list of explicit origins, pass the `.split(',')` array.
  2. Do not change `credentials: true` — unaffected by this bug, and the client doesn't rely on
     cookie-based auth for this gateway (handshake uses `auth: { token }`, not cookies), so this
     is out of scope regardless.
  3. Do not touch anything else in this file — same "low creativity dial" discipline as every
     PORT variant; this is a one-condition fix, not a refactor.
- **Invariants:** the handshake JWE-auth path (`decodeNextAuthToken`), Redis-adapter fan-out,
  `alerts:fired` subscription, and `deliver()`'s room-scoped emit are all untouched and must stay
  byte-identical — this order touches ONLY the `cors.origin` derivation.
- **Parity proof:** `realtime.gateway.spec.ts`/`realtime.gateway.e2e.spec.ts` (existing, from
  4B-17) must still pass unmodified — they don't exercise real cross-origin CORS (an in-process
  Nest test has no real `Origin` header semantics to trip on), so they prove no regression, not
  proof of the fix. The actual proof is Checklist step 2 below: a REAL browser, cross-origin,
  successfully connecting — something no `curl`-based check can substitute for (see F53's own
  finding on why `curl` verification is insufficient for this specific bug class).
- **Commit:** `fix(4b-18b): correct RealtimeGateway CORS origin wildcard handling (F53)`

## Rules specific to this variant

- One file, one condition change. Any temptation to also touch `credentials`, add a new env var,
  or restructure the gateway's CORS handling more broadly is scope creep — resist it; if
  `ALLOWED_ORIGINS` itself needs a real explicit-origin-list policy decision (vs. staying
  wildcard indefinitely), that's a separate, Davin-level product/security decision, not this
  session's call.
- `tsc --noEmit` + the existing `operation-service` suite must stay green — same baseline as
  4B-18's own CONFIRM (42/42 suites, 375/375 tests), plus/minus only whatever this fix's own new
  unit coverage adds.

## Slice-level verification (done when)

- [x] New unit coverage proving the fix's actual branching: `ALLOWED_ORIGINS` unset/`'*'` →
      `cors.origin === '*'` (bare string, not an array); `ALLOWED_ORIGINS` set to a real
      comma-separated list → `cors.origin` is the split array. (A unit test can assert the
      constructed option value directly — it does not need a real browser to prove the
      TypeScript-level branching is correct; the browser proof is Checklist step 2, below.)
      4 new tests, all pass.
- [x] `operation-service` full suite green, no regression vs. the 4B-18 baseline. 42/42 suites,
      379/379 tests (was 375, +4).
- [x] Deployed to production (`railway up --path-as-root --service operation-service`, per
      `LESSONS-LEARNED.md` L38 — this service has no connected GitHub source). Deployment
      `2116bd43` SUCCESS.
- [ ] **Checklist step 2 — the actual proof, mirroring 4B-18's own Checklist verbatim:** Davin
      re-runs the identical live browser smoke test (authenticated tab, `/charts/<symbol>/<tf>`
      with a line-touch alert armed or naturally firing). This time confirm the socket
      **connects and authenticates** (an `authenticated` event with the real `userId`), then
      confirm one real alert fire delivers BOTH `notification` and `alert_fired` events. Any red
      result here → stop again, do not declare closed, escalate — this order's own fix is
      narrowly scoped to the ONE root cause found; if the smoke test still fails after this fix,
      that is a NEW finding, not evidence this fix was wrong.
      **FAILED — see Deviation 6.** A new, distinct root cause was found (Deviation 8, F54):
      the monolith's CSP `connect-src` never included operation-service's origin.
- [x] Independent Railway HTTP-log cross-check (Executor) of the connection succeeding,
      mirroring 4B-18's own method — this time expecting a real, logged `GET /socket.io/...`
      (or WS-upgrade-equivalent) entry timestamp-correlated to Davin's test, not an absence.
      **Done — result was the absence, confirming the browser's own report rather than
      contradicting it (Deviation 7).**

## Cutover & rollback

- No flag exists for this slice (unchanged from 4B-18's own framing) — there is nothing to flip.
  Rollback, if the fix itself somehow regresses something: `git revert` this order's own single
  commit; zero regression to anything that worked before, since nothing depended on this gateway
  working in production before 4B-17/4B-18 either.

## Deviations

**Session executed 2026-08-03. Fix built, tested, and deployed clean — but the live browser
smoke test (Checklist step 2) still FAILED. This session does NOT close as successful; F53
itself is resolved, but F8/Slice-6 realtime delivery is still not live in production. Full
detail below, mirroring 4B-18's own "RED result, do not close as successful" precedent.**

1. **File 1/1 built exactly as scoped.** `resolveRealtimeCorsOrigin()` extracted as a pure,
   exported function in `realtime.gateway.ts` (not inlined in the decorator) so it could be
   unit-tested directly per the order's own Done-when wording ("assert the constructed option
   value directly"). `credentials: true` and everything else in the file left untouched, per the
   order's own low-dial discipline.
2. **New unit coverage (4 tests, `realtime.gateway.spec.ts`):** unset → bare `'*'`; literal `'*'`
   → bare `'*'`; multi-origin comma-separated list → split array; single explicit origin → single-
   element array (not the wildcard). All 4 pass.
3. **Full suite + build:** `operation-service` 42/42 suites, 379/379 tests (was 375 — +4, exactly
   the new coverage, zero regression). `tsc --noEmit` clean. `nest build` clean.
4. **Deployed clean:** `railway up --path-as-root --service operation-service` — deployment
   `2116bd43-a03d-4d77-9586-f77439334ff9` genuinely `SUCCESS` (checked `latestDeployment.status`,
   not the stale top-level field, per L38). `/health` → 200.
5. **F53 itself independently re-verified as genuinely fixed, beyond the order's own minimum
   proof requirement.** Sent a real cross-origin `OPTIONS` preflight WITH an actual `Origin`
   header (`https://trading-alerts-saas-frontend.vercel.app`) at the deployed Engine.IO endpoint
   — before this fix this would never have set the CORS header at all; it now correctly returns
   `access-control-allow-origin: *` + `access-control-allow-credentials: true`. Cross-checked that
   this combination is actually safe here (not a spec violation that browsers would reject): read
   `hooks/use-realtime-socket.ts` and confirmed the client's `io(url, { auth: { token } })` call
   sets no `withCredentials`, so this connection is never credentialed — the wildcard-origin +
   credentials-true combination (which browsers DO reject for genuinely credentialed requests) is
   a non-issue here. This is real, protocol-level proof the specific F53 bug is fixed — stronger
   than a bare `curl` check (which sends no Origin header at all), though still short of a real
   browser.
6. **Checklist step 2 — Davin's real browser smoke test — FAILED.** Authenticated tab,
   `/charts/XAUUSD/M5`, watched for 5+ minutes across two page loads including a fresh reload.
   Console showed `Realtime socket connect error: websocket error` recurring every ~5-6s
   continuously. UI's own connection indicator stayed red/"Disconnected". No `authenticated` event
   ever observed. Network tab showed **zero** `GET /socket.io/...` entries — only the initial
   `GET /api/realtime/token` (200, same-origin) succeeded. Step 4 (arm/observe a real alert fire)
   correctly NOT attempted, per this order's own explicit stop-on-red rule.
7. **Independent Railway HTTP-log cross-check (Executor) — confirms the browser's own report,
   does not contradict it.** Pulled `operation-service`'s real HTTP access log for the exact
   window (`railway logs --http --since 30m -n 300`, pairing `--http` with an explicit `-n` per
   the 4B-8-era lesson on this command's empty-without-`-n` trap). During Davin's actual test
   window (~00:33-00:40 UTC), the ONLY entries are `GET /drawings 200` (the monolith's own
   server-side forward — proves general page-load/connectivity was fine) — **zero `/socket.io/`
   entries of any kind**, exactly the same signature 4B-18's own original RED result showed. My
   own two manual `curl`/`OPTIONS` checks (00:31:36-37) are visible in the same log as the only
   `/socket.io/` lines present anywhere in the window — confirming Railway/operation-service DOES
   log real socket.io requests when they arrive; their total absence during Davin's real test is
   not a logging gap, it's a real signal the browser never sent the request at all.
8. **A NEW finding, found via further read-only diagnosis (no code changed) before escalating,
   per this order's own "escalate... with the new evidence" instruction — not a second
   speculative fix:**
   - Re-read `node_modules/engine.io/build/server.js`'s `handleUpgrade()`: engine.io's `cors`
     middleware DOES run on the WebSocket upgrade path too (via a `WebSocketResponse` shim), but
     `node_modules/cors/lib/index.js`'s `configureOrigin()` never aborts the request on an origin
     mismatch — it only omits/sets the `Access-Control-Allow-Origin` header and always calls
     `next()`. That header has no effect on a raw WebSocket handshake at all: browsers do not
     enforce CORS-style origin checks for `WebSocket` connections (unlike `fetch`/XHR) — Origin
     enforcement for WS is the SERVER's own responsibility, not something `Access-Control-Allow-
Origin` controls. Since `hooks/use-realtime-socket.ts` requests `transports: ['websocket',
'polling']` (websocket attempted first, Engine.IO v4's direct-WS-connect feature), F53's own
     CORS bug may never have been the layer actually blocking the live browser symptom in the
     first place — it is still a real, confirmed, correctly-fixed bug (it WOULD have blocked the
     polling fallback, a genuine `fetch`-based transport that IS CORS-gated), just not
     conclusively THE explanation for the WS-first failure mode observed live both times.
   - Scripted a raw WebSocket handshake directly against the deployed endpoint (Node's `ws`
     package, `wss://operation-service-production.up.railway.app/socket.io/?EIO=4&transport=
websocket`, a real `Origin` header set) — **it succeeded**: `OPEN`, followed by a real Engine.IO
     handshake payload (`0{"sid":...}`). This rules out a server/Railway-infra-level rejection of
     the WS upgrade entirely — the deployed fix, the server, and Railway's edge all accept the
     connection fine outside a browser.
   - Read `next.config.js`'s security-headers block (lines 119-134) and found the actual blocker:
     its `Content-Security-Policy`'s `connect-src` directive is
     `'self' https://api.stripe.com https://checkout.stripe.com wss://*.pusher.com https://*.vercel-analytics.com`
     — **`operation-service-production.up.railway.app` (or any `*.up.railway.app` wildcard) is
     not present.** `connect-src` governs every `fetch`/XHR/WebSocket connection the page
     initiates; a cross-origin destination absent from it is blocked by the BROWSER itself before
     any network request is ever sent — which matches every piece of evidence gathered this
     session and in 4B-18's own original investigation: zero server-side log entries (the request
     never left the browser), a generic `connect_error: websocket error` (exactly what socket.io-
     client emits on a CSP-blocked connection attempt), `/api/realtime/token` working fine
     (same-origin, `'self'` covers it), and the raw Node `ws` test succeeding (Node does not
     enforce CSP — a browser-only mechanism).
   - `wss://*.pusher.com` in the same directive is confirmed dead/stale — a repo-wide grep found
     zero code anywhere referencing Pusher; this predates the realtime feature entirely (`git log`
     on `next.config.js` shows its 3 most recent commits are Phase 5 Next.js-16-upgrade/Vercel-
     deploy fixes, none touching CSP, none newer than Session 4B-17 which built the feature this
     CSP was never updated for).
   - **Not fixed this session — deliberately, per this order's own explicit instruction** ("stop,
     do not attempt a second speculative fix in the same session — escalate to Davin/Advisor with
     the new evidence"). `next.config.js` was read-only this session; zero bytes changed in it.
9. **Open question flagged for the next session, not resolved here:** whether this same CSP gap
   was ALSO the (or an) actual blocker in 4B-18's own original RED result, independent of F53 —
   the evidence (zero server-log entries in BOTH 4B-18's original test and this session's re-test)
   is consistent with CSP having been the real blocker both times, with F53's CORS bug being a
   real-but-never-actually-reached secondary issue for the WS-first path. Both bugs are now
   understood; only CSP is unfixed. The next session's own live proof, once the CSP fix ships,
   will be the first real evidence either way.

## F53 status: RESOLVED (the specific CORS array-vs-wildcard-string bug — verified fixed via a

real cross-origin preflight probe, see Deviation 5). **F8/Slice-6 realtime delivery is still NOT
live in production** — blocked on the newly-found CSP gap (registered as its own flag,
`DECISION-LOG.md` **F54**), carried forward to `4b-18c-realtime-csp-connect-src-fix.migration-
order.md` (PRE-DRAFTed at this session's close).

## Known wrinkles / do-not-touch

- Do not widen `ALLOWED_ORIGINS`'s own semantics or add new env vars — this is a bugfix to
  existing, already-decided (F8) config handling, not a new design surface.
- Do not touch `hooks/use-realtime-socket.ts`, the token route, or either consumer
  (`useFiredAlertMarkers.ts`, `notification-bell.tsx`) — none of them are implicated by F53's
  own root-cause chain.

## Next-session handoff

- **The live proof failed after this fix — per this order's own rule, escalated rather than
  patched further in-session.** F53 itself is genuinely resolved (Deviation 5). A new, distinct,
  well-evidenced root cause was found (Deviation 8): `next.config.js`'s CSP `connect-src`
  directive never included operation-service's origin, blocking the connection client-side before
  any network request is sent — consistent with every piece of evidence in both this session and
  4B-18's own original test.
- New `4b-18c-realtime-csp-connect-src-fix.migration-order.md` PRE-DRAFTed (PORT, tiny scope,
  same shape as this order) — add `https://operation-service-production.up.railway.app` (and a
  `wss://` entry for the WebSocket scheme) to `connect-src`; carries this order's own Deviation 8
  evidence forward as its Background. Whether to also remove the confirmed-dead
  `wss://*.pusher.com` entry is flagged as an explicit scope question for that order, not decided
  here (out of this session's own scope to decide unilaterally).
- Do **not** proceed to Session 4B-19 (Email rendering port) until 4B-18c's own live proof
  actually passes — F8/Slice-6 realtime delivery is still not live in production.

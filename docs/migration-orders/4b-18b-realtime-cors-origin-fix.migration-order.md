# Migration Order — PORT variant (tiny scope)

> Session **4B-18b** (Realtime CORS origin fix + live re-verification, **F53**'s fix). Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: this is a one-file,
> well-understood config fix, not new feature work. Worked example for the finding itself:
> `4b-18-realtime-cutover.migration-order.md`'s own Deviations and `DECISION-LOG.md` F53.

**Session:** 4B-18b · **Variant:** PORT (tiny scope) · **Status:** PRE-DRAFT
**Generated:** 2026-08-02 (Executor PRE-DRAFT, at Session 4B-18's own close) ·
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

- [ ] Session 4B-18 CONFIRMED and closed (RED result, F53 registered — see `CLAUDE.md`
      Current/Waiting-on #98, `4b-18-realtime-cutover.migration-order.md`'s own Deviations).
- [ ] Re-verify at CONFIRM: `ALLOWED_ORIGINS` is still `*` on operation-service production (or,
      if Davin has since set it to a real explicit origin list, re-read this order's own fix
      against whatever the live value now is — the fix must handle BOTH cases correctly, not
      just the wildcard one).
- [ ] Re-verify at CONFIRM: `realtime.gateway.ts`'s `cors` config is unchanged since 4B-18's own
      close (nobody else touched it in the interim).

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

- [ ] New unit coverage proving the fix's actual branching: `ALLOWED_ORIGINS` unset/`'*'` →
      `cors.origin === '*'` (bare string, not an array); `ALLOWED_ORIGINS` set to a real
      comma-separated list → `cors.origin` is the split array. (A unit test can assert the
      constructed option value directly — it does not need a real browser to prove the
      TypeScript-level branching is correct; the browser proof is Checklist step 2, below.)
- [ ] `operation-service` full suite green, no regression vs. the 4B-18 baseline.
- [ ] Deployed to production (`railway up --path-as-root --service operation-service`, per
      `LESSONS-LEARNED.md` L38 — this service has no connected GitHub source).
- [ ] **Checklist step 2 — the actual proof, mirroring 4B-18's own Checklist verbatim:** Davin
      re-runs the identical live browser smoke test (authenticated tab, `/charts/<symbol>/<tf>`
      with a line-touch alert armed or naturally firing). This time confirm the socket
      **connects and authenticates** (an `authenticated` event with the real `userId`), then
      confirm one real alert fire delivers BOTH `notification` and `alert_fired` events. Any red
      result here → stop again, do not declare closed, escalate — this order's own fix is
      narrowly scoped to the ONE root cause found; if the smoke test still fails after this fix,
      that is a NEW finding, not evidence this fix was wrong.
- [ ] Independent Railway HTTP-log cross-check (Executor) of the connection succeeding,
      mirroring 4B-18's own method — this time expecting a real, logged `GET /socket.io/...`
      (or WS-upgrade-equivalent) entry timestamp-correlated to Davin's test, not an absence.

## Cutover & rollback

- No flag exists for this slice (unchanged from 4B-18's own framing) — there is nothing to flip.
  Rollback, if the fix itself somehow regresses something: `git revert` this order's own single
  commit; zero regression to anything that worked before, since nothing depended on this gateway
  working in production before 4B-17/4B-18 either.

## Deviations

_(empty — filled during execution once this order is CONFIRMED and run)_

## Known wrinkles / do-not-touch

- Do not widen `ALLOWED_ORIGINS`'s own semantics or add new env vars — this is a bugfix to
  existing, already-decided (F8) config handling, not a new design surface.
- Do not touch `hooks/use-realtime-socket.ts`, the token route, or either consumer
  (`useFiredAlertMarkers.ts`, `notification-bell.tsx`) — none of them are implicated by F53's
  own root-cause chain.

## Next-session handoff

- If this session's own live proof passes clean: F8/Slice-6 realtime delivery can genuinely be
  considered live in production for the first time. Next in the playbook's own remaining Phase 4B
  order is unchanged — **Session 4B-19 (Email rendering port)**.
- If the live proof still fails after this fix: stop, do not attempt a second speculative fix in
  the same session — escalate to Davin/Advisor with the new evidence, per this variant's own
  low-dial discipline.

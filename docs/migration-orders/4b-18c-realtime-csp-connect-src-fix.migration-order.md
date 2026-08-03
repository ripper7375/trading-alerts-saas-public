# Migration Order — PORT variant (tiny scope)

> Session **4B-18c** (Realtime CSP `connect-src` fix + live re-verification, **F54**'s fix). Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: this is a one-file,
> well-understood config fix, not new feature work. Worked example for the finding itself:
> `4b-18b-realtime-cors-origin-fix.migration-order.md`'s own Deviations and `DECISION-LOG.md` F54.

**Session:** 4B-18c · **Variant:** PORT (tiny scope) · **Status:** PRE-DRAFT
**Generated:** 2026-08-03 (Executor PRE-DRAFT, at Session 4B-18b's own close) ·
**Flags touched:** F54 · **Estimated time:** <30min
**Target service:** monolith (Next.js, `next.config.js`)
**Contract:** none (internal security-header config, not an API surface change)

## Background (read before touching anything)

Session 4B-18b fixed and independently verified `DECISION-LOG.md` F53 (a real, confirmed CORS
`origin` array-vs-wildcard-string bug in `RealtimeGateway`) — a real cross-origin `OPTIONS`
preflight against the deployed, fixed endpoint now correctly returns `access-control-allow-origin:
*`. **Davin's live browser smoke test still FAILED after that fix, identically to 4B-18's own
original RED result:** authenticated tab, `/charts/XAUUSD/M5`, recurring `Realtime socket connect
error: websocket error` every ~5-6s, connection indicator stayed red/"Disconnected", no
`authenticated` event ever, zero `GET /socket.io/...` network entries.

4B-18b's own further read-only diagnosis (no code changed that session, per its own "escalate with
new evidence, don't speculative-fix" rule) found the real blocker, root-caused with certainty:

`next.config.js:119-134` (the monolith's site-wide security-headers block):

```js
{
  key: 'Content-Security-Policy',
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://checkout.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://*.githubusercontent.com https://*.stripe.com",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://checkout.stripe.com wss://*.pusher.com https://*.vercel-analytics.com",
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; '),
},
```

`connect-src` governs every `fetch`/XHR/WebSocket connection the page initiates.
`operation-service-production.up.railway.app` (in any scheme) is not present in it — the browser
blocks the connection itself, client-side, before any network request is ever sent, regardless of
whether the destination server's own CORS config is correct. This is a genuinely SEPARATE gate
from CORS: CORS controls whether a browser exposes a cross-origin RESPONSE to page JavaScript;
CSP's `connect-src` controls whether the browser will even ATTEMPT the connection at all. Fixing
one says nothing about the other.

**Ruled out before concluding this was the cause (4B-18b's own diagnostic work, not asserted):**
(1) re-read `engine.io`'s `handleUpgrade()` and `cors`'s own `configureOrigin()` — confirmed the
`cors` middleware never aborts a request on an origin mismatch, and `Access-Control-Allow-Origin`
has no bearing on a raw WebSocket handshake at all (browsers don't enforce CORS on WS the way they
do `fetch`/XHR) — meaning F53's own bug, while real and correctly fixed, may never have actually
been the layer blocking this specific WS-first connection path
(`hooks/use-realtime-socket.ts` requests `transports: ['websocket', 'polling']`, websocket first).
(2) scripted a raw WebSocket handshake (Node's `ws` package, a real `Origin` header) directly
against the deployed, already-F53-fixed endpoint — it **succeeded** (`OPEN`, a real Engine.IO
handshake payload received) — ruling out a server- or Railway-infra-level rejection entirely.
(3) pulled `operation-service`'s real Railway HTTP access log for Davin's exact test window — zero
`/socket.io/` entries of any kind, while the Executor's own manual `curl`/Node checks minutes
earlier DID appear in that same log — confirming Railway logs real socket.io requests when they
arrive, so their total absence during Davin's real test is a genuine "never sent," not a logging
gap. All three findings are consistent with, and only with, a client-side (browser) block — CSP
`connect-src` is the one mechanism that fits every piece of evidence.

**Separately confirmed:** `wss://*.pusher.com` in the same `connect-src` directive is dead/stale —
a repo-wide grep found zero code anywhere referencing Pusher; `next.config.js`'s own recent git
history shows no CSP-touching commit since well before Session 4B-17 built the realtime feature
this CSP was never updated for.

## Entry criteria

- [ ] Session 4B-18b CONFIRMED and closed (F53 RESOLVED, F54 registered — see `CLAUDE.md`
      Current/Waiting-on #99, `4b-18b-realtime-cors-origin-fix.migration-order.md`'s own
      Deviations).
- [ ] Re-verify at CONFIRM: `next.config.js`'s CSP `connect-src` directive is unchanged since
      4B-18b's own close (nobody else touched it in the interim) — re-read the live file, don't
      trust this order's own quoted copy above.
- [ ] Re-verify at CONFIRM: `operation-service`'s live production URL is still
      `https://operation-service-production.up.railway.app` (the exact string this order's fix
      adds) — a Railway URL change would need this order's own fix value corrected before
      executing, not just copy-pasted.

## File Port Order

### File 1/1

- **SOURCE / TARGET:** `next.config.js` (same file, in place — a targeted config fix, not a
  cross-stack port)
- **Kind:** port + adapt (widen one CSP directive by one origin; not a rewrite)
- **Fix steps:**
  1. Add `https://operation-service-production.up.railway.app` to the `connect-src` directive's
     value list (line 127). WebSocket connections to that same host use the `wss://` scheme at
     the protocol level, but CSP `connect-src` entries match by origin regardless of `http(s)`
     vs `ws(s)` scheme for the SAME host — confirm this against the current MDN/CSP Level 3 spec
     behavior before assuming either a bare `https://` entry suffices or a separate `wss://`
     entry is required; add whichever the spec actually requires (possibly both, to be safe and
     explicit, since this is cheap and low-risk).
  2. Do not add a `NEXT_PUBLIC_*` or other new env var for this — the target host is a fixed,
     already-known production value (same precedent as the other hardcoded entries already in
     this directive, e.g. `https://api.stripe.com`). If Davin wants this made
     environment-configurable in the future, that's a separate, larger decision — not this tiny
     PORT session's call.
  3. Do NOT remove `wss://*.pusher.com` in this same edit — it is confirmed dead/stale, but
     removing it is a separate, distinct change with its own (near-zero, but non-zero) risk;
     flag it to Davin as an option, let him decide, don't bundle it into this fix silently.
  4. Do not touch anything else in this file — same "low creativity dial" discipline as every
     PORT variant; this is a one-line addition, not a broader CSP hardening pass.
- **Invariants:** every other CSP directive, every other security header in this same
  `headers()` block (`Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`,
  `X-XSS-Protection`), and the route matcher this block applies under must all stay
  byte-identical — this order touches ONLY the `connect-src` value string.
- **Parity proof:** no existing automated test covers this CSP header's literal content (a repo
  search should confirm this before assuming otherwise — if one exists, it must still pass
  unmodified except for the one new origin it now expects). The actual proof is Checklist step 2
  below: a REAL browser, actually attempting the cross-origin WebSocket connection this CSP
  directive gates — something no automated test in this repo currently exercises, and no
  `curl`/Node script can substitute for (CSP enforcement, like CORS response-reading, only exists
  inside an actual browser JS engine — see `LESSONS-LEARNED.md`'s newest candidate note, filed at
  4B-18b's close).
- **Commit:** `fix(4b-18c): add operation-service origin to monolith CSP connect-src (F54)`

## Rules specific to this variant

- One file, one directive, one addition (plus, if Davin approves live, one removal of the
  confirmed-dead `pusher.com` entry — ask, don't assume). Any temptation to restructure the CSP
  block more broadly, add nonces, or "harden while we're in here" is scope creep — resist it.
- `tsc --noEmit` + `eslint --max-warnings 0` + `next build` must all stay green — same baseline
  this repo has used as its real check since Session 4A-7a (`LESSONS-LEARNED.md` L20 — the
  literal `npm run validate` chain's `validate:format`/`validate:policies` steps are a known,
  pre-existing, unrelated Windows/CRLF gap, not this order's concern).

## Slice-level verification (done when)

- [ ] `next.config.js`'s `connect-src` directive verified (via a fresh `curl -I` against the live
      production URL, or a browser DevTools Network tab check on the response headers) to
      genuinely include operation-service's origin post-deploy — don't just trust the source diff,
      confirm the header the browser will actually receive.
- [ ] Monolith `tsc --noEmit`/`eslint --max-warnings 0`/`next build` all clean, no regression.
- [ ] Deployed to production (`vercel --prod --archive=tgz --yes`, per `LESSONS-LEARNED.md` L36 —
      this monorepo needs the `--archive=tgz` flag).
- [ ] **Checklist step 2 — the actual proof, mirroring 4B-18/4B-18b's own Checklist verbatim:**
      Davin re-runs the identical live browser smoke test (authenticated tab,
      `/charts/<symbol>/<tf>` with a line-touch alert armed or naturally firing). This time confirm
      the socket **connects and authenticates** (an `authenticated` event with the real `userId`),
      then confirm one real alert fire delivers BOTH `notification` and `alert_fired` events. Any
      red result here → stop again, do not declare closed, escalate — F53 and F54 are the only two
      root causes found and fixed across this 3-session arc; if the smoke test STILL fails after
      both fixes, that is a genuinely NEW, third finding, not evidence either fix was wrong.
- [ ] Independent Railway HTTP-log cross-check (Executor) of the connection succeeding, mirroring
      4B-18/4B-18b's own method — this time expecting a real, logged `GET /socket.io/...` (or
      WS-upgrade-equivalent) entry on `operation-service`'s side, timestamp-correlated to Davin's
      test, not an absence.

## Cutover & rollback

- No flag exists for this slice (unchanged from 4B-18/4B-18b's own framing) — there is nothing to
  flip. Rollback, if the fix itself somehow regresses something: `git revert` this order's own
  single commit; zero regression to anything that worked before, since nothing depended on
  operation-service's origin being CSP-allowed before this fix either.

## Deviations

_(empty — filled during execution once this order is CONFIRMED and run)_

## Known wrinkles / do-not-touch

- Do not widen `connect-src` (or any other CSP directive) beyond the one origin this fix needs —
  this is a targeted bugfix, not a CSP redesign.
- Do not remove `wss://*.pusher.com` without Davin's explicit live say-so, even though it's
  confirmed dead — ask first, per this order's own Rules section.
- Do not touch `realtime.gateway.ts`, `hooks/use-realtime-socket.ts`, the token route, or either
  consumer (`useFiredAlertMarkers.ts`, `notification-bell.tsx`) — none of them are implicated by
  F54's own root-cause chain; F53's own fix (a different file, a different session) already covers
  everything realtime-code-side this arc has found so far.

## Next-session handoff

- If this session's own live proof passes clean: F8/Slice-6 realtime delivery can genuinely be
  considered live in production for the first time, closing out the 3-session F53/F54 arc
  (4B-18 → 4B-18b → 4B-18c). Next in the playbook's own remaining Phase 4B order is unchanged —
  **Session 4B-19 (Email rendering port)**.
- If the live proof still fails after this fix: stop, do not attempt a second speculative fix in
  the same session — escalate to Davin/Advisor with the new evidence, per this variant's own
  low-dial discipline. A third distinct root cause at this point would be a strong signal this
  needs a broader, non-PORT-shaped investigation session rather than another tiny targeted fix.

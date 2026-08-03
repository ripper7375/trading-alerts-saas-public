# Migration Order — PORT variant (tiny scope)

> Session **4B-18c** (Realtime CSP `connect-src` fix + live re-verification, **F54**'s fix). Read
> `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at **Low**: this is a one-file,
> well-understood config fix, not new feature work. Worked example for the finding itself:
> `4b-18b-realtime-cors-origin-fix.migration-order.md`'s own Deviations and `DECISION-LOG.md` F54.

**Session:** 4B-18c · **Variant:** PORT (tiny scope) · **Status:** CONFIRMED
**Generated:** 2026-08-03 (Executor PRE-DRAFT at 4B-18b close; Approved by Antigravity Advisor 2026-08-03;
CONFIRMED by Claude Code CLI 2026-08-03 — all 3 entry criteria independently re-verified live and
PASSED with zero drift; Davin confirmed the PRE-DRAFT→APPROVED status edit was Antigravity's own
authentic edit; GO given) ·
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

- [x] Session 4B-18b CONFIRMED and closed (F53 RESOLVED, F54 registered — see `CLAUDE.md`
      Current/Waiting-on #99, `4b-18b-realtime-cors-origin-fix.migration-order.md`'s own
      Deviations). Verified live: `DECISION-LOG.md` F53 = RESOLVED, F54 = OPEN (due this session).
- [x] Re-verify at CONFIRM: `next.config.js`'s CSP `connect-src` directive is unchanged since
      4B-18b's own close (nobody else touched it in the interim). Verified: `git log -- next.config.js`
      shows no commits since `be62d87f` (a pre-4B-17 Phase-5 fix); live file read matches this
      order's quoted copy exactly, byte-for-byte, including the dead `wss://*.pusher.com` entry.
- [x] Re-verify at CONFIRM: `operation-service`'s live production URL is still
      `https://operation-service-production.up.railway.app`. Verified via `railway service list
    --json` (status `SUCCESS`, deployment `2116bd43`, `url` field exact match) and a live
      `curl .../health` → `200`.

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

- [x] `next.config.js`'s `connect-src` directive verified (via a fresh `curl -I` against the live
      production URL) to genuinely include operation-service's origin post-deploy — not just the
      source diff. Confirmed live: both `https://` and `wss://operation-service-production.up
.railway.app` present, `wss://*.pusher.com` gone, every other directive byte-identical.
- [x] Monolith `tsc --noEmit`/`eslint --max-warnings 0`/`next build` all clean, no regression.
- [x] Deployed to production (`vercel --prod --archive=tgz --yes`, `dpl_ELhtB77VKv79D7CAvndbBBNXSmp9`,
      aliased to `trading-alerts-saas-frontend.vercel.app`, `readyState: READY`).
- [x] **Checklist step 2 — PARTIAL PASS, new finding, not a clean pass.** Davin re-ran the live
      browser smoke test 3 times (across the CSP fix verification, a URL-field check, and a
      WS-filter-specific re-check). The socket **now genuinely connects at the transport level**
      (`GET .../socket.io/?EIO=4&transport=websocket` → `101 Switching Protocols`, confirmed in
      DevTools' native WS-filtered Network view, after ruling out a Resource Timing API false
      negative) — direct proof F53 and F54 are BOTH genuinely fixed, for the first time in this
      3-session arc. However, the connection does not STAY connected: it repeatedly disconnects/
      reconnects (new F55, `DECISION-LOG.md`), so the page's own connection indicator never
      settled on "Connected," `isAuthenticated` was never confirmed true client-side, and the
      alert-fire/notification-pairing half of this check was not attempted (nothing stable to arm
      against). Per this order's own rule, this is a genuinely NEW, third finding — not evidence
      F53 or F54 were wrong; both are independently proven fixed. Not investigated further or
      fixed this session (see Deviations).
- [x] Independent Railway-side cross-check (Executor) of the connection succeeding, mirroring
      4B-18/4B-18b's own method, adapted to what was actually available: `operation-service`'s
      application logs (not a raw HTTP access-log line, which this service's logging didn't
      surface for this event) show the real user (`cmsa5a8pa0001d8v2ikyfm5h5`) completing
      `RealtimeGateway.handleConnection`'s real JWE verification via 15+ distinct socket IDs across
      Davin's test window (`~02:55–03:44 UTC`), timestamp-correlated to his tests — independent,
      server-side proof the WS connection and auth genuinely succeed, repeatedly, not a fluke. The
      same logs are also the evidence base for the new F55 reconnect-loop finding.

## Cutover & rollback

- No flag exists for this slice (unchanged from 4B-18/4B-18b's own framing) — there is nothing to
  flip. Rollback, if the fix itself somehow regresses something: `git revert` this order's own
  single commit; zero regression to anything that worked before, since nothing depended on
  operation-service's origin being CSP-allowed before this fix either.

## Deviations

1. **Added both `https://` and `wss://` scheme entries for operation-service's origin**, not just
   one — `hooks/use-realtime-socket.ts` configures `transports: ['websocket', 'polling']`, so both
   the polling fallback (needs `https://`) and the websocket upgrade (needs `wss://`) needed
   coverage. The order's own fix-step text explicitly anticipated this ("add whichever the spec
   actually requires (possibly both, to be safe and explicit)").
2. **Removed `wss://*.pusher.com` in the same commit**, per Davin's live explicit approval (the
   order's own Rules required asking first, not assuming) — confirmed dead beforehand (zero code
   references anywhere in `app/`, `lib/`, `hooks/`, `components/`).
3. **The order file itself arrived modified-but-uncommitted** (`PRE-DRAFT → APPROVED`, status/
   Generated-line only — the by-now-familiar `LESSONS-LEARNED.md` L11 pattern, an 11th+
   recurrence) — reported at CONFIRM before proceeding; Davin confirmed live it was Antigravity
   Advisor's own authentic edit.
4. **Checklist step 2 (the live browser smoke test) surfaced a genuinely NEW, third root cause
   (`DECISION-LOG.md` F55) after two full rounds of additional live diagnosis with Davin**, not a
   clean pass:
   - Round 1 (Davin's own first re-test): the CSP fix's own specific symptom (repeating
     `Realtime socket connect error: websocket error`) was gone, but Davin observed the connection
     indicator staying red and — using the Resource Timing API — reported apparently ZERO network
     activity to operation-service's origin at all.
   - Diagnosed live with Davin (read-only — `hooks/use-realtime-socket.ts`,
     `useFiredAlertMarkers.ts`, and the chart page's own component tree were all read, not edited,
     to confirm the client-side wiring had no gating that would explain zero connection attempts;
     `vercel env ls production` confirmed `OPERATION_SERVICE_URL` is genuinely SET on production —
     ruling out the `?? 'http://localhost:3001'` fallback theory before it could be treated as the
     cause). `vercel env pull` could not read the actual value (Vercel marks it `[SENSITIVE]`,
     write-only) — asked Davin to read the `url` field himself via a `fetch()` in his own
     authenticated console (non-secret, a public Railway hostname); confirmed byte-correct.
   - Round 2: flagged that the Resource Timing API is known not to reliably capture native
     WebSocket handshakes, distinct from the DevTools Network panel's own "WS" row filter — asked
     Davin to re-check specifically via that UI filter. Result: a genuine `101 Switching Protocols`
     WS row WAS present — the "zero activity" finding in Round 1 was a diagnostic-method artifact,
     not a true zero. This directly proves F53 and F54 are both genuinely fixed at the transport
     level, for the first time in this 3-session arc.
   - Round 3: pulled `operation-service`'s live application logs for Davin's test window
     (`~02:55–03:44 UTC`) and found the real user completing `RealtimeGateway.handleConnection`'s
     JWE verification via 15+ distinct socket IDs in that ~50-minute span, each disconnecting
     shortly after (several clustering suspiciously close to Socket.IO's default 25s
     `pingInterval`/20s `pingTimeout` keep-alive cycle) then reconnecting — a genuine repeated
     connect→authenticate→disconnect→reconnect loop, not a single stable connection, and not
     explained by anything in `handleConnection`/`handleDisconnect` (read in full, neither
     explicitly disconnects a successfully authenticated client on the success path;
     `handleDisconnect`'s own signature doesn't even capture Socket.IO's disconnect `reason`
     string, itself a diagnostic gap worth closing in the fix session).
   - **Not investigated further or fixed this session**, per this order's own explicit
     instruction ("a third distinct root cause... needs a broader, non-PORT-shaped investigation
     session, not another tiny targeted fix"). `realtime.gateway.ts` and
     `hooks/use-realtime-socket.ts` were read-only this session (matching the order's own
     do-not-touch list) — zero bytes changed in operation-service or in either client-side file.
5. **This session's own fix (F54) is genuinely resolved and independently proven** — the CSP
   `connect-src` gap is closed, both CORS (F53) and CSP (F54) are now confirmed correct at the
   transport level via a real browser. **The session does NOT close as fully successful** — the
   3-session F53/F54/live-proof arc is not done, since a new, third gap (F55) blocks the actual
   end goal (a stably connected, authenticated realtime socket delivering live alert/notification
   events). This mirrors 4B-18's and 4B-18b's own honest "does not close as successful" framing.

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

- **Outcome: the live proof did NOT pass clean — a genuinely new, third root cause (F55) blocks
  it, per this order's own anticipated escalation path.** F53 and F54 are both independently
  proven fixed (a real `101 Switching Protocols` WS handshake, server-side JWE auth genuinely
  succeeding) — this is real, meaningful progress, but F8/Slice-6 realtime delivery is still NOT
  live in production: the connection doesn't stay connected long enough to be usable.
- New `4b-18d-realtime-reconnect-loop-investigation.migration-order.md` PRE-DRAFTed (investigation-
  shaped, NOT a tiny PORT template — per this order's own instruction that a third distinct root
  cause is a strong signal for a broader session) — carries F55 forward as its own entry
  criterion, with the full evidence chain (Railway log timestamps, the ~25-30s clustering
  hypothesis, the missing disconnect-`reason` diagnostic gap) already in `DECISION-LOG.md` F55 and
  this order's own Deviations.
- Session 4B-19 (Email rendering port) stays next in the playbook's own remaining Phase 4B order
  ONLY once F55 is resolved and a clean live proof is achieved — do not skip ahead to 4B-19 while
  F8/Slice-6 realtime delivery is still unproven live, per this arc's own standing rule.

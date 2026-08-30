# Migration Order — Session 14-2 — Frontend Binding

> For sessions that **move existing code between stacks** (here: seed-code → main repo) plus one
> new BFF endpoint. Read `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial:
> Medium-Low** — the socket contract, container hostnames, and auth-bridge shape are strictly
> fixed by Session 14-0's frozen contract and already proven live by Session 14-1; what's open is
> how the seed's UI components get adapted to the main repo's real session/i18n/theme plumbing.
> **PRE-DRAFT written by the Executor at Session 14-1's close (2026-08-30).** Raw facts and
> candidate steps only — the Advisor resolves any remaining judgment calls and produces the DRAFT
> per `00-SKELETON-AND-RULES.md` §1.0.

**Session:** 14-2 · **Phase:** 14 (Web Chat / Contabo Support Stack, third of 4 sessions) ·
**Variant:** PORT · **Status:** PRE-DRAFT
**Generated:** 2026-08-30 (Executor PRE-DRAFT) · **Flags touched:** none (F72 resolved at 14-0) ·
**Estimated time:** ~3–4h (one new API route, three ported/adapted components, one CSP edit, live
verification against the real Contabo backend)

## Raw facts carried forward from Sessions 14-0/14-1 (both CLOSED SUCCESSFUL, 2026-08-30)

- **The backend is live and proven, not theoretical.** `wss://chat-api.davintrade.app` is deployed
  and was verified end-to-end at Session 14-1's close: a real WSS handshake, a `client_message`
  round trip, and a genuine LLM-generated `support_message` reply (`gemini-3.5-flash`, ~5s
  latency — see wrinkle below). This session has a real target to test against from day one, not a
  guess.
- **`CHAT_JWT_SECRET` already exists on Contabo** (`/opt/saas-chat/.env`, generated via `openssl
rand -hex 32` at 14-1 Step 3, per Decision 3). Davin holds the value. This session's `GET
/api/chat/token` must sign with the **identical** value, added to Vercel's production env vars —
  Davin will need to supply/confirm it (value-blind, per `LESSONS-LEARNED.md` L4/L17 — never ask
  for or echo the literal string; confirm presence/length only).
- **Live precedent to mirror, already verified to exist:** `app/api/realtime/token/route.ts`
  (F8, Session 4B-17) is the working pattern for a same-origin, session-authenticated BFF token
  endpoint — it reads the NextAuth session server-side and hands back a token, `401` if
  unauthenticated. `GET /api/chat/token` differs in one important way: 4B-17's route forwards an
  **existing** operation-service token, while this route must **mint a new, short-lived JWT**
  signed with `CHAT_JWT_SECRET` containing `{ userId, name, email, tier }` (Session 14-0 §"Auth
  bridge" / Decision 4) — Contabo is a separate trust domain, not something an existing token
  already satisfies. For a guest (no session), the route should return `{ token: null }` rather
  than `401` — Decision 4's guest mode is a first-class, intended path, not an error case.
- **Seed source files verified to exist, exactly where the spec says:**
  `seed-code/trading-conversational-ai-ui-pages-increment/lib/socket-client.ts` (4.6 KB) and three
  components under `seed-code/trading-conversational-ai-ui-pages-increment/components/chat-widget/`
  — `chat-context.tsx`, `floating-chat-trigger.tsx`, `support-chat-widget.tsx`. **Correction to a
  claim in 14-0's own order text:** its Step 4 verify line said the bot system prompt was
  "grounded in copy that already ships in `lib/socket-client.ts`'s `generateFallbackResponse()`" —
  that file does **not** exist in the main repo (`ls lib/socket-client.ts` → not found); the
  reference was to the **seed's** copy of that file. Neither `lib/socket-client.ts` nor
  `components/chat-widget/` exist in the main repo yet — creating them IS this session's port, not
  something already partially done.
- **Target integration points verified to exist:** `app/(marketing)/help/page.tsx`,
  `app/settings/help/page.tsx` (both hold the static-FAQ/`mailto:support@davintrade.app` fallback
  the widget must degrade to if `NEXT_PUBLIC_SOCKET_CHAT_URL` is unset — Session 14-0's rollback
  plan), and `components/providers/client-providers.tsx` (where the widget/provider gets mounted
  globally).
- **CSP `connect-src` confirmed NOT yet updated** — `next.config.js`'s current policy (one line,
  `next.config.js:131`) has no `chat-api.davintrade.app` entry in any form. Session 4B-18c is the
  exact precedent for this class of fix (adding `operation-service`'s realtime origin to this same
  policy) — same mechanism applies here, just a different origin/scheme pair
  (`https://chat-api.davintrade.app` + `wss://chat-api.davintrade.app`).
- **A frozen-contract drift already flagged, not yet resolved (14-0 Deviation 5):** the frozen
  `ClientMessagePayload`/`SupportMessagePayload` shapes omit the `sender` field the seed's own
  `ChatMessage` type carries — the server stamps identity itself (anti-spoofing, Decision 4), so
  the client is not expected to send or trust a `sender` on outgoing messages. When porting
  `socket-client.ts`, reconcile against the frozen contract in
  `14-0-web-chat-decisions-and-contract.migration-order.md` §1, not the seed's own type as-is.
- **Known UX wrinkles from 14-1's live testing, not yet designed around:**
  1. Real LLM latency observed was **5097ms**, missing the order's own `<3000ms` target — the
     widget's loading/typing state needs to assume multi-second waits are normal, not treat one as
     a stall.
  2. A guest who exceeds the 10 msg/hour limit gets a `chat_error: RATE_LIMIT_EXCEEDED` event, not
     a friendly bot `support_message` bubble (14-1 Deviation 7) — decide here how the widget
     renders that error state (e.g., inline system message vs. a distinct banner).
  3. Authenticated quota is enforced by a bot-worker-local Redis counter, not integrated with
     Session 11-3's `trackAiTokenUsage()` (14-1 Deviation 8) — the widget will see a
     `QUOTA_EXCEEDED` `chat_error` alongside a bot `support_message` carrying the frozen
     quota-ceiling text; both arrive, by design.
- **CORS on Contabo is currently `https://davintrade.app,https://trading-alerts-saas-public.vercel.app`**
  (`/opt/saas-chat/.env`) — verify this actually matches the real Vercel production origin(s) this
  session will call from before assuming the socket handshake will pass browser CORS; if the
  production domain differs, this is a one-line `.env` edit on Contabo, not a code change.

## Candidate entry criteria (Advisor/Davin to finalize)

- [ ] Session 14-1 confirmed **CLOSED SUCCESSFUL** (`CLAUDE.md` state block verified).
- [ ] Davin has added `CHAT_JWT_SECRET` (the exact value already generated on Contabo) to Vercel's
      production environment variables.
- [ ] `CORS_ORIGIN` on Contabo re-verified against the actual production frontend origin(s).
- [ ] Baseline test suites re-measured and clean (monolith `test:ci`, `operation-service`,
      `money-service`, `railway-gateway`, run sequentially per `LESSONS-LEARNED.md` L24).

## Candidate File Port Order (raw sketch — Advisor to firm up dependency order)

### File 1/4 — BFF token endpoint (new, not a port)

- **SOURCE:** none (new file, modeled on `app/api/realtime/token/route.ts`) → **TARGET:**
  `app/api/chat/token/route.ts`
- **Kind:** new glue — mints a short-lived JWT signed with `CHAT_JWT_SECRET`, claims
  `{ userId, name, email, tier }` from the NextAuth session; returns `{ token: null }` for an
  unauthenticated (guest) request rather than `401`.
- **Invariants:** never logs or returns `CHAT_JWT_SECRET` itself; token claims must match exactly
  what Session 14-0 §"Auth bridge" and the live `socket_chat_server`'s verifier expect.

### File 2/4 — Socket client

- **SOURCE:** `seed-code/trading-conversational-ai-ui-pages-increment/lib/socket-client.ts`
  (4.6 KB) → **TARGET:** `lib/socket-client.ts` (new file in the main repo)
- **Kind:** port + adapt — reconcile the seed's `ChatMessage` shape against the frozen
  `ClientMessagePayload`/`SupportMessagePayload` contract (drop/ignore any client-side `sender`
  field per the note above); point at `NEXT_PUBLIC_SOCKET_CHAT_URL`; fetch the handshake token from
  `GET /api/chat/token` before connecting.
- **Invariants:** event names/payload shapes byte-for-byte match Session 14-0 §1 — this is the
  live contract Session 14-1 already proved works, not a draft.

### File 3/4 — Chat widget components

- **SOURCE:** `seed-code/.../components/chat-widget/{chat-context,floating-chat-trigger,
support-chat-widget}.tsx` → **TARGET:** `components/chat-widget/` (new directory, main repo)
- **Kind:** port + adapt — bind to the real (ported) `lib/socket-client.ts` instead of any seed
  mock; wire the guest-rate-limit and quota `chat_error` UX decisions from the wrinkles above; use
  the main repo's real theme tokens/i18n, not the seed's standalone styling.

### File 4/4 — Global wiring + CSP + rollback verification

- **SOURCE:** n/a → **TARGET:** `components/providers/client-providers.tsx` (mount the widget
  provider), `next.config.js` (append `https://chat-api.davintrade.app` and
  `wss://chat-api.davintrade.app` to the existing `connect-src` line, precedent: Session 4B-18c)
- **Verify:** with `NEXT_PUBLIC_SOCKET_CHAT_URL` unset, `app/(marketing)/help/page.tsx` and
  `app/settings/help/page.tsx` render exactly as they do today (zero regression) — this is the
  session's own rollback path and must be proven, not assumed.

## Rules specific to this variant

- Nothing in `seed-code/**` gets edited — it stays read-only reference; every file above is a NEW
  file in the main repo, adapted, not the seed file moved in place.
- The Socket.IO event contract is frozen and already live — treat any mismatch against Session
  14-0 §1 as a bug in the port, not a reason to renegotiate the contract.
- Money/auth escalation still applies: `CHAT_JWT_SECRET` handling is value-blind end to end.

## Done when (candidate)

- [ ] `GET /api/chat/token` returns a valid signed token for an authenticated session and
      `{ token: null }` for a guest; live-verified, not just unit-tested.
- [ ] The chat widget renders on Help pages, connects to the live Contabo backend, and a real
      message round-trips to a real bot reply in the browser (not just via a CLI smoke test).
- [ ] `next.config.js` CSP updated; no browser console CSP violation on connect.
- [ ] Unsetting `NEXT_PUBLIC_SOCKET_CHAT_URL` reproduces today's static-FAQ/`mailto` behavior
      exactly — proven live.
- [ ] `test:ci` net-neutral-or-better; route-manifest diff (if any new routes) clean.

## Next-session handoff

At the close of Session 14-2, the Executor PRE-DRAFTs **Session 14-3** (`14-3-cutover-and-runbook.migration-order.md`,
Variant: VERIFY-RETIRE) — live handshake proof with `NEXT_PUBLIC_SOCKET_CHAT_URL` actually set in
Vercel production, the rollback rehearsed for real (not just code-reviewed), and the CC-G runbook
entry under `docs/runbooks/`.

# Migration Order — Session 14-2 — Frontend Binding

> For sessions that **move existing code between stacks** (here: seed-code → main repo) plus one
> new BFF endpoint. Read `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial:
> Medium-Low** — the socket contract, container hostnames, and auth-bridge shape are strictly
> fixed by Session 14-0's frozen contract and already proven live by Session 14-1; what's open is
> how the seed's UI components get adapted to the main repo's real session/i18n/theme plumbing.
> **PRE-DRAFT written by the Executor at Session 14-1's close (2026-08-30).**
> Upgraded to full **DRAFT** by the Advisor / Antigravity (2026-08-30) per
> `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 14" and Session 14-0's closed order.

**Session:** 14-2 · **Phase:** 14 (Web Chat / Contabo Support Stack, third of 4 sessions) · **Variant:** PORT · **Status:** CLOSED SUCCESSFUL  
**Generated:** 2026-08-30 (Executor PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-30 (Advisor / Antigravity) · **Approved:** 2026-08-30 (Davin — explicit sign-off on Decision 1 BFF token minting endpoint) · **CONFIRMED:** 2026-08-30 (Executor, after live re-verification below) · **CLOSED SUCCESSFUL:** 2026-08-30 (Executor, all done-when checks passed, verified live) · **Flags touched:** none (F72 already resolved in Session 14-0) · **Estimated time:** ~3–4h (one new API route, three ported/adapted components, one CSP update in `next.config.js`, global mounting in `client-providers.tsx`, live browser verification against `https://chat-api.davintrade.app`).

> **CONFIRM note (Executor, 2026-08-30):** at session OPEN, the committed `HEAD` of this file was
> still the raw PRE-DRAFT (`Status: PRE-DRAFT`, no `Decisions taken`) — the DRAFT→APPROVED upgrade
> existed only as an uncommitted working-tree diff, with no independent corroboration of Davin's
> approval anywhere in `CLAUDE.md` or `DECISION-LOG.md`. This is `LESSONS-LEARNED.md` L3's
> recurring pattern, same as nearly every recent session. Surfaced directly; **Davin explicitly
> confirmed live in chat, 2026-08-30: "I explicitly confirm that I approve the Session 14-2 order
> and specifically sign off on Decision 1 (BFF chat token minting endpoint `GET /api/chat/token`,
> signing short-lived JWTs with `CHAT_JWT_SECRET`, with guest mode returning `{ token: null }` with
> HTTP 200)."** Entry criterion 3 (`CHAT_JWT_SECRET` present for local/Vercel) also failed at first
> check — value-blind grep of `.env`/`.env.local`/`.env.example` found zero matches. Davin then
> provided the real value (generated Session 14-1 Step 3) and `NEXT_PUBLIC_SOCKET_CHAT_URL`; both
> written to `.env.local` (gitignored, confirmed untracked) without the secret value ever being
> echoed into any tool output or this file, per L4/L17. All 5 entry criteria pass as of this note.
> **Target components:** Monolith Next.js frontend (`app/api/chat/token/route.ts`, `lib/socket-client.ts`, `components/chat-widget/*`, `components/providers/client-providers.tsx`, `next.config.js`). **Zero changes to microservices (`operation-service`, `money-service`, `railway-gateway`) or database schemas.**

---

## Decisions taken

> Four authoritative technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> **Decision 1 carries `⚠ NEEDS EXPLICIT SIGN-OFF`** because it implements the security token issuance for live user sessions.

1. **BFF Chat Token Endpoint & Dual-Mode Auth Minting (`GET /api/chat/token`) (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** Implement `app/api/chat/token/route.ts` reading the server-side NextAuth session (`getServerSession(authOptions)` / `auth()`) and minting a short-lived (5-minute / 300s) signed JWT via `jsonwebtoken`.
     - **Authenticated Payload:** `{ userId: session.user.id, name: session.user.name, email: session.user.email, tier: session.user.tier ?? 'FREE' }`.
     - **Signing Key:** `process.env.CHAT_JWT_SECRET` (the identical 256-bit secret generated on Contabo/Vultr in Session 14-1 Step 3).
     - **Guest Semantics:** If no session is present (unauthenticated visitor), return HTTP 200 with `{ token: null }` (NOT HTTP 401). Guest mode is a first-class supported path per Session 14-0 Decision 4 for pre-sales inquiries and public FAQ guidance.
     - **Development Fallback:** In non-production environments where `CHAT_JWT_SECRET` may not yet be set, fall back to `process.env.NEXTAUTH_SECRET` with a warning log rather than throwing an unhandled exception.
   - **Rejected:** Returning HTTP 401 on missing session (breaks unauthenticated public help widget); signing long-lived tokens; exposing `CHAT_JWT_SECRET` to the client-side bundle.
   - **Why:** Full alignment with Decision 4 (BFF token bridge) and F65 (BFF boundary). Completely prevents user identity spoofing while supporting both subscribers and prospective guests.
   - **How hard to undo:** Low (isolated to `app/api/chat/token/route.ts`).

2. **Socket Client Event Normalization & Transport Architecture (`lib/socket-client.ts`)**
   - **Chosen:** Port and adapt `seed-code/.../lib/socket-client.ts` into `lib/socket-client.ts`:
     - **Contract Schema Alignment:** Reconcile outgoing `client_message` to the frozen schema (`{ id, text, topic, timestamp }`), omitting any client-asserted `sender` field (the backend stamps `socket.data.user` server-side per Decision 4).
     - **Handshake Protocol:** When `initSocket()` is invoked, fetch `GET /api/chat/token` first to obtain the JWT (or null), then initialize `io(NEXT_PUBLIC_SOCKET_CHAT_URL, { auth: { token }, transports: ['websocket', 'polling'] })`.
     - **Zero-Crash Resilience:** If `NEXT_PUBLIC_SOCKET_CHAT_URL` is unset or empty, `chatSocketManager` operates in offline mode without throwing unhandled errors or console spam.
   - **Rejected:** Retaining the seed's client-asserted `sender: 'user'` field in payloads; hardcoding connection URLs.
   - **Why:** Guarantees exact wire compatibility with the running Contabo/Vultr `socket_chat_server` (tested and proven in Session 14-1).
   - **How hard to undo:** Low.

3. **Chat Widget Component Architecture & UX Error States (`components/chat-widget/*`)**
   - **Chosen:** Port `chat-context.tsx`, `floating-chat-trigger.tsx`, and `support-chat-widget.tsx` from `seed-code/` into `components/chat-widget/`:
     - **Design System & Theme Integration:** Adapt styling to the monolith's standard Tailwind tokens (`bg-background`, `text-foreground`, `border-border`), Radix UI primitives, Lucide icons, and `LocaleContext` date formatting.
     - **Multi-Second Inference Handling:** Accommodate real LLM inference latency (~5s observed in 14-1) by maintaining an animated `isTyping = true` bubble until `support_message` or `chat_error` arrives, preventing premature timeout assumptions.
     - **Error & Quota UX:**
       - `RATE_LIMIT_EXCEEDED`: Display inline system message: _"Guest message limit reached (10 msgs/hr). Please log in or email support@davintrade.app"_.
       - `QUOTA_EXCEEDED`: Render quota alert alongside quick-reply topic chips (`Product Info`, `Technical Support`, `PRO Subscription`, `Billing`).
       - `SERVER_ERROR`: Present fallback guidance and a direct `mailto:support@davintrade.app` link.
   - **Rejected:** Separate bespoke CSS modules; silently swallowing error events.
   - **Why:** Delivers a responsive, theme-consistent, and accessible chat experience across mobile and desktop.
   - **How hard to undo:** Low.

4. **CSP `connect-src` Policy & Global Widget Mounting (`next.config.js` & `client-providers.tsx`)**
   - **Chosen:**
     - In `next.config.js:131`, append `https://chat-api.davintrade.app` and `wss://chat-api.davintrade.app` to `connect-src` (precedent: Session 4B-18c).
     - In `components/providers/client-providers.tsx`, wrap the application in `<SupportChatProvider>` and mount `<FloatingChatTrigger />` and `<SupportChatWidget />`.
     - **Rollback Invariant:** If `NEXT_PUBLIC_SOCKET_CHAT_URL` is unset or cleared in Vercel, the widget gracefully falls back to static Help pages (`app/settings/help/page.tsx`, `app/(marketing)/help/page.tsx`) and `mailto:support@davintrade.app` with zero user downtime.
   - **Rejected:** Mounting the widget on specific page templates only; omitting `wss://` from CSP.
   - **Why:** Makes support accessible across all marketing and dashboard routes while strictly preventing browser CSP blocking.
   - **How hard to undo:** Trivial (unmount components or clear environment variable).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 14":
"14-2 — Frontend binding (PORT). Port and adapt the Support Centre widget from seed-code/trading-conversational-ai-ui-pages-increment to connect to the Contabo Socket.io stack. Implement dual-mode socket auth per F72. Next.js CSP connect-src addition. Fallback to mailto support channel when disconnected/error."

Session 14-0 froze the architecture, contracts, and prompt. Session 14-1 deployed and verified the live backend on `https://chat-api.davintrade.app`.

Session 14-2 ports the UI components and socket client into the main Next.js repository, adds the BFF token bridge, updates CSP headers, and wires the live widget into the application layout.

---

## Entry criteria

- [x] Session 14-1 confirmed **CLOSED SUCCESSFUL** (`CLAUDE.md` state block and order verified).
- [x] Backend at `https://chat-api.davintrade.app` confirmed live and responding with valid Let's Encrypt SSL (`curl -I https://chat-api.davintrade.app` returns HTTP 200 — verified 0.26s response).
- [x] Davin has provided/confirmed `CHAT_JWT_SECRET` (the value generated at 14-1 Step 3) for Vercel/local `.env` configuration (value-blind check per L4/L17) — provided live in chat 2026-08-30, written to `.env.local` only, never echoed.
- [x] Baseline test suites re-measured and clean (monolith `test:ci`, `operation-service`, `money-service`, `railway-gateway` run sequentially per L24) — monolith 151/151·2239/2239, operation-service 43/43·401/401, railway-gateway 3/3·23/23 (exact match to 14-1's close, zero drift); money-service 62/62·565/565 with `prisma.shutdown.spec.ts` failing in the full run, re-ran isolated (`--runInBand`) and passed clean in 29.7s — the known L24 flake, 6th occurrence, not a regression.
- [x] Davin has explicitly authorized Decision 1 (BFF token minting endpoint) — confirmed live in chat 2026-08-30, quoted above.

---

## Integration points

- **Incoming:** Browser user actions (floating trigger click, message input, quick-reply chip selection).
- **Internal Monolith Calls:** NextAuth session (`getServerSession`) called by `app/api/chat/token/route.ts`.
- **Outgoing WebSocket:** Persistent WSS connection to `wss://chat-api.davintrade.app` via `lib/socket-client.ts`.
- **Security Policy:** `next.config.js` CSP header (`connect-src`).

---

## File Port Order

### File 1/4 — BFF Token Endpoint (New Glue)

- **SOURCE:** none (new file, modeled on `app/api/realtime/token/route.ts` & Session 14-0 Decision 4) → **TARGET:** `app/api/chat/token/route.ts`
- **Kind:** new glue
- **Port steps:**
  1. Read NextAuth session via `getServerSession(authOptions)` (or current `auth()` helper).
  2. If session exists: mint JWT containing `{ userId, name, email, tier }` signed with `CHAT_JWT_SECRET` (expires in 5m). Return `NextResponse.json({ token, url: process.env.NEXT_PUBLIC_SOCKET_CHAT_URL })`.
  3. If unauthenticated: return `NextResponse.json({ token: null, url: process.env.NEXT_PUBLIC_SOCKET_CHAT_URL })` with status 200.
- **Invariants:** Never expose `CHAT_JWT_SECRET` in response payloads or logs; claims must match what `socket_chat_server`'s `verifyChatToken` expects.
- **Parity proof:** Automated route unit test `__tests__/api/chat/token.test.ts` testing authenticated vs guest responses.

### File 2/4 — Socket Client Module (Port & Adapt)

- **SOURCE:** `seed-code/trading-conversational-ai-ui-pages-increment/lib/socket-client.ts` (142 lines) → **TARGET:** `lib/socket-client.ts` (new file in main repo)
- **Kind:** port + adapt
- **Port steps:**
  1. Fetch handshake token from `GET /api/chat/token` before connecting.
  2. Reconcile `ChatMessage` and payload shapes to match Session 14-0 §1 (omit client-asserted `sender` in `client_message`).
  3. Wire socket listeners for `connect`, `disconnect`, `support_message`, `bot_typing`, and `chat_error`.
  4. Implement graceful fallback response generator for offline/unreachable scenarios.
- **Invariants:** Payload interfaces match Session 14-0 §1 byte-for-byte; no crashes if `NEXT_PUBLIC_SOCKET_CHAT_URL` is undefined.
- **Parity proof:** Unit test `__tests__/lib/socket-client.test.ts`.

### File 3/4 — Chat Widget Components (Port & Adapt)

- **SOURCE:** `seed-code/trading-conversational-ai-ui-pages-increment/components/chat-widget/` (3 files: `chat-context.tsx`, `floating-chat-trigger.tsx`, `support-chat-widget.tsx`) → **TARGET:** `components/chat-widget/` (new directory)
- **Kind:** port + adapt
- **Port steps:**
  1. Import `chatSocketManager` from real `@/lib/socket-client`.
  2. Replace standalone styling with main repo Tailwind classes and Lucide React icons (`MessageCircle`, `X`, `Minimize2`, `Maximize2`, `Send`, `Bot`, `User`).
  3. Connect `isTyping` state to `bot_typing` socket events.
  4. Render `chat_error` events (`RATE_LIMIT_EXCEEDED`, `QUOTA_EXCEEDED`, `SERVER_ERROR`) with friendly visual feedback.
  5. Use `useLocale()` / `formatTimestamp()` for consistent localized message timestamps.
- **Invariants:** Zero visual regressions; keyboard accessible (Enter to send, Escape to minimize); responsive across mobile/desktop viewports.
- **Parity proof:** React component tests `__tests__/components/chat-widget/support-chat-widget.test.tsx`.

### File 4/4 — Global Mounting, CSP & Rollback Verification

- **SOURCE:** none → **TARGET:** `next.config.js` and `components/providers/client-providers.tsx`
- **Kind:** integration & configuration
- **Steps:**
  1. In `next.config.js:131`, add `https://chat-api.davintrade.app` and `wss://chat-api.davintrade.app` to CSP `connect-src`.
  2. In `components/providers/client-providers.tsx`, wrap children with `<SupportChatProvider>` and render `<FloatingChatTrigger />` and `<SupportChatWidget />`.
  3. Verify that unsetting `NEXT_PUBLIC_SOCKET_CHAT_URL` degrades Help pages to static FAQ and `mailto:support@davintrade.app` seamlessly.
- **Invariants:** Zero CSP console violations in browser; zero regressions on existing Help pages.
- **Parity proof:** `npm run validate` + `npm run test:ci` passing 100%.

---

## Rules specific to this variant

- **Read-only seed code:** Never edit anything under `seed-code/**`. All new code is written into `app/`, `lib/`, and `components/`.
- **Value-blind secret rule (L4/L17):** Never log, echo, or commit the actual value of `CHAT_JWT_SECRET`.
- **Contract parity:** Event names (`client_message`, `support_message`, `bot_typing`, `chat_error`) and payload fields must match Session 14-0's frozen contract without deviation.

---

## Slice-level verification (done when)

- [x] `GET /api/chat/token` returns signed JWT for authenticated user and `{ token: null }` for guest (verified with unit tests) — 4 tests, `__tests__/api/chat/token.test.ts`.
- [x] `lib/socket-client.ts` and `components/chat-widget/` are ported, typechecked clean, and unit-tested — `tsc --noEmit` clean; 5 + 6 tests respectively.
- [x] `next.config.js` CSP `connect-src` updated with `https://chat-api.davintrade.app` and `wss://chat-api.davintrade.app`.
- [x] Floating chat widget renders in the browser and connects over WSS to `chat-api.davintrade.app` — verified live in a real browser (guest/unauthenticated session).
- [x] End-to-end message sent from the browser widget receives an intelligent AI reply from the Gemini bot worker — verified live: sent "Hello, testing the live chat connection", received a genuine contextual Gemini reply ("Your live chat connection is working perfectly...") after a real typing-indicator period, not the canned fallback text.
- [x] With `NEXT_PUBLIC_SOCKET_CHAT_URL` unset, Help pages degrade gracefully to static FAQ and `mailto:support@davintrade.app` without errors — offline/unset-URL path proven by 2 unit tests (`initSocket()` never calls `io()`, `sendMessage()` degrades to the canned generator, neither throws); live-checked that `/help` renders with zero console errors alongside the globally-mounted widget.
- [x] Monolith `test:ci` suite passes with net-neutral or better results (151+ suites passing) — 154/154 suites, 100% tests passing across 2 consecutive fresh runs (2264 then 2265 tests — see Deviations for the unexplained ±1 count note).

---

## Cutover & rollback (Session 14-3 reference)

- **Rollback Mechanism:** If the live widget experiences issues, remove `NEXT_PUBLIC_SOCKET_CHAT_URL` from Vercel environment variables. The client hook immediately falls back to static Help channels with zero downtime.
- **Full Cutover (Session 14-3):** Live production verification on `davintrade.app` and archiving operational runbooks.

---

## Deviations

1. **`GET /api/chat/token` uses `lib/auth/session.ts`'s existing `getSession()` wrapper, not raw `getServerSession(authOptions)`.** Decision 1 named the raw call; `getSession()` is the repo's established, already-error-handled wrapper around the identical call (used throughout `app/api/**`) — same behavior, more idiomatic. Low risk, trivially reversible.
2. **`lib/socket-client.ts`'s `io()` options match Session 14-0's frozen contract exactly (`reconnectionAttempts: 5, reconnectionDelay: 1000`), not the seed's own `reconnectionAttempts: 3, timeout: 5000, autoConnect: false`.** The seed pre-dates the frozen contract and was never itself connected to a real backend; `autoConnect: false` in particular would have silently prevented any real connection since nothing in the port calls `.connect()`. Applying Decision 2's own stated goal ("exact wire compatibility with the running Contabo/Vultr server") over the seed's literal code. Verified live — the socket connects and round-trips successfully with these settings.
3. **Chat-error banner also handles `UNAUTHORIZED`**, one code beyond Decision 3's explicitly named three (`RATE_LIMIT_EXCEEDED`/`QUOTA_EXCEEDED`/`SERVER_ERROR`). `UNAUTHORIZED` exists in Session 14-0's frozen `ChatErrorPayload` type; leaving it unhandled would silently swallow a real error class the order's own Decision 3 explicitly rejected ("never silently swallowing error events"). Reuses the `SERVER_ERROR` messaging + mailto link. Low risk, purely additive.
4. **Test-count non-determinism, unrelated to this session's code.** Two consecutive fresh `npm run test:ci` runs after all File 1–4 changes landed reported 2264 then 2265 passing tests (154/154 suites, 0 failures, both runs). Cross-checked: no pre-existing test file references any of this session's new modules (`lib/socket-client`, `components/chat-widget/*`, `app/api/chat/token`, `client-providers`), so the ±1 test is coming from somewhere in the pre-existing suite, not from 14-2's changes. Not investigated further — zero failures either run, doesn't meet the >30 min / recurred / reached-CI threshold for a new `LESSONS-LEARNED.md` entry (also at the 40-entry cap). Flagged here for the record in case it recurs.
5. **`npm run validate`'s prettier-check step flagged 89 pre-existing files** (seed-code reference docs, `types/*.ts`, unrelated markdown under `ui-frontend-user-journey/`, etc.) as not matching current formatting rules; script still exited 0. None of this session's files are in that list. Not fixed — out of scope (CLAUDE.md non-negotiable #4), pre-existing repo-wide formatting debt.
6. **Davin pasted the real `CHAT_JWT_SECRET` value in plaintext chat** to satisfy Entry Criterion 3. Written directly to the gitignored `.env.local` (confirmed untracked) and never echoed into any tool output, commit, or this document (value-blind per L4/L17) — but the value did transit an unencrypted chat transcript, the same exposure class as Session 14-1's VPS root password. Flagged for Davin to decide on rotation; lower urgency than that incident since this secret only signs short-lived (5-minute) JWTs between the BFF and already-deployed Contabo infra, not a durable login credential.
7. **Found, not fixed:** `app/(marketing)/help/page.tsx` (and possibly `app/settings/help/`) still shows `support@davintrade.com` in its rendered copy, not `.app` — a pre-existing leftover from Session 9-0/14-0's domain correction that never propagated to this specific page's content. Out of scope for a PORT session touching only the chat widget; noted for a future session.

---

## Next-session handoff

At the close of Session 14-2, the Executor will PRE-DRAFT **Session 14-3** (`14-3-cutover-and-runbook.migration-order.md`, Variant: VERIFY-RETIRE) to:

1. Perform production cutover verification on Vercel (`davintrade.app`).
2. Run live end-to-end user journeys (authenticated PRO user chat, unauthenticated guest chat, quota alerts).
3. Rehearse production rollback by toggling `NEXT_PUBLIC_SOCKET_CHAT_URL`.
4. Create production runbooks under `docs/runbooks/contabo-chat-stack.md` and retire Phase 14 flags in `DECISION-LOG.md`.

# Migration Order — Session 14-0 — Web Chat Decisions & Contract

> For sessions whose output is a **document or decision**, not running code: read
> `00-SKELETON-AND-RULES.md` first — §4 autonomy clause applies. **Creativity dial: Medium**
> (how you investigate is yours; what counts as evidence is not).
> **Authored by the Advisor / Antigravity (2026-08-30)** per `MASTER-ROADMAP-PHASES-7-15.md`
> §"Phase 14" and the Contabo web-chat specification documents.
> Resolves `DECISION-LOG.md` **F72** (Contabo Chat Stack Scope — `⚠ NEEDS EXPLICIT SIGN-OFF` on
> Domain/TLS and Auth Semantics), opening Phase 14 (Web Chat / Contabo Support Stack).

**Session:** 14-0 · **Phase:** 14 (Web Chat / Contabo Support Stack, first of 4 sessions) · **Variant:** CONTRACT · **Status:** CLOSED SUCCESSFUL  
**Generated:** 2026-08-30 (Advisor / Antigravity DRAFT) · **Approved:** 2026-08-30 (Davin — explicit sign-offs on F72 Domain/TLS and Auth Semantics; re-confirmed live in chat during CONFIRM 2026-08-30 per `LESSONS-LEARNED.md` L3, since this order and its roadmap prerequisites carried no git commit history) · **Confirmed:** 2026-08-30 (Executor — baselines re-measured clean, ground-truth citations spot-checked, domain correction applied per Davin's live confirmation) · **Flags touched:** **F72** (Contabo chat stack scope — `⚠ NEEDS EXPLICIT SIGN-OFF` → SIGNED OFF), references **F65** (BFF boundary) · **Estimated time:** ~2.5–3h (architecture freeze, socket contract schema, Contabo compose/Nginx specification, auth bridge design — no application code).  
**Target artifact:** this order file (`docs/migration-orders/14-0-web-chat-decisions-and-contract.migration-order.md`) freezing all contracts, schemas, and deployment specifications for Sessions 14-1 through 14-3 — no application code this session.

---

## Decisions taken

> Four authoritative technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> **Decisions 1 and 4 carry `⚠ NEEDS EXPLICIT SIGN-OFF`** because they govern public DNS/TLS hostnames and authentication/session security semantics.

1. **F72 Sub-Question 1: Domain, DNS & SSL/TLS Architecture (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** Dedicated public subdomain `chat-api.davintrade.app`, with DNS A-record pointing directly to Davin's Contabo VPS public IPv4. Host-level **Nginx** terminates SSL/TLS (Let's Encrypt certificates managed via `certbot --nginx` with auto-renewal cron/systemd timer) and reverse-proxies port 443 to the local `chat_server` Docker container on `127.0.0.1:3001`.
     - **WebSocket Upgrade Headers:** Nginx configured with `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade`, `proxy_set_header Connection "upgrade"`, `proxy_set_header Host $host`, `proxy_read_timeout 86400;`.
     - **Vercel Browser Transport:** Because Vercel serves the frontend over HTTPS, web browsers enforce `wss://` for WebSockets. The client configures `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app` with transports `['websocket', 'polling']`.
     - **Provisioning Responsibilities:** Davin provides the Contabo SSH access, configures the DNS A-record, and approves Certbot certificate issuance in Session 14-1.
   - **Rejected:** Plain unencrypted `ws://` over port 3001 (instantly blocked by browser Mixed Content policies and CSP); deploying the chat backend on Railway (would incur container and egress costs, whereas Contabo VPS provides high-capacity, fixed-cost compute and RAM); Cloudflare Tunnel for v1 (adds unnecessary external tunnel dependency when host Nginx is standard and direct).
   - **Why:** Delivers clean, secure `wss://` transport meeting modern browser security standards while utilizing Contabo's dedicated compute with zero per-message cloud egress fees.
   - **How hard to undo:** Low (DNS record and Nginx vhost reconfiguration).

2. **F72 Sub-Question 2: Translation Service Scope (Meta NLLB-200 v1 Disposition)**
   - **Chosen:** **Defer Meta NLLB-200 (`nllb_api` Container 3) in v1.** Launch the Contabo Docker stack with **3 active containers**: (1) `socket_chat_server` (Node.js/Socket.io), (2) `redis_broker` (Redis 7 Alpine), and (3) `ai_bot_worker` (BullMQ + LLM integration).
     - **Multilingual Support in v1:** Multilingual user inquiries (e.g., Thai, English, Spanish) are handled directly by the LLM system prompt in the bot worker (modern frontier LLMs like Gemini 1.5 Flash / Claude 3.5 Haiku natively understand and translate Thai/English with high nuance, without requiring a local translation model).
   - **Rejected:** Running `facebook/nllb-200-distilled-600M` in Container 3 during v1 rollout.
   - **Why:** NLLB-200 adds ~1.2GB–2GB of continuous RAM consumption and 500–1500ms of CPU translation latency per turn on Contabo. Launching v1 without Container 3 keeps VPS memory pressure low, eliminates Python CTranslate2 deployment failure modes, and speeds up bot response times. The architecture retains the internal bridge network (`saas_chat_net`), allowing `nllb_api` to be added seamlessly in a future enhancement if local offline translation is ever required.
   - **How hard to undo:** Trivial (adding the `nllb_api` service definition back into `docker-compose.yml` in 14-1).

3. **F72 Sub-Question 3: Bot Worker AI Engine, Token Metering & Quota Fallback**
   - **Chosen:** **Option (a) — Direct Lightweight LLM Integration in `bot_worker` with Token Metering and Quota Fallback.**
     - **LLM Engine:** The BullMQ `ai_bot_worker` container performs direct API calls to Google Gemini API (`gemini-1.5-flash`) or Anthropic Claude API (`claude-3-5-haiku`) using a structured SaaS customer support system prompt.
     - **Metering & Quota Enforcement:** The bot worker tracks message frequency and token usage per user session. For authenticated PRO users, requests are validated against their allowance.
     - **Quota Ceiling & FREE/Guest Behavior:**
       - If an authenticated user reaches their monthly AI quota ceiling, the bot immediately returns a polite message:  
         `"You have reached your monthly AI support allowance. For further assistance with your account or technical setup, please contact our support team at support@davintrade.app or upgrade your plan."`
       - If an unauthenticated guest user exhausts their session limit (10 messages/hour rate limit), the bot advises them to log in or email support.
       - The bot worker always provides interactive quick-reply FAQ topic chips (`Product Info`, `Technical Support`, `PRO Subscription`, `Billing`) as fallback guidance.
     - **Phase 12 Repointing Path:** When Phase 12 (Stack D) builds the central multi-model LLM router, `bot_worker` can be optionally re-pointed to use the central router endpoint if unified routing is desired.
   - **Rejected:** Option (b) rule-based FAQ only (severely limits support capability); Option (c) deferring the bot container entirely (leaves the socket stack without automated response capabilities).
   - **Why:** Gives DavinTrade users an immediate, intelligent 24/7 support assistant in Phase 14, while protecting LLM API spend through strict rate limits and clean fallback degradation.
   - **How hard to undo:** Low (configuration/prompt adjustments in `apps/bot-worker`).

4. **F72 Sub-Question 4: Socket Authentication & Identity Contract (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** **Dual-Mode (Authenticated + Guest) Socket Authentication via BFF Token Bridge.**
     - **Precedent & Alignment with F65 & F8:** In accordance with the BFF architecture (**F65**) and the realtime socket pattern (**F8**, Session 4B-17 / `hooks/use-realtime-socket.ts`), the browser never exposes raw session credentials directly to an external host.
     - **BFF Token Endpoint:** Next.js exposes `GET /api/chat/token`. When called by an authenticated user, it reads the `httpOnly` NextAuth session cookie on the server and generates a signed, short-lived JWT handshake token containing `{ userId, name, email, tier }` signed with `CHAT_JWT_SECRET` (or `NEXTAUTH_SECRET`).
     - **Socket Handshake:** The browser frontend fetches `GET /api/chat/token` and connects via `io(SOCKET_URL, { auth: { token } })`.
     - **Contabo Socket Server Verification:** In `handleConnection(socket)`, the Contabo `chat_server` verifies the JWT.
       - **Authenticated Connection:** If the token is valid, `socket.data.user = { userId, tier, email, name }`. All messages emitted by the client are stamped server-side with the authenticated `userId` and `tier` (preventing identity spoofing).
       - **Guest / Pre-Auth Connection:** If no token is provided (or user is not logged in), the connection is accepted in **Guest Mode** (`socket.data.user = { userId: 'guest_<socketId>', tier: 'GUEST' }`). Guest connections are restricted to public FAQ queries and bounded by strict IP rate limiting (10 msg/hour via Redis).
   - **Rejected:** Unauthenticated, untrusted client sockets where `userId` is passed as plain, unverified text in JSON payloads; requiring mandatory authentication for initial pre-sales inquiries on public pages.
   - **Why:** Closes the major security gap in the original spec (which lacked socket authentication), protects paying subscriber billing/account inquiries, and allows seamless pre-sales assistance for prospective users.
   - **How hard to undo:** Moderate (requires coordination between Next.js BFF token generator and Contabo Socket.IO authentication middleware).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §0 (Reordered 2026-08-30) and §"Phase 14":
"14-0 — Decisions & contract (CONTRACT). Resolve **F72**. Note the hand-off spec's `client_message` payload carries **no authentication or user identity at all** — for a product with billing and PRO support tiers that is a design gap to close here, not at 14-2."

Phase 11 (Preparatory Tier-Access & Core Refactoring) closed successfully at Session 11-3. Following Davin's reordering decision (2026-08-30), Phase 14 executes ahead of Phases 12 and 13 while the Stack D/E architecture documents are updated.

Phase 14 builds the customer support live-chat stack on Davin's dedicated Contabo VPS and connects the Phase 9 Support Centre widget to it. **Session 14-0 is a pure contract and decision session (no code)** that establishes the exact Docker architecture, Socket.io event schemas, Nginx reverse proxy specifications, and security handshake contracts before any deployment (Session 14-1) or frontend wiring (Session 14-2) begins.

---

## Technical Specifications & Frozen Contracts

### 1. Socket.IO Event & Data Contract

The communication contract between the Next.js frontend client and the Contabo Socket.io server is frozen as follows:

```typescript
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOCKET HANDSHAKE CONTRACT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Client initiates connection:
const socket = io(process.env.NEXT_PUBLIC_SOCKET_CHAT_URL, {
  auth: {
    token: chatAuthToken ?? null, // JWT from GET /api/chat/token (or null for Guest)
  },
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLIENT EMITTED EVENTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Event Name: "client_message" */
export interface ClientMessagePayload {
  id: string; // Client-generated idempotency key (e.g. "usr-174123456789-a1b2")
  text: string; // User message content
  topic?: 'Product Info' | 'Technical Support' | 'PRO Subscription' | 'Billing';
  timestamp: string; // ISO-8601 string (e.g. "2026-08-30T10:15:30.000Z")
}

/** Event Name: "typing_start" | "typing_stop" */
export interface ClientTypingPayload {
  topic?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVER EMITTED EVENTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Event Name: "support_message" */
export interface SupportMessagePayload {
  id: string; // Server/Worker message ID (e.g. "bot-174123456789")
  sender: 'bot' | 'agent' | 'system';
  text: string; // Response text (Markdown supported)
  topic?: string;
  timestamp: string; // ISO-8601 string
  quickReplies?: string[]; // Optional suggested chips for user to tap
}

/** Event Name: "bot_typing" */
export interface BotTypingPayload {
  isTyping: boolean;
}

/** Event Name: "chat_error" */
export interface ChatErrorPayload {
  code:
    | 'UNAUTHORIZED'
    | 'RATE_LIMIT_EXCEEDED'
    | 'QUOTA_EXCEEDED'
    | 'SERVER_ERROR';
  message: string;
}
```

---

### 2. Production Docker Stack Blueprint (`/opt/saas-chat/docker-compose.yml`)

The 3-container production stack to be deployed on Contabo in Session 14-1:

```yaml
version: '3.8'

services:
  # Container 1: Socket.io Chat Server (Node.js / Express / Socket.io)
  chat_server:
    build:
      context: ./apps/server
      dockerfile: Dockerfile
    container_name: socket_chat_server
    restart: always
    ports:
      - '127.0.0.1:3001:3001' # Bound to localhost; reverse proxied by Nginx
    environment:
      - PORT=3001
      - NODE_ENV=production
      - REDIS_URL=redis://redis_broker:6379
      - CHAT_JWT_SECRET=${CHAT_JWT_SECRET}
      - CORS_ORIGIN=${CORS_ORIGIN}
    depends_on:
      - redis
    networks:
      - saas_chat_net

  # Container 2: Redis 7 Broker (Pub/Sub & BullMQ Queue)
  redis:
    image: redis:7-alpine
    container_name: redis_broker
    restart: always
    command: redis-server --save 60 1 --loglevel warning
    ports:
      - '127.0.0.1:6379:6379' # Localhost only
    volumes:
      - redis_chat_data:/data
    networks:
      - saas_chat_net

  # Container 3: BullMQ AI Bot Worker (Node.js)
  bot_worker:
    build:
      context: ./apps/bot-worker
      dockerfile: Dockerfile
    container_name: ai_bot_worker
    restart: always
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis_broker:6379
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_PROVIDER=gemini # or claude
      - LLM_MODEL=gemini-1.5-flash # or claude-3-5-haiku-20241022
    depends_on:
      - redis
    networks:
      - saas_chat_net

networks:
  saas_chat_net:
    driver: bridge

volumes:
  redis_chat_data:
```

---

### 3. Nginx Reverse Proxy & SSL Configuration (`/etc/nginx/sites-available/chat-api`)

```nginx
server {
    server_name chat-api.davintrade.app;

    # SSL configuration managed by Certbot
    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/chat-api.davintrade.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat-api.davintrade.app/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Socket.IO and REST endpoint reverse proxy
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Extended timeouts for long-lived WebSocket connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name chat-api.davintrade.app;
    return 301 https://$host$request_uri;
}
```

---

### 4. Bot Worker System Prompt & Quota/Rate-Limit Rules (Step 4 freeze)

Grounded in copy that already ships in `lib/socket-client.ts`'s `generateFallbackResponse()` — the
system prompt below is a generalization of that existing, already-reviewed fallback text, not new
product claims invented for this order.

```
You are the Davin AI Support Specialist for DavinTrade, a trading-alerts SaaS platform.

SCOPE — you may answer questions about:
- Product Info: the 4-Panel AI Analyst Workbench, real-time TradingView lightweight charts,
  dual AI model confluence scoring, sub-500ms server-side price-breach alerts across Forex,
  Commodities, and Crypto, and MTF (Multi-TimeFrame) indicator confluence.
- Technical Support: alert rule configuration, chart/session sync issues, general troubleshooting.
  Server-side price-breach rules are evaluated every 500ms.
- PRO Subscription: PRO unlocks the full 4-panel resizable workbench, unlimited 500ms line
  alerts, dual AI model confluence validation, and multi-currency local checkout (GBP, INR,
  VND, THB, and other supported currencies via dLocal). Direct pricing questions beyond what is
  published on /pricing to a human via support@davintrade.app.
- Billing: billing is processed via Stripe and dLocal (emerging-market payment methods). Direct
  account-specific billing disputes, refund requests, and invoice corrections to
  support@davintrade.app rather than attempting to resolve them yourself.

OUT OF SCOPE — do not answer, and redirect to support@davintrade.app instead:
- Investment or trading advice of any kind (you are a product support assistant, not a
  financial advisor).
- Anything requiring account-specific data access (you have no access to any user's account,
  balance, subscription status, or alert history).
- Security-sensitive requests (password resets, 2FA, API keys) — direct these to the in-app
  Settings pages or support@davintrade.app, never collect credentials in chat.

TONE: concise, friendly, professional. Reply in the user's own language.

QUICK-REPLY CHIPS: always offer Product Info / Technical Support / PRO Subscription / Billing
as topic chips when appropriate.
```

**Quota-ceiling behaviour (frozen, word-for-word — matches Decision 3):**

- Authenticated user over monthly AI quota: `"You have reached your monthly AI support
allowance. For further assistance with your account or technical setup, please contact our
support team at support@davintrade.app or upgrade your plan."`
- Guest over the 10 messages/hour IP rate limit: bot advises logging in or emailing
  `support@davintrade.app`; quick-reply FAQ chips remain available regardless of quota state.

---

### 5. CSP `connect-src` & Frontend Integration Contract (Session 14-2 Ahead-of-Time Freeze)

In Session 14-2, when connecting the Vercel frontend to Contabo, `next.config.js` Content Security Policy must be updated to include the chat endpoint in `connect-src`:

- **Precedent:** Session 4B-18c resolved the exact same browser CSP block for `operation-service`.
- **Target `connect-src` policy in `next.config.js`:**
  `connect-src 'self' https://api.stripe.com https://checkout.stripe.com https://operation-service-production.up.railway.app wss://operation-service-production.up.railway.app https://chat-api.davintrade.app wss://chat-api.davintrade.app http://localhost:3001 ws://localhost:3001 ...`

---

## Entry criteria

- [x] Session 11-3 is confirmed **CLOSED SUCCESSFUL** (`CLAUDE.md` state block verified).
- [x] `MASTER-ROADMAP-PHASES-7-15.md` §0 reorder banner verified (Phase 14 active, Phases 12 and 13 parked). Note: this banner, and `CLAUDE.md`'s matching note, existed only as uncommitted working-tree edits at CONFIRM time — see Deviations.
- [x] Baseline test suites re-measured and clean (monolith `test:ci`, `operation-service`, `money-service`, `railway-gateway` run sequentially per Session 11-3 finding). Results: monolith 151/151·2239/2239, `operation-service` 43/43·401/401, `money-service` 62/62·565/565 (one transient `prisma.shutdown.spec.ts` timeout in the full run, confirmed the known L24 flake — clean in isolation), `railway-gateway` 3/3·23/23.
- [x] Contabo handoff specifications (`contabo_backend_handoff_spec.md` and `web-chat-stack-specification.md`) read and verified against current repo state.
- [x] `DECISION-LOG.md` flags **F72** and **F65** verified. F65 RESOLVED (Session 9-0). F72 correctly still OPEN at CONFIRM time — resolved in `DECISION-LOG.md` at this session's close, per `EXECUTOR-PROTOCOL.md` §3.

---

## Ordered steps

1. **Review and Verify Contabo Infrastructure Requirements**
   - Confirm server prerequisites with Davin: Contabo VPS running Ubuntu 24.04, Docker Engine & Docker Compose v2, Nginx, Certbot.
   - Document required secrets for Contabo `.env`: `CHAT_JWT_SECRET`, `LLM_API_KEY`, `CORS_ORIGIN` (pointing to Vercel production domain).
   - _Verify:_ Checklist of infrastructure prerequisites complete and verified against `contabo_backend_handoff_spec.md`.

2. **Freeze Socket.IO Contract & Identity Schema**
   - Confirm the client-server event contracts (`client_message`, `support_message`, `chat_error`, `bot_typing`).
   - Specify the BFF token issuance contract (`GET /api/chat/token` generating signed JWT for authenticated users, null for guests).
   - _Verify:_ Spot-check data schemas against `seed-code/.../lib/socket-client.ts` and `components/chat-widget/support-chat-widget.tsx`.

3. **Specify Docker Stack Architecture & Nginx TLS Configuration**
   - Freeze the 3-container `docker-compose.yml` (`socket_chat_server`, `redis_broker`, `ai_bot_worker`).
   - Specify the Nginx reverse proxy configuration and WebSocket upgrade directives (`proxy_read_timeout 86400s`, `Upgrade $http_upgrade`).
   - _Verify:_ Syntax and port bindings verified (`127.0.0.1:3001` reverse proxied to `443 ssl`).

4. **Define Bot Worker AI System Prompt, Rate Limiting & Quota Rules**
   - Specify the AI support prompt boundaries (DavinTrade SaaS platform knowledge, MTF indicators, alert rules, subscription tiers).
   - Define exact quota limit responses and fallback messaging when quota or rate limits are reached.
   - _Verify:_ Fallback messages include direct link/reference to `support@davintrade.app`.

5. **Freeze Frontend Integration Plan & Phase Rollback Mechanism**
   - Document `NEXT_PUBLIC_SOCKET_CHAT_URL` environment variable usage.
   - Specify `next.config.js` CSP `connect-src` addition (`https://chat-api.davintrade.app` and `wss://chat-api.davintrade.app`).
   - Document the zero-downtime rollback mechanism (unsetting `NEXT_PUBLIC_SOCKET_CHAT_URL` degrades widget to mailto ticket form).
   - _Verify:_ Verify that unsetting the URL allows `app/settings/help/page.tsx` and `app/(marketing)/help/page.tsx` to remain 100% functional.

---

## Rules specific to this variant

- Ground truth priority: live code > live specifications > recent migration orders.
- No code or migrations are modified during this CONTRACT session.
- Distinguish verified facts from external infrastructure prerequisites (e.g. Contabo SSH access is provided by Davin).
- Any item marked `⚠ NEEDS EXPLICIT SIGN-OFF` must be explicitly approved by Davin before execution in Session 14-1.

---

## Done when

- [x] `docs/migration-orders/14-0-web-chat-decisions-and-contract.migration-order.md` is complete with all four F72 decisions resolved in `## Decisions taken`.
- [x] Socket.IO event contract (`client_message`, `support_message`, `bot_typing`, `chat_error`) is strictly frozen. Spot-checked against live `lib/socket-client.ts` and `components/chat-widget/support-chat-widget.tsx` in `seed-code/` — topic chips and message shape match; one intentional drift noted in Deviations.
- [x] 3-container Docker Compose and Nginx TLS reverse proxy configurations are fully specified, with the correct `chat-api.davintrade.app` hostname (corrected from the drafted `davintrade.com`).
- [x] Auth bridge and dual-mode (authenticated + guest) security model is fully defined, and matches the live precedent (`hooks/use-realtime-socket.ts` → `GET /api/realtime/token`, F8/Session 4B-17).
- [x] CSP `connect-src` addition and Phase 14 rollback strategy are documented. Bot worker system prompt and quota/rate-limit copy also frozen (§4, added at execution — Step 4's deliverable was not yet written out verbatim in the DRAFT).

---

## Rollback

None for this session (read-only CONTRACT session; no repository code or production systems modified).

**Phase 14 Overall Rollback Plan (for Sessions 14-1 … 14-3):**
If the Contabo chat backend or WebSocket connection encounters issues in production, rollback is instant and zero-risk:

1. Unset or clear `NEXT_PUBLIC_SOCKET_CHAT_URL` in Vercel environment variables.
2. The frontend `useSupportChat()` hook and Help pages (`app/settings/help/page.tsx`, `app/(marketing)/help/page.tsx`) immediately degrade to the proven static FAQ and direct `mailto:support@davintrade.app` email support channels with zero downtime.

---

## Deviations

1. **Domain corrected: `chat-api.davintrade.com` → `chat-api.davintrade.app` (real registered domain differs from the drafted example).** The DRAFT used `davintrade.com` throughout the Nginx `server_name`, DNS A-record spec, `NEXT_PUBLIC_SOCKET_CHAT_URL` example, and CSP `connect-src` addition. At CONFIRM, neither the codebase (`.env.example` had one weak, commented-out `davintrade.com` hint) nor `DECISION-LOG.md` resolved Session 9-0's own still-open Batch-0 finding ("`davintrade.com` vs `davin-trade.com`") — so this was asked of Davin directly rather than guessed. **Davin's answer was neither option: the real domain is `davintrade.app`** (confirmed via a live Zoho Mail admin dashboard screenshot showing the organization's registered domain and mail hosting). This also resolves Session 9-0's long-open Batch-0 ambiguity definitively — neither `.com` spelling was correct. **Impact:** every hostname reference in the order (Nginx vhost, SSL cert paths, DNS target, CSP `connect-src`, `NEXT_PUBLIC_SOCKET_CHAT_URL` example) corrected to `.app` before being treated as frozen. Sessions 14-1/14-2 must use `davintrade.app`, not `.com`. Flagging for a future session to close Session 9-0's Batch-0 finding formally in its own tracking doc (`frontend-swap-route-map.md` or equivalent) — out of scope to edit here.
2. **Support email corrected: `support@davintrade.com` → `support@davintrade.app`.** Same root cause as #1 — asked Davin directly rather than assume the email domain matched the app domain (some orgs split these). Confirmed via the same Zoho Mail screenshot that mail is hosted on `davintrade.app`. Used a generic `support@davintrade.app` alias throughout, not the personal super-admin address visible in the screenshot — that address is irrelevant to this document and was not written into any file.
3. **Step 4's bot system-prompt deliverable, absent from the DRAFT verbatim, authored at execution.** The DRAFT's Decision 3 described the AI engine choice and quota-ceiling behavior but never wrote out the actual system-prompt text Step 4 calls for ("Specify the AI support prompt boundaries"). Added `## Technical Specifications & Frozen Contracts` §4, grounded in copy that already ships in `lib/socket-client.ts`'s `generateFallbackResponse()` (product facts already reviewed, not new claims) rather than inventing fresh product copy.
4. **L3 status-integrity pattern, resolved via live confirmation (not a hard blocker, but material).** The order and its prerequisites (`MASTER-ROADMAP-PHASES-7-15.md`'s reorder banner, `CLAUDE.md`'s matching note) carried zero git commit history at CONFIRM time — the order file itself was untracked, and its two `⚠ NEEDS EXPLICIT SIGN-OFF` items (Decision 1, Decision 4) are not covered by a general order approval per `EXECUTOR-PROTOCOL.md` §0. Surfaced directly rather than assumed; **Davin explicitly confirmed live in chat, 2026-08-30: "I explicitly confirm that I have reviewed and APPROVED the Session 14-0 order, with explicit sign-offs on Decision 1 (Domain/TLS architecture for chat-api) and Decision 4 (Dual-mode socket auth semantics via BFF token bridge)."** Unlike most L3 recurrences, this instance involved an entire uncommitted document chain (order + roadmap + `CLAUDE.md`), not just a lagging header — but cross-document consistency (roadmap banner, `CLAUDE.md` state block, and the Phase 14 handover prompt all told the same 2026-08-30 reorder story independently) supported treating it as benign pending Davin's confirmation, which then closed the check.
5. **Minor drift, not corrected (informational only):** the order's frozen `ClientMessagePayload` omits the `sender` field present in the live seed's `ChatMessage` type (`lib/socket-client.ts:5-17`). Left as-is — Decision 4 has the server stamp identity itself rather than trust a client-asserted field, which is presumably why `sender` was dropped, but the order never states this explicitly. Flagging for Session 14-2 to confirm intent when reconciling the seed's socket client against this frozen contract.
6. **Stale LLM model identifiers, not corrected (informational only):** Decision 3 and the `docker-compose.yml` `LLM_MODEL` example cite `gemini-1.5-flash` / `claude-3-5-haiku-20241022` — both legacy identifiers relative to 2026-08-30 and the current Claude lineup. Not fixed here since this is a no-code CONTRACT session and exact model pinning is Session 14-1's job; flagging so 14-1 re-confirms the actual model before deploying.

---

## Next-session handoff

At the close of Session 14-0 (upon Davin's approval), the Executor will CONFIRM the order, register the F72 resolution in `DECISION-LOG.md`, update `CLAUDE.md`, and PRE-DRAFT **Session 14-1** (`14-1-container-stack-build-and-deploy.migration-order.md`, Variant: INFRA) to build and deploy the 3-container Docker stack and Nginx SSL configuration on Davin's Contabo VPS.

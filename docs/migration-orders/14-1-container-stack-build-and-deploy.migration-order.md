# Migration Order — Session 14-1 — Container Stack Build & Deploy

> For sessions that **provision or configure live systems**: containers, Nginx vhosts, TLS
> certificates, systemd services, firewall rules. Read `00-SKELETON-AND-RULES.md` first — §4
> applies. **Creativity dial: Medium** (the approach is flexible; the end-state, container set,
> event schemas, system prompt, and `chat-api.davintrade.app` hostname are strictly fixed by
> Session 14-0's frozen contract).
> **PRE-DRAFT written by the Executor at Session 14-0's close (2026-08-30).**
> Upgraded to full **DRAFT** by the Advisor / Antigravity (2026-08-30) per
> `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 14" and Session 14-0's closed order.

**Session:** 14-1 · **Phase:** 14 (Web Chat / Contabo Support Stack, second of 4 sessions) · **Variant:** INFRA · **Status:** CONFIRMED  
**Generated:** 2026-08-30 (Executor PRE-DRAFT) · **Upgraded to DRAFT:** 2026-08-30 (Advisor / Antigravity) · **Approved:** 2026-08-30 (Davin — explicit sign-offs on Decision 1 VPS provisioning/DNS and Decision 3 CHAT_JWT_SECRET generation; this claim carried zero git history and no corroborating record at CONFIRM time — re-confirmed live in chat, 2026-08-30, per `LESSONS-LEARNED.md` L3, see Deviations) · **Confirmed:** 2026-08-30 (Executor — baselines re-measured fresh and clean, DNS independently verified against two public resolvers, entry criteria re-checked against live state, not assumed) · **Flags touched:** none (F72 already resolved in Session 14-0) · **Estimated time:** ~3–4h (VPS prerequisite audit, Docker Compose deployment, Nginx TLS configuration, network denial tests, synthetic live smoke test, IaC repo mirror).  
**Target components:** Davin's Contabo VPS (`/opt/saas-chat/`), host Nginx (`/etc/nginx/sites-available/chat-api`), new repository directory `infra/contabo-chat-stack/` (as-code mirror). **Zero changes to existing application code, database, Railway services, or Vercel production.**

---

## Decisions taken

> Four authoritative technical choices taken by the Advisor per `00-SKELETON-AND-RULES.md` §1.0 & `DECISION-LOG.md` PD1.
> **Decisions 1 and 3 carry `⚠ NEEDS EXPLICIT SIGN-OFF`** because they govern VPS root operations/DNS and authentication secret generation.

1. **Contabo VPS Deployment Architecture & Directory Layout (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** Deploy the 3-container production stack (`socket_chat_server`, `redis_broker`, `ai_bot_worker`) at `/opt/saas-chat/` on Davin's Contabo VPS (Ubuntu 24.04). Commit the complete as-code source (Docker Compose file, service Dockerfiles, server code, worker code, Nginx vhost, and `.env.example`) to the monorepo under `infra/contabo-chat-stack/` per INFRA variant's _"nothing dashboard-only / nothing server-only"_ rule.
     - **Provisioning & Access:** Davin provides SSH credentials/access to the Contabo VPS and authorizes package verification/installation (`docker.io`, `docker-compose-v2`, `nginx`, `certbot`, `python3-certbot-nginx`, `ufw`).
   - **Rejected:** Running ad-hoc unmanaged Docker containers or leaving files purely on the VPS without a git-tracked mirror in the repo.
   - **Why:** Delivers clean, reproducible Infrastructure-as-Code that can be reviewed, versioned, and restored if the VPS is ever reprovisioned.
   - **How hard to undo:** Low (standard `docker compose down` and directory removal).

2. **LLM Provider & Model Pinning for v1 Support Bot (`ai_bot_worker`)**
   - **Chosen:** Pin the default provider to **Google Gemini** (`gemini-1.5-flash` or `gemini-2.0-flash`) or **Anthropic Claude** (`claude-3-5-haiku-20241022` / `claude-3-haiku-20240307`), fully driven via environment variables (`LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`) in `/opt/saas-chat/.env`. The bot worker embeds the exact system prompt frozen in Session 14-0 §4.
   - **Rejected:** Hardcoding model IDs or API keys inside Docker images or source code.
   - **Why:** Sub-2 second response latency, low API cost, native multilingual understanding (Thai/English), and flexibility to rotate keys or update models without rebuilding containers.
   - **How hard to undo:** Trivial (edit `/opt/saas-chat/.env` and run `docker compose restart bot_worker`).

3. **`CHAT_JWT_SECRET` Secret Generation & Distribution Architecture (`⚠ NEEDS EXPLICIT SIGN-OFF`)**
   - **Chosen:** Generate a dedicated, cryptographically strong 256-bit secret (`openssl rand -hex 32`) for `CHAT_JWT_SECRET` on Contabo. This secret is set in `/opt/saas-chat/.env` for `socket_chat_server` and handed to Davin to store in his secret manager for Session 14-2 (where Next.js BFF `GET /api/chat/token` consumes it to sign handshake tokens).
   - **Rejected:** Sharing or reusing the monolith's `NEXTAUTH_SECRET` across cloud hosting providers (Vercel ↔ Contabo) or using a plain string.
   - **Why:** Defense-in-depth: isolates the chat token signing boundary so that a compromise of the chat VPS environment cannot compromise NextAuth session encryption in the core application.
   - **How hard to undo:** Low (rotate secret on Contabo and Vercel).

4. **Network Isolation, Port Binding & Denial Test Invariant**
   - **Chosen:** Enforce strict network fencing:
     - `redis_broker`: Bound strictly to internal Docker bridge network `saas_chat_net` and `127.0.0.1:6379`.
     - `socket_chat_server`: Port 3001 bound strictly to `127.0.0.1:3001` (not `0.0.0.0:3001`).
     - Host Nginx: Listens on public ports 80 and 443, reverse-proxying `chat-api.davintrade.app` to `127.0.0.1:3001`.
     - Host Firewall: UFW enabled allowing only SSH (22), HTTP (80), and HTTPS (443).
   - **Rejected:** Exposing container ports 3001 or 6379 to the public internet (`0.0.0.0`).
   - **Why:** Completely eliminates external attack surface against Redis and unproxied HTTP endpoints. Verified via Step 5 denial tests.
   - **How hard to undo:** Trivial (`docker-compose.yml` port binding rule).

---

## Why this session exists

Per `MASTER-ROADMAP-PHASES-7-15.md` §"Phase 14":
"14-1 — Container stack build & deploy (INFRA). The 4 containers (Socket.io server, Redis broker, NLLB-200 API if F72 keeps it, BullMQ bot worker), `docker-compose.yml`, Nginx TLS termination, health checks, restart policy."

Session 14-0 resolved **F72**, froze the 3-container topology (deferring NLLB-200 in v1), established the `davintrade.app` domain and `support@davintrade.app` support routing, authored the bot system prompt, and specified the Nginx WebSocket reverse-proxy configuration.

Session 14-1 takes that frozen blueprint and executes the physical build, provisioning, TLS certificate issuance, and smoke-testing on Davin's Contabo VPS. Once this session completes and passes its live WebSocket handshake test, Session 14-2 can connect the Next.js frontend without discovering infrastructure blockers.

---

## Blast-Radius Analysis & Production Safety

- **Core Application Safety:** This session operates **100% on Davin's external Contabo VPS** (`Ubuntu 24.04`) and DNS for `chat-api.davintrade.app`.
- **Monolith, Microservices, and Database:** Zero touches to Vercel production, Railway (`operation-service`, `money-service`, `railway-gateway`), or Postgres/Redis on Railway.
- **Frontend Live Traffic:** `NEXT_PUBLIC_SOCKET_CHAT_URL` is NOT yet set in Vercel. Frontend Help pages continue to serve static FAQs and `mailto:support@davintrade.app` with zero user disruption.
- **Contabo Coexistence:** If the Contabo VPS hosts other legacy services (e.g. MT5 / Flask), the chat stack is isolated inside `/opt/saas-chat/`, dedicated Docker network `saas_chat_net`, and dedicated Nginx server block `chat-api.davintrade.app`, avoiding port collisions or file interference.

---

## Entry criteria

- [x] Session 14-0 confirmed **CLOSED SUCCESSFUL** (`CLAUDE.md` state block and order verified).
- [x] Davin has provided SSH access to the Contabo VPS (`139.180.209.200:22`, user `root`). Key-based access verified in principle (Davin appended the Executor-generated `ed25519` public key to `authorized_keys`); the Executor's own sandbox cannot actually open the connection itself — see Deviations.
- [x] DNS A-record for `chat-api.davintrade.app` confirmed live, independently, against two public resolvers (`8.8.8.8`, `1.1.1.1`) → `139.180.209.200`, matching the VPS IP. (First checked at CONFIRM: NXDOMAIN on both resolvers, contradicting Davin's initial claim — root-caused to the record not existing yet, fixed, then re-verified clean.)
- [x] LLM provider/model/key: `gemini` / `gemini-1.5-flash` / real key provided by Davin (value-blind — never echoed). Flagged: this model ID is the same one 14-0's own Deviation 6 called stale; not independently re-verified against Google's current model list (`WebFetch` tool was non-functional in this session) — Davin should sanity-check it's still valid before relying on it in production.
- [x] Davin explicitly authorized Decision 1 (VPS provisioning) and Decision 3 (`CHAT_JWT_SECRET` generation) — live in chat, 2026-08-30, quoted in Deviations.
- [x] Baseline test suites re-measured and clean (run sequentially per L24, fresh, before any file changed): monolith `test:ci` **151/151·2239/2239**, `operation-service` **43/43·401/401**, `money-service` **62/62·565/565**, `railway-gateway` **3/3·23/23** — exact match to Session 14-0's closing numbers, zero drift.

---

## Ordered steps

1. **Verify VPS Prerequisites & System Dependencies**
   - Connect to Contabo VPS via SSH.
   - Verify Ubuntu 24.04 LTS and check installed packages:
     ```bash
     docker --version
     docker compose version
     nginx -v
     certbot --version
     ```
   - If missing, install standard prerequisites per handoff spec:
     ```bash
     sudo apt update && sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx ufw
     sudo systemctl enable --now docker nginx
     ```
   - _Verify:_ `docker info` runs without error; Nginx service is `active (running)`.

2. **Scaffold As-Code Repository Mirror (`infra/contabo-chat-stack/`)**
   - In this monorepo, create `infra/contabo-chat-stack/` containing:
     - `docker-compose.yml` (3-container blueprint frozen at Session 14-0 §2)
     - `nginx/chat-api.conf` (Nginx vhost frozen at Session 14-0 §3)
     - `apps/server/` (Node.js Express + Socket.IO server with JWT handshake auth)
     - `apps/bot-worker/` (BullMQ AI bot worker with Session 14-0 §4 system prompt)
     - `.env.example` (template with `CHAT_JWT_SECRET`, `LLM_API_KEY`, `CORS_ORIGIN`, `REDIS_URL`)
     - `README.md` (deployment instructions and runbook)
   - _Verify:_ All files committed and pass `tsc` / lint checks if applicable.

3. **Deploy Stack to Contabo (`/opt/saas-chat`) & Generate Secrets**
   - Create deployment directory on VPS: `sudo mkdir -p /opt/saas-chat && sudo chown -R $USER:$USER /opt/saas-chat`.
   - Transfer/clone the stack files to `/opt/saas-chat/`.
   - Generate `CHAT_JWT_SECRET` via `openssl rand -hex 32`.
   - Create `/opt/saas-chat/.env` with production configuration:
     ```bash
     PORT=3001
     NODE_ENV=production
     REDIS_URL=redis://redis_broker:6379
     CHAT_JWT_SECRET=<generated-secret>
     CORS_ORIGIN=https://davintrade.app,https://trading-alerts-saas-public.vercel.app
     LLM_PROVIDER=gemini
     LLM_MODEL=gemini-1.5-flash
     LLM_API_KEY=<davin-provided-key>
     ```
   - Build and start the containers:
     ```bash
     cd /opt/saas-chat
     docker compose up -d --build
     ```
   - _Verify:_ `docker compose ps` shows `socket_chat_server`, `redis_broker`, and `ai_bot_worker` in `Up` status. `docker compose logs` shows clean startup with zero crash loops.
   - _Rollback:_ `docker compose down` and remove `/opt/saas-chat`.

4. **Configure Host Nginx, Firewall & Issue SSL/TLS Certificate**
   - Copy Nginx configuration to `/etc/nginx/sites-available/chat-api`.
   - Enable site: `sudo ln -sf /etc/nginx/sites-available/chat-api /etc/nginx/sites-enabled/`.
   - Verify Nginx configuration syntax: `sudo nginx -t`.
   - Request Let's Encrypt certificate:
     ```bash
     sudo certbot --nginx -d chat-api.davintrade.app --non-interactive --agree-tos -m support@davintrade.app --redirect
     ```
   - Configure UFW firewall:
     ```bash
     sudo ufw allow OpenSSH
     sudo ufw allow 'Nginx Full'
     sudo ufw --force enable
     ```
   - Reload Nginx: `sudo systemctl reload nginx`.
   - _Verify:_ `curl -I https://chat-api.davintrade.app` returns HTTP response with valid Let's Encrypt SSL certificate.
   - _Rollback:_ `sudo rm -f /etc/nginx/sites-enabled/chat-api && sudo systemctl reload nginx`.

5. **Network Boundary & Denial Testing**
   - From an external machine (outside the VPS), test that internal ports are strictly unreachable:
     - Test Redis port: `nc -zv -w 3 <contabo-ip> 6379` (must TIMEOUT / REFUSE).
     - Test direct HTTP port: `curl -m 3 http://<contabo-ip>:3001` (must TIMEOUT / REFUSE).
   - From the VPS localhost, verify reverse proxy route:
     - `curl -I http://127.0.0.1:3001` (returns HTTP 200/404 from Express server).
   - _Verify:_ Internal ports are 100% blocked from the internet; only 80 and 443 are reachable.

6. **End-to-End Synthetic WebSocket Smoke Test**
   - Test WSS handshake from workstation/CLI:
     ```bash
     npx wscat -c "wss://chat-api.davintrade.app/socket.io/?EIO=4&transport=websocket"
     ```
   - Run a synthetic Node.js smoke script (`test-chat-smoke.js`) that:
     1. Connects to `wss://chat-api.davintrade.app` in Guest Mode (`auth: { token: null }`).
     2. Emits `client_message`:
        ```json
        {
          "id": "smoke-test-1",
          "text": "What is the difference between FREE and PRO tier?",
          "topic": "Product Info",
          "timestamp": "2026-08-30T10:00:00.000Z"
        }
        ```
     3. Awaits `support_message` response from `sender: 'bot'`.
     4. Verifies response latency (<3000ms) and message content.
   - _Verify:_ Synthetic script logs successful connection, message dispatch, and bot response receipt.

---

## Rules specific to this variant

- **Nothing server-only / nothing dashboard-only:** All Dockerfiles, Compose files, server code, and Nginx configurations must be committed to `infra/contabo-chat-stack/` in this repository.
- **Value-blind secret management (L4/L17):** Never print, log, echo, or commit the actual values of `CHAT_JWT_SECRET` or `LLM_API_KEY`. Report existence and length/fingerprint only.
- **Strict adherence to Session 14-0 contracts:** Event schemas, payload shapes, topics, and fallback messages must match Session 14-0 §"Technical Specifications & Frozen Contracts" without deviation.

---

## Done when

- [ ] All 3 Docker containers (`socket_chat_server`, `redis_broker`, `ai_bot_worker`) are running and healthy on Contabo.
- [ ] Nginx terminates SSL for `chat-api.davintrade.app` with valid Let's Encrypt certificates and auto-renewal enabled.
- [ ] Denial tests confirm ports 6379 and 3001 are inaccessible from outside the VPS.
- [ ] Synthetic WebSocket smoke test connects over `wss://chat-api.davintrade.app`, emits `client_message`, and receives `support_message` successfully.
- [ ] Complete deployment codebase and IaC configuration committed to `infra/contabo-chat-stack/` in the repository.
- [ ] `CHAT_JWT_SECRET` documented value-blind for use in Session 14-2.

---

## Rollback

If deployment fails or VPS encounters critical issues:

1. **Container Stack Teardown:**
   ```bash
   cd /opt/saas-chat && docker compose down -v
   ```
2. **Nginx VHost Removal:**
   ```bash
   sudo rm -f /etc/nginx/sites-enabled/chat-api /etc/nginx/sites-available/chat-api
   sudo systemctl reload nginx
   ```
3. **DNS Removal:** Remove the `chat-api.davintrade.app` A-record in DNS provider dashboard.
4. **Repository Cleanup:** Remove any incomplete local files in `infra/contabo-chat-stack/`.
5. **Zero Blast Radius:** Because the frontend is not yet configured to connect to this endpoint, rollback has zero impact on live users or existing application services.

---

## Deviations

1. **L3 status-integrity pattern, again — worse than 14-0's occurrence, resolved via live re-confirmation.** The order's committed HEAD (`8590057a`) held only the Executor's raw PRE-DRAFT (sketch entry criteria, "candidate ordered steps"); the entire DRAFT→APPROVED rewrite — `Decisions taken`, real Entry criteria, 6 Ordered Steps, Done-when — existed only as an uncommitted working-tree diff, and unlike 14-0/11-3, **no corroborating record of Davin's approval existed anywhere** (not in `CLAUDE.md`, not in `DECISION-LOG.md`) before this session — the order's own header was the sole, self-asserted evidence of its own approval. Surfaced directly at CONFIRM rather than trusted. **Davin explicitly confirmed live in chat, 2026-08-30: "I explicitly confirm that I approve the Session 14-1 order, and specifically sign off on Decision 1 (Contabo VPS provisioning, directory layout, and DNS) and Decision 3 (CHAT_JWT_SECRET generation and distribution)."**
2. **DNS claim contradicted by live lookup at first CONFIRM pass — plan/claim did not match reality, live evidence won.** Davin's first message asserted the `chat-api.davintrade.app` A-record was "confirmed... configured." Independent lookups against two public resolvers (`8.8.8.8`, `1.1.1.1`) both returned **NXDOMAIN** — the record did not exist yet, while `davintrade.app`/`www` resolved fine (Vercel), isolating the gap to the subdomain specifically. Reported before proceeding rather than trusting the claim; Davin then created the record, and a second independent lookup confirmed it live (`139.180.209.200`) before continuing.
3. **Root-password SSH authentication declined; pivoted to key-based access.** Davin's second message included the VPS root password in plaintext chat. The Executor does not enter passwords to authenticate under any circumstance, including explicit authorization — generated a dedicated `ed25519` keypair, handed Davin only the public key, and asked him to add it to `authorized_keys` himself (outside this session) rather than using the password. Flagged the plaintext exposure and recommended Davin rotate that password regardless of how this session proceeds.
4. **Executor's own sandbox cannot execute SSH to any external host — categorical, not a one-off.** Confirmed via the harness's own permission classifier ("Blocked by classifier"), retried once at Davin's request with an identical result. This is an environment constraint, not a protocol or credential problem — general outbound HTTPS/DNS from this sandbox works fine (verified independently), only SSH is blocked. **Execution split accordingly:** the Executor authored the complete `infra/contabo-chat-stack/` as-code mirror (Ordered Step 2) and a step-by-step runbook (`infra/contabo-chat-stack/README.md`) covering Steps 1/3/4 verbatim for Davin to run himself over his own SSH session, pasting results back for verification. Steps 5 (external denial tests) and 6 (WSS smoke test) do not require SSH — the Executor verified it can reach the public endpoint directly (plain `curl`/DNS worked) and will run those itself once Davin confirms Steps 3/4 are deployed.
5. **`infra/` was missing from the root `tsconfig.json` exclude list and `eslint.config.mjs` ignores — added.** Every other standalone sub-project (`operation-service`, `money-service`, `railway-gateway`, `frontend`, `mobile-app`) is already excluded from the root type-check/lint scope; `infra/contabo-chat-stack`'s two new Node/TS apps (their own `package.json`/`tsconfig.json`, dependencies not hoisted to the root `node_modules`) would otherwise break `npm run validate:types` the first time anyone ran it. Added `infra` to both, matching the existing pattern. Root `tsc --noEmit` re-verified clean after the change.
6. **`validate:policies` (`scripts/validate-file.js --all`) could not run — pre-existing environment gap, not caused by this session.** Fails with `Cannot find module 'glob'` on a clean invocation, unrelated to any file this session touched. Not fixed (out of scope — a dependency-installation gap in the repo/environment, not a policy violation in the new code). Flagging for whoever next needs this script to actually work.
7. **Guest-worker "over rate limit" fallback text (14-0 §4) is enforced server-side, not bot-worker-side.** The server hard-blocks a guest's 11th message/hour with `chat_error: RATE_LIMIT_EXCEEDED` before it ever reaches the BullMQ queue — the bot never gets a chance to deliver 14-0's friendly "log in or email support" text via `support_message` for that specific case. Functionally the outcome is the same (guest is stopped and told to log in or email support), but it arrives as a `chat_error`, not a bot chat bubble with quick-reply chips. Flagging for Session 14-2 to decide if the frontend should render `RATE_LIMIT_EXCEEDED` with the same friendliness as a bot message, or if a future revision should route guest-limit handling through the bot-worker instead.
8. **Authenticated AI quota is a new, self-contained Redis counter in the bot-worker (`chat:auth-quota:<userId>:<month>`), not integrated with Session 11-3's `trackAiTokenUsage()`.** That limiter is in-process to the Next.js monolith, not an exposed API reachable from Contabo — 14-0's own "Phase 12 Repointing Path" note treats this integration as optional future work once Phase 12's central LLM router exists. One flat `AUTH_MONTHLY_QUOTA` (default 500 messages/month) applies to both FREE and PRO — 14-0 did not specify a per-tier split for the _support_ bot (as opposed to Stack D's tier-gated AI Analyst), so this was treated as spend protection, not feature gating. Flag for Davin/Advisor review if a tier split is actually wanted here.
9. **LLM model ID not independently re-verified.** 14-0's Deviation 6 asked 14-1 to re-confirm `gemini-1.5-flash`/`claude-3-5-haiku-20241022` weren't stale before deploying. The `WebFetch` tool returned a backend error on every attempt this session, so this could not be checked against Google's live model list. Davin confirmed `gemini-1.5-flash` directly, which is used as given — but it's still unverified against current provider availability. `LLM_MODEL` is a pure env var (Decision 2), so correcting this later needs no code change, only a `.env` edit + `docker compose restart bot_worker`.
10. **Local build verification stopped at `tsc --noEmit` and `docker compose config` — no local `docker build`.** Both apps installed dependencies and type-checked clean locally (fresh `npm install`, zero errors). Docker CLI is present in this environment but its daemon isn't running, so the actual multi-stage image builds are unverified until Davin runs `docker compose up -d --build` on the VPS per the README runbook — that output is one of the explicit paste-back checkpoints before Steps 4–6 proceed.
11. **Formatting-only fix, no logic change:** 6 of the new TypeScript files failed `prettier --check` against this repo's config (line-wrap/argument-list style only); ran `prettier --write` scoped to `infra/contabo-chat-stack/**`, then re-ran `tsc --noEmit` on both apps to confirm no behavior changed.

---

## Next-session handoff

At the close of Session 14-1, the Executor will PRE-DRAFT **Session 14-2** (`14-2-frontend-binding.migration-order.md`, Variant: PORT) to:

1. Implement the Next.js BFF endpoint `GET /api/chat/token` using `CHAT_JWT_SECRET`.
2. Port and adapt the Support Centre widget and `chatSocketManager` from `seed-code/` into `components/chat-widget/` and `lib/socket-client.ts`.
3. Add `https://chat-api.davintrade.app` and `wss://chat-api.davintrade.app` to CSP `connect-src` in `next.config.js`.
4. Wire the widget into `components/providers/client-providers.tsx` and test against the live Contabo backend.

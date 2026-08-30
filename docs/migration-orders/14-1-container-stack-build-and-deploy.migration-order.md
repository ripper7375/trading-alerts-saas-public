# Migration Order — Session 14-1 — Container Stack Build & Deploy

> For sessions that **provision or configure live systems**. Read `00-SKELETON-AND-RULES.md`
> first — §4 applies. **Creativity dial: Medium** (the approach is flexible; the end-state,
> container set, and hostnames are fixed by Session 14-0's frozen contract).
> **PRE-DRAFT written by the Executor (Claude Code) at Session 14-0's close, 2026-08-30.** Raw
> facts and candidate steps only — the Advisor resolves any remaining judgment calls and produces
> the DRAFT per `00-SKELETON-AND-RULES.md` §1.0.

**Session:** 14-1 · **Phase:** 14 (Web Chat / Contabo Support Stack, second of 4 sessions) · **Variant:** INFRA · **Status:** PRE-DRAFT
**Generated:** 2026-08-30 (Executor PRE-DRAFT) · **Flags touched:** none (F72 already resolved at 14-0) · **Estimated time:** ~3–4h (provisioning, deploy, live smoke test — no application code beyond what 14-0 already froze)

## Raw facts carried forward from Session 14-0 (CLOSED SUCCESSFUL, 2026-08-30)

- **All contracts are frozen** in `14-0-web-chat-decisions-and-contract.migration-order.md` §"Technical Specifications & Frozen Contracts": the 3-container `docker-compose.yml` (`chat_server`, `redis`, `bot_worker` — NLLB-200 deferred), the Nginx reverse-proxy/TLS vhost, the Socket.IO event contract, and the bot-worker system prompt/quota rules. This session builds exactly that — no new architecture decisions belong here.
- **Real domain is `chat-api.davintrade.app`**, not the Contabo handoff spec's own placeholder `chat-api.yourdomain.com` or the order's own initial drafting mistake (`davintrade.com`) — corrected and Davin-confirmed at Session 14-0's CONFIRM. Use `.app` everywhere: DNS A-record, Nginx `server_name`, Certbot cert request, `CORS_ORIGIN`.
- **Support email is `support@davintrade.app`** (same domain correction) — appears in the bot's quota-ceiling fallback text and rate-limit messaging; no code path in this session emits it, but keep it consistent if any config/env var echoes it.
- **This is genuinely new territory for the migration:** every prior INFRA session (4A-1, 4B-1, 8-2, etc.) provisioned Railway. This is Davin's own Contabo VPS, reached over SSH — no `railway up`, no Railway CLI lessons apply here. `EXECUTOR-PROTOCOL.md`'s do-not-touch list and money/auth escalation rules still apply in full; nothing about the deploy mechanism changes them.
- **Secrets needed** (values only in Contabo's `.env` / Davin's secret store — never in git, per `LESSONS-LEARNED.md` L4): `CHAT_JWT_SECRET` (new — shared between the Next.js BFF's `GET /api/chat/token` issuer, built at 14-2, and the Contabo socket server's verifier, built here — so both sides need the same value; consider whether this session or 14-2 generates it first), `LLM_API_KEY` (Gemini or Claude — Decision 3 named both as options, provider not yet pinned), `CORS_ORIGIN` (the Vercel production origin).
- **LLM model identifiers in the frozen `docker-compose.yml` are stale** (`gemini-1.5-flash` / `claude-3-5-haiku-20241022` — flagged as a Deviation at 14-0). This session should re-confirm the actual current model before pinning `LLM_MODEL` in the real `.env`, not copy the placeholder forward uncritically.
- **No code in this repo changes.** The 4 files this session produces (`docker-compose.yml`, the two app Dockerfiles for `apps/server`/`apps/bot-worker`, the Nginx vhost) live on Davin's Contabo VPS, not in `trading-alerts-saas-public`. Whatever gets committed to THIS repo should be the as-code source (per INFRA variant's "nothing dashboard-only" rule) — likely a new `docs/runbooks/` or `infra/contabo-chat-stack/` directory mirroring what's deployed, so it's not dashboard/SSH-session-only.
- **Contabo access, DNS, and Certbot issuance are Davin's to provide** (per 14-0's own "Provisioning Responsibilities" — he provides SSH access and configures the DNS A-record; Certbot issuance needs his approval). Not blockers to drafting this order, but hard blockers to executing Ordered Step 1 below.

## Candidate entry criteria (Advisor/Davin to finalize)

- [ ] Session 14-0 confirmed **CLOSED SUCCESSFUL** (`CLAUDE.md` state block verified).
- [ ] Davin has provided: Contabo SSH access, the DNS A-record for `chat-api.davintrade.app` pointed at the VPS's public IPv4, and confirmed Docker Engine + Docker Compose v2 + Nginx + Certbot are installed (or approved installing them as Step 0).
- [ ] `CHAT_JWT_SECRET`, `LLM_API_KEY`, and the actual (non-stale) LLM provider/model choice are available.
- [ ] Blast-radius statement: this session touches only Davin's standalone Contabo VPS and new DNS records — zero risk to the monolith, `operation-service`, `money-service`, `railway-gateway`, or any existing production traffic. The chat stack is not live-linked to the frontend until Session 14-2 sets `NEXT_PUBLIC_SOCKET_CHAT_URL`, so this session can fail/retry freely without user-facing impact.

## Candidate ordered steps (raw sketch — Advisor to firm up)

1. Confirm Contabo prerequisites live (Ubuntu 24.04, Docker/Compose v2, Nginx, Certbot) — install what's missing.
2. Author the 3-container `docker-compose.yml` at `/opt/saas-chat/` per 14-0's frozen spec (verbatim, with `.app` domain), plus minimal `apps/server`/`apps/bot-worker` scaffolding (or clone/adapt the handoff spec's referenced starter repos — verify those repos actually exist and are reachable before depending on them).
   _Verify:_ `docker compose up -d --build` brings up all 3 containers; `docker ps` shows all healthy.
3. Configure DNS A-record + Nginx vhost + Certbot per 14-0's frozen Nginx config (`.app` domain).
   _Verify:_ `npx wscat -c wss://chat-api.davintrade.app/socket.io/?EIO=4&transport=websocket` (or equivalent) gets a real handshake response.
4. Denial/boundary test: confirm the Redis and bot-worker containers are NOT reachable from outside `127.0.0.1` (only `chat_server` is reverse-proxied).
   _Verify:_ external `nc`/`curl` to ports 6379 and the bot-worker's internal port both fail/timeout from outside the VPS.
5. Commit the as-code source (compose file, Nginx vhost, Dockerfiles) into this repo under a new `infra/contabo-chat-stack/` (or similar) directory — per INFRA variant's "nothing dashboard-only" rule — even though the runtime lives outside this repo.
6. Live smoke test: connect a throwaway `socket.io-client` script, send a `client_message`, confirm the bot worker's fallback/LLM reply comes back as `support_message` within a reasonable time.

## Rules specific to this variant

- Nothing dashboard-only — the compose file, Nginx vhost, and Dockerfiles must exist as committed, reviewable text, not just live on the VPS.
- Do not deviate from 14-0's frozen container set, event contract, or hostname without stopping and asking Davin — those are this session's fixed end-state, not open questions.
- Secrets: names/purpose documented here and in the order; values only ever touch Contabo's `.env` or Davin's secret manager, never this git repo (`LESSONS-LEARNED.md` L4 — never even echo a secret value to confirm it's set).

## Done when

- [ ] All 3 containers live and healthy on Contabo, `chat-api.davintrade.app` resolves and completes a real WSS handshake.
- [ ] Denial tests pass (Redis/bot-worker not externally reachable).
- [ ] Compose file, Nginx vhost, and Dockerfiles committed as-code in this repo.
- [ ] A throwaway client can send `client_message` and receive a `support_message` reply end-to-end.

## Rollback

Tear down: `docker compose down` on Contabo, remove the Nginx vhost + Certbot cert, remove the DNS A-record. Zero impact on any existing production system either way — nothing in this repo's deployed services (Vercel/Railway) references the chat stack until Session 14-2.

## Deviations

_(filled during execution)_

## Next-session handoff

At Session 14-1's close, the Executor PRE-DRAFTs **Session 14-2** (`14-2-frontend-binding.migration-order.md`, Variant: PORT) — `NEXT_PUBLIC_SOCKET_CHAT_URL`, the real socket client, Support Centre widget wiring, `GET /api/chat/token` BFF endpoint, and the `next.config.js` CSP `connect-src` addition (`https://chat-api.davintrade.app` / `wss://chat-api.davintrade.app`) frozen at 14-0 §5.

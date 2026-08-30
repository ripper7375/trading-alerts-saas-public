# Runbook — Contabo Chat Stack (CC-G)

**Live since:** Session 14-3 (2026-08-30) · **Owner:** Davin (VPS root) / Executor (external verification, app-side changes)
**Serves:** the Support Centre chat widget on `https://davintrade.app`, backed by `https://chat-api.davintrade.app`.

This is the **operational** runbook — day-2 maintenance, monitoring, and recovery. The **build/deploy**
runbook (initial provisioning, TLS issuance, first-time secrets) is
`infra/contabo-chat-stack/README.md` — read that first if the stack doesn't exist yet at all.

---

## 1. Architecture & container topology

```
Browser (davintrade.app, Vercel) --wss--> Nginx :443 (TLS) --> 127.0.0.1:3001 socket_chat_server
                                                                        |
                                                                BullMQ queue (Redis, 127.0.0.1:6379)
                                                                        |
                                                                  ai_bot_worker --> Gemini API
```

Deployed at `/opt/saas-chat/` on Davin's Contabo VPS (`139.180.209.200`), from the as-code mirror at
`infra/contabo-chat-stack/` in this repo (source of truth — `/opt/saas-chat/` is a deployment of it,
never hand-edited independently).

| Container            | Image / build                             | Role                                                                                                                                                                                | Exposure                                              |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `socket_chat_server` | `apps/server` (Node/Express/Socket.IO)    | Handshake auth (verifies the JWT minted by `GET /api/chat/token`), guest rate limiting, emits jobs to the queue, relays `support_message`/`bot_typing`/`chat_error` back to clients | `127.0.0.1:3001` only — reverse-proxied by host Nginx |
| `redis_broker`       | `redis:7-alpine`                          | Pub/sub + BullMQ queue between server and worker                                                                                                                                    | `127.0.0.1:6379` only — **never** expose to `0.0.0.0` |
| `ai_bot_worker`      | `apps/bot-worker` (Node, BullMQ consumer) | Consumes `client_message` jobs, calls the LLM, publishes the reply carrying `socketId` in its own job return value (see the `removeOnComplete`/`QueueEvents` race note below)       | No exposed port — outbound only (LLM API)             |

Host Nginx (`/etc/nginx/sites-available/chat-api`, mirrored at
`infra/contabo-chat-stack/nginx/chat-api.conf`) terminates TLS and reverse-proxies `/` (Socket.IO +
REST) to `127.0.0.1:3001`, with `Upgrade`/`Connection: upgrade` headers for the WebSocket handshake
and 86400s read/send timeouts for long-lived connections.

**Frontend side** (this repo, Vercel): `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app`
and `CHAT_JWT_SECRET` (must byte-match the VPS's own `.env` value) are Vercel production env vars.
`NEXT_PUBLIC_*` vars are inlined at **Next.js build time** — changing either in the Vercel dashboard
alone does nothing until a fresh production deployment actually builds and ships (a dashboard save
does not trigger one by itself; push to `main` or manually redeploy/promote in the dashboard).

---

## 2. Standard maintenance

All commands run **on the VPS**, from `/opt/saas-chat/`, unless noted.

### Restart the stack

```bash
docker compose up -d
```

Recreates only containers whose config actually changed; use `docker compose restart <service>` to
bounce one container without touching the others.

### Upgrade the LLM model

```bash
# edit .env: LLM_MODEL=<new-model-id>
docker compose up -d bot_worker
```

**Known gotcha (Session 14-1):** a plain `docker compose up -d bot_worker` after only editing `.env`
can report `Restarted -> Started` while the container keeps its OLD environment — Compose does not
always reload `.env` on a bare restart. If a smoke test after a model change still behaves like the
old model, force a real recreate:

```bash
docker compose up -d --force-recreate bot_worker
```

Confirm the new value actually loaded: `docker compose exec bot_worker printenv LLM_MODEL`.

### Rotate secrets (`CHAT_JWT_SECRET`, `LLM_API_KEY`)

1. Generate the new value (`openssl rand -hex 32` for `CHAT_JWT_SECRET`).
2. Update `/opt/saas-chat/.env` on the VPS.
3. `docker compose up -d --force-recreate chat_server` (and `bot_worker` if `LLM_API_KEY` changed).
4. **`CHAT_JWT_SECRET` must be updated in Vercel production at the same time** (it's shared with
   `GET /api/chat/token`) and a new production deployment shipped — a mismatched secret makes every
   authenticated handshake fail signature verification (falls back to guest mode, not an outage, but
   silently drops PRO-tier identity).
5. Never paste a secret's actual value into chat, a commit, or a log — presence-only checks
   (`grep -c '^CHAT_JWT_SECRET=.\+' .env` → should print `1`), per this project's value-blind rule.

---

## 3. Monitoring

### Log streaming

```bash
docker compose logs -f --tail=100                 # all three containers
docker compose logs -f --tail=100 bot_worker       # one container
```

Watch for: repeated `chat_error: SERVER_ERROR` (LLM call failing), `QUOTA_EXCEEDED` bursts (near
`AUTH_MONTHLY_QUOTA`), or a `client_message` accepted (`bot_typing: true`) with no matching reply —
that exact symptom was a real bug at Session 14-1 (`removeOnComplete: true` was purging a completed
BullMQ job's data before the server's `QueueEvents` listener could re-fetch `socketId` via
`Job.fromId`, silently dropping the reply; fixed by carrying `socketId` inside the job's own return
value, commit `3e6198fe`). If it recurs, check `apps/server`'s `QueueEvents` handler first.

### Redis queue health

```bash
docker compose exec redis_broker redis-cli INFO clients
docker compose exec redis_broker redis-cli LLEN bull:chat-jobs:wait     # jobs queued, not yet picked up
docker compose exec redis_broker redis-cli LLEN bull:chat-jobs:active   # jobs the worker is processing
```

A growing `wait` length with a static `active` count means the worker has stalled — check
`bot_worker`'s own logs and restart it.

### TLS certificate

Let's Encrypt auto-renews via Certbot's systemd timer. Validate it's actually working (dry run,
doesn't touch the real cert):

```bash
sudo certbot renew --dry-run
```

Confirm the timer itself is active: `systemctl status certbot.timer`. Cert expiry:
`echo | openssl s_client -connect chat-api.davintrade.app:443 -servername chat-api.davintrade.app 2>/dev/null | openssl x509 -noout -enddate`.

### External black-box checks (no SSH needed — run from anywhere)

```bash
curl -I https://chat-api.davintrade.app                                          # expect 200, valid cert
curl -s https://davintrade.app/api/chat/token                                     # expect {"token":null,"url":"https://chat-api.davintrade.app"} for a guest request
```

---

## 4. Disaster recovery

Full VPS rebuild from this repo, target **<10 minutes** of stack downtime (DNS/Nginx-level, not
counting a fresh VPS provision from Contabo if the box itself is lost):

1. Provision a VPS (or use a surviving box) with Docker, Docker Compose v2, Nginx, Certbot — see
   `infra/contabo-chat-stack/README.md` Step 1 for the exact package list.
2. Copy the stack:
   ```bash
   scp -r infra/contabo-chat-stack/* root@<vps-ip>:/opt/saas-chat/
   ```
3. On the VPS: `cd /opt/saas-chat && cp .env.example .env`, fill in `CHAT_JWT_SECRET` (must match
   Vercel production's value — do not regenerate unless you're doing a coordinated rotation, see §2),
   `CORS_ORIGIN`, `LLM_PROVIDER`/`LLM_MODEL`/`LLM_API_KEY`.
4. `docker compose up -d --build` — confirm all three containers show `Up` in `docker compose ps`
   with no crash-loop in `docker compose logs --tail=50`.
5. Nginx + TLS: copy `nginx/chat-api.conf` into `sites-available`, symlink into `sites-enabled`,
   `nginx -t`, then `certbot --nginx -d chat-api.davintrade.app --non-interactive --agree-tos -m support@davintrade.app --redirect`.
6. Firewall: `ufw allow OpenSSH`, `ufw allow 'Nginx Full'`, `ufw --force enable`.
7. If the VPS's IP changed, update the `chat-api.davintrade.app` DNS A-record and wait for
   propagation before the external checks in §3 will pass.
8. Verify with the external black-box checks in §3, then a real guest chat round-trip from a browser
   against `https://davintrade.app`.

**Rollback / full stack teardown** (e.g. reverting the whole chat feature, not just one bad deploy):
on the VPS, `docker compose down -v` (the `-v` also drops the Redis queue/volume — only if you don't
need to recover in-flight jobs), then in Vercel, unset `NEXT_PUBLIC_SOCKET_CHAT_URL` and ship a new
production deployment. The widget degrades to its in-widget canned-response generator
(`lib/socket-client.ts:148-199`) with zero console errors and zero user-facing downtime — proven live
at Session 14-3 (`NEXT_PUBLIC_SOCKET_CHAT_URL` unset, real browser, zero errors) and by
`__tests__/lib/socket-client.test.ts`'s offline-mode suite. The static `/settings/help` and
`(marketing)/help` pages (FAQ accordion + `mailto:` ticket form) are separate, always-available
surfaces — not something the widget redirects to, but always reachable regardless of the chat
stack's own health.

---

## 5. Known issues / not fixed here

- `/help` and `/about` currently 404 on production (`https://davintrade.app`) — found live during
  Session 14-3's cutover verification, confirmed unrelated to the chat stack (this session shipped
  zero application source changes) and pre-existing. Not investigated further here; out of scope for
  a chat-stack runbook. Flag for a future session.
- `money-service`'s `prisma.shutdown.spec.ts` has a known Jest parallel-worker timeout flake, clean
  in isolation (`--runInBand`) every time — `LESSONS-LEARNED.md` L24, unrelated to this stack.

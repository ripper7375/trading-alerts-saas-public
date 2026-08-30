# Contabo Chat Stack — Session 14-1 deployment runbook

As-code mirror of the 3-container chat/support-bot stack frozen at Session 14-0
and built at Session 14-1. This directory is the source of truth; `/opt/saas-chat/`
on the Contabo VPS is a deployment of it, not an independent copy to hand-edit.

**Why this is a runbook, not something the Executor ran directly:** the
Executor's own sandbox permission classifier categorically blocks outbound SSH
to external hosts in this session. Steps 1/3/4 below need root shell access on
the VPS and must be run by Davin directly. Steps 5/6 (external verification) do
not need SSH — the Executor runs those itself against the public endpoint.

---

## Step 1 — VPS prerequisites

SSH in and check what's already installed:

```bash
ssh root@139.180.209.200
docker --version
docker compose version
nginx -v
certbot --version
```

If anything is missing:

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx ufw
sudo systemctl enable --now docker nginx
```

**Verify:** `docker info` runs without error; `systemctl status nginx` shows `active (running)`.

---

## Step 3 — Deploy the stack and generate secrets

From **your local machine** (inside a clone of this repo), copy the stack to the VPS:

```bash
ssh root@139.180.209.200 "mkdir -p /opt/saas-chat"
scp -r infra/contabo-chat-stack/* root@139.180.209.200:/opt/saas-chat/
```

Back on the VPS:

```bash
ssh root@139.180.209.200
cd /opt/saas-chat
cp .env.example .env
openssl rand -hex 32   # copy this value — you'll paste it into .env next
```

Edit `/opt/saas-chat/.env` and fill in:

```bash
CHAT_JWT_SECRET=<the value openssl just printed>
CORS_ORIGIN=https://davintrade.app,https://trading-alerts-saas-public.vercel.app
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-flash
LLM_API_KEY=<your Gemini API key>
```

> Keep `CHAT_JWT_SECRET` somewhere safe (password manager) — Session 14-2's
> Next.js `GET /api/chat/token` needs the identical value to sign tokens this
> server can verify. Never paste the actual secret or API key value back into
> chat — per this project's value-blind secret rule, only confirm they're set
> (e.g. `grep -c '^CHAT_JWT_SECRET=.\+' .env` should print `1`).

Build and start:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=50
```

**Verify:** all three containers (`socket_chat_server`, `redis_broker`, `ai_bot_worker`) show `Up`; no crash-loop in the logs. **Paste the `docker compose ps` output and the last ~30 log lines back** so the Executor can confirm before moving on.

**Rollback:** `docker compose down` (add `-v` to also drop the Redis volume), then `rm -rf /opt/saas-chat`.

---

## Step 4 — Nginx, TLS, firewall

Still on the VPS:

```bash
sudo cp /opt/saas-chat/nginx/chat-api.conf /etc/nginx/sites-available/chat-api
sudo ln -sf /etc/nginx/sites-available/chat-api /etc/nginx/sites-enabled/
sudo nginx -t
```

`nginx -t` will complain about missing cert files the first time — that's expected before Certbot runs. Issue the certificate:

```bash
sudo certbot --nginx -d chat-api.davintrade.app --non-interactive --agree-tos -m support@davintrade.app --redirect
```

Certbot rewrites the vhost in place to add the SSL block and installs a renewal timer automatically. Then:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo systemctl reload nginx
curl -I https://chat-api.davintrade.app
```

**Verify:** the `curl -I` returns an HTTP response with a valid Let's Encrypt cert (no TLS error). **Paste that output back.**

**Rollback:** `sudo rm -f /etc/nginx/sites-enabled/chat-api /etc/nginx/sites-available/chat-api && sudo systemctl reload nginx`.

---

## Steps 5 & 6 — External verification (Executor runs these, no SSH needed)

Once you confirm Steps 3 and 4 are done, tell the Executor. It will run, from its own environment:

- **Denial tests:** confirm `139.180.209.200:6379` (Redis) and `139.180.209.200:3001` (chat server, unproxied) both refuse/timeout from the public internet — only 80/443 should be reachable.
- **WSS smoke test:** connect to `wss://chat-api.davintrade.app/socket.io/?EIO=4&transport=websocket` in Guest Mode, emit a `client_message`, and confirm a `support_message` reply comes back from the bot within a few seconds.

No further VPS access is needed for these — they exercise the same public endpoint any real browser would.

---

## Architecture recap

```
Browser (Vercel) --wss--> Nginx :443 (TLS) --> 127.0.0.1:3001 socket_chat_server
                                                        |
                                                   BullMQ queue (Redis, 127.0.0.1:6379)
                                                        |
                                                  ai_bot_worker --> Gemini/Claude API
```

`redis_broker` and `socket_chat_server`'s raw port are bound to `127.0.0.1` only —
never reachable except through the Nginx reverse proxy on 80/443.

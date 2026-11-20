# Post-Snapshot Chat VPS Rebuild Runbook (3-in-1 Security & Hardening Rollout)

- **Applies to:** `/opt/saas-chat/` on the Vultr Ubuntu Webchat VPS (legacy repo path: `infra/contabo-chat-stack/`)
- **Source of truth:** `infra/contabo-chat-stack/` on `origin/main` (aligned through PR `#513`, commit `b532c8ba`, 2026-11-20)
- **Companion runbooks:**
  - Snapshot provisioning, DNS, TLS, and teardown: [UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md](./UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md)
  - Day-2 operations & disaster recovery: [contabo-chat-stack.md](../docs/runbooks/contabo-chat-stack.md)

> [!CAUTION]
> **MANDATORY AGENT & OPERATOR NOTICE — RUN THIS 3-IN-1 REBUILD IMMEDIATELY AFTER RESTORING THE VULTR SNAPSHOT**
>
> The standing snapshot `webchat-setup-backup` was taken on **2026-09-10** and is paused (instance destroyed). Whenever you initiate restoring that snapshot on Vultr, **do NOT open the stack to live traffic, consider restoration complete, or take a replacement snapshot** until you have executed **all steps in this document** to apply these three updates together:
>
> 1. **PR `#513` (`b532c8ba`) refreshed lockfile** (`apps/server/package-lock.json`) — resolves the `engine.io` DoS advisory and transitive npm advisories (0 vulnerabilities in `npm audit --omit=dev`).
> 2. **Node.js `22.23.5+` security patch floor** (`04a68167` `node:22-alpine` Dockerfiles + `docker compose build --pull --no-cache`) — replaces the snapshot's Node 20 base images and pulls the patched upstream runtime.
> 3. **Latest chat hardening & auth alignment on `main`** — includes **WS-13** (`97eb1b6e`: strict `HS256`, `issuer: 'davintrade'`, `audience: 'chat-api'`, 300 s maxAge, no email claim in `apps/server/src/auth.ts`, matching the already-live Vercel BFF `/api/chat/token`) and **Batch C** (`2bb30d1f`: `X-Real-IP` / IPv6 `/64` rate limiting, payload validation, 1,000-character input and 1,024-token output caps, dot-separated BullMQ job IDs across `apps/server` and `apps/bot-worker`).
>
> Never rely on the older 7-file `scp` snippet in `UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md` alone: that partial copy omits `auth.ts`, both `Dockerfile`s, `apps/server/package-lock.json`, and `--pull --no-cache`.

---

## 1. Pre-Rebuild Safety Gates (Before Syncing or Pointing DNS)

Complete these checks in order right after the Vultr instance boots (Steps 2.1–2.2 of `UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md`):

### 1.1 Mandatory pgAdmin check (read-only, run first)

```bash
docker ps -a --format '{{.Names}} {{.Image}}' | grep -i pgadmin; docker images | grep -i pgadmin; echo "done: any line above mentioning pgadmin needs a look; none means not found"
```

```bash
(dpkg -l; systemctl list-units --all; pip3 list) 2>/dev/null | grep -i pgadmin; echo "done: any line above mentioning pgadmin needs a look; none means not found"
```

- If `permission denied` appears on the first command, re-run with `sudo` in front of `docker`.
- **No output before `done:`** in either command → clean; continue.
- **Any match mentioning `pgadmin`** → **STOP immediately**, delete nothing, report to Davin, and do not open the stack to users.

### 1.2 Inspect the restored containers & `.env`

```bash
cd /opt/saas-chat
docker compose ps
docker compose config --services
```

- **Expected services:** `chat_server`, `redis`, `bot_worker` (containers `socket_chat_server`, `redis_broker`, `ai_bot_worker`).
- **If `nllb_api` appears and `bot_worker` is missing:** STOP and confirm with Davin before modifying or removing `nllb_api` (per `UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md` Step 2.4 / 2.7b).
- Confirm `/opt/saas-chat/.env` exists and holds the required keys **without printing any secret values**:

```bash
grep -c '^CHAT_JWT_SECRET=.\+' /opt/saas-chat/.env
grep -c '^LLM_API_KEY=.\+' /opt/saas-chat/.env
grep -c '^CORS_ORIGIN=.\+' /opt/saas-chat/.env
```

Each command should print `1`. Also verify `/opt/saas-chat/.env` against `infra/contabo-chat-stack/.env.example` once synced (especially `LLM_PROVIDER`, `LLM_MODEL`, `GUEST_RATE_LIMIT_PER_HOUR`, `AUTH_MONTHLY_QUOTA`), and remember `CHAT_JWT_SECRET` must byte-match Vercel Production.

### 1.3 Verify Nginx forwards `X-Real-IP`

Batch C (`2bb30d1f`) reads `X-Real-IP` from host Nginx (never `X-Forwarded-For`). Confirm it is present:

```bash
grep -c 'X-Real-IP' /etc/nginx/sites-available/chat-api
```

Expected: `>= 1`. Keep `chat-api.davintrade.app` **DNS only** (grey cloud / no Cloudflare proxy) when updating DNS so `X-Real-IP` reflects each real client rather than a proxy IP.

---

## 2. Sync `/opt/saas-chat/` from `origin/main` (Without Overwriting `.env`)

Back up `.env` on the VPS first (never print or commit it):

```bash
cp /opt/saas-chat/.env /root/saas-chat.env.backup
```

### Method A (Recommended — run directly on the VPS via sparse `git clone`)

Downloads only `infra/contabo-chat-stack/` (~50 KB, clean Linux LF line endings, no Windows `node_modules`). Because the repo only contains `.env.example`, copying over `/opt/saas-chat/` preserves `/opt/saas-chat/.env`.

```bash
rm -rf /tmp/chat-sync
git clone --depth 1 --filter=blob:none --sparse https://github.com/ripper7375/trading-alerts-saas-public.git /tmp/chat-sync
git -C /tmp/chat-sync sparse-checkout set infra/contabo-chat-stack
ls -la /tmp/chat-sync/infra/contabo-chat-stack
cp -a /tmp/chat-sync/infra/contabo-chat-stack/. /opt/saas-chat/
rm -rf /tmp/chat-sync
```

### Method B (Fallback — from a local workstation if `git` on the VPS lacks `--filter=blob:none`)

> **WARNING:** Never run `scp -r infra/contabo-chat-stack/*` blindly if `apps/server/node_modules` or `apps/bot-worker/node_modules` exists on your workstation. Always package cleanly from `origin/main` with `git archive`:

1. From the repo root on your workstation:
   ```bash
   git fetch origin main
   git archive --format=tar.gz -o chat-stack-sync.tar.gz origin/main:infra/contabo-chat-stack
   scp chat-stack-sync.tar.gz root@<NEW_IP_ADDRESS>:/tmp/
   rm -f chat-stack-sync.tar.gz
   ```
2. On the VPS:
   ```bash
   tar -xzf /tmp/chat-stack-sync.tar.gz -C /opt/saas-chat
   rm -f /tmp/chat-stack-sync.tar.gz
   ```

---

## 3. Execute the 3-in-1 Rebuild & Recreate

Run on the VPS inside `/opt/saas-chat`:

```bash
cd /opt/saas-chat
docker compose build --pull --no-cache
docker compose up -d --force-recreate
```

Why both flags are mandatory:
- `build --pull --no-cache` fetches the latest upstream `node:22-alpine` base image (for the `22.23.5+` security floor) and rebuilds both TypeScript apps cleanly using PR `#513`'s refreshed `apps/server/package-lock.json` with zero stale Docker build layers.
- `up -d --force-recreate` replaces running containers cleanly and reloads `.env` (avoiding the Session 14-1 gotcha where plain `restart` kept stale state).

---

## 4. DNS, TLS, and OS Package Updates

Follow Steps 2.5–2.6 of `UBUNTU-WEBCHAT-STACK-RESTORATION-RUNBOOK.md`:

1. Point the `chat-api` **A record** (`chat-api.davintrade.app`, **DNS only**) to `<NEW_IP_ADDRESS>` and wait for propagation (`nslookup chat-api.davintrade.app`).
2. Restart Nginx, renew TLS, and patch Ubuntu packages:
   ```bash
   systemctl restart nginx
   certbot certificates
   certbot renew
   systemctl status certbot.timer
   apt update && apt upgrade -y
   ```
3. If `apt upgrade` updated the Linux kernel, reboot the VPS (`restart: always` brings all three containers back up).

---

## 5. Verification Checklist (Must All Pass Before Going Live or Re-Snapshotting)

### 5.1 On the VPS (paste output back to the Agent/record — contains no secrets)

```bash
cd /opt/saas-chat
docker compose ps
docker compose exec chat_server node -v
docker compose exec bot_worker node -v
docker compose exec chat_server grep '"version"' node_modules/engine.io/package.json
docker compose logs --tail=30 chat_server bot_worker
free -m
```

Verify:
- All three containers (`socket_chat_server`, `redis_broker`, `ai_bot_worker`) are `Up` with no restart loop.
- Both `chat_server` and `bot_worker` report `node -v` at or above the current Node 22 patch floor (`>= v22.23.5` as of 2026-11-20; verify against `.claude/architecture/infrastructure.md` at restore time).
- Installed `engine.io` version inside `chat_server` is `6.6.12` (or newer patched release).
- Logs show `socket_chat_server listening on :3001` and no Redis connection errors.
- `free -m` shows > 500 MB free memory.

### 5.2 External & End-to-End Checks

```bash
curl -I https://chat-api.davintrade.app
curl -s https://davintrade.app/api/chat/token
```

- `curl -I https://chat-api.davintrade.app` returns HTTP 200 with a valid Let's Encrypt certificate.
- `GET /api/chat/token` returns `{"token":null,"url":"https://chat-api.davintrade.app"}` when unauthenticated.
- Confirm `<NEW_IP_ADDRESS>:6379` and `<NEW_IP_ADDRESS>:3001` are unreachable from the public internet (only 22, 80, 443 open via `ufw`; Redis and chat server bound to `127.0.0.1`).
- Browser smoke test on `https://davintrade.app`:
  - **Guest user:** send a message and receive a bot reply (confirm 1,000-char limit behavior).
  - **Signed-in user:** confirm authenticated handshake succeeds (verifies WS-13 `HS256` / `davintrade` / `chat-api` alignment with Vercel and `CHAT_JWT_SECRET` match).

---

## 6. Next Snapshot & Teardown Hygiene

If pausing the VPS again after testing/use:
1. **Take a new dated snapshot** (e.g., `webchat-setup-backup-YYYY-MM-DD`) **after** Section 5 passes so the 3-in-1 rebuild is baked into the snapshot.
2. Wait until Vultr shows the new snapshot as **Complete** before destroying the instance (and keep the prior snapshot until verified).
3. **Remove the `chat-api` DNS A record** while the instance is destroyed so `chat-api.davintrade.app` never points to a released IP address (re-add it in Section 4 on next restore).
4. Record the pgAdmin check outcome, `node -v` reading, and snapshot status in `.claude/state/current-state.md` / `waiting-on.md`.

# Ubuntu Webchat Stack Restoration Runbook (Vultr Snapshot)

- **Snapshot name:** `webchat-setup-backup` (Ubuntu 24.04 LTS, 25 GB, taken 2026-09-10)
- **Provider and location:** Vultr, Singapore
- **Public host:** `chat-api.davintrade.app` (an A record, DNS only, not proxied)
- **Minimum hardware:** 2 vCPU / 4 GB RAM (see Step 2.1 for sizing)
- **Last reviewed:** 2026-11-18, against `infra/contabo-chat-stack/docker-compose.yml` and `docs/runbooks/contabo-chat-stack.md`

> **Names.** The repo folder `infra/contabo-chat-stack/` and the runbook `docs/runbooks/contabo-chat-stack.md` say "Contabo". That is a legacy name: this VPS is hosted at Vultr. Both runbooks describe the same `/opt/saas-chat/` deployment. The Word guide `how-to-restore-webchat-in-vultr.docx` in this folder records how the snapshot was taken and the instance destroyed.

> **State on 2026-11-20.** The VPS is paused: the instance was destroyed after the `2026-09-10` snapshot to stop hourly billing, so the chat host does not answer and the website's chat widget shows its offline replies. Restoring it is optional until the chat is needed.

> [!CAUTION]
> **MANDATORY AGENT NOTICE — 3-IN-1 REBUILD REQUIRED IMMEDIATELY ON SNAPSHOT RESTORE**
>
> Whenever any Agent or operator initiates restoring the `webchat-setup-backup` snapshot on Vultr, **you MUST immediately execute the 3-in-1 rebuild in [POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md](./POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md)** (after the pgAdmin check in Step 2.3 and before opening traffic or taking a replacement snapshot) so the VPS picks up all three pending updates together:
> 1. Refreshed `apps/server/package-lock.json` from PR `#513` (`b532c8ba`, fixes `engine.io` DoS & transitive npm advisories)
> 2. Node.js `22.23.5+` security patch floor (`node:22-alpine` Dockerfiles + `docker compose build --pull --no-cache`)
> 3. Latest chat hardening & auth alignment on `main` (WS-13 `auth.ts` `97eb1b6e` + Batch C `2bb30d1f`)
>
> **Do NOT use Step 2.7a's old 7-file copy alone** — it omits `auth.ts`, both `Dockerfile`s, `apps/server/package-lock.json`, and `--pull --no-cache`.

---

## 1. What the snapshot should contain

The repo stack under `/opt/saas-chat` (source of truth: `infra/contabo-chat-stack/`) has three containers behind host Nginx:

```text
Browser (website on Vercel) --wss--> host Nginx :443 (TLS) --> 127.0.0.1:3001  socket_chat_server
                                                                       |
                                                    BullMQ queue (redis_broker, 127.0.0.1:6379)
                                                                       |
                                                    ai_bot_worker --> LLM API (outbound only)
```

| Container            | Compose service | Role                                                    |
| -------------------- | --------------- | ------------------------------------------------------- |
| `socket_chat_server` | `chat_server`   | Socket.IO server: token check, rate limits, queue       |
| `redis_broker`       | `redis`         | Queue and pub/sub                                       |
| `ai_bot_worker`      | `bot_worker`    | Takes queued messages, calls the LLM, returns the reply |

All three use `restart: always`, so Docker starts them on boot. Host Nginx terminates TLS and proxies to port 3001.

**Unverified: a translation container.** The 2026-09-11 version of this runbook listed `nllb_api` (Meta NLLB-200 translation, image `ghcr.io/winstxnhdw/nllb-api:latest`, port 8000) and no `ai_bot_worker`. The repo compose does not run NLLB (deferred, F72). Nobody has looked inside the snapshot since, so Step 2.4 decides which case applies.

---

## 2. Restoration procedure

### Step 2.1: Deploy a server from the snapshot

1. Log in to the Vultr dashboard.
2. Click **Deploy +** → **Deploy New Server**.
3. Choose **Cloud Compute - Shared CPU** (or High Performance).
4. **Server location:** Singapore (the snapshot's region; keep it unless you have a reason).
5. **Server image:** open the **Snapshots** tab and select `webchat-setup-backup`.
6. **Server size:** 2 vCPU / 4 GB RAM (about $24 per month, $0.036 per hour) is safe for either case in Step 2.4. The 4 GB comes from the NLLB container (about 2.5 to 3 GB for the model). If Step 2.4 shows the repo stack without NLLB, check `free -m` before deciding whether a smaller plan is enough. The plan's disk must stay larger than the snapshot's 25 GB.
7. Click **Deploy Now** and wait about 60 seconds for Vultr to restore the disk and boot Ubuntu.

### Step 2.2: Connect via SSH

1. Note the **new IP address**. Vultr assigns a new public address to the restored instance.
2. Connect, using your root password or your SSH key:
   ```bash
   ssh root@<NEW_IP_ADDRESS>
   ```

### Step 2.3: Check for pgAdmin first

A VPS restored from a snapshot comes back exactly as it was when the snapshot was taken. Before anything else, and before updating DNS (Step 2.5), confirm that no pgAdmin (a database administration web UI) is on this machine; pgAdmin 9.19 (2026-10-29) fixed 15 CVEs. This check is an open item in `.claude/state/waiting-on.md`. The commands are the two from section 4 of `docs/runbooks/contabo-chat-stack.md`:

```bash
docker ps -a --format '{{.Names}} {{.Image}}' | grep -i pgadmin; docker images | grep -i pgadmin; echo "done: any line above mentioning pgadmin needs a look; none means not found"
```

```bash
(dpkg -l; systemctl list-units --all; pip3 list) 2>/dev/null | grep -i pgadmin; echo "done: any line above mentioning pgadmin needs a look; none means not found"
```

- No line before `done:` in either command: nothing found. Continue.
- If the first command prints `permission denied`, put `sudo` in front of `docker` and run it again. An error is not a clean result.
- Any line that mentions `pgadmin`: **stop and tell Davin.** Delete nothing and do not open the stack to users until he has decided.
- Note the outcome (found or not found, and the date) in the session entry.

### Step 2.4: Verify the Docker containers

```bash
cd /opt/saas-chat
docker compose ps
docker compose config --services
```

- **Expected (repo stack):** `socket_chat_server`, `redis_broker` and `ai_bot_worker`, all `Up`; the services are `chat_server`, `redis` and `bot_worker`. Use Step 2.7a.
- **If `nllb_api` is listed and `ai_bot_worker` is missing:** the snapshot's stack differs from the repo. Do not patch it file by file; use Step 2.7b, and ask Davin whether NLLB stays.
- If containers are stopped or restarting, run `docker compose up -d` and read `docker compose logs --tail=50`.

### Step 2.5: Update DNS for the new IP address

1. At the DNS provider, change the **A record** of `chat-api` (public host `chat-api.davintrade.app`) to the new IP address.
2. Keep the record **DNS only** (no Cloudflare proxy, no orange cloud). The chat server trusts the `X-Real-IP` header written by host Nginx; behind a proxy that header would carry the proxy's address and every guest would share one rate-limit bucket.
3. Do not put the IP address into `NEXT_PUBLIC_SOCKET_CHAT_URL`. The value is inlined when the website is built, browsers need the host name for HTTPS, and Vercel would need a new production build to pick up a change.
4. Wait for DNS to propagate (`nslookup chat-api.davintrade.app`), then restart the reverse proxy on the VPS:
   ```bash
   systemctl restart nginx
   ```
   The repo setup uses Nginx. If the snapshot uses Caddy instead, restart `caddy`; Caddy renews its certificates by itself, so Step 2.6 only needs the operating-system part.

### Step 2.6: Renew TLS and update the operating system

The snapshot is old, so its certificate may be near expiry or expired and the system packages are behind. Renewal works only after Step 2.5, because it needs the name to point at this machine and ports 80 and 443 to be reachable.

```bash
certbot certificates
certbot renew
systemctl status certbot.timer
apt update && apt upgrade -y
```

Reboot if the upgrade replaced the kernel (`restart: always` brings the containers back), then run `docker compose ps` again.

### Step 2.7: Run the 3-in-1 Chat VPS Rebuild (Mandatory)

The `2026-09-10` snapshot predates **WS-13** (`97eb1b6e`), **Node `22-alpine` (`04a68167`)**, **Batch C (`2bb30d1f`)**, and **PR `#513` (`b532c8ba`, refreshed `apps/server/package-lock.json`)**.

**2.7a. The repo stack is present (`ai_bot_worker` listed in Step 2.4):** **Do NOT copy only the 7 Batch C files** — execute Sections 2–5 of **[POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md](./POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md)** so you sync all of `infra/contabo-chat-stack/` from `origin/main` (without overwriting `/opt/saas-chat/.env` and without copying local `node_modules`) and run:

```bash
cd /opt/saas-chat
docker compose build --pull --no-cache
docker compose up -d --force-recreate
```

Verify `docker compose exec chat_server node -v` and `docker compose exec bot_worker node -v` both report `>= v22.23.5` (or the latest floor in `.claude/architecture/infrastructure.md`), and `engine.io` is `6.6.12` (or newer).

**2.7b. The snapshot's stack differs from the repo (`nllb_api` instead of `ai_bot_worker`):** follow "Full rebuild from this repo" in section 4 of `docs/runbooks/contabo-chat-stack.md` and Sections 2–3 of [POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md](./POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md) (use `git archive` or sparse `git clone` from `origin/main`, never blindly `scp` local `node_modules`). Make sure `/opt/saas-chat/.env` holds `CHAT_JWT_SECRET` (must byte-match Vercel Production), `CORS_ORIGIN`, `LLM_PROVIDER`, `LLM_MODEL` and `LLM_API_KEY`, then run `docker compose build --pull --no-cache && docker compose up -d --force-recreate`. Decide with Davin what happens to the NLLB container before removing anything.

The Dockerfiles still use `node:22-alpine` by choice. Moving them to Node 24 is a separate decision for a later rebuild (see `.claude/state/waiting-on.md`).

---

## 3. Health verification

Run these on the restored VPS:

```bash
docker compose ps
docker compose logs --tail=50 chat_server bot_worker
free -m
```

From any machine:

```bash
curl -I https://chat-api.davintrade.app
```

Verification criteria:

- All containers are `Up` with no restart loop, and the logs show no crash.
- The `chat_server` log shows `socket_chat_server listening on :3001` and no Redis connection error.
- Free memory stays above 500 MB.
- `curl -I` answers HTTP 200 with a valid certificate.
- If `nllb_api` is present: `curl -s http://127.0.0.1:8000/docs | head -n 5` answers.
- Browser test: opening the website's chat widget as a guest, sending a message and receiving a bot reply works (the widget limits input to 1,000 characters).

---

## 4. Teardown and re-snapshot (cost control)

To stop hourly charges after testing:

1. **Take a new snapshot first** if you changed anything on the VPS; Step 2.7 counts as a change. Without a new snapshot, the next restore comes back with the pre-Batch-C code. Give it a dated name, for example `webchat-setup-backup-YYYY-MM-DD`.
2. Wait until the new snapshot shows **Complete**. Keep the old snapshot until the new one has been checked.
3. Click **Destroy Instance** to terminate the VPS.
4. While the VPS is destroyed, the chat host does not answer and the widget falls back to its offline replies.

**Open decision for Davin (not adopted yet):** whether to delete the `chat-api` A record while the instance is destroyed, so that no record points at an address the account no longer holds. If you delete it, add it again in Step 2.5.

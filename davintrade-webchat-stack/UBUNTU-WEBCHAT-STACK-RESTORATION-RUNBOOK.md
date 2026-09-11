# Ubuntu Webchat Stack Restoration Runbook (Vultr Snapshot)

**Snapshot Name:** `webchat-setup-backup`  
**OS Version:** Ubuntu 24.04 LTS (or Ubuntu 22.04 LTS)  
**Primary Location:** Singapore (or preferred region)  
**Minimum Hardware:** 2 vCPU / 4 GB RAM (8 GB recommended for heavy translation inference)

---

## 1. Overview & Preserved Components

The `webchat-setup-backup` snapshot preserves the complete Dockerized multi-service chat backend under `/opt/saas-chat`:

```
┌────────────────────────────────────────────────────────┐
│               Target 2: Ubuntu VPS (Vultr)             │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │ Container 1: Socket.io Chat Server (Node.js)  │   │ ◄── Port 3001
│   ├────────────────────────────────────────────────┤   │
│   │ Container 2: Redis 7 Broker (Pub/Sub & BullMQ) │   │ ◄── Port 6379 (Internal)
│   ├────────────────────────────────────────────────┤   │
│   │ Container 3: Meta NLLB-200 Translation API     │   │ ◄── Port 8000 (Internal)
│   ├────────────────────────────────────────────────┤   │
│   │ Reverse Proxy: Nginx / Caddy (SSL Termination) │   │ ◄── Ports 80 / 443
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

- **Docker Containers (`restart: always`):**
  - `socket_chat_server`: Port 3001
  - `redis_broker`: Port 6379
  - `nllb_api`: Port 8000 (`facebook/nllb-200-distilled-600M`)
- **Web Server / SSL:** Nginx or Caddy reverse proxy pre-configured to forward HTTPS/WSS to port 3001.

---

## 2. Step-by-Step Restoration Procedure

### Step 2.1: Deploy Server in Vultr

1. Log in to [Vultr Dashboard](https://my.vultr.com/).
2. Click **Deploy +** → **Deploy New Server**.
3. Choose **Cloud Compute - Shared CPU** (or High Performance).
4. **Server Location:** Choose **Singapore** (or preferred region).
5. **Server Image:**
   - Click the **Snapshots** tab.
   - Select **`webchat-setup-backup`**.
6. **Server Size:**
   - Select a plan with **at least 4 GB RAM** (e.g. 2 vCPU / 4 GB RAM at ~$24/mo, ~$0.036/hr).
   - _Note: Meta NLLB-200 translation microservice requires ~2.5–3 GB RAM to load model weights._
7. Click **Deploy Now**.
8. Wait ~60 seconds for Vultr to restore the disk and boot Ubuntu.

---

### Step 2.2: Connect via SSH

1. Note the **New IP Address** assigned by Vultr.
2. Open PowerShell or a terminal and connect:
   ```bash
   ssh root@<NEW_IP_ADDRESS>
   ```
3. Enter your root password (or authenticate using your existing SSH key).

---

### Step 2.3: Verify Docker Containers

Because all containers use `restart: always`, Docker starts them automatically on system boot.

1. Navigate to the project directory:
   ```bash
   cd /opt/saas-chat
   ```
2. Check container status:
   ```bash
   docker compose ps
   ```
3. **Expected Output:**
   ```text
   NAME                 IMAGE                                COMMAND                  SERVICE       CREATED         STATUS
   nllb_api             ghcr.io/winstxnhdw/nllb-api:latest   "uvicorn main:app ..."   nllb_api      ...             Up
   redis_broker         redis:7-alpine                       "docker-entrypoint..."   redis         ...             Up
   socket_chat_server   ...                                  "docker-entrypoint..."   chat_server   ...             Up
   ```
4. _If containers are stopped or restarting:_
   ```bash
   docker compose up -d
   ```

---

### Step 2.4: Update DNS for the New IP Address

Because Vultr assigns a **new public IP address** to the restored instance:

1. **If using a custom domain (e.g. `chat-api.davintrade.com`):**
   - Log in to your DNS provider (Cloudflare, Namecheap, etc.).
   - Update the **A Record** for `chat-api` to point to the **New Vultr IP Address**.
2. **If using direct IP in frontend:**
   - Update `NEXT_PUBLIC_SOCKET_CHAT_URL` in Vercel project environment variables with the new IP (e.g. `https://<NEW_IP>` or `http://<NEW_IP>:3001`).
3. **Restart Reverse Proxy (if applicable):**
   ```bash
   systemctl restart nginx  # or: systemctl restart caddy
   ```

---

## 3. Quick Health Verification (Ubuntu Bash)

Run these checks on the restored Ubuntu VPS:

```bash
# 1. Test translation API health
curl -s http://127.0.0.1:8000/docs | head -n 5

# 2. Check Socket.io Chat Server logs
docker compose logs --tail=25 chat_server

# 3. Check memory consumption
free -m
```

### Verification Criteria:

- `nllb_api` answers HTTP 200 on port 8000.
- `socket_chat_server` logs report `Server running on port 3001` and Redis connection confirmed.
- Free memory remains above 500 MB.
- Browser test: Opening the DavinTrade webchat widget successfully emits `client_message` and receives `support_message` bot responses.

---

## 4. Teardown Reminder (Cost Control)

When testing is complete and you wish to stop hourly charges:

1. In Vultr Dashboard, take an updated snapshot if you modified code or Docker containers.
2. Once the snapshot status displays **Complete**, click **Destroy Instance** to terminate the VPS.

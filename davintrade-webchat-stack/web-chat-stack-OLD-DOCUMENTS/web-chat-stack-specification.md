# Build Architecture

Decoupled Monorepo (Next.js on Vercel + Standalone Socket.io Backend) + Translation Engine Microservice (FastAPI + Meta NLLB)

# Repository

github.com/IMRANDIL/Next_JS_Turbo_Repo_Scaleable_chat_APP + github.com/winstxnhdw/nllb-api

# Deployment Architecture

┌─────────────────────────┐
│ Vercel (Cloud) │ ───> Next.js 16 Frontend
└────────────┬────────────┘
│ WebSocket / HTTP
▼
┌─────────────────────────┐
│ Contabo (Ubuntu 24) │ ───> Docker Container 1: Socket.io Chat Server
│ │ ───> Docker Container 2: Redis (Local Broker)
│ │ ───> Docker Container 3: FastAPI (Meta NLLB-200)
└─────────────────────────┘

==============================================================================================

Here is the exact `docker-compose.yml` file you can use on your **Contabo (Ubuntu 24.04)** VPS to orchestrate all three backend containers in a single Docker bridge network.

---

## Contabo Production `docker-compose.yml`

Create a directory on your VPS (e.g., `/opt/saas-chat`) and add this `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Container 2: Redis (Local Broker for Socket.io scaling & caching)
  redis:
    image: redis:7-alpine
    container_name: redis_broker
    restart: always
    command: redis-server --save 60 1 --loglevel warning
    ports:
      - '127.0.0.1:6379:6379' # Bound to localhost for security
    volumes:
      - redis_data:/data
    networks:
      - saas_chat_net

  # Container 3: Meta NLLB-200 Translation Microservice
  nllb_api:
    image: ghcr.io/winstxnhdw/nllb-api:latest
    container_name: nllb_api
    restart: always
    environment:
      - MODEL_NAME=facebook/nllb-200-distilled-600M # or 1.3B if you have 8GB+ RAM
      - USE_CTRANSLATE2=true
    ports:
      - '127.0.0.1:8000:8000' # Bound to localhost for security
    networks:
      - saas_chat_net

  # Container 1: Node.js Socket.io Server (from IMRANDIL repo)
  chat_server:
    build:
      context: ./apps/server # Path to cloned repo's server folder
      dockerfile: Dockerfile
    container_name: socket_chat_server
    restart: always
    ports:
      - '3001:3001' # Exposed to host so Nginx/Caddy can reverse proxy
    environment:
      - PORT=3001
      - REDIS_URL=redis://redis:6379
      - NLLB_API_URL=http://nllb_api:8000
      - NODE_ENV=production
    depends_on:
      - redis
      - nllb_api
    networks:
      - saas_chat_net

networks:
  saas_chat_net:
    driver: bridge

volumes:
  redis_data:
```

---

## 2 Critical Production Setup Notes

### 1. SSL/TLS Requirement for Vercel (`wss://`)

Because Vercel hosts your Next.js 16 frontend over **HTTPS**, web browsers will block insecure WebSocket (`ws://`) connections to your VPS.

To resolve this on your Contabo server:

- Put **Nginx** or **Caddy** on the host to terminate SSL for your domain (e.g., `[https://chat-api.yourdomain.com](https://chat-api.yourdomain.com)`).
- Point `chat-api.yourdomain.com` to `http://localhost:3001` with `Upgrade` and `Connection` headers enabled for WebSockets.
- Alternatively, use a **Cloudflare Tunnel** (free, zero open inbound ports required).

### 2. Contabo Deployment Quick Commands

```bash
# 1. Update Ubuntu & Install Docker
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose-v2 -y

# 2. Clone Repos & Start Stack
git clone https://github.com/IMRANDIL/Next_JS_Turbo_Repo_Scaleable_chat_APP.git
cd Next_JS_Turbo_Repo_Scaleable_chat_APP

# Place your docker-compose.yml here, then run:
docker compose up -d --build

```

================================================

Only Need 2 Hosting Targets

You do **not** need to add a 3rd host or separate cloud service for the AI bot. Because Contabo VPS tiers offer generous CPU and RAM allocations (standard tiers come with 4–8 vCPUs and 8–24 GB RAM), your Contabo Ubuntu server can easily handle the AI bot worker alongside your chat server and translation microservice.

---

## Updated System Architecture (2 Hosting Targets)

Instead of adding another host, you simply add a **4th container** (`ai_bot_worker`) into your existing `docker-compose.yml` on Contabo.

```
┌─────────────────────────────────────────┐
│              1. Vercel                  │ ───> Next.js 16 Frontend (UI)
└────────────────────┬────────────────────┘
                     │ WebSocket / HTTP
                     ▼
┌─────────────────────────────────────────┐
│         2. Contabo VPS (Ubuntu)         │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │ Container 1: Socket.io Server   │   │
│   ├─────────────────────────────────┤   │
│   │ Container 2: Redis Broker       │   │
│   ├─────────────────────────────────┤   │
│   │ Container 3: Meta NLLB-200 API  │   │
│   ├─────────────────────────────────┤   │
│   │ Container 4: AI Queue Worker    │ <─── NEW: BullMQ AI Bot Worker
│   └─────────────────────────────────┘   │
└─────────────────────────────────────────┘

```

---

## Why Keeping 2 Hosting Targets is Ideal

- **Zero Added Infrastructure Cost:** The AI worker container is lightweight (~50–100MB RAM) and reuses the exact same Redis container already running on your VPS as its job queue broker.
- **0ms Network Overhead:** When the AI worker finishes processing a prompt, translating it via Meta NLLB-200, and publishing it back to Socket.io, all network traffic moves instantly across Docker's internal bridge network (`saas_chat_net`).
- **Dead-Simple Maintenance:** You only ever manage two dashboards: **Vercel** for continuous frontend deployments, and **Contabo** for backend Docker containers.

---

## Updated Production `docker-compose.yml`

Here is how your complete Docker Compose setup on Ubuntu looks with Container 4 added:

```yaml
version: '3.8'

services:
  # Container 1: Socket.io Chat Server
  chat_server:
    build:
      context: ./apps/server
      dockerfile: Dockerfile
    container_name: socket_chat_server
    restart: always
    ports:
      - '3001:3001'
    environment:
      - PORT=3001
      - REDIS_URL=redis://redis:6379
      - NLLB_API_URL=http://nllb_api:8000
    depends_on:
      - redis
      - nllb_api
    networks:
      - saas_chat_net

  # Container 2: Redis (Broker for Socket.io & BullMQ Queue)
  redis:
    image: redis:7-alpine
    container_name: redis_broker
    restart: always
    ports:
      - '127.0.0.1:6379:6379'
    volumes:
      - redis_data:/data
    networks:
      - saas_chat_net

  # Container 3: Meta NLLB-200 Translation Microservice
  nllb_api:
    image: ghcr.io/winstxnhdw/nllb-api:latest
    container_name: nllb_api
    restart: always
    environment:
      - MODEL_NAME=facebook/nllb-200-distilled-600M
      - USE_CTRANSLATE2=true
    ports:
      - '127.0.0.1:8000:8000'
    networks:
      - saas_chat_net

  # Container 4: AI Bot Queue Worker (NEW)
  bot_worker:
    build:
      context: ./apps/bot-worker
      dockerfile: Dockerfile
    container_name: ai_bot_worker
    restart: always
    environment:
      - REDIS_URL=redis://redis:6379
      - NLLB_API_URL=http://nllb_api:8000
      - LLM_API_KEY=${LLM_API_KEY}
    depends_on:
      - redis
      - nllb_api
    networks:
      - saas_chat_net

networks:
  saas_chat_net:
    driver: bridge

volumes:
  redis_data:
```

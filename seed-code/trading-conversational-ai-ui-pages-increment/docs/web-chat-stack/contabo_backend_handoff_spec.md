# Technical Handoff Specification: Target 2 — Contabo VPS (Ubuntu 24.04) Backend Stack

**Target Audience:** Antigravity Agent / DevOps Engineer  
**Purpose:** Instructions for setting up, configuring, and deploying the 4-Container Backend Docker Stack on Contabo VPS to seamlessly connect with the DavinTrade Next.js 16 Vercel Frontend.

---

## 📐 1. System Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                   Target 1: Vercel Cloud               │
│               Next.js 16 App Router Frontend           │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ WebSocket / HTTPS (wss://chat-api.yourdomain.com)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Target 2: Contabo VPS (Ubuntu 24.04)     │
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │ Container 1: Socket.io Chat Server (Node.js)  │   │ ◄── Port 3001
│   ├────────────────────────────────────────────────┤   │
│   │ Container 2: Redis 7 Broker (Pub/Sub & BullMQ) │   │ ◄── Port 6379 (Internal)
│   ├────────────────────────────────────────────────┤   │
│   │ Container 3: Meta NLLB-200 Translation API     │   │ ◄── Port 8000 (Internal)
│   ├────────────────────────────────────────────────┤   │
│   │ Container 4: BullMQ AI Bot Worker              │   │ ◄── Background Worker
│   └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

---

## 🔌 2. Frontend Contract & Socket.io Data Schemas

The Next.js 16 Vercel frontend connects to the backend using `socket.io-client` v4.

### 2.1 Connection Endpoint

- **Frontend Environment Variable:** `NEXT_PUBLIC_SOCKET_CHAT_URL`
- **Example Value:** `https://chat-api.yourdomain.com` (Transports: `['websocket', 'polling']`)

### 2.2 Client Emitted Event: `client_message`

When a user types an inquiry or clicks a topic chip on the Vercel frontend, the client emits:

```typescript
// Event Name: "client_message"
{
  "id": "usr-174123456789-a1b2",
  "sender": "user",
  "text": "How do server-side price alerts work?",
  "timestamp": "01:45 PM",
  "topic": "Technical Support" // Optional: "Product Info" | "Technical Support" | "PRO Subscription" | "Billing"
}
```

### 2.3 Backend Emitted Event: `support_message`

The Socket.io Chat Server (Container 1) must emit back to the user's socket session:

```typescript
// Event Name: "support_message"
{
  "id": "bot-174123456789",
  "sender": "bot", // or "agent"
  "text": "PRO subscribers get 100 active alert rules evaluated every 500ms...",
  "timestamp": "01:45 PM",
  "topic": "Technical Support"
}
```

---

## 🛠️ 3. Production `docker-compose.yml` for Contabo VPS

Create directory `/opt/saas-chat` on the Contabo VPS and save this `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # Container 1: Node.js Socket.io Chat Server
  chat_server:
    build:
      context: ./apps/server
      dockerfile: Dockerfile
    container_name: socket_chat_server
    restart: always
    ports:
      - '3001:3001' # Reverse proxied by Nginx/Caddy on host
    environment:
      - PORT=3001
      - REDIS_URL=redis://redis:6379
      - NLLB_API_URL=http://nllb_api:8000
      - NODE_ENV=production
      - CORS_ORIGIN=https://trading-conversational-ai-ui-pages.vercel.app
    depends_on:
      - redis
      - nllb_api
    networks:
      - saas_chat_net

  # Container 2: Redis Broker (Pub/Sub & BullMQ Queue)
  redis:
    image: redis:7-alpine
    container_name: redis_broker
    restart: always
    command: redis-server --save 60 1 --loglevel warning
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

  # Container 4: BullMQ AI Bot Worker
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

---

## 🔒 4. SSL/TLS Termination & Reverse Proxy Config (Nginx)

Because Vercel serves the Next.js app over **HTTPS (`https://`)**, browsers enforce WSS (`wss://`) for WebSockets. Plain `ws://` connections will be blocked by Mixed Content Security policies.

### Nginx Virtual Host (`/etc/nginx/sites-available/chat-api`)

```nginx
server {
    server_name chat-api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    listen 443 ssl http2;
    ssl_certificate /etc/letsencrypt/live/chat-api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat-api.yourdomain.com/privkey.pem;
}
```

---

## 🚀 5. Step-by-Step Setup Guide for Contabo Agent

### Step 1: System Update & Docker Installation

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install docker.io docker-compose-v2 nginx certbot python3-certbot-nginx -y
```

### Step 2: Clone Backend Repository & Env Setup

```bash
mkdir -p /opt/saas-chat && cd /opt/saas-chat
# Clone backend services repo
git clone https://github.com/IMRANDIL/Next_JS_Turbo_Repo_Scaleable_chat_APP.git .

# Create .env configuration
cat <<EOT > .env
LLM_API_KEY=your_openai_or_anthropic_api_key
CORS_ORIGIN=https://trading-conversational-ai-ui-pages.vercel.app
EOT
```

### Step 3: Launch Docker Containers

```bash
docker compose up -d --build
```

### Step 4: Verify Container Health

```bash
docker ps
# Ensure containers socket_chat_server, redis_broker, nllb_api, and ai_bot_worker are running.
docker compose logs -f chat_server
```

---

## 🧪 6. Connectivity Verification Test

Run from your local workstation or terminal to test WebSocket connection:

```bash
# Test WebSocket Handshake
npx wscat -c wss://chat-api.yourdomain.com/socket.io/?EIO=4&transport=websocket
```

Once established, set the environment variable in your Vercel project:

- `NEXT_PUBLIC_SOCKET_CHAT_URL` = `https://chat-api.yourdomain.com`

The DavinTrade Vercel frontend will immediately begin streaming real-time support chat messages with zero code changes required!

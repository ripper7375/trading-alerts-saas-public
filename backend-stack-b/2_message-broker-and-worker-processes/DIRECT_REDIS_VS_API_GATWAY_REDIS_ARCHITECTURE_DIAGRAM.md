# DIRECT REDIS APPROACH

MT5 EA (Contabo)
↓ (1) HTTP POST **DIRECTLY** to Upstash Redis REST API
↓ Endpoint: https://your-redis.upstash.io/lpush/market-data-sync
Upstash Redis (Message Broker)
↓ (3) Bull Queue Consumer (TCP (ioredis) library)
Railway Workers (NestJS)
↓ (5) SQL INSERT
Railway PostgreSQL

# API GATEWAY REDIS APPROACH

MT5 EA (Contabo)
↓ (1) HTTP POST to **NestJS API endpoint**
↓ Endpoint: https://your-api.railway.app/api/market-data
Railway NestJS Backend
↓ (2) Add to Bull Queue via ioredis (TCP (ioredis))
Railway Redis (Message Broker)
↓ (3) Bull Queue Consumer (TCP (ioredis) library)
Railway Workers (NestJS)
↓ (5) SQL INSERT
Railway PostgreSQL

================================
Redis → Client Library → Your Code

# Trading Alerts SaaS — Database & Real-Time Scaling Architecture

**Project:** trading-alerts-saas-v7  
**Version:** 1.0  
**Date:** 2026-02-26  
**Status:** Production Roadmap (Stage-Gated)  
**Author:** Dhapanart + Claude (Anthropic)  
**Target Scale:** 0 → 10,000 users (phased)

---

## Table of Contents

1. [Overview & Philosophy](#overview--philosophy)
2. [Current Baseline Architecture](#current-baseline-architecture)
3. [Real-Time Pipeline: WebSocket + Alert Notification](#real-time-pipeline-websocket--alert-notification)
4. [Redis + BullMQ: Alert Queue System](#redis--bullmq-alert-queue-system)
5. [Worker Architecture](#worker-architecture)
6. [pgBouncer: Connection Pooling](#pgbouncer-connection-pooling)
7. [PostgreSQL Read Replicas](#postgresql-read-replicas)
8. [Stage-Gated Scaling Roadmap](#stage-gated-scaling-roadmap)
9. [Database Schema Considerations](#database-schema-considerations)
10. [Monitoring & Scaling Triggers](#monitoring--scaling-triggers)
11. [Cost Analysis Per Stage](#cost-analysis-per-stage)

---

## Overview & Philosophy

This document describes the **incremental scaling architecture** for the Trading Alerts SaaS platform — specifically covering the database layer, alert processing pipeline, and real-time WebSocket delivery to users.

The guiding principle is **scale when the pain arrives, not in anticipation of pain that may never come.** Every infrastructure addition described here has a defined trigger point tied to real user load, not speculative future growth.

### What This Document Covers

- How alerts are detected, queued, processed, and delivered in real-time via WebSocket
- When and how to introduce Redis + BullMQ for async alert processing
- When and how to deploy pgBouncer for connection pooling
- When and how to add PostgreSQL read replicas
- How all these components connect into a cohesive, observable pipeline

### What This Document Does NOT Cover

- LLM/RAG/chatbot features (not part of this SaaS)
- Multi-region deployment (relevant only at 50K+ users)
- Database sharding (relevant only at 100K+ users)

---

## Current Baseline Architecture

### Stack (Right Now — Phase 3)

```
┌─────────────────────────────────────────────────────────┐
│                  CLIENT (Browser / Mobile)               │
│           Next.js 15 — Vercel Edge Network               │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / WebSocket (WSS)
┌──────────────────────────▼──────────────────────────────┐
│              BACKEND (Railway)                           │
│              Flask (Python)                              │
│  • REST API endpoints                                    │
│  • MT5 price data ingestion                              │
│  • Alert condition evaluation                            │
│  • WebSocket server (Flask-SocketIO)                     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│            DATABASE (Railway PostgreSQL)                 │
│  • Users, subscriptions, tiers                           │
│  • Alert configurations (symbol, condition, threshold)   │
│  • Alert trigger history                                 │
│  • Price snapshots                                       │
└─────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              MT5 (MetaTrader 5)                          │
│  • Real-time price feed (XAUUSD, FX pairs, etc.)         │
│  • Up to 15 symbols per PRO user                         │
└─────────────────────────────────────────────────────────┘
```

### Current Bottlenecks to Watch

| Component                     | Risk                                   | Trigger to Act             |
| ----------------------------- | -------------------------------------- | -------------------------- |
| Flask single process          | CPU blocks on MT5 polling + alert eval | >50 concurrent users       |
| PostgreSQL direct connections | Connection exhaustion                  | >50 concurrent connections |
| Synchronous alert evaluation  | Latency spikes under load              | >100 active alert configs  |
| No async queue                | Alert processing blocks API responses  | >200 users                 |

---

## Real-Time Pipeline: WebSocket + Alert Notification

This is the core user experience: **a user sets an alert → the price moves → the user sees a live notification in under 2 seconds.**

### How the Pipeline Works (All Stages)

```
┌──────────────────────────────────────────────────────────────────┐
│                     MT5 PRICE FEED                               │
│  Tick data polled every 500ms per symbol                         │
│  (XAUUSD, EURUSD, GBPUSD ... up to 15 symbols per PRO user)     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ price tick event
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                  ALERT EVALUATION ENGINE                         │
│                                                                  │
│  Stage 1 (0-500 users):   In-process Flask evaluation           │
│  Stage 2 (500-2K users):  BullMQ Worker (async, separate)       │
│  Stage 3 (2K-10K users):  Multiple BullMQ Workers + Redis cache │
│                                                                  │
│  Logic:                                                          │
│  for each active alert:                                          │
│    if current_price crosses alert.threshold:                     │
│        → fire alert                                              │
└────────────────────────────┬─────────────────────────────────────┘
                             │ alert fired
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌─────────────┐  ┌──────────────┐  ┌────────────────┐
     │  WebSocket  │  │  Telegram    │  │  PostgreSQL    │
     │  Push to    │  │  Bot Message │  │  Write to      │
     │  Browser    │  │  (instant)   │  │  alert_history │
     └─────────────┘  └──────────────┘  └────────────────┘
           │
           ▼
     ┌─────────────────────────────────┐
     │  User sees live notification    │
     │  in dashboard within <2s        │
     └─────────────────────────────────┘
```

### WebSocket Connection Model

Each authenticated user maintains a persistent WebSocket connection to the Flask-SocketIO server. When an alert fires, the server emits to the specific user's socket room.

```python
# Flask-SocketIO: Emitting to a specific user
def fire_alert(user_id: str, alert: dict):
    # 1. Write to DB (async)
    save_alert_to_history(alert)

    # 2. Push via WebSocket (instant)
    socketio.emit(
        'alert_triggered',
        {
            'symbol': alert['symbol'],
            'price': alert['price'],
            'condition': alert['condition'],
            'timestamp': alert['fired_at']
        },
        room=f"user_{user_id}"
    )

    # 3. Telegram notification (async)
    send_telegram_message.delay(user_id, alert)  # BullMQ job (Stage 2+)
```

### Data Feed Display (Live Price Streaming)

Beyond alerts, users see live prices in their dashboard. This uses a **broadcast model** — one price update per symbol goes to all subscribed users.

```python
# Price broadcast to all users watching a symbol
def broadcast_price(symbol: str, price: float, timestamp: str):
    socketio.emit(
        'price_update',
        {'symbol': symbol, 'price': price, 'timestamp': timestamp},
        room=f"symbol_{symbol}"  # All users watching this symbol
    )

# User joins symbol room on dashboard load
@socketio.on('subscribe_symbol')
def on_subscribe(data):
    join_room(f"symbol_{data['symbol']}")
```

---

## Redis + BullMQ: Alert Queue System

### Why Add a Queue? (Trigger: 200+ users or 100+ active alerts)

Without a queue, the Flask process handles everything synchronously:

- Receive MT5 price tick
- Loop through all active alerts
- Evaluate conditions
- Send Telegram
- Write to PostgreSQL
- Emit WebSocket

This blocks the event loop, causes latency spikes, and fails silently if Telegram is slow. A queue **decouples** the fast path (price evaluation + WebSocket) from the slow path (Telegram, DB writes, email).

### Queue Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     REDIS (Railway)                            │
│                                                                │
│  Queue: alert-notifications     Queue: price-snapshots         │
│  ┌─────────────────────────┐   ┌─────────────────────────┐   │
│  │ Job: send_telegram      │   │ Job: save_price_tick     │   │
│  │ Job: send_email         │   │ Job: update_24h_stats    │   │
│  │ Job: log_alert_history  │   └─────────────────────────┘   │
│  └─────────────────────────┘                                   │
│                                                                │
│  Queue: alert-evaluation  (Stage 2+, when eval moves async)   │
│  ┌─────────────────────────┐                                   │
│  │ Job: eval_price_tick    │                                   │
│  │ { symbol, price, ts }   │                                   │
│  └─────────────────────────┘                                   │
└────────────────────────────────────────────────────────────────┘
         ▲                              ▼
   [Flask Producer]              [BullMQ Worker]
   Pushes jobs when              Processes jobs
   price tick arrives            asynchronously
```

### BullMQ Setup (Node.js Worker)

The worker is a **separate lightweight Node.js process** deployed alongside Flask on Railway.

```javascript
// worker/src/queues/alertQueue.js
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const connection = new Redis(process.env.REDIS_URL);

// Queue instance (used by Flask via Redis directly, or a thin Node producer)
export const alertQueue = new Queue('alert-notifications', { connection });

// Worker: processes alert notification jobs
export const alertWorker = new Worker(
  'alert-notifications',
  async (job) => {
    const { type, userId, alertData } = job.data;

    switch (type) {
      case 'telegram':
        await sendTelegramAlert(userId, alertData);
        break;
      case 'email':
        await sendEmailAlert(userId, alertData);
        break;
      case 'log_history':
        await saveAlertHistory(alertData);
        break;
    }
  },
  {
    connection,
    concurrency: 10, // Process 10 jobs simultaneously
    limiter: {
      max: 100, // Max 100 jobs per 10 seconds (rate limiting)
      duration: 10000,
    },
  }
);

// Error handling
alertWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
  // Alert via Telegram to admin if critical
});
```

### Flask: Pushing Jobs to Redis Queue

Flask pushes jobs directly to Redis using the BullMQ-compatible format, or via a simple Redis pub/sub.

```python
# flask/services/alert_queue.py
import redis
import json
import uuid
import time

r = redis.from_url(os.getenv('REDIS_URL'))

def enqueue_alert_notification(user_id: str, alert_data: dict):
    """Push alert job to BullMQ-compatible Redis queue."""
    job = {
        'id': str(uuid.uuid4()),
        'name': 'send_notification',
        'data': {
            'type': 'telegram',
            'userId': user_id,
            'alertData': alert_data
        },
        'timestamp': int(time.time() * 1000),
        'attempts': 0,
        'opts': {'attempts': 3, 'backoff': {'type': 'exponential', 'delay': 2000}}
    }
    # Push to BullMQ list (BullMQ reads from this key)
    r.lpush('bull:alert-notifications:wait', json.dumps(job))
```

### Job Priority Model

| Queue               | Jobs                             | Priority | Concurrency |
| ------------------- | -------------------------------- | -------- | ----------- |
| alert-notifications | Telegram, email, history log     | HIGH     | 10          |
| price-snapshots     | DB writes for price history      | MEDIUM   | 5           |
| alert-evaluation    | Price tick evaluation (Stage 3+) | CRITICAL | 20          |

---

## Worker Architecture

### Stage 1: Single Worker (0–500 users)

One Node.js worker process handles all async jobs. Deployed as a single Railway service alongside Flask.

```
Railway Services:
├── flask-backend        (main API + WebSocket + alert evaluation)
├── bullmq-worker        (1 instance — handles all notification jobs)
├── postgresql           (Railway managed)
└── redis                (Railway managed)
```

**Resource allocation for single worker:**

- RAM: 256MB is sufficient
- CPU: 0.5 vCPU
- Monthly cost: ~$5 on Railway

### Stage 2: Scaled Workers (500–2,000 users)

When notification queue depth exceeds 50 jobs consistently, scale the worker horizontally.

```
Railway Services:
├── flask-backend        (2 instances — Railway load balanced)
├── bullmq-worker        (2-3 instances — each pulls from same Redis queue)
├── postgresql           (Railway managed)
└── redis                (Railway managed)
```

BullMQ handles multi-worker coordination natively — no configuration change needed. Each worker instance competes for jobs from the same queue, providing natural load distribution.

### Stage 3: Dedicated Workers Per Queue (2,000–10,000 users)

Separate worker processes per queue type for isolation and independent scaling.

```
Railway Services:
├── flask-backend           (3-5 instances)
├── worker-notifications    (3 instances — Telegram/email delivery)
├── worker-price-eval       (2 instances — alert condition evaluation)
├── worker-analytics        (1 instance — DB writes, stats updates)
├── postgresql-primary      (Railway managed)
├── postgresql-replica-1    (Railway managed read replica)
└── redis                   (Railway managed)
```

### Worker Health & Reliability

```javascript
// Graceful shutdown — finish current job before stopping
process.on('SIGTERM', async () => {
  await alertWorker.close();
  await connection.quit();
  process.exit(0);
});

// Stalled job detection (job started but worker died)
const alertWorker = new Worker('alert-notifications', processor, {
  connection,
  stalledInterval: 30000, // Check for stalled jobs every 30s
  maxStalledCount: 2, // Retry stalled jobs up to 2 times
});
```

---

## pgBouncer: Connection Pooling

### The Problem pgBouncer Solves

PostgreSQL creates a dedicated OS process per connection. Each connection consumes ~5-10MB RAM. Without pooling:

- 50 Flask workers × 5 DB connections each = 250 connections
- 250 connections × 8MB = 2GB RAM consumed by idle connections
- PostgreSQL starts rejecting connections above its `max_connections` limit (default: 100)

pgBouncer sits between your application and PostgreSQL, **multiplexing many application connections into a small number of actual PostgreSQL connections.**

```
Without pgBouncer:
Flask (50 workers) ──── 250 connections ──→ PostgreSQL (overwhelmed)

With pgBouncer:
Flask (50 workers) ──── 250 connections ──→ pgBouncer ──→ 20 connections ──→ PostgreSQL (healthy)
                        (application side)              (multiplexed)        (12.5:1 ratio)
```

### When to Add pgBouncer

**Trigger:** When you observe any of the following:

- PostgreSQL `max_connections` utilization above 60%
- Connection timeout errors in Flask logs
- More than 50 concurrent users regularly

**Monitoring query to watch:**

```sql
-- Run this in Railway PostgreSQL to check connection usage
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active,
       count(*) FILTER (WHERE state = 'idle') as idle
FROM pg_stat_activity
WHERE datname = 'trading_alerts';
```

### pgBouncer Configuration

pgBouncer is deployed as a **sidecar** within the same Railway service as your Flask worker — no separate infrastructure needed.

```ini
# pgbouncer/pgbouncer.ini
[databases]
trading_alerts = host=postgresql.railway.internal port=5432 dbname=trading_alerts

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool mode: transaction is ideal for Flask (connection held only during query)
pool_mode = transaction

# Connection limits
max_client_conn = 500       # Max app-side connections
default_pool_size = 20      # Actual PostgreSQL connections per database
min_pool_size = 5           # Keep 5 connections warm
reserve_pool_size = 5       # Emergency reserve

# Timeouts
server_idle_timeout = 600   # Close idle server connections after 10 min
client_idle_timeout = 0     # Keep client connections indefinitely

# Logging
log_connections = 1
log_disconnections = 1
```

### Flask Connection String Update

```python
# Before pgBouncer
DATABASE_URL = "postgresql://user:pass@postgresql.railway.internal:5432/trading_alerts"

# After pgBouncer (just change the port to 6432)
DATABASE_URL = "postgresql://user:pass@localhost:6432/trading_alerts"

# Important: Disable prepared statements when using transaction pool mode
engine = create_engine(
    DATABASE_URL,
    connect_args={"options": "-c statement_timeout=30000"},
    pool_pre_ping=True,
    # pgBouncer transaction mode is incompatible with SQLAlchemy's prepared statements
    executemany_mode="values"
)
```

### pgBouncer Pool Modes Explained

| Mode        | Connection Held During | Best For                        | Use This              |
| ----------- | ---------------------- | ------------------------------- | --------------------- |
| Session     | Entire client session  | Apps that use session state     | ❌ Wastes connections |
| Transaction | Single transaction     | Most web apps, Flask/SQLAlchemy | ✅ **Recommended**    |
| Statement   | Single statement       | Simple read-only queries        | ⚠️ Too aggressive     |

---

## PostgreSQL Read Replicas

### The Problem Read Replicas Solve

By default, all database queries (reads AND writes) hit the primary PostgreSQL instance. For a trading alerts SaaS, the read/write ratio is approximately:

- **80% reads:** Fetching user alert configs, price history, dashboard data
- **20% writes:** Logging alert triggers, storing price snapshots, updating user state

At 1,000+ users, the primary PostgreSQL CPU becomes the bottleneck for dashboard load times, even though writes are infrequent. Read replicas offload the 80% read traffic to separate instances, dramatically reducing primary CPU usage.

### When to Add Read Replicas

**Trigger:** When you observe any of the following:

- Primary PostgreSQL CPU consistently above 60%
- Dashboard query latency above 100ms
- More than 1,000 active users

### How Read Replicas Work

PostgreSQL streaming replication uses the **Write-Ahead Log (WAL)** to keep replicas synchronized with the primary in near real-time (typically 10-100ms lag).

```
┌────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL Replication Flow                      │
│                                                                    │
│  Primary DB                                                        │
│  ┌──────────────┐    WAL Stream     ┌─────────────────────────┐   │
│  │ Writes:      │ ───────────────→  │  Read Replica 1         │   │
│  │ INSERT       │    (10-100ms)     │  SELECT queries only     │   │
│  │ UPDATE       │                  └─────────────────────────┘   │
│  │ DELETE       │                                                  │
│  └──────────────┘                                                  │
│                                                                    │
│  Application Routing:                                              │
│  • INSERT / UPDATE / DELETE  ──→  Primary (via pgBouncer :6432)   │
│  • SELECT (user data, alerts) ──→  Replica (via pgBouncer :6433)  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Application-Level Read/Write Routing

The simplest implementation uses two SQLAlchemy engine instances — one for the primary (writes) and one for the replica (reads).

```python
# flask/database/connection.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Primary: all writes go here
primary_engine = create_engine(
    os.getenv('DATABASE_PRIMARY_URL'),  # pgBouncer on :6432
    pool_size=10,
    max_overflow=5
)

# Replica: all reads go here
replica_engine = create_engine(
    os.getenv('DATABASE_REPLICA_URL'),   # pgBouncer on :6433
    pool_size=20,  # More connections since reads are more frequent
    max_overflow=10
)

PrimarySession = sessionmaker(bind=primary_engine)
ReplicaSession = sessionmaker(bind=replica_engine)


# Context managers for clean usage
from contextlib import contextmanager

@contextmanager
def get_write_db():
    """Use for INSERT, UPDATE, DELETE operations."""
    session = PrimarySession()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

@contextmanager
def get_read_db():
    """Use for SELECT queries — dashboard, alert configs, history."""
    session = ReplicaSession()
    try:
        yield session
    finally:
        session.close()
```

```python
# Usage in Flask routes
from database.connection import get_read_db, get_write_db

@app.route('/api/alerts')
def get_user_alerts():
    """Dashboard: loads user's alert configurations — READ replica."""
    with get_read_db() as db:
        alerts = db.query(Alert).filter(Alert.user_id == current_user.id).all()
    return jsonify([a.to_dict() for a in alerts])


def fire_alert(alert_id: str, price: float):
    """Alert triggered — WRITE to primary."""
    with get_write_db() as db:
        history = AlertHistory(
            alert_id=alert_id,
            triggered_price=price,
            fired_at=datetime.utcnow()
        )
        db.add(history)
        # commit happens automatically via context manager
```

### Replication Lag Awareness

Read replicas have a small lag (10-100ms typically). For trading alerts, this is acceptable for dashboard display but **never acceptable for alert evaluation** — always read the latest price and alert configs from the primary.

```python
# CORRECT: Alert evaluation uses PRIMARY to avoid stale data
def evaluate_alerts_for_symbol(symbol: str, current_price: float):
    with get_write_db() as db:  # Use primary for critical reads
        active_alerts = db.query(Alert).filter(
            Alert.symbol == symbol,
            Alert.is_active == True
        ).all()
    # ... evaluation logic

# CORRECT: Dashboard display uses REPLICA (slight lag acceptable)
def get_alert_history(user_id: str, limit: int = 50):
    with get_read_db() as db:
        return db.query(AlertHistory).filter(
            AlertHistory.user_id == user_id
        ).order_by(AlertHistory.fired_at.desc()).limit(limit).all()
```

---

## Stage-Gated Scaling Roadmap

### Stage 1: 0–500 Users (Current)

**Infrastructure:** Minimal. No Redis, no pgBouncer, no replicas.

```
Vercel (Next.js 15)
    │
    ▼
Railway Flask (1 instance)
    ├── Alert evaluation: in-process synchronous
    ├── WebSocket: Flask-SocketIO (single server)
    ├── Telegram: direct API call (synchronous)
    └── PostgreSQL: direct connection (no pooler)
```

**Monthly cost:** ~$15-25 (Flask + PostgreSQL on Railway)

**Action items at this stage:**

- Build and ship the product
- Instrument logging to capture DB connection count and query latency
- Set up Railway metrics alerts for CPU > 70%

---

### Stage 2: 500–2,000 Users

**Trigger:** CPU > 60% on Flask, or queue depth growing, or Telegram calls causing latency spikes.

**Add:** Redis + BullMQ Worker (offload Telegram/email/DB writes)

```
Vercel (Next.js 15)
    │
    ▼
Railway Flask (1-2 instances)
    ├── Alert evaluation: still in-process (fast)
    ├── WebSocket: Flask-SocketIO
    ├── Telegram: → enqueue to Redis (async) ← NEW
    └── PostgreSQL: direct connection

Railway Redis ← NEW
Railway BullMQ Worker (1 instance) ← NEW
    ├── Processes: send_telegram
    ├── Processes: send_email
    └── Processes: log_alert_history
```

**Monthly cost:** ~$35-60 (+ Redis ~$5, + worker ~$10)

**What improves:**

- Flask no longer blocked by Telegram API calls
- Alert-to-WebSocket latency drops (Telegram delivery happens async)
- Failed Telegram messages automatically retry (3 attempts with exponential backoff)

---

### Stage 3: 2,000–10,000 Users

**Trigger:** PostgreSQL CPU > 60%, dashboard load > 100ms, or connection pool saturation.

**Add:** pgBouncer + PostgreSQL Read Replica + Redis caching for MT5 price data

```
Vercel (Next.js 15)
    │
    ▼
Railway Flask (2-5 instances)
    ├── Alert evaluation: in-process (reads from Redis price cache) ← NEW
    ├── WebSocket: Flask-SocketIO (+ Redis adapter for multi-instance sync) ← NEW
    └── pgBouncer :6432 (write) / :6433 (read) ← NEW

Railway Redis (price cache + socket adapter + BullMQ)
Railway BullMQ Workers (2-3 instances)

Railway PostgreSQL Primary ← WRITES ONLY
Railway PostgreSQL Replica 1 ← READS (dashboard, history, preferences)
```

**Monthly cost:** ~$100-180 (+ replica ~$25, + pgBouncer is free/sidecar)

**What improves:**

- MT5 price lookups come from Redis (sub-millisecond) instead of DB
- Dashboard queries hit replica (primary CPU drops ~40%)
- Flask can scale horizontally (WebSocket state synced via Redis adapter)
- Connection pooling supports 2,000+ concurrent users with 20 actual DB connections

---

### MT5 Price Caching with Redis (Stage 3)

Rather than querying PostgreSQL for the latest price (which is polled from MT5 and written to DB), cache it in Redis with a short TTL.

```python
# flask/services/price_cache.py
import redis
import json

r = redis.from_url(os.getenv('REDIS_URL'))

PRICE_TTL = 5  # seconds — price data is considered stale after 5s

def cache_price(symbol: str, price: float, timestamp: str):
    """Called every time MT5 delivers a new tick."""
    key = f"price:{symbol}"
    r.setex(key, PRICE_TTL, json.dumps({'price': price, 'ts': timestamp}))

def get_cached_price(symbol: str) -> dict | None:
    """Retrieve latest price from cache. Falls back to DB if cache miss."""
    data = r.get(f"price:{symbol}")
    if data:
        return json.loads(data)
    # Cache miss: fetch from DB replica (cold start or Redis restart)
    return fetch_latest_price_from_db(symbol)

# Alert evaluation now uses cache — eliminates DB query per tick
def evaluate_alerts(symbol: str):
    price_data = get_cached_price(symbol)
    if not price_data:
        return  # Skip if no price available
    current_price = price_data['price']
    # ... evaluation logic using current_price
```

---

## Database Schema Considerations

The schema design directly impacts how well the above scaling patterns perform.

### Critical Indexes for Alert Platform

```sql
-- Active alerts lookup (called on every price tick — must be fast)
CREATE INDEX idx_alerts_symbol_active
    ON alerts(symbol, is_active)
    WHERE is_active = TRUE;

-- User's alert history (dashboard — hits read replica)
CREATE INDEX idx_alert_history_user_fired
    ON alert_history(user_id, fired_at DESC);

-- Price snapshots (analytics queries — hits read replica)
CREATE INDEX idx_prices_symbol_ts
    ON price_snapshots(symbol, recorded_at DESC);

-- Subscription tier lookup (called on auth check)
CREATE INDEX idx_users_tier
    ON users(tier, subscription_status);
```

### Partition alert_history by Month (Stage 3+)

Once alert_history exceeds 1M rows (roughly 500 active users × 2,000 alerts/month), partition by month to keep query performance consistent.

```sql
-- Convert to partitioned table (one-time migration)
CREATE TABLE alert_history (
    id          UUID DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    alert_id    UUID NOT NULL,
    symbol      VARCHAR(20),
    fired_at    TIMESTAMPTZ NOT NULL,
    trigger_price DECIMAL(18,5),
    direction   VARCHAR(10)
) PARTITION BY RANGE (fired_at);

-- Create monthly partitions
CREATE TABLE alert_history_2026_02 PARTITION OF alert_history
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE alert_history_2026_03 PARTITION OF alert_history
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

---

## Monitoring & Scaling Triggers

### Key Metrics to Watch Per Component

| Component    | Metric             | Warning                 | Action                     |
| ------------ | ------------------ | ----------------------- | -------------------------- |
| PostgreSQL   | Active connections | >60% of max_connections | Add pgBouncer              |
| PostgreSQL   | CPU utilization    | >60%                    | Add read replica           |
| PostgreSQL   | Query latency P95  | >50ms                   | Add indexes or replica     |
| pgBouncer    | Pool utilization   | >70%                    | Increase pool_size         |
| pgBouncer    | Wait queue         | >10 jobs                | Increase max_client_conn   |
| Read Replica | Replication lag    | >500ms                  | Investigate replica health |
| Redis        | Memory usage       | >70%                    | Increase instance size     |
| BullMQ       | Queue depth        | >100 jobs consistently  | Add worker instance        |
| BullMQ       | Failed job rate    | >5%                     | Check Telegram/email API   |
| Flask        | Response time P95  | >500ms                  | Add Flask instance         |
| WebSocket    | Active connections | >3,000/instance         | Add Flask instance         |

### Railway Monitoring Queries

```sql
-- Connection pool health (run in Railway PostgreSQL console)
SELECT
    datname,
    count(*) AS total,
    count(*) FILTER (WHERE state = 'active') AS active,
    count(*) FILTER (WHERE state = 'idle') AS idle,
    count(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting
FROM pg_stat_activity
WHERE datname IS NOT NULL
GROUP BY datname;

-- Slowest queries (identify missing indexes)
SELECT
    mean_exec_time,
    calls,
    query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Replication lag (run when replica exists)
SELECT
    client_addr,
    state,
    sent_lsn - write_lsn AS write_lag_bytes,
    EXTRACT(EPOCH FROM (now() - write_time)) AS lag_seconds
FROM pg_stat_replication;
```

---

## Cost Analysis Per Stage

| Stage   | Users         | Monthly Infrastructure Cost | Key Additions                               |
| ------- | ------------- | --------------------------- | ------------------------------------------- |
| Stage 1 | 0–500         | $15–25                      | Flask + PostgreSQL                          |
| Stage 2 | 500–2,000     | $35–60                      | + Redis + 1 BullMQ worker                   |
| Stage 3 | 2,000–10,000  | $100–180                    | + pgBouncer + 1 read replica + worker scale |
| Future  | 10,000–50,000 | $300–600                    | + 2nd replica + HAProxy + multi-worker      |

**Key principle:** Infrastructure cost should grow in proportion to revenue. At $29/month PRO pricing:

- 50 PRO users = $1,450/month revenue → Stage 1 infra at $25/month = **1.7% of revenue**
- 200 PRO users = $5,800/month revenue → Stage 2 infra at $60/month = **1.0% of revenue**
- 500 PRO users = $14,500/month revenue → Stage 3 infra at $150/month = **1.0% of revenue**

---

## Conclusion

This architecture scales from your current single-developer early-stage platform to 10,000 users through three clearly-defined infrastructure additions, each triggered by measurable load signals — not by speculation.

**The order matters:**

1. **Ship the product first** — Stage 1 is sufficient to onboard your first 500 users and validate PMF
2. **Add Redis + BullMQ** when async processing becomes a bottleneck (~200+ users)
3. **Add pgBouncer** when PostgreSQL connection exhaustion approaches
4. **Add read replica** when PostgreSQL CPU becomes the dashboard latency bottleneck

At no point does this require abandoning your existing Next.js + Flask + Railway PostgreSQL stack. Every component described here is additive, incremental, and reversible.

**The WebSocket real-time pipeline remains constant across all stages** — only the backend infrastructure supporting it scales. Users always experience sub-2-second alert notifications regardless of whether you have 10 users or 10,000.

---

_Document Version: 1.0 | Last Updated: 2026-02-26 | Project: trading-alerts-saas-v7_

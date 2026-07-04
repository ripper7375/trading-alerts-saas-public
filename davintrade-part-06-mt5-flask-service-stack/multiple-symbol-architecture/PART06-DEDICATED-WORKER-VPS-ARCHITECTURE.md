# Part 06 Architecture Design Document — Dedicated Worker VPS Pipeline

**Last Updated:** 2026-07-03
**Status:** 🟡 PROPOSED (design approved, implementation not started)
**Supersedes (for Part 06 only):** `mt5-service/` monolithic Flask process
**Does not touch:** The EA-based historical/indicator pipeline (Contabo VPS #1 → NestJS API Gateway → Bull Queue → PostgreSQL)
**Source diagrams:** `docs/files-completion-list/Part06-Before-After-v3-Dedicated-Worker-VPS.pptx`
**Related specs:** `docs/open-api-documents/part-06-flask_mt5_openapi.yaml` (v6.0.0), `docs/architecture/PART6-PART20-DUAL-SYSTEM.md`

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Background: Current Architecture](#2-background-current-architecture)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Proposed Architecture](#4-proposed-architecture)
5. [Infrastructure Topology](#5-infrastructure-topology)
6. [Component Specifications](#6-component-specifications)
7. [Data Contracts](#7-data-contracts)
8. [Tier Access Control](#8-tier-access-control)
9. [Resilience & Failover](#9-resilience--failover)
10. [Deployment Plan](#10-deployment-plan)
11. [Repository Structure](#11-repository-structure)
12. [Migration & Cutover Plan](#12-migration--cutover-plan)
13. [Observability & Monitoring](#13-observability--monitoring)
14. [Security Considerations](#14-security-considerations)
15. [Testing & Validation Checklist](#15-testing--validation-checklist)
16. [Open Questions / Future Work](#16-open-questions--future-work)
17. [Appendix A: Reference Documents](#17-appendix-a-reference-documents)
18. [Appendix B: Environment Variables Reference](#18-appendix-b-environment-variables-reference)

---

## 1. Purpose & Scope

This document specifies the target architecture for **Part 06 (real-time OHLCV market data service)** after decomposing it away from the current monolithic Flask process. It is written to be handed to an implementation agent (Claude Code) as a build reference — every component, contract, and file path below should be treated as the source of truth for implementation, ahead of any older Part 06 docs that describe the monolithic design.

**In scope:**

- Ingestion of live OHLCV data from MT5 terminals on a **dedicated Contabo VPS**
- A **Python worker** process per terminal, isolated from the existing EA/indicator pipeline
- **Redis** as the message broker and rolling-history cache (hosted on Railway, private network)
- A **NestJS Realtime Gateway** that serves the existing REST + Socket.IO contract to Part 07 and the browser
- Primary/backup MT5 terminal failover per symbol

**Out of scope (unchanged, not touched by this document):**

- The MQL5 EA-based historical/indicator pipeline (Contabo VPS #1 → NestJS API Gateway → Bull Queue → PostgreSQL)
- Part 07 (Tier Routes API) internals — only its external contract with Part 06 matters here
- Frontend chart rendering (`trading-chart.tsx`, `lightweight-charts`) — no changes expected

---

## 2. Background: Current Architecture

### 2.1 Problem Statement

Part 06 today is a single Flask process (`mt5-service/`) that:

- Opens up to **15 MT5 terminal sessions** (one per symbol) inside **one Python interpreter**, via `app/services/mt5_connection_pool.py`
- Serves REST (`/api/indicators/{symbol}/{timeframe}`, `/api/symbols`, `/api/timeframes`, admin endpoints) and Socket.IO (real-time `ohlcv_update` events) from that same process
- Uses `flask-socketio` + `eventlet` for concurrency

The official `MetaTrader5` Python package is designed around a **one-process-per-terminal** model — running 15 sessions inside a single interpreter risks cross-session interference, and a crash or restart of that one process takes all 15 symbols down simultaneously. The REST/WebSocket serving layer also cannot scale independently of MT5 connectivity, since they share the same process.

### 2.2 Current Stack

| Layer             | Technology                                                                           |
| ----------------- | ------------------------------------------------------------------------------------ |
| Web framework     | Flask 3.0.0, Flask-CORS 4.0.0                                                        |
| Realtime          | flask-socketio 5.3.5, python-socketio 5.10.0, python-engineio 4.8.0, eventlet 0.33.3 |
| MT5 integration   | `MetaTrader5` Python package (Windows-only)                                          |
| Data processing   | pandas ≥ 2.0.0, numpy ≥ 1.24.0                                                       |
| Validation        | pydantic ≥ 2.12.0                                                                    |
| Production server | gunicorn 21.2.0, gevent 23.9.1                                                       |
| Hosting           | Single Windows VPS                                                                   |

### 2.3 Current Data Flow

```
MT5 Terminals (×15, one per symbol)
        │  mt5.copy_rates_from_pos()
        ▼
Single Flask Process
  ├─ MT5ConnectionPool (15 MT5Connection objects, one interpreter)
  ├─ REST API (/api/indicators/{symbol}/{timeframe}, /api/symbols, ...)
  └─ Socket.IO server (flask-socketio + eventlet)
        │  0.25s change-detection loop, push on new bar or intra-bar close change
        ▼
Part 07 (tier check) + Browser (chart, Socket.IO client)
```

This design is documented in full in `docs/open-api-documents/part-06-flask_mt5_openapi.yaml` (v6.0.0) — that contract is preserved unchanged by this redesign (see [Section 7](#7-data-contracts)).

---

## 3. Goals & Non-Goals

### 3.1 Goals

- **G1 — Fault isolation for ingestion.** A dead or degraded MT5 terminal session must not affect any other symbol, and must not affect the REST/WebSocket serving layer.
- **G2 — Independent scaling.** The serving layer (Realtime Gateway) must be able to scale horizontally without any change to MT5 ingestion, and vice versa.
- **G3 — Zero contract change.** Part 07 and the browser must see the exact same REST endpoints and Socket.IO events as today. No frontend changes required.
- **G4 — Isolation from the EA pipeline.** Part 06 must never share a process, a VPS, or a queue with the MQL5 EA / historical-indicator pipeline.
- **G5 — Per-terminal failover.** Losing a single MT5 terminal connection should self-heal via a backup credential set, without manual intervention.

### 3.2 Non-Goals

- This document does **not** propose changes to the tier model (FREE/PRO symbol and timeframe limits) — those rules are reused as-is.
- This document does **not** propose reducing the terminal count below what's operationally required. Terminal consolidation (fewer terminals, each polling multiple symbols) is called out as a _future optimization to validate_, not a requirement of this design (see [Section 16](#16-open-questions--future-work)).
- This document does **not** cover the EA/indicator pipeline's design — see `docs/architecture/PART6-PART20-DUAL-SYSTEM.md` and the `contabo-to-postgresql` docs for that system.

---

## 4. Proposed Architecture

### 4.1 High-Level Diagram

```
┌─────────────────────────────┐
│  Contabo VPS #2 (dedicated) │
│                              │
│  MT5 Terminal(s)             │
│  ├─ Primary session          │
│  └─ Backup session (standby) │
└──────────────┬───────────────┘
               │ MetaTrader5 Python API
               │ copy_rates_from_pos()
               ▼
┌──────────────────────────────┐
│  Python Worker (per terminal)│
│  ├─ Connection manager        │
│  │   (primary + backup,       │
│  │    health check, failover) │
│  └─ redis-py publisher         │
└──────────────┬────────────────┘
               │ PUBLISH ohlcv:{symbol}:{timeframe}
               │ ZADD ohlcv:history:{symbol}:{timeframe}
               ▼
┌──────────────────────────────┐
│  Redis (Railway, private)     │
│  ├─ Pub/Sub — live ticks       │
│  └─ Sorted Set — rolling       │
│     history cache (≤ N bars)   │
└──────────────┬────────────────┘
               │ SUBSCRIBE / ZRANGE
               ▼
┌──────────────────────────────┐
│  NestJS Realtime Gateway       │
│  (Railway, public, ×N replicas)│
│  ├─ REST: /api/symbols,        │
│  │   /api/indicators/...       │
│  ├─ Socket.IO server           │
│  │   (@socket.io/redis-adapter)│
│  └─ Tier check on subscribe     │
└──────────────┬────────────────┘
               │ same REST + WS contract
               ▼
      Part 07 (tier API)  +  Browser (chart)
```

### 4.2 What Changes vs. What Doesn't

|                            | Before                                 | After                                                         |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------- |
| MT5 bridge                 | Python process, bundled with REST/WS   | Dedicated Python worker process, isolated on its own VPS      |
| Terminal hosting           | 15 terminals, 1 shared Windows box     | Terminals dedicated to Part 06 on a separate Contabo VPS      |
| Live tick transport        | Flask polls MT5 in-process every 0.25s | Worker publishes to Redis Pub/Sub; NestJS + Socket.IO fan out |
| Isolation from EA pipeline | N/A — Part 06 never touched indicators | Physically separate VPS; EA and worker never share a machine  |
| Hosting                    | Everything pinned to one Windows box   | 2 VPS (EA + worker) + Railway (Gateway + Redis)               |
| External API contract      | REST + Socket.IO (Part 07 / Browser)   | **Unchanged** — same REST + Socket.IO contract                |

---

## 5. Infrastructure Topology

### 5.1 Contabo VPS #1 (existing, untouched)

- Runs the MQL5 EA(s) and MT5 terminals for the historical/indicator pipeline
- Feeds the NestJS API Gateway → Bull Queue → PostgreSQL system
- **No changes required by this document.**

### 5.2 Contabo VPS #2 (new, dedicated to Part 06)

- Windows VPS, sized for however many MT5 terminals Part 06 requires (start with a 1:1 mapping to today's 15 terminals; see [Section 16](#16-open-questions--future-work) for consolidation)
- No MQL5 EA installed — the only client of these terminals is the Python worker
- Runs one Python worker process per terminal (or per terminal pair, if primary/backup share a process — see [Section 9](#9-resilience--failover))
- Outbound network access to Railway's Redis instance only (no inbound ports need to be exposed)

### 5.3 Railway Project

- **Realtime Gateway service** (NestJS) — public HTTPS + WSS endpoint, horizontally scalable (N replicas)
- **Redis instance** — private network only, not exposed publicly; reachable by the Gateway via Railway's internal network, and by the Contabo VPS #2 workers via a securely configured external connection (TLS + auth; see [Section 14](#14-security-considerations))

---

## 6. Component Specifications

### 6.1 MT5 Terminals (Dedicated VPS #2)

- One MT5 terminal instance per symbol (matching the existing `config/mt5_terminals.json` shape), reused/migrated from the current design
- Each terminal has **two sets of broker credentials**: primary and backup, both resolvable via environment variables (same `${VAR_NAME}` pattern as today's `mt5_terminals.json`)
- No EA, no WebRequest — the terminal is only ever driven by the Python worker via the `MetaTrader5` package

### 6.2 Python Worker Service

**Directory:** `mt5-worker/` (new; see [Section 11](#11-repository-structure))

Responsibilities:

- Connect to its assigned MT5 terminal(s) using the `MetaTrader5` Python API — reuses the existing `MT5Connection` class design from `mt5-service/app/services/mt5_connection_pool.py` (connect, reconnect, health check, `reconnect_count`, `last_error`), extended with a **backup credential set** (see [Section 9](#9-resilience--failover))
- On a fixed interval (default: 0.25s, matching today's change-detection cadence), call `copy_rates_from_pos(symbol, timeframe, 0, N)` for every timeframe assigned to that terminal
- Detect changes the same way the current `websocket.py` background loop does: push on new bar open (timestamp advances) **or** intra-bar close price change
- On a detected change:
  - `PUBLISH ohlcv:{symbol}:{timeframe}` with the tick payload (see [Section 7.1](#71-redis-channel--payload-schema))
  - `ZADD ohlcv:history:{symbol}:{timeframe}` to update the rolling history cache (score = bar timestamp), trimmed to the last N bars (default 1000, matching the existing `bars` query parameter default)
- Resolve broker-specific symbol names using the same logic as `app/utils/symbol_resolver.py` (e.g., Eightcap `.i` suffix)
- Expose a lightweight local health-check log/metric (see [Section 13](#13-observability--monitoring)) — this worker does not need its own HTTP server; it is a pure producer

**Tech stack:** Python 3.11+, `MetaTrader5` package, `redis-py`, `python-dotenv`, `colorlog` (reused from the current service for consistent log formatting)

### 6.3 Redis (Message Broker + Cache)

Hosted on Railway, **private network only**. Two responsibilities:

1. **Pub/Sub** — live tick fan-out. One channel per symbol+timeframe: `ohlcv:{symbol}:{timeframe}`.
2. **Rolling history cache** — a Sorted Set per symbol+timeframe (`ohlcv:history:{symbol}:{timeframe}`), used by the Gateway to serve both the REST endpoint and the WebSocket `initial_data` payload **without ever calling MT5 directly**. This is the key design decision that keeps MT5 access fully isolated to the worker tier — the Gateway never needs an MT5 connection of its own.

No BullMQ, no job queue in this path — it is fire-and-forget, latency-first, matching the "why this works" rationale in the source deck: a queue's competing-consumer model doesn't fan out to many subscribers the way Pub/Sub does, and job-processing overhead isn't worth paying on a 0.25s cadence.

### 6.4 NestJS Realtime Gateway

**Directory:** `realtime-gateway/` (new; see [Section 11](#11-repository-structure))

Responsibilities:

- Serve the **existing REST contract** (`/api/symbols`, `/api/timeframes`, `/api/indicators/{symbol}/{timeframe}`, `/api/health`, admin endpoints) by reading from the Redis history cache instead of querying MT5 — response shapes are unchanged (see `part-06-flask_mt5_openapi.yaml`)
- Serve **Socket.IO** (`@nestjs/platform-socket.io`) with the existing events: client `subscribe {symbol, timeframe}`, server `initial_data` (pulled from the Redis Sorted Set) and `ohlcv_update` (relayed from the Redis Pub/Sub channel)
- Use `@socket.io/redis-adapter` so that any of the N Gateway replicas can broadcast to clients connected to any other replica
- Enforce **tier access control** on `subscribe` (see [Section 8](#8-tier-access-control)) — mirrors today's Flask behavior of validating tier before joining a room
- Health/admin endpoints proxy to worker-reported status (via a small Redis key each worker updates, e.g. `worker:health:{terminal_id}`) rather than holding MT5 connections directly

**Tech stack:** NestJS 11.x, `@nestjs/platform-socket.io`, `ioredis`, `@socket.io/redis-adapter`, `class-validator` / `zod` for DTOs (match whichever the team already standardizes on for Part 07)

### 6.5 Part 07 / Browser (unchanged)

- Part 07 continues to serve `/api/tier/symbols`, `/api/tier/check/{symbol}`, `/api/tier/combinations` exactly as today
- The browser continues to: call Part 07 to fetch allowed combinations → open a Socket.IO connection to Part 06 (now the Realtime Gateway, at the same public URL/contract) → subscribe → receive `initial_data` + `ohlcv_update`
- **No frontend code changes are anticipated.**

---

## 7. Data Contracts

### 7.1 Redis Channel & Payload Schema

**Pub/Sub channel:** `ohlcv:{symbol}:{timeframe}` (e.g. `ohlcv:XAUUSD:M5`)

```json
{
  "symbol": "XAUUSD",
  "timeframe": "M5",
  "time": 1751500800,
  "open": 1985.5,
  "high": 1987.25,
  "low": 1984.75,
  "close": 1986.0,
  "volume": 1234,
  "source": "primary",
  "terminal_id": "MT5_15"
}
```

**History cache key:** `ohlcv:history:{symbol}:{timeframe}` — Redis Sorted Set, member = JSON-encoded bar (same shape as above minus `source`), score = `time`. Trimmed to the most recent 1000 entries (`ZREMRANGEBYRANK ... 0 -1001`) after each write.

**Worker health key:** `worker:health:{terminal_id}` — Redis hash, fields: `connected` (bool), `active_session` (`primary`|`backup`), `last_check` (ISO timestamp), `reconnect_count` (int), `last_error` (string, optional). TTL refreshed on every health check so a dead worker's key naturally expires.

### 7.2 REST API (unchanged)

The Gateway must reproduce every response shape defined in `docs/open-api-documents/part-06-flask_mt5_openapi.yaml` v6.0.0, including:

- `GET /api/health` → `HealthResponse` (now sourced from `worker:health:*` keys instead of live MT5 pings)
- `GET /api/symbols`, `GET /api/timeframes` → tier-filtered, same as today
- `GET /api/indicators/{symbol}/{timeframe}` → `OHLCVDataResponse`, now sourced from `ohlcv:history:{symbol}:{timeframe}` via `ZRANGE` instead of a live `copy_rates_from_pos()` call
- `GET/POST /api/admin/terminals/*` → admin actions (restart, logs, stats) now translate to worker-side operations (e.g., a restart request publishes a control message the relevant worker listens for, or triggers a process restart via the VPS's process manager)

### 7.3 WebSocket Events (unchanged)

| Event          | Direction       | Payload                                                                   |
| -------------- | --------------- | ------------------------------------------------------------------------- |
| `subscribe`    | client → server | `{ symbol, timeframe }`                                                   |
| `initial_data` | server → client | Full recent history, read from `ohlcv:history:{symbol}:{timeframe}`       |
| `ohlcv_update` | server → client | Single bar, relayed from the `ohlcv:{symbol}:{timeframe}` Pub/Sub channel |

---

## 8. Tier Access Control

Tier rules (FREE: 5 symbols × {H1, H4, D1}; PRO: 15 symbols × 9 timeframes) are validated **independently at the Gateway**, the same way the current Flask service validates before serving `/api/indicators/{symbol}/{timeframe}` and before allowing a WebSocket room join. Two implementation options, to be decided during implementation:

1. **Duplicate the tier-config logic** into the NestJS Gateway (mirrors `lib/tier-config.ts` / `lib/tier-validation.ts` from Part 07). Fast (no network hop per subscribe), but requires keeping two copies of the rules in sync.
2. **Call Part 07 internally** on each subscribe/REST request to validate. Simpler to keep in sync, adds latency and a dependency on Part 07's availability.

**Recommendation:** start with option 1 (duplicated, lightweight tier check) for latency reasons, and add an integration test that fails CI if Part 07's tier-config and the Gateway's copy diverge.

---

## 9. Resilience & Failover

Each MT5 terminal is configured with **primary and backup broker credentials**. The worker's connection manager:

1. Connects to the primary session on startup and operates normally
2. Runs a health check on a timer (reuses the existing reconnect/health-check pattern from `MT5Connection`)
3. After **N consecutive failed reconnects** (configurable, default 3), marks the primary session down and logs into the backup session for the same symbol
4. Resumes `copy_rates_from_pos()` polling from the backup session — the Redis channel names and Gateway contract are unaffected, so clients see at most a brief data gap bounded by the health-check interval
5. Optionally, once the primary is healthy again, an operator (or an auto-recovery policy) can force a switch back

This is the same mechanism described in the single-symbol design (`Part06-Single-Symbol-Primary-Backup.pptx`), generalized here to apply per-terminal across the full multi-symbol worker fleet. It requires no architectural change beyond a second credential set per terminal and a small state machine in the connection manager.

---

## 10. Deployment Plan

### 10.1 Contabo VPS #2 Setup

1. Provision a new Windows VPS, sized for the target terminal count
2. Install MT5 terminal instances (one per symbol, or consolidated per [Section 16](#16-open-questions--future-work))
3. Configure primary + backup broker credentials per terminal
4. Deploy the Python worker (`mt5-worker/`) as a Windows service (or scheduled task with auto-restart) per terminal or terminal group
5. Configure outbound-only network access to Railway's Redis (see [Section 14](#14-security-considerations) for the connection-security tradeoff)

### 10.2 Railway Services Setup

1. Provision a Railway Redis instance, private network only
2. Deploy the `realtime-gateway/` NestJS service, configured with the Redis connection string
3. Configure horizontal scaling (start with 1–2 replicas; `@socket.io/redis-adapter` makes adding replicas safe at any time)
4. Point the existing public DNS/URL Part 07 and the frontend already use at the new Gateway service (no client-side URL change if the same domain is reused)

### 10.3 Environment Variables

See [Appendix B](#18-appendix-b-environment-variables-reference) for the full list.

---

## 11. Repository Structure

```
trading-alerts-saas-public/
├── mt5-service/                  # LEGACY — current monolithic Flask service
│                                  # (kept during migration, removed after cutover)
├── mt5-worker/                   # NEW — Python worker (this document)
│   ├── worker.py                 # entrypoint, one process per terminal
│   ├── connection_manager.py     # primary/backup MT5 session handling
│   ├── redis_publisher.py        # publish + history-cache writes
│   ├── symbol_resolver.py        # reused/ported from mt5-service
│   ├── config/
│   │   └── mt5_terminals.json    # terminal + primary/backup credentials
│   ├── requirements.txt
│   └── tests/
├── realtime-gateway/              # NEW — NestJS Gateway (this document)
│   ├── src/
│   │   ├── main.ts
│   │   ├── ohlcv/                # REST controllers (symbols, timeframes, indicators)
│   │   ├── realtime/              # Socket.IO gateway, subscribe handler, tier check
│   │   ├── redis/                 # ioredis providers (pub/sub + history reads)
│   │   └── admin/                 # admin endpoints (health, terminal stats/restart)
│   ├── package.json
│   └── test/
└── docs/
    └── architecture/
        └── PART06-DEDICATED-WORKER-VPS-ARCHITECTURE.md   # this document
```

---

## 12. Migration & Cutover Plan

Following the same feature-flag pattern already used for the Part 06 / Part 20 dual-system (`USE_FLASK_MT5`, see `docs/architecture/PART6-PART20-DUAL-SYSTEM.md`), introduce a flag to control cutover, e.g. `MT5_SERVICE_MODE=legacy | dedicated-worker`.

**Phase 1 — Build in parallel.** Stand up `mt5-worker/` and `realtime-gateway/` alongside the existing `mt5-service/`, without touching production traffic. Validate against the OpenAPI contract using recorded requests/responses from the legacy service.

**Phase 2 — Shadow traffic.** Run the new pipeline against live MT5 data, comparing its REST/WS output to the legacy service's for the same symbols/timeframes, without serving real users.

**Phase 3 — Canary cutover.** Route a small percentage of traffic (or a subset of symbols) to the new Gateway via the feature flag / DNS weighting; monitor error rates, latency, and data staleness.

**Phase 4 — Full cutover.** Switch all traffic to the new Gateway. Keep `mt5-service/` deployable (but stopped) for a rollback window.

**Phase 5 — Decommission.** Remove `mt5-service/` and the single shared Windows VPS once the new pipeline has been stable for an agreed bake-in period.

---

## 13. Observability & Monitoring

- Each worker logs connection state, reconnects, and failovers using the same `colorlog`-based structured format as `mt5-service` today
- Each worker writes its health snapshot to `worker:health:{terminal_id}` in Redis (see [Section 7.1](#71-redis-channel--payload-schema)) on every health-check tick
- The Gateway aggregates worker health keys to serve `GET /api/health` and the admin stats endpoints, reproducing the existing `HealthResponse` / `AdminHealthResponse` shapes
- Recommended additions (not required for parity, but valuable): Prometheus metrics on the Gateway (request latency, active Socket.IO connections, Redis subscribe lag) and alerting on any worker's `last_error` age exceeding a threshold

---

## 14. Security Considerations

- **Redis stays private.** Only the Gateway (Railway internal network) and the VPS #2 workers (external, authenticated connection) can reach it. No public Redis exposure.
- **Worker-to-Redis connection security.** Since VPS #2 is outside Railway's private network, the worker's Redis connection must cross the public internet — use Redis AUTH plus TLS (`rediss://`), or a managed Redis provider that supports secure external connections if Railway's own instance can't be safely exposed. This is the same tradeoff flagged in the earlier Railway/NestJS discussion.
- **API keys unchanged.** The Gateway continues to require `X-API-Key` for REST calls from Next.js, and `X-Admin-API-Key` for admin endpoints, matching the current OpenAPI spec.
- **MT5 credentials.** Primary and backup broker credentials are stored as environment variables on VPS #2 only, never checked into the repository (same `${VAR_NAME}` resolution pattern as today's `mt5_terminals.json`).

---

## 15. Testing & Validation Checklist

- [ ] Worker correctly resolves broker-specific symbol names (Eightcap `.i` suffix and any others in `symbol_resolver.py`)
- [ ] Worker detects and publishes on both "new bar open" and "intra-bar close change" conditions, matching today's 0.25s change-detection behavior
- [ ] Redis history cache (`ohlcv:history:*`) stays capped at the configured bar count and serves correct `bars_requested` / `bars_received` metadata
- [ ] Gateway's REST responses byte-for-byte match the existing OpenAPI examples for `/api/symbols`, `/api/timeframes`, `/api/indicators/{symbol}/{timeframe}`
- [ ] Gateway's Socket.IO `initial_data` and `ohlcv_update` events match the existing payload shapes exactly
- [ ] Tier gating rejects FREE-tier subscribe/REST requests for PRO-only symbols and timeframes, matching today's `AccessDeniedResponse` shape
- [ ] Primary → backup failover: kill the primary MT5 session in a test environment and confirm the worker switches over within the configured failure threshold, with no Gateway-visible contract change
- [ ] Multi-replica Gateway: confirm a tick published while a client is connected to replica A is received by a client connected to replica B (validates `@socket.io/redis-adapter` wiring)
- [ ] Load test: confirm the Gateway can serve the expected number of concurrent Socket.IO connections per replica before needing to scale out
- [ ] Confirm VPS #2 has no MQL5 EA installed and no dependency on the EA/indicator pipeline's Bull Queue or PostgreSQL

---

## 16. Open Questions / Future Work

- **Terminal consolidation.** The EA-based indicator pipeline covers 15 symbols with only 5 terminals because the EA multiplexes symbols via `OnTimer()`. It's plausible that a single Python worker process can similarly poll multiple symbols from one logged-in terminal via `copy_rates_from_pos(symbol, ...)`, since that call isn't restricted to one symbol per session — but this hasn't been validated for the Python API path the way it has for the EA path. Worth a small spike before committing to a 1:1 terminal-per-symbol deployment on VPS #2.
- **Admin restart semantics.** Decide the exact mechanism for `POST /api/admin/terminals/{terminal_id}/restart` in the new architecture — likely a Redis-published control message the target worker subscribes to, or a process-manager-level restart triggered by the Gateway via a small management API on VPS #2.
- **Tier-config duplication vs. shared package.** If option 1 in [Section 8](#8-tier-access-control) is chosen, consider extracting tier rules into a shared npm package consumed by both Part 07 and the Realtime Gateway, rather than maintaining two hand-synced copies.
- **Single-symbol scope.** If a reduced product tier (e.g., XAUUSD-only) is introduced, the simpler primary/backup-in-one-monolith design in `Part06-Single-Symbol-Primary-Backup.pptx` remains the right-sized choice for that scope — this document's decomposition is only justified once multiple symbols are back in play.

---

## 17. Appendix A: Reference Documents

- `docs/open-api-documents/part-06-flask_mt5_openapi.yaml` — authoritative REST/WS contract (v6.0.0), unchanged by this redesign
- `docs/files-completion-list/Part06-Before-After-v3-Dedicated-Worker-VPS.pptx` — source diagrams for this document
- `docs/files-completion-list/Part06-Single-Symbol-Primary-Backup.pptx` — simplified single-symbol variant (when this decomposition isn't justified)
- `docs/architecture/PART6-PART20-DUAL-SYSTEM.md` — prior art for feature-flag-based service cutover
- `docs/files-completion-list/files-inventory/part-06-files-completion.md` — current `mt5-service/` file inventory
- `mt5-service/app/services/mt5_connection_pool.py`, `mt5-service/app/utils/symbol_resolver.py`, `mt5-service/config/mt5_terminals.json` — current implementation being ported/replaced

---

## 18. Appendix B: Environment Variables Reference

### Python Worker (Contabo VPS #2)

| Variable                                             | Purpose                                                                 |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `MT5_SERVER`                                         | Shared broker server address (reused pattern from `mt5_terminals.json`) |
| `MT5_LOGIN_{NN}` / `MT5_PASSWORD_{NN}`               | Primary credentials per terminal                                        |
| `MT5_BACKUP_LOGIN_{NN}` / `MT5_BACKUP_PASSWORD_{NN}` | Backup credentials per terminal                                         |
| `REDIS_URL`                                          | `rediss://` connection string to Railway Redis (TLS + auth)             |
| `HEALTH_CHECK_INTERVAL`                              | Seconds between health checks (default: matches existing `60`)          |
| `CHANGE_DETECTION_INTERVAL`                          | Seconds between OHLCV polls (default: `0.25`)                           |
| `FAILOVER_THRESHOLD`                                 | Consecutive failed reconnects before switching to backup (default: `3`) |

### NestJS Realtime Gateway (Railway)

| Variable            | Purpose                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `REDIS_URL`         | Internal Railway Redis connection string                                                              |
| `PORT`              | Gateway HTTP/WS port (Railway-assigned)                                                               |
| `MT5_API_KEY`       | Validates `X-API-Key` from Next.js, matching current spec                                             |
| `MT5_ADMIN_API_KEY` | Validates `X-Admin-API-Key` for admin endpoints                                                       |
| `CORS_ORIGINS`      | Allowed origins, same as current `mt5-service` config                                                 |
| `HISTORY_BAR_LIMIT` | Max bars kept per `ohlcv:history:*` key (default: `1000`)                                             |
| `MT5_SERVICE_MODE`  | `legacy` \| `dedicated-worker` — cutover feature flag (see [Section 12](#12-migration--cutover-plan)) |

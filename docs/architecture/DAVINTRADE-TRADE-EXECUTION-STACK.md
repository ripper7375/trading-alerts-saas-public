# DavinTrade — Trade Execution Stack Architecture

**Document Type:** Architecture Design Reference
**Status:** Planning (not yet implemented)
**Purpose:** Blueprint for future development of the trade execution stack in DavinTrade
**Reference Source:** Derived from study of `seed-code/ai-trading-agent`

---

## 1. Overview

DavinTrade is currently a **market analysis engine** — it identifies high-probability S/R zones using SSA, entropy, KDE heatmaps, and fractal clustering, but has no trade execution capability.

This document describes the architecture required to add **trade execution** to DavinTrade, allowing users to act on DavinTrade's analysis by placing real orders into MetaTrader 5 via their own broker accounts.

The design is based on the working implementation found in `seed-code/ai-trading-agent/mt5_bridge/`.

---

## 2. Full System Architecture

```
┌─────────────────────────────────────────────────────┐
│              User A (Browser / Phone)               │
└─────────────────────────┬───────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                  DavinTrade App                     │
│              (Vercel + Railway/cloud)               │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  Secrets Vault (Railway)                    │   │
│  │  Stores per-user:                           │   │
│  │    - MT5_BRIDGE_URL  (user's VPS address)   │   │
│  │    - X-Bridge-Key    (auth token)           │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Routes HTTP POST /order to correct bridge          │
│  based on authenticated user session               │
└──────────┬──────────────────────────┬──────────────┘
           │                          │
           │  HTTP POST /order        │  HTTP POST /order
           │  (X-Bridge-Key: userA)   │  (X-Bridge-Key: userB)
           ▼                          ▼
┌──────────────────────┐  ┌──────────────────────────┐
│  User A's            │  │  User B's                │
│  Windows VPS         │  │  Windows VPS             │
│  (e.g. Contabo)      │  │  (e.g. Hetzner)          │
│                      │  │                          │
│  ┌────────────────┐  │  │  ┌────────────────────┐  │
│  │ MT5 Bridge     │  │  │  │ MT5 Bridge         │  │
│  │ (FastAPI)      │  │  │  │ (FastAPI)          │  │
│  └───────┬────────┘  │  │  └────────┬───────────┘  │
│          │           │  │           │              │
│  ┌───────▼────────┐  │  │  ┌────────▼───────────┐  │
│  │ MT5 Python SDK │  │  │  │ MT5 Python SDK     │  │
│  │ mt5.order_send │  │  │  │ mt5.order_send     │  │
│  └───────┬────────┘  │  │  └────────┬───────────┘  │
│          │           │  │           │              │
│  ┌───────▼────────┐  │  │  ┌────────▼───────────┐  │
│  │ MT5 Terminal   │  │  │  │ MT5 Terminal       │  │
│  │ (must be       │  │  │  │ (must be           │  │
│  │  running here) │  │  │  │  running here)     │  │
│  └───────┬────────┘  │  │  └────────┬───────────┘  │
└──────────┼───────────┘  └───────────┼──────────────┘
           │                          │
           │  Broker protocol         │  Broker protocol
           ▼                          ▼
┌──────────────────────┐  ┌──────────────────────────┐
│  Broker X Server     │  │  Broker Y Server         │
│  User A's account    │  │  User B's account        │
└──────────────────────┘  └──────────────────────────┘
```

---

## 3. Component Descriptions

### 3.1 DavinTrade App (Vercel + Railway)

The existing DavinTrade frontend (Next.js on Vercel) and backend (Railway) extended with:

- **User authentication** — identifies which user is making the trade request
- **Secrets vault** — stores each user's `MT5_BRIDGE_URL` and `X-Bridge-Key` encrypted at rest
- **Trade router** — on receiving a trade request, looks up the user's bridge credentials and forwards the HTTP POST to the correct Windows VPS
- **LLM trade advice** — DavinTrade analysis (HMI/RPI/BPI scores, regime, S/R zones) feeds into an LLM to generate trade recommendations; user confirms before execution

### 3.2 MT5 Bridge (FastAPI on Windows VPS)

A lightweight FastAPI server running on each user's Windows VPS. This is the **only component that requires Windows** — everything else can run on Linux.

**Key endpoints:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | MT5 terminal connection status |
| `/tick/{symbol}` | GET | Current bid/ask price |
| `/ohlcv/{symbol}` | GET | Candlestick history |
| `/account` | GET | Balance, equity, free margin |
| `/positions` | GET | All open trades + P&L |
| `/order` | POST | Place BUY/SELL order |
| `/position/{ticket}` | PUT | Modify SL/TP |
| `/position/{ticket}` | DELETE | Close position |
| `/positions` | DELETE | Close all positions (emergency) |

**Authentication:** Every request (except `/health`) requires the `X-Bridge-Key` header matching the `BRIDGE_API_KEY` environment variable set on the VPS.

**Reference implementation:** `seed-code/ai-trading-agent/mt5_bridge/main.py`

### 3.3 MT5 Python SDK

The official `MetaTrader5` Python library. Must be installed on the **same Windows machine** as the MT5 Terminal.

Key calls used by the bridge:

```python
import MetaTrader5 as mt5

mt5.initialize(MT5_PATH)                              # connect to terminal
mt5.login(login, password=password, server=server)    # authenticate with broker
mt5.symbol_info_tick(symbol)                          # get current price
mt5.copy_rates_from_pos(symbol, tf, 0, count)         # get OHLCV
mt5.account_info()                                    # get account state
mt5.positions_get()                                   # get open positions
mt5.order_send(request)                               # place / close order
```

**Constraint:** The MetaTrader5 Python library is Windows-only. It cannot run on Linux or macOS. This is why a separate Windows VPS is required per user.

### 3.4 MT5 Terminal (MetaTrader 5 Application)

The standard MetaTrader 5 desktop application installed on the Windows VPS.

- Must be **running at all times** for the Python SDK to communicate with it
- Logged into the user's broker account (`login`, `password`, `server`)
- Connects to the broker's server using the broker's proprietary protocol
- The Python SDK communicates with the terminal **locally** (not over the internet)

### 3.5 Broker Server

The remote server operated by the broker (e.g. IC Markets, Pepperstone, XM).

- Users have **no direct access** to this server
- The MT5 Terminal connects to it using the broker's protocol
- Trade orders flow: MT5 Terminal → Broker Server → Market execution
- Different users can use **different brokers** — the architecture supports this

---

## 4. Windows VPS Requirements

Each user (or the platform operator on behalf of a user) needs a Windows VPS with the following:

| Requirement | Details |
|---|---|
| **OS** | Windows Server 2019/2022 or Windows 10/11 |
| **MT5 Terminal** | Installed and logged into user's broker account |
| **Python 3.10+** | For the MT5 Python SDK and MT5 Bridge |
| **MetaTrader5 package** | `pip install MetaTrader5` |
| **MT5 Bridge** | FastAPI server from `seed-code/ai-trading-agent/mt5_bridge/` |
| **Port open** | The bridge port (default 8001) accessible from Railway |
| **Auto-start** | MT5 Terminal and MT5 Bridge set to start on boot |
| **VPS providers** | Contabo, Hetzner, AWS Windows, Azure Windows |

### Environment Variables on the VPS

```env
MT5_LOGIN=12345678            # broker account login number
MT5_PASSWORD=yourpassword     # broker account password
MT5_SERVER=ICMarkets-Live     # broker server name (shown in MT5)
MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe
BRIDGE_API_KEY=random-secret-key-here   # must match X-Bridge-Key sent from Railway
```

---

## 5. Per-User Secrets Stored in DavinTrade Vault

For each registered user, DavinTrade's secrets vault stores:

| Secret Key | Value | Description |
|---|---|---|
| `MT5_BRIDGE_URL` | `http://[vps-ip]:8001` | Address of user's MT5 Bridge |
| `MT5_BRIDGE_KEY` | `[random secret]` | X-Bridge-Key for authentication |
| `MT5_BROKER_NAME` | `IC Markets` | Display label only |
| `MT5_ACCOUNT_LOGIN` | `12345678` | For display/reference only |

The vault encrypts all values at rest using AES-256-GCM (reference: `seed-code/ai-trading-agent/backend/app/vault.py`).

---

## 6. Trade Request Flow (Step by Step)

```
1. User views DavinTrade dashboard
      │
      │  DavinTrade shows S/R zones, BPI score, regime state
      ▼
2. LLM generates trade advice
      │  "XAUUSD approaching strong resistance at 2345.
      │   BPI = 72, regime = Trending. Suggested: SELL 0.1 lot
      │   SL = 2355, TP = 2320"
      ▼
3. User reviews and confirms trade
      │
      ▼
4. DavinTrade backend (Railway) receives confirmed trade request
      │
      │  Looks up user's MT5_BRIDGE_URL and MT5_BRIDGE_KEY
      │  from secrets vault
      ▼
5. Railway sends HTTP POST /order to user's Windows VPS
      │
      │  POST http://[user-vps-ip]:8001/order
      │  Headers: X-Bridge-Key: [user's bridge key]
      │  Body: { symbol, type, lot, sl, tp, comment }
      ▼
6. MT5 Bridge (FastAPI on VPS) receives request
      │
      │  Validates X-Bridge-Key
      │  Gets current tick price from MT5
      ▼
7. MT5 Python SDK places order
      │
      │  mt5.order_send({ action: TRADE_ACTION_DEAL,
      │                   symbol, volume, type,
      │                   price, sl, tp, ... })
      ▼
8. MT5 Terminal sends order to broker
      │
      ▼
9. Broker Server executes order
      │
      │  Returns: ticket number, fill price, status
      ▼
10. Result propagates back to DavinTrade UI
       │
       │  User sees: "Order filled: SELL 0.1 XAUUSD @ 2344.5
       │              Ticket #123456, SL=2355, TP=2320"
```

---

## 7. VPS Ownership Model

The architecture supports two models — both are technically identical:

### Model A: Platform Operator Rents VPS (on behalf of users)

```
DavinTrade operator rents Windows VPS for each user
    → Sets up MT5 Terminal + Bridge for each user
    → Manages credentials centrally
    → Users do not need to manage any infrastructure
```

**Pros:** Better user experience, centrally managed
**Cons:** Operator bears VPS cost, responsible for uptime

### Model B: Users Rent Their Own VPS

```
Each user rents their own Windows VPS independently
    → User installs MT5 Terminal + Bridge themselves
    → User provides their MT5_BRIDGE_URL and X-Bridge-Key to DavinTrade
    → DavinTrade stores these in vault and routes accordingly
```

**Pros:** User has full control, cost stays with user
**Cons:** Requires user technical setup, harder to support

---

## 8. What Needs to Be Built in DavinTrade

The following components are **not yet implemented** and must be built:

### 8.1 User Authentication
- Login/registration system (currently absent in DavinTrade)
- Session management
- Per-user data isolation
- Reference: `seed-code/ai-trading-agent/backend/app/auth_webauthn.py`

### 8.2 Secrets Vault
- AES-256-GCM encrypted storage for per-user MT5 bridge credentials
- UI for users to enter and test their bridge connection
- Reference: `seed-code/ai-trading-agent/backend/app/vault.py`

### 8.3 MT5 Bridge (Windows VPS component)
- FastAPI server to deploy on each user's Windows VPS
- Full implementation already exists and is ready to use
- Reference: `seed-code/ai-trading-agent/mt5_bridge/main.py`

### 8.4 Trade Router (Railway backend)
- Receives confirmed trade requests from DavinTrade frontend
- Looks up user's bridge credentials from vault
- Forwards HTTP POST to the correct Windows VPS
- Returns execution result to frontend

### 8.5 LLM Trade Advice Integration
- Passes DavinTrade analysis outputs (HMI, RPI, BPI, regime, S/R zones) to Claude
- Claude generates trade recommendation with symbol, direction, lot, SL, TP
- User confirmation step before any order is sent
- Reference: `seed-code/ai-trading-agent/backend/mcp_server/` for MCP tool pattern

### 8.6 Guardrails (Optional but Recommended)
- Hard limits enforced before any order reaches the bridge
- Max lot, daily loss limit, max concurrent trades, min time between trades
- Reference: `seed-code/ai-trading-agent/backend/mcp_server/guardrails.py`

### 8.7 Rollout Mode (Optional but Recommended)
- Shadow → Paper → Micro → Live progression
- Allows safe testing before real money trades
- Reference: `seed-code/ai-trading-agent/backend/mcp_server/guardrails.py` (Phase F)

---

## 9. Reference Files in seed-code/ai-trading-agent

| File | What to study |
|---|---|
| `mt5_bridge/main.py` | Complete MT5 Bridge implementation (ready to deploy) |
| `backend/app/vault.py` | Secrets vault (AES-256-GCM) |
| `backend/app/auth_webauthn.py` | Passkey authentication |
| `backend/mcp_server/guardrails.py` | Hard trading limits |
| `backend/mcp_server/tools/broker.py` | Guardrail-gated order execution |
| `backend/app/risk/manager.py` | Position sizing + SL/TP calculation |
| `backend/app/risk/circuit_breaker.py` | Per-symbol daily loss breaker |
| `backend/app/mt5/connector.py` | HTTP client that calls the bridge |

---

## 10. Key Constraints Summary

| Constraint | Detail |
|---|---|
| MT5 Python SDK is Windows-only | Cannot run on Linux/macOS — requires Windows VPS |
| MT5 Terminal must be on same machine as SDK | SDK communicates with terminal locally, not over network |
| Users cannot access broker server directly | Broker server is broker infrastructure — no SSH/install access |
| One MT5 Terminal = one broker account | Each user needs their own terminal instance logged into their account |
| Bridge must be reachable from Railway | VPS firewall must allow inbound on bridge port (default 8001) |
| MT5 Terminal must stay running | If terminal closes, SDK loses connection and orders cannot be placed |

---

*Document created: 2026-04-14*
*Based on: Study of seed-code/ai-trading-agent and architecture discussion*
*Next step: Implement components listed in Section 8 when trade execution development begins*

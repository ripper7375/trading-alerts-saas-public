# MT5 Terminal Mapping Strategy

## Overview

To support PRO tier (15 symbols × 9 timeframes = 135 chart combinations), we use **15 separate MT5 terminals**, each dedicated to a single symbol with all 9 timeframes.

## Architecture Benefits

✅ **Load Distribution:** 9 charts per terminal (instead of 135 on one terminal)
✅ **Fault Isolation:** If one MT5 crashes, only 1 symbol is affected
✅ **Performance:** Each terminal has dedicated resources
✅ **Scalability:** Easy to add more symbols = add more terminals

## Symbol-to-Terminal Mapping

| Terminal ID | Symbol | Broker Account | Charts (9 timeframes each)            |
| ----------- | ------ | -------------- | ------------------------------------- |
| MT5_01      | AUDJPY | Account 1      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_02      | AUDUSD | Account 2      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_03      | BTCUSD | Account 3      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_04      | ETHUSD | Account 4      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_05      | EURUSD | Account 5      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_06      | GBPJPY | Account 6      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_07      | GBPUSD | Account 7      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_08      | NDX100 | Account 8      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_09      | NZDUSD | Account 9      | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_10      | US30   | Account 10     | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_11      | USDCAD | Account 11     | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_12      | USDCHF | Account 12     | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_13      | USDJPY | Account 13     | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_14      | XAGUSD | Account 14     | M5, M15, M30, H1, H2, H4, H8, H12, D1 |
| MT5_15      | XAUUSD | Account 15     | M5, M15, M30, H1, H2, H4, H8, H12, D1 |

## Deployment Options

### Option 1: Single VPS with 15 MT5 Instances (RECOMMENDED for Development)

**Pros:**

- Single machine to manage
- Lower cost (one VPS)
- Simpler network configuration

**Cons:**

- Requires powerful VPS (32GB+ RAM, 8+ cores)
- Single point of failure (hardware level)

**Estimated VPS Requirements:**

- **RAM:** 32GB minimum (15 MT5 × ~1.5GB each + OS + Flask)
- **CPU:** 8 cores minimum (15 MT5 instances)
- **Storage:** 100GB SSD
- **OS:** Windows Server 2019/2022

**Cost:** ~$80-120/month (Contabo, Hetzner, or OVH dedicated)

---

### Option 2: Multiple VPS (3 VPS × 5 MT5 each) - RECOMMENDED for Production

**Pros:**

- Fault tolerance (if one VPS fails, 10 symbols still work)
- Better resource distribution
- Easier to scale (add more VPS)

**Cons:**

- More expensive
- More complex deployment

**Configuration:**

- **VPS 1:** MT5_01-05 (AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD)
- **VPS 2:** MT5_06-10 (GBPJPY, GBPUSD, NDX100, NZDUSD, US30)
- **VPS 3:** MT5_11-15 (USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD)

**VPS Requirements (each):**

- **RAM:** 12GB
- **CPU:** 4 cores
- **Storage:** 50GB SSD
- **OS:** Windows Server 2019/2022

**Cost:** ~$120-180/month total (3 × $40-60)

---

### Option 3: Docker Containers (Advanced)

**Pros:**

- Maximum density
- Easy orchestration with Kubernetes
- Auto-scaling possible

**Cons:**

- MT5 on Docker is complex (Windows containers or Wine)
- Not officially supported by MetaTrader
- Requires advanced DevOps skills

**Not recommended** unless you have MT5 containerization experience.

---

## Flask Service Architecture

### Single Flask Service (RECOMMENDED)

The Flask service runs **once** and manages connections to all 15 MT5 terminals.

**Connection Flow:**

```
1. Client Request: GET /api/indicators/XAUUSD/H1
2. Flask Router: Extracts symbol "XAUUSD"
3. Connection Manager: Looks up MT5 connection for XAUUSD → MT5_15
4. Indicator Reader: Fetches data from MT5_15
5. Response: Returns indicator data to client
```

**Deployment:**

- **Option A:** Flask on same VPS as MT5 terminals (if using Option 1)
- **Option B:** Flask on Railway, connects to VPS(s) via IP (if using Option 2/3)

---

## Environment Variables

### Flask Service Configuration

```bash
# MT5 Connection Pool Configuration
# Each MT5 terminal has: server, login, password, path (for local connections)

# MT5 Terminal 1 - AUDJPY
MT5_01_SERVER=broker.server.com
MT5_01_LOGIN=12345678
MT5_01_PASSWORD=SecurePassword1
MT5_01_SYMBOL=AUDJPY
MT5_01_HOST=localhost  # Or VPS IP if remote
MT5_01_PORT=18812      # MetaTrader Manager API port (if using remote connection)

# MT5 Terminal 2 - AUDUSD
MT5_02_SERVER=broker.server.com
MT5_02_LOGIN=12345679
MT5_02_PASSWORD=SecurePassword2
MT5_02_SYMBOL=AUDUSD
MT5_02_HOST=localhost
MT5_02_PORT=18813

# ... (repeat for MT5_03 through MT5_15)

# MT5 Terminal 15 - XAUUSD
MT5_15_SERVER=broker.server.com
MT5_15_LOGIN=12345692
MT5_15_PASSWORD=SecurePassword15
MT5_15_SYMBOL=XAUUSD
MT5_15_HOST=localhost
MT5_15_PORT=18826

# Flask Service
FLASK_ENV=production
FLASK_API_KEY=your_secure_api_key_here
```

### Simplified Configuration (JSON Config File)

Instead of 75 environment variables (15 terminals × 5 vars), use a JSON config file:

```json
{
  "mt5_terminals": [
    {
      "id": "MT5_01",
      "symbol": "AUDJPY",
      "server": "broker.server.com",
      "login": 12345678,
      "password": "SecurePassword1",
      "host": "localhost",
      "port": 18812
    },
    {
      "id": "MT5_02",
      "symbol": "AUDUSD",
      "server": "broker.server.com",
      "login": 12345679,
      "password": "SecurePassword2",
      "host": "localhost",
      "port": 18813
    }
    // ... 13 more entries
  ]
}
```

**Load in Flask:**

```python
import json

with open('config/mt5_config.json', 'r') as f:
    mt5_config = json.load(f)

# Build symbol → config mapping
SYMBOL_TO_MT5 = {
    terminal['symbol']: terminal
    for terminal in mt5_config['mt5_terminals']
}
```

---

## Health Monitoring

### Health Check Endpoint

```python
GET /api/health

Response:
{
  "status": "ok",
  "mt5_terminals": {
    "AUDJPY": { "connected": true, "terminal_id": "MT5_01", "last_check": "2025-11-17T10:30:00Z" },
    "AUDUSD": { "connected": true, "terminal_id": "MT5_02", "last_check": "2025-11-17T10:30:00Z" },
    "BTCUSD": { "connected": false, "terminal_id": "MT5_03", "last_check": "2025-11-17T10:30:00Z", "error": "Connection timeout" },
    ...
  },
  "total_connected": 14,
  "total_terminals": 15
}
```

### Automatic Reconnection

Flask service should:

1. Monitor connection health every 60 seconds
2. Auto-reconnect if terminal disconnects
3. Log connection issues
4. Alert admin if terminal offline for >5 minutes

---

## Broker Account Considerations

### Do you need 15 separate broker accounts?

**Option A: 15 Separate Accounts (SAFEST)**

- ✅ Complete isolation
- ✅ No interference between terminals
- ✅ Broker support per terminal
- ❌ More expensive (if broker charges per account)

**Option B: Same Account, Different Logins (if supported)**

- Some brokers allow "investor password" or "read-only" logins
- ✅ Cheaper (one main account)
- ⚠️ Check broker policies
- ⚠️ Not all brokers support this

**Option C: Demo Accounts (for Testing)**

- ✅ Free
- ✅ Real market data
- ⚠️ No real trading (fine for indicator data)

**RECOMMENDATION for Production:** Option A (15 separate accounts with minimal balance, just for data access)

---

## Network Architecture

### If Flask is on Railway and MT5 on VPS:

```
┌─────────────────────────────────────────────────────────────┐
│  RAILWAY (Flask Service)                                    │
│  Public IP: Assigned by Railway                             │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  VPS (Windows Server)                                       │
│  Public IP: 203.0.113.45 (example)                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  15 MT5 Terminals (localhost ports 18812-18826)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  MetaTrader Manager API or Python Bridge             │  │
│  │  - Exposes ports 18812-18826                          │  │
│  │  - Flask connects via IP:PORT                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Connection Method:**

- **Local (same machine):** `MetaTrader5.initialize()` (Python library)
- **Remote (Flask on Railway):** Use MetaTrader Manager API or custom bridge service

**Challenge:** The `MetaTrader5` Python package only works when running on the same machine as MT5 terminal.

**Solution:**

1. Run Flask service **on the same VPS** as MT5 terminals (NOT on Railway)
2. OR use a **bridge service** on VPS that Flask calls via HTTP

---

## Recommendation Summary

### For Development/MVP:

- ✅ **Option 1:** Single VPS with 15 MT5 instances
- ✅ Flask service on same VPS
- ✅ Use JSON config file for terminal mapping
- ✅ 5 demo accounts (reuse each account for 3 symbols)

**Cost:** ~$80/month VPS

### For Production:

- ✅ **Option 2:** 3 VPS with 5 MT5 instances each
- ✅ Flask service on VPS 1 (or separate small VPS)
- ✅ 15 separate broker accounts (minimal balance)
- ✅ Health monitoring + auto-reconnect
- ✅ Alerts for connection failures

**Cost:** ~$150-200/month (VPS + broker accounts)

---

## Next Steps

1. **Choose deployment option** (Option 1 or 2)
2. **Provision VPS(s)** (Windows Server with RDP access)
3. **Install 15 MT5 terminals** (use different data directories)
4. **Configure broker accounts**
5. **Modify Flask service** (see implementation guide below)
6. **Test connection to each terminal**
7. **Deploy and monitor**

---

**Last Updated:** 2025-11-17
**Version:** 1.0.0

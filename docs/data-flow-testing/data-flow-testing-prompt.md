# Comprehensive Data Flow Testing Plan - MT5 to PostgreSQL/Redis

**Prompt for Claude Code (Web)**

---

## Context

I'm implementing Part 20 of Trading Alerts SaaS - a complete migration from Flask MT5 service (Part 6) to direct PostgreSQL access with SQLite buffer.

**Current Status:**

- ✅ Staging environment tested (Railway PostgreSQL + Redis, Vercel deployment)
- ✅ Sync script code created (in `/sync` folder - see attached image)
- ✅ PostgreSQL has 162 tables (26 app + 136 indicator tables)
- ✅ Redis connection tested successfully
- ❌ **NOT YET:** Contabo VPS setup, MT5 installation, real data flow testing

**Architecture:**

```
MT5 Terminals (×15 on Contabo VPS)
  ↓ DataCollector.mq5 (MQL5 Service)
SQLite Buffer (C:\MT5Data\trading_data.db)
  ↓ Sync Script (Python - every 30 sec)
Railway PostgreSQL (162 tables)
  ↓ (Optional caching)
Railway Redis
  ↓ API queries
Vercel Next.js (Chart display)
```

---

## Your Task

Create a **comprehensive, step-by-step testing plan** that covers:

1. **Contabo VPS Setup** (Windows Server)
2. **MT5 Installation & Configuration**
3. **Indicator Installation** (custom .ex5 files)
4. **DataCollector.mq5 Deployment**
5. **SQLite Database Setup**
6. **Sync Script Deployment**
7. **End-to-End Data Flow Testing**
8. **Redis Caching Integration Testing**

---

## Part 1: Contabo VPS Setup Guide

### What I Need

**Create a document:** `contabo-vps-setup-guide.md`

Include:

#### 1.1 Contabo Account Registration

- Where to register: https://contabo.com
- Which plan to choose (VPS S or M for MT5 terminals)
- Operating system: Windows Server 2019/2022
- Expected costs
- Payment methods

#### 1.2 VPS Access Setup

- How to get RDP credentials
- How to connect via Remote Desktop (Windows)
- Initial Windows Server configuration
- Firewall rules needed (allow Railway PostgreSQL/Redis connections)

#### 1.3 Required Software Installation

- Python 3.8+ installation
- Git installation (optional, for version control)
- 7-Zip or WinRAR (for extracting files)
- Text editor (Notepad++ or VS Code)

#### 1.4 Directory Structure

```
C:\
├── MT5Data\
│   └── trading_data.db (will be created by DataCollector)
├── Scripts\
│   └── sync_package\
│       ├── __init__.py
│       ├── config.py
│       ├── db_connections.py
│       ├── sync_to_postgresql.py
│       ├── timeframe_filter.py
│       └── requirements.txt
└── Program Files\
    └── MetaTrader 5\ (×15 installations)
```

---

## Part 2: MT5 Installation & Configuration Guide

### What I Need

**Create a document:** `mt5-installation-guide.md`

Include:

#### 2.1 Download MT5

- Where to download from broker
- Installation process (silent install for multiple instances)
- How to install 15 separate MT5 instances

#### 2.2 MT5 Account Configuration

**I have an MT5 account credentials:**

- Login: [I will provide]
- Password: [I will provide]
- Server: [I will provide]

**Guide should cover:**

- How to configure each MT5 instance with account
- How to name each instance (MT5_EURUSD, MT5_BTCUSD, etc.)
- How to enable "Allow automated trading"
- How to enable "Allow DLL imports"

#### 2.3 Symbol Configuration

**15 Symbols to monitor:**

- AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD
- GBPJPY, GBPUSD, NDX100, NZDUSD, US30
- USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD

**Guide should cover:**

- How to add symbols to Market Watch
- How to verify symbol data is available
- How to check if broker provides all symbols

#### 2.4 Timeframe Configuration

**9 Timeframes to collect:**

- M5, M15, M30, H1, H2, H4, H8, H12, D1

---

## Part 3: Indicator Installation Guide

### What I Need

**Create a document:** `indicator-installation-guide.md`

Include:

#### 3.1 Required Indicators (.ex5 files)

I need to install these custom indicators (I have the .ex5 files):

1. **Fractal Horizontal Line_V5.ex5**
2. **Fractal Diagonal Line_V4.ex5**
3. **Body Size Momentum Candle_V2.ex5**
4. **Keltner Channel_ATF_10 Bands.ex5**
5. **TEMA_HRMA_SMA-SMMA_Modified Buffers.ex5**
6. **ZigZagColor & MarketStructure_JSON Export_V27_TXT Input.ex5**

#### 3.2 Installation Steps

- Where to place .ex5 files (`C:\Users\...\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL5\Indicators\`)
- How to find the correct Terminal folder for each MT5 instance
- How to verify indicators are loaded
- How to attach indicators to charts (if needed)

#### 3.3 Indicator Testing

- How to verify each indicator is calculating correctly
- How to check indicator buffers are accessible
- Common errors and troubleshooting

---

## Part 4: DataCollector.mq5 Deployment Guide

### What I Need

**Create a document:** `datacollector-deployment-guide.md`

#### 4.1 DataCollector.mq5 Overview

**I have this file:** `DataCollector.mq5` (MQL5 Service)

**What it does:**

- Runs 24/7 without chart window (it's a SERVICE, not EA)
- Reads indicator buffers from all 6 custom indicators
- Collects OHLC + indicator data every 30 seconds
- Stores data in SQLite (`C:\MT5Data\trading_data.db`)
- Creates one table per symbol (lowercase: `eurusd`, `btcusd`, etc.)

**Reference:** See attached `DataCollector.mq5` code in our conversation history

#### 4.2 Compilation & Deployment

- How to compile .mq5 to .ex5
- Where to place compiled .ex5 file
- How to install in all 15 MT5 instances

#### 4.3 Service Configuration

**Input Parameters:**

```mql5
input int    CollectionInterval = 30;  // 30 seconds
input string DatabasePath = "C:\\MT5Data\\trading_data.db";
input string SymbolToMonitor = "";     // Empty = use chart symbol
input int    BufferSize = 100;
input bool   EnableLogging = true;
```

- How to configure for each symbol
- How to set correct database path

#### 4.4 Starting the Service

- How to start service via: Tools → Services → DataCollector
- How to verify service is running
- How to check logs
- How to monitor for errors

#### 4.5 SQLite Database Verification

- How to verify `C:\MT5Data\trading_data.db` was created
- How to check tables exist (15 tables: audjpy, audusd, btcusd, etc.)
- How to verify data is being written every 30 seconds
- Using SQLite CLI or DB Browser for SQLite

**Expected table structure:**

```sql
CREATE TABLE eurusd (
  timestamp INTEGER PRIMARY KEY,
  open REAL, high REAL, low REAL, close REAL,
  fractals TEXT, horizontal_trendlines TEXT,
  diagonal_trendlines TEXT, momentum_candles TEXT,
  keltner_channels TEXT, tema REAL, hrma REAL,
  smma REAL, zigzag TEXT
);
```

---

## Part 5: Sync Script Deployment Guide

### What I Need

**Create a document:** `sync-script-deployment-guide.md`

#### 5.1 Sync Package Files

**I have these files** (in `/sync` folder):

- `__init__.py`
- `config.py` (with lowercase symbols and timeframes)
- `db_connections.py`
- `sync_to_postgresql.py`
- `timeframe_filter.py`
- `requirements.txt`
- `run_sync.ps1` (Windows Task Scheduler wrapper)
- `setup-sync-package.ps1` (automated setup)

#### 5.2 Environment Configuration

**Railway credentials needed:**

```
POSTGRESQL_URI=postgresql://postgres:PASSWORD@turntable.proxy.rlwy.net:55082/railway
REDIS_URL=redis://default:PASSWORD@switchyard.proxy.rlwy.net:47725
SQLITE_PATH=C:\MT5Data\trading_data.db
```

- How to create `.env` file
- How to set environment variables
- Security best practices

#### 5.3 Dependency Installation

```powershell
cd C:\Scripts\sync_package
pip install -r requirements.txt
```

- Verify psycopg2-binary installed
- Verify python-dotenv installed

#### 5.4 Manual Test Run

```powershell
cd C:\Scripts\sync_package
python sync_to_postgresql.py
```

**What to expect:**

- Script connects to SQLite
- Script connects to PostgreSQL
- For each symbol (15 total):
  - Reads new rows from SQLite
  - Filters into 9 timeframe tables
  - Inserts to PostgreSQL
- Creates `sync_state.json` (tracks last synced timestamp)
- Logs to `sync.log`

#### 5.5 Windows Task Scheduler Setup

**Using automated setup:**

```powershell
cd C:\Scripts
.\setup-sync-package.ps1
```

**OR manual Task Scheduler setup:**

- Create task to run every 30 seconds
- Run as SYSTEM account
- Use `run_sync.ps1` wrapper
- Configure logging

#### 5.6 Monitoring

- How to check `sync.log` for errors
- How to verify `sync_state.json` is updating
- How to monitor Windows Task Scheduler

---

## Part 6: End-to-End Data Flow Testing Plan

### What I Need

**Create a document:** `e2e-testing-plan.md`

Include a **comprehensive testing checklist**:

#### 6.1 Pre-Test Verification

**Contabo VPS:**

- [ ] Windows Server accessible via RDP
- [ ] Python 3.8+ installed and working
- [ ] 15 MT5 instances installed
- [ ] All 6 custom indicators installed in each instance
- [ ] DataCollector.mq5 compiled and installed
- [ ] SQLite database directory created (`C:\MT5Data\`)

**Railway Infrastructure:**

- [ ] PostgreSQL online and accessible
- [ ] Redis online and accessible
- [ ] 162 tables exist in PostgreSQL
- [ ] Connection strings tested from local machine

**Sync Script:**

- [ ] All files in `C:\Scripts\sync_package\`
- [ ] Dependencies installed
- [ ] Environment variables configured
- [ ] Manual test run successful

#### 6.2 Test Scenario 1: Single Symbol End-to-End (15 minutes)

**Goal:** Verify complete data flow for EURUSD

**Steps:**

1. Start DataCollector service in MT5_EURUSD instance
2. Wait 2 minutes for data collection
3. Verify SQLite has data:
   ```powershell
   sqlite3 C:\MT5Data\trading_data.db "SELECT COUNT(*) FROM eurusd;"
   # Should show 4 rows (2 min / 30 sec = 4 cycles)
   ```
4. Run sync script manually:
   ```powershell
   python sync_to_postgresql.py
   ```
5. Verify PostgreSQL has data:
   ```powershell
   psql $env:POSTGRESQL_URI -c "SELECT COUNT(*) FROM eurusd_h1;"
   # Should show new rows
   ```
6. Check all 9 timeframe tables:
   ```powershell
   psql $env:POSTGRESQL_URI -c "
   SELECT 'eurusd_m5', COUNT(*) FROM eurusd_m5
   UNION ALL SELECT 'eurusd_m15', COUNT(*) FROM eurusd_m15
   ... [all 9 timeframes]
   "
   ```
7. Verify timeframe filtering worked correctly

**Success Criteria:**

- ✅ SQLite shows increasing rows every 30 seconds
- ✅ PostgreSQL receives data after sync
- ✅ Data correctly filtered into 9 timeframe tables
- ✅ OHLC values match between SQLite and PostgreSQL
- ✅ JSON fields (fractals, trendlines, etc.) are valid

#### 6.3 Test Scenario 2: Multiple Symbols (30 minutes)

**Goal:** Verify all 15 symbols working simultaneously

**Steps:**

1. Start DataCollector service in all 15 MT5 instances
2. Wait 5 minutes
3. Verify SQLite has 15 tables with data
4. Run sync script
5. Verify PostgreSQL has data in 135 tables (15 symbols × 9 timeframes)
6. Check for any sync errors in `sync.log`

**Success Criteria:**

- ✅ All 15 symbols collecting data to SQLite
- ✅ All 135 PostgreSQL tables receiving data
- ✅ No errors in sync logs
- ✅ sync_state.json tracking all 15 symbols

#### 6.4 Test Scenario 3: Automatic Sync (60 minutes)

**Goal:** Verify Windows Task Scheduler runs sync automatically

**Steps:**

1. Ensure DataCollector services running in all MT5 instances
2. Start Windows Task Scheduler task
3. Monitor for 1 hour
4. Check sync.log every 10 minutes
5. Verify PostgreSQL row counts increasing

**Success Criteria:**

- ✅ Task runs every 30 seconds automatically
- ✅ No task failures in Task Scheduler
- ✅ sync.log shows regular cycles
- ✅ PostgreSQL data continuously increasing
- ✅ No gaps in data collection

#### 6.5 Test Scenario 4: Failure Recovery (30 minutes)

**Goal:** Verify system handles failures gracefully

**Test 4a: Network Interruption**

1. Disable network on Contabo VPS (5 minutes)
2. DataCollector continues writing to SQLite
3. Re-enable network
4. Verify sync script catches up

**Test 4b: PostgreSQL Unavailable**

1. Stop PostgreSQL service on Railway (2 minutes)
2. Sync script should retry and log errors
3. Restart PostgreSQL
4. Verify sync resumes and catches up

**Test 4c: MT5 Service Crash**

1. Stop DataCollector service
2. Verify sync script doesn't crash (no new data)
3. Restart DataCollector
4. Verify data collection resumes

**Success Criteria:**

- ✅ SQLite acts as reliable buffer during outages
- ✅ No data loss during network interruptions
- ✅ Sync script retries on failure
- ✅ System auto-recovers when services restore

#### 6.6 Test Scenario 5: Data Integrity (30 minutes)

**Goal:** Verify data accuracy end-to-end

**Steps:**

1. Pick a specific timestamp (e.g., 2026-01-08 12:00:00 UTC)
2. Query SQLite for EURUSD at that time:
   ```sql
   SELECT * FROM eurusd WHERE timestamp = 1704715200;
   ```
3. Query PostgreSQL eurusd_h1 for same timestamp:
   ```sql
   SELECT * FROM eurusd_h1 WHERE timestamp = '2026-01-08 12:00:00+00';
   ```
4. Compare OHLC values exactly match
5. Compare JSON fields (fractals, trendlines) match exactly
6. Verify no data corruption

**Success Criteria:**

- ✅ OHLC values identical
- ✅ JSON fields identical
- ✅ No data corruption or truncation
- ✅ Timestamps correctly converted (Unix → PostgreSQL)

---

## Part 7: Redis Caching Integration Testing

### What I Need

**Create a document:** `redis-caching-testing-plan.md`

#### 7.1 Redis Configuration Verification

**Steps:**

1. Verify Redis connection from Contabo VPS:
   ```powershell
   redis-cli -u $env:REDIS_URL PING
   # Expected: PONG
   ```
2. Verify Vercel app has REDIS_URL environment variable
3. Test Redis write/read from Vercel app

#### 7.2 API Caching Test (Manual)

**Goal:** Verify Redis caching reduces PostgreSQL load

**Steps:**

1. Clear Redis cache:
   ```powershell
   redis-cli -u $env:REDIS_URL FLUSHDB
   ```
2. First API call (should hit PostgreSQL):
   ```powershell
   Measure-Command {
     Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
   }
   # Note the time (e.g., 200ms)
   ```
3. Second API call (should hit Redis cache):
   ```powershell
   Measure-Command {
     Invoke-RestMethod "https://your-app.vercel.app/api/indicators/EURUSD/H1"
   }
   # Should be much faster (e.g., 20ms)
   ```
4. Check response metadata:
   ```json
   {
     "success": true,
     "data": { ... },
     "metadata": {
       "data_source": "cache" or "postgresql"
     }
   }
   ```

**Success Criteria:**

- ✅ First call: `data_source: "postgresql"`, slower
- ✅ Second call (within 30s): `data_source: "cache"`, faster
- ✅ After 30s: Cache expires, fetches from PostgreSQL again

#### 7.3 Cache Invalidation Test

**Goal:** Verify cache invalidates when new data synced

**Steps:**

1. Query API for EURUSD/H1 → cached
2. Wait for sync cycle (30 seconds)
3. Query API again → should fetch fresh data from PostgreSQL
4. Verify new data is different (newer timestamp)

**Success Criteria:**

- ✅ Cache invalidates after sync
- ✅ API returns fresh data after sync
- ✅ No stale data served

#### 7.4 Redis Failover Test

**Goal:** Verify app works even if Redis is down

**Steps:**

1. Stop Redis service on Railway
2. Query API → should fallback to PostgreSQL
3. Verify no errors returned to user
4. Restart Redis
5. Verify caching resumes

**Success Criteria:**

- ✅ API continues working without Redis
- ✅ Graceful degradation (no user-facing errors)
- ✅ Auto-recovery when Redis comes back

---

## Part 8: Performance Testing

### What I Need

**Create a document:** `performance-testing-plan.md`

#### 8.1 Data Collection Performance

**Metrics to measure:**

- Time for DataCollector to collect 1 cycle (all indicators)
- SQLite write performance
- Memory usage of DataCollector service
- CPU usage during collection

**Tools:** Windows Performance Monitor, MT5 logs

#### 8.2 Sync Performance

**Metrics to measure:**

- Time to sync 1 symbol (15 rows → 9 tables)
- Time to sync all 15 symbols
- PostgreSQL insert performance
- Network bandwidth usage

**Target:** Complete sync of all symbols < 5 seconds

#### 8.3 API Performance

**Metrics to measure:**

- PostgreSQL query time (without cache)
- Redis query time (with cache)
- API response time (end-to-end)
- Concurrent request handling

**Target:**

- PostgreSQL: < 200ms
- Redis: < 20ms
- API: < 250ms (cached), < 300ms (uncached)

#### 8.4 Load Testing

**Simulate:**

- 100 concurrent users
- Each requesting different symbol/timeframe
- Sustained for 10 minutes

**Verify:**

- No errors
- Response times stay within targets
- PostgreSQL connection pool doesn't exhaust
- Redis memory usage stays reasonable

---

## Part 9: Monitoring & Alerting Setup

### What I Need

**Create a document:** `monitoring-setup-guide.md`

#### 9.1 Contabo VPS Monitoring

**What to monitor:**

- DataCollector service status (all 15 instances)
- Sync script Windows Task status
- SQLite database size
- Disk space usage
- CPU/Memory usage

**How to monitor:**

- Windows Event Viewer for errors
- Task Scheduler history
- PowerShell scripts to check service status

#### 9.2 Railway Monitoring

**What to monitor:**

- PostgreSQL connection count
- PostgreSQL database size
- Redis memory usage
- Redis connection count

**How to monitor:**

- Railway dashboard metrics
- PostgreSQL queries:
  ```sql
  SELECT pg_database_size('railway') / 1024 / 1024 as size_mb;
  SELECT count(*) FROM pg_stat_activity;
  ```

#### 9.3 Vercel Monitoring

**What to monitor:**

- API response times
- Error rates
- Cache hit rates

**How to monitor:**

- Vercel Analytics dashboard
- Custom logging in API routes

#### 9.4 Alert Setup

**Create alerts for:**

- DataCollector service stopped (any instance)
- Sync script hasn't run for > 2 minutes
- PostgreSQL connection errors
- Redis connection errors
- API error rate > 5%
- Disk space < 20% free

---

## Part 10: Documentation & Runbooks

### What I Need

**Create a document:** `operational-runbooks.md`

#### 10.1 Daily Operations Checklist

**Morning check:**

- [ ] All 15 DataCollector services running
- [ ] Sync task running successfully
- [ ] No errors in sync.log (last 24h)
- [ ] PostgreSQL data increasing normally
- [ ] Redis cache working

#### 10.2 Common Issues & Solutions

**Issue 1: DataCollector service stopped**

- How to identify
- How to restart
- How to check logs
- How to prevent

**Issue 2: Sync script failing**

- Common error messages
- How to debug
- How to manually recover
- How to test connection

**Issue 3: PostgreSQL connection issues**

- How to test connection
- How to check Railway status
- How to verify credentials
- How to recover

**Issue 4: Redis cache not working**

- How to test Redis
- How to clear cache
- How to disable caching temporarily
- How to verify cache hits

#### 10.3 Disaster Recovery Procedures

**Scenario 1: Contabo VPS failure**

- SQLite backup strategy
- How to restore on new VPS
- How to resume data collection

**Scenario 2: PostgreSQL data corruption**

- How to identify
- How to restore from backup
- How to resync from SQLite

**Scenario 3: Complete data loss**

- How to rebuild from scratch
- Time estimate
- Data recovery options

---

## Part 11: Cost Estimation

### What I Need

**Create a document:** `infrastructure-costs.md`

Calculate monthly costs for:

#### 11.1 Contabo VPS

- VPS plan selected
- Windows Server license
- Additional storage (if needed)

#### 11.2 Railway

- PostgreSQL usage
- Redis usage
- Data transfer
- Estimated based on 15 symbols × 9 timeframes × 24/7 collection

#### 11.3 Vercel

- Bandwidth
- Function invocations
- Build minutes

**Total estimated monthly cost:** $\_\_\_

---

## Part 12: Next Steps After Testing

### What I Need

**Create a document:** `post-testing-checklist.md`

#### After successful testing:

1. [ ] Archive old Flask infrastructure (Part 6)
2. [ ] Update documentation for team
3. [ ] Create backup/restore procedures
4. [ ] Set up automated monitoring
5. [ ] Schedule regular maintenance windows
6. [ ] Document any deviations from plan
7. [ ] Create handover documentation

---

## Deliverables Summary

Please create these 12 documents:

1. ✅ `contabo-vps-setup-guide.md`
2. ✅ `mt5-installation-guide.md`
3. ✅ `indicator-installation-guide.md`
4. ✅ `datacollector-deployment-guide.md`
5. ✅ `sync-script-deployment-guide.md`
6. ✅ `e2e-testing-plan.md`
7. ✅ `redis-caching-testing-plan.md`
8. ✅ `performance-testing-plan.md`
9. ✅ `monitoring-setup-guide.md`
10. ✅ `operational-runbooks.md`
11. ✅ `infrastructure-costs.md`
12. ✅ `post-testing-checklist.md`

---

## Important Notes

- **I don't have Contabo yet** - need registration guidance
- **I have MT5 account credentials** - will provide when needed
- **I have all indicator .ex5 files** - ready to install
- **I have DataCollector.mq5 source** - needs compilation
- **I have sync script files** - in `/sync` folder (see image)
- **Railway credentials available** - PostgreSQL & Redis tested

---

## Success Criteria

The testing is **COMPLETE** when:

1. ✅ All 15 MT5 instances collecting data to SQLite
2. ✅ Sync script syncing data to 135 PostgreSQL tables
3. ✅ Windows Task running sync every 30 seconds
4. ✅ Redis caching API responses
5. ✅ Charts displaying real MT5 data in production
6. ✅ System running stable for 24 hours
7. ✅ No data loss or corruption
8. ✅ All monitoring in place

---

## Format Requirements

- Use markdown with clear headings
- Include code blocks for all commands
- Add screenshots placeholders where helpful
- Include troubleshooting sections
- Provide time estimates for each step
- Add success criteria for each section
- Use checklists where appropriate

---

Thank you! These documents will guide me through the complete setup and testing of the Part 20 migration.

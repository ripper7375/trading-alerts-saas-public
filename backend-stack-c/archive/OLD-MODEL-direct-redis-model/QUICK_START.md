# v2.24 Quick Start Guide

## 🚀 Deployment in 5 Steps

### Step 1: Configure Redis

Edit `SimpleDataCollector_Modified_v2_24_PRODUCTION.mq5`:

```cpp
input string RedisURL = "https://your-redis.upstash.io";
input string RedisToken = "YOUR_TOKEN_HERE";
```

Get from: https://console.upstash.com/

### Step 2: Configure Symbols

```cpp
// Terminal 1
input string SymbolsList = "EURUSD,GBPUSD,USDJPY";

// Terminal 2
input string SymbolsList = "XAUUSD,XAGUSD,WTIUSD";

// ... etc (5 terminals total)
```

### Step 3: Compile & Attach EA

1. Copy `.mq5` file to MT5's `MQL5/Experts/` folder
2. Compile in MetaEditor (F7)
3. Drag EA to any chart (timeframe doesn't matter)
4. Check "Allow DLL imports" and "Allow WebRequest"
5. Add URL to allowed list: `https://your-redis.upstash.io`

### Step 4: Verify Collection

Check MT5 Experts log:

```
=== Symbol Detection ===
✓ [1] EURUSD → EURUSD.i (db: eurusd)
✓ [2] GBPUSD → GBPUSD.i (db: gbpusd)
✓ [3] USDJPY → USDJPY.i (db: usdjpy)
========================

✓ All indicators loaded successfully
✓ All databases connected successfully
✓ Redis connection verified

=== Collection Statistics ===
Redis Success: 135
Redis Failures: 0
SQLite Backups: 0
Redis Success Rate: 100.00%
============================
```

### Step 5: Run Python Backfill Worker

```bash
# On Contabo VPS
cd C:\Scripts
python backfill_worker.py
```

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────┐
│ CONTABO VPS (5 MT5 Terminals)                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Terminal 1: EURUSD, GBPUSD, USDJPY          │ │
│ │ Terminal 2: XAUUSD, XAGUSD, WTIUSD          │ │
│ │ Terminal 3: BTCUSD, ETHUSD, BNBUSD          │ │
│ │ Terminal 4: US30, SPX500, NAS100            │ │
│ │ Terminal 5: AUDUSD, NZDUSD, USDCAD          │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ Each EA v2.24:                                   │
│ ├─ Try Redis → ✅ Success (99.9%)              │
│ └─ If failed → SQLite backup (0.1%)            │
└─────────────────────────────────────────────────┘
             ↓ (Primary)         ↓ (Recovery)
┌─────────────────────┐    ┌──────────────────┐
│ UPSTASH REDIS       │    │ SQLite Backups   │
│ (Message Broker)    │    │ (Safety Net)     │
│                     │    │                  │
│ Queue: 135 jobs/hr  │    │ 15 .db files     │
└─────────────────────┘    └──────────────────┘
             ↓                      ↓
             │         ┌────────────┘
             │         │ (Python backfill)
             ↓         ↓
┌─────────────────────────────────────────────────┐
│ RAILWAY WORKERS (Bull Queue)                    │
│ ├─ Process Redis queue                          │
│ └─ Batch insert to PostgreSQL                   │
└─────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────┐
│ RAILWAY POSTGRESQL (TimescaleDB)                │
│ ├─ 15 tables (1 per symbol)                     │
│ └─ 90,000 rows max per table                    │
└─────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────┐
│ VERCEL NEXT.JS (Frontend)                       │
│ ├─ TradingView Lightweight Charts               │
│ └─ Real-time confluence scores                  │
└─────────────────────────────────────────────────┘
```

## ✅ Key Features

### Symbol Detection (Eightcap)

```
Input: "EURUSD"
Auto-detects: "EURUSD.i" ✅
Database: "eurusd.db"
```

### Sequential Logic (NOT Parallel)

```cpp
if(PublishToRedis())      // Try first
    return true;          // 99.9% exit here

return WriteSQLite();     // Only if Redis failed
```

### Resource Optimization

```
3 symbols/terminal:
├─ RAM: ~600 MB
├─ CPU: ~15%
└─ Status: ✅ Very stable

5 symbols/terminal:
├─ RAM: ~1 GB
├─ CPU: ~25%
└─ Status: ✅ Comfortable

10 symbols/terminal:
├─ RAM: ~2 GB
├─ CPU: ~50%
└─ Status: ⚠️ Maximum advised
```

## 🔧 Troubleshooting

### Issue: "Symbol not found"

```
Solution:
1. Check broker uses .i suffix (Eightcap)
2. Input: "EURUSD" not "EURUSD.i"
3. EA auto-detects suffix
```

### Issue: Redis connection failed

```
Solution:
1. Check RedisURL and RedisToken correct
2. Add URL to MT5 allowed list (Tools > Options > Expert Advisors)
3. Test connection: https://your-redis.upstash.io/ping
```

### Issue: High SQLite backup rate

```
Check:
1. Network stability (Contabo → Upstash)
2. Redis service status
3. Collection statistics (should be >99% Redis success)

If persistent:
- Check firewall
- Check DNS resolution
- Verify Redis credentials
```

### Issue: Backfill not working

```
Check:
1. backfill_worker.py running?
2. Redis credentials correct?
3. SQLite files readable?
4. Check worker logs

Debug:
python backfill_worker.py  # See error messages
```

## 📈 Monitoring

### Hourly Statistics (MT5 Log):

```
=== Collection Statistics ===
Redis Success: 8,145
Redis Failures: 2
SQLite Backups: 2
Redis Success Rate: 99.98%
Last Redis Failure: 2026.01.15 14:23
============================
```

### Expected Performance:

```
Normal operation:
├─ Redis success rate: >99.9%
├─ SQLite backups: <10 per day
└─ Backfill lag: <5 minutes

Red flags:
├─ Redis success rate: <99%
├─ SQLite backups: >100 per day
└─ Backfill lag: >1 hour
```

## 🎯 Production Checklist

- [ ] v2.24 EA compiled successfully
- [ ] Redis credentials configured
- [ ] Symbols configured (3-5 per terminal)
- [ ] Database path exists: `C:\Scripts\database\`
- [ ] EA attached to 5 terminals
- [ ] Symbol detection working (check logs)
- [ ] All indicators loaded (check logs)
- [ ] Redis connection verified (check logs)
- [ ] SQLite databases created (check folder)
- [ ] backfill_worker.py configured
- [ ] backfill_worker.py running
- [ ] Collection statistics showing success
- [ ] Railway workers processing queue
- [ ] PostgreSQL receiving data

## 📞 Support Resources

### Documentation:

- Full README: `v2.24_README.md`
- EA Code: `SimpleDataCollector_Modified_v2_24_PRODUCTION.mq5`
- Backfill Script: `backfill_worker.py`

### Key Files:

```
C:\Scripts\database\
├─ btcusd.db            (SQLite backup)
├─ ethusd.db
├─ ... (15 .db files)
└─ backfill_queue.csv   (Recovery tracking)
```

### Next Steps:

1. ✅ Deploy to demo account first
2. ✅ Monitor for 24 hours
3. ✅ Verify data in PostgreSQL
4. ✅ Deploy to production

**Ready for production!** 🚀

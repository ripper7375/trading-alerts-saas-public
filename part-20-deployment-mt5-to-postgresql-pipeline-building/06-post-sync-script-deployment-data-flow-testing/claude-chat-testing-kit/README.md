# MT5 to PostgreSQL Data Pipeline - Deployment Guides

**Part 20 - Complete MT5 Integration**
**Status:** ✅ COMPLETE

---

## 📖 Documentation Index

This directory contains all deployment guides and testing procedures for integrating MT5 market data with the Trading Alerts SaaS platform.

### Deployment Guides (Steps 1-5)

| Step | Document                                                                                       | Description                                | Status  |
| ---- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ | ------- |
| 1    | [01-contabo-vps-setup-guide.md](./01-contabo-vps-setup-guide.md)                               | VPS provisioning and initial setup         | ✅ Done |
| 2    | [02-mt5-installation-guide.md](./02-mt5-installation-guide.md)                                 | Installing 15 MT5 terminal instances       | ✅ Done |
| 3    | [03-indicator-installation-guide.md](./03-indicator-installation-guide.md)                     | Custom indicator deployment (6 indicators) | ✅ Done |
| 4    | [04-datacollector-deployment-guide-revised.md](./04-datacollector-deployment-guide-revised.md) | DataCollector MQL5 service setup           | ✅ Done |
| 5    | [05-sync-script-deployment-guide-revised.md](./05-sync-script-deployment-guide-revised.md)     | Python sync script configuration           | ✅ Done |

### Testing & Verification (Step 6)

| Document                                                                 | Description                                 | When to Use   |
| ------------------------------------------------------------------------ | ------------------------------------------- | ------------- |
| [06-post-sync-script-deployment.md](./06-post-sync-script-deployment.md) | Comprehensive post-deployment testing guide | After Step 5  |
| [TESTING-PROCEDURES.md](./TESTING-PROCEDURES.md)                         | Step-by-step testing procedures             | Testing phase |

---

## 🚀 Quick Start

### Prerequisites

1. **Contabo VPS** with Windows Server
2. **15 MT5 terminal instances** installed and running
3. **DataCollector** services active in all MT5 instances
4. **Railway PostgreSQL** and **Redis** provisioned
5. **Environment variables** configured

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/trading-alerts-saas.git
cd trading-alerts-saas

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials
```

### Environment Variables

```bash
# PostgreSQL (Railway)
DATABASE_URL="postgresql://user:pass@host:5432/db"
POSTGRESQL_URI="postgresql://user:pass@host:5432/db"

# Redis (Railway)
REDIS_URL="redis://default:pass@host:6379"

# Optional
ENABLE_REDIS_SYNC="true"
```

---

## 🧪 Testing

### Run All Tests

```bash
npm run test:mt5:all
```

This runs:

1. ✅ Deployment verification
2. ✅ Complete pipeline tests
3. ✅ Health monitoring

### Individual Test Commands

```bash
# Verify sync deployment
npm run test:mt5:verify

# Test complete pipeline
npm run test:mt5:deployment

# Monitor pipeline health
npm run test:mt5:monitor
```

### Manual Testing

```bash
# Verify deployment
npx tsx scripts/verify-sync-deployment.ts

# Test pipeline
npx tsx scripts/test-mt5-deployment.ts

# Monitor health
npx tsx scripts/monitor-mt5-pipeline.ts
```

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTABO VPS (Windows)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MT5 Terminal #1-15                                  │   │
│  │  └─ DataCollector.mq5 (MQL5 Service)                │   │
│  │     └─ Writes to SQLite (trading_data.db)           │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Python Sync Script (runs every 30s)                │   │
│  │  └─ Reads SQLite                                     │   │
│  │  └─ Syncs to Railway (PostgreSQL + Redis)           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY (Cloud)                          │
│  ┌──────────────────────┐  ┌──────────────────────────┐    │
│  │  Redis (Hot Tier)    │  │  PostgreSQL (Warm Tier) │    │
│  │  • 250 candles       │  │  • 135 timeframe tables │    │
│  │  • <1ms latency      │  │  • 10,000 rows max      │    │
│  │  • Real-time data    │  │  • Historical data      │    │
│  └──────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend)                        │
│  • Next.js Application                                      │
│  • Real-time trading alerts                                 │
│  • Chart visualization                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Deployment Workflow

### Complete Workflow (Steps 1-6)

```
Step 1: Contabo VPS Setup (01-contabo-vps-setup-guide.md)
   ✓ Provision VPS
   ✓ Configure Windows Server
   ✓ Set up RDP access
   ↓
Step 2: MT5 Installation (02-mt5-installation-guide.md)
   ✓ Install 15 MT5 terminals
   ✓ Configure accounts
   ✓ Set up auto-start
   ↓
Step 3: Indicator Installation (03-indicator-installation-guide.md)
   ✓ 6 MQL5 indicators installed
   ✓ All indicators working properly
   ✓ Deployed to all 15 MT5 instances
   ↓
Step 4: DataCollector Deployment (04-datacollector-deployment-guide-revised.md)
   ✓ Deploy MQL5 service
   ✓ Configure SQLite database
   ✓ Verify data collection
   ↓
Step 5: Sync Script Deployment (05-sync-script-deployment-guide-revised.md)
   ✓ Deploy Python scripts
   ✓ Configure environment
   ✓ Set up Task Scheduler
   ↓
Step 6: Post-Deployment Testing (06-post-sync-script-deployment.md)
   ✓ Run verification tests
   ✓ 24-hour stability test
   ✓ Performance benchmarking
   ✓ Set up monitoring
```

---

## 🔍 Monitoring & Health Checks

### Automated Monitoring

Set up continuous monitoring:

```bash
# Run every 5 minutes via cron/Task Scheduler
*/5 * * * * cd /path/to/repo && npm run test:mt5:monitor >> logs/monitor.log 2>&1
```

### Health Check Dashboard

Monitor the pipeline health:

```bash
npm run test:mt5:monitor
```

**Output:**

- 🔴 Redis status and metrics
- 🐘 PostgreSQL status and metrics
- ⏰ Data freshness
- ✓ Data integrity

### Alert Levels

- **HEALTHY** ✅ - All systems operational
- **DEGRADED** ⚠️ - Some warnings present
- **CRITICAL** 🔴 - Immediate action required

---

## 🐛 Troubleshooting

### Common Issues

#### 1. Redis Connection Failed

**Error:**

```
❌ Redis Connection: ECONNREFUSED
```

**Fix:**

```bash
# Check REDIS_URL is correct
echo $REDIS_URL

# Test Redis connection
npx tsx -e "import { createClient } from 'redis'; const c = createClient({url: process.env['REDIS_URL']}); await c.connect(); console.log(await c.ping()); await c.disconnect();"
```

#### 2. PostgreSQL Tables Missing

**Error:**

```
❌ PostgreSQL Tables: Found 50/135 tables
```

**Fix:**

```bash
# Run database migrations
npm run db:push

# Or check sync script logs
# On Contabo VPS: C:\Scripts\sync_package\sync.log
```

#### 3. Data is Stale

**Error:**

```
⚠️ Data Freshness: WARNING - Data is aging (180s old)
```

**Fix:**

1. Check if sync script is running (Task Scheduler)
2. Verify SQLite is updating (Contabo VPS)
3. Check DataCollector services active in MT5

---

## 📈 Performance Targets

| Metric           | Target | Critical Threshold |
| ---------------- | ------ | ------------------ |
| Redis query time | <5ms   | >10ms              |
| PostgreSQL query | <50ms  | >100ms             |
| Data freshness   | <120s  | >300s              |
| Sync frequency   | 30s    | >60s               |
| Error rate       | <1%    | >5%                |
| Uptime           | >99.9% | <99%               |

---

## 📚 Additional Resources

### Documentation

- [Sync Package Files](/sync/) - Python sync script source
- [Testing Procedures](./TESTING-PROCEDURES.md) - Detailed testing guide
- [Post-Deployment Guide](./06-post-sync-script-deployment.md) - Comprehensive testing reference

### Scripts

| Script                    | Purpose                | Location    |
| ------------------------- | ---------------------- | ----------- |
| verify-sync-deployment.ts | Verify deployment      | `/scripts/` |
| test-mt5-deployment.ts    | Test complete pipeline | `/scripts/` |
| monitor-mt5-pipeline.ts   | Health monitoring      | `/scripts/` |

### External Links

- [Contabo VPS Dashboard](https://my.contabo.com)
- [Railway Dashboard](https://railway.app/dashboard)
- [MT5 Documentation](https://www.metatrader5.com/en/terminal/help)

---

## 🎯 Production Readiness

Before going to production, ensure:

### ✅ Deployment Checklist

```
Infrastructure:
[ ] Contabo VPS operational
[ ] All 15 MT5 instances running
[ ] DataCollector services active
[ ] SQLite database updating

Database Services:
[ ] Railway PostgreSQL online
[ ] Railway Redis online
[ ] All 135 tables created
[ ] Data syncing correctly

Testing:
[ ] All verification tests pass
[ ] 24-hour stability test complete
[ ] Performance benchmarks met
[ ] No critical issues

Monitoring:
[ ] Health checks scheduled
[ ] Alerts configured
[ ] Logs rotating
[ ] Team trained
```

---

## 💡 Tips & Best Practices

1. **Run tests after deployment** - Always verify with `npm run test:mt5:all`
2. **Monitor continuously** - Set up automated health checks every 5-15 minutes
3. **Review logs regularly** - Check sync logs daily for errors
4. **Maintain backups** - SQLite database backups weekly
5. **Document changes** - Update guides when making modifications

---

## 🤝 Support

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting) section
2. Review [Testing Procedures](./TESTING-PROCEDURES.md)
3. Check logs:
   - Sync script: `C:\Scripts\sync_package\sync.log` (Contabo)
   - Railway: https://railway.app/dashboard
4. Run diagnostics: `npm run test:mt5:verify`

---

## 📅 Maintenance Schedule

### Daily

- Review monitoring dashboard
- Check for alerts
- Verify data freshness

### Weekly

- Review sync logs
- Check system resources
- Backup SQLite database

### Monthly

- Performance review
- Cost analysis
- Documentation updates

---

**Last Updated:** 2026-01-11
**Version:** 1.0.0
**Status:** ✅ Production Ready

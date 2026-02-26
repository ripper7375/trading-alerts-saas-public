# Claude Code Prompts - Master Guide

## Overview

This document explains how to use the 4 prompts with Claude Code (web) to build your complete API Gateway infrastructure on Railway.

---

## Prerequisites

Before starting, upload these 2 documents to Claude Code:

1. **ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED.md**
   - Contains complete API Gateway architecture
   - 8-layer validation specification
   - Performance benchmarks
   - Cost analysis

2. **API_GATEWAY_OBSERVABILITY_GUIDE.md**
   - Complete observability implementation
   - Level 1, 2, 3 observability
   - Metrics definitions
   - Dashboard examples

---

## Prompt Sequence

### 📝 Prompt 1: NestJS API Gateway Implementation

**File:** `PROMPT_1_API_GATEWAY.md`

**What it builds:**

- Complete NestJS API Gateway
- 8-layer validation service
- API key authentication
- Bull Queue integration
- Structured logging
- Prometheus metrics

**Timeline:** 30-45 minutes implementation

**Steps:**

1. Upload the 2 architecture documents to Claude Code
2. Copy-paste `PROMPT_1_API_GATEWAY.md` content
3. Claude Code will generate complete project structure
4. Download and review the generated code
5. Test locally before deploying

**Expected deliverables:**

```
api-gateway/
├── src/
│   ├── api-gateway/
│   │   ├── market-data.controller.ts
│   │   ├── validation.service.ts (8 layers)
│   │   ├── dto/market-data.dto.ts (57 columns)
│   │   └── guards/api-key.guard.ts
│   ├── monitoring/
│   │   └── metrics.service.ts
│   └── config/
├── test/
├── package.json
└── README.md
```

---

### ⚙️ Prompt 2: Railway Redis Setup & Configuration

**File:** `PROMPT_2_REDIS_SETUP.md`

**What it builds:**

- Complete Redis configuration
- Bull Queue setup
- Database allocation strategy
- Rate limiting configuration
- Health checks

**Timeline:** 15-20 minutes setup

**Steps:**

1. Use same Claude Code session (documents already uploaded)
2. Copy-paste `PROMPT_2_REDIS_SETUP.md` content
3. Claude Code will generate configuration files
4. Follow deployment guide for Railway

**Expected deliverables:**

```
redis-config/
├── redis.config.ts
├── bull-queue.config.ts
├── rate-limiter.config.ts
├── railway-setup-guide.md
└── .env.example
```

---

### 🔄 Prompt 3: NestJS Workers Implementation

**File:** `PROMPT_3_WORKERS.md`

**What it builds:**

- Bull Queue processor
- Batch insertion service
- TypeORM entity (57 columns)
- Database migrations
- Retry logic
- Monitoring

**Timeline:** 30-45 minutes implementation

**Steps:**

1. Use same Claude Code session
2. Copy-paste `PROMPT_3_WORKERS.md` content
3. Claude Code will generate worker application
4. Test with sample data before production

**Expected deliverables:**

```
workers/
├── src/
│   ├── workers/
│   │   ├── market-data.processor.ts
│   │   └── batch.service.ts
│   ├── database/
│   │   ├── entities/market-data.entity.ts
│   │   └── migrations/
│   ├── monitoring/
│   └── config/
├── test/
├── package.json
└── README.md
```

---

### 📊 Prompt 4: Basic Observability Implementation

**File:** `PROMPT_4_OBSERVABILITY.md`

**What it builds:**

- Prometheus configuration
- Grafana dashboards (4 complete dashboards)
- Alerting rules
- Logging configuration
- Health check aggregator

**Timeline:** 20-30 minutes setup

**Steps:**

1. Use same Claude Code session
2. Copy-paste `PROMPT_4_OBSERVABILITY.md` content
3. Claude Code will generate monitoring stack
4. Deploy Prometheus and Grafana to Railway
5. Import dashboards

**Expected deliverables:**

```
observability/
├── prometheus/
│   ├── prometheus.yml
│   └── alerts.yml
├── grafana/
│   ├── provisioning/
│   └── dashboards/ (4 JSON files)
├── logging/
│   └── winston.config.ts
└── deployment-guide.md
```

---

## Usage Workflow

### Step 1: Prepare Documents

```bash
# Make sure you have these ready
✅ ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED.md
✅ API_GATEWAY_OBSERVABILITY_GUIDE.md
```

### Step 2: Open Claude Code

```
1. Go to claude.ai
2. Start new conversation with Claude Code
3. Upload the 2 architecture documents
```

### Step 3: Execute Prompts in Order

**Session 1: API Gateway**

```
1. Paste PROMPT_1_API_GATEWAY.md
2. Wait for complete code generation
3. Review and download all files
4. Test compilation locally
```

**Session 2: Redis Setup** (same conversation)

```
1. Paste PROMPT_2_REDIS_SETUP.md
2. Get configuration files
3. Set up Redis on Railway
4. Configure environment variables
```

**Session 3: Workers** (same conversation)

```
1. Paste PROMPT_3_WORKERS.md
2. Get worker application code
3. Test locally with sample data
4. Deploy to Railway
```

**Session 4: Observability** (same conversation)

```
1. Paste PROMPT_4_OBSERVABILITY.md
2. Get monitoring configuration
3. Deploy Prometheus + Grafana
4. Import dashboards
```

---

## Expected Timeline

| Task                        | Duration      | Status                   |
| --------------------------- | ------------- | ------------------------ |
| **Prompt 1: API Gateway**   | 30-45 min     | Code generation + review |
| **Prompt 2: Redis Setup**   | 15-20 min     | Configuration only       |
| **Prompt 3: Workers**       | 30-45 min     | Code generation + review |
| **Prompt 4: Observability** | 20-30 min     | Config + dashboard setup |
| **Total Claude Code Time**  | **~2 hours**  | Code generation          |
| **Local Testing**           | 1-2 hours     | Manual testing           |
| **Railway Deployment**      | 1-2 hours     | Deployment + config      |
| **Total Implementation**    | **4-6 hours** | Complete system          |

---

## Testing Strategy

### After Prompt 1 (API Gateway)

```bash
# Local testing
cd api-gateway
npm install
npm run test
npm run build
npm run start:dev

# Test endpoint
curl -X POST http://localhost:3000/api/v1/market-data \
  -H "Authorization: Bearer test_key" \
  -H "X-Terminal-ID: terminal_001" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"btcusd","timeframe":"PERIOD_M5",...}'
```

### After Prompt 2 (Redis)

```bash
# Test Redis connection
redis-cli -h your-redis.railway.app -p 6379 -a your_password
PING
# Should return: PONG
```

### After Prompt 3 (Workers)

```bash
# Local testing
cd workers
npm install
npm run test
npm run build
npm run start:dev

# Monitor queue
# Should process jobs from Redis
```

### After Prompt 4 (Observability)

```bash
# Access Prometheus
https://prometheus.railway.app

# Access Grafana
https://grafana.railway.app
# Import dashboards
# Verify metrics flowing
```

---

## Deployment Order

1. **Railway Redis** (Prompt 2)
   - Deploy first (other services depend on it)
   - Set up databases 0-5
   - Configure environment variables

2. **Railway PostgreSQL**
   - Set up TimescaleDB
   - Run migrations
   - Create indexes

3. **API Gateway** (Prompt 1)
   - Deploy NestJS application
   - Configure API keys
   - Test validation endpoint

4. **Workers** (Prompt 3)
   - Deploy worker application
   - Start processing queue
   - Monitor batch inserts

5. **Prometheus + Grafana** (Prompt 4)
   - Deploy monitoring stack
   - Import dashboards
   - Configure alerts

---

## Environment Variables Summary

After all 4 prompts, you'll need these environment variables:

### API Gateway

```bash
PORT=3000
NODE_ENV=production
REDIS_HOST=redis.railway.internal
REDIS_PASSWORD=xxx
API_KEY_TERMINAL_001=mt5_terminal_001_xxx
# ... (15 terminal keys)
```

### Workers

```bash
PORT=3001
NODE_ENV=production
REDIS_HOST=redis.railway.internal
REDIS_PASSWORD=xxx
DATABASE_HOST=postgres.railway.internal
DATABASE_PASSWORD=xxx
WORKER_CONCURRENCY=5
BATCH_SIZE=100
```

### Prometheus

```bash
PROMETHEUS_PORT=9090
RETENTION_DAYS=30
```

### Grafana

```bash
GRAFANA_ADMIN_PASSWORD=xxx
GF_SERVER_ROOT_URL=https://your-grafana.railway.app
```

---

## Success Criteria

After completing all 4 prompts and deploying:

### API Gateway

- ✅ Compiles without errors
- ✅ Validates 8 layers correctly
- ✅ Returns specific error messages
- ✅ Queues data to Bull
- ✅ Exposes /metrics endpoint
- ✅ Handles 200+ req/min

### Redis

- ✅ Bull Queue working
- ✅ Rate limiting active
- ✅ Multiple databases configured
- ✅ Health check passing

### Workers

- ✅ Processing queue jobs
- ✅ Batch inserting to PostgreSQL
- ✅ Retrying failed jobs
- ✅ Logging structured JSON
- ✅ Graceful shutdown working

### Observability

- ✅ Prometheus collecting metrics
- ✅ 4 Grafana dashboards working
- ✅ Alerts configured
- ✅ Logs aggregated in Railway

---

## Troubleshooting

### If code doesn't compile:

1. Check all dependencies in package.json
2. Verify TypeScript version compatibility
3. Re-run `npm install`
4. Check for missing imports

### If Railway deployment fails:

1. Check environment variables
2. Verify internal networking (use .railway.internal)
3. Check build logs
4. Verify health check endpoint

### If validation errors are high:

1. Check Grafana "Validation Overview" dashboard
2. Review error messages in logs
3. Fix EA indicator calculations
4. Re-test with sample data

### If queue is backing up:

1. Check worker health
2. Increase worker concurrency
3. Check database performance
4. Review batch size settings

---

## Next Steps After Implementation

1. **Test with one MT5 terminal** (terminal_001)
   - Configure EA with API Gateway URL
   - Monitor for 24 hours
   - Verify error rate < 1%

2. **Gradually add terminals**
   - Add terminal_002
   - Wait 24 hours
   - Continue to terminal_015

3. **Monitor continuously**
   - Check Grafana daily
   - Review error logs weekly
   - Adjust validation rules as needed

4. **Optimize performance**
   - Tune batch sizes
   - Adjust worker concurrency
   - Optimize database indexes

---

## Support Resources

**Architecture Questions:**

- Reference: `ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED.md`
- Validation logic details
- Performance benchmarks

**Monitoring Questions:**

- Reference: `API_GATEWAY_OBSERVABILITY_GUIDE.md`
- Metrics definitions
- Dashboard examples
- Alert thresholds

**Railway Questions:**

- Railway Docs: https://docs.railway.app
- Discord: https://discord.gg/railway
- Support: help@railway.app

---

## Summary

This guide provides 4 sequential prompts to build:

1. ✅ NestJS API Gateway with validation
2. ✅ Railway Redis configuration
3. ✅ NestJS Workers with batch processing
4. ✅ Complete observability stack

**Total implementation time: 4-6 hours**

**Result: Production-ready API Gateway infrastructure with 0.5% error rate target**

Good luck with your implementation! 🚀

---

**Document Version:** 1.0  
**Date:** 2026-01-29  
**Status:** Ready for Use

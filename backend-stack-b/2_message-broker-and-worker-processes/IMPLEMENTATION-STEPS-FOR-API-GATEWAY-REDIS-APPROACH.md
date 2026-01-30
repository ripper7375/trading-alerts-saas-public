PRODUCTION FILES NEED

✅ What You Have Built

EA (v2.24) ---> we have completed "SimpleDataCollector_v2_24_API_GATEWAY.mq5" (DONE)

├─ Collects 57 columns

├─ 9 timeframes

├─ HTTP POST capability

└─ SQLite fallback

backfill_worker ----> we have completed "backfill_worker_api_gateway.py" (DONE)

├─ Reads SQLite

├─ Can post to HTTP endpoint

└─ Ready to send to API Gateway

✅ What I Need To Build for API Gateway approach:

(a) Railway NestJS API Gateway (BACKEND BUILD)

└─ Receives HTTP POST from EA

└─ 8-layer validation

└─ Adds to Bull Queue

(b) Railway Redis (Message Broker) (SETUP)

└─ Bull Queue storage

└─ Sessions, rate limits, cache

(c) Railway NestJS Workers (BUILD)

└─ Process queue jobs

└─ Batch insert to PostgreSQL

(d) Basic Observability (BUILD)

└─ Structured logging

└─ Error tracking

Based on workflow above + I will upload these 2 documents below to Claude Code (web)

ARCHITECTURE_DESIGN_DOCUMENT_ENHANCED.md

API_GATEWAY_OBSERVABILITY_GUIDE.md

then ask Claude Code (web) to create production code + setup for (a) (b) (c) (d)

Could you craft the 4 prompts to Claude Code (web) to implement (a) (b) (c) (d) \[providing that I upload the 2 documents to Claude Code (web)] ? Please write the 4 prompts for (a) (b) (c) (d) in artifact so that I could download them as markdown flies and use them to Claude Code (web)

===========================================

STEPS TO IMPLEMENT

Recommended Path

Week 1: Core Infrastructure
Day 1-2: NestJS API Gateway + Validation
Day 3: Railway Redis + Bull Queue setup
Day 4: NestJS Workers + PostgreSQL
Day 5: Basic logging + testing

Week 2: Integration \& Testing
Day 1: Connect EA to API Gateway
Day 2: Test all 15 symbols × 9 timeframes
Day 3: Connect backfill_worker.py
Day 4: Add Prometheus metrics
Day 5: Create Grafana dashboard

Week 3: Observability \& Polish
Day 1-2: Set up alerts
Day 3: Terminal health monitoring
Day 4: Error analysis \& EA fixes
Day 5: Documentation

Total: 3 weeks to production-ready system

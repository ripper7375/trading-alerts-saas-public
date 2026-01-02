# Multi-Indicator Confluence Analysis System

## Architecture Design Document

**Version:** 1.0
**Date:** 2025-11-22
**Purpose:** Seed reference for trading-alerts-saas-v7 development

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Layers](#architecture-layers)
3. [Database Design](#database-design)
4. [Data Flow Architecture](#data-flow-architecture)
5. [Component Interactions](#component-interactions)
6. [Key Architectural Decisions](#key-architectural-decisions)
7. [Technology Stack](#technology-stack)
8. [Scalability Considerations](#scalability-considerations)
9. [Future Development Roadmap](#future-development-roadmap)

---

## System Overview

### Vision

A multi-timeframe, multi-indicator confluence analysis system that combines technical analysis with AI-powered insights to provide traders with high-quality trade setups and comprehensive market analysis.

### Core Requirements

- Monitor 7 technical indicators across 5 timeframes (M15, M30, H1, H2, H4)
- Collect and store market data and indicator values in SQLite database
- Calculate confluence scores through intermediate data processing
- Generate AI-powered technical analysis and trade setups
- Deliver comprehensive analysis to end users via API

### System Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                     SYSTEM BOUNDARY                             │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │   MQL5       │───▶│   SQLite     │───▶│    Python       │  │
│  │   Service    │    │   Database   │    │    Processor    │  │
│  │              │    │   (Railway)  │    │                 │  │
│  └──────────────┘    └──────────────┘    └─────────────────┘  │
│         │                    │                     │           │
│         │                    │                     │           │
│         ▼                    ▼                     ▼           │
│  [Market Data]        [Raw Storage]         [Calculations]    │
│  [Indicators]         [Query Layer]         [Confluence]      │
│                                                     │           │
│                                              ┌──────▼──────┐   │
│                                              │     LLM     │   │
│                                              │  Integration│   │
│                                              └──────┬──────┘   │
│                                                     │           │
│                                              ┌──────▼──────┐   │
│                                              │   REST API  │   │
│                                              │  Response   │   │
│                                              └─────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Architecture Layers

### Layer 1: Data Collection Layer (MQL5)

**Responsibility:** Real-time market data and indicator value collection

**Components:**

- Market data collector service
- 7 indicator monitors (running concurrently)
- Multi-timeframe synchronizer
- Database writer with transaction management

**Design Pattern:** Continuous Service Pattern (from Part 297)

- Runs 24/7 as MQL5 service
- Periodic data collection (configurable interval)
- Automatic retry logic for failed operations
- Duplicate prevention before database writes

**Key Characteristics:**

- **Stateless:** Each collection cycle is independent
- **Resilient:** Handles network/broker interruptions gracefully
- **Efficient:** Uses transactions for bulk inserts (532x performance gain)

---

### Layer 2: Data Storage Layer (SQLite on Railway)

**Responsibility:** Persistent storage with three sub-layers

#### Sub-Layer 2.1: Raw Data Layer

Stores unprocessed data directly from MQL5:

- Market OHLCV data per timeframe
- Indicator values (7 indicators × 5 timeframes)
- Symbol metadata

**Design Principle:** Write-heavy, immutable once written

#### Sub-Layer 2.2: Intermediate Calculation Layer

Stores processed analytical data:

- Timeframe alignment scores
- Indicator strength weightings
- Signal correlations

**Design Principle:** Computational results cached for reuse

#### Sub-Layer 2.3: Output Layer

Stores final results ready for consumption:

- Confluence scores
- LLM-generated analysis
- Trade setup recommendations

**Design Principle:** Read-optimized, API-ready format

---

### Layer 3: Processing Layer (Python)

**Responsibility:** Data transformation and confluence calculation

**Components:**

- Data fetcher (reads from Raw Layer)
- Timeframe alignment calculator
- Indicator strength analyzer
- Confluence score engine
- Database writer (to Intermediate/Output layers)

**Design Pattern:** ETL Pipeline

```
Extract → Transform → Load
   ↓          ↓         ↓
  Raw    Processing  Output
 Layer   (Pandas)    Layer
```

**Key Characteristics:**

- **Idempotent:** Same input always produces same output
- **Stateless:** No session state between calculations
- **Reprocessable:** Can recalculate historical data

---

### Layer 4: AI Integration Layer (LLM)

**Responsibility:** Generate human-readable technical analysis

**Components:**

- Prompt builder (structures confluence data)
- LLM API client
- Response parser
- Analysis storage manager

**Design Pattern:** Adapter Pattern

- Abstracts LLM provider (OpenAI, Anthropic, etc.)
- Allows switching providers without code changes
- Maintains prompt versioning

---

### Layer 5: API Layer

**Responsibility:** External interface for data consumption

**Components:**

- REST endpoints
- Authentication/Authorization
- Response schema formatter
- Caching layer

**Design Pattern:** Gateway Pattern

- Single entry point for all client requests
- Aggregates data from multiple database layers
- Implements rate limiting and security

---

## Database Design

### Design Philosophy

Based on lessons from Part 297 (normalized schema) and Native handling (transaction optimization):

1. **Separation of Concerns:** Raw data, processed data, and output are isolated
2. **Referential Integrity:** Foreign keys with CASCADE operations
3. **Data Validation:** CHECK constraints at database level
4. **Type Safety:** STRICT mode for modern SQLite
5. **Performance:** Indexed columns for fast queries

---

### Schema Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RAW DATA LAYER                           │
├─────────────────────────────────────────────────────────────┤
│  symbol                                                     │
│  ├─ symbol_id (PK)                                          │
│  ├─ ticker                                                  │
│  ├─ exchange                                                │
│  └─ asset_type                                              │
│                                                             │
│  market_data                                                │
│  ├─ (tstamp, timeframe, symbol_id) (PK)                    │
│  ├─ price_open, price_high, price_low, price_close         │
│  ├─ tick_volume, spread                                     │
│  └─ FK: symbol_id → symbol                                  │
│                                                             │
│  indicator_values                                           │
│  ├─ (tstamp, timeframe, indicator_name, symbol_id) (PK)    │
│  ├─ value_line1, value_line2, value_line3                  │
│  ├─ signal_direction (-1/0/1)                               │
│  ├─ signal_strength (0-100)                                 │
│  └─ FK: symbol_id → symbol                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              INTERMEDIATE CALCULATION LAYER                 │
├─────────────────────────────────────────────────────────────┤
│  timeframe_alignment                                        │
│  ├─ analysis_id (PK)                                        │
│  ├─ tstamp, symbol_id                                       │
│  ├─ m15_alignment_score, m30_alignment_score, ...           │
│  ├─ overall_direction                                       │
│  └─ FK: symbol_id → symbol                                  │
│                                                             │
│  indicator_strength                                         │
│  ├─ strength_id (PK)                                        │
│  ├─ analysis_id                                             │
│  ├─ indicator_name, timeframe                               │
│  ├─ weight, reliability_score                               │
│  └─ FK: analysis_id → timeframe_alignment                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     OUTPUT LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  confluence_score                                           │
│  ├─ confluence_id (PK)                                      │
│  ├─ analysis_id, symbol_id, tstamp                          │
│  ├─ total_score (0-100)                                     │
│  ├─ bullish_score, bearish_score                            │
│  ├─ timeframe_consensus (JSON)                              │
│  ├─ indicator_breakdown (JSON)                              │
│  ├─ confidence_level (LOW/MEDIUM/HIGH/VERY_HIGH)            │
│  └─ FK: analysis_id → timeframe_alignment                   │
│                                                             │
│  llm_analysis                                               │
│  ├─ llm_id (PK)                                             │
│  ├─ confluence_id                                           │
│  ├─ technical_summary                                       │
│  ├─ trade_setup                                             │
│  ├─ risk_assessment                                         │
│  ├─ market_context                                          │
│  ├─ llm_model, prompt_version                               │
│  └─ FK: confluence_id → confluence_score                    │
└─────────────────────────────────────────────────────────────┘
```

### Schema Design Principles

#### 1. Composite Primary Keys

Used for time-series data to ensure uniqueness across time + dimension:

```
PRIMARY KEY (tstamp, timeframe, symbol_id)
```

**Rationale:** Prevents duplicate entries for same bar across timeframes

#### 2. Foreign Key Cascades

```
FOREIGN KEY(symbol_id) REFERENCES symbol(symbol_id)
    ON DELETE CASCADE ON UPDATE CASCADE
```

**Rationale:** Automatic cleanup when parent records are deleted

#### 3. CHECK Constraints

```
signal_direction INTEGER CHECK(signal_direction IN (-1, 0, 1))
timeframe TEXT CHECK(timeframe IN ('M15','M30','H1','H2','H4'))
```

**Rationale:** Data validation at database level, not application level

#### 4. JSON Storage for Complex Data

```
timeframe_consensus TEXT  -- JSON: {"M15":"BULL","M30":"BULL",...}
indicator_breakdown TEXT  -- JSON: {"IND1":{"signal":"BUY","weight":15},...}
```

**Rationale:** Flexible storage for nested data, queryable with SQLite JSON functions

---

## Data Flow Architecture

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATA FLOW PIPELINE                         │
└─────────────────────────────────────────────────────────────────┘

Step 1: COLLECTION (MQL5 Service)
┌──────────────────────────────────────┐
│ Every 60 seconds                     │
│ For each timeframe (M15-H4):         │
│   ├─ CopyRates() → OHLCV            │
│   ├─ CopyBuffer() → 7 indicators    │
│   ├─ ClassifySignal() → direction   │
│   ├─ CalculateStrength() → 0-100    │
│   └─ DatabaseExecute() → Raw Layer  │
│                                      │
│ Pattern: Transaction BEGIN/COMMIT   │
│ Result: 35 records per cycle        │
│         (7 indicators × 5 TF)       │
└──────────────────────────────────────┘
                ↓
         [API Webhook]
                ↓
Step 2: PROCESSING (Python Engine)
┌──────────────────────────────────────┐
│ Triggered by new data event          │
│                                      │
│ 2.1 Extract                          │
│   └─ SELECT * FROM indicator_values │
│      WHERE tstamp = latest           │
│                                      │
│ 2.2 Transform (Pandas/Numpy)         │
│   ├─ Timeframe alignment (%)         │
│   ├─ Indicator weighting             │
│   ├─ Signal correlation              │
│   └─ Confluence calculation          │
│                                      │
│ 2.3 Load                             │
│   ├─ INSERT → timeframe_alignment   │
│   ├─ INSERT → indicator_strength    │
│   └─ INSERT → confluence_score      │
│                                      │
│ Result: analysis_id, confluence_id   │
└──────────────────────────────────────┘
                ↓
Step 3: AI GENERATION (LLM)
┌──────────────────────────────────────┐
│ Triggered by confluence_id           │
│                                      │
│ 3.1 Build Context                    │
│   └─ Fetch confluence + breakdown    │
│                                      │
│ 3.2 Generate Prompt                  │
│   └─ Structured template             │
│                                      │
│ 3.3 Call LLM API                     │
│   └─ OpenAI/Anthropic/etc.          │
│                                      │
│ 3.4 Parse & Store                    │
│   └─ INSERT → llm_analysis          │
│                                      │
│ Result: llm_id                       │
└──────────────────────────────────────┘
                ↓
Step 4: API RESPONSE (REST)
┌──────────────────────────────────────┐
│ Client requests analysis             │
│                                      │
│ 4.1 Query Output Layer               │
│   ├─ SELECT FROM confluence_score   │
│   └─ JOIN llm_analysis              │
│                                      │
│ 4.2 Format Response                  │
│   └─ JSON schema                    │
│                                      │
│ 4.3 Return to Client                 │
│   └─ HTTP 200 + payload             │
└──────────────────────────────────────┘
```

### Data Flow Timing

```
T+0s:   MQL5 collects data → RAW layer
T+1s:   Python triggered → processes data
T+2s:   Writes to INTERMEDIATE layer
T+3s:   Calculates confluence → OUTPUT layer
T+4s:   LLM API call initiated
T+6s:   LLM response received
T+7s:   Analysis stored → OUTPUT layer
T+8s:   Data ready for API consumption

Total latency: ~8 seconds from market data to final analysis
```

---

## Component Interactions

### Interaction Matrix

| Component            | Reads From                | Writes To               | Triggers     |
| -------------------- | ------------------------- | ----------------------- | ------------ |
| **MQL5 Service**     | Broker API                | Raw Layer               | API webhook  |
| **Python Processor** | Raw Layer                 | Intermediate + Output   | LLM Analyzer |
| **LLM Analyzer**     | Output Layer (confluence) | Output Layer (analysis) | None         |
| **REST API**         | All Layers                | None (read-only)        | None         |

### Communication Patterns

#### 1. MQL5 → Database (Direct Write)

```
Pattern: Write-Through
Frequency: Every 60 seconds
Protocol: SQLite native connection
Transaction: Always wrapped in BEGIN/COMMIT
```

#### 2. MQL5 → Python (Event-Driven)

```
Pattern: Webhook/Queue
Frequency: On new data availability
Protocol: HTTP POST or message queue
Payload: {symbol_id, tstamp, timeframe}
```

#### 3. Python → Database (Read-Transform-Write)

```
Pattern: ETL Pipeline
Frequency: On-demand (triggered)
Protocol: SQLite native connection
Transaction: Per analysis cycle
```

#### 4. Python → LLM (API Call)

```
Pattern: Request-Response
Frequency: Per confluence calculation
Protocol: HTTPS REST
Retry: 3 attempts with exponential backoff
```

#### 5. Client → API (Stateless)

```
Pattern: RESTful
Frequency: On-demand
Protocol: HTTPS
Authentication: API key / JWT
```

---

## Key Architectural Decisions

### Decision Log

| Decision                               | Rationale                                                         | Trade-offs                                       | Source                   |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ | ------------------------ |
| **Use SQLite instead of PostgreSQL**   | Simplicity, portability, sufficient for single-symbol analysis    | Limited concurrency, no native replication       | Part 297 pattern         |
| **Three-layer database design**        | Separation of concerns, easier debugging, reprocessing capability | Increased storage, some duplication              | Architecture principle   |
| **Transaction wrapping for inserts**   | 532x performance improvement for bulk operations                  | Slightly more complex error handling             | Native folder lesson     |
| **MQL5 Service (not EA)**              | Runs independently of charts, more stable                         | Cannot access chart objects                      | Part 297 pattern         |
| **Duplicate prevention before insert** | Avoid data redundancy, ensure idempotency                         | Extra SELECT query overhead                      | Part 297 pattern         |
| **JSON for complex nested data**       | Flexibility for variable structure                                | Requires parsing, less queryable than normalized | Modern SQLite capability |
| **STRICT mode for tables**             | Type safety, catches errors early                                 | Less forgiving for schema changes                | Part 297 pattern         |
| **Foreign keys with CASCADE**          | Automatic cleanup, referential integrity                          | Potential for accidental deletions               | Part 297 pattern         |
| **Event-driven processing**            | Real-time analysis, lower latency                                 | More complex orchestration                       | Scalability              |
| **Separate LLM analysis storage**      | Version tracking, prompt evolution                                | Additional table complexity                      | Future-proofing          |

---

## Technology Stack

### Data Collection Tier

```
Language:     MQL5
Runtime:      MetaTrader 5 Terminal
Deployment:   Windows VPS / Local machine
Database:     SQLite (native MQL5 functions)
Persistence:  DATABASE_OPEN_COMMON flag
```

### Processing Tier

```
Language:     Python 3.10+
Framework:    pandas, numpy
Database:     SQLite via sqlite3 module
Deployment:   Railway (or similar PaaS)
Scheduling:   Event-driven or cron
```

### AI Tier

```
Provider:     OpenAI / Anthropic / etc.
Protocol:     REST API
Format:       JSON request/response
Versioning:   Tracked in llm_analysis.prompt_version
```

### API Tier

```
Framework:    FastAPI / Flask
Protocol:     REST over HTTPS
Auth:         API Key or JWT
Deployment:   Railway (same as processing)
Cache:        In-memory or Redis
```

### Database Tier

```
Engine:       SQLite 3.35+
Location:     Railway persistent volume
Backup:       Periodic snapshot to S3/GCS
Size:         Estimated 100MB per month (single symbol)
```

---

## Scalability Considerations

### Current Design Capacity

- **Symbols:** 1 (EURUSD or similar)
- **Timeframes:** 5 (M15, M30, H1, H2, H4)
- **Indicators:** 7
- **Data points per hour:** 35 (7 indicators × 5 TF)
- **Storage growth:** ~3MB per day

### Scaling Paths

#### Horizontal Scaling (Multiple Symbols)

```
Current:  1 MQL5 service → 1 database
Scaled:   N MQL5 services → N databases → 1 aggregator
Pattern:  Shard by symbol
```

#### Vertical Scaling (More Indicators/Timeframes)

```
Current:  7 indicators × 5 timeframes = 35 data points
Scaled:   15 indicators × 8 timeframes = 120 data points
Impact:   3.4x storage growth, linear processing time
```

#### Performance Scaling

```
Bottleneck 1: MQL5 CopyBuffer() calls
Solution:     Parallel indicator reads (multi-threading)

Bottleneck 2: Database writes
Solution:     Already optimized (transactions)

Bottleneck 3: LLM API latency
Solution:     Async calls, result caching
```

### High Availability

```
Component:     MQL5 Service
HA Strategy:   Active-Passive (failover VPS)

Component:     SQLite Database
HA Strategy:   Periodic replication to read-replica

Component:     Python Processor
HA Strategy:   Stateless, multiple instances behind load balancer

Component:     API Layer
HA Strategy:   Horizontal scaling, stateless design
```

---

## Future Development Roadmap

### Phase 1: Foundation (Months 1-2)

- [ ] Implement complete database schema
- [ ] Build MQL5 data collection service
- [ ] Test transaction performance
- [ ] Validate data integrity with foreign keys

### Phase 2: Processing (Months 3-4)

- [ ] Build Python ETL pipeline
- [ ] Implement timeframe alignment algorithm
- [ ] Implement indicator strength weighting
- [ ] Implement confluence score calculation
- [ ] Validate calculations against manual analysis

### Phase 3: AI Integration (Month 5)

- [ ] Design LLM prompt templates
- [ ] Integrate LLM API (start with one provider)
- [ ] Implement response parsing
- [ ] A/B test different prompts
- [ ] Store analysis with version tracking

### Phase 4: API Development (Month 6)

- [ ] Build REST API endpoints
- [ ] Implement authentication
- [ ] Create response schemas
- [ ] Add caching layer
- [ ] Performance testing

### Phase 5: Production Hardening (Months 7-8)

- [ ] Implement monitoring and alerting
- [ ] Set up automated backups
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation

### Phase 6: Enhancement (Months 9-12)

- [ ] Add more symbols (horizontal scaling)
- [ ] Add more indicators (vertical scaling)
- [ ] Implement backtesting capability
- [ ] Add historical analysis dashboard
- [ ] Mobile app integration

---

## Appendix: Design Pattern References

### From "Native handling of SQL databases in MQL5"

1. **Transaction Pattern** - DatabaseTransactionBegin.mq5
   - Wrap bulk inserts in BEGIN/COMMIT
   - Use ROLLBACK on errors
   - Performance gain: 532x

2. **Prepared Statement Pattern** - DatabasePrepare.mq5
   - Compile queries once, execute many times
   - Automatic struct binding with DatabaseReadBind()
   - Security: prevents SQL injection

3. **Basic CRUD Pattern** - DatabaseRead.mq5
   - Open → Execute → Prepare → Read → Finalize → Close
   - Column access by index
   - Type-safe retrieval

### From "Part 297"

1. **Service Pattern** - db-update-statarb-0.1.mq5
   - Continuous loop with Sleep()
   - Graceful shutdown on IsStopped()
   - Retry logic with max attempts

2. **Schema Separation Pattern** - schema-0.1.sql
   - External SQL file for schema
   - Version tracking (0.1, 0.2, etc.)
   - STRICT mode for type safety

3. **Duplicate Prevention Pattern**
   - Check existence before insert
   - Idempotent operations
   - Composite primary keys

4. **Normalization Pattern**
   - Symbol master table
   - Foreign keys for relationships
   - CASCADE for automatic cleanup

---

## Document Versioning

| Version | Date       | Changes                     | Author |
| ------- | ---------- | --------------------------- | ------ |
| 1.0     | 2025-11-22 | Initial architecture design | System |

---

**End of Architecture Design Document**

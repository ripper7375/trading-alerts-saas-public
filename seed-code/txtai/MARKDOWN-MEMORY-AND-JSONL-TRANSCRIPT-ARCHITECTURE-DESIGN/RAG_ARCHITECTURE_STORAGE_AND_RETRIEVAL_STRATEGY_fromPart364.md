# RAG Architecture: Storage and Retrieval Strategy

## Trading Advisory System - Complete Design Reference

**Document Version**: 2.0  
**Date**: February 5, 2026  
**Purpose**: Comprehensive reference for RAG-based trading advisory system architecture covering storage strategy, data flow, retrieval engines, and fallback mechanisms.

**CRITICAL CONCEPT**: Symbol-Timeframe combinations (e.g., EURUSD-H4, EURUSD-H1) are treated as **independent trading instruments**. Each combination has unique OHLCV data, indicator values, market behavior, and trading context. Same symbol + different timeframe = different technical analysis and user context.

---

## Table of Contents

1. [Storage Strategy and Architecture](#1-storage-strategy-and-architecture)
2. [Databases and File System](#2-databases-and-file-system)
3. [Data Flow](#3-data-flow)
4. [Two-Engine Approach](#4-two-engine-approach)
5. [Graceful Fallback](#5-graceful-fallback)
6. [Implementation Guidelines](#6-implementation-guidelines)
7. [Performance Considerations](#7-performance-considerations)
8. [Quick Reference](#8-quick-reference)

---

## 1. Storage Strategy and Architecture

### 1.1 Core Principles

**Principle 1: Right Data, Right Storage**

- Time-series numerical data (OHLCV + Indicators) → PostgreSQL as **native columns** (optimized for range queries and aggregations)
  - **NO conversion to JSONB needed** - Both OHLCV and indicator values are structured, predictable data from MT5 data pipeline
  - Stored as separate columns with proper data types for SQL performance
- Static knowledge → Vector DB (optimized for semantic search)
- User profiles → Filesystem (human-readable, versionable)
- Audit trails → Filesystem (append-only, archivable)
- Ephemeral context → Generated on-demand, never stored

**Principle 2: Avoid Redundant Storage**

- Market commentary text is derived from numerical data → Generate on-demand
- Don't store what can be computed quickly (< 20ms)
- Don't embed what changes frequently (< 1 hour TTL)

**Principle 3: Optimize for Access Pattern**

- Hot data (recent 24 hours) → In-memory cache + PostgreSQL indexes
- Warm data (1-90 days) → PostgreSQL with standard indexes
- Cold data (> 90 days) → Compressed archives on filesystem

**Principle 4: Symbol-Timeframe Independence**

- Each symbol-timeframe pair (e.g., XAUUSD-H4, XAUUSD-H1) is an **independent trading instrument**
- Different timeframes have different: OHLCV values, indicator values, support/resistance levels, market commentary, trading behavior, and user context
- Database schema must support this independence with proper indexing on (symbol, timeframe, timestamp) tuples

### 1.2 Data Classification

```
┌─────────────────────────────────────────────────────────────┐
│                   DATA TAXONOMY                              │
└─────────────────────────────────────────────────────────────┘

A. MARKET DATA (High Frequency, Time-Series)
   ├── (1) Numerical Market Data
   │   ├── OHLCV bars
   │   ├── Technical indicators (ATR, ADX, RSI, etc.)
   │   ├── Support/resistance levels
   │   └── Volatility metrics
   │
   └── (2) Market Commentary Text
       ├── Generated on-demand from (1)
       ├── NOT stored
       └── Ephemeral (use once, discard)

B. KNOWLEDGE BASE (Low Frequency, Static)
   └── (3) Trading Knowledge
       ├── Strategy explanations
       ├── Indicator interpretations
       ├── Risk management principles
       └── Technical analysis concepts

C. USER-SPECIFIC DATA (Medium Frequency, Personal)
   └── (4) Markdown Memory
       ├── TRADER_PROFILE.md
       ├── BEHAVIORAL_*.md
       ├── RISK_WARNINGS.md
       └── PERFORMANCE_SUMMARY.md

D. AUDIT DATA (High Frequency, Compliance)
   └── (5) JSONL Transcripts
       ├── User queries
       ├── LLM responses
       ├── Tool calls
       └── System events
```

### 1.3 Storage Decision Matrix

| Data Type                  | Characteristics         | Storage        | Indexed?                                      | Update Frequency  |
| -------------------------- | ----------------------- | -------------- | --------------------------------------------- | ----------------- |
| **(1) OHLCV + Indicators** | Numerical, time-series  | PostgreSQL     | SQL indexes on (symbol, timeframe, timestamp) | Every 15 min      |
| **(2) Market Commentary**  | Text, derived           | **NOT STORED** | No                                            | On-demand only    |
| **(3) Trading Knowledge**  | Text, static            | Vector DB      | Vector embeddings                             | Rarely (curated)  |
| **(4) User Profiles**      | Text, semi-static       | Filesystem     | Vector embeddings                             | Weekly/Monthly    |
| **(5) Audit Logs**         | JSON Lines, append-only | Filesystem     | No (sequential)                               | Every interaction |

**Why PostgreSQL for OHLCV AND Indicator Values?**

- Both come from the same data pipeline (MT5 Contabo VPS terminals)
- SQL excels at time-series range queries
- Built-in aggregation functions (AVG, MAX, MIN, percentiles)
- ACID guarantees for data consistency
- Efficient indexing for temporal data
- No need to convert structured data to JSONB - use native columns for better query performance

### 1.4 Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     STORAGE ARCHITECTURE                        │
└────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   User Query    │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ PostgreSQL   │   │ Vector DB    │   │ Filesystem   │
│              │   │              │   │              │
│ (1) OHLCV +  │   │ (3) Trading  │   │ (4) Markdown │
│     Indicator│   │     Knowledge│   │     Profiles │
│     Values   │   │     Concepts │   │              │
│     15-min   │   │              │   │              │
│              │   │ [Embeddings] │   │ (5) JSONL    │
│ [Time-Series]│   │              │   │     Logs     │
│ [Native Cols]│   │              │   │              │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       │ SQL Query        │ Semantic Search  │ File Read
       │ (10ms)           │ (80ms)           │ (5ms)
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ (2) On-Demand         │
              │     Commentary        │
              │     Generator         │
              │     (3ms)             │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   LLM Context         │
              │   Assembly            │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   LLM Response        │
              │   (2000ms)            │
              └───────────────────────┘

Note: Both OHLCV and indicator values come from the same
      MT5 Contabo VPS data pipeline - stored together in
      PostgreSQL as native columns for optimal SQL performance.
```

---

## 2. Databases and File System

### 2.1 PostgreSQL Schema

#### 2.1.1 Market Data Tables

```sql
-- Table 1: OHLCV Data (Core Time-Series)
CREATE TABLE ohlcv_15m (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL DEFAULT '15m',
    timestamp TIMESTAMP NOT NULL,

    -- Price data
    open DECIMAL(20,5) NOT NULL,
    high DECIMAL(20,5) NOT NULL,
    low DECIMAL(20,5) NOT NULL,
    close DECIMAL(20,5) NOT NULL,
    volume BIGINT NOT NULL,

    -- Technical indicators (calculated)
    atr_value DECIMAL(20,5),
    atr_percentile INT, -- 0-100
    adx_value DECIMAL(10,2),
    rsi_value DECIMAL(10,2),

    -- Market regime classification
    trend_direction VARCHAR(10), -- 'UP', 'DOWN', 'RANGING'
    volatility_regime VARCHAR(20), -- 'LOW', 'MEDIUM', 'HIGH'
    swing_momentum VARCHAR(20), -- 'Over-Bought', 'Over-Sold', 'Neutral'

    -- Support/Resistance (JSONB for flexibility)
    support_levels JSONB,
    resistance_levels JSONB,

    -- Reversal signals
    reversal_probability VARCHAR(20), -- 'Likely', 'Possible', '---'

    -- Constraints
    CONSTRAINT unique_symbol_timestamp UNIQUE(symbol, timeframe, timestamp)
);

-- Essential indexes for sub-10ms queries
-- CRITICAL: Symbol + Timeframe is the combined key for independent trading instruments
CREATE INDEX idx_ohlcv_symbol_timeframe_time ON ohlcv_15m (symbol, timeframe, timestamp DESC);
CREATE INDEX idx_ohlcv_recent ON ohlcv_15m (symbol, timeframe, timestamp DESC)
    WHERE timestamp >= NOW() - INTERVAL '24 hours';

COMMENT ON TABLE ohlcv_15m IS 'Raw market data with calculated indicators - NO commentary text';
COMMENT ON COLUMN ohlcv_15m.atr_percentile IS 'Percentile rank for volatility regime detection';
COMMENT ON INDEX idx_ohlcv_symbol_timeframe_time IS 'Primary index for symbol-timeframe queries (e.g., XAUUSD H4)';
```

#### 2.1.2 User Metadata Tables

```sql
-- Table 2: User Profile Metadata (Pointers to Markdown Files)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id),

    -- Markdown file locations
    workspace_path VARCHAR(512) NOT NULL,
    -- e.g., '/home/workspace/users/{user_id}/markdown/'

    -- Tracking
    last_profile_update TIMESTAMP,
    last_behavioral_update TIMESTAMP,
    last_risk_warning_update TIMESTAMP,

    -- Metadata (not the actual content)
    total_trades_analyzed INT DEFAULT 0,
    profile_version INT DEFAULT 1,

    -- Index metadata for embeddings
    embeddings_last_updated TIMESTAMP,
    embeddings_version INT DEFAULT 1
);

CREATE INDEX idx_user_profiles_updates ON user_profiles (last_profile_update DESC);

COMMENT ON TABLE user_profiles IS 'Metadata pointing to Markdown files on filesystem';
```

#### 2.1.3 JSONL Session Registry

```sql
-- Table 3: JSONL Session Registry (Pointers to Log Files)
CREATE TABLE jsonl_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(64) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id),

    -- Session metadata
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    duration_seconds INT,
    session_type VARCHAR(50) NOT NULL,
    -- 'chat_query', 'upload_processing', 'background_analytics'

    -- JSONL file location
    jsonl_file_path VARCHAR(512) NOT NULL,
    -- e.g., '/home/logs/users/{user_id}/sessions/2026-02-05.jsonl'

    jsonl_file_size_bytes BIGINT,

    -- Session stats
    total_entries INT DEFAULT 0,
    query_count INT DEFAULT 0,
    tool_call_count INT DEFAULT 0,
    warning_count INT DEFAULT 0,

    -- Outcome tracking
    advice_given BOOLEAN DEFAULT false,
    advice_risk_level VARCHAR(20),

    -- Retention
    archive_after DATE,
    archived_at TIMESTAMP,
    archived_location VARCHAR(512)
);

CREATE INDEX idx_jsonl_user_sessions ON jsonl_sessions (user_id, started_at DESC);
CREATE INDEX idx_jsonl_archive ON jsonl_sessions (archive_after)
    WHERE archived_at IS NULL;

COMMENT ON TABLE jsonl_sessions IS 'Registry pointing to JSONL log files on filesystem';
```

### 2.2 Filesystem Structure

```
Storage Root: /home/trading-saas/

├── workspace/                          # User-specific data
│   └── users/
│       └── {user_id}/
│           ├── markdown/               # (4) User Profiles
│           │   ├── TRADER_PROFILE.md
│           │   ├── BEHAVIORAL_HIGH_VOLATILITY.md
│           │   ├── BEHAVIORAL_LOW_VOLATILITY.md
│           │   ├── RISK_WARNINGS.md
│           │   ├── PERFORMANCE_SUMMARY.md
│           │   └── LEARNING_NOTES.md
│           │
│           └── markdown_history/       # Versioned snapshots
│               ├── TRADER_PROFILE_2026-02-01.md
│               ├── TRADER_PROFILE_2026-01-15.md
│               └── ...
│
├── logs/                               # Audit trails
│   └── users/
│       └── {user_id}/
│           ├── sessions/               # (5) JSONL Transcripts
│           │   ├── 2026-02/
│           │   │   ├── 2026-02-06.jsonl
│           │   │   ├── 2026-02-05.jsonl
│           │   │   └── ...
│           │   └── 2026-01/
│           │       └── ...
│           │
│           ├── analytics/              # Processed insights
│           │   ├── behavioral_patterns.jsonl
│           │   ├── advice_outcomes.jsonl
│           │   ├── compliance_events.jsonl
│           │   └── quality_feedback.jsonl
│           │
│           └── archive/                # Compressed old logs
│               ├── 2025-12.jsonl.gz
│               └── ...
│
└── cache/                              # Optional: temporary cache
    └── market_commentary/
        ├── XAUUSD_H4_20260206_1430.txt  # 5-min TTL
        └── ...
```

### 2.3 Vector Database (Qdrant / Pinecone / Weaviate)

```
Collection: trading_knowledge (Static, Curated)

Schema:
├── id: string
├── text: string (chunk of trading knowledge)
├── embedding: vector[1536] (OpenAI ada-002 or similar)
├── metadata:
│   ├── category: 'strategy' | 'indicator' | 'risk_management' | 'concept'
│   ├── topic: string (e.g., 'support_resistance', 'position_sizing')
│   ├── difficulty: 'beginner' | 'intermediate' | 'advanced'
│   └── source: string (document source)

Example Entry:
{
  "id": "concept_support_001",
  "text": "Support levels are price zones where buying pressure...",
  "embedding": [0.234, -0.123, ...],
  "metadata": {
    "category": "concept",
    "topic": "support_resistance",
    "difficulty": "beginner",
    "source": "technical_analysis_handbook.pdf"
  }
}

Collection: user_profiles (Dynamic, Indexed from Markdown)

Schema:
├── id: string (user_id + file + chunk_id)
├── text: string (chunk from Markdown file)
├── embedding: vector[1536]
├── metadata:
│   ├── user_id: string
│   ├── file_name: string (e.g., 'TRADER_PROFILE.md')
│   ├── section: string (e.g., 'Position Sizing', 'Weaknesses')
│   ├── last_updated: timestamp
│   └── version: int

Example Entry:
{
  "id": "user_abc123_profile_chunk_01",
  "text": "Trader tends to oversize positions during high volatility...",
  "embedding": [0.456, -0.234, ...],
  "metadata": {
    "user_id": "abc123",
    "file_name": "BEHAVIORAL_HIGH_VOLATILITY.md",
    "section": "Weaknesses",
    "last_updated": "2026-02-01T14:30:00Z",
    "version": 3
  }
}
```

### 2.4 Storage Rationale

| Storage Type                                  | Why This Choice?                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL for OHLCV and Indicator Values** | - Both OHLCV and indicator values come from the same MT5 Contabo VPS data pipeline<br>- SQL excels at time-series range queries<br>- Built-in aggregation functions (AVG, MAX, MIN, percentiles)<br>- ACID guarantees for data consistency<br>- Efficient indexing for temporal data<br>- **No JSONB conversion needed** - use native columns for better performance |
| **Filesystem for Markdown Profiles**          | - Human-readable (can edit with any text editor)<br>- Easy versioning (copy files)<br>- Git-friendly for version control<br>- No database overhead for infrequent updates                                                                                                                                                                                            |
| **Filesystem for JSONL Logs**                 | - Append-only writes (O(1) performance)<br>- Easy compression for archives<br>- Standard format (any tool can parse)<br>- Cost-effective for 7-year retention<br>- Sequential access pattern ideal for audit logs                                                                                                                                                    |
| **Vector DB for Trading Knowledge**           | - Optimized for semantic similarity search<br>- Efficient nearest-neighbor algorithms (HNSW, IVF)<br>- Purpose-built for embeddings<br>- Scales to millions of vectors                                                                                                                                                                                               |

**Key Decision: Why NOT store market commentary as JSONB in PostgreSQL?**

- Market commentary is **derived** from OHLCV and indicator values
- Changes every 15 minutes with new data
- Can be regenerated on-demand in < 5ms
- Storing it would create redundancy and sync issues
- On-demand generation ensures commentary always matches current data

---

## 3. Data Flow

### 3.1 Query Processing Flow

```
┌────────────────────────────────────────────────────────────┐
│  USER QUERY: "Did XAUUSD H4 touch support with 80%+       │
│              confluence in the last 4 hours?"              │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 1. Query Parsing      │
              │                       │
              │ Extract:              │
              │ - Symbol: XAUUSD      │
              │ - Timeframe: H4       │
              │ - Time range: 4 hours │
              │ - Intent: Support test│
              │ - Metric: 80%+ conflu │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 2. Route to Engines   │
              │                       │
              │ Decision:             │
              │ ✓ Specific trading    │
              │   instruments         │
              │   → SQL Engine        │
              │ ✓ Technical concept   │
              │   → Vector Engine     │
              │ ✓ User context needed │
              │   → Markdown Engine   │
              └───────────┬───────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ ENGINE 1:    │  │ ENGINE 2:    │  │ ENGINE 3:    │
│ SQL Search   │  │ Vector Search│  │ Markdown Load│
│              │  │              │  │              │
│ Query:       │  │ Query:       │  │ Load:        │
│ SELECT *     │  │ "confluence  │  │ TRADER_      │
│ FROM ohlcv   │  │  support"    │  │ PROFILE.md   │
│ WHERE symbol │  │              │  │              │
│ = 'XAUUSD'   │  │ Returns:     │  │ Returns:     │
│ AND tf='H4'  │  │ - Support    │  │ - User's     │
│ LIMIT 16     │  │   concepts   │  │   baseline   │
│              │  │ - Confluence │  │ - Risk prefs │
│ Time: 10ms   │  │   definition │  │              │
│              │  │              │  │ Time: 5ms    │
│ Returns:     │  │ Time: 80ms   │  │              │
│ - 16 bars    │  │              │  │              │
│ - OHLC data  │  │              │  │              │
│ - Indicators │  │              │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                         ▼
          ┌──────────────────────────┐
          │ 3. Commentary Generation │
          │    (On-Demand)           │
          │                          │
          │ Input: 16 bars from SQL  │
          │                          │
          │ Process:                 │
          │ - Latest bar analysis    │
          │ - Support level check    │
          │ - Confluence calculation │
          │                          │
          │ Output:                  │
          │ "XAUUSD H4 touched       │
          │  support at 2040.15      │
          │  with 85% confluence     │
          │  (MA + Fib + Trendline)" │
          │                          │
          │ Time: 3ms                │
          │ Storage: NONE ✓          │
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │ 4. Context Assembly      │
          │                          │
          │ Combine:                 │
          │ ✓ Market commentary (3ms)│
          │ ✓ Trading concepts (80ms)│
          │ ✓ User profile (5ms)     │
          │                          │
          │ Total prep: ~88ms        │
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │ 5. LLM Processing        │
          │                          │
          │ System Prompt:           │
          │ "You are a trading       │
          │  advisor..."             │
          │                          │
          │ Context:                 │
          │ [Market Commentary]      │
          │ [Trading Concepts]       │
          │ [User Profile]           │
          │                          │
          │ User Query:              │
          │ "Did XAUUSD H4..."       │
          │                          │
          │ Time: 2000ms             │
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │ 6. Response Generation   │
          │                          │
          │ "Yes, XAUUSD H4 touched  │
          │  support at 2040.15 with │
          │  85% confluence from:    │
          │  - 50 EMA                │
          │  - 61.8% Fib level       │
          │  - Ascending trendline   │
          │                          │
          │  Based on your profile,  │
          │  this is a high-quality  │
          │  setup matching your     │
          │  risk parameters."       │
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │ 7. Audit Logging         │
          │                          │
          │ Append to:               │
          │ ~/logs/.../2026-02-06    │
          │         .jsonl           │
          │                          │
          │ Log entries:             │
          │ - User query             │
          │ - Market data fetched    │
          │ - Context loaded         │
          │ - LLM response           │
          │ - Risk assessment        │
          │                          │
          │ Update PostgreSQL:       │
          │ jsonl_sessions table     │
          │                          │
          │ Time: 5ms                │
          └──────────────────────────┘

Total Response Time: ~2100ms
├── Data retrieval: 88ms (SQL + Vector + Markdown)
├── Commentary gen: 3ms (on-demand)
├── LLM inference: 2000ms (majority of time)
└── Audit logging: 5ms
```

### 3.2 Upload Processing Flow

```
┌────────────────────────────────────────────────────────────┐
│  USER UPLOADS: MT5_History_2026-02.xlsx                    │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 1. File Validation    │
              │                       │
              │ - Check file format   │
              │ - Validate columns    │
              │ - Calculate SHA-256   │
              │ - Check duplicates    │
              │                       │
              │ Log to JSONL:         │
              │ session_type:         │
              │ 'upload_processing'   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 2. Parse Trades       │
              │                       │
              │ Extract:              │
              │ - Entry/exit times    │
              │ - Prices              │
              │ - Volume (lots)       │
              │ - P/L                 │
              │ - Symbol              │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 3. Store to PostgreSQL│
              │                       │
              │ INSERT INTO trades    │
              │ - Raw trade data      │
              │                       │
              │ UPDATE upload_history │
              │ - Processing status   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 4. Enrich with Market │
              │    Context            │
              │                       │
              │ For each trade:       │
              │ - Query OHLCV at time │
              │ - Get ATR percentile  │
              │ - Determine regime    │
              │                       │
              │ UPDATE trades         │
              │ SET market_regime...  │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 5. Behavioral Analysis│
              │                       │
              │ Calculate:            │
              │ - Win rate by regime  │
              │ - Position sizing     │
              │   patterns            │
              │ - Risk/reward ratios  │
              │ - Time-of-day prefs   │
              │                       │
              │ Detect:               │
              │ - Revenge trading     │
              │ - Overtrading         │
              │ - Drift from baseline │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 6. Generate Markdown  │
              │                       │
              │ Create/Update:        │
              │ - TRADER_PROFILE.md   │
              │ - BEHAVIORAL_*.md     │
              │ - RISK_WARNINGS.md    │
              │                       │
              │ Save to:              │
              │ ~/workspace/users/    │
              │ {user_id}/markdown/   │
              │                       │
              │ Backup previous:      │
              │ Copy to markdown_     │
              │ history/              │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 7. Update Embeddings  │
              │                       │
              │ - Read Markdown files │
              │ - Chunk into sections │
              │ - Generate embeddings │
              │ - Upsert to Vector DB │
              │                       │
              │ Update metadata:      │
              │ user_profiles table   │
              │ - embeddings_last_    │
              │   updated             │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 8. Complete & Log     │
              │                       │
              │ Return to user:       │
              │ - Upload ID           │
              │ - Trades parsed       │
              │ - Warnings detected   │
              │ - Profile updated     │
              │                       │
              │ Final JSONL entry:    │
              │ - processing_status:  │
              │   'completed'         │
              │ - total_trades: N     │
              │ - duration_ms: X      │
              └───────────────────────┘

Total Upload Processing: 5-30 seconds
├── Validation: 500ms
├── Parse & store: 2-10s (depends on trade count)
├── Enrichment: 1-5s (market data lookups)
├── Analysis: 1-3s (behavioral calculations)
├── Markdown gen: 500ms
└── Embedding update: 1-10s (depends on changes)
```

### 3.3 Background Analytics Flow

```
┌────────────────────────────────────────────────────────────┐
│  SCHEDULED JOB: Daily Analytics (runs at 2 AM)             │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 1. Load Recent JSONL  │
              │                       │
              │ Read all sessions:    │
              │ - Last 24 hours       │
              │ - All users           │
              │                       │
              │ Parse entries for:    │
              │ - User queries        │
              │ - Advice given        │
              │ - Warnings issued     │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 2. Pattern Mining     │
              │                       │
              │ Detect sequences:     │
              │ - Revenge trading     │
              │   (loss → sizing query│
              │    within 30 min)     │
              │                       │
              │ - Analysis paralysis  │
              │   (5+ questions before│
              │    trade)             │
              │                       │
              │ - Ignored warnings    │
              │   (critical warning → │
              │    no acknowledge)    │
              │                       │
              │ Save to:              │
              │ ~/logs/.../analytics/ │
              │ behavioral_patterns   │
              │ .jsonl                │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 3. Advice Attribution │
              │                       │
              │ Link advice → outcomes│
              │                       │
              │ For each advice:      │
              │ - Find next trade     │
              │   (within 2 hours)    │
              │ - Check if followed   │
              │ - Calculate outcome   │
              │                       │
              │ Store to:             │
              │ advice_outcomes table │
              │ (PostgreSQL)          │
              │                       │
              │ Also log to:          │
              │ advice_outcomes.jsonl │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 4. Update Markdown    │
              │                       │
              │ If critical patterns: │
              │ - Update RISK_        │
              │   WARNINGS.md         │
              │ - Add pattern evidence│
              │ - Increment severity  │
              │                       │
              │ If behavioral change: │
              │ - Update BEHAVIORAL_  │
              │   *.md                │
              │ - Reflect new patterns│
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 5. Archive Old Logs   │
              │                       │
              │ Compress:             │
              │ - JSONL > 90 days old │
              │ - Create .jsonl.gz    │
              │ - Move to archive/    │
              │                       │
              │ Update registry:      │
              │ jsonl_sessions table  │
              │ - archived_at         │
              │ - archived_location   │
              └───────────┬───────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ 6. Platform Analytics │
              │                       │
              │ Aggregate (anonymous):│
              │ - Common patterns     │
              │ - Advice effectiveness│
              │ - Query types         │
              │                       │
              │ Store to:             │
              │ platform_metrics.jsonl│
              │                       │
              │ Use for:              │
              │ - System improvement  │
              │ - Feature development │
              └───────────────────────┘
```

---

## 4. Two-Engine Approach

### 4.1 Engine Overview

```
┌────────────────────────────────────────────────────────────┐
│                   RETRIEVAL ENGINES                         │
└────────────────────────────────────────────────────────────┘

ENGINE 1: SQL Search
├── Purpose: Fetch specific market data
├── Input: Symbol + Timeframe + Date range (symbol-timeframe is COMBINED KEY)
├── Query: SELECT * FROM ohlcv_15m WHERE symbol=$1 AND timeframe=$2 AND ...
├── Speed: 5-20ms
├── Output: Numerical data → On-demand commentary
├── CRITICAL: Same symbol + different timeframe = different data/behavior
└── Use case: "What's XAUUSD H4 doing now?" vs "What's XAUUSD H1 doing?"

ENGINE 2: Semantic Search
├── Purpose: Find relevant knowledge/context
├── Input: Natural language query
├── Query: Vector similarity search
├── Speed: 50-150ms
├── Output: Text chunks with context
└── Use case: "How to use RSI divergence?"

ENGINE 2a: Vector DB (Static Knowledge)
├── Collection: trading_knowledge
├── Content: Strategies, concepts, principles
├── Update: Rarely (curated)
├── Examples:
│   ├── "Support and resistance explained"
│   ├── "Position sizing formulas"
│   └── "Risk management rules"

ENGINE 2b: Markdown Search (User Context)
├── Collection: user_profiles
├── Content: User-specific patterns, preferences
├── Update: Weekly/Monthly
├── Examples:
│   ├── "User tends to overtrade in high volatility"
│   ├── "Win rate: 65% in ranging markets"
│   └── "Preferred symbols: XAUUSD, EURUSD"
```

### 4.2 Query Routing Logic

```typescript
// Intelligent routing based on query characteristics

interface QueryAnalysis {
  hasSymbol: boolean;
  hasTimeframe: boolean;
  hasDateRange: boolean;
  isConceptual: boolean;
  needsUserContext: boolean;
}

function analyzeQuery(query: string): QueryAnalysis {
  return {
    hasSymbol: /\b(XAUUSD|EURUSD|BTCUSD|US30)\b/i.test(query),
    hasTimeframe: /\b(M5|M15|M30|H1|H2|H4|H8|H12|D1)\b/i.test(query),
    hasDateRange: /\b(today|yesterday|last|week|month)\b/i.test(query),
    isConceptual: /\b(how|what|why|explain|define)\b/i.test(query),
    needsUserContext: /\b(my|I|should I|for me)\b/i.test(query),
  };
}

async function routeQuery(query: string, userId: string) {
  const analysis = analyzeQuery(query);

  const engines = {
    sql: false,
    vectorKnowledge: false,
    vectorUser: false,
    markdownLoad: false,
  };

  // CRITICAL DECISION POINT: Symbol + Timeframe routing
  // Same symbol + different timeframe = different technical context

  // Engine 1: SQL (specific symbol + timeframe data)
  if (analysis.hasSymbol && analysis.hasTimeframe) {
    // Both symbol AND timeframe specified → SQL Engine
    engines.sql = true;
  } else if (analysis.hasSymbol && !analysis.hasTimeframe) {
    // Symbol without timeframe → requires clarification or fallback
    // Will trigger fallback scenario in graceful degradation
  }

  // Engine 2a: Vector DB (general concepts or technical questions)
  if (analysis.isConceptual || !analysis.hasSymbol) {
    engines.vectorKnowledge = true;
  }

  // Engine 2b: Markdown (user-specific context)
  if (analysis.needsUserContext) {
    engines.markdownLoad = true;
  }

  return engines;
}

// Example queries with routing decisions:

// Query 1: "Did XAUUSD H4 touch support today?"
// Parsed: Symbol=XAUUSD, Timeframe=H4, Intent=Support test, Metric=touch
// Route: { sql: true, vectorKnowledge: true, markdownLoad: false }
// Explanation: Need XAUUSD-H4 specific data + support concept definition

// Query 2: "Compare XAUUSD H4 vs XAUUSD H1"
// Parsed: Symbol=XAUUSD, Timeframes=[H4, H1]
// Route: Multiple SQL calls (H4 and H1 are different instruments)
// Explanation: Each timeframe requires separate data retrieval

// Query 3: "Should I increase position size?"
// Parsed: No symbol, No timeframe, User context needed
// Route: { sql: false, vectorKnowledge: true, markdownLoad: true }
// Explanation: Need position sizing principles + user's risk profile

// Query 4: "What is RSI divergence?"
// Parsed: Conceptual query, No symbol/timeframe
// Route: { sql: false, vectorKnowledge: true, markdownLoad: false }
// Explanation: Pure conceptual query, no user context needed

// Query 5: "How's XAUUSD doing?" (missing timeframe)
// Parsed: Symbol=XAUUSD, Timeframe=NONE
// Route: Triggers fallback - either ask for timeframe or show multiple timeframes
// Explanation: Need timeframe to fetch specific data
```

### 4.3 Implementation: SQL Engine

```typescript
// Engine 1: SQL Search with On-Demand Commentary

class SQLEngine {
  async search(params: {
    symbol: string;
    timeframe: string;
    barsBack?: number;
  }): Promise<MarketContext> {
    const { symbol, timeframe, barsBack = 16 } = params;

    // 1. SQL query (5-20ms)
    const result = await db.query(
      `
      SELECT 
        timestamp,
        open, high, low, close, volume,
        atr_value, atr_percentile,
        adx_value,
        rsi_value,
        trend_direction,
        volatility_regime,
        swing_momentum,
        support_levels,
        resistance_levels,
        reversal_probability
      FROM ohlcv_15m
      WHERE symbol = $1
        AND timeframe = $2
        AND timestamp >= NOW() - INTERVAL '${barsBack * 15} minutes'
      ORDER BY timestamp DESC
      LIMIT $3
    `,
      [symbol, timeframe, barsBack]
    );

    if (result.rows.length === 0) {
      throw new Error(`No data found for ${symbol} ${timeframe}`);
    }

    const bars = result.rows;
    const latest = bars[0];

    // 2. Generate commentary on-demand (2-5ms)
    const commentary = this.generateCommentary(latest, bars.slice(1));

    // 3. Return structured context
    return {
      symbol,
      timeframe,
      timestamp: latest.timestamp,
      price: latest.close,

      // Commentary (NOT stored anywhere)
      narrative: commentary,

      // Raw data (for advanced queries)
      raw_bars: bars,

      // Key levels
      support: latest.support_levels,
      resistance: latest.resistance_levels,

      // Current regime
      regime: {
        trend: latest.trend_direction,
        volatility: latest.volatility_regime,
        momentum: latest.swing_momentum,
      },
    };
  }

  private generateCommentary(current: OHLCVBar, history: OHLCVBar[]): string {
    const parts: string[] = [];

    // Trend
    if (current.trend_direction === 'UP') {
      const strength = this.getTrendStrength(current.adx_value);
      parts.push(
        `${current.symbol} ${current.timeframe} is in a ${strength} uptrend ` +
          `(ADX: ${current.adx_value})`
      );
    } else if (current.trend_direction === 'DOWN') {
      const strength = this.getTrendStrength(current.adx_value);
      parts.push(
        `${current.symbol} ${current.timeframe} is in a ${strength} downtrend ` +
          `(ADX: ${current.adx_value})`
      );
    } else {
      parts.push(
        `${current.symbol} ${current.timeframe} is ranging with no clear trend ` +
          `(ADX: ${current.adx_value})`
      );
    }

    // Momentum
    if (current.swing_momentum === 'Over-Bought') {
      const duration = this.countConsecutive(
        history,
        'swing_momentum',
        'Over-Bought'
      );
      parts.push(`Over-bought for ${duration} bars`);
    } else if (current.swing_momentum === 'Over-Sold') {
      const duration = this.countConsecutive(
        history,
        'swing_momentum',
        'Over-Sold'
      );
      parts.push(`Over-sold for ${duration} bars`);
    }

    // Volatility
    if (current.atr_percentile > 80) {
      parts.push(
        `Extremely high volatility (${current.atr_percentile}th percentile)`
      );
    } else if (current.atr_percentile < 20) {
      parts.push(
        `Very low volatility (${current.atr_percentile}th percentile)`
      );
    }

    // Reversals
    if (current.reversal_probability === 'Likely') {
      parts.push('Reversal signals appearing');
    }

    // Price levels
    const nearSupport = this.checkProximity(
      current.close,
      current.support_levels
    );
    const nearResistance = this.checkProximity(
      current.close,
      current.resistance_levels
    );

    if (nearResistance) {
      parts.push(`Approaching resistance at ${nearResistance}`);
    } else if (nearSupport) {
      parts.push(`Near support at ${nearSupport}`);
    }

    return parts.join('. ') + '.';
  }

  private getTrendStrength(adx: number): string {
    if (adx > 35) return 'strong';
    if (adx > 20) return 'moderate';
    return 'weak';
  }
}
```

### 4.4 Implementation: Vector Engine

```typescript
// Engine 2: Semantic Search (Knowledge + User Context)

class VectorEngine {
  // Search static trading knowledge
  async searchKnowledge(
    query: string,
    limit: number = 5
  ): Promise<KnowledgeChunk[]> {
    const results = await vectorDB.search({
      collection: 'trading_knowledge',
      query,
      limit,
      filter: {
        // Optional: filter by topic, difficulty, etc.
      },
    });

    return results.map((r) => ({
      text: r.text,
      relevance: r.score,
      metadata: r.metadata,
    }));
  }

  // Search user-specific context (Markdown embeddings)
  async searchUserContext(
    userId: string,
    query: string,
    limit: number = 3
  ): Promise<UserContextChunk[]> {
    const results = await vectorDB.search({
      collection: 'user_profiles',
      query,
      limit,
      filter: {
        user_id: userId,
      },
    });

    return results.map((r) => ({
      text: r.text,
      relevance: r.score,
      source_file: r.metadata.file_name,
      section: r.metadata.section,
      last_updated: r.metadata.last_updated,
    }));
  }

  // Combined search (knowledge + user context)
  async searchCombined(
    userId: string,
    query: string
  ): Promise<CombinedContext> {
    const [knowledge, userContext] = await Promise.all([
      this.searchKnowledge(query, 5),
      this.searchUserContext(userId, query, 3),
    ]);

    return {
      general_knowledge: knowledge,
      user_specific: userContext,
    };
  }
}
```

### 4.5 Complete Query Handler

```typescript
// Orchestrate all engines

async function handleQuery(userId: string, query: string): Promise<string> {
  // 1. Analyze query
  const analysis = analyzeQuery(query);
  const routing = await routeQuery(query, userId);

  // 2. Parallel data fetching
  const contexts: any = {};

  // SQL Engine (if specific symbol mentioned)
  if (routing.sql) {
    const symbolInfo = extractSymbolAndTimeframe(query);
    if (symbolInfo) {
      contexts.market = await sqlEngine.search({
        symbol: symbolInfo.symbol,
        timeframe: symbolInfo.timeframe,
      });
    }
  }

  // Vector Engine (general knowledge)
  if (routing.vectorKnowledge) {
    contexts.knowledge = await vectorEngine.searchKnowledge(query);
  }

  // Vector Engine (user context)
  if (routing.vectorUser) {
    contexts.userContext = await vectorEngine.searchUserContext(userId, query);
  }

  // 3. Assemble LLM context
  const systemPrompt = buildSystemPrompt();
  const contextText = assembleContext(contexts);

  // 4. LLM generation
  const response = await llm.generate({
    system: systemPrompt,
    context: contextText,
    query: query,
  });

  // 5. Log to JSONL
  await jsonlLogger.log({
    type: 'user_query',
    content: query,
    routing: routing,
    contexts_loaded: Object.keys(contexts),
  });

  await jsonlLogger.log({
    type: 'assistant_response',
    content: response,
    model_used: 'claude-opus-4',
  });

  return response;
}

function assembleContext(contexts: any): string {
  const parts: string[] = [];

  // Market data (if available)
  if (contexts.market) {
    parts.push('# Current Market Conditions\n');
    parts.push(contexts.market.narrative);
    parts.push('\n');
  }

  // General knowledge (if available)
  if (contexts.knowledge && contexts.knowledge.length > 0) {
    parts.push('# Trading Concepts\n');
    contexts.knowledge.forEach((chunk: any, i: number) => {
      parts.push(`## Concept ${i + 1}\n${chunk.text}\n`);
    });
    parts.push('\n');
  }

  // User context (if available)
  if (contexts.userContext && contexts.userContext.length > 0) {
    parts.push('# Trader Profile\n');
    contexts.userContext.forEach((chunk: any, i: number) => {
      parts.push(`## ${chunk.section}\n${chunk.text}\n`);
    });
  }

  return parts.join('\n');
}
```

---

## 5. Graceful Fallback

### 5.1 Fallback Scenarios

**Available Timeframes in Database**: M5, M15, M30, H1, H2, H4, H8, H12, D1

```
SCENARIO 1: No Symbol in Query and/or NO Timeframe
├── Query: "How's the market today?" or "What's EURUSD doing?"
├── Problem: No specific symbol to query OR missing timeframe specification
├── Sub-cases:
│   ├── 1a: No symbol at all → Query major symbols (XAUUSD, EURUSD, US30, BTCUSD)
│   └── 1b: Has symbol but no timeframe → Ask for timeframe or show multiple
├── Fallback: Query major markets or request clarification
└── Response: Broad market overview or "Which timeframe? (H1, H4, D1)"

SCENARIO 2: Symbol Not in Database and/or Have Symbol in Database but Timeframe Not in Database
├── Query: "What's AAPL doing?" or "EURUSD M1 analysis"
├── Problem: Symbol not supported OR timeframe not available
├── Sub-cases:
│   ├── 2a: Symbol completely missing (e.g., stocks) → Only forex/crypto in DB
│   └── 2b: Symbol exists but requested timeframe unavailable (e.g., M1, W1)
├── Available timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1
├── Fallback: Use general knowledge + external data source OR suggest available timeframes
└── Response: "I don't have real-time data for AAPL, but..." or
              "M1 not available, try H1 or H4 instead"

SCENARIO 3: No Recent Data
├── Query: "XAUUSD H4 analysis"
├── Problem: Last update was 2 hours ago (data gap)
├── Fallback: Use last available data with disclaimer
└── Response: "Based on last update at 14:00 UTC..."

SCENARIO 4: Conceptual Query Only
├── Query: "What is RSI?"
├── Problem: No market data needed
├── Fallback: Vector search only (skip SQL)
└── Response: Pure educational content from trading knowledge base

SCENARIO 5: Ambiguous Query
├── Query: "Should I trade?"
├── Problem: Missing context (what symbol? what timeframe? when?)
├── Fallback: Use user profile + ask clarifying questions
└── Response: "Based on your profile... Which symbol-timeframe? (e.g., XAUUSD H4)"
```

### 5.2 Implementation: Fallback Logic

```typescript
class FallbackHandler {
  // Available timeframes in database
  private readonly AVAILABLE_TIMEFRAMES = [
    'M5',
    'M15',
    'M30',
    'H1',
    'H2',
    'H4',
    'H8',
    'H12',
    'D1',
  ];
  private readonly MAJOR_SYMBOLS = ['XAUUSD', 'EURUSD', 'US30', 'BTCUSD'];

  async handleQuery(userId: string, query: string): Promise<QueryResult> {
    try {
      // Try primary flow
      return await primaryQueryHandler(userId, query);
    } catch (error) {
      // Determine fallback strategy
      return await this.selectFallback(userId, query, error);
    }
  }

  private async selectFallback(
    userId: string,
    query: string,
    error: Error
  ): Promise<QueryResult> {
    const analysis = analyzeQuery(query);

    // Fallback 1a: No symbol → Use major markets
    if (!analysis.hasSymbol) {
      return await this.majorMarketsOverview(userId);
    }

    // Fallback 1b: Has symbol but no timeframe → Request clarification
    if (analysis.hasSymbol && !analysis.hasTimeframe) {
      return await this.requestTimeframeClarity(userId, query);
    }

    // Fallback 2a: Symbol not found → External data
    if (error.message.includes('No data found for symbol')) {
      return await this.externalDataFallback(userId, query);
    }

    // Fallback 2b: Timeframe not available → Suggest alternatives
    if (error.message.includes('Timeframe not available')) {
      return await this.suggestAvailableTimeframes(userId, query);
    }

    // Fallback 3: Data too old → Use last available
    if (error.message.includes('stale data')) {
      return await this.staleDataFallback(userId, query);
    }

    // Fallback 4: Conceptual → Knowledge base only
    if (analysis.isConceptual) {
      return await this.knowledgeOnlyFallback(query);
    }

    // Fallback 5: Ambiguous → User context + clarification
    return await this.clarificationFallback(userId, query);
  }

  // Fallback 1a: Major Markets Overview
  private async majorMarketsOverview(userId: string): Promise<QueryResult> {
    // Fetch all major markets in parallel (fast)
    const contexts = await Promise.all(
      this.MAJOR_SYMBOLS.map(
        (symbol) =>
          sqlEngine
            .search({
              symbol,
              timeframe: 'H4', // Default to H4 for overview
              barsBack: 4,
            })
            .catch(() => null) // Skip if missing
      )
    );

    const validContexts = contexts.filter((c) => c !== null);

    if (validContexts.length === 0) {
      // No data at all - use general sentiment from vector DB
      return await this.vectorOnlyFallback(userId);
    }

    // Generate broad market overview
    const overview = this.generateMarketOverview(validContexts);

    const response = await llm.generate({
      system: 'You are a market analyst providing a broad market overview.',
      context: overview,
      query: 'Provide a general market sentiment summary.',
    });

    return {
      response,
      fallback_used: 'major_markets_overview',
      data_sources: validContexts.map((c) => `${c.symbol}-${c.timeframe}`),
    };
  }

  // Fallback 1b: Request Timeframe Clarification
  private async requestTimeframeClarity(
    userId: string,
    query: string
  ): Promise<QueryResult> {
    const symbolMatch = query.match(/\b(XAUUSD|EURUSD|BTCUSD|US30)\b/i);
    const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : 'this symbol';

    return {
      response:
        `I need to know which timeframe you want to analyze for ${symbol}. ` +
        `Available timeframes: ${this.AVAILABLE_TIMEFRAMES.join(', ')}. ` +
        `For example, "${symbol} H4" or "${symbol} D1".`,
      fallback_used: 'missing_timeframe',
      needs_clarification: true,
      symbol: symbol,
    };
  }

  // Fallback 2a: External Data Source
  private async externalDataFallback(
    userId: string,
    query: string
  ): Promise<QueryResult> {
    // Extract symbol
    const symbolMatch = query.match(/\b([A-Z]{3,6})\b/);
    const symbol = symbolMatch ? symbolMatch[1] : null;

    if (!symbol) {
      return await this.clarificationFallback(userId, query);
    }

    // Try external API (e.g., Yahoo Finance, Alpha Vantage)
    try {
      const externalData = await fetchExternalData(symbol);

      const response = await llm.generate({
        system: 'You have access to external market data.',
        context: `External data for ${symbol}: ${JSON.stringify(externalData)}`,
        query: query,
        note: 'Note: This data is from an external source, not our primary database.',
      });

      return {
        response: response + '\n\n*Note: Data from external source.*',
        fallback_used: 'external_data_source',
        external_symbol: symbol,
      };
    } catch (externalError) {
      // Can't get external data either
      return {
        response:
          `I don't have data for ${symbol} in my database, and I'm unable to fetch it from external sources. ` +
          `My database covers: ${this.MAJOR_SYMBOLS.join(', ')}. Would you like information on any of these?`,
        fallback_used: 'no_data_available',
        error: 'Symbol not in database and external fetch failed',
      };
    }
  }

  // Fallback 2b: Suggest Available Timeframes
  private async suggestAvailableTimeframes(
    userId: string,
    query: string
  ): Promise<QueryResult> {
    const symbolMatch = query.match(/\b(XAUUSD|EURUSD|BTCUSD|US30)\b/i);
    const timeframeMatch = query.match(/\b(M1|M3|W1|MN)\b/i);

    const symbol = symbolMatch ? symbolMatch[1].toUpperCase() : 'the symbol';
    const requestedTF = timeframeMatch ? timeframeMatch[1] : 'that timeframe';

    return {
      response:
        `I don't have ${requestedTF} data for ${symbol}. ` +
        `Available timeframes: ${this.AVAILABLE_TIMEFRAMES.join(', ')}. ` +
        `Would you like to see the H4 or D1 analysis instead?`,
      fallback_used: 'timeframe_not_available',
      available_timeframes: this.AVAILABLE_TIMEFRAMES,
      requested_timeframe: requestedTF,
      symbol: symbol,
    };
  }

  // Fallback 3: Stale Data with Disclaimer
  private async staleDataFallback(
    userId: string,
    query: string
  ): Promise<QueryResult> {
    const symbolInfo = extractSymbolAndTimeframe(query);

    // Get last available data (no time filter)
    const staleData = await db.query(
      `
      SELECT * FROM ohlcv_15m
      WHERE symbol = $1 AND timeframe = $2
      ORDER BY timestamp DESC
      LIMIT 16
    `,
      [symbolInfo.symbol, symbolInfo.timeframe]
    );

    if (staleData.rows.length === 0) {
      return await this.externalDataFallback(userId, query);
    }

    const lastUpdate = staleData.rows[0].timestamp;
    const ageMinutes = Math.floor(
      (Date.now() - new Date(lastUpdate).getTime()) / 60000
    );

    const commentary = sqlEngine.generateCommentary(
      staleData.rows[0],
      staleData.rows.slice(1)
    );

    const response = await llm.generate({
      system: 'Provide analysis but note data age.',
      context: commentary,
      query: query,
      disclaimer: `Last data update was ${ageMinutes} minutes ago at ${lastUpdate}`,
    });

    return {
      response:
        `⚠️ *Note: Using data from ${ageMinutes} minutes ago*\n\n` + response,
      fallback_used: 'stale_data',
      data_age_minutes: ageMinutes,
    };
  }

  // Fallback 4: Knowledge Base Only (Conceptual Query)
  private async knowledgeOnlyFallback(query: string): Promise<QueryResult> {
    // Pure vector search - no SQL needed
    const knowledge = await vectorEngine.searchKnowledge(query, 5);

    if (knowledge.length === 0) {
      return {
        response:
          "I don't have information about that topic. Could you rephrase or ask about common trading concepts?",
        fallback_used: 'no_knowledge_found',
      };
    }

    const response = await llm.generate({
      system: 'You are a trading educator.',
      context: knowledge.map((k) => k.text).join('\n\n'),
      query: query,
    });

    return {
      response,
      fallback_used: 'knowledge_base_only',
      sources: knowledge.length,
    };
  }

  // Fallback 5: Clarification Needed
  private async clarificationFallback(
    userId: string,
    query: string
  ): Promise<QueryResult> {
    // Load user context to make smart suggestions
    const userContext = await vectorEngine.searchUserContext(userId, query, 3);

    const response = await llm.generate({
      system: 'Ask clarifying questions based on user context.',
      context: userContext.map((c) => c.text).join('\n'),
      query: query,
      instruction:
        'The query is ambiguous. Ask specific clarifying questions about symbol, timeframe, or intent.',
    });

    return {
      response,
      fallback_used: 'clarification_needed',
      requires_followup: true,
    };
  }

  // Last resort: Vector-only fallback
  private async vectorOnlyFallback(userId: string): Promise<QueryResult> {
    const generalSentiment = await vectorEngine.searchKnowledge(
      'general market sentiment analysis',
      3
    );

    const response = await llm.generate({
      system: 'Provide general market commentary.',
      context: generalSentiment.map((k) => k.text).join('\n'),
      query: 'What is the general market sentiment?',
      note: 'Real-time data is temporarily unavailable.',
    });

    return {
      response: '⚠️ *Real-time data temporarily unavailable*\n\n' + response,
      fallback_used: 'vector_only',
      disclaimer: 'General knowledge only, no live data',
    };
  }
}
```

### 5.3 Fallback Decision Tree

```
User Query Received
        │
        ▼
   Parse Query
        │
        ├─────────────────────────────────────┐
        │                                     │
    Has Symbol?                           No Symbol?
        │                                     │
        ▼                                     ▼
  Query Database                    Fallback 1:
        │                           Major Markets
        │                           Overview
    Data Found? ──────No──────┐            │
        │                     │            ▼
       Yes                    ▼       Generate Broad
        │              Fallback 2:    Market Summary
        ▼              External API
  Data Fresh?               │
        │                  │
    Age < 30min?           │
        │                 │
       Yes               No
        │                │
        ▼                ▼
   Primary Flow    Fallback 3:
   (SQL Engine)    Stale Data
        │           with Disclaimer
        │                │
        │                │
        └────────┬───────┘
                 │
                 ▼
          Vector Search
                 │
         Has Embeddings?
                 │
             ┌───┴───┐
            Yes     No
             │       │
             ▼       ▼
        LLM Gen  Fallback 4:
                 Knowledge Only
                      │
                      ▼
                 Still Ambiguous?
                      │
                     Yes
                      │
                      ▼
                 Fallback 5:
                 Clarification
```

---

## 6. Implementation Guidelines

### 6.1 Setup Checklist

**PostgreSQL**

- [ ] Create database with proper encoding (UTF-8)
- [ ] Deploy schema (OHLCV, indicators, users, sessions)
- [ ] Create indexes (symbol+timestamp, recent data)
- [ ] Set up partitioning for OHLCV (optional, for scale)
- [ ] Configure backup schedule (daily incremental)

**Filesystem**

- [ ] Create directory structure (`/workspace`, `/logs`)
- [ ] Set permissions (app user read/write)
- [ ] Configure backup schedule (daily, exclude cache)
- [ ] Set up log rotation for JSONL (gzip after 90 days)

**Vector Database**

- [ ] Choose provider (Qdrant, Pinecone, Weaviate)
- [ ] Create collections (trading_knowledge, user_profiles)
- [ ] Configure indexes (HNSW or similar)
- [ ] Set up API authentication
- [ ] Populate initial trading knowledge

**Application**

- [ ] Implement SQLEngine class
- [ ] Implement VectorEngine class
- [ ] Implement FallbackHandler class
- [ ] Implement JSONLLogger class
- [ ] Implement MarketCommentaryGenerator
- [ ] Configure LLM provider (Anthropic, OpenAI)

### 6.2 Performance Tuning

```typescript
// Cache hot data in-memory

class PerformanceCache {
  private marketCache = new Map<string, CachedData>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async getOrFetch(
    symbol: string,
    timeframe: string,
    fetcher: () => Promise<any>
  ): Promise<any> {
    const key = `${symbol}_${timeframe}`;
    const cached = this.marketCache.get(key);

    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const fresh = await fetcher();
    this.marketCache.set(key, {
      data: fresh,
      expires: Date.now() + this.TTL,
    });

    return fresh;
  }

  // Warm cache on startup for popular symbols
  async warmup() {
    const popular = ['XAUUSD', 'EURUSD', 'BTCUSD', 'US30'];
    await Promise.all(
      popular.map((symbol) =>
        this.getOrFetch(symbol, 'H4', () =>
          sqlEngine.search({ symbol, timeframe: 'H4' })
        )
      )
    );
  }
}
```

### 6.3 Monitoring Metrics

```typescript
// Track system health

interface Metrics {
  // Query performance
  sql_query_latency_p50: number;
  sql_query_latency_p95: number;
  vector_search_latency_p50: number;
  vector_search_latency_p95: number;
  llm_generation_latency_p50: number;

  // Fallback rates
  fallback_major_markets_rate: number;
  fallback_external_api_rate: number;
  fallback_stale_data_rate: number;
  fallback_clarification_rate: number;

  // Data freshness
  avg_data_age_minutes: number;
  max_data_age_minutes: number;

  // Cache hit rates
  cache_hit_rate: number;

  // Storage
  jsonl_size_mb: number;
  markdown_size_mb: number;
  postgres_size_gb: number;
}

// Alert thresholds
const ALERTS = {
  sql_latency_p95: 50, // ms
  vector_latency_p95: 200, // ms
  fallback_rate: 0.1, // 10%
  max_data_age: 60, // minutes
  cache_hit_rate: 0.7, // 70%
};
```

---

## 7. Performance Considerations

### 7.1 Latency Budget

```
Target: < 2500ms total response time

Breakdown:
├── SQL query:           5-20ms    (0.8%)
├── Commentary gen:      2-5ms     (0.2%)
├── Vector search:       50-150ms  (6%)
├── Markdown load:       5-15ms    (0.6%)
├── Context assembly:    10-20ms   (0.8%)
├── LLM inference:       2000ms    (80%)
└── JSONL logging:       5-10ms    (0.4%)

Total: ~2100ms (within budget)

Optimization priorities:
1. LLM (80% of time) - Use streaming, caching
2. Vector search (6%) - Optimize index, reduce limit
3. Everything else (14%) - Already fast enough
```

### 7.2 Scalability Metrics

```
Current Architecture Capacity:

PostgreSQL (OHLCV):
├── Storage: 500 MB per symbol per year (15-min bars)
├── Query: 10,000 queries/sec (with proper indexes)
├── Scaling: Vertical (bigger instance) or horizontal (read replicas)

Vector DB:
├── Storage: 1 GB per 1M embeddings
├── Query: 1,000 searches/sec
├── Scaling: Horizontal (sharding)

Filesystem:
├── Markdown: 1 MB per user
├── JSONL: 10 MB per user per month
├── Scaling: Unlimited (cheap storage)

Bottleneck: LLM API rate limits (1000 req/min typical)
Solution: Queue system, multiple API keys, caching
```

### 7.3 Cost Optimization

```
Monthly Cost Breakdown (1000 active users):

PostgreSQL (AWS RDS):
├── Instance: $100/month (db.t3.medium)
├── Storage: $20/month (200 GB)
└── Subtotal: $120/month

Vector DB (Pinecone):
├── Index: $70/month (1M vectors)
├── Queries: $30/month (100K searches)
└── Subtotal: $100/month

Filesystem (S3):
├── Markdown: $1/month (1 GB)
├── JSONL: $5/month (50 GB)
└── Subtotal: $6/month

LLM API (Anthropic):
├── Queries: $500/month (50K queries @ $0.01 each)
├── Tokens: $300/month (30M tokens)
└── Subtotal: $800/month

Total: ~$1000/month for 1000 users
Cost per user: $1/month (infrastructure only)

Savings from on-demand approach:
├── No Vector DB for market data: -$50/month
├── No redundant storage: -$20/month
└── Total saved: $70/month (7%)
```

---

## 8. Quick Reference

### 8.1 Data Storage Cheat Sheet

| What               | Where                 | Why                  |
| ------------------ | --------------------- | -------------------- |
| OHLCV + Indicators | PostgreSQL            | Time-series queries  |
| Market Commentary  | Nowhere (on-demand)   | Changes every 15 min |
| Trading Knowledge  | Vector DB             | Semantic search      |
| User Profiles      | Filesystem (Markdown) | Human-readable       |
| Audit Logs         | Filesystem (JSONL)    | Append-only          |
| User Metadata      | PostgreSQL            | Registry/pointers    |
| Session Registry   | PostgreSQL            | Audit tracking       |

### 8.2 Query Routing Cheat Sheet

| Query Type                  | SQL      | Vector | Markdown | Notes                                       |
| --------------------------- | -------- | ------ | -------- | ------------------------------------------- |
| "XAUUSD H4 analysis"        | ✓        | ✓      | ✗        | Both symbol + timeframe specified           |
| "XAUUSD analysis"           | Fallback | ✓      | ✗        | Missing timeframe → request clarification   |
| "Compare XAUUSD H4 vs H1"   | ✓ (2x)   | ✓      | ✗        | Multiple SQL calls for different timeframes |
| "Should I trade?"           | ✗        | ✓      | ✓        | No symbol/timeframe → user context needed   |
| "What is RSI?"              | ✗        | ✓      | ✗        | Pure conceptual query                       |
| "My EURUSD H4 performance?" | ✓        | ✗      | ✓        | Symbol-timeframe + user history             |
| "Market sentiment?"         | Fallback | ✓      | ✗        | No specific symbol → major markets overview |

**Key Rule**: SQL Engine requires BOTH symbol AND timeframe. Same symbol + different timeframe = different query.

### 8.3 Fallback Priority

**Available Timeframes**: M5, M15, M30, H1, H2, H4, H8, H12, D1

```
1. Primary Flow (SQL + Vector + Markdown)
   → Symbol + Timeframe specified → Fetch specific data

2. Missing Timeframe
   → Has symbol but no timeframe → Request clarification

3. No Symbol Specified
   → No symbol in query → Major markets overview (XAUUSD, EURUSD, US30, BTCUSD)

4. Symbol Not in Database
   → Unknown symbol → External API or clarification

5. Timeframe Not Available
   → Unsupported timeframe (e.g., M1, W1) → Suggest available alternatives

6. Stale Data
   → Data gap detected → Use last available with disclaimer

7. Conceptual Only
   → Pure knowledge query → Vector search only

8. Ambiguous Context
   → Missing critical info → User context + clarification
```

### 8.4 Performance Targets

| Metric         | Target   | Alert If |
| -------------- | -------- | -------- |
| SQL query      | < 20ms   | > 50ms   |
| Vector search  | < 150ms  | > 300ms  |
| LLM generation | < 3000ms | > 5000ms |
| Total response | < 2500ms | > 4000ms |
| Cache hit rate | > 70%    | < 50%    |
| Fallback rate  | < 10%    | > 20%    |

---

## Conclusion

This architecture provides:

✅ **Right storage for right data** - PostgreSQL for time-series, filesystem for audit/profiles, Vector DB for concepts

✅ **Symbol-Timeframe independence** - Each symbol-timeframe pair (e.g., XAUUSD-H4, XAUUSD-H1) is treated as an independent trading instrument with unique data and behavior

✅ **No JSONB conversion needed** - OHLCV and indicator values stored as native PostgreSQL columns for optimal query performance (both from same MT5 data pipeline)

✅ **Optimal performance** - On-demand generation eliminates redundant storage and keeps market commentary fresh

✅ **Intelligent retrieval** - Three-engine approach (SQL + Semantic + Markdown) covers all query types

✅ **Robust fallback** - Graceful degradation when primary data unavailable, with clear handling of missing symbol/timeframe scenarios

✅ **Scalable design** - Each component scales independently

✅ **Cost-effective** - Minimal redundancy, efficient storage utilization

**Key Takeaways**:

1. Market commentary is **ephemeral context**, not permanent data - generate on-demand, use immediately, discard
2. Symbol-timeframe combinations are **independent instruments** - EURUSD-H4 ≠ EURUSD-H1
3. Store only source data (PostgreSQL), static knowledge (Vector DB), and user profiles (Markdown)
4. Available timeframes: **M5, M15, M30, H1, H2, H4, H8, H12, D1**

---

**Document Status**: Complete reference for RAG architecture implementation

**Next Steps**:

1. Set up PostgreSQL schema
2. Configure Vector DB collections
3. Implement SQLEngine and VectorEngine
4. Build fallback handlers
5. Deploy and monitor

**Questions?** Refer to specific sections above or consult implementation code examples.

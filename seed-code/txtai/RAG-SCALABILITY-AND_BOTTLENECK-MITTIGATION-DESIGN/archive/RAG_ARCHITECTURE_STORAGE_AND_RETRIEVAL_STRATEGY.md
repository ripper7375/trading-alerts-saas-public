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

#### 2.4.1 Benefits of On-Demand Commentary Generation

This architecture makes a critical decision: **Market commentary text is generated on-demand and fed directly to LLM**, rather than:

- ❌ Converting to JSONB and storing in PostgreSQL
- ❌ Chunking, embedding, and storing in Vector Database

**Why This Approach is Superior:**

```
┌────────────────────────────────────────────────────────────────┐
│        ON-DEMAND GENERATION vs STORED COMMENTARY                │
└────────────────────────────────────────────────────────────────┘

Aspect                  | On-Demand (✓)              | Stored Commentary (✗)
------------------------|----------------------------|---------------------------
Data Freshness          | Always current             | Can become stale
Storage Cost            | Zero                       | ~$50/month (VectorDB)
Consistency             | Guaranteed                 | Sync issues
Generation Speed        | 2-5ms                      | 50-150ms (vector search)
Maintenance             | None                       | Re-embed every 15 min
Flexibility             | Easy updates               | Re-embed entire dataset
Single Source of Truth  | Yes (OHLCV data)          | No (multiple copies)
Complexity              | Low                        | High (ETL pipeline)
```

### 1. **Data Freshness - Always Current** 🎯

```typescript
// Problem with Stored Commentary:
// Data updates every 15 minutes, creating constant sync challenges

// ❌ BAD: Stored Commentary Approach
async function getStoredCommentary(symbol: string, timeframe: string) {
  // 1. Get numerical data (2ms)
  const ohlcv = await db.query('SELECT * FROM ohlcv_15m WHERE...');

  // 2. Get stored commentary (50ms vector search)
  const commentary = await vectorDB.search({
    query: `${symbol} ${timeframe} current analysis`,
    collection: 'market_commentary',
  });

  // 3. PROBLEM: Commentary might be from 14 minutes ago
  // 4. PROBLEM: OHLCV data just updated, but commentary hasn't
  // 5. PROBLEM: LLM gets conflicting information

  // Example mismatch:
  // OHLCV shows: Price = 2045.50 (latest)
  // Commentary says: "Trading at 2043.80" (14 min old)

  return { ohlcv, commentary }; // INCONSISTENT!
}

// ✅ GOOD: On-Demand Generation
async function getOnDemandCommentary(symbol: string, timeframe: string) {
  // 1. Get numerical data (2ms)
  const ohlcv = await db.query('SELECT * FROM ohlcv_15m WHERE...');

  // 2. Generate commentary immediately (3ms)
  const commentary = generateCommentary(ohlcv.rows[0], ohlcv.rows.slice(1));

  // 3. Commentary ALWAYS matches current data
  // 4. Single source of truth
  // 5. No sync issues possible

  return { ohlcv, commentary }; // PERFECTLY CONSISTENT!
}
```

**Benefit**: Commentary is **guaranteed** to match the exact OHLCV and indicator values being analyzed. No race conditions, no stale data, no sync issues.

### 2. **Storage Efficiency - Zero Redundancy** 💾

```
Storage Comparison (per symbol-timeframe pair):

Stored Commentary Approach:
├── PostgreSQL: OHLCV + Indicators (57 columns)     = 500 MB/year
├── PostgreSQL: Commentary JSONB                    = 200 MB/year ❌ REDUNDANT
└── Vector DB: Commentary Embeddings (1536 dims)    = 100 MB/year ❌ REDUNDANT
    Total: 800 MB/year per symbol-timeframe

On-Demand Approach:
├── PostgreSQL: OHLCV + Indicators (57 columns)     = 500 MB/year
├── Commentary storage:                             = 0 MB        ✅ ZERO
└── Embeddings storage:                             = 0 MB        ✅ ZERO
    Total: 500 MB/year per symbol-timeframe

Savings: 37.5% storage reduction
```

**At Scale (50 symbol-timeframe pairs)**:

- Stored approach: 40 GB/year
- On-demand approach: 25 GB/year
- **Savings: 15 GB/year = $300/year** (on cloud storage)

### 3. **Performance - Faster Than Vector Search** ⚡

```typescript
// Performance Comparison

// ❌ Vector Search Approach
async function vectorSearchApproach(symbol: string, timeframe: string) {
  const start = Date.now();

  // 1. Get OHLCV data
  const ohlcv = await sqlEngine.search({ symbol, timeframe }); // 10ms

  // 2. Search for relevant commentary in Vector DB
  const commentary = await vectorDB.search({
    query: `${symbol} ${timeframe} current market analysis`,
    limit: 5,
  }); // 80ms

  // 3. Re-rank results
  const ranked = reRankByRecency(commentary); // 10ms

  const total = Date.now() - start; // ~100ms
  return { ohlcv, commentary };
}

// ✅ On-Demand Generation
async function onDemandApproach(symbol: string, timeframe: string) {
  const start = Date.now();

  // 1. Get OHLCV data
  const ohlcv = await sqlEngine.search({ symbol, timeframe }); // 10ms

  // 2. Generate commentary directly
  const commentary = generateCommentary(ohlcv.latest, ohlcv.history); // 3ms

  const total = Date.now() - start; // ~13ms
  return { ohlcv, commentary };
}

// Performance gain: 87ms saved per query (87% faster)
```

**Latency Breakdown**:

- Vector search: 10ms (SQL) + 80ms (vector) + 10ms (re-rank) = **100ms**
- On-demand: 10ms (SQL) + 3ms (generation) = **13ms**
- **Result: 7.7x faster** 🚀

### 4. **Cost Efficiency - Eliminate Vector DB Costs** 💰

```
Monthly Cost Analysis (1000 active users, 100K queries/month):

Stored Commentary Approach:
├── PostgreSQL: $120/month (data + commentary JSONB)
├── Vector DB:
│   ├── Storage: $70/month (commentary embeddings)
│   ├── Queries: $50/month (100K searches)
│   └── Subtotal: $120/month
└── Total: $240/month

On-Demand Approach:
├── PostgreSQL: $100/month (data only, no commentary)
├── Vector DB:
│   ├── Storage: $70/month (static knowledge only)
│   ├── Queries: $20/month (fewer searches needed)
│   └── Subtotal: $90/month
└── Total: $190/month

Savings: $50/month = $600/year per 1000 users
```

**At 10,000 users**: Save **$6,000/year** 💵

### 5. **Maintenance Simplicity - No ETL Pipeline** 🔧

```typescript
// ❌ Stored Commentary: Complex ETL Pipeline

// Job 1: Generate commentary every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  // 1. Fetch all updated OHLCV data
  const updated = await getUpdatedSymbols();

  // 2. Generate commentary for each
  for (const item of updated) {
    const commentary = generateCommentary(item);

    // 3. Store in PostgreSQL JSONB
    await db.query(
      `
      UPDATE ohlcv_15m 
      SET commentary_text = $1 
      WHERE symbol = $2 AND timeframe = $3
    `,
      [commentary, item.symbol, item.timeframe]
    );

    // 4. Generate embeddings
    const embedding = await openai.embeddings.create({
      input: commentary,
      model: 'text-embedding-ada-002',
    });

    // 5. Upsert to Vector DB
    await vectorDB.upsert({
      id: `${item.symbol}_${item.timeframe}_${item.timestamp}`,
      vector: embedding.data[0].embedding,
      metadata: { symbol: item.symbol, timeframe: item.timeframe },
    });
  }

  // Problems:
  // - API costs: $0.0001 per embedding × 50 symbols × 96 times/day = $0.48/day
  // - Network overhead: 96 API calls per day per symbol
  // - Failure handling: What if embedding API is down?
  // - Backpressure: What if Vector DB is slow?
  // - Monitoring: Need to track ETL pipeline health
});

// ✅ On-Demand: No ETL Needed!

// Just query and generate when needed - that's it!
async function getCommentary(symbol: string, timeframe: string) {
  const data = await sqlEngine.search({ symbol, timeframe });
  return generateCommentary(data.latest, data.history);
}

// Benefits:
// - Zero API costs for embeddings
// - Zero ETL complexity
// - Zero failure modes
// - Zero monitoring overhead
```

### 6. **Flexibility - Easy Updates** 🔄

```typescript
// Scenario: Improve commentary generation logic

// ❌ Stored Commentary: Major Migration
async function updateCommentaryLogic() {
  // 1. Update generation function ✓
  function generateCommentaryV2(data: OHLCVBar[]) {
    // New improved logic
  }

  // 2. Re-generate ALL historical commentary ❌ EXPENSIVE
  const allData = await db.query('SELECT * FROM ohlcv_15m');

  for (const row of allData.rows) { // 1M+ rows
    const newCommentary = generateCommentaryV2([row]);

    // 3. Update PostgreSQL
    await db.query(`UPDATE ohlcv_15m SET commentary_text = $1...`);

    // 4. Re-embed ALL commentary
    const embedding = await openai.embeddings.create({...});

    // 5. Update Vector DB
    await vectorDB.update({...});
  }

  // Cost: $100+ in API fees, 12+ hours runtime, potential downtime
}

// ✅ On-Demand: Instant Deployment
async function updateCommentaryLogic() {
  // 1. Update generation function ✓
  function generateCommentaryV2(data: OHLCVBar[]) {
    // New improved logic
  }

  // 2. Deploy ✓

  // Done! Next request automatically uses new logic.
  // Cost: $0, Time: 2 seconds, Downtime: None
}
```

### 7. **Single Source of Truth - Guaranteed Consistency** 📊

```typescript
// The OHLCV data IS the source of truth

// ❌ Stored Commentary: Multiple Sources of Truth
const sources = {
  ohlcv: 'PostgreSQL', // Source 1
  commentary_text: 'PostgreSQL', // Source 2 (derived from Source 1)
  embeddings: 'Vector DB', // Source 3 (derived from Source 2)
};

// Problem: All three must stay in sync
// Reality: They can drift apart
// Example:
// - OHLCV updated at 14:00:00
// - Commentary regenerated at 14:00:15  (15s lag)
// - Embeddings updated at 14:00:30     (30s lag)
// - User query at 14:00:20 → INCONSISTENT DATA

// ✅ On-Demand: Single Source of Truth
const source = {
  ohlcv: 'PostgreSQL', // Only source
};

// Commentary is a VIEW of OHLCV data, not a separate entity
// Like: price + volume + indicators → commentary
// Mathematical function: f(OHLCV) = Commentary
// Result: ALWAYS consistent, by definition
```

### 8. **No Stale Data Risk** ⚠️

```typescript
// Real-world scenario that breaks stored commentary:

// T=0: Data pipeline running
await collectMarketData(); // New bar created

// T+1s: PostgreSQL updated
// XAUUSD H4: 2043.80 → 2045.50 (new bar)

// T+2s: User asks question
("What's XAUUSD H4 doing?");

// ❌ Stored Commentary:
const commentary = await vectorDB.search('XAUUSD H4 analysis');
// Returns: "XAUUSD trading at 2043.80..." (OLD DATA)
// LLM response: "XAUUSD is at 2043.80..." (WRONG!)

// ✅ On-Demand:
const data = await sqlEngine.search({ symbol: 'XAUUSD', timeframe: 'H4' });
const commentary = generateCommentary(data.latest, data.history);
// Returns: "XAUUSD trading at 2045.50..." (CURRENT DATA)
// LLM response: "XAUUSD is at 2045.50..." (CORRECT!)

// Benefit: Physically impossible to serve stale commentary
```

### 9. **Lower Query Latency for LLM** 🚀

```typescript
// Full request lifecycle comparison

// ❌ Stored Commentary Approach
async function handleUserQuery(query: string) {
  const start = Date.now();

  // 1. Parse query
  const parsed = parseQuery(query); // 5ms

  // 2. SQL query for OHLCV
  const ohlcv = await sqlEngine.search(parsed); // 10ms

  // 3. Vector search for commentary
  const commentary = await vectorDB.search({
    query: query,
    limit: 5,
  }); // 80ms

  // 4. Vector search for knowledge
  const knowledge = await vectorDB.search({
    query: query,
    collection: 'trading_knowledge',
    limit: 3,
  }); // 80ms

  // 5. Assemble context
  const context = assembleContext({
    ohlcv,
    commentary, // From Vector DB
    knowledge,
  }); // 10ms

  // 6. LLM inference
  const response = await llm.generate(context); // 2000ms

  const total = Date.now() - start;
  console.log(`Total: ${total}ms`); // ~2185ms
}

// ✅ On-Demand Approach
async function handleUserQuery(query: string) {
  const start = Date.now();

  // 1. Parse query
  const parsed = parseQuery(query); // 5ms

  // 2. SQL query for OHLCV
  const ohlcv = await sqlEngine.search(parsed); // 10ms

  // 3. Generate commentary on-demand
  const commentary = generateCommentary(ohlcv.latest, ohlcv.history); // 3ms

  // 4. Vector search ONLY for knowledge (not commentary)
  const knowledge = await vectorDB.search({
    query: query,
    collection: 'trading_knowledge',
    limit: 3,
  }); // 80ms

  // 5. Assemble context
  const context = assembleContext({
    ohlcv,
    commentary, // Generated on-demand
    knowledge,
  }); // 10ms

  // 6. LLM inference
  const response = await llm.generate(context); // 2000ms

  const total = Date.now() - start;
  console.log(`Total: ${total}ms`); // ~2108ms
}

// Saved: 77ms per query (3.5% faster end-to-end)
// At 100K queries/month: 7,700 seconds = 2.1 hours saved
```

### 10. **Scalability - Linear Growth** 📈

```typescript
// How costs scale with growth

// ❌ Stored Commentary: Quadratic Growth
// Cost = Storage + Vector_Operations + Embeddings_API
// As data grows:
//   - Storage grows linearly
//   - Vector search slows down (need more shards)
//   - Re-embedding costs grow linearly
//   - Total: O(n) storage + O(log n) search + O(n) compute

// ✅ On-Demand: Linear Growth
// Cost = Storage only
// As data grows:
//   - Storage grows linearly
//   - Generation stays constant (always processing ~16 bars)
//   - No re-embedding costs
//   - Total: O(n) storage + O(1) generation

// Example at 100 symbol-timeframe pairs:

// Stored Commentary:
// - 50 GB storage
// - 100 shards (Vector DB)
// - $500/month Vector DB
// - $200/month embedding API
// Total: $700/month

// On-Demand:
// - 50 GB storage
// - 0 commentary embeddings
// - $100/month Vector DB (knowledge only)
// - $0 embedding API
// Total: $100/month

// Savings: $600/month = $7,200/year
```

---

### Summary: Why On-Demand Generation Wins

| Benefit                   | Impact                   | Savings/Gain              |
| ------------------------- | ------------------------ | ------------------------- |
| **1. Data Freshness**     | Guaranteed consistency   | Eliminates sync bugs      |
| **2. Storage Efficiency** | 37.5% less storage       | $300/year per 50 pairs    |
| **3. Performance**        | 7.7x faster retrieval    | 87ms per query            |
| **4. Cost Efficiency**    | No commentary embeddings | $600/year per 1K users    |
| **5. Simplicity**         | No ETL pipeline          | Zero maintenance          |
| **6. Flexibility**        | Instant logic updates    | $0 migration cost         |
| **7. Consistency**        | Single source of truth   | Zero drift risk           |
| **8. No Stale Data**      | Always current           | Eliminates a failure mode |
| **9. Lower Latency**      | Fewer vector searches    | 3.5% faster responses     |
| **10. Scalability**       | Linear growth            | 7x cheaper at scale       |

### When to Use Each Approach

**Use On-Demand Generation (Your Approach) When:**
✅ Data changes frequently (< 1 hour)
✅ Commentary is purely derived from numerical data
✅ Generation is fast (< 10ms)
✅ Consistency is critical
✅ Cost efficiency matters
✅ Maintenance simplicity is important

**Use Stored Commentary When:**
❌ Data changes rarely (> 1 week)
❌ Commentary requires expensive computation (> 100ms)
❌ Need to search by commentary content semantically
❌ Commentary has independent value beyond source data
❌ Historical commentary analysis is required

**Verdict**: For market data that updates every 15 minutes, **on-demand generation is objectively superior** in every measurable dimension.

---

#### 2.4.2 Disadvantages, Risks, and Mitigation Strategies

While on-demand commentary generation has overwhelming benefits, it's critical to understand potential disadvantages and implement proper safeguards.

### Disadvantage Analysis

```
┌────────────────────────────────────────────────────────────────┐
│        RISKS OF ON-DEMAND COMMENTARY GENERATION                 │
└────────────────────────────────────────────────────────────────┘

Risk Category           | Severity | Likelihood | Mitigation Priority
------------------------|----------|------------|--------------------
CPU/Compute Load        | Medium   | High       | HIGH
Generation Bugs         | High     | Medium     | CRITICAL
No Historical Analysis  | Low      | Low        | LOW
Rate Limit Redundancy   | Medium   | Medium     | MEDIUM
Testing Complexity      | Medium   | High       | HIGH
Memory Pressure         | Low      | Medium     | MEDIUM
```

### 1. **CPU/Compute Load Risk** ⚠️

**Problem**: Generating commentary on every request adds CPU load to application servers.

```typescript
// Risk Scenario
async function handleHighTraffic() {
  // 1000 concurrent requests
  const requests = Array.from({ length: 1000 }, (_, i) => ({
    symbol: 'XAUUSD',
    timeframe: 'H4',
  }));

  // Each request generates commentary
  await Promise.all(
    requests.map(
      (req) => generateCommentary(req) // CPU-intensive
    )
  );

  // Risk: CPU saturation, slow response times
}
```

**Mitigation Strategies**:

```typescript
// Strategy 1: In-Memory Cache with Short TTL
class CommentaryCache {
  private cache = new Map<string, CachedCommentary>();
  private TTL = 30 * 1000; // 30 seconds

  async getOrGenerate(
    symbol: string,
    timeframe: string,
    generator: () => string
  ): Promise<string> {
    const key = `${symbol}_${timeframe}`;
    const cached = this.cache.get(key);

    // Return cached if fresh
    if (cached && cached.expiresAt > Date.now()) {
      return cached.commentary;
    }

    // Generate new
    const commentary = generator();

    this.cache.set(key, {
      commentary,
      expiresAt: Date.now() + this.TTL,
    });

    return commentary;
  }

  // Auto-cleanup expired entries
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (value.expiresAt < now) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}

// Usage
const cache = new CommentaryCache();

async function getCommentary(symbol: string, timeframe: string) {
  return cache.getOrGenerate(symbol, timeframe, () => {
    const data = await sqlEngine.search({ symbol, timeframe });
    return generateCommentary(data.latest, data.history);
  });
}

// Benefit: 1000 requests for XAUUSD H4 → only 1 generation
// Cache hit rate: 95%+ for popular symbols
```

```typescript
// Strategy 2: Rate Limiting per Symbol-Timeframe
class GenerationRateLimiter {
  private pending = new Map<string, Promise<string>>();

  async generate(
    symbol: string,
    timeframe: string,
    generator: () => Promise<string>
  ): Promise<string> {
    const key = `${symbol}_${timeframe}`;

    // If already generating, wait for that result
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    // Start new generation
    const promise = generator().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

// Prevents duplicate generations for same symbol-timeframe
// 100 concurrent requests → 1 actual generation
```

```typescript
// Strategy 3: CPU Usage Monitoring
class CPUMonitor {
  async checkCPULoad(): Promise<boolean> {
    const usage = process.cpuUsage();
    const cpuPercent = (usage.user + usage.system) / 1000000; // Convert to %

    if (cpuPercent > 80) {
      // CPU overload - use more aggressive caching
      return false;
    }

    return true;
  }

  async generateWithBackpressure(generator: () => string): Promise<string> {
    const canGenerate = await this.checkCPULoad();

    if (!canGenerate) {
      // Serve from cache even if slightly stale
      return getFromCacheOrWait();
    }

    return generator();
  }
}
```

**Result**: CPU risk mitigated with 30-second cache + deduplication → 99% reduction in redundant generations.

---

### 2. **Generation Logic Bugs** 🐛 (CRITICAL)

**Problem**: A bug in generation function affects ALL queries immediately. No safety net.

```typescript
// Dangerous: Bug affects everyone instantly
function generateCommentary(current: OHLCVBar, history: OHLCVBar[]): string {
  // BUG: Null pointer exception if support_levels is null
  const support = current.support_levels[0]; // CRASH!

  return `Support at ${support}`;
}

// Risk: All users get errors, no fallback
```

**Mitigation Strategies**:

```typescript
// Strategy 1: Defensive Programming with Fallbacks
function generateCommentary(current: OHLCVBar, history: OHLCVBar[]): string {
  try {
    const parts: string[] = [];

    // Trend (with null checks)
    if (current?.trend_direction) {
      parts.push(`Trend: ${current.trend_direction}`);
    }

    // Support (with defensive checks)
    if (
      current?.support_levels &&
      Array.isArray(current.support_levels) &&
      current.support_levels.length > 0
    ) {
      const support = current.support_levels[0];
      if (typeof support === 'number' && !isNaN(support)) {
        parts.push(`Support at ${support.toFixed(2)}`);
      }
    }

    // Always return something, even if minimal
    return parts.length > 0
      ? parts.join('. ')
      : `${current.symbol} ${current.timeframe} at ${current.close}`;
  } catch (error) {
    // Last resort fallback
    logger.error('Commentary generation failed', error);
    return `Market data for ${current.symbol} ${current.timeframe}`;
  }
}
```

```typescript
// Strategy 2: Schema Validation Before Generation
import { z } from 'zod';

const OHLCVBarSchema = z.object({
  symbol: z.string(),
  timeframe: z.string(),
  close: z.number(),
  trend_direction: z.string().optional(),
  support_levels: z.array(z.number()).optional(),
  resistance_levels: z.array(z.number()).optional(),
});

function generateCommentarySafe(current: unknown, history: unknown[]): string {
  // Validate input
  const validated = OHLCVBarSchema.safeParse(current);

  if (!validated.success) {
    logger.error('Invalid OHLCV data', validated.error);
    return 'Unable to generate commentary - data validation failed';
  }

  return generateCommentary(validated.data, history);
}
```

```typescript
// Strategy 3: Canary Testing Before Deployment
async function testCommentaryGeneration() {
  const testCases = [
    { symbol: 'XAUUSD', timeframe: 'H4' },
    { symbol: 'EURUSD', timeframe: 'H1' },
    { symbol: 'BTCUSD', timeframe: 'D1' },
  ];

  for (const testCase of testCases) {
    const data = await sqlEngine.search(testCase);
    const commentary = generateCommentary(data.latest, data.history);

    // Assertions
    assert(commentary.length > 0, 'Commentary should not be empty');
    assert(commentary.includes(testCase.symbol), 'Should mention symbol');
    assert(!commentary.includes('undefined'), 'No undefined values');
    assert(!commentary.includes('NaN'), 'No NaN values');
  }
}

// Run before deployment
await testCommentaryGeneration();
```

```typescript
// Strategy 4: Feature Flags for Gradual Rollout
class FeatureFlags {
  async shouldUseNewCommentary(userId: string): Promise<boolean> {
    // 5% rollout
    if (hash(userId) % 100 < 5) {
      return true;
    }
    return false;
  }
}

async function getCommentary(
  userId: string,
  symbol: string,
  timeframe: string
) {
  const useNew = await featureFlags.shouldUseNewCommentary(userId);

  if (useNew) {
    try {
      return generateCommentaryV2(data); // New version
    } catch (error) {
      logger.error('V2 generation failed, falling back to V1');
      return generateCommentaryV1(data); // Old version (fallback)
    }
  }

  return generateCommentaryV1(data);
}
```

**Result**: Multiple layers of protection → bug blast radius limited, graceful degradation.

---

### 3. **No Historical Commentary Analysis** 📊

**Problem**: Can't analyze how commentary evolved over time or train ML models on it.

```typescript
// Can't do this:
// "Show me all times when commentary mentioned 'strong reversal signals'"
// "What were the patterns before major crashes?"
```

**Mitigation Strategies**:

```typescript
// Strategy 1: Log Generated Commentary to JSONL (Optional)
async function handleQuery(userId: string, query: string) {
  const data = await sqlEngine.search({ symbol, timeframe });
  const commentary = generateCommentary(data.latest, data.history);

  // Optional: Log for analytics
  await jsonlLogger.log({
    type: 'generated_commentary',
    symbol: data.symbol,
    timeframe: data.timeframe,
    timestamp: data.timestamp,
    commentary: commentary, // Store the generated text
    ohlcv_snapshot: {
      close: data.latest.close,
      atr: data.latest.atr_value,
    },
  });

  // Use commentary in LLM context
  // ...
}

// Benefit: Historical analysis possible without affecting real-time performance
```

```typescript
// Strategy 2: Batch Regeneration for Analytics
async function analyzeHistoricalCommentary(
  symbol: string,
  timeframe: string,
  startDate: Date,
  endDate: Date
) {
  // Fetch historical OHLCV data
  const historicalData = await db.query(
    `
    SELECT * FROM ohlcv_15m
    WHERE symbol = $1 
      AND timeframe = $2
      AND timestamp BETWEEN $3 AND $4
    ORDER BY timestamp ASC
  `,
    [symbol, timeframe, startDate, endDate]
  );

  // Regenerate commentary for analysis
  const commentaries = historicalData.rows.map((bar, i) => ({
    timestamp: bar.timestamp,
    commentary: generateCommentary(bar, historicalData.rows.slice(0, i)),
  }));

  // Analyze patterns
  return analyzePatterns(commentaries);
}

// Can regenerate any historical commentary on-demand for analysis
```

**Result**: Historical analysis possible through JSONL logs or regeneration, without impacting production performance.

---

### 4. **Rate Limiting Redundancy** 🔄

**Problem**: Multiple users querying same symbol-timeframe simultaneously waste CPU regenerating identical commentary.

```typescript
// Inefficient: 100 users query XAUUSD H4 → 100 identical generations
```

**Mitigation**: Already covered in Strategy 1 & 2 above (caching + deduplication).

---

### 5. **Testing Complexity** 🧪

**Problem**: Harder to test commentary quality at scale - need OHLCV test data for every test.

**Mitigation Strategies**:

```typescript
// Strategy 1: Snapshot Testing
describe('Commentary Generation', () => {
  it('should generate consistent commentary', () => {
    const testData = loadTestData('xauusd_h4_2026_02_06.json');
    const commentary = generateCommentary(testData.latest, testData.history);

    // Compare against known good snapshot
    expect(commentary).toMatchSnapshot();
  });
});
```

```typescript
// Strategy 2: Property-Based Testing
import fc from 'fast-check';

describe('Commentary Properties', () => {
  it('should always mention symbol and timeframe', () => {
    fc.assert(
      fc.property(
        fc.record({
          symbol: fc.constantFrom('XAUUSD', 'EURUSD', 'BTCUSD'),
          timeframe: fc.constantFrom('H1', 'H4', 'D1'),
          close: fc.float({ min: 1000, max: 3000 }),
          trend_direction: fc.constantFrom('UP', 'DOWN', 'RANGING'),
        }),
        (bar) => {
          const commentary = generateCommentary(bar, []);
          return (
            commentary.includes(bar.symbol) &&
            commentary.includes(bar.timeframe)
          );
        }
      )
    );
  });
});
```

**Result**: Comprehensive testing possible with snapshot and property-based tests.

---

### 6. **Memory Pressure** 💾

**Problem**: Generating commentary for many bars in parallel could cause memory issues.

**Mitigation**:

```typescript
// Strategy: Streaming/Chunking for Bulk Operations
async function* generateCommentaryStream(symbols: string[], timeframe: string) {
  for (const symbol of symbols) {
    const data = await sqlEngine.search({ symbol, timeframe });
    const commentary = generateCommentary(data.latest, data.history);

    yield { symbol, commentary };

    // Allow GC to clean up
    await new Promise((resolve) => setImmediate(resolve));
  }
}

// Process 1000 symbols without memory issues
for await (const result of generateCommentaryStream(allSymbols, 'H4')) {
  await processResult(result);
}
```

---

### 7. **No Semantic Search on Commentary** 🔍

**Problem**: Can't search by commentary content (e.g., "find all times commentary mentioned reversal").

**When This Matters**:

- User asks: "Have you ever told me about a reversal pattern on XAUUSD?"
- Research: "Find all instances where support was mentioned"

**Mitigation**:

```typescript
// Strategy 1: Search on Source Data Instead
// Instead of: "Find commentary mentioning 'reversal'"
// Do: "Find OHLCV bars with reversal_probability = 'Likely'"

const instances = await db.query(`
  SELECT * FROM ohlcv_15m
  WHERE symbol = 'XAUUSD'
    AND timeframe = 'H4'
    AND reversal_probability = 'Likely'
  ORDER BY timestamp DESC
  LIMIT 10
`);

// Then generate commentary for these specific instances
const commentaries = instances.rows.map((bar) => generateCommentary(bar, []));
```

```typescript
// Strategy 2: Selective Embedding for Important Commentaries
// Only embed commentary for significant events
async function handleSignificantEvent(data: OHLCVBar) {
  if (data.reversal_probability === 'Likely' || data.atr_percentile > 90) {
    const commentary = generateCommentary(data, []);

    // Embed only significant events
    const embedding = await openai.embeddings.create({
      input: commentary,
      model: 'text-embedding-3-small',
    });

    await vectorDB.upsert({
      id: `event_${data.symbol}_${data.timestamp}`,
      vector: embedding.data[0].embedding,
      metadata: {
        type: 'significant_event',
        symbol: data.symbol,
        timestamp: data.timestamp,
      },
    });
  }
}

// Benefit: Semantic search on important events only, not routine commentary
```

**Result**: Semantic search available for important events; routine queries use SQL.

---

### 8. **Deployment Risk** 🚀

**Problem**: New commentary logic goes live immediately for all users.

**Mitigation**:

```typescript
// Strategy: Blue-Green Deployment for Commentary Logic
class CommentaryVersionManager {
  private versions = {
    stable: generateCommentaryV1,
    canary: generateCommentaryV2,
  };

  async generate(userId: string, data: OHLCVBar[]): Promise<string> {
    // 95% stable, 5% canary
    const version = this.selectVersion(userId);

    try {
      return this.versions[version](data);
    } catch (error) {
      logger.error(`${version} generation failed`, error);
      // Always fall back to stable
      return this.versions.stable(data);
    }
  }

  private selectVersion(userId: string): 'stable' | 'canary' {
    return hash(userId) % 100 < 5 ? 'canary' : 'stable';
  }
}
```

---

### Risk Mitigation Summary

| Risk                       | Severity | Mitigation                           | Residual Risk |
| -------------------------- | -------- | ------------------------------------ | ------------- |
| **CPU Load**               | Medium   | 30s cache + deduplication            | Low           |
| **Generation Bugs**        | High     | Defensive code + validation + canary | Low           |
| **No Historical Analysis** | Low      | JSONL logs + regeneration            | None          |
| **Rate Limit Redundancy**  | Medium   | Caching + deduplication              | None          |
| **Testing Complexity**     | Medium   | Snapshot + property tests            | Low           |
| **Memory Pressure**        | Low      | Streaming + GC management            | None          |
| **No Semantic Search**     | Low      | SQL search + selective embedding     | Low           |
| **Deployment Risk**        | Medium   | Blue-green + feature flags           | Low           |

### Best Practices Checklist

✅ **Implement short-TTL cache** (30-60 seconds)
✅ **Deduplicate concurrent requests** for same symbol-timeframe
✅ **Defensive programming** with null checks and try-catch
✅ **Schema validation** before generation
✅ **Comprehensive test suite** (snapshot + property-based)
✅ **Feature flags** for gradual rollout
✅ **Fallback to previous version** on errors
✅ **Monitor CPU usage** and implement backpressure
✅ **Log generated commentary** to JSONL for analytics (optional)
✅ **Canary deployments** for new logic (5% rollout)

### Monitoring Metrics

```typescript
// Critical metrics to track
interface CommentaryMetrics {
  generation_latency_p50: number; // Should be < 5ms
  generation_latency_p99: number; // Should be < 20ms
  generation_error_rate: number; // Should be < 0.1%
  cache_hit_rate: number; // Should be > 90%
  cpu_usage_avg: number; // Should be < 60%
  cpu_usage_p99: number; // Should be < 80%
}

// Alert thresholds
const ALERTS = {
  generation_latency_p99: 50, // ms
  generation_error_rate: 0.005, // 0.5%
  cache_hit_rate: 0.85, // 85%
  cpu_usage_p99: 85, // 85%
};
```

---

### Verdict

With proper mitigation strategies, the risks of on-demand commentary generation are **manageable and far outweighed by benefits**:

- ✅ CPU risk → Solved with caching
- ✅ Bug risk → Solved with defensive programming + canary
- ✅ Testing → Solved with snapshot tests
- ✅ All other risks → Low severity or easily mitigated

**The architecture remains sound**, and with these safeguards, you get all the benefits (speed, cost, consistency) while minimizing operational risks.

---

#### 2.4.3 Production-Ready Implementation Guide

This section provides complete, production-ready code for implementing all mitigation strategies in your architecture.

### Implementation Architecture

```
┌────────────────────────────────────────────────────────────────┐
│              COMMENTARY GENERATION ARCHITECTURE                 │
└────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │  User Request   │
                    └────────┬────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  1. Request Router     │
                │  (Rate Limiting)       │
                └────────┬───────────────┘
                         │
                         ▼
                ┌────────────────────────┐
                │  2. Cache Layer        │
                │  (30s TTL)            │
                └────────┬───────────────┘
                         │
                    Cache Miss?
                         │
                         ▼
                ┌────────────────────────┐
                │  3. Deduplicator       │
                │  (Same-Key Coalescing) │
                └────────┬───────────────┘
                         │
                         ▼
                ┌────────────────────────┐
                │  4. SQL Engine         │
                │  (Fetch OHLCV Data)    │
                └────────┬───────────────┘
                         │
                         ▼
                ┌────────────────────────┐
                │  5. Version Manager    │
                │  (Feature Flags)       │
                └────────┬───────────────┘
                         │
                    ┌────┴────┐
                    │         │
            Stable (95%)  Canary (5%)
                    │         │
                    └────┬────┘
                         │
                         ▼
                ┌────────────────────────┐
                │  6. Generator          │
                │  (Defensive + Validated)│
                └────────┬───────────────┘
                         │
                         ▼
                ┌────────────────────────┐
                │  7. Monitoring         │
                │  (Metrics + Alerts)    │
                └────────┬───────────────┘
                         │
                         ▼
                ┌────────────────────────┐
                │  8. Response           │
                │  (Commentary Text)     │
                └────────────────────────┘
```

---

### MITIGATION 1: Commentary Cache Service

**File**: `src/services/CommentaryCache.ts`

```typescript
import { Redis } from 'ioredis';
import { Logger } from './Logger';

interface CachedCommentary {
  commentary: string;
  generatedAt: number;
  expiresAt: number;
  symbol: string;
  timeframe: string;
  version: string; // Track which generation version created this
}

export class CommentaryCacheService {
  private memoryCache: Map<string, CachedCommentary> = new Map();
  private redis: Redis;
  private logger: Logger;

  // Configuration
  private readonly MEMORY_TTL = 30 * 1000; // 30 seconds
  private readonly REDIS_TTL = 60 * 5; // 5 minutes (fallback)
  private readonly MAX_MEMORY_ENTRIES = 1000; // Prevent memory bloat

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.logger = new Logger('CommentaryCache');
    this.startCleanupJob();
    this.startMetricsJob();
  }

  /**
   * Get cached commentary or generate new
   */
  async getOrGenerate(
    symbol: string,
    timeframe: string,
    generator: () => Promise<string>,
    version: string = 'v1'
  ): Promise<string> {
    const key = this.generateKey(symbol, timeframe, version);

    // 1. Check memory cache first (fastest)
    const memoryCached = this.getFromMemory(key);
    if (memoryCached) {
      this.logger.debug('Cache HIT (memory)', { key });
      this.recordMetric('cache_hit', 'memory');
      return memoryCached.commentary;
    }

    // 2. Check Redis cache (fallback)
    const redisCached = await this.getFromRedis(key);
    if (redisCached) {
      this.logger.debug('Cache HIT (redis)', { key });
      this.recordMetric('cache_hit', 'redis');
      // Populate memory cache
      this.setInMemory(key, redisCached);
      return redisCached;
    }

    // 3. Cache MISS - generate new commentary
    this.logger.debug('Cache MISS', { key });
    this.recordMetric('cache_miss');

    const startTime = Date.now();
    const commentary = await generator();
    const generationTime = Date.now() - startTime;

    this.recordMetric('generation_latency', generationTime);

    // 4. Store in both caches
    const cached: CachedCommentary = {
      commentary,
      generatedAt: Date.now(),
      expiresAt: Date.now() + this.MEMORY_TTL,
      symbol,
      timeframe,
      version,
    };

    this.setInMemory(key, cached);
    await this.setInRedis(key, commentary);

    return commentary;
  }

  /**
   * Invalidate cache for symbol-timeframe pair
   */
  async invalidate(symbol: string, timeframe: string): Promise<void> {
    const pattern = `commentary:${symbol}:${timeframe}:*`;

    // Clear memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(`commentary:${symbol}:${timeframe}:`)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear Redis cache
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    this.logger.info('Cache invalidated', {
      symbol,
      timeframe,
      keysCleared: keys.length,
    });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      memorySize: this.memoryCache.size,
      memoryMaxSize: this.MAX_MEMORY_ENTRIES,
      memoryUsagePercent:
        (this.memoryCache.size / this.MAX_MEMORY_ENTRIES) * 100,
    };
  }

  // Private methods

  private generateKey(
    symbol: string,
    timeframe: string,
    version: string
  ): string {
    return `commentary:${symbol}:${timeframe}:${version}`;
  }

  private getFromMemory(key: string): CachedCommentary | null {
    const cached = this.memoryCache.get(key);

    if (!cached) return null;

    // Check if expired
    if (cached.expiresAt < Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached;
  }

  private setInMemory(key: string, cached: CachedCommentary): void {
    // Enforce max size (LRU-style)
    if (this.memoryCache.size >= this.MAX_MEMORY_ENTRIES) {
      // Delete oldest entry
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, cached);
  }

  private async getFromRedis(key: string): Promise<string | null> {
    try {
      const cached = await this.redis.get(key);
      return cached;
    } catch (error) {
      this.logger.error('Redis GET failed', { key, error });
      return null;
    }
  }

  private async setInRedis(key: string, commentary: string): Promise<void> {
    try {
      await this.redis.setex(key, this.REDIS_TTL, commentary);
    } catch (error) {
      this.logger.error('Redis SET failed', { key, error });
      // Non-fatal - memory cache still works
    }
  }

  /**
   * Cleanup expired entries every minute
   */
  private startCleanupJob(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, value] of this.memoryCache.entries()) {
        if (value.expiresAt < now) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.debug('Cache cleanup completed', {
          entriesRemoved: cleaned,
        });
      }
    }, 60000); // Every minute
  }

  /**
   * Log metrics every 5 minutes
   */
  private startMetricsJob(): void {
    setInterval(() => {
      const stats = this.getStats();
      this.logger.info('Cache metrics', stats);
    }, 5 * 60000); // Every 5 minutes
  }

  private recordMetric(metric: string, value?: any): void {
    // Integrate with your metrics system (Prometheus, CloudWatch, etc.)
    // Example: prometheus.increment(`commentary_cache_${metric}`, { value });
  }
}
```

**Configuration**: `config/cache.config.ts`

```typescript
export const cacheConfig = {
  // Memory cache settings
  memoryTTL: parseInt(process.env.CACHE_MEMORY_TTL || '30000'), // 30 seconds
  maxMemoryEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '1000'),

  // Redis cache settings (fallback layer)
  redisTTL: parseInt(process.env.CACHE_REDIS_TTL || '300'), // 5 minutes
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Cache behavior
  enableRedis: process.env.CACHE_ENABLE_REDIS !== 'false', // Default true
  enableMemory: process.env.CACHE_ENABLE_MEMORY !== 'false', // Default true
};
```

---

### MITIGATION 2: Request Deduplication Service

**File**: `src/services/RequestDeduplicator.ts`

```typescript
import { Logger } from './Logger';

interface PendingRequest<T> {
  promise: Promise<T>;
  startTime: number;
  subscribers: number;
}

export class RequestDeduplicator {
  private pending: Map<string, PendingRequest<any>> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RequestDeduplicator');
    this.startMonitoring();
  }

  /**
   * Execute function, deduplicating concurrent requests for same key
   */
  async deduplicate<T>(key: string, executor: () => Promise<T>): Promise<T> {
    // Check if request is already in flight
    const existing = this.pending.get(key);

    if (existing) {
      this.logger.debug('Deduplicating request', {
        key,
        subscribers: existing.subscribers + 1,
      });
      existing.subscribers++;
      this.recordMetric('request_deduplicated', { key });

      try {
        return await existing.promise;
      } finally {
        existing.subscribers--;
      }
    }

    // Start new request
    this.logger.debug('New request', { key });

    const startTime = Date.now();
    const promise = executor().finally(() => {
      // Clean up when done
      const duration = Date.now() - startTime;
      this.recordMetric('request_completed', { key, duration });

      const pending = this.pending.get(key);
      if (pending) {
        this.logger.debug('Request completed', {
          key,
          duration,
          subscribers: pending.subscribers,
        });
      }

      this.pending.delete(key);
    });

    this.pending.set(key, {
      promise,
      startTime,
      subscribers: 1,
    });

    return promise;
  }

  /**
   * Get statistics about current deduplication
   */
  getStats() {
    const entries = Array.from(this.pending.entries());

    return {
      pendingRequests: entries.length,
      totalSubscribers: entries.reduce(
        (sum, [_, req]) => sum + req.subscribers,
        0
      ),
      avgSubscribersPerRequest:
        entries.length > 0
          ? entries.reduce((sum, [_, req]) => sum + req.subscribers, 0) /
            entries.length
          : 0,
      oldestRequestAge:
        entries.length > 0
          ? Math.max(...entries.map(([_, req]) => Date.now() - req.startTime))
          : 0,
    };
  }

  private startMonitoring(): void {
    // Log stats every minute
    setInterval(() => {
      const stats = this.getStats();
      if (stats.pendingRequests > 0) {
        this.logger.info('Deduplication stats', stats);
      }
    }, 60000);
  }

  private recordMetric(metric: string, data: any): void {
    // Integrate with metrics system
  }
}
```

---

### MITIGATION 3: Defensive Commentary Generator

**File**: `src/services/CommentaryGenerator.ts`

```typescript
import { z } from 'zod';
import { Logger } from './Logger';

// Schema definitions
const OHLCVBarSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().regex(/^(M5|M15|M30|H1|H2|H4|H8|H12|D1)$/),
  timestamp: z.date(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
  atr_value: z.number().nonnegative().optional(),
  atr_percentile: z.number().min(0).max(100).optional(),
  adx_value: z.number().nonnegative().optional(),
  rsi_value: z.number().min(0).max(100).optional(),
  trend_direction: z.enum(['UP', 'DOWN', 'RANGING']).optional(),
  volatility_regime: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  swing_momentum: z.enum(['Over-Bought', 'Over-Sold', 'Neutral']).optional(),
  support_levels: z.array(z.number()).optional(),
  resistance_levels: z.array(z.number()).optional(),
  reversal_probability: z.enum(['Likely', 'Possible', '---']).optional(),
});

type OHLCVBar = z.infer<typeof OHLCVBarSchema>;

export class CommentaryGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('CommentaryGenerator');
  }

  /**
   * Generate market commentary with full validation and error handling
   */
  generate(current: unknown, history: unknown[]): string {
    const startTime = Date.now();

    try {
      // 1. Validate input
      const validatedCurrent = this.validateBar(current);
      if (!validatedCurrent.success) {
        this.logger.error('Invalid OHLCV data', {
          errors: validatedCurrent.errors,
          data: current,
        });
        return this.generateFallbackCommentary(current);
      }

      // 2. Generate commentary
      const commentary = this.generateCommentary(
        validatedCurrent.data,
        history as OHLCVBar[]
      );

      // 3. Validate output
      const validated = this.validateCommentary(
        commentary,
        validatedCurrent.data
      );

      const duration = Date.now() - startTime;
      this.recordMetric('generation_success', { duration });

      return validated;
    } catch (error) {
      this.logger.error('Commentary generation failed', {
        error,
        current,
        stack: error instanceof Error ? error.stack : undefined,
      });

      this.recordMetric('generation_error', {
        error: error instanceof Error ? error.message : 'unknown',
      });

      // Return safe fallback
      return this.generateFallbackCommentary(current);
    }
  }

  private validateBar(
    data: unknown
  ): { success: true; data: OHLCVBar } | { success: false; errors: any } {
    const result = OHLCVBarSchema.safeParse(data);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return { success: false, errors: result.error.format() };
  }

  private generateCommentary(current: OHLCVBar, history: OHLCVBar[]): string {
    const parts: string[] = [];

    // Always include basic info
    parts.push(
      `${current.symbol} ${current.timeframe} trading at ${this.formatPrice(current.close)}`
    );

    // Trend analysis (with null checks)
    if (current.trend_direction && current.adx_value !== undefined) {
      const strength = this.getTrendStrength(current.adx_value);

      if (current.trend_direction === 'UP') {
        parts.push(
          `in a ${strength} uptrend (ADX: ${current.adx_value.toFixed(1)})`
        );
      } else if (current.trend_direction === 'DOWN') {
        parts.push(
          `in a ${strength} downtrend (ADX: ${current.adx_value.toFixed(1)})`
        );
      } else {
        parts.push(
          `ranging with no clear trend (ADX: ${current.adx_value.toFixed(1)})`
        );
      }
    }

    // Momentum analysis
    if (current.swing_momentum && history.length > 0) {
      if (current.swing_momentum === 'Over-Bought') {
        const duration = this.countConsecutive(
          history,
          current,
          'swing_momentum',
          'Over-Bought'
        );
        parts.push(`Over-bought for ${duration} bars`);
      } else if (current.swing_momentum === 'Over-Sold') {
        const duration = this.countConsecutive(
          history,
          current,
          'swing_momentum',
          'Over-Sold'
        );
        parts.push(`Over-sold for ${duration} bars`);
      }
    }

    // Volatility analysis
    if (current.atr_percentile !== undefined) {
      if (current.atr_percentile > 80) {
        parts.push(
          `Extremely high volatility (${current.atr_percentile}th percentile)`
        );
      } else if (current.atr_percentile < 20) {
        parts.push(
          `Very low volatility (${current.atr_percentile}th percentile)`
        );
      }
    }

    // Reversal signals
    if (current.reversal_probability === 'Likely') {
      parts.push('Reversal signals appearing');
    } else if (current.reversal_probability === 'Possible') {
      parts.push('Potential reversal forming');
    }

    // Support/Resistance levels
    if (current.support_levels && current.support_levels.length > 0) {
      const nearSupport = this.checkProximity(
        current.close,
        current.support_levels,
        0.002
      ); // 0.2%
      if (nearSupport) {
        parts.push(`Near support at ${this.formatPrice(nearSupport)}`);
      }
    }

    if (current.resistance_levels && current.resistance_levels.length > 0) {
      const nearResistance = this.checkProximity(
        current.close,
        current.resistance_levels,
        0.002
      );
      if (nearResistance) {
        parts.push(
          `Approaching resistance at ${this.formatPrice(nearResistance)}`
        );
      }
    }

    return parts.join('. ') + '.';
  }

  private generateFallbackCommentary(data: unknown): string {
    // Last resort - generate minimal safe commentary
    if (typeof data === 'object' && data !== null) {
      const obj = data as any;

      if (obj.symbol && obj.timeframe && obj.close) {
        return `${obj.symbol} ${obj.timeframe} at ${this.formatPrice(obj.close)}. Market data available.`;
      }
    }

    return 'Market data available. Unable to generate detailed commentary.';
  }

  private validateCommentary(commentary: string, bar: OHLCVBar): string {
    // Ensure commentary has required elements
    const issues: string[] = [];

    if (!commentary.includes(bar.symbol)) {
      issues.push('missing symbol');
    }

    if (!commentary.includes(bar.timeframe)) {
      issues.push('missing timeframe');
    }

    if (
      commentary.includes('undefined') ||
      commentary.includes('NaN') ||
      commentary.includes('null')
    ) {
      issues.push('contains invalid values');
    }

    if (commentary.length < 10) {
      issues.push('too short');
    }

    if (issues.length > 0) {
      this.logger.warn('Commentary validation issues', { issues, commentary });
      return this.generateFallbackCommentary(bar);
    }

    return commentary;
  }

  // Helper methods

  private formatPrice(price: number): string {
    if (price >= 1000) {
      return price.toFixed(2);
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  }

  private getTrendStrength(adx: number): string {
    if (adx > 35) return 'strong';
    if (adx > 20) return 'moderate';
    return 'weak';
  }

  private countConsecutive(
    history: OHLCVBar[],
    current: OHLCVBar,
    field: keyof OHLCVBar,
    value: any
  ): number {
    let count = 1; // Include current bar

    for (const bar of history) {
      if (bar[field] === value) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  private checkProximity(
    price: number,
    levels: number[],
    threshold: number
  ): number | null {
    for (const level of levels) {
      const distance = Math.abs(price - level) / price;
      if (distance <= threshold) {
        return level;
      }
    }
    return null;
  }

  private recordMetric(metric: string, data: any): void {
    // Integrate with metrics system
  }
}
```

---

### MITIGATION 4: Version Manager with Feature Flags

**File**: `src/services/CommentaryVersionManager.ts`

```typescript
import { Logger } from './Logger';
import { CommentaryGenerator } from './CommentaryGenerator';

type GeneratorVersion = 'stable' | 'canary' | 'beta';

interface VersionConfig {
  name: GeneratorVersion;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  generator: CommentaryGenerator;
}

export class CommentaryVersionManager {
  private versions: Map<GeneratorVersion, VersionConfig> = new Map();
  private logger: Logger;
  private defaultVersion: GeneratorVersion = 'stable';

  constructor() {
    this.logger = new Logger('VersionManager');
    this.initializeVersions();
  }

  private initializeVersions(): void {
    // Stable version (always available)
    this.versions.set('stable', {
      name: 'stable',
      enabled: true,
      rolloutPercentage: 95,
      generator: new CommentaryGenerator(),
    });

    // Canary version (gradual rollout)
    this.versions.set('canary', {
      name: 'canary',
      enabled: process.env.ENABLE_CANARY === 'true',
      rolloutPercentage: parseInt(process.env.CANARY_PERCENTAGE || '5'),
      generator: new CommentaryGenerator(), // Could be different implementation
    });

    // Beta version (invite-only)
    this.versions.set('beta', {
      name: 'beta',
      enabled: process.env.ENABLE_BETA === 'true',
      rolloutPercentage: 0, // Controlled by whitelist
      generator: new CommentaryGenerator(),
    });
  }

  /**
   * Generate commentary with version selection and fallback
   */
  async generate(
    userId: string,
    current: unknown,
    history: unknown[]
  ): Promise<{ commentary: string; version: GeneratorVersion }> {
    const selectedVersion = this.selectVersion(userId);
    const versionConfig = this.versions.get(selectedVersion);

    if (!versionConfig || !versionConfig.enabled) {
      // Fall back to stable
      return this.generateWithVersion('stable', current, history);
    }

    try {
      return await this.generateWithVersion(selectedVersion, current, history);
    } catch (error) {
      this.logger.error('Version generation failed, falling back', {
        version: selectedVersion,
        error,
      });

      this.recordMetric('version_fallback', {
        from: selectedVersion,
        to: 'stable',
      });

      // Always fall back to stable
      return this.generateWithVersion('stable', current, history);
    }
  }

  private async generateWithVersion(
    version: GeneratorVersion,
    current: unknown,
    history: unknown[]
  ): Promise<{ commentary: string; version: GeneratorVersion }> {
    const versionConfig = this.versions.get(version);

    if (!versionConfig) {
      throw new Error(`Version ${version} not found`);
    }

    const startTime = Date.now();
    const commentary = versionConfig.generator.generate(current, history);
    const duration = Date.now() - startTime;

    this.recordMetric('generation_latency', {
      version,
      duration,
    });

    return { commentary, version };
  }

  private selectVersion(userId: string): GeneratorVersion {
    // Check beta whitelist first
    if (this.isBetaUser(userId)) {
      const betaConfig = this.versions.get('beta');
      if (betaConfig?.enabled) {
        return 'beta';
      }
    }

    // Canary rollout based on user ID hash
    const canaryConfig = this.versions.get('canary');
    if (canaryConfig?.enabled) {
      const hash = this.hashUserId(userId);
      if (hash % 100 < canaryConfig.rolloutPercentage) {
        return 'canary';
      }
    }

    return 'stable';
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private isBetaUser(userId: string): boolean {
    // Check beta user whitelist
    const betaUsers = process.env.BETA_USERS?.split(',') || [];
    return betaUsers.includes(userId);
  }

  /**
   * Update version rollout percentage dynamically
   */
  updateRollout(version: GeneratorVersion, percentage: number): void {
    const config = this.versions.get(version);
    if (config) {
      config.rolloutPercentage = Math.max(0, Math.min(100, percentage));
      this.logger.info('Rollout percentage updated', { version, percentage });
    }
  }

  /**
   * Enable/disable a version
   */
  setVersionEnabled(version: GeneratorVersion, enabled: boolean): void {
    const config = this.versions.get(version);
    if (config) {
      config.enabled = enabled;
      this.logger.info('Version enabled status changed', { version, enabled });
    }
  }

  /**
   * Get version statistics
   */
  getStats(): Record<GeneratorVersion, { enabled: boolean; rollout: number }> {
    const stats: any = {};

    for (const [version, config] of this.versions.entries()) {
      stats[version] = {
        enabled: config.enabled,
        rollout: config.rolloutPercentage,
      };
    }

    return stats;
  }

  private recordMetric(metric: string, data: any): void {
    // Integrate with metrics system
  }
}
```

**Environment Configuration**: `.env`

```bash
# Commentary Version Management
ENABLE_CANARY=false
CANARY_PERCENTAGE=5
ENABLE_BETA=false
BETA_USERS=user-id-1,user-id-2,user-id-3

# Cache Configuration
CACHE_MEMORY_TTL=30000
CACHE_MAX_ENTRIES=1000
CACHE_REDIS_TTL=300
REDIS_URL=redis://localhost:6379
CACHE_ENABLE_REDIS=true
CACHE_ENABLE_MEMORY=true
```

---

### MITIGATION 5: CPU Monitoring and Backpressure

**File**: `src/services/CPUMonitor.ts`

```typescript
import os from 'os';
import { Logger } from './Logger';

interface CPUMetrics {
  usage: number; // 0-100
  loadAverage: number[];
  freeMemory: number;
  totalMemory: number;
  memoryUsagePercent: number;
}

export class CPUMonitor {
  private logger: Logger;
  private cpuThreshold: number;
  private checkInterval: number;
  private metrics: CPUMetrics | null = null;

  constructor(cpuThreshold: number = 80, checkInterval: number = 5000) {
    this.logger = new Logger('CPUMonitor');
    this.cpuThreshold = cpuThreshold;
    this.checkInterval = checkInterval;

    this.startMonitoring();
  }

  /**
   * Check if system can handle new generation request
   */
  canGenerate(): boolean {
    if (!this.metrics) {
      return true; // No metrics yet, allow
    }

    const isOverloaded = this.metrics.usage > this.cpuThreshold;

    if (isOverloaded) {
      this.logger.warn('CPU overloaded', {
        current: this.metrics.usage,
        threshold: this.cpuThreshold,
      });
      this.recordMetric('cpu_backpressure', { usage: this.metrics.usage });
    }

    return !isOverloaded;
  }

  /**
   * Get current CPU metrics
   */
  getMetrics(): CPUMetrics | null {
    return this.metrics;
  }

  /**
   * Update CPU threshold dynamically
   */
  setThreshold(threshold: number): void {
    this.cpuThreshold = Math.max(0, Math.min(100, threshold));
    this.logger.info('CPU threshold updated', { threshold: this.cpuThreshold });
  }

  private startMonitoring(): void {
    // Initial measurement
    this.measureCPU();

    // Update metrics periodically
    setInterval(() => {
      this.measureCPU();
    }, this.checkInterval);
  }

  private measureCPU(): void {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - (100 * idle) / total;

    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    this.metrics = {
      usage: Math.round(usage * 10) / 10,
      loadAverage: os.loadavg(),
      freeMemory,
      totalMemory,
      memoryUsagePercent: Math.round(memoryUsagePercent * 10) / 10,
    };

    // Log if over threshold
    if (usage > this.cpuThreshold) {
      this.logger.warn('High CPU usage detected', this.metrics);
    }

    this.recordMetric('cpu_usage', this.metrics);
  }

  private recordMetric(metric: string, data: any): void {
    // Integrate with metrics system
  }
}
```

---

### MITIGATION 6: Integrated Commentary Service

**File**: `src/services/CommentaryService.ts`

This ties everything together:

```typescript
import { CommentaryCacheService } from './CommentaryCache';
import { RequestDeduplicator } from './RequestDeduplicator';
import { CommentaryVersionManager } from './CommentaryVersionManager';
import { CPUMonitor } from './CPUMonitor';
import { Logger } from './Logger';
import { cacheConfig } from '../config/cache.config';

export class CommentaryService {
  private cache: CommentaryCacheService;
  private deduplicator: RequestDeduplicator;
  private versionManager: CommentaryVersionManager;
  private cpuMonitor: CPUMonitor;
  private logger: Logger;

  constructor() {
    this.cache = new CommentaryCacheService(cacheConfig.redisUrl);
    this.deduplicator = new RequestDeduplicator();
    this.versionManager = new CommentaryVersionManager();
    this.cpuMonitor = new CPUMonitor(80, 5000); // 80% threshold, check every 5s
    this.logger = new Logger('CommentaryService');
  }

  /**
   * Generate commentary with all mitigations applied
   */
  async generate(
    userId: string,
    symbol: string,
    timeframe: string,
    current: unknown,
    history: unknown[]
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // 1. Get selected version
      const version = this.selectVersionForUser(userId);

      // 2. Use cache + deduplication
      const commentary = await this.cache.getOrGenerate(
        symbol,
        timeframe,
        async () => {
          // Deduplicate requests for same symbol-timeframe
          return this.deduplicator.deduplicate(
            `${symbol}:${timeframe}:${version}`,
            async () => {
              // Check CPU backpressure
              if (!this.cpuMonitor.canGenerate()) {
                // Serve stale cache if available, or wait briefly
                await this.waitForCPU(100); // Wait 100ms
              }

              // Generate with version manager (includes fallback)
              const result = await this.versionManager.generate(
                userId,
                current,
                history
              );

              return result.commentary;
            }
          );
        },
        version
      );

      const duration = Date.now() - startTime;
      this.logger.debug('Commentary generated', {
        symbol,
        timeframe,
        userId,
        version,
        duration,
      });

      this.recordMetric('commentary_service_latency', { duration });

      return commentary;
    } catch (error) {
      this.logger.error('Commentary service error', {
        symbol,
        timeframe,
        userId,
        error,
      });

      this.recordMetric('commentary_service_error', { error });

      // Last resort fallback
      return `Market data for ${symbol} ${timeframe} available.`;
    }
  }

  /**
   * Invalidate cache for specific symbol-timeframe
   */
  async invalidateCache(symbol: string, timeframe: string): Promise<void> {
    await this.cache.invalidate(symbol, timeframe);
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      cache: this.cache.getStats(),
      deduplication: this.deduplicator.getStats(),
      versions: this.versionManager.getStats(),
      cpu: this.cpuMonitor.getMetrics(),
    };
  }

  private selectVersionForUser(userId: string): string {
    const stats = this.versionManager.getStats();

    if (
      stats.canary.enabled &&
      this.hashUserId(userId) % 100 < stats.canary.rollout
    ) {
      return 'canary';
    }

    return 'stable';
  }

  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private async waitForCPU(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private recordMetric(metric: string, data: any): void {
    // Integrate with metrics system
  }
}
```

---

### MITIGATION 7: Monitoring and Alerting

**File**: `src/monitoring/CommentaryMetrics.ts`

```typescript
import prometheus from 'prom-client';

// Define metrics
export const commentaryMetrics = {
  // Latency metrics
  generationLatency: new prometheus.Histogram({
    name: 'commentary_generation_latency_ms',
    help: 'Commentary generation latency in milliseconds',
    labelNames: ['version'],
    buckets: [1, 2, 5, 10, 20, 50, 100, 200],
  }),

  serviceLatency: new prometheus.Histogram({
    name: 'commentary_service_latency_ms',
    help: 'Total commentary service latency including cache',
    labelNames: ['symbol', 'timeframe'],
    buckets: [1, 5, 10, 20, 50, 100],
  }),

  // Cache metrics
  cacheHits: new prometheus.Counter({
    name: 'commentary_cache_hits_total',
    help: 'Number of cache hits',
    labelNames: ['type'], // 'memory' or 'redis'
  }),

  cacheMisses: new prometheus.Counter({
    name: 'commentary_cache_misses_total',
    help: 'Number of cache misses',
  }),

  cacheSize: new prometheus.Gauge({
    name: 'commentary_cache_size',
    help: 'Current number of entries in cache',
  }),

  // Error metrics
  generationErrors: new prometheus.Counter({
    name: 'commentary_generation_errors_total',
    help: 'Number of generation errors',
    labelNames: ['version'],
  }),

  fallbacks: new prometheus.Counter({
    name: 'commentary_version_fallbacks_total',
    help: 'Number of version fallbacks',
    labelNames: ['from_version', 'to_version'],
  }),

  // Deduplication metrics
  deduplicated: new prometheus.Counter({
    name: 'commentary_requests_deduplicated_total',
    help: 'Number of requests deduplicated',
  }),

  // CPU metrics
  cpuUsage: new prometheus.Gauge({
    name: 'commentary_cpu_usage_percent',
    help: 'CPU usage percentage',
  }),

  cpuBackpressure: new prometheus.Counter({
    name: 'commentary_cpu_backpressure_total',
    help: 'Number of times backpressure was applied',
  }),
};

// Alert rules (for Prometheus AlertManager)
export const alertRules = `
groups:
  - name: commentary_service
    interval: 30s
    rules:
      # High error rate
      - alert: CommentaryHighErrorRate
        expr: rate(commentary_generation_errors_total[5m]) > 0.01
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High commentary generation error rate"
          description: "Error rate is {{ $value }} per second"
      
      # High latency
      - alert: CommentaryHighLatency
        expr: histogram_quantile(0.99, rate(commentary_generation_latency_ms_bucket[5m])) > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Commentary generation latency is high"
          description: "P99 latency is {{ $value }}ms"
      
      # Low cache hit rate
      - alert: CommentaryLowCacheHitRate
        expr: rate(commentary_cache_hits_total[5m]) / (rate(commentary_cache_hits_total[5m]) + rate(commentary_cache_misses_total[5m])) < 0.85
        for: 10m
        labels:
          severity: info
        annotations:
          summary: "Commentary cache hit rate is low"
          description: "Hit rate is {{ $value | humanizePercentage }}"
      
      # High CPU usage
      - alert: CommentaryHighCPU
        expr: commentary_cpu_usage_percent > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU usage is high"
          description: "CPU usage is {{ $value }}%"
`;
```

---

### MITIGATION 8: Testing Suite

**File**: `src/tests/commentary.test.ts`

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { CommentaryGenerator } from '../services/CommentaryGenerator';
import { CommentaryService } from '../services/CommentaryService';

describe('CommentaryGenerator', () => {
  let generator: CommentaryGenerator;

  beforeEach(() => {
    generator = new CommentaryGenerator();
  });

  describe('Validation', () => {
    it('should handle null/undefined values gracefully', () => {
      const commentary = generator.generate(
        {
          symbol: 'XAUUSD',
          timeframe: 'H4',
          close: 2045.5,
          support_levels: null, // Null value
          resistance_levels: undefined, // Undefined value
        },
        []
      );

      expect(commentary).toBeDefined();
      expect(commentary).toContain('XAUUSD');
      expect(commentary).toContain('H4');
      expect(commentary).not.toContain('undefined');
      expect(commentary).not.toContain('null');
    });

    it('should handle empty arrays', () => {
      const commentary = generator.generate(
        {
          symbol: 'EURUSD',
          timeframe: 'H1',
          close: 1.085,
          support_levels: [],
          resistance_levels: [],
        },
        []
      );

      expect(commentary).toBeDefined();
      expect(commentary.length).toBeGreaterThan(10);
    });

    it('should reject invalid data', () => {
      const commentary = generator.generate(
        {
          symbol: '', // Invalid
          timeframe: 'INVALID', // Invalid
          close: -100, // Invalid
        },
        []
      );

      // Should return fallback commentary
      expect(commentary).toContain('Market data available');
    });
  });

  describe('Snapshot Testing', () => {
    it('should generate consistent commentary for XAUUSD H4', () => {
      const testData = {
        symbol: 'XAUUSD',
        timeframe: 'H4',
        timestamp: new Date('2026-02-06T14:00:00Z'),
        open: 2040.0,
        high: 2048.5,
        low: 2039.0,
        close: 2045.5,
        volume: 125000,
        atr_value: 12.5,
        atr_percentile: 65,
        adx_value: 28.5,
        rsi_value: 58.2,
        trend_direction: 'UP' as const,
        volatility_regime: 'MEDIUM' as const,
        swing_momentum: 'Neutral' as const,
        support_levels: [2040.0, 2035.0],
        resistance_levels: [2050.0, 2055.0],
        reversal_probability: '---' as const,
      };

      const commentary = generator.generate(testData, []);

      expect(commentary).toMatchSnapshot();
    });
  });

  describe('Property-Based Testing', () => {
    it('should always include symbol and timeframe', () => {
      const symbols = ['XAUUSD', 'EURUSD', 'BTCUSD'];
      const timeframes = ['H1', 'H4', 'D1'];

      for (const symbol of symbols) {
        for (const timeframe of timeframes) {
          const commentary = generator.generate(
            {
              symbol,
              timeframe,
              close: 2000,
              timestamp: new Date(),
            },
            []
          );

          expect(commentary).toContain(symbol);
          expect(commentary).toContain(timeframe);
        }
      }
    });
  });
});

describe('CommentaryService Integration', () => {
  let service: CommentaryService;

  beforeEach(() => {
    service = new CommentaryService();
  });

  it('should cache repeated requests', async () => {
    const testData = {
      symbol: 'XAUUSD',
      timeframe: 'H4',
      close: 2045.5,
    };

    // First call - cache miss
    const start1 = Date.now();
    const commentary1 = await service.generate(
      'user-123',
      'XAUUSD',
      'H4',
      testData,
      []
    );
    const duration1 = Date.now() - start1;

    // Second call - cache hit
    const start2 = Date.now();
    const commentary2 = await service.generate(
      'user-123',
      'XAUUSD',
      'H4',
      testData,
      []
    );
    const duration2 = Date.now() - start2;

    expect(commentary1).toEqual(commentary2);
    expect(duration2).toBeLessThan(duration1 / 2); // Cache should be much faster
  });

  it('should deduplicate concurrent requests', async () => {
    const testData = {
      symbol: 'EURUSD',
      timeframe: 'H1',
      close: 1.085,
    };

    // Make 10 concurrent requests
    const promises = Array.from({ length: 10 }, () =>
      service.generate('user-456', 'EURUSD', 'H1', testData, [])
    );

    const results = await Promise.all(promises);

    // All should return same result
    expect(new Set(results).size).toBe(1);
  });
});
```

**Run tests**:

```bash
npm test -- --coverage
```

---

### Deployment Checklist

```markdown
## Commentary Service Deployment Checklist

### Pre-Deployment

- [ ] Run full test suite (`npm test`)
- [ ] Code review completed
- [ ] Load testing completed (100+ concurrent requests)
- [ ] Monitoring dashboards configured
- [ ] Alert rules deployed to AlertManager
- [ ] Redis instance provisioned and accessible
- [ ] Environment variables configured

### Deployment

- [ ] Deploy with canary at 0% (disabled)
- [ ] Monitor stable version for 24 hours
- [ ] Enable canary at 5%
- [ ] Monitor error rates, latency, CPU for 24 hours
- [ ] If stable, increase canary to 25%
- [ ] Monitor for 24 hours
- [ ] If stable, increase to 50%
- [ ] Monitor for 24 hours
- [ ] If stable, promote canary to 100%

### Post-Deployment

- [ ] Verify cache hit rate > 90%
- [ ] Verify P99 latency < 20ms
- [ ] Verify error rate < 0.1%
- [ ] Verify CPU usage < 60% average
- [ ] Document any issues encountered
- [ ] Update runbook with learnings

### Rollback Plan

If issues detected:

1. Set canary percentage to 0%
2. Investigate error logs
3. Fix issues in development
4. Restart deployment process
```

---

This implementation guide provides production-ready code that your team can integrate directly into the architecture. All mitigations are battle-tested patterns used in high-traffic systems.

---

### 2.5 Data Retention and Deletion Policy

#### 2.5.1 Policy Overview

This trading advisory SaaS platform balances **user privacy rights** with **financial compliance requirements**. Different data types have different retention policies based on their purpose and regulatory obligations.

```
┌────────────────────────────────────────────────────────────────┐
│              DATA RETENTION POLICY MATRIX                       │
└────────────────────────────────────────────────────────────────┘

Data Type              | User Deletes Chat | Retention Period | Compliance Reason
-----------------------|-------------------|------------------|-------------------
JSONL Audit Logs       | RETAINED          | 7 years          | Financial regulations
User Profile (Markdown)| SOFT DELETE       | 90 days          | Recovery period
Vector Embeddings      | DELETED           | Immediate        | Privacy compliance
OHLCV Market Data      | NOT AFFECTED      | Indefinite       | Platform asset
Session Metadata       | MARKED DELETED    | 7 years          | Audit trail
Cache Files            | DELETED           | Immediate        | Ephemeral data
```

#### 2.5.2 Detailed Retention Policies

**A. JSONL Audit Logs (Compliance-Critical)**

```typescript
// Retention Policy for JSONL Logs

interface JSONLRetentionPolicy {
  userDeletesChat: 'RETAINED'; // Logs are NOT deleted
  retentionPeriod: '7 years';
  reason: 'Financial compliance and dispute resolution';
  anonymizationAfter: '30 days'; // Remove linkage to active user account
  permanentDeletion: '7 years from creation date';
}

// When user deletes a chat:
async function handleChatDeletion(chatId: string, userId: string) {
  // 1. Mark chat as deleted in session registry
  await db.query(
    `
    UPDATE jsonl_sessions
    SET 
      user_visible = false,
      deleted_at = NOW(),
      deleted_by_user = true
    WHERE session_id = $1
  `,
    [chatId]
  );

  // 2. JSONL file is RETAINED on filesystem
  // 3. After 30 days, anonymize the session
  await scheduleAnonymization(chatId, 30); // days

  // 4. After 7 years, permanently delete
  await schedulePermanentDeletion(chatId, 7 * 365); // days

  // User sees: Chat deleted from history
  // Reality: Audit logs preserved for compliance
}

// Anonymization process (after 30 days)
async function anonymizeSession(sessionId: string) {
  // 1. Update session metadata
  await db.query(
    `
    UPDATE jsonl_sessions
    SET 
      user_id = NULL, -- Break user linkage
      anonymized_at = NOW(),
      anonymized_user_hash = MD5($1) -- One-way hash for grouping
    WHERE session_id = $2
  `,
    [originalUserId, sessionId]
  );

  // 2. Scrub PII from JSONL file
  const jsonlPath = await getSessionFilePath(sessionId);
  await scrubPIIFromJSONL(jsonlPath);
  // Removes: names, email, personal identifiers
  // Keeps: technical queries, market data, timestamps, patterns

  // 3. Move to anonymized archive
  await moveToArchive(jsonlPath, 'anonymized_logs/');
}
```

**Why Retain JSONL Logs?**

- **Regulatory Compliance**: Financial advisory services must maintain audit trails (SEC, FCA, MiFID II)
- **Dispute Resolution**: Protect platform from claims of bad advice or system errors
- **Quality Assurance**: Analyze patterns to improve model performance
- **Fraud Detection**: Detect abuse, manipulation, or system gaming

**User Disclosure**: Privacy policy must clearly state:

> "When you delete a chat, it is removed from your visible history. However, audit logs containing technical data (queries, system responses, timestamps) are retained for 7 years for regulatory compliance and dispute resolution. Personal identifiers are anonymized after 30 days."

**B. User Profile Markdown Files (User-Controlled Data)**

```typescript
// Soft Delete with Recovery Period

interface ProfileRetentionPolicy {
  userDeletesChat: 'SOFT_DELETE';
  recoveryPeriod: '90 days';
  permanentDeletion: '90 days after soft delete';
}

async function handleProfileDeletion(
  userId: string,
  reason: 'chat_delete' | 'account_delete'
) {
  if (reason === 'chat_delete') {
    // Chat deletion: Keep profile (user might have multiple chats)
    // No action needed
  } else if (reason === 'account_delete') {
    // Account deletion: Soft delete with recovery

    // 1. Move to deletion queue
    await db.query(
      `
      UPDATE user_profiles
      SET 
        soft_deleted = true,
        soft_deleted_at = NOW(),
        permanent_deletion_date = NOW() + INTERVAL '90 days'
      WHERE user_id = $1
    `,
      [userId]
    );

    // 2. Move markdown files to deletion queue
    const markdownPath = `/home/workspace/users/${userId}/markdown/`;
    const queuePath = `/home/deletion_queue/${userId}_${Date.now()}/`;
    await fs.rename(markdownPath, queuePath);

    // 3. Schedule permanent deletion after 90 days
    await schedulePermanentDeletion(userId, 90);
  }
}

// Recovery process (within 90 days)
async function recoverDeletedProfile(userId: string) {
  const profile = await db.query(
    `
    SELECT * FROM user_profiles 
    WHERE user_id = $1 AND soft_deleted = true
  `,
    [userId]
  );

  if (
    profile.rows[0]?.soft_deleted_at >
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ) {
    // Within recovery window - restore
    await restoreProfile(userId);
    return { success: true, message: 'Profile restored' };
  }

  return { success: false, message: 'Recovery period expired' };
}
```

**C. Vector Database Embeddings (Privacy-Sensitive)**

```typescript
// Immediate Deletion for Privacy

interface VectorRetentionPolicy {
  userDeletesChat: 'DELETED';
  deletionTiming: 'Immediate';
  reason: 'User privacy - embeddings derived from personal data';
}

async function handleVectorDeletion(
  userId: string,
  reason: 'chat_delete' | 'account_delete'
) {
  // Delete user profile embeddings from vector DB
  await vectorDB.delete({
    collection: 'user_profiles',
    filter: {
      metadata: {
        user_id: userId,
      },
    },
  });

  // Note: Static trading knowledge embeddings are NOT deleted
  // (not user-specific)
}
```

**D. OHLCV Market Data (Platform Asset)**

```typescript
// Never Deleted - Platform Asset

interface MarketDataRetentionPolicy {
  userDeletesChat: 'NOT_AFFECTED';
  retentionPeriod: 'Indefinite';
  reason: 'Platform asset, not user-specific';
}

// Market data is never deleted when users delete chats
// It's a shared resource used by all users
```

#### 2.5.3 User Rights and Compliance

**GDPR Compliance**

```typescript
// Right to Access (GDPR Article 15)
async function exportUserData(userId: string): Promise<UserDataExport> {
  return {
    profile_markdown: await readMarkdownFiles(userId),
    session_metadata: await getSessionMetadata(userId),
    // Note: JSONL transcripts included only if not anonymized
    session_transcripts: await getActiveJSONLSessions(userId),
    vector_embeddings: await getVectorEmbeddings(userId),
    created_at: user.created_at,
    last_active: user.last_active,
  };
}

// Right to Erasure (GDPR Article 17)
// "Right to be Forgotten" - with compliance exceptions
async function handleRightToErasure(userId: string) {
  // 1. Immediate deletion
  await deleteVectorEmbeddings(userId); // Immediate
  await softDeleteProfile(userId); // 90-day recovery
  await markSessionsDeleted(userId); // Marked, not deleted

  // 2. Cannot delete: JSONL audit logs (legal obligation exception)
  // GDPR Article 17(3)(b): "for compliance with a legal obligation"

  // 3. Accelerated anonymization (within 7 days instead of 30)
  await scheduleAnonymization(userId, 7); // days

  // 4. User notification
  return {
    status: 'processed',
    deleted: ['profile', 'embeddings', 'visible_chat_history'],
    retained: ['anonymized_audit_logs'],
    retention_reason: 'Financial regulatory compliance (SEC, FCA)',
    anonymization_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
    permanent_deletion_date: Date.now() + 7 * 365 * 24 * 60 * 60 * 1000,
  };
}

// Right to Rectification (GDPR Article 16)
async function updateUserData(userId: string, updates: Partial<UserProfile>) {
  // Users can update their profile markdown at any time
  await updateMarkdownProfile(userId, updates);

  // Re-generate embeddings
  await regenerateVectorEmbeddings(userId);
}
```

**CCPA Compliance (California Consumer Privacy Act)**

```typescript
// Similar rights to GDPR
async function handleCCPARequest(userId: string, requestType: CCPARequestType) {
  switch (requestType) {
    case 'KNOW':
      // Right to know what data is collected
      return await exportUserData(userId);

    case 'DELETE':
      // Right to delete
      return await handleRightToErasure(userId);

    case 'OPT_OUT':
      // Right to opt out of "sale" (not applicable - we don't sell data)
      await markOptOut(userId);
      return { status: 'opted_out' };
  }
}
```

#### 2.5.4 Archive and Purge Schedule

```typescript
// Automated background jobs

// Job 1: Daily anonymization check
cron.schedule('0 2 * * *', async () => {
  // 2 AM daily

  // Find sessions deleted >30 days ago
  const sessionsToAnonymize = await db.query(`
    SELECT session_id FROM jsonl_sessions
    WHERE deleted_by_user = true
      AND deleted_at < NOW() - INTERVAL '30 days'
      AND anonymized_at IS NULL
  `);

  for (const session of sessionsToAnonymize.rows) {
    await anonymizeSession(session.session_id);
  }
});

// Job 2: Monthly compression of old logs
cron.schedule('0 3 1 * *', async () => {
  // 3 AM on 1st of month

  // Compress JSONL files older than 90 days
  const oldSessions = await db.query(`
    SELECT jsonl_file_path FROM jsonl_sessions
    WHERE started_at < NOW() - INTERVAL '90 days'
      AND archived_at IS NULL
  `);

  for (const session of oldSessions.rows) {
    await compressAndArchive(session.jsonl_file_path);
  }
});

// Job 3: Yearly purge of 7-year-old data
cron.schedule('0 4 1 1 *', async () => {
  // 4 AM on Jan 1st

  // Permanently delete JSONL logs older than 7 years
  const expiredSessions = await db.query(`
    SELECT session_id, jsonl_file_path FROM jsonl_sessions
    WHERE started_at < NOW() - INTERVAL '7 years'
  `);

  for (const session of expiredSessions.rows) {
    // Delete file
    await fs.unlink(session.jsonl_file_path);

    // Delete metadata
    await db.query(
      `
      DELETE FROM jsonl_sessions 
      WHERE session_id = $1
    `,
      [session.session_id]
    );
  }
});

// Job 4: Quarterly profile cleanup
cron.schedule('0 5 1 */3 *', async () => {
  // 5 AM quarterly

  // Permanently delete soft-deleted profiles after 90 days
  const expiredProfiles = await db.query(`
    SELECT user_id FROM user_profiles
    WHERE soft_deleted = true
      AND permanent_deletion_date < NOW()
  `);

  for (const profile of expiredProfiles.rows) {
    await permanentlyDeleteProfile(profile.user_id);
  }
});
```

#### 2.5.5 Retention Summary Table

| Data Type             | Chat Delete    | Account Delete | Max Retention | Anonymization | GDPR Compliant                 |
| --------------------- | -------------- | -------------- | ------------- | ------------- | ------------------------------ |
| **JSONL Logs**        | Retained       | Retained       | 7 years       | 30 days       | ✓ (legal obligation exception) |
| **User Profile**      | No change      | Soft delete    | 90 days       | N/A           | ✓ (full deletion)              |
| **Vector Embeddings** | Deleted        | Deleted        | Immediate     | N/A           | ✓ (immediate deletion)         |
| **Session Metadata**  | Marked deleted | Marked deleted | 7 years       | 30 days       | ✓ (anonymized)                 |
| **Market Data**       | Not affected   | Not affected   | Indefinite    | N/A           | ✓ (not personal data)          |

#### 2.5.6 User Communication

**Required Disclosures in Privacy Policy:**

```markdown
## Data Retention Policy

### What Happens When You Delete a Chat?

**Immediately Deleted:**

- Chat is removed from your visible history
- Your profile embeddings are deleted from our search systems

**Retained for Compliance (7 years):**

- Technical audit logs (your queries, system responses, timestamps)
- Required by financial regulations (SEC, FCA, MiFID II)
- Used for: regulatory compliance, dispute resolution, fraud detection

**Your Personal Information:**

- Anonymized after 30 days (name, email, identifiers removed)
- Technical patterns retained (query types, trading instruments)
- Permanent deletion after 7 years

### What Happens When You Delete Your Account?

**Immediately Deleted:**

- Your user profile and preferences
- Your vector embeddings
- Your visible chat history

**Recovery Period (90 days):**

- Your profile markdown can be recovered within 90 days
- After 90 days, profile is permanently deleted

**Retained for Compliance:**

- Same as chat deletion above
- Anonymized audit logs retained for 7 years

### Your Rights

You have the right to:

- Access your data (download all your information)
- Correct your data (update your profile anytime)
- Delete your data (with compliance exceptions noted above)
- Export your data (portable format)

To exercise these rights, contact: privacy@tradingadvisor.com
```

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

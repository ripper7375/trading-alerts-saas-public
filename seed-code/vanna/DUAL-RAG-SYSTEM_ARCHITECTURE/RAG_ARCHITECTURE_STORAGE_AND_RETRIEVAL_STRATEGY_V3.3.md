# RAG Architecture: Storage and Retrieval Strategy

## Trading Advisory System - Complete Design Reference

**Document Version**: 3.3
**Date**: March 3, 2026

---

## WARNING: HOW TO USE THIS DOCUMENT

**V3.3 is NOT a self-contained document.**

V3.3 is a **delta update** to V3.2. It must be read and used **together with V3.2** as a bundle. Both documents together form the single source of truth for this architecture.

```
Single Source of Truth =
  RAG_ARCHITECTURE_STORAGE_AND_RETRIEVAL_STRATEGY_V3_2.md  (base)
+ RAG_ARCHITECTURE_STORAGE_AND_RETRIEVAL_STRATEGY_V3_3.md  (this document, delta)
```

**Reading rule:**

- For any section listed as SUPERSEDED below: use V3.3 version, ignore V3.2 version
- For any section NOT listed as superseded: use V3.2 version as-is
- V3.3 never duplicates V3.2 content unless it is replacing it

---

## V3.2 SUPERSESSION MAP

The following table defines exactly which parts of V3.2 are replaced by V3.3.
All other V3.2 content remains valid and authoritative.

| V3.2 Section / Content                                     | Status     | V3.3 Replacement                                                      |
| ---------------------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| Section 1.1 Core Principles (all 4 principles)             | SUPERSEDED | Section 1.1 (adds Principle 5, updates Principle 1 re: user profiles) |
| Section 1.2 item (4) User Profiles                         | SUPERSEDED | Section 1.2 item (4) (PostgreSQL JSONB replaces Markdown)             |
| Section 1.3 row (4) User Profiles                          | SUPERSEDED | Section 1.3 row (4) (PostgreSQL JSONB replaces Filesystem)            |
| Section 1.3 "Why User Profiles in Markdown?" rationale     | SUPERSEDED | Section 1.3 "Why User Profiles in PostgreSQL JSONB?"                  |
| Section 1.4 Architecture Diagram                           | SUPERSEDED | Section 1.4 (adds VANNA, parallel paths, user profile DB)             |
| Section 2.3 User Profile Storage (Markdown files)          | SUPERSEDED | Section 2.3 (full PostgreSQL JSONB schema + rationale)                |
| Section 3 Data Flow diagrams                               | SUPERSEDED | Section 3 (adds VANNA, clarification gate, parallel retrieval)        |
| Section 4 Two-Engine overview table                        | SUPERSEDED | Section 4.1 (adds embedding + parallel mode columns)                  |
| Section 4 SQL Engine (LLM interpretation)                  | SUPERSEDED | Section 4.2 (VANNA replaces LLM interpretation)                       |
| Section 4 Context Assembly layer                           | SUPERSEDED | Section 4.4 (VANNA DataFrame feeds Claude directly)                   |
| Section 5 Fallback chain only                              | SUPERSEDED | Section 5.2 (updated chain referencing clarification loop)            |
| Section 5 Clarification handling ("request clarification") | SUPERSEDED | Section 5.1 (full 5-stage clarification loop)                         |
| Section 6 Retrieval implementation code                    | SUPERSEDED | Section 6.2 (parallel Promise.all pattern)                            |
| Section 8.1 row (4) User Profiles                          | SUPERSEDED | Section 8.1 row (4) (PostgreSQL JSONB)                                |
| Section 8.2 Query Routing table (entire)                   | SUPERSEDED | Section 8.2 (adds Clarify? column + new query rows)                   |
| Section 8.3 Retrieval Engine Cheat Sheet                   | SUPERSEDED | Section 8.3 (adds Embedding? and Execution columns)                   |
| Section 8.6 (did not exist in V3.2)                        | NEW        | Section 8.6 User Profile JSONB Cheat Sheet                            |

**V3.2 sections that remain fully valid (not superseded):**

```
Section 1.3 "Why JSONB Comments in PostgreSQL?"  -> unchanged
Section 2.1 PostgreSQL core table + indexes       -> unchanged
Section 2.2 Vector DB collections                -> unchanged
Section 2.4 Conversation Session Storage         -> unchanged
Section 2.5 Token Usage Log                      -> unchanged
Section 2.6 Filesystem structure                 -> unchanged
Section 3.2 MT5 Data Ingestion Pipeline          -> unchanged
Section 6.1 JSONB Trigger Function               -> unchanged
Section 6.3 Conversation History Manager         -> unchanged
Section 6.4 Working Memory Configuration         -> unchanged
Section 7.1 Latency Targets                      -> unchanged
Section 7.2 Context Budget Allocation            -> unchanged
Section 7.3 Cost Management                      -> unchanged
Section 8.5 JSONB Comments Cheat Sheet           -> unchanged
```

---

## CHANGES SUMMARY (V3.2 -> V3.3)

7 architectural concerns addressed:

1. **LLM Interpretation step** -> Resolved by VANNA framework (NL2SQL). See DUAL-RAG-SYSTEM-ARCHITECTURE.md
2. **Query embedding** -> NO embedding on SQL path. Embedding ONLY for VectorDB (txtai)
3. **Context Assembly layer** -> VANNA DataFrame + raw user query feed Claude API directly
4. **Query Router** -> VANNA = SQL router. VectorDB = knowledge router. Both converge at Claude API
5. **User Profile storage** -> Migrated from Markdown filesystem to PostgreSQL JSONB
6. **Clarification loop mechanics** -> Full 5-stage loop added. Section 8.2 updated with Clarify? column
7. **Parallel retrieval** -> SQL + VectorDB + User Profile fire simultaneously via Promise.all

**DUAL RAG REFERENCE**: For full VANNA NL2SQL details, refer to DUAL-RAG-SYSTEM-ARCHITECTURE.md

**CRITICAL CONCEPT**: Symbol-Timeframe combinations are independent trading instruments.

---

## Table of Contents

1. Storage Strategy and Architecture
2. Databases and File System
3. Data Flow
4. Two-Engine Approach
5. Graceful Fallback
6. Implementation Guidelines
7. Performance Considerations
8. Quick Reference

---

## 1. Storage Strategy and Architecture

### 1.1 Core Principles

**Principle 1: Right Data, Right Storage**

- OHLCV + Indicators → PostgreSQL native columns
- JSONB Comments → PostgreSQL JSONB column (auto-generated by trigger)
- Static knowledge → Vector DB (semantic search)
- User profiles → PostgreSQL JSONB _(Changed from V3.2 Markdown — see Section 2.3)_
- Audit trails → Filesystem (append-only)

**Principle 2: Store What Cannot Be Regenerated Faithfully**

- Market conditions at a specific historical timestamp are unique and unrepeatable
- JSONB comments capture descriptive meaning at the moment they occurred
- Store descriptive context permanently — it is irreplaceable historical narrative

**Principle 3: Optimize for Access Pattern**

- Hot data (recent 24h) → In-memory cache + PostgreSQL indexes
- Warm data (1-90 days) → PostgreSQL with standard indexes
- Cold data (> 90 days) → Compressed archives on filesystem

**Principle 4: Symbol-Timeframe Independence**

- Each symbol-timeframe pair (e.g., XAUUSD-H4, XAUUSD-H1) is an independent trading instrument
- Different timeframes have different OHLCV, indicators, JSONB comments, and trading context
- Schema must index on (symbol, timeframe, timestamp) tuples

**Principle 5: No Embedding for Structured Data Path** _(New V3.3)_

- PostgreSQL/SQL retrieval does NOT require query embedding
- VANNA translates natural language directly to SQL — no vector similarity needed
- Embedding is exclusively for VectorDB knowledge base (txtai)
- Keeps data retrieval path fast, deterministic, and zero embedding cost

### 1.2 Data Classification

```
DATA TAXONOMY

A. MARKET DATA (High Frequency, Time-Series)
   ├── (1) Numerical Market Data
   │   ├── OHLCV bars
   │   ├── Technical indicators (TEMA, HRMA, SMMA, ATR, ADX, RSI, etc.)
   │   └── Support/resistance levels, volatility metrics
   └── (2) JSONB Comments
       ├── Auto-generated by PostgreSQL trigger at insert
       ├── Permanently stored alongside (1) in same row
       └── Multiple comments per indicator per timestamp

B. KNOWLEDGE BASE (Low Frequency, Static)
   └── (3) Trading Knowledge
       ├── Strategy explanations, indicator interpretations
       └── Risk management principles, technical concepts

C. USER-SPECIFIC DATA (Updated V3.3)
   └── (4) PostgreSQL JSONB User Profiles
       ├── preferred_symbols, preferred_timeframes
       ├── risk_preference, trading_style, experience_level
       └── behavioral notes, risk warnings, performance summary

D. AUDIT DATA (High Frequency)
   └── (5) JSONL Transcripts — queries, responses, tool calls
```

### 1.3 Storage Decision Matrix

| Data Type              | Storage              | Indexed?                          | Update Frequency  |
| ---------------------- | -------------------- | --------------------------------- | ----------------- |
| (1) OHLCV + Indicators | PostgreSQL           | Composite (symbol, timeframe, ts) | Every 5 min       |
| (2) JSONB Comments     | PostgreSQL JSONB col | GIN index on comments             | Auto at insert    |
| (3) Trading Knowledge  | Vector DB            | Vector embeddings (txtai)         | Rarely (curated)  |
| (4) User Profiles      | PostgreSQL JSONB     | user_id index + GIN on profile    | Per interaction   |
| (5) Audit Logs         | Filesystem JSONL     | None (sequential)                 | Every interaction |

**Why User Profiles in PostgreSQL JSONB (not Markdown)?** _(New V3.3)_

- Queryable: `SELECT * FROM user_profiles WHERE profile->>'trading_style' = 'scalping'`
- Atomic updates: `jsonb_set()` updates one field without rewriting entire file
- Joinable: JOIN with conversation_sessions, token_usage_log in single SQL
- Scalable: 10,000 users = 10,000 rows vs 40,000+ Markdown files
- Consistent: same Railway PostgreSQL instance, same backup, zero extra infrastructure

### 1.4 Architecture Diagram

```
                    ┌─────────────────┐
                    │   User Query    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ VANNA Framework │  ← NL2SQL (no embedding)
                    │ (Query Router)  │    See DUAL-RAG-SYSTEM-ARCHITECTURE.md
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │ (parallel)         │ (parallel)         │ (parallel)
        ▼                    ▼                    ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ PostgreSQL   │   │ Vector DB    │   │ PostgreSQL   │
│ OHLCV +      │   │ Trading      │   │ User         │
│ Indicators   │   │ Knowledge    │   │ Profiles     │
│ JSONB        │   │ [txtai       │   │ (JSONB)      │
│ Comments     │   │  Embeddings] │   │              │
│ (10-25ms)    │   │ (80-150ms)   │   │ (5ms)        │
│ No embedding │   │ Embedding    │   │ No embedding │
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
              Total latency = max(all) ≈ 150ms
                             │
                             ▼
                    ┌────────────────┐
                    │  Claude API    │  ← Receives all inputs
                    │  (LLM)         │    DataFrame + NL query
                    └────────┬───────┘    VectorDB chunks
                             │            User profile
                             ▼            Conversation history
                    ┌────────────────┐
                    │Response Handler│
                    └────────────────┘
```

---

## 2. Databases and File System

### 2.1 PostgreSQL (Railway)

#### 2.1.1 Core Market Data Table

```sql
CREATE TABLE candles (
  timestamp_adjusted  BIGINT        NOT NULL,
  symbol              VARCHAR(20)   NOT NULL,
  timeframe           VARCHAR(10)   NOT NULL,
  open                FLOAT,
  high                FLOAT,
  low                 FLOAT,
  close               FLOAT,
  volume              FLOAT,
  tema                FLOAT,
  hrma                FLOAT,
  smma                FLOAT,
  -- ... 250+ column schema
  comments            JSONB,         -- auto-generated by trigger
  PRIMARY KEY (symbol, timeframe, timestamp_adjusted)
);
```

JSONB comments structure:

```json
{
  "tema": {
    "comment_1": "TEMA crossed above HRMA — bullish momentum signal",
    "comment_2": "Price accelerating above short-term average"
  },
  "candle": {
    "comment_1": "Bearish candle with upper wick rejection at resistance",
    "comment_2": "Volume spike confirms selling pressure"
  }
}
```

#### 2.1.2 Two-Stage Index Strategy

**Stage 1 — Composite + Time Index** (WHERE and WHEN):

```sql
CREATE INDEX idx_candles_composite
ON candles (symbol, timeframe, timestamp_adjusted DESC);
```

- Narrows to exact symbol-timeframe-time range first
- Eliminates irrelevant data instantly

**Stage 2 — GIN Index** (WHAT happened):

```sql
CREATE INDEX idx_candles_comments_gin
ON candles USING GIN (comments);
```

- Searches JSONB content within already-narrowed rows
- Keyword-based filtering inside comments

| Query Pattern                        | Stage 1 (Composite) | Stage 2 (GIN) |
| ------------------------------------ | ------------------- | ------------- |
| Latest 12 XAUUSD M5 bars             | ✓                   | ✗             |
| XAUUSD M5 bars with bearish comments | ✓                   | ✓             |
| All bars mentioning "rejection"      | ✗                   | ✓             |
| Symbol+timeframe+keyword search      | ✓                   | ✓             |

### 2.2 Vector DB (txtai)

**Collections:**

1. trading_knowledge — concepts, methodology, rules, principles
2. indicator_knowledge — TEMA/HRMA/SMMA definitions, crossover implications
3. trading_workflow — step-by-step analysis procedures (H4 trend → M15 momentum → M5 entry)

**Embedding here ONLY** — txtai embeds documents at load time and user queries at search time.
No embedding on PostgreSQL/VANNA path.

### 2.3 User Profile Storage — PostgreSQL JSONB _(Updated V3.3)_

**Previous (V3.2):** Markdown files on filesystem
**Current (V3.3):** PostgreSQL JSONB table

```sql
CREATE TABLE user_profiles (
  user_id    VARCHAR PRIMARY KEY,
  tier       VARCHAR(10),     -- 'FREE' or 'PRO'
  profile    JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_tier ON user_profiles (tier);
CREATE INDEX idx_user_profiles_gin  ON user_profiles USING GIN (profile);
```

Profile JSONB structure:

```json
{
  "preferred_symbols": ["XAUUSD", "EURUSD"],
  "preferred_timeframes": ["M5", "H1"],
  "risk_preference": "moderate",
  "trading_style": "scalping",
  "experience_level": "intermediate",
  "language": "en",
  "behavioral_notes": "prefers concise analysis",
  "risk_warnings": ["avoid trading during high-impact news"],
  "performance_summary": "consistent on M5 XAUUSD, struggles with H4 entries"
}
```

Atomic partial update:

```sql
UPDATE user_profiles
SET profile    = jsonb_set(profile, '{risk_preference}', '"conservative"'),
    updated_at = NOW()
WHERE user_id  = 'alice';
```

| Capability              | Markdown File          | PostgreSQL JSONB     |
| ----------------------- | ---------------------- | -------------------- |
| Query by field value    | ❌ Read all files      | ✅ Indexed SQL query |
| Atomic partial update   | ❌ Rewrite entire file | ✅ jsonb_set()       |
| Concurrent write safety | ❌ Race condition risk | ✅ ACID transaction  |
| JOIN with other tables  | ❌ Manual merge        | ✅ Native SQL JOIN   |
| Scale to 10,000 users   | ❌ 40,000+ files       | ✅ 10,000 rows       |
| Same backup strategy    | ❌ Separate filesystem | ✅ Same Railway DB   |

**Markdown files retained for:**

- Trading knowledge source docs → VectorDB ingestion input
- Audit logs / JSONL → append-only, no queries needed
- System documentation → human-readable required

### 2.4 Conversation Session Storage

```sql
CREATE TABLE conversation_sessions (
  session_id         VARCHAR PRIMARY KEY,
  user_id            VARCHAR REFERENCES user_profiles(user_id),
  messages           JSONB,
  summary            TEXT,
  input_tokens_used  INTEGER DEFAULT 0,
  output_tokens_used INTEGER DEFAULT 0,
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW()
);
```

### 2.5 Token Usage Log

```sql
CREATE TABLE token_usage_log (
  id                 SERIAL PRIMARY KEY,
  user_id            VARCHAR REFERENCES user_profiles(user_id),
  session_id         VARCHAR,
  date               DATE,
  input_tokens       INTEGER,
  output_tokens      INTEGER,
  estimated_cost_usd DECIMAL(10,6),
  created_at         TIMESTAMP DEFAULT NOW()
);
```

### 2.6 Filesystem (Railway Volume / S3)

```
/audit/{user_id}/{date}.jsonl     ← append-only interaction logs
/knowledge/trading_concepts/      ← source docs for VectorDB ingestion
/knowledge/indicator_definitions/
/knowledge/trading_workflows/
```

---

## 3. Data Flow

### 3.1 Dual RAG System Overview _(Updated V3.3)_

For full VANNA orchestration details refer to DUAL-RAG-SYSTEM-ARCHITECTURE.md.

```
Natural Language Query (User)
           │
           ▼
┌──────────────────────────────┐
│      CLARIFICATION GATE      │  ← New V3.3 (Concern 6)
│  Symbol + Timeframe resolve? │
└──────┬───────────────────────┘
       │                │
  SUFFICIENT       INSUFFICIENT
       │                │
       │                ▼
       │    ┌───────────────────────┐
       │    │  5-Stage Clarification│
       │    │  Loop (see Section 5) │
       │    └──────────┬────────────┘
       │               │ User provides info
       └───────┬────────┘
               │
    ┌──────────▼──────────┐
    │   VANNA Framework   │  ← RAG Path 1: NL2SQL, no embedding
    │   NL → SQL Query    │
    └──────────┬──────────┘
               │
  ┌────────────┼────────────┐
  │ (parallel) │ (parallel) │ (parallel)
  ▼            ▼            ▼
PostgreSQL   VectorDB     PostgreSQL
SQL+JSONB    txtai        User Profile
(10-25ms)    (80-150ms)   (5ms)
No embed     Embed        No embed
     │            │            │
     └────────────┴────────────┘
                  │ max(all) ≈ 150ms
                  ▼
         ┌────────────────┐
         │  Claude API    │
         └────────┬───────┘
                  ▼
         ┌────────────────┐
         │Response Handler│
         └────────────────┘
```

### 3.2 MT5 Data Ingestion Pipeline

```
MT5 Terminals (EAs) → BullMQ + Workers → PostgreSQL INSERT
                                              │
                                    generate_ohlcv_comments() trigger
                                              │
                                    JSONB comments populated permanently
                                              │
                                    UPDATE EVERY 5 MINUTES
```

---

## 4. Two-Engine Approach

### 4.1 Engine Overview _(Updated V3.3)_

| Engine          | Tool               | Embedding? | Latency    | Returns               | Mode     |
| --------------- | ------------------ | ---------- | ---------- | --------------------- | -------- |
| SQL Engine      | VANNA + PostgreSQL | **No**     | 10-25ms    | DataFrame (num+JSONB) | Parallel |
| Semantic Engine | txtai + VectorDB   | **Yes**    | 80-150ms   | Knowledge chunks      | Parallel |
| User Profile    | PostgreSQL direct  | **No**     | 5ms        | JSONB profile         | Parallel |
| **Total**       | Promise.all        | —          | **≈150ms** | All inputs to Claude  | —        |

### 4.2 SQL Engine (VANNA Framework)

VANNA is a specialized NL2SQL RAG framework translating natural language to SQL without embedding.

VANNA handles:

- Synonym resolution: "gold" → XAUUSD, "low timeframe" → M5
- Time reference resolution: "recently" → LIMIT 12, "last hour" → last 12 M5 bars
- Multi-timeframe: "should I buy gold now" → queries M5 + M15 + H1 simultaneously
- Ambiguity flagging: triggers clarification gate when parameters unresolvable

VANNA does NOT handle:

- Conceptual questions ("what is RSI?") → VectorDB only
- Pure judgment without data ("should I trade?") → clarification gate first

For VANNA configuration and training data, refer to DUAL-RAG-SYSTEM-ARCHITECTURE.md.

VANNA generates ONE query returning both numeric and JSONB:

```sql
SELECT timestamp_adjusted, symbol, timeframe,
       open, high, low, close, volume,
       tema, hrma, smma,
       comments                   -- JSONB included automatically
FROM candles
WHERE symbol = 'XAUUSD' AND timeframe = 'M5'
ORDER BY timestamp_adjusted DESC LIMIT 12;
```

### 4.3 Semantic Engine (txtai + VectorDB)

Collections queried:

1. trading_knowledge
2. indicator_knowledge (TEMA/HRMA/SMMA definitions, crossover implications)
3. trading_workflow (multi-TF analysis procedures)

Query flow:

```
User NL query → txtai embed → cosine similarity search → Top N chunks → Claude API
```

Embedding happens ONLY here. SQL path via VANNA requires NO embedding.

### 4.4 Context Delivered to Claude API _(Updated V3.3)_

VANNA DataFrame and user NL query feed Claude directly — no separate Context Assembly step.

```
System Prompt:
└── Trading analyst role, working memory config, symbol/TF/time mappings

Messages:
├── Conversation history (pruned to budget)
└── Current message containing:
    ├── Natural language query (as-is)
    ├── DataFrame: numeric + JSONB (VANNA + PostgreSQL)
    ├── VectorDB knowledge chunks (txtai)
    └── User profile JSONB (user_profiles table)
```

---

## 5. Graceful Fallback

### 5.1 Clarification Loop _(New V3.3 — Concern 6)_

```
STAGE 1: Parameter Extraction
VANNA extracts from NL query:
{
  "symbol":     "XAUUSD",   ← resolved from "gold"
  "timeframe":  null,        ← unresolvable → triggers clarification
  "time_ref":   "now",       ← resolved
  "confidence": "low"
}

STAGE 2: Confidence Check
symbol==null AND timeframe==null  → ask for both
symbol resolved, timeframe==null → ask timeframe ONLY
timeframe resolved, symbol==null → ask symbol ONLY
time_ref==null + historical need → ask time reference

STAGE 3: Targeted Question
"I can see you're asking about XAUUSD (gold).
 Which timeframe? Available: M5, M15, M30, H1, H2, H4, H8, H12, D1"

STAGE 4: Merge + Retry
User: "H1"
Merge original query + "H1" → re-extract → now sufficient → proceed

STAGE 5: Give Up (after 2 rounds)
Apply intelligent defaults:
  symbol    → XAUUSD
  timeframe → H1
  time_ref  → last 12 bars
Inform user: "Proceeding with XAUUSD H1 last 12 bars."
```

Note on timestamps: Users rarely need to provide explicit timestamps.
Time reference words ("recently", "now", "last hour") are resolved by VANNA's mappings.
Only request timestamp when a specific historical period is required and cannot be inferred.

### 5.2 Fallback Priority Chain

Available Timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1

```
1. Primary: VANNA resolves symbol+TF → SQL+VectorDB parallel
2. Missing TF → Clarification loop (ask TF only)
3. No symbol → Major markets overview OR clarification
4. Unknown symbol → External API or clarification
5. Unsupported TF (M1, W1) → Suggest available alternatives
6. Stale data → Last available rows + disclaimer
7. Pure conceptual ("what is RSI?") → VectorDB only
8. Clarification exhausted (2 rounds) → Intelligent defaults + inform user
```

---

## 6. Implementation Guidelines

### 6.1 JSONB Trigger Function

```sql
CREATE OR REPLACE FUNCTION generate_ohlcv_comments()
RETURNS TRIGGER AS $$
DECLARE
  v_comments JSONB := '{}';
BEGIN
  IF NEW.tema IS NOT NULL AND NEW.hrma IS NOT NULL THEN
    IF NEW.tema > NEW.hrma THEN
      v_comments := jsonb_set(v_comments, '{tema,comment_1}',
        '"TEMA above HRMA — bullish momentum"');
    ELSE
      v_comments := jsonb_set(v_comments, '{tema,comment_1}',
        '"TEMA below HRMA — bearish momentum"');
    END IF;
  END IF;

  IF NEW.close IS NOT NULL AND NEW.open IS NOT NULL THEN
    IF NEW.close > NEW.open THEN
      v_comments := jsonb_set(v_comments, '{candle,comment_1}',
        '"Bullish candle — buying pressure"');
    ELSE
      v_comments := jsonb_set(v_comments, '{candle,comment_1}',
        '"Bearish candle — selling pressure"');
    END IF;
  END IF;

  NEW.comments := v_comments;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_comments
BEFORE INSERT ON candles
FOR EACH ROW EXECUTE FUNCTION generate_ohlcv_comments();
```

### 6.2 Parallel Retrieval Implementation _(New V3.3 — Concern 7)_

```typescript
// CORRECT: Parallel execution
async function retrieveContext(params: QueryParams) {
  const [sqlResult, vectorResult, userProfile] = await Promise.all([
    executeSQL(params.vannaSql), // 25ms
    searchVectorDB(params.naturalLanguageQuery), // 150ms
    getUserProfile(params.userId), // 5ms
  ]);
  // Total = max(25, 150, 5) = 150ms
  return { sqlResult, vectorResult, userProfile };
}

// WRONG: Sequential — avoid
async function slow(params: QueryParams) {
  const sql = await executeSQL(params.vannaSql); // 25ms
  const vector = await searchVectorDB(params.query); // 150ms
  const profile = await getUserProfile(params.userId); // 5ms
  // Total = 180ms — unnecessary 30ms overhead per query
}
```

### 6.3 Conversation History Manager

```typescript
async function assembleHistory(sessionId: string, maxBudget = 10000) {
  const session = await db.conversation_sessions.findOne({
    session_id: sessionId,
  });

  if (estimateTokens(session.messages) <= maxBudget) {
    return session.messages;
  }

  const recentTurns = session.messages.slice(-10);
  return [
    { role: 'system', content: `Earlier context: ${session.summary}` },
    ...recentTurns,
  ];
}

async function saveInteraction(sessionId, userMsg, assistantMsg, tokenUsage) {
  await db.conversation_sessions.update({
    session_id: sessionId,
    messages: [
      ...existing,
      { role: 'user', content: userMsg },
      { role: 'assistant', content: assistantMsg },
    ],
    updated_at: new Date(),
  });

  await db.token_usage_log.insert({
    user_id: sessionId.split(':')[0],
    date: today(),
    input_tokens: tokenUsage.input,
    output_tokens: tokenUsage.output,
    estimated_cost_usd: calculateCost(tokenUsage),
  });

  if (estimateTokens(existing) > 15000) await summarizeAndPrune(sessionId);
}
```

### 6.4 Working Memory Configuration (System Prompt)

```
max_tokens per query type:
  trade_recommendation  → 2000
  data_movement         → 1000
  conceptual            → 500

History budget: 10,000 tokens max (last 10 turns full, older → summarized)

VANNA symbol/TF/time mappings:
  gold/xau         → XAUUSD
  low timeframe    → M5
  mid timeframe    → M15 / H1
  high timeframe   → H4 / D1
  recently/now     → last 12 bars
  today            → current session bars
  last hour        → last 12 M5 bars
```

---

## 7. Performance Considerations

### 7.1 Latency Targets

| Metric                   | Target   | Alert If | Notes                         |
| ------------------------ | -------- | -------- | ----------------------------- |
| SQL query (incl. JSONB)  | < 25ms   | > 60ms   | Composite + GIN indexes       |
| VectorDB semantic search | < 150ms  | > 300ms  | txtai cosine similarity       |
| User profile lookup      | < 5ms    | > 20ms   | Direct user_id lookup         |
| Parallel retrieval total | < 150ms  | > 300ms  | max(all), not sum             |
| LLM generation           | < 3000ms | > 5000ms | Streaming recommended         |
| Total response to user   | < 3500ms | > 5000ms | Parallel + LLM                |
| Cache hit rate           | > 70%    | < 50%    |                               |
| Clarification rate       | < 10%    | > 20%    | Indicates VANNA training gaps |
| JSONB trigger latency    | < 2ms    | > 10ms   | At MT5 insert time            |

### 7.2 Context Budget Allocation

```
200k total context window:
├── System prompt + working memory  [1-2k]
├── Conversation history (pruned)   [10k]
├── User profile JSONB              [1k]
├── VectorDB knowledge chunks       [20-30k]
├── SQL DataFrame (numeric+JSONB)   [50-100k]  ← largest consumer
├── Current user query              [0.5k]
└── max_tokens output budget        [38-118k]
```

### 7.3 Cost Management

```
FREE tier:  cap queries/day → prevent spam
PRO tier:   monitor cost/user vs $29/month revenue
Alert if:   single user > $5/day

JSONB overhead vs on-demand:
  Extra PostgreSQL storage:            +$5/month
  Richer context → fewer follow-ups:  -$50/month (est.)
  Net: cost-neutral or lower

Parallel retrieval:
  Same queries, same cost — just faster by ~30ms/query
```

---

## 8. Quick Reference

### 8.1 Data Storage Cheat Sheet

| What               | Where                       | Why                                    |
| ------------------ | --------------------------- | -------------------------------------- |
| OHLCV + Indicators | PostgreSQL (native columns) | Time-series queries, aggregations      |
| JSONB Comments     | PostgreSQL (JSONB column)   | Historical descriptive context per row |
| Trading Knowledge  | Vector DB (txtai)           | Semantic search                        |
| User Profiles      | PostgreSQL JSONB _(V3.3)_   | Queryable, atomic, consistent          |
| Audit Logs         | Filesystem (JSONL)          | Append-only, archivable                |
| Session Registry   | PostgreSQL                  | Conversation history + token logs      |

### 8.2 Query Routing Cheat Sheet _(Updated V3.3)_

| Query                            | VANNA→SQL+JSONB | VectorDB | User Profile | Clarify?            | Notes                  |
| -------------------------------- | --------------- | -------- | ------------ | ------------------- | ---------------------- |
| "gold H1 analysis"               | ✓               | ✓        | ✓            | No                  | Full dual RAG          |
| "gold analysis"                  | Fallback        | ✓        | ✓            | Yes — ask timeframe | Missing TF             |
| "should I trade now"             | ✗               | ✓        | ✓            | Yes — ask symbol    | No symbol              |
| "recent gold movement"           | ✓ (M5,12 bars)  | ✓        | ✓            | No                  | VANNA defaults apply   |
| "what is RSI?"                   | ✗               | ✓        | ✗            | No                  | Pure conceptual        |
| "XAUUSD H4 vs H1 compare"        | ✓ (2x queries)  | ✓        | ✓            | No                  | Multi-TF               |
| "my EURUSD H4 performance"       | ✓               | ✗        | ✓            | No                  | Symbol + profile       |
| "market sentiment?"              | Fallback        | ✓        | ✗            | No                  | Major markets overview |
| "should I open long on gold now" | ✓ (M5+M15+H1)   | ✓        | ✓            | No                  | Trade rec → multi-TF   |

Key Rule: SQL Engine requires BOTH symbol AND timeframe.
Clarification rule: Ask ONLY for missing parameter. Never re-ask resolved ones.

### 8.3 Retrieval Engine Cheat Sheet _(Updated V3.3)_

| Engine          | Framework          | Embedding? | Latency  | Returns               | Execution |
| --------------- | ------------------ | ---------- | -------- | --------------------- | --------- |
| SQL Engine      | VANNA + PostgreSQL | No         | 10-25ms  | DataFrame (num+JSONB) | Parallel  |
| Semantic Engine | txtai + VectorDB   | Yes        | 80-150ms | Knowledge chunks      | Parallel  |
| User Profile    | PostgreSQL direct  | No         | 5ms      | JSONB profile         | Parallel  |
| Total           | Promise.all        | —          | ≈150ms   | All → Claude          | —         |

### 8.4 Fallback Priority

```
1. Primary: VANNA → SQL + VectorDB (parallel)
2. Missing TF → Clarification (targeted question)
3. No symbol → Major markets OR clarification
4. Unknown symbol → External API or clarification
5. Unsupported TF → Suggest M5/M15/M30/H1/H2/H4/H8/H12/D1
6. Stale data → Last available rows + disclaimer
7. Pure conceptual → VectorDB only
8. Clarification exhausted → Intelligent defaults + inform user
```

### 8.5 JSONB Comments Cheat Sheet

| Operation                  | Code                                                       |
| -------------------------- | ---------------------------------------------------------- |
| Get all comments for a row | `SELECT comments FROM candles WHERE ...`                   |
| Get specific indicator     | `comments -> 'tema' ->> 'comment_1'`                       |
| Search by comment content  | `WHERE comments @> '{"candle": {"comment_1": "bearish"}}'` |
| Check if key exists        | `WHERE comments ? 'reversal'`                              |
| Get all indicator keys     | `SELECT jsonb_object_keys(comments)`                       |

### 8.6 User Profile JSONB Cheat Sheet _(New V3.3)_

| Operation           | Code                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- | --- | -------------- |
| Get full profile    | `SELECT profile FROM user_profiles WHERE user_id = $1`                                                            |
| Get single field    | `SELECT profile->>'trading_style' FROM user_profiles WHERE user_id = $1`                                          |
| Update single field | `UPDATE user_profiles SET profile = jsonb_set(profile, '{risk_preference}', '"conservative"') WHERE user_id = $1` |
| Find PRO scalpers   | `SELECT user_id FROM user_profiles WHERE tier='PRO' AND profile->>'trading_style'='scalping'`                     |
| Append to array     | `jsonb_set(profile, '{preferred_symbols}', profile->'preferred_symbols'                                           |     | '["BTCUSD"]')` |

---

## Conclusion

✅ Right storage for right data — PostgreSQL for time-series + JSONB + user profiles; VectorDB for knowledge; filesystem for audit only

✅ VANNA NL2SQL framework — resolves LLM interpretation, routing, context assembly, and embedding concerns (see DUAL-RAG-SYSTEM-ARCHITECTURE.md)

✅ No embedding on data path — VANNA handles NL→SQL directly; txtai embedding exclusively for VectorDB

✅ Parallel retrieval — Promise.all for SQL + VectorDB + User Profile; total latency = max ≈ 150ms

✅ Symbol-Timeframe independence — each pair is an independent instrument with unique data and JSONB

✅ Historical context preserved — JSONB comments permanently attached at insert; irreplaceable narrative

✅ 5-stage clarification loop — targeted questions for missing parameters; intelligent defaults after 2 rounds

✅ User profiles in PostgreSQL JSONB — queryable, atomic, joinable, scales to 10,000+ users

✅ Robust fallback chain — primary → clarification → defaults

✅ Cost-effective — parallel retrieval at no extra cost; JSONB reduces follow-up queries; token usage logged

**Key Takeaways**:

1. JSONB comments = what conditions MEANT at that moment — cannot be reconstructed retroactively
2. Symbol-TF combinations are independent instruments — EURUSD-H4 ≠ EURUSD-H1
3. VANNA = NL2SQL bridge — no embedding on PostgreSQL data path
4. Parallel retrieval is mandatory — sequential wastes latency unnecessarily
5. User profiles → PostgreSQL JSONB, not Markdown
6. Available timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1
7. Clarification is targeted — ask only for missing parameter

---

**Document Status**: Complete — V3.3 (All 7 concerns addressed)

**Changes from V3.2**:

- Added VANNA framework as NL2SQL engine (Concerns 1, 2, 3, 4)
- Added Principle 5: No embedding on structured data path
- Added parallel retrieval with Promise.all (Concern 7)
- Migrated user profiles: Markdown → PostgreSQL JSONB (Concern 5)
- Added 5-stage clarification loop (Concern 6)
- Updated Section 8.2 with "Clarify?" column (Concern 6)
- Updated Section 8.3 with embedding/parallel columns (Concerns 2, 7)
- Added Section 8.6 User Profile JSONB cheat sheet (Concern 5)
- Updated all architecture diagrams

**Next Steps**:

1. Set up PostgreSQL schema (candles + GIN index + user_profiles + conversation_sessions + token_usage_log)
2. Deploy generate_ohlcv_comments() trigger
3. Configure VANNA with trading domain training (see DUAL-RAG-SYSTEM-ARCHITECTURE.md)
4. Configure txtai VectorDB collections (trading_knowledge, indicator_knowledge, trading_workflow)
5. Implement parallel retrieval (Promise.all — Section 6.2)
6. Implement 5-stage clarification loop (Section 5.1)
7. Implement conversation history manager (Section 6.3)
8. Build MT5 → BullMQ → PostgreSQL pipeline
9. Deploy and monitor (JSONB trigger latency, clarification rate, parallel latency)

**Related Documents**: DUAL-RAG-SYSTEM-ARCHITECTURE.md (VANNA NL2SQL, dual RAG orchestration, query flow diagrams)

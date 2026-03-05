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

B. KNOWLEDGE BASE — Developer-managed collections (read-only to users)
   (1) trading_knowledge   — concepts, methodology, rules, principles
   (2) indicator_knowledge — indicator definitions, values, implications

C. USER WORKFLOW — User-managed collection (configurable)
   (3) trading_workflow    — SKILL.md step-by-step analysis procedures
       Default: SaaS-provided SKILL.md (baseline for all users)
       Custom:  User-uploaded SKILL.md (replaces default per user)
       Access:  User can upload/replace own workflow only

D. AUDIT DATA (High Frequency)
   └── (5) JSONL Transcripts — queries, responses, tool calls
```

### 1.3 Storage Decision Matrix

| Data Type                 | Storage                      | Indexed?                          | Update Frequency            |
| ------------------------- | ---------------------------- | --------------------------------- | --------------------------- | ---------------------- |
| (1) OHLCV + Indicators    | PostgreSQL                   | Composite (symbol, timeframe, ts) | Every 5 min                 |
| (2) JSONB Comments        | PostgreSQL JSONB col         | GIN index on comments             | Auto at insert              |
| **(3) Trading Knowledge** | Text, static, developer-only | Vector DB (developer ns)          | Vector embeddings (txtai)   | Rarely (developer)     |
| **(3) Trading Workflow**  | SKILL.md, user-configurable  | Vector DB (user ns)               | Vector embeddings on upload | User uploads + version |
| (4) User Profiles         | PostgreSQL JSONB             | user_id index + GIN on profile    | Per interaction             |
| (5) Audit Logs            | Filesystem JSONL             | None (sequential)                 | Every interaction           |

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

VectorDB contains THREE collections with different ownership and mutability:

```
COLLECTION OWNERSHIP MODEL

Collection               Owner           User-configurable?  Upload allowed?
──────────────────────────────────────────────────────────────────────────────
(1) trading_knowledge    SaaS Developer  NO                  NO
(2) indicator_knowledge  SaaS Developer  NO                  NO
(3) trading_workflow     User            YES                 YES (SKILL.md)
```

**Collection (1): trading_knowledge** — _Developer-managed, read-only_

- Trading concepts, methodology, rules, principles, practices
- Risk management frameworks
- Market structure theory
- Managed exclusively by SaaS developer
- Users cannot view, modify, or replace these documents

**Collection (2): indicator_knowledge** — _Developer-managed, read-only_

- Indicator formulas and definitions (TEMA, HRMA, SMMA, ATR, ADX, RSI, etc.)
- Indicator value interpretation and implication
- Crossover signal meanings (e.g. TEMA crossover HRMA significance)
- Keltner Channel band interpretation
- Managed exclusively by SaaS developer
- Users cannot view, modify, or replace these documents

**Collection (3): trading_workflow** — _User-managed, configurable_ _(New V3.3)_

- Step-by-step trading analysis procedures (SKILL.md files)
- Example default: "Investigate H4 trend → M15 momentum → M5 entry confirmation"
- Each user has their OWN workflow collection namespace
- Users may upload custom SKILL.md files to replace or extend the default
- SaaS provides a default SKILL.md as baseline configuration
- Advanced users may create custom workflows after studying:
  OHLCV data structure, all indicator values, all JSONB comment types
  (SaaS provides educational materials for this purpose)

**Embedding applies to all three collections** — txtai embeds documents at
load/upload time and user queries at search time for cosine similarity matching.
No embedding on PostgreSQL/VANNA path.

**Per-user workflow namespace:**

```
Default workflow (all users):   vectordb://workflow/default/{chunks}
User custom workflow:           vectordb://workflow/{user_id}/{chunks}

Query routing:
  If user has uploaded custom workflow -> search vectordb://workflow/{user_id}/
  If no custom workflow uploaded       -> search vectordb://workflow/default/
  Never mix user workflow with another user workflow
```

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
  llm_role           VARCHAR NOT NULL,  -- "vanna" | "trading"
  model_id           VARCHAR NOT NULL,  -- e.g. "claude-sonnet-4-6", "gemini/gemini-2.0-flash-lite"
  input_tokens       INTEGER,
  output_tokens      INTEGER,
  estimated_cost_usd DECIMAL(10,6),
  created_at         TIMESTAMP DEFAULT NOW()
);
```

### 2.6 Filesystem (Railway Volume / S3)

```
/audit/{user_id}/{date}.jsonl            <- append-only interaction logs

/knowledge/                              <- Developer-managed (read-only)
  trading_concepts/                      <- Collection (1) source docs
  indicator_definitions/                 <- Collection (2) source docs
  trading_workflows/default/             <- Default SKILL.md provided by SaaS

/user_workflows/                         <- User-managed uploads
  {user_id}/                             <- Per-user namespace
    skill_v1.md                          <- User uploaded SKILL.md
    skill_v2.md                          <- User may version their files
    active_skill.md -> skill_v2.md       <- Symlink to active version
```

**Access rules:**

```
/knowledge/          -> SaaS developer write access only
                        Users: NO read, NO write, NO upload

/user_workflows/{user_id}/  -> User write access to own namespace only
                               User cannot access other users namespaces
                               SaaS admin has read access for moderation
```

---

### 2.7 User Workflow Upload System _(Updated V3.3 — Hybrid Tier Model)_

This section defines the full lifecycle of user-uploaded SKILL.md
trading workflow files — from upload through embedding to retrieval.

**Tier model: Hybrid (Option C)**
Custom workflow upload is available on BOTH tiers with different limits.
FREE tier gets a taste of personalization; PRO tier gets full capability.
This design intentionally increases FREE-to-PRO conversion rate.

#### 2.7.1 Tier Limits Comparison

```
Feature                          FREE tier        PRO tier
────────────────────────────────────────────────────────────────
Custom workflow upload           YES              YES
Max file size per upload         50KB             500KB
Max active workflow versions     1 (latest only)  Unlimited
Version history / rollback       NO               YES
Download own uploaded file       YES              YES
Revert to SaaS default           YES              YES
Upload to Collection (1) or (2)  NO               NO
Access other users workflows     NO               NO
```

**Conversion trigger messaging for FREE tier users:**

```
When FREE user tries to upload a file > 50KB:
  "Your file exceeds the 50KB limit on the Free plan.
   Upgrade to Pro to upload workflow files up to 500KB
   and keep unlimited version history.
   -> [Upgrade to Pro]"

When FREE user tries to upload a second version (replacing v1):
  "Free plan supports 1 active workflow at a time.
   Uploading this will replace your current workflow (no rollback).
   Upgrade to Pro to keep full version history and roll back anytime.
   -> [Upgrade to Pro] or [Replace anyway]"
```

#### 2.7.2 Access Control Matrix

```
Action                           Collection (1)  Collection (2)  Collection (3)
                                 trading_know.   indicator_know. trading_workflow
─────────────────────────────────────────────────────────────────────────────────
Developer: upload / modify        YES             YES             YES (default)
FREE user: upload own workflow    NO              NO              YES (1 ver, 50KB)
PRO user:  upload own workflow    NO              NO              YES (unlimited)
Any user:  read/view own upload   NO              NO              YES (own only)
Any user:  modify developer docs  NO              NO              NO
Any user:  access other users     NO              NO              NO
```

#### 2.7.3 Upload Pipeline

```
User uploads SKILL.md via SaaS UI
           |
           v
  VALIDATION GATE
  ├── File type check:    .md only (reject .txt, .pdf, .docx etc.)
  ├── File size check:
  │     FREE tier -> max 50KB  (exceed: show upgrade prompt)
  │     PRO tier  -> max 500KB (exceed: reject with error)
  ├── Content check:    must contain workflow steps (basic structure check)
  └── Version check:
        FREE tier -> has existing v1? show replace warning + upgrade prompt
        PRO tier  -> always allow, auto-increment version number
           |
     PASS  |  FAIL -> return specific error or upgrade prompt to user
           v
  STORE TO FILESYSTEM
  FREE:  /user_workflows/{user_id}/skill_v1.md  (overwrite)
  PRO:   /user_workflows/{user_id}/skill_vN.md  (new version)
  Both:  update active_skill.md symlink to new version
           |
           v
  EMBED WITH TXTAI
  txtai.add(documents=chunked_skill_md, namespace=f"workflow/{user_id}")
  txtai.index()  <- rebuild user namespace index
           |
           v
  UPDATE user_profiles JSONB
  SET has_custom_workflow = true
  SET workflow_version    = "vN"
  SET workflow_uploaded_at = NOW()
  SET workflow_filename   = "skill_vN.md"
           |
           v
  CONFIRM TO USER
  "Your custom trading workflow (vN) is now active.
   Your AI analysis will use your workflow instead of the default."
```

#### 2.7.4 Workflow Version Management

```sql
-- user_profiles JSONB workflow fields:
{
  "has_custom_workflow":  true,
  "workflow_version":     "v3",          -- latest active version
  "workflow_uploaded_at": "2026-03-04T10:00:00Z",
  "workflow_filename":    "skill_v3.md",
  "workflow_history": [   -- PRO only: full version history
    {"version":"v1","uploaded_at":"2026-01-10T08:00:00Z"},
    {"version":"v2","uploaded_at":"2026-02-15T14:30:00Z"},
    {"version":"v3","uploaded_at":"2026-03-04T10:00:00Z"}
  ]
}
```

**FREE tier users may:**

- Upload 1 custom SKILL.md (max 50KB)
- Replace it with a new version (no rollback — old version overwritten)
- Revert to SaaS default at any time
- Download their currently active SKILL.md for editing

**PRO tier users may additionally:**

- Upload files up to 500KB
- Keep unlimited version history
- Roll back to any previous version
- View full upload history with timestamps

**Neither tier may:**

- Upload to Collection (1) or (2)
- Access or download the SaaS default SKILL.md source
- Upload workflows on behalf of other users

#### 2.7.5 Default vs Custom Workflow Routing

```
User state                           Workflow used in VectorDB query
──────────────────────────────────────────────────────────────────────
FREE tier  (no upload yet)           vectordb://workflow/default/
FREE tier  (custom uploaded)         vectordb://workflow/{user_id}/
FREE tier  (reverted to default)     vectordb://workflow/default/
PRO tier   (no upload yet)           vectordb://workflow/default/
PRO tier   (custom uploaded, active) vectordb://workflow/{user_id}/
PRO tier   (rolled back to default)  vectordb://workflow/default/
```

```typescript
// Workflow namespace resolver — same logic for FREE and PRO
function resolveWorkflowNamespace(userId: string): string {
  const hasCustom = await checkUserHasCustomWorkflow(userId);
  return hasCustom
    ? `workflow/${userId}` // user custom SKILL.md (FREE or PRO)
    : `workflow/default`; // SaaS default SKILL.md
}
```

#### 2.7.6 Conversion Funnel Design

The hybrid model creates a deliberate conversion funnel:

```
STAGE 1 — Discovery (FREE tier)
  User discovers custom workflow feature
  Studies educational materials (OHLCV, indicators, JSONB, timeframes)
  Invests time learning the platform deeply
  Uploads first SKILL.md (50KB limit)
  Sees immediate improvement in AI analysis quality
            |
            v  (conversion trigger points below)

STAGE 2 — Friction points that trigger upgrade (FREE -> PRO)
  ├── File exceeds 50KB limit
  │     -> "Upgrade to Pro for 500KB limit"
  ├── Wants to upload refined v2 without losing v1
  │     -> "Upgrade to Pro for version history"
  ├── Wants access to PRO-only symbols/timeframes
  │     -> natural symbol/TF upsell (Section 5.2 Items 4-6)
  └── Wants to iterate workflow rapidly (multiple versions)
        -> "Upgrade to Pro for unlimited versions"

STAGE 3 — PRO tier
  Full capability: 500KB, unlimited versions, rollback
  High retention: user has deep platform investment
  (custom workflow + preferred symbols + timeframes = sticky)
```

#### 2.7.7 Educational Prerequisite

Custom SKILL.md creation requires understanding the full market data
schema available in the SaaS. Before writing a custom workflow, users
are expected to study (via SaaS educational materials):

```
Required knowledge to write effective custom SKILL.md:

1. OHLCV structure
   Open, High, Low, Close, Volume per bar per timeframe

2. All indicator values available
   TEMA, HRMA, SMMA, ATR, ADX, RSI, Keltner Channel bands, etc.
   (see Collection (2) indicator_knowledge for full list)

3. All JSONB comment types
   What narrative comments are auto-generated per indicator
   How to reference them in workflow steps

4. Timeframe analysis hierarchy
   How H12/H4/H1/M15/M5 relate in multi-TF analysis
   (low/mid/high timeframe mappings — see Section 6.4)

SaaS provides dedicated educational content covering all the above.
Users who skip this prerequisite risk writing workflows that reference
unavailable indicators or produce incoherent analysis instructions.
The 50KB FREE tier limit naturally encourages users to start simple
and iterate — which aligns with the learning curve.
```

---

### 2.8 Dual LLM Configuration _(New V3.3)_

The system uses TWO independent LLMs with separate roles, separate context windows,
and separate billing. This architecture provides context window expansion, cost
optimization, and user personalization simultaneously.

#### 2.8.1 Dual LLM Architecture Overview

```
                    USER QUERY
                        |
          +-------------+-------------+
          |                           |
          v                           v
   LLM-1: VANNA LLM            LLM-2: Trading LLM
   (Admin-configured)          (User-selected)
   Low-cost model              High-competency model
   NL -> SQL translation       Trading analysis + response
   ~500-1500 tokens/call       ~5,000-50,000 tokens/call
   SaaS operating cost         User plan usage limit
   Context: system prompt      Context: DataFrame + VectorDB
            + NL query                  + history + profile
          |                           |
          v                           v
    SQL DataFrame              Trading Analysis Response
          |                           |
          +-------------+-------------+
                        |
                        v
                  Response to User
```

**Key benefits:**

```
(1) Context window expansion
    VANNA LLM context: dedicated to NL->SQL system prompt + query
    Trading LLM context: fully available for market data + analysis
    No competition for tokens between translation and analysis tasks

(2) Cost optimization
    VANNA LLM: cheap model for a deterministic structured task
    Trading LLM: premium model only where quality matters
    NL->SQL does not require creative reasoning -> no need for GPT-4o/Sonnet

(3) User personalization
    Users choose their preferred reasoning engine for analysis
    Different users may have provider preferences (Anthropic vs OpenAI vs Google)
    Higher-cost model choice burns plan usage limit faster (natural incentive)
```

#### 2.8.2 VANNA LLM — Admin Configuration (Not User-Configurable)

**Role:** NL->SQL translation only. Deterministic, structured task.
**Configured by:** SaaS Admin only. Users cannot view or change this.
**Model tier:** Low-to-mid competency. High reasoning power is not required.

```
Suggested Admin models for VANNA LLM:

Provider    Model                      VANNA Class              Notes
──────────────────────────────────────────────────────────────────────────
Anthropic   claude-haiku-4-5           AnthropicLlmService      Recommended
OpenAI      gpt-4o-mini                OpenAILlmService         Good alt.
OpenAI      gpt-4.1-nano               OpenAILlmService         Cheapest
Google      gemini-2.0-flash-lite       GeminiLlmService         Cheapest
Mock        MockLlmService             MockLlmService           Dev/test only

Admin selection criteria:
  - Cost per 1M tokens (lowest feasible)
  - SQL generation accuracy on trading schema
  - Latency (target < 25ms for NL->SQL step)
  - Reliability / uptime SLA

Admin may switch VANNA LLM without user notification.
Users are never exposed to VANNA LLM identity.
```

**VANNA supported LLM backends (from VANNA 2.0 codebase):**

```
AnthropicLlmService    -> Anthropic Claude (native tool_use, streaming)
OpenAILlmService       -> OpenAI GPT (function calling, streaming)
AzureOpenAILlmService  -> Azure OpenAI (enterprise deployments)
GeminiLlmService       -> Google Gemini (Google Cloud environments)
OllamaLlmService       -> Ollama (local/offline, self-hosted)
OpenAIResponsesService -> OpenAI Responses API (newer)
MockLlmService         -> Testing and development

All implement LlmService interface:
  async send_request(request: LlmRequest) -> LlmResponse
  async stream_request(request: LlmRequest) -> AsyncGenerator[LlmStreamChunk]
  async validate_tools(tools: List[ToolSchema]) -> List[str]
```

#### 2.8.3 Trading LLM — Tier-Dependent Access

**Role:** Trading analysis, advice, and recommendations. Requires nuanced reasoning.
**FREE tier:** FIXED model — no user choice. Controlled for cost predictability.
**PRO tier:** User-selectable from approved model list.

```
FREE TIER — Fixed Trading LLM (no user choice)
──────────────────────────────────────────────
Model:    gemini-2.5-flash  (gemini/gemini-2.5-flash)
Reason:   Mid-competency, sufficient for structured market analysis
          Very low API cost -> SaaS can absorb as FREE tier cost
          Large context window -> handles full DataFrame well
          Provider diversity (not Anthropic-only dependency)
User action: None. Model is fixed. No settings exposed.

PRO TIER — User-Selectable Trading LLM (introductory phase)
────────────────────────────────────────────────────────────
Provider    Model                LiteLLM string             Cost tier
─────────────────────────────────────────────────────────────────────
Anthropic   Claude Sonnet 4.6    claude-sonnet-4-6          Mid      <- Default
Anthropic   Claude Opus 4        claude-opus-4              High
OpenAI      GPT-4o               gpt-4o                     Mid
OpenAI      GPT-4.1              gpt-4.1                    High
Google      Gemini 2.5 Pro       gemini/gemini-2.5-pro      Mid

Default PRO model (no selection made): claude-sonnet-4-6

Expansion phases (future):
  Phase 2: Add Mistral, Cohere, Groq
  Phase 3: Allow any LiteLLM-compatible endpoint (advanced users)
```

**Rationale for fixed FREE tier model:**

```
1. Cost control: SaaS absorbs FREE tier Trading LLM cost.
   Fixed model = predictable cost per query = viable unit economics.
   Variable model = unpredictable cost = profitability risk.

2. Conversion incentive: Model upgrade is a clear PRO benefit.
   FREE user experiences gemini-2.5-flash quality.
   PRO user gets Claude Sonnet/Opus, GPT-4o, Gemini Pro.
   Quality gap is felt directly in analysis depth.

3. Simplicity: FREE UI has no model settings screen.
   Reduces cognitive load and support burden.
```

**User LLM stored in user_profiles JSONB:**

```json
{
  "preferred_trading_llm": "claude-sonnet-4-6",
  "llm_updated_at": "2026-03-04T10:00:00Z"
}
```

Note: FREE tier users have no preferred_trading_llm field.
System resolves to gemini-2.5-flash regardless of profile.

**LLM resolution logic:**

```typescript
function resolveTradingLLM(user: User): string {
  if (user.tier === 'FREE') {
    return 'gemini/gemini-2.5-flash'; // always fixed, no override
  }
  return user.profile.preferred_trading_llm ?? 'claude-sonnet-4-6';
}
```

#### 2.8.4 Plan Usage Limit — Financial Model

Token budgets are derived from unit economics, not arbitrary numbers.
See Section 2.9 for enforcement implementation.

```
COST PER QUERY ANALYSIS

FREE tier (gemini-2.5-flash, fixed):
  Avg input:   ~10,000 tokens/query (DataFrame + VectorDB + history)
  Avg output:  ~1,000  tokens/query (analysis response)
  Input cost:  $0.15 per 1M tokens  -> $0.0015/query
  Output cost: $0.60 per 1M tokens  -> $0.0006/query
  Total cost:  ~$0.002 per query
  Target:      ~200 queries/month for viable FREE experience
  SaaS cost:   200 x $0.002 = ~$0.40/user/month
  At 1,000 FREE users: ~$400/month  <- acceptable acquisition cost

PRO tier (claude-sonnet-4-6, default):
  Avg input:   ~12,000 tokens/query
  Avg output:  ~2,000  tokens/query
  Input cost:  $3.00 per 1M tokens  -> $0.036/query
  Output cost: $15.00 per 1M tokens -> $0.030/query
  Total cost:  ~$0.066 per query
  Revenue:     $29/month
  LLM budget:  max $10/user/month (34% of revenue)
  Safe queries: $10 / $0.066 = ~150 queries/month on Sonnet
  Hard cap:    200 queries/month (with daily sub-cap for burst)

PRO tier (claude-opus-4, heavy user):
  Total cost:  ~$0.90 per query
  At 200 queries: $180/month -> EXCEEDS $29 revenue by 6x
  Mitigation:  Opus users get 30 queries/month hard cap
               OR implement credit top-up for heavy Opus usage
```

```
PLAN LIMITS SUMMARY

Dimension              FREE tier              PRO tier
────────────────────────────────────────────────────────────────
Trading LLM            gemini-2.5-flash       User-selected
                       (FIXED, no choice)     (Sonnet default)
Monthly query cap      200 queries/month      200 queries/month*
Daily query cap        20 queries/day         40 queries/day
Per-minute rate limit  3 queries/minute       10 queries/minute
Concurrent sessions    1                      3
Monthly token budget   N/A (fixed model)      1,500,000 tokens
Max cost to SaaS       ~$0.40/user/month      ~$10/user/month
VANNA LLM queries      NOT counted (SaaS cost on all tiers)

* PRO monthly query cap adjusts per model:
  claude-sonnet-4-6  -> 200 queries/month
  gpt-4o             -> 200 queries/month
  gemini-2.5-pro     -> 250 queries/month
  gpt-4.1            -> 120 queries/month
  claude-opus-4      -> 30  queries/month (or credit top-up)
```

**Model cost multipliers (relative to gemini-2.5-flash baseline):**

```
Model                  Input $/1M   Output $/1M   Multiplier vs Flash
───────────────────────────────────────────────────────────────────
gemini-2.5-flash       $0.15        $0.60         1x  (FREE default)
claude-haiku-4-5       $0.80        $4.00         ~5x
gpt-4o-mini            $0.15        $0.60         ~1x
claude-sonnet-4-6      $3.00        $15.00        ~33x (PRO default)
gpt-4o                 $2.50        $10.00        ~25x
gemini-2.5-pro         $1.25        $5.00         ~10x
gpt-4.1                $2.00        $8.00         ~20x
claude-opus-4          $15.00       $75.00        ~160x
```

**token_usage_log tracks both LLMs separately:**

```sql
-- llm_role = "vanna"   -> Admin cost tracking only, not user budget
-- llm_role = "trading" -> Counted against user monthly query cap

-- Check user monthly usage:
SELECT model_id,
       COUNT(*)                          AS queries_this_month,
       SUM(input_tokens)                 AS input_tokens,
       SUM(output_tokens)                AS output_tokens,
       SUM(estimated_cost_usd)           AS total_cost_usd
FROM token_usage_log
WHERE user_id  = $1
  AND llm_role = 'trading'
  AND date >= DATE_TRUNC('month', NOW())
GROUP BY model_id;
```

#### 2.8.5 LLM Selection UI Flow

```
FREE TIER Settings -> AI Model:
  Shows: "Your plan uses Gemini 2.5 Flash for trading analysis."
         "Upgrade to Pro to choose from Claude, GPT-4o, and Gemini Pro."
         -> [Upgrade to Pro]
  No model selector shown. No configuration exposed.

PRO TIER Settings -> AI Model:
  Shows model cards for each available model:
  ┌─────────────────────────────────────────────┐
  │ [Anthropic logo] Claude Sonnet 4.6  [Active]│
  │ Quality: ████████░░  Speed: ███████░░░       │
  │ Budget usage: ~5x faster than Flash          │
  │ ~200 queries/month on your Pro plan          │
  └─────────────────────────────────────────────┘
  ┌─────────────────────────────────────────────┐
  │ [Anthropic logo] Claude Opus 4              │
  │ Quality: ██████████  Speed: █████░░░░░       │
  │ Budget usage: ~30x faster than Flash         │
  │ ~30 queries/month on your Pro plan           │
  └─────────────────────────────────────────────┘

User selects new model -> confirmation dialog:
  "Switching to Claude Opus 4 will use your monthly budget
   approximately 30x faster than the default.
   Estimated: ~30 queries remaining this month.
   -> [Confirm switch] [Keep current model]"

On confirm:
  UPDATE user_profiles
  SET profile = jsonb_set(profile,'{preferred_trading_llm}','"claude-opus-4"')
  Takes effect on next query immediately.
```

---

### 2.9 Plan Rate Limits Architecture _(New V3.3)_

Rate limiting is a three-layer system protecting SaaS profitability and
infrastructure from abuse. Each layer addresses a different threat vector.

#### 2.9.1 Three-Layer Enforcement Model

```
LAYER 1: Per-Minute Rate Limit  (Redis TTL counter)
  Purpose:   Prevent burst abuse, protect inference latency
  Granularity: Per-user, rolling 60-second window
  FREE tier: 3 queries/minute
  PRO tier:  10 queries/minute
  Storage:   Redis key: ratelimit:minute:{user_id}
  TTL:       60 seconds (auto-expire)
  Violation: HTTP 429, retry-after header

LAYER 2: Daily Query Hard Cap  (Redis TTL counter)
  Purpose:   Prevent daily spam, protect daily operating cost
  Granularity: Per-user, calendar day (UTC reset at 00:00)
  FREE tier: 20 queries/day
  PRO tier:  40 queries/day
  Storage:   Redis key: ratelimit:daily:{user_id}:{YYYY-MM-DD}
  TTL:       86400 seconds (auto-expire at midnight UTC)
  Violation: Block with day-reset timestamp shown to user

LAYER 3: Monthly Query Cap  (PostgreSQL token_usage_log)
  Purpose:   Protect monthly profitability per user
  Granularity: Per-user, per-model, calendar month
  FREE tier: N/A (fixed model, daily cap sufficient)
  PRO tier:  Per-model query cap (see Section 2.8.4)
  Storage:   PostgreSQL token_usage_log COUNT(*) per month
  Check:     Pre-query lookup (cached in Redis 5-min TTL)
  Violation: Block with upgrade prompt or model-switch suggestion
```

```
LAYER PRIORITY (checked in order, fail-fast):

  User sends query
       |
       v
  [L1] Per-minute check  -> FAIL -> HTTP 429 "Too many requests.
       |                             Please wait N seconds."
       v PASS
  [L2] Daily cap check   -> FAIL -> "Daily limit reached.
       |                             Resets at 00:00 UTC.
       |                             -> [Upgrade to Pro]"
       v PASS
  [L3] Monthly cap check -> FAIL -> "Monthly limit reached.
       |                             -> [Upgrade] [Switch model]"
       v PASS
  [TIER] Access check    -> FAIL -> Tier upsell (Section 5.2)
       |
       v PASS ALL
  Execute query (VANNA + Trading LLM)
  Increment all counters (L1, L2, L3)
```

#### 2.9.2 Redis Key Schema

```
Key pattern                              TTL        Value
──────────────────────────────────────────────────────────────────────
ratelimit:minute:{user_id}               60s        INTEGER (query count)
ratelimit:daily:{user_id}:{YYYY-MM-DD}   86400s     INTEGER (query count)
ratelimit:monthly_cache:{user_id}        300s       INTEGER (month query count)
ratelimit:concurrent:{user_id}           30s        INTEGER (active sessions)

Notes:
  monthly_cache: 5-min cached copy of PostgreSQL monthly count
    Prevents PostgreSQL hit on every single query
    Invalidated immediately when monthly limit is reached
  concurrent: tracks in-flight queries (prevent duplicate submissions)
    FREE tier: max 1 concurrent  PRO tier: max 3 concurrent
```

#### 2.9.3 Enforcement Middleware (NestJS)

```typescript
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private redis: RedisService,
    private db: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const limits = PLAN_LIMITS[user.tier]; // see Section 2.9.4

    // LAYER 1: Per-minute rate limit
    const minuteKey = `ratelimit:minute:${user.id}`;
    const minuteCount = await this.redis.incr(minuteKey);
    if (minuteCount === 1) await this.redis.expire(minuteKey, 60);
    if (minuteCount > limits.perMinute) {
      throw new TooManyRequestsException(
        `Rate limit: ${limits.perMinute} queries/minute on ${user.tier} plan.`
      );
    }

    // LAYER 2: Daily hard cap
    const today = new Date().toISOString().slice(0, 10);
    const dailyKey = `ratelimit:daily:${user.id}:${today}`;
    const dailyCount = await this.redis.incr(dailyKey);
    if (dailyCount === 1) await this.redis.expire(dailyKey, 86400);
    if (dailyCount > limits.perDay) {
      throw new ForbiddenException(
        `Daily limit of ${limits.perDay} queries reached. Resets at 00:00 UTC.`
      );
    }

    // LAYER 3: Monthly cap (PRO only — FREE uses daily cap)
    if (user.tier === 'PRO') {
      const monthlyCount = await this.getMonthlyCount(user.id);
      const monthlyLimit =
        limits.perMonthByModel[user.tradingLLM] ?? limits.perMonthDefault;
      if (monthlyCount >= monthlyLimit) {
        throw new ForbiddenException(
          `Monthly limit of ${monthlyLimit} queries reached for ${user.tradingLLM}.`
        );
      }
    }

    // LAYER 4: Concurrent session limit
    const concurrentKey = `ratelimit:concurrent:${user.id}`;
    const concurrent = await this.redis.incr(concurrentKey);
    if (concurrent === 1) await this.redis.expire(concurrentKey, 30);
    if (concurrent > limits.concurrent) {
      await this.redis.decr(concurrentKey);
      throw new TooManyRequestsException('Query already in progress.');
    }

    // All checks passed — attach cleanup to response
    req.on('finish', async () => {
      await this.redis.decr(concurrentKey);
    });

    return true;
  }

  private async getMonthlyCount(userId: string): Promise<number> {
    const cacheKey = `ratelimit:monthly_cache:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return parseInt(cached);

    // Cache miss: query PostgreSQL
    const result = await this.db.token_usage_log.count({
      where: {
        user_id: userId,
        llm_role: 'trading',
        date: { gte: startOfMonth() },
      },
    });
    await this.redis.setex(cacheKey, 300, result.toString());
    return result;
  }
}
```

#### 2.9.4 Plan Limits Configuration Object

```typescript
const PLAN_LIMITS = {
  FREE: {
    perMinute: 3,
    perDay: 20,
    perMonthDefault: null, // N/A — daily cap sufficient
    perMonthByModel: {}, // N/A — model is fixed
    concurrent: 1,
    tradingLLM: 'gemini/gemini-2.5-flash', // fixed, no override
    maxCostPerMonth: 0.4, // USD, SaaS absorbs
  },
  PRO: {
    perMinute: 10,
    perDay: 40,
    perMonthDefault: 200, // fallback if model not in map
    perMonthByModel: {
      'claude-sonnet-4-6': 200,
      'gpt-4o': 200,
      'gemini/gemini-2.5-pro': 250,
      'gpt-4.1': 120,
      'claude-opus-4': 30,
    },
    concurrent: 3,
    maxCostPerMonth: 10.0, // USD target ceiling per user
  },
};
```

#### 2.9.5 User-Facing Limit Messages

```
LAYER 1 — Per-minute exceeded:
  "Slow down — you can send up to [N] queries per minute.
   Please wait [N] seconds before your next query."
  (No upgrade prompt — this is a UX friction message, not a sales moment)

LAYER 2 — Daily cap exceeded:
  FREE: "You have reached your daily limit of 20 queries.
         Your limit resets at 00:00 UTC ([time remaining]).
         Upgrade to Pro for 40 queries/day and access to
         premium symbols, timeframes, and AI models.
         -> [Upgrade to Pro]"
  PRO:  "You have reached your daily limit of 40 queries.
         Your limit resets at 00:00 UTC ([time remaining])."

LAYER 3 — Monthly cap exceeded (PRO only):
  Default model: "You have reached your monthly limit of [N] queries
                  on Claude Sonnet 4.6. Resets on [date].
                  Switch to Gemini 2.5 Pro for [N] more queries this month.
                  -> [Switch model] [View usage]"
  Opus model:    "You have reached your monthly limit of 30 queries
                  on Claude Opus 4. Resets on [date].
                  Switch to Claude Sonnet 4.6 for up to 200 queries/month.
                  -> [Switch model] [View usage]"

WARNING THRESHOLDS (shown proactively in UI banner):
  Daily  >= 80% (16/20 FREE, 32/40 PRO):
    "You have used [N] of your [max] daily queries."
  Monthly >= 80% (PRO only):
    "You have used 80% of your monthly [model] quota."
  Monthly >= 95% (PRO only):
    "5% of monthly quota remaining. Consider switching to a lighter model
     to extend your usage. -> [Switch model] [Upgrade plan]"
```

#### 2.9.6 Total LLM Cost Surveillance System

All LLM API cost monitoring covers BOTH VANNA and Trading LLM combined.
token_usage_log.llm_role separates them for attribution but total cost
surveillance always aggregates both roles for true platform P&L.

**Surveillance architecture:**

```
token_usage_log  (PostgreSQL)
      |
      +---> llm_role = "vanna"    (SaaS operating cost)
      +---> llm_role = "trading"  (user plan cost)
      |
      v
  5 surveillance views (materialized, refresh every 5 min)
      |
      +---> View 1: Real-time platform P&L snapshot
      +---> View 2: Per-user total cost (VANNA + Trading combined)
      +---> View 3: Month-to-date cost projection
      +---> View 4: Cost velocity (daily trend, acceleration)
      +---> View 5: VANNA cost per query over time
      |
      v
  Alert engine  (checks thresholds every 5 min)
      |
      +---> Soft alert  -> Admin dashboard banner
      +---> Hard alert  -> Email + Slack notification
      +---> Auto-action -> Automated throttle (critical only)
```

##### SQL View 1: Real-Time Platform P&L Snapshot

```sql
-- Platform-wide LLM cost vs revenue this month
-- Covers BOTH vanna + trading roles
SELECT
  -- Revenue side
  COUNT(DISTINCT CASE WHEN u.tier = 'PRO' THEN u.user_id END)
                                        AS pro_users,
  COUNT(DISTINCT CASE WHEN u.tier = 'PRO' THEN u.user_id END) * 29.00
                                        AS monthly_revenue_usd,

  -- Total LLM cost (VANNA + Trading combined)
  ROUND(SUM(t.estimated_cost_usd), 4)   AS total_llm_cost_usd,

  -- Split by role
  ROUND(SUM(CASE WHEN t.llm_role = 'vanna'
    THEN t.estimated_cost_usd ELSE 0 END), 4)
                                        AS vanna_cost_usd,
  ROUND(SUM(CASE WHEN t.llm_role = 'trading'
    THEN t.estimated_cost_usd ELSE 0 END), 4)
                                        AS trading_cost_usd,

  -- Margin calculation
  ROUND(
    COUNT(DISTINCT CASE WHEN u.tier = 'PRO' THEN u.user_id END) * 29.00
    - SUM(t.estimated_cost_usd),
  4)                                    AS llm_margin_usd,

  -- LLM cost as % of revenue
  ROUND(
    SUM(t.estimated_cost_usd) /
    NULLIF(COUNT(DISTINCT CASE WHEN u.tier='PRO' THEN u.user_id END)*29.00, 0)
    * 100, 2
  )                                     AS llm_cost_pct_of_revenue,

  -- Query counts
  COUNT(CASE WHEN t.llm_role = 'vanna'   THEN 1 END) AS vanna_queries,
  COUNT(CASE WHEN t.llm_role = 'trading' THEN 1 END) AS trading_queries

FROM token_usage_log t
JOIN user_profiles u ON t.user_id = u.user_id
WHERE t.date >= DATE_TRUNC('month', NOW());
```

##### SQL View 2: Per-User Total LLM Cost (VANNA + Trading Combined)

```sql
-- Full per-user cost picture — both roles, current month
SELECT
  u.user_id,
  u.tier,
  u.email,

  -- Total queries (both LLMs)
  COUNT(*)                              AS total_queries,
  COUNT(CASE WHEN t.llm_role='vanna'   THEN 1 END) AS vanna_queries,
  COUNT(CASE WHEN t.llm_role='trading' THEN 1 END) AS trading_queries,

  -- Total cost (VANNA + Trading combined)
  ROUND(SUM(t.estimated_cost_usd), 4)  AS total_cost_usd,
  ROUND(SUM(CASE WHEN t.llm_role='vanna'
    THEN t.estimated_cost_usd ELSE 0 END), 4) AS vanna_cost_usd,
  ROUND(SUM(CASE WHEN t.llm_role='trading'
    THEN t.estimated_cost_usd ELSE 0 END), 4) AS trading_cost_usd,

  -- Active Trading LLM model
  (u.profile->>'preferred_trading_llm')
                                        AS trading_model,

  -- Revenue contribution
  CASE WHEN u.tier='PRO' THEN 29.00 ELSE 0 END
                                        AS monthly_revenue_usd,
  CASE WHEN u.tier='PRO'
    THEN ROUND(29.00 - SUM(t.estimated_cost_usd), 4)
    ELSE ROUND(-SUM(t.estimated_cost_usd), 4)
  END                                   AS net_margin_usd

FROM token_usage_log t
JOIN user_profiles u ON t.user_id = u.user_id
WHERE t.date >= DATE_TRUNC('month', NOW())
GROUP BY u.user_id, u.tier, u.email, u.profile
ORDER BY total_cost_usd DESC;
```

##### SQL View 3: Month-to-Date Cost Projection

```sql
-- Project full-month cost from current MTD burn rate
-- Critical: alerts before month-end if on a bad trajectory
WITH daily_costs AS (
  SELECT
    t.date,
    SUM(t.estimated_cost_usd)           AS daily_total_cost,
    SUM(CASE WHEN t.llm_role='vanna'
      THEN t.estimated_cost_usd ELSE 0 END) AS daily_vanna_cost,
    SUM(CASE WHEN t.llm_role='trading'
      THEN t.estimated_cost_usd ELSE 0 END) AS daily_trading_cost,
    COUNT(DISTINCT t.user_id)           AS active_users
  FROM token_usage_log t
  WHERE t.date >= DATE_TRUNC('month', NOW())
  GROUP BY t.date
)
SELECT
  SUM(daily_total_cost)                 AS mtd_total_cost_usd,
  SUM(daily_vanna_cost)                 AS mtd_vanna_cost_usd,
  SUM(daily_trading_cost)               AS mtd_trading_cost_usd,
  ROUND(AVG(daily_total_cost), 4)       AS avg_daily_cost_usd,
  ROUND(
    AVG(daily_total_cost)
    * EXTRACT(DAY FROM
        DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
        - DATE_TRUNC('month', NOW())
      ),
  4)                                    AS projected_month_cost_usd,
  EXTRACT(DAY FROM NOW()
    - DATE_TRUNC('month', NOW()))       AS days_elapsed,
  EXTRACT(DAY FROM
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    - DATE_TRUNC('month', NOW()))       AS days_in_month
FROM daily_costs;
```

##### SQL View 4: Cost Velocity (Daily Trend + Acceleration)

```sql
-- Detect cost acceleration: is spend growing faster than user growth?
SELECT
  t.date,
  COUNT(DISTINCT t.user_id)             AS active_users,
  COUNT(*)                              AS total_queries,
  ROUND(SUM(t.estimated_cost_usd), 4)   AS total_cost_usd,
  ROUND(SUM(CASE WHEN t.llm_role='vanna'
    THEN t.estimated_cost_usd ELSE 0 END), 4) AS vanna_cost_usd,
  ROUND(SUM(CASE WHEN t.llm_role='trading'
    THEN t.estimated_cost_usd ELSE 0 END), 4) AS trading_cost_usd,

  -- Cost per active user per day
  ROUND(SUM(t.estimated_cost_usd)
    / NULLIF(COUNT(DISTINCT t.user_id), 0), 4)
                                        AS cost_per_active_user,

  -- 7-day rolling average cost
  ROUND(AVG(SUM(t.estimated_cost_usd)) OVER (
    ORDER BY t.date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ), 4)                                 AS rolling_7d_avg_cost,

  -- Day-over-day cost change %
  ROUND((
    SUM(t.estimated_cost_usd)
    - LAG(SUM(t.estimated_cost_usd)) OVER (ORDER BY t.date)
  ) / NULLIF(
    LAG(SUM(t.estimated_cost_usd)) OVER (ORDER BY t.date), 0
  ) * 100, 2)                           AS dod_cost_change_pct

FROM token_usage_log t
WHERE t.date >= NOW() - INTERVAL '30 days'
GROUP BY t.date
ORDER BY t.date DESC;
```

##### SQL View 5: VANNA Cost Per Query Over Time

```sql
-- Monitor VANNA LLM efficiency — detect model degradation or prompt bloat
SELECT
  t.date,
  t.model_id                            AS vanna_model,
  COUNT(*)                              AS vanna_queries,
  ROUND(AVG(t.input_tokens), 0)         AS avg_input_tokens,
  ROUND(AVG(t.output_tokens), 0)        AS avg_output_tokens,
  ROUND(AVG(t.estimated_cost_usd), 6)   AS avg_cost_per_query,
  ROUND(SUM(t.estimated_cost_usd), 4)   AS daily_vanna_cost,

  -- 7-day rolling avg cost per query (detect creep)
  ROUND(AVG(AVG(t.estimated_cost_usd)) OVER (
    PARTITION BY t.model_id
    ORDER BY t.date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ), 6)                                 AS rolling_7d_avg_per_query

FROM token_usage_log t
WHERE t.llm_role = 'vanna'
  AND t.date >= NOW() - INTERVAL '30 days'
GROUP BY t.date, t.model_id
ORDER BY t.date DESC;
```

##### Alert Thresholds and Response Actions

```
TOTAL LLM COST ALERTS (VANNA + Trading combined)

Alert                              Severity   Delivery         Auto-action
───────────────────────────────────────────────────────────────────────────────
Per-user alerts:
  FREE user total LLM > $0.50/day  SOFT       Dashboard        None
  FREE user total LLM > $1.00/day  HARD       Email + Slack    Flag for review
  PRO user total LLM  > $5.00/day  SOFT       Dashboard        None
  PRO user total LLM  > $10.00/day HARD       Email + Slack    Throttle to 5/min
  Any user LLM > revenue/user       CRITICAL  Email + Slack    Block + review

Platform-wide alerts:
  LLM cost % of revenue > 25%      SOFT       Dashboard        None
  LLM cost % of revenue > 35%      HARD       Email + Slack    Admin review
  LLM cost % of revenue > 50%      CRITICAL   Email + Slack    Freeze PRO Opus access
  Projected month cost > 2x MTD     HARD       Email + Slack    Admin review
  Daily cost DoD growth > +50%      HARD       Email + Slack    Investigate spike

VANNA-specific alerts:
  VANNA total > $50/month           SOFT       Dashboard        None
  VANNA total > $100/month          HARD       Email + Slack    Consider model downgrade
  VANNA avg cost/query up > +30%    HARD       Email + Slack    Check prompt bloat
  VANNA queries/day > 10,000        SOFT       Dashboard        None (scale check)

Rate limit abuse alerts:
  Redis violations > 100/hour       SOFT       Dashboard        None
  Redis violations > 500/hour       HARD       Email + Slack    Investigate IPs
  Single user > 3x daily cap        CRITICAL   Email + Slack    Temp block + review
```

##### Alert Delivery Implementation

```typescript
// Alert engine runs every 5 minutes via BullMQ scheduled job
// Same BullMQ infrastructure already in MT5 pipeline

@Processor('cost-surveillance')
export class CostSurveillanceWorker {
  @Process({ name: 'check-alerts', every: 300000 }) // 5 min
  async runAlertChecks() {
    const snapshot = await this.db.query(PLATFORM_PNL_QUERY);
    const perUser = await this.db.query(PER_USER_COST_QUERY);
    const projected = await this.db.query(MTD_PROJECTION_QUERY);
    const velocity = await this.db.query(COST_VELOCITY_QUERY);
    const vanna = await this.db.query(VANNA_COST_QUERY);

    const alerts = [
      ...this.checkPlatformAlerts(snapshot, projected, velocity),
      ...this.checkPerUserAlerts(perUser),
      ...this.checkVannaAlerts(vanna),
    ];

    for (const alert of alerts) {
      await this.storeAlert(alert); // always: admin dashboard
      if (alert.severity === 'HARD') await this.sendNotification(alert); // email + Slack
      if (alert.severity === 'CRITICAL') await this.executeAutoAction(alert); // throttle / block
    }
  }

  private async executeAutoAction(alert: Alert) {
    switch (alert.action) {
      case 'throttle_user':
        // Override Redis rate limit to 1/min for this user
        await this.redis.set(
          `override:throttle:${alert.userId}`,
          '1',
          'EX',
          3600
        );
        break;
      case 'freeze_opus':
        // Temporarily block all claude-opus-4 calls platform-wide
        await this.redis.set(
          'override:freeze_model:claude-opus-4',
          '1',
          'EX',
          86400
        );
        break;
      case 'block_user':
        // Block user from all LLM calls pending admin review
        await this.redis.set(
          `override:block:${alert.userId}`,
          '1',
          'EX',
          86400
        );
        break;
    }
  }
}
```

##### Admin Cost Dashboard — Key Metrics

```
REAL-TIME PANEL (refresh every 5 min):
  Today total LLM cost:        $X.XX  (VANNA: $X.XX | Trading: $X.XX)
  Today queries:               N      (VANNA: N | Trading: N)
  Active users today:          N
  Avg cost per active user:    $X.XX
  Rate limit violations:       N (last hour)

MONTHLY P&L PANEL:
  MTD revenue (PRO subs):      $X,XXX
  MTD total LLM cost:          $X,XXX  (VANNA: $XXX | Trading: $X,XXX)
  MTD LLM margin:              $X,XXX  (XX% of revenue)
  Projected month-end cost:    $X,XXX  [GREEN/AMBER/RED]
  Avg LLM cost per PRO user:   $X.XX   (target < $10.00)
  Avg LLM cost per FREE user:  $X.XX   (target < $0.40)

VANNA EFFICIENCY PANEL:
  MTD VANNA cost:              $XXX
  VANNA avg cost/query:        $0.00XXX
  VANNA avg input tokens:      X,XXX
  7d rolling avg cost/query:   $0.00XXX  [trend arrow]

TOP COST USERS (today):
  [user_id] [tier] [model] [queries] [total_cost] [margin]
  sorted by total_cost DESC, shows top 10
  RED highlight if cost > revenue contribution

ACTIVE ALERTS PANEL:
  [severity] [timestamp] [description] [action taken]
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

| Engine          | Tool               | LLM Role                             | Embedding? | Latency    | Returns               | Mode     |
| --------------- | ------------------ | ------------------------------------ | ---------- | ---------- | --------------------- | -------- |
| SQL Engine      | VANNA + PostgreSQL | NL->SQL translation (Admin LLM)      | **No**     | 10-25ms    | DataFrame (num+JSONB) | Parallel |
| Semantic Engine | txtai + VectorDB   | Trading analysis response (User LLM) | **Yes**    | 80-150ms   | Knowledge chunks      | Parallel |
| User Profile    | PostgreSQL direct  | —                                    | **No**     | 5ms        | JSONB profile         | Parallel |
| **Total**       | Promise.all        | Two separate LLMs                    | —          | **~150ms** | All inputs assembled  | —        |

**Two-LLM architecture:** VANNA uses an Admin-configured low-cost LLM for NL->SQL translation.
The Trading RAG (txtai) uses a User-selected high-competency LLM for analysis and response.
These are independent API calls with separate context windows and separate billing.
See Section 2.8 for full Dual LLM Configuration specification.

### 4.2 SQL Engine (VANNA Framework)

VANNA is a specialized NL2SQL RAG framework translating natural language to SQL without embedding.

**VANNA LLM:** Admin-configured only. Users cannot change this.
Low-to-mid competency model sufficient for NL->SQL translation.
See Section 2.8.2 for Admin LLM selection and suggested models.

VANNA handles:

- Synonym resolution: "gold" -> XAUUSD, "low timeframe" -> M5+M15, "high timeframe" -> H1+H4
- Time reference resolution: "recently/now" -> LIMIT 12, "recent hours" -> 12 H1 bars, "last week" -> 12 H12 bars, "last few days" -> 12 H4 bars
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

**Collections queried per request:**

```
(1) trading_knowledge    <- always queried (developer-managed)
(2) indicator_knowledge  <- always queried (developer-managed)
(3) trading_workflow     <- user namespace if custom uploaded,
                            else default namespace
```

**Workflow collection routing:**

```typescript
function resolveWorkflowNamespace(userId: string): string {
  const hasCustom = await checkUserHasCustomWorkflow(userId);
  return hasCustom
    ? `workflow/${userId}` // user custom SKILL.md
    : `workflow/default`; // SaaS default SKILL.md
}
```

**Query flow:**

```
User NL query
     |
     v  txtai embeds query -> query vector
     |
     v  cosine similarity search against:
        (1) trading_knowledge    (developer)
        (2) indicator_knowledge  (developer)
        (3) trading_workflow     (user custom OR default)
     |
     v  Top N chunks per collection (ranked by relevance)
     |
     v  Passed to Claude API alongside SQL DataFrame
```

**Trading LLM:** User-selectable (introductory phase: Anthropic, OpenAI, Google only).
High-competency model required for nuanced trading analysis and recommendations.
User LLM selection stored in user_profiles JSONB. Usage tracked per-model.
See Section 2.8.3 for user LLM selection and plan usage limits.

Embedding happens ONLY here. SQL path via VANNA requires NO embedding.

### 4.4 Context Delivered to Trading LLM _(Updated V3.3)_

VANNA DataFrame and user NL query feed the Trading LLM directly — no separate Context Assembly step.

```
System Prompt:
└── Trading analyst role, working memory config, symbol/TF/time mappings,
    selected Trading LLM model identity (e.g. claude-sonnet-4-6)

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

**Tier Definitions:**

- FREE tier symbols: XAUUSD, BTCUSD, EURUSD, USDJPY, US30 (5 symbols)
- PRO tier symbols: all FREE + XAGUSD, ETHUSD, NDX100, GBPUSD, AUDUSD, NZDUSD, USDCAD, USDCHF, GBPJPY, AUDJPY (15 total)
- FREE tier timeframes: H1, H4, D1 (3 timeframes)
- PRO tier timeframes: M5, M15, M30, H1, H2, H4, H8, H12, D1 (9 timeframes)

```
FALLBACK PRIORITY CHAIN

1. PRIMARY FLOW
   VANNA resolves symbol + TF -> check tier access -> SQL + VectorDB parallel
   -> Happy path, full response

2. MISSING TIMEFRAME
   Symbol resolved, TF missing -> Clarification loop (ask TF only)

3. NO SYMBOL SPECIFIED
   No symbol in query -> Major markets overview (XAUUSD, EURUSD, US30, BTCUSD)
   OR clarification if query requires specific symbol

4. TIER ACCESS VIOLATION: PRO SYMBOL requested by FREE user
   Detected: resolved symbol is in PRO-only list AND user.tier == FREE
   PRO-only symbols: XAGUSD, ETHUSD, NDX100, GBPUSD, AUDUSD,
                     NZDUSD, USDCAD, USDCHF, GBPJPY, AUDJPY

   Response to user:
   "[Symbol] is available on the Pro plan.
    Your current Free plan supports: XAUUSD, BTCUSD, EURUSD, USDJPY, US30.
    Upgrade to Pro for access to all 15 symbols including [Symbol].
    -> [Upgrade to Pro link]"

5. TIER ACCESS VIOLATION: PRO TIMEFRAME requested by FREE user
   Detected: resolved TF is M5/M15/M30/H2/H8/H12 AND user.tier == FREE
   PRO-only timeframes: M5, M15, M30, H2, H8, H12

   Response to user:
   "[Timeframe] is available on the Pro plan.
    Your current Free plan supports: H1, H4, D1.
    Upgrade to Pro for access to all 9 timeframes including [Timeframe].
    -> [Upgrade to Pro link]"

6. TIER ACCESS VIOLATION: BOTH symbol AND timeframe are PRO-only (FREE user)
   Detected: symbol is PRO-only AND TF is PRO-only AND user.tier == FREE

   Response to user:
   "Both [Symbol] and [Timeframe] are available on the Pro plan.
    Your Free plan supports XAUUSD, BTCUSD, EURUSD, USDJPY, US30
    on H1, H4, and D1 timeframes only.
    Upgrade to Pro for full access to 15 symbols and 9 timeframes.
    -> [Upgrade to Pro link]"

7. TRULY UNKNOWN SYMBOL (not in 15-symbol list after all nickname resolution)
   Step 1: Exhausted all symbol mappings + nicknames -> still unresolved
   Step 2a: Possible misspelling detected (close match found)
     -> "Did you mean [nearest symbol]? e.g. XAUUSD (gold)"
   Step 2b: Genuinely out-of-scope instrument (stocks, futures, etc.)
     -> "Sorry, [X] is not currently supported.
        Supported symbols: XAUUSD, XAGUSD, BTCUSD, ETHUSD, EURUSD,
        GBPUSD, AUDUSD, NZDUSD, USDCAD, USDCHF, USDJPY,
        GBPJPY, AUDJPY, US30, NDX100
        (Pro plan required for symbols beyond the Free tier 5)"

8. UNSUPPORTED TIMEFRAME (not in system regardless of tier: M1, W1, MN etc.)
   Nearest-match suggestions:
     M1 / M2 / M3  -> suggest M5
     M10           -> suggest M15
     M20 / M45     -> suggest M30
     H3            -> suggest H2 or H4
     H6            -> suggest H4 or H8
     H10           -> suggest H8 or H12
     W1 / MN       -> suggest D1 or H12

   Response: "[TF] is not a supported timeframe.
             Nearest available timeframe is [nearest TF].
             Shall I proceed with [nearest TF]?"

   Note: if nearest TF is PRO-only and user is FREE tier
   -> combine with Item 5 response (tier upsell)

9. STALE DATA
   Data gap detected -> use last available rows + JSONB comments + disclaimer
   JSONB comments on stale rows still accurately describe
   conditions at the time of last update

10. PURE CONCEPTUAL QUERY
    "What is RSI?" / "Explain Keltner Channel" -> VectorDB only, no SQL

11. CLARIFICATION EXHAUSTED (2 rounds)
    Apply intelligent defaults + inform user:
      symbol    -> XAUUSD (available on FREE and PRO)
      timeframe -> H1 (available on FREE and PRO)
      time_ref  -> last 12 bars
    -> "Proceeding with XAUUSD H1 last 12 bars.
        Let me know if you meant a different instrument or timeframe."
```

**Tier upsell trigger summary:**

| Scenario                           | User tier | Response                              |
| ---------------------------------- | --------- | ------------------------------------- |
| PRO-only symbol requested          | FREE      | Symbol upsell + Free symbol list      |
| PRO-only timeframe requested       | FREE      | Timeframe upsell + Free TF list       |
| PRO symbol + PRO TF both requested | FREE      | Combined upsell message               |
| Any symbol or TF                   | PRO       | No restriction, proceed normally      |
| Truly unknown symbol               | Any       | Not supported + full symbol list      |
| Unsupported TF (M1, W1, MN)        | Any       | Nearest match suggestion + tier check |

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

  -- Symbol mappings (informal names, nicknames, dialects):

  gold / xau / yellow metal / bullion / aurum / spot gold / the yellow    -> XAUUSD
  silver / xag / white metal / poor mans gold / grey metal / spot silver  -> XAGUSD
  bitcoin / btc / crypto king / digital gold / orange coin / magic coin   -> BTCUSD
  ethereum / eth / ether / vitalik / eth usd / crypto eth                 -> ETHUSD
  euro / eur / fiber / eurodollar / the euro / eur usd                    -> EURUSD
  cable / pound / sterling / quid / gbp / pound dollar / the pound        -> GBPUSD
  aussie / aud / aud usd / australian dollar / the aussie                 -> AUDUSD
  kiwi / nzd / nzd usd / new zealand dollar / the kiwi                   -> NZDUSD
  loonie / cad / usd cad / canadian dollar / oil currency / the loonie    -> USDCAD
  swissie / chf / usd chf / swiss franc / franc / the swissie / safe haven-> USDCHF
  yen / jpy / dollar yen / usd jpy / ninja / tokyo / the yen              -> USDJPY
  pound yen / gbp jpy / guppy / geppy / the beast / the dragon            -> GBPJPY
  aussie yen / aud jpy / australian yen / carry trade                     -> AUDJPY
  dow / dow jones / us30 / wall street / djia / blue chips / industrials  -> US30
  nasdaq / ndx / ndx100 / tech index / nasdaq 100 / qqq / big tech        -> NDX100

  -- Timeframe mappings:
  low timeframe         -> M5 + M15  (M15=trend, M5=momentum+confirmation)
  mid timeframe         -> M15 + H1  (H1=trend, M15=momentum+confirmation)
  high timeframe        -> H1 + H4   (H4=trend, H1=momentum+confirmation)
  intraday / short      -> M5 + M15
  swing                 -> H1 + H4
  long term / position  -> H4 + H12  (H12=trend, H4=momentum+confirmation)

  -- Time horizon mappings:
  recently / now / latest -> last 12 bars (default timeframe)
  last few minutes        -> last 12 M5 bars
  last hour / recent hours-> last 12 H1 bars
  recent hours (plural)   -> last 12 H1 bars
  today / this session    -> current session bars (M30 or H1)
  last few hours          -> last 12 H1 bars
  last few days           -> last 12 H4 bars
  this week / last week   -> last 12 H12 bars
  recent days             -> last 12 H4 bars
  this month / last month -> last 12 D1 bars

  -- Time horizon defaults when missing entirely:
  (no time reference given) -> LIMIT 12 of the resolved timeframe
```

---

---

## 6.5 Dynamic Market Data — Conversation History Strategy _(New V3.3)_

### 6.5.1 The Core Problem

Market data in PostgreSQL updates every 5 minutes. Conversation history
containing market data references becomes stale within one bar interval.
This is fundamentally different from conventional chatbots where all
prior conversation content remains permanently valid.

```
Conventional chatbot history:
  Turn 1 (10:00): "Topic is X"         <- still valid at Turn 3
  Turn 2 (10:05): "Detail about X"     <- still valid at Turn 3
  Turn 3 (10:15): follow-up query      <- history fully usable

Trading SaaS history:
  Turn 1 (10:00): "XAUUSD close=5187, TEMA above HRMA, bullish"
  Turn 2 (10:05): "EMA holding support at 5185"
  Turn 3 (10:17): follow-up query
                  <- 2 new M5 bars have printed
                  <- price may now be 5192 or 5178
                  <- Turn 1 and Turn 2 market data is STALE
                  <- JSONB comments describe OLD conditions
```

### 6.5.2 Content Classification in History

Conversation history contains two fundamentally different content types
that must be handled differently:

```
TYPE A: STATIC CONTENT  <- safe to keep in history indefinitely
  User intent and preferences  ("I prefer scalping")
  Clarifications provided      ("I meant H1 timeframe")
  Trading style stated         ("I use trend-following")
  Symbols/TF under discussion  ("we are analyzing XAUUSD H1")
  AI analytical conclusions    ("structure is bullish above 5180")
  Open questions/follow-ups    ("user wants to know entry point")

TYPE B: MARKET DATA REFERENCES  <- expires every 5 minutes
  Raw OHLCV values             ("close=5187.2, high=5189.22")
  Indicator values             ("TEMA=5188.1, HRMA=5185.18")
  JSONB narratives             ("bearish candle with rejection")
  Specific bar conditions      ("uptrend on H1 at 10:00")
  Price levels cited           ("support at 5185")
```

**Rule: NEVER store TYPE B content in conversation history.**
**ALWAYS re-fetch market data fresh on every turn regardless of recency.**

### 6.5.3 Dual-Store Session Architecture

```
Session stores TWO separate memory layers:

STORE 1: Static Conversation Memory  (conversation_sessions.messages)
  What to store:
    - User intent, clarifications, preferences (TYPE A only)
    - AI conclusions in narrative form (no raw numbers)
    - Symbol + TF context for the session
  What NOT to store:
    - Raw OHLCV values
    - Indicator values
    - JSONB narratives from prior turns
    - Any specific price levels or bar data

STORE 2: Market Data Fetch Metadata  (conversation_sessions.market_meta)
  Stores per-turn fetch record:
    - fetch_timestamp: when data was fetched
    - query_params: {symbol, timeframe, limit}
    - bar_range: {from_timestamp, to_timestamp}
    - bars_fetched: N
  Used for:
    - Staleness detection on next turn
    - Bar count awareness (how many new bars since last fetch)
    - Generating the Short Remark (see Section 6.5.5)
    - Default params for follow-up queries
```

### 6.5.4 Implementation: Data Freshness Layer

```typescript
async function assembleContext(session: Session, userQuery: string) {
  // Step 1: Always load static conversation memory
  const staticHistory = filterStaticContent(session.messages);
  // filterStaticContent() strips any TYPE B content
  // keeping only TYPE A: intent, clarifications, conclusions

  // Step 2: Always re-fetch market data fresh — no caching
  const queryParams = resolveQueryParams(userQuery, session.market_meta);
  // Uses last query_params as default if user says "what about now?"
  // Overrides if user specifies new symbol/TF

  const freshData = await fetchFreshMarketData(queryParams);
  // Always fetches from PostgreSQL regardless of elapsed time

  // Step 3: Calculate bar delta since last fetch
  const barDelta = calculateBarDelta(
    session.market_meta?.fetch_timestamp,
    session.market_meta?.bar_range?.to_timestamp,
    queryParams.timeframe
  );
  // barDelta = { new_bars_printed: N, elapsed_minutes: N }

  // Step 4: Generate Short Remark if prior data exists
  const shortRemark =
    barDelta.new_bars_printed > 0
      ? generateShortRemark(session.market_meta, freshData, barDelta)
      : null;

  // Step 5: Save new fetch metadata to session
  await updateMarketMeta(session.session_id, {
    fetch_timestamp: Date.now(),
    query_params: queryParams,
    bar_range: {
      from_timestamp: freshData.rows.at(-1).timestamp_adjusted,
      to_timestamp: freshData.rows.at(0).timestamp_adjusted,
    },
    bars_fetched: freshData.rows.length,
  });

  return {
    staticHistory, // TYPE A history only
    freshData, // always current market data
    shortRemark, // data refresh notice for user
    barDelta, // injected into system prompt
    userQuery,
  };
}

function calculateBarDelta(lastFetchTs, lastBarTs, timeframe) {
  if (!lastFetchTs) return { new_bars_printed: 0, elapsed_minutes: 0 };
  const tfMinutes = {
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H2: 120,
    H4: 240,
    H8: 480,
    H12: 720,
    D1: 1440,
  };
  const elapsed = (Date.now() - lastFetchTs) / 60000;
  const newBars = Math.floor(elapsed / tfMinutes[timeframe]);
  return { new_bars_printed: newBars, elapsed_minutes: Math.round(elapsed) };
}
```

### 6.5.5 Short Remark — Data Refresh Notice to User

Every response where market data has been re-fetched since the prior turn
MUST include a Short Remark at the TOP of the response, before the analysis.
This prevents user confusion between stale and current market conditions.

### Short Remark Master Rule

```
Show Short Remark = (market_data_fetched == true)
                  AND (new_bars_printed >= 1)
                  AND (session.turn > 1)

ALL THREE conditions must be true. If any is false -> skip Short Remark.
```

**Full decision matrix:**

```
Query type                        Data fetched?  New bars?  Show Remark?
──────────────────────────────────────────────────────────────────────
"How is gold H1 now?"             YES            YES        YES
"Should I enter long?"            YES (multi-TF) YES        YES
"What happened to gold at 10:00?" YES            YES        YES
"Gold H1 again" (same bar)        YES            NO         NO  <- same bar
"What is RSI?"                    NO             n/a        NO  <- conceptual
"Explain TEMA crossover"          NO             n/a        NO  <- conceptual
"What timeframes do you support?" NO             n/a        NO  <- system query
"I prefer scalping style"         NO             n/a        NO  <- preference
"Thanks, got it"                  NO             n/a        NO  <- conversational
"Should I trade?" (no symbol yet) NO             n/a        NO  <- clarification
Turn 1 of session (any query)     YES            n/a        NO  <- no prior turn
Tier access violation (blocked)   NO             n/a        NO  <- no data fetched
Unknown symbol (blocked)          NO             n/a        NO  <- no data fetched
```

**Mapping to Fallback Priority Chain (Section 5.2):**

```
Item 1  Primary flow          -> fetches data -> Short Remark if new bars >= 1
Item 2  Missing TF            -> no fetch yet -> NO Short Remark
Item 3  No symbol             -> no fetch yet -> NO Short Remark
Item 4  Tier violation symbol -> blocked      -> NO Short Remark
Item 5  Tier violation TF     -> blocked      -> NO Short Remark
Item 6  Tier violation both   -> blocked      -> NO Short Remark
Item 7  Unknown symbol        -> blocked      -> NO Short Remark
Item 8  Unsupported TF        -> blocked      -> NO Short Remark
Item 9  Stale data            -> fetches data -> Short Remark + stale disclaimer
Item 10 Pure conceptual       -> VectorDB only-> NO Short Remark
Item 11 Clarification default -> fetches data -> Short Remark if new bars >= 1
```

**Short Remark template:**

```
> Data refreshed. Previous analysis was based on bars from
> [from_timestamp_prev] to [to_timestamp_prev].
> This analysis is based on the latest bars from
> [from_timestamp_curr] to [to_timestamp_curr]
> ([N] new [TF] bars have printed since the last analysis).
```

**Rendered example:**

```
> Data refreshed. Previous analysis was based on bars from
> 2026-03-04 09:45 to 2026-03-04 10:00.
> This analysis is based on the latest bars from
> 2026-03-04 09:50 to 2026-03-04 10:15
> (3 new M5 bars have printed since the last analysis).

[Analysis continues below...]
```

**Short Remark display rules:**

```
Position:  Always FIRST in response, before any analysis text
Format:    Blockquote (>) for visual distinction from analysis body
Length:    3-5 lines maximum — it is a notice, not a paragraph
Tone:      Neutral, factual — not apologetic, not alarming
Frequency: Once per turn maximum — never repeat within same response
```

**Short Remark generator:**

```typescript
function shouldShowShortRemark(
  marketDataFetched: boolean,
  newBarsPrinted: number,
  sessionTurn: number
): boolean {
  return marketDataFetched && newBarsPrinted >= 1 && sessionTurn > 1;
}

function generateShortRemark(
  prevMeta: MarketMeta,
  freshData: MarketData,
  barDelta: BarDelta
): string {
  const prevFrom = formatTimestamp(prevMeta.bar_range.from_timestamp);
  const prevTo = formatTimestamp(prevMeta.bar_range.to_timestamp);
  const currFrom = formatTimestamp(freshData.rows.at(-1).timestamp_adjusted);
  const currTo = formatTimestamp(freshData.rows.at(0).timestamp_adjusted);
  const tf = prevMeta.query_params.timeframe;
  const n = barDelta.new_bars_printed;

  return [
    `> Data refreshed. Previous analysis was based on bars from`,
    `> ${prevFrom} to ${prevTo}.`,
    `> This analysis is based on the latest bars from`,
    `> ${currFrom} to ${currTo}`,
    `> (${n} new ${tf} bar${n > 1 ? 's' : ''} have printed since the last analysis).`,
  ].join('\n');
}
```

### 6.5.6 System Prompt Injection for Bar Awareness

Inject bar delta context into system prompt on every turn so Claude
understands the passage of time between conversation turns:

```
Market data context (injected dynamically per turn):
  Data fetched at:       [fetch_timestamp]
  Symbol / Timeframe:    [symbol] / [timeframe]
  Bar range:             [from_timestamp] to [to_timestamp]
  Bars in context:       [N] bars
  New bars since last turn: [N] new [TF] bars have printed
  Prior analysis at:     [prev_fetch_timestamp] (if exists)

Instruction to Claude:
  "Market data is always freshly fetched. Do not reference specific
   price values or indicator values from conversation history as
   these are stale. Base all analysis on the fresh data provided
   in this prompt only. If prior conclusions in history conflict
   with current fresh data, current data takes precedence."
```

### 6.5.7 What Claude API Receives Per Turn

```
Turn 1 (10:00) — "How is gold H1 doing?"
  System prompt:  trading analyst role + bar awareness (0 prior bars)
  Static history: [] (empty, first turn)
  Fresh data:     XAUUSD H1 last 12 bars @ 10:00
  Short Remark:   none (first turn)
  Saved to meta:  fetch_ts=10:00, bars=10:00..09:00

Turn 2 (10:17) — "Should I enter long now?"
  System prompt:  role + "3 new H1 bars since last turn"
  Static history: ["user analyzing XAUUSD H1, bullish conclusion at 10:00"]
                  (TYPE A only — no raw OHLCV from Turn 1)
  Fresh data:     XAUUSD H1 last 12 bars @ 10:17 (RE-FETCHED)
  Short Remark:   "Previous: 09:00-10:00. Current: 09:05-10:15.
                   3 new H1 bars have printed."
  VectorDB:       entry criteria knowledge chunks
  User profile:   trading style, risk preference
```

### 6.5.8 Database Schema Addition

```sql
-- Add market_meta column to conversation_sessions
ALTER TABLE conversation_sessions
ADD COLUMN market_meta JSONB;

-- market_meta structure:
-- {
--   "fetch_timestamp":  1709541000000,
--   "query_params":     {"symbol":"XAUUSD","timeframe":"H1","limit":12},
--   "bar_range": {
--     "from_timestamp": 1709537400000,
--     "to_timestamp":   1709541000000
--   },
--   "bars_fetched":     12
-- }
```

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

**Dual LLM cost model:**

```
VANNA LLM cost (Admin-borne, SaaS operating cost):
  Model:    Low-cost (Haiku 4.5, GPT-4o mini, Gemini Flash-Lite)
  Usage:    Every query that reaches VANNA (NL->SQL translation only)
  Tokens:   Small — system prompt + NL query + SQL output (~500-1500 tokens)
  Control:  Admin selects model; users cannot change
  Budget:   Fixed predictable cost per query regardless of user count

Trading LLM cost (User-borne via plan usage limit):
  Model:    User-selected (Claude Sonnet/Opus, GPT-4o, Gemini Pro)
  Usage:    Every trading analysis response
  Tokens:   Large — full context: DataFrame + VectorDB chunks + history
            (~5,000-50,000 tokens per query depending on data scope)
  Control:  User selects model; higher-cost model burns limit faster
  Budget:   Per-user plan usage limit (see Section 2.8.3)
```

**Plan usage limit design:**

```
FREE tier:  monthly token budget (e.g. 500,000 trading LLM tokens/month)
PRO tier:   monthly token budget (e.g. 5,000,000 trading LLM tokens/month)

Model cost multiplier (approx. relative token cost):
  claude-haiku-4-5          -> 1x  (baseline)
  gemini-2.0-flash          -> 1x
  gpt-4o-mini               -> 1x
  claude-sonnet-4-6         -> 5x  (burns limit 5x faster)
  gpt-4o                    -> 5x
  gemini-2.0-pro            -> 4x
  claude-opus-4             -> 15x (burns limit 15x faster)

Usage limit warning thresholds:
  80% of limit reached  -> "You are approaching your monthly limit."
  95% of limit reached  -> "Upgrade to Pro / switch to a lighter model"
  100% reached          -> block Trading LLM calls, show upgrade prompt
  NOTE: VANNA LLM calls are NOT subject to user plan limit (SaaS cost)
```

**Operational cost targets:**

```
FREE tier:  cap queries/day -> prevent spam
PRO tier:   monitor cost/user vs $29/month revenue
Alert if:   single user > $5/day on Trading LLM

JSONB overhead vs on-demand:
  Extra PostgreSQL storage:            +$5/month
  Richer context -> fewer follow-ups:  -$50/month (est.)
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

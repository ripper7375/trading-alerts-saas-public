# Dual RAG System Architecture

## VANNA RAG (SQL Translation) + TRADING RAG (Knowledge Retrieval)

**Version:** 1.0.0
**Created:** 2026-03-03
**Purpose:** Comprehensive architecture design and implementation blueprint for the dual RAG system that powers natural language querying of trading data.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [RAG System #1 — VANNA RAG (SQL Translation)](#3-rag-system-1--vanna-rag-sql-translation)
4. [RAG System #2 — TRADING RAG (Knowledge Retrieval)](#4-rag-system-2--trading-rag-knowledge-retrieval)
5. [Dual RAG Data Flow](#5-dual-rag-data-flow)
6. [Query Router](#6-query-router)
7. [Database Schema — Single Table Design](#7-database-schema--single-table-design)
8. [Reference Data — Vanna Training Data](#8-reference-data--vanna-training-data)
9. [Trading Knowledge Base — VectorDB](#9-trading-knowledge-base--vectordb)
10. [Claude API Integration](#10-claude-api-integration)
11. [Component Inventory](#11-component-inventory)
12. [Technology Stack](#12-technology-stack)
13. [Implementation Phases](#13-implementation-phases)
14. [Error Handling & Fallbacks](#14-error-handling--fallbacks)
15. [Security Considerations](#15-security-considerations)

---

## 1. System Overview

The SaaS platform uses a **dual RAG architecture** to answer user natural language queries about trading data. Two specialized RAG systems work in sequence, each handling a distinct responsibility:

| System | Responsibility | Input | Output |
|---|---|---|---|
| **VANNA RAG** | Translate natural language to SQL, execute, return data | User's NL query | DataFrame (numeric + JSONB narratives) |
| **TRADING RAG** | Enrich data with trading knowledge, generate final response | DataFrame + user query | Natural language answer to user |

### Why Two RAG Systems

A single RAG system cannot serve both purposes effectively:

- **VANNA RAG** needs database schema context (DDL, column descriptions, example SQL) to translate ambiguous human language into precise SQL. Its vector store contains **database knowledge**.
- **TRADING RAG** needs trading domain context (indicator interpretations, candlestick patterns, trading workflows) to explain what the data means. Its vector store contains **trading knowledge**.

These are fundamentally different knowledge domains that require separate retrieval pipelines.

---

## 2. Architecture Diagram

### End-to-End Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
│  "How about gold price movement in low timeframe last hour?"         │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        QUERY ROUTER                                  │
│  Determines: Does this query need SQL data? Knowledge only? Both?    │
└──────────┬───────────────────────────────────────┬───────────────────┘
           │                                       │
           ▼                                       ▼
┌─────────────────────────┐          ┌─────────────────────────────────┐
│   VANNA RAG             │          │   TRADING RAG                   │
│   (SQL Translation)     │          │   (Knowledge Retrieval)         │
│                         │          │                                 │
│  ┌───────────────────┐  │          │  ┌───────────────────────────┐  │
│  │ Vector Store       │  │          │  │ Vector Store              │  │
│  │ (Schema Context)   │  │          │  │ (Trading Knowledge)       │  │
│  │  - DDL schemas     │  │          │  │  - Indicator guides       │  │
│  │  - Column desc.    │  │          │  │  - Pattern recognition    │  │
│  │  - Example SQL     │  │          │  │  - Trading workflows      │  │
│  └────────┬──────────┘  │          │  └────────────┬──────────────┘  │
│           ▼              │          │               │                 │
│  ┌───────────────────┐  │          │               │                 │
│  │ LLM generates SQL │  │          │               │                 │
│  └────────┬──────────┘  │          │               │                 │
│           ▼              │          │               │                 │
│  ┌───────────────────┐  │          │               │                 │
│  │ PostgreSQL        │  │          │               │                 │
│  │ Execute query     │  │          │               │                 │
│  └────────┬──────────┘  │          │               │                 │
│           ▼              │          │               │                 │
│  ┌───────────────────┐  │          │               │                 │
│  │ DataFrame result  │  │          │               │                 │
│  │ (numeric + JSONB) │──┼──────────┼───┐           │                 │
│  └───────────────────┘  │          │   │           │                 │
└─────────────────────────┘          │   ▼           ▼                 │
                                     │ ┌───────────────────────────┐   │
                                     │ │ Claude API                │   │
                                     │ │                           │   │
                                     │ │ Combines:                 │   │
                                     │ │  1. User query (text)     │   │
                                     │ │  2. DataFrame (context)   │   │
                                     │ │  3. Trading knowledge     │   │
                                     │ │     (from VectorDB)       │   │
                                     │ │                           │   │
                                     │ │ Generates:                │   │
                                     │ │  Final NL response        │   │
                                     │ └─────────────┬─────────────┘   │
                                     └───────────────┼─────────────────┘
                                                     │
                                                     ▼
                                     ┌───────────────────────────────┐
                                     │  Response to User             │
                                     │  "Gold (XAUUSD) on M5 showed │
                                     │  bearish momentum in the last │
                                     │  hour with TEMA crossing      │
                                     │  below HRMA..."               │
                                     └───────────────────────────────┘
```

---

## 3. RAG System #1 — VANNA RAG (SQL Translation)

### Purpose

Translate ambiguous natural language queries into precise, executable SQL queries against the PostgreSQL database.

### The Translation Problem It Solves

Users say things like:

| User says | Database needs |
|---|---|
| "gold" | `symbol = 'XAUUSD'` |
| "low timeframe" | `timeframe = 'M5'` |
| "last hour" | `LIMIT 12` (12 bars x 5min = 60min) |
| "euro dollar" | `symbol = 'EURUSD'` |
| "daily chart" | `timeframe = 'D1'` |
| "this week" | `timestamp_adjusted >= date_trunc('week', NOW())` |

Vanna's reference data teaches the LLM these mappings.

### Components

```
VANNA RAG
├── Vector Store (schema context)
│   ├── DDL schemas from Prisma
│   ├── Column descriptions / narratives
│   └── Example question → SQL pairs
│
├── LLM Service (SQL generation)
│   └── Claude / GPT / configurable
│
├── SQL Runner (query execution)
│   └── PostgreSQL via Prisma connection
│
└── Output: pd.DataFrame
    ├── Numeric columns (OHLCV, indicators)
    └── JSONB column (descriptive narratives)
```

### How It Works (Step by Step)

```
Step 1: User query arrives
        "How about gold price movement in low timeframe last hour?"

Step 2: Vector similarity search against reference data
        Retrieved:
          - Candle table DDL (schema)
          - "gold maps to XAUUSD, low timeframe maps to M5"
          - Similar example: "Show EURUSD on M5" → SQL

Step 3: LLM generates SQL with retrieved context
        SELECT timestamp_adjusted, symbol, timeframe,
               open, high, low, close, volume,
               tema, hrma, smma,
               comment
        FROM candles
        WHERE symbol = 'XAUUSD'
          AND timeframe = 'M5'
        ORDER BY timestamp_adjusted DESC
        LIMIT 12;

Step 4: SQL Runner executes against PostgreSQL

Step 5: Returns DataFrame with all columns (numeric + JSONB)
```

### What Gets Stored in Vanna's Vector Store

Three categories of reference data (loaded once, updated when schema changes):

**Category 1: DDL Schemas**
```sql
CREATE TABLE candles (
    id              TEXT PRIMARY KEY,
    timestamp_adjusted TIMESTAMP WITH TIME ZONE,
    symbol          VARCHAR(20),
    timeframe       VARCHAR(10),
    open            DOUBLE PRECISION,
    high            DOUBLE PRECISION,
    low             DOUBLE PRECISION,
    close           DOUBLE PRECISION,
    volume          DOUBLE PRECISION,
    tema            DOUBLE PRECISION,
    hrma            DOUBLE PRECISION,
    smma            DOUBLE PRECISION,
    comment         JSONB
);
```

**Category 2: Column & Domain Descriptions**
```text
"The candles table stores OHLCV candlestick data with technical indicators.

Symbol mapping:
  - Gold / XAUUSD: symbol = 'XAUUSD'
  - Euro Dollar / EURUSD: symbol = 'EURUSD'
  - Cable / GBPUSD: symbol = 'GBPUSD'
  - Dollar Yen / USDJPY: symbol = 'USDJPY'

Timeframe mapping:
  - Scalping / lowest timeframe: timeframe = 'M1' (1 minute)
  - Low timeframe: timeframe = 'M5' (5 minutes)
  - Medium timeframe: timeframe = 'M15' (15 minutes)
  - Hourly: timeframe = 'H1' (1 hour)
  - Four hour: timeframe = 'H4' (4 hours)
  - Daily: timeframe = 'D1' (1 day)

Indicator columns:
  - tema: Triple Exponential Moving Average
  - hrma: Hull-based Rapid Moving Average
  - smma: Smoothed Moving Average

The comment column (JSONB) contains pre-computed descriptive narratives
that analyze each candle's price action, indicator behavior, and
technical significance. These are stored per-row and returned alongside
numeric data."
```

**Category 3: Example Question → SQL Pairs**
```text
Q: "Show me gold on the 5 minute chart for the last hour"
A: SELECT * FROM candles WHERE symbol = 'XAUUSD' AND timeframe = 'M5'
   ORDER BY timestamp_adjusted DESC LIMIT 12;

Q: "What's the latest EURUSD daily candle?"
A: SELECT * FROM candles WHERE symbol = 'EURUSD' AND timeframe = 'D1'
   ORDER BY timestamp_adjusted DESC LIMIT 1;

Q: "Compare TEMA and HRMA for GBPUSD on H1 today"
A: SELECT timestamp_adjusted, tema, hrma, close FROM candles
   WHERE symbol = 'GBPUSD' AND timeframe = 'H1'
   AND timestamp_adjusted >= CURRENT_DATE
   ORDER BY timestamp_adjusted ASC;
```

### Vanna Components Used

| Vanna Component | Class | Purpose |
|---|---|---|
| Agent Memory | `ChromaAgentMemory` or `PineconeAgentMemory` | Store/retrieve reference data |
| LLM Service | `AnthropicLlmService` | Generate SQL from NL + context |
| SQL Runner | `PostgresRunner` | Execute generated SQL |
| Data Models | `ToolMemory`, `TextMemory` | Structure stored reference data |

### No Embedding Required at Query Time

The user's natural language query is sent as **plain text** to Vanna's LLM. The vector similarity search happens only against the pre-embedded reference data to find relevant schema context. The query itself is not embedded.

---

## 4. RAG System #2 — TRADING RAG (Knowledge Retrieval)

### Purpose

Combine the SQL results (DataFrame) with domain-specific trading knowledge to generate a meaningful, contextual natural language response.

### The Interpretation Problem It Solves

Raw data from PostgreSQL:

```
| close   | tema    | hrma    | comment (JSONB)                    |
|---------|---------|---------|-------------------------------------|
| 5187.20 | 5188.10 | 5189.50 | "Bearish candle, wick rejection..." |
| 5189.22 | 5188.80 | 5189.10 | "Doji forming at resistance..."     |
```

Without trading knowledge, an LLM would describe numbers. With trading knowledge, it can explain **what the numbers mean** for a trader.

### Components

```
TRADING RAG
├── Vector Store (trading knowledge)
│   ├── Indicator interpretation rules
│   ├── Candlestick pattern definitions
│   ├── Trading workflows & strategies
│   ├── Risk management principles
│   └── Market structure concepts
│
├── Claude API (response generation)
│   └── Combines: query + DataFrame + retrieved knowledge
│
└── Output: Natural language response to user
```

### How It Works (Step by Step)

```
Step 1: Receive inputs
        - User's original query (plain text, no embedding)
        - DataFrame from VANNA RAG (numeric + JSONB, no embedding)

Step 2: Query VectorDB for relevant trading knowledge
        Search query derived from user question + data characteristics
        Retrieved:
          - "TEMA crossing below HRMA indicates short-term bearish momentum"
          - "Upper wick rejection at resistance suggests seller dominance"
          - "M5 timeframe patterns are noise-prone; confirm with H1"

Step 3: Claude API receives all three inputs
        - System prompt with trading analyst role
        - User query (plain text context)
        - DataFrame (injected as structured context)
        - Retrieved trading knowledge (from VectorDB)

Step 4: Claude generates contextual response
        "Gold (XAUUSD) on the M5 timeframe showed bearish momentum
         over the last hour. TEMA crossed below HRMA on the 3rd bar,
         confirming a short-term momentum shift. Notable upper wick
         rejection at 5189 suggests seller dominance at that level..."
```

### What Gets Stored in Trading RAG's VectorDB

This is the **pre-embedded trading knowledge base** — the only component that uses embeddings at query time:

**Category 1: Indicator Interpretation**
```text
"When TEMA crosses above HRMA, it signals short-term bullish momentum.
The crossover is more significant when confirmed by rising volume.
SMMA acts as a trend filter — if price is above SMMA, favor long setups."
```

**Category 2: Candlestick Pattern Recognition**
```text
"A bearish engulfing pattern on M5 at a resistance level is a
short-term reversal signal. Reliability increases when:
1. Upper wick is > 60% of total candle range
2. Volume is above the 20-period average
3. TEMA slope is negative"
```

**Category 3: Trading Workflows**
```text
"Multi-timeframe analysis workflow:
1. Identify trend on H4 (SMMA direction)
2. Find entry zone on H1 (TEMA/HRMA alignment)
3. Time entry on M5 (candlestick confirmation)
4. Set stop loss below the M5 swing low"
```

**Category 4: Market Context**
```text
"XAUUSD (Gold) is sensitive to USD strength, bond yields, and
geopolitical events. During London session (07:00-16:00 UTC),
volatility is typically higher. Asian session tends to consolidate."
```

### Embedding Strategy

| What | Embedded? | When | Why |
|---|---|---|---|
| Trading knowledge base | Yes | At ingestion time (one-time + updates) | Large corpus, needs similarity search |
| User query | No | Never | Small text, passed directly to Claude |
| DataFrame from Vanna | No | Never | Already specific/filtered, passed as context |

---

## 5. Dual RAG Data Flow

### Complete Sequence (Numbered Steps)

```
        USER
         │
         │ (1) Natural language query
         │     "How about gold price movement in low timeframe last hour?"
         ▼
    ┌─────────┐
    │  VANNA  │
    │   RAG   │
    └────┬────┘
         │
         │ (2) Vector search: retrieve schema context
         │     Found: DDL, "gold=XAUUSD, low=M5, 1hr=12 bars"
         │
         │ (3) LLM generates SQL
         │     SELECT ... FROM candles WHERE symbol='XAUUSD'
         │     AND timeframe='M5' ORDER BY ... LIMIT 12
         │
         │ (4) Execute SQL against PostgreSQL
         │     Returns DataFrame: 12 rows x all columns
         │     ┌──────────┬───────┬────────┬─────────────────┐
         │     │ close    │ tema  │ hrma   │ comment (JSONB)  │
         │     │ 5187.20  │ 5188  │ 5189.5 │ "Bearish..."    │
         │     │ ...      │ ...   │ ...    │ ...              │
         │     └──────────┴───────┴────────┴─────────────────┘
         │
         ▼
    ┌──────────┐
    │ TRADING  │
    │   RAG    │
    └────┬─────┘
         │
         │ (5) Inputs to Claude API (NO embedding needed):
         │     - User query (plain text)
         │     - DataFrame (structured context)
         │
         │ (6) Claude API queries VectorDB for trading knowledge
         │     (THIS is where embedding-based retrieval happens)
         │     Retrieved: indicator rules, pattern guides, workflows
         │
         │ (7) Claude combines all three:
         │     user query + DataFrame + trading knowledge
         │
         │ (8) Generates final natural language response
         │
         ▼
        USER
        "Gold (XAUUSD) on M5 showed bearish momentum in the last hour.
         TEMA crossed below HRMA suggesting short-term selling pressure..."
```

---

## 6. Query Router

### Purpose

Determine whether a user query requires SQL data, trading knowledge only, or both.

### Routing Logic

```
User query arrives
       │
       ▼
┌──────────────────────────────────────────────┐
│  Does the query reference specific data?      │
│  (prices, symbols, timeframes, "show me",     │
│   "what happened", "last hour", etc.)         │
└──────┬──────────────────────────┬─────────────┘
       │ YES                      │ NO
       ▼                          ▼
  VANNA RAG → TRADING RAG    TRADING RAG only
  (full pipeline)             (knowledge answer)
```

### Route Categories

| Route | Example Query | Pipeline |
|---|---|---|
| **Data + Knowledge** | "How is gold moving on M5?" | VANNA RAG → TRADING RAG |
| **Knowledge only** | "What does TEMA crossover mean?" | TRADING RAG only |
| **Data only** | "Give me raw EURUSD H1 data" | VANNA RAG only (return DataFrame) |

### Implementation Approach

The router can be implemented as:

1. **LLM-based classification** — Send query to Claude with a classification prompt
2. **Keyword heuristics** — Check for data-referencing keywords (symbol names, timeframes, "show", "last", "today")
3. **Hybrid** — Keyword check first, LLM fallback for ambiguous queries

---

## 7. Database Schema — Single Table Design

### Prisma Schema

```prisma
model Candle {
  id                 String   @id @default(cuid())
  timestampAdjusted  DateTime @map("timestamp_adjusted")
  symbol             String   // e.g., "XAUUSD", "EURUSD"
  timeframe          String   // e.g., "M1", "M5", "M15", "H1", "H4", "D1"
  open               Float
  high               Float
  low                Float
  close              Float
  volume             Float
  tema               Float    // Triple Exponential Moving Average
  hrma               Float    // Hull-based Rapid Moving Average
  smma               Float    // Smoothed Moving Average
  comment            Json     // JSONB descriptive narrative

  @@map("candles")
  @@index([symbol, timeframe, timestampAdjusted])
}
```

### Single Table, Dual Content

Every row contains **both** numeric data and descriptive narrative:

```
┌──────────────────────────────────────────────────────────────────────┐
│                        candles table                                 │
├──────────────────────────────────┬───────────────────────────────────┤
│  Numeric Columns                 │  JSONB Column                    │
│  (quantitative data)             │  (qualitative narrative)         │
│                                  │                                  │
│  open    = 5189.22               │  comment = {                     │
│  high    = 5189.22               │    "summary": "Bearish candle    │
│  low     = 5186.50               │     with upper wick rejection    │
│  close   = 5187.20               │     at 5189",                    │
│  volume  = 1243.0                │    "tema_analysis": "TEMA        │
│  tema    = 5188.10               │     crossing below HRMA",        │
│  hrma    = 5189.50               │    "momentum": "bearish",        │
│  smma    = 5190.30               │    "significance": "moderate"    │
│                                  │  }                               │
├──────────────────────────────────┴───────────────────────────────────┤
│  Both returned by the SAME SQL query from VANNA RAG                 │
│  Both passed together as DataFrame context to TRADING RAG           │
└──────────────────────────────────────────────────────────────────────┘
```

The JSONB narratives are **pre-computed** during candle ingestion (by the data pipeline), not generated at query time. This eliminates redundant LLM calls when the same data is queried repeatedly.

---

## 8. Reference Data — Vanna Training Data

### What It Is

Descriptive narrative data that explains column names, data types, domain mappings, and business rules from the Prisma schema. This is what enables the LLM to understand the full context of the database.

### Storage Method

Loaded into Vanna's vector store using the `AgentMemory` interface:

```python
# DDL schemas → save_text_memory
await agent_memory.save_text_memory(
    content=ddl_schema_text,
    context=tool_context
)

# Column/domain descriptions → save_text_memory
await agent_memory.save_text_memory(
    content=column_description_text,
    context=tool_context
)

# Example SQL pairs → save_tool_usage
await agent_memory.save_tool_usage(
    question="Show gold on 5 minute chart last hour",
    tool_name="run_sql",
    args={"sql": "SELECT * FROM candles WHERE symbol = 'XAUUSD' AND timeframe = 'M5' ORDER BY timestamp_adjusted DESC LIMIT 12"},
    context=tool_context,
    success=True
)
```

### Maintenance

| Event | Action |
|---|---|
| Prisma schema changes | Re-load DDL into Vanna's vector store |
| New symbol added | Update domain descriptions |
| New timeframe added | Update timeframe mappings |
| Users ask new query patterns | Add as example SQL pairs (continuous improvement) |

---

## 9. Trading Knowledge Base — VectorDB

### What It Is

A corpus of trading domain knowledge embedded and stored in a vector database. This is the **only component that uses embedding-based retrieval at query time**.

### Knowledge Categories

```
Trading Knowledge Base (VectorDB)
├── Indicator Interpretation
│   ├── TEMA behavior and signals
│   ├── HRMA behavior and signals
│   ├── SMMA as trend filter
│   └── Cross-indicator relationships
│
├── Candlestick Patterns
│   ├── Single candle patterns (doji, hammer, engulfing)
│   ├── Multi-candle patterns (three soldiers, evening star)
│   └── Pattern reliability by timeframe
│
├── Trading Workflows
│   ├── Multi-timeframe analysis
│   ├── Entry/exit timing
│   └── Confirmation sequences
│
├── Market Context
│   ├── Symbol-specific behaviors (XAUUSD, EURUSD, etc.)
│   ├── Session-based volatility patterns
│   └── Correlation awareness
│
└── Risk Management
    ├── Position sizing principles
    ├── Stop loss placement
    └── Risk/reward assessment
```

### Embedding Pipeline

```
Knowledge documents (markdown/text)
        │
        │  One-time ingestion
        ▼
┌───────────────────┐
│  Embedding Model   │
│  (e.g., text-      │
│   embedding-3-     │
│   small)           │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  VectorDB          │
│  (ChromaDB /       │
│   Pinecone /       │
│   Qdrant)          │
└───────────────────┘
```

### At Query Time

```
Claude API needs trading context
        │
        │  Similarity search
        ▼
┌───────────────────┐
│  VectorDB          │  → Returns top-K relevant chunks
└───────────────────┘
        │
        ▼
  Injected into Claude prompt as context
```

---

## 10. Claude API Integration

### Role in the System

Claude API is the **response generation engine** for Trading RAG. It receives three inputs and produces the final user-facing response.

### Input Assembly (No Embedding Required)

```
Claude API Prompt Construction
├── System Prompt
│   "You are a trading analyst. Analyze the provided data
│    using the trading knowledge context. Respond in clear,
│    actionable language."
│
├── Context Block 1: DataFrame from VANNA RAG
│   Injected as structured text (not embedded)
│   ┌────────────────────────────────────────────┐
│   │ OHLCV + Indicator Data:                    │
│   │ Bar 1: close=5187.20, tema=5188.1, ...     │
│   │ Bar 2: close=5189.22, tema=5188.8, ...     │
│   │                                            │
│   │ Narrative Context:                          │
│   │ Bar 1: "Bearish candle, wick rejection..."  │
│   │ Bar 2: "Doji forming at resistance..."      │
│   └────────────────────────────────────────────┘
│
├── Context Block 2: Trading Knowledge (from VectorDB)
│   Retrieved via embedding similarity search
│   ┌────────────────────────────────────────────┐
│   │ "TEMA below HRMA = bearish momentum"       │
│   │ "Upper wick rejection = seller dominance"  │
│   │ "M5 patterns: confirm with H1 trend"       │
│   └────────────────────────────────────────────┘
│
└── User Message
    "How about gold price movement in low timeframe last hour?"
```

### What Gets Embedded vs What Doesn't

| Input | Embedded? | Reason |
|---|---|---|
| User query | No | Small text, passed directly as user message |
| DataFrame from Vanna | No | Already filtered/specific, injected as context |
| Trading knowledge base | Yes (pre-embedded) | Large corpus requiring similarity search at retrieval time |

---

## 11. Component Inventory

### VANNA RAG Components

| Component | Source | Description |
|---|---|---|
| `AgentMemory` | Vanna framework | Interface for storing/retrieving reference data |
| `ChromaAgentMemory` / `PineconeAgentMemory` | Vanna integration | Vector store for schema context |
| `AnthropicLlmService` | Vanna integration | LLM for SQL generation |
| `PostgresRunner` | Vanna integration | Execute SQL against PostgreSQL |
| `ToolMemory` | Vanna core | Data model for example SQL pairs |
| `TextMemory` | Vanna core | Data model for DDL/descriptions |

### TRADING RAG Components

| Component | Source | Description |
|---|---|---|
| VectorDB client | To be selected (ChromaDB / Pinecone / Qdrant) | Store/retrieve trading knowledge |
| Embedding model | OpenAI `text-embedding-3-small` or equivalent | Embed trading knowledge at ingestion |
| Claude API client | Anthropic SDK | Generate final response |
| Knowledge ingestion pipeline | Custom | Load trading docs into VectorDB |

### Shared Components

| Component | Description |
|---|---|
| Query Router | Classify queries and route to appropriate pipeline |
| User session management | Authenticate and track user context |
| Response formatter | Format final response for UI delivery |

---

## 12. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **LLM (SQL generation)** | Claude via Vanna's `AnthropicLlmService` | NL → SQL translation |
| **LLM (Response generation)** | Claude API (Anthropic SDK) | Final response generation |
| **Database** | PostgreSQL (via Prisma) | Trading data storage |
| **Vector Store (Vanna)** | ChromaDB or Pinecone | Schema reference data |
| **Vector Store (Trading)** | ChromaDB or Pinecone | Trading knowledge base |
| **Embedding Model** | `text-embedding-3-small` or equivalent | Embed trading knowledge |
| **ORM** | Prisma | Schema management, migrations |
| **Framework** | Next.js (App Router) | Web application |
| **API Layer** | Next.js Route Handlers | API endpoints |
| **Vanna Framework** | Vanna 2.0 (Python) | SQL translation pipeline |

### Vanna Integration Note

Vanna is a Python framework. Integration with the Next.js (TypeScript) application requires one of:

1. **Python microservice** — Vanna runs as a separate FastAPI service, called from Next.js via HTTP
2. **Python serverless function** — Vanna runs in a serverless Python runtime
3. **Direct port** — Re-implement Vanna's logic in TypeScript (higher effort, tighter integration)

---

## 13. Implementation Phases

### Phase 1: VANNA RAG Setup

1. Install Vanna and configure vector store (ChromaDB for dev, Pinecone for prod)
2. Extract DDL from Prisma schema and load as text memory
3. Write column/domain descriptions and load as text memory
4. Create 20-50 example question → SQL pairs and load as tool usage
5. Configure `AnthropicLlmService` with Claude API key
6. Configure `PostgresRunner` with database connection
7. Test: NL query → SQL generation → execution → DataFrame returned

### Phase 2: TRADING RAG Setup

1. Select and configure VectorDB (same or different instance from Vanna's)
2. Write trading knowledge documents (indicators, patterns, workflows)
3. Embed and ingest knowledge into VectorDB
4. Build Claude API prompt assembly logic
5. Test: DataFrame + query → knowledge retrieval → response generation

### Phase 3: Integration

1. Build query router (classify incoming queries)
2. Connect VANNA RAG output to TRADING RAG input
3. Build end-to-end pipeline: user query → router → VANNA → TRADING → response
4. Add error handling and fallbacks
5. Test with diverse query types

### Phase 4: Production Hardening

1. Add user authentication and tier-based access
2. Implement caching for repeated queries
3. Add monitoring and logging
4. Performance optimization (query latency targets)
5. Continuous improvement: add new example SQL pairs from user queries

---

## 14. Error Handling & Fallbacks

### VANNA RAG Failures

| Failure | Handling |
|---|---|
| SQL generation produces invalid SQL | Retry with error context; if fails again, return "Could not understand query" |
| SQL execution error | Return error message; do not expose raw SQL errors to user |
| Empty result set | Pass empty DataFrame to Trading RAG; let it respond "No data found for..." |
| Vector store unavailable | Fall back to LLM-only SQL generation (no RAG context) |

### TRADING RAG Failures

| Failure | Handling |
|---|---|
| VectorDB unavailable | Generate response using DataFrame + JSONB narratives only (no knowledge enrichment) |
| Claude API error | Retry with exponential backoff; after 3 failures, return raw DataFrame as formatted table |
| Knowledge retrieval returns no results | Proceed with DataFrame context only |

### Graceful Degradation Order

```
Full pipeline (ideal):     VANNA RAG + TRADING RAG (with knowledge)
Degraded level 1:          VANNA RAG + TRADING RAG (without knowledge, using JSONB narratives)
Degraded level 2:          VANNA RAG only (return formatted DataFrame)
Degraded level 3:          Error message to user
```

---

## 15. Security Considerations

### SQL Injection Prevention

- Vanna generates SQL via LLM, not from direct user input concatenation
- SQL Runner should use parameterized queries where possible
- Read-only database connection for the SQL Runner (no INSERT/UPDATE/DELETE)
- Query validation layer to reject destructive SQL before execution

### Data Access Control

- User tier determines which symbols/timeframes are accessible
- Tier validation happens **before** SQL execution, not after
- User can only query data their subscription tier permits

### API Key Management

- All API keys (Claude, VectorDB, database) stored as environment variables
- Never exposed to client-side code
- Rotated on regular schedule

### Rate Limiting

- Per-user query rate limits to prevent abuse
- LLM API call budget tracking per user tier

---

## Summary

The dual RAG system cleanly separates two concerns:

| | VANNA RAG | TRADING RAG |
|---|---|---|
| **Job** | Translate NL → SQL → Data | Interpret data → NL response |
| **Vector store contains** | Database schema knowledge | Trading domain knowledge |
| **LLM task** | Generate SQL | Generate analysis |
| **Input** | User query | User query + DataFrame |
| **Output** | DataFrame (numeric + JSONB) | Natural language response |
| **Embedding at query time** | No (reference data pre-embedded) | Yes (knowledge base similarity search) |

Both systems are modular and independently testable. VANNA RAG can be validated by checking SQL correctness. TRADING RAG can be validated by checking response quality given known DataFrames.

---

**End of Architecture Document**

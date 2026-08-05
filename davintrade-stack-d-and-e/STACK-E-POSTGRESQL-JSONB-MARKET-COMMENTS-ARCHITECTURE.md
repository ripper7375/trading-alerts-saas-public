# Stack E — PostgreSQL JSON-B Market Comment Feeds & Quality Metrics Architecture Framework

**Document Version:** 1.0.0  
**Status:** Authoritative Architectural Framework for Claude Code Execution  
**Target Scope (Phase 1):** `XAUUSD` on `M5` and `M15` timeframes only  
**Date:** 2026-08-05

---

## 1. Executive Summary & Purpose

Stack E defines the **Data Narrative Conversion & Real-Time Comment Engine** for the DavinTrade platform. It bridges the gap between raw numeric market data (OHLC + 79 calculated indicator columns in PostgreSQL `market_data_v6`) and the right-hand **Market Comments Feed & Quality Metrics Panel** on the UI.

Stack E operates on a **Database-First Narrative Engine**: rather than burdening application servers or LLMs with re-generating descriptive commentary on every request, PostgreSQL executes an automated `BEFORE INSERT OR UPDATE` trigger. This trigger transforms numeric threshold states into self-describing structured JSON-B narrative arrays (`comments` column), which are then broadcast via WebSockets to feed the real-time UI.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ DavinTrade  │ 🏷️ XAUUSD M5  Gemini 3.6 Flash ▼ │  XAUUSD M5 SSA & EDT Chart    M15 ZigZag Chart          │
├─────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
│ SIDEBAR     │ STACK D: CONVERSATIONAL AI       │ MIDDLE: DUAL TRADINGVIEW LIGHTWEIGHT CHARTS            │
│             │ ANALYST PANEL (LEFT)             │                                                        │
│ 🏷️ XAUUSD M5│                                  │ 📈 Window 1: XAUUSD M5                                 │
│   10m ago   │ 🤖 DAVINTRADE AI                 │    • Candles + SSA Line + Upper/Lower EDT Lines       │
│             │ Hello! I'm analyzing **XAUUSD**  │                                                        │
│ 🏷️ XAUUSD M15│ on the **M5** timeframe...       │ 📈 Window 2: XAUUSD M15                                │
│   17m ago   │                                  │    • Candles + ZigZag Polyline + Centroid Polygons     │
│             │                                  ├────────────────────────────────────────────────────────┤
│             │ 💬 Ask Gemini...                │ STACK E: MARKET COMMENTS & METRICS (RIGHT PANEL)       │
│             │                                  │ Market Comments :                                      │
│             │                                  │ 🔔 timestamp / Short Comment / Call Action             │
│             │                                  │ 🔔 timestamp / Short Comment / Call Action             │
│             │                                  │                                                        │
│             │                                  │ Market Quality Metrics:                                │
│             │                                  │ Bar Coverage:     Excellent 92%                        │
│             │                                  │ Regression R²:    Fair 72%                             │
│             │                                  │ EDT Fitness:      Underfit 27%                         │
│             │                                  │ Baseline Symmetry: LOEDT Bias 32%                      │
└─────────────┴──────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 2. Reference Documents & Dependencies

This architectural framework derives its specifications from the following authoritative project assets:

1. **RAG Database Storage & Indexing Strategy:**
   - [`prisma/RAG-ARCHITECTURE-STORAGE-AND-RETRIEVAL-STRATEGY/INDEXING_STRATEGY.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/prisma/RAG-ARCHITECTURE-STORAGE-AND-RETRIEVAL-STRATEGY/INDEXING_STRATEGY.md)
   - [`prisma/RAG-ARCHITECTURE-STORAGE-AND-RETRIEVAL-STRATEGY/single-jsonb-column-approach.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/prisma/RAG-ARCHITECTURE-STORAGE-AND-RETRIEVAL-STRATEGY/single-jsonb-column-approach.md)
   - [`prisma/RAG-ARCHITECTURE-STORAGE-AND-RETRIEVAL-STRATEGY/DUAL-RAG-SYSTEM_ARCHITECTURE/RAG_PRODUCTION_MODULE_DECOMPOSITION.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/prisma/RAG-ARCHITECTURE-STORAGE-AND-RETRIEVAL-STRATEGY/DUAL-RAG-SYSTEM_ARCHITECTURE/RAG_PRODUCTION_MODULE_DECOMPOSITION.md)
2. **PostgreSQL Database Schemas & Railway Gateway:**
   - [`backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql`](file:///d:/SaaS%20Project/trading-alerts-saas-public/backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql)
   - [`railway-gateway/src/worker/market-data.processor.ts`](file:///d:/SaaS%20Project/trading-alerts-saas-public/railway-gateway/src/worker/market-data.processor.ts)
3. **Inventory & Completion References:**
   - [`docs/files-completion-list/files-inventory/part-23-files-completion-v2_29_data_pipeline_architecture.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-23-files-completion-v2_29_data_pipeline_architecture.md)
   - [`docs/files-completion-list/files-inventory/part-25-files-completion-railway-gateway.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-25-files-completion-railway-gateway.md)

---

## 3. High-Level Ingestion-to-UI Pipeline Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CONTABO VPS DATA PIPELINE                                 │
│                MT5 Indicator Exports ➔ Local SQLite ➔ Python Push Worker               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTPS POST (79-column payload)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                             RAILWAY INGESTION GATEWAY                                  │
│               NestJS Controller ➔ BullMQ Queue ➔ Idempotent Database Ingestion         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Database UPSERT (`market_data_v6`)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     POSTGRESQL DATABASE LAYER (`market_data_v6`)                       │
│                                                                                        │
│  ┌──────────────────────────────────────┐     ┌─────────────────────────────────────┐  │
│  │ Raw OHLCV + Numeric Indicator        │ ──► │ Automated JSON-B Conversion Trigger  │  │
│  │ Calculated Columns (Inputs)          │     │ (`trg_generate_market_comments`)    │  │
│  └──────────────────────────────────────┘     └──────────────────┬──────────────────┘  │
│                                                                  │                     │
│                                                                  ▼                     │
│                                               ┌─────────────────────────────────────┐  │
│                                               │ `comments` JSON-B Column            │  │
│                                               │ Array of structured narrative items │  │
│                                               └──────────────────┬──────────────────┘  │
└──────────────────────────────────────────────────────────────────┼─────────────────────┘
                                                                   │
                                                                   ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                          REAL-TIME EVENT BROKER & SOCKET GATEWAY                       │
│        PostgreSQL NOTIFY / Redis Pub-Sub ➔ Socket.IO Gateway (`Operation-Service`)      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ WebSocket Event (`market_comments_stream`)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND CHART ANALYSIS DASHBOARD (RIGHT PANEL)                  │
│                                                                                        │
│  ┌──────────────────────────────────────────┐  ┌────────────────────────────────────┐  │
│  │ Market Comments Feed (Top Half)          │  │ Market Quality Metrics (Bottom Half)│  │
│  │ Renders JSON-B items:                    │  │ Quantitative Readouts:             │  │
│  │ [Alert Icon | Timestamp | Comment | Action]│  │ Bar Coverage, R², EDT Fitness, Bias│  │
│  └──────────────────────────────────────────┘  └────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Architectural Layer Specifications

### 4.1 Layer A — PostgreSQL Database Narrative Engine (PL/pgSQL Trigger)

- **Concept:** Every row in PostgreSQL `market_data_v6` is self-describing.
- **Conversion Trigger (`trg_generate_market_comments`):** An automated `BEFORE INSERT OR UPDATE` trigger function.
- **Operation:** As raw OHLC and numeric indicator columns are upserted into `market_data_v6`, the trigger evaluates threshold conditions and automatically generates a structured JSON-B array in the `comments` column:
  ```json
  [
    {
      "icon_type": "ALERT_RESISTANCE",
      "timestamp": 1770000000,
      "short_comment": "Structure commentary text",
      "call_action": "Suggested tactical action"
    }
  ]
  ```

### 4.2 Layer B — Two-Stage High-Performance Indexing Strategy

To guarantee sub-25ms query speeds even across millions of rows, Stack E uses a **Two-Stage Index Architecture**:

1. **Stage 1 (Composite B-Tree Index):** Rapidly narrows down the table by symbol, timeframe, and timestamp:
   ```sql
   CREATE INDEX idx_market_data_sym_tf_time
     ON market_data_v6 (symbol, timeframe, timestamp DESC);
   ```
2. **Stage 2 (GIN Index on JSON-B):** Fast JSON-B searching across the narrative payload:
   ```sql
   CREATE INDEX idx_market_data_comments
     ON market_data_v6 USING GIN (comments);
   ```

### 4.3 Layer C — Real-Time Event Broker & Socket Gateway

- **DB Event Trigger:** On successful row write, PostgreSQL emits a `LISTEN/NOTIFY` event or publishes to Redis Pub/Sub (`market_comments_channel`).
- **Socket.IO Gateway (`Operation-Service`):** Receives the published JSON-B comment payload and dispatches a WebSocket event (`market_comments_stream`) to all connected Next.js client browsers listening to `XAUUSD M5` or `XAUUSD M15`.

### 4.4 Layer D — Right-Panel UI Component Framework

- **Top Section — Market Comments Feed:**
  - Connects to the WebSocket comment stream.
  - Renders a scrollable feed of comment cards matching your mockup layout:  
    `[Alert Icon / timestamp / Short Comment / Call Action]`
- **Bottom Section — Market Quality Metrics Panel:**
  - Displays 4 quantitative statistical readouts directly calculated from dataset metadata:
    1. **Bar Coverage:** Data completeness percentage (e.g. `Excellent 92%`).
    2. **Regression $R^2$:** Goodness-of-fit metric (e.g. `Fair 72%`).
    3. **EDT Fitness:** Channel tightness score (e.g. `Underfit 27%`).
    4. **Baseline Symmetry:** Structural bias indicator (e.g. `LOEDT Bias 32%`).

---

## 5. Master Roadmap Extension (Parts 31–33 for Stack E)

Stack E implementation is structured into 3 discrete parts following Part 30:

| Part #      | Title                                                      | Core Architectural Deliverables                                                                                                               |
| ----------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Part 31** | **Stack E: PostgreSQL JSON-B Narrative Conversion Engine** | PL/pgSQL database trigger framework (`trg_generate_market_comments`), `comments` JSON-B column schema, and Stage 1 + Stage 2 GIN index setup. |
| **Part 32** | **Stack E: Real-Time Market Comment Pub/Sub Gateway**      | PostgreSQL `NOTIFY` / Redis Pub/Sub integration and `Operation-Service` NestJS Socket.IO gateway (`market_comments.gateway.ts`).              |
| **Part 33** | **Stack E: Market Comments Feed & Quality Metrics UI**     | Next.js Panel 3 UI components: `MarketCommentsFeed.tsx` (Alert Icon, Timestamp, Comment, Call Action) and `QualityMetricsPanel.tsx`.          |

---

## 6. Verification & Evaluation Criteria for Claude Code

When Claude Code evaluates and executes Stack E, it must verify:

1. **Trigger Automated Execution:** Confirmed that inserting or updating a row in PostgreSQL `market_data_v6` automatically populates the `comments` JSON-B column without needing application-level code.
2. **JSON-B Schema Integrity:** Confirmed that every generated JSON-B array element contains valid `icon_type`, `timestamp`, `short_comment`, and `call_action` nodes.
3. **WebSocket Sub-Second Stream:** Confirmed that DB writes trigger instant WebSocket emissions to the client browser.
4. **UI Panel Compliance:** Confirmed that Panel 3 on the right-hand side correctly renders the scrollable comment feed and the 4 statistical quality readouts matching the mockup screen.

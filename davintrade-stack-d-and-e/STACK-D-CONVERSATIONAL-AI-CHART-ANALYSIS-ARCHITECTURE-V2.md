# Stack D — Conversational AI for Chart Analysis Architecture Framework (V2)

**Document Version:** 2.4.0  
**Status:** Authoritative Master Architecture Blueprint for Claude Code / Claude Cowork Migration Planning  
**Target Scope (Phase 1):** `XAUUSD` on `M5` and `M15` timeframes only  
**Execution Target:** Claude Code (Phase 12 / Sessions 12-0 → 12-5 Implementation)  
**Date:** 2026-08-29

---

## 📌 1. Executive Summary & V1 ➔ V2 Evolution

Stack D establishes the **Multimodal Conversational AI Analyst Co-Pilot** for the DavinTrade Chart Analysis Interface. It provides real-time, quantitative trade recommendations, market structure breakdown, risk-bounded execution mathematics, and interactive advisory services directly alongside live candlestick charts.

### 🔄 Summary of Core Upgrades from V1.1.0 to V2.1.0:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    STACK D EVOLUTION MATRIX (V1 ➔ V2)                                  │
├─────────────────────┬──────────────────────────────────────────┬───────────────────────────────────────┤
│ Architectural Area  │ Version 1.1.0 (Original Baseline)        │ Version 2.1.0 (Master Upgraded)       │
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Retrieval Model** │ 4-Pillar Quad-Retrieval                  │ **7-Pillar Supercharged Multimodal**  │
│                     │ (SQL + txtai + Profile + PNG Image)      │ (+ MCD Counts, Storyline, WACS Score) │
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Database Engine** │ PostgreSQL `market_data_v6` (Cols 1–79)  │ **`market_data_v6` Extended (Cols 1–92│
│                     │ Raw numeric indicators only              │ + JSONB Storyline + WACS Weights)     │
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Vector Strategy** │ External `txtai` VectorDB concept        │ **Native PostgreSQL `pgvector`**      │
│                     │ (Unspecified schema & storage)           │ **HNSW Index (`vector(768)`)**        │
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Chat Persistence**│ Conceptual "1 Instrument = 1 Thread"     │ **PostgreSQL `chat_threads/messages`**│
│                     │ No schema or sliding window buffer       │ **+ Redis 20-msg Context Buffer (<2ms)│
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Vision Storage**  │ Unspecified Matplotlib PNG file handling │ **Cloudflare R2 Object Storage**      │
│                     │                                          │ **Zero Egress CDN + 48h Auto-Pruning**│
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Response Model**  │ Single unstructured text output + Card   │ **Structured Dual-Report Strategy**   │
│                     │                                          │ **(Report 1: Analysis + Report 2: Setup│
├─────────────────────┼──────────────────────────────────────────┼───────────────────────────────────────┤
│ **Legal Governance**│ Generic disclaimer only                  │ **Engine 4 Legal Compliance Gate**    │
│                     │                                          │ **(EU AI Act, CFTC 4.41, FCA, JFSA)** │
└─────────────────────┴──────────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 🏛️ 2. The 7-Pillar Supercharged Multimodal Retrieval Engine

To guarantee zero hallucinations, deterministic trade setups, and sub-150ms retrieval latency, Stack D coordinates **7 discrete data pillars** in parallel (`Promise.all`):

```
                       ┌────────────────────────────────────────────────────────┐
                       │               STACK D: CHAT UI FRONTEND                │
                       │   • Active Instrument: [XAUUSD M5 / M15]               │
                       │   • Model Selector: Gemini 3.6 / DeepSeek V4 / Claude  │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │       ENGINE 4 PRE-SESSION CONFIRMATION GATE (LOCKED)   │
                       │   Validates 9 User Constraints & Preferences Profile   │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │   PARALLEL 7-PILLAR RETRIEVAL PIPELINE (`Promise.all`)  │
                       │                                                        │
                       │ ┌────────────────────────────────────────────────────┐ │
                       │ │ 1. NUMERIC CANDLE DATA (VANNA NL2SQL - Cols 1-79)  │ │
                       │ │ 2. MCD OCCURRENCE DENSITY (Last N Bars - Cols 80-89│ │
                       │ │ 3. DEDUPLICATED STORYLINE TIMELINE (Col 90 JSONB)  │ │
                       │ │ 4. QUANT DIRECTION & WACS SCORE (Col 92: -100..100)│ │
                       │ │ 5. STRATEGY RULES (PostgreSQL `pgvector` HNSW RAG) │ │
                       │ │ 6. VISION CHART PNG (Part 24 Matplotlib via R2)    │ │
                       │ │ 7. USER CONSTRAINTS PROFILE (Engine 4 via Redis)   │ │
                       │ └────────────────────────────────────────────────────┘ │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │             MULTIMODAL CONTEXT ASSEMBLY LAYER          │
                       │   Fuses Numbers + Storyline + WACS + Rules + Vision    │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │       MULTIMODAL LLM ROUTER (GEMINI 3.6 / CLAUDE 5)    │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │                   DUAL-REPORT OUTPUT                   │
                       │   • REPORT 1: Technical & Trade Setup Analysis         │
                       │   • REPORT 2: Trade Setup Report (Math Sizing & TPs)   │
                       │   • Interactive UI Card: `TradeSetupCard.tsx`          │
                       └────────────────────────────────────────────────────────┘
```

### Detailed Breakdown of the 7 Pillars:

1. **Pillar 1 — Numeric Indicator Data (Engine 1 / VANNA NL2SQL):**
   - Translates natural language into deterministic SQL querying Columns 1–79 of `market_data_v6` (OHLCV, SSA Regression, Centroid Slope, Upper/Lower EDT Bounds, ZigZag Extremes, Z-Scores).
2. **Pillar 2 — Signal Density & MCD Occurrence Counts (Engine 1.5A):**
   - Aggregates the frequency of Market Condition Descriptions (MCD1–MCD10) occurring within the platform-wide **Fixed 54-Bar Lookback Window** (`FREQ54_MCDxx`, Columns 90–99+ in `market_data_v6`).
3. **Pillar 3 — Context Storyline & Deduplicated Event Timeline (Engine 1.5B):**
   - Extracts chronological, state-deduplicated market events stored in `JSONB54` (Column 100) to provide historical narrative context over 54 bars without token bloat.
4. **Pillar 4 — Quant Direction & Weighted Adaptive Centroid Score - WACS (Engine 1.5C):**
   - Retrieves `WACS54` (Column 102), providing a decay-weighted multi-bar momentum and bias score across 54 bars from $-100$ (Extreme Bearish) to $+100$ (Extreme Bullish).
5. **Pillar 5 — Trading Knowledge & Strategy Rules (Engine 2 / `pgvector`):**
   - Queries vector embeddings of trading playbooks, entry triggers, and invalidation rules stored in PostgreSQL using cosine similarity.
6. **Pillar 6 — Computer Vision Chart PNG (Engine 3 / Part 24 Matplotlib):**
   - Fetches the latest 3-panel comparison chart image (`mtf_render_xauusd_{timeframe}.png`) from Cloudflare R2 / Local Buffer for visual pattern verification (wick rejections, channel touches, geometry).
7. **Pillar 7 — User Constraints & Preferences (Engine 4 Profile):**
   - Injects the user's active confirmed profile (Trader Type, Style, Risk %, Leverage, Target RRR, Equity Balance, Minimum SLD, Commission).

---

## 🗄️ 3. Complete Storage & Infrastructure Architecture

Stack D is engineered with a **lean, high-performance, tiered storage framework**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STACK D FULL-STACK STORAGE BLUEPRINT                      │
├─────────────────────┬──────────────────────────┬───────────────────────────────────────┤
│ Data Layer          │ Technology & Location    │ Schema / Role & Latency               │
├─────────────────────┼──────────────────────────┼───────────────────────────────────────┤
│ **1. Market Data**  │ **PostgreSQL** (Railway) │ `market_data_v6` (Cols 1–92, JSONB)   │
│                     │                          │ Latency: < 80ms (Indexed B-Tree + GIN)│
├─────────────────────┼──────────────────────────┼───────────────────────────────────────┤
│ **2. Vector RAG**   │ **pgvector** Extension   │ `strategy_knowledge_embeddings`       │
│                     │ (Railway PostgreSQL)     │ `vector(768)` with HNSW Cosine Index  │
│                     │                          │ Latency: < 15ms                       │
├─────────────────────┼──────────────────────────┼───────────────────────────────────────┤
│ **3. Chat History** │ **PostgreSQL** (Railway) │ `chat_threads` & `chat_messages`      │
│                     │                          │ Persistent message & card JSONB store │
├─────────────────────┼──────────────────────────┼───────────────────────────────────────┤
│ **4. Active Buffer**│ **Redis**                │ `davintrade:chat:buffer:{threadId}`   │
│                     │ (Railway / Contabo VPS)  │ Sliding 20-message window (TTL 48h)   │
│                     │                          │ Latency: < 2ms                        │
├─────────────────────┼──────────────────────────┼───────────────────────────────────────┤
│ **5. Vision Charts**│ **Cloudflare R2**        │ `s3://davintrade-renders/xauusd/`     │
│                     │ (+ Contabo SSD Local)    │ Zero Egress CDN + 48h Rolling Pruning │
│                     │                          │ Latency: < 15ms                       │
├─────────────────────┼──────────────────────────┼───────────────────────────────────────┤
│ **6. User Profile** │ **PostgreSQL + Redis**   │ `user_trade_preferences` + Redis Cache│
│                     │ (Engine 4 Subsystem)     │ Latency: < 2ms                        │
├─────────────────────┼──────────────────────────┼───────────────────────────────────────┤
│ **7. Legal Vault**  │ **AWS S3 Object Lock**   │ 7-Year WORM Compliance Retention      │
│                     │ (Glacier Deep Archive)   │ (Transcripts, Consents, Audit Proofs) │
└─────────────────────┴──────────────────────────┴───────────────────────────────────────┘
```

---

## 🐘 4. PostgreSQL Database Schemas & `pgvector` Specification

### 4.1 Enable `pgvector` Extension & Knowledge Embeddings Table:

```sql
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Strategy Rules & Trading Knowledge Vector Table
CREATE TABLE IF NOT EXISTS strategy_knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL, -- 'SSA_TREND' | 'EDT_CHANNEL' | 'ZIGZAG_STRUCTURE' | 'RISK_MANAGEMENT'
  rule_title VARCHAR(255) NOT NULL,
  rule_content TEXT NOT NULL,
  embedding vector(768) NOT NULL, -- Dimension matched to Google Gecko / text-embedding-004
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- HNSW Index for ultra-fast vector similarity search (<15ms)
CREATE INDEX IF NOT EXISTS idx_strategy_embedding_hnsw
ON strategy_knowledge_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### 4.2 Chat Threads & Messages Persistence Schema (Supporting Historical Sessions):

```sql
-- 3. Chat Threads Table (Supports Multiple Historical Sessions in Sidebar)
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  symbol VARCHAR(20) DEFAULT 'XAUUSD' NOT NULL,
  timeframe VARCHAR(10) DEFAULT 'M5' NOT NULL, -- 'M5' | 'M15'
  title VARCHAR(255) NOT NULL, -- e.g. "XAUUSD M5 Scalp Setup", "XAUUSD M15 EDT Retest"
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
  total_tokens_used INT DEFAULT 0 NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_chat_threads_user_last_msg ON chat_threads(user_id, last_message_at DESC);

-- 4. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  prompt_type VARCHAR(40) DEFAULT 'CUSTOM_TEXT' NOT NULL, -- 'CUSTOM_TEXT' | 'INSTANT_M5_INSPECT' | 'INSTANT_M15_INSPECT'
  trade_setup_card JSONB, -- Stores TradeSetupCard props if card was generated
  multimodal_meta JSONB, -- { model: "gemini-3.6-flash", tokens: 1420, image_analyzed: true, wacs_score: 42.5 }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id, created_at ASC);
```

---

## 🖥️ 5. Backend Architecture for Chat Sessions, History & Token Metering

To power the Left Sidebar **`SESSIONS` List**, the Center **`AI Chart Analyst` Window**, and the Bottom **`Monthly Token Quota` Meter** shown on the UI:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   BACKEND CHAT SESSIONS & TOKEN METERING WORKFLOW                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. SIDEBAR LISTING: `GET /api/ai/chat/sessions`                                        │
│    Queries `chat_threads` ordered by `last_message_at DESC`. Returns session IDs,      │
│    titles ("XAUUSD M5 Scalp Setup"), timestamps, and active flags.                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. LOAD SESSION MESSAGES: `GET /api/ai/chat/sessions/:id/messages`                     │
│    Reads past messages + TradeSetupCard JSONB payloads to render conversational thread.│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. AUTO-TITLE GENERATION WORKER (Background Task):                                     │
│    After the 1st user exchange, an LLM summarizer generates a concise 3–5 word title   │
│    (e.g., "XAUUSD M5 Scalp Setup") and updates `chat_threads.title`.                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. MONTHLY TOKEN QUOTA METERING ENGINE:                                                │
│    • Tracks monthly usage per user tier (Free: 50,000 / Pro: 500,000 tokens).          │
│    • Deducts prompt tokens, vision image tokens, and output tokens per message.        │
│    • Returns real-time quota state `{ used: 42500, limit: 500000, pct: 8.5 }` to      │
│      render the Progress Bar in the UI chat footer.                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Session Lifecycle REST API Contracts:

- `GET /api/ai/chat/sessions`: Lists all user sessions for the sidebar drawer.
- `POST /api/ai/chat/sessions`: Creates a new session thread.
- `GET /api/ai/chat/sessions/:id/messages`: Retrieves chronological message history.
- `PATCH /api/ai/chat/sessions/:id`: Renames or pins a session thread.
- `DELETE /api/ai/chat/sessions/:id`: Soft-deletes / archives a session thread.

---

## ⚡ 6. Instant Prompt Functions (1-Click Chart-to-Chat Triggers)

As designed on the UI, underneath **Window 1 (M5 Chart)** and **Window 2 (M15 Chart)**, there are 1-click action buttons:

- **Window 1 Button:** `[ 🐱 Ask AI about M5 Chart ]`
- **Window 2 Button:** `[ 🐱 Ask AI about M15 Chart ]`

```
[ User Clicks [ Ask AI about M5 Chart ] below Window 1 ]
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│ FAST-PATH DISPATCH (Zero Typing Required)                        │
│ • Injects Preset User Message into active session:               │
│   "What is the current M5 SSA trend & EDT channel situation      │
│    for XAUUSD?"                                                  │
│ • Flags `prompt_type = 'INSTANT_M5_INSPECT'`                     │
│ • Bypasses Ambiguity Clarification Gate (Intent is 100% focused) │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7-PILLAR RETRIEVAL & SSE STREAMING                               │
│ • Slices M5 SSA slope, EDT upper/lower bounds, and recent wicks  │
│ • Generates Real-Time Technical Assessment in AI Chat Panel:     │
│   - "M5 Structure: Double bottom wick rejection at lower EDT..." │
│   - "M15 SSA Slope: Bullish trend alignment with Z-score..."     │
│   - "Tactical Action: Favourable BUY LIMIT entry at $2,634.50..."│
└──────────────────────────────────────────────────────────────────┘
```

### 6.1 Deterministic Instant Prompt Templates:

1. **M5 Instant Trigger (`INSTANT_M5_INSPECT`):**
   - **Injected Prompt:** `"What is the current M5 SSA trend & EDT channel situation for XAUUSD?"`
   - **Focus Areas:** Immediate M5 SSA baseline slope, Upper/Lower EDT channel touches, Centroid regression $R^2$, and micro-structure wick rejections.
2. **M15 Instant Trigger (`INSTANT_M15_INSPECT`):**
   - **Injected Prompt:** `"What is the current M15 SSA trend & ZigZag structure situation for XAUUSD?"`
   - **Focus Areas:** Macro M15 trend direction, ZigZag swing highs/lows, multi-bar MCD pattern density, and higher-timeframe structural support/resistance.

---

### 6.2 Strict Scope Enforcement & Out-of-Scope Intent Interception (Asset & Timeframe Guardrails)

To guarantee high analytical precision, prevent LLM hallucinations on unsupported instruments, and maintain strict system boundaries, Stack D implements a **System Prompt Intent Guardrail** that intercepts out-of-scope inquiries:

#### A. Out-of-Scope Asset / Symbol Interception (Forex, Crypto, Stocks, Indices)

- **Trigger:** User queries symbols other than `XAUUSD` (e.g. `EURUSD`, `GBPUSD`, `BTCUSD`, `ETHUSD`, `AAPL`, `US30`, `NAS100`).
- **AI Interception Response:**
  > 💬 _"DavinTrade AI Co-Pilot is currently specialized and optimized exclusively for **XAUUSD (Gold)** on **M5 and M15** timeframes. Multi-asset coverage (Forex pairs, Crypto, and Equity Indices) is scheduled for future platform updates._  
  > _How can I assist you with current XAUUSD market structure, technical indicators, or trade setup reports?"_

#### B. Out-of-Scope Timeframe Interception (H1, H4, D1, W1, M1)

- **Trigger:** User requests analysis on timeframes other than `M5` or `M15` (e.g. _"Analyze H4 trend"_, _"Give me daily chart forecast"_).
- **AI Interception Response:**
  > 💬 _"DavinTrade's quantitative engines (EDT Bands, SSA Centroids, WACS Momentum, and MCD Sequence Density) operate specifically on **M15 (Macro Structure)** and **M5 (Micro Execution)** timeframes for Day Traders and Scalpers._  
  > _Analysis on higher/lower timeframes (such as H1, H4, or Daily) is not supported in this version. Would you like me to analyze the current **M15 Macro trend** or **M5 Micro entry setup** for XAUUSD?"_

---

### 6.3 Real-Time Entry Price Plausibility & Sanity Gate (±5.0% Validation Band)

When a user provides a custom entry price (either via modal input or conversational prompt), the system validates the price against the **live market price $P_{\text{live}}$** to prevent typos (e.g. `$254.50`, `$25.45`, `$25,450.00`) or unexecutable price entries:

$$\text{Plausibility Band} = [P_{\text{live}} \times 0.95 \quad \longleftrightarrow \quad P_{\text{live}} \times 1.05]$$

- **Validation Rule:** The custom entry price **MUST** fall within $\pm 5.0\%$ of $P_{\text{live}}$.
- **Violations:** If the entered price falls outside this range, the system blocks calculation and issues an immediate diagnostic alert:
  > ❌ _"Invalid Entry Price ($X USD): Current live XAUUSD price is $P_live USD. Your entry price must fall within the execution band [$P_min – $P_max USD] (±5.0%). Please check for typing errors and try again."_

---

## 🌐 7. OpenRouter Unified Gateway & Multi-Model Registry

To provide Pro Users with the flexibility to select their preferred AI model while maintaining high engineering simplicity, Stack D integrates with the **OpenRouter Unified API Gateway** (`https://openrouter.ai/api/v1`).

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        OPENROUTER UNIFIED GATEWAY PIPELINE                             │
├────────────────────────────┬────────────────────────────┬──────────────────────────────┤
│ 1. VARIOUS LLM PROVIDERS   │ 2. OPENROUTER UNIFIED API  │ 3. PRO USER MULTI-MODEL UI   │
│ • Google Gemini            │ • Single OpenAI-compatible │ • Model Dropdown in Header   │
│ • Anthropic Claude         │   Endpoint (`/chat/comp`)  │ • Dynamic Quota Metering     │
│ • OpenAI GPT               │ • Automatic Failover       │ • Instant Model Switching    │
│ • DeepSeek / Zhipu / Kimi  │ • High Concurrency         │                              │
├────────────────────────────┴────────────────────────────┴──────────────────────────────┤
│ 💰 FINANCIAL ARCHITECTURE: COST-PLUS MARKUP TOKEN QUOTA METERING                       │
│ • DavinTrade pays wholesale API token rates to OpenRouter                              │
│ • User's Monthly Token Quota (500,000 Units) is deducted on a Cost-Plus Markup basis  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 7.1 The 6 Multi-Model Registry & Cost-Plus Multiplier Matrix

The UI model selector dropdown in the `AI Chart Analyst` header features **6 specialized AI models**, mapped to their respective OpenRouter endpoints and Cost-Plus Quota Multipliers:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   AI MODEL REGISTRY & TOKEN MULTIPLIER MATRIX                                  │
├────┬──────────────────────────┬─────────────────────────────┬────────────────┬────────────┬────────────────────┤
│ #  │ Model Name on UI         │ OpenRouter Model Identifier │ Cost / Tier    │ Multiplier │ Effective Quota    │
├────┼──────────────────────────┼─────────────────────────────┼────────────────┼────────────┼────────────────────┤
│ 1  │ 🟢 **Gemini 3.6 Flash**  │ `google/gemini-3.6-flash`   │ Base / Fast    │ **1.0x**   │ ~1,500 Units / Msg │
│    │ *(Default)*              │                             │ (Wholesale)    │ *(Base)*   │ (300+ msgs/mo)     │
├────┼──────────────────────────┼─────────────────────────────┼────────────────┼────────────┼────────────────────┤
│ 2  │ 🟢 **DeepSeek V4 Flash** │ `deepseek/deepseek-v4-flash`│ Base / Fast    │ **1.0x**   │ ~1,500 Units / Msg │
│    │ *(High-Math Quant)*      │                             │ (Wholesale)    │ *(Base)*   │ (300+ msgs/mo)     │
├────┼──────────────────────────┼─────────────────────────────┼────────────────┼────────────┼────────────────────┤
│ 3  │ 🟡 **GLM-5.2**           │ `zhipu/glm-5.2`             │ Mid-Tier       │ **2.5x**   │ ~3,750 Units / Msg │
│    │ *(Zhipu AI Multilingual)*│                             │                │            │ (130+ msgs/mo)     │
├────┼──────────────────────────┼─────────────────────────────┼────────────────┼────────────┼────────────────────┤
│ 4  │ 🟡 **Kimi K3**           │ `moonshot/kimi-k3`          │ Mid-Tier       │ **3.0x**   │ ~4,500 Units / Msg │
│    │ *(Pattern Memorization)* │                             │                │            │ (110+ msgs/mo)     │
├────┼──────────────────────────┼─────────────────────────────┼────────────────┼────────────┼────────────────────┤
│ 5  │ 🔴 **GPT 5.6 Terra**     │ `openai/gpt-5.6-terra`      │ Premium        │ **8.0x**   │ ~12,000 Units / Msg│
│    │ *(Broad Macro Synthesis)*│                             │                │            │ (40+ msgs/mo)      │
├────┼──────────────────────────┼─────────────────────────────┼────────────────┼────────────┼────────────────────┤
│ 6  │ 🔴 **Claude Sonnet 5**   │ `anthropic/claude-sonnet-5` │ Institutional  │ **10.0x**  │ ~15,000 Units / Msg│
│    │ *(Deep Strategy Logic)*  │                             │                │            │ (30+ msgs/mo)      │
└────┴──────────────────────────┴─────────────────────────────┴────────────────┴────────────┴────────────────────┘
```

> [!TIP]
> **Dynamic Configuration Invariant (`config/ai-models.ts`):**  
> All model identifiers, display names, and markup multipliers are defined in a centralized configuration file. When deploying in production, the `OpenRouter Model Identifier` field in `config/ai-models.ts` simply routes to the active model endpoint slug of that provider. As new foundation models are released or deprecated over time, administrators can update the registry and adjust markup rates dynamically without altering core chat orchestration logic.

---

### 7.2 The Cost-Plus Quota Deduction Formula:

$$\text{Deducted Quota Units} = \Big(\text{Prompt Tokens} + \text{Vision Image Tokens} + \text{Output Tokens}\Big) \times \text{Model Multiplier}$$

- **Real-time UI Sync:** Upon completion of each SSE stream chunk, the backend calculates the exact deducted units, subtracts them from the user's monthly quota balance in Redis/PostgreSQL, and broadcasts the updated percentage to the **`Monthly Token Quota (42,500 / 500,000)`** progress bar.

---

### 7.3 OpenRouter Streaming Gateway Implementation:

```typescript
// services/ai/openrouter-gateway.ts
export async function streamOpenRouterAnalysis({
  modelId, // e.g. "anthropic/claude-3.5-sonnet"
  multimodalPrompt, // Text Prompt + 3-Panel PNG Base64 / Cloudflare R2 URL
  userQuota, // Current User Quota State
  multiplier = 1.0, // Model Multiplier Weight
}): Promise<ReadableStream> {
  // 1. Validate quota availability
  if (userQuota.remaining <= 0) {
    throw new Error('MONTHLY_TOKEN_QUOTA_EXCEEDED');
  }

  // 2. Dispatch to OpenRouter Unified Endpoint
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://davintrade.com',
        'X-Title': 'DavinTrade AI Analyst',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: multimodalPrompt,
        stream: true,
        temperature: 0.1, // Deterministic technical outputs
      }),
    }
  );

  return response.body;
}
```

---

## 📊 8. The Dual-Report Response Strategy

Whenever the AI Co-Pilot generates a complete market assessment and setup recommendation, it structures its response into **2 synchronized reports**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              THE DUAL-REPORT ARCHITECTURE                              │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 📄 REPORT 1: CHART TECHNICAL AND TRADE SETUP ANALYSIS REPORT                           │
│ • Executive Summary & Market Regime (WACS Score & Momentum Bias)                       │
│ • Multi-Timeframe Structure Alignment (M15 Macro vs M5 Micro)                          │
│ • EDT Channel Geometry, SSA Slope & Dynamic Support/Resistance                          │
│ • Multi-Bar MCD Pattern Sequence Analysis (Density in Lookback N Bars)                 │
│ • High-Impact Economic News Warnings & Market Risk Factors                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🎯 REPORT 2: TRADE SETUP REPORT (MATHEMATICAL POSITION SIZING & PROFIT TARGETS)        │
│ • Generated via Post-Report Clarification / Display Interactive Modal (5 Inputs)       │
│ • Direction Confirmation (BUY / SELL) with Explicit Non-Coercive Decline Button        │
│ • Entry Price Selection (5 Dynamic Zone Levels + Custom Box + Decline Button)          │
│ • Verified Risk Per Trade % (Bounded by Max RPT%) & Max Capital at Risk ($ USD)        │
│ • Stop Loss Distance $ (Bounded by Min SLD$) & Exact Stop Loss Price ($ USD)           │
│ • ROUND DOWN Effective Lot Size (2 Decimal Places) & Leverage Utilization ($\le 1:5.0x$)│
│ • 3-Tier Profit-Taking Scenario Matrix:                                                │
│   - Conservative (Recommend ✔️ based on Market Alignment)                              │
│   - Normal (Standard Target RRR)                                                       │
│   - Aggressive (Strong Momentum + Substantial Runway Remaining)                        │
│ • Commission-Adjusted Effective RRR & Realisable Net Profit ($ USD)                    │
│ • Post-Report Review & User Sanity / Consent Verification Gate (`[ ✓ Accept ]`,         │
│   `[ 🔄 Modify / Recalculate ]`, `[ ❌ Decline / Discard ]`)                           │
│ • Statutory Micro-Disclaimer (EU MiFID II, US CFTC 4.41, UK FCA, Japan JFSA)          │
│ • ⚠️ Standalone Single-Trade Scope Notice (No Portfolio-Level Multi-Position Aggregate)│
│                                                                                        │
│ 👉 Authoritative Spec: `STACK-D-WORKFLOW-AND-WORK-PROCESS-IN-CREATING-TRADE-SETUP-REPORT.md`│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ☁️ 9. Cloudflare R2 Vision Chart PNG Pipeline (Engine 3)

1. **Generation (Contabo VPS Worker):**
   - Python Matplotlib script (`mtf_render/renderer.py`) generates a 3-panel comparison chart image on every candle close (M5 every 5m, M15 every 15m).
   - File path on VPS: `/app/storage/renders/mtf_render_xauusd_{timeframe}.png` (~300–500 KB).
2. **Cloudflare R2 Upload & CDN Caching:**
   - Script uploads the generated PNG to Cloudflare R2 bucket `davintrade-renders`.
   - Public CDN URL: `https://renders.davintrade.com/xauusd/mtf_render_xauusd_m5.png`.
   - Benefits: **Zero Egress Fees** and global edge caching (< 15ms image fetch for Gemini/Claude Vision APIs).
3. **Retention & Pruning Policy:**
   - Active charts are kept for **48 hours (Rolling Window)**.
   - Background cron job purges images older than 48 hours to conserve storage.

---

## 🔄 10. Parallel Quad/7-Pillar Retrieval Orchestrator Implementation

```typescript
// services/ai/retrieval-orchestrator.ts
export async function execute7PillarRetrieval(
  userId: string,
  userQuery: string,
  symbol: 'XAUUSD',
  timeframe: 'M5' | 'M15',
  promptType:
    | 'CUSTOM_TEXT'
    | 'INSTANT_M5_INSPECT'
    | 'INSTANT_M15_INSPECT' = 'CUSTOM_TEXT'
): Promise<MultimodalContextPayload> {
  // 1. Fetch User Confirmed Constraints from Redis/PostgreSQL (Engine 4)
  const userPreferences = await getUserTradePreferences(userId);
  const LOOKBACK_BARS = 54; // Platform-Wide Fixed 54-Bar Standard

  // 2. Dispatch Parallel Retrieval across all pillars (< 120ms total)
  const [
    numericData, // Pillar 1: VANNA NL2SQL (Cols 1–79)
    mcdDensity, // Pillar 2: MCD Occurrence Counts (FREQ54_MCDxx)
    storylineNarrative, // Pillar 3: Deduplicated Timeline (JSONB54)
    wacsScore, // Pillar 4: WACS Direction Score (WACS54)
    strategyKnowledge, // Pillar 5: pgvector HNSW Strategy Rules
    chartPngBuffer, // Pillar 6: Cloudflare R2 3-Panel Vision PNG
    recentChatBuffer, // Recent 10-message Sliding Window from Redis
  ] = await Promise.all([
    vannaEngine.queryNumericDataFrame(symbol, timeframe, LOOKBACK_BARS),
    mcdCounter.getMcdDensity(symbol, timeframe, LOOKBACK_BARS),
    storylineEngine.getStoryline(symbol, timeframe, LOOKBACK_BARS),
    wacsEngine.getLatestWacs(symbol, timeframe),
    pgvectorStore.searchKnowledge(userQuery, { limit: 3 }),
    r2Storage.getLatestChartPng(symbol, timeframe),
    redisChatBuffer.getRecentMessages(userId, symbol, timeframe, 10),
  ]);

  // 3. Assemble Multimodal Prompt Context
  return assembleMultimodalPayload({
    userPreferences,
    numericData,
    mcdDensity,
    storylineNarrative,
    wacsScore,
    strategyKnowledge,
    chartPngBuffer,
    recentChatBuffer,
    promptType,
  });
}
```

---

## 🗺️ 11. Master Roadmap Extension for Stack D (Phase 12: Sessions 12-0 → 12-5)

Stack D implementation is structured into 6 focused execution sessions:

| Session #        | Title                                          | Core Architectural Deliverables                                                                                                                                                                             |
| :--------------- | :--------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session 12-0** | **Database & Vector Setup**                    | Enable `pgvector`, migrate `strategy_knowledge_embeddings`, `chat_threads`, `chat_messages`, and `market_data_v6` extended schema (Cols 1–92).                                                              |
| **Session 12-1** | **Engine 4 Subsystem & Gate**                  | Implement 9 User Constraints, Pre-Chat Summary Card, Confirmation Loop, and PostgreSQL/Redis sync.                                                                                                          |
| **Session 12-2** | **7-Pillar Retrieval Orchestrator**            | Build `execute7PillarRetrieval()` with VANNA NL2SQL, MCD Density, Storyline JSONB, WACS, `pgvector`, and Cloudflare R2 PNG loader.                                                                          |
| **Session 12-3** | **OpenRouter Gateway & Multi-Model Router**    | Connect OpenRouter Unified API, configure 6 Models Registry (`Gemini 3.6`, `Claude Sonnet 5`, `GPT 5.6`, `GLM-5.2`, `Kimi K3`, `DeepSeek V4`), Cost-Plus Markup multipliers, and Dual-Report Prompt Engine. |
| **Session 12-4** | **Chat UI, Sessions Drawer & Instant Prompts** | Build `AIAnalystPanel.tsx`, `SESSIONS` Sidebar drawer CRUD, Token Quota meter, and `Ask AI about M5/M15` 1-click trigger handlers.                                                                          |
| **Session 12-5** | **Dynamic Cards & SSE Stream**                 | Implement `/api/ai/chat/stream` SSE streaming, `TradeSetupCard.tsx`, multi-TP exit visualization, and Token Cost Surveillance.                                                                              |

---

## 📋 12. Verification & Acceptance Criteria for Claude Code

When Claude Code executes Stack D, it must verify:

1. **7-Pillar Completeness:** Verified that all 7 data sources are queried in parallel via `Promise.all` and injected into the LLM context.
2. **`pgvector` Performance:** Verified that `strategy_knowledge_embeddings` HNSW cosine search executes in $< 15\text{ms}$.
3. **Session Drawer CRUD:** Verified that the left sidebar lists historical chat sessions and allows switching between sessions without losing state.
4. **Instant Prompt Triggers:** Verified that clicking `Ask AI about M5 Chart` and `Ask AI about M15 Chart` dispatches deterministic prompts and streams instant analysis.
5. **OpenRouter Multi-Model Switching:** Verified that switching between the 6 models in the dropdown executes properly via OpenRouter API.
6. **Cost-Plus Token Quota Metering:** Confirmed that token consumption applies model multipliers and updates the footer progress bar (`Monthly Token Quota 42,500 / 500,000`).
7. **Vision Integration:** Confirmed that Gemini / Claude / GPT receives the high-resolution 3-panel PNG from Cloudflare R2 alongside numeric data.
8. **Dual-Report Output:** Verified that AI produces Report 1 (Market Analysis) and Report 2 (Mathematical Sizing with 3-Tier TPs).
9. **Legal Compliance:** Confirmed that the Engine 4 Confirmation Gate and statutory micro-disclaimers are rendered on all cards.

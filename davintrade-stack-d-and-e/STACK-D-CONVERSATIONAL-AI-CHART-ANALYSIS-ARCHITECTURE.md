# Stack D — Conversational AI for Chart Analysis Architecture Framework

**Document Version:** 1.1.0  
**Status:** Authoritative Multimodal Architectural Framework for Claude Code Execution  
**Target Scope (Phase 1):** `XAUUSD` on `M5` and `M15` timeframes only  
**Date:** 2026-08-05

---

## 1. Executive Summary & Purpose

Stack D establishes the **Multimodal Conversational AI Analyst** co-pilot for the DavinTrade Chart Analysis Interface. It provides real-time, quantitative trade recommendations, market structure breakdown, and interactive advisory services directly alongside live candlestick charts.

To ensure zero financial data hallucinations, sub-500ms response times, and bulletproof analysis quality, Stack D is architected around a **Multimodal Quad-Retrieval Hybrid Engine** combining:

1. **VANNA NL2SQL** (natural language to numeric database queries on PostgreSQL `market_data_v6`).
2. **`txtai` VectorDB** (trading knowledge & strategy rule retrieval).
3. **Engine 1 Part 24 Matplotlib Renderer** (high-resolution 3-panel comparison PNG chart images).
4. **Gemini 3.6 / Claude 3.5 Multimodal LLM API** (fusing numbers, strategy rules, and computer vision chart image inputs).

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ DavinTrade  │ 🏷️ XAUUSD M5  Gemini 3.6 Flash ▼ │  XAUUSD M5 SSA & EDT Chart    M15 ZigZag Chart          │
├─────────────┼──────────────────────────────────┼────────────────────────────────────────────────────────┤
│ SIDEBAR     │ STACK D: MULTIMODAL AI ANALYST   │ MIDDLE: DUAL TRADINGVIEW LIGHTWEIGHT CHARTS            │
│             │ PANEL (LEFT)                     │                                                        │
│ 🏷️ XAUUSD M5│                                  │ 📈 Window 1: XAUUSD M5                                 │
│   10m ago   │ 🤖 DAVINTRADE AI                 │    • Candles + SSA Line + Upper/Lower EDT Lines       │
│             │ Hello! I'm analyzing **XAUUSD**  │                                                        │
│ 🏷️ XAUUSD M15│ on the **M5** timeframe. Market  │ 📈 Window 2: XAUUSD M15                                │
│   17m ago   │ structure appears bullish...     │    • Candles + ZigZag Polyline + Centroid Polygons     │
│             │ [Analyzed Numbers + PNG Image]   ├────────────────────────────────────────────────────────┤
│             │                                  │ STACK E: MARKET COMMENTS & METRICS (RIGHT)             │
│             │ 🟢 TRADE SETUP CARD              │ 🔔 Alert: Touched Lower EDT ($2,434.50)                │
│             │ • Signal: BUY LIMIT @ $2,434.50  │ 📊 Regression R²: Fair 72%                             │
│             │ • TP: $2,448.00  |  SL: $2,427.00│ 📊 EDT Fitness: 27%  |  Symmetry: LOEDT Bias 32%     │
│             │ • Risk/Reward Ratio: 1 : 3.2     │                                                        │
│             │                                  │                                                        │
│             │ 💬 Ask Gemini...                │                                                        │
└─────────────┴──────────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 2. Reference Documents & Dependencies

This architectural framework derives its specifications from the following authoritative project assets:

1. **Part 24 Engine 1 Matplotlib Renderer:**
   - [`docs/files-completion-list/files-inventory/part-24-files-completion-v2_29_multi-timeframe-visualisation.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-24-files-completion-v2_29_multi-timeframe-visualisation.md)
   - [`backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/mtf_render/renderer.py`](file:///d:/SaaS%20Project/trading-alerts-saas-public/backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/mtf_render/renderer.py)
2. **VANNA Dual-RAG Architecture & Decomposition:**
   - [`seed-code/vanna/DUAL-RAG-SYSTEM_ARCHITECTURE/DUAL-RAG-SYSTEM-ARCHITECTURE.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/vanna/DUAL-RAG-SYSTEM_ARCHITECTURE/DUAL-RAG-SYSTEM-ARCHITECTURE.md)
   - [`seed-code/vanna/DUAL-RAG-SYSTEM_ARCHITECTURE/RAG_ARCHITECTURE_STORAGE_AND_RETRIEVAL_STRATEGY_V3.3.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/vanna/DUAL-RAG-SYSTEM_ARCHITECTURE/RAG_ARCHITECTURE_STORAGE_AND_RETRIEVAL_STRATEGY_V3.3.md)
   - [`seed-code/vanna/DUAL-RAG-SYSTEM_ARCHITECTURE/RAG_PRODUCTION_MODULE_DECOMPOSITION.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/vanna/DUAL-RAG-SYSTEM_ARCHITECTURE/RAG_PRODUCTION_MODULE_DECOMPOSITION.md)
3. **Chat UI & Thread Management:**
   - [`seed-code/txtai/CHAT-UI-MANAGEMENT/Trading_Instrument_Chat_Management_Architecture.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/txtai/CHAT-UI-MANAGEMENT/Trading_Instrument_Chat_Management_Architecture.md)
   - [`seed-code/txtai/DYNAMIC-CHART-AND-CARD-DISPLAY/`](file:///d:/SaaS%20Project/trading-alerts-saas-public/seed-code/txtai/DYNAMIC-CHART-AND-CARD-DISPLAY/)
4. **Data Pipeline & Upstream Repositories:**
   - [`docs/files-completion-list/files-inventory/part-23-files-completion-v2_29_data_pipeline_architecture.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-23-files-completion-v2_29_data_pipeline_architecture.md)
   - [`docs/files-completion-list/files-inventory/part-25-files-completion-railway-gateway.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-25-files-completion-railway-gateway.md)

---

## 3. Multimodal Architectural Pipeline

```
                       ┌────────────────────────────────────────────────────────┐
                       │               STACK D: CHAT UI FRONTEND                │
                       │   • Active Instrument Badge: [XAUUSD M5 / M15]         │
                       │   • Model Selector: Gemini 3.6 Flash / Pro / Claude   │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │          QUERY ORCHESTRATION & CLARIFICATION GATE       │
                       │   5-Stage Ambiguity Gate: Defaults to Active Chart     │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │        PARALLEL QUAD-RETRIEVAL ENGINE (`Promise.all`)   │
                       │                                                        │
                       │ ┌────────────────┐ ┌────────────────┐ ┌──────────────┐ │
                       │ │ Engine 1: VANNA│ │ Engine 2:      │ │ Engine 3:    │ │
                       │ │ (NL2SQL Engine)│ │ txtai VectorDB │ │ Part 24 PNG  │ │
                       │ │ 79-col numeric │ │ Strategy rules │ │ 3-Panel Visual│ │
                       │ │ DataFrame      │ │ & risk bounds  │ │ Chart Image  │ │
                       │ └───────┬────────┘ └───────┬────────┘ └──────┬───────┘ │
                       └─────────┼──────────────────┼─────────────────┼─────────┘
                                 │                  │                 │
                                 └──────────────────┼─────────────────┘
                                                    │
                                                    ▼
                       ┌────────────────────────────────────────────────────────┐
                       │             MULTIMODAL CONTEXT ASSEMBLY LAYER          │
                       │   Fuses: 1. Numeric DataFrame + 2. Strategy Rules +    │
                       │          3. Computer Vision PNG Chart Image            │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │           MULTIMODAL LLM ROUTER (VISION-ENABLED)       │
                       │   Gemini 3.6 Flash / Pro / Claude 3.5 Sonnet (Vision) │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │            STREAMING RESPONSE & DYNAMIC CARDS          │
                       │   Outputs SSE Text Stream + TradeSetupCard JSON        │
                       └────────────────────────────────────────────────────────┘
```

---

## 4. Architectural Layer Specifications

### 4.1 Engine #1 — VANNA NL2SQL (Quantitative Numeric Data Engine)

- **Purpose:** Translates user questions (_"Where is current support on M5?"_) into deterministic SQL queries against PostgreSQL `market_data_v6`.
- **Phase 1 Scoping:** All SQL queries generated by VANNA are strictly constrained to `symbol = 'XAUUSD'` and `timeframe IN ('M5', 'M15')`.

### 4.2 Engine #2 — TRADING RAG / `txtai` (Domain Knowledge Engine)

- **Purpose:** Retrieves interpretation guidelines for SSA trend lines, EDT channels, ZigZag market structure, and Z-score candle patterns.

### 4.3 Engine #3 — Part 24 Matplotlib Renderer (`mtf_render` Computer Vision Image Engine)

- **Purpose:** Passes the pre-rendered Part 24 **3-Panel Comparison PNG Chart Image** (`mtf_render_xauusd.png`) directly into the Multimodal LLM prompt.
- **Multimodal Visual Analysis:** Enables Gemini 3.6 Flash/Pro & Claude 3.5 Sonnet to perform **Computer Vision analysis** on the actual visual chart image in parallel with inspecting the numeric database DataFrame—verifying wick rejections, visual channel angles, and pattern geometry.

### 4.4 Parallel Quad-Retrieval Engine (`Promise.all`)

- **Execution Pattern:** Dispatches SQL numeric retrieval, vector knowledge search, user profile retrieval, and Part 24 PNG image fetching simultaneously to achieve sub-100ms pipeline latency:
  ```typescript
  const [sqlData, tradingKnowledge, userProfile, chartImagePng] =
    await Promise.all([
      vannaEngine.queryToDataFrame(userQuery), // 1. Quantitative Numbers (~80ms)
      txtaiVectorStore.searchKnowledge(userQuery), // 2. Strategy Rules (~35ms)
      userProfileRepo.getJsonbProfile(userId), // 3. User JSONB Profile (~10ms)
      mtfRenderEngine.getLatestChartPng('XAUUSD', 'M5'), // 4. Part 24 3-Panel Visual PNG (~15ms)
    ]);
  ```

### 4.5 Chat Management Architecture: "1 Instrument = 1 Chat Thread"

- **Thread Boundary Rule:** Each instrument (`XAUUSD M5` or `XAUUSD M15`) maintains **at most 1 active chat thread** per user.
- **Badge System:** Permanent, non-editable pill badge (`XAUUSD M5`) rendered in the sidebar entry and panel header.
- **Automated Routing:** Incoming price alerts for `XAUUSD M5` are appended directly into the active `XAUUSD M5` conversation thread.

### 4.6 LLM Router & Cost Surveillance

- **Model Router:**
  - `Gemini 3.6 Flash (Vision)`: Low-latency, sub-second default multimodal model for FREE and PRO users.
  - `Gemini 3.6 Pro / Claude 3.5 Sonnet (Vision)`: High-reasoning multimodal model available for PRO users for complex strategy generation.
- **Cost Logging:** Every interaction logs input tokens, image tokens, output tokens, and USD cost to PostgreSQL `token_usage_log`.

---

## 5. Master Roadmap Extension (Parts 26–30 for Stack D)

Stack D implementation is structured into 5 discrete parts following Part 25:

| Part #      | Title                                                   | Core Architectural Deliverables                                                                                                                                         |
| ----------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Part 26** | **Stack D: Dual-RAG Vector & Schema Setup**             | PostgreSQL `market_data_v6` VANNA schema vectors, `txtai` trading knowledge vector initialization, and Part 24 PNG image artifact pipeline.                             |
| **Part 27** | **Stack D: VANNA NL2SQL & Quad-Retrieval Orchestrator** | VANNA Python engine, NL2SQL translation layer for `XAUUSD M5/M15`, `Promise.all` quad-retrieval (SQL + VectorDB + Profile + PNG Image), and 5-Stage Clarification Gate. |
| **Part 28** | **Stack D: Context Assembly & Multimodal LLM Router**   | Context fusion layer (Numbers + Rules + Vision PNG Image), Gemini 3.6 Flash/Pro / Claude 3.5 Sonnet Vision API router, and `token_usage_log` cost surveillance.         |
| **Part 29** | **Stack D: Instrument Chat Management & UI**            | Next.js Panel 1 Chat Interface (`AIAnalystPanel.tsx`), `1 Instrument = 1 Chat Thread` state machine, and permanent instrument badge rendering.                          |
| **Part 30** | **Stack D: Dynamic Action Cards & SSE Stream**          | Server-Sent Events (SSE) token streaming API (`/api/ai/chat/stream`), `TradeSetupCard.tsx`, and `MarketHealthCard.tsx` rendering.                                       |

---

## 6. Verification & Evaluation Criteria for Claude Code

When Claude Code evaluates and executes Stack D, it must verify:

1. **Query Scoping:** 100% of generated VANNA SQL queries enforce `symbol = 'XAUUSD'` and `timeframe IN ('M5', 'M15')`.
2. **Multimodal Payload Assembly:** Confirmed that Gemini 3.6 / Claude 3.5 receives **both** the quantitative DataFrame **and** Part 24's 3-panel visual PNG chart image.
3. **Parallel Latency:** `Promise.all` quad-retrieval completes in `< 150ms`.
4. **Thread State:** Verified that incoming price alerts append to the existing active instrument thread without duplicating sidebar entries.
5. **Card Rendering:** Trade setup cards properly render Entry, Target (TP), Stop Loss (SL), and Risk/Reward Ratio.

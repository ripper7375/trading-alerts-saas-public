> **SUPERSEDED on 30 September 2026.** The canonical Stack D architecture is
> [`docs/STACK-D-ARCHITECTURE.md`](../../docs/STACK-D-ARCHITECTURE.md), with every decision in
> [`docs/adr/`](../../docs/adr/README.md). This file is kept for history. Where it disagrees with the
> canonical document, the canonical document wins.

# Stack D & E: Master Conversational AI Architecture (Version 2.0.0)

**Applying Open Knowledge Format (OKF), Agentic Routing, and Progressive Disclosure to Algorithmic Trading Systems**

- **Document Code:** `STACK-D-OKF-CONVERSATIONAL-AI-ARCHITECTURE-V2.md`
- **System Layer:** Stack D (Conversational AI Analyst Backend) & Stack E (Workbench UI / Trading Copilot)
- **Target Financial Asset:** Strictly and Exclusively `XAUUSD (Gold)`
- **Target Analytical Timeframes:** `M5` (Micro Execution / Trigger) and `M15` (Macro Market Structure)
- **Data Foundation:** PostgreSQL `market_data_v6` (103 Core Contract Columns / 106 Prisma Fields, 15 MQL5 Indicator Suites, Dual-Table Point-in-Time Architecture with `market_data_point_in_time` [84 fields / 77 drifting columns] and `indicator_statistics` [87 columns / 12 sources], Platform-Wide Fixed 54-Bar Lookback Standard)
- **Major Architectural Decision:** **Engine 1.5C (Weighted Confluence Scoring — WACS54) is permanently retired and superseded by Engine 1.5E ("Tactical OKF Router").**
- **Document Status:** Authoritative Master Architecture Blueprint

---

## 1. Executive Summary & Evolutionary Paradigm Shift

### 1.1 The Challenge of Financial Conversational AI

Building a conversational AI agent for institutional and retail financial markets presents challenges fundamentally different from general-purpose chatbot systems. Financial market timeseries data is non-stationary, high-dimensional, and noisy.

Feeding raw quantitative timeseries data (103 technical columns across 54 bars = 5,562 floating-point variables per query) directly into a Large Language Model (LLM) induces three fatal failure modes:

1. **Severe Context Window Bloat:** Unfiltered telemetry consumes tens of thousands of tokens before reasoning begins.
2. **Mathematical Hallucination:** LLMs lack deterministic floating-point precision; they cannot reliably calculate whether a price is breaking an Empirical Distribution Trendline (EDT) or if an oscillator has reached an extreme threshold.
3. **Loss of Strategy Grounding:** Without strict domain constraints, LLMs conflate incompatible trading styles (e.g., advising a Scalper to hold through a 4-hour macro pullback or recommending counter-trend entries in a violent momentum breakout).

### 1.2 The Demise of Engine 1.5C (The Fallacy of Compensatory Averaging)

In earlier architectural iterations, the system attempted to solve trade qualification through **Engine 1.5C: Weighted Alert Confluence Scoring (WACS54)**. Engine 1.5C aggregated indicator outputs across 54 bars into a single linear composite score ranging from -100 to +100 using a time-decay weight formula:

$$w_i = \frac{55 - i}{1485}, \quad i \in [1, 54]$$

**Engine 1.5C has been formally deprecated and retired due to a fatal methodological flaw: The Fallacy of Compensatory Averaging.**

In live trading, different market regimes (trending, mean-reverting, consolidating, high-volatility breakout) are governed by mutually exclusive structural dynamics:

- **The Noise Compensation Problem:** If an EDT channel only spans 12 bars (statistically meaningless bar coverage of $15\%$), but happens to display a tight linear regression line ($R^2 = 0.98$), a composite weighted score averages these metrics together and awards a "Passing" grade ($\approx 65\%$). In live markets, a high $R^2$ cannot compensate for an insufficient sample size.
- **The Multi-Regime Pollution Problem:** Market Condition Descriptions (`MCD1` through `MCD15`) evaluate conflicting phenomena. For example, `MCD1` measures M15 Primary Trend Direction via Regression Channels, while another MCD might evaluate M5 Overbought Mean Reversion. Averaging these into a single numerical index flattens critical non-linear signals, obliterating the trader's edge.

### 1.3 The Solution: Engine 1.5E ("The Tactical OKF Router")

Rather than forcing all indicators into an arbitrary arithmetic score, the system adopts the **Open Knowledge Format (OKF)** paradigm of **Agentic Routing** and **Progressive Disclosure**:

```
[User Query + Current Market State]
               │
               ▼
┌────────────────────────────────────────────────────────┐
│     ENGINE 1.5E: THE TACTICAL OKF ROUTER               │
│     (The Stationmaster / Dispatcher Layer)             │
│     • Analyzes user inquiry intent                     │
│     • Inspects instantaneous regime flags              │
│     • Dynamically selects ONLY relevant MCDs           │
│       e.g., [MCD1, MCD2, MCD3]                         │
└────────────────────────────────────────────────────────┘
               │ (Scoped Dispatch)
               ▼
┌────────────────────────────────────────────────────────┐
│     SCOPED RETRIEVAL & QUANT SYNTHESIS                 │
│     • txtai retrieves deep logic ONLY for MCD1, 2, 3   │
│     • Live quantitative values injected via JSON       │
│     • LLM reasons over structured, zero-noise context  │
└────────────────────────────────────────────────────────┘
```

**Engine 1.5E acts as an intelligent stationmaster:**

1. It parses the user's intent (e.g., trend query, entry level, risk audit, volatility question).
2. It cross-references the live quantitative regime (from Engine 1.5A state discretization).
3. It deterministically selects _only_ the specific subset of MCD engines that apply to that exact market circumstance.
4. It isolates unrelated MCDs completely, reducing token consumption by up to 90% and eliminating contradictory analytical noise.

---

## 2. Open Knowledge Format (OKF) Applied to Quantitative Trading

The **Open Knowledge Format (OKF)**, an open standard developed for human-agent knowledge sharing, establishes that knowledge should be organized as a **living, modular graph of concept files** rather than a monolithic database or flat text dump.

### 2.1 The Two-Tier Knowledge Separation

DavinTrade Stack D enforces a clean architectural separation between **Routing Metadata** and **Deep Domain Knowledge**:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: THE TACTICAL ROUTER (`TRADING_ROUTER.md`)                      │
│ • Ultra-lean navigation matrix (< 5 KB, < 100 lines)                   │
│ • Fast, deterministic intent-to-MCD mapping                            │
│ • Loaded into the primary agent routing layer                          │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                    Selects target concept modules
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 2: DEEP DOMAIN KNOWLEDGE (Scoped txtai Vector Store & SQLite)     │
│ • Domain 1: MCD Foundations & Math (`domain-1-mcd-foundations/`)       │
│ • Domain 2: Standalone Trading Playbooks (`domain-2-single-mcd-.../`)  │
│ • Domain 3: Multi-MCD Synthesis & Confluence (`domain-3-multi-mcd.../`)│
│ • Domain 4: Institutional Risk Management (`domain-4-risk-management/`)│
│ • Domain 5: Trading Governance & Compliance (`domain-5-governance.../`)│
│ • Retrieved strictly on-demand via metadata-filtered vector search     │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Decoupling Static Strategy Logic from Dynamic Telemetry

A critical innovation of this architecture is the clean separation of **Rules** from **Numbers**:

| Layer                              | Representation         | Location / Mechanism                                    | Role in Context                                                                                              |
| ---------------------------------- | ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Static Strategy Logic**          | Plain Markdown (`.md`) | `knowledge-corpus/` (5 Authoritative Knowledge Domains) | Provides semantic meaning: mathematical derivations, breakout definitions, synthesis rules, risk governance. |
| **Dynamic Quantitative Telemetry** | Structured JSON        | `mcdX_output.json` & `JSONB54` (from PostgreSQL)        | Provides empirical reality: live prices, calculated slope, EDT bounds, $R^2$, Z-scores.                      |

When the Orchestrator composes the prompt, it merges both: the Markdown establishes the **logical reasoning framework**, while the JSON populates the **exact, unhallucinated prices and metrics**.

### 2.3 The Genesis of `TRADING_ROUTER.md`: From Decentralized JSONB Telemetry to an Institutional Dispatcher

To implement the **Call Center Dispatcher** paradigm (analogous to how `CLAUDE.md` coordinates specialized sub-departments in agentic systems), DavinTrade compiles `TRADING_ROUTER.md` (or `MCD_DISPATCHER.md`) directly from the decentralized outputs of all MCD modules.

#### 1. The Call Center Metaphor: Ending the Centralized Bureaucracy

In legacy architectures, prompt systems functioned like an inefficient, monolithic government bureaucracy:

- A user calls the central agency (submits a query).
- The central agency attempts to process the query with flat, massive documents (5,000+ pages of unstructured indicators, formulas, and rules).
- The system is overwhelmed with context bloat, leading to slow response times, extreme token waste, hallucinated numbers, and departments passing work back and forth without resolution.

Under the OKF Call Center model:

- **`TRADING_ROUTER.md` is the Internal Switchboard Directory:** It does _not_ contain the deep technical handbooks of each department. Instead, it contains an ultra-lean (< 5 KB), high-density routing index of every department's direct phone extension, specializations, trigger phrases, and operational scope.
- **The Operator (Engine 1.5E):** Listens to the incoming caller (User Prompt) and inspects the live office status (Active Market Telemetry), then immediately connects the call to the 2 or 3 exact specialist departments (Target MCDs) qualified to handle that specific situation.

#### 2. Telemetry Extraction: Fueling the Router with JSONB Canonical Comments

`TRADING_ROUTER.md` is not written as generic marketing prose. It is derived systematically from the **deterministic JSONB outputs (`mcdX_output.json`)** and architectural specifications (`mcdX.md`) of each MCD:

1. **Canonical Commentary Signatures:** Each evaluator produces standardized English commentary strings (e.g., `"M15 Primary Trend is Bullish Continuation. Price contained within 2EDT channel..."`, `"Confluence detected at Freedman-Diaconis Support sr_1..."`). The keywords, state enums, and phrase structures from these templates form the **Routing Signatures** in the dispatcher.
2. **Specialized Analytical Domain:** Defines what specific market dimension the module governs (Macro Trend Direction, S&R Clustering, Volatility Compression/Expansion, Micro Trigger, Momentum Inflection).
3. **Trigger Invariants & Quality Gate Thresholds:** Records the gating conditions required before a module can be considered active (e.g., Bar Coverage $\ge 60$, $R^2 \ge 0.65$).
4. **Target Intent Classes:** Explicitly maps which types of user inquiries (Trend Confirmation, Entry Price Timing, Volatility Assessment, Key S&R Levels) route to this MCD.

---

## 3. End-to-End System Architecture (The 7 Pillars)

The DavinTrade conversational engine executes across seven concurrent and sequential pillars:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             STACK D END-TO-END CONVERSATIONAL PIPELINE                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. USER INTERACTION & FRONTEND GATING (STACK E WORKBENCH)                                                                       │
│    • User submits query via Chat Panel: "Should I open a Buy or Sell position on XAUUSD right now, and at what price?"         │
│    • Gating: Verify PRO subscription tier, Redis token quota, and active thread context (Instrument: XAUUSD, Timeframe: M5)    │
│                                                              │                                                                  │
│                                                              ▼                                                                  │
│ 2. ENGINE 4: USER CONSTRAINTS & RISK PROFILING (STANDING INVARIANTS)                                                            │
│    • Retrieve confirmed User Profile: Trader Type (Scalper <2h vs Day Trader <12h), Style (Trend Follow / Counter)              │
│    • Account Parameters: Balance ($10,000), Max Risk per Trade (1.5%), Leverage Ceiling (1:5.0x max), Target RRR (1.75x)       │
│                                                              │                                                                  │
│                                                              ▼                                                                  │
│ 3. QUANTITATIVE TIMESERIES INGESTION & DISCRETIZATION (POSTGRESQL `market_data_v6` / DUAL-TABLE)                               │
│    ├─► ENGINE 1 (Data Access)      : Query 103 contract columns (106 Prisma fields) over fixed 54-bar lookback window          │
│    ├─► ENGINE 1.5A (State Machine) : Discretize 103 columns into active MCD1–MCD15 states + 4-Quadrant EDT Gate + FREQ54 counts │
│    └─► ENGINE 1.5B (Storyline)     : Deduplicate consecutive states into chronological narrative episode blocks (JSONB54)       │
│                                                              │                                                                  │
│                                                              ▼                                                                  │
│ 4. ENGINE 1.5E: THE TACTICAL OKF ROUTER (MCD SELECTION DISPATCHER)                                                              │
│    • Evaluate User Prompt Intent + Engine 1.5A Instantaneous Market Regime                                                      │
│    • Deterministic Triage: Selects relevant subset of modules: [MCD1 (M15 Trend Baseline), MCD2, MCD3 (Illustrative Modules)]   │
│                                                              │                                                                  │
│                                                              ▼                                                                  │
│ 5. PARALLEL MULTIMODAL CONTEXT RETRIEVAL                                                                                        │
│    ├─► ENGINE 2 (txtai Scoped RAG) : Vector search scoped ONLY to selected [MCD1, MCD2, MCD3] concepts & synthesis playbooks    │
│    └─► ENGINE 3 (Vision Engine)    : Render high-resolution 3-Panel MTF Chart PNG (Panel 1: M15 | Panel 2: M5 | Panel 3: EDT/Z) │
│                                                              │                                                                  │
│                                                              ▼                                                                  │
│ 6. SUPER-PROMPT ASSEMBLY & MULTIMODAL REASONING BRAIN                                                                           │
│    • Assemble unified context: 103-Col Telemetry & Stats + JSONB54 Storyline + Selected MCD JSONs + Scoped RAG + Risk Rules + Chart │
│    • Invocation: Claude Opus 5.5 / Gemini Multimodal API with Native Reasoning                                                  │
│                                                              │                                                                  │
│                                                              ▼                                                                  │
│ 7. STREAMING RESPONSE & DYNAMIC TRADE SETUP CARD DELIVERY                                                                       │
│    • Stream natural-language analytical explanation via Server-Sent Events (SSE)                                                │
│    • Deliver interactive `TradeSetupCard.tsx`: Exact Entry ($2,634.50), Stop Loss ($2,620.50), Take Profit ($2,659.00), Lot Size│
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Pillar Specifications in Depth

### 4.1 Engine 1: Timeseries Data Access, 103-Column Architecture & Inception Anchoring

#### 4.1.1 Production Database Architecture (Dual-Table Point-in-Time Model)

The quantitative timeseries foundation is deployed on PostgreSQL (production on Railway, staging on Contabo VPS SQLite) and enforces a formal separation between **Live Operational Technical Analysis** and **Historical Point-in-Time Evaluation**:

1. **Operational Live Datastore: `market_data_v6` (103 Contract Columns / 106 Prisma Fields)**
   - **Core Role:** Serves as the Single Source of Truth (SSOT) for live charting, real-time trigger evaluation, and the Conversational AI Co-Pilot (Stack D & E).
   - **Write Semantics:** Idempotent `UPSERT` on unique composite key `(symbol, timeframe, timestamp)` across a sliding window of ~3,000 bars.
   - **Continuous Re-fitting:** As new bars close, polynomial regression lines, Singular Spectrum Analysis (SSA) curves, and equidistant trendline channels (EDT) continuously re-fit historical values to reflect the freshest mathematical baseline of the active market regime.
   - **Contract Scope:** 103 contract columns spanning 14 functional categories (+ 3 Prisma ORM system fields: `id` as cuid, `createdAt`, and `updatedAt`, totaling 106 fields).

2. **Immutable Snapshot Datastore: `market_data_point_in_time` (84 Prisma Fields / 77 Drifting Indicator Columns)**
   - **Core Role:** Foundation for quantitative strategy backtesting, Machine Learning feature stores, and fitness function scoring.
   - **Write Semantics:** Append-only log (`INSERT ... ON CONFLICT DO NOTHING`) capturing the state of bar 1 at the precise second it closed (`snapshot_age_bars = 1`).
   - **Elimination of Look-Ahead Bias:** Resolves the critical empirical drift phenomenon documented in production (where dynamic EDT channels drift on 100% of historical bars with an average drift of $19.26 USD, and SSA smoothed curves shift 100% of the time). Provides frozen point-in-time integrity for model verification.

3. **Mathematical Audit Datastore: `indicator_statistics` (87 Columns / 12 Sources)**
   - **Core Role:** Stores the underlying mathematical parameters and distribution metrics that generated indicator levels.
   - **Enum Sources:** Extended to 12 sources including `sr_levels` (Indicator 14: `SupportAndResistantAutoCalibration_v2_29.mq5`) and `sr2_levels` (Indicator 15: `S-R-AutoCalibration_v2_29.mq5`, deployed via migration `20260922000000_add_market_data_v6_sr2_levels`).

#### 4.1.2 Classification of the 103 Columns in `market_data_v6` (14 Functional Categories)

The 103 columns consolidate telemetry from all 15 MQL5 indicator suites running on MT5 terminals (exporting every 5 minutes at second :59) and Python calc modules into 14 distinct functional categories:

| Group  | Category Name                               | Column Count | Column Span  | Description & Data Origin                                                                                                                                                                                                                                              |
| ------ | ------------------------------------------- | ------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------- | ----- | ---------------------------------------------------------------------- |
| **1**  | Base OHLCV & Timeframe Grid                 | 8            | Cols 1–8     | `timestamp`, `symbol`, `timeframe`, `open`, `high`, `low`, `close`, `volume` (Standardized M5/M15 spine).                                                                                                                                                              |
| **2**  | Centroid Variant 1: `best_fit_a`            | 8            | Cols 9–16    | Primary Best-Fit: SSA (30,6,3), DBSCAN, WLS (`Exclude=0`), 2EDT channels (`uoedt`, `loedt`, `base_fl`, `ssa`, `crossing`).                                                                                                                                             |
| **3**  | Centroid Variant 2: `best_fit_b`            | 8            | Cols 17–24   | Secondary Best-Fit: SSA (30,6,3), WLS (`Exclude=3` recent centroids to isolate persistent structure from short swings).                                                                                                                                                |
| **4**  | Centroid Variant 3: `cherry_a`              | 8            | Cols 25–32   | OLS regression fitted across Cherry-Picked Centroid Set A.                                                                                                                                                                                                             |
| **5**  | Centroid Variant 4: `cherry_b`              | 8            | Cols 33–40   | OLS regression fitted across Cherry-Picked Centroid Set B.                                                                                                                                                                                                             |
| **6**  | Centroid Variant 5: `most_recent`           | 8            | Cols 41–48   | OLS regression anchored to $N$ most recent centroids to track immediate momentum.                                                                                                                                                                                      |
| **7**  | Centroid Variant 6: `non_a`                 | 8            | Cols 49–56   | OLS regression excluding recent Box A centroids.                                                                                                                                                                                                                       |
| **8**  | Centroid Variant 7: `non_b`                 | 8            | Cols 57–64   | OLS regression excluding recent Box B centroids.                                                                                                                                                                                                                       |
| **9**  | Fractal Lines & Support/Resistance          | 5            | Cols 65–69   | `fractal_best_fl`, `fractal_uoedt`, `fractal_loedt`, `best_resistance`, `best_support` (Max touch confirmation).                                                                                                                                                       |
| **10** | S&R Auto-Calibration Set 1 (`sr_1`–`sr_8`)  | 8            | Cols 70–77   | Indicator 14 (`SupportAndResistantAutoCalibration_v2_29.mq5`): Freedman-Diaconis IQR clustering across fractals (`sr_1`..`sr_4` supports below close, `sr_5`..`sr_8` resistances above close).                                                                         |
| **11** | S&R Auto-Calibration Set 2 (`sr_9`–`sr_16`) | 8            | Cols 78–85   | Indicator 15 (`S-R-AutoCalibration_v2_29.mq5`): Secondary independent S&R clustering (`sr_9`..`sr_12` supports, `sr_13`..`sr_16` resistances).                                                                                                                         |
| **12** | Z-Score Candle Volatility                   | 3            | Cols 86–88   | `body_direction`, `body_size` ($                                                                                                                                                                                                                                       | Z   | = \frac{ | C - O | - \mu}{\sigma}$, 432-bar sample), `body_classification` (Enum 0 to 5). |
| **13** | ZigZag Market Structure & Metrics           | 11           | Cols 89–99   | `zigzag_point_type`, `zigzag_current_point`, `zigzag_price_change`, `zigzag_pct_change`, `zigzag_pct_change_class`, `zigzag_bars`, `zigzag_bars_class`, `zigzag_price_per_bar`, `zigzag_price_per_bar_class`, `zigzag_slope`, `zigzag_category` (HH/HL/LH/LL/EQH/EQL). |
| **14** | Pipeline Provenance & Metadata              | 4            | Cols 100–103 | `cycle_id`, `collected_at`, `calculated_at`, `synced_at` (Audit integrity and multi-stage synchronization).                                                                                                                                                            |

#### 4.1.3 Dual Lookback Methodology

- **Micro Window Query:** Strictly enforces the **Platform-Wide Fixed 54-Bar Standard** ($i = 1 \dots 54$, where $i = 1$ is the live bar). For M5, 54 bars represents $4.5$ hours of market action; for M15, 54 bars represents $13.5$ hours of macro structure.
- **Macro Anchor Query:** Scans from inception anchor to live bar to trace full historical EDT span metrics ($N_{\text{span}}$ bars), ensuring robust channel geometry without truncating structural boundaries.

### 4.2 Engine 1.5A: Discrete State Machine & 4-Quadrant Quality Gate

#### 4.2.1 The MCD Series Governance: Certified Baseline vs. User-Driven Tactical Modules

To prevent misrepresentation and maintain strict architectural fidelity with [`HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-stack-d-and-e/engine-1-5-new/HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md), the system enforces the following governance principles across the MCD series:

1. **Standardized Naming Convention:** All modules follow the single-integer notation `MCD1`, `MCD2`, `MCD3`, ..., `MCD15` (matching directory structure `engine-1-5-new/mcd1/`, `engine-1-5-new/mcd2/`, etc.).
2. **MCD1 is the ONLY Certified Real Production Baseline ("ของจริง"):**
   - **Domain Scope:** **M15 Primary Trend Direction via Regression Channels** on `XAUUSD`.
   - **Indicator Telemetry:** Evaluates the 7 SSA Centroid variants (`best_fit_a`, `best_fit_b`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`) in conjunction with `indicator_statistics`.
   - **Dual-Horizon Framework:** Implements the mathematically verified formula $N_{\text{macro}} = T_{\text{EDT}}$ and $N_{\text{micro}} = \max(96, \text{round}(T_{\text{EDT}} \times 0.05))$ with a strict 96-bar floor.
   - **Production Certification:** Certified with 13/13 passing unit tests (`test_mcd1_unit_tests.py`), 4-tier pre-flight data validation, and complete canonical English JSONB output.
3. **Subsequent Modules (MCD2 to MCD15) are User-Specified Tactical Modules ("User-Driven Topic Definition"):**
   - **No Pre-Emptive Implementation:** Preliminary mockup lists ("ตุ๊กตา") in early drafts were strictly conceptual scaffolding. The system **never** pre-assumes or hardcodes subsequent MCD topics.
   - **User-Driven Design:** The USER directly dictates the exact topic, target timeframe (`M5` vs `M15`), input columns from `market_data_v6` (103 columns / 15 MQL5 indicators), mathematical formulas, threshold gates, and discrete states when each new module is initiated.
   - **Domain Independence:** Each MCD captures a completely distinct, independent market dimension (e.g., S&R clustering, candlestick volatility, ZigZag wave structure, momentum inflection, micro trigger). MCD1's regression-specific rules (such as Centroid variant isolation or Dual-Horizon 96-bar floor) are **never** forced onto other MCDs.
   - **Universal Engineering Standards Across All MCDs:** Every subsequent module ($MCD_X$) must adopt the 5 standard self-contained deliverables established by MCD1:
     1. `mcdX_evaluator.py`: Production evaluator class with 4-tier pre-flight validation.
     2. `test_mcdX_unit_tests.py`: Comprehensive test suite (100% PASS on real and synthetic data).
     3. `mcdX_output.json`: Canonical JSONB payload with deterministic English commentary (zero hallucination).
     4. `mcdX.md`: Complete architectural specification and decision matrix.
     5. `mcdX-manifest-work-completion.md`: Audit trail and integration manifest for Claude Code.

#### 4.2.2 The 4-Quadrant Quality Gate & Discretization Engine

- **The 4-Quadrant Matrix:** Evaluates channel health across a $2 \times 2$ grid:
  - Quadrant 1: Model A (SSA Crossing / Momentum Energy) on M5
  - Quadrant 2: Model B (Centroid Regression / Structural Geometry) on M5
  - Quadrant 3: Model A on M15
  - Quadrant 4: Model B on M15
- **Non-Compensatory Minimum Threshold Gatekeeper:** Evaluates Bar Coverage ($\ge 60$ bars), Fit Quality ($R^2 \ge 0.65$), Trend Fitness, and Channel Symmetry. If any pillar fails, the setup is **not suppressed**; instead, it generates a **Cautionary Defect Flag** instructing position size reduction by $50\%$.
- **Discretization:** Evaluates instantaneous technical conditions into discrete boolean vectors `MCD1_VALID` through `MCD15_VALID`.
- **State Density (`FREQ54`):** Computes exact historical occurrences of each state across the 54-bar lookback window to identify regime persistence.

### 4.3 Engine 1.5B: Narrative Storyline Builder (`JSONB54`)

- **Run-Length Episode Compression:** Collapses consecutive identical MCD states into narrative blocks:
  ```json
  {
    "episode": 1,
    "state": "MCD1_BULLISH_EXPANSION",
    "bar_span": [12, 18],
    "duration_bars": 7,
    "event": "Tested Upper EDT Channel at $2,642.10, rejected with long wick"
  }
  ```
- **Payload Generation:** Packages the 4-Quadrant Audit, Informational Risk Flags (Kurtosis, Variance Ratio), and Chronological Storyline into `JSONB54` for context injection.

### 4.4 Engine 1.5E: The Tactical OKF Router & MCD Dispatcher (The Stationmaster)

#### 4.4.1 Architectural Role: The Switchboard Operator of DavinTrade

Engine 1.5E functions as the **Tactical Stationmaster / Switchboard Operator** of the DavinTrade architecture. It replaces the flawed linear averaging of Engine 1.5C (WACS54) with a deterministic, multi-dimensional routing protocol.

Rather than allowing the LLM to search blindly through thousands of knowledge chunks or forcing all quantitative indicators into an arbitrary score, Engine 1.5E acts as the gatekeeper: it listens to the user's question, audits the live quantitative state of the market, cross-references the lightweight switchboard directory (`TRADING_ROUTER.md`), and selectively connects the call to a tightly scoped target subset of specialist modules:
$$\mathcal{M}^* = \{\text{MCD}_1, \text{MCD}_a, \text{MCD}_b, \dots\}$$

---

#### 4.4.2 Telemetry Harvesting: Compiling JSONB Comment Texts into `TRADING_ROUTER.md`

`TRADING_ROUTER.md` (or `MCD_DISPATCHER.md`) is the operational heart of Tier 1 routing. It is systematically compiled by extracting and condensing metadata from the completed MCD deliverables:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        TELEMETRY HARVESTING & ROUTER DIRECTORY COMPILATION                             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. LOCAL MCD EVALUATORS (`engine-1-5-new/mcdX/`)                                                       │
│    • `mcd1_output.json` ➔ Canonical English commentary, discrete states, 4-tier validation results     │
│    • `mcd2_output.json` ➔ Tactical pullback commentary, S&R reactions, local boundary wicks           │
│    • `mcd3_output.json` ➔ Micro trigger commentary, stochastic inflection, velocity thresholds         │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 2. ROUTER COMPILER (`engine-1-5e-router/router_compiler.py`)                                           │
│    • Extracts signature keywords, trigger patterns, state definitions, and analytical domains          │
│    • Compiles ultra-lean routing profile for each MCD (< 300 bytes per module)                         │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 3. THE SWITCHBOARD DIRECTORY (`TRADING_ROUTER.md` / `MCD_DISPATCHER.md`)                               │
│    • Lean table (< 5 KB) containing: Module ID, Domain, Signature Keywords, Target Intent Mappings    │
│    • Serves as the authoritative routing directory for both Rule-based and Vector-based dispatch       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

##### Standard Entry Structure in `TRADING_ROUTER.md`:

| Module ID  | Primary Timeframe | Domain & Specialization                       | Canonical Telemetry Signatures (Keywords)                                                                                              | Target Query Intents                               | Vector Namespace |
| :--------- | :---------------- | :-------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------- | :--------------- |
| **`MCD1`** | `M15`             | Macro Trend Direction via Regression Channels | `"Bullish Continuation"`, `"Bearish Reversal"`, `"2EDT Channel"`, `"Containment Rate"`, `"Structural Breach"`, `"Asymmetric Breakout"` | `INTENT_DIRECTION`, `INTENT_MACRO_STRUCTURE`       | `mcd1`           |
| **`MCD2`** | `M5`              | Micro Pullback & Support Retest               | `"Pullback Retest"`, `"Support Absorption"`, `"Rejection Wick"`, `"Boundary Confluence"`                                               | `INTENT_ENTRY_TIMING`, `INTENT_PULLBACK`           | `mcd2`           |
| **`MCD3`** | `M5`              | Micro Tactical Trigger & Inflection           | `"Stochastic Inflection"`, `"Oversold Trigger"`, `"Overbought Exhaustion"`, `"Energy Crossover"`                                       | `INTENT_ENTRY_TIMING`, `INTENT_TRIGGER`            | `mcd3`           |
| **`MCD4`** | `M5` / `M15`      | Volatility Corridor & Candle Body Z-Scores    | `"Volatility Expansion"`, `"UP_EXTREME"`, `"DOWN_EXTREME"`, `"Z-Score Spike"`, `"Range Expansion"`                                     | `INTENT_VOLATILITY`, `INTENT_RISK_AUDIT`           | `mcd4`           |
| **`MCD5`** | `M15` / `M5`      | Auto-Calibrated S&R Cluster Confluence        | `"Freedman-Diaconis"`, `"IQR Density"`, `"sr_1..sr_16"`, `"Horizontal Reaction Zone"`                                                  | `INTENT_SUPPORT_RESISTANCE`, `INTENT_PRICE_TARGET` | `mcd5`           |

---

#### 4.4.3 Vector Similarity Mapping: Bridging `TRADING_ROUTER.md` to `VectorDB` (txtai)

To achieve truly dynamic and robust routing in natural language conversational AI, Engine 1.5E does not rely merely on rigid keyword matching. It utilizes **Semantic Vector Similarity Mapping** powered by `txtai`:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        VECTOR SIMILARITY MAPPING & SCOPED RETRIEVAL WORKFLOW                           │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [User Prompt: "ควร Buy XAUUSD แถว 2634 ดีไหม?"] + [Live Active MCD JSONB Commentary Texts]             │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 1. COMPOSITE DISPATCH QUERY VECTOR ENCODING                                                            │
│    • Synthesize weighted context: e_dispatch = α·Embed(Prompt) + (1-α)·Embed(Live JSONB Comments)     │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 2. VECTOR SIMILARITY EVALUATION AGAINST ROUTER EMBEDDINGS                                              │
│    • Query the txtai router index containing semantic embeddings of TRADING_ROUTER.md entries         │
│    • Calculate Cosine Similarity: Sim(k) = (e_dispatch · e_node_k) / (||e_dispatch|| ||e_node_k||)   │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 3. THE STATIONMASTER'S DISPATCH DECISION                                                               │
│    • Select modules exceeding similarity threshold (θ >= 0.72) ➔ M* = ['MCD1', 'MCD2', 'MCD5']       │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 4. SCOPED SQL METADATA PRE-FILTERING ON VECTORDB                                                       │
│    • Executes filtered query on Engine 2 Knowledge Vault:                                              │
│      WHERE mcd_id IN ('MCD1', 'MCD2', 'MCD5') OR domain IN ('synthesis', 'risk', 'governance')         │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 5. REASONING ENGINE CONTEXT ASSEMBLY (Zero Bloat, Zero Noise, 100% Mathematically Grounded)            │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

##### 1. Composite Query Vector Formulation:

In financial markets, answering _"Should I Buy Gold?"_ requires a completely different analytical lens during a violent bearish breakdown than during an orderly bullish pullback. Therefore, Engine 1.5E constructs a **Composite Dispatch Representation** fusing User Intent ($Q$) with Live Market Telemetry ($\mathcal{T}_{\text{JSONB}}$):
$$\mathbf{e}_{\text{dispatch}} = \alpha \cdot \text{Embed}(Q) + (1 - \alpha) \cdot \text{Embed}\left(\bigcup_{k=1}^N \text{JSONB}_k.\text{commentary}\right)$$
_(where $\alpha = 0.60$ balances user inquiry intent against live market reality)._

##### 2. Semantic Node Indexing of `TRADING_ROUTER.md`:

In the `txtai` database, each row of `TRADING_ROUTER.md` is indexed as an **MCD Capability Node** with dense semantic embeddings:
$$\mathbf{e}_{\text{node}}^{(k)} = \text{Embed}\Big(\text{Name}_k \oplus \text{Domain}_k \oplus \text{Signatures}_k \oplus \text{Intents}_k\Big)$$

##### 3. Cosine Similarity Ranking & Module Gating:

The Dispatcher computes cosine similarity scores across all available MCD capability nodes:
$$\text{Score}(k) = \frac{\mathbf{e}_{\text{dispatch}} \cdot \mathbf{e}_{\text{node}}^{(k)}}{\|\mathbf{e}_{\text{dispatch}}\| \|\mathbf{e}_{\text{node}}^{(k)\|}$$

- **Selection Rule:** A module $k$ is included in the active target set $\mathcal{M}^*$ if:
  $$\text{Score}(k) \ge \theta_{\text{threshold}} \quad (\theta = 0.72) \quad \text{OR} \quad k \in \text{Top-3 Highest Matching Modules}$$
- **Invariant Inclusions:** `MCD1` (Macro Structure Baseline) is _always_ included when macro orientation is required for directional trade qualification.

##### 4. Connecting the Dispatcher to Deep Knowledge Retrieval:

Once Engine 1.5E emits the target array $\mathcal{M}^* = \{\text{MCD1}, \text{MCD2}, \text{MCD5}\}$, this array is passed directly to Engine 2's `scoped_query_engine.py`.
The array acts as an **inviolable SQL metadata pre-filter** on the 5 Knowledge Domains of the VectorDB:

```python
# Unbroken link: Router dispatch array strictly scopes the deep VectorDB search
deep_knowledge_chunks = txtai_client.search(
    query=user_prompt,
    limit=4,
    filter=f"mcd_id IN {target_mcd_array} OR domain IN ('synthesis', 'risk_management', 'governance')"
)
```

This guarantees that **only relevant mathematical proofs, standalone playbooks, cross-MCD synthesis rules, and risk constraints are loaded into the prompt**. Unrelated modules are completely quarantined, achieving:

- **Zero Hallucination:** The LLM can only reason over theories directly applicable to the selected MCDs.
- **Zero Context Window Bloat:** Prompt token consumption drops from 25,000+ tokens to under 2,000 tokens.
- **Deterministic Execution:** The trading copilot operates with institutional precision and speed.

### 4.5 Engine 2: Scoped Knowledge & Strategy RAG (Powered by `txtai` + VectorDB/SQLite)

#### 4.5.1 Strategic Role: The Institutional Trading Brain & Knowledge Vault

In quantitative conversational AI, numbers without qualitative trading doctrine lead directly to **hallucination, contradictory advice, and ungrounded execution**. While Engine 1, Engine 1.5A, and Engine 1.5B extract and compress empirical telemetry (prices, channels, discrete states, and episode storylines), **Engine 2 serves as the semantic knowledge core and institutional reasoning vault of DavinTrade**.

Engine 2 provides the Large Language Model with:

1. The **foundational rationale, mathematical proofs, and design hypotheses** behind every indicator and MCD.
2. The **standalone execution rules and statistical edges** of individual MCDs.
3. The **synthesis playbooks** governing how multiple MCDs interact across timeframes to form cohesive strategies.
4. The **institutional capital preservation and risk management formulas** that safeguard equity.
5. The **inviolable trading governance, compliance rules, and operational ethics** that prevent catastrophic retail failure modes.

Through the **Open Knowledge Format (OKF) Progressive Disclosure** model, Engine 2 does _not_ flood the prompt with thousands of pages of unstructured text. Instead, it operates in strict lockstep with Engine 1.5E: when the Tactical Router dispatches a target subset (e.g., $\mathcal{M}^* = \{\text{MCD1}, \text{MCD2}, \text{MCD3}\}$), Engine 2 executes a **metadata-scoped vector retrieval**, extracting _only_ the specific theories, playbooks, confluence matrices, and risk constraints relevant to that exact market circumstance.

---

#### 4.5.2 The 5 Authoritative Knowledge Domains of Engine 2

The Engine 2 knowledge repository is structured across five distinct institutional domains:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ENGINE 2: 5 CORE KNOWLEDGE DOMAINS                                   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DOMAIN 1: MCD FOUNDATION & CONSTRUCTION PRINCIPLES                                                     │
│ • Mathematical formulas, MQL5 indicator origins, baseline hypotheses, discrete state taxonomies       │
│                                                   │                                                    │
│ DOMAIN 2: STANDALONE MCD TRADING PLAYBOOKS        │ DOMAIN 3: MULTI-MCD SYNTHESIS & CONFLUENCE         │
│ • Edge definition, valid triggers, invalidation   │ • Cross-MCD synthesis matrix, MTF alignment        │
│ • Asymmetric breakouts & cautionary protocols     │ • Trend continuation, mean-reversion & conflict res│
│                                                   │                                                    │
│ DOMAIN 4: INSTITUTIONAL RISK MANAGEMENT           │ DOMAIN 5: TRADING GOVERNANCE & COMPLIANCE          │
│ • Exact position sizing math ($ risk, SLD, fees)  │ • Single-order scope, 1:5.0x leverage ceiling      │
│ • Volatility-adjusted stops & circuit breakers    │ • News event blackouts & anti-overtrading guardrails│
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

##### 1. Domain 1: MCD Foundation, Rationale & Mathematical Construction

- **Indicator Lineage & Algorithmic Provenance:** Documents the exact mathematical origins in MQL5 indicator source code (e.g., why Singular Spectrum Analysis uses `Window=30, Rank=6` with EMA signal `Period=3`, how DBSCAN clusters crossovers into regression centroids, and why Freedman-Diaconis IQR clustering is chosen for Support/Resistance auto-calibration over fixed price bins).
- **Baseline Hypotheses & Edge Definition:** Details the statistical assumptions underlying each module (e.g., MCD1 assumes price action is bounded by an Equidistant Trendline Channel whose baseline represents fair institutional value).
- **Mathematical Derivations:** Formulates core quantitative thresholds, such as the Dual-Horizon Framework ($N_{\text{macro}} = T_{\text{EDT}}$ and $N_{\text{micro}} = \max(96, \text{round}(T_{\text{EDT}} \times 0.05))$), containment ratios, and velocity vectors.
- **Discrete State Taxonomies:** Catalogs all possible discrete states (e.g., `BULLISH_EXPANSION`, `PULLBACK_RETEST`, `STRUCTURAL_BREACH`), defining their precise entry and exit conditions.
- **Quality Gate Integrity Standards:** Establishes non-compensatory thresholds for Bar Coverage ($\ge 60$ bars), Fit Quality ($R^2 \ge 0.65$), and Channel Symmetry.

##### 2. Domain 2: Standalone MCD Trading Playbooks

- **Single-Module Tactical Edge:** Defines how a trader extracts an edge relying strictly on an individual MCD's signals.
- **Trigger Mechanics & Entry Zones:** Specifies whether entries should be taken on immediate bar touches or on confirmed bar closes.
- **Asymmetric Breakout Logic:** Distinguishes between **Prompt Climax Reversals** (same-slope exhaustion where a single bar breach requires immediate protective reaction) versus **Sustained Structural Breaches** (counter-trend shifts requiring $\ge 80.0\%$ cumulative breach across the micro-horizon).
- **False Breakout & Retest Protocols:** Guidelines for differentiating between temporary liquidity sweeps (wicks) and genuine regime breakouts.
- **Cautionary Defect Playbook:** Strict operational instructions for trading when an indicator generates a Cautionary Defect Flag (e.g., $R^2 < 0.65$ or low coverage), mandating an immediate 50% position size reduction or sideline stance.

##### 3. Domain 3: Multi-MCD Synthesis & Strategy Confluence Engine

- **Cross-MCD Synthesis Matrix:** Maps the combinatorial interactions between all active MCDs (e.g., how MCD1 Trend interacts with S&R Levels, Volatility Z-scores, and ZigZag swings).
- **Macro-to-Micro Multi-Timeframe Alignment:**
  - _M15 Structure (MCD1):_ Governs macro trend direction, structural boundaries, and regime bias.
  - _M5 Trigger (Subsequent MCDs):_ Governs entry timing, pullback exhaustion, and micro fractal triggers.
- **Institutional Trend Continuation Setups:** Documents high-conviction continuation playbooks (e.g., M15 Trend Continuation + M5 Pullback into Freedman-Diaconis Support `sr_1` + Sub-window oscillator oversold inflection).
- **Counter-Trend & Mean-Reversion Playbooks:** Governs high-volatility counter-trend trading (e.g., price piercing the outermost Upper 2EDT channel with candle body volatility $|Z| \ge 2.50$, targeting a reversion back to the Base Flip Line). Enforces a **mandatory hard cap on Reward-to-Risk Ratio ($RRR \le 2.50\text{x}$)** to prevent greed in counter-trend swings.
- **Conflict Resolution Hierarchy:** Eliminates analytical confusion when indicators emit contradictory signals. Enforces a deterministic institutional precedence:
  $$\text{Macro Market Structure (M15)} \succ \text{Horizontal S\&R Density} \succ \text{Geometric Trendline} \succ \text{Sub-window Oscillators}$$
  _Rule:_ A sub-window oscillator oversold flag can never override an active macro structural breakdown.

##### 4. Domain 4: Institutional Risk Management & Capital Preservation

- **Dynamic Position Sizing Mathematics:** Enforces institutional position sizing calculated strictly from dollar equity and structural Stop Loss Distance (SLD):
  $$\text{Lot Size} = \frac{\text{Equity} \times \text{Risk \%}}{(\text{SLD} \times \text{Contract Multiplier}) + \text{Commission per Lot}}$$
  _(For XAUUSD, Contract Multiplier is 100 oz, and round-trip commission is $4.00/lot)._
- **Volatility-Adjusted Stop Loss Engineering:** Requires Stop Losses to be placed behind verifiable structural market barriers (e.g., $0.50 below the Lower EDT Channel or beneath the nearest Freedman-Diaconis support cluster `sr_1`) rather than arbitrary retail dollar stops.
- **Dynamic Risk Scaling:** Automatically scales base risk from 1.5% down to 0.75% or 0.50% when Cautionary Defect Flags are triggered or when market kurtosis indicates high tail risk.
- **Drawdown Circuit Breakers:** Standing mandates that halt trading or force defensive position sizing upon reaching daily loss thresholds (-3.0%) or weekly drawdown limits (-5.0%).

##### 5. Domain 5: Trading Governance, Compliance & Ethical Execution Rules

- **Single-Order Scope Demarcation:** Invariant principle dictating that DavinTrade evaluates setups strictly on a **single-trade, standalone basis**. Prohibits martingales, unhedged grid layering, or cross-collateralized portfolio margin assumptions.
- **Institutional Leverage Ceiling:** Hard-locked ceiling at **1:5.0x**, categorically rejecting excessive retail leverage to preserve long-term survival probability.
- **Macroeconomic High-Impact Event Protocols:** Mandates operational blackouts (no new orders 15 minutes before and after Tier 1 economic releases: US CPI, Core PCE, FOMC Rate Decision, and Non-Farm Payrolls).
- **Execution Hygiene & Psychological Guardrails:** Enforces cooling-off periods following consecutive losses to eliminate emotional revenge trading.

---

#### 4.5.3 Technical Architecture: `txtai` + VectorDB & Relational SQLite

Engine 2 implements a robust, sub-millisecond semantic retrieval pipeline:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              ENGINE 2: TXTAI SCOPED RETRIEVAL PIPELINE                                 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. KNOWLEDGE INGESTION PIPELINE (Offline / Build Time)                                                 │
│    • AST-Aware Markdown Parser: Splits documents on ##/### boundaries (preserves KaTeX & code)        │
│    • Frontmatter Extractor: Parses YAML metadata: mcd_id, domain, timeframe, strategy_tag, scenario_id│
│    • Embeddings Engine: Encodes semantic text into dense vectors (sentence-transformers / all-MiniLM)   │
│    • Dual Storage: Dense vectors in Faiss HNSW index; structured metadata & raw text in SQLite        │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 2. SCOPED RETRIEVAL WORKFLOW (Online / Request Time)                                                   │
│    • Dispatch Signal: Engine 1.5E emits target array: M* = ['MCD1', 'MCD2', 'MCD3']                   │
│    • Stage 1 (SQL Metadata Pre-Filter):                                                                │
│        SELECT chunk_id FROM knowledge_store                                                            │
│        WHERE mcd_id IN ('MCD1', 'MCD2', 'MCD3') OR domain IN ('synthesis', 'risk', 'governance');      │
│    • Stage 2 (Hybrid Vector Search & Re-ranking):                                                      │
│        Executes BM25 Lexical + Dense Semantic similarity over pre-filtered candidate pool               │
│    • Output: Top 3-5 high-signal Markdown concept blocks (1,500 - 2,500 tokens total)                  │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 3. SUPER-PROMPT INTEGRATION                                                                            │
│    • Scoped knowledge is injected directly into Pillar 6 Context Assembler                             │
│    • Guarantees the LLM reasons with pure mathematical precision, zero bloat, and zero hallucination   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Client Invocation Contract (`scoped_query_engine.py`):**
  ```python
  # Scoped retrieval query executed by the Orchestrator
  scoped_results = txtai_client.search(
      query=user_prompt,
      limit=4,
      filter="mcd_id IN ('MCD1', 'MCD2', 'MCD3') OR domain IN ('synthesis', 'risk', 'governance')",
      weights=[0.7, 0.3]  # 70% dense semantic similarity, 30% BM25 keyword match
  )
  ```

### 4.6 Engine 3: Computer Vision Multi-Timeframe Engine

- **Visual Synthesis:** Generates a high-resolution, 3-panel chart image from raw memory buffer using Matplotlib:
  - Panel 1 (Top): M15 Macro Structure with EDT channel envelopes and SSA pivots.
  - Panel 2 (Middle): M5 Micro Candlesticks with local Support/Resistance levels.
  - Panel 3 (Bottom): Sub-window indicators (EDT Stochastic, Z-Score expansion, ZigZag).
- **Multimodal Inspection:** Injected directly into the vision context of Claude Opus 5.5, enabling the model to inspect candlestick wicks, visual rejections, and geometric chart patterns that cannot be fully captured by numerical tables.

### 4.7 Engine 4: User Constraints, Preferences & Inviolable Risk Governance

Engine 4 enforces institutional safety rules that cannot be overridden by user prompts or market excitement:

1. **Trader Persona Alignment:**
   - **Scalper (< 2 hours):** Structure on M5, execution on M5, tight target bounds.
   - **Day Trader (< 12 hours):** Structure on M15, entry confirmation on M5.
2. **Institutional Leverage Ceiling:** Strictly capped at **1:5.0x**, rejecting higher retail leverage to enforce capital preservation.
3. **Max Risk Per Trade (RPT):** Configurable between **0.5% and 2.0%** (Default: **1.5%**), including round-trip broker commission ($4.00/lot).
4. **Conditional Target RRR:** Default **1.75x**. If user selects _Trend Countering_, RRR is **hard-capped at 2.50x**.
5. **Single-Order Scope Demarcation:** Calculations apply solely to the current standalone trade setup. DavinTrade does _not_ aggregate multi-position portfolio margin or cross-asset correlation.

---

## 5. Complete Files and Folders Structure

The complete production layout for DavinTrade Stack D and E is structured as follows:

```text
davintrade-stack-d-and-e/
├── README.md                                      # System Overview & Architecture Summary
├── TRADING_ROUTER.md                              # [OKF TIER 1 ROUTER] Master Intent-to-MCD Dispatch Matrix
│
├── config/                                        # Global Configuration & Governance Settings
│   ├── asset_scope.yaml                           # Supported symbols: strictly XAUUSD (Gold)
│   ├── platform_constants.py                      # 54-bar lookback, 1:5.0x leverage cap, default fees
│   └── database_config.py                         # PostgreSQL pool settings & connection parameters
│
├── engine-1-data-access/                          # [ENGINE 1] Raw Timeseries Database Ingestion
│   ├── __init__.py
│   ├── client.py                                  # PostgreSQL async connection client
│   ├── query_service.py                           # 54-bar micro slice & inception macro queries
│   ├── column_definitions.py                      # 103-column schemas & numeric feature mappers (14 groups)
│   ├── point_in_time_snapshot.py                  # Immutable snapshot handler (84 fields / 77 drifting columns)
│   └── data_integrity_validator.py                # Checks bar monotonicity, gap detection, null audits
│
├── engine-1-5-new/                                # [ENGINE 1.5A & 1.5B] Quantitative Logic & Evaluator Modules
│   ├── market_data_v6_replicated.xlsx             # Master local dataset (M15, M5, indicator_statistics snapshots)
│   ├── HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md      # Authoritative hand-off & engineering workflow standard
│   │
│   ├── state-machine-1-5a/                        # Engine 1.5A Core Framework & Quality Gate
│   │   ├── __init__.py
│   │   ├── edt_quality_gate.py                    # 4-Quadrant 2x2 Minimum Threshold Gatekeeper
│   │   ├── freq54_calculator.py                   # Computes occurrence counts & state density ratios
│   │   └── base_evaluator.py                      # Abstract base class for MCD computation
│   │
│   ├── narrative-builder-1-5b/                    # Engine 1.5B: Narrative Storyline Deduplication
│   │   ├── __init__.py
│   │   ├── run_length_dedup.py                    # Compresses identical sequential states into episodes
│   │   ├── payload_builder.py                     # Assembles JSONB54 payload with quality audit & flags
│   │   └── schemas.py                             # Pydantic data models for JSONB54 narrative blocks
│   │
│   ├── mcd1/                                      # [MCD1: CERTIFIED PRODUCTION BASELINE (REAL)]
│   │   ├── mcd1_evaluator.py                      # Production evaluator (Dual-Horizon M15 Trend Direction)
│   │   ├── test_mcd1_unit_tests.py                # 13 unit tests (100% PASS)
│   │   ├── mcd1_output.json                       # Canonical JSONB output payload
│   │   ├── mcd1.md                                # Comprehensive architectural specification & decision matrix
│   │   └── mcd1-manifest-work-completion.md       # Audit trail & integration manifest for Claude Code
│   │
│   ├── mcd2/                                      # [MCD2: USER-SPECIFIED TOPIC (IN PROGRESS/NEXT)]
│   │   ├── mcd2_evaluator.py                      # (Standard 5-deliverable structure built to user specs)
│   │   ├── test_mcd2_unit_tests.py
│   │   ├── mcd2_output.json
│   │   ├── mcd2.md
│   │   └── mcd2-manifest-work-completion.md
│   │
│   └── mcd3/ ... mcd15/                           # [MCD3 to MCD15: MODULAR TACTICAL EXPANSION]
│       └── (Self-contained directories built iteratively following User-Driven Topic Definitions)
│
├── engine-1-5e-router/                            # [ENGINE 1.5E] Tactical OKF Agentic Router & Switchboard
│   ├── __init__.py
│   ├── intent_classifier.py                       # Natural language intent parser (Direction/Timing/Risk)
│   ├── market_regime_detector.py                  # Detects macro regime (Trending, Range, High-Volatility)
│   ├── router_compiler.py                         # Telemetry Harvester: compiles live JSONB comments into TRADING_ROUTER.md
│   ├── vector_dispatcher.py                       # Vector similarity mapper: query+telemetry -> txtai router node match
│   ├── tactical_mcd_selector.py                   # Dispatch algorithm: maps Intent + Regime + Similarity -> MCD array
│   └── dispatch_matrix.yaml                       # Declarative routing fallback & capability profiles
│
├── engine-2-strategy-rag/                         # [ENGINE 2] Semantic Knowledge Vault & Scoped txtai RAG
│   ├── __init__.py
│   ├── config.py                                  # txtai embeddings config, Faiss HNSW parameters, SQLite path
│   ├── txtai_service.py                           # Core wrapper for txtai application lifecycle & index loading
│   │
│   ├── ingestion/                                 # Automated Document Parsing & Embedding Pipeline
│   │   ├── __init__.py
│   │   ├── markdown_chunker.py                    # Header-aware AST semantic parser (preserves code & KaTeX math)
│   │   ├── metadata_extractor.py                  # Extracts YAML frontmatter (mcd_id, domain, regime, tags)
│   │   └── build_index.py                         # CLI script to rebuild Faiss + SQLite index from markdown corpus
│   │
│   ├── retrieval/                                 # Scoped Search & Dynamic Knowledge Assembly
│   │   ├── __init__.py
│   │   ├── scoped_query_engine.py                 # Enforces Engine 1.5E metadata filtering (mcd_id IN target_set)
│   │   ├── hybrid_ranker.py                       # Combines BM25 lexical score + Dense vector similarity
│   │   └── context_formatter.py                   # Formats retrieved chunks into clean Markdown for LLM prompt
│   │
│   └── knowledge-corpus/                          # [OKF TIER 2: AUTHORITATIVE KNOWLEDGE VAULT (5 DOMAINS)]
│       ├── domain-1-mcd-foundations/              # Rationale, Mathematical Logic & Construction of each MCD
│       │   ├── mcd1_foundation_and_math.md        # M15 Trend, SSA Centroids, DBSCAN, WLS, Dual-Horizon Math
│       │   ├── mcd2_foundation_and_math.md        # (User-specified module principles & math)
│       │   ├── mcd3_foundation_and_math.md
│       │   └── ...                                # Scalable up to MCD15
│       │
│       ├── domain-2-single-mcd-playbooks/         # Standalone Execution Rules for each individual MCD
│       │   ├── mcd1_trading_playbook.md           # Asymmetric breakouts, prompt climax vs sustained breach
│       │   ├── mcd2_trading_playbook.md
│       │   ├── mcd3_trading_playbook.md
│       │   └── cautionary_defect_playbook.md      # Rules for trading with Low Coverage/R2 defect flags
│       │
│       ├── domain-3-multi-mcd-synthesis/          # Confluence, Cross-MCD Strategy & Conflict Resolution
│       │   ├── synthesis_matrix.md                # Cross-MCD interaction grid across all active indicators
│       │   ├── macro_micro_alignment_playbook.md  # M15 Macro Structure + M5 Micro Trigger orchestration
│       │   ├── trend_continuation_scenarios.md    # Multi-MCD trend continuation playbook
│       │   ├── mean_reversion_pullback_scenarios.md # Counter-trend mean reversion (RRR <= 2.5x hard cap)
│       │   └── conflict_resolution_hierarchy.md   # Deterministic precedence rules when MCD signals diverge
│       │
│       ├── domain-4-risk-management/              # Institutional Capital Preservation & Sizing
│       │   ├── capital_preservation_framework.md  # Core institutional risk mandates
│       │   ├── dynamic_position_sizing_math.md    # Exact lot size derivation from $ risk, SLD & fees
│       │   ├── volatility_adjusted_stops.md       # Placing SL behind fractal/EDT structural barriers
│       │   └── drawdown_circuit_breakers.md      # Account protection & risk reduction protocols
│       │
│       └── domain-5-governance-and-compliance/    # Operational Governance & Trading Ethics
│           ├── non_negotiable_invariants.md       # 1:5.0x leverage cap, 2.0% risk cap, mandatory SL
│           ├── single_order_scope_boundary.md     # Standalone trade evaluation (no portfolio margin)
│           ├── news_event_blackout_protocols.md   # US CPI, FOMC, NFP high-impact news handling
│           └── execution_hygiene_and_guardrails.md# Overtrading prevention, daily loss caps
│
├── engine-3-vision/                               # [ENGINE 3] Multi-Timeframe Chart Vision (MTF PNG)
│   ├── __init__.py
│   ├── chart_renderer.py                          # Matplotlib 3-panel high-res rendering pipeline
│   ├── visual_overlays.py                         # Draws EDT envelopes, SSA lines, and SR bands on chart
│   └── vision_encoder.py                          # Encodes PNG image buffer to Base64 data string
│
├── engine-4-user-constraints/                     # [ENGINE 4] User Profile & Risk Governance
│   ├── __init__.py
│   ├── profile_manager.py                         # Manages trader persona, style bias, and equity inputs
│   ├── position_sizer.py                          # Strict risk formula: calculates lot size from $ risk & SLD
│   ├── leverage_enforcer.py                       # Hard ceiling validator (rejects values > 1:5.0x)
│   ├── single_order_scope.py                      # Enforces standalone single-trade calculation boundary
│   └── non_negotiable_risk_rules.md               # Standing invariants: 2% risk cap, SL mandatory, no hedging
│
├── orchestrator-synthesis/                        # [REASONING BRAIN & SUPER-PROMPT ASSEMBLER]
│   ├── __init__.py
│   ├── super_prompt_assembler.py                  # Integrates all 7 pillars into unified, zero-bloat prompt
│   ├── llm_gateway.py                             # Invokes Claude Opus 5.5 streaming API with native reasoning
│   ├── active_task_tracker.py                     # Manages `.claude/state/active-tasks.md` for long-horizon runs
│   └── setup_card_extractor.py                    # Parses structured JSON to render `TradeSetupCard.tsx`
│
├── api/                                           # [API LAYER & STREAMING WEBSOCKET/SSE]
│   ├── __init__.py
│   ├── main.py                                    # FastAPI application bootstrap
│   ├── middleware.py                              # CORS, request logging, execution timing middleware
│   ├── dependencies.py                            # Redis token metering, auth tokens, rate limiters
│   └── routes/
│       ├── chat_stream.py                         # Server-Sent Events (SSE) `/api/v1/chat/stream`
│       ├── preferences.py                         # Engine 4 User Constraints CRUD endpoints
│       └── health.py                              # Service health check & database latency monitoring
│
└── tests/                                         # Automated Test Suite & Verification Harness
    ├── test_mcd_evaluators.py                     # Mathematical unit tests for MCD evaluators (MCD1 real baseline + subsequent modules)
    ├── test_tactical_router_1_5e.py               # Validates deterministic triage across user intents
    ├── test_scoped_txtai_retrieval.py             # Validates that vector search strictly respects MCD scoping
    ├── test_risk_governance_engine_4.py           # Validates leverage ceiling, lot sizing, and RRR caps
    └── test_end_to_end_synthesis.py               # Full integration test from query to Trade Setup Card
```

---

## 6. Detailed Data Contracts & Schemas

### 6.1 Engine 1.5E Dispatch Contract (`tactical_mcd_selector.py`)

```json
{
  "query_intent": "INTENT_ENTRY_CONFIRMATION",
  "detected_market_regime": "REGIME_BULLISH_TREND_CONTINUATION",
  "active_trader_type": "DAY_TRADER",
  "selected_mcd_array": ["MCD1", "MCD2", "MCD3", "MCD5"],
  "omitted_mcd_array": ["MCD4", "MCD6", "MCD7", "MCD8", "MCD9", "MCD10"],
  "routing_rationale": "M15 Trend confirmed via certified baseline MCD1; M5 pullback exhausted into support via illustrative modules MCD2/MCD5; Entry timing governed by tactical trigger MCD3. Volatility expansion (MCD4) and Mean-Reversion (MCD7) omitted as non-applicable."
}
```

### 6.2 Engine 1.5B Storyline Payload Contract (`JSONB54`)

```json
{
  "header": {
    "symbol": "XAUUSD",
    "primary_timeframe": "M5",
    "macro_timeframe": "M15",
    "bars_evaluated": 54,
    "timestamp_utc": "2026-09-27T16:00:00Z"
  },
  "edt_4_quadrant_audit": {
    "quadrant_1_model_a_m5": { "coverage": 54, "r2": 0.88, "gate": "PASS" },
    "quadrant_2_model_b_m5": { "coverage": 54, "r2": 0.91, "gate": "PASS" },
    "quadrant_3_model_a_m15": { "coverage": 54, "r2": 0.84, "gate": "PASS" },
    "quadrant_4_model_b_m15": { "coverage": 54, "r2": 0.89, "gate": "PASS" }
  },
  "informational_flags": {
    "variance_ratio": 1.12,
    "kurtosis": 3.05,
    "cautionary_defect_flag": false
  },
  "storyline_episodes": [
    {
      "episode_id": 1,
      "state": "MCD1_CONSOLIDATION",
      "bars_ago_span": [54, 38],
      "summary": "Tight range-bound trading between $2,628 and $2,632"
    },
    {
      "episode_id": 2,
      "state": "MCD1_BULLISH_BREAKOUT",
      "bars_ago_span": [37, 14],
      "summary": "High momentum breakout clearing Upper EDT channel at $2,633.50"
    },
    {
      "episode_id": 3,
      "state": "MCD2_PULLBACK_RETEST",
      "bars_ago_span": [13, 1],
      "summary": "Healthy pullback retesting previous resistance as support at $2,634.50"
    }
  ]
}
```

### 6.3 Dynamic Trade Setup Card Schema (`TradeSetupCard.tsx`)

```typescript
interface TradeSetupCardProps {
  symbol: 'XAUUSD';
  timeframe: 'M5' | 'M15';
  direction: 'BUY' | 'SELL' | 'HOLD';
  orderType: 'BUY_LIMIT' | 'SELL_LIMIT' | 'MARKET';
  entryPrice: number; // e.g. 2634.50
  stopLossPrice: number; // e.g. 2620.50 (SLD: $14.00)
  takeProfitPrice: number; // e.g. 2659.00 (TPD: $24.50)
  rewardToRiskRatio: number; // e.g. 1.75
  recommendedLotSize: number; // e.g. 0.10 (Derived from 1.5% risk on $10,000 equity)
  estimatedCommissionUSD: number; // e.g. $0.40 ($4.00/lot * 0.10)
  riskAmountUSD: number; // e.g. $140.40 (<= $150.00 risk ceiling)
  cautionaryDefectWarning?: string; // Appears if EDT Quality Gate flagged low coverage/R2
  supportingMCDs: string[]; // ["MCD1", "MCD2", "MCD3", "MCD5"]
}
```

---

## 7. Downstream Implementation Roadmaps

This master document serves as the foundational specification for subsequent subsystem designs:

1. **Stack E Workbench UI & Frontend State:**
   - Design the real-time SSE chat client using Zustand and React Query.
   - Build the interactive `TradeSetupCard.tsx` component with dynamic parameter adjustment sliders.
   - Implement Engine 4 interactive preference confirmation modals and tooltip balloons (`[ℹ️]`).
2. **`txtai` Vector Engine & Knowledge Corpus Pipeline (Engine 2):**
   - Configure the `txtai` container with Faiss HNSW dense vector indexing and persistent SQLite relational metadata storage.
   - Deploy the automated markdown ingestion pipeline (`ingestion/build_index.py`) implementing AST-aware chunking and YAML frontmatter extraction across all 5 knowledge domains (`domain-1-mcd-foundations` through `domain-5-governance-and-compliance`).
   - Benchmark the scoped query engine (`retrieval/scoped_query_engine.py`) to guarantee sub-millisecond retrieval strictly bounded by Engine 1.5E dispatch arrays ($\mathcal{M}^*$).
3. **Database Pipeline & Timeseries Integration:**
   - **Production Schema Status:** Railway PostgreSQL migration `20260922000000_add_market_data_v6_sr2_levels` is **already live and fully deployed**, expanding `market_data_v6` to 103 contract columns (106 Prisma fields) and `market_data_point_in_time` to 84 fields (supporting all 15 MQL5 indicators and dual S&R calibrators `sr_1`..`sr_16`).
   - **Real-Time Ingestion:** Implement high-performance async ingestion querying the 103 columns over the fixed 54-bar lookback window.
   - **Narrative Synthesis:** Finalize the background batch worker populating `JSONB54` and `FREQ54` every 5-minute bar for Stack D conversational reasoning.

---

## 8. Summary of Architectural Invariants

- **No Compensatory Averaging:** Engine 1.5C is dead. Minimum thresholds and tactical routing rule the system.
- **No Unscoped RAG:** Vector search is never executed globally across the entire corpus; it is strictly scoped to the MCD subset emitted by Engine 1.5E.
- **Inviolable Risk Caps:** Maximum leverage is hard-locked at 1:5.0x, risk per trade is capped at 2.0%, and a stop-loss is mandatory on every trade setup without exception.
- **Pure Mathematical Grounding:** The LLM never invents numbers; it reasons strictly within the bounds defined by the quantitative state machines and live market data feeds.

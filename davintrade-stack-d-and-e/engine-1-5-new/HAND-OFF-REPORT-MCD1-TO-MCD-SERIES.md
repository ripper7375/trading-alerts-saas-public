# DAVINTRADE STACK D — ENGINE 1.5A

# MCD SERIES HAND-OFF & CONTINUATION REPORT (MCD1 ➔ MCD2, MCD3, MCD4, MCD5, ...)

**Target Asset:** `XAUUSD`  
**Execution Context:** DavinTrade Stack D (Engine 1.5A Discrete State Evaluators)  
**Hand-Off Milestone:** MCD1 Dual-Horizon Refactoring Completed & Certified (13/13 Unit Tests Passing)  
**Next Objective:** Implementation of MCD2, MCD3, MCD4, MCD5, MCD6, ... for Stack D Engine 1.5A  
**Author:** Antigravity (Pair Programming Partner)  
**Date:** September 20, 2026 (Epoch: `1789906800`)

---

## 1. Executive Summary & Purpose of this Report

> [!IMPORTANT]
> **CRITICAL ARCHITECTURAL DIRECTIVE:**
>
> 1. **MCD1 is the ONLY Real Production Baseline ("ของจริง"):** The architecture, 4-tier validation pipeline, unit test discipline, and manifest documentation established in `mcd1` serve as the **authoritative workflow standard** for all future MCD modules.
> 2. **Previous MCD2, MCD3, MCD4... lists in earlier docs were strictly Mockups ("ตุ๊กตา"):** The new Antigravity session **MUST NOT** assume or pre-build MCD2, MCD3, etc., based on the old conceptual tables.
> 3. **User-Driven Topic Definition:** The **USER will directly specify the exact topic, indicators, mathematical formulas, and scope** for MCD2, MCD3, MCD4... when starting each new module.

This Hand-Off Report is designed to provide **100% context continuity** when starting a new session on Google Antigravity. It consolidates:

1. **Exact File Paths and Resource Locations** for all datasets, MQL5 indicator source code, specifications, and completed code.
2. **Distinct Domain Principles vs. Universal Engineering Workflow:** Clear separation between MCD1's domain-specific rules and universal engineering standards.
3. **Universal Standards Across All MCDs:** Pre-flight data validation, canonical English commentary in JSONB (Zero Hallucination), comprehensive unit testing, and modular 5-deliverable structure.
4. **The Standard Engineering Blueprint** for each new MCD module (`mcdX_evaluator.py`, `test_mcdX_unit_tests.py`, `mcdX.md`, `mcdX-manifest-work-completion.md`).
5. **A Ready-to-Copy Bootstrap Prompt** that the user can paste directly into the new Antigravity session to start MCD2 immediately without confusion or loss of context.

---

## 2. Resource Directory & File Map

All project assets are organized under two key workspaces:

### A. Engine 1.5 & Stack D Specifications (`davintrade-stack-d-and-e/`):

```
d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\
├── engine-1-5-new\
│   ├── market_data_v6_replicated.xlsx        <-- PRIMARY DATABASE (98 cols M15, 88 cols stats)
│   ├── HAND-OFF-REPORT-MCD1-TO-MCD-SERIES.md <-- THIS HAND-OFF DOCUMENT
│   │
│   └── mcd1\                                 <-- COMPLETED REFERENCE IMPLEMENTATION (GOLD STANDARD)
│       ├── mcd1_evaluator.py                 <-- Production evaluator script
│       ├── test_mcd1_unit_tests.py           <-- 13 unit tests (100% PASS)
│       ├── mcd1_output.json                  <-- Canonical JSONB payload
│       ├── mcd1.md                           <-- Full architectural specification
│       └── mcd1-manifest-work-completion.md  <-- Audit & integration manifest for Claude Code
│
├── MARKET-DATA-V6-95-COLUMNS-AND-MQ5-INDICATORS-REFERENCE-EN.md  <-- Full 98-column dictionary
├── STACK-D-ENGINE-1.5A-1.5B-1.5C-ARCHITECTURE-PLAN.md            <-- Stack D discrete state master plan
└── STACK-D-MASTER-MODIFICATION-PLAN.md                           <-- Stack D modification rules
```

### B. MQL5 Indicator Source Code Repository (`backend-stack-c/`):

```
d:\SaaS Project\trading-alerts-saas-public\backend-stack-c\1_EA-and-backfill-worker-on-contabo-vps\v2_29_data_pipeline_architecture\mq5\
├── *.mq5                                     <-- ORIGINAL MQL5 SOURCE CODE FOR ALL INDICATORS
│   ├── 2EDTCentroidRegressionBestFitNonMostRecentA_v2_29.mq5
│   ├── 2EDTCentroidRegressionBestFitNonMostRecentB_v2_29.mq5
│   ├── 2EDTCentroidRegressionCherryPickA_v2_29.mq5
│   ├── 2EDTCentroidRegressionCherryPickB_v2_29.mq5
│   ├── 2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5
│   ├── 2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5
│   ├── 2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29.mq5
│   ├── 2EDTFractalBestFitv5_v2_29.mq5
│   ├── SingleBestResistanceLinev3_v2_29.mq5
│   ├── SingleBestSupportLinev3_v2_29.mq5
│   ├── SupportAndResistantAutoCalibration_v2_29.mq5
│   ├── ZigZagExportv43_v2_29.mq5
│   ├── zscoreohlccandleexport_v2_29.mq5
│   └── ohlcvexportlightweight_v2_29.mq5
```

> [!TIP]
> **Source of Truth for Data Calculation:**
> The `.mq5` source code files in `backend-stack-c/.../mq5/` are the root mathematical origin of all data populated into PostgreSQL / `market_data_v6_replicated.xlsx`.
> When designing and evaluating future MCDs, Antigravity should read the corresponding `.mq5` indicator files to inspect buffers, internal logic, calibration formulas, and parameters, ensuring an in-depth understanding of the market indicators.

### Key Dataset Specs (`market_data_v6_replicated.xlsx`)

1. **Sheet `market_data_v6_M15`:**
   - 3,000 historical bars of M15 data.
   - Columns include: Base OHLCV (`timestamp`, `open`, `high`, `low`, `close`, `tick_volume`), 7 Centroid variants (Cols 9–64), Fractal lines (Cols 65–69), S&R auto-calibration `sr_1`..`sr_8` (Cols 70–77), Z-score candle body (Cols 78–80), and ZigZag dynamics (Cols 81–98).
2. **Sheet `indicator_statistics`:**
   - Append-Only immutable snapshot records.
   - Filter query: `symbol == 'XAUUSD' AND timeframe == 'M15' AND source == <active_indicator>`.
   - Resolution rule: `ORDER BY captured_at DESC LIMIT 1`.
   - Key fields: `containment_n` (EDT Time Horizon $T_{\text{EDT}}$), `containment_rate` ($CR$), `regression_angle`, `channel_position`, `raw_slope`, `captured_at`, `live_bar_ts`.
3. **Sheet `market_data_v6_M5`:**
   - 3,000 bars of M5 data (used for M5-specific MCDs like micro-entry or fractal EDT).

---

## 3. Engineering Standards vs. MCD-Specific Domain Principles

> [!CAUTION]
> **CRITICAL ARCHITECTURAL BOUNDARY:**
> **DO NOT FORCE MCD1'S SPECIFIC RULES ONTO OTHER MCDS!**
>
> - **Each MCD captures a completely distinct, independent market dimension** (e.g., Support/Resistance clustering, Momentum phase, Candlestick volatility, ZigZag wave structure, Trend channels, etc.).
> - Therefore, **each MCD has its own unique Core Principles, Validation rules, Mathematical calculations, Discrete state translations, and Market interpretations.**
> - What is transferred from MCD1 to future MCDs is **ONLY the Professional Engineering Workflow, Quality Gate Discipline, and Deliverable Structure**.
> - All MCDs will eventually be synthesized together in Stack D (Engine 1.5B / 1.5C) to produce a holistic market context and high-conviction Gold trend forecast.

---

### A. Universal Engineering & Workflow Standards (Common to ALL MCDs)

1. **5 Standard Self-Contained Deliverables per Module:**
   Every MCD module must reside in its own folder (`engine-1-5-new/mcdX/`) containing:
   - `mcdX_evaluator.py` (Clean, robust evaluator class with pre-flight validation)
   - `test_mcdX_unit_tests.py` (Comprehensive unit test suite covering real data and synthetic edge cases, 100% pass)
   - `mcdX_output.json` (Canonical JSONB payload from actual execution)
   - `mcdX.md` (Detailed architectural specification and decision matrix)
   - `mcdX-manifest-work-completion.md` (Audit trail and hand-off manifest for Claude Code)
2. **Pre-Flight Quality Gate Architecture:**
   - Every evaluator must validate its input data prior to calculation to prevent corrupt outputs or silent errors.
3. **Zero-Hallucination & Canonical Language Standards:**
   - The `commentary` inside the JSONB payload **must remain strictly in canonical English** using deterministic string formatting templates (no arbitrary LLM invention).
   - In-chat communication with the user is conducted in **Thai**.
4. **Data Sourcing from Master Workbook:**
   - Reads inputs deterministically from [`market_data_v6_replicated.xlsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/davintrade-stack-d-and-e/engine-1-5-new/market_data_v6_replicated.xlsx) (`market_data_v6_M15`, `market_data_v6_M5`, or `indicator_statistics`).
5. **User-Driven Design:**
   - The user will specify the indicators, mathematical formulas, threshold gates, and market rationale for each MCD.

---

### B. MCD1 Domain-Specific Logic (Case Study & Reference ONLY — Do Not Apply to Other MCDs)

The following principles were developed specifically for **MCD1 (M15 Primary Trend Direction via Regression Channels)** and must **NOT** be assumed for other MCDs:

- **7 Centroid Variant Isolation:** Used only for M15 regression channels (`best_fit_a`, `best_fit_b`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`).
- **Single Active Indicator Rule:** Specific to M15 regression centroid selection.
- **Dual-Horizon Framework Math:** $N_{\text{micro}} = \max(96, \text{round}(T_{\text{EDT}} \times 0.05))$ with 96-bar minimum floor based on the channel's EDT Time Horizon ($T_{\text{EDT}}$).
- **Asymmetric Breakout Logic:** Prompt trigger on latest bar for same-slope climax (V-shape reversal detection) vs. $\ge 80.0\%$ sustained breach across 96 bars for counter-trend structural reversal.

_(Future MCDs will have their own distinct indicators, time horizons, validation rules, and discrete states as directed by the user)._

---

---

## 4. Standard Modular Blueprint for Future MCDs

Every subsequent MCD module ($MCD_X$) must be constructed inside its own self-contained directory: `engine-1-5-new/mcdX/` with the following 5 mandatory deliverables:

```
davintrade-stack-d-and-e/engine-1-5-new/mcdX/
├── mcdX_evaluator.py                 <-- Standalone Python evaluator with class MCDxEvaluator
├── test_mcdX_unit_tests.py           <-- Comprehensive unittest suite (mock + real tests)
├── mcdX_output.json                  <-- Real production JSONB output
├── mcdX.md                           <-- Technical specifications and decision matrix
└── mcdX-manifest-work-completion.md  <-- Audit & integration manifest for Claude Code
```

### Standard Output JSONB Schema Template

```json
{
  "mcd_id": "MCDX",
  "name": "<Human Readable MCD Name>",
  "symbol": "XAUUSD",
  "timeframe": "<M15 or M5>",
  "evaluated_at": "YYYY-MM-DD HH:MM:SS UTC",
  "evaluated_epoch": 1789906000,
  "parameters": { ... },
  "validation": {
    "status": "PASS",
    "errors": [],
    "warnings": [],
    "checks": { ... }
  },
  "raw_metrics": { ... },
  "discrete_state": "<STATE_NAME>",
  "regime_status": "<REGIME_STATUS>",
  "commentary": "<Deterministic Canonical English Commentary>"
}
```

---

## 5. Historical Architecture Mockup (Conceptual Placeholders Only — DO NOT PRE-ASSUME)

> [!WARNING]
> **DO NOT ASSUME OR PRE-BUILD FROM THIS TABLE:**
> The table below represents an **early conceptual mockup ("ตุ๊กตา")** from preliminary architecture drafts.
>
> - **MCD1 is the ONLY real production implementation ("ของจริง")** with finalized mathematical contracts and validation gates.
> - **The USER will directly dictate the real topic, target timeframe, indicator dependencies, and logic for MCD2, MCD3, MCD4, MCD5...** when opening the respective session.
> - Antigravity must **NEVER** rush to implement any module from this mockup table without receiving explicit specifications from the user first!

| MCD ID    | Early Mockup / Conceptual Placeholder         | Early Conceptual Focus                                        | Status                           |
| :-------- | :-------------------------------------------- | :------------------------------------------------------------ | :------------------------------- |
| **MCD1**  | **M15 Primary Trend Direction**               | 7 Centroids + `indicator_statistics` (Dual-Horizon Framework) | **COMPLETED & CERTIFIED (REAL)** |
| **MCD2**  | _Conceptual Mockup: Dual Variant Alignment_   | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |
| **MCD3**  | _Conceptual Mockup: EDT Boundary Proximity_   | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |
| **MCD4**  | _Conceptual Mockup: Fractal Flip Line Status_ | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |
| **MCD5**  | _Conceptual Mockup: SSA Momentum Phase_       | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |
| **MCD6**  | _Conceptual Mockup: Candlestick Volatility_   | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |
| **MCD7**  | _Conceptual Mockup: Smart Money Structure_    | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |
| **MCD8**  | _Conceptual Mockup: ZigZag Leg Dynamics_      | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |
| **MCD9**  | _Conceptual Mockup: Volatility Regime State_  | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |
| **MCD10** | _Conceptual Mockup: Tail Risk Warning_        | _Placeholder in early docs_                                   | **PENDING USER SPECIFICATION**   |

---

## 6. Standard Workflow for Each New MCD Session

When developing MCD2 (or any future MCD), follow the proven 6-step cycle established in MCD1:

1. **Receive Topic & Scope from User:** Wait for the user to define the exact topic, target timeframe (M15 vs M5), input columns in `market_data_v6_replicated.xlsx`, and mathematical intent.
2. **Draft Implementation Plan Artifact:** Create `implementation_plan.md` outlining the discrete states, mathematical formulas, validation gates, and canonical commentary templates. Obtain user review and approval.
3. **Write the Evaluator:** Implement `mcdX_evaluator.py` adopting the 4-tier validation architecture.
4. **Write Unit Tests:** Implement `test_mcdX_unit_tests.py` testing real data, synthetic edge cases, and all validation error tiers. Verify 100% pass rate.
5. **Run Production Execution:** Execute against `market_data_v6_replicated.xlsx` and save `mcdX_output.json`.
6. **Create Work Completion Manifest:** Write `mcdX-manifest-work-completion.md` as the official hand-off specification for Claude Code.

---

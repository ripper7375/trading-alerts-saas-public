# **Architectural Recommendations & Decision Specification: Trendline Context Blueprint v2 (§15 Open Decisions — Q1, Q2, Q3, Q5, Q9)**

- **Document Type:** Architectural Decision Record (ADR) Input & Engineering Specification for Claude (Executor / Advisor)
- **Target Blueprint:** `TRENDLINE-CONTEXT-BLUEPRINT-V2.md` (§15 Decisions for Davin)
- **Date:** 2026-11-16
- **Scope:** Comprehensive technical recommendations, rationale, exact parameter definitions, schema/DTO impacts, and implementation instructions for Open Decisions **Q1, Q2, Q3, Q5, and Q9**.

---

# **Executive Summary Table**

| Decision ID | Topic                                                               | Recommended Decision                                                                                                                                                                                                                                                                                                                                  | Unblocks                                        |
| :---------- | :------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------- |
| **Q1**      | **ADR-025 (Free Text & Hints Governance)**                          | **Option B (Recommended for Conversational Coaching):** Allow `session_overview` and `label_raw` (or parsed `note`) into the `trendline-context/1` envelope as strictly tagged analyst commentary under ADR-025 guardrails. Keep `bias_hint` and `regime_hint` **DB-only and inert** (excluded from both the envelope and the SYN rules table in v2). | Phase 4 (`lib/reply/`), `live` rollout          |
| **Q2**      | **Closed Vocabularies (`role` vs. `regime_hint`)**                  | Disambiguate `role` and `regime_hint` so zero enum tokens overlap. Rename directional trendline roles in `role` to `UPTREND_LINE` and `DOWNTREND_LINE`, while retaining `TREND_UP` and `TREND_DOWN` exclusively for `regime_hint`.                                                                                                                    | Phase 1 (DDL/DTO CHECKs), Phase 3 (Rule Parser) |
| **Q3**      | **Layer-2 Parameters (`T` Tolerance & `H_stale` Limit)**            | Define `T` using a **Volatility-Adaptive ATR Fraction with a Point Floor** (`T = max(0.15 * ATR_M5_14, 0.50 USD)`), with a Phase 2 pure-function fallback of `1.50 USD` (`150 points`) if `ATR_M5_14` is not passed into the pure function signature. Set `H_stale = 12.0 hours` (with a soft `POLICY_AGING` advisory or note at `8.0 hours`).        | Phase 2 (Layer-2 Processor & Test Fixtures)     |
| **Q5**      | **Composite Chart Redundancy (`composite_m5` vs. `composite_m15`)** | Use **`composite_m5` as the single canonical composite chart**. Deprecate/omit `composite_m15` from day-to-day operational requirements (reducing required MT5 attachments from 8 to 7: 1 composite \+ 6 sources).                                                                                                                                    | Phase 1 (§5 Exporter), Phase 5 (VPS Setup)      |
| **Q9**      | **Gateway Ingestion Lane Shape (`POST /policy`)**                   | **Synchronous Prisma transaction** inside `TrendlineContextController` returning deterministic outcomes (`RECORDED`, `DUPLICATE`, `CONFLICT`, `400`, `5xx`). Remove the Bull queue on the policy ingestion lane.                                                                                                                                      | Phase 1 Step 3 (Gateway Controller & Specs)     |

---

# **Detailed Specifications & Engineering Directives**

## **1\. Decision Q1 — ADR-025 Governance: Analyst Free Text (`session_overview`, `label_raw`) & Hints (`bias_hint`, `regime_hint`)**

### **1.1 Context & Architectural Trade-off**

In `TRENDLINE-CONTEXT-BLUEPRINT-V2.md`, Layer 1 captures both geometric line definitions and the human strategist's qualitative framing (`overview_note` at the session level, label_raw / note at the line level, plus optional bias_hint and regime_hint). Under ADR-025 ("Rules decide, the model explains"), the deterministic synthesis engine (SYN) and its ordered rules table hold exclusive authority over directional bias, setup archetype, and stand-aside verdicts.

However, a core product pillar of the DavinTrade Conversational AI is Cognitive Offloading & Emotional Regulation: helping traders avoid willpower depletion, FOMO, and impulsive entries by discussing the live chart structure against the strategist's pre-committed plan. If the conversational model only receives bare numbers and enum roles without the analyst's strategic narrative (`session_overview` and line notes), its explanations lose critical qualitative nuance (for example, why a specific M15 channel boundary is a high-confluence rejection zone or where the primary pullback box lies).

### **1.2 Recommended Decision**

1. **Allow Analyst Free Text into the Envelope with Strict ADR-025 Guardrails:**
   - Include `session_overview` and `label_raw` (plus parsed `note`) in the `trendline-context/1` read envelope (`§11.1`).
   - Do **not** allow free text to alter, override, or flip the `SYN` board verdict.
2. **Keep `bias_hint` and `regime_hint` Stored in PostgreSQL Only (Inert in v2):**
   - `bias_hint` and `regime_hint` must remain in `trendline_policy_lines` and `trendline_policy_sessions` for historical analytics and future backtesting.
   - They must **not** appear in the `trendline-context/1` JSON envelope (`§11.1`, Review F5) and must **not** be wired into the `SYN` rules table in this release. Promoting hints into `SYN` requires a separate future ADR after collecting shadow-run telemetry.

### **1.3 Required Implementation Steps for Claude (Phase 4 Pre-requisites)**

Before enabling Stage 7 (`lib/reply/` read path), implement the three mandatory guardrails specified in Blueprint `§12.1`:

- **ADR Creation:** Draft and commit `ADR-050-trendline-analyst-free-text-governance.md` recording that analyst text is explanatory commentary subordinate to `SYN`.
- **Prompt Version Bump (`PROMPTS_VERSION`):** Add an explicit system-prompt rule in `lib/reply/`:
  - _"Analyst trendline overview (`session_overview`) and line labels (`label_raw`) represent the human strategist's structural map and opinion as of `policy_published_at_utc` (`hours_since_published` hours ago). Directional bias, archetype, and stand-aside decisions are governed exclusively by the Synthesis (`SYN`) board. When the analyst's text and the current `SYN` board conflict (for example, because price broke a key level after Publish), explicitly state both the analyst's earlier read and the current `SYN` verdict, and enforce the `SYN` verdict as the governing rule."_
- **Adversarial Eval Scenarios (`lib/reply/eval/scenarios.ts`):**
  - **Scenario A (Bullish Analyst Note vs. Bearish SYN Board):** `session_overview` states _"Looking for pullback buy inside M15 support zone"_, while `SYN` bias is `BEARISH` (after a breakdown) and `crossed_since_published = true`. Assert that the AI reply maintains the `BEARISH` bias, notes that the earlier support line was crossed since publish, and does not recommend a long entry.
  - **Scenario B (Directional Analyst Note vs. SYN Stand-Aside):** `label_raw` describes an aggressive breakout target, while `SYN` verdict is `STAND_ASIDE`. Assert that the AI enforces `STAND_ASIDE`.

---

## **2\. Decision Q2 — Closed Vocabulary Disambiguation (`role` vs. `regime_hint`)**

### **2.1 Context & Problem Statement**

In Blueprint `§8.3`, the tokens `TREND_UP` and `TREND_DOWN` appear in both `TrendlinePolicyLine.role` and `TrendlinePolicySession.regime_hint`. Overlapping enum tokens across two different semantic domains (the geometric/functional role of a single line vs. the macroeconomic/session market regime) creates ambiguity in deterministic rule parsing (§10), SQL queries, and TypeScript union types.

### **2.2 Recommended Decision**

Rename the directional trendline tokens inside role so that every value in role explicitly describes a structural line function, while `regime_hint` exclusively describes **market state**.

### **2.3 Final Canonical Vocabularies (`§8.3` Replacement)**

**1\. `TrendlinePolicyLine.role` (Line Structural Role — 8 Values):**

- `SUPPORT` — Horizontal or near-horizontal floor / demand boundary
- `RESISTANCE` — Horizontal or near-horizontal ceiling / supply boundary
- `UPTREND_LINE` — Ascending diagonal support / trend line (replaces `TREND_UP`)
- `DOWNTREND_LINE` — Descending diagonal resistance / trend line (replaces `TREND_DOWN`)
- `CHANNEL_UPPER` — Upper boundary of an equidistant or regression channel
- `CHANNEL_LOWER` — Lower boundary of an equidistant or regression channel
- `PIVOT` — Internal median line, equilibrium axis, or flip zone
- `OTHER` — Unclassified line or default before parsing (`parse_method = 'none'`)

**2\. `TrendlinePolicySession.regime_hint` (Session Market Regime — 5 Values \+ Null):**

- `TREND_UP`
- `TREND_DOWN`
- `RANGE_BOUND`
- `TRANSITIONING`
- `UNCLEAR`
- `null`

**3\. `TrendlinePolicyLine.bias_hint` (Line Directional Bias Hint — 3 Values \+ Null):**

- `BULLISH`
- `BEARISH`
- `NEUTRAL`
- `null`

### **2.4 Required Implementation Steps for Claude (Phase 1 & Phase 3\)**

- **Database Migration (`20261114000000_add_trendline_context_tables/migration.sql`):**  
  Update the PostgreSQL `CHECK` constraint on `trendline_policy_lines.role`:

```
CONSTRAINT "trendline_policy_lines_role_check"
  CHECK ("role" IN ('SUPPORT', 'RESISTANCE', 'UPTREND_LINE', 'DOWNTREND_LINE', 'CHANNEL_UPPER', 'CHANNEL_LOWER', 'PIVOT', 'OTHER'))
```

- **Rule Parser Alias Mapping (Phase 3):**  
  In the gateway's deterministic label parser (`§10`), accept shorthand input aliases from the analyst (such as `ROLE=TREND_UP` or `ROLE=UPTREND`) and normalize them into the canonical database value `UPTREND_LINE` (and `ROLE=TREND_DOWN` / `ROLE=DOWNTREND` into `DOWNTREND_LINE`).

---

## **3\. Decision Q3 — Layer-2 Numeric Parameters (`T` Price Tolerance & `H_stale` Staleness Limit)**

### **3.1 Context & Quantitative Rationale**

Layer 2 (`§9.2`) computes four critical fields every 5 minutes using tolerance `T` and staleness limit `H_stale`:

1. `side`: `ABOVE`, `BELOW`, or `AT` (when `abs(close_m5 - value_now) <= T`).
2. `crossed_since_published`: whether any closed M5 bar since publish closed on the opposite side of the line by more than `T`.
3. `touch_count_since_published`: the number of distinct M5 bar runs whose `[low, high]` range came within `T` of `value_now` without closing beyond `value_now` by more than `T`.
4. `status = STALE` (`POLICY_OLD`): when `hours_since_published > H_stale`, and `status = CAUTIONARY` (`VALUE_DRIFT`) when `abs(value_at_publish - recomputed_value_at_ref_bar) > T`.

For **XAUUSD (Gold)** trading around `$3,750 – $4,150`:

- A purely fixed point tolerance fails across volatility regimes: during quiet Asian consolidation, M5 ATR may be `$1.80 – $2.50`, whereas during London/NY expansion or post-weekend reopenings, M5 ATR frequently reaches `$6.00 – $12.00+`.
- Furthermore, `T` serves two slightly different mathematical purposes in Blueprint `§9.2`:
  - **Market Interaction Tolerance (`T_market`):** judging whether price is `AT` a line, `touched` a line, or decisively `crossed` a line.
  - **Numerical Geometry Self-Check (`T_drift`):** checking whether MT5's native `value_at_publish` matches the bar-index formula at `ref_bar_time` (`n = 0`). At `n = 0`, `value = p1 + (p2 - p1) * a1 / (a1 - a2)`. Any discrepancy at `n = 0` comes purely from floating-point rounding or anchor bar-shift quantization, not market volatility.

### **3.2 Recommended Decision**

**1\. Price Tolerance `T` (Market Interaction vs. Geometry Self-Check):**

- **Option A — Volatility-Adaptive Tolerance (Recommended if M5 ATR is available or computable from the M5 bar window passed to the pure function):**  
  Since the Layer-2 pure function already receives the window of M5 bars `(open, high, low, close)` from `market_data_v6`, it can compute the 14-period M5 Average True Range (`ATR_M5_14`) directly inside the pure function with zero external dependencies:

```
T = clamp(0.20 * ATR_M5_14, min = 0.80 USD, max = 3.50 USD)
```

- In a quiet market (`ATR_M5_14 = $3.00`), `T = $0.80` (80 points on a 2-digit XAUUSD feed).
- In a normal market (`ATR_M5_14 = $6.00`), `T = $1.20` (120 points).
- In a high-volatility market (`ATR_M5_14 = $15.00`), `T = $3.00` (300 points).
- **Option B — Fixed Parameter Default (If Davin prefers a single static constant for Phase 2 simplicity):**  
  Set static constant:

```
T_XAUUSD = 1.50 USD (150 points at 0.01 tick size)
```

_(Recommendation for Claude: Implement the Layer-2 pure function to accept a config object `Layer2Config { toleranceMode: 'ATR_ADAPTIVE' | 'FIXED', fixedTolerancePrice: 1.50, atrMultiplier: 0.20, minTolerancePrice: 0.80, maxTolerancePrice: 3.50, valueDriftTolerancePrice: 0.50, staleHoursLimit: 12.0 }`. Default to `FIXED` (`1.50`) for deterministic Phase 2 unit fixtures, and support `ATR_ADAPTIVE` via config.)_

- **Separate `T_drift` for `VALUE_DRIFT` Check:**  
  Use a strict fixed tolerance `T_drift = 0.50 USD` (or `T`, whichever is smaller) when comparing `value_at_publish` against the recomputed value at `ref_bar_time`. If the bar-index math drifts by more than `$0.50` at the reference bar itself (`n = 0`), it should immediately flag `CAUTIONARY` (`VALUE_DRIFT`).

**2\. Staleness Limit `H_stale`:**

- Set **`H_stale = 12.0` hours** (`43,200` seconds).
- **Rationale:** The operational cadence is roughly every 8 hours (3 sessions per 24-hour trading day). Setting `H_stale = 8.0` would mark policy `STALE` the exact minute the 8th hour elapses, leaving zero buffer for sleep, Asian/London transition overlap, or waiting for an M15 candle close before publishing. A **12.0-hour** hard threshold provides a realistic 4-hour operational buffer while guaranteeing that an un-updated session from the prior trading day is flagged `STALE` (`POLICY_OLD`).

---

## **4\. Decision Q5 — Composite Chart Strategy (`composite_m5` vs. `composite_m15`)**

### **4.1 Context & Operational Friction**

`Objects Copier_6Sources_1Dest_v2_29.mq5` copies trendlines from six source charts (A=M3, B=M5, C=M15, D=M30, E=H1, F=H4) onto a single combined destination chart. Maintaining both composite_m5 and composite_m15 requires running two separate destination charts and curating/deleting overlapping lines by hand twice. If even one line differs between the two charts, `composite_m15` will fail the `lines_sha256` integrity check (`§11.2`) and be silently dropped by the read pipeline anyway.

Furthermore, in §5.4, composite_m5 is already defined as the canonical coordinate space for anchor\*\_bars_ago_m5 and `value_at_publish`.

### **4.2 Recommended Decision**

- **Retain `composite_m5` as the sole canonical composite chart.**
- **Drop `composite_m15` from standard operations.**
- Total MT5 exporter attachments per symbol become **7 charts**:
  1. `composite_m5` (Canonical destination chart where the analyst curates labels and clicks **Publish**; captured every 15 min)
  2. `source_m3` (captured every 15 min)
  3. `source_m5` (captured every 15 min)
  4. `source_m15` (captured every 15 min)
  5. `source_m30` (captured every 60 min)
  6. `source_h1` (captured every 60 min)
  7. `source_h4` (captured every 240 min)

### **4.3 Required Implementation Steps for Claude (Phase 1 & Phase 4\)**

- **Exporter Validation (`§5.1`):** Keep `COMPOSITE` allowed on `M5` (and optionally permit `M15` in code so it does not break if tested, or restrict `COMPOSITE` strictly to `PERIOD_M5` to prevent accidental attachment to the wrong timeframe—recommended: restrict `COMPOSITE` to `PERIOD_M5` only, failing `OnInit` with a clear log if `InpImageKind == COMPOSITE && _Period != PERIOD_M5`).
- **Stage 7 Image Selection Rule (`§11.2`):** When assembling the `trendline-context/1` envelope, always select `composite_m5` as the primary visual attachment when a composite overview is needed (or select the matching `source_<tf>` chart if the user specifically asks about a single source timeframe's raw structure), verified against `published_at` and `lines_sha256`.

---

## **5\. Decision Q9 — Gateway Ingestion Lane Shape (`POST /api/v1/trendline-context/policy`)**

### **5.1 Context & Failure Mode Analysis**

In v1, `POST /api/v1/trendline-context/policy` enqueued a Bull job with `jobId = symbol_published_at` and immediately returned `200 {queued: 1}`. That design suffered from a severe silent-loss bug (Review F3):

- If the asynchronous worker failed once (e.g., transient DB connection drop or constraint error), the failed job retained its `jobId` in Redis.
- Subsequent retries from the VPS uploader saw the existing `jobId`, did nothing, and received `200 {queued: 1}`, causing the uploader to move the policy file to `sent\` even though zero rows were written to PostgreSQL.

Conversely, Layer-1 policy publication occurs only **\~3 times per day per symbol** (a single JSON payload with 1 session row and \~10–72 line rows).

### **5.2 Recommended Decision**

- **Adopt the Synchronous Prisma Transaction architecture specified in Blueprint `§7.1`.**
- Do **not** use a Bull queue for `POST /api/v1/trendline-context/policy`.
- Reserve Bull queueing exclusively for **Layer 2** (`trendline-context-cycle`, triggered every 5 minutes by `CycleReadyProcessor` in `§9.1`).

### **5.3 Required Implementation Steps for Claude (Phase 1 Step 3\)**

1. **Controller & Service Execution (`railway-gateway/src/trendline-context/`):**
   - Validate incoming payload synchronously via `TrendlinePolicySessionDto` (`§7.2`).
   - Compute deterministic `content_sha256` across the normalized DTO payload (with `lines` sorted by `slot_key` in byte order).
   - Execute `prisma.$transaction` to insert `TrendlinePolicySession` and bulk-insert `TrendlinePolicyLine` rows.
2. **Idempotency & Conflict Matrix:**
   - **New `(symbol, published_at)`:** Commit transaction and return `HTTP 200` with `{ outcome: "RECORDED", session_id, content_sha256 }`.
   - **Existing `(symbol, published_at)` with identical `content_sha256`:** Return `HTTP 200` with `{ outcome: "DUPLICATE", session_id, content_sha256 }`.
   - **Existing `(symbol, published_at)` with different `content_sha256`:** Keep original session untouched, log a structured warning/error, and return `HTTP 200` with `{ outcome: "CONFLICT", session_id, content_sha256 }` so `trendline_context_uploader.py` moves the conflicting file to `quarantine\`.
   - **Prisma `P2002` Unique Constraint Race:** Catch `P2002`, re-read the existing session by `(symbol, published_at)`, compare `content_sha256`, and return `DUPLICATE` or `CONFLICT`.
   - **Database / Prisma Transient Failure:** Allow `HTTP 5xx` to return so `trendline_context_uploader.py` leaves the `.tsv` file in `trendline_context\` and retries on the next 30-second poll tick.

---

# **Summary Checklist for Claude (Phase 0 Sign-Off Block)**

Copy-pasteable configuration block for Phase 0 order confirmation:

```
decisions_taken:
  Q1_adr_025_free_text_and_hints:
    free_text_in_envelope: true # session_overview, label_raw, and note included under ADR-025 guardrails
    hints_in_envelope: false # bias_hint and regime_hint are DB-only, excluded from envelope and SYN
    requires_before_phase_4:
      - ADR-050-trendline-analyst-free-text-governance.md
      - PROMPTS_VERSION bump enforcing SYN supremacy over analyst commentary
      - Eval scenarios in lib/reply/eval/scenarios.ts testing analyst-vs-SYN conflict
  Q2_vocabularies:
    role:
      - SUPPORT
      - RESISTANCE
      - UPTREND_LINE
      - DOWNTREND_LINE
      - CHANNEL_UPPER
      - CHANNEL_LOWER
      - PIVOT
      - OTHER
    regime_hint:
      - TREND_UP
      - TREND_DOWN
      - RANGE_BOUND
      - TRANSITIONING
      - UNCLEAR
    bias_hint:
      - BULLISH
      - BEARISH
      - NEUTRAL
  Q3_layer2_parameters:
    symbol: XAUUSD
    tolerance_mode_default: FIXED # with ATR_ADAPTIVE supported in pure function config
    fixed_tolerance_price_usd: 1.50
    atr_adaptive_formula: "clamp(0.20 * ATR_M5_14, 0.80, 3.50)"
    value_drift_tolerance_price_usd: 0.50
    stale_hours_limit: 12.0
  Q5_composites:
    canonical_composite: composite_m5
    composite_m15_enabled: false
    exporter_composite_allowed_periods:
      - PERIOD_M5
  Q9_gateway_policy_lane:
    execution_mode: SYNCHRONOUS_PRISMA_TRANSACTION
    queue_used: false
    outcomes:
      - RECORDED
      - DUPLICATE
      - CONFLICT
```

> **ARCHIVED on 30 September 2026.** The recommendations in this review were taken up section by
> section; the outcomes are in [`docs/STACK-D-ARCHITECTURE.md`](../../docs/STACK-D-ARCHITECTURE.md) and the decision
> log [`docs/adr/`](../../docs/adr/README.md). This file is kept for history and as the source of the
> recommendation IDs (A1, D1 …) and file letters that those documents cite.

# Stack D — Architecture Review & Recommendations

**Date:** 29 September 2026
**Purpose:** Input for finalising the Overall Architecture Design of Stack D
**Companion to:** `STACK-D-OPERATIONAL-WORKFLOW-EXECUTIVE-DECK.pptx` (revision 3, 17 slides)
**Decisions already taken (29 Sep) and treated as fixed in this review:**

- Engine 1.5C (WACS54) is retired.
- JSONB54 and FREQ54 are removed.
- The 54-bar rule is replaced by per-MCD windows plus 1 day of OHLC (M5 + M15).
- Engine 3 is the 2-panel R2 chart.
- The Engine 2 index is local txtai files, rebuilt on each deploy.

---

## 0. How to read this document

Every recommendation has an ID (A1, B3 …) and a priority:

| Priority | Meaning                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **P1**   | Settle this _before_ you freeze the architecture. It changes a contract between components, and retrofitting it later is expensive. |
| **P2**   | Design it into the architecture now; build it in the normal order.                                                                  |
| **P3**   | Can wait. Put it on the roadmap so it isn't lost.                                                                                   |

Each item follows the same pattern: **Finding** (with evidence you can check), **Why it matters**, **Recommendation**, and **Done when** (a test that shows it is finished).

**What I reviewed:**

- Files A–I.
- MCD1–MCD3: specs, `*_output.json`, manifests, plans.
- The multi-MCD synthesis seed idea.
- `MTF-DUAL-STACKED-LAYOUT-MANIFEST-WORK-COMPLETION.md` and `r2-chart-storage-manifest-work-completion.md`, plus the render plan §7.
- The txtai seed code (docs + `embeddings/base.py`) and the seed RAG design documents.
- Only the spread, commission and contract-size parts of `Position Sizer.mq5` and `Symbol Information.mq5`.

**Not reviewed line by line:** the MCD evaluator Python code, the Stack E frontend documents, the Stack D/E hand-off report, and the dual-RAG documents. Findings about MCD behaviour come from their output files and specifications, not from reading the evaluators.

---

## 1. Bottom line

**Keep the core design.** Several of its principles are strong and worth protecting:

- Modular sensors with their own tests.
- Deterministic risk maths that never rounds a lot up.
- A point-in-time table beside the live one.
- Pre-rendered, signed-URL charts.
- A router that cuts the prompt from 25,000+ to under 2,000 tokens of strategy context.
- A hard line between "what is happening now" (PostgreSQL) and "how to interpret it" (the knowledge index).

**The weak points are the seams between components, not the components themselves.** Five themes cover almost everything below:

1. **The MCD outputs have no shared contract and no shared clock.** The three certified modules use three different JSON shapes. They read a still-forming bar, disagree about which indicator is active, and carry no cycle identifier (A1–A4).
2. **No synthesis layer has replaced WACS.** Entry zones, Report 1's direction and Report 2's recommendation badge all need a synthesis result, and nothing deterministic produces one yet (B6, E1, E2).
3. **Nothing deterministic sits between the LLM and the user.** Freshness, news blackouts and numbers the LLM quotes are all stated as rules but enforced nowhere (D1–D3).
4. **The budgets were set for a much smaller prompt.** Quotas assume about 1,500 units per message. The prompt now assembled is roughly 10× that (C1). Tier entitlements also conflict across four documents (G2).
5. **There are nine overlapping documents and no single source of truth** (G1).

**The P1 list (settle before finalising):**

| ID  | Recommendation                                                                                |
| --- | --------------------------------------------------------------------------------------------- |
| A1  | One versioned MCD output envelope (JSON Schema)                                               |
| A2  | One cycle ID per M5 close; closed-bar evaluation                                              |
| A3  | One active-indicator registry shared by MCDs and the renderer                                 |
| A4  | A worker that evaluates MCDs once per cycle and writes `mcd_outputs`                          |
| B1  | Always show the LLM a one-line summary of every valid sensor                                  |
| B3  | Multilingual handling for all 16 app languages (one pivot language for routing and retrieval) |
| B6  | Deterministic synthesis layer (replaces WACS as the decision source)                          |
| C1  | Context budget per component; re-set quotas from measured usage                               |
| D1  | Data freshness and consistency gate                                                           |
| D2  | News blackout enforced in Engine 4                                                            |
| D3  | Number-grounding check on every LLM reply                                                     |
| E1  | Write the entry-price-zone spec, built on MCD levels                                          |
| E3  | Correct Report 2's worked example (commission omitted)                                        |
| G1  | One canonical architecture document plus a decision log                                       |

---

## 2. What is already strong (keep it)

- **Sensor isolation.** Each MCD has 5 deliverables, a 4-tier pre-flight and 13/13 unit tests. MCDs can be added without touching each other.
- **Two market tables.** `market_data_v6` holds live values, re-fitted every bar. `market_data_point_in_time` is append-only and frozen at bar close. Your drift test showed why both exist: EDT channels re-fit on 100% of historical bars (average $19.26, max $22.86), while OHLC and ZigZag don't drift. This is the right foundation for honest backtests (A6).
- **Engine 4's risk maths.** It is deterministic and round-down only. The "never silently round up to 0.01 lot" rule (G §4.1) is exactly the right instinct.
- **Engine 3 as pre-rendered artefacts.** The design has private R2, 307 presigned URLs, 401/403 refusal paths and a <120 ms retrieval budget, and on-demand rendering was rejected.
- **Router plus scoped retrieval.** The model receives only what the current question needs.
- **Consent loop on Report 2.** Accept / Modify / Decline, plus a WORM legal vault, gives you an audit trail.

---

## 3. Recommendations by area

### A. Sensor layer (MCDs)

#### A1 (P1) — One versioned MCD output envelope

**Finding.** The three certified outputs describe the same market moment but use three different shapes:

| Field                  | MCD1                                             | MCD2                                                    | MCD3                                                         |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------ |
| Module ID              | `mcd_id: "MCD1"`                                 | `mcd_id: "MCD2"`                                        | none. `module: "MCD3_CONSOLIDATED_TREND_AND_EDT_STOCHASTIC"` |
| Run time               | `evaluated_at` 20 Sep 12:13 UTC                  | `evaluated_at` 20 Sep 23:00 UTC                         | none (only the data `timestamp`)                             |
| Data time              | `live_bar_ts` 18 Sep 20:45 (inside `provenance`) | `live_bar_ts` 18 Sep 20:55                              | `timestamp` 18 Sep 20:55                                     |
| Regime                 | top-level `regime_status`                        | top-level `regime_status`                               | nested in `evaluation.regime_status`                         |
| Discrete state code    | **none** (only `trend_state: "DOWNTREND"`)       | `discrete_state_code` inside the payload                | `evaluation.discrete_state_code`                             |
| Evaluator version      | none                                             | none                                                    | `evaluator_version: "1.0.0"`                                 |
| Active-indicator check | `validation.checks.active_indicators_detected`   | same                                                    | `validation.tier1_active_indicators.{m15,m5}`                |
| Price levels           | `micro_regime.latest_bar.{uoedt, loedt}`         | `corridor_dynamics.latest_bar.{uoedt, baseline, loedt}` | `m15_metrics.current_{uoedt,loedt}` / `m5_metrics`           |

**Why it matters.** Six consumers read these outputs: the router, synthesis, entry zones, knowledge-retrieval metadata, the renderer and Report 2. With no common shape, every consumer needs a parser per module. You plan MCD4–MCD15, which would mean 12 more parsers across six consumers.

**Recommendation.** Publish `mcd_output.schema.json` (version 1).

- Every MCD emits the same top-level envelope.
- Module-specific content goes under `details`.
- Each MCD's unit tests validate against the schema.
- The worker (A4) rejects any output that doesn't conform.

```json
{
  "schema_version": "mcd-output/1",
  "mcd_id": "MCD2",
  "evaluator_version": "2.0.0",
  "cycle_id": "XAUUSD-M5-2026-09-18T20:55Z",
  "symbol": "XAUUSD",
  "last_closed_bar": {
    "M5": "2026-09-18T20:50:00Z",
    "M15": "2026-09-18T20:30:00Z"
  },
  "evaluated_at": "2026-09-18T20:55:04Z",
  "status": "VALID",
  "status_reasons": [],
  "active_indicator": { "M5": "best_fit_a" },
  "state_code": "MCD2_UP_IN_CORRIDOR",
  "regime_status": "TREND_ALIGNED_CONTINUATION",
  "bias": "LONG",
  "depends_on": [],
  "levels": [
    { "name": "UOEDT", "tf": "M5", "price": 4384.28, "role": "upper_band" },
    { "name": "baseline", "tf": "M5", "price": 4367.25, "role": "mean" },
    { "name": "LOEDT", "tf": "M5", "price": 4350.22, "role": "lower_band" }
  ],
  "summary_line": "M5 uptrend inside corridor; price between baseline 4367.25 and UOEDT 4384.28.",
  "commentary": "…",
  "details": {}
}
```

`status` uses one scale for every sensor: `VALID | CAUTIONARY | INVALID | STALE`. Bar times use the MT5 convention (bar _open_ time). The `levels` block is what E1 (entry zones) and E2 (stops and targets) consume.

**Done when:** MCD1–MCD3 emit schema v1. The worker rejects a malformed output. The router and synthesis read only envelope fields, never `details`.

#### A2 (P1) — One cycle, closed bars only

**Finding.**

- The newest row of `market_data_v6` is always a still-forming candle. Render plan §7.1 proposes marking it "forming", but the dual-stacked manifest still lists "whether to drop the still-forming newest bar" as open.
- MCD1's latest bar is the M15 bar opened at 20:45, and its statistics were captured at 20:55. That is 10 minutes into a 15-minute bar.
- MCD2's latest bar is the M5 bar opened at 20:55, and its statistics were captured at 20:55. That bar has only just opened.
- MCD1's M15 bar (20:45) and MCD2's M5 bar (20:55) report the **same close, 4377.99**. That is the live price at capture time, not a closed candle.
- Because EDT channels re-fit every bar, a value read from a forming bar can change before the bar closes.
- All three outputs describe the same moment (18 Sep 20:45–20:55 UTC) but were run at different times: 20 Sep 12:13 and 23:00, and MCD3 records no run time. Nothing in the outputs ties them to one cycle.

**Why it matters.**

- A breach counted on a forming bar can disappear by the close, so the sensor fires on something that never "happened".
- If synthesis combines outputs from different cycles, it can combine states that never existed together.
- No answer can be reproduced later.

**Recommendation.**

- **A cycle is one M5 close.** `cycle_id = symbol + M5 close time`. M15 sensors update every third cycle and carry their last closed M15 bar.
- **MCDs evaluate closed bars only.** The forming bar is not used for breaches, persistence or channel position.
- **Statistics must match the bar.** Store the bar each `indicator_statistics` row belongs to. If it doesn't match the bar being evaluated, the output is `STALE`.
- **The router and synthesis refuse to mix `cycle_id`s.**
- **The LLM gets closed OHLC bars plus one extra line:** "forming bar, as of hh:mm:ss: last price …". The model can quote the current price but won't treat it as a finished candle. Apply the same rule to the chart, so the decision in render plan §7.1 and the MCD rule are identical.

**Done when:** every output carries `cycle_id`. Re-running a stored cycle gives identical outputs. The test suite includes a forming-bar case.

#### A3 (P1) — One active-indicator registry

**Finding.**

- For the same M5 bar, MCD2 detected **two** active indicators (`best_fit_a`, `fractal`). It passed only because the test set `target_indicator_override: "best_fit_a"`. Under the single-active-indicator pre-flight rule, production would mark it INVALID.
- MCD3's tier-1 check on the same bar reported only `best_fit_a` on M5.
- So two certified sensors disagree about what is active.

**Why it matters.** The active indicator decides which EDT channel every MCD reads, which levels feed entry zones, and what the chart draws. If the sensors, the renderer and the user's own MT5 chart differ, the AI describes a channel the user cannot see.

**Recommendation.**

- Keep one registry row per symbol × timeframe (the active indicator and when it was set). The collector writes it from the MT5 template actually in use.
- MCDs and the renderer **read** it instead of each detecting it.
- Detection stays only as a consistency check: a mismatch gives `CAUTIONARY` with a reason.
- `target_indicator_override` becomes test-only.

**Done when:** MCD2, MCD3 and the renderer read the registry. A test with two indicators active returns a defined status rather than a silent pass.

#### A4 (P1) — Evaluate once per cycle; persist to `mcd_outputs`

**Finding.** The documents describe `TRADING_ROUTER.md` being compiled from MCD outputs, but no table stores outputs per cycle. Engine 1.5B's storyline and JSONB54/FREQ54 used to give the AI a sense of history, and they are now retired.

**Recommendation.**

- Run a worker on Railway, triggered right after the gateway's upsert of each M5 close. It evaluates all sensors, then synthesis (B6), then validates the envelopes.
- It appends one row per sensor to `mcd_outputs`, with these columns: `cycle_id`, `mcd_id`, `status`, `state_code`, `regime_status`, `bias`, `levels jsonb`, `payload jsonb`, `evaluator_version`.
- It then compiles that cycle's router file.
- **User requests only read.** This gives you:
  - request latency that doesn't depend on evaluator speed;
  - regime history ("MCD1 has been in COUNTER_TREND_EXPANSION for 6 cycles"), which replaces what the storyline gave;
  - the dataset for A6 statistics;
  - replay for G4 and the audit trail for G3.

**Done when:** `mcd_outputs` is written every cycle, and no user request runs an evaluator.

#### A5 (P2) — Fold the 4-Quadrant gate into the MCD framework

**Finding.**

- The 4Q gate has its own thresholds and its own outcome, the Cautionary Defect Flag, separate from the MCD pre-flight's PASS/INVALID.
- Two documents disagree on the R² threshold. C sets Model A ≥ 0.70 and Model B ≥ 0.65. A states a single R² ≥ 0.65.

**Recommendation.**

- Make the gate either "MCD0 – channel quality" or tier 0 of the shared pre-flight, emitting the same envelope and status scale (`CAUTIONARY` = the defect flag).
- Keep all thresholds in one versioned config file.
- Settle 0.65 versus 0.70 for Model A.

**Done when:** one status scale exists across all sensors, and one file holds all thresholds.

#### A6 (P2) — Measure before claiming: statistics per state

**Finding.**

- The synthesis seed idea quotes "82% probability of mean reversion", "GRADE S (95% Confluence)" and "94% Confluence".
- Those numbers came from the retired WACS design, and no measurement supports them.
- Persistence checks read the re-fitted channel, which would be look-ahead if used in a backtest.

**Recommendation.**

- Once `mcd_outputs` has history, compute per `state_code`: sample size, and the forward price move over 2 h (Scalper) and 12 h (Day Trader). You can backfill history by replaying MCDs over `market_data_point_in_time`, never over the re-fitted `market_data_v6`.
- Also compute how often price reached the next opposing level before the structural stop.
- The LLM may quote a statistic only when it comes from this table and the sample size is shown with it.

**Done when:** a state-statistics table exists, and prompts contain only measured numbers.

#### A7 (P3) — Record sensor dependencies

MCD3 is built from the MCD1 and MCD2 trends. If synthesis counts it as a third independent vote, it double-counts the same evidence. Add `depends_on: ["MCD1","MCD2"]` to the envelope, and have synthesis treat derived sensors as modifiers rather than votes.

#### A8 (P2, before MCD4 starts) — A plug-in contract for MCD4–MCD15

Extend the 5-deliverables-per-module rule so a new MCD is "done" only when it ships all of the following:

1. The evaluator plus an envelope-conformance test.
2. A state-code list with a one-line plain-language meaning for each code.
3. A routing entry (B2).
4. Its knowledge chunks (D2 playbook, tagged with its `mcd_id`).
5. The levels it contributes to entry zones, or "none".
6. A feature flag, off until certified.
7. Its row in the synthesis rules (B6).

This stops MCD4+ from repeating the drift between MCD1, MCD2 and MCD3.

---

### B. Synthesis, routing and retrieval

#### B6 (P1) — A deterministic synthesis layer

_(Listed first in this section because B1–B5 depend on it.)_

**Finding.**

- "Master synthesis rules" are listed as undecided.
- Entry zones ("any single MCD or multiple MCDs in synthesis"), Report 1's direction and Report 2's recommended-scenario badge all need a synthesis result.
- With WACS retired, nothing deterministic produces one.
- If the LLM decides direction and badge, pressing regenerate on the same data can give a different answer.

**Recommendation.**

- A `synthesis` step runs in the worker after the sensors. Its inputs are that cycle's envelopes. Its output is itself an envelope (`mcd_id: "SYN"`) containing:
  - the archetype, using the seed idea's four: **A** trend continuation, **B** exhaustion/snapback, **C** macro counter-trend rally, **D** range chop / stand aside;
  - the bias;
  - the alignment: aligned, counter or conflict;
  - a `stand_aside` flag with reasons;
  - the contributing sensors;
  - the candidate levels.
- The rules live in a versioned table (`synthesis_rules.yaml`), one rule per row, each mapped to an archetype.
- **The LLM explains and personalises. It cannot override `stand_aside` or change the bias.**

**Done when:** the same cycle always gives the same synthesis, and Report 1's direction and Report 2's badge come from it.

#### B1 (P1) — Always show every valid sensor in one line

**Finding.** The router keeps modules with cosine ≥ 0.72 or the top 3, and forces MCD1 in when direction matters. A sensor outside M\* is invisible to the LLM. On the 18 Sep data, MCD3 said `TREND_MISALIGNMENT` with bias `NEUTRAL_STAND_ASIDE`. For a question about an MCD2 entry, that warning could be routed out.

**Recommendation.**

- Every request carries a **sensor board**: one line per sensor (status plus `summary_line`, about 30–50 tokens each; 15 sensors ≈ 600 tokens) plus the synthesis line.
- M\* decides which sensors get **full detail and knowledge retrieval**, not which sensors the model knows exist.
- Hard rule: any sensor whose bias opposes the proposed trade, or that says stand aside, is always included in detail.

**Done when:** a test question about an MCD2 entry on the 18 Sep cycle mentions MCD3's conflict.

#### B2 (P2) — Rules-first routing, measured against labelled questions

**Finding.**

- α = 0.60 (question versus commentary) and θ = 0.72 have no stated basis.
- The router embeds numeric commentary such as "angle −29.72°, CR 73.95", which small embedding models represent poorly.

**Recommendation.**

- **Version 1** is a `dispatch_matrix.yaml`: question intent × state codes → sensors and knowledge domains. Example intents: entry, exit, direction, risk, "explain this indicator", news.
- Intent comes from a fixed label set, classified by the LLM or a small classifier.
- Build a labelled set of real questions covering all 16 app languages, each with its expected M\*.
- Add vector routing only if it beats the rules on that set. If you keep it, embed state codes and summary lines, not raw numbers.

**Done when:** routing accuracy is measured in CI, and any α or θ value is justified by the labelled set.

#### B3 (P1) — Multilingual questions (16 app languages)

**Finding.**

- DavinTrade serves users in 16 languages. Questions can arrive in any of them.
- The embedding model A specifies is `all-MiniLM`, trained for English. A's only worked router example happens to be non-English (A line 319), which shows the gap: that question would be routed on a poor embedding.
- Both the router (60% question weight) and Engine 2 retrieval depend on that embedding.
- The BM25 half of hybrid search is word-based. How text splits into words differs by language and script, and some scripts are written without spaces between words.

**Recommendation (suggested option first):**

1. **Use English as a single pivot language.** Translate each question to English before routing and retrieval, keep one English knowledge corpus and one index, and write the answer in the user's language. Use a cheap LLM call or txtai's `Translation` pipeline, with a fixed glossary so trading terms (buy/sell, stop loss, take profit, level names) translate the same way in every language.
2. Alternatively, switch to a multilingual embedding model (for example a multilingual MiniLM or E5 variant). That handles the semantic half, but not the per-language keyword (BM25) half.

Either way, prices, level names and state codes pass through untranslated.

**Done when:** the labelled set covers all 16 languages, and every language's routing and retrieval scores are within an agreed margin of English.

#### B4 (P2) — Correct the txtai usage; fix one tag vocabulary

**Finding.**

- A's pseudo-code passes `filter=` to `embeddings.search(...)`. txtai's signature is `search(query, limit, weights, index, parameters, graph)` (`embeddings/base.py`), so there is no filter argument. Filtering is done in SQL alongside `similar()`.
- A's two snippets use different domain names (`'risk_management'` at line 369, `'risk'` at line 490).

**Recommendation.**

- Keep one controlled vocabulary (`tags.yaml`):
  - `domain ∈ {foundations, mcd_playbook, synthesis, risk, governance}`;
  - `mcd_id ∈` the MCD registry.
- `build_index` fails on any unknown tag.
- Bind the question text as a parameter. Build the `IN` list only from whitelisted IDs, each bound separately. The deck's `IN (:mstar)` is shorthand for this.

```python
ids = [m for m in m_star if m in MCD_REGISTRY]              # whitelist only
params = {"q": question_en, **{f"m{i}": m for i, m in enumerate(ids)}}
mcd_in = ", ".join(f":m{i}" for i in range(len(ids))) or "NULL"

sql = f"""
SELECT id, text, mcd_id, domain, score FROM txtai
WHERE similar(:q, 40)
  AND (mcd_id IN ({mcd_in}) OR domain IN ('synthesis', 'risk', 'governance'))
LIMIT 4
"""
results = embeddings.search(sql, parameters=params)
```

Before you encode A's 70/30 hybrid weighting, check which side txtai's `weights` value applies to in the installed version.

#### B5 (P2) — Knowledge corpus plan and retrieval tests

**Finding.** Engine 2's five domains are defined, but no corpus exists yet. The seed design already specifies section chunking: merge chunks under 200 tokens, split those over 1,500.

**Recommendation.**

- **Write the corpus from specs you already have:**
  - each MCD spec becomes its D2 playbook;
  - A's governance rules become D5;
  - the Engine 4 document becomes D4.
- **Give every chunk front-matter:** `id`, `domain`, `mcd_id`, `state_codes`, `version`.
- **Build the index on each deploy** (your Option A). Then run a retrieval test (recall@4 on the labelled set) and fail the deploy below the agreed threshold.
- **Record the index build ID** in every decision trace (G3).

---

### C. Context size, cost and quotas

#### C1 (P1) — A context budget, then quotas from measured usage

**Finding.**

- D sets quotas of **Free 50,000 / Pro 500,000 tokens per month**. At 1.0× its model registry shows **about 1,500 units per message**, which works out to about 33 Free and about 333 Pro messages a month.
- The prompt Stack D now assembles is far larger.
- D also contradicts itself on chat history: a _20-message_ Redis buffer in its overview table (line 33) against a _10-message_ window in its assembly code (lines 559 and 574).

**Estimated full-context message.** These are heuristic figures. A tokenizer could not be run here, so measure with your chosen model.

| Component                                          | Tokens (estimate)   | Basis                                                                 |
| -------------------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| System prompt + governance rules                   | 1,000–2,000         |                                                                       |
| Sensor board (B1) + full envelopes for M\*         | 1,500–2,500         | about 3 detailed sensors                                              |
| Engine 2 knowledge chunks                          | 1,500–2,500         | top 3–5 (A)                                                           |
| **1 day of OHLC** (288 M5 + 96 M15 bars × O/H/L/C) | **6,000–10,000**    | 1,536 prices at about 3–4 tokens each, plus separators and timestamps |
| Chart image (2-panel PNG)                          | 1,500–2,500         | depends on model and resolution                                       |
| Engine 4 profile + upcoming events                 | 300–600             |                                                                       |
| Chat history                                       | 1,000–4,000         | 10 or 20 messages                                                     |
| Answer                                             | 800–2,000           |                                                                       |
| **Total**                                          | **≈ 14,000–26,000** |                                                                       |

On a 500,000 Pro quota that is about **19–36 full-context messages a month**, not 300+. The Free tier would get **2–3**.

**Recommendation.**

1. **Keep your 1-day OHLC decision, and make it cheap:**
   - no timestamp on every bar (start time + interval);
   - one compact line per bar;
   - M15 only where M5 already covers the detail.
   - Measure the result. If it is still too costly, send a short OHLC summary by default (today's open/high/low, the last 12 M5 and last 8 M15 closed bars) and the full day only for questions that need it.
2. **Define "1 day" precisely** as the last 288 closed M5 and 96 closed M15 bars (trading bars). A Monday-morning window then reaches back into Friday rather than into an empty weekend.
3. **Cache the static parts** (system prompt, governance) with prompt caching. Meter quotas in _cost units_ so caching savings reach the user.
4. **Give each component a hard cap in the prompt assembler,** with a defined truncation order (history first, then knowledge, never the sensor board or gates).
5. **Re-set quotas from the measured average,** together with G2's entitlement decision. Fix the 10-versus-20 buffer contradiction.

**Done when:** each component has an enforced cap, and quotas are derived from measured averages.

#### C2 (P2) — Follow-up turns and latency

- **Within the same cycle,** don't resend OHLC or the image. Reuse the snapshot and state "same data as the previous answer".
- **When a new cycle arrives,** send only what changed and say so: "data updated 21:05 UTC — MCD2 moved from UP_IN_CORRIDOR to …".
- **Set a latency budget per stage:** translate/route, retrieve, fetch the R2 image, first token. Log each stage so you can see where time goes.

---

### D. Deterministic safety gates

#### D1 (P1) — Data freshness and consistency gate

**Finding.**

- The renderer currently draws **synthetic fixture data** dated around 9 June until the `.ex5` rebuild lands (R2 manifest §7).
- The R2 checklist flags objects older than 10 minutes as stale, but only in a manual check.
- There is **no last-known-good fallback** (R2 manifest §9.5).
- The chart is drawn on the VPS from the renderer's own database, while the MCDs read Railway PostgreSQL. Those are two data paths that can drift apart.
- The dual-stacked manifest recorded `/terminal` showing "Disconnected", so live data could not be verified.

**Recommendation.** Add a gate in the request path, before the LLM:

- **Market data:** the last closed M5 bar is no more than 2 cycles old during market hours. Otherwise switch to a "data delayed" mode.
- **Sensors:** the MCD `cycle_id` matches that bar.
- **Chart:** the renderer writes `last_bar_ts` and `cycle_id` into the R2 object's custom metadata. If they don't match the sensor cycle, drop the image and tell the user, rather than show a chart from a different moment.
- **Market closed:** an explicit weekend/holiday mode.
- **Report 2 is blocked** whenever the market-data or sensor check fails.
- **Every reply is stamped** "data as of hh:mm UTC".

**Done when:** a stale-data test case blocks Report 2, and every reply carries the data timestamp.

#### D2 (P1) — News blackout enforced in Engine 4

**Finding.**

- A mandates no new orders from 15 minutes before to 15 minutes after Tier-1 releases (US CPI, Core PCE, FOMC, NFP; A line 449).
- D's Pillar 8 reads `economic_events`, but only as narrative for the LLM.
- G §8.2's validation checks 0–4 cover the entry band, RPT, SLD, the RRR cap and leverage. None of them covers news, and nothing else enforces the blackout.

**Recommendation.**

- **Add check 5 to Engine 4's validation:** if a HIGH-impact USD event falls within ±15 minutes of now, or of the planned entry time, Report 2 is not generated. The reply says why and when the window ends.
- **Widen the window** when an event's time is approximate.
- **If `economic_events` is empty or stale,** label "news calendar unavailable" instead of passing silently.
- **Report 1 may still be produced,** with the warning shown prominently.

**Done when:** unit tests with events at −16, −14, +14 and +16 minutes give the right results.

#### D3 (P1) — Number-grounding check on every reply

**Finding.** The design says the LLM never invents market data, but nothing checks it. Report 2's numbers come from Engine 4, while Report 1's narrative quotes prices and levels directly.

**Recommendation.**

- **After generation,** extract every price and percentage from the reply.
- **Each must match** a value in the supplied context (OHLC, sensor levels, Engine 4 output, user input) within a small tolerance, for example $0.05.
- **If a number doesn't match,** regenerate once. If it still fails, flag the number to the user.
- **Also run the forbidden-phrase list** from F3.
- **Log every violation** so you can track the rate.

**Done when:** the validator runs on every reply and its violation rate is on a dashboard.

#### D4 (P2) — The defect flag drives Engine 4

**Finding.** A Cautionary Defect Flag should cut position size by 50%, but neither Engine 4's inputs nor G's Report 2 maths take the flag into account.

**Recommendation.**

- Pass the gate status (A5) into Engine 4.
- When it is `CAUTIONARY`, pre-select the reduced RPT and show the reason.
- Allow the trader to override, and record the override in the consent record.

---

### E. Entry zones and Report 2

#### E1 (P1) — Write the entry-price-zone spec on MCD levels

**Finding.**

- G points to `STACK-D-ENTRY-PRICE-ZONE-CALCULATION-DOCUMENT.md` as a separate specification (G line 98), but that file doesn't exist in the folder.
- Your rule is that zones come from any single MCD or from a multi-MCD synthesis.
- Today each MCD exposes its levels in a different place (see A1).
- G allows a custom entry within **±5% of the live price** (G §8.2, check 0). That works as a typo filter, which is its stated purpose. As a plausibility bound it is far too wide: about ±$127 at 2,545, or about ±$219 at 4,384, much more than a day's range on M5/M15.

**Recommendation. The spec should define:**

- **Inputs:** `levels[]` from the VALID sensors of one cycle, plus the synthesis bias (B6).
- **Construction by level role:** for example, a pullback zone around the baseline for trend-following, or a deviation zone at LOEDT/UOEDT for mean reversion.
- **Confluence:** zones from two or more sensors within $X of each other merge and rank higher.
- **Each zone carries:** its source sensors, an invalidation price (a structural stop candidate) and its distance from the current price.
- **The 5 zones shown in Report 1:** how they are chosen.
- **A second, tighter custom-entry bound** based on ATR or the day's range. Keep ±5% as the typo filter.

**Done when:** the spec exists, zone output is deterministic and replayable, and every zone traces back to its sensors.

#### E2 (P2) — Anchor stops, targets and the badge to structure

**Finding.**

- G's stop-loss choices are fixed pills of $13/15/17/19/21 (G line 86), while A's risk domain requires structural stops.
- G §5.1 still uses **WACS 25–60** for the Normal badge and **WACS > 60** for Aggressive, even though WACS is retired.

**Recommendation.**

- **Stop options** are the distances from entry to the structural invalidation levels from E1. Filter them by Min SLD ($13) and keep a "custom" choice.
- **Runway** is the distance from entry to the next opposing level, divided by SLD. If a scenario's take-profit lies beyond that level, don't recommend it.
- **Badge rules,** driven by synthesis (B6):

| Condition                                          | Badge        |
| -------------------------------------------------- | ------------ |
| Counter-trend or conflict                          | Conservative |
| Aligned, and runway ≥ Normal RRR                   | Normal       |
| Aligned on M5 and M15, and runway ≥ Aggressive RRR | Aggressive   |

**Done when:** G §5.1 contains no WACS references, and the badge can be reproduced from the envelopes plus Engine 4's inputs.

#### E3 (P1, small) — Correct Report 2's worked example

**Finding.** G's example (§6) uses equity $10,000, BUY at 2,545, RPT 1%, SLD $15, commission $4/lot round trip and 0.06 lot. Its net profits ($138.60 / $162.00 / $184.50) equal `0.06 × 100 × TP distance`, which means **commission was not subtracted**, contrary to G's own Row 12 formula. Its effective RRRs (1.54 / 1.80 / 2.05) also don't follow from G's effective-RRR formula.

Recomputed with G's formulas:

|               | Conservative | Normal      | Aggressive  |
| ------------- | ------------ | ----------- | ----------- |
| Target RRR    | 1.50x        | 1.75x       | 2.00x       |
| Effective RRR | 1.5024x      | 1.7524x     | 2.0024x     |
| TP distance   | $22.54       | $26.29      | $30.04      |
| TP price      | 2,567.54     | 2,571.29    | 2,575.04    |
| Net profit    | **$134.98**  | **$157.48** | **$179.98** |

Two related points:

- **Actual risk after rounding down is $90.24 (0.90%), not $100.** Report 2 should show both "declared risk" and "actual risk".
- **Leverage is 1.527×.** G prints 1.52×, so specify whether displayed values round or truncate.

**Recommendation.** Replace the table in G. Make this example a fixture in Engine 4's unit tests so the document and the code can't diverge again.

#### E4 (P2) — Broker realism

**Finding.**

- The `Position Sizer.mq5` in your indicators folder accounts for spread (with a maximum-spread limit) and one-way commission per lot.
- `Symbol Information.mq5` reads contract size (`SYMBOL_TRADE_CONTRACT_SIZE`) and swap.
- Engine 4 hard-codes 100 oz/lot and assumes a 0.01 lot step. It ignores spread and swap.

**Recommendation.**

- **Add a symbol-spec table,** filled from MT5 by the collector, holding:
  - contract size;
  - lot minimum, step and maximum;
  - tick size;
  - typical spread;
  - commission model (one-way or round trip);
  - swap long and short.
- **Engine 4 reads the table** instead of fixed constants.
- **Stop distance accounts for spread** (a BUY exits at the bid).
- **Show swap** when a Day Trader position (< 12 h) can cross rollover.
- **Per-broker profiles** can come later.

---

### F. LLM layer

#### F1 (P2) — Structured output for Report 1

The LLM returns JSON validated against a schema: direction (copied from synthesis), rationale bullets, sensors cited, zone IDs chosen, risks. The UI renders the card and pulls every number by ID from the engine outputs, so the model never retypes a price. This also makes D3 much simpler.

#### F2 (P2) — Settle the model gateway

**Finding.**

- A calls Claude Opus 5.5 or a Gemini multimodal model with native reasoning.
- D defines an OpenRouter registry of several models with cost multipliers. It includes fast base models (for example Gemini 3.6 Flash and DeepSeek V4 Flash at 1.0×).

**Recommendation.**

- Record capability flags per model: vision, context length, structured output, and answer quality in each of the 16 languages.
- A model becomes selectable only after passing the same evaluation suite: golden scenarios (G4), grounding (D3) and compliance language (F3).
- Start with one or two models.

#### F3 (P2) — Compliance language

**Finding.** G's disclaimer positions the product as execution-only decision support (MiFID II, CFTC 4.41, FCA PERG 8.29, JFSA). Several documents use wording that conflicts with that position:

- the seed idea's "82% probability", "GRADE S (95% Confluence)" and "High-Conviction Alert";
- I's "100% accurate, hallucination-free trade advice";
- F's "hallucination-free technical analysis".

**Recommendation.** Write a style guide covering:

- conditional phrasing;
- always stating the invalidation level;
- no unmeasured probabilities or grades (A6);
- never calling output "advice";
- statistics only with their sample size.

Add the banned phrases to D3's check. I'm not a lawyer: have counsel in each target jurisdiction review the final wording.

---

### G. Platform and operations

#### G1 (P1) — One canonical architecture document plus a decision log

**Finding.** Nine overlapping documents (A–I) are resolved by a "newest wins" rule. The deck's appendix lists 11 conflicts that had to be resolved by hand, and more are listed above (R², the chat buffer, the tag names, entitlements).

**Recommendation.**

- **Create `STACK-D-ARCHITECTURE.md`** as the single source of truth.
- **Keep a decision log** in `docs/adr/`. Today's decisions are the first entries:
  1. 1.5C retired.
  2. JSONB54/FREQ54 removed.
  3. The 54-bar rule replaced by per-MCD windows plus 1-day OHLC.
  4. The 2-panel chart.
  5. The txtai index as local files, rebuilt each deploy.
- **Add a SUPERSEDED banner** to A–I pointing at the canonical document.
- **Add a pointer in `CLAUDE.md`** so Claude Code reads the canonical document first.
- **Consider renaming engines by function** (Data, Sensors, Synthesis, Router, Knowledge, Chart, Risk). After the retirements, "1.5A/1.5E" numbering is harder to follow.

#### G2 (P2, but decide with C1) — One entitlement table

**Finding.** Four sources disagree:

| Source                | Free                                                | Pro                  |
| --------------------- | --------------------------------------------------- | -------------------- |
| A (OKF v2)            | no access; gating checks for PRO                    | full                 |
| D (chart analysis v2) | 50,000 tokens/month                                 | 500,000 tokens/month |
| I (executive deck)    | 20 queries/day                                      | PNG chart analysis   |
| R2 manifest           | chart download refused (403); overlay toggle locked | presigned chart      |

**Recommendation.** Write one table of features × tiers, covering:

- conversational AI access;
- chart image sent to the LLM (a separate question from the user downloading the chart);
- chart download;
- Report 2;
- quota;
- history length.

#### G3 (P2) — A decision trace per request

For each request, record:

- request ID and tier;
- `cycle_id`;
- sensor statuses and synthesis;
- M\*;
- knowledge chunk IDs and the index build ID;
- model and prompt version;
- gate results;
- Engine 4 input and output;
- the consent action;
- token use.

Store it under D's WORM legal vault retention (7 years; E says 5–7 years, so settle one figure). It answers "why did it say BUY?" for support and for audits. Define the fields together with A1 so the envelope already carries them.

#### G4 (P2) — Degraded modes and golden-scenario replay

| Failure                             | Behaviour                                                          |
| ----------------------------------- | ------------------------------------------------------------------ |
| Market data stale                   | no Report 2; general questions still answered; delay stated        |
| A sensor INVALID/STALE              | excluded from synthesis; listed as unavailable on the sensor board |
| Chart missing or from another cycle | text-only answer; missing chart stated                             |
| Knowledge index fails to load       | block trade setups; answer with sensor data only, flagged          |
| LLM provider down                   | fallback model from F2, or "service busy"                          |
| News calendar unavailable           | label it; no silent pass (D2)                                      |

Keep 20–30 real stored cycles as **golden scenarios**, with their expected envelopes, synthesis, zones and Report 2 numbers. Replay them in CI on every change to sensors, rules, prompts or models.

#### G5 (P3) — Later

- Proactive alerts on state changes (the A4 worker already has the data).
- Cross-session memory of a trader's past setups and outcomes.
- Per-user time-zone display.

---

## 4. Decisions you need to make

| #   | Decision                        | My suggestion                                                                                          | Why                                                             |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 1   | Where the MCD worker runs       | Railway, right after the gateway's upsert                                                              | The data is already there, and one clock drives everything      |
| 2   | Forming bar in MCDs             | Closed bars only; the forming bar appears only as a labelled current price                             | Reproducible, and no phantom breaches                           |
| 3   | Who decides direction and badge | Deterministic synthesis rules; the LLM explains                                                        | Same data, same answer                                          |
| 4   | Routing v1                      | Dispatch matrix plus a labelled test set; vector routing only if it wins                               | Measurable and explainable                                      |
| 5   | Multilingual (16 languages)     | English as the single pivot for routing and retrieval; answer in the user's language                   | One corpus, one index; avoids per-language keyword tokenisation |
| 6   | 1-day OHLC delivery             | Keep your decision in a compact format; measure; fall back to summary-by-default only if cost requires | Respects your choice and controls cost                          |
| 7   | News blackout behaviour         | Block Report 2 in the ±15-minute window; Report 1 allowed with a warning                               | Matches A's rule                                                |
| 8   | Entitlements                    | One table (does Free get the AI at all?)                                                               | Four documents disagree                                         |
| 9   | Model gateway                   | One or two models that pass the eval suite                                                             | Fewer variables at launch                                       |
| 10  | Defect-flag override            | Allowed and logged                                                                                     | Trader autonomy plus an audit trail                             |
| 11  | Custom-entry bound              | Add an ATR- or day-range-based bound; keep ±5% only as a typo filter                                   | ±5% is ≈ $127–$219 on gold                                      |
| 12  | 4Q Model A R² threshold         | Pick 0.65 or 0.70 and record it in the decision log                                                    | C and A disagree                                                |
| 13  | Audit retention                 | One figure (7 years per D, or 5–7 per E)                                                               | Consistency for compliance                                      |

---

## 5. Suggested order of work

1. **G1:** canonical document plus decision log. This records everything decided so far and stops further drift.
2. **A1–A3:** envelope, cycle and registry. Retrofit MCD1–MCD3. Define the G3 trace fields at the same time.
3. **A4 + B6 + E1:** worker and `mcd_outputs`, synthesis v1, and the entry-zone spec.
4. **D1–D3 + C1 + G2:** gates, measured context budget, quotas and entitlements.
5. **B1–B5:** sensor board, routing, multilingual handling, txtai corpus and retrieval tests.
6. **E2–E4 + F1–F3:** structural stops/targets and badge, broker realism, structured output, gateway, compliance language.
7. **G4:** golden replay suite. Start collecting scenarios as soon as A4 writes data.
8. **A8 before MCD4; A6 once history accumulates.**

---

## Appendix — Evidence index

| Claim                                                   | Where to check                                                                                                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCD output shapes differ                                | `engine-1-5-new/mcd{1,2,3}/mcd*_output.json` (top-level keys, `validation`, `evaluation`)                                                                                                                   |
| Forming-bar reads                                       | MCD1 `provenance.live_bar_ts` 1789764300 (18 Sep 20:45 UTC) vs `captured_at` 1789764900 (20:55); MCD2 both 1789764900; both `latest_bar.close` = 4377.99; render plan §7.1; dual-stacked manifest open item |
| Active-indicator disagreement                           | MCD2 `validation.checks.active_indicators_detected: ["best_fit_a","fractal"]` + `parameters.target_indicator_override`; MCD3 `validation.tier1_active_indicators.m5: ["best_fit_a"]`                        |
| MCD3 stand-aside                                        | MCD3 `evaluation.regime_status: TREND_MISALIGNMENT`, `tactical_bias: NEUTRAL_STAND_ASIDE`                                                                                                                   |
| txtai has no `filter=`                                  | `seed-code/txtai/src/python/txtai/embeddings/base.py` line 356; `docs/embeddings/query.md` (SQL, bind parameters)                                                                                           |
| `filter=` and tag names in A                            | A lines 369 and 490                                                                                                                                                                                         |
| Non-English example vs English-only model               | A line 319 (example prompt), line 464 (`all-MiniLM`)                                                                                                                                                        |
| Router α and θ                                          | A lines 332, 347, 358                                                                                                                                                                                       |
| Quotas and 1,500 units/message                          | D lines 250, 357, 373, 376                                                                                                                                                                                  |
| 20- vs 10-message buffer                                | D line 33 vs lines 559, 574                                                                                                                                                                                 |
| Blackout rule                                           | A line 449; `economic_events` as Pillar 8 in D lines 117–118                                                                                                                                                |
| R² thresholds                                           | C lines 127–128 vs A lines 124, 250                                                                                                                                                                         |
| Entry-zone spec missing                                 | G line 98; not present in `davintrade-stack-d-and-e/`                                                                                                                                                       |
| ±5% custom entry; validation checks 0–4 (no news check) | G lines 64, 116, 472; G §8.2                                                                                                                                                                                |
| Fixed SLD pills                                         | G line 86                                                                                                                                                                                                   |
| WACS still in the badge logic                           | G §5.1 (lines 291, 296)                                                                                                                                                                                     |
| Report 2 example                                        | G §6 (lines 340–358)                                                                                                                                                                                        |
| Unmeasured probabilities and grades                     | seed idea lines 125, 138, 150, 203, 218; I line 18; F line 48                                                                                                                                               |
| Synthetic renders, no fallback                          | R2 manifest §5.3, §7 (lines 313–319), §9.5 (line 356)                                                                                                                                                       |
| Entitlements                                            | A line 139; D line 250; I lines 104–109; R2 manifest lines 273, 315                                                                                                                                         |
| Retention                                               | D line 160 (7-year WORM); E line 305 (5–7 years)                                                                                                                                                            |

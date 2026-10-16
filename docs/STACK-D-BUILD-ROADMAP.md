# STACK D BUILD ROADMAP

STEP 4: Synthesis & Entry Zones (Finishing Now)
├─ Backend: Rules engine, SYN reading (Day Trader & Scalper), zone builder, sensor kit sync
└─ Data Contracts: Entry zones, invalidation prices, ranked reference prices (for modal pills)
↓
STEP 5: Engine 4 & Report 2 (Risk Sizing & Trade Modal)
├─ Backend: Deterministic risk engine, lot sizing, Tier-1 news blackout, symbol specs, consent audit
└─ UI: Report 2 Trade Setup Modal & Card, interactive entry price pills, Accept/Decline buttons
↓
STEP 6: Intake, Routing & Knowledge (RAG & Chart Triggers)
├─ Backend: Trading glossary, curated Knowledge Corpus, local txtai RAG index, 19-locale routing
└─ UI: Panel C instant prompts: the two Market Context badges of the charts (ADR-098 D10)
↓
STEP 7: Prompt & Reply (AI Copilot Chat Interface)
├─ Backend: Prompt assembler, OpenRouter model gateway, number check, token quota metering
└─ UI: Panel B live ChatPanel (model picker, quota meter, Report 1 shown after its checks) & Panel A dynamic threads
↓
PHASE B: Live Rollout & Certification on Railway (B0 → B5)
├─ Operations: PostgreSQL migrations applied, Python 3.11 Railway container, live shadow ingestion
└─ Production: 5 trading days shadow data, state certification, RETUNING enforcement → Full Live MVP

=============================================

Detailed Step-by-Step Breakdown
Step 4 — Synthesis & Entry Zones (Current Step)

Transforms raw sensor channel data into market bias, reason codes, and entry zones.

Backend & Engine:

- Ordered rules table (draft-1.yaml) and pure decision engine (engine.py).
- Canonical SYN readings for both DAY_TRADER (M15 structure) and SCALPER (M5 structure).
- Entry-zone builder (zones.py): 10% channel half-width, overlap merging,≥ $13 invalidation stop floor, and runway ratio sorting.
- Sensor kit synced to 45 runtime files (railway-gateway/sensors/).
- Replay and measurement kit with log-based refusal accounting.

UI Data Contracts Produced:

- Exported entry_zones rows: reference prices, stop distances, next structural opposing levels.
- Ranked reference price list formatted specifically for Step 5's interactive modal pills.

Verification: Offline test fixtures, 100% mutation testing kill rate, scratch PostgreSQL 18.0 database specs.

Step 5 — Engine 4 & Report 2 (Next Step)

Calculates mathematical position sizing, risk limits, and renders the interactive execution modal.

Backend & Engine:

- Deterministic Risk Engine (Engine 4): Validates trade eligibility, maximum risk per trade (≤ Max RPT), broker lot size constraints, and leverage ceiling (1:5).
- Counter-Trend Protection: Enforces strict reward-to-risk ratio cap (≤ 2.5×) on counter-trend setups.
- Economic News Blackout: Suppresses trade setups during high-impact Tier-1 economic releases.
- Broker Specifications (symbol_specs): Real tick values, minimum contract sizes, and live spread adjustments.
- Consent Audit Table: Append-only recording of every user decision (ACCEPT, MODIFY, DECLINE) with HMAC-hashed user privacy retention.

Frontend & UI Built:

- Report 2 Trade Setup Modal & Card:
  -- Displays 3 risk scenarios: Conservative, Normal, and Aggressive.
  -- Shows declared vs. actual dollar risk side-by-side.

- Interactive Modal Price Pills:
  -- Button pills populated directly with the reference prices from Step 4's top entry zones.

- Consent Action Controls:
  -- "Accept setup" button (with broker execution disclaimer), "Modify", and "Decline".

- Legal Disclaimers: Reviewed risk disclaimers and single-order scope notices translated into the 19 interface locales.

Verification: Pre-calculated worked examples and edge-case unit tests. Zero mock data.

Step 6 — Intake, Routing & Knowledge (Chapter 4)

Enables multi-language intent parsing, semantic RAG search, and chart-to-chat triggers.

Backend & Engine:

- Knowledge Corpus & Vector Index: Curated trading psychology, market mechanics, and indicator playbooks indexed using local txtai files (ADR-005).
- Trading Glossary: Definitive terminology translations across all 19 interface locales.
- Intent & Language Router: Classifies user queries (analysis request vs. risk modification vs. out-of-scope question).

Frontend & UI Built:

- Panel C Instant Prompts (components/charts/mtf-stacked-charts.tsx):
  -- The top-left Market Context badge of each chart is the instant prompt (ADR-098 D10, Owner Decision "Option A"); there is no separate button.
  -- Pressing a badge sends the fixed question of that timeframe through the instant route; the reply is drawn by Step 7.

Verification: Labelled question benchmark set in all 19 locales with semantic retrieval accuracy validation.

Step 7 — Prompt & Reply (Chapter 5 — Final UI Integration)

Connects the LLM gateway, safety backstops, token quota meter, and the live conversational AI panel.

Backend & Engine:

- Prompt Assembler: Combines cycle state, synthesis reading, entry zones, and retrieved knowledge into a compact prompt (
  16,000 to 19,600 tokens at the caps; the day of OHLC alone is about 7,700, architecture 5.4).
- OpenRouter Model Gateway: Multi-model routing (one default and one fallback of another provider, named after the live evaluation; none is named yet, ADR-099 D1) using passed models only (ADR-055).
- Number Check & Safety Backstop: Re-validates that every price in the AI reply exists in the verified cycle context (
  ±$0.05 tolerance); enforces banned wording policies.
- Token Metering & Quota Engine: Deducts usage against actual gateway costs, reserving token balances before request dispatch.
- Audit Trace Logging (request_traces): Comprehensive request audit rows stored for 90 days in PostgreSQL, archived for 7 years.

Frontend & UI Built:

- Panel B AI Copilot (components/chat-panel.tsx):
  -- Replaces the "AI Copilot Coming Soon" placeholder with the live conversational interface.
  -- Header Model Picker: Dropdown listing the models that passed the evaluation, with "about N analyses left" from the measured cost (ADR-073).
  -- Active Cycle & Profile Badges: Displays DAY_TRADER / SCALPER and current cycle time slot.
  -- Monthly Quota Meter: Live progress bar showing the share of the Pro allowance left (a share, never a token number, ADR-073).
  -- Report 1 Structured Renderer: Formats the AI market analysis (headline, multi-timeframe alignment, levels, entry zones, risks).

- Panel A Sidebar (components/chat-sidebar.tsx):
  -- Replaces static session titles with dynamic database chat sessions, complete with LONG/SHORT direction badges, timestamps, and preview snippets.

Verification: End-to-end question-to-report verification over the 34 golden scenarios and a recorded evaluation run (replies are shown whole after their checks, ADR-054), billing accuracy tests on the ledger.

Status (2026-10-16): built in ten parts and proved offline (the evaluation run is a STAND-IN: no model was called); nothing is switched on. The stages that need a key, a budget and people are in docs/runbooks/deploy-stack-d-step7.md (S0 to S9); the decisions are ADR-099.

Phase B — Live Rollout & Production Certification (Railway B0 → B5)

Deploys the complete, fully coded software system to live production on Railway.

B0 — Database & Container Deployment:

- Apply the 3 additive migrations to production PostgreSQL (cycle_pipeline_tables, sensor_tables, synthesis_tables).
- Update railway-gateway/nixpacks.toml to install Python 3.11, PyYAML, and jsonschema.
- Deploy Railway image with SENSOR_WORKER_ENABLED=true (all sensor flags set to off).

B1 — Live Shadow Activation:

- Enable sensor and synthesis flags in shadow mode. Real market cycles begin ingesting without user-facing impact.

B2 — Latency Verification:

- Verify real cycle execution latency: <1s per sensor, <30s total cycle time.

B3 — 5-Day Live Shadow Accumulation:

- Accumulate at least 5 continuous trading days of live market cycles in production shadow mode.

B4 — Certification:

- Compute state statistics across observed market states into state_statistics (n≥30 threshold gate).

B5 — Full Live Promotion:

- Enforce RETUNING rules in production.
- Promote sensor and synthesis flags from shadow to live.
- Stack D MVP is officially live in production!

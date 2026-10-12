# Stack D Hand-Off: Step 4 Completion to Step 5 (Engine 4 & Report 2)

**Generated:** 2026-10-09  
**Role:** Antigravity Advisor Hand-Off  
**Target:** Fresh Antigravity Advisor Session & Davin  
**Repository:** `D:\SaaS Project\trading-alerts-saas-public`  
**Roadmap Reference:** `docs/STACK-D-BUILD-ROADMAP.md`

---

## 1. Executive Summary & Build State

Build Step 4 (Chapter 3: Synthesis & Entry Zones) has finished all **7 parts** in code and is locally committed in `main`.

- **Last Commit on `main`:** `706852a0` ("Build step 4 (Synthesis): the first golden scenarios, documents and closing (part 7)")
- **Ahead of `origin/main`:** 2 commits ahead:
  1. `506018d1` — Build step 4 part 6 (replay and measurement kit for SYN & zones)
  2. `706852a0` — Build step 4 part 7 (first golden scenarios, architecture docs, ADR-084 to ADR-092)
     _(Parts 1 to 5 were pushed earlier and sit on `origin/main`)._
- **Working Tree:** Clean of Stack D files. Unrelated unstaged mobile app file movement (`mobile-app/` → `davintrade-mobile-app/`) and untracked assets remain intentionally untouched.
- **Pending Migrations (Not Applied):**
  1. `20261002000000_add_cycle_pipeline_tables` (Step 2)
  2. `20261003000000_add_sensor_tables` (Step 3)
  3. `20261004000000_add_synthesis_tables` (Step 4, Part 4)
     _(All 3 are additive SQL files; zero applied to production; production remains completely untouched)._
- **Runtime Flags:** `SENSOR_WORKER_ENABLED=false`, `SYN: 'off'`.

---

## 2. What Was Built & Verified in Step 4

### Parts 1–7 Summary:

1. **Part 1 (Rules Engine & SYN Reading):**
   - Ordered, versioned rules table `draft-1.yaml` (`mcd_worker/synthesis/rules/draft-1.yaml`).
   - Pure decision engine (`engine.py`) producing canonical `syn-output/1` readings for `DAY_TRADER` (M15 structure) and `SCALPER` (M5 structure).
   - 180 new unit tests, differential testing across all 810 state combinations.
2. **Part 2 (Entry-Zone Builder & Pills):**
   - Zone parameters `zone_params.yaml` (`zones-1`: 10% half-width, $0.50 structural buffer, $\ge \$13$ stop floor, max 5 zones).
   - Zone builder (`zones.py`): overlap merging, confluence counting, invalidation pricing behind structure, runway ratio calculation.
   - Reference price pills (`pills.py`): exact zone reference prices in rank order, zero filler prices.
   - Architecture §3.7 reproduced to the exact cent on its own numbers.
3. **Part 3 (Runner Integration & Sensor Kit):**
   - Additive, optional `context_levels` on `CycleInputs` (M15/M5 $SR$ levels); Standard bumped to **1.0.6 (PATCH)**.
   - `SYN` worker flag (`off`, `shadow`, `live`).
   - Sensor kit synchronized to **45 files (377,716 bytes)** under `railway-gateway/sensors/`.
   - All 12 legacy MCD envelope hashes (3 cycles $\times$ 4 MCDs) verified **100% byte-identical**.
4. **Part 4 (PostgreSQL Tables & 25 CHECK Constraints):**
   - Additive migration file `20261004000000_add_synthesis_tables/migration.sql` creating `synthesis_readings` and `entry_zones`.
   - 25 custom database `CHECK` constraints enforcing business invariants at the PostgreSQL engine level.
   - Verified on throwaway PostgreSQL 18.0 database; `prisma migrate diff` confirmed zero drift.
5. **Part 5 (Gateway Write Path):**
   - Pre-validating TypeScript twin (`synthesis-rows.ts`) matching all 25 CHECK constraints, pre-screening rows before database transactions.
   - Defensive `SYN_TABLES_MISSING` table-existence guard preventing sensor data loss if deployed before migration.
   - Stored cycles write byte-identical readings and hashes matching `.synthesis.json` fixtures.
6. **Part 6 (Replay & Measurement Kit):**
   - Replay engine (`replay.ts`, `replay-cycle.js --fixtures`) verifies all 3 real cycles (`v1`, `v3`, `v4`): **3 of 3 VERIFIED** including SYN readings and entry zones.
   - Measurement kit (`measure-synthesis.ts`) tracks status mix, CAUTIONARY share, rule-hit histograms, `NO_MATCH` diagnostics, and log-based refusal reconciliation.
7. **Part 7 (Golden Scenarios & Architecture Grounding):**
   - **16 Golden Scenarios Captured & Signed `APPROVED`:**
     - 3 real market cycles (18 Sep 20:55, 28 Sep 14:15, 28 Sep 23:15).
     - 13 synthetic cycles covering all rules and branches of `draft-1.yaml`.
     - Signed by Davin on 2026-10-09 in `approval.json`. `golden check --require-approved` passes 16/16.
   - Architecture §3.5 and §3.7 updated to exact verified figures ($Z_1$: 4363.79–4370.61, $Z_2$: 4346.75–4353.57).
   - Strict preservation of the **19 supported languages** (commit `322ba4bc`).
   - New ADRs documented: [ADR-084] through [ADR-092].
   - Runbook updated: `docs/runbooks/deploy-stack-d-step3.md` §9.

### Test Verification Counts at Step 4 Completion:

- **Python worker suite:** 906 tests OK.
- **Python kit & MCD0–MCD3:** 223 / 124 / 113 / 102 / 134 OK.
- **Gateway Jest suite:** 64 suites, 2,741 tests pass (0 fail).
- **Mutations killed:** 100% across all modules (120/120 in part 1, 219/219 in part 2, 44/44 in part 3, 74/74 in part 4, 115/115 in part 5, 193/195 in part 6, 63/63 in part 7).

---

## 3. Immediate Next Step: Step 4 Session B (Independent Check)

Per [`docs/STACK-D-BUILD-USER-MANUAL.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/STACK-D-BUILD-USER-MANUAL.md#L225-L235) and Architecture §7.10, every build step must conclude with an independent **Session B (Check)** before moving to the next step.

Session B runs in a fresh Claude Code session, opens the code, executes tests/checks against §3.10's 8 "Done when" items, reports failures (if any), and changes zero files.

### Prompt for Claude Code (Session B Check):

```text
Repository: D:\SaaS Project\trading-alerts-saas-public
Read CLAUDE.md and "Running a build step" in docs/STACK-D-ARCHITECTURE.md §7.10; read other parts only as it directs.
Follow it as session B, for build step 4 (chapter 3, Synthesis & entry zones).
```

---

## 4. Hand-Off to Step 5: Engine 4 & Report 2 (Chapter 6)

Once Session B certifies Step 4, we immediately launch **Build Step 5**.

### Objective of Step 5:

Calculate mathematical position sizing, risk controls, and build the interactive Report 2 execution modal and card ([`docs/STACK-D-BUILD-ROADMAP.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/STACK-D-BUILD-ROADMAP.md#L48-L75)).

### Scope of Step 5:

1. **Deterministic Risk Engine (Engine 4):**
   - Validates trade eligibility, maximum risk per trade ($\le\text{Max RPT}$), lot sizing, and leverage ceiling (1:5).
   - Enforces counter-trend reward-to-risk cap ($\le 2.5\times$).
   - Tier-1 economic news blackout filter.
   - Broker specifications (`symbol_specs`: tick size, contract size, spread).
2. **Frontend & UI (Report 2 Modal & Card):**
   - Renders 3 risk scenarios: Conservative, Normal, and Aggressive.
   - Shows declared vs. actual risk side-by-side.
   - Interactive modal price pills bound directly to Step 4's zone reference prices.
   - Consent buttons: "Accept setup", "Modify", "Decline" with single-order disclaimer.
3. **Database Audit Table:**
   - Append-only consent logging (`user_trade_preferences_history`) with HMAC user hashing.
4. **Offline Verification:**
   - Pre-calculated fixtures, underflow test cases, scratch PostgreSQL tests. Zero mock data.

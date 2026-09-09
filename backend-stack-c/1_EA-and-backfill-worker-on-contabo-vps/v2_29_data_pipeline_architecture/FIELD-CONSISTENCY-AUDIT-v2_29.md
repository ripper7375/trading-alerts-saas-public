# Field Consistency Audit — v2.29 XAUUSD Data Pipeline (all 87 `market_data_v6` fields)

> ## ⚠ SUPERSEDED IN PART, same day (2026-09-09)
>
> After this audit, the pipeline was simplified so that **MQL5 is the single
> source of every `market_data` value** and the Python calc stack was parked.
> Two consequences for what you read below:
>
> - **§5's major finding is dissolved, not fixed.** It reported that the centroid
>   EDT stage self-detected fractals instead of using the staged
>   `horiz_high_map`/`horiz_low_map` columns, and that `golden_certification.py`
>   could not run. Both were properties of the Python CALCULATE stage. That stage
>   no longer exists; the EDT values in `market_data` are now the ones MQL5
>   exported. The finding is preserved verbatim below because it is the reason
>   the split was re-examined, and because it is an **open bug to fix first if
>   the calc stack is ever revived** — see
>   `calculation-split-between-mt5-and-python-PENDING-PROJECT/CALCULATION-SPLIT-ARCHITECTURE-PENDING.md`.
> - **§8's fix 2 (the `_price_or_none()` guard) was absorbed.** Those columns are
>   now parsed from the exports rather than computed, so the parse-time
>   `PRICE_LEVEL_COLUMNS` guard covers them by name and the helper was removed.
>
> Everything else — the field-by-field mapping, the naming conventions, the
> nullability fixes in §8 — stands unchanged. The §10 filename table was added
> after the fact.

**Date:** 2026-09-09. **Requested by:** Davin, direct chat instruction (`EXECUTOR-PROTOCOL.md` §6),
extending the 2026-09-03 `best_fit_a`/`best_fit_b` split and 2026-09-08 ingestion-guard sessions.
**Scope:** trace every field from its MQL5 source through every pipeline hop to Postgres —
name, type, nullability, "what does absent data mean" — flag and fix genuine drift.

**Method:** three parallel research passes read every file in scope (all 13 `.mq5` indicators +
the legacy EA, every real captured export header, the full Python collector/calc-stack/SQLite/
gateway-JSON-contract, and all three TypeScript/Prisma layers); the two highest-stakes findings
were then verified first-hand — `golden_certification.py` was actually run against the real M5/M15
export archives, `centroid_regression.py`/`export_collector_validator_v2.py` were read directly,
and `git log` was checked across both files' full history.

## Headline result

**Field naming is almost entirely correct end-to-end already.** Every source's
"export-filename-prefix ≠ column-header-prefix" pattern (e.g. file `Centriod_Best_Fit_A_XAUUSD_M5.txt`
but columns headed `Best_Fit_A_*`) is by design, and `export_collector_validator_v2.py`'s `SOURCES`
dict already stores the correct header prefix, distinct from the filename prefix, for **all 13
sources** — not just `best_fit_a`, which is the only one a prior session (2026-09-08) had reason to
re-check (and found correct in *production* code; only a throwaway verification *script*'s own test
fixture had the wrong assumption, already fixed). This was cross-checked directly against the real
`.mq5` `FileWrite` header strings and real captured `.txt` files in `davintrade-stack-d-and-e/
engine-1-5/` and `mock-data-from-indicators/golden_certification/` for every one of the 13 sources.

The real findings are: three small, genuine type/nullability drifts (fixed this session), one
missing generalization of an existing defensive null-guard (fixed this session), and **one serious,
confirmed correctness gap in the certified centroid-regression math** that is out of scope for this
audit to fix and is escalated to Davin (see §5).

---

## 1. Identity & OHLCV (9 fields) — §3.1

| Field | MQL5 source | SQLite | Gateway JSON | Monolith Prisma | RW-GW Prisma | Op-service Prisma | Status |
|---|---|---|---|---|---|---|---|
| `terminal_id` | n/a — set by push worker, not exported by any indicator | — (not a `market_data` column) | `string`, **required** | `String` | `String` | omitted | ✅ Confirmed always `'push_worker_v5'` (`backfill_worker_api_gateway_v5.py:43`), a static sender-id constant by design, not a per-terminal identifier — matches its own JSON-Schema description exactly. |
| `timestamp` | every source, UTC unix sec | `INTEGER NOT NULL` | `integer`, required | `Int` | `Int` | `Int` | ✅ |
| `symbol` | every source | `TEXT NOT NULL CHECK ='XAUUSD'` | `const:"XAUUSD"`, required | `String` | `String` | `String` | ✅ |
| `timeframe` | every source | `TEXT NOT NULL CHECK IN('M5','M15')` | `enum`, required | `String` | `String` | `String` | ✅ |
| `open`,`high`,`low`,`close` | `OHLCV` (`ohlcv_open/high/low`), `ZScore` (`z-score_open/high/low`, redundant copy used only for its own calc), `close` on every source as a validation key | `REAL NOT NULL` (×4) | `number`, required (×4) | `Float` (×4) | `Float` (×4) | `close` only, `Float` | ✅ — cosmetic-only precision difference noted: `OHLCV`'s export always prints 5 decimals (`%.5f`), the 7 centroid variants' `close` key prints at `_Digits` (often 2 decimals for XAUUSD) — numerically identical once parsed as float, non-issue since the collector parses (never string-compares) these. |
| `volume` | `OHLCV` (`ohlcv_volume`) | `INTEGER NOT NULL` | `integer`, required | `Int` | `Int` | omitted | ✅ |

## 2. Centroid-regression variants — 7 variants × 8 sub-fields = 56 fields — §3.2

Variants: `best_fit_a`, `best_fit_b`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b`.
Sub-fields: `horiz_high_map`, `horiz_low_map`, `ssa`, `ema_ssa` (admin, MQL5-exported, Float?),
`crossing` (admin, Int?), `base_fl`, `uoedt`, `loedt` (calculated, Python, Float?).

| Variant | `.mq5` file | Filename prefix | Real header prefix (verified against real `.txt`) | Collector `SOURCES` header prefix | SQLite cols | Gateway JSON | Monolith/RW-GW Prisma | Certification (M15 / M5) |
|---|---|---|---|---|---|---|---|---|
| `best_fit_a` | `2EDTCentroidRegressionBestFitNonMostRecentA_v2_29.mq5` | `Centriod_Best_Fit_A` | `Best_Fit_A_*` (no real *post-split* capture exists — see §6.1; `.mq5` source itself confirmed) | `Best_Fit_A` ✅ matches | 8 cols, all nullable | 8 props, nullable | `Float?`×7, `Int?`×1 | **Cannot run** — crashes before comparing any value (§5) |
| `best_fit_b` | `...BestFitNonMostRecentB_v2_29.mq5` | `Centriod_Best_Fit_B` | `Best_Fit_B_*` (no real capture exists at all — see §6.1) | `Best_Fit_B` ✅ matches | 8 cols | 8 props | same | Deliberately excluded from `golden_certification.py`'s `variants` dict (no captured data); present only in `test_phase3_centroid.py`'s synthetic smoke test |
| `cherry_a` | `...CherryPickA_v2_29.mq5` | `Cherry-Pick-A` | `Cherry_A_*` (confirmed vs real file) | `Cherry_A` ✅ matches | 8 cols | 8 props | same | **Cannot run** (§5) |
| `cherry_b` | `...CherryPickB_v2_29.mq5` | `Cherry-Pick-B` | `Cherry_B_*` (confirmed) | `Cherry_B` ✅ matches | 8 cols | 8 props | same | **Cannot run** (§5) |
| `most_recent` | `...MostRecentLineExtension_v2_29.mq5` | `Most-Recent` | `Most_Recent_*` (confirmed) | `Most_Recent` ✅ matches | 8 cols | 8 props | same | **Cannot run** (§5) |
| `non_a` | `...NonMostRecentLineExtensionA_v2_29.mq5` | `Non-Recent-A` | `Non_A_*` (confirmed) | `Non_A` ✅ matches | 8 cols | 8 props | same | **Cannot run** (§5) |
| `non_b` | `...NonMostRecentLineExtensionB_v2_29.mq5` | `Non-Recent-B` | `Non_B_*` (confirmed) | `Non_B` ✅ matches | 8 cols | 8 props | same | **Cannot run** (§5) |

**Ingestion null-guard coverage (2026-09-08 fix):** `parse_export_file()`'s `PRICE_LEVEL_COLUMNS`
`<=0.0 → None` guard is built generically from `_centroid_columns(prefix)`, which emits the *same*
generic internal names (`horiz_high_map`/`horiz_low_map`/`ssa`/`ema_ssa`) for every one of the 7
variants — **confirmed to generalize correctly to all 7 by construction**, no per-variant test
needed (it isn't hardcoded per-variant to begin with). `crossing` is correctly exempt (`Int`, `0` is
a valid "no cross" flag). This guard **never reached** `base_fl`/`uoedt`/`loedt` — those are
Python-*calculated*, never parsed from an export column — see §3/§4 fix.

**A/B isolated-coexistence symmetry (§4 cross-cutting):** `best_fit` and `cherry` both have A/B
pairs (separate MQL5 object namespaces, separate export buttons); `most_recent` deliberately has no
A/B split — confirmed intentional per the blueprint (§3.4: "Most-Recent" was never part of the
Non-A/Non-B/Cherry-A/Cherry-B/Best-Fit-A/Best-Fit-B redundancy set), not a missing counterpart.

## 3. Fractal EDT + Best Lines (5 fields) — §3.3

| Field | MQL5 source | SQLite | Gateway JSON | Prisma | Status |
|---|---|---|---|---|---|
| `fractal_best_fl`, `fractal_uoedt`, `fractal_loedt` | `2EDTFractalBestFitv5_v2_29.mq5` (keys-only export; computed by `fractal_lines.py`) | `REAL` nullable ×3 | `number\|null` ×3 | `Float?` ×3 | ✅ all 3 produced/propagated; **no null-guard on the Python-computed value** — fixed this session, see §4. |
| `best_resistance` | `SingleBestResistanceLinev3_v2_29.mq5` (keys-only export) | `REAL` nullable | `number\|null` | `Float?` | same fix applied |
| `best_support` | `SingleBestSupportLinev3_v2_29.mq5` (keys-only export) | `REAL` nullable | `number\|null` | `Float?` | same fix applied |

## 4. Z-Score / Body Classification (3 fields) — §3.4

`body_direction` (Int?, -1/0/1), `body_size` (Float?, `|z-score|`), `body_classification` (Int?, 0-5).
Source: `zscoreohlccandleexport_v2_29.mq5` → `zscore_candle.py`. **Confirmed: no layer anywhere in
the real pipeline (collector, SQLite, gateway JSON, DTO) carries a `zscore_` prefix on the persisted
field name** — the `zscore_candle.py` module's own internal dataclass names (`ZScoreCandleResult`)
stay module-internal; the emitted keys are the clean `body_direction`/`body_size`/`body_classification`
triple, matching `market_data` exactly at every layer. `body_size = |z|` is legitimately `0` when
there's no deviation — correctly **not** subject to the price-level null-guard (it isn't a price).

## 5. ZigZag (11 fields) — §3.5

`zigzag_point_type`, `zigzag_current_point`, `zigzag_price_change`, `zigzag_pct_change`,
`zigzag_pct_change_class`, `zigzag_bars`, `zigzag_bars_class`, `zigzag_price_per_bar`,
`zigzag_price_per_bar_class`, `zigzag_slope`, `zigzag_category`. Source: `ZigZagExportv43_v2_29.mq5`
→ `zigzag_metrics.py`. **Confirmed: every layer uses exactly these snake_case names, no
abbreviation/casing variant, and no illegal character anywhere in a real persisted/JSON field name.**
The `%` that appears in Davin's own Excel model concern (`zigzag_Current%Chg`) only ever exists
inside the raw *MQL5 export header text* (`Current%Chg`, `Current%ChgClass`) — confirmed via the
real captured file headers — never as a Python identifier, SQLite column, or JSON-Schema property
name; `zigzag_metrics.py`'s `ZigZagSegmentMetrics` dataclass fields are all clean identifiers.
`zigzag_current_point` is protected by the same `PRICE_LEVEL_COLUMNS` parse-time guard (`current_point`
is an explicit member of that set) — confirmed via `promote_cycle()`, which reads it straight from
the already-guarded `raw_zigzag` staging table.

One drift worth noting (JSON stricter than SQL, not a bug): `zigzag_category` is `TEXT` with no
CHECK constraint in SQLite, but a closed 6-value enum (`HH/HL/LH/LL/EQH/EQL`) in the gateway JSON
contract. `zigzag_metrics.py`'s `_category()` is exhaustive over exactly those 6 codes, so this
can't diverge in practice — flagged, not fixed (see §7).

## 6. Provenance (3 fields) — §3.6

| Field | Set by | SQLite | Gateway JSON (before → after this session) | Prisma (before → after) |
|---|---|---|---|---|
| `cycle_id` | `promote_cycle()`, unconditionally, every promoted row (`export_collector_validator_v2.py:475`) | `INTEGER NOT NULL` | `["integer","null"]` → **`integer`, now required** | `Int?` → **`Int`** |
| `collected_at` | `promote_cycle()`, unconditionally (`= now`) | `INTEGER NOT NULL` | `["integer","null"]` → **`integer`, now required** | `Int?` → **`Int`** |
| `calculated_at` | `promote_cycle()`, unconditionally (`= now`, same timing as `collected_at`) | `INTEGER` nullable | `["integer","null"]` — unchanged, correctly nullable | `Int?` — unchanged | Minor drift noted, not fixed: the SQL column's own comment says "NULL = calc stage skipped," but `promote_cycle()` actually always stamps it with the same `now` as `collected_at` regardless of whether `calculate_stage()` produced anything for that bar — a comment/behavior mismatch, not a functional bug (flagged, §7). |

Both `cycle_id` and `collected_at` were confirmed, by reading `promote_cycle()` directly, to be
unconditionally set for every row ever promoted — the SQLite `NOT NULL` constraint was the true
invariant all along; the gateway JSON contract and both Prisma schemas were looser than reality.
**Fixed this session** (§8) — this closes a real gap where a future "missed wiring" regression
upstream could have silently produced a row the downstream contract would accept as valid instead
of rejecting.

---

## 7. Cross-cutting checks — §4

- **NULL/placeholder semantics beyond the 2026-09-08 fix:** that fix guards MQL5-*parsed*
  price-level columns at `parse_export_file()`. It never reached the 26 columns Python itself
  *computes* in `calculate_stage()` (`best_resistance`, `best_support`, `fractal_best_fl`,
  `fractal_uoedt`, `fractal_loedt`, and all 21 `{variant}_base_fl`/`_uoedt`/`_loedt`) — these were
  written unconditionally with no sentinel coercion, even though `PRICE_LEVEL_COLUMNS`'s own
  comment claimed to "catch the derived columns too." **Fixed this session** — see §8.
- **Type fidelity:** Int vs Float vs String were checked at every intermediate layer (SQLite column
  affinity, JSON-Schema `"type"`, DTO field type). No cross-layer type mismatch found anywhere
  except the nullability drift in §6 (a nullability difference, not a base-type difference).
- **A/B isolated-coexistence symmetry:** confirmed intentional (§2 above) — `most_recent` was never
  meant to have an A/B pair.
- **Legacy EA correctness** (`SimpleDataCollector_v2_29_ASYNC_SOCKET.mq5`): re-verified. All 12
  `iCustom()` handles (`h_cr_bestfit_a/b`, `h_cr_cherry_a/b`, `h_cr_mostrecent`, `h_cr_nonrecent_a/b`,
  `h_fractal_bestfit`, `h_best_resistance`, `h_best_support`, `h_zigzag`, `h_zscore_candle`) use
  indicator-name strings that exactly match all 13 real `.mq5` filenames — no stale reference to the
  pre-split single `best_fit`. The EA's own local SQLite backup DDL (`CreateSymbolTable()`) and
  migration array (`MigrateSymbolTable()`'s `newColumns[]`) both correctly declare all 7
  variants' 8-column blocks with correct A/B-suffixed names — no leftover un-suffixed `best_fit_*`
  column anywhere. Confirmed no regression since the 2026-09-03 session fixed this class of bug.
- **Certification coverage:** see §5 below — this is where the audit's most significant finding is.

---

## 8. Fixes applied this session

1. **`cycle_id`/`collected_at` required + non-nullable**, end to end:
   `gateway_contract_market_data.schema.json` (added to `required`, dropped `"null"` from `type`,
   description updated) → `railway-gateway/src/gateway/dto/market-data.dto.ts` (regenerated via
   `npm run generate:dto`, purely schema-driven — now `cycle_id!: number` / `collected_at!: number`,
   no `@IsOptional()`/`| null`) → `prisma/market-data/schema.prisma` and
   `railway-gateway/prisma/schema.prisma` (both `Int?` → `Int`, kept byte-identical model bodies) →
   `types/indicator.ts` and `types/prisma-stubs.d.ts` (`number | null` → `number`, kept in sync) →
   an **authored-but-unapplied** migration
   (`prisma/migrations/20260909000000_market_data_v6_provenance_not_null/migration.sql`) that sets
   both columns `NOT NULL` on the live Postgres `market_data_v6` table. This one is **not**
   unconditionally lossless the way the 2026-09-03 rename was — its own header comment tells Davin
   to run `SELECT COUNT(*) FROM market_data_v6 WHERE cycle_id IS NULL OR collected_at IS NULL;`
   and confirm zero before applying. **Not applied to any real database**, per standing rule.
2. **Null-guard generalization**: new `_price_or_none(v)` helper in
   `export_collector_validator_v2.py` (`return v if v is not None and v > 0.0 else None`), applied
   at all 8 assignment sites in `calculate_stage()` for the 26 Python-calculated price-level
   columns listed above. Verified via a throwaway script (5 cases: real price passes through,
   `0.0`/negative coerced to `None`, an already-`None` EDT result stays `None`, a tiny-but-positive
   value passes through) — all 5 passed; script discarded after use (this stack has no persisted
   pytest coverage for the collector script itself, only for the calc modules — matching the
   established precedent from the 2026-09-08 session rather than introducing a new test-file
   convention unilaterally).
3. **`createdAt`/`updatedAt` type alignment**: `types/prisma-stubs.d.ts`'s `MarketDataV6` interface
   typed both `Date`-only; `types/indicator.ts`'s equivalent (the one actually used at runtime by
   `app/api/market-data/channel/route.ts` etc.) typed both `Date | string`. Aligned the stub to
   match.
4. **Incidental fix, needed to actually perform this session's own required verification** (not a
   field-naming fix, flagged separately): `test_phase1_golden.py`'s `MOCK_DIR` constant used
   `Path(__file__).resolve().parents[2]`, resolving to
   `.../1_EA-and-backfill-worker-on-contabo-vps/mock-data-from-indicators/...` — one level too
   shallow; the real `mock-data-from-indicators/` directory lives at the repo root. This has
   apparently been broken since the file was created (confirmed via directly reproducing the
   `FileNotFoundError`, in both Bash and PowerShell, ruling out an environment quirk) — meaning
   this test's zigzag-golden section could never have actually run as committed, undermining part
   of the blueprint's own "93/93 passing" claim (Appendix A). Fixed to `parents[4]`; re-ran clean,
   23/23. `test_phase2_lines.py`/`test_phase3_centroid.py` have no equivalent path constant
   (synthetic-fixture unit tests, not golden-file comparisons) — not affected.

---

## Sources for reference during this audit
- Blueprint: `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` (design-of-record; verified against live
  code per its own §0's "how to read" note and `CLAUDE.md`'s "live code wins" rule)
- `CERTIFICATION.md`, `golden_certification_report_M5.txt`/`_M15.txt`
- Real captured exports: `davintrade-stack-d-and-e/engine-1-5/*.txt`,
  `mock-data-from-indicators/{golden_certification,time_series_data}/`

---

# 5. MAJOR UNRESOLVED FINDING — escalated to Davin, NOT fixed this session

## `golden_certification.py` cannot run against the current `centroid_regression.py`; production
## may be using the wrong fractal source for every centroid variant's EDT lines

This is a correctness question about certified trading math, not a naming/type/nullability issue.
Verified first-hand, not assumed from documentation:

**1. Empirically reproduced the crash.** Ran `golden_certification.py` directly against the real
M5 and M15 archives (`mock-data-from-indicators/golden_certification/`). The z-score, ZigZag, and
fractal/resistance/support **lines** sections all pass cleanly on both timeframes (20/20 checks
each — matches the blueprint's own claims for those sections). It then crashes on the very first
centroid variant attempted (`best_fit_a`):

```
TypeError: CentroidRegressionParams.__init__() got an unexpected keyword argument 'fractals'
  File "...\golden_certification.py", line 283, in certify
    res = calculate_variant(variant, crossings, closes[:live_i + 1], highs[...], lows[...],
                            fractals=fractals, **overrides)
  File "...\centroid_regression.py", line 548, in calculate_variant
    return calculate(crossings, closes, highs, lows, CentroidRegressionParams(**cfg), atr)
TypeError: CentroidRegressionParams.__init__() got an unexpected keyword argument 'fractals'
```

**2. Confirmed this is not a typo or a recent regression — it has never worked in this repo.**
`git log --follow -p` on both `centroid_regression.py` and `golden_certification.py` shows their
first commit (2026-06-13) already has this exact shape: `golden_certification.py` deliberately
builds a `fractals` list from the real captured `{variant}_horiz_high_map`/`_horiz_low_map` columns
and passes `fractals=fractals` into `calculate_variant()`. `calculate()`/`calculate_variant()` in
`centroid_regression.py`, across every commit in this repo's history, has **never** had a `fractals`
parameter — `calculate()` unconditionally self-detects fractals from raw OHLCV `highs`/`lows` via
`detect_upper_fractals(highs, side) + detect_lower_fractals(lows, side)`.

**3. This directly contradicts `CERTIFICATION.md`'s own documented "Production rule":**
> "the centroid EDT stage must keep using the staged `horiz_high_map`/`horiz_low_map` fractals
> (self-detected fractals were tested and are worse — they break best_fit)."

**4. Production is wired the same self-detecting way as the broken certification script — read
directly in `export_collector_validator_v2.py`'s `calculate_stage()`:**
```python
highs = [r[2] for r in ohlcv]   # raw OHLCV, from raw_ohlcv — NOT the staged horiz_high_map column
lows  = [r[3] for r in ohlcv]
...
r = calculate_variant(variant, crossings, closes, highs, lows)   # no fractals override
```
This means **production has been computing every centroid variant's EDT lines (UOEDT/LOEDT, and by
extension the baseline/EDT-dependent figures) via self-detected fractals from raw OHLCV — the exact
approach `CERTIFICATION.md` says was tested and explicitly rejected** — since this code was first
written, not as a recent regression.

**Net effect:** the "CERTIFIED" verdict for all 7 centroid variants' Base_FL/UOEDT/LOEDT figures
(blueprint §6.3/§6.4: "M15 50/50 PASS," "M5 39/50 PASS," `CERTIFICATION.md`) **is stale,
unreproducible evidence against the code as it exists in this repo today.** Either:
- (a) certification was originally run against a different, never-committed version of
  `centroid_regression.py` that genuinely supported fractal injection, and a later refactor
  silently dropped that capability without anyone re-running certification against the version
  that shipped to production, or
- (b) `golden_certification.py`'s centroid section was written aspirationally against an API that
  was never actually built, and the report files' PASS/FAIL numbers for the centroid section were
  produced some other way (or are simply wrong/copied).

Either way, **the EDT values currently being computed and pushed to production for every centroid
variant may not be the ones that were actually certified**, and this cannot be resolved without
Davin's judgment call: restore fractal-injection support in `calculate()`/`_edts()` and wire
`calculate_stage()` to read+pass the staged `horiz_high_map`/`horiz_low_map` columns (a real change
to certified trading math, needing a full re-certification run against real MT5 data afterward), or
determine that self-detected fractals are in fact the correct, intended production behavior today
and formally revise `CERTIFICATION.md`'s "Production rule" and the blueprint's own §6.4 to match —
neither of which this audit's scope (naming/type/nullability consistency) authorizes deciding
unilaterally.

**Not touched this session.** `calculate()`/`calculate_stage()`'s fractal source was left exactly as
found. Logged here and in `CLAUDE.md`'s `Waiting on` section for a dedicated future session.

---

## 10. Filename / prefix / iCustom mapping — all 13, verified 2026-09-09

Davin's explicit ask: confirm the 13 `.mq5` filenames match every downstream
reference. Verified programmatically, not by eye. **All 13 match.**

Note there are two independent naming axes and they deliberately differ:
the `.mq5` **filename** (what `iCustom()` loads) and the `InpExportFileName`
**export prefix** (what the output file is called). A third — the per-column
header prefix inside the file — differs again; see §2.

| Source key | `.mq5` file | Export prefix (`InpExportFileName`) | `iCustom` in EA |
| --- | --- | --- | --- |
| `best_fit_a` | `2EDTCentroidRegressionBestFitNonMostRecentA_v2_29` | `Centriod_Best_Fit_A` | ✓ |
| `best_fit_b` | `2EDTCentroidRegressionBestFitNonMostRecentB_v2_29` | `Centriod_Best_Fit_B` | ✓ |
| `cherry_a` | `2EDTCentroidRegressionCherryPickA_v2_29` | `Cherry-Pick-A` | ✓ |
| `cherry_b` | `2EDTCentroidRegressionCherryPickB_v2_29` | `Cherry-Pick-B` | ✓ |
| `most_recent` | `2EDTCentroidRegressionMostRecentLineExtension_v2_29` | `Most-Recent` | ✓ |
| `non_a` | `2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29` | `Non-Recent-A` | ✓ |
| `non_b` | `2EDTCentroidRegressionNonMostRecentLineExtensionB_v2_29` | `Non-Recent-B` | ✓ |
| `fractal_edt` | `2EDTFractalBestFitv5_v2_29` | `Fractal_EDT` | ✓ |
| `resistance` | `SingleBestResistanceLinev3_v2_29` | `Resistance_Line` | ✓ |
| `support` | `SingleBestSupportLinev3_v2_29` | `Support_Line` | ✓ |
| `zigzag` | `ZigZagExportv43_v2_29` | `ZigZag` (see note) | ✓ |
| `ohlcv` | `ohlcvexportlightweight_v2_29` | `OHLCV` (via `InpBaseFileName`) | n/a — `indicator_plots 0`, read by `CopyRates` |
| `zscore` | `zscoreohlccandleexport_v2_29` | `ZScore` (hardcoded) | ✓ |

Two harmless naming quirks, verified rather than assumed:

- **`Centriod_` is a typo** in the two best-fit prefixes — but it is the typo
  MetaTrader actually writes, so the collector must match it. Do not "correct" it
  without renaming the real files on the VPS at the same time.
- **ZigZag's `InpExportFileName = "ZigZag.txt"` is dead config.** The real
  filename is built directly at `ZigZagExportv43_v2_29.mq5:385` as
  `"ZigZag_" + symbol + "_" + timeframe + ".txt"`; the input is only a fallback
  for an empty filename argument, which the auto-export path never passes.
  The collector's `ZigZag` prefix matches the real emitted name (confirmed
  against `ZigZag_XAUUSD_M5.txt` on disk).

---

## 9. Minor call-outs (found, not fixed — low value or needs data this Executor doesn't have)

- **No real captured export exists anywhere for the *current* `best_fit_a`/`best_fit_b` split
  naming.** The only "best fit" ground-truth archive present (`mock-data-from-indicators/
golden_certification/{m5,m15}_timeseries/Centriod_Best_Fit_XAUUSD_M{5,15}.txt`) is the pre-split
  legacy format (`Best_Fit_*` headers, no `_A`/`_B` suffix). The `.mq5` source code is the only
  ground truth for `best_fit_a`/`best_fit_b`'s real header shape today — needs a live MT5 capture,
  which this Executor cannot produce.
- **`zigzag_category`** — unconstrained `TEXT` in SQLite vs. a closed 6-value enum in the gateway
  JSON contract. Not a real drift (Python is already exhaustive over exactly those 6 codes); adding
  a matching SQLite CHECK constraint would need a nontrivial table-rebuild migration on a live VPS
  file-database (SQLite can't `ALTER ... ADD CONSTRAINT`) for marginal value — flagged only.
- **`calculated_at`'s SQL comment vs. actual behavior** — see §6 table. Cosmetic, not fixed.
- **Blueprint Appendix A's "93/93 passing"** is now stale by one test (94/94, after the 2026-09-03
  session added a `best_fit_b` synthetic case to `test_phase3_centroid.py`) — trivial, not fixed as
  part of this audit (out of this session's stated deliverables).

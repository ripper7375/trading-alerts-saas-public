# DavinTrade — Python Backend Stacks Architecture Design Document

**Scope:** Requirements 1, 2, 3, 4 — translate the Excel calculation sheets into a Python backend.
**Audience:** Claude Code (implementation agent) + maintainers.
**Status:** Implementation-ready specification.
**Date:** 2026-06-02

---

## 0. How to read this document

This document is the authoritative translation of four Excel "calculation sheets" into Python. Each requirement maps one Excel sheet to one Python module ("stack"):

| Req | Excel sheet (workbook)                                  | Python stack       | Produces                                                                             |
| --- | ------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------ |
| 1   | `Validation` (G) — `centroid_regression_and-edt.xlsx`   | `validation`       | A single boolean gate + per-field validation matrix across the 6 EDT model exports   |
| 2   | `Combine_After_Validation` (H) — same workbook          | `combine`          | The unified, validated EDT dataset consumed by the **Top Canvas**                    |
| 3   | `Timestamp_Adjustment` (J) — `zigzag_v43_repaired.xlsx` | `timestamp_adjust` | ZigZag pivot timestamps snapped to the M15 grid                                      |
| 4   | `EQH_EQL_Summary` (K) — same workbook                   | `eqh_eql_summary`  | EQH/EQL support-resistance levels + the 6 horizontal lines for the **Bottom Canvas** |

The two workbooks are independent pipelines that converge only at the frontend:

```
centroid_regression_and-edt.xlsx          zigzag_v43_repaired.xlsx
  A..F  (6 EDT model exports, raw MT5)       I  V43_New (ZigZag export, raw MT5)
        │                                         │
        ▼  Req 1                                  ▼  Req 3
  G  Validation  ──gate──┐                    J  Timestamp_Adjustment
        │                │                         │
        ▼  Req 2         │                         ▼  Req 4
  H  Combine_After_Validation                  K  EQH_EQL_Summary
        │                                         │
        ▼                                         ▼
  TOP CANVAS (EDT channels, SSA)            BOTTOM CANVAS (ZigZag + EQH/EQL lines)
```

> **Source of truth.** Every formula in this document was extracted directly from the two workbooks: `centroid_regression_and-edt.xlsx` and `zigzag_v43_repaired.xlsx`. (The latter is the canonical ZigZag workbook for this project — the earlier `zigzag_v43.xlsx` had a truncated ZIP central directory and has been removed; `zigzag_v43_repaired.xlsx` is a byte-faithful recovery of all 19 intact local file entries and is identical in content to the author's originals.) Use `zigzag_v43_repaired.xlsx` everywhere.

---

## 1. System context & non-functional requirements

### 1.1 Where these stacks sit

The MT5 indicators (`*.mq5`) write **tab-delimited UTF-8 text files** to disk every M15 bar (the spec states emission occurs at the 59th second of the execution loop). The Python backend:

1. Watches the MT5 output files for modification.
2. Parses each file into a typed table (one DataFrame per source).
3. Runs the four calculation stacks (this document).
4. Serializes the results to a single JSON payload.
5. Pushes the payload over a WebSocket to the frontend (`TradingView Lightweight Charts`).

This document specifies **steps 2–4 for the four calculation sheets only.** Ingestion (file-watch/WebSocket) and rendering are out of scope but their contracts are defined where the stacks touch them (§7).

### 1.2 Non-functional requirements

- **Determinism / fidelity.** Output must be numerically identical to Excel (within float tolerance `1e-9`). The Excel sheets are the acceptance oracle.
- **Vectorized.** Each sheet is ≤3001 rows; use pandas/NumPy vector ops, not Python row loops, except where an inherently sequential scan is required.
- **Pure functions.** Each stack is a pure transformation `inputs (DataFrames) -> output (DataFrame/dict)`. No global state, no disk I/O inside the calculation layer (I/O lives in the ingestion/serialization layers).
- **Re-runnable per tick.** The full pipeline recomputes from scratch on every new bar; there is no incremental state to maintain.
- **Excel-empty semantics.** Excel `""` (empty string) is the "no value" sentinel throughout. In Python this maps to `None`/`NaN`; the serialization layer emits JSON `null`. Never emit the literal string `""` to the frontend.

### 1.3 Recommended stack

- **Python 3.11+**, `pandas`, `numpy`.
- **pandera** (or pydantic) for schema validation of parsed inputs.
- **FastAPI + websockets** for the transport layer (out of scope here, but the JSON shapes in §7 are the contract).
- **pytest** for the fixture-based parity tests (§8).

### 1.4 Suggested package layout

```
davintrade_backend/
├── io/
│   ├── mt5_reader.py          # tab-delimited parsers -> DataFrames (typed)
│   └── schemas.py             # pandera/pydantic schemas for each source
├── calc/
│   ├── timegrid.py            # shared M15 timestamp-snapping helper (Req 3 core)
│   ├── validation.py          # Req 1  -> Sheet G
│   ├── combine.py             # Req 2  -> Sheet H
│   ├── zigzag_features.py     # V43_New derived columns needed by Req 4
│   ├── eqh_eql.py             # Req 4  -> Sheet K
│   └── pipeline.py            # orchestrates 1->2 and 3->4, builds payload
├── serialize/
│   └── payload.py             # DataFrames -> WebSocket JSON
└── tests/
    ├── fixtures/              # golden CSVs exported from the workbooks
    ├── test_validation.py
    ├── test_combine.py
    ├── test_timestamp_adjust.py
    └── test_eqh_eql.py
```

### 1.5 Python stack technologies by data-flow stage

Every stage of the pipeline and the exact libraries to use at that stage. This is the planning backbone for code development — build bottom-up: **Stage 0 → 1 → 2/3 → 4 → 5 → 6**.

| #   | Stage                                                      | Module(s)                  | Primary libraries                                           | Role of each library                                                                    |
| --- | ---------------------------------------------------------- | -------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 0   | **Ingestion / file-watch** _(out of scope, contract only)_ | `io/` runtime              | `watchdog`, std-lib `pathlib`                               | Detect MT5 file writes (59th-second emit); trigger a pipeline run                       |
| 1   | **Parse & type**                                           | `io/mt5_reader.py`         | `pandas` (`read_csv(sep="\t")`), `numpy`                    | Read tab-delimited UTF-8 (no BOM) into typed DataFrames; map MT5 empties → `NaN`/`None` |
| 1b  | **Input schema validation**                                | `io/schemas.py`            | `pandera` (preferred) or `pydantic v2`                      | Enforce column names/dtypes/row-alignment before calc; fail fast on malformed exports   |
| —   | **Shared time helper**                                     | `calc/timegrid.py`         | std-lib `math`, `pandas`                                    | `snap_timestamp()` — `ceil`/`floor`/MROUND M15/5-min grid (§2)                          |
| 2   | **Req 1 · Validation (G)**                                 | `calc/validation.py`       | `pandas`, `numpy`                                           | Vectorized element-wise cross-source equality; global `all_validation` gate             |
| 3   | **Req 2 · Combine (H)**                                    | `calc/combine.py`          | `pandas`                                                    | Gated coalesce + per-model passthrough                                                  |
| 4a  | **Req 4 prep · ZigZag features**                           | `calc/zigzag_features.py`  | `pandas` (`.shift()`), `numpy`                              | Rebuild V43_New lag/%Diff/EQHL/S&R/ImpEQHL columns                                      |
| 4b  | **Req 3 · Timestamp_Adjustment (J)**                       | `calc/timestamp_adjust.py` | `pandas`, `calc/timegrid.py`                                | Snap pivot timestamps; next-row guard                                                   |
| 4c  | **Req 4 · EQH_EQL_Summary (K)**                            | `calc/eqh_eql.py`          | `pandas`, `numpy`                                           | Count/Avg EQHL; six most-recent horizontal lines                                        |
| 5   | **Orchestration**                                          | `calc/pipeline.py`         | `pandas` (pure functions)                                   | Wire `1→2` and `4a→4b→4c`; assemble result object                                       |
| 6   | **Serialize**                                              | `serialize/payload.py`     | std-lib `json`, `orjson` (optional, speed)                  | DataFrames → WebSocket JSON; `NaN/None → null`                                          |
| 7   | **Transport** _(out of scope, contract only)_              | app layer                  | `FastAPI`, `websockets`/`uvicorn`                           | Push payload over WebSocket to TradingView Lightweight Charts frontend                  |
| T   | **Parity testing**                                         | `tests/`                   | `pytest`, `openpyxl` (fixture extraction), `pandas.testing` | Golden-fixture comparison vs the workbooks (the oracle)                                 |

**Dependency tiers (for `requirements.txt` / `pyproject.toml`):**

- _Core calc (required):_ `python>=3.11`, `pandas>=2.0`, `numpy>=1.24`.
- _I/O & validation:_ `pandera>=0.18` (or `pydantic>=2`), `watchdog` (runtime ingestion).
- _Serialization/transport (out-of-scope stages):_ `fastapi`, `uvicorn[standard]`, `websockets`, optional `orjson`.
- _Dev/test:_ `pytest>=8`, `openpyxl>=3.1`.

> **Why pandas/NumPy and not plain Python loops:** every sheet is ≤3001 rows and all logic is column-wise (equality, coalesce, `shift`, masked classification, `mean`). Vectorized ops give exact Excel parity with less code and meet the per-tick recompute budget. The only legitimately sequential reads are the next-row guards (`shift(-1)`), which are still vectorized.

---

## 2. Shared concept: the M15 timestamp-snapping helper

Both workbooks snap raw MT5 epoch timestamps onto the M15 (15-minute = 900 s) grid using the **identical** three-step formula. Implement once in `calc/timegrid.py` and reuse for Req 3 and for the source sheets feeding Req 1/2.

**Excel (from `Most-Recent_*` cols N/O/P and `Timestamp_Adjustment` cols B/C/D):**

```
N: convert_to_readable_datetime = (A/86400) + 25569          # epoch secs -> Excel serial date
O: round_to_nearest_datetime    = CEILING(INT(N*1440)/1440*288, 1) / 288   # snap UP to 5-min grid
P: timestamp_adjusted           = MROUND((O - 25569) * 86400, 300)         # back to epoch, round to 300s
```

> Note the constants: `25569` = days between 1899-12-30 (Excel epoch) and 1970-01-01 (Unix epoch). `1440` = minutes/day. `288` = 5-minute slots/day. `300` = 5 minutes in seconds. The pipeline rounds to a **5-minute** grid even though the chart is M15; this is intentional and must be preserved exactly.

**Python translation (integer-exact, avoids Excel serial round-trip drift):**

```python
import math

EXCEL_EPOCH_OFFSET_DAYS = 25569
SECONDS_PER_DAY = 86400
FIVE_MIN_SLOTS_PER_DAY = 288     # 1440 / 5
SNAP_SECONDS = 300               # MROUND target

def snap_timestamp(epoch_secs: float) -> int:
    """Replicates Excel cols N->O->P exactly.

    Returns the M15/5-min-grid-adjusted epoch (seconds). Integer result.
    """
    n = epoch_secs / SECONDS_PER_DAY + EXCEL_EPOCH_OFFSET_DAYS          # serial date (col N)
    # col O: CEILING(INT(n*1440)/1440*288, 1) / 288
    minutes_int = math.floor(n * 1440)                                  # INT(N*1440)
    slot_value = minutes_int / 1440 * FIVE_MIN_SLOTS_PER_DAY
    o = math.ceil(slot_value) / FIVE_MIN_SLOTS_PER_DAY                  # CEILING(...,1)/288
    # col P: MROUND((O-25569)*86400, 300)
    raw = (o - EXCEL_EPOCH_OFFSET_DAYS) * SECONDS_PER_DAY
    return int(_mround(raw, SNAP_SECONDS))

def _mround(value: float, multiple: float) -> float:
    """Excel MROUND: round to nearest multiple, half away from zero."""
    if multiple == 0:
        return 0.0
    return math.floor(value / multiple + 0.5) * multiple
```

**Critical edge cases to honor (verified against the workbooks):**

- `CEILING(x, 1)` in Excel rounds **up to the next integer** (toward +∞ for positive `x`). Use `math.ceil`.
- `INT()` in Excel **floors** (toward −∞). Use `math.floor`.
- `MROUND` rounds half **away from zero** — _not_ banker's rounding. The `floor(v/m + 0.5)*m` form above matches for the non-negative timestamps in scope.
- **Empty guard (Req 3 specifically):** `Timestamp_Adjustment!B2 = IF(A3="","", ...)`. The readable-datetime is only computed when the **next** row's timestamp exists. See §5.2 — this look-ahead is a deliberate "drop the last/partial pivot" guard and must be replicated.

**Verified fixtures** (from cached workbook values):

| Input epoch (A) | Expected adjusted epoch (D/P) |
| --------------- | ----------------------------- |
| 1776246302      | 1776246300                    |
| 1776262502      | 1776262500                    |
| 1776227401      | 1776227400                    |

---

## 3. Requirement 1 — `Validation` sheet (G)

### 3.1 Purpose

Six MT5 indicator variants each export the _same_ market frame independently:

| Sheet | Tab name                        | Role                             |
| ----- | ------------------------------- | -------------------------------- |
| A     | `Most-Recent_XAUUSD_M15_Rev1`   | Most-recent line extension       |
| B     | `Non-Recent-A_XAUUSD_M15_Rev1`  | Non-most-recent line extension A |
| C     | `Non-Recent-B_XAUUSD_M15_rev1`  | Non-most-recent line extension B |
| D     | `Cherry-Pick-A_XAUUSD_M15_Rev1` | Cherry-pick A                    |
| E     | `Cherry-Pick-B_XAUUSD_M15_Rev1` | Cherry-pick B                    |
| F     | `Best-Fit_XAUUSD_M15_Rev1`      | Best-fit regression              |

Validation cross-checks that all six agree on the **shared market context** (timestamp, symbol, timeframe, close, the two horizontal pivot maps, the SSA pair, and the SSA crossing flag). They are allowed to _differ_ on the EDT geometry (Base_FL / UOEDT / LOEDT) — that is the whole point of having six models — so those columns are **not** validated.

The output is a single global boolean gate (`all_validation`) plus a per-field, per-row boolean matrix for diagnostics.

### 3.2 Source-sheet schema (each of A–F, 16 columns)

Each export sheet has identical columns. Columns relevant downstream:

| Col   | Header                | Meaning                           | Used by                          |
| ----- | --------------------- | --------------------------------- | -------------------------------- |
| A     | `*_timestamp`         | raw MT5 epoch secs                | snapped to P, then validated     |
| B     | `*_symbol`            | e.g. `XAUUSD`                     | validated                        |
| C     | `*_timeframe`         | e.g. `M15`                        | validated                        |
| D     | `*_close`             | bar close                         | validated                        |
| E     | `*_Base_FL`           | Base / Centroid Fit Line (sparse) | **Combine only** (not validated) |
| F     | `*_UOEDT`             | Upper Outermost EDT (sparse)      | **Combine only**                 |
| G     | `*_LOEDT`             | Lower Outermost EDT (sparse)      | **Combine only**                 |
| H     | `*_horiz_high_map`    | horizontal high pivot (sparse)    | validated                        |
| I     | `*_horiz_low_map`     | horizontal low pivot (sparse)     | validated                        |
| J     | `*_ssa`               | SSA trend value                   | validated                        |
| K     | `*_ema_ssa`           | EMA of SSA                        | validated                        |
| L     | `*_crossing`          | SSA/EMA crossing flag (0/1)       | validated                        |
| N,O,P | timestamp helper cols | see §2                            | A-column source uses P           |

`E/F/G` (Base_FL/UOEDT/LOEDT) and `H/I` (pivot maps) are **sparse** — populated only on the rows where the indicator places geometry. `J/K` (SSA) are dense. Data extent: rows 2…3001 (3000 bars).

### 3.3 Validation logic (exact Excel)

The `Validation` sheet first re-pulls columns from all six sources into blocks of 9 columns each (A-block: cols A–I, B-block: J–R, … F-block: AT–BB), applying the M15-snapped timestamp (`P`) for the timestamp column and an `IF(...="","",...)` empty-passthrough for the sparse pivot maps. It then computes 9 per-field validation columns + 1 global gate:

```
BC timestamp_validation     = AND(A2=J2, J2=S2, S2=AB2, AB2=AK2, AK2=AT2)
BD symbol_validation        = AND(B2=K2, K2=T2, T2=AC2, AC2=AL2, AL2=AU2)
BE timeframe_validation     = AND(C2=L2, L2=U2, U2=AD2, AD2=AM2, AM2=AV2)
BF close_validation         = AND(D2=M2, M2=V2, V2=AE2, AE2=AN2, AN2=AW2)
BG horiz_high_map_validation= AND(E2=N2, N2=W2, W2=AF2, AF2=AO2, AO2=AX2)
BH horiz_low_map_validation = AND(F2=O2, O2=X2, X2=AG2, AG2=AP2, AP2=AY2)
BI ssa_validation           = AND(G2=P2, P2=Y2, Y2=AH2, AH2=AQ2, AQ2=AZ2)
BJ ema_ssa_validation       = AND(H2=Q2, Q2=Z2, Z2=AI2, AI2=AR2, AR2=BA2)
BK crossing_validation      = AND(I2=R2, R2=AA2, AA2=AJ2, AJ2=AS2, AS2=BB2)

BL all_validation (single cell BL2) = AND(BC2:BK3001)   # AND over the ENTIRE matrix
```

> **`BL2` is one cell**, not a per-row column. It is the logical AND across **every** per-field cell in the whole sheet (rows 2–3001 × columns BC–BK). It is the master gate that Req 2 consumes via the absolute reference `Validation!$BL$2`.

### 3.4 Semantics that must be preserved

1. **The six sources are aligned by row index, not by timestamp join.** Row 2 of each source is the same bar. Implement validation as element-wise comparison of equal-length, row-aligned arrays. (You should _also_ assert the snapped timestamps match — that is exactly what `timestamp_validation` does.)
2. **Empty-vs-empty equality.** Excel `""="" → TRUE`. After mapping `""→NaN`, `NaN==NaN` is `False` in pandas. You **must** treat "both empty" as equal. Use a helper `cells_equal(a, b)` that returns True when both are empty OR both are equal (see code). This matters for the sparse columns E/F/H/I (pivot maps) where most rows are empty across all six.
3. **Float equality.** Close/SSA values originate from the same MT5 computation rounded to fixed decimals in the export (`%.5f`, etc.), so exact equality is what Excel checks. Compare on the parsed values; if you observe spurious mismatches from re-rounding, compare rounded-to-export-precision values. Do **not** introduce a tolerance unless a fixture proves it is needed — Excel uses exact `=`.
4. **`all_validation` is global and binary.** A single disagreeing cell anywhere fails the whole frame, which suppresses the entire Combine output (Req 2). This is a hard safety gate: if the six models disagree on context, no EDT data is shown.

### 3.5 Python implementation (`calc/validation.py`)

```python
import numpy as np
import pandas as pd
from dataclasses import dataclass

# The 9 validated logical fields and which source column each maps to.
# (Base_FL/UOEDT/LOEDT are intentionally absent — not validated.)
VALIDATED_FIELDS = {
    "timestamp": "timestamp_adjusted",   # snapped P, not raw A
    "symbol":    "symbol",
    "timeframe": "timeframe",
    "close":     "close",
    "horiz_high_map": "horiz_high_map",
    "horiz_low_map":  "horiz_low_map",
    "ssa":       "ssa",
    "ema_ssa":   "ema_ssa",
    "crossing":  "crossing",
}
SOURCE_ORDER = ["most_recent", "non_a", "non_b", "cherry_a", "cherry_b", "best_fit"]

def _is_empty(s: pd.Series) -> pd.Series:
    return s.isna() | (s.astype("object") == "")

def cells_equal(a: pd.Series, b: pd.Series) -> pd.Series:
    """Excel '=' with ""="" -> True semantics."""
    both_empty = _is_empty(a) & _is_empty(b)
    eq = (a == b) & ~_is_empty(a) & ~_is_empty(b)
    return both_empty | eq

@dataclass
class ValidationResult:
    matrix: pd.DataFrame        # per-row, per-field booleans (cols BC..BK)
    all_validation: bool        # the single BL2 gate

def run_validation(sources: dict[str, pd.DataFrame]) -> ValidationResult:
    """sources: {source_name: DataFrame with VALIDATED_FIELDS columns}, row-aligned.
    Each source DataFrame must already have 'timestamp_adjusted' from snap_timestamp().
    """
    ref = sources[SOURCE_ORDER[0]]
    matrix = pd.DataFrame(index=ref.index)
    for field, col in VALIDATED_FIELDS.items():
        agree = pd.Series(True, index=ref.index)
        first = sources[SOURCE_ORDER[0]][col]
        for name in SOURCE_ORDER[1:]:
            agree &= cells_equal(first, sources[name][col])
            # (chained equality A=J,J=S,... is equivalent to all-equal-to-first
            #  because '=' is transitive over equal values)
        matrix[f"{field}_validation"] = agree
    all_validation = bool(matrix.to_numpy().all())   # AND over entire matrix (BL2)
    return ValidationResult(matrix=matrix, all_validation=all_validation)
```

> **Implementation note on chained equality.** Excel's `AND(A=J, J=S, S=AB, …)` is a chain. Comparing every source to the _first_ source is mathematically equivalent **as long as equality is transitive on the actual values**, which it is for scalars. Keep the helper comment so a maintainer doesn't "optimize" away the empty-vs-empty rule.

### 3.6 Acceptance

For the shipped workbook, `all_validation == True`. The parity test compares the full BC–BK matrix and the BL2 scalar against the golden fixture (§8).

---

## 4. Requirement 2 — `Combine_After_Validation` sheet (H)

### 4.1 Purpose

Once the gate passes, produce **one** clean, unified row per bar by coalescing the six sources. Shared context columns take the first non-empty source value; the EDT geometry columns (Base_FL/UOEDT/LOEDT) are carried through **per model** (all six kept side by side, since the Top Canvas draws all six channel families). The result is the Top Canvas data contract.

### 4.2 Output schema (27 columns)

| Col | Header                                  | Rule                                              |
| --- | --------------------------------------- | ------------------------------------------------- |
| A   | `timestamp_validated`                   | coalesce of the 6 snapped timestamps              |
| B   | `symbol_validated`                      | coalesce of 6 symbols                             |
| C   | `timeframe_validated`                   | coalesce of 6 timeframes                          |
| D   | `close_validated`                       | coalesce of 6 closes                              |
| E   | `Most_Recent_Base_FL_validated`         | passthrough from source A col E                   |
| F   | `Most_Recent_UOEDT_validated`           | passthrough from source A col F                   |
| G   | `Most_Recent_LOEDT_validated`           | passthrough from source A col G                   |
| H–J | `Non_A_{Base_FL,UOEDT,LOEDT}_validated` | passthrough from source B cols E/F/G              |
| K–M | `Non_B_{…}_validated`                   | passthrough from source C                         |
| N–P | `Cherry_A_{…}_validated`                | passthrough from source D                         |
| Q–S | `Cherry_B_{…}_validated`                | passthrough from source E                         |
| T–V | `Best_Fit_{CFL,UOEDT,LOEDT}_validated`  | passthrough from source F (note: Base→CFL naming) |
| W   | `horiz_high_map_validated`              | coalesce across the 6 high maps                   |
| X   | `horiz_low_map_validated`               | coalesce across the 6 low maps                    |
| Y   | `ssa_validated`                         | coalesce across the 6 SSA                         |
| Z   | `ema_ssa_validated`                     | coalesce across the 6 EMA-SSA                     |
| AA  | `crossing_validated`                    | coalesce across the 6 crossing flags              |

### 4.3 The two formula families (exact Excel)

**Family 1 — gated coalesce** (cols A,B,C,D,W,X,Y,Z,AA). Example for `timestamp_validated`:

```
A2 = IF(AND($BL$2=TRUE, A2<>""),  Validation!A2,
     IF(AND($BL$2=TRUE, J2<>""),  Validation!J2,
     IF(AND($BL$2=TRUE, S2<>""),  Validation!S2,
     IF(AND($BL$2=TRUE, AB2<>""), Validation!AB2,
     IF(AND($BL$2=TRUE, AK2<>""), Validation!AK2,
     IF(AND($BL$2=TRUE, AT2<>""), Validation!AT2, ""))))))
```

Semantics: **if the gate is False → empty. Else return the first non-empty value** scanning the six sources in order `[most_recent, non_a, non_b, cherry_a, cherry_b, best_fit]`. Columns W/X/Y/Z/AA do the same coalesce over their respective Validation block columns (high map E/N/W/AF/AO/AX; low map F/O/X/AG/AP/AY; ssa G/P/Y/AH/AQ/AZ; ema H/Q/Z/AI/AR/BA; crossing I/R/AA/AJ/AS/BB).

**Family 2 — gated passthrough** (cols E–V, the per-model EDT geometry). Example for `Most_Recent_Base_FL_validated`:

```
E2 = IF(AND($BL$2=TRUE, 'Most-Recent...'!E2<>""), 'Most-Recent...'!E2,
     IF(AND($BL$2=TRUE, 'Most-Recent...'!E2=""), ""))
```

Semantics: **if the gate is True, pass the source value through verbatim** (which is empty when the source is empty); if the gate is False, the cell is empty. I.e. simply `value if gate else empty`, preserving the source's own emptiness. Each of E–V binds to a _specific_ source/column (no coalescing).

### 4.4 Semantics that must be preserved

1. **Gate short-circuits everything.** When `all_validation` is False, **all 27 columns are empty for every row**. The serialization layer emits an empty/`null` Top-Canvas dataset. Frontend must handle "no validated data".
2. **Coalesce order is fixed** and identical for all Family-1 columns: most_recent → non_a → non_b → cherry_a → cherry_b → best_fit. First non-empty wins.
3. **EDT geometry is per-model and sparse.** Cols E–V keep each model separate; they remain empty on rows where that model placed no geometry. The Top Canvas draws six channel families, so do not collapse them.
4. **`Best_Fit` Base column is renamed `CFL`** in the output header (col T) but pulls from source F col E (Base_FL). Keep the rename in the output schema only.
5. Combine reads the _snapped_ timestamp (Validation col A = source P), not raw epoch.

### 4.5 Python implementation (`calc/combine.py`)

```python
import pandas as pd

COALESCE_SOURCES = ["most_recent", "non_a", "non_b", "cherry_a", "cherry_b", "best_fit"]

def _first_nonempty(frames: list[pd.Series]) -> pd.Series:
    out = frames[0].copy()
    for s in frames[1:]:
        mask = out.isna() | (out.astype("object") == "")
        out = out.where(~mask, s)
    return out.where(~(out.astype("object") == ""), other=pd.NA)

def run_combine(sources: dict[str, pd.DataFrame], all_validation: bool) -> pd.DataFrame:
    idx = sources["most_recent"].index
    out = pd.DataFrame(index=idx)

    if not all_validation:
        # Gate False -> all 27 columns empty.
        cols = ["timestamp_validated","symbol_validated","timeframe_validated","close_validated",
                "Most_Recent_Base_FL_validated","Most_Recent_UOEDT_validated","Most_Recent_LOEDT_validated",
                "Non_A_Base_FL_validated","Non_A_UOEDT_validated","Non_A_LOEDT_validated",
                "Non_B_Base_FL_validated","Non_B_UOEDT_validated","Non_B_LOEDT_validated",
                "Cherry_A_Base_FL_validated","Cherry_A_UOEDT_validated","Cherry_A_LOEDT_validated",
                "Cherry_B_Base_FL_validated","Cherry_B_UOEDT_validated","Cherry_B_LOEDT_validated",
                "Best_Fit_CFL_validated","Best_Fit_UOEDT_validated","Best_Fit_LOEDT_validated",
                "horiz_high_map_validated","horiz_low_map_validated","ssa_validated",
                "ema_ssa_validated","crossing_validated"]
        for c in cols:
            out[c] = pd.NA
        return out

    # Family 1: gated coalesce (first non-empty across the 6 sources, in order)
    def coalesce(col): return _first_nonempty([sources[s][col] for s in COALESCE_SOURCES])
    out["timestamp_validated"] = coalesce("timestamp_adjusted")
    out["symbol_validated"]    = coalesce("symbol")
    out["timeframe_validated"] = coalesce("timeframe")
    out["close_validated"]     = coalesce("close")

    # Family 2: per-model EDT geometry passthrough (sparse preserved)
    model_map = {
        "Most_Recent": "most_recent", "Non_A": "non_a", "Non_B": "non_b",
        "Cherry_A": "cherry_a", "Cherry_B": "cherry_b", "Best_Fit": "best_fit",
    }
    for label, src in model_map.items():
        base_name = "CFL" if label == "Best_Fit" else "Base_FL"
        out[f"{label}_{base_name}_validated"] = sources[src]["base_fl"]
        out[f"{label}_UOEDT_validated"]       = sources[src]["uoedt"]
        out[f"{label}_LOEDT_validated"]       = sources[src]["loedt"]

    # Family 1 (continued): the shared map/SSA/crossing columns
    out["horiz_high_map_validated"] = coalesce("horiz_high_map")
    out["horiz_low_map_validated"]  = coalesce("horiz_low_map")
    out["ssa_validated"]            = coalesce("ssa")
    out["ema_ssa_validated"]        = coalesce("ema_ssa")
    out["crossing_validated"]       = coalesce("crossing")
    return out
```

> Column ordering in the output must match the Excel A–AA order exactly (re-order `out` columns before returning if your construction differs).

### 4.6 Acceptance

With the shipped (`all_validation == True`) workbook, the Combine output must match sheet H cell-for-cell. Verified spot value: row 2 → `timestamp_validated=1776227400, symbol=XAUUSD, timeframe=M15, close=4823.51`, and E/F/G empty on that row.

---

## 5. Requirement 3 — `Timestamp_Adjustment` sheet (J)

### 5.1 Purpose

Snap each ZigZag pivot's raw MT5 epoch timestamp (`V43_New!A`) onto the M15/5-minute grid, producing the x-coordinate used to place EQH/EQL lines and ZigZag vertices on the **Bottom Canvas** time axis, and the join key for Req 4.

### 5.2 Logic (exact Excel)

```
A2 = V43_New!A2                                                # raw epoch passthrough
B2 = IF(A3="", "", (A2/86400)+25569)                           # readable serial date, guarded by NEXT row
C2 = IFERROR(CEILING(INT(B2*1440)/1440*288, 1) / 288, "")      # snap up to 5-min grid (IFERROR-guarded)
D2 = IFERROR(MROUND((C2-25569)*86400, 300), "")                # back to epoch, round to 300s (IFERROR-guarded)
```

This is exactly the shared helper of §2 with **one extra guard**: `B2` is empty when `A3` (the _next_ row) is empty. The ZigZag export ends with a partial/most-recent pivot whose "next" pivot does not yet exist; this look-ahead drops the trailing row so a forming pivot is not snapped and rendered prematurely. **Preserve this.**

> **Excel-error fix (applied to `zigzag_v43_repaired.xlsx`).** When `B` is blank (the last/forming pivot), the original `C`/`D` formulas computed `CEILING(INT(""*1440)…)` and propagated `#VALUE!` into `C183`/`D183`. Both columns are now wrapped in `IFERROR(…, "")` so a blank `B` yields a clean blank `C`/`D` instead of an error. **The Python port already does the right thing** — §5.3 computes the snap _only_ where the next-row guard passes (`next_exists`), returning `NA` otherwise, so it never raises and never needs a separate IFERROR. No code change required; the IFERROR is the spreadsheet-side equivalent of that guard.

### 5.3 Python implementation (`calc/timestamp_adjust.py`)

```python
import pandas as pd
from .timegrid import snap_timestamp

def run_timestamp_adjustment(v43: pd.DataFrame) -> pd.DataFrame:
    """v43: DataFrame with raw 'timestamp' column (V43_New col A), row-ordered as exported."""
    raw = v43["timestamp"].reset_index(drop=True)
    out = pd.DataFrame({"timestamp": raw})
    # B-guard: row i is valid only if the NEXT row's timestamp exists & is non-empty
    next_exists = raw.shift(-1).notna() & (raw.shift(-1).astype("object") != "")
    adjusted = raw.where(next_exists).map(
        lambda v: snap_timestamp(v) if pd.notna(v) else pd.NA
    )
    out["timestamp_adjusted"] = adjusted   # col D
    return out
```

### 5.4 Acceptance

Verified fixtures (cached sheet values): `A=1776246302 → D=1776246300`; `A=1776262502 → D=1776262500`. The final exported pivot row yields empty `D` (next-row guard).

---

## 6. Requirement 4 — `EQH_EQL_Summary` sheet (K)

### 6.1 Purpose

Detect **Equal Highs (EQH) / Equal Lows (EQL)** among ZigZag pivots, average them into support/resistance levels, and emit the **six most-recent levels** as horizontal lines on the Bottom Canvas (`AC2…AH2`). This is the highest-complexity stack because it depends on a chain of derived columns in `V43_New` that are themselves Excel formulas, not raw exports.

### 6.2 Dependency chain

```
V43_New raw export (per pivot row):
  A timestamp, B symbol, C timeframe, D close, E Type(Peak/Bottom),
  F CurrentPoint(pivot price), R CurrentPrChg, AD Current%Chg,
  AP Current%ChgClass, BB CurrentBars, BN CurrentBarsClass,
  BZ CurrentPrPerBar, CL CurrentPrPerBarClass, CX CurrentSlope, DJ CurrentCategory
        │
        ▼  lag/shift columns (Excel references to N rows above)
  G..Q   N-PrevPoint     = F shifted up by N (N=2,4,...,22)
  AQ..BA N-Prev%ChgClass = AP shifted up by N
  DK..DU N-PrevCategory  = DJ shifted up by N
        │
        ▼
  DV..EF  N-Prev%Diff   = (NPrevPoint - CurrentPoint)/CurrentPoint*100
  EG..EQ  N-PrevEQHL     = EQH/EQL classification (tolerance 0.25%)
  ER..FM  N-PrevS&R      = pivot price when EQHL fired, else empty
  FC..FM  N-PrevImpEQHL  = "Important" EQH/EQL (overrides FB.. block; see note)
        │
        ▼  EQH_EQL_Summary
  Z CountEQHL, AA ImpEQHL flag, AB AvgEQHL, AC..AH six most-recent levels
```

> **Column-block clarification.** In `V43_New` the three N-indexed blocks are: `EG..EQ` = EQHL labels, `ER..FB` = S&R prices, `FC..FM` = Important-EQHL labels. (The header row labels `ER..FB` as `*PrevS&R` and `FC..FM` as `*PrevImpEQHL`.) Req 4's summary `D..Y` columns pull `V43_New!ER2..FM2` — i.e. the S&R block **and** the ImpEQHL block. Implement all three blocks.

### 6.3 The "N-Prev" shift semantics

ZigZag pivots alternate Peak/Bottom. `N-Prev` (N = 2,4,…,22) references the pivot **N rows above** the current row, i.e. the _same-type_ pivot N/2 swings back (2Prev = previous same-type pivot, 4Prev = two back, … 22Prev = eleven back). Concretely the Excel cells are pure row offsets:

```
G(r) [2PrevPoint]  = F(r-2)
H(r) [4PrevPoint]  = F(r-4)   ...   Q(r) [22PrevPoint] = F(r-22)
DK(r)[2PrevCategory] = DJ(r-2) ...  DU(r)[22PrevCategory] = DJ(r-22)
AQ(r)[2Prev%ChgClass]= AP(r-2) ...  BA(r)[22Prev%ChgClass]= AP(r-22)
```

In pandas: `df["F"].shift(N)` for N in {2,4,…,22}. Rows where `r-N < first data row` are empty (NaN) — matches Excel referencing the header/blank.

### 6.4 Derived-column formulas (exact Excel)

For each `N` in `{2,4,6,…,22}` (let `k = N` for the column suffix):

```
%Diff_N      = IFERROR((PrevPoint_N - CurrentPoint)/CurrentPoint*100, "")

EQHL_N =
  IF(%Diff_N = "", "",
     IF( AND(ABS(%Diff_N) <= 0.25, Type="Bottom", PrevCategory_N="LL"), "EQL",
     IF( AND(ABS(%Diff_N) <= 0.25, Type="Peak",   PrevCategory_N="HH"), "EQH", "")))

S&R_N        = IF(OR(EQHL_N="EQL", EQHL_N="EQH"), PrevPoint_N, "")

ImpEQHL_N =
  IF( AND(EQHL_N="EQL", OR(Prev%ChgClass_N=4, Prev%ChgClass_N=5)), "IEQL",
  IF( AND(EQHL_N="EQH", OR(Prev%ChgClass_N=1, Prev%ChgClass_N=2)), "IEQH", ""))
```

**Plain-English rules:**

- **EQHL:** A previous same-type pivot is "Equal" when its price is within **±0.25%** of the current pivot price, _and_ the structure agrees — current pivot is a `Bottom` with the prev categorized `LL` → `EQL`; current is a `Peak` with prev `HH` → `EQH`. Otherwise empty.
- **S&R:** When an EQH/EQL fires, the support/resistance price is the **previous pivot's price** (`PrevPoint_N`).
- **ImpEQHL ("Important"):** Upgrades an EQL to `IEQL` if the prev pivot's `%ChgClass ∈ {4,5}` (large down moves); upgrades an EQH to `IEQH` if class `∈ {1,2}` (large up moves). The class is the MT5-exported magnitude bucket.

### 6.5 Summary sheet formulas (exact Excel)

The summary re-pulls per-row (guarded by `A2<>""`, i.e. a valid adjusted timestamp from Req 3):

```
A  timestamp = Timestamp_Adjustment!D2          # snapped epoch (join to Req 3)
B  close     = IF(A2="","", V43_New!D2)
C  point     = IF(A2="","", V43_New!F2)          # current pivot price
D..N  = V43_New!ER2..FB2     (the 11 S&R prices, 2Prev..22Prev)
O..Y  = V43_New!FC2..FM2     (the 11 ImpEQHL labels, 2Prev..22Prev)

Z  CountEQHL = IF(C3<>"", COUNT(C2:N2), 0)       # # of numeric S&R values in D..N (note: C2:N2 spans C..N)
AA ImpEQHL   = IF(AND(O2="",P2="",...,Y2=""), 0, 1)   # 1 if ANY ImpEQHL label present in O..Y
AB AvgEQHL   = IF(OR(Z2>=3, AA2=1), AVERAGE(C2:N2), "")  # level = mean of pivot + its S&R prices
```

> **Exactness notes:**
>
> - `Z2 = IF(C3<>"", COUNT(C2:N2), 0)`. `COUNT` counts **numeric** cells only (S&R cells are blank when no EQHL fired), and the range is `C2:N2` (the current pivot price `C` plus the 11 S&R columns `D..N`). The guard `C3<>""` requires the _next_ row's pivot to exist.
> - `AA2 = 1` iff **any** of `O2..Y2` (ImpEQHL labels) is non-empty.
> - `AB2`: a level is published only when there are **≥3** equal points in the cluster **OR** at least one _important_ EQHL is present. The level value is `AVERAGE(C2:N2)` = mean of the current pivot price and all its equal S&R prices. (Blank S&R cells are ignored by `AVERAGE`.)

**The six horizontal lines (`AC2…AH2`) — array formulas:**

```
AC2 = INDEX(AB$2:AB$183, MATCH(LARGE(IF(AB$2:AB$183<>"", ROW(AB$2:AB$183)-1), 1),
                               IF(AB$2:AB$183<>"", ROW(AB$2:AB$183)-1), 0))
AD2 = ... LARGE(..., 2) ...     # 2nd most recent
AE2 = ... LARGE(..., 3) ...
AF2 = ... LARGE(..., 4) ...
AG2 = ... LARGE(..., 5) ...
AH2 = ... LARGE(..., 6) ...
```

Decoded: among all rows where `AvgEQHL (AB)` is non-empty, take the **6 highest row indices** (= the 6 most-recent pivots that produced a level) and return their `AvgEQHL` values, most-recent first. These six values are the EQH/EQL horizontal lines drawn on the Bottom Canvas.

### 6.6 Python implementation (`calc/zigzag_features.py` + `calc/eqh_eql.py`)

```python
# zigzag_features.py — rebuild the V43_New derived columns
import numpy as np
import pandas as pd

N_LAGS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]
EQ_TOL_PCT = 0.25

def build_v43_features(v43: pd.DataFrame) -> pd.DataFrame:
    """Input has raw exported columns; output adds %Diff, EQHL, S&R, ImpEQHL per lag.
    Required raw cols: type ('Peak'/'Bottom'), current_point (F),
                       current_pct_chg_class (AP), current_category (DJ).
    """
    df = v43.reset_index(drop=True).copy()
    out = df.copy()
    for n in N_LAGS:
        prev_point    = df["current_point"].shift(n)
        prev_category = df["current_category"].shift(n)
        prev_class    = df["current_pct_chg_class"].shift(n)

        pct_diff = (prev_point - df["current_point"]) / df["current_point"] * 100.0
        pct_diff = pct_diff.where(prev_point.notna(), other=pd.NA)  # IFERROR("")

        within = pct_diff.abs() <= EQ_TOL_PCT
        eqhl = pd.Series(pd.NA, index=df.index, dtype="object")
        eqhl = eqhl.mask(within & (df["type"] == "Bottom") & (prev_category == "LL"), "EQL")
        eqhl = eqhl.mask(within & (df["type"] == "Peak")   & (prev_category == "HH"), "EQH")
        eqhl = eqhl.where(pct_diff.notna(), other=pd.NA)  # %Diff empty -> empty

        sr = prev_point.where(eqhl.isin(["EQL", "EQH"]), other=pd.NA)

        imp = pd.Series(pd.NA, index=df.index, dtype="object")
        imp = imp.mask((eqhl == "EQL") & prev_class.isin([4, 5]), "IEQL")
        imp = imp.mask((eqhl == "EQH") & prev_class.isin([1, 2]), "IEQH")

        out[f"pct_diff_{n}"] = pct_diff
        out[f"eqhl_{n}"]     = eqhl
        out[f"sr_{n}"]       = sr
        out[f"imp_eqhl_{n}"] = imp
    return out
```

```python
# eqh_eql.py — the EQH_EQL_Summary sheet (K)
import numpy as np
import pandas as pd

def run_eqh_eql_summary(features: pd.DataFrame, ts_adj: pd.DataFrame) -> dict:
    """features: output of build_v43_features (row-aligned to V43_New).
       ts_adj:   output of run_timestamp_adjustment (provides snapped 'timestamp_adjusted').
       Returns {'rows': DataFrame(sheet K A..AB), 'horizontal_lines': [6 floats, most-recent first]}.
    """
    n = len(features)
    A = ts_adj["timestamp_adjusted"].reset_index(drop=True)        # col A
    valid = A.notna()                                              # A2<>"" guard
    point = features["current_point"].reset_index(drop=True)       # col C
    close = features["close"].reset_index(drop=True)               # col B

    sr_cols  = [f"sr_{k}"  for k in [2,4,6,8,10,12,14,16,18,20,22]]   # D..N
    imp_cols = [f"imp_eqhl_{k}" for k in [2,4,6,8,10,12,14,16,18,20,22]]  # O..Y

    df = pd.DataFrame(index=features.index)
    df["timestamp"] = A.where(valid)
    df["close"]     = close.where(valid)
    df["point"]     = point.where(valid)
    for i, c in enumerate(sr_cols):  df[f"sr_{i}"]  = features[c].where(valid)
    for i, c in enumerate(imp_cols): df[f"imp_{i}"] = features[c].where(valid)

    # C2:N2 = [point] + [11 S&R]   (numeric mean / count)
    cluster = pd.concat([df["point"]] + [df[f"sr_{i}"] for i in range(11)], axis=1)
    cluster_num = cluster.apply(pd.to_numeric, errors="coerce")

    count_eqhl = cluster_num.notna().sum(axis=1)                   # COUNT(C2:N2)
    # Z guard: only valid when NEXT row's pivot exists (C3<>"")
    next_point_exists = df["point"].shift(-1).notna()
    df["count_eqhl"] = np.where(next_point_exists, count_eqhl, 0)

    imp_present = pd.concat([df[f"imp_{i}"] for i in range(11)], axis=1).notna().any(axis=1)
    df["imp_eqhl"] = imp_present.astype(int)                       # AA

    publish = (df["count_eqhl"] >= 3) | (df["imp_eqhl"] == 1)
    df["avg_eqhl"] = cluster_num.mean(axis=1).where(publish)       # AB (AVERAGE ignores blanks)

    # AC..AH: the 6 most-recent non-empty avg_eqhl, most-recent first
    levels = df.loc[df["avg_eqhl"].notna(), "avg_eqhl"]
    horizontal_lines = list(levels.iloc[::-1].head(6).values)      # last 6, reversed
    return {"rows": df, "horizontal_lines": horizontal_lines}
```

> **`AVERAGE(C2:N2)` parity:** Excel `AVERAGE` skips blank/text cells and divides by the count of numeric cells. `cluster_num.mean(axis=1)` with NaN for blanks does exactly this. Do **not** fill blanks with 0.

### 6.7 Acceptance

Verified fixtures (cached sheet values):

- `AC2..AH2 (6 horizontal lines)` = `[4515.5133…, 4521.39, 4370.895, 4492.2067…, 4538.40, 4487.7967…]`.
- Row 2: `timestamp(A)=1776246300, close(B)=4798.21, point(C)=4786.23, CountEQHL(Z)=1, ImpEQHL(AA)=0, AvgEQHL(AB)=empty` (not published: count<3 and no important).

The parity test reconstructs `V43_New` derived columns from the raw export, recomputes K, and matches all of A..AB plus the six AC..AH values.

---

## 7. Output / serialization contracts

The pipeline (`calc/pipeline.py`) runs `validation → combine` and `timestamp_adjust → zigzag_features → eqh_eql`, then `serialize/payload.py` emits one JSON message. Recommended shape (frontend = TradingView Lightweight Charts):

```json
{
  "schema_version": "1.0",
  "symbol": "XAUUSD",
  "timeframe": "M15",
  "validation": { "all_validation": true, "failed_fields": [] },
  "top_canvas": {
    "bars": [
      {
        "time": 1776227400,
        "close": 4823.51,
        "ssa": 4826.17016,
        "ema_ssa": 4826.17016,
        "crossing": 0,
        "horiz_high_map": null,
        "horiz_low_map": null,
        "models": {
          "most_recent": { "base_fl": null, "uoedt": null, "loedt": null },
          "non_a": { "...": null },
          "non_b": {},
          "cherry_a": {},
          "cherry_b": {},
          "best_fit": { "cfl": null, "uoedt": null, "loedt": null }
        }
      }
    ]
  },
  "bottom_canvas": {
    "zigzag": [{ "time": 1776246300, "type": "Bottom", "point": 4786.23 }],
    "eqh_eql_lines": [4515.51, 4521.39, 4370.9, 4492.21, 4538.4, 4487.8]
  }
}
```

Rules:

- **Empty → `null`.** Never serialize Excel `""`.
- **`all_validation == false` ⇒ `top_canvas.bars` empty** (mirrors §4.4). `failed_fields` lists which of the 9 validation fields failed (derive from the BC–BK matrix: a field fails if any row is False) for operator diagnostics.
- `eqh_eql_lines` is exactly the 6 (or fewer, if <6 levels exist) most-recent `AvgEQHL` values, most-recent first — these are the `AC2…AH2` horizontal lines for the Bottom Canvas (UI spec §3.2).
- Times are integer epoch seconds, already M15/5-min snapped.

---

## 8. Testing strategy (the workbooks are the oracle)

Build **golden-fixture parity tests** before/with the implementation. The xlsx files contain Excel's cached computed values — extract them to CSV and assert the Python output matches.

1. **Fixture extraction (one-off script).** Load each workbook with `openpyxl(data_only=True)` and export:
   - source sheets A–F → `fixtures/centroid_source_<name>.csv`
   - `Validation` BC–BK matrix + BL2 → `fixtures/validation_matrix.csv`, `validation_gate.txt`
   - `Combine_After_Validation` A–AA → `fixtures/combine.csv`
   - `V43_New` (raw + derived) → `fixtures/v43_new.csv`
   - `Timestamp_Adjustment` → `fixtures/timestamp_adjustment.csv`
   - `EQH_EQL_Summary` A–AH → `fixtures/eqh_eql_summary.csv`
2. **Per-stack tests** (`pytest`), tolerance `1e-9` for floats, exact for strings/booleans/timestamps:
   - `test_timestamp_adjust`: includes the 3 verified epoch pairs + the trailing-row empty guard.
   - `test_validation`: full BC–BK matrix equality + `all_validation is True`. Add a synthetic negative case (perturb one source cell) ⇒ gate flips to False.
   - `test_combine`: cell-for-cell vs sheet H, plus a gate-False case ⇒ all columns empty.
   - `test_zigzag_features`: EQHL/S&R/ImpEQHL columns vs `v43_new.csv`.
   - `test_eqh_eql`: A–AB vs fixture, and `horizontal_lines == [4515.51…, 4521.39, 4370.895, 4492.21…, 4538.40, 4487.80…]`.
3. **Empty-semantics tests**: assert no `""` leaks into JSON; both-empty cells compare equal in validation.
4. **Property/regression**: re-running the pipeline twice yields identical output (determinism).

> **Verification directive for Claude Code:** implement the parity harness _first_, confirm it reproduces the six cached `AC..AH` line values and `all_validation=True`, then refactor freely. A green parity suite is the definition of done.

---

## 9. Edge cases & gotchas checklist

- [ ] `CEILING`/`INT`/`MROUND` map to `ceil`/`floor`/half-away-from-zero — not Python's banker's rounding.
- [ ] Timestamp grid is **5-minute (300s)**, even on M15 — preserve.
- [ ] Req 3 `B`-column **next-row** empty guard drops the forming pivot.
- [ ] Req 1 empty-vs-empty must compare **equal** (sparse pivot maps).
- [ ] Req 1 `BL2` is a **single global** AND over the whole matrix; one bad cell ⇒ whole frame fails.
- [ ] Req 2 gate-False ⇒ **all 27 columns empty**.
- [ ] Req 2 coalesce order fixed: most_recent → non_a → non_b → cherry_a → cherry_b → best_fit.
- [ ] Req 2 `Best_Fit` Base column renamed `CFL` in output only.
- [ ] Req 4 `N-Prev` = row shift by N (2…22), not a timestamp join.
- [ ] Req 4 EQ tolerance is **±0.25%**, structure must agree (Bottom+LL→EQL, Peak+HH→EQH).
- [ ] Req 4 `AvgEQHL` publishes only when `Count≥3 OR any ImpEQHL`; value = `AVERAGE(C:N)` skipping blanks.
- [ ] Req 4 `CountEQHL` range is `C2:N2` (pivot + 11 S&R) and guarded by next-row pivot existing.
- [ ] Req 4 horizontal lines = 6 most-recent published levels, **most-recent first**.
- [ ] Never serialize `""`; emit `null`.
- [ ] Inputs are **row-aligned** across the 6 EDT sources (same bar = same row index).
- [ ] **Every guard in §10 is implemented.** Sparse map empty-passthrough (C-1); Combine gate cascade C-4/C-5; Timestamp next-row guard Z-1 propagating to Z-2; V43_New `IFERROR` %Diff (V-1) feeding the EQHL/S&R/Imp guards (V-2/3/4); Summary timestamp gate K-1; `Count≥3 OR Imp` publish rule K-4.
- [ ] **Blank ≠ zero ≠ false.** Only the §10.3-listed cells return the blank sentinel; `CountEQHL`/`ImpEQHL` (K-2/K-3) are intentionally numeric `0/1`; validators (C-2/C-3) are booleans.

---

## 10. Complete validation & empty-return catalogue (AUTHORITATIVE)

> **Why this section exists.** Across both workbooks, _every computed cell that can return a blank does so through an explicit guard_. If any guard is missed, the Python output silently diverges from Excel (wrong levels published, lines drawn from forming pivots, geometry shown when models disagree, etc.). This section enumerates **every** guard in both files — extracted directly from the formulas — so nothing is left implicit. `∅` = Excel empty `""` → Python `None`/`NaN` → JSON `null`.

### 10.1 Workbook `centroid_regression_and-edt.xlsx`

| ID  | Sheet · cols                                                                                                                    | Excel guard (representative)                                               | Returns `∅` (or shown value) when…                                      | Python rule                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1 | **Validation** E,F (and N,O / W,X / AF,AG / AO,AP / AX,AY) — the `horiz_high_map`/`horiz_low_map` pulls for all 6 source blocks | `=IF(src!H2="","",src!H2)`                                                 | source pivot-map cell is empty → pass `∅` through                       | These two map columns are **sparse**; preserve emptiness on pull. All other pulls (timestamp/symbol/timeframe/close/ssa/ema/crossing) are raw, no guard.                  |
| C-2 | **Validation** BC..BK (9 per-field validators)                                                                                  | `=AND(A2=J2,J2=S2,S2=AB2,AB2=AK2,AK2=AT2)`                                 | returns **FALSE** (not `∅`) if the 6 sources disagree on that field/row | element-wise all-equal; **empty==empty ⇒ TRUE** (see §3.4). Booleans, never blank.                                                                                        |
| C-3 | **Validation** BL2 (`all_validation`)                                                                                           | `=AND(BC2:BK3001)`                                                         | FALSE if **any** cell in the whole BC..BK matrix is FALSE               | single global boolean gate.                                                                                                                                               |
| C-4 | **Combine** A,B,C,D and W,X,Y,Z,AA (9 _coalesce_ cols)                                                                          | `=IF(AND($BL$2=TRUE,A2<>""),A2, IF(AND($BL$2=TRUE,J2<>""),J2, … ,""))`     | `∅` if gate FALSE **or** all 6 sources empty for that field             | `value if gate else ∅`; else first-non-empty across the 6 in fixed order.                                                                                                 |
| C-5 | **Combine** E..V (18 _passthrough_ cols, the per-model Base_FL/UOEDT/LOEDT/CFL)                                                 | `=IF(AND($BL$2=TRUE,src!E2<>""),src!E2, IF(AND($BL$2=TRUE,src!E2=""),""))` | `∅` if gate FALSE **or** that model's source cell is empty              | `src if (gate and src not empty) else ∅`. Note: when gate TRUE and src empty the inner IF yields `∅`; when gate FALSE both IFs fail → Excel `FALSE`/blank — treat as `∅`. |

> **Gate cascade (critical):** guards C-4 and C-5 all hinge on `Validation!$BL$2`. When `all_validation` is FALSE, **all 27 Combine columns are `∅` for every row** → the Top Canvas receives an empty dataset. Implement the gate check once at the top of `run_combine` (already done in §4.5).

### 10.2 Workbook `zigzag_v43_repaired.xlsx`

**Sheet `Timestamp_Adjustment` (J):**

| ID  | Col                                | Excel guard                                                              | Returns `∅` when…                                                                      | Python rule                                                                                                                                                                                           |
| --- | ---------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z-1 | B (`convert_to_readable_datetime`) | `=IF(A3="","",(A2/86400)+25569)`                                         | the **next** row's raw timestamp (`A3`) is empty                                       | drop the still-forming last pivot; C and D propagate the blank. `shift(-1)` guard in §5.3.                                                                                                            |
| Z-2 | C, D                               | `=IFERROR(CEILING(...),"")` / `=IFERROR(MROUND((C−25569)*86400,300),"")` | B is blank (last/forming pivot) → arithmetic on `""` would error → IFERROR returns `∅` | only compute where B is non-empty; Python returns `NA` via the `next_exists` guard (no IFERROR needed). **Fixed:** original C/D lacked IFERROR and produced `#VALUE!` at the last row (e.g. row 183). |

**Sheet `V43_New` (I) — derived columns (raw export columns have no guards):**

| ID  | Cols                            | Excel guard                                                                                                                                      | Returns `∅` when…                                                           | Python rule                                                                          |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| V-1 | DV..EF (`N-Prev%Diff`, N=2..22) | `=IFERROR((PrevPoint−$F)/$F*100,"")`                                                                                                             | division error (no prev pivot / `F`=0) → `∅`                                | `(prev−cur)/cur*100`, mask to `∅` where prev is NaN; wrap in try/IFERROR equivalent. |
| V-2 | EG..EQ (`N-PrevEQHL`)           | `=IF(%DiffN="","", IF(AND(ABS(%DiffN)<=0.25,Type="Bottom",PrevCatN="LL"),"EQL", IF(AND(ABS(%DiffN)<=0.25,Type="Peak",PrevCatN="HH"),"EQH","")))` | `∅` if `%Diff` is `∅`, **or** tolerance/structure not met (inner else `""`) | two-level guard: outer empties on missing %Diff; inner empties on no-match.          |
| V-3 | ER..FB (`N-PrevS&R`)            | `=IF(OR(EQHLN="EQL",EQHLN="EQH"),PrevPointN,"")`                                                                                                 | `∅` unless that lag fired an EQH/EQL                                        | publish prev pivot price only when EQHL set.                                         |
| V-4 | FC..FM (`N-PrevImpEQHL`)        | `=IF(AND(EQHLN="EQL",OR(class∈{4,5})),"IEQL", IF(AND(EQHLN="EQH",OR(class∈{1,2})),"IEQH",""))`                                                   | `∅` unless an EQL/EQH is _important_ (class match)                          | else `∅`.                                                                            |

**Sheet `EQH_EQL_Summary` (K):**

| ID  | Col                         | Excel guard                                                                                       | Returns value when…                                                                  | Python rule                                                                                                     |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| K-1 | B, C, and D..Y (24 pulls)   | `=IF(A2="","",V43_New!…)`                                                                         | `∅` if the row's adjusted timestamp `A2` (from J) is empty                           | gate every summary pull on `timestamp_adjusted` present.                                                        |
| K-2 | Z (`CountEQHL`)             | `=IF(C3<>"",COUNT(C2:N2),0)`                                                                      | **0** (not `∅`) if next-row pivot `C3` empty; else count of numeric cells in `C2:N2` | `COUNT` counts numerics only (blank S&R ignored); range = pivot `C` + 11 S&R `D..N`. Guarded by next-row pivot. |
| K-3 | AA (`ImpEQHL`)              | `=IF(AND(O2="",…,Y2=""),0,1)`                                                                     | **0** if all 11 ImpEQHL labels (`O..Y`) empty, else **1**                            | flag = any important label present.                                                                             |
| K-4 | AB (`AvgEQHL`)              | `=IF(OR(Z2>=3,AA2=1),AVERAGE(C2:N2),"")`                                                          | `∅` unless `Count≥3` **OR** `ImpEQHL=1`; else mean of `C2:N2`                        | `AVERAGE` skips blanks (divides by numeric count) — do **not** fill blanks with 0.                              |
| K-5 | AC..AH (6 horizontal lines) | `{=INDEX(AB$2:AB$183,MATCH(LARGE(IF(AB<>"",ROW−1),k),IF(AB<>"",ROW−1),0))}` array formula, k=1..6 | the k-th most-recent **non-empty** `AB` (AvgEQHL)                                    | take published levels, reverse, head(6); fewer than 6 if not enough levels.                                     |

### 10.3 Consolidated empty-propagation rules (implementation invariants)

1. **One sentinel.** Excel `""` ⇒ Python `None`/`NaN` ⇒ JSON `null`. Never emit `""`, and never coerce a guarded blank to `0` (except K-2/K-3 which are _intentionally_ `0`, and are numeric, not blank).
2. **Guards propagate downstream.** A blank from V-1 empties V-2 → V-3/V-4 → K-1 (S&R/Imp pulls) → affects K-2/K-4. A blank `A` from Z-1 empties the entire K row (K-1). A FALSE C-3 gate empties all of Combine (C-4/C-5). Implement guards in dependency order so blanks flow naturally.
3. **Distinguish "blank" from "false/zero".** C-2/C-3 return booleans; K-2/K-3 return `0`/`1`. Only C-1, C-4, C-5, Z-1/Z-2, V-1..V-4, K-1, K-4, K-5 return the blank sentinel.
4. **`empty == empty ⇒ equal`** (C-2) but in pandas `NaN == NaN` is False — use the `cells_equal` helper (§3.5) wherever Excel compares possibly-blank cells.
5. **Test every guard.** §8 parity tests must include at least one fixture row that exercises each guard's blank branch _and_ its value branch (e.g. an `all_validation=False` case for C-4/C-5; an unpublished pivot for K-4; the trailing forming pivot for Z-1).

---

## 11. Appendix — input data contracts (MT5 exports)

Both indicator families write **tab-delimited UTF-8 (no BOM)** text files (`FileOpen(..., FILE_TXT|FILE_ANSI, '\t', CP_UTF8)`).

**ZigZag export → `V43_New` raw columns** (15 fields per `StringFormat("%d\t%s\t%s\t%.5f\t%s\t%.5f\t%.5f\t%.2f\t%d\t%d\t%d\t%.5f\t%d\t%.4f\t%s")`), mapping in order to:
`A TimeStamp(int) · B symbol · C timeframe · D close · E Type · F CurrentPoint · R CurrentPrChg · AD Current%Chg · AP Current%ChgClass · BB CurrentBars · BN CurrentBarsClass · BZ CurrentPrPerBar · CL CurrentPrPerBarClass · CX CurrentSlope · DJ CurrentCategory`. All other `V43_New` columns are **Excel-derived** (this document, §6) — the Python `zigzag_features` stack reproduces them.

**EDT model exports (A–F) → 16 columns** as in §3.2. `Base_FL/UOEDT/LOEDT` (E/F/G), `horiz_high_map/horiz_low_map` (H/I) are sparse; `ssa/ema_ssa/crossing` (J/K/L) dense; `N/O/P` are the timestamp-helper columns (the Python reader computes the snapped timestamp via §2 instead of trusting exported helper cols).

`io/mt5_reader.py` must: read tab-delimited, coerce numeric columns, map MT5 empty cells to `NaN`/`None`, attach the snapped timestamp via `snap_timestamp`, and validate against `io/schemas.py` before the calculation layer runs.

---

_End of specification. The two workbooks (`centroid_regression_and-edt.xlsx`, `zigzag_v43_repaired.xlsx`) remain the numerical oracle for all four stacks._

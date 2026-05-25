**XAUUSD SSA MULTI-TIMEFRAME SYSTEM**

Architecture Design Document

_Python (Stack A + B) · Nest.js (Stack C) · Next.js v16 Frontend_

**Reference File**

ALGLIB_SSA_XAUUSD_timeframemapping_H3_M15_v6.xlsx

_Confidential --- for Claude Code implementation_

**Table of Contents**

**1. System Overview**

This document is the definitive reference for implementing the XAUUSD SSA multi-timeframe signal system. It translates all calculation logic encoded in the reference Excel workbook into three independent but interconnected software stacks. The document is written to be handed directly to Claude Code for implementation.

**1.1 Business Purpose**

The system ingests raw tick/bar data exported from MetaTrader 5 (MQL5) for Gold (XAUUSD) across two timeframes --- H3 (3-hour bars) and M15 (15-minute bars) --- and applies Singular Spectrum Analysis (SSA) to identify trend direction and dynamic support/resistance bands projected forward in time.

The final output is a set of time-series values consumed by a TradingView Lightweight Charts panel, allowing a trader to read SSA-derived trend signals and projected high/low bands overlaid on the raw M15 price chart.

**1.2 High-Level Data Flow**

The pipeline runs in four sequential stages:

1.  MQL5 export → raw CSV/XLSX with H3 and M15 OHLC + SSA values (columns A--W of sheet ALGLIB_SSA_XAUUSD).

2.  Stack A (Python) --- Timestamp normalisation: raw MQL5 Unix timestamps are rounded to a clean 15-minute grid and stored alongside the originals (columns K--M for H3, Y--AA for M15).

3.  Stack B (Python) --- Mapping & interpolation engine: every M15 bar is mapped to its parent H3 bar; H3 SSA values are linearly interpolated across the 12 M15 positions within each group; regression-based forward projections are computed (columns A--BB of sheet Mapped_H3_M15_Interporate). The final output columns BD--BM are emitted as structured records.

4.  Stack C (Nest.js) serves the BD--BM records via a REST/WebSocket API. The Next.js v16 frontend consumes this API and renders the data through TradingView Lightweight Charts.

**1.3 Key Ratios and Constants**

---

**Constant** **Value** **Derivation**
H3 bar duration 10,800 s 3 hours × 3600 s/hour
M15 bar duration 900 s 15 minutes × 60 s/minute
Bars per H3 group 12 10,800 / 900 = 12
TS_STEP (forward fill) 900 s One M15 bar interval
DATA_ROWS 2,400 Total M15 rows (200 H3 bars × 12)
MAX_DATA_ROW 2,401 Last data row index in 1-based Excel
LAST_ANCHOR 2,390 Row of last H3 anchor = 2 + 199×12
Regression window 12 rows One full H3 group (previous group)
Slope cap high +3 / −0.5 Positive → min(3, \|slope\|); negative → max(−0.5, slope)
Slope cap low −3 / +0.5 Negative → max(−3, −\|slope\|); positive → min(0.5, slope)

---

**2. Source Data Schema --- Sheet: ALGLIB_SSA_XAUUSD**

This sheet is the raw MQL5 export. Rows 1 is the header; rows 2--2401 contain bar data. Stack A reads this sheet and writes the three rounding columns (K--M for H3, Y--AA for M15). Stack B reads all columns from this sheet as lookup sources.

**2.1 H3 Columns (A--M)**

---

**Col** **Name** **Type** **Notes**
A timestamp_h3 Unix int Raw MQL5 H3 bar open time (seconds since 1970-01-01)
B symbol_h3 String Always \'XAUUSD\'
C timeframe_h3 String Always \'H3\'
D close_h3 Float H3 bar close price
E ssa_h3 Float SSA reconstruction of H3 close
F ema_ssa_h3 Float EMA of ssa_h3
G ssa_high_h3 Float SSA upper band on H3
H ssa_low_h3 Float SSA lower band on H3
I SSA_Crossing_h3 0 or 1 Crossing signal (unused in Stacks B--C)
J (spacer) --- Empty column
K convert_to_readable_datetime_h3 Float (serial) Excel date serial = A/86400 + 25569
L round_to_nearest_datetime_h3 Float (serial) CEILING(INT(K×1440)/1440×288, 1)/288
M timestamp_adjusted_h3 Unix int MROUND((L−25569)×86400, 300) --- rounded to 5-min grid

---

**2.2 M15 Columns (O--AA)**

---

**Col** **Name** **Type** **Notes**
O timestamp_m15 Unix int Raw MQL5 M15 bar open time
P symbol_m15 String Always \'XAUUSD\'
Q timeframe_m15 String Always \'M15\'
R close_m15 Float M15 bar close price
S ssa_m15 Float SSA reconstruction of M15 close
T ema_ssa_m15 Float EMA of ssa_m15
U ssa_high_m15 Float SSA upper band on M15
V ssa_low_m15 Float SSA lower band on M15
W SSA_Crossing_m15 0 or 1 Crossing signal (unused in Stacks B--C)
X (spacer) --- Empty column
Y convert_to_readable_datetime_m15 Float (serial) (O/86400)+25569
Z round_to_nearest_datetime_15m Float (serial) CEILING(INT(Y×1440)/1440×288, 1)/288
AA timestamp_adjusted_m15 Unix int MROUND((Z−25569)×86400, 300) --- Stack B uses this as the join key for all M15 lookups

---

**3. Python Development Stack --- Technology Reference**

This section is the definitive technology reference for Claude Code when implementing Stack A and Stack B. All libraries listed below must be used as specified. No substitution without explicit approval.

**3.1 Runtime Environment**

---

**Component** **Version** **Purpose**
Python 3.11+ Minimum required for match-statement support and improved error messages. Use 3.12 for best performance.
pip / uv latest Package installation. Prefer uv for speed in CI/CD environments.
venv stdlib Virtual environment isolation. Always activate before running Stack A/B.

---

**3.2 Core Computation Libraries**

---

**Library** **Version** **Import** **Used for**
pandas \>=2.0 import pandas as pd Primary DataFrame for holding all 2,400 M15 rows; merge operations for M15 XLOOKUP; time-indexed querying
numpy \>=1.26 import numpy as np searchsorted() for INDEX/MATCH type=1 (H3 lookup); array operations on H3 source columns
scipy \>=1.12 from scipy.stats import linregress Linear regression for AT/AU slope calculation (regression window = 12 rows)
math stdlib import math math.ceil() for the CEILING step in timestamp normalisation (Step 2 of 3)
openpyxl \>=3.1 from openpyxl import load_workbook Initial ingestion of MQL5 xlsx export (Stack A data source). Not used in real-time mode.

---

**3.3 Scheduling and HTTP Libraries**

---

**Library** **Version** **Import** **Used for**
APScheduler \>=3.10 from apscheduler.schedulers.background import BackgroundScheduler Pass 1 cron (\*/15 \* \* \* \*) and Pass 2 cron (0 \*/3 \* \* \*)
httpx \>=0.27 import httpx Async HTTP POST to Stack C /api/v1/bars/batch endpoint. Use httpx.AsyncClient for non-blocking sends.
pydantic \>=2.0 from pydantic import BaseModel BarRecord schema validation before sending to Stack C. Mirrors the NestJS BarRecordDto exactly.
python-dotenv \>=1.0 from dotenv import load_dotenv Load STACK_C_URL, API_KEY, DB_PATH from .env without hardcoding secrets

---

**3.4 requirements.txt**

The following requirements.txt must be placed in the Stack A/B project root. Pin exact versions for reproducible builds:

> \# Stack A + B --- Python computation engine
>
> \# Generated for Python 3.11+
>
> pandas\>=2.0,\<3.0
>
> numpy\>=1.26,\<2.0
>
> scipy\>=1.12,\<2.0
>
> openpyxl\>=3.1,\<4.0
>
> APScheduler\>=3.10,\<4.0
>
> httpx\>=0.27,\<1.0
>
> pydantic\>=2.0,\<3.0
>
> python-dotenv\>=1.0,\<2.0

**3.5 Project Structure (Stack A + B)**

> ssa_engine/
>
> ├── .env \<- STACK_C_URL, API_KEY, LOG_LEVEL
>
> ├── requirements.txt
>
> ├── main.py \<- entry point; starts APScheduler
>
> ├── stack_a/
>
> │ ├── \_\_init\_\_.py
>
> │ └── normalise.py \<- normalise_timestamp(), unix_to_excel_serial(), etc.
>
> ├── stack_b/
>
> │ ├── \_\_init\_\_.py
>
> │ ├── engine.py \<- pass1_m15_arrival(), pass2_h3_close(), batch_mode()
>
> │ ├── lookup.py \<- match_type1(), m15_exact_lookup()
>
> │ ├── interpolate.py \<- and_guard_interp_efgh(), and_guard_interp_i()
>
> │ ├── regression.py \<- clamped_slope_high(), clamped_slope_low(), compute_ax(), compute_ay()
>
> │ └── forward_fill.py \<- forward_fill_timestamp(), x_count_regression()
>
> ├── transport/
>
> │ ├── \_\_init\_\_.py
>
> │ └── stack_c_client.py \<- post_batch() via httpx.AsyncClient
>
> ├── schema/
>
> │ └── bar_record.py \<- BarRecord pydantic model (mirrors BarRecordDto)
>
> └── tests/
>
> ├── test_normalise.py \<- verify ts_adjusted against v6.xlsx column AA / M
>
> ├── test_interpolate.py \<- verify AND-guard, fillback, null propagation
>
> └── test_regression.py \<- verify AT/AU slope clamping, BL/BM try/except

**4. Stack A --- Timestamp Normalisation (Python)**

Stack A consumes the raw MQL5 export and produces three normalised timestamp columns for each timeframe. These cleaned timestamps are the join keys that allow H3 and M15 data to be aligned without drift.

**4.1 Why Timestamp Normalisation is Necessary**

MQL5 exports raw Unix timestamps that may contain sub-minute offsets introduced by broker feed irregularities. H3 bar open times, for example, are not always exact multiples of 10,800 seconds, and M15 open times are not always exact multiples of 900 seconds. Without normalisation, XLOOKUP exact-match lookups would fail for the majority of rows. The rounding pipeline eliminates this drift.

**4.2 Rounding Pipeline --- Exact Formula Translation**

The three-step pipeline converts a raw Unix timestamp to a clean grid-aligned Unix timestamp. The intermediate Excel serial format is used purely as a unit-conversion vehicle.

**Step 1 --- Unix → Excel Serial**

Excel stores dates as floating-point day counts since 1899-12-30. The conversion is:

> excel_serial = (unix_ts / 86400.0) + 25569.0

Where 25569 is the number of days between 1899-12-30 and 1970-01-01 (the Unix epoch).

**Step 2 --- Round to Nearest 5-Minute Slot**

The formula uses a two-step CEILING operation that first truncates sub-minute fractions, then rounds up to the nearest 1/288-day boundary (288 = 1440 minutes per day ÷ 5-minute slots):

> rounded_serial = math.ceil( int(excel_serial \* 1440) / 1440 \* 288 ) / 288

This is equivalent to the Excel expression: CEILING(INT(K\*1440)/1440\*288, 1)/288

> **⚑ Python\'s math.ceil maps directly to Excel\'s CEILING(x, 1) when the granularity is 1 unit.**

**Step 3 --- Excel Serial → Rounded Unix**

Convert back to Unix, then snap to the nearest 300-second (5-minute) grid using MROUND:

> unix_rounded = round( (rounded_serial - 25569.0) \* 86400 / 300 ) \* 300

The final result is the clean timestamp used as the join key. For M15, the grid is 300 s (output of MROUND(\..., 300)). For H3, the same formula applies --- because the MROUND(\..., 300) formula uses 300 for both timeframes in v6, this produces a 5-minute aligned timestamp that accommodates any H3 open-time drift.

**4.3 Python Implementation Blueprint**

> import math
>
> def unix_to_excel_serial(unix_ts: int) -\> float:
>
> return unix_ts / 86400.0 + 25569.0
>
> def round_to_nearest_5min_serial(excel_serial: float) -\> float:
>
> \# CEILING(INT(serial \* 1440) / 1440 \* 288, 1) / 288
>
> return math.ceil(int(excel_serial \* 1440) / 1440 \* 288) / 288
>
> def serial_to_unix_rounded(rounded_serial: float) -\> int:
>
> \# MROUND((serial - 25569) \* 86400, 300)
>
> raw = (rounded_serial - 25569.0) \* 86400
>
> return int(round(raw / 300) \* 300)
>
> def normalise_timestamp(unix_ts: int) -\> dict:
>
> serial = unix_to_excel_serial(unix_ts)
>
> rounded_serial = round_to_nearest_5min_serial(serial)
>
> ts_adjusted = serial_to_unix_rounded(rounded_serial)
>
> return {
>
> \'excel_serial\': serial,
>
> \'rounded_serial\': rounded_serial,
>
> \'ts_adjusted\': ts_adjusted,
>
> }

**4.4 Stack A Data Contract**

Stack A must produce two enriched DataFrames (one per timeframe) with the following columns appended to the raw MQL5 data:

---

**Output Field** **Source** **Python dtype** **Description**
excel_serial_h3 timestamp_h3 float64 Intermediate: Excel day-serial for H3
rounded_serial_h3 excel_serial_h3 float64 Nearest 5-min slot as Excel serial for H3
ts_adjusted_h3 rounded_serial_h3 int64 Clean Unix ts for H3 (join key for H3 lookups)
excel_serial_m15 timestamp_m15 float64 Intermediate: Excel day-serial for M15
rounded_serial_m15 excel_serial_m15 float64 Nearest 5-min slot as Excel serial for M15
ts_adjusted_m15 rounded_serial_m15 int64 Clean Unix ts for M15 (primary join key --- col AA)

---

**5. Stack B --- Mapping & Interpolation Engine (Python)**

Stack B implements all 65 columns of sheet Mapped_H3_M15_Interporate. It consumes the output of Stack A and produces the BD--BM final output records. This is the computational core of the system.

**5.1 Group / Block Architecture**

Every M15 row belongs to exactly one H3 group (also called a block). Within a group, position 0 is the anchor (the first M15 bar whose timestamp falls within that H3 bar) and positions 1--11 are non-anchor rows that receive interpolated H3 values.

---

**Concept** **Excel** **Python**
Row index (0-based) ROW()-2 i = row_index (0 = first data row)
Position within group MOD(ROW()-2, 12) pos = i % 12 (0..11)
Group index (0-based) INT((ROW()-2)/12) g = i // 12 (0..199)
Anchor row index group_start = 2+(g\*12) anchor_i = g \* 12
Next anchor row index next_anchor = group_start+12 next_anchor_i = anchor_i + 12
block_index_h3 (1-based) INT((ROW()-2)/12)+1 g + 1
block_index_m15 (1-based) MOD(ROW()-2,12)+1 pos + 1

---

**5.2 Column-by-Column Implementation Guide**

**Group 1: Columns A--I --- H3 Data with Interpolation**

**Column A --- timestamp_m15 (join key)**

Source: ts_adjusted_m15 from Stack A output (column AA of ALGLIB_SSA_XAUUSD sheet).

> df\[\'ts_m15\'\] = stack_a_m15\[\'ts_adjusted_m15\'\]

**Columns B, C --- symbol_h3, timeframe_h3**

INDEX/MATCH type=1: find the largest H3 adjusted timestamp that is less than or equal to the M15 timestamp. This handles the \~1-second offset between H3 and M15 bar open times.

> \# Build sorted H3 lookup index once
>
> h3_ts = stack_a_h3\[\'ts_adjusted_h3\'\].values \# sorted ascending
>
> h3_sym = stack_a_h3\[\'symbol_h3\'\].values
>
> h3_tf = stack_a_h3\[\'timeframe_h3\'\].values
>
> import numpy as np
>
> def match_type1(query_ts, lookup_ts):
>
> \# Returns index of largest lookup_ts \<= query_ts
>
> idx = np.searchsorted(lookup_ts, query_ts, side=\'right\') - 1
>
> return max(0, idx)
>
> indices = \[match_type1(ts, h3_ts) for ts in df\[\'ts_m15\'\]\]
>
> df\[\'symbol_h3\'\] = h3_sym\[indices\]
>
> df\[\'timeframe_h3\'\] = h3_tf\[indices\]

**Column D --- block_index_h3**

> df\[\'block_index_h3\'\] = (df.index // 12) + 1 \# 1-based, resets every group

**Columns E--I --- H3 SSA values (anchor lookup + AND-guard interpolation)**

For anchor rows (pos == 0): look up from H3 source using INDEX/MATCH type=1.

For non-anchor rows (pos \> 0): interpolate linearly between anchor and next anchor, but ONLY if both conditions hold:

- The value at the next anchor is non-null / non-empty.

- The block_index_h3 of the next anchor equals current block_index_h3 + 1 (the two anchors are consecutive H3 bars --- no gap in the data).

Column I (ssa_low_h3) uses a different guard: instead of checking I at the next anchor, it checks L (close_m15) at the next anchor row to verify data continuity.

> h3_cols = {
>
> \'close_h3\': stack_a_h3\[\'close_h3\'\].values,
>
> \'ssa_h3\': stack_a_h3\[\'ssa_h3\'\].values,
>
> \'ema_ssa_h3\': stack_a_h3\[\'ema_ssa_h3\'\].values,
>
> \'ssa_high_h3\':stack_a_h3\[\'ssa_high_h3\'\].values,
>
> \'ssa_low_h3\': stack_a_h3\[\'ssa_low_h3\'\].values,
>
> }
>
> for i in range(len(df)):
>
> pos = i % 12
>
> g = i // 12
>
> anchor_i = g \* 12
>
> nxt_i = anchor_i + 12 \# next anchor row index
>
> h3_anchor = match_type1(df.loc\[anchor_i, \'ts_m15\'\], h3_ts)
>
> if pos == 0:
>
> \# Anchor: direct H3 lookup
>
> for col, arr in h3_cols.items():
>
> df.at\[i, col\] = arr\[h3_anchor\]
>
> else:
>
> \# Non-anchor: AND-guard interpolation
>
> block_now = df.at\[anchor_i, \'block_index_h3\'\]
>
> if nxt_i \< len(df):
>
> block_nxt = df.at\[nxt_i, \'block_index_h3\'\]
>
> h3_nxt = match_type1(df.loc\[nxt_i, \'ts_m15\'\], h3_ts)
>
> consecutive = (block_nxt == block_now + 1)
>
> for col in \[\'close_h3\',\'ssa_h3\',\'ema_ssa_h3\',\'ssa_high_h3\'\]:
>
> v_anchor = df.at\[anchor_i, col\]
>
> v_nxt = h3_cols\[col\]\[h3_nxt\]
>
> guard = (v_nxt is not None) and consecutive
>
> df.at\[i, col\] = (v_anchor + (v_nxt - v_anchor) \* pos / 12
>
> if guard else None)
>
> \# ssa_low_h3 guard uses close_m15 at next anchor instead
>
> close_m15_nxt = df.at\[nxt_i, \'close_m15\'\] if nxt_i \< len(df) else None
>
> guard_i = (close_m15_nxt is not None) and consecutive
>
> v_a = df.at\[anchor_i, \'ssa_low_h3\'\]
>
> v_n = h3_cols\[\'ssa_low_h3\'\]\[h3_nxt\]
>
> df.at\[i, \'ssa_low_h3\'\] = (v_a + (v_n - v_a) \* pos / 12
>
> if guard_i else None)

**Group 2: Columns J--P --- M15 XLOOKUP Values**

Exact XLOOKUP against the ts_adjusted_m15 column (AA). In Python this is a simple pandas merge or dictionary lookup.

---

**Column** **Name** **Source (ALGLIB_SSA_XAUUSD)** **Python**
J symbol_m15 P (symbol_m15) m15_lookup\[\'symbol_m15\'\]\[ts_adjusted_m15\]
K timeframe_m15 Q (timeframe_m15) m15_lookup\[\'timeframe_m15\'\]\[ts_adjusted_m15\]
L close_m15 R (close_m15) m15_lookup\[\'close_m15\'\]\[ts_adjusted_m15\]
M ssa_m15 S (ssa_m15) m15_lookup\[\'ssa_m15\'\]\[ts_adjusted_m15\]
N ema_ssa_m15 T (ema_ssa_m15) m15_lookup\[\'ema_ssa_m15\'\]\[ts_adjusted_m15\]
O ssa_high_m15 U (ssa_high_m15) m15_lookup\[\'ssa_high_m15\'\]\[ts_adjusted_m15\]
P ssa_low_m15 V (ssa_low_m15) m15_lookup\[\'ssa_low_m15\'\]\[ts_adjusted_m15\]

---

> \# Build M15 lookup dict keyed by ts_adjusted_m15
>
> m15_df = stack_a_m15.set_index(\'ts_adjusted_m15\')
>
> df = df.merge(m15_df\[\[\'symbol_m15\',\'timeframe_m15\',\'close_m15\',
>
> \'ssa_m15\',\'ema_ssa_m15\',\'ssa_high_m15\',\'ssa_low_m15\'\]\],
>
> left_on=\'ts_m15\', right_index=True, how=\'left\')

**Group 3: Columns S--AE --- Passthrough and Rename**

These columns are direct assignments --- each maps a source column to an output column for the purpose of creating clear named aliases for downstream processing.

---

**Col** **Name** **Source** **Notes**
S timestamp A (ts_m15) Primary time index for output records
T symbol J (symbol_m15) Passthrough
U timeframe K (timeframe_m15) Passthrough
V block_index_m15 Computed MOD(i, 12) + 1 --- position 1--12 within H3 group
W close L (close_m15) Passthrough
X ssa_m15_interpolation F (ssa_h3) H3 SSA interpolated to M15 grid --- primary signal
Y ema_ssa_m15_interpolation G (ema_ssa_h3) H3 EMA-SSA interpolated to M15 grid
Z ssa_m15 M (ssa_m15) Raw M15 SSA value
AA ema_ssa_m15 N (ema_ssa_m15) Raw M15 EMA-SSA value
AB ssa_high_m15_interpolation H (ssa_high_h3) H3 SSA upper band on M15 grid
AC ssa_high_m15 O (ssa_high_m15) Raw M15 SSA upper band
AD ssa_low_m15_interpolation I (ssa_low_h3) H3 SSA lower band on M15 grid
AE ssa_low_m15 P (ssa_low_m15) Raw M15 SSA lower band

---

**Group 4: Columns AH--AR --- Forward Fill and Trend Logic**

AH--AJ implement a forward-fill pattern: if the current row has a valid timestamp/symbol/timeframe, use it; otherwise carry forward the previous row\'s value and increment the timestamp by one M15 step (900 s). This ensures the output columns are never empty even at the tail of the dataset.

> df\[\'ts_forward\'\] = df\[\'ts_m15\'\].copy()
>
> df\[\'sym_forward\'\] = df\[\'symbol\'\].copy()
>
> df\[\'tf_forward\'\] = df\[\'timeframe\'\].copy()
>
> for i in range(1, len(df)):
>
> if pd.isna(df.at\[i, \'ts_forward\'\]):
>
> df.at\[i, \'ts_forward\'\] = df.at\[i-1, \'ts_forward\'\] + 900
>
> df.at\[i, \'sym_forward\'\] = df.at\[i-1, \'sym_forward\'\]
>
> df.at\[i, \'tf_forward\'\] = df.at\[i-1, \'tf_forward\'\]

**Columns AK--AR --- Signal Aliases and Trend Direction**

---

**Col** **Name** **Formula / Logic**
AK close (copy) close_m15 (null-safe: None if empty)
AL ssa_m15_interp (copy) X --- null-safe copy
AM ema_ssa_m15_interp (copy) Y --- null-safe copy
AN ssa_emassa_diff AL − AM (None if either is None)
AO trend \'Bullish\' if AN \> 0, \'Bearish\' if AN \<= 0, None if AN is None
AP trend_projection AO if not None, else carry forward previous row\'s AP
AQ ssa_high_interp (copy) AB --- null-safe copy
AR ssa_low_interp (copy) AD --- null-safe copy

---

**Group 5: Column AS --- x_count_regression**

A 1--12 cycling counter that tracks position within the current regression window. It resets to 1 after reaching 12, synchronised with block_index_m15. This counter is the X-axis for the slope calculation.

> \# First row = 1; every subsequent row = prev + 1, but reset to 1 when prev == 12
>
> x_count = \[\]
>
> for i in range(len(df)):
>
> if i == 0:
>
> x_count.append(1)
>
> else:
>
> x_count.append(1 if x_count\[-1\] == 12 else x_count\[-1\] + 1)
>
> df\[\'x_count\'\] = x_count

**Group 6: Columns AT--BB --- Regression, Projection, and Error**

These columns are computed for group_idx \>= 1 (i.e., starting from the second H3 group, rows 14 onwards). The regression uses the PREVIOUS group\'s 12 rows (positions anchor-12 to anchor-1) as the training window.

**AT --- slope_12_ssa_high_m15_interpolation**

Slope of AQ (ssa_high_interp) over AS (x_count 1--12) in the previous window:

> from scipy.stats import linregress
>
> def clamped_slope_high(y_vals, x_vals):
>
> \# Filter out None pairs (empty rows before Pass 2 fillback)
>
> pairs = \[(x,y) for x,y in zip(x_vals,y_vals) if y is not None\]
>
> if len(pairs) \< 2: return 0.0 \# sparse window -\> flat slope (matches IFERROR-\>0 in v6)
>
> xs, ys = zip(\*pairs)
>
> try:
>
> slope, \*\_ = linregress(xs, ys)
>
> except Exception:
>
> return 0.0 \# linregress error -\> flat slope
>
> if slope \> 0: return min(3.0, abs(slope))
>
> if slope \< -0.5: return -0.5
>
> return 0.0
>
> def clamped_slope_low(y_vals, x_vals):
>
> pairs = \[(x,y) for x,y in zip(x_vals,y_vals) if y is not None\]
>
> if len(pairs) \< 2: return 0.0 \# sparse window -\> flat slope (matches IFERROR-\>0 in v6)
>
> xs, ys = zip(\*pairs)
>
> try:
>
> slope, \*\_ = linregress(xs, ys)
>
> except Exception:
>
> return 0.0 \# linregress error -\> flat slope
>
> if slope \< 0: return max(-3.0, -abs(slope))
>
> if slope \> 0.5: return 0.5
>
> return 0.0

**AV/AW --- ssa_high/low_regression (linear projection from anchor)**

The regression line is evaluated at the current x_count position, starting from the anchor row\'s AQ/AR value:

> \# AV\[i\] = AQ\[anchor_row\] + AT\[i\] \* (AS\[i\] - 1)
>
> \# AW\[i\] = AR\[anchor_row\] + AU\[i\] \* (AS\[i\] - 1)

**AX/AY --- ssa_high/low_projection (one step ahead)**

> \# AX\[i\] = AV\[i\] + AT\[i\] if AT\[i\] \> 0, else AV\[i\]
>
> \# AY\[i\] = AW\[i\] + AU\[i\] if AU\[i\] \< 0, else AW\[i\]

**BA/BB --- ssa_high/low_error**

> \# BA\[i\] = AX\[i\] - AQ\[i\] (IFERROR → None on exception)
>
> \# BB\[i\] = AY\[i\] - AR\[i\]

**5.3 Final Output Columns BD--BM**

These 10 columns are the only output Stack B passes downstream to Stack C.

---

**Col** **Name** **Source Col** **Python dtype** **Description**
BD timestamp_forward AH int64 Unix ts, forward-filled, never null
BE symbol_forward AI str \'XAUUSD\', forward-filled
BF timeframe_forward AJ str \'M15\', forward-filled
BG close_m15 L float64 Raw M15 close price
BH ssa_m15_interpolation X float64? H3 SSA → M15 grid (null in group 1 non-anchors)
BI ema_ssa_m15_interpolation Y float64? H3 EMA-SSA → M15 grid
BJ ssa_m15 Z float64 Raw M15 SSA
BK ema_ssa_m15 AA float64 Raw M15 EMA-SSA
BL ssa_high_projection IFERROR(AX,\"\") float64? Forward SSA upper band. IFERROR wrapper returns empty when SLOPE window is sparse; None for group 1.
BM ssa_low_projection IFERROR(AY,\"\") float64? Forward SSA lower band. IFERROR wrapper returns empty when SLOPE window is sparse; None for group 1.

---

**5.4 Sample Output Values (from v6.xlsx)**

---

**Row** **BD (ts)** **BG (close)** **BH (ssa_interp)** **BI (ema_interp)** **BJ (ssa_m15)** **BL (high_proj)** **BM (low_proj)**
2 (anchor g1) 1775134800 4587.61 4630.60871 4642.36200 4587.04638 --- ---
3 (g1 pos=1) 1775135700 4591.43 --- --- 4585.99\... --- ---
14 (anchor g2) 1775145600 4654.93 4630.70237 4636.53218 4660.15725 4665.56067 4595.03007
15 (g2 pos=1) 1775146500 4650.75 4631.16309 4636.51963 4657.61269 4665.06067 4595.03007

---

> **⚑ BH and BI for non-anchor rows in group 1 (rows 3--13) are null because the AND-guard fails --- there is no \'previous\' group to validate the next anchor block index.**

**5.5 Fillback Computation Model --- The 3-Hour Dependency**

This is the most critical timing constraint in the entire system. It governs when Stack B can compute E--I interpolation for the 11 non-anchor M15 rows in each group, and it dictates the scheduling of both Stack B passes and the UPSERT behaviour of Stack C.

**Why Fillback is Necessary**

The interpolation formula for any non-anchor M15 row (pos = 1..11) within group g requires TWO pieces of H3 data:

5.  The H3 SSA values at the START of group g --- i.e., the anchor at row g×12. These are available the moment the first M15 bar of group g arrives.

6.  The H3 SSA values at the START of group g+1 --- i.e., the anchor at row (g+1)×12. These are NOT available until the H3 bar for group g+1 closes, which is exactly 3 hours (10,800 seconds) after group g began.

Consequence: when M15 bars 2--12 of group g arrive (every 15 minutes during the 3-hour H3 period), the interpolated E--I values for those bars are UNKNOWN and must be stored as null. Only when the next H3 bar closes can the system go back and FILL IN those 11 rows retroactively.

**Timeline for a Single H3 Group (group g)**

---

**Clock time** **Event** **Action**
T + 0:00 M15 bar 1 arrives (pos=0, anchor) INSERT row: compute E--I via H3 lookup. BH/BI populated. Store row.
T + 0:15 M15 bar 2 arrives (pos=1) INSERT row: E--I = null (next H3 anchor not yet known). BH/BI = null.
T + 0:30 M15 bar 3 arrives (pos=2) INSERT row: E--I = null. BH/BI = null.
T + 0:45 M15 bar 4 arrives (pos=3) INSERT row: E--I = null. BH/BI = null.
T + 1:00 ... T + 2:45 M15 bars 5--12 arrive INSERT rows: all E--I = null. BH/BI = null.
T + 3:00 NEW H3 bar closes → group g+1 anchor arrives PASS 2 (FILLBACK): compute E--I for all 11 prior rows (pos 1..11 of group g). UPDATE those 11 rows in database. BH/BI now populated.
T + 3:00 M15 bar 1 of group g+1 (pos=0) INSERT anchor row: E--I via H3 lookup. Regression AT/AU/AV/AW/AX/AY now computable for group g+1 using group g\'s now-complete data.

---

**Two-Pass Algorithm (Correct Implementation)**

Stack B must be implemented as two distinct computational passes triggered on different schedules:

**Pass 1 --- M15 Arrival (every 15 minutes)**

Triggered when a new M15 bar closes. Processes ONE new row:

> def pass1_m15_arrival(new_m15_row: dict, h3_source_df: DataFrame,
>
> m15_source_df: DataFrame) -\> dict:
>
> i = new_m15_row\[\'row_index\'\] \# 0-based
>
> pos = i % 12
>
> g = i // 12
>
> record = {}
>
> record\[\'ts_m15\'\] = new_m15_row\[\'ts_adjusted_m15\'\] \# col A
>
> record\[\'block_index_h3\'\] = g + 1 \# col D
>
> record\[\'block_index_m15\'\]= pos + 1 \# col V
>
> \# M15 columns J--P: exact lookup on ts_adjusted_m15
>
> m15_vals = m15_source_df.loc\[record\[\'ts_m15\'\]\]
>
> record.update({ \'close_m15\': m15_vals\[\'close_m15\'\],
>
> \'ssa_m15\': m15_vals\[\'ssa_m15\'\], \... })
>
> if pos == 0: \# Anchor row --- H3 lookup available NOW
>
> h3_idx = match_type1(record\[\'ts_m15\'\], h3_source_df\[\'ts_adjusted_h3\'\])
>
> record\[\'close_h3\'\] = h3_source_df.at\[h3_idx, \'close_h3\'\]
>
> record\[\'ssa_h3\'\] = h3_source_df.at\[h3_idx, \'ssa_h3\'\]
>
> record\[\'ema_ssa_h3\'\] = h3_source_df.at\[h3_idx, \'ema_ssa_h3\'\]
>
> record\[\'ssa_high_h3\'\] = h3_source_df.at\[h3_idx, \'ssa_high_h3\'\]
>
> record\[\'ssa_low_h3\'\] = h3_source_df.at\[h3_idx, \'ssa_low_h3\'\]
>
> else: \# Non-anchor --- CANNOT interpolate yet
>
> record\[\'close_h3\'\] = record\[\'ssa_h3\'\] = record\[\'ema_ssa_h3\'\] = None
>
> record\[\'ssa_high_h3\'\] = record\[\'ssa_low_h3\'\] = None
>
> \# Derived passthrough/signal columns
>
> record\[\'ssa_m15_interpolation\'\] = record.get(\'ssa_h3\') \# col X / BH
>
> record\[\'ema_ssa_m15_interpolation\'\] = record.get(\'ema_ssa_h3\') \# col Y / BI
>
> record\[\'ssa_high_m15_interpolation\'\]= record.get(\'ssa_high_h3\') \# col AB
>
> record\[\'ssa_low_m15_interpolation\'\] = record.get(\'ssa_low_h3\') \# col AD
>
> \# Trend: null when interpolation values are null
>
> if record\[\'ssa_m15_interpolation\'\] and record\[\'ema_ssa_m15_interpolation\'\]:
>
> diff = record\[\'ssa_m15_interpolation\'\] - record\[\'ema_ssa_m15_interpolation\'\]
>
> record\[\'trend\'\] = \'Bullish\' if diff \> 0 else \'Bearish\'
>
> else:
>
> record\[\'trend\'\] = None
>
> \# BL / BM remain null until Pass 2 completes for this group
>
> record\[\'ssa_high_projection\'\] = None
>
> record\[\'ssa_low_projection\'\] = None
>
> return record

**Pass 2 --- H3 Bar Close (every 3 hours) --- Fillback + Regression**

Triggered when a new H3 bar closes. At this moment the NEXT anchor for the PREVIOUS group is known, so the 11 interim rows can be filled in. Pass 2 also runs the regression for the group that just completed.

> def pass2_h3_close(completed_group_idx: int, \# g --- the group just completed
>
> db_rows: list\[dict\], \# all 12 rows of group g from DB
>
> h3_source_df: DataFrame) -\> list\[dict\]:
>
> \"\"\"
>
> Returns 11 UPDATE payloads (pos 1..11) with filled E-I and BH/BI.
>
> Also returns the updated anchor row (pos=0) with regression results.
>
> \"\"\"
>
> anchor_row = db_rows\[0\] \# pos=0, already has E-I values
>
> g = completed_group_idx
>
> next_g = g + 1
>
> \# Fetch next anchor\'s H3 values (just written by Pass 1)
>
> next_anchor_ts = db_rows\[0\]\[\'ts_m15\'\] + 12 \* 900 \# approximate
>
> next_h3_idx = match_type1(next_anchor_ts, h3_source_df\[\'ts_adjusted_h3\'\])
>
> next_block_index = g + 2 \# block_index_h3 of next group
>
> \# Verify AND-guard: next anchor must be consecutive block
>
> next_h3_vals = {
>
> col: h3_source_df.at\[next_h3_idx, col\]
>
> for col in \[\'close_h3\',\'ssa_h3\',\'ema_ssa_h3\',\'ssa_high_h3\',\'ssa_low_h3\'\]
>
> }
>
> next_block_is_consecutive = (next_block_index == anchor_row\[\'block_index_h3\'\] + 1)
>
> next_close_m15 = db_rows\[12\]\[\'close_m15\'\] if len(db_rows) \> 12 else None
>
> updates = \[\]
>
> for pos in range(1, 12):
>
> row = db_rows\[pos\]
>
> update = {\'timestamp_forward\': row\[\'timestamp_forward\'\]}
>
> for col in \[\'close_h3\',\'ssa_h3\',\'ema_ssa_h3\',\'ssa_high_h3\'\]:
>
> v_anc = anchor_row\[col\]
>
> v_nxt = next_h3_vals\[col\]
>
> guard = (v_nxt is not None) and next_block_is_consecutive
>
> update\[col\] = (v_anc + (v_nxt - v_anc) \* pos / 12
>
> if guard else None)
>
> \# ssa_low_h3 uses close_m15 at next anchor as guard
>
> guard_i = (next_close_m15 is not None) and next_block_is_consecutive
>
> update\[\'ssa_low_h3\'\] = (
>
> anchor_row\[\'ssa_low_h3\'\] +
>
> (next_h3_vals\[\'ssa_low_h3\'\] - anchor_row\[\'ssa_low_h3\'\]) \* pos / 12
>
> if guard_i else None)
>
> \# Update derived columns
>
> update\[\'ssa_m15_interpolation\'\] = update.get(\'ssa_h3\')
>
> update\[\'ema_ssa_m15_interpolation\'\] = update.get(\'ema_ssa_h3\')
>
> update\[\'ssa_high_m15_interpolation\'\]= update.get(\'ssa_high_h3\')
>
> update\[\'ssa_low_m15_interpolation\'\] = update.get(\'ssa_low_h3\')
>
> if update\[\'ssa_m15_interpolation\'\] and update\[\'ema_ssa_m15_interpolation\'\]:
>
> diff = update\[\'ssa_m15_interpolation\'\] - update\[\'ema_ssa_m15_interpolation\'\]
>
> update\[\'trend\'\] = \'Bullish\' if diff \> 0 else \'Bearish\'
>
> else:
>
> update\[\'trend\'\] = None
>
> updates.append(update)
>
> \# Regression for this group (uses previous group\'s completed data)
>
> if g \>= 1:
>
> prev_group_rows = fetch_group_from_db(g - 1) \# already filled
>
> aq_vals = \[r\[\'ssa_high_m15_interpolation\'\] for r in prev_group_rows\]
>
> ar_vals = \[r\[\'ssa_low_m15_interpolation\'\] for r in prev_group_rows\]
>
> xs = list(range(1, 13))
>
> slope_h = clamped_slope_high(aq_vals, xs)
>
> slope_l = clamped_slope_low( ar_vals, xs)
>
> for row_update in updates + \[anchor_row\]:
>
> x_count = row_update.get(\'block_index_m15\', 1)
>
> aq_anchor = prev_group_rows\[0\]\[\'ssa_high_m15_interpolation\'\]
>
> ar_anchor = prev_group_rows\[0\]\[\'ssa_low_m15_interpolation\'\]
>
> av = aq_anchor + slope_h \* (x_count - 1)
>
> aw = ar_anchor + slope_l \* (x_count - 1)
>
> row_update\[\'ssa_high_projection\'\] = av + slope_h if slope_h \> 0 else av
>
> row_update\[\'ssa_low_projection\'\] = aw + slope_l if slope_l \< 0 else aw
>
> return updates

**Batch Mode vs Real-Time Mode**

When processing historical data (e.g., the full 2,400-row v6.xlsx dataset), all H3 source data is already available. In this case, both passes can be collapsed into a single sequential scan:

- For anchor rows (pos=0): do H3 lookup directly.

- For non-anchor rows (pos=1--11): both anchor AND next-anchor H3 values are already in h3_source_df, so interpolation can run immediately. No wait required.

In real-time production mode, the two-pass model is mandatory. A scheduler (e.g., APScheduler or Celery beat) must fire Pass 1 every 15 minutes and Pass 2 every 3 hours.

**Scheduling Summary**

---

**Pass** **Trigger** **Cron** **Action**
Pass 1 (M15) New M15 bar closes \*/15 \* \* \* \* Fetch MQL5 export, run Stack A normalisation, INSERT 1 new row. E--I null for non-anchors.
Pass 2 (H3) New H3 bar closes 0 \*/3 \* \* \* Run fillback for previous group\'s 11 rows. Compute regression. UPDATE 11 rows + emit BH/BI/BL/BM.
Stack A Before each Pass 1/2 Same as Pass 1 Always runs first to normalise timestamps before Stack B.
Full rebatch Manual / on restart On demand Process all 2,400 rows in single-pass batch mode to rebuild history.

---

**Database UPSERT Requirement for Stack C**

Because Pass 2 retroactively updates rows that were already INSERTed by Pass 1, Stack C must implement UPSERT (INSERT \... ON CONFLICT DO UPDATE) semantics. The conflict target is the composite key (symbol_forward, timeframe_forward, timestamp_forward).

> \-- PostgreSQL UPSERT
>
> INSERT INTO ssa_bars (timestamp_forward, symbol_forward, timeframe_forward,
>
> close_m15, ssa_m15_interpolation, ema_ssa_m15_interpolation,
>
> ssa_m15, ema_ssa_m15, ssa_high_projection, ssa_low_projection)
>
> VALUES (\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9,\$10)
>
> ON CONFLICT (symbol_forward, timeframe_forward, timestamp_forward)
>
> DO UPDATE SET
>
> ssa_m15_interpolation = EXCLUDED.ssa_m15_interpolation,
>
> ema_ssa_m15_interpolation = EXCLUDED.ema_ssa_m15_interpolation,
>
> ssa_high_projection = EXCLUDED.ssa_high_projection,
>
> ssa_low_projection = EXCLUDED.ssa_low_projection,
>
> updated_at = NOW();
>
> **⚑ The 11 fillback rows will transition from null → populated for BH, BI, BL, BM in a single Pass 2 run. The Stack C WebSocket gateway MUST broadcast a bars:fillback event (separate from bars:update) so the frontend knows to refresh previously-rendered null gaps on the chart.**

**5.6 Empty-Value Propagation for Columns X, Y, AB, AD, AL, AM, AN, AO, AQ, AR, BA, BB, BH, BI**

All fourteen columns listed above derive their values --- including their empty state --- from columns F, G, H, and I (the H3 SSA interpolated values). When F--I are empty (which happens for non-anchor rows before Pass 2 fillback, or when an H3 data gap causes the AND-guard to fail), the following propagation chain ensures each downstream column also returns an empty string rather than producing a formula error or a misleading value.

**Empty-Value Propagation Chain --- Verified from v6.xlsx Formulas**

---

**Column** **Name** **Excel Formula (non-anchor row)** **Empty when**
F ssa_h3 IF(AND(F{nxt}\<\>\"\",D{nxt}=D{anc}+1), interp, \"\") AND-guard fails: next anchor empty OR blocks non-consecutive
G ema_ssa_h3 IF(AND(G{nxt}\<\>\"\",D{nxt}=D{anc}+1), interp, \"\") Same guard as F
H ssa_high_h3 IF(AND(H{nxt}\<\>\"\",D{nxt}=D{anc}+1), interp, \"\") Same guard as F
I ssa_low_h3 IF(AND(L{nxt}\<\>\"\",D{nxt}=D{anc}+1), interp, \"\") Guard uses L (close_m15) not I --- empty when close_m15 at next anchor empty
X ssa_m15_interpolation IF(F{r}=\"\",\"\",F{r}) F is empty
Y ema_ssa_m15_interpolation IF(G{r}=\"\",\"\",G{r}) G is empty
AB ssa_high_m15_interpolation IF(H{r}=\"\",\"\",H{r}) H is empty
AD ssa_low_m15_interpolation IF(I{r}=\"\",\"\",I{r}) I is empty
AL ssa_m15_interp (alias) IF(X{r}\<\>\"\",X{r},\"\") X is empty (= F is empty)
AM ema_ssa_m15_interp (alias) IF(Y{r}\<\>\"\",Y{r},\"\") Y is empty (= G is empty)
AQ ssa_high_interp (alias) IF(AB{r}\<\>\"\",AB{r},\"\") AB is empty (= H is empty)
AR ssa_low_interp (alias) IF(AD{r}\<\>\"\",AD{r},\"\") AD is empty (= I is empty)
AN ssa_emassa_diff IF(OR(AL{r}=\"\",AM{r}=\"\"),\"\",AL{r}-AM{r}) AL or AM empty (= F or G is empty)
AO trend IF(AN{r}=\"\",\"\",IF(AN{r}\>0,\"Bullish\",\"Bearish\")) Empty string \"\" --- NOT \"Bullish\"/\"Bearish\" --- when F or G empty
BH ssa_m15_interpolation (out) IF(X{r}=\"\",\"\",X{r}) X is empty (= F is empty)
BI ema_ssa_m15_interp (out) IF(Y{r}=\"\",\"\",Y{r}) Y is empty (= G is empty)
BA ssa_high_error IFERROR(AX{r}-AQ{r},\"\") AQ=\"\" causes \#VALUE!, caught by IFERROR -\> returns \"\"
BB ssa_low_error IFERROR(AY{r}-AR{r},\"\") AR=\"\" causes \#VALUE!, caught by IFERROR -\> returns \"\"

---

**Columns That Are Exceptions --- Never Empty or May Error**

---

**Column** **Name** **Behaviour**
AP trend_projection NEVER empty. IF(AO{r}=\"\",AP{r-1},AO{r}) --- always carries forward the last known trend direction even when AO is empty. This is by design: the projected trend persists across a live H3 bar where interpolation is not yet available.
BG close_m15 (output) ALWAYS populated. =L{r} --- direct M15 XLOOKUP result, independent of any H3 interpolation. Not affected by empty F-I.
BJ ssa_m15 (output) ALWAYS populated. =Z{r} = M{r} --- raw M15 SSA from XLOOKUP. Independent of H3 interpolation.
BK ema_ssa_m15 (output) ALWAYS populated. =AA{r} = N{r} --- raw M15 EMA-SSA from XLOOKUP. Independent.
BL ssa_high_projection =IFERROR(AX{r},\"\") --- IFERROR added in v6. When SLOPE window (AQ prev-group range) is sparse, AT is protected by its own IFERROR returning 0 (flat slope); BL then also catches any residual cascade with IFERROR -\> returns empty string. Python: try/except emits None.
BM ssa_low_projection =IFERROR(AY{r},\"\") --- IFERROR added in v6. Same two-layer protection as BL: AU guarded at slope level, BM catches residual. Python: try/except emits None.

---

**Functional Redundancy --- Column Identity Pairs**

Several columns are functionally identical --- they are aliases of earlier columns in the chain, introduced to provide clearly-named references for downstream regression and output stages. Claude Code should implement these as simple assignments:

---

**Column** **Is functionally identical to** **Rationale for duplication**
X = BH IF(F=\"\",\"\",F) X names the interpolated value for the mapping stage; BH re-exposes it as a final output column with an explicit null guard. Both are = F when F is non-empty.
Y = BI IF(G=\"\",\"\",G) Same pattern: Y for mapping stage, BI for final output.
X = AL IF(F=\"\",\"\",F) AL is a working copy of X used in the AN/AO trend computation. Explicit \<\> guard rather than = guard, but identical value.
Y = AM IF(G=\"\",\"\",G) AM is a working copy of Y. Same as above.
AB = AQ IF(H=\"\",\"\",H) AQ is the regression-input alias of AB (ssa_high_m15_interpolation). Used as Y-range in SLOPE for AT.
AD = AR IF(I=\"\",\"\",I) AR is the regression-input alias of AD (ssa_low_m15_interpolation). Used as Y-range in SLOPE for AU.

---

**Real-Time vs Batch Mode --- When Empty Values Occur**

---

**Mode** **Rows affected** **F-I state** **X/Y/AB/AD/AL/AM/AQ/AR/AN/AO/BH/BI state**
Batch (historical) All 2,400 rows Fully populated --- all anchors have H3 lookup values; all non-anchors have interpolated values (next anchor always available in full dataset) All populated --- no empty values in any of the 14 columns
Real-time: anchor row pos=0 of any group Populated via H3 INDEX/MATCH lookup the moment the M15 bar arrives All populated immediately
Real-time: non-anchor pos=1-11 of CURRENT active group Empty string \"\" --- next H3 anchor has not closed yet All 14 columns return \"\" --- BH/BI show no value on chart
Real-time: non-anchor pos=1-11 of COMPLETED groups (post-Pass 2) Populated via Pass 2 fillback All populated after fillback
H3 data gap Any group where next anchor block is non-consecutive AND-guard fails even in batch mode All 14 columns return \"\" for affected non-anchor rows

---

**Python Implementation for Null Propagation**

In Stack B, the null propagation is implicit: all derived columns simply copy from their source. The critical rules are:

> \# X / BH: guard on F (ssa_h3)
>
> record\[\'ssa_m15_interpolation\'\] = record.get(\'ssa_h3\') \# None when ssa_h3 is None
>
> record\[\'bh\'\] = record.get(\'ssa_h3\') \# identical
>
> \# Y / BI: guard on G (ema_ssa_h3)
>
> record\[\'ema_ssa_m15_interpolation\'\] = record.get(\'ema_ssa_h3\') \# None when ema_ssa_h3 is None
>
> record\[\'bi\'\] = record.get(\'ema_ssa_h3\') \# identical
>
> \# AB / AQ: guard on H (ssa_high_h3)
>
> record\[\'ssa_high_m15_interpolation\'\] = record.get(\'ssa_high_h3\')
>
> \# AD / AR: guard on I (ssa_low_h3)
>
> record\[\'ssa_low_m15_interpolation\'\] = record.get(\'ssa_low_h3\')
>
> \# AN: empty when either AL or AM is None
>
> al = record.get(\'ssa_m15_interpolation\')
>
> am = record.get(\'ema_ssa_m15_interpolation\')
>
> record\[\'ssa_emassa_diff\'\] = (al - am) if (al is not None and am is not None) else None
>
> \# AO: trend --- empty string when AN is None (NOT \'Bullish\'/\'Bearish\')
>
> d = record.get(\'ssa_emassa_diff\')
>
> record\[\'trend\'\] = (\'Bullish\' if d \> 0 else \'Bearish\') if d is not None else None
>
> \# AP: trend_projection --- NEVER None --- always carry forward
>
> record\[\'trend_projection\'\] = record\[\'trend\'\] if record\[\'trend\'\] is not None else prev_trend_projection
>
> \# BL/BM: try/except mirrors the two-layer IFERROR in v6 (AT/AU IFERROR-\>0, BL/BM IFERROR-\>\"\")
>
> try:
>
> record\[\'ssa_high_projection\'\] = compute_ax(slope_h, aq_anchor, x_count)
>
> except Exception:
>
> record\[\'ssa_high_projection\'\] = None \# sparse regression window
>
> try:
>
> record\[\'ssa_low_projection\'\] = compute_ay(slope_l, ar_anchor, x_count)
>
> except Exception:
>
> record\[\'ssa_low_projection\'\] = None
>
> **⚑ AO returning None (not \'Bullish\'/\'Bearish\') is intentional and correct when F or G is empty. The chart trend badge and AP trend_projection must treat None/\'\' as \'carry forward previous\' --- not as a reversal signal.**

**6. Stack C --- Nest.js API**

Stack C is the backend API server. It receives BD--BM records from Stack B and exposes them to the Next.js frontend through REST and optionally WebSocket endpoints.

**7.1 Technology Stack**

---

**Component** **Choice** **Notes**
Framework Nest.js (latest) TypeScript-first; modular; built-in DI and guards
HTTP Adapter Express (default) Nest default; swap to Fastify for higher throughput if needed
Database PostgreSQL + TypeORM Time-series data; BRIN index on timestamp for efficient range scans
Cache Redis Cache last N=2400 rows for sub-10ms frontend refresh
WebSocket \@nestjs/websockets Socket.IO gateway for streaming new bars as they arrive
Validation class-validator DTO validation on all inbound records from Stack B
Auth JWT Bearer Optional; use API key for internal Stack B → C communication

---

**6.2 Data Ingestion --- Stack B → Stack C**

Stack B posts a batch of BD--BM records to Stack C after each calculation run. The endpoint accepts an array of BarRecord DTOs.

**BarRecord DTO (TypeScript)**

> export class BarRecordDto {
>
> \@IsInt() timestamp_forward: number; // BD --- Unix s
>
> \@IsString() symbol_forward: string; // BE
>
> \@IsString() timeframe_forward: string; // BF
>
> \@IsNumber() close_m15: number; // BG
>
> \@IsOptional()
>
> \@IsNumber() ssa_m15_interpolation: number \| null; // BH
>
> \@IsOptional()
>
> \@IsNumber() ema_ssa_m15_interpolation: number \| null; // BI
>
> \@IsNumber() ssa_m15: number; // BJ
>
> \@IsNumber() ema_ssa_m15: number; // BK
>
> \@IsOptional()
>
> \@IsNumber() ssa_high_projection: number \| null; // BL
>
> \@IsOptional()
>
> \@IsNumber() ssa_low_projection: number \| null; // BM
>
> }

**Ingestion Endpoint**

> POST /api/v1/bars/batch
>
> Body: { symbol: string, timeframe: string, bars: BarRecordDto\[\] }
>
> Auth: X-Api-Key header (internal secret)
>
> Response: { inserted: number, updated: number }

**6.3 REST API Endpoints for Frontend**

---

**Method + Path** **Query Params** **Response**
GET /api/v1/bars symbol, timeframe, from_ts, to_ts, limit BarRecord\[\] --- time-range query, ordered by timestamp ASC
GET /api/v1/bars/latest symbol, timeframe, n (default 300) Last n BarRecords --- efficient for initial chart load
GET /api/v1/bars/:ts symbol, timeframe Single BarRecord at exact timestamp
GET /api/v1/meta --- { symbol, timeframe, first_ts, last_ts, total_rows }

---

**Response Envelope**

> {
>
> \"status\": \"ok\",
>
> \"data\": BarRecord\[\],
>
> \"meta\": { \"total\": number, \"from_ts\": number, \"to_ts\": number }
>
> }

**6.4 WebSocket Gateway (Live Streaming)**

Stack C exposes two distinct WebSocket events --- one for new bars (Pass 1) and one for the fillback update (Pass 2). The frontend must subscribe to both so it can patch null gaps on the chart when the 3-hour fillback fires.

> // Gateway: bars.gateway.ts
>
> \@WebSocketGateway({ namespace: \'/bars\', cors: { origin: \'\*\' } })
>
> export class BarsGateway {
>
> \@WebSocketServer() server: Server;
>
> // Pass 1 --- called after each M15 INSERT
>
> broadcastNewBar(bar: BarRecordDto) {
>
> this.server.emit(\'bars:update\', { bar });
>
> }
>
> // Pass 2 --- called after H3 fillback completes (11 rows updated)
>
> broadcastFillback(bars: BarRecordDto\[\]) {
>
> this.server.emit(\'bars:fillback\', { bars });
>
> }
>
> }

**6.5 Database Schema (PostgreSQL / TypeORM)**

> \@Entity(\'ssa_bars\')
>
> \@Index(\[\'symbol\', \'timeframe\', \'timestamp_forward\'\])
>
> export class SsaBarEntity {
>
> \@PrimaryGeneratedColumn() id: number;
>
> \@Column(\'bigint\') timestamp_forward: number;
>
> \@Column(\'varchar\', { length: 16 }) symbol_forward: string;
>
> \@Column(\'varchar\', { length: 8 }) timeframe_forward: string;
>
> \@Column(\'float\') close_m15: number;
>
> \@Column(\'float\', { nullable: true }) ssa_m15_interpolation: number \| null;
>
> \@Column(\'float\', { nullable: true }) ema_ssa_m15_interpolation: number \| null;
>
> \@Column(\'float\') ssa_m15: number;
>
> \@Column(\'float\') ema_ssa_m15: number;
>
> \@Column(\'float\', { nullable: true }) ssa_high_projection: number \| null;
>
> \@Column(\'float\', { nullable: true }) ssa_low_projection: number \| null;
>
> \@CreateDateColumn() created_at: Date;
>
> }

**6.6 Nest.js Module Structure**

> src/
>
> ├── app.module.ts
>
> ├── bars/
>
> │ ├── bars.module.ts
>
> │ ├── bars.controller.ts ← REST endpoints
>
> │ ├── bars.gateway.ts ← WebSocket
>
> │ ├── bars.service.ts ← business logic, DB queries
>
> │ ├── bars.entity.ts ← TypeORM entity
>
> │ └── dto/
>
> │ └── bar-record.dto.ts
>
> ├── config/
>
> │ └── database.config.ts
>
> └── common/
>
> └── guards/api-key.guard.ts

**7. Frontend --- Next.js v16 + TradingView Lightweight Charts**

**7.1 Technology Stack**

---

**Component** **Choice** **Notes**
Framework Next.js v16 (App Router) React 19; server components for data pre-fetch; client components for chart
Charting lightweight-charts v4+ TradingView library; small bundle; candlestick + line series support
State management Zustand Simple store for bar data, selected range, and trend signal
Data fetching SWR or React Query For periodic polling of /api/v1/bars/latest
Real-time Socket.IO client Subscribe to bars:update from Nest.js WebSocket gateway
Styling Tailwind CSS v4 Dark theme by default to match TradingView dark chart background

---

**7.2 Chart Layout and Series**

The chart renders a single main pane with multiple overlaid series:

---

**Series** **Data Column** **Type** **Color / Style**
Close (M15 price) BG close_m15 Candlestick / Line Default white candles
SSA M15 Interpolation BH ssa_m15_interpolation Line Blue \#2979FF, width 2
EMA-SSA M15 Interpolation BI ema_ssa_m15_interp Line Orange \#FF9100, width 1, dashed
SSA M15 (raw) BJ ssa_m15 Line Cyan \#00BCD4, width 1
EMA-SSA M15 (raw) BK ema_ssa_m15 Line Purple \#7C4DFF, width 1
SSA High Projection BL ssa_high_projection Line Green \#69F0AE, width 2, dashed
SSA Low Projection BM ssa_low_projection Line Red \#FF5252, width 2, dashed

---

**7.3 Trend Signal Panel**

A compact panel above or alongside the chart reads the AP (trend_projection) column and displays a coloured badge:

> // Derive from current last bar
>
> const trend = lastBar?.trend_projection ?? \'Unknown\';
>
> const color = trend === \'Bullish\' ? \'\#69F0AE\' : trend === \'Bearish\' ? \'\#FF5252\' : \'\#888\';
>
> \<div style={{ background: color, borderRadius: 4, padding: \'4px 12px\' }}\>
>
> \<span\>{trend}\</span\>
>
> \</div\>

**7.4 Data Transformation --- API → Chart Series**

TradingView Lightweight Charts expects each data point as { time, value } (for line series) or { time, open, high, low, close } (for candlestick). The time field must be a Unix timestamp in seconds.

> // Map BD--BM API response to chart-ready arrays
>
> const toBars = (records: BarRecord\[\]) =\> ({
>
> candles: records.map(r =\> ({
>
> time: r.timestamp_forward,
>
> open: r.close_m15, // M15 OHLC not available --- use close for flat bars
>
> high: r.close_m15, // Replace with actual open/high/low when available
>
> low: r.close_m15,
>
> close: r.close_m15,
>
> })),
>
> ssaInterp: records
>
> .filter(r =\> r.ssa_m15_interpolation != null)
>
> .map(r =\> ({ time: r.timestamp_forward, value: r.ssa_m15_interpolation! })),
>
> emaInterp: records
>
> .filter(r =\> r.ema_ssa_m15_interpolation != null)
>
> .map(r =\> ({ time: r.timestamp_forward, value: r.ema_ssa_m15_interpolation! })),
>
> ssaRaw: records.map(r =\> ({ time: r.timestamp_forward, value: r.ssa_m15 })),
>
> emaRaw: records.map(r =\> ({ time: r.timestamp_forward, value: r.ema_ssa_m15 })),
>
> highProj: records
>
> .filter(r =\> r.ssa_high_projection != null)
>
> .map(r =\> ({ time: r.timestamp_forward, value: r.ssa_high_projection! })),
>
> lowProj: records
>
> .filter(r =\> r.ssa_low_projection != null)
>
> .map(r =\> ({ time: r.timestamp_forward, value: r.ssa_low_projection! })),
>
> });

**7.5 Chart Component (React, Client)**

> \'use client\';
>
> import { useEffect, useRef } from \'react\';
>
> import { createChart, ColorType } from \'lightweight-charts\';
>
> export function SsaChart({ data }: { data: ChartData }) {
>
> const containerRef = useRef\<HTMLDivElement\>(null);
>
> const chartRef = useRef\<IChartApi \| null\>(null);
>
> useEffect(() =\> {
>
> if (!containerRef.current) return;
>
> const chart = createChart(containerRef.current, {
>
> layout: { background: { type: ColorType.Solid, color: \'\#131722\' },
>
> textColor: \'\#D9D9D9\' },
>
> grid: { vertLines: { color: \'\#2B2B43\' }, horzLines: { color: \'\#2B2B43\' } },
>
> timeScale: { timeVisible: true, secondsVisible: false },
>
> width: containerRef.current.clientWidth,
>
> height: 600,
>
> });
>
> chartRef.current = chart;
>
> const candleSeries = chart.addCandlestickSeries();
>
> candleSeries.setData(data.candles);
>
> const ssaLine = chart.addLineSeries({ color: \'\#2979FF\', lineWidth: 2 });
>
> ssaLine.setData(data.ssaInterp);
>
> const emaLine = chart.addLineSeries({ color: \'\#FF9100\', lineWidth: 1,
>
> lineStyle: 1 }); // dashed
>
> emaLine.setData(data.emaInterp);
>
> const highLine = chart.addLineSeries({ color: \'\#69F0AE\', lineWidth: 2,
>
> lineStyle: 2 }); // dotted
>
> highLine.setData(data.highProj);
>
> const lowLine = chart.addLineSeries({ color: \'\#FF5252\', lineWidth: 2,
>
> lineStyle: 2 });
>
> lowLine.setData(data.lowProj);
>
> return () =\> { chart.remove(); };
>
> }, \[data\]);
>
> return \<div ref={containerRef} style={{ width: \'100%\' }} /\>;
>
> }

**7.6 Next.js Project Structure**

> app/
>
> ├── layout.tsx ← dark theme, global styles
>
> ├── page.tsx ← dashboard: server component fetches initial data
>
> └── dashboard/
>
> ├── page.tsx ← server component: prefetch /api/v1/bars/latest
>
> └── \_components/
>
> ├── SsaChart.tsx ← client component (chart)
>
> ├── TrendBadge.tsx ← Bullish/Bearish signal panel
>
> └── MetricsBar.tsx ← last close, last SSA, projection values
>
> lib/
>
> ├── api.ts ← typed fetch wrappers for Nest.js endpoints
>
> ├── socket.ts ← Socket.IO client singleton
>
> └── types.ts ← BarRecord interface, ChartData interface

**8. Inter-Stack Data Contracts**

**8.1 Stack A → Stack B (Python internal)**

Stack A produces two pandas DataFrames passed directly to Stack B (in-process). No serialisation required if running in the same Python process or worker.

---

**DataFrame** **Index** **Key added columns**
h3_df RangeIndex (0-based) ts_adjusted_h3 (int), excel_serial_h3 (float), rounded_serial_h3 (float)
m15_df RangeIndex (0-based), sorted asc ts_adjusted_m15 (int), excel_serial_m15 (float), rounded_serial_m15 (float)

---

**8.2 Stack B → Stack C (HTTP)**

Stack B POSTs a JSON batch to Stack C. The batch contains the full BD--BM column set for all rows computed in the current run.

> POST /api/v1/bars/batch
>
> Content-Type: application/json
>
> X-Api-Key: \<shared-secret\>
>
> {
>
> \"symbol\": \"XAUUSD\",
>
> \"timeframe\": \"M15\",
>
> \"bars\": \[
>
> {
>
> \"timestamp_forward\": 1775134800,
>
> \"symbol_forward\": \"XAUUSD\",
>
> \"timeframe_forward\": \"M15\",
>
> \"close_m15\": 4587.61,
>
> \"ssa_m15_interpolation\": 4630.60871,
>
> \"ema_ssa_m15_interpolation\": 4642.36200,
>
> \"ssa_m15\": 4587.04638,
>
> \"ema_ssa_m15\": 4587.04638,
>
> \"ssa_high_projection\": null,
>
> \"ssa_low_projection\": null
>
> },
>
> \...
>
> \]
>
> }

**8.3 Stack C → Frontend (REST)**

The frontend uses GET /api/v1/bars/latest to load the chart, then subscribes to WebSocket events for live updates.

> GET /api/v1/bars/latest?symbol=XAUUSD&timeframe=M15&n=500
>
> Response 200:
>
> {
>
> \"status\": \"ok\",
>
> \"data\": \[ { \...BarRecord }, \... \],
>
> \"meta\": { \"total\": 2400, \"from_ts\": 1775134800, \"to_ts\": 1777294800 }
>
> }

**9. Edge Cases and Known Gotchas**

**9.1 H3 Timestamp Offset (\~1 second drift)**

MQL5 H3 bar open times exported to Excel are offset by approximately 1 second from what a naive 10,800-second grid would predict. This means an exact-match lookup of M15 → H3 timestamps returns empty for virtually all rows. The system MUST use INDEX/MATCH type=1 (find largest H3 ts ≤ M15 ts) for all H3 lookups. Never use exact XLOOKUP for H3.

**9.2 AND-Guard Failures in Group 1 (rows 3--13)**

The AND-guard interpolation checks that the next anchor\'s block_index_h3 equals current + 1 (consecutive bars). For group 1, the next anchor is row 14 which has block_index_h3 = 2, so the guard passes. However, column I (ssa_low_h3) uses close_m15 at the next anchor as its guard. If close_m15 at row 14 is null (data not yet available), column I will return null for rows 3--13. This flows through to BH and BI being null for those rows --- this is expected and correct.

**9.3 Regression Only Available from Group 2**

Columns AT--BB and therefore BL--BM are not computed for group 1 (rows 2--13). Stack B must emit null for BL and BM for these rows. Stack C must handle nullable floats in the BarRecord DTO. The frontend must filter out null values before passing to TradingView series (the .filter(\...) calls shown in Section 6.4 handle this).

**9.4 MROUND vs Standard Rounding**

Python\'s built-in round() uses banker\'s rounding (round-half-to-even). Excel\'s MROUND always rounds to the nearest multiple and uses arithmetic rounding (round-half-up). For the timestamp values involved (multiples of 300), this difference is irrelevant in practice --- MROUND(x, 300) always lands on a clean multiple. Use int(round(x / 300) \* 300) in Python, which matches Excel\'s MROUND for these values.

**9.5 x_count_regression Resets**

The AS column cycles 1→12→1→12→\... across all rows. It is NOT tied to block_index_m15. It resets when the previous value reaches 12, not when a new H3 group begins. In practice, since block_index_m15 also cycles 1--12 in sync with the 12-bar groups, these will be identical --- but the implementation should mirror the Excel formula exactly: reset when AS\[i-1\] + 1 == 13.

**9.6 Slope Clamping Direction**

AT (high slope): positive slope → clamped to \[0, +3\]; negative slope less than -0.5 → clamped to -0.5; negative slope in \[-0.5, 0\] → returns 0.

AU (low slope): negative slope → clamped to \[-3, 0\]; positive slope greater than +0.5 → clamped to +0.5; positive slope in \[0, +0.5\] → returns 0.

These asymmetric clamps ensure the projected upper band only moves up (or stays flat) and the projected lower band only moves down (or stays flat) within the clamped range.

**9.7 Live Chart Null Gaps During Active H3 Bar**

While an H3 bar is still open (i.e., M15 bars 2--12 of the current group are streaming in), BH and BI for those rows will be null. On the TradingView chart, the SSA interpolation lines (BH, BI) and projection bands (BL, BM) will appear to have a gap at the right edge of the chart for up to \~2:45 hours. This is expected --- the gap closes when Pass 2 fires at the H3 close. The frontend should NOT attempt to extrapolate or fill this gap visually; it should simply stop the series at the last non-null data point and resume when the bars:fillback event arrives.

**9.8 Forward Projection Logic (AX/AY)**

AX (high projection) = AV + AT only if AT \> 0; otherwise AX = AV. This means the projection goes one step AHEAD of the regression line when the slope is upward, but stays at the regression value when the slope is zero or negative.

AY (low projection) = AW + AU only if AU \< 0; otherwise AY = AW. Symmetric logic for the lower band.

**10. Implementation Checklist for Claude Code**

**Stack A (Python)**

- Implement normalise_timestamp(unix_ts) → { excel_serial, rounded_serial, ts_adjusted }

- Apply to all rows of H3 data (column A of ALGLIB_SSA_XAUUSD) → produce ts_adjusted_h3

- Apply to all rows of M15 data (column O) → produce ts_adjusted_m15

- Unit-test: verify ts_adjusted_m15 for a known timestamp matches column AA in v6.xlsx

- Unit-test: verify ts_adjusted_h3 for a known H3 timestamp matches column M in v6.xlsx

**Stack B (Python)**

- Build match_type1(query, sorted_array) using np.searchsorted

- Build M15 exact lookup dict/merge keyed on ts_adjusted_m15

- Implement pass1_m15_arrival(): anchor gets H3 lookup; non-anchor rows E--I = null

- Implement pass2_h3_close(): fillback 11 interim rows using AND-guard interpolation

- AND-guard cols E--H: guard on {col} at next anchor being non-null AND block indices consecutive

- AND-guard col I (ssa_low_h3): guard on close_m15 at next anchor, not ssa_low at next anchor

- Implement forward-fill for timestamp/symbol/timeframe (AH--AJ)

- Implement x_count_regression cycling counter (AS): 1→12 reset

- Implement clamped_slope_high and clamped_slope_low using scipy.stats.linregress

- Implement regression line (AV/AW) and projection (AX/AY) in Pass 2 --- group_idx \>= 1 only

- Implement batch mode (single-pass, historical): collapse Pass 1 + Pass 2 into one loop

- Schedule Pass 1 with APScheduler: cron \*/15 \* \* \* \*

- Schedule Pass 2 with APScheduler: cron 0 \*/3 \* \* \*

- Integration test (batch mode): compare BD--BM row 2, 14, 15 against sample values in Section 4.4

- Unit test: verify that non-anchor rows produce null BH/BI before Pass 2 fires, then populate after

**Stack C (Nest.js)**

- Scaffold Nest.js project with TypeORM + PostgreSQL + Redis

- Implement SsaBarEntity with UNIQUE constraint on (symbol_forward, timeframe_forward, timestamp_forward) and BRIN index on timestamp_forward

- Implement BarRecordDto with class-validator decorators (nullable floats for BH/BI/BL/BM)

- Implement POST /api/v1/bars/batch with UPSERT (ON CONFLICT DO UPDATE) semantics --- required for Pass 2 fillback

- Implement GET /api/v1/bars/latest with Redis cache layer

- Implement GET /api/v1/bars with time-range filtering

- Implement WebSocket gateway: bars:update event (Pass 1 new bar) AND bars:fillback event (Pass 2 retroactive fill of 11 rows)

- Integration test: POST a batch with 12 rows (11 with null BH/BI), then POST an update with those 11 filled, verify DB reflects the filled values

**Frontend (Next.js v16)**

- Install lightweight-charts and Socket.IO client

- Implement toBars() transformation function (Section 6.4) --- filter nulls from BH/BI/BL/BM before passing to series

- Implement SsaChart client component with all 7 series

- Implement TrendBadge reading trend_projection from last bar

- Wire SWR/React Query for periodic polling (every 900 s for M15)

- Subscribe to bars:update --- call series.update() for new single bar

- Subscribe to bars:fillback --- call series.setData() or series.update() for each of the 11 retroactively-filled bars to patch null gaps

- End-to-end test: simulate a 3-hour sequence: 12 bars arrive → first 11 show gap in BH/BI series → fillback event fires → gaps fill in

**9. Edge Cases and Known Gotchas**

**9.1 H3 Timestamp Offset (\~1 second drift)**

MQL5 H3 bar open times exported to Excel are offset by approximately 1 second from what a naive 10,800-second grid would predict. This means an exact-match lookup of M15 to H3 timestamps returns empty for virtually all rows. The system MUST use INDEX/MATCH type=1 (find largest H3 ts \<= M15 ts) for all H3 lookups. Never use exact XLOOKUP for H3.

**9.2 AND-Guard Failures in Group 1 (rows 3-13)**

The AND-guard interpolation checks that the next anchor block_index_h3 equals current + 1 (consecutive bars). For group 1, the next anchor is row 14 which has block_index_h3 = 2, so the guard passes. However, column I (ssa_low_h3) uses close_m15 at the next anchor as its guard. If close_m15 at row 14 is null, column I returns null for rows 3-13. This flows through to BH and BI being null in batch mode for those rows.

**9.3 Regression Only Available from Group 2**

Columns AT-BB and therefore BL-BM are not written for group 1 (rows 2-13). Stack B must emit null for BL and BM for these rows. Stack C must handle nullable floats. The frontend must filter out null values before passing to TradingView series. From group 2 onwards (row 14+), BL and BM use IFERROR wrappers (added in v6) so a sparse regression window returns empty string rather than a \#DIV/0! error.

**9.4 MROUND vs Standard Python Rounding**

Python\'s built-in round() uses banker\'s rounding. Excel\'s MROUND uses arithmetic rounding. For timestamp multiples of 300 this difference is irrelevant in practice. Use int(round(x / 300) \* 300) in Python to match Excel\'s MROUND for these values.

**9.5 x_count_regression Resets**

The AS column cycles 1 to 12 and resets across all rows, triggered when AS\[i-1\] + 1 == 13. In practice this is always synchronised with block_index_m15 because both cycle over the same 12-bar groups.

**9.6 Slope Clamping Direction**

AT (high slope): positive slope clamped to \[0, +3\]; slope below -0.5 clamped to -0.5; slope in \[-0.5, 0\] returns 0. AU (low slope): negative slope clamped to \[-3, 0\]; slope above +0.5 clamped to +0.5; slope in \[0, +0.5\] returns 0. These asymmetric clamps ensure the projected upper band only moves up and the projected lower band only moves down.

**9.7 Live Chart Null Gaps During Active H3 Bar**

While an H3 bar is still open (M15 bars 2-12 of the current group streaming in), BH and BI for those rows are null. The SSA interpolation and projection series will show a gap at the right edge for up to 2 hours 45 minutes. This is correct. The gap closes when Pass 2 fires at H3 close. The frontend MUST NOT extrapolate or fill this gap visually. It must stop the series at the last non-null point and resume when the bars:fillback WebSocket event arrives.

**9.8 Forward Projection Logic (AX/AY)**

AX (high projection) = AV + AT only if AT \> 0, otherwise AX = AV. The projection goes one step ahead of the regression line when slope is upward, but stays at the regression value otherwise. AY (low projection) = AW + AU only if AU \< 0, otherwise AY = AW. Symmetric logic for the lower band.

**10. Implementation Checklist for Claude Code**

**Stack A (Python)**

- Implement normalise_timestamp(unix_ts) returning excel_serial, rounded_serial, ts_adjusted

- Apply to all H3 rows (column A of ALGLIB_SSA_XAUUSD) to produce ts_adjusted_h3

- Apply to all M15 rows (column O) to produce ts_adjusted_m15

- Unit-test: verify ts_adjusted_m15 for a known timestamp matches column AA in v6.xlsx

- Unit-test: verify ts_adjusted_h3 for a known H3 timestamp matches column M in v6.xlsx

**Stack B (Python)**

- Build match_type1(query, sorted_array) using np.searchsorted for H3 lookups

- Build M15 exact lookup keyed on ts_adjusted_m15

- Implement pass1_m15_arrival(): anchor row gets H3 lookup for E-I; non-anchor rows store null

- Implement pass2_h3_close(): fillback the 11 prior interim rows with AND-guard interpolation

- AND-guard cols E-H: guard on col value at next anchor being non-null AND block indices consecutive

- AND-guard col I (ssa_low_h3): guard on close_m15 at next anchor row, not ssa_low_h3

- Implement forward-fill for timestamp/symbol/timeframe (AH-AJ, 900 s step when null)

- Implement x_count_regression counter: reset to 1 when previous value == 12

- Implement clamped_slope_high and clamped_slope_low using scipy.stats.linregress

- Implement regression line AV/AW and projection AX/AY in Pass 2, group_idx \>= 1 only

- Implement batch mode: collapse Pass 1 and Pass 2 into single-pass loop for historical data

- Schedule Pass 1: APScheduler cron \*/15 \* \* \* \*

- Schedule Pass 2: APScheduler cron 0 \*/3 \* \* \*

- Integration test (batch mode): compare BD-BM rows 2, 14, 15 against sample values in Section 4.4

- Unit test: non-anchor rows produce null BH/BI before Pass 2, then populate correctly after

**Stack C (Nest.js)**

- Scaffold Nest.js project with TypeORM + PostgreSQL + Redis

- SsaBarEntity: UNIQUE constraint on (symbol_forward, timeframe_forward, timestamp_forward); BRIN index on timestamp_forward

- BarRecordDto: nullable floats for ssa_m15_interpolation, ema_ssa_m15_interpolation, ssa_high_projection, ssa_low_projection

- POST /api/v1/bars/batch: UPSERT with ON CONFLICT DO UPDATE to support Pass 2 retroactive fills

- GET /api/v1/bars/latest: return last N records, backed by Redis cache

- GET /api/v1/bars: time-range filter by from_ts and to_ts

- WebSocket gateway: emit bars:update for each new Pass 1 row; emit bars:fillback for Pass 2 batch of 11 rows

- Integration test: POST 12 rows with 11 having null BH/BI; POST update with filled values; verify DB updated

**Frontend (Next.js v16)**

- Install lightweight-charts v4+ and Socket.IO client

- toBars() transformation: filter nulls from BH/BI/BL/BM arrays before setting chart series data

- SsaChart client component with 7 series: candles (BG), ssa_interp (BH), ema_interp (BI), ssa_raw (BJ), ema_raw (BK), high_proj (BL), low_proj (BM)

- TrendBadge reading trend_projection from last non-null bar

- SWR or React Query polling every 900 s for M15 data refresh

- Subscribe bars:update: call series.update() with the single new bar

- Subscribe bars:fillback: iterate 11 updated bars and call series.update() on each to patch null gaps

- End-to-end test: simulate 3-hour sequence; verify 11-bar null gap fills on fillback event

**11. Appendix - Formula Quick Reference**

**A. Timestamp Normalisation**

---

**Step** **Excel Formula** **Python Equivalent**
1 - to serial (A2/86400)+25569 ts / 86400.0 + 25569.0
2 - round 5 min CEILING(INT(K2\*1440)/1440\*288,1)/288 math.ceil(int(s\*1440)/1440\*288)/288
3 - to Unix MROUND((L2-25569)\*86400,300) round((s-25569)\*86400/300)\*300

---

**B. H3 Lookup (INDEX/MATCH type=1)**

> Excel: =IF(\$A{r}=\"\",\"\",INDEX(SRC!\$D\$2:\$D\$2401,MATCH(\$A{r},SRC!\$A\$2:\$A\$2401,1)))
>
> Python: idx = np.searchsorted(h3_ts_sorted, ts_m15, side=\'right\') - 1

**C. M15 XLOOKUP (exact match)**

> Excel: =\_xlfn.XLOOKUP(\$A{r},SRC!\$AA\$2:\$AA\$2401,SRC!\$R\$2:\$R\$2401,\"\",0)
>
> Python: df.merge(m15_df, left_on=\'ts_m15\', right_on=\'ts_adjusted_m15\', how=\'left\')

**D. AND-Guard Interpolation (cols E-H)**

> Excel: =IF(AND({col}{nxt}\<\>\"\",D{nxt}=D{anc}+1),
>
> {col}{anc}+({col}{nxt}-{col}{anc})\*{pos}/12,\"\")
>
> Python: (v_anchor + (v_next - v_anchor) \* pos / 12
>
> if v_next is not None and block_nxt == block_now + 1
>
> else None)

**E. AND-Guard col I (ssa_low_h3) - uses L guard**

> Excel: =IF(AND(L{nxt}\<\>\"\",D{nxt}=D{anc}+1),
>
> I{anc}+(I{nxt}-I{anc})\*{pos}/12,\"\")
>
> Python: guard = close_m15_at_next_anchor is not None and block_nxt == block_now + 1

**F. Regression Slope Clamping**

> AT (high): slope \> 0 -\> min(3, abs(slope))
>
> slope \< -0.5 -\> -0.5
>
> else -\> 0
>
> AU (low): slope \< 0 -\> max(-3, -abs(slope))
>
> slope \> 0.5 -\> 0.5
>
> else -\> 0

**G. AT / AU Slope Formula with IFERROR Protection (v6)**

> AT = IFERROR(IF(SLOPE(AQ_prev,AS_prev)\>0, MIN(3,\|slope\|), IF(slope\<-0.5,-0.5,0)), 0)
>
> AU = IFERROR(IF(SLOPE(AR_prev,AS_prev)\<0, MAX(-3,-\|slope\|),IF(slope\>0.5,0.5,0)), 0)

When SLOPE returns \#DIV/0! (sparse window), AT and AU default to 0 (flat slope). AV and AW then equal the anchor AQ/AR value. AX = AV, AY = AW (no step added). BL and BM add a second IFERROR layer catching any residual cascade.

**H. BL / BM Final Output with IFERROR (v6)**

> BL = IFERROR(AX{r}, \"\") \-- was =AX{r} in v5 (no protection)
>
> BM = IFERROR(AY{r}, \"\") \-- was =AY{r} in v5 (no protection)

Two-layer protection: AT/AU IFERROR handles sparse SLOPE; BL/BM IFERROR catches any cascade that escapes the first layer (e.g., empty AQ anchor value in a data-gap scenario).

**I. Regression Line and Projection**

> AV\[i\] = AQ\[anchor\] + AT\[i\] \* (AS\[i\] - 1) \# high regression line
>
> AW\[i\] = AR\[anchor\] + AU\[i\] \* (AS\[i\] - 1) \# low regression line
>
> AX\[i\] = AV\[i\] + AT\[i\] if AT\[i\] \> 0 else AV\[i\] \# high projection
>
> AY\[i\] = AW\[i\] + AU\[i\] if AU\[i\] \< 0 else AW\[i\] \# low projection

**J. Fillback Schedule Summary**

> Pass 1 (M15 bar close): cron \*/15 \* \* \* \* -\> INSERT 1 row; E-I null for non-anchor
>
> Pass 2 (H3 bar close): cron 0 \*/3 \* \* \* -\> UPDATE 11 rows; fill E-I, BH/BI/BL/BM
>
> Batch (historical): on-demand -\> single-pass, all rows at once

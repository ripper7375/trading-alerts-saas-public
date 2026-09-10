# Claude Code Task Prompt: Python Ingestion Safety Guard for Price-Level Columns

> **Instructions for User:** Copy the entire markdown block below and paste it directly into Claude Code.

---

````markdown
# TASK: Implement Ingestion Safety Guard Coercing Inactive 0.0 Price Levels to None (NULL) in export_collector_validator_v2.py

## 1. Target Repository & File

- **Target File:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/export_collector_validator_v2.py`
- **Related Reference Schema:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/sqlite_schema_v6_xauusd.sql`
- **Related Blueprint:** `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`

---

## 2. Background & Problem Statement

In MetaTrader 5 (MQL5) indicators, price buffers that are inactive, outside the calculation lookback window, or uninitialized are represented by `EMPTY_VALUE` (which formats as an empty tab `\t\t`) or `0.0` / `0.00000`.

In financial markets (specifically XAUUSD where gold price is ~$2,000–$3,000+), an inactive price level of `$0.0` is completely invalid. Furthermore, **SQLite Schema v6 explicitly mandates** (`sqlite_schema_v6_xauusd.sql`, line 39):

```sql
--   * Empty export fields are stored as NULL, not 0.
```
````

Currently, in `export_collector_validator_v2.py`, `parse_export_file()` parses real columns as:

```python
elif typ == 'real':
    row[col] = float(v)
```

If an export file contains `"0.0"` or `"0.00000"` for an inactive level, it is stored as `0.0` instead of `None` (`NULL`). This causes critical downstream failures:

1. **Regression Engine Catastrophe (`calculate_stage()`):**
   When `calculate_stage()` gathers SSA crossings:
   ```python
   crossings = [(ts_to_idx[ts], ssa) for ts, ssa, crossing in rows
                if crossing == 1 and ssa is not None and ts in ts_to_idx]
   ```
   If `ssa` is `0.0`, the point `(idx, 0.0)` is passed into `centroid_regression.py`. This catastrophically skews the OLS linear regression slope and pulls baseline levels (`base_fl`, `uoedt`, `loedt`) down towards zero.
2. **False Support/Resistance Alerts (`market_data`):**
   If `horiz_high_map` or `horiz_low_map` contains `0.0`, downstream alert bots and visual chart renderers interpret this as a support/resistance line at `$0.00`, causing spurious alert firings and corrupted chart bounds.
3. **ZigZag Phantom Pivots:**
   If `current_point` in ZigZag is `0.0`, downstream segment metric calculators treat `$0.00` as an active swing high/low.

---

## 3. Required Modifications

### A. Guard in `parse_export_file()`

In `export_collector_validator_v2.py`:

1. Define a constant set of price-level column names near the source definitions or at module scope:

```python
# Price-level columns where 0.0 or <= 0.0 represents inactive/empty data, never a valid market price
PRICE_LEVEL_COLUMNS = {
    'horiz_high_map', 'horiz_low_map', 'ssa', 'ema_ssa', 'current_point',
    'best_resistance', 'best_support', 'fractal_best_fl', 'fractal_uoedt',
    'fractal_loedt', 'base_fl', 'uoedt', 'loedt'
}
```

2. In `parse_export_file()`:
   When parsing columns from `col_idx`:

```python
for col, (idx, typ) in col_idx.items():
    v = parts[idx].strip() if idx is not None and idx < len(parts) else ''
    if v == '':
        row[col] = None
    elif typ == 'real':
        val = float(v)
        # Ingestion Guard: coerce inactive price levels (0.0 or <= 0.0) to None (NULL)
        is_price_col = (col in PRICE_LEVEL_COLUMNS or
                        col.endswith(('_map', '_point', '_fl', '_edt', '_ssa', '_resistance', '_support')))
        if is_price_col and val <= 0.0:
            row[col] = None
        else:
            row[col] = val
    elif typ == 'int':
        row[col] = int(float(v))
    else:
        row[col] = v
```

_(Note: Do NOT coerce integers like `crossing` to None when they equal 0 — `crossing == 0` is a valid boolean flag representing "no cross", whereas `1` represents "cross")._

---

### B. Defensive Guards in `calculate_stage()`

Even if staging tables contain historical or mock data with `0.0`, `calculate_stage()` must defensively guard against zero price values:

1. **Centroid Crossings SSA Filter (around line 404):**
   Update:

```python
crossings = [(ts_to_idx[ts], ssa) for ts, ssa, crossing in rows
             if crossing == 1 and ssa is not None and ssa > 0.0 and ts in ts_to_idx]
```

2. **ZigZag Pivots Filter (around line 363):**
   Update the SQL query for `raw_zigzag`:

```python
pivots_rows = conn.execute(
    f"SELECT timestamp_adj, point_type, current_point FROM raw_zigzag "
    f"WHERE cycle_id = ? AND current_point IS NOT NULL AND current_point > 0.0 "
    f"ORDER BY timestamp_adj DESC",
    (cycle_id,)).fetchall()
```

---

## 4. Verification & Testing Instructions

Please run the following checks to verify the fix:

1. **Syntax Check:**

   ```bash
   python -m py_compile backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/export_collector_validator_v2.py
   ```

2. **Unit / Property Test:**
   Execute a quick inline Python verification:

   ```python
   from pathlib import Path
   import tempfile
   from export_collector_validator_v2 import parse_export_file, SOURCES

   # Create a temporary dummy export file simulating inactive 0.0 and empty fields
   header = "Centriod_Best_Fit_A_timestamp\tCentriod_Best_Fit_A_symbol\tCentriod_Best_Fit_A_timeframe\tCentriod_Best_Fit_A_close\tCentriod_Best_Fit_A_Base_FL\tCentriod_Best_Fit_A_UOEDT\tCentriod_Best_Fit_A_LOEDT\tCentriod_Best_Fit_A_horiz_high_map\tCentriod_Best_Fit_A_horiz_low_map\tCentriod_Best_Fit_A_ssa\tCentriod_Best_Fit_A_ema_ssa\tCentriod_Best_Fit_A_crossing\n"
   # Row 1: empty tabs (\t\t)
   # Row 2: explicit "0.00000" for price maps and ssa, 0 for crossing
   # Row 3: valid price levels (e.g. 2350.50), 1 for crossing
   row1 = "1725793200\tXAUUSD\tM5\t2350.10\t\t\t\t\t\t\t\t0\n"
   row2 = "1725793500\tXAUUSD\tM5\t2350.20\t0.00000\t0.00000\t0.00000\t0.00000\t0.00000\t0.00000000\t0.00000000\t0\n"
   row3 = "1725793800\tXAUUSD\tM5\t2350.30\t2348.00\t2355.00\t2340.00\t2355.50\t2342.20\t2349.80000000\t2349.75000000\t1\n"

   with tempfile.NamedTemporaryFile("w+", delete=False, encoding="utf-8") as tf:
       tf.write(header + row1 + row2 + row3)
       tf_path = Path(tf.name)

   rows = parse_export_file(tf_path, SOURCES['best_fit_a'], 'M5')
   tf_path.unlink()

   # Assertions:
   assert rows[0]['horiz_high_map'] is None, "Empty tab must parse as None"
   assert rows[1]['horiz_high_map'] is None, "0.00000 price map must be coerced to None"
   assert rows[1]['ssa'] is None, "0.00000000 ssa must be coerced to None"
   assert rows[1]['crossing'] == 0, "crossing=0 must remain integer 0, not None"
   assert rows[2]['horiz_high_map'] == 2355.50, "Valid price must parse as float"
   assert rows[2]['crossing'] == 1, "crossing=1 must remain integer 1"
   print("ALL INGESTION GUARD ASSERTIONS PASSED SUCCESSFULLY!")
   ```

3. Confirm git diff shows clean, targeted changes adhering to existing logging, styling, and schema v6 rules.

```

```

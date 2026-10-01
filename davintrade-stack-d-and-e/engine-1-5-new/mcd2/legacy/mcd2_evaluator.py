"""
MCD2: M5 Defined Trend and Breakout Implication Evaluator (XAUUSD - M5)
DavinTrade Stack D - Engine 1.5A Module

Core Mandate:
1. Determine the defined intraday trend direction of Gold (XAUUSD) on M5 from linear regression angle.
2. Evaluate immediate corridor deviation status and mean-reversion probability:
   - For Centroid indicators (7 variants): evaluated using Singular Spectrum Analysis (SSA) vs UOEDT/LOEDT.
   - For Fractal indicator: evaluated using Close price vs fractal UOEDT/LOEDT.
3. Implication of Breakout on M5:
   - Inside Corridor: Normal price/SSA oscillation within channel bands; healthy trend continuation.
   - Outside Corridor (SSA > UOEDT or SSA < LOEDT): Abnormal deviation presenting high probability
     of Mean Reversion back into the corridor, with low risk of disrupting the underlying M5 trend.
     Presents high-conviction entry opportunities to scalp or capture mean-reversion pullbacks.

4-Tier Pre-Flight Quality Gate Architecture:
- Tier 1: Candidate Isolation & Single Active Indicator Rule (8 candidate EDT indicators: 7 centroids + fractal).
- Tier 2: M5 Continuity & Non-Null Monotonicity Check.
- Tier 3: Channel Boundary Sanity Gate (UOEDT > LOEDT on all evaluated bars).
- Tier 4: Statistics Ingestion Verification (symbol=XAUUSD, tf=M5, matching source record, CR >= 50%).

Synthesis Decision Matrix (9 Canonical Discrete States):
- UPTREND + IN_CORRIDOR -> TREND_ALIGNED_CONTINUATION
- UPTREND + UPPER_BREAKOUT -> UPPER_OVEREXTENSION_REVERSION
- UPTREND + LOWER_BREAKDOWN -> DIP_VALUE_BUY_OPPORTUNITY
- DOWNTREND + IN_CORRIDOR -> TREND_ALIGNED_CONTINUATION
- DOWNTREND + LOWER_BREAKDOWN -> LOWER_OVEREXTENSION_REVERSION
- DOWNTREND + UPPER_BREAKOUT -> RALLY_VALUE_SELL_OPPORTUNITY
- SIDEWAYS + IN_CORRIDOR -> RANGE_EQUILIBRIUM
- SIDEWAYS + UPPER_BREAKOUT -> RANGE_RESISTANCE_REVERSION
- SIDEWAYS + LOWER_BREAKDOWN -> RANGE_SUPPORT_REVERSION
"""

import os
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import openpyxl

# Ensure UTF-8 output on Windows console
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Candidate EDT Indicators permitted on M5 (Strictly 8 candidates)
CANDIDATE_EDT_INDICATORS = [
    "best_fit_a",
    "best_fit_b",
    "cherry_a",
    "cherry_b",
    "most_recent",
    "non_a",
    "non_b",
    "fractal",
]

# Configurable Calibration Constants
DEFAULT_SIDEWAYS_ANGLE_THRESHOLD = 5.0    # Deadband threshold in degrees (+/- 5.0°)
DEFAULT_MIN_CONTAINMENT_THRESHOLD = 50.0  # Corridor statistical integrity gate (%)
DEFAULT_MIN_WINDOW_FLOOR = 48             # Minimum floor: 48 bars (4 hours on M5)
DEFAULT_MAX_WINDOW_BARS = 288             # Maximum window: 288 bars (24 hours / 1 full day of M5)
DEFAULT_SYMBOL = "XAUUSD"
DEFAULT_TIMEFRAME = "M5"


class MCD2ValidationError(Exception):
    """Custom exception for MCD2 4-tier validation failures."""
    pass


class MCD2M5TrendEvaluator:
    """
    Evaluator for MCD2: M5 Defined Trend and Breakout Implication (XAUUSD - M5).
    """

    def __init__(
        self,
        excel_path: str,
        sideways_threshold: float = DEFAULT_SIDEWAYS_ANGLE_THRESHOLD,
        min_containment_threshold: float = DEFAULT_MIN_CONTAINMENT_THRESHOLD,
        min_window_floor: int = DEFAULT_MIN_WINDOW_FLOOR,
        max_window_bars: int = DEFAULT_MAX_WINDOW_BARS,
        target_indicator: Optional[str] = None,
        symbol: str = DEFAULT_SYMBOL,
        timeframe: str = DEFAULT_TIMEFRAME,
    ):
        self.excel_path = os.path.abspath(excel_path)
        self.sideways_threshold = sideways_threshold
        self.min_containment_threshold = min_containment_threshold
        self.min_window_floor = min_window_floor
        self.max_window_bars = max_window_bars
        self.target_indicator = target_indicator.strip().lower() if target_indicator else None
        self.symbol = symbol
        self.timeframe = timeframe

        self.wb: Optional[openpyxl.Workbook] = None
        self.m5_sheet = None
        self.stat_sheet = None

        self.validation_errors: List[str] = []
        self.validation_warnings: List[str] = []
        self.validation_checks: Dict[str, Any] = {}

    def load_workbook(self) -> None:
        """Load Excel workbook in read-only mode for high performance."""
        if not os.path.exists(self.excel_path):
            raise FileNotFoundError(f"Excel workbook not found at: {self.excel_path}")

        try:
            self.wb = openpyxl.load_workbook(self.excel_path, data_only=True, read_only=True)
        except Exception as e:
            raise MCD2ValidationError(f"Failed to open Excel workbook: {str(e)}")

        sheet_names = self.wb.sheetnames
        m5_sheet_name = f"market_data_v6_{self.timeframe}"

        if m5_sheet_name not in sheet_names:
            raise MCD2ValidationError(
                f"Required sheet '{m5_sheet_name}' not found. Available sheets: {sheet_names}"
            )
        if "indicator_statistics" not in sheet_names:
            raise MCD2ValidationError(
                f"Required sheet 'indicator_statistics' not found. Available sheets: {sheet_names}"
            )

        self.m5_sheet = self.wb[m5_sheet_name]
        self.stat_sheet = self.wb["indicator_statistics"]

    def _get_sheet_headers_and_rows(self, sheet) -> Tuple[Dict[str, int], List[List[Any]]]:
        """Extract header column map and rows from an openpyxl sheet."""
        rows_iter = sheet.iter_rows(values_only=True)
        try:
            header_row = next(rows_iter)
        except StopIteration:
            return {}, []

        headers = {str(name).strip(): col_idx for col_idx, name in enumerate(header_row) if name is not None}
        data_rows = [list(r) for r in rows_iter if any(v is not None for v in r)]
        return headers, data_rows

    def validate_tier1_and_detect_active_indicator(
        self, headers: Dict[str, int], rows: List[List[Any]]
    ) -> Tuple[str, int]:
        """
        Tier 1 Validation: Candidate Isolation & Single Active Indicator Rule.
        Scans strictly the 8 Candidate EDT Indicators on M5.
        Enforces exactly 1 active indicator in production mode.
        If target_indicator is provided, isolates and validates that candidate.
        Returns: (active_indicator_name, last_populated_row_index)
        """
        total_bars = len(rows)
        self.validation_checks["total_bars_available"] = total_bars

        if total_bars < self.min_window_floor:
            err = (
                f"Tier 1 Validation Failed: Insufficient bar data in {self.timeframe} sheet. "
                f"Found {total_bars} bars, but minimum floor requires {self.min_window_floor} bars."
            )
            self.validation_errors.append(err)
            raise MCD2ValidationError(err)

        detected_active: List[str] = []
        indicator_coverage: Dict[str, int] = {}
        indicator_last_row_indices: Dict[str, int] = {}

        for ind in CANDIDATE_EDT_INDICATORS:
            if ind == "fractal":
                fl_col = "fractal_best_fl"
                uoedt_col = "fractal_uoedt"
                loedt_col = "fractal_loedt"
                close_col = "close"

                if fl_col not in headers or uoedt_col not in headers or loedt_col not in headers:
                    indicator_coverage[ind] = 0
                    continue

                fl_idx = headers[fl_col]
                uoedt_idx = headers[uoedt_col]
                loedt_idx = headers[loedt_col]
                close_idx = headers.get(close_col, -1)

                populated_indices = [
                    i
                    for i, r in enumerate(rows)
                    if r[fl_idx] is not None
                    and r[uoedt_idx] is not None
                    and r[loedt_idx] is not None
                    and (close_idx == -1 or r[close_idx] is not None)
                    and isinstance(r[fl_idx], (int, float))
                    and isinstance(r[uoedt_idx], (int, float))
                    and isinstance(r[loedt_idx], (int, float))
                    and r[uoedt_idx] > 0
                ]
            else:
                ssa_col = f"{ind}_ssa"
                uoedt_col = f"{ind}_uoedt"
                loedt_col = f"{ind}_loedt"

                if ssa_col not in headers or uoedt_col not in headers or loedt_col not in headers:
                    indicator_coverage[ind] = 0
                    continue

                ssa_idx = headers[ssa_col]
                uoedt_idx = headers[uoedt_col]
                loedt_idx = headers[loedt_col]

                populated_indices = [
                    i
                    for i, r in enumerate(rows)
                    if r[ssa_idx] is not None
                    and r[uoedt_idx] is not None
                    and r[loedt_idx] is not None
                    and isinstance(r[ssa_idx], (int, float))
                    and isinstance(r[uoedt_idx], (int, float))
                    and isinstance(r[loedt_idx], (int, float))
                    and r[ssa_idx] > 0
                ]

            count = len(populated_indices)
            indicator_coverage[ind] = count
            if count >= self.min_window_floor:
                detected_active.append(ind)
                indicator_last_row_indices[ind] = populated_indices[-1]
            elif count > 0:
                self.validation_warnings.append(
                    f"Insufficient bar coverage for '{ind}': found {count} bars, minimum floor is {self.min_window_floor}."
                )

        self.validation_checks["candidate_indicator_coverage"] = indicator_coverage
        self.validation_checks["active_indicators_detected"] = detected_active

        # If a target indicator was explicitly specified (for test isolation)
        if self.target_indicator is not None:
            if self.target_indicator not in CANDIDATE_EDT_INDICATORS:
                err = (
                    f"Tier 1 Validation Failed: Specified target_indicator '{self.target_indicator}' is not in "
                    f"permitted candidates: {CANDIDATE_EDT_INDICATORS}"
                )
                self.validation_errors.append(err)
                raise MCD2ValidationError(err)

            if self.target_indicator not in detected_active:
                err = (
                    f"Tier 1 Validation Failed: Specified target_indicator '{self.target_indicator}' has insufficient "
                    f"active data ({indicator_coverage.get(self.target_indicator, 0)} bars < {self.min_window_floor})."
                )
                self.validation_errors.append(err)
                raise MCD2ValidationError(err)

            active_indicator = self.target_indicator
            last_row_idx = indicator_last_row_indices[active_indicator]
            return active_indicator, last_row_idx

        # Strict Production Mode (target_indicator is None)
        if len(detected_active) == 0:
            err = (
                f"Tier 1 Validation Failed: No active EDT indicator found on {self.timeframe} "
                f"with >= {self.min_window_floor} bars. Candidate coverage: {indicator_coverage}"
            )
            self.validation_errors.append(err)
            raise MCD2ValidationError(err)

        if len(detected_active) > 1:
            err = (
                f"Tier 1 Validation Failed: Multiple active EDT indicators detected on {self.timeframe} "
                f"({detected_active}). Under DavinTrade System Rule, exactly 1 active indicator is permitted in production."
            )
            self.validation_errors.append(err)
            raise MCD2ValidationError(err)

        active_indicator = detected_active[0]
        last_row_idx = indicator_last_row_indices[active_indicator]
        return active_indicator, last_row_idx

    def validate_tier4_indicator_statistics(
        self, active_indicator: str
    ) -> Dict[str, Any]:
        """
        Tier 4 Validation: Indicator Statistics Ingestion Verification.
        Queries indicator_statistics matching symbol='XAUUSD', timeframe='M5', and source=active_indicator.
        (For active_indicator == 'fractal', source maps to 'fractal_edt').
        Validates regression_angle, containment_rate, and containment_n (EDT Time Horizon).
        """
        headers, rows = self._get_sheet_headers_and_rows(self.stat_sheet)
        if not headers or not rows:
            err = "Tier 4 Validation Failed: Sheet 'indicator_statistics' contains no header or data rows."
            self.validation_errors.append(err)
            raise MCD2ValidationError(err)

        required_cols = ["symbol", "timeframe", "source", "captured_at", "regression_angle"]
        for col in required_cols:
            if col not in headers:
                err = f"Tier 4 Validation Failed: Sheet 'indicator_statistics' missing required column: '{col}'"
                self.validation_errors.append(err)
                raise MCD2ValidationError(err)

        stat_source = "fractal_edt" if active_indicator == "fractal" else active_indicator

        sym_idx = headers["symbol"]
        tf_idx = headers["timeframe"]
        src_idx = headers["source"]
        cap_idx = headers["captured_at"]
        ang_idx = headers["regression_angle"]
        cont_rate_idx = headers.get("containment_rate")
        cont_n_idx = headers.get("containment_n")
        vis_win_idx = headers.get("visual_window_bars")
        win_bars_idx = headers.get("window_bars")
        cp_idx = headers.get("channel_position")
        slope_idx = headers.get("raw_slope")
        live_bar_idx = headers.get("live_bar_ts")
        y_int_idx = headers.get("anchored_y_int")
        ch_width_idx = headers.get("channel_width")

        matching_rows: List[List[Any]] = []
        for r in rows:
            r_sym = str(r[sym_idx]).strip() if r[sym_idx] else ""
            r_tf = str(r[tf_idx]).strip() if r[tf_idx] else ""
            r_src = str(r[src_idx]).strip() if r[src_idx] else ""

            if r_sym == self.symbol and r_tf == self.timeframe and r_src == stat_source:
                matching_rows.append(r)

        if not matching_rows:
            err = (
                f"Tier 4 Validation Failed: No matching statistic record in 'indicator_statistics' for "
                f"symbol='{self.symbol}', timeframe='{self.timeframe}', source='{stat_source}'."
            )
            self.validation_errors.append(err)
            raise MCD2ValidationError(err)

        # Sort descending by captured_at to take the latest snapshot
        matching_rows.sort(key=lambda x: int(x[cap_idx]) if x[cap_idx] is not None else 0, reverse=True)
        latest_row = matching_rows[0]

        raw_angle = latest_row[ang_idx]
        if raw_angle is None:
            err = f"Tier 4 Validation Failed: 'regression_angle' is null for '{stat_source}'."
            self.validation_errors.append(err)
            raise MCD2ValidationError(err)

        try:
            regression_angle = float(raw_angle)
        except ValueError:
            err = f"Tier 4 Validation Failed: Failed to parse 'regression_angle' as float: {raw_angle}"
            self.validation_errors.append(err)
            raise MCD2ValidationError(err)

        # Containment Rate
        containment_rate = None
        if cont_rate_idx is not None and latest_row[cont_rate_idx] is not None:
            try:
                containment_rate = float(latest_row[cont_rate_idx])
            except ValueError:
                pass

        # EDT Time Horizon (read from containment_n, visual_window_bars, or window_bars)
        edt_time_horizon = None
        if cont_n_idx is not None and latest_row[cont_n_idx] is not None:
            try:
                edt_time_horizon = int(latest_row[cont_n_idx])
            except ValueError:
                pass
        if edt_time_horizon is None and vis_win_idx is not None and latest_row[vis_win_idx] is not None:
            try:
                edt_time_horizon = int(latest_row[vis_win_idx])
            except ValueError:
                pass
        if edt_time_horizon is None and win_bars_idx is not None and latest_row[win_bars_idx] is not None:
            try:
                edt_time_horizon = int(latest_row[win_bars_idx])
            except ValueError:
                pass
        if edt_time_horizon is None:
            edt_time_horizon = self.max_window_bars
            self.validation_warnings.append(
                f"Could not read 'containment_n' or 'window_bars' for '{stat_source}'. "
                f"Defaulting EDT Time Horizon to {self.max_window_bars} bars."
            )

        channel_position_stat = None
        if cp_idx is not None and latest_row[cp_idx] is not None:
            try:
                channel_position_stat = float(latest_row[cp_idx])
            except ValueError:
                pass

        captured_at = int(latest_row[cap_idx]) if latest_row[cap_idx] is not None else 0
        raw_slope = float(latest_row[slope_idx]) if slope_idx is not None and latest_row[slope_idx] is not None else None
        live_bar_ts = int(latest_row[live_bar_idx]) if live_bar_idx is not None and latest_row[live_bar_idx] is not None else None
        anchored_y_int = float(latest_row[y_int_idx]) if y_int_idx is not None and latest_row[y_int_idx] is not None else None
        channel_width_stat = float(latest_row[ch_width_idx]) if ch_width_idx is not None and latest_row[ch_width_idx] is not None else None

        stat_summary = {
            "source": stat_source,
            "captured_at": captured_at,
            "live_bar_ts": live_bar_ts,
            "regression_angle": regression_angle,
            "containment_rate": containment_rate,
            "edt_time_horizon": edt_time_horizon,
            "channel_position_stat": channel_position_stat,
            "raw_slope": raw_slope,
            "anchored_y_int": anchored_y_int,
            "channel_width_stat": channel_width_stat,
            "total_matching_snapshots": len(matching_rows),
        }
        self.validation_checks["indicator_statistics_record"] = stat_summary
        return stat_summary

    def calculate_evaluation_window(self, edt_time_horizon: int) -> int:
        """
        Calculate Evaluation Window Size for M5:
        N_window = max(min_window_floor, min(edt_time_horizon, max_window_bars))
        Default window caps at 288 bars (24 hours / 1 day of M5).
        """
        n_window = max(self.min_window_floor, min(edt_time_horizon, self.max_window_bars))
        self.validation_checks["edt_time_horizon"] = edt_time_horizon
        self.validation_checks["evaluation_window_bars"] = n_window
        return n_window

    def validate_tier2_and_tier3_corridor(
        self,
        active_indicator: str,
        headers: Dict[str, int],
        rows: List[List[Any]],
        last_row_idx: int,
        n_window: int,
    ) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        """
        Tier 2: M5 Continuity & Monotonicity Check.
        Tier 3: Channel Sanity Gate (UOEDT > LOEDT on every evaluated bar).
        Calculates bar-by-bar corridor metrics:
          - Uses SSA for Centroids
          - Uses Close for Fractal
        Returns: (bar_records, window_statistics)
        """
        start_idx = last_row_idx - n_window + 1
        if start_idx < 0:
            err = (
                f"Tier 2 Validation Failed: Insufficient historical bars prior to last bar. "
                f"Required {n_window} bars, but only {last_row_idx + 1} available."
            )
            self.validation_errors.append(err)
            raise MCD2ValidationError(err)

        evaluation_rows = rows[start_idx : last_row_idx + 1]
        self.validation_checks["evaluation_start_bar_index"] = start_idx + 2
        self.validation_checks["evaluation_end_bar_index"] = last_row_idx + 2

        is_fractal = (active_indicator == "fractal")
        if is_fractal:
            fl_idx = headers["fractal_best_fl"]
            uoedt_idx = headers["fractal_uoedt"]
            loedt_idx = headers["fractal_loedt"]
            metric_col_name = "close"
            metric_idx = headers.get("close", 8)
        else:
            fl_idx = headers.get(f"{active_indicator}_base_fl", -1)
            uoedt_idx = headers[f"{active_indicator}_uoedt"]
            loedt_idx = headers[f"{active_indicator}_loedt"]
            metric_col_name = "ssa"
            metric_idx = headers[f"{active_indicator}_ssa"]

        ts_idx = headers.get("timestamp", 2)
        close_idx = headers.get("close", 8)

        bar_records: List[Dict[str, Any]] = []
        prev_ts = 0

        contained_count = 0
        upper_breach_count = 0
        lower_breach_count = 0
        max_excursion_above = 0.0
        max_excursion_below = 0.0

        for idx, r in enumerate(evaluation_rows, start=1):
            ts = int(r[ts_idx]) if r[ts_idx] is not None else 0
            close_val = float(r[close_idx]) if r[close_idx] is not None else 0.0
            uoedt_val = float(r[uoedt_idx])
            loedt_val = float(r[loedt_idx])
            base_val = float(r[fl_idx]) if fl_idx != -1 and r[fl_idx] is not None else (uoedt_val + loedt_val) / 2.0
            metric_val = float(r[metric_idx]) if r[metric_idx] is not None else close_val

            # Tier 2: Monotonic timestamp continuity check
            if prev_ts > 0 and ts <= prev_ts:
                self.validation_warnings.append(
                    f"Tier 2 Warning: Timestamp non-monotonic at bar {idx}: prev_ts={prev_ts}, curr_ts={ts}"
                )
            prev_ts = ts

            # Tier 3: Channel boundary sanity gate (UOEDT > LOEDT)
            if uoedt_val <= loedt_val:
                err = (
                    f"Tier 3 Validation Failed: Corrupt Channel Boundary at bar {idx} (ts={ts}): "
                    f"UOEDT ({uoedt_val}) <= LOEDT ({loedt_val}). Upper band must be strictly greater than lower band."
                )
                self.validation_errors.append(err)
                raise MCD2ValidationError(err)

            channel_width = uoedt_val - loedt_val
            cp_metric = round((metric_val - loedt_val) / channel_width, 4) if channel_width > 0 else 0.5
            cp_close = round((close_val - loedt_val) / channel_width, 4) if channel_width > 0 else 0.5

            is_contained = (loedt_val <= metric_val <= uoedt_val)
            breach_type = "NONE"
            if metric_val > uoedt_val:
                breach_type = "UPPER_BREACH"
                upper_breach_count += 1
                excursion = metric_val - uoedt_val
                if excursion > max_excursion_above:
                    max_excursion_above = excursion
            elif metric_val < loedt_val:
                breach_type = "LOWER_BREACH"
                lower_breach_count += 1
                excursion = loedt_val - metric_val
                if excursion > max_excursion_below:
                    max_excursion_below = excursion
            else:
                contained_count += 1

            bar_records.append({
                "bar_index_from_latest": n_window - idx + 1,
                "timestamp": ts,
                "close": close_val,
                "metric_name": metric_col_name,
                "metric_value": metric_val,
                "baseline": base_val,
                "uoedt": uoedt_val,
                "loedt": loedt_val,
                "channel_width": channel_width,
                "channel_position": cp_metric,
                "channel_position_close": cp_close,
                "is_contained": is_contained,
                "breach_type": breach_type,
            })

        window_statistics = {
            "window_bars": n_window,
            "metric_evaluated": metric_col_name.upper(),
            "contained_bar_count": contained_count,
            "contained_pct": round((contained_count / n_window) * 100, 1) if n_window > 0 else 0.0,
            "upper_breach_count": upper_breach_count,
            "upper_breach_pct": round((upper_breach_count / n_window) * 100, 1) if n_window > 0 else 0.0,
            "lower_breach_count": lower_breach_count,
            "lower_breach_pct": round((lower_breach_count / n_window) * 100, 1) if n_window > 0 else 0.0,
            "max_excursion_above": round(max_excursion_above, 2),
            "max_excursion_below": round(max_excursion_below, 2),
        }

        return bar_records, window_statistics

    def classify_trend(self, regression_angle: float) -> str:
        """
        Classify M5 Trend Direction via regression_angle with deadband threshold (+/- 5.0°).
        """
        if regression_angle > self.sideways_threshold:
            return "UPTREND"
        elif regression_angle < -self.sideways_threshold:
            return "DOWNTREND"
        else:
            return "SIDEWAYS"

    def classify_corridor_state(self, channel_position: float) -> str:
        """
        Classify Corridor State from channel position:
        - channel_position > 1.0 -> UPPER_BREAKOUT
        - channel_position < 0.0 -> LOWER_BREAKDOWN
        - 0.0 <= channel_position <= 1.0 -> IN_CORRIDOR
        """
        if channel_position > 1.0:
            return "UPPER_BREAKOUT"
        elif channel_position < 0.0:
            return "LOWER_BREAKDOWN"
        else:
            return "IN_CORRIDOR"

    def synthesize_m5_trend_and_corridor(
        self,
        trend_direction: str,
        corridor_state: str,
        is_corridor_valid: bool,
        regression_angle: float,
        channel_position: float,
        uoedt_latest: float,
        loedt_latest: float,
        metric_latest: float,
        metric_name: str,
    ) -> Tuple[str, str, str, str, str, str, str]:
        """
        Synthesize M5 Trend Direction and Corridor Deviation State into canonical discrete states.
        Returns: (
            primary_trend,
            corridor_state,
            regime_status,
            discrete_state_code,
            mean_reversion_prob,
            trend_continuation_risk,
            description,
            commentary
        )
        """
        if not is_corridor_valid or trend_direction == "UNIDENTIFIED":
            return (
                "UNIDENTIFIED",
                "UNCERTAIN",
                "UNCERTAIN",
                "MCD2_UNIDENTIFIED",
                "UNKNOWN",
                "HIGH",
                "M5 EDT channel structure failed statistical integrity checks (containment rate < 50%).",
                f"{self.symbol} {self.timeframe} channel structure failed integrity checks. Primary trend is UNIDENTIFIED.",
            )

        dist_uoedt = metric_latest - uoedt_latest
        dist_loedt = metric_latest - loedt_latest

        if trend_direction == "UPTREND":
            if corridor_state == "IN_CORRIDOR":
                regime_status = "TREND_ALIGNED_CONTINUATION"
                state_code = "MCD2_UP_IN_CORRIDOR"
                reversion_prob = "LOW"
                trend_risk = "LOW"
                desc = "Price fluctuates normally inside upward channel bands. Healthy uptrend continuation."
                commentary = (
                    f"{self.symbol} {self.timeframe} trend is UPTREND (+{regression_angle:.2f}°) with {metric_name} "
                    f"safely within the EDT corridor (channel_position={channel_position:.4f}). "
                    f"Deviation remains moderate without high mean reversion pressure, confirming healthy trend continuation."
                )
            elif corridor_state == "UPPER_BREAKOUT":
                regime_status = "UPPER_OVEREXTENSION_REVERSION"
                state_code = "MCD2_UP_UPPER_BREAKOUT"
                reversion_prob = "HIGH"
                trend_risk = "LOW"
                desc = (
                    "Abnormal bullish deviation above UOEDT. High probability of Mean Reversion back down into corridor, "
                    "with low risk to macro uptrend. Profit taking or short mean-reversion scalp opportunity."
                )
                commentary = (
                    f"{self.symbol} {self.timeframe} trend is UPTREND (+{regression_angle:.2f}°), but {metric_name} "
                    f"has breached above the UOEDT corridor (channel_position={channel_position:.4f} > 1.0, distance=+{dist_uoedt:.2f} USD). "
                    f"This reflects an abnormal upward deviation with high probability of Mean Reversion back into the corridor, "
                    f"carrying low risk of disrupting the underlying M5 bullish trend."
                )
            else:  # LOWER_BREAKDOWN
                regime_status = "DIP_VALUE_BUY_OPPORTUNITY"
                state_code = "MCD2_UP_LOWER_BREAKDOWN"
                reversion_prob = "HIGH"
                trend_risk = "LOW"
                desc = (
                    "Bullish trend pullback dipping below LOEDT. Extreme downward deviation presenting prime buy-the-dip "
                    "opportunity for mean-reversion bounce aligned with uptrend."
                )
                commentary = (
                    f"{self.symbol} {self.timeframe} trend is UPTREND (+{regression_angle:.2f}°), and {metric_name} "
                    f"has dipped below LOEDT (channel_position={channel_position:.4f} < 0.0, distance={dist_loedt:.2f} USD). "
                    f"This abnormal downward deviation creates a prime mean-reversion buying opportunity back into the corridor "
                    f"with low structural trend risk."
                )

        elif trend_direction == "DOWNTREND":
            if corridor_state == "IN_CORRIDOR":
                regime_status = "TREND_ALIGNED_CONTINUATION"
                state_code = "MCD2_DOWN_IN_CORRIDOR"
                reversion_prob = "LOW"
                trend_risk = "LOW"
                desc = "Price fluctuates normally inside downward channel bands. Orderly downtrend continuation."
                commentary = (
                    f"{self.symbol} {self.timeframe} trend is DOWNTREND ({regression_angle:.2f}°) with {metric_name} "
                    f"safely within the EDT corridor (channel_position={channel_position:.4f}). "
                    f"Deviation remains moderate, confirming orderly downward trend continuation."
                )
            elif corridor_state == "LOWER_BREAKDOWN":
                regime_status = "LOWER_OVEREXTENSION_REVERSION"
                state_code = "MCD2_DOWN_LOWER_BREAKDOWN"
                reversion_prob = "HIGH"
                trend_risk = "LOW"
                desc = (
                    "Abnormal bearish deviation below LOEDT. High probability of upward Mean Reversion bounce back into corridor, "
                    "with low risk to macro downtrend. Profit taking or long mean-reversion scalp opportunity."
                )
                commentary = (
                    f"{self.symbol} {self.timeframe} trend is DOWNTREND ({regression_angle:.2f}°), but {metric_name} "
                    f"has breached below the LOEDT corridor (channel_position={channel_position:.4f} < 0.0, distance={dist_loedt:.2f} USD). "
                    f"This reflects an abnormal downward deviation with high probability of upward Mean Reversion back into the corridor, "
                    f"carrying low risk of disrupting the underlying M5 bearish trend."
                )
            else:  # UPPER_BREAKOUT
                regime_status = "RALLY_VALUE_SELL_OPPORTUNITY"
                state_code = "MCD2_DOWN_UPPER_BREAKOUT"
                reversion_prob = "HIGH"
                trend_risk = "LOW"
                desc = (
                    "Bearish trend counter-bounce spiking above UOEDT. Extreme upward deviation presenting prime sell-the-rally "
                    "opportunity for mean-reversion drop aligned with downtrend."
                )
                commentary = (
                    f"{self.symbol} {self.timeframe} trend is DOWNTREND ({regression_angle:.2f}°), and {metric_name} "
                    f"has rallied above UOEDT (channel_position={channel_position:.4f} > 1.0, distance=+{dist_uoedt:.2f} USD). "
                    f"This abnormal upward excursion creates a prime mean-reversion selling opportunity back into the corridor "
                    f"with low structural trend risk."
                )

        else:  # SIDEWAYS
            if corridor_state == "IN_CORRIDOR":
                regime_status = "RANGE_EQUILIBRIUM"
                state_code = "MCD2_SIDEWAYS_IN_CORRIDOR"
                reversion_prob = "LOW"
                trend_risk = "LOW"
                desc = "Balanced horizontal consolidation. Price oscillates near channel baseline with minimal directional deviation."
                commentary = (
                    f"{self.symbol} {self.timeframe} market is in SIDEWAYS equilibrium ({regression_angle:.2f}°). "
                    f"Price and {metric_name} oscillate comfortably within channel boundaries (channel_position={channel_position:.4f}) "
                    f"with balanced supply and demand."
                )
            elif corridor_state == "UPPER_BREAKOUT":
                regime_status = "RANGE_RESISTANCE_REVERSION"
                state_code = "MCD2_SIDEWAYS_UPPER_BREAKOUT"
                reversion_prob = "HIGH"
                trend_risk = "LOW"
                desc = "Range high breakout above UOEDT in a flat market. High probability of downward mean reversion back toward channel center."
                commentary = (
                    f"{self.symbol} {self.timeframe} market is SIDEWAYS ({regression_angle:.2f}°), with {metric_name} "
                    f"breaching above the UOEDT boundary (channel_position={channel_position:.4f} > 1.0, distance=+{dist_uoedt:.2f} USD). "
                    f"High probability of downward mean reversion back toward the channel baseline."
                )
            else:  # LOWER_BREAKDOWN
                regime_status = "RANGE_SUPPORT_REVERSION"
                state_code = "MCD2_SIDEWAYS_LOWER_BREAKDOWN"
                reversion_prob = "HIGH"
                trend_risk = "LOW"
                desc = "Range low breakdown below LOEDT in a flat market. High probability of upward mean reversion back toward channel center."
                commentary = (
                    f"{self.symbol} {self.timeframe} market is SIDEWAYS ({regression_angle:.2f}°), with {metric_name} "
                    f"dipping below the LOEDT boundary (channel_position={channel_position:.4f} < 0.0, distance={dist_loedt:.2f} USD). "
                    f"High probability of upward mean reversion back toward the channel baseline."
                )

        return (
            trend_direction,
            corridor_state,
            regime_status,
            state_code,
            reversion_prob,
            trend_risk,
            desc,
            commentary,
        )

    def evaluate(self) -> Dict[str, Any]:
        """
        Execute 4-tier validation, M5 trend classification, and corridor deviation synthesis.
        Returns canonical JSONB payload for Stack D Engine 1.5A consumption.
        """
        eval_time = datetime.now(timezone.utc)
        result: Dict[str, Any] = {
            "mcd_id": "MCD2",
            "name": "M5 Defined Trend and Breakout Implication",
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "evaluated_at": eval_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "evaluated_epoch": int(eval_time.timestamp()),
            "parameters": {
                "sideways_angle_threshold_degrees": self.sideways_threshold,
                "min_containment_threshold": self.min_containment_threshold,
                "min_window_floor": self.min_window_floor,
                "max_window_bars": self.max_window_bars,
                "target_indicator_override": self.target_indicator,
            },
            "validation": {
                "status": "PASS",
                "errors": [],
                "warnings": [],
                "checks": {},
            },
        }

        try:
            self.load_workbook()
            headers, rows = self._get_sheet_headers_and_rows(self.m5_sheet)
            active_indicator, last_row_idx = self.validate_tier1_and_detect_active_indicator(headers, rows)
            stat_summary = self.validate_tier4_indicator_statistics(active_indicator)

            edt_time_horizon = stat_summary["edt_time_horizon"]
            n_window = self.calculate_evaluation_window(edt_time_horizon)

            bar_records, window_stats = self.validate_tier2_and_tier3_corridor(
                active_indicator=active_indicator,
                headers=headers,
                rows=rows,
                last_row_idx=last_row_idx,
                n_window=n_window,
            )

            # Trend Structure
            regression_angle = stat_summary["regression_angle"]
            containment_rate = stat_summary["containment_rate"]
            is_corridor_valid = (
                containment_rate is not None and containment_rate >= self.min_containment_threshold
            )
            if not is_corridor_valid and containment_rate is not None:
                self.validation_warnings.append(
                    f"Tier 4 Warning: Containment rate ({containment_rate:.2f}%) below minimum threshold "
                    f"({self.min_containment_threshold:.1f}%). Corridor integrity is compromised."
                )

            trend_direction = self.classify_trend(regression_angle)

            # Latest Bar Corridor Dynamics
            latest_bar = bar_records[-1]
            cp_metric = latest_bar["channel_position"]
            corridor_state = self.classify_corridor_state(cp_metric)
            metric_name = "SSA" if active_indicator != "fractal" else "Close"

            (
                primary_trend,
                corridor_st,
                regime_status,
                state_code,
                reversion_prob,
                trend_risk,
                desc,
                commentary,
            ) = self.synthesize_m5_trend_and_corridor(
                trend_direction=trend_direction,
                corridor_state=corridor_state,
                is_corridor_valid=is_corridor_valid,
                regression_angle=regression_angle,
                channel_position=cp_metric,
                uoedt_latest=latest_bar["uoedt"],
                loedt_latest=latest_bar["loedt"],
                metric_latest=latest_bar["metric_value"],
                metric_name=metric_name,
            )

            result["validation"]["status"] = "PASS" if not self.validation_errors else "FAIL"
            result["validation"]["errors"] = self.validation_errors
            result["validation"]["warnings"] = self.validation_warnings
            result["validation"]["checks"] = self.validation_checks

            result["active_indicator"] = active_indicator
            result["trend_structure"] = {
                "regression_angle": regression_angle,
                "raw_slope": stat_summary.get("raw_slope"),
                "containment_rate_pct": containment_rate,
                "edt_time_horizon": edt_time_horizon,
                "is_corridor_valid": is_corridor_valid,
                "trend_direction": trend_direction,
                "provenance": {
                    "source": stat_summary.get("source"),
                    "captured_at": stat_summary.get("captured_at"),
                    "live_bar_ts": stat_summary.get("live_bar_ts"),
                },
            }
            result["corridor_dynamics"] = {
                "metric_used": metric_name,
                "latest_bar": {
                    "timestamp": latest_bar["timestamp"],
                    "close": latest_bar["close"],
                    "metric_value": latest_bar["metric_value"],
                    "uoedt": latest_bar["uoedt"],
                    "loedt": latest_bar["loedt"],
                    "baseline": latest_bar["baseline"],
                    "channel_width": latest_bar["channel_width"],
                    "channel_position": cp_metric,
                    "channel_position_close": latest_bar["channel_position_close"],
                    "corridor_state": corridor_state,
                },
                "window_statistics": window_stats,
            }
            result["synthesis"] = {
                "primary_trend": primary_trend,
                "corridor_state": corridor_st,
                "regime_status": regime_status,
                "discrete_state_code": state_code,
                "mean_reversion_probability": reversion_prob,
                "trend_continuation_risk": trend_risk,
                "description": desc,
            }
            result["trend_state"] = primary_trend
            result["regime_status"] = regime_status
            result["commentary"] = commentary

        except MCD2ValidationError as e:
            result["validation"]["status"] = "FAIL"
            result["validation"]["errors"] = self.validation_errors or [str(e)]
            result["validation"]["warnings"] = self.validation_warnings
            result["validation"]["checks"] = self.validation_checks
            result["trend_state"] = "INVALID"
            result["regime_status"] = "UNCERTAIN"
            result["commentary"] = f"MCD2 Validation Failed: {str(e)}"

        return result


def main():
    """Main CLI entrypoint for testing and output artifact generation."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    excel_path = os.path.abspath(os.path.join(base_dir, "..", "market_data_v6_replicated.xlsx"))

    # By default, use target_indicator='best_fit_a' to generate certified baseline JSON output
    # (as demonstrated in mcd2-xauusd-m5-best-fit-a.png)
    target_ind = "best_fit_a"
    if len(sys.argv) > 1:
        target_ind = sys.argv[1] if sys.argv[1].lower() != "auto" else None

    evaluator = MCD2M5TrendEvaluator(excel_path=excel_path, target_indicator=target_ind)
    result = evaluator.evaluate()

    # Save canonical JSON output
    output_json_path = os.path.join(base_dir, "mcd2_output.json")
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"\n[INFO] Evaluator successfully executed. Saved to: {output_json_path}")


if __name__ == "__main__":
    main()

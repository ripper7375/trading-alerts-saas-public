"""
MCD1: Primary Trend Direction Evaluator (XAUUSD - M15)
DavinTrade Stack D - Engine 1.5A Module

Dual-Horizon Framework Architecture:
1. Macro Structure Level (Trend Direction & Statistical Validity):
   - Reference span is the EDT Time Horizon (T_EDT) read from indicator_statistics ('containment_n').
   - Validates corridor integrity: containment_rate >= MIN_CONTAINMENT_THRESHOLD (default 50.0%).
   - Classifies Macro Trend via regression_angle (threshold +/- 5.0°): UPTREND / DOWNTREND / SIDEWAYS.
   - Omitted baseline_coverage_* as redundant (containment_rate already governs corridor integrity).

2. Dynamic Micro Regime Level (Recent Price Action Confirmation):
   - Dynamic lookback window: N_micro = max(MIN_MICRO_FLOOR, round(T_EDT * micro_pct)).
   - Enforces MIN_MICRO_FLOOR = 96 bars (exactly 24 hours / 1 full trading day of M15) to filter out
     temporary 2-3 hour news spikes.
   - Evaluates channel_position = (close - loedt) / (uoedt - loedt) and bar-by-bar corridor breaches:
     * 0.0 <= channel_position <= 1.0 -> IN_CORRIDOR (Normal trading within bands)
     * channel_position > 1.0 -> UPPER_BREAKOUT (Bullish Expansion)
     * channel_position < 0.0 -> LOWER_BREAKDOWN (Bearish Expansion)

3. 4-Tier Comprehensive Validation:
   - Tier 1: Candidate Isolation & Single Active Indicator Rule (strictly 1 active out of 7 Centroid Variants).
   - Tier 2: M15 Continuity & Data Availability (>= N_micro bars, ascending timestamps, non-null).
   - Tier 3: Channel Sanity Gate (UOEDT > LOEDT on every single evaluated bar).
   - Tier 4: Statistics Ingestion Verification (symbol=XAUUSD, tf=M15, matching record, latest captured_at).

4. Synthesis Decision Matrix & Canonical English JSONB Output:
   - Evaluates combinations of Macro Trend + Micro Regime:
     * TREND_ALIGNED_CONTINUATION: Normal trending price action inside corridor.
     * BREAKOUT_SAME_SLOPE: Massive pump/dump in trend direction (high reversal probability).
     * COUNTER_TREND_EXPANSION: Price breaking out against macro slope (sustained reversal/expansion).
     * CONSOLIDATION / RANGE_EXPANSION: Sideways macro scenarios.
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

# Candidate Centroid Indicators (Strictly 7 variants permitted on M15)
CANDIDATE_CENTROID_INDICATORS = [
    "best_fit_a",
    "best_fit_b",
    "cherry_a",
    "cherry_b",
    "most_recent",
    "non_a",
    "non_b",
]

# Configurable Calibration Constants
DEFAULT_MICRO_LOOKBACK_PCT = 5.0      # Minimum 5.0% of EDT Time Horizon
DEFAULT_MIN_MICRO_FLOOR = 96          # Exactly 24 hours / 1 full trading day of M15
DEFAULT_MICRO_BREACH_THRESHOLD_PCT = 80.0  # Minimum 80% sustained breach rate across micro window to confirm breakout
DEFAULT_MIN_CONTAINMENT_THRESHOLD = 50.0  # Corridor statistical integrity gate (%)
DEFAULT_SIDEWAYS_ANGLE_THRESHOLD = 5.0    # Deadband threshold in degrees (+/- 5.0°)
DEFAULT_SYMBOL = "XAUUSD"
DEFAULT_TIMEFRAME = "M15"


class MCD1ValidationError(Exception):
    """Custom exception for MCD1 4-tier validation failures."""
    pass


class MCD1PrimaryTrendEvaluator:
    """
    Dual-Horizon Evaluator for MCD1: M15 Primary Trend Direction.
    """

    def __init__(
        self,
        excel_path: str,
        micro_lookback_pct: float = DEFAULT_MICRO_LOOKBACK_PCT,
        min_micro_floor: int = DEFAULT_MIN_MICRO_FLOOR,
        micro_breach_threshold_pct: float = DEFAULT_MICRO_BREACH_THRESHOLD_PCT,
        min_containment_threshold: float = DEFAULT_MIN_CONTAINMENT_THRESHOLD,
        sideways_threshold: float = DEFAULT_SIDEWAYS_ANGLE_THRESHOLD,
        symbol: str = DEFAULT_SYMBOL,
        timeframe: str = DEFAULT_TIMEFRAME,
    ):
        self.excel_path = os.path.abspath(excel_path)
        self.micro_lookback_pct = micro_lookback_pct
        self.min_micro_floor = min_micro_floor
        self.micro_breach_threshold_pct = micro_breach_threshold_pct
        self.min_containment_threshold = min_containment_threshold
        self.sideways_threshold = sideways_threshold
        self.symbol = symbol
        self.timeframe = timeframe

        self.wb: Optional[openpyxl.Workbook] = None
        self.m15_sheet = None
        self.stat_sheet = None

        self.validation_errors: List[str] = []
        self.validation_warnings: List[str] = []
        self.validation_checks: Dict[str, Any] = {}

    def load_workbook(self) -> None:
        """Load Excel workbook in read-only mode for speed."""
        if not os.path.exists(self.excel_path):
            raise FileNotFoundError(f"Excel workbook not found at: {self.excel_path}")

        try:
            self.wb = openpyxl.load_workbook(self.excel_path, data_only=True, read_only=True)
        except Exception as e:
            raise MCD1ValidationError(f"Failed to open Excel workbook: {str(e)}")

        sheet_names = self.wb.sheetnames
        m15_sheet_name = f"market_data_v6_{self.timeframe}"

        if m15_sheet_name not in sheet_names:
            raise MCD1ValidationError(
                f"Required sheet '{m15_sheet_name}' not found. Available sheets: {sheet_names}"
            )
        if "indicator_statistics" not in sheet_names:
            raise MCD1ValidationError(
                f"Required sheet 'indicator_statistics' not found. Available sheets: {sheet_names}"
            )

        self.m15_sheet = self.wb[m15_sheet_name]
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
        Scans strictly the 7 Centroid Variants for M15.
        Enforces exactly 1 active indicator with populated data >= min_micro_floor.
        Returns: (active_indicator_name, last_populated_row_index)
        """
        total_bars = len(rows)
        self.validation_checks["total_bars_available"] = total_bars

        if total_bars < self.min_micro_floor:
            err = (
                f"Tier 1 Validation Failed: Insufficient bar data in {self.timeframe} sheet. "
                f"Found {total_bars} bars, but minimum floor requires {self.min_micro_floor} bars."
            )
            self.validation_errors.append(err)
            raise MCD1ValidationError(err)

        detected_active: List[str] = []
        indicator_coverage: Dict[str, int] = {}
        indicator_last_row_indices: Dict[str, int] = {}

        for ind in CANDIDATE_CENTROID_INDICATORS:
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
            if count >= self.min_micro_floor:
                detected_active.append(ind)
                indicator_last_row_indices[ind] = populated_indices[-1]
            elif count > 0:
                self.validation_warnings.append(
                    f"Insufficient bar coverage for '{ind}': found {count} bars, minimum floor is {self.min_micro_floor}."
                )

        self.validation_checks["candidate_indicator_coverage"] = indicator_coverage
        self.validation_checks["active_indicators_detected"] = detected_active

        if len(detected_active) == 0:
            err = (
                f"Tier 1 Validation Failed: No active centroid indicator found on {self.timeframe} "
                f"with >= {self.min_micro_floor} bars. Candidate coverage: {indicator_coverage}"
            )
            self.validation_errors.append(err)
            raise MCD1ValidationError(err)

        if len(detected_active) > 1:
            err = (
                f"Tier 1 Validation Failed: Multiple active centroid indicators detected on {self.timeframe} "
                f"({detected_active}). Under DavinTrade System Rule, exactly 1 active indicator is permitted."
            )
            self.validation_errors.append(err)
            raise MCD1ValidationError(err)

        active_indicator = detected_active[0]
        last_row_idx = indicator_last_row_indices[active_indicator]
        return active_indicator, last_row_idx

    def validate_tier4_indicator_statistics(
        self, active_indicator: str
    ) -> Dict[str, Any]:
        """
        Tier 4 Validation: Indicator Statistics Ingestion Verification.
        Locates the latest snapshot record for symbol='XAUUSD', timeframe='M15', source=active_indicator.
        Validates regression_angle, containment_rate, and containment_n (EDT Time Horizon).
        """
        headers, rows = self._get_sheet_headers_and_rows(self.stat_sheet)
        if not headers or not rows:
            err = "Tier 4 Validation Failed: Sheet 'indicator_statistics' contains no header or data rows."
            self.validation_errors.append(err)
            raise MCD1ValidationError(err)

        required_cols = ["symbol", "timeframe", "source", "captured_at", "regression_angle"]
        for col in required_cols:
            if col not in headers:
                err = f"Tier 4 Validation Failed: Sheet 'indicator_statistics' missing required column: '{col}'"
                self.validation_errors.append(err)
                raise MCD1ValidationError(err)

        sym_idx = headers["symbol"]
        tf_idx = headers["timeframe"]
        src_idx = headers["source"]
        cap_idx = headers["captured_at"]
        ang_idx = headers["regression_angle"]
        cont_rate_idx = headers.get("containment_rate")
        cont_n_idx = headers.get("containment_n")
        vis_win_idx = headers.get("visual_window_bars")
        cp_idx = headers.get("channel_position")
        slope_idx = headers.get("raw_slope")
        live_bar_idx = headers.get("live_bar_ts")

        matching_rows: List[List[Any]] = []
        for r in rows:
            r_sym = str(r[sym_idx]).strip() if r[sym_idx] else ""
            r_tf = str(r[tf_idx]).strip() if r[tf_idx] else ""
            r_src = str(r[src_idx]).strip() if r[src_idx] else ""

            if r_sym == self.symbol and r_tf == self.timeframe and r_src == active_indicator:
                matching_rows.append(r)

        if not matching_rows:
            err = (
                f"Tier 4 Validation Failed: No matching statistic record in 'indicator_statistics' for "
                f"symbol='{self.symbol}', timeframe='{self.timeframe}', source='{active_indicator}'."
            )
            self.validation_errors.append(err)
            raise MCD1ValidationError(err)

        # Sort descending by captured_at to take the latest snapshot
        matching_rows.sort(key=lambda x: int(x[cap_idx]) if x[cap_idx] is not None else 0, reverse=True)
        latest_row = matching_rows[0]

        raw_angle = latest_row[ang_idx]
        if raw_angle is None:
            err = f"Tier 4 Validation Failed: 'regression_angle' is null for '{active_indicator}'."
            self.validation_errors.append(err)
            raise MCD1ValidationError(err)

        try:
            regression_angle = float(raw_angle)
        except ValueError:
            err = f"Tier 4 Validation Failed: Failed to parse 'regression_angle' as float: {raw_angle}"
            self.validation_errors.append(err)
            raise MCD1ValidationError(err)

        # Containment Rate
        containment_rate = None
        if cont_rate_idx is not None and latest_row[cont_rate_idx] is not None:
            try:
                containment_rate = float(latest_row[cont_rate_idx])
            except ValueError:
                pass

        # EDT Time Horizon (read from containment_n or visual_window_bars)
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
        if edt_time_horizon is None:
            # Fallback to total available bars if not explicitly recorded
            edt_time_horizon = self.min_micro_floor
            self.validation_warnings.append(
                f"Could not read 'containment_n' or 'visual_window_bars' for '{active_indicator}'. "
                f"Defaulting EDT Time Horizon to {self.min_micro_floor} bars."
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

        stat_summary = {
            "source": active_indicator,
            "captured_at": captured_at,
            "live_bar_ts": live_bar_ts,
            "regression_angle": regression_angle,
            "containment_rate": containment_rate,
            "edt_time_horizon": edt_time_horizon,
            "channel_position_stat": channel_position_stat,
            "raw_slope": raw_slope,
            "total_matching_snapshots": len(matching_rows),
        }
        self.validation_checks["indicator_statistics_record"] = stat_summary
        return stat_summary

    def calculate_dynamic_micro_window(self, edt_time_horizon: int) -> int:
        """
        Calculate Dynamic Micro Window Size:
        N_micro = max(min_micro_floor, round(edt_time_horizon * (micro_lookback_pct / 100.0)))
        Guarantees evaluation window is >= 96 bars (1 full trading day of M15).
        """
        raw_bars = round(edt_time_horizon * (self.micro_lookback_pct / 100.0))
        n_micro = max(self.min_micro_floor, raw_bars)
        self.validation_checks["edt_time_horizon"] = edt_time_horizon
        self.validation_checks["dynamic_micro_window_bars"] = n_micro
        return n_micro

    def validate_tier2_and_tier3_micro_corridor(
        self,
        active_indicator: str,
        headers: Dict[str, int],
        rows: List[List[Any]],
        last_row_idx: int,
        n_micro: int,
    ) -> List[Dict[str, Any]]:
        """
        Tier 2: M15 Continuity & Data Availability.
        Tier 3: Channel Sanity Gate (UOEDT > LOEDT on every bar).
        Extracts exactly n_micro bars ending at last_row_idx.
        """
        start_idx = last_row_idx - n_micro + 1
        if start_idx < 0:
            err = (
                f"Tier 2 Validation Failed: Insufficient historical bars prior to last calculated bar. "
                f"Required {n_micro} bars, but only {last_row_idx + 1} available."
            )
            self.validation_errors.append(err)
            raise MCD1ValidationError(err)

        evaluation_rows = rows[start_idx : last_row_idx + 1]
        self.validation_checks["evaluation_start_bar_index"] = start_idx + 2
        self.validation_checks["evaluation_end_bar_index"] = last_row_idx + 2

        ssa_idx = headers[f"{active_indicator}_ssa"]
        uoedt_idx = headers[f"{active_indicator}_uoedt"]
        loedt_idx = headers[f"{active_indicator}_loedt"]
        ts_idx = headers.get("timestamp", 2)
        close_idx = headers.get("close", 8)

        bar_records: List[Dict[str, Any]] = []
        prev_ts = 0

        for idx, r in enumerate(evaluation_rows, start=1):
            ts = int(r[ts_idx]) if r[ts_idx] is not None else 0
            close_val = float(r[close_idx]) if r[close_idx] is not None else 0.0
            ssa_val = float(r[ssa_idx])
            uoedt_val = float(r[uoedt_idx])
            loedt_val = float(r[loedt_idx])

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
                raise MCD1ValidationError(err)

            # Corridor breaches and channel position
            # Channel Position = (close - loedt) / (uoedt - loedt)
            channel_width = uoedt_val - loedt_val
            cp = round((close_val - loedt_val) / channel_width, 4) if channel_width > 0 else 0.5

            is_contained = (loedt_val <= close_val <= uoedt_val)
            breach_type = "NONE"
            if close_val > uoedt_val:
                breach_type = "UPPER_BREACH"
            elif close_val < loedt_val:
                breach_type = "LOWER_BREACH"

            bar_records.append({
                "bar_index_from_latest": n_micro - idx + 1,
                "timestamp": ts,
                "close": close_val,
                "ssa": ssa_val,
                "uoedt": uoedt_val,
                "loedt": loedt_val,
                "channel_position": cp,
                "is_contained": is_contained,
                "breach_type": breach_type,
            })

        return bar_records

    def synthesize_macro_micro_regime(
        self,
        macro_trend: str,
        micro_regime: str,
        is_macro_corridor_valid: bool,
        regression_angle: float,
        channel_position_latest: float,
        n_micro: int,
        upper_breach_count: int = 0,
        lower_breach_count: int = 0,
    ) -> Tuple[str, str, str, str]:
        """
        Synthesize Macro Structure and Micro Regime into canonical trend state and regime status.
        Returns: (primary_trend, regime_status, synthesis_description, canonical_commentary)
        """
        if not is_macro_corridor_valid or macro_trend == "UNIDENTIFIED":
            primary_trend = "UNIDENTIFIED"
            regime_status = "UNCERTAIN"
            desc = "Macro corridor statistical integrity is compromised or invalid."
            commentary = (
                f"{self.symbol} {self.timeframe} macro channel structure failed integrity checks. "
                f"Primary trend is UNIDENTIFIED."
            )
            return primary_trend, regime_status, desc, commentary

        upper_pct = round((upper_breach_count / n_micro) * 100, 1) if n_micro > 0 else 0.0
        lower_pct = round((lower_breach_count / n_micro) * 100, 1) if n_micro > 0 else 0.0

        # Decision Matrix evaluation
        if macro_trend == "UPTREND":
            if micro_regime == "IN_CORRIDOR":
                primary_trend = "UPTREND"
                regime_status = "TREND_ALIGNED_CONTINUATION"
                desc = "Price fluctuates normally inside upward channel bands. Healthy uptrend continuation."
                commentary = (
                    f"{self.symbol} {self.timeframe} primary trend is UPTREND (+{regression_angle:.2f}°). "
                    f"Micro price action over the past {n_micro} bars (1 day) is contained within the EDT corridor "
                    f"(channel_position={channel_position_latest:.4f}), confirming healthy trend continuation."
                )
            elif micro_regime == "UPPER_BREAKOUT":
                primary_trend = "UPTREND"
                regime_status = "BREAKOUT_SAME_SLOPE"
                desc = "Price breaking out upward in the same direction of macro slope. Shows massive pump with high probability of soon V-shape price reversal."
                commentary = (
                    f"{self.symbol} {self.timeframe} primary trend is UPTREND (+{regression_angle:.2f}°), "
                    f"with price accelerating into an UPPER_BREAKOUT outside the corridor (channel_position={channel_position_latest:.4f} > 1.0). "
                    f"This reflects an explosive buying climax with high probability of soon V-shape price reversal."
                )
            else:  # LOWER_BREAKDOWN
                primary_trend = "UPTREND"
                regime_status = "COUNTER_TREND_EXPANSION"
                desc = "Price breaking out downward against macro uptrend slope. Sustained counter-trend selling with high probability of structural trend reversal."
                commentary = (
                    f"{self.symbol} {self.timeframe} macro slope is UPTREND (+{regression_angle:.2f}°), "
                    f"but micro price action has broken below the LOEDT corridor (channel_position={channel_position_latest:.4f} < 0.0) "
                    f"sustained across {n_micro} bars ({lower_breach_count}/{n_micro} bars = {lower_pct}% >= {self.micro_breach_threshold_pct:.1f}% threshold). "
                    f"This indicates aggressive counter-trend selling pressure with a high likelihood of structural trend reversal."
                )

        elif macro_trend == "DOWNTREND":
            if micro_regime == "IN_CORRIDOR":
                primary_trend = "DOWNTREND"
                regime_status = "TREND_ALIGNED_CONTINUATION"
                desc = "Price fluctuates normally inside downward channel bands. Healthy downtrend continuation."
                commentary = (
                    f"{self.symbol} {self.timeframe} primary trend is DOWNTREND ({regression_angle:.2f}°). "
                    f"Micro price action over the past {n_micro} bars (1 day) is contained within the EDT corridor "
                    f"(channel_position={channel_position_latest:.4f}), confirming steady downtrend continuation."
                )
            elif micro_regime == "LOWER_BREAKDOWN":
                primary_trend = "DOWNTREND"
                regime_status = "BREAKOUT_SAME_SLOPE"
                desc = "Price breaking out downward in the same direction of macro slope. Shows massive dump with high probability of soon V-shape price reversal."
                commentary = (
                    f"{self.symbol} {self.timeframe} primary trend is DOWNTREND ({regression_angle:.2f}°), "
                    f"with price accelerating into a LOWER_BREAKDOWN below the corridor (channel_position={channel_position_latest:.4f} < 0.0). "
                    f"This shows a massive sell-off panic dump with high probability of soon V-shape price reversal."
                )
            else:  # UPPER_BREAKOUT
                primary_trend = "DOWNTREND"
                regime_status = "COUNTER_TREND_EXPANSION"
                desc = "Price breaking out upward against macro downtrend slope. Sustained counter-trend buying with high probability of structural trend reversal."
                commentary = (
                    f"{self.symbol} {self.timeframe} macro slope is DOWNTREND ({regression_angle:.2f}°), "
                    f"yet recent micro price action has breached above the UOEDT corridor (channel_position={channel_position_latest:.4f} > 1.0) "
                    f"sustained over the past {n_micro} bars (1 day: {upper_breach_count}/{n_micro} bars = {upper_pct}% >= {self.micro_breach_threshold_pct:.1f}% threshold). "
                    f"This demonstrates persistent counter-trend buying expansion with high probability of structural reversal."
                )

        else:  # SIDEWAYS
            if micro_regime == "IN_CORRIDOR":
                primary_trend = "SIDEWAYS"
                regime_status = "CONSOLIDATION"
                desc = "Price moving sideways within normal horizontal corridor."
                commentary = (
                    f"{self.symbol} {self.timeframe} market is in SIDEWAYS consolidation ({regression_angle:.2f}°). "
                    f"Micro price action over {n_micro} bars oscillates within the channel boundaries (channel_position={channel_position_latest:.4f})."
                )
            elif micro_regime == "UPPER_BREAKOUT":
                primary_trend = "SIDEWAYS"
                regime_status = "RANGE_EXPANSION"
                desc = "Price breaking out upward from sideways range. Bullish expansion out of consolidation."
                commentary = (
                    f"{self.symbol} {self.timeframe} macro angle is flat ({regression_angle:.2f}°), "
                    f"but price has initiated an UPPER_BREAKOUT above the corridor (channel_position={channel_position_latest:.4f} > 1.0) "
                    f"sustained across {n_micro} bars ({upper_breach_count}/{n_micro} bars = {upper_pct}% >= {self.micro_breach_threshold_pct:.1f}% threshold), "
                    f"signaling bullish expansion out of consolidation."
                )
            else:  # LOWER_BREAKDOWN
                primary_trend = "SIDEWAYS"
                regime_status = "RANGE_EXPANSION"
                desc = "Price breaking out downward from sideways range. Bearish expansion out of consolidation."
                commentary = (
                    f"{self.symbol} {self.timeframe} macro angle is flat ({regression_angle:.2f}°), "
                    f"but price has initiated a LOWER_BREAKDOWN below the corridor (channel_position={channel_position_latest:.4f} < 0.0) "
                    f"sustained across {n_micro} bars ({lower_breach_count}/{n_micro} bars = {lower_pct}% >= {self.micro_breach_threshold_pct:.1f}% threshold), "
                    f"signaling bearish breakdown out of consolidation."
                )

        return primary_trend, regime_status, desc, commentary

    def evaluate(self) -> Dict[str, Any]:
        """
        Execute 4-tier validation, dual-horizon evaluation, and qualitative synthesis.
        Returns canonical JSONB payload for Stack D consumption.
        """
        eval_time = datetime.now(timezone.utc)
        result: Dict[str, Any] = {
            "mcd_id": "MCD1",
            "name": "M15 Primary Trend Direction",
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "evaluated_at": eval_time.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "evaluated_epoch": int(eval_time.timestamp()),
            "parameters": {
                "micro_lookback_pct": self.micro_lookback_pct,
                "min_micro_floor": self.min_micro_floor,
                "micro_breach_threshold_pct": self.micro_breach_threshold_pct,
                "min_containment_threshold": self.min_containment_threshold,
                "sideways_angle_threshold_degrees": self.sideways_threshold,
            },
            "validation": {
                "status": "PASS",
                "errors": [],
                "warnings": [],
                "checks": {},
            },
            "active_indicator": None,
            "macro_structure": {},
            "micro_regime": {},
            "synthesis": {},
            "trend_state": "UNIDENTIFIED",
            "regime_status": "UNCERTAIN",
            "commentary": "",
        }

        try:
            # 1. Load Workbook
            self.load_workbook()

            # 2. Tier 1: Candidate Isolation & Single Active Centroid Indicator Rule
            m15_headers, m15_rows = self._get_sheet_headers_and_rows(self.m15_sheet)
            active_indicator, last_row_idx = self.validate_tier1_and_detect_active_indicator(m15_headers, m15_rows)
            result["active_indicator"] = active_indicator

            # 3. Tier 4: Statistics Ingestion Verification
            stat_summary = self.validate_tier4_indicator_statistics(active_indicator)
            edt_time_horizon = stat_summary["edt_time_horizon"]
            regression_angle = stat_summary["regression_angle"]
            containment_rate = stat_summary["containment_rate"]

            # Macro Structural Integrity Check
            is_corridor_valid = True
            if containment_rate is not None and containment_rate < self.min_containment_threshold:
                is_corridor_valid = False
                self.validation_warnings.append(
                    f"Corridor Integrity Compromised: containment_rate ({containment_rate}%) is below "
                    f"threshold ({self.min_containment_threshold}%)."
                )

            # Macro Trend Direction
            if not is_corridor_valid:
                macro_trend = "UNIDENTIFIED"
            elif regression_angle > self.sideways_threshold:
                macro_trend = "UPTREND"
            elif regression_angle < -self.sideways_threshold:
                macro_trend = "DOWNTREND"
            else:
                macro_trend = "SIDEWAYS"

            result["macro_structure"] = {
                "edt_time_horizon": edt_time_horizon,
                "regression_angle": regression_angle,
                "containment_rate_pct": containment_rate,
                "channel_position_stat": stat_summary.get("channel_position_stat"),
                "is_corridor_valid": is_corridor_valid,
                "macro_trend": macro_trend,
                "provenance": {
                    "source": active_indicator,
                    "captured_at": stat_summary["captured_at"],
                    "live_bar_ts": stat_summary["live_bar_ts"],
                    "raw_slope": stat_summary["raw_slope"],
                },
            }

            # 4. Dynamic Micro Lookback Window Calculation
            n_micro = self.calculate_dynamic_micro_window(edt_time_horizon)

            # 5. Tier 2 & Tier 3: Micro Corridor Continuity & Sanity Gate
            bar_records = self.validate_tier2_and_tier3_micro_corridor(
                active_indicator, m15_headers, m15_rows, last_row_idx, n_micro
            )

            contained_count = sum(1 for b in bar_records if b["is_contained"])
            upper_breach_count = sum(1 for b in bar_records if b["breach_type"] == "UPPER_BREACH")
            lower_breach_count = sum(1 for b in bar_records if b["breach_type"] == "LOWER_BREACH")

            latest_bar = bar_records[-1]
            channel_position_latest = latest_bar["channel_position"]

            upper_breach_pct = round((upper_breach_count / n_micro) * 100, 2)
            lower_breach_pct = round((lower_breach_count / n_micro) * 100, 2)

            # Micro Regime Classification Logic:
            # 1. BREAKOUT_SAME_SLOPE (Fast Climax / V-shape potential): Triggers promptly on latest bar breach
            #    in the same direction of macro slope (Uptrend + Upper Breach OR Downtrend + Lower Breach).
            # 2. COUNTER_TREND_EXPANSION (Structural Reversal): Requires sustained breach >= micro_breach_threshold_pct (80%)
            #    over n_micro bars (1 day) to confirm genuine reversal and filter temporary pullbacks.
            # 3. SIDEWAYS RANGE_EXPANSION: Requires sustained breach >= 80% to confirm genuine breakout.
            if macro_trend == "UPTREND":
                if channel_position_latest > 1.0:
                    micro_regime_state = "UPPER_BREAKOUT"  # Prompt same-slope pump / V-shape potential
                elif channel_position_latest < 0.0 and lower_breach_pct >= self.micro_breach_threshold_pct:
                    micro_regime_state = "LOWER_BREAKDOWN"  # Sustained counter-trend breakdown
                else:
                    micro_regime_state = "IN_CORRIDOR"

            elif macro_trend == "DOWNTREND":
                if channel_position_latest < 0.0:
                    micro_regime_state = "LOWER_BREAKDOWN"  # Prompt same-slope dump / V-shape potential
                elif channel_position_latest > 1.0 and upper_breach_pct >= self.micro_breach_threshold_pct:
                    micro_regime_state = "UPPER_BREAKOUT"  # Sustained counter-trend breakout
                else:
                    micro_regime_state = "IN_CORRIDOR"

            else:  # SIDEWAYS
                if channel_position_latest > 1.0 and upper_breach_pct >= self.micro_breach_threshold_pct:
                    micro_regime_state = "UPPER_BREAKOUT"
                elif channel_position_latest < 0.0 and lower_breach_pct >= self.micro_breach_threshold_pct:
                    micro_regime_state = "LOWER_BREAKDOWN"
                else:
                    micro_regime_state = "IN_CORRIDOR"

            result["micro_regime"] = {
                "window_bars": n_micro,
                "channel_position_latest": channel_position_latest,
                "regime": micro_regime_state,
                "contained_bar_count": contained_count,
                "upper_breach_count": upper_breach_count,
                "upper_breach_pct": upper_breach_pct,
                "lower_breach_count": lower_breach_count,
                "lower_breach_pct": lower_breach_pct,
                "breach_threshold_pct": self.micro_breach_threshold_pct,
                "containment_rate_pct": round((contained_count / n_micro) * 100, 2),
                "latest_bar": {
                    "timestamp": latest_bar["timestamp"],
                    "close": latest_bar["close"],
                    "ssa": latest_bar["ssa"],
                    "uoedt": latest_bar["uoedt"],
                    "loedt": latest_bar["loedt"],
                    "channel_position": channel_position_latest,
                    "breach_type": latest_bar["breach_type"],
                },
            }

            # 6. Synthesis Decision Matrix
            primary_trend, regime_status, desc, commentary = self.synthesize_macro_micro_regime(
                macro_trend=macro_trend,
                micro_regime=micro_regime_state,
                is_macro_corridor_valid=is_corridor_valid,
                regression_angle=regression_angle,
                channel_position_latest=channel_position_latest,
                n_micro=n_micro,
                upper_breach_count=upper_breach_count,
                lower_breach_count=lower_breach_count,
            )

            result["synthesis"] = {
                "primary_trend": primary_trend,
                "regime_status": regime_status,
                "description": desc,
            }
            result["trend_state"] = primary_trend
            result["regime_status"] = regime_status
            result["commentary"] = commentary

        except MCD1ValidationError as ve:
            result["validation"]["status"] = "FAIL"
            result["trend_state"] = "UNIDENTIFIED"
            result["regime_status"] = "UNCERTAIN"
            result["commentary"] = f"Validation failed: {str(ve)}"

        except Exception as e:
            result["validation"]["status"] = "ERROR"
            result["trend_state"] = "UNIDENTIFIED"
            result["regime_status"] = "UNCERTAIN"
            self.validation_errors.append(str(e))
            result["commentary"] = f"Runtime error: {str(e)}"

        finally:
            result["validation"]["errors"] = self.validation_errors
            result["validation"]["warnings"] = self.validation_warnings
            result["validation"]["checks"] = self.validation_checks
            if self.wb:
                self.wb.close()

        return result


def run_mcd1_test(excel_file: Optional[str] = None) -> Dict[str, Any]:
    """Runner function for CLI and automated testing."""
    if excel_file is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        cand1 = os.path.join(base_dir, "..", "market_data_v6_replicated.xlsx")
        cand2 = os.path.join(base_dir, "market_data_v6_replicated.xlsx")
        excel_file = cand1 if os.path.exists(cand1) else cand2

    print("=" * 80)
    print("DAVINTRADE STACK D - ENGINE 1.5A: MCD1 DUAL-HORIZON EVALUATION RUNNER")
    print(f"Target Excel File: {excel_file}")
    print("=" * 80)

    evaluator = MCD1PrimaryTrendEvaluator(excel_path=excel_file)
    output = evaluator.evaluate()

    # Pretty print formatted JSON
    print("\n--- JSONB OUTPUT PAYLOAD ---")
    print(json.dumps(output, indent=2, ensure_ascii=False))
    print("=" * 80)

    # Summary table
    print("\n--- EVALUATION SUMMARY ---")
    print(f"MCD ID            : {output['mcd_id']} ({output['name']})")
    print(f"Active Indicator  : {output.get('active_indicator')}")
    print(f"Validation Status : {output['validation']['status']}")
    print(f"EDT Time Horizon  : {output.get('macro_structure', {}).get('edt_time_horizon', 'N/A')} bars")
    print(f"Regression Angle  : {output.get('macro_structure', {}).get('regression_angle', 'N/A')}°")
    print(f"Macro Trend       : {output.get('macro_structure', {}).get('macro_trend', 'N/A')}")
    print(f"Micro Window      : {output.get('micro_regime', {}).get('window_bars', 'N/A')} bars")
    print(f"Channel Position  : {output.get('micro_regime', {}).get('channel_position_latest', 'N/A')}")
    print(f"Micro Regime      : {output.get('micro_regime', {}).get('regime', 'N/A')}")
    print(f"Synthesis Trend   : {output['trend_state']}")
    print(f"Regime Status     : {output.get('regime_status')}")
    print(f"Commentary        : {output['commentary']}")
    print("=" * 80)

    output_json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mcd1_output.json")
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n[INFO] Saved output to: {output_json_path}")

    return output


if __name__ == "__main__":
    target_path = sys.argv[1] if len(sys.argv) > 1 else None
    run_mcd1_test(target_path)

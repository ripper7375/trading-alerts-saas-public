"""
Unit Tests for MCD2: M5 Defined Trend and Breakout Implication Evaluator
Tests all 4 validation tiers, M5 trend classifications, corridor deviation dynamics,
and the complete 9-state discrete synthesis matrix.
"""

import os
import sys
import unittest

# Ensure UTF-8 output on Windows console
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

from mcd2_evaluator import (
    MCD2M5TrendEvaluator,
    MCD2ValidationError,
    DEFAULT_SIDEWAYS_ANGLE_THRESHOLD,
    DEFAULT_MIN_CONTAINMENT_THRESHOLD,
    DEFAULT_MIN_WINDOW_FLOOR,
    DEFAULT_MAX_WINDOW_BARS,
)


class TestMCD2M5TrendLogic(unittest.TestCase):
    """Comprehensive test suite for MCD2 Evaluator."""

    @classmethod
    def setUpClass(cls):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        cls.excel_path = os.path.abspath(os.path.join(base_dir, "..", "market_data_v6_replicated.xlsx"))

    def test_01_real_data_execution_best_fit_a(self):
        """Test real data execution with best_fit_a on market_data_v6_M5."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path, target_indicator="best_fit_a")
        res = evaluator.evaluate()

        self.assertEqual(res["mcd_id"], "MCD2")
        self.assertEqual(res["timeframe"], "M5")
        self.assertEqual(res["validation"]["status"], "PASS")
        self.assertEqual(res["active_indicator"], "best_fit_a")

        # Trend Structure checks
        trend = res["trend_structure"]
        self.assertEqual(trend["trend_direction"], "UPTREND")
        self.assertEqual(trend["regression_angle"], 6.94)
        self.assertEqual(trend["raw_slope"], 0.05268)
        self.assertEqual(trend["containment_rate_pct"], 55.76)
        self.assertEqual(trend["edt_time_horizon"], 755)
        self.assertTrue(trend["is_corridor_valid"])
        self.assertEqual(trend["provenance"]["source"], "best_fit_a")

        # Corridor Dynamics checks (SSA-based for centroids)
        corridor = res["corridor_dynamics"]
        self.assertEqual(corridor["metric_used"], "SSA")
        latest = corridor["latest_bar"]
        self.assertAlmostEqual(latest["close"], 4377.99, places=2)
        self.assertAlmostEqual(latest["metric_value"], 4377.3285, places=3)
        self.assertAlmostEqual(latest["uoedt"], 4384.2806, places=3)
        self.assertAlmostEqual(latest["loedt"], 4350.2161, places=3)
        self.assertAlmostEqual(latest["channel_position"], 0.7959, places=3)
        self.assertEqual(latest["corridor_state"], "IN_CORRIDOR")

        # Synthesis checks
        synthesis = res["synthesis"]
        self.assertEqual(synthesis["primary_trend"], "UPTREND")
        self.assertEqual(synthesis["corridor_state"], "IN_CORRIDOR")
        self.assertEqual(synthesis["regime_status"], "TREND_ALIGNED_CONTINUATION")
        self.assertEqual(synthesis["discrete_state_code"], "MCD2_UP_IN_CORRIDOR")
        self.assertEqual(synthesis["mean_reversion_probability"], "LOW")
        self.assertEqual(synthesis["trend_continuation_risk"], "LOW")

        self.assertEqual(res["trend_state"], "UPTREND")
        self.assertEqual(res["regime_status"], "TREND_ALIGNED_CONTINUATION")
        self.assertIn("XAUUSD M5 trend is UPTREND (+6.94°)", res["commentary"])
        self.assertIn("channel_position=0.7959", res["commentary"])

    def test_02_real_data_execution_fractal(self):
        """Test real data execution with fractal on market_data_v6_M5."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path, target_indicator="fractal")
        res = evaluator.evaluate()

        self.assertEqual(res["mcd_id"], "MCD2")
        self.assertEqual(res["timeframe"], "M5")
        self.assertEqual(res["validation"]["status"], "PASS")
        self.assertEqual(res["active_indicator"], "fractal")

        # Trend Structure checks (source maps to fractal_edt in statistics)
        trend = res["trend_structure"]
        self.assertEqual(trend["trend_direction"], "UPTREND")
        self.assertEqual(trend["regression_angle"], 10.61)
        self.assertEqual(trend["raw_slope"], 0.08177852)
        self.assertEqual(trend["containment_rate_pct"], 64.88)
        self.assertEqual(trend["edt_time_horizon"], 336)
        self.assertTrue(trend["is_corridor_valid"])
        self.assertEqual(trend["provenance"]["source"], "fractal_edt")

        # Corridor Dynamics checks (Close-based for fractal)
        corridor = res["corridor_dynamics"]
        self.assertEqual(corridor["metric_used"], "Close")
        latest = corridor["latest_bar"]
        self.assertEqual(latest["metric_value"], latest["close"])
        self.assertAlmostEqual(latest["uoedt"], 4412.5953, places=3)
        self.assertAlmostEqual(latest["loedt"], 4374.3168, places=3)
        self.assertAlmostEqual(latest["channel_position"], 0.096, places=3)
        self.assertEqual(latest["corridor_state"], "IN_CORRIDOR")

        # Synthesis checks
        synthesis = res["synthesis"]
        self.assertEqual(synthesis["primary_trend"], "UPTREND")
        self.assertEqual(synthesis["corridor_state"], "IN_CORRIDOR")
        self.assertEqual(synthesis["regime_status"], "TREND_ALIGNED_CONTINUATION")
        self.assertEqual(synthesis["discrete_state_code"], "MCD2_UP_IN_CORRIDOR")
        self.assertIn("Close safely within the EDT corridor", res["commentary"])

    def test_03_synthetic_uptrend_in_corridor(self):
        """Test synthesis: UPTREND + IN_CORRIDOR -> TREND_ALIGNED_CONTINUATION."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)
        (
            primary,
            corr_st,
            regime,
            code,
            rev_prob,
            risk,
            desc,
            comm,
        ) = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="UPTREND",
            corridor_state="IN_CORRIDOR",
            is_corridor_valid=True,
            regression_angle=7.5,
            channel_position=0.65,
            uoedt_latest=4400.0,
            loedt_latest=4360.0,
            metric_latest=4386.0,
            metric_name="SSA",
        )
        self.assertEqual(primary, "UPTREND")
        self.assertEqual(corr_st, "IN_CORRIDOR")
        self.assertEqual(regime, "TREND_ALIGNED_CONTINUATION")
        self.assertEqual(code, "MCD2_UP_IN_CORRIDOR")
        self.assertEqual(rev_prob, "LOW")
        self.assertEqual(risk, "LOW")
        self.assertIn("Healthy uptrend continuation", desc)
        self.assertIn("safely within the EDT corridor", comm)

    def test_04_synthetic_uptrend_upper_overextension(self):
        """Test synthesis: UPTREND + UPPER_BREAKOUT -> UPPER_OVEREXTENSION_REVERSION."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)
        (
            primary,
            corr_st,
            regime,
            code,
            rev_prob,
            risk,
            desc,
            comm,
        ) = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="UPTREND",
            corridor_state="UPPER_BREAKOUT",
            is_corridor_valid=True,
            regression_angle=8.2,
            channel_position=1.25,
            uoedt_latest=4400.0,
            loedt_latest=4360.0,
            metric_latest=4410.0,
            metric_name="SSA",
        )
        self.assertEqual(primary, "UPTREND")
        self.assertEqual(corr_st, "UPPER_BREAKOUT")
        self.assertEqual(regime, "UPPER_OVEREXTENSION_REVERSION")
        self.assertEqual(code, "MCD2_UP_UPPER_BREAKOUT")
        self.assertEqual(rev_prob, "HIGH")
        self.assertEqual(risk, "LOW")
        self.assertIn("Abnormal bullish deviation", desc)
        self.assertIn("high probability of Mean Reversion back into the corridor", comm)
        self.assertIn("low risk of disrupting the underlying M5 bullish trend", comm)

    def test_05_synthetic_uptrend_dip_value_opportunity(self):
        """Test synthesis: UPTREND + LOWER_BREAKDOWN -> DIP_VALUE_BUY_OPPORTUNITY."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)
        (
            primary,
            corr_st,
            regime,
            code,
            rev_prob,
            risk,
            desc,
            comm,
        ) = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="UPTREND",
            corridor_state="LOWER_BREAKDOWN",
            is_corridor_valid=True,
            regression_angle=6.4,
            channel_position=-0.20,
            uoedt_latest=4400.0,
            loedt_latest=4360.0,
            metric_latest=4352.0,
            metric_name="SSA",
        )
        self.assertEqual(primary, "UPTREND")
        self.assertEqual(corr_st, "LOWER_BREAKDOWN")
        self.assertEqual(regime, "DIP_VALUE_BUY_OPPORTUNITY")
        self.assertEqual(code, "MCD2_UP_LOWER_BREAKDOWN")
        self.assertEqual(rev_prob, "HIGH")
        self.assertEqual(risk, "LOW")
        self.assertIn("prime buy-the-dip opportunity", desc)
        self.assertIn("prime mean-reversion buying opportunity", comm)

    def test_06_synthetic_downtrend_in_corridor(self):
        """Test synthesis: DOWNTREND + IN_CORRIDOR -> TREND_ALIGNED_CONTINUATION."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)
        (
            primary,
            corr_st,
            regime,
            code,
            rev_prob,
            risk,
            desc,
            comm,
        ) = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="DOWNTREND",
            corridor_state="IN_CORRIDOR",
            is_corridor_valid=True,
            regression_angle=-12.5,
            channel_position=0.35,
            uoedt_latest=4380.0,
            loedt_latest=4340.0,
            metric_latest=4354.0,
            metric_name="SSA",
        )
        self.assertEqual(primary, "DOWNTREND")
        self.assertEqual(corr_st, "IN_CORRIDOR")
        self.assertEqual(regime, "TREND_ALIGNED_CONTINUATION")
        self.assertEqual(code, "MCD2_DOWN_IN_CORRIDOR")
        self.assertEqual(rev_prob, "LOW")
        self.assertEqual(risk, "LOW")
        self.assertIn("Orderly downtrend continuation", desc)

    def test_07_synthetic_downtrend_lower_overextension(self):
        """Test synthesis: DOWNTREND + LOWER_BREAKDOWN -> LOWER_OVEREXTENSION_REVERSION."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)
        (
            primary,
            corr_st,
            regime,
            code,
            rev_prob,
            risk,
            desc,
            comm,
        ) = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="DOWNTREND",
            corridor_state="LOWER_BREAKDOWN",
            is_corridor_valid=True,
            regression_angle=-9.8,
            channel_position=-0.15,
            uoedt_latest=4380.0,
            loedt_latest=4340.0,
            metric_latest=4334.0,
            metric_name="SSA",
        )
        self.assertEqual(primary, "DOWNTREND")
        self.assertEqual(corr_st, "LOWER_BREAKDOWN")
        self.assertEqual(regime, "LOWER_OVEREXTENSION_REVERSION")
        self.assertEqual(code, "MCD2_DOWN_LOWER_BREAKDOWN")
        self.assertEqual(rev_prob, "HIGH")
        self.assertEqual(risk, "LOW")
        self.assertIn("Abnormal bearish deviation below LOEDT", desc)
        self.assertIn("high probability of upward Mean Reversion back into the corridor", comm)

    def test_08_synthetic_downtrend_rally_short_opportunity(self):
        """Test synthesis: DOWNTREND + UPPER_BREAKOUT -> RALLY_VALUE_SELL_OPPORTUNITY."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)
        (
            primary,
            corr_st,
            regime,
            code,
            rev_prob,
            risk,
            desc,
            comm,
        ) = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="DOWNTREND",
            corridor_state="UPPER_BREAKOUT",
            is_corridor_valid=True,
            regression_angle=-11.0,
            channel_position=1.15,
            uoedt_latest=4380.0,
            loedt_latest=4340.0,
            metric_latest=4386.0,
            metric_name="SSA",
        )
        self.assertEqual(primary, "DOWNTREND")
        self.assertEqual(corr_st, "UPPER_BREAKOUT")
        self.assertEqual(regime, "RALLY_VALUE_SELL_OPPORTUNITY")
        self.assertEqual(code, "MCD2_DOWN_UPPER_BREAKOUT")
        self.assertEqual(rev_prob, "HIGH")
        self.assertEqual(risk, "LOW")
        self.assertIn("prime sell-the-rally opportunity", desc)
        self.assertIn("prime mean-reversion selling opportunity", comm)

    def test_09_synthetic_sideways_states(self):
        """Test synthesis: SIDEWAYS across all 3 corridor states."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)

        # 1. IN_CORRIDOR
        p1, c1, r1, code1, rev1, rk1, d1, comm1 = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="SIDEWAYS",
            corridor_state="IN_CORRIDOR",
            is_corridor_valid=True,
            regression_angle=2.1,
            channel_position=0.50,
            uoedt_latest=4380.0,
            loedt_latest=4340.0,
            metric_latest=4360.0,
            metric_name="SSA",
        )
        self.assertEqual(r1, "RANGE_EQUILIBRIUM")
        self.assertEqual(code1, "MCD2_SIDEWAYS_IN_CORRIDOR")
        self.assertEqual(rev1, "LOW")

        # 2. UPPER_BREAKOUT
        p2, c2, r2, code2, rev2, rk2, d2, comm2 = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="SIDEWAYS",
            corridor_state="UPPER_BREAKOUT",
            is_corridor_valid=True,
            regression_angle=-1.5,
            channel_position=1.30,
            uoedt_latest=4380.0,
            loedt_latest=4340.0,
            metric_latest=4392.0,
            metric_name="SSA",
        )
        self.assertEqual(r2, "RANGE_RESISTANCE_REVERSION")
        self.assertEqual(code2, "MCD2_SIDEWAYS_UPPER_BREAKOUT")
        self.assertEqual(rev2, "HIGH")

        # 3. LOWER_BREAKDOWN
        p3, c3, r3, code3, rev3, rk3, d3, comm3 = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="SIDEWAYS",
            corridor_state="LOWER_BREAKDOWN",
            is_corridor_valid=True,
            regression_angle=0.0,
            channel_position=-0.25,
            uoedt_latest=4380.0,
            loedt_latest=4340.0,
            metric_latest=4330.0,
            metric_name="SSA",
        )
        self.assertEqual(r3, "RANGE_SUPPORT_REVERSION")
        self.assertEqual(code3, "MCD2_SIDEWAYS_LOWER_BREAKDOWN")
        self.assertEqual(rev3, "HIGH")

    def test_10_tier1_strict_production_multi_indicator_failure(self):
        """Test Tier 1: Real-world strict check when multiple indicators exist in mockup workbook without override."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path, target_indicator=None)
        res = evaluator.evaluate()

        # Both best_fit_a and fractal are backfilled in market_data_v6_replicated.xlsx
        self.assertEqual(res["validation"]["status"], "FAIL")
        self.assertEqual(res["trend_state"], "INVALID")
        self.assertEqual(res["regime_status"], "UNCERTAIN")
        self.assertIn("Multiple active EDT indicators detected on M5", res["validation"]["errors"][0])
        self.assertIn("exactly 1 active indicator is permitted", res["commentary"])

    def test_11_tier1_zero_active_indicator_error(self):
        """Test Tier 1: Zero active indicators raises MCD2ValidationError."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)
        empty_headers = {"timestamp": 0, "close": 1}
        empty_rows = [[1789764900, 4377.99] for _ in range(100)]

        with self.assertRaises(MCD2ValidationError) as ctx:
            evaluator.validate_tier1_and_detect_active_indicator(empty_headers, empty_rows)
        self.assertIn("No active EDT indicator found", str(ctx.exception))

    def test_12_tier3_corrupt_channel_error(self):
        """Test Tier 3: Corrupt channel geometry (UOEDT <= LOEDT) raises MCD2ValidationError."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)
        headers = {
            "timestamp": 0,
            "close": 1,
            "best_fit_a_ssa": 2,
            "best_fit_a_uoedt": 3,
            "best_fit_a_loedt": 4,
            "best_fit_a_base_fl": 5,
        }
        # Inverted channel: UOEDT (4300.0) < LOEDT (4400.0)
        corrupt_rows = [
            [1789760000 + i * 300, 4350.0, 4350.0, 4300.0, 4400.0, 4350.0]
            for i in range(50)
        ]
        with self.assertRaises(MCD2ValidationError) as ctx:
            evaluator.validate_tier2_and_tier3_corridor(
                active_indicator="best_fit_a",
                headers=headers,
                rows=corrupt_rows,
                last_row_idx=49,
                n_window=50,
            )
        self.assertIn("Tier 3 Validation Failed: Corrupt Channel Boundary", str(ctx.exception))

    def test_13_tier4_missing_stat_record_and_compromised_corridor(self):
        """Test Tier 4: Missing stat record raises MCD2ValidationError and low CR marks corridor invalid."""
        evaluator = MCD2M5TrendEvaluator(excel_path=self.excel_path)

        # Missing indicator query
        evaluator.load_workbook()
        with self.assertRaises(MCD2ValidationError) as ctx:
            evaluator.validate_tier4_indicator_statistics(active_indicator="non_existent_indicator")
        self.assertIn("No matching statistic record", str(ctx.exception))

        # Compromised corridor synthesis (containment rate < 50%)
        primary, corr_st, regime, code, rev_prob, risk, desc, comm = evaluator.synthesize_m5_trend_and_corridor(
            trend_direction="UPTREND",
            corridor_state="IN_CORRIDOR",
            is_corridor_valid=False,  # Compromised!
            regression_angle=7.0,
            channel_position=0.5,
            uoedt_latest=4400.0,
            loedt_latest=4350.0,
            metric_latest=4375.0,
            metric_name="SSA",
        )
        self.assertEqual(primary, "UNIDENTIFIED")
        self.assertEqual(regime, "UNCERTAIN")
        self.assertEqual(code, "MCD2_UNIDENTIFIED")
        self.assertEqual(risk, "HIGH")
        self.assertIn("failed statistical integrity checks", desc)


if __name__ == "__main__":
    unittest.main()

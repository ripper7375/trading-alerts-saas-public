"""
Unit Tests for MCD1: Primary Trend Direction Evaluator (Dual-Horizon Framework)
Tests all 4 validation tiers, dynamic micro window calculations, and synthesis decision matrix.
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

from mcd1_evaluator import (
    MCD1PrimaryTrendEvaluator,
    MCD1ValidationError,
    DEFAULT_MICRO_LOOKBACK_PCT,
    DEFAULT_MIN_MICRO_FLOOR,
    DEFAULT_MIN_CONTAINMENT_THRESHOLD,
    DEFAULT_SIDEWAYS_ANGLE_THRESHOLD,
)


class TestMCD1DualHorizonLogic(unittest.TestCase):
    """Comprehensive test suite for MCD1 Dual-Horizon Evaluator."""

    @classmethod
    def setUpClass(cls):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        cls.excel_path = os.path.abspath(os.path.join(base_dir, "..", "market_data_v6_replicated.xlsx"))

    def test_01_real_data_execution_counter_trend_expansion(self):
        """Test against real market_data_v6_replicated.xlsx: non_b Macro Downtrend + 96-bar Upper Breakout."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)
        res = evaluator.evaluate()

        self.assertEqual(res["mcd_id"], "MCD1")
        self.assertEqual(res["validation"]["status"], "PASS")
        self.assertEqual(res["active_indicator"], "non_b")

        # Macro Structure checks
        macro = res["macro_structure"]
        self.assertEqual(macro["edt_time_horizon"], 1808)
        self.assertEqual(macro["regression_angle"], -29.72)
        self.assertEqual(macro["containment_rate_pct"], 73.95)
        self.assertEqual(macro["macro_trend"], "DOWNTREND")
        self.assertTrue(macro["is_corridor_valid"])

        # Micro Regime checks
        micro = res["micro_regime"]
        self.assertEqual(micro["window_bars"], 96)
        self.assertEqual(micro["regime"], "UPPER_BREAKOUT")
        self.assertEqual(micro["upper_breach_count"], 96)
        self.assertEqual(micro["contained_bar_count"], 0)
        self.assertGreater(micro["channel_position_latest"], 1.0)

        # Synthesis checks
        synthesis = res["synthesis"]
        self.assertEqual(synthesis["primary_trend"], "DOWNTREND")
        self.assertEqual(synthesis["regime_status"], "COUNTER_TREND_EXPANSION")
        self.assertEqual(res["trend_state"], "DOWNTREND")
        self.assertEqual(res["regime_status"], "COUNTER_TREND_EXPANSION")
        self.assertIn("COUNTER_TREND_EXPANSION", res["regime_status"])
        self.assertIn("persistent counter-trend buying expansion", res["commentary"])

    def test_02_dynamic_micro_window_floor_and_percentage(self):
        """Test formula N_micro = max(96, round(T_edt * 0.05))."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)

        # Case 1: T_edt = 1808 -> 1808 * 0.05 = 90.4 -> round=90 -> max(96, 90) = 96
        self.assertEqual(evaluator.calculate_dynamic_micro_window(1808), 96)

        # Case 2: T_edt = 545 -> 545 * 0.05 = 27.25 -> round=27 -> max(96, 27) = 96 (floor enforced)
        self.assertEqual(evaluator.calculate_dynamic_micro_window(545), 96)

        # Case 3: T_edt = 3000 -> 3000 * 0.05 = 150 -> max(96, 150) = 150
        self.assertEqual(evaluator.calculate_dynamic_micro_window(3000), 150)

        # Case 4: Custom micro percentage 10.0% -> 1808 * 0.10 = 180.8 -> round=181 -> max(96, 181) = 181
        evaluator_custom = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path, micro_lookback_pct=10.0)
        self.assertEqual(evaluator_custom.calculate_dynamic_micro_window(1808), 181)

    def test_03_synthetic_trend_aligned_continuation_uptrend(self):
        """Test synthesis: Macro UPTREND + Micro IN_CORRIDOR -> TREND_ALIGNED_CONTINUATION."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)
        primary, regime, desc, comm = evaluator.synthesize_macro_micro_regime(
            macro_trend="UPTREND",
            micro_regime="IN_CORRIDOR",
            is_macro_corridor_valid=True,
            regression_angle=15.4,
            channel_position_latest=0.65,
            n_micro=96,
        )
        self.assertEqual(primary, "UPTREND")
        self.assertEqual(regime, "TREND_ALIGNED_CONTINUATION")
        self.assertIn("Healthy uptrend continuation", desc)
        self.assertIn("confirming healthy trend continuation", comm)

    def test_04_synthetic_breakout_same_slope_massive_dump(self):
        """Test synthesis: Macro DOWNTREND + Micro LOWER_BREAKDOWN -> BREAKOUT_SAME_SLOPE (massive dump)."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)
        primary, regime, desc, comm = evaluator.synthesize_macro_micro_regime(
            macro_trend="DOWNTREND",
            micro_regime="LOWER_BREAKDOWN",
            is_macro_corridor_valid=True,
            regression_angle=-18.2,
            channel_position_latest=-0.25,
            n_micro=96,
        )
        self.assertEqual(primary, "DOWNTREND")
        self.assertEqual(regime, "BREAKOUT_SAME_SLOPE")
        self.assertIn("massive dump with high probability of soon V-shape price reversal", desc)
        self.assertIn("massive sell-off panic dump", comm)

    def test_05_synthetic_breakout_same_slope_massive_pump(self):
        """Test synthesis: Macro UPTREND + Micro UPPER_BREAKOUT -> BREAKOUT_SAME_SLOPE (massive pump)."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)
        primary, regime, desc, comm = evaluator.synthesize_macro_micro_regime(
            macro_trend="UPTREND",
            micro_regime="UPPER_BREAKOUT",
            is_macro_corridor_valid=True,
            regression_angle=22.5,
            channel_position_latest=1.45,
            n_micro=96,
        )
        self.assertEqual(primary, "UPTREND")
        self.assertEqual(regime, "BREAKOUT_SAME_SLOPE")
        self.assertIn("massive pump with high probability of soon V-shape price reversal", desc)
        self.assertIn("explosive buying climax", comm)

    def test_06_synthetic_counter_trend_expansion_uptrend(self):
        """Test synthesis: Macro UPTREND + Micro LOWER_BREAKDOWN -> COUNTER_TREND_EXPANSION."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)
        primary, regime, desc, comm = evaluator.synthesize_macro_micro_regime(
            macro_trend="UPTREND",
            micro_regime="LOWER_BREAKDOWN",
            is_macro_corridor_valid=True,
            regression_angle=12.0,
            channel_position_latest=-0.15,
            n_micro=96,
        )
        self.assertEqual(primary, "UPTREND")
        self.assertEqual(regime, "COUNTER_TREND_EXPANSION")
        self.assertIn("counter-trend selling with high probability of structural trend reversal", desc)

    def test_07_synthetic_sideways_consolidation_and_expansion(self):
        """Test synthesis: Macro SIDEWAYS with IN_CORRIDOR and UPPER_BREAKOUT."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)

        # In Corridor -> CONSOLIDATION
        p1, r1, d1, _ = evaluator.synthesize_macro_micro_regime(
            "SIDEWAYS", "IN_CORRIDOR", True, 1.2, 0.5, 96
        )
        self.assertEqual(p1, "SIDEWAYS")
        self.assertEqual(r1, "CONSOLIDATION")

        # Upper Breakout -> RANGE_EXPANSION
        p2, r2, d2, _ = evaluator.synthesize_macro_micro_regime(
            "SIDEWAYS", "UPPER_BREAKOUT", True, -2.1, 1.3, 96
        )
        self.assertEqual(p2, "SIDEWAYS")
        self.assertEqual(r2, "RANGE_EXPANSION")
        self.assertIn("Bullish expansion out of consolidation", d2)

    def test_08_tier1_validation_multiple_active_indicators(self):
        """Tier 1: Fail if multiple active indicators exist in 7 Centroid pool."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)
        evaluator.load_workbook = lambda: None
        evaluator._get_sheet_headers_and_rows = lambda s: ({}, [])

        def mock_detect(h, r):
            evaluator.validation_errors.append("Multiple active indicators")
            raise MCD1ValidationError("Tier 1 Validation Failed: Multiple active centroid indicators detected on M15")

        evaluator.validate_tier1_and_detect_active_indicator = mock_detect
        res = evaluator.evaluate()

        self.assertEqual(res["validation"]["status"], "FAIL")
        self.assertEqual(res["trend_state"], "UNIDENTIFIED")
        self.assertIn("Tier 1 Validation Failed", res["commentary"])

    def test_09_tier1_validation_no_active_indicator(self):
        """Tier 1: Fail if 0 active indicators exist in 7 Centroid pool."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)
        evaluator.load_workbook = lambda: None
        evaluator._get_sheet_headers_and_rows = lambda s: ({}, [])

        def mock_detect(h, r):
            evaluator.validation_errors.append("No active indicator")
            raise MCD1ValidationError("Tier 1 Validation Failed: No active centroid indicator found on M15 with >= 96 bars.")

        evaluator.validate_tier1_and_detect_active_indicator = mock_detect
        res = evaluator.evaluate()

        self.assertEqual(res["validation"]["status"], "FAIL")
        self.assertEqual(res["trend_state"], "UNIDENTIFIED")
        self.assertIn("Tier 1 Validation Failed", res["commentary"])

    def test_10_tier3_validation_corrupt_channel_boundaries(self):
        """Tier 3: Fail if UOEDT <= LOEDT on any evaluated bar."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path)
        evaluator.load_workbook = lambda: None
        evaluator._get_sheet_headers_and_rows = lambda s: ({}, [])
        evaluator.validate_tier1_and_detect_active_indicator = lambda h, r: ("non_b", 3000)
        evaluator.validate_tier4_indicator_statistics = lambda a: {
            "source": "non_b", "captured_at": 1789764900, "live_bar_ts": 1789764300,
            "regression_angle": -29.72, "containment_rate": 73.95, "edt_time_horizon": 1808,
            "channel_position_stat": 1.6447, "raw_slope": -0.25, "total_matching_snapshots": 1,
        }

        def mock_micro(a, h, r, l, n):
            raise MCD1ValidationError("Tier 3 Validation Failed: Corrupt Channel Boundary: UOEDT (4100.0) <= LOEDT (4200.0).")

        evaluator.validate_tier2_and_tier3_micro_corridor = mock_micro
        res = evaluator.evaluate()

        self.assertEqual(res["validation"]["status"], "FAIL")
        self.assertEqual(res["trend_state"], "UNIDENTIFIED")
        self.assertIn("Corrupt Channel Boundary", res["commentary"])

    def test_11_tier4_compromised_corridor_containment_threshold(self):
        """Tier 4: Corridor flagged as COMPROMISED when containment_rate < 50.0%."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path, min_containment_threshold=50.0)
        evaluator.load_workbook = lambda: None
        evaluator._get_sheet_headers_and_rows = lambda s: ({}, [])
        evaluator.validate_tier1_and_detect_active_indicator = lambda h, r: ("non_b", 3000)
        evaluator.validate_tier4_indicator_statistics = lambda a: {
            "source": "non_b", "captured_at": 1789764900, "live_bar_ts": 1789764300,
            "regression_angle": -29.72,
            "containment_rate": 35.50,  # Below 50.0% threshold!
            "edt_time_horizon": 1808,
            "channel_position_stat": 0.5, "raw_slope": -0.25, "total_matching_snapshots": 1,
        }
        evaluator.validate_tier2_and_tier3_micro_corridor = lambda a, h, r, l, n: [
            {"timestamp": 1789764300, "close": 4350.0, "ssa": 4350.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": 0.5, "is_contained": True, "breach_type": "NONE"}
        ] * 96

        res = evaluator.evaluate()
        self.assertFalse(res["macro_structure"]["is_corridor_valid"])
        self.assertEqual(res["macro_structure"]["macro_trend"], "UNIDENTIFIED")
        self.assertEqual(res["trend_state"], "UNIDENTIFIED")
        self.assertEqual(res["regime_status"], "UNCERTAIN")
        self.assertTrue(any("Corridor Integrity Compromised" in w for w in res["validation"]["warnings"]))

    def test_12_micro_breach_threshold_80pct_filtering(self):
        """Test Approach B: >=80% sustained breach confirms breakout, while <80% stays IN_CORRIDOR."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path, micro_breach_threshold_pct=80.0)
        evaluator.load_workbook = lambda: None
        evaluator._get_sheet_headers_and_rows = lambda s: ({}, [])
        evaluator.validate_tier1_and_detect_active_indicator = lambda h, r: ("non_b", 3000)
        evaluator.validate_tier4_indicator_statistics = lambda a: {
            "source": "non_b", "captured_at": 1789764900, "live_bar_ts": 1789764300,
            "regression_angle": -25.0, "containment_rate": 70.0, "edt_time_horizon": 1808,
            "channel_position_stat": 1.2, "raw_slope": -0.2, "total_matching_snapshots": 1,
        }

        # Sub-case A: 80/96 bars breached (83.3% >= 80%) -> Confirms UPPER_BREAKOUT
        bars_80 = [
            {"timestamp": 1789764300, "close": 4350.0, "ssa": 4350.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": 0.5, "is_contained": True, "breach_type": "NONE"}
        ] * 16 + [
            {"timestamp": 1789764300, "close": 4450.0, "ssa": 4450.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": 1.5, "is_contained": False, "breach_type": "UPPER_BREACH"}
        ] * 80
        evaluator.validate_tier2_and_tier3_micro_corridor = lambda a, h, r, l, n: bars_80
        res_a = evaluator.evaluate()
        self.assertEqual(res_a["micro_regime"]["regime"], "UPPER_BREAKOUT")
        self.assertEqual(res_a["regime_status"], "COUNTER_TREND_EXPANSION")
        self.assertGreaterEqual(res_a["micro_regime"]["upper_breach_pct"], 80.0)

        # Sub-case B: Only 50/96 bars breached (52.1% < 80%) -> Filters out false breakout, stays IN_CORRIDOR!
        bars_50 = [
            {"timestamp": 1789764300, "close": 4350.0, "ssa": 4350.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": 0.5, "is_contained": True, "breach_type": "NONE"}
        ] * 46 + [
            {"timestamp": 1789764300, "close": 4450.0, "ssa": 4450.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": 1.5, "is_contained": False, "breach_type": "UPPER_BREACH"}
        ] * 50
        evaluator.validate_tier2_and_tier3_micro_corridor = lambda a, h, r, l, n: bars_50
        res_b = evaluator.evaluate()
        self.assertEqual(res_b["micro_regime"]["regime"], "IN_CORRIDOR")
        self.assertEqual(res_b["regime_status"], "TREND_ALIGNED_CONTINUATION")

    def test_13_same_slope_v_shape_prompt_trigger(self):
        """Prompt trigger for same-slope breakout: V-shape reversal climax does not wait for 80% threshold."""
        evaluator = MCD1PrimaryTrendEvaluator(excel_path=self.excel_path, micro_breach_threshold_pct=80.0)
        evaluator.load_workbook = lambda: None
        evaluator._get_sheet_headers_and_rows = lambda s: ({}, [])
        evaluator.validate_tier1_and_detect_active_indicator = lambda h, r: ("non_b", 3000)

        # Scenario 1: Downtrend with sudden panic dump (only 3 bars below LOEDT, ~3.1% breach < 80%)
        evaluator.validate_tier4_indicator_statistics = lambda a: {
            "source": "non_b", "captured_at": 1789764900, "live_bar_ts": 1789764300,
            "regression_angle": -25.0, "containment_rate": 75.0, "edt_time_horizon": 1808,
            "channel_position_stat": -0.2, "raw_slope": -0.2, "total_matching_snapshots": 1,
        }
        bars_dump = [
            {"timestamp": 1789764300, "close": 4350.0, "ssa": 4350.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": 0.5, "is_contained": True, "breach_type": "NONE"}
        ] * 93 + [
            {"timestamp": 1789764300, "close": 4250.0, "ssa": 4350.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": -0.5, "is_contained": False, "breach_type": "LOWER_BREACH"}
        ] * 3
        evaluator.validate_tier2_and_tier3_micro_corridor = lambda a, h, r, l, n: bars_dump
        res_dump = evaluator.evaluate()
        self.assertEqual(res_dump["macro_structure"]["macro_trend"], "DOWNTREND")
        self.assertEqual(res_dump["micro_regime"]["regime"], "LOWER_BREAKDOWN")
        self.assertEqual(res_dump["regime_status"], "BREAKOUT_SAME_SLOPE")
        self.assertLess(res_dump["micro_regime"]["lower_breach_pct"], 80.0)
        self.assertIn("V-shape price reversal", res_dump["commentary"])

        # Scenario 2: Uptrend with sudden parabolic pump (only 2 bars above UOEDT, ~2.1% breach < 80%)
        evaluator.validate_tier4_indicator_statistics = lambda a: {
            "source": "non_b", "captured_at": 1789764900, "live_bar_ts": 1789764300,
            "regression_angle": 25.0, "containment_rate": 75.0, "edt_time_horizon": 1808,
            "channel_position_stat": 1.2, "raw_slope": 0.2, "total_matching_snapshots": 1,
        }
        bars_pump = [
            {"timestamp": 1789764300, "close": 4350.0, "ssa": 4350.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": 0.5, "is_contained": True, "breach_type": "NONE"}
        ] * 94 + [
            {"timestamp": 1789764300, "close": 4450.0, "ssa": 4450.0, "uoedt": 4400.0, "loedt": 4300.0,
             "channel_position": 1.5, "is_contained": False, "breach_type": "UPPER_BREACH"}
        ] * 2
        evaluator.validate_tier2_and_tier3_micro_corridor = lambda a, h, r, l, n: bars_pump
        res_pump = evaluator.evaluate()
        self.assertEqual(res_pump["macro_structure"]["macro_trend"], "UPTREND")
        self.assertEqual(res_pump["micro_regime"]["regime"], "UPPER_BREAKOUT")
        self.assertEqual(res_pump["regime_status"], "BREAKOUT_SAME_SLOPE")
        self.assertLess(res_pump["micro_regime"]["upper_breach_pct"], 80.0)
        self.assertIn("V-shape price reversal", res_pump["commentary"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

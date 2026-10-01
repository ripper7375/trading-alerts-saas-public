"""Reason codes, envelope builders, canonical JSON, schema check, never_throws."""

import copy
import json
import logging
import unittest

from mcd_common import envelope as env
from mcd_common import reason_codes as rc

SLOT = "2026-09-18T20:55Z"


def good_valid(**overrides):
    args = dict(
        state_code="MCD2_UP_IN_CORRIDOR", bias="LONG", summary_line="M5 uptrend, price inside the corridor",
        commentary="Close 4378.17 is inside the corridor.", regime_status="TREND_ALIGNED_CONTINUATION",
        levels=[
            {"name": "UOEDT", "tf": "M5", "price": 4384.28061, "role": "resistance"},
            {"name": "baseline", "tf": "M5", "price": 4367.24834},
            {"name": "LOEDT", "tf": "M5", "price": 4350.21607, "role": "support"},
        ],
        details={"window_bars": 288, "a": {"z": 1, "b": 2}},
        last_closed_bar={"M5": "2026-09-18T20:50Z"}, active_indicator={"M5": "best_fit_a"},
        config_hash={"best_fit_a": "d78ed3ba68"},
    )
    args.update(overrides)
    return env.valid("MCD2", "2.0.0", SLOT, **args)


class ReasonCodeTests(unittest.TestCase):
    def test_appendix_d_statuses(self):
        expected = {
            "DATA_STALE": "STALE", "RETUNING": "CAUTIONARY", "NO_SETTING": "INVALID",
            "DETECTION_MISMATCH": "CAUTIONARY", "NO_STATS_AT_SLOT": "STALE", "CONTAINMENT_LOW": "INVALID",
            "INSUFFICIENT_BARS": "INVALID", "DISCONTINUITY": "INVALID", "SANITY_FAILED": "INVALID",
            "MCD0_DEFECT_M5": "CAUTIONARY", "MCD0_DEFECT_M15": "CAUTIONARY", "EVALUATOR_ERROR": "INVALID",
            "UPSTREAM_CAUTIONARY:MCD1": "CAUTIONARY", "UPSTREAM_UNAVAILABLE:MCD2": "INVALID",
            "UPSTREAM_STALE:MCD15": "STALE",
        }
        for code, status in expected.items():
            self.assertEqual(rc.status_for(code), status, code)
        self.assertEqual(len(rc.FIXED_CODES), 12)

    def test_nothing_else_is_known(self):
        for bad in ("UNIDENTIFIED", "MCD3_INVALID", "UPSTREAM_STALE:MCD16", "UPSTREAM_STALE:", "UPSTREAM_OTHER:MCD1", "", None, 3):
            self.assertFalse(rc.is_known(bad), repr(bad))
            with self.assertRaises(ValueError):
                rc.status_for(bad)  # type: ignore[arg-type]

    def test_helpers(self):
        self.assertEqual(rc.upstream_unavailable("MCD1"), "UPSTREAM_UNAVAILABLE:MCD1")
        self.assertEqual(rc.mcd0_defect("M15"), "MCD0_DEFECT_M15")
        with self.assertRaises(ValueError):
            rc.upstream_stale("X")
        with self.assertRaises(ValueError):
            rc.mcd0_defect("H1")


class BuilderTests(unittest.TestCase):
    def test_valid_envelope_is_schema_valid_and_complete(self):
        e = good_valid()
        self.assertEqual(env.schema_errors(e), [])
        self.assertEqual(list(e), list(env.TOP_LEVEL_ORDER))
        self.assertEqual(e["status_reasons"], [])
        self.assertEqual([lv["price"] for lv in e["levels"]], [4384.28, 4367.25, 4350.22])

    def test_cautionary_keeps_state_bias_levels(self):
        e = env.cautionary(
            "MCD2", "2.0.0", SLOT, [rc.MCD0_DEFECT_M5, rc.RETUNING], state_code="MCD2_UP_IN_CORRIDOR", bias="LONG",
            summary_line="s", commentary="c", levels=[{"name": "UOEDT", "tf": "M5", "price": 1.0}],
        )
        self.assertEqual(e["status"], "CAUTIONARY")
        self.assertEqual(env.schema_errors(e), [])

    def test_invalid_and_stale_carry_no_state_bias_levels(self):
        for builder, code in ((env.invalid, rc.INSUFFICIENT_BARS), (env.stale, rc.NO_STATS_AT_SLOT)):
            e = builder("MCD2", "2.0.0", SLOT, [code])
            self.assertIsNone(e["state_code"])
            self.assertIsNone(e["bias"])
            self.assertEqual(e["levels"], [])
            self.assertEqual(env.schema_errors(e), [])
            self.assertLessEqual(len(e["summary_line"]), 80)

    def test_stopping_reason_may_follow_cautionary_reasons(self):
        e = env.stale("MCD2", "2.0.0", SLOT, [rc.DETECTION_MISMATCH, rc.NO_STATS_AT_SLOT])
        self.assertEqual(e["status_reasons"], ["DETECTION_MISMATCH", "NO_STATS_AT_SLOT"])
        self.assertEqual(env.schema_errors(e), [])

    def test_unavailable_dispatch(self):
        self.assertEqual(env.unavailable("STALE", "MCD2", "2.0.0", SLOT, [rc.DATA_STALE])["status"], "STALE")
        with self.assertRaises(ValueError):
            env.unavailable("VALID", "MCD2", "2.0.0", SLOT, [])

    def test_builders_refuse_incoherent_envelopes(self):
        cases = [
            lambda: env.invalid("MCD2", "2.0.0", SLOT, []),                                  # no reason
            lambda: env.invalid("MCD2", "2.0.0", SLOT, [rc.NO_STATS_AT_SLOT]),               # STALE code on INVALID
            lambda: env.stale("MCD2", "2.0.0", SLOT, [rc.SANITY_FAILED]),                    # INVALID code on STALE
            lambda: env.invalid("MCD2", "2.0.0", SLOT, ["UNIDENTIFIED"]),                     # not in Appendix D
            lambda: env.cautionary("MCD2", "2.0.0", SLOT, [], state_code="MCD2_A", bias="LONG", summary_line="s", commentary="c"),
            lambda: env.cautionary("MCD2", "2.0.0", SLOT, [rc.NO_SETTING], state_code="MCD2_A", bias="LONG", summary_line="s", commentary="c"),
            lambda: good_valid(state_code="MCD3_UP"),                                        # wrong prefix
            lambda: good_valid(state_code="MCD2_" + "X" * 44),                                # 49 chars
            lambda: good_valid(bias="BUY"),
            lambda: good_valid(levels=[{"name": "UOEDT", "tf": "H1", "price": 1.0}]),
            lambda: good_valid(levels=[{"name": "UOEDT", "tf": "M5", "price": "4384"}]),
            lambda: good_valid(levels=[{"name": "UOEDT", "tf": "M5", "price": 1.0, "role": "target"}]),
            lambda: env.valid("MCD16", "2.0.0", SLOT, state_code="MCD16_A", bias="LONG", summary_line="s", commentary="c"),
            lambda: env.valid("MCD2", "2.0", SLOT, state_code="MCD2_A", bias="LONG", summary_line="s", commentary="c"),
            lambda: env.valid("MCD2", "2.0.0", "2026-09-18T20:57Z", state_code="MCD2_A", bias="LONG", summary_line="s", commentary="c"),
        ]
        for i, build in enumerate(cases):
            with self.assertRaises(ValueError, msg=f"case {i}"):
                build()


class RoundingTests(unittest.TestCase):
    def test_round2_is_half_up_on_the_shortest_decimal(self):
        self.assertEqual(env.round2(2.675), 2.68)     # float repr is 2.675; half up
        self.assertEqual(env.round2(4384.28061), 4384.28)
        self.assertEqual(env.round2(0.005), 0.01)
        self.assertEqual(env.round2(-0.004), 0.0)
        self.assertEqual(str(env.round2(-0.004)), "0.0")  # no negative zero
        self.assertEqual(env.round2(5), 5.0)

    def test_round2_rejects_non_numbers(self):
        for bad in (None, "1.0", True, float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                env.round2(bad)  # type: ignore[arg-type]


class CanonicalJsonTests(unittest.TestCase):
    def test_same_envelope_same_bytes_whatever_the_key_order(self):
        a = good_valid()
        b = copy.deepcopy(a)
        b["details"] = {"a": {"b": 2, "z": 1}, "window_bars": 288}      # keys in another order
        b = {k: b[k] for k in reversed(list(b))}                       # top-level reversed
        self.assertEqual(env.canonical_json(a), env.canonical_json(b))
        self.assertEqual(env.canonical_json(a, pretty=True), env.canonical_json(b, pretty=True))

    def test_top_level_order_is_the_schema_order(self):
        keys = list(json.loads(env.canonical_json(good_valid())))
        self.assertEqual(keys, list(env.TOP_LEVEL_ORDER))

    def test_prices_are_rounded_at_output_only(self):
        e = good_valid()
        e["levels"][0]["price"] = 4384.28061                              # unrounded input
        self.assertIn('"price":4384.28', env.canonical_json(e))

    def test_nan_and_infinity_are_refused(self):
        e = good_valid(details={"x": float("nan")})
        with self.assertRaises(ValueError):
            env.canonical_json(e)

    def test_negative_zero_in_details_is_written_as_zero(self):
        """F6 (b): ``-0.0`` and ``0.0`` must give the same bytes (R4); ``details`` is not rounded by ``round2``."""
        negative = good_valid(details={"angle": -0.0, "nested": {"deltas": [-0.0, 1.5, {"z": -0.0}]}})
        positive = good_valid(details={"angle": 0.0, "nested": {"deltas": [0.0, 1.5, {"z": 0.0}]}})
        text = env.canonical_json(negative)
        self.assertNotIn("-0.0", text)
        self.assertIn('"angle":0.0', text)
        self.assertEqual(text, env.canonical_json(positive))
        self.assertEqual(env.canonical_json(negative, pretty=True), env.canonical_json(positive, pretty=True))
        self.assertEqual(env.schema_errors(negative), [])

    def test_a_small_negative_number_in_details_keeps_its_sign(self):
        self.assertIn('"angle":-0.25', env.canonical_json(good_valid(details={"angle": -0.25})))

    def test_extra_top_level_key_is_kept_so_the_schema_can_reject_it(self):
        e = dict(good_valid(), evaluated_at="2026-09-18T20:55:03Z")
        self.assertIn("evaluated_at", json.loads(env.canonical_json(e)))
        self.assertTrue(any("evaluated_at" in msg for msg in env.schema_errors(e)))

    def test_pretty_ends_with_newline_and_is_ascii(self):
        text = env.canonical_json(good_valid(commentary="degrees °"), pretty=True)
        self.assertTrue(text.endswith("\n"))
        text.encode("ascii")


class SchemaTests(unittest.TestCase):
    def test_accepts_a_correct_envelope(self):
        env.assert_valid(good_valid())

    def test_rejects_an_extra_top_level_field(self):
        errors = env.schema_errors(dict(good_valid(), confidence="high"))
        self.assertTrue(errors and "confidence" in errors[0], errors)
        with self.assertRaises(AssertionError):
            env.assert_valid(dict(good_valid(), extra=1))

    def test_rejects_missing_fields(self):
        for key in env.TOP_LEVEL_ORDER:
            e = good_valid()
            del e[key]
            self.assertTrue(env.schema_errors(e), f"missing {key} should fail")

    def test_state_and_bias_rules_by_status(self):
        e = good_valid()
        e["state_code"] = None
        self.assertTrue(env.schema_errors(e))          # VALID needs a state
        e = good_valid()
        e["bias"] = None
        self.assertTrue(env.schema_errors(e))
        s = env.stale("MCD2", "2.0.0", SLOT, [rc.DATA_STALE])
        s["state_code"] = "MCD2_UP_IN_CORRIDOR"
        self.assertTrue(env.schema_errors(s))          # STALE carries no state
        s = env.stale("MCD2", "2.0.0", SLOT, [rc.DATA_STALE])
        s["levels"] = [{"name": "UOEDT", "tf": "M5", "price": 1.0}]
        self.assertTrue(env.schema_errors(s))
        s = env.stale("MCD2", "2.0.0", SLOT, [rc.DATA_STALE])
        s["status_reasons"] = []
        self.assertTrue(env.schema_errors(s))          # non-VALID needs a reason

    def test_field_formats(self):
        for key, bad in (
            ("schema_version", "mcd-output/2"), ("mcd_id", "MCD16"), ("evaluator_version", "2.0"),
            ("cycle_slot", "2026-09-18T20:57Z"), ("status", "OK"), ("bias", "BUY"),
            ("summary_line", "x" * 81), ("state_code", "UP_IN_CORRIDOR"), ("depends_on", ["MCD1", "MCD1"]),
            ("last_closed_bar", {"H1": "2026-09-18T20:50Z"}), ("active_indicator", {"M30": "x"}),
        ):
            e = good_valid()
            e[key] = bad
            self.assertTrue(env.schema_errors(e), f"{key}={bad!r} should fail")

    def test_state_code_over_48_characters_fails(self):
        e = good_valid()
        e["state_code"] = "MCD2_" + "A" * 44
        self.assertTrue(env.schema_errors(e))

    def test_schema_file_is_the_appendix_b_schema(self):
        import re
        from .support import REPO_DIR

        standard = (REPO_DIR / "docs" / "MCD-DEVELOPMENT-STANDARD.md").read_text(encoding="utf-8")
        block = re.search(r"```json\n(.*?)\n```", standard[standard.index("## Appendix B"):], re.S).group(1)
        self.assertEqual(json.loads(block), json.loads(env.SCHEMA_PATH.read_text(encoding="utf-8")))


class ReadingContextTests(unittest.TestCase):
    def test_only_the_timeframes_and_sources_read_are_reported(self):
        from .support import synthetic_inputs

        inputs = synthetic_inputs(
            active_indicator={"M5": "best_fit_a", "M15": "non_b"},
            config_hash={"best_fit_a": "h1", "non_b": "h2", "fractal_edt": "h3"},
        )
        ctx = env.reading_context(inputs, ("M5",))
        self.assertEqual(ctx, {"last_closed_bar": {"M5": "2026-09-18T20:50Z"}, "active_indicator": {"M5": "best_fit_a"}, "config_hash": {"best_fit_a": "h1"}})

    def test_fractal_hash_is_keyed_by_the_statistics_source(self):
        from .support import synthetic_inputs

        inputs = synthetic_inputs(active_indicator={"M5": "fractal"}, config_hash={"fractal_edt": "h3", "fractal": "wrong"})
        self.assertEqual(env.reading_context(inputs, ("M5",))["config_hash"], {"fractal_edt": "h3"})

    def test_failure_path_is_best_effort_and_never_raises(self):
        from .support import synthetic_inputs

        import dataclasses

        for changes in ({"active_indicator": {}}, {"active_indicator": None}, {"config_hash": None}, {"bars": None}, {"bars": {}}):
            ctx = env.reading_context(dataclasses.replace(synthetic_inputs(), **changes), ("M5",))
            self.assertEqual(sorted(ctx), ["active_indicator", "config_hash", "last_closed_bar"], changes)
        self.assertEqual(env.reading_context(dataclasses.replace(synthetic_inputs(), active_indicator={}), ("M5",))["active_indicator"], {})


class NeverThrowsTests(unittest.TestCase):
    def test_exception_becomes_invalid_evaluator_error_and_is_logged(self):
        @env.never_throws("MCD9", "1.0.0")
        def boom(inputs, params, upstream):
            raise RuntimeError("kaboom")

        class Inputs:
            cycle_slot = SLOT

        with self.assertLogs("mcd", level=logging.ERROR) as logs:
            e = boom(Inputs(), None, {})
        self.assertEqual((e["status"], e["status_reasons"], e["state_code"], e["bias"]), ("INVALID", ["EVALUATOR_ERROR"], None, None))
        self.assertEqual(e["cycle_slot"], SLOT)
        self.assertEqual(env.schema_errors(e), [])
        self.assertEqual(logs.records[0].mcd_id, "MCD9")
        self.assertEqual(logs.records[0].cycle_slot, SLOT)

    def test_unreadable_slot_falls_back_and_still_validates(self):
        @env.never_throws("MCD9", "1.0.0")
        def boom(inputs, params, upstream):
            raise ValueError("x")

        with self.assertLogs("mcd", level=logging.ERROR):
            e = boom(object(), None, None)
        self.assertEqual(e["cycle_slot"], "1970-01-01T00:00Z")
        self.assertEqual(env.schema_errors(e), [])

    def test_good_result_passes_through_and_name_is_kept(self):
        @env.never_throws("MCD2", "2.0.0")
        def fine(inputs, params, upstream):
            """doc"""
            return good_valid()

        self.assertEqual(fine(None, None, None), good_valid())
        self.assertEqual(fine.__name__, "fine")

    def test_bad_identity_fails_at_decoration_time(self):
        with self.assertRaises(ValueError):
            env.never_throws("MCD99", "1.0.0")
        with self.assertRaises(ValueError):
            env.never_throws("MCD2", "one")


if __name__ == "__main__":
    unittest.main()

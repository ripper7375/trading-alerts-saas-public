"""wording.py (T11) and budget.py (T12, R15)."""

import os
import tempfile
import unittest
from unittest import mock

from mcd_common import budget, wording
from mcd_common import envelope as env

from .support import SLOT


class BannedWordTests(unittest.TestCase):
    def test_every_banned_word_is_caught_in_codes(self):
        for word in wording.BANNED_WORDS:
            code = f"MCD5_UP_{word}_ZONE"
            self.assertIn(word, wording.banned_in_code(code), code)

    def test_codes_match_whole_parts_only(self):
        self.assertEqual(wording.banned_in_code("MCD5_UPGRADE_ZONE"), [])   # GRADE inside UPGRADE
        self.assertEqual(wording.banned_in_code("MCD5_MEASURE"), [])       # SURE inside MEASURE
        self.assertEqual(wording.banned_in_code("MCD5_UNSAFE"), [])
        self.assertEqual(wording.banned_in_code("MCD5_HIGH_CONVICTION_UP"), ["CONVICTION", "HIGH_CONVICTION"])
        self.assertEqual(wording.banned_in_code("MCD5_STRONG_BUY_ZONE"), ["STRONG_BUY"])

    def test_text_matches_words_case_insensitively(self):
        self.assertEqual(wording.banned_in_text("There is a high Probability of a bounce."), ["PROBABILITY"])
        self.assertEqual(wording.banned_in_text("We are sure and confident, a safe grade."), ["CONFIDENCE", "GRADE", "SAFE", "SURE"])
        self.assertEqual(wording.banned_in_text("a strong buy signal"), ["STRONG_BUY"])
        self.assertEqual(wording.banned_in_text("We measure the upgrade safeguards."), [])

    def test_neutral_location_terms_are_fine(self):
        for code in ("MCD2_UPPER_OVEREXTENSION_REVERSION", "MCD3_BULL_PREMIUM", "MCD3_BULL_VALUE", "RANGE_EQUILIBRIUM"):
            self.assertEqual(wording.check_code(code), [], code)


# F5 (Davin, 2026-10-01): inflections of the ten banned words, from the P6 check's examples and the
# forms in ``BANNED_INFLECTIONS``. Each is reported under the banned word it belongs to.
INFLECTION_CASES = {
    "PROBABILITIES": "PROBABILITY",
    "CONVICTIONS": "CONVICTION",
    "CONFIDENCES": "CONFIDENCE",
    "CONFIDENT": "CONFIDENCE",
    "CONFIDENTLY": "CONFIDENCE",
    "GRADES": "GRADE",
    "GRADED": "GRADE",
    "GRADING": "GRADE",
    "GUARANTEE": "GUARANTEED",
    "GUARANTEES": "GUARANTEED",
    "GUARANTEEING": "GUARANTEED",
    "SAFELY": "SAFE",
    "SAFER": "SAFE",
    "SAFEST": "SAFE",
    "SURELY": "SURE",
    "SURER": "SURE",
    "SUREST": "SURE",
    "STRONG_BUYS": "STRONG_BUY",
    "STRONG_SELLS": "STRONG_SELL",
    "HIGH_CONVICTIONS": "HIGH_CONVICTION",
}
# Words that contain a banned word, or look like an inflection, and must stay clean.
CLEAN_NEIGHBOURS = (
    "MEASURE", "MEASURED", "UPGRADE", "UPGRADED", "DOWNGRADE", "PRESSURE", "ENSURE", "ASSURE", "INSURE",
    "GRADIENT", "GRADUAL", "GRADUALLY", "SAFEGUARD", "SAFEGUARDS", "UNSAFE", "UNSURE",
    "CONVICT", "CONFIDE", "GUARANTOR",
)


class InflectionTests(unittest.TestCase):
    def test_the_table_has_exactly_the_ten_banned_words_as_keys_and_they_are_unchanged(self):
        self.assertEqual(tuple(wording.BANNED_INFLECTIONS), wording.BANNED_WORDS)
        self.assertEqual(len(wording.BANNED_WORDS), 10)
        for word, forms in wording.BANNED_INFLECTIONS.items():
            self.assertTrue(forms, word)
            self.assertNotIn(word, forms)
            self.assertEqual(len(set(forms)), len(forms), word)

    def test_every_listed_form_is_in_the_cases_below(self):
        listed = {form for forms in wording.BANNED_INFLECTIONS.values() for form in forms}
        self.assertEqual(listed, set(INFLECTION_CASES))
        for form, word in INFLECTION_CASES.items():
            self.assertIn(form, wording.BANNED_INFLECTIONS[word])

    def test_inflections_are_caught_in_codes(self):
        for form, word in INFLECTION_CASES.items():
            code = f"MCD5_UP_{form}_ZONE"
            self.assertIn(word, wording.banned_in_code(code), code)
            self.assertTrue(wording.check_code(code, mcd_id="MCD5"), code)

    def test_inflections_are_caught_in_text_in_any_case(self):
        for form, word in INFLECTION_CASES.items():
            spaced = form.replace("_", " ")
            for text in (f"the {spaced.lower()} here", f"The {spaced.title()} here.", f"{spaced.upper()}!"):
                self.assertIn(word, wording.banned_in_text(text), text)
                self.assertTrue(wording.check_text("commentary", text), text)

    def test_the_cases_the_p6_check_named(self):
        self.assertEqual(wording.banned_in_text("PROBABILITIES of a bounce"), ["PROBABILITY"])
        self.assertEqual(wording.banned_in_text("a graded zone"), ["GRADE"])
        self.assertEqual(wording.banned_in_text("the grades differ"), ["GRADE"])
        self.assertEqual(wording.banned_in_text("price holds safely"), ["SAFE"])
        self.assertEqual(wording.banned_in_text("two convictions"), ["CONVICTION"])
        self.assertEqual(wording.banned_in_text("a confident reading"), ["CONFIDENCE"])

    def test_a_hyphen_separates_the_words_of_a_multiword_form_in_text(self):
        """G3: the inflection tests use spaces in text and underscores in codes; dropping the hyphen
        from the separator class kept every one of them green."""
        multiword = {form: word for form, word in INFLECTION_CASES.items() if "_" in form}
        multiword.update({word: word for word in wording.BANNED_WORDS if "_" in word})
        self.assertEqual(
            set(multiword),
            {"STRONG_BUY", "STRONG_SELL", "HIGH_CONVICTION", "STRONG_BUYS", "STRONG_SELLS", "HIGH_CONVICTIONS"},
        )
        for form, word in multiword.items():
            hyphenated = form.replace("_", "-")
            for text in (f"a {hyphenated.lower()} zone", f"A {hyphenated.title()} zone.", f"{hyphenated.upper()}!"):
                self.assertIn(word, wording.banned_in_text(text), text)
                self.assertTrue(wording.check_text("commentary", text), text)
        self.assertEqual(wording.banned_in_text("a strong-buy zone"), ["STRONG_BUY"])

    def test_a_multiword_inflection_reports_both_words_it_contains(self):
        self.assertEqual(wording.banned_in_code("MCD5_HIGH_CONVICTIONS_UP"), ["CONVICTION", "HIGH_CONVICTION"])

    def test_words_that_only_contain_or_resemble_a_banned_word_stay_clean(self):
        for word in CLEAN_NEIGHBOURS:
            self.assertEqual(wording.banned_in_code(f"MCD5_{word}_ZONE"), [], word)
            self.assertEqual(wording.banned_in_text(f"the {word.lower()} here"), [], word)
            self.assertEqual(wording.check_code(f"MCD5_{word}_ZONE", mcd_id="MCD5"), [], word)
            self.assertEqual(wording.check_text("commentary", f"the {word.lower()} here"), [], word)

    def test_inflections_reach_t11_through_check_wording(self):
        problems = wording.check_wording(
            mcd_id="MCD3",
            state_codes=["MCD3_GRADED_ZONE"],
            regime_words=["SAFELY_CONTAINED"],
            templates={"MCD3_T01": "Probabilities favour the upper half."},
            summaries=[("A confident uptrend", [])],
        )
        joined = "\n".join(problems)
        for expected in ("GRADE", "SAFE", "PROBABILITY", "CONFIDENCE"):
            self.assertIn(f"banned word {expected}", joined)


class AdviceWordTests(unittest.TestCase):
    def test_advice_words_in_codes(self):
        self.assertEqual(wording.advice_in_code("MCD2_DIP_VALUE_BUY_OPPORTUNITY"), ["BUY", "OPPORTUNITY"])
        self.assertEqual(wording.advice_in_code("MCD3_CAUTION_TAKE_PROFIT_BUY"), ["BUY", "TAKE_PROFIT"])
        self.assertEqual(wording.advice_in_code("MCD3_HOLD_BULLISH_TREND_RUNNER"), ["HOLD"])
        self.assertEqual(wording.advice_in_code("MCD2_UPTREND_DIP_BELOW_CORRIDOR"), [])

    def test_advice_words_in_text_and_the_allow_list(self):
        self.assertEqual(wording.advice_in_text("Consider a buy here."), ["BUY"])
        self.assertEqual(wording.advice_in_text("Price holds above the base; threshold reached."), [])
        self.assertEqual(wording.advice_in_text("time to take profit"), ["TAKE_PROFIT"])
        self.assertEqual(wording.advice_in_text("Consider a buy here.", allow=["buy"]), [])
        self.assertEqual(wording.advice_in_code("MCD2_DIP_VALUE_BUY_OPPORTUNITY", allow=["BUY", "OPPORTUNITY"]), [])


class CodeFormatTests(unittest.TestCase):
    def test_state_code_format(self):
        self.assertEqual(wording.check_code("MCD2_UP_IN_CORRIDOR", mcd_id="MCD2"), [])
        for bad in ("UP_IN_CORRIDOR", "MCD3_UP", "mcd2_up", "MCD2_UP-IN", "MCD2_ÜP", "MCD2_" + "A" * 44):
            self.assertTrue(wording.check_code(bad, mcd_id="MCD2"), bad)


class TextAndSummaryTests(unittest.TestCase):
    def test_percent_sign_is_refused_in_summary_and_commentary(self):
        self.assertTrue(wording.check_text("commentary", "Breach on 82% of bars."))
        self.assertTrue(wording.check_summary_line("82% inside"))
        self.assertEqual(wording.check_text("commentary", "14 of 96 closed bars above UOEDT."), [])

    def test_summary_length_boundary_is_80(self):
        self.assertEqual(wording.check_summary_line("x" * 80), [])
        self.assertTrue(any("81 characters" in p for p in wording.check_summary_line("x" * 81)))

    def test_summary_carries_no_prices(self):
        levels = [{"name": "UOEDT", "tf": "M5", "price": 4384.28}, {"name": "LOEDT", "tf": "M5", "price": 12.5}]
        self.assertTrue(wording.check_summary_line("Price above UOEDT 4384.28", levels))
        self.assertTrue(wording.check_summary_line("Above 4384", levels))               # three or more digits
        self.assertTrue(wording.check_summary_line("Support at 12.50", levels))        # exact level price
        self.assertTrue(wording.check_summary_line("Support at 12.5", levels))
        self.assertEqual(wording.check_summary_line("M5 uptrend, price inside the corridor", levels), [])
        self.assertEqual(wording.check_summary_line("M5 slope up 21 degrees", levels), [])

    def test_check_wording_collects_everything(self):
        problems = wording.check_wording(
            mcd_id="MCD3",
            state_codes=["MCD3_BULL_VALUE", "MCD3_HIGH_CONVICTION_BUY_DIP"],
            regime_words=["TREND_ALIGNED_CONTINUATION", "DIP_VALUE_BUY_OPPORTUNITY"],
            templates={"MCD3_T01": "{n} of {m} bars nested", "MCD3_T02": "Nesting is 82%."},
            summaries=[("EDT stochastic near the value zone", []), ("x" * 90, [])],
        )
        joined = "\n".join(problems)
        for expected in ("HIGH_CONVICTION", "CONVICTION", "BUY", "OPPORTUNITY", "MCD3_T02", "90 characters"):
            self.assertIn(expected, joined)
        self.assertNotIn("MCD3_BULL_VALUE'", joined)
        self.assertEqual(wording.check_wording(mcd_id="MCD3", state_codes=["MCD3_BULL_VALUE"], templates={"t": "ok"}), [])

    def test_wording_of_the_kits_own_default_texts_is_clean(self):
        for builder, code in ((env.invalid, "NO_SETTING"), (env.stale, "NO_STATS_AT_SLOT")):
            e = builder("MCD9", "1.0.0", SLOT, [code])
            self.assertEqual(wording.check_summary_line(e["summary_line"], []), [])
            self.assertEqual(wording.check_text("commentary", e["commentary"]), [])


class BudgetFallbackTests(unittest.TestCase):
    """The encoding is not available: the documented estimate is used and the result is pending."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        patcher = mock.patch.dict(os.environ, {"TIKTOKEN_CACHE_DIR": self.tmp.name})
        patcher.start()
        self.addCleanup(patcher.stop)
        self.addCleanup(self.tmp.cleanup)

    def test_estimate_is_ceil_chars_over_three_and_is_flagged(self):
        self.assertFalse(budget.encoding_available())
        count = budget.count_tokens("x" * 10)
        self.assertEqual((count.tokens, count.exact, count.pending), (4, False, True))
        self.assertEqual(count.method, "estimate:ceil(chars/3)")
        self.assertEqual(budget.estimate_tokens(""), 0)

    def test_a_damaged_cache_file_is_not_trusted_and_nothing_is_downloaded(self):
        import hashlib

        path = budget._cache_file()
        path.write_bytes(b"not the encoding")
        self.assertEqual(path.name, hashlib.sha1(budget.ENCODING_URL.encode()).hexdigest())
        self.assertFalse(budget.encoding_available())
        self.assertTrue(budget.count_tokens("hello").pending)

    def test_size_check_is_pending_not_failing_when_only_an_estimate_exists(self):
        from mcd_common.testing import check_size

        huge = env.valid("MCD9", "1.0.0", SLOT, state_code="MCD9_A", bias="NEUTRAL", summary_line="s", commentary="c" * 5000)
        result = check_size([huge])
        self.assertTrue(result.pending)
        self.assertFalse(result.passed)      # over budget by the estimate ...
        # ... yet no AssertionError was raised: T12 stays pending until o200k_base is cached.


@unittest.skipUnless(budget.encoding_available(), "o200k_base not cached (python -m mcd_common.budget --fetch)")
class BudgetExactTests(unittest.TestCase):
    def test_real_encoding_counts(self):
        count = budget.count_tokens("hello world")
        self.assertEqual((count.tokens, count.method, count.exact), (2, "o200k_base", True))

    def test_size_check_raises_over_budget_with_the_real_encoding(self):
        from mcd_common.testing import check_size

        huge = env.valid("MCD9", "1.0.0", SLOT, state_code="MCD9_A", bias="NEUTRAL", summary_line="s", commentary="alpha beta " * 400)
        with self.assertRaises(AssertionError):
            check_size([huge])
        small = env.valid("MCD9", "1.0.0", SLOT, state_code="MCD9_A", bias="NEUTRAL", summary_line="s", commentary="c")
        result = check_size([small])
        self.assertTrue(result.passed and not result.pending)
        self.assertEqual(result.method, "o200k_base")

    def test_envelope_count_uses_the_compact_canonical_form(self):
        e = env.valid("MCD9", "1.0.0", SLOT, state_code="MCD9_A", bias="NEUTRAL", summary_line="s", commentary="c")
        self.assertEqual(budget.count_envelope_tokens(e).tokens, budget.count_tokens(env.canonical_json(e)).tokens)


class TimingTests(unittest.TestCase):
    def test_time_evaluation_returns_the_slowest_run(self):
        calls = []
        slowest = budget.time_evaluation(lambda: calls.append(1), runs=4)
        self.assertEqual(len(calls), 4)
        self.assertGreaterEqual(slowest, 0.0)

    def test_check_time_fails_a_slow_evaluator(self):
        import time

        from mcd_common.testing import SensorUnderTest, check_time

        from .support import synthetic_inputs

        def slow(inputs, params, upstream):
            time.sleep(0.05)
            return {}

        sensor = SensorUnderTest(slow, synthetic_inputs(), None, {}, ("M5",))
        with self.assertRaises(AssertionError):
            check_time(sensor, limit=0.01)
        self.assertLess(check_time(sensor, limit=5.0), 5.0)


if __name__ == "__main__":
    unittest.main()

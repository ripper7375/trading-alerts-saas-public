"""Synthesis: the rules that turn one cycle's sensor readings into a bias, a reason and, later, entry zones (build step 4; chapter 3).

Part 2: the entry zones (``zones``: the builder, the parameters in ``zone_params.yaml``, ``pills``). Part 1: the rules file (``rules/draft-1.yaml``) and its loader (``rules``), the facts a rule may test
(``facts``), the engine that picks the first matching row for each trader type (``engine``) and the ``syn-output/1`` reading
with its guards (``reading``). No runner integration yet (part 3), no database (parts 4 and 5).

Rules decide, the model explains (ADR-025). Everything here is a pure function of its inputs: same readings, same rules, same
reading byte for byte.
"""

from .engine import Decision, SensorView, decide
from .reading import SynReading, canonical_json, make_reading, reading_problems, synthesize_cycle
from .rules import DEFAULT_RULES_VERSION, Rules, load_rules, parse_rules, vocabulary_from_registry

__all__ = [
    "DEFAULT_RULES_VERSION",
    "Decision",
    "Rules",
    "SensorView",
    "SynReading",
    "canonical_json",
    "decide",
    "load_rules",
    "make_reading",
    "parse_rules",
    "reading_problems",
    "synthesize_cycle",
    "vocabulary_from_registry",
]

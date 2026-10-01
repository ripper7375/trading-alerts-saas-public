"""Shared kit every MCD evaluator imports (walkthrough Part B2, standard sections 4-6, 11-12).

An evaluator is a pure function ``evaluate(inputs, params, upstream) -> Envelope``. This package
holds the parts that must be identical for every MCD: the frozen input bundle, the envelope
builders and schema check, the fixed pre-flight order, the reason codes, the Excel fixture
provider (test fixtures only), and the shared tests T4-T8 and T10-T12.

Evaluators import only the standard library, this package and pure maths. The fixture provider
(``excel_fixture_provider``), ``budget`` and ``testing`` are for tests, workers and tooling, not
for evaluator code.
"""

KIT_VERSION = "1.0.0"

# mcd_common: the shared MCD kit

Every MCD evaluator imports this package (walkthrough Part B2, standard §4–§6 and §11–§12). Each MCD
then writes only its own logic. Built by task P1, 30 September 2026. Interfaces are fixed once MCD2's
retrofit uses them.

An evaluator is `evaluate(inputs, params, upstream) -> Envelope`: pure, never raising. The pre-flight
checks assume a well-formed bundle and can raise on a corrupt one, so wrap every evaluator in
`envelope.never_throws` (rule R7, test T10).

| Module                      | For                    | What it gives an MCD                                                                                                                                                                 |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cycle_inputs.py`           | evaluators             | `CycleInputs` (frozen bundle: Part B2 fields plus `stats_slot` and the optional `context_levels`), `Params`, `closed_bars()`, slot and grid helpers, the channel-indicator catalogue |
| `reason_codes.py`           | evaluators             | The Appendix D codes; nothing else can be emitted                                                                                                                                    |
| `envelope.py`               | evaluators             | `valid` / `cautionary` / `invalid` / `stale`, `reading_context()`, `canonical_json()`, `schema_errors()`, the `never_throws` decorator                                               |
| `preflight.py`              | evaluators             | `run_preflight()` (order fixed: cycle, tier 1, tier 4, tier 2, tier 3, upstream) and the tier helpers; tier 1 applies decision D3                                                    |
| `wording.py`                | evaluators, tests      | Banned words, `%`, 80-character summary, no prices, advice words                                                                                                                     |
| `excel_fixture_provider.py` | tests and tooling only | Replica workbook to `CycleInputs` for one slot; writes `<slot>.inputs.json`, `.source.md`, `.envelope.json`. The only place with the replica statistics tolerance (decision E1)      |
| `budget.py`                 | tests and tooling only | Token count (`o200k_base`) and timing; `python -m mcd_common.budget --fetch` downloads the encoding once into `.tiktoken_cache/`                                                     |
| `testing.py`                | tests only             | T4, T5, T6, T7, T8, T9, T10, T11, T12 and the R15 time check; the `SharedSensorChecks` mixin                                                                                         |
| `fixtures/settings_*.yaml`  | tests only             | Active-indicator setting per replica workbook (decision D2)                                                                                                                          |

Evaluator-facing modules (`reason_codes`, `cycle_inputs`, `envelope`, `preflight`, `wording`) import only the
standard library at module level; `tests/test_kit_boundaries.py` enforces that, and that they use no
clock, randomness, environment, network, printing or database.

## Run the tests

From `davintrade-stack-d-and-e/engine-1-5-new/` (pytest is not installed; the suite uses `unittest`):

```bash
python -m unittest discover -s mcd_common/tests -t .
```

Requirements are pinned in `requirements.txt`. If `o200k_base` is not cached, token counts fall back to
a documented character estimate and T12 is reported as "pending" (skipped), never as a failure.

## Use it from an MCD

An MCD folder is `engine-1-5-new/mcdN/`, so its evaluator and tests put `engine-1-5-new` on `sys.path`
and `import mcd_common`. A test file gets the shared checks with one hook:

```python
class TestShared(SharedSensorChecks, unittest.TestCase):
    def sensor(self):
        return SensorUnderTest(evaluate, inputs, params, upstream={}, timeframes=("M5",))
```

`tests/stub_mcd.py` is a small worked example of an evaluator on the kit.

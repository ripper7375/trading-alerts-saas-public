# `mcd_worker`: the cycle runner of the sensor worker

Build step 3 (architecture chapter 2), part 1. One call turns one frozen input bundle (`mcd_common.CycleInputs`) into one reading
per enabled MCD. It sits beside `mcd_common/` and loads `mcd0` to `mcd3` as they are: no evaluator, parameter file or registry is
copied or changed. It reads no database, no network and no clock for any decision. The gateway's sensor worker (part 4) runs it once
per cycle as `python -m mcd_worker.cli`.

Status: Phase A, built on fixtures. Every flag is `off`. Nothing here is deployed, and nothing reads production.

## What one cycle does

1. The bundle must be keyable: a slot on the 5-minute grid, a symbol, a boolean `retuning` (`BundleError` otherwise). Bad market data is
   not an error: the evaluators answer INVALID or STALE.
2. **RETUNING switch** (Davin, Q6). `retuning` of the bundle is always read and recorded as `retuning_observed`. The evaluators see it only
   when `retuning_enforced` is true (`retuning_applied`). The default is **false**: until a promote is rehearsed and Davin has settled how
   RETUNING ends (step 3, B5), production sensors stay VALID during a promote.
3. **Order**: MCD0, then the independent MCDs by number, then the derived MCDs in dependency order (`execution_order`).
4. Each MCD gets the bundle and a **copy** of the readings of the MCDs it depends on, as they stand after MCD0 inheritance (Q5 a). MCD3
   therefore reads MCD1 and MCD2 and recomputes nothing.
5. **MCD0 inheritance** (ADR-018, Q5 b): only a VALID MCD0 reading that calls a timeframe defective marks the channel MCDs whose registry
   `uses_channel` names it: VALID becomes CAUTIONARY with `MCD0_DEFECT_<TF>` added after the evaluator's own reasons (M5 before M15). State,
   bias, levels and texts stay. INVALID and STALE readings are left alone. An INVALID, STALE or CAUTIONARY MCD0 marks nobody.
6. **Output guards** (`guards.py`): schema, identity, reason codes, state register and bias, and a wording backstop (no banned word, no `%`).
   A reading that fails, or an evaluator that raises, is saved as INVALID with `EVALUATOR_ERROR`; the problems are returned in
   `guard_problems`, never put in the envelope. Every enabled MCD yields exactly one reading.

## Flags (`worker_config.yaml`, `checklists/MCDn.yaml`)

`off`, `shadow` or `live` (strings: an unquoted `off` is a YAML boolean and is refused). **Checklist items 1 to 6 allow `shadow`; all nine
allow `live`** (Q7). A flag above what its checklist allows stops the worker from starting. Two more rules, mine, listed in the hand-off:
no MCD may be higher than an MCD it depends on, and no channel MCD may be higher than MCD0. The registries carry the same flag; a test
fails when they differ from `worker_config.yaml`.

## Request and result

`python -m mcd_worker.cli [--config PATH] [--engine-dir PATH]`, run from `davintrade-stack-d-and-e/engine-1-5-new/`.

Request on stdin, one JSON object, only these keys:

```json
{
  "request_version": "mcd-cycle-request/1",
  "bundle": { "...": "CycleInputs.to_dict()" },
  "retuning_enforced": false
}
```

`retuning_enforced` is optional, defaults to `false`, and must be a JSON boolean. The sensor worker maps `SENSOR_RETUNING_ENFORCED` to it
(exactly `true` is true). The flags are never part of a request.

Result on stdout, one line, `mcd-cycle-result/1`: `symbol`, `cycle_slot`, `inputs_sha256` (the hash of the bundle's canonical text, keys
sorted, no spaces), `bundle_canonical_json` (that text itself, as a JSON string: the bundle as it was received, whatever RETUNING enforcement
did to what the evaluators saw; `null` with `inputs_sha256` when the bundle cannot be written as JSON), `retuning` (`observed`, `enforced`,
`applied`), `flags`, `order`, `gate`, and one entry per MCD run in `results`:
`mcd_id`, `flag`, `evaluator_version`, `status`, `state_code`, `bias`, `envelope_json` (the exact canonical text to store),
`envelope_sha256`, `evaluator_envelope_sha256` (before inheritance), `inherited_reasons`, `guard_problems`. Only `runtime` (Python version,
timings) differs between two runs of the same bundle.

`bundle_canonical_json` is what the gateway's sensor worker stores for replay (`market_cycle_inputs`): JavaScript and Python write a float
differently (`1e-05` against `0.00001`), so the worker never rebuilds the text, it stores this one. It is an additive field of
`mcd-cycle-result/1` (part 4, Davin's decision 3 option a) and is **not** part of `CycleResult.deterministic_dict()`, so the stored
`fixtures/*.cycle.json` stay as they were (they already have the bundle beside them and its hash inside).

Exit status: `0` a result was written; `2` the request or the configuration is wrong (stderr names every problem, stdout stays empty);
`1` an unexpected error. Logs are JSON lines on stderr, keyed by `cycle_slot` and `mcd_id`.

## Files

Runtime files (the part 4 sync copies these and nothing else of this folder): `__init__.py`, `cli.py`, `cycle_runner.py`, `errors.py`,
`flags.py`, `guards.py`, `inheritance.py`, `registry.py`, `worker_config.yaml`, `README.md` and `checklists/`. The `statistics/` package is outside the
per-cycle runtime (see the section below).

Not runtime: `tests/`, `fixtures/` (one shared bundle per slot for v1, v3 and v4, its source note, and the expected cycle) and `tools/`
(`build_fixtures.py`, `mutation_check.py`).

## Statistics (build step 3, part 6)

`statistics/` is not part of the per-cycle runtime: it measures what price did after past occurrences of a state, for the `state_statistics`
table (architecture section 2.8, ADR-022), and runs when the point-in-time history is replayed (step 3, B4). Pure functions, standard library
only, no I/O: `outcomes.py` (the forward move and the adverse excursion of one occurrence at 2 h or 12 h, from closed M5 bars: Davin's arithmetic
of 2026-10-03, with an outcome only when every bar of the window exists) and `aggregate.py` (`n`, the median and the quartiles; **no figure below
`MIN_SAMPLE` = 30 outcomes**; one row per MCD, evaluator `MAJOR.MINOR`, `config_hash` text, state and horizon). `opposing_level_rate` stays `None` until
step 4. The gateway's `state-statistics.writer.ts` stores the rows; `state-statistics.reader.ts` is the only reader. The folder is named
`statistics`, so run Python from `engine-1-5-new/`, never from inside `mcd_worker/` (a working directory of `mcd_worker/` would put it ahead of the
standard library's module of that name). Its golden output is `tests/data/state-statistics.rows.json` (`WRITE_FIXTURES=yes` regenerates it).

## Commands

Run from `davintrade-stack-d-and-e/engine-1-5-new/` (pytest is not installed; the suites use `unittest`):

```bash
python -B -m unittest discover -s mcd_worker/tests -t .
python -B -m mcd_worker.tools.build_fixtures --check
python -B -m mcd_worker.tools.mutation_check
```

`build_fixtures` needs the replica workbooks and `openpyxl`; `mutation_check` mutates a scratch copy and never the checkout.

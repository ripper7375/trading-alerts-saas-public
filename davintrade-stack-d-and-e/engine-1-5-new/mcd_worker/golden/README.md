# Golden scenarios (build step 4, part 7)

The first golden scenarios of architecture 7.7: cycles whose expected outputs Davin approves, file by file. They guard the layer from the sensors' readings to the
entry zones (plan decision D13). The rest of the 24 (Report 1, Report 2, the account and clock edges) belongs to build steps 5 to 7 and is not here.

[`INDEX.md`](INDEX.md) lists the scenarios, what each decided for the Day Trader and the Scalper, and which rows of the rules table the set covers.

## One folder per scenario

| File            | What it is                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scenario.json` | The input. A **real** cycle (`"kind": "cycle"`) names a stored bundle of `../fixtures/`: the runner makes the sensors' readings and then synthesis. A **synthetic** one (`"kind": "readings"`) gives the sensors' readings and the few bundle facts synthesis reads |
| `expected.json` | The exact expected output: the sensors' canonical envelopes with their hashes, the `synthesis` section (the two `syn-output/1` readings, the entry zones, their hashes) and the modal pills. Compared byte for byte                                                 |
| `review.md`     | The same as tables, to read before signing. Generated                                                                                                                                                                                                               |
| `approval.json` | The sign-off. Generated as `PENDING`; **only Davin changes it to `APPROVED`**                                                                                                                                                                                       |

A synthetic scenario runs only the synthesis layer, on sensor readings built through the kit (they validate against `mcd-output/1`); it does not run the evaluators.
Its numbers are made up to be internally consistent, not taken from a market. Each carries a bar still forming whose close differs from the last closed one, to show that
the reference price is the closed bar's (ADR-011, decision D4).

## How to review one

Open `review.md`. Check, in this order: the sensors' states and statuses are what the scenario says it is about; the rule, branch, bias, archetype and trend relation are what
the table in architecture 3.4 (as `draft-1`, with the readings of decision D1) says for those states; the status and its reason codes follow from the sensors the matched
row read (3.3 mechanic 4); the zones are where 3.6 puts them (reference price, range, invalidation at least $13 away, runway and its ratio, order); the pills are the zones'
reference prices in rank order. Approving a scenario says "for this input, this output is right under these rules". It is not a view on whether the rule is a good trade.

## How to sign one off

Edit three fields of the scenario's `approval.json` and leave the rest alone:

```json
"status": "APPROVED",
"approved_by": "Davin",
"approved_on": "2026-10-10",
```

The file already holds the SHA-256 of `scenario.json` and of `expected.json` as they stood when it was generated. `check` refuses an approval whose hashes no longer match, and
`record` puts any scenario whose input or expected output changed back to `PENDING` with a note, so a scenario cannot stay approved after it changed.

## Commands

Run from `davintrade-stack-d-and-e/engine-1-5-new/` (the tool needs only the standard library and what the worker already needs):

```bash
python -B -m mcd_worker.tools.golden list
python -B -m mcd_worker.tools.golden check
python -B -m mcd_worker.tools.golden check --require-approved
python -B -m mcd_worker.tools.golden record
```

`list` shows each scenario's outcome and approval status. `check` rebuilds every scenario and compares it with the stored files, writing nothing; with
`--require-approved` it also fails while any scenario is `PENDING` (the release gate of 7.7). `record` rewrites the generated files and never writes `APPROVED`.
The suite `mcd_worker/tests/test_golden.py` and the gateway spec `railway-gateway/test/golden-scenarios.spec.ts` run the same comparison.

## When a golden changes

A change to a sensor, to a rule (a new `draft-N.yaml`, never an edit of `draft-1`), to the zone parameters or to the synthesis code makes `check` fail. Do not edit a golden file by
hand. Read what changed (`git diff` of `expected.json`), decide whether the new output is right, run `record`, and ask Davin to approve the scenarios that changed. A fix that only
repairs a bug of the tool needs no new approval if `check` still passes.

## What the set covers

Every row of the rules table decides at least one reading, for each trader type that row applies to, and so does every branch of every row (the two tables of `INDEX.md`). Two
cells cannot be reached by any input and are not scenarios: a Scalper cannot reach row 5 or "no match" with a usable MCD2, because rows 2, 3s and 4 cover every state of MCD2
(`synthesis/synthesis.md`, section 7; pinned by `tests/test_synthesis_engine.py`). Also covered: a VALID reading, CAUTIONARY readings from an MCD0 defect and from MCD3's modifier,
an INVALID and a STALE stand-aside, NEUTRAL, stand-aside from a range and from a conflict, zones with each invalidation basis (`LEVEL`, `MINIMUM_STOP`, `NO_LEVEL`), a level just
above the entry, no zones and why (`NOT_DIRECTIONAL`, `NO_ZONE_SOURCES`), and partial sensors (only MCD2 running).

## Adding a scenario

Make a folder `NN-short-words` with a `scenario.json` (copy one; the tool refuses unknown or missing keys), run `record`, read the new `review.md`, and ask for the approval.
The set's coverage tests will tell you if a row you meant to cover is still missing.

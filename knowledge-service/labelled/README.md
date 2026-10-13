# The labelled question set

Build step 6, part 9 (plan part 9, ADR-044, decision D15; architecture 4.8 and 4.11 items 3 and 7). This folder is what the release gate is
measured on. It sits inside `knowledge-service/` because the Docker build runs `gate replay` on it, and the image is built from this folder alone.

| Path                                           | What it is                                                                                                                                                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base.en-US.json`                              | the English base: 40 questions, five for each of eight intents, eight of them noisy, each hand-labelled; and the adversarial slice (13 cases), judged apart from the percentages                                                 |
| `locales/<locale>.json`                        | the same 40 in each of the other 18 locales (the 19 interface locales of `lib/i18n/languages.ts`). A translation holds only `id` and `question`: every label comes from the base. Drafts, `translation_status: DRAFT`          |
| `approval.json`, `review.md`                   | the sign-off of the English base. `review.md` is generated (content only); `approval.json` is written PENDING by `gate labelled-review` and APPROVED only by a person. The translations are not part of the approval             |
| `current-run.json`                             | names the recorded run that counts (its fingerprint)                                                                                                                                                                             |
| `runs/<fingerprint>/manifest.json`, `<locale>.json` | one recorded run: which model, which prompt, which glossary, which set, and for every question what the Understand step returned and what the real pipeline did with it                                                  |

## A question

```json
{
  "id": "q-06", "slice": "core", "question": "Where is a good place to enter a long on gold?",
  "expected_intent": "ENTRY_TIMING", "trader_type": "DAY_TRADER", "scenario_id": "golden-01",
  "expected_m_star": ["MCD1", "MCD2", "MCD3"], "expected_warnings": ["MCD3"],
  "expected_symbols": ["XAUUSD"], "expected_timeframes": [],
  "expected_chunk_ids": ["d3-zones-and-runway.what-an-entry-zone-is", "..."], "label_note": "why these labels"
}
```

The labels were written by hand from the golden cycles (`mcd_worker/golden`) and the corpus, **not** from the router or from a search result, so a
router that disagrees with a label is a finding and not a circle. `expected_warnings` are the sensors that say STAND_ASIDE or oppose the reading;
they are always part of M\*. A question that retrieves has one to four expected chunks; Report 2 and Out of scope have none.

## The bars

| Bar                                                                       | Where it is checked                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| intent match and M\* match at least 90%, in every locale                  | `__tests__/lib/intake/labelled-gate.test.ts`                                   |
| every locale within 5 points of English (intent, M\*, recall)             | the same, and `gate replay`                                                    |
| stand-aside and opposing sensors present in M\*: 100%                     | the same                                                                       |
| out-of-scope questions refused as out of scope: 100% (D15 c)              | the same                                                                       |
| in-scope questions refused: at most 5% (D15 c, a starting value)          | the same                                                                       |
| recall@4 at least 0.80 on the real index, in every locale                 | `python -m knowledge.gate replay --index index --labelled labelled`            |
| the recording is current (fingerprint, base, translations, glossary)      | both halves: this one sees the glossary and the files, that one the prompt     |
| the adversarial cases are refused or neutralised, and search the same SQL | both halves                                                                    |

Recall@4 means that at least one of the chunks a complete answer needs is among the first four hits (the expansions are not counted). The share of
the expected chunks found is printed too, as information.

## The recorded run

A run is named by its fingerprint, `sha256(model_id:prompt_version:glossary_version:base_set_sha256)` cut to 32 characters, where the base-set
hash is the SHA-256 of the canonical JSON of `base.en-US.json` (the same on every line ending). A change to the model, the prompt, the glossary or
the English base makes the committed run **stale**, and both halves of the gate refuse it. A change to a translation makes that locale's recording
stale (the manifest holds each locale file's hash).

The manifest says what kind of run it is:

- **`LIVE`** — a real model answered. Made with `INTAKE_UNDERSTAND_API_KEY` and `INTAKE_UNDERSTAND_MODEL` in the environment:

  ```bash
  npx tsx scripts/intake/eval_understand.ts --live            # a dry run: calls the model, prints the table, writes nothing
  npx tsx scripts/intake/eval_understand.ts --live --write    # writes runs/<fingerprint>/ and current-run.json
  ```

  About 770 calls (19 locales of 40 questions and the 13 adversarial cases, minus the five refused at the door). The cost is not measured by the
  adapter (it returns the model's text only): read it from the provider's dashboard for the run and write it in `cost_usd` of the manifest, then
  run the gate. A new LIVE run is a new directory; the old one stays as a measurement.

- **`STAND_IN`** — no model was called. The answers are the hand labels (the intent, symbols and timeframes of the base; the base English
  question as the pivot, in every language). It is deterministic and reproducible (`eval_understand.ts --check-stand-in`), it proves the replay, the
  router, the scope check and the retrieval, and **it measures nothing about the model or about translation**: every locale gets the same pivot, so
  the per-locale comparison is equal by construction. The gate prints which kind it ran on, and `gate replay --require-live-run` refuses a stand-in.

```bash
npx tsx scripts/intake/eval_understand.ts --stand-in --write   # make the stand-in run
npx tsx scripts/intake/eval_understand.ts --report              # measure the committed run (the TypeScript half) and print a table
python -m knowledge.gate labelled-review --labelled labelled    # regenerate review.md and approval.json after a change to the base
python -m knowledge.gate replay --index index --labelled labelled [--require-approved] [--require-live-run]
```

## Changing the set

Change a word of the English base and three things follow: `labelled-review` puts the approval back to PENDING, the committed run is stale, and
the translations may need the same change. Make the run again (`--stand-in --write`, or `--live --write`), regenerate the review, and Davin reads it.

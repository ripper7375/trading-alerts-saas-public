# The real knowledge corpus

This folder is where the real corpus lives: `D1/` to `D5/`, one Markdown file per topic, each starting with front matter (see
`knowledge/frontmatter.py`). It is drafted from the specs and approved by Davin one area at a time (ADR-042). Written (build step 6
parts 7 and 8): **D1 Foundations** (`D1/`, four files), **D2 Single-MCD playbooks** (`D2/mcd0.md` to `D2/mcd3.md`, one per sensor, a section for
every state code of its registry), **D3 Synthesis** (`D3/`: the rules of `draft-1`, the archetypes, the sensor conflicts and the MCD3 modifiers, the
entry zones, invalidation and runway), **D4 Risk** (`D4/`: Engine 4 in words, sizing, structural stops, half risk, the profile and the underflow
help) and **D5 Governance** (`D5/`: the invariants, the single-order scope, the news blackouts, the assistant's role).

```
corpus/
  D1/ D2/ (D3/ D4/ D5/)   the knowledge: Markdown with front matter
  source-map.json         for every chunk, the specification files and sections it was written from (by hand)
  review/_<area>.md       the review tables, generated:  python -m knowledge.gate review --corpus corpus
  approval/<area>.json    the sign-off per area, PENDING until a person edits it
```

Rules that hold:

- **Nothing here is a test fixture.** The tests have their own corpus under `tests/fixtures/corpus/`, marked `TEST_ONLY`. A test corpus is
  never copied or linked here, and the production build (`--require-real`) refuses a folder that holds a `TEST_ONLY` file.
- **Do not reformat these files.** The index build id is a hash of their text, and an approval holds the hash of what was read;
  `.prettierignore` keeps the formatter away. `README.md` files, files starting with `_` and everything under `review/` and `approval/` are
  not corpus.
- **One section is one chunk**, 200 to 450 tokens (counted with the embedding model's tokenizer) and under 4,000 characters. A section under
  200 tokens would be merged into its neighbour and a longer one split; the tests fail if either happens, so write each section to size.
- **A playbook section covers one state**, under a plain-words `##` heading, and opens with `**State code:** `CODE`.`, the regime word and the
  sensor's own bias, then four parts in this order: **What it says.** · **What it does not say.** · **With the other sensors.** ·
  **What to watch next.** The bias and the regime word are checked against the registry; the code is how the review tables and the coverage
  test find the section.
- **English prose only, plain ASCII. No live numbers**: no price, date, clock time or cycle from any day; refer to P_ref, the baseline,
  UOEDT and LOEDT. A threshold that a spec fixes (the five degree band, 96 bars, 80%, 75%, the pillar bounds) may be quoted, and a test
  compares each one with the parameter file it comes from.
- **No probabilities, grades, win rates or confidence words** (ADR-035), no advice wording and no instruction (the wording backstop,
  `knowledge/wording.py`, fails the build; the tests are stricter and also refuse the words "probability", "chance", "odds" and
  "confidence"). The corpus describes market structure and what a state does not claim; it never tells anyone what to do.
- **D3 to D5 follow the same rules, with their own figures.** D3 quotes only the zone parameters (10%, $0.50, $13, five zones) and the cap of
  2.50x; D5 quotes no figure but durations that a test compares with `lib/engine4/blackout.ts`; D4 may quote dollar figures, and every one of them is
  derived by a test from an approved worked example (`__tests__/lib/engine4/worked-examples/`), from the profile defaults in `lib/engine4/profile.ts` or
  from the plain-English guide's arithmetic: a figure that no source accounts for fails the build of the tests. Every rule id, branch id and modifier id
  of `draft-1.yaml` must be explained in D3 with its fixed reason texts and summary line.
- **Every chunk has an entry in `source-map.json`.** Add it when you add a section; `gate review` refuses a chunk without one.

To change the corpus: edit the file, run `python -m knowledge.gate review --corpus corpus` (the area goes back to PENDING and its table is
rewritten), run the tests, and commit the files together. Approving is a person's edit of `approval/<area>.json`.

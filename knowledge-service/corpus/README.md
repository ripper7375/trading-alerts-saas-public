# The real knowledge corpus

This folder is where the real corpus lives: `D1/` to `D5/`, one Markdown file per topic, each starting with front matter (see
`knowledge/frontmatter.py`). It is drafted from the specs and approved by Davin one area at a time (ADR-042). Written so far (build step 6
part 7): **D1 Foundations** (`D1/`, four files) and **D2 Single-MCD playbooks** (`D2/mcd0.md` to `D2/mcd3.md`, one per sensor, a section for
every state code of its registry). D3, D4 and D5 are part 8.

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
- **Every chunk has an entry in `source-map.json`.** Add it when you add a section; `gate review` refuses a chunk without one.

To change the corpus: edit the file, run `python -m knowledge.gate review --corpus corpus` (the area goes back to PENDING and its table is
rewritten), run the tests, and commit the files together. Approving is a person's edit of `approval/<area>.json`.

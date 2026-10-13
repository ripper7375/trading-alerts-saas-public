# The real knowledge corpus

This folder is where the real corpus goes: `D1/`, `D2/`, `D3/`, `D4/` and `D5/`, one Markdown file per topic, each
starting with front matter (see `knowledge/frontmatter.py`). It is written in build step 6 parts 7 and 8, drafted from the
specs and approved by Davin one domain at a time (ADR-042).

It is empty on purpose until then. Two rules hold:

- **Nothing here is a test fixture.** The tests have their own corpus under `tests/fixtures/corpus/`, marked `TEST_ONLY`.
  A test corpus is never copied or linked here, and the production build (`--require-real`) refuses a folder that holds a
  `TEST_ONLY` file.
- **Do not reformat these files.** The index build id is a hash of their text, and an approval holds the hash of what
  was read; `.prettierignore` keeps the formatter away. `README.md` files and files starting with `_` are not corpus.

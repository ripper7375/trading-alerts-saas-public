---
type: Concept/SessionHistory
status: archived
period: 2026-10-01..2026-10-31
source: .claude/state/current-state.md (rotated entries)
tags: [history, sessions, 2026-10]
---

# Session history — October 2026

Entries rotated out of `current-state.md` by [session-lifecycle](../../protocols/session-lifecycle.md), verbatim, newest first (only the relative link prefixes are adjusted for this folder's depth).

Back to [history index](./index.md).

<!-- session 2026-10-01 mcd2-p2 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P2 for MCD2
> (steps R1 to R4): concept readback, English spec, parameters, registry and implementation plan are
> written; stopped at the STOP. P3 (build) is not started.**
> **Needs from Davin:** (1) approve `mcd2.md` and the plan, and answer Q1 to Q7 ([the hand-off](../../../docs/handoffs/2026-10-01-0343-mcd2-p2.md)
> §6; recommendations are the P3 defaults); (2) check the English readback of the two Thai boards
> (`concept.md` §3), which the builder translated; (3) then **P3 for MCD2**; (4) commit when ready (two
> staged board renames; the rest of the work is untracked or modified).
> **Changed & verified:** in `engine-1-5-new/mcd2/`: `legacy/` (byte-identical evaluator, tests, output; one
> path line edited in the test copy), `concept/` (two images, `git mv`), new `concept.md`,
> `mcd2_params.yaml`, `mcd2_registry.yaml`, rewritten `mcd2.md` and `mcd2_implementation_plan.md`.
> Legacy tests **13 OK** from `legacy/`; kit suite **215 OK** (unchanged); params load through the kit,
> nine states and D6 bias checked, `wording` checks clean on codes, regime words, templates and summaries;
> spec §6 and the params file list the same six parameters; Prettier clean. Closed-bar readings on all
> four real cycles keep the legacy state (v1 and v4, centroid and fractal).
> **Unconfirmed / found:** all four real cycles are `IN_CORRIDOR`, so the other states are synthetic
> only (the untracked replica batches v2/v3 were not scanned); the statistics fit windows may include the
> still-open bar (inherited, see [waiting-on](../waiting-on.md)); architecture §2.5 and §3.4 still name the
> old regime words (Q7). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (the
> P6 re-check) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd-step0-g1-g3-commit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed as "Step 0: shared MCD kit
> (mcd_common)" (hash in `git log`), not pushed. G1 to G3 on the kit are fixed with four new tests (215
> pass, 211 before); standard PATCHed to 1.0.2 for the unknown `data_status`; derived words stay allowed.**
> **Needs from Davin:** (1) the commit left out, on purpose, the Stack C `.mq5`/`.ex5` change
> (`InpTolerancePercent` 0.50 to 5.00, not made by this session), the two Advisor docs, the v2 to v4
> generators and raw exports, the other replica batches and the `.pptx` files: say which to commit
> ([the hand-off](../../../docs/handoffs/2026-10-01-0220-step0-kit-commit.md) §6 and §7); (2) G4 (the wrong
> "CRLF" sentence in the fix hand-off) was not in the order and is unchanged; (3) next work: **P2 for
> MCD2** (needs D4 to D7 at its STOP).
> **Changed & verified:** four tests (G1 in `test_shared_checks.py`, G2a and G2b in
> `test_cycle_inputs.py`, G3 in `test_wording_and_budget.py`); a two-line comment in `wording.py`;
> standard §6 and §12 (version 1.0.2); the `market_data_v6_replicated_v4.xlsx` fixture is now committed
> because the kit's tests read it. From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests
-t .` **215 OK, 0 skipped**. The five mutants that survived the re-check (G1 twice, G2a, G2b, G3) are
> all killed now, kit restored by bytes. Standard is Prettier-clean; new table cells fit the old widths.
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked, see [waiting-on](../waiting-on.md)). Not run: `test:ci`, `tsc`, lint, build (no app
> code touched). The oldest entry (the F1 to F6 fixes) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd-p6-recheck-kit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 on the
> shared kit `mcd_common/`, a fresh re-check of the lines changed for F1 to F6: all six fixes hold,
> 211 tests pass and the kit is unchanged. Four small findings G1 to G4 (three test gaps, one wrong
> sentence in the fix hand-off), none blocks P2.**
> **Needs from Davin:** (1) whether to fix G1 to G4 before P2 (recommended: one very short builder step
> for G1 to G3, about four small tests); (2) still open from the fix hand-off: whether derived words
> (`PROBABLE`, `LIKELY`, `SAFETY`) are banned too, and whether to PATCH standard §6 and the §12 T10 row
> for the unknown-status failure; (3) read [the hand-off](../../../docs/handoffs/2026-10-01-0156-p6-recheck-kit.md)
> §4.3 and §6; (4) next work: **P2 for MCD2** (needs D4 to D7 at its STOP); (5) commit when ready
> (`mcd_common/` and `docs/handoffs/` are untracked).
> **Changed & verified:** nothing in the kit (read-only check); only the hand-off, this entry, and the
> oldest entry rotated into the new `history/2026-10-sessions.md`. From `engine-1-5-new/`:
> `python -m unittest discover -s mcd_common/tests -t .` **211 OK, 0 skipped**. Own probes, 57 checks, all
> pass: F1 to F5, and the P1 "Done when" and Part B2 items on both workbooks and the standard's text.
> Own mutation pass on a scratch copy: 34 mutations on the changed lines, 29 killed, 5 survived (1
> equivalent; the other 4 are G1 to G3).
> **Unconfirmed / found:** G4: the fix hand-off says the kit files are CRLF; measured with Python they
> are LF only, with no mixed endings (do not check line endings with `grep` in Git Bash). The forming bar
> inside the statistics fit windows is still unverified (MQL5 source not checked, see
> [waiting-on](../waiting-on.md)). MCD2's legacy commentary "safely within the EDT corridor" now fails
> T11 (for P2). Not run: `test:ci`, `tsc`, lint, build (no app code touched).

<!-- session 2026-10-01 mcd-p6-fixes-kit -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. The six P6 findings
> F1 to F6 on the shared kit `mcd_common/` are fixed with Davin's choices for F4 and F5; 211 tests
> pass (192 before).**
> **Needs from Davin:** (1) read [the hand-off](../../../docs/handoffs/2026-10-01-0040-p6-fixes-kit.md) §6:
> the F5 inflection list is a little wider than "plural, -ED, -LY" (adds `-ING`, comparatives,
> `CONFIDENT`, `GUARANTEE`), and derived words such as `PROBABLE` or `LIKELY` are still not caught;
> standard §6 does not yet name the new cycle failure; (2) next work: a fresh session for **task P6
> on the kit**, re-checking only the changed lines, then **P2 for MCD2** (needs D4 to D7 at its
> STOP); (3) commit when ready (`mcd_common/` is still untracked).
> **Changed & verified:** F1 `freeze()` now freezes and copies the contents of a `MappingProxyType`;
> F2 preflight docstring and README say the checks can raise on a corrupt bundle and every evaluator
> needs `never_throws`; F3 budget comment says 3.6 MB; F4 `cycle_check` gives INVALID + `SANITY_FAILED`
> for a `data_status` outside the four values (T10 gets a ninth corruption); F5 `BANNED_INFLECTIONS`
> in `wording.py`, whole-word matching kept; F6 two missing tests (earlier upstream reason kept, `-0.0`
> in `details`). From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests -t .`
> **211 OK, 0 skipped**; own mutation pass on a scratch copy: 11 mutations, 11 killed;
> `BANNED_WORDS` still equals standard §7.4; provider cut-offs unchanged (last closed M5 bar 20:50).
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked, see [waiting-on](../waiting-on.md)). Re-freezing a frozen 3,000-bar bundle now
> costs about 0.7 s (construction and `dataclasses.replace` only, not evaluation). Not run: `test:ci`,
> `tsc`, lint, build (no app code touched).

<!-- session 2026-10-01 mcd-p6-kit-check -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 on the
> shared kit `mcd_common/`: every Part B2 and P1 "Done when" item holds and the kit is unchanged; six
> small findings (F1 to F6), none blocks P2.**
> **Needs from Davin:** (1) F4: what an unknown `data_status` should produce (recommended: INVALID +
> `SANITY_FAILED`); (2) F5: whether the wording check T11 should also catch inflections of the banned
> words, such as `PROBABILITIES` or `graded` (recommended: yes); (3) whether to fix F1 to F6 before P2
> (recommended: yes, a short builder session, then a fresh re-check of those lines); (4) read
> [the hand-off](../../../docs/handoffs/2026-10-01-0015-p6-kit.md) §4 to §6; (5) commit when ready
> (`mcd_common/` is still untracked).
> **Changed & verified:** nothing in the kit (read-only check); only the hand-off report and this
> entry. From `engine-1-5-new/`: `python -m unittest discover -s mcd_common/tests -t .` **192 OK, 0
> skipped**. Own scripts: provider cuts v1 at M5 20:50 / M15 20:30 and v4 at 23:10 / 23:00; no live-bar
> or last-price statistics field in any bundle row; schema file equals standard Appendix B and rejects
> an extra top-level field; reason codes, banned words, `CycleInputs` fields and pre-flight order equal
> the standard. Own mutation pass on a scratch copy: 26 mutations, 23 killed, 2 real test gaps (F6),
> 1 equivalent mutant.
> **Unconfirmed / found:** the forming bar inside the statistics fit windows is still unverified (MQL5
> source not checked; `window_high`, `window_low`, `window_range`, `breach_*` and `max_excursion_*`
> are the same class, see [waiting-on](../waiting-on.md)). Not run: `test:ci`, `tsc`, lint, build (no
> app code touched).

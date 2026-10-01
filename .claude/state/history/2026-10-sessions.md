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

<!-- session 2026-10-01 mcd1-p2 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`. (1) MCD2 closed and committed
> (`ecbb3f94`, "Retrofit MCD2: evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"). (2) MCD task P2
> for MCD1 (steps R1 to R4): concept readback, English spec, parameters, registry and plan written; stopped at
> the STOP. P3 is not started and the MCD1 files are NOT committed.**
> **Needs from Davin:** (1) answer [the hand-off](../../../docs/handoffs/2026-10-01-0457-mcd1-p2.md) §6, **D6
> first** (bias per MCD1 state: no default, the registry holds `DAVIN` for six states), then Q1 to Q7, check the
> English readback (`concept.md`), and approve `mcd1.md` and the plan; (2) say when to commit the MCD1 P2 files;
> (3) keep or change the five lines added to the repo-wide `.prettierignore` (in the MCD2 commit); (4) then **P3
> for MCD1**. `active-tasks.md` is left in place with the STOP item open.
> **Changed & verified:** MCD2: one test for H1 to H3 (93 tests; the four tier-3 mutants die on a scratch
> mirror), standard 1.0.3 (`flag: 'off'` in Appendix C.2), walkthrough C1 "Renamed (D5)", manifest at 93 tests
> with the sign-off, committed by explicit path (31 files). MCD1, in `engine-1-5-new/mcd1/`: `legacy/`
> (byte-identical evaluator and output; one path line edited in the test copy), new `concept.md`,
> `mcd1_params.yaml`, `mcd1_registry.yaml`, rewritten `mcd1.md` and `mcd1_implementation_plan.md`. From
> `engine-1-5-new/`: `python -m unittest discover -s mcd2` **93 OK** (also on the committed tree); the kit
> **215 OK**; the legacy tests **13 OK** for MCD1 and MCD2. Params load through the kit; nine states, wording
> checks, spec against registry and params all clean; Prettier clean. Closed-bar readings keep the legacy
> state on all three real cycles (v1 `non_b`: `MCD1_DOWN_UPPER_BREAKOUT`; v4 `non_b`: `MCD1_DOWN_IN_CORRIDOR`;
> v4 `non_a`: `MCD1_SIDEWAYS_LOWER_BREAKDOWN`), so three of nine states have real examples.
> **Unconfirmed / found:** the pre-commit hook (`lint-staged` + prettier) reformatted the one-line canonical
> JSON fixtures of the first MCD2 commit and broke two replay tests on the committed tree; fixed with
> `.prettierignore` entries, regenerated files and an amend of the local commit (details: hand-off §7, gotchas
> file). The forming bar inside the statistics fit windows is still unverified ([waiting-on](../waiting-on.md));
> MCD1 reads the same fields. 17 old `lint-staged automatic backup` stashes sit in `git stash list` (not from
> this session, untouched). Not run: `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry
> (MCD2 P3) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P6 for MCD2: a
> fresh independent check of the retrofit (evaluator 2.0.0) against its manifest. No line of A1 to A26
> fails (20 pass, A15 not applicable, 5 not yet due); three low test-gap findings H1 to H3. Nothing in the
> MCD2 folder or the kit was changed.**
> **Needs from Davin:** (1) answer [the hand-off](../../../docs/handoffs/2026-10-01-0430-mcd2-p6.md) §7: sign off
> stage 3 for MCD2 (I would not hold it for H1 to H3) and say whether to add the one short test for H1 to H3;
> (2) the three items still open from the P3 hand-off §6: PATCH the standard to 1.0.3 for `flag: 'off'`, what
> and when to commit, walkthrough C1 "Proposed renames"; (3) next work: **P2 for MCD1** (needs D6 at its STOP).
> **Changed & verified:** nothing in the MCD2 folder, the kit, the standard or the architecture; this report,
> the state entries and two gotchas. From `engine-1-5-new/`: `python -m unittest discover -s mcd2` **92 OK, 0
> skipped**; the kit **215 OK**; the 13 legacy tests OK (from `mcd2/legacy/`). Legacy evaluator and output are
> byte-identical to HEAD; the manifest's legacy baseline, tokens (355, 355, 359, 353), time and SHA-256 values
> all reproduce; output and fixtures validate against the schema taken from the standard; no banned word in any
> code, template or summary; Prettier clean. Own mutation pass on a scratch mirror: 40 mutants, 36 killed; the 4
> survivors are the three gaps H1 to H3 (tier-3 window edges, strict `>` on older bars, raw bars in tier 3);
> direct probes show the evaluator is right in each case.
> **Unconfirmed / found:** a breakout under half a cent reads "0.00 above UOEDT" (accurate, may read oddly;
> hand-off §5); the forming bar inside the statistics fit windows is still unverified ([waiting-on](../waiting-on.md));
> six states are still tested with synthetic bundles only (replica batches v2 and v3 not scanned); an
> unstaged rename of the MCD3 board image is in the tree (not this work). Not run: `test:ci`, `tsc`, lint,
> build (no app code touched). The oldest entry (MCD2 P2) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd2-p3 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed. MCD task P3 for MCD2
> (steps R5 to R10): evaluator 2.0.0 built on the kit; 92 tests pass; manifest, fixtures and the
> architecture records written. Flag `off`, registry status `Retrofit (2.0.0)`.**
> **Needs from Davin:** (1) a fresh session for **P6 on MCD2**, then **P2 for MCD1**; (2) the standard's
> Appendix C.2 shows `flag: off`, which YAML loads as `false`: PATCH it to 1.0.3? ([the hand-off](../../../docs/handoffs/2026-10-01-0410-mcd2-p3.md)
> §6a); (3) what to commit and when (§6b: P2 and P3 left the MCD2 folder, the architecture doc,
> `docs/handoffs/` and `.claude/state/` uncommitted, plus two staged image renames); (4) optional: walkthrough
> C1 still says "Proposed renames" (§6c).
> **Changed & verified:** `mcd2_evaluator.py`, `test_mcd2_unit_tests.py`, `fixtures/`, `mcd2_output.json`,
> the manifest, the registry (`flag` quoted), approvals in the spec, plan and concept; architecture §2.13
> (2.0.0), §2.5 and §3.4 (renamed regime words). From `engine-1-5-new/`: `python -m unittest discover -s mcd2`
> **92 OK**; the kit **215 OK** (untouched); the 13 legacy tests OK. Mutation pass on a scratch copy: 28 of 28
> killed (one survivor closed with a test). Largest envelope 359 tokens, evaluation about 9 ms.
> Legacy and new side by side: the four real cycles and all nine states keep their state, every difference
> explained. Prettier clean.
> **Unconfirmed / found:** the statistics fit windows may include the still-open bar (inherited, see
> [waiting-on](../waiting-on.md)); all four real cycles are `IN_CORRIDOR`, so six states are synthetic only
> (the untracked replica batches v2/v3 were not scanned). Not run: `test:ci`, `tsc`, lint, build (no app code
> touched). The oldest entry (Step 0 commit) was rotated into `history/2026-10-sessions.md`.

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

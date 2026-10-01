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

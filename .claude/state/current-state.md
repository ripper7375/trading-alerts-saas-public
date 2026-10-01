---
type: Concept/AgentState
status: active
updated_at: 2026-10-01
last_numbered_session: '14-3 (CLOSED SUCCESSFUL 2026-08-30) — Phase 14 complete'
next_numbered_session: '12-0 (Phase 12, Stack D) — blocked on the handover-prompt re-draft, see waiting-on.md'
git_branch: main
max_sessions: 2
related_docs:
  - ./waiting-on.md
  - ./history/index.md
  - ../protocols/session-lifecycle.md
---

# Active session state

Holds **at most 2** session entries (newest first). When you add a third, move the oldest into
`history/YYYY-MM-sessions.md` per [session-lifecycle](../protocols/session-lifecycle.md).
Every entry older than these two is in [history](./history/index.md).

## Where the project stands

- **Playbook position:** last numbered session is **14-3** (Cutover + Runbook), closed
  2026-08-30; **Phase 14 (Web Chat) is complete**. Every session since then has been an
  ad-hoc session ("phase/session unchanged"). Next numbered work is **Phase 12 / Session 12-0**
  (`docs/migration-orders/12-0-decisions-and-contracts.migration-order.md`), gated on the
  Advisor re-drafting the Phase 12 handover prompt (see [waiting-on](./waiting-on.md)).
- **Status correction (2026-09-26, OKF refactor):** round 5 (now in [history](./history/2026-09-sessions.md)) says "NOT committed, NOT
  deployed". It has since been committed and merged to `main` via PR #474 (`31c2e8d4`).
  Deployment was not verified during the refactor.
- **OKF fine-tuning for Opus 5.5 (2026-09-27, docs only):** non-negotiable 8 (settled answers),
  `active-tasks.md` checklist + action-first close entry in
  [session-lifecycle](../protocols/session-lifecycle.md), new
  [subagent-orchestration](../protocols/subagent-orchestration.md); `tsc`/lint clean.
- **MCD kit (2026-10-01):** Step 0 is committed ("Step 0: shared MCD kit (mcd_common)"). P6 findings F1
  to F6 and the re-check findings G1 to G3 are fixed (215 tests); standard 1.0.3 documents the unknown
  `data_status` (INVALID + `SANITY_FAILED`) and quotes `flag: 'off'` in Appendix C.2; derived words stay
  allowed. G4 (a wrong sentence in the fix hand-off) is open. **MCD2 is retrofitted to evaluator 2.0.0,
  checked by P6, signed off by Davin and committed (`ecbb3f94`).** **MCD1 is retrofitted to evaluator 2.0.0
  (spec, plan, D6 and Q1 to Q7 approved by Davin; 105 tests), checked by P6 (no A line fails; F1 to F3 closed
  by one test and one alignment), signed off by Davin and committed ("Retrofit MCD1: evaluator 2.0.0, tests,
  fixtures, manifest (Stage 3 sign-off)").** Both stay flag `off`, registry status `Retrofit (2.0.0)`. **MCD3 is retrofitted to evaluator 2.0.0** (spec, plan, D10 option A, D6, D7 and Q1 to Q9 approved by Davin; 134 tests; fixtures v1, v4 and v3 with stored upstream; standard 1.0.4), checked by P6 (A22 over 600 decided by Davin: a ceiling of 670 tokens for this derived sensor; seven test gaps closed by seven tests), signed off by Davin and committed ("Retrofit MCD3: evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"). Flag `off`, registry status `Retrofit (2.0.0)`. **MCD1, MCD2 and MCD3 are all retrofitted, checked, signed off and committed.** **MCD2 and MCD1 are patched to 2.0.1 (task P7: the window counts the channel's closed bars; committed; ADR-083 drafted, Proposed).** Next: an optional fresh P6 check of the two patched MCDs, then MCD0 (Part D, content in walkthrough C4). The pre-commit prettier hook must not touch canonical JSON:
  `.prettierignore` excludes the MCD fixtures and outputs (gotchas file).
  Hand-offs: [P1](../../docs/handoffs/2026-09-30-1448-p1-kit.md),
  [P6](../../docs/handoffs/2026-10-01-0015-p6-kit.md),
  [P6 fixes](../../docs/handoffs/2026-10-01-0040-p6-fixes-kit.md),
  [P6 re-check](../../docs/handoffs/2026-10-01-0156-p6-recheck-kit.md),
  [Step 0 commit](../../docs/handoffs/2026-10-01-0220-step0-kit-commit.md),
  [P2 MCD2](../../docs/handoffs/2026-10-01-0343-mcd2-p2.md),
  [P3 MCD2](../../docs/handoffs/2026-10-01-0410-mcd2-p3.md),
  [P6 MCD2](../../docs/handoffs/2026-10-01-0430-mcd2-p6.md),
  [MCD2 close-out + P2 MCD1](../../docs/handoffs/2026-10-01-0457-mcd1-p2.md),
  [P3 MCD1](../../docs/handoffs/2026-10-01-0544-mcd1-p3.md),
  [P6 MCD1](../../docs/handoffs/2026-10-01-0628-mcd1-p6.md),
  [P2 MCD3](../../docs/handoffs/2026-10-01-0703-mcd3-p2.md),
  [P3 MCD3](../../docs/handoffs/2026-10-01-0859-mcd3-p3.md),
  [P6 MCD3](../../docs/handoffs/2026-10-01-1407-mcd3-p6.md),
  [P7 (a) MCD2 and MCD1](../../docs/handoffs/2026-10-01-1435-p7a-mcd2-mcd1.md),
  [P7 (b) MCD2 and MCD1](../../docs/handoffs/2026-10-01-1453-p7b-mcd2-mcd1.md).
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). Database traps:
  [database-traps.md](../architecture/database-traps.md).

## Latest sessions (verbatim)

<!-- session 2026-10-01 p7b-mcd2-mcd1 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed by explicit path ("Patch MCD2 and MCD1 to 2.0.1: window
> counts the channel's closed bars (task P7)"; the hash is in `git log`), NOT pushed. MCD task P7 part (b) for MCD2 and MCD1 after
> Davin confirmed the PATCH (evaluator 2.0.1): MCD2's window is `min(T_EDT - 1, 288)` and a channel under 48 closed bars is INVALID +
> `INSUFFICIENT_BARS`; MCD1 requires the channel to hold `N_micro` closed bars (`T_EDT - 1 >= N_micro`), same reason code; no real
> reading changes.**
> **Needs from Davin:** (1) nothing blocks. Q1 to Q5 of the concept sections were not answered one by one, so the build follows the
> recommended answers (floors kept as minimums, parameter `t_edt_open_bar_rows` = 1, ADR-083 drafted, MCD3 note wording): say if any
> should change; (2) settle **ADR-083** (status Proposed); (3) optionally a fresh **P6 check** of the two patched MCDs (a short one);
> (4) next work: **MCD0** (Part D with the C4 content; its open questions (a) to (f) are his). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** both evaluators, params, registries, specs, plans, manifests and `concept.md` sections of MCD1 and MCD2;
> `MCD2` 93 to **102** tests and `MCD1` 105 to **113** (`ShortChannelTests`; three MCD2 tests that pinned the old formula edited, MCD1
> only its register test); `evaluator_version` label `2.0.0` to `2.0.1` in nine stored JSON files (MCD1 and MCD2 fixture envelopes and
> outputs, MCD3's three `upstream.json`: MCD3 T14 needs them equal to the live output); architecture §2.5 and §2.13; ADR-083 and its
> index row; two MCD3 notes (wording); the `waiting-on.md` item moved to resolved; hand-off
> ([P7 (b)](../../docs/handoffs/2026-10-01-1453-p7b-mcd2-mcd1.md)). From `engine-1-5-new/`: MCD2 **102 OK**, MCD1 **113 OK**, MCD3
> **134 OK** (1 opt-in skip; the opt-in scan of the 12 real pairings OK), the kit **215 OK**, legacy **13 OK** each; pyflakes and Prettier
> clean. Own mutation pass on the new logic: 14 of 14 killed. The test run after the commit is in the terminal report, not in a file.
> **Unconfirmed / found:** with the floors kept, MCD1 changes only a reason code (`DISCONTINUITY` to `INSUFFICIENT_BARS`) and MCD2 gains
> VALID readings for `T_EDT` 49 to 288. The fit-window question stays open ([waiting-on](./waiting-on.md)); the parameter makes a
> different answer a one-value change. The "T_EDT helper" is now in three evaluators (a kit change for Davin to schedule). Not run:
> `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (MCD3 P6) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 p7a-mcd2-mcd1 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `6599c74f` is Davin's). MCD task P7 part (a) for
> MCD2 and MCD1, the short-channel window: the "Change 2026-10-01" section is written in `mcd2/concept.md` and `mcd1/concept.md`
> (PATCH, evaluator 2.0.1, no fixture output moves) and the work STOPS for Davin's confirmation. Also the cosmetic edit on line 168 of
> the MCD3 plan ("(D6 proposal)" to "(Approved)").**
> **Needs from Davin:** (1) confirm the two Change sections and answer **Q1 first: keep the 48-bar (MCD2) and 96-bar (MCD1) floors as
> minimums** (INVALID + `INSUFFICIENT_BARS` for a shorter channel; recommended), because `min(T_EDT - 1, cap)` applied literally drops
> them (a channel of 30 closed M5 bars would read VALID over 29 bars); (2) Q2 to Q5 in the sections, each with a recommendation:
> `t_edt_open_bar_rows` as a parameter, PATCH not MINOR (three MCD2 tests pin the old formula), one decision entry (ADR-083) for both,
> and the wording of two MCD3 notes; (3) what to commit. Then **P7 (b)** (spec, parameters, registry, evaluator, tests, version 2.0.1,
> manifests, architecture §2.5 and §2.13, the draft decision entry, the suites, a fresh P6), then MCD0. `active-tasks.md` is left in
> place with the STOP and part (b) open.
> **Changed & verified:** the two `concept.md` files (84 and 76 added lines, none removed) and one line of
> `mcd3/mcd3_implementation_plan.md`; the hand-off ([P7 (a)](../../docs/handoffs/2026-10-01-1435-p7a-mcd2-mcd1.md)) and these state
> files. No evaluator, test, spec, registry, parameter, fixture or output was touched. Prettier clean, LF, no Thai. A scratch probe
> (nothing in the repo): the fixtures' `T_EDT` are 314 or more on M5 and 500 or more on M15, so no fixture output moves; the committed
> MCD2 reads INVALID + `DISCONTINUITY` at `T_EDT` 288 and below, MCD1 at 96 and below (as the waiting-on item said). Not run: the test
> suites (no code touched), `test:ci`, `tsc`, lint, build.
> **Unconfirmed / found:** with the floors kept, the MCD1 patch changes only a reason code (`DISCONTINUITY` to `INSUFFICIENT_BARS`);
> MCD2 gains VALID readings for `T_EDT` 49 to 288. MCD3 reads only the upstream status, trend and angle, so the MCD1 reason-code
> change is invisible to it. The fit-window question stays open ([waiting-on](./waiting-on.md)); the patch does not depend on it. The
> "T_EDT helper" now exists in three evaluators (a kit change for Davin to schedule). The oldest entry (MCD3 P3) was rotated into
> `history/2026-10-sessions.md`.

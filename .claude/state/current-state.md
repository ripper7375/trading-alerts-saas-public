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
  fixtures, manifest (Stage 3 sign-off)").** Both stay flag `off`, registry status `Retrofit (2.0.0)`. **MCD3 is retrofitted to evaluator 2.0.0** (spec, plan, D10 option A, D6, D7 and Q1 to Q9 approved by Davin; 134 tests; fixtures v1, v4 and v3 with stored upstream; standard 1.0.4), checked by P6 (A22 over 600 decided by Davin: a ceiling of 670 tokens for this derived sensor; seven test gaps closed by seven tests), signed off by Davin and committed ("Retrofit MCD3: evaluator 2.0.0, tests, fixtures, manifest (Stage 3 sign-off)"). Flag `off`, registry status `Retrofit (2.0.0)`. **MCD1, MCD2 and MCD3 are all retrofitted, checked, signed off and committed.** **MCD2 and MCD1 are patched to 2.0.1 (task P7: the window counts the channel's closed bars; committed; ADR-083 settled by Davin on 2026-10-01 and Q1 to Q5 approved as built).** **MCD0 is built (task P5): evaluator 1.0.0, fixtures v1, v3 and v4, manifest; spec, registry, parameters and plan approved by Davin; architecture §2.13 `Draft (1.0.0)`; flag `off`. It is checked by P6 (a fresh session: A7 and A9 for a non-string `config_hash` and one test gap, both closed; 124 tests), signed off by Davin and committed ("Build MCD0: evaluator 1.0.0, tests, fixtures, manifest (Stage 3 sign-off)"). MCD0 to MCD3 are now all built or retrofitted, checked, signed off and committed.** Next: the kit change for `config_hash` ([waiting-on](./waiting-on.md)); an optional fresh P6 check of the two patched MCDs stays open. The pre-commit prettier hook must not touch canonical JSON:
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
  [P7 (b) MCD2 and MCD1](../../docs/handoffs/2026-10-01-1453-p7b-mcd2-mcd1.md),
  [P4 (a) MCD0](../../docs/handoffs/2026-10-01-1519-mcd0-p4a.md),
  [P4 (b) MCD0](../../docs/handoffs/2026-10-01-1536-mcd0-p4b.md),
  [P5 MCD0](../../docs/handoffs/2026-10-01-1559-mcd0-p5.md),
  [P6 MCD0](../../docs/handoffs/2026-10-01-1650-mcd0-p6.md).
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). Database traps:
  [database-traps.md](../architecture/database-traps.md).

## Latest sessions (verbatim)

<!-- session 2026-10-01 mcd0-p6 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, committed as "Build MCD0: evaluator 1.0.0, tests, fixtures, manifest (Stage 3
> sign-off)" on top of `4ae42610` (Davin's Next.js security update); NOT pushed. MCD task P6 for MCD0 (a fresh independent check that changed
> nothing), then, after Davin's stage-3 sign-off, the two findings closed and the wrap-up.**
> **Needs from Davin:** (1) schedule the kit change for `config_hash` ([waiting-on](./waiting-on.md)): MCD1 to MCD3 still pass a non-string hash
> through; (2) keep or revert the builder addition to F1 (a `config_hash` that is not a mapping is also INVALID + `SANITY_FAILED`); (3) push, when
> he decides; (4) optionally a fresh P6 check of the MCD1 and MCD2 2.0.1 patch; nothing blocks. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** `mcd0_evaluator.py` (tier 3 rejects a non-string `config_hash` of an active source and a non-mapping `config_hash`;
> `_evaluate` keeps only string hashes), `test_mcd0_unit_tests.py` (**124 tests**, +5: four for F1, one for F2), spec §5 and §13, plan §9, the
> manifest, the hand-off ([P6 MCD0](../../docs/handoffs/2026-10-01-1650-mcd0-p6.md)), the kit item in `waiting-on.md` and these state files.
> From `engine-1-5-new/`: MCD0 **124 OK**, MCD1 **113 OK**, MCD2 **102 OK**, MCD3 **134 OK** (1 opt-in skip), the kit **215 OK**; pyflakes and
> Prettier clean; LF, no Thai. P6: no line of A1 to A26 failed except A7 and A9 for a non-string `config_hash` (F1, root cause in the shared kit)
> and a test gap under A21 (F2, a zero statistic reported as 1.0 passed every test); a differential test of 150,000 cycles against an independent
> spec §6 implementation found no mismatch; a fuzz of about 23,000 corrupted bundles raised nothing (661 schema-breaking envelopes, all F1);
> mutation of the evaluator: 382 mutants with one real gap, and 403 after the fixes with none; 92 data-file mutants (7 prose survivors). The
> evaluator stays at 1.0.0 (never live, no fixture output changes).
> **Unconfirmed / found:** the envelope margin is **20 to 30 tokens** for realistic data, not 48 (other setting names and random hashes
> tokenise longer; 600 is crossed only with seven-digit statistics); `Params.from_yaml` accepts `.inf` (kit item); five defensive `int()`
> normalisations are untested (low); the shadow period must still measure the flag rate; the fit-window question reaches MCD0. Not run: the
> legacy tests, `test:ci`, `tsc`, lint, build (no app code touched). The oldest entry (P4 (b)) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-01 mcd0-p5 -->

> **Ad-hoc session (2026-10-01, phase/session unchanged), `main`, NOT committed (HEAD `4ae42610`, Davin's Next.js security update). MCD task
> P5 for MCD0 after Davin approved the spec, registry, parameters and plan and answered Q1 to Q5 (routing: Explain only): MCD0 is built at
> evaluator 1.0.0, flag `off`: evaluator, 119 tests, fixtures for v1, v3 and v4, `mcd0_output.json` and the manifest; the architecture §2.13
> row reads `Draft (1.0.0)`.**
> **Needs from Davin:** (1) run **task P6 for MCD0** in a fresh session, then his stage-3 sign-off; (2) what to commit and when (decision (k):
> after P5 is verified, which it now is): uncommitted are ADR-083 settled and its README row, two manifest rows, `mcd0/`, the architecture row,
> three hand-offs and the state files (`package.json` and `pnpm-lock.yaml` were committed by him); (3) optionally a fresh P6 check of the MCD1 and
> MCD2 2.0.1 patch; (4) nothing blocks. The half-up rounding helper now exists in MCD0 to MCD3 and the `T_EDT` helper in three evaluators (a kit
> change for him to schedule). `active-tasks.md` was deleted (every item done).
> **Changed & verified:** new in `mcd0/`: `mcd0_evaluator.py` (254 lines, no bar read), `test_mcd0_unit_tests.py` (**119 tests, all pass**),
> `fixtures/` (v1, v3, v4: nine files), `mcd0_output.json`, `mcd0-manifest-work-completion.md` (Appendix A with evidence); status lines and the
> routing row of the spec, plan and registry; `docs/STACK-D-ARCHITECTURE.md` §2.13; the hand-off ([P5 MCD0](../../docs/handoffs/2026-10-01-1559-mcd0-p5.md))
> and these state files. From `engine-1-5-new/`: MCD0 **119 OK**, MCD1 **113 OK**, MCD2 **102 OK**, MCD3 **134 OK** (1 opt-in skip), the kit **215 OK**,
> legacy **13 OK** each; pyflakes and Prettier clean; LF, no Thai. Largest envelope **552 tokens** (546 valid; budget 600, margin 48), one evaluation
> under 1 ms. Own mutation pass on the verdict logic: **37 of 37 killed** (36 on the first pass; the survivor was a required-fields test that read
> its list from the evaluator, now holding its own copy from spec §3). Not run: `test:ci`, `tsc`, lint, build (no app code touched).
> **Unconfirmed / found:** every real reading is `MCD0_M5_M15_DEFECT` under the fixture settings (and `MCD0_M5_DEFECT` with M15 re-set to `non_a`);
> `MCD0_ALL_QUALIFIED` and `MCD0_M15_DEFECT` are synthetic only, so the shadow period must measure the flag rate; the envelope margin of 48 tokens is
> thin, so a new `details` field must re-measure; the fit-window question reaches MCD0 ([waiting-on](./waiting-on.md), updated); `<slot>.source.md` of
> v3 and v4 carries an absolute workbook path (the open kit item). The oldest entry (P4 (a)) was rotated into `history/2026-10-sessions.md`.

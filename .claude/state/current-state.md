---
type: Concept/AgentState
status: active
updated_at: 2026-10-02
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
- **Build step 2, Market data & chart (2026-10-02):** plan approved ([plan](../../docs/handoffs/2026-10-01-2321-step2-plan.md), ten parts); **all ten parts are built, checked by session B (no defect found; [check](../../docs/handoffs/2026-10-02-1548-step2-session-b-check.md)) and committed
  locally in seven commits by area (not pushed); nothing deployed, the part 2 migration is a file only, not applied.**
  (cycle core, [part 1](../../docs/handoffs/2026-10-01-2347-step2-part1.md); four tables as an unapplied migration, [part 2](../../docs/handoffs/2026-10-02-0010-step2-part2.md);
  sender side, [part 3](../../docs/handoffs/2026-10-02-0101-step2-part3.md); gateway endpoint, processor and `cycle-ready` job, [part 4](../../docs/handoffs/2026-10-02-0156-step2-part4.md);
  the strengthened landed check and the read side, [part 5](../../docs/handoffs/2026-10-02-0446-step2-part5.md); the active-indicator setting behind a flag that is off,
  [part 6](../../docs/handoffs/2026-10-02-0536-step2-part6.md); the chart stamp, the cycle-driven renderer and the last good image,
  [part 7](../../docs/handoffs/2026-10-02-0714-step2-part7.md); the `symbol_specs` lane (an MQL5 exporter that is NOT compiled),
  [part 8](../../docs/handoffs/2026-10-02-1100-step2-part8.md); promote detection and RETUNING,
  [part 9](../../docs/handoffs/2026-10-02-1134-step2-part9.md); **part 10: Option A (the gateway counts the window to end RETUNING, ADR-015 amended, part 9's open point resolved), the `measure-cycles` kit and the
  deploy-order runbook** ([part 10](../../docs/handoffs/2026-10-02-1300-step2-part10.md)).) **Next:** Davin takes **decision 1, how RETUNING ends** (session B's P1: with the real push worker it could last days, not hours; see [waiting-on](./waiting-on.md)),
  then a small builder session fixes the stale statements (P2). He also settles the other open points (the one-step reading of "followed by one verified manifest", a key of its own for
  writes before the flag goes live, ADR-015 amended or superseded, the part 7 and 8 questions), runs the production and VPS checks, and deploys in the order of
  [the runbook](../../docs/runbooks/deploy-stack-d-step2.md) (migration, gateway, monolith with the flag off, VPS files, then the exporter on terminals A and B), runs the kit on real cycles, and confirms or replaces
  the ADR-012 thresholds with a new decision. Session B's F1 to F4 close with that live evidence. Build step 3 starts after live evidence is recorded ([waiting-on](./waiting-on.md)).
- **Open follow-ups:** see [waiting-on.md](./waiting-on.md). Database traps:
  [database-traps.md](../architecture/database-traps.md).

## Latest sessions (verbatim)

<!-- session 2026-10-02 step2-session-b-and-commit -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, HEAD `8bc80b6c` when it began. Build step 2 (chapter 1): session B's open items recorded, the asterisk damage in architecture §3.4 fixed, and build
> step 2 committed locally (Davin approved the commit) in seven commits by area: Prisma migration, Stack C and VPS, MQL5, gateway, monolith, Stack C documents, docs and state (in that order: each commit builds on the ones before it). NOT pushed, NOT deployed, the part 2 migration NOT applied (it is a file only).**
> Session B ([check](../../docs/handoffs/2026-10-02-1548-step2-session-b-check.md)) found no defect in what was built; of the nine section 1.8 items, five are met on the evidence it produced (2, 3 on the read path, 5, 6, 8)
> and four wait on something that does not exist yet (1, 4, 7, 9: F1 to F4).
> **Needs from Davin:** (1) **decision 1: how RETUNING ends (session B's P1).** Simulated with the real push worker's code, Option A can leave a promote in RETUNING for about 10 trading days at 100 to 200 rows a minute
> and half a day at 600 (one slot at 800), where the docs say "hours"; the real rate is unmeasured. Options: keep Option A and measure first; Option B (count only what the sensors read, so RETUNING ends one verified manifest
> after the promote); or speed up the push worker first. It does not block the deploy; settle it before step 3 wires the `retuning` flag to CAUTIONARY in production. (2) **P2, the stale statements, wait for decision 1** and
> a small builder session (their text depends on the rule; deliberately NOT fixed in this session): the comment at `backfill_worker_api_gateway_v5.py:913-915`, `docs/STACK-D-ARCHITECTURE.md:255-256` ("5–6 minutes"), and
> "hours" in `docs/adr/015-retuning-during-a-promote.md:36` and `docs/runbooks/mt5-terminal-promote.md:191`. (3) **F1 to F4 wait on live evidence** (none is a defect): F1 a real cycle measured with the kit; F2 the chart
> stamp's enforcement point (`chartMatchesCycle` has no caller until the prompt assembler); F3 a promote rehearsed end to end (a second terminal, step 3's loader reading `retuning`, and P1's duration); F4 the
> indicator switch in one slot for MCD inputs and the UI (step 3's loader; the flag is off). (4) Still open from part 10: the one-step reading of "followed by one verified manifest", a key of its own for writes before
> the flag goes live, ADR-015 amended or superseded, the part 7 and 8 questions, the production and VPS checks, then the deploy in the runbook's order. (5) Push, when he decides.
> **Changed & verified:** `docs/STACK-D-ARCHITECTURE.md` section 3.4 rows 4 and 5 (the state codes are back in backticks; Prettier clean); a search of `docs/STACK-D-*.md`, `docs/MCD-*.md` and `docs/adr/` found no other
> damage (`M\*` is escaped and renders correctly, left as is); walkthrough Part E2 now has the rule that identifiers in Markdown always go in backticks; this file and `waiting-on.md` (session B's items); the commits, made by
> explicit path with no `git add -A`. The test re-run after the commits and the hashes are in this session's hand-off report (`docs/handoffs/`, named `*-step2-commit.md`; written after the commits, so not in them).
> **Unconfirmed / found:** nothing ran against production, the VPS or a deployed gateway; the newest-row question (stub or closing bar) is still unverified; `test_extended_statistics.py` fails the same 15 checks at HEAD (not
> step 2's); six gateway tests read files outside `railway-gateway/` (the whole checkout is needed; a CI job testing the package alone would go red); `npm run build` at the repo root rewrites `next-env.d.ts`, which was kept
> out of the commits; the two other hand-offs session B names (`*-1320-antigravity-advisor-...`, `*-1435-step3-plan.md`) are not in this working tree, so nothing of them was committed; `davintrade-recent-works/stack-d.md`
> has an unrelated uncommitted change (Davin's reading list), left alone. The oldest entry (part 9) was rotated into `history/2026-10-sessions.md`.

<!-- session 2026-10-02 step2-part10 -->

> **Ad-hoc session (2026-10-02, phase/session unchanged), `main`, NOT committed (HEAD `8bc80b6c`). Build step 2 (chapter 1), session A, part 10 of 10, the closing part: Option A for RETUNING (the gateway counts
> the window; ADR-015 amended), the `measure-cycles` kit, the deploy-order runbook, and the closing verification. **Build step 2 is complete in code.** Built and tested locally; NOT deployed, the part 2 migration is NOT
> applied, nothing committed. A throwaway embedded Postgres (local, created from the gateway's own schema, stopped and removed) ran the gated specs; no repo migration was run.**
> **Needs from Davin:** (1) **confirm the one-step reading of "followed by one verified manifest"** (the manifest that counts 0 must itself be READY; mine, hand-off decision 1; the extra manifest costs a new column);
> (2) **a key of its own for writes, before `ACTIVE_INDICATOR_FROM_GATEWAY=true`** (part 6); (3) ADR-015 amended in place or superseded by a new number; (4) the production and VPS checks (including which gateway the
> push worker targets), a go for the deploy in the order of `docs/runbooks/deploy-stack-d-step2.md`, and commit and push when he decides; (5) optional: a column for the gateway's count so progress is SQL-visible; (6) approve
> a scratch-venv install of matplotlib, pandas, pytest and boto3 so the three renderer test files can run; (7) after the first measured cycles, confirm or replace the ADR-012 thresholds with a new decision; the part 7
> and 8 questions are still open. `active-tasks.md` was deleted (every item done).
> **Changed & verified:** `railway-gateway/src/cycle/retuning.ts` and `src/worker/cycle-manifest.service.ts` (Option A: the window count, the promote lookup, the new `RETUNE_COMPLETE` detail), `src/cycle/measure-cycles.ts`
> and `scripts/measure-cycles.js` (the kit; the script is plain JavaScript on purpose), tests `retuning.spec.ts` (35), `promote-retuning.spec.ts` (57), gated `promote-retuning.pg.spec.ts` (8), `measure-cycles.spec.ts` (77) with
> `helpers/measure-world.ts` and a sample fixture; docs: `docs/runbooks/deploy-stack-d-step2.md` (new), `mt5-terminal-promote.md`, ADR-015, STACK-D 1.6, the contract's description of `repush_rows_unsent` (copy re-synced), blueprint 5.4,
> schema comments; hand-off ([part 10](../../docs/handoffs/2026-10-02-1300-step2-part10.md)). `railway-gateway`: `tsc` clean, `npm test` **29 passed + 3 gated skipped / 836 + 26 skipped** (was 729 + 24), `npm run test:e2e` **7 / 139**
> (unchanged), the gated specs **8 of 8 twice** (promote) and **7 of 7** (readers) on the throwaway Postgres, `npm run build` clean (`dist/main.js`, no `dist/src`); root: `type-check` clean, `lint` at its baseline (0 errors, 5 old
> warnings), `npm run test:ci` **257 suites / 3,453 passed** (unchanged: no monolith file touched); Python: 12 of the 13 pipeline tests green (`test_extended_statistics.py` fails the same 15 checks as at HEAD), `test_cycle_manifest.py` 47.
> **Mutation check: 74 of 74 Option A mutants killed; the kit's 94 of 94 killed on the final spec** (first pass 87 killed, 1 weak, 6 survived: six real test gaps, now closed).
> **Unconfirmed / found:** the kit has run on a fixture only, nothing ran against production, the VPS or a deployed gateway; **how long RETUNING lasts is unmeasured** (a worker slower than the window leaves the middle of it old for hours,
> by my reading of the code); the window bound is one bar wider than the collector's, which can hold RETUNING one more cycle (pinned by a test); the three renderer test files were NOT run (packages not installed, no download without
> a say), and phase 1 of the parked calculation project cannot run (its mock data folder is missing); `scripts/**/*.ts` is in the gateway's tsconfig, so a `.ts` there would break `node dist/main` (a test guards it); `railway run`
> gives a private database URL a laptop cannot reach; my first mutation harness read every mutant as a crash (cp1252), and killing it mid-mutant left `retuning.ts` mutated until I restored it from the backup (verified by sha256);
> the harness now refuses to start if a source differs from its backup. The oldest entry (part 8) was rotated into `history/2026-10-sessions.md`.

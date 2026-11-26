# MCD0 1.1.0 shadow batch: built locally, for review

**From:** Claude Code (Executor, Computer 2) · **Date:** 2026-11-26 · **Base:** `f5256850`
**State:** built and tested locally on Davin's order ("ให้เริ่มเขียนโค้ด"). **Not committed, not deployed, no setting switched.**

## 1. What changed (44 modified and 4 new files in the engine, `railway-gateway` and `docs`, plus this note)

- **MCD0 1.1.0** (variant A4): fit ratio 1.25 to 3.20, geo ratio 0.50 to 2.00, R-squared floor 0.00 for both models, applied on M5 only through the new parameter `r2_timeframes`. M15 lists `R2_A`, `R2_B` as skipped. ⚠ The rule is keyed to the timeframe, not to the indicator `non_b` (rule 6); recorded in ADR-101 for Davin to accept or change.
- Stored outputs regenerated from the stored input bundles; the gateway's sensor copy synced (4 files; `check:sensor-kit` passes).
- **Gateway log filter:** production writes `log`, `warn`, `error`, `fatal`; `LOG_LEVEL=debug` brings `debug` back. The `Authorized caller: <prefix>` line is a `debug` line and no longer appears by default.
- **Records:** ADR-100 (M5 `most_recent`, supersedes ADR-010), ADR-101 (supersedes ADR-019, amends ADR-018's thresholds), architecture §1.3, §1.4, §1.9, §2.4, §2.8, §2.12, §2.13 and Appendix A, MCD0 spec, build record and checklist item 3.

## 2. Verification

| Check                                                                      | Before the change                                     | After                                                   |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Engine `mcd0`                                                              | 124 tests, 3 not passing                              | 129 tests, 2 not passing (need `openpyxl`, `tiktoken`)  |
| Engine `mcd1` to `mcd3`, `mcd_common`                                      | library and flag failures                             | the same list, nothing new                              |
| Worker tests                                                               | 909, 3 not passing                                    | 910, the same 3                                         |
| Golden scenarios                                                           | 16 approved                                           | 13 approved, **3 pending** (01 to 03), 0 problems       |
| Gateway Jest                                                               | 4 failed, 1 suite not compiling (stale Prisma client) | the same, 2,794 passed (+7)                             |
| Gateway database specs, temporary PostgreSQL 18 (CI does not run them)     | the 4 failures reproduced on unchanged `HEAD`         | 393 passed, 4 failed (the same 4)                       |
| Web tests that read the engine's files (intake, engine4, reply, dev pages) | not run                                               | 12,080 passed, **6 failed, all from the golden change** |

**On the 1,375 exported cycles** (M5 `most_recent`, rebuilt as in the simulation): the real 1.1.0 engine against the A4 simulation, cycle by cycle, **no difference**. MCD0 flags M5 20.8%, M15 3.1%, either 23.9%; MCD1 `VALID` 1,323 / `CAUTIONARY` 42 / `STALE` 10; MCD2 1,091 / 261 / `INVALID` 23; MCD3 1,039 / 303 / 23 / 10; no `NO_MATCH`; Scalper stand-aside 23.

## 3. Open before any commit (Davin)

1. **Two web files outside the permitted folders.** CI fails without them.
   - `__tests__/lib/intake/board.test.ts`: the two 28 September sensor boards now read `VALID`.
   - `config/reply/eval-runs/stand-in.json`: record again with `node scripts/reply/eval-run.js --stand-in --write` (offline, no paid call).
2. **Golden 01 to 03 approval** (read each `review.md`). 01: only the MCD0 reading changes. 02: both SYN readings `CAUTIONARY` to `VALID`. 03: SYN stays `CAUTIONARY` through MCD3's modifier; the MCD0 reasons are gone.
3. **`openpyxl==3.1.5` and `tiktoken==0.10.0`** (with their dependencies) to run the 600-token test (T12) and the workbook provenance tests. Needs Davin's permission to download.

Later, each on Davin's order: commit and deploy (a merge to `main` deploys the gateway; this checkout is 2 commits behind `origin/main`), check that Railway has no `LOG_LEVEL=debug` set, read `ACTIVE_INDICATOR_FROM_GATEWAY` on the web app, then switch M5.

## 4. Findings for the Advisor

- On fixture v3 both SYN readings are now `VALID` **LONG** through `R2_EXHAUSTION_SNAPBACK`. With fewer MCD0 marks, the Finding B rule carries full pre-set risk more often. `draft-2` before any `live` flag.
- `mcd_worker/tools/build_fixtures.py` now writes `*.cycle.json` with synthesis on (SYN is `shadow` in the committed configuration), while the file is defined as SYN off. I regenerated with SYN off; the tool is unchanged. Its provenance test is skipped without `openpyxl` and would fail with it.
- Tests already failing since the flags became `shadow`, not touched: the registry test of `mcd1` to `mcd3` (expects `off`), 3 worker tests, 4 database specs. The same stale line in MCD0's own test was corrected.
- Old thresholds remain in text outside the permitted folders: `MCD-DEVELOPMENT-STANDARD.md` §9.2, the retrofit walkthrough (about lines 401 and 429), `deploy-stack-d-step3.md` §4.2.
- Architecture Appendix A has no row for ADR-099 (already so before this work).

## 5. Second round: Davin's approvals and pre-commit verification (2026-11-26)

Sections 3 and 4 describe the state before this round. **Still nothing staged, committed or pushed.**

**Done.** ADR-101 keying accepted; golden 01 to 03 recorded `APPROVED` (16 of 16, `--require-approved` passes); `board.test.ts` updated; stand-in run recorded again (with `--date 2026-10-16`, the date `eval-run-cli.test.ts` pins; with today's date that one test fails); Appendix A row 099; runbook §4.2 and §9.3. No download on Computer 2; T12 (548 tokens) is recorded as reported from Computer 1.

**Two more files follow from these changes and are NOT yet permitted** (list: `2026-11-26-mcd0-1-1-0-commit-files-pending.txt`, 22 paths). CI fails without them:

- `config/reply/demo/` (21 files; `node scripts/reply/record-demo.js record`): the recordings name the old stand-in run. In each locale file only the run id and fingerprint change; the approval stays `PENDING`, its content hash changes.
- `app/dev/chat/recorded.json` (`RECORD_CHAT_FIXTURES=1 npx jest __tests__/components/chat/fixtures.test`, then Prettier): on the 28 September 23:15 exchange MCD1 and MCD2 read `VALID` and their two "is cautionary" risk lines go (3 lines added, 12 removed).

**Verification on the merged result** (`HEAD` + the batch + the 2 `origin/main` commits, exported with LF line endings into the scratchpad):

| Check                                                         | Result                                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| All web tests, batch as it stands                             | 21 failed: 20 `demo-freshness`, 1 chat `fixtures`                                  |
| All web tests, with the 22 pending files recorded in the copy | **21,665 passed, 31 skipped, 0 failed**                                            |
| `tsc --noEmit`; ESLint on the changed web test                | 0 errors                                                                           |
| Gateway Jest                                                  | 2,798 passed, 0 tests failed; 1 suite does not compile (stale local Prisma client) |
| Golden `--require-approved`; sensor kit check                 | 16 of 16; equal                                                                    |
| Worker tests; `mcd0`                                          | the 3 old failures; the 2 library tests                                            |
| Merge with `origin/main` (`git merge-tree`)                   | clean; no file in both                                                             |

In the working folder: `mcd_worker.tests.test_golden` 65 of 65, `check-operating-docs.mjs` PASS (53 documents). With `--tracked-only` on the exported copy it reports links into uncommitted hand-offs; those files are also absent from `HEAD`, and the exported `tests.yml` has no such step.

**The local gateway failures are environment, not this batch** (CI's gateway job on `f5256850`: unit, end-to-end and build all succeeded):

- `sensors-synthesis-rows.spec.ts`, three tests `zone_params.yaml ... min_stop_distance / max_zones / price_decimals`: the test's pattern expects LF; this checkout is CRLF (`core.autocrlf=true`). They pass on the LF copy.
- `sensors-replay.spec.ts`, `scripts/replay-cycle.js is plain JavaScript ...`: expects `#!/usr/bin/env node` followed by LF; same cause, passes on the LF copy.
- `sensors-disabled-consumes-nothing.spec.ts` does not compile: `trendlinePolicySession` missing on `PrismaService`; the local client was generated on 2026-10-24 (7.9.1 installed, 7.10.1 wanted), before commit `97ee43d0` added the model.

**For the commit.** `2026-11-26-mcd0-1-1-0-commit-files.txt` (78 paths: 50 code, tests and records, this note, 27 evidence files cited by ADR-100/101; scanned, no secret or infrastructure address). The runbook is **not** in that list: it also holds 6 uncommitted lines from before this batch ("Concurrent Work & Agent Guardrails"), so apply `2026-11-26-mcd0-1-1-0-runbook-step3.patch` with `git apply --cached`. The commit hook's Prettier re-marks two Advisor replies cosmetically. The push hook runs type-check and the web tests on the working folder, which holds unrelated changes and was not run that way here.

**Further follow-up found.** `knowledge-service/corpus/D2/mcd0.md` still states the 1.0.0 bounds to the user, and `knowledge-service/tests/test_corpus_d1_d2.py` compares them with the parameters, so it will fail (not run in CI, not run here: no `pytest`). The text is signed; change and approve it before the knowledge service is deployed.

## 6. Third round: the 22 files and the commit from a clean worktree (2026-11-26)

This section supersedes "nothing staged, committed or pushed" and "not yet permitted" in section 5. When it was written the commit was about to be made locally; **nothing had been pushed**.

**Davin's decisions.** The 22 pending files are approved (demo approval stays `PENDING`); the local gateway failures are accepted as environment issues; the knowledge playbook is deferred and is a **hard gate: no build or deploy of `knowledge-service`** until `knowledge-service/corpus/D2/mcd0.md` states the 1.1.0 bounds, is approved again and `tests/test_corpus_d1_d2.py` passes.

**Recorded.** `config/reply/demo/` (21 files: run id, fingerprint and content hash) and `app/dev/chat/recorded.json` (3 lines added, 12 removed). The changed set equals the pending list.

**Method.** A temporary worktree outside the shared folder, branch `mcd0-1-1-0-shadow` on `origin/main` `7436a2bd`, LF line endings, dependencies installed offline from the pnpm store. The listed files were copied through a private index and byte-compared (0 differences); the runbook received only the patch. **The commit holds 100 files, not 101:** `mcd_worker/fixtures/2026-09-18T2055Z.synthesis.json` is on the list but its content equals `origin/main` (only a line-ending mark in the main checkout). Section 1's file count includes it.

**Verification in the worktree**

| Check                                                | Result                                           |
| ---------------------------------------------------- | ------------------------------------------------ |
| `prisma generate`, `type-check`                      | pass, 0 errors                                   |
| `lint`; ESLint on `board.test.ts`                    | 0 errors (5 warnings in files outside the batch) |
| `test:ci` (the CI command, with coverage)            | 643 suites, 21,665 passed, 31 skipped, 0 failed  |
| `test:integration`                                   | 5 suites, 66 passed                              |
| `mcd_worker.tests.test_golden`; `--require-approved` | 65 of 65; 16 of 16                               |
| Sensor kit check                                     | equal, 45 files                                  |
| All worker tests (910); `mcd0` (129)                 | the 3 old failures; the 2 missing-library tests  |

**Not run in the worktree.** Gateway tests: `npm ci --offline` lacks packages in the local cache and nothing was downloaded for it; the batch's gateway files are unchanged since section 5's merged-result run (2,798 passed, 1 suite blocked by a stale Prisma client), and CI runs the gateway job on push. `pnpm run build` was not run.

**For the sync after a push.** The two `origin/main` commits touch no batch file. They do touch four files the main checkout shows as uncommitted: `jest.config.js`, `scripts/validate-file.js` and `tsconfig.json` already equal `origin/main`; `.gitignore` equals it plus two local lines (`.claude/*.log`, `.claude/state/checkpoints/`) that must be kept.

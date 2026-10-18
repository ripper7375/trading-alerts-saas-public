---
type: Concept/Task
status: ready_for_review
updated_at: 2026-10-18
task_id: 2026-10-18-nestjs-production-advisories
owner: Codex
integrator: Codex
reviewer: not-required
shared_state_writer: handoff-only
approval: Davin's direct task and reference prompt; separately approved test annotation; commit/push/combined PR authorized 2026-10-18
order_mode: ad-hoc; phase/session unchanged
base_commit: 5dab316c79c13abd42d024f9291dda667cff755e
worktree: D:/SaaS Project/trading-alerts-saas-codex-nestjs
branch: codex/nestjs-security-audit
---

# Objective and current result

Clear production high/critical advisories in three isolated npm services, or list
remaining IDs and reasons, with service-specific baseline/final checks.

Compatible fixes are applied and installed. All three critical package findings
are removed; production audits still exit 1 for the documented approval-gated
parents and breaking upgrades. All final checks pass: money 838 tests, operation 506, gateway 2764 unit tests and 156 e2e tests; gateway retains 376 gated skips.

## Scope and ownership

- Codex owns the three service lockfiles and these task/handoff/evidence artifacts.
  Davin additionally approved the one-line `(v: unknown)` test callback annotation
  at money-service/src/stripe/stripe-checkout.controller.spec.ts:368.
- Root package.json, root pnpm-lock.yaml, service manifests, overrides, workflows,
  migrations and runtime semantics are unchanged. Davin authorized commit, push
  and one combined PR on 2026-10-18; merge and production actions remain outside
  scope. Initial worktree was clean; no nested
  routers apply to the changed files.
- Reference prompt: C:/Users/WiN/Desktop/Clear production advisories in NestJS Service.txt.
  Its sign-off gates for work beyond lockfile patches and money/auth majors
  remain binding. The test-only exception was approved explicitly on resume.
- Codex owns local install/client-generation/test resources in this worktree.
  No independent reviewer or subagent was requested. Other worktrees remain
  read-only context. Shared Claude state is handoff-only for its existing writer.
- Davin selected one combined PR and explicitly authorized its commit and push.

## Checklist

- [x] Read required rules, prompt, lifecycle and relevant state; inspect HEAD/diff.
- [x] Measure all original baselines before dependency edits; record corrections.
- [x] Audit production dependencies and identify vulnerable parent constraints.
- [x] Apply/install compatible lock fixes; inspect source, integrity and majors.
- [x] Complete gateway full unit rerun after canonical LF twin repair.
- [x] Finish verification comparison, document/diff checks and handoff publication.

## Decisions and deviations

- This checkout's Claude state predates the referenced security session. Relevant
  context was read from the original security worktree. Its state was not copied,
  overwritten or rotated; the final handoff supplies proposed publication text.
- Initial service node_modules were absent. Gateway clean npm ci passed after
  31 minutes; money/operation installs were interrupted at Davin's credit
  checkpoint. Resume recovered them with npm install --no-save --ignore-scripts
  --no-audit --no-fund --prefer-offline, exits 0; all original lock hashes matched.
- Temporary candidate locks were generated using targeted npm update with
  --package-lock-only --ignore-scripts --no-audit --no-fund, without --force.
  Targets: proxy-addr, compression, brace-expansion, browserslist, fast-uri,
  js-yaml, @grpc/grpc-js, engine.io, qs and baseline-browser-mapping. Candidate
  patch/hash was verified and applied only after original baselines completed.
- PowerShell npm.ps1 consumed `--` and ignored the Jest flag in an interrupted
  early run. Completed baselines/final runs use npm.cmd and --runInBand, with no
  test selection reduction. Python yaml/jsonschema prerequisites are available.
- Original money tsc exit 2 / Jest exit 1 revealed TS7006 in a pre-existing test.
  Davin approved the prepared one-line unknown annotation. Corrected complete
  baseline passes 74 suites / 838 tests; 15 formerly uncollected Stripe cases
  were restored. No assertions or runtime behavior changed.
- Raw gateway baseline had five CRLF-sensitive assertion failures in three
  suites. Three inputs were restored to exact committed LF bytes and the failed
  suites passed 328 tests. The first post-update full run then exposed a missed
  vendored YAML twin (three kit-sync failures). That fourth checkout file is byte-identical to HEAD and its engine twin. The repeated full suite passes 2764 tests with 376 existing skips.
  No source or YAML value patch is delivered. See checkout-normalization.json.
- Git's existing index.lock blocked a stat-cache refresh (exit 128). It was
  preserved. These four LF-only files can appear M in git status while git diff
  is empty. Cached diff exit 0 confirms no staged content.
- Three local Prisma client generations and operation's private shared-types
  build passed (exit 0). No database, migration or production credential was used.

## Audit results and remaining scope

| Service   | Before: moderate / high / critical | After                  | Audit exit |
| --------- | ---------------------------------- | ---------------------- | ---------- |
| Money     | 48 / 18 / 1 (67 total)             | 46 / 13 / 0 (59 total) | 1          |
| Operation | 48 / 19 / 1 (68 total)             | 46 / 13 / 0 (59 total) | 1          |
| Gateway   | 4 / 10 / 1 (15 total)              | 3 / 6 / 0 (9 total)    | 1          |

Final audits use npm audit --omit=dev --audit-level=high. Counts include affected
parents, not unique vulnerabilities. The remaining 15 direct IDs (8 high) and
exact reasons are in the [verified handoff](../../handoffs/2026-10-18-nestjs-production-advisories-codex-verified.md#remaining-advisories-and-reasons)
and [advisory catalog](evidence/2026-10-18-nestjs-production-advisories/remaining-advisories.json).
No family bump, override or major upgrade was applied. Parent pins requiring
sign-off are Multer/NestJS, Swagger YAML, Prisma/mysql2/deepmerge-ts and legacy
OpenTelemetry; UUID remains below the high gate in incompatible parent ranges.

Changed/added lock entries: money 19, operation 23, gateway 14. All changed
installed versions match the locks, every changed resolved package has a
registry HTTPS source and integrity, and root metadata is identical. No existing
package changes major. Root and service manifests have no diff.

Standalone regression check: proxy-addr 2.0.7 trusted an unrelated test IP for the
advisory's malformed mapped subnet in all three services; 2.0.8 rejects it in all
three. Evidence is proxy-addr-smoke-after.json. This is a library reproduction,
not a claim about the application's configured trust subnet.

## Baseline and verification

| Cwd / check      | Original baseline and correction                                                                                                       | Final                                                                  |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Money / tsc      | 2 raw; approved test annotation recheck 0                                                                                              | 0                                                                      |
| Money / Jest     | 1 raw (73 suites pass, one fails to compile; 823 tests collected/pass); corrected 0 (74 suites / 838 tests pass)                       | 0; 74 suites / 838 tests pass                                          |
| Operation / tsc  | 0                                                                                                                                      | 0                                                                      |
| Operation / Jest | 0; 53 suites / 506 tests pass                                                                                                          | 0; 53 suites / 506 tests pass                                          |
| Gateway / tsc    | 0                                                                                                                                      | 0                                                                      |
| Gateway / Jest   | 1 raw: 64 pass / 3 fail / 10 skip suites; 2759 pass / 5 fail / 376 skip tests (3140 total); affected-suite LF recheck 0 (3 / 328 pass) | 0; 67 suites / 2764 tests pass; 10 suites / 376 tests skip; 3140 total |
| Gateway / e2e    | 0; 8 suites / 156 tests pass                                                                                                           | 0; 8 suites / 156 tests pass                                           |

Commands: npx.cmd tsc --noEmit; npm.cmd test -- --runInBand; gateway npm.cmd run
test:e2e -- --runInBand. No tests added/removed. Existing database-gated skips
remain; no CYCLE_PG_URL/CYCLE_PG_ALLOW_WIPE opt-in was enabled. Node 24.12.0,
npm 11.15.0. CI runners and live external payment/auth flows were not exercised.

## Evidence and closeout

- [Final structured verification](evidence/2026-10-18-nestjs-production-advisories/verification-results.json).
- [Verified handoff, residual IDs and proposed shared-state update](../../handoffs/2026-10-18-nestjs-production-advisories-codex-verified.md).
- [Four payload file hashes](evidence/2026-10-18-nestjs-production-advisories/final-file-hashes.json) and [package changes](evidence/2026-10-18-nestjs-production-advisories/package-changes.json).
- [Historical credit checkpoint](evidence/2026-10-18-nestjs-production-advisories/checkpoint.json), checkpoint handoff and the archived earlier task record remain in the evidence directory.
- Formatting and diff checks exit 0. Operating-doc checker exits 1 with the identical 29 pre-existing issues; zero new issues. Full final logs, audits and exit metadata are saved in the evidence directory.

## Continuation / owner actions

- Local implementation and required checks are complete; no task command remains active. Ready for review within the authorized scope.
- The shared-state writer publishes the proposed session and waiting-on update from the verified handoff; stale Claude state in this checkout remains untouched.
- Recommend a blocking service CI audit gate after residual high findings have an approved resolution. No workflow was changed.
- Remaining parent/major decisions belong to Davin. Merge, deployment and migrations remain unauthorized.
- Publication resume: the task commit was rebased onto fetched remote main at `0e7aaf99b6a4e56e8bfed6d518f4f83595e923ef`. All four payload hashes still exactly match the verified checkpoint. Remote main has identical service trees to the original verification base. Nine inherited local Next.js commits are excluded; their history and the original task commit remain on local backup branch `codex/nestjs-security-audit-verification-backup`.
- The stale index.lock was preserved at `C:/Users/WiN/AppData/Local/Temp/nestjs-security-publication-2026-10-18/index.lock.20261018-170338.backup` after confirming its unchanged timestamp and no active Git index writer. Git writes now succeed and the four LF-only files have no content diff.
- The conventional commit contains four implementation paths and 64 task/evidence paths. Protected root/service manifests and workflows have no PR diff. Root dependencies and generated `.husky/_` hooks are absent in this isolated checkout; no hook was bypassed. Service verification remains valid by exact file hashes. Publication formatting passes; the operating-doc checker still reports the pre-existing issues. Raw log terminal blank lines are retained; staged whitespace checks pass with those log-only blank lines excluded.

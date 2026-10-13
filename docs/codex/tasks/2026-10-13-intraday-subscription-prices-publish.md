---
type: Concept/Task
status: in_progress
updated_at: 2026-10-13
task_id: 2026-10-13-intraday-subscription-prices-publish
owner: Codex
integrator: Codex primary agent
reviewer: Codex commit_scope_audit (read-only)
shared_state_writer: handoff-only
approval: 'Davin explicitly requested commit + push of the feature branch to GitHub, with no pull request.'
order_mode: ad-hoc; phase/session unchanged
base_commit: d07855d9faa0de0cf7c535b456962d71d47ffab5
worktree: 'D:\SaaS Project\trading-alerts-saas-public'
branch: codex/intraday-subscription-prices
---

# Objective

Commit the verified FX implementation and publish this feature branch to origin,
then verify the remote SHA. Do not create a pull request or deploy.

## Scope and ownership

- Primary owns explicit staging, commit/push, this publication record and its
  unique handoff. The 53 implementation files are allowlisted in the prior
  review manifest; add its three implementation documents and this publication record.
- Exclude mobile deletions/moved folders, next-env changes, unrelated untracked
  files, earlier research records, real .env files, generated clients and shared
  Claude state. Preserve all excluded work and never stash/reset/clean.
- Reviewer reads hashes, scope and credential exposure; it does not mutate Git.
  After the full gate exposed old fixtures, it exclusively adapted
  `__tests__/e2e/dlocal-payment-flow.test.ts` and
  `__tests__/integration/payment-creation.test.ts`. Root extended scoped test
  type coverage. Runtime source and payment/grant semantics are unchanged.
- Installed pre-commit lint-staged normally stashes; run the equivalent with
  --no-stash and --no-hide-partially-staged, disabling only duplicate hook runs
  for the authorized Git commands. Run type/test gates manually without the
  pre-push hook's shared Prisma client regeneration. Root owns those checks.
- Commit and normal push to origin are authorized. PR, merge and deploy are not.

## Checklist

- [x] Inspect branch, HEAD, index, dirty paths, origin and installed hooks.
- [x] Audit implementation hashes and absence of credentials in the scope.
- [x] Correct stale implementation-record checkboxes and publication pointers.
- [x] Stage and verify only the 59 allowlisted implementation/document paths.
- [ ] Run safe hook equivalents; commit and push without force.
- [ ] Verify remote SHA and complete publication handoff.

## Decisions and deviations

- Independent audit matched all 53 code/test/env-example hashes. The index was
  empty, and base/HEAD remains the reviewed d07855d9 commit.
- Remove an implementation-handoff link to excluded, untracked research instead
  of adding that earlier work to this feature commit.
- Initial sandboxed remote read could not reach GitHub; network-enabled Git
  verification/push is required. No credentials will be entered.
- Full operating-doc checker has the known 29 existing errors; validate owned
  documents separately and report that limitation.

## Verification

- Safe lint-staged passed exit 0 without stash/hiding; the original 53-file
  implementation hash comparison was unchanged.
- Root/runtime and original scoped test type checks passed exit 0.
- The first full pre-push run stopped at one old partial-rate fixture: 44 suites
  passed, E2E expected NGN 40455 but fallback gave 39150. Updated both remaining
  real-reader suites to complete CurrencyBeacon fixtures while preserving that
  expected total. Both suites pass, 46 tests, exit 0.
- Expanded scoped test tsc passes exit 0. Explicit test-side guards and the
  existing supported discountCode property fix old typing gaps. The scoped
  config includes the existing Next ambient declarations; next-env is untouched.
- Full pre-push Jest gate passed exit 0: 351 suites, 9750 tests; coverage
  statements 61.71%, branches 53.82%, functions 57.99%, lines 61.93%.
- Final focused fixture rerun: 2 suites / 46 tests, exit 0. Full gate and
  root/scoped type checks pass; safe staged lint/format and scoped docs pass.

Results will be recorded in the publication handoff. Prior implementation checks
passed: root 176 tests, money 61 tests, types/lint/format, live API and browser.

## Continuation

- Next: exact staging and safe quality gates, then commit + normal origin push.
- No user input is pending. Preserve unrelated files and no PR creation.
- Handoff: docs/handoffs/2026-10-13-intraday-subscription-prices-codex-publish.md.

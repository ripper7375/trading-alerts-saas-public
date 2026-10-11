---
type: Concept/Task
status: in_progress
updated_at: 2026-10-11
task_id: 2026-10-11-publish-codex-workflow
owner: Codex
integrator: Codex
reviewer: read-only publication-scope agent
shared_state_writer: handoff-only for canonical Claude project state
approval: Davin explicitly authorized commit and push, then selected a separate codex branch containing only this documentation work
order_mode: ad-hoc; phase/session unchanged
base_commit: adbc22007acf4a12f945346d4d52103fa601d0ad
worktree: C:/Users/WiN/.codex/worktrees/claude-collaboration-docs/trading-alerts-saas-public
branch: codex/claude-collaboration-docs
---

# Publish the Codex workflow and documentation

## Objective and scope

Publish the 31 authored workflow/documentation files and their publication
records on a separate Codex branch based on the verified GitHub main revision.
Davin chose this scope after the preflight found five existing local commits.
Keep local main at 96fbf410004aaee8abd7f69985b56cfbd100aa80; do not publish those
five commits or any unrelated dirty changes. Do not force-push or merge main.

The 31-file allowlist consists of the two root routers, .claude/index.md;
four shared collaboration documents; Codex index, protocols, templates, state
and four completed task records; four dated workflow handoffs; the operating
document checker and its tests; and the seven-document package. Publication
records belong to this task. Claude canonical project state remains excluded.

## Checklist

- [x] Inspect repository, remote, staged scope, dependencies and commit hooks.
- [x] Obtain Davin's choice for the five unpushed commits: keep them local.
- [x] Prepare a clean worktree/branch at the verified remote base.
- [x] Transfer only the allowlisted artifacts and verify the isolated scope.
- [x] Run document, checker-test and formatting checks; inspect the staged diff before committing.
- [ ] Commit scoped files and push the separate branch without force.
- [ ] Verify GitHub branch SHA and exclusion of the five local commits.
- [ ] Complete publication handoff and preserve the original checkout.

## Decisions and verification constraints

GitHub main was independently read as
adbc22007acf4a12f945346d4d52103fa601d0ad. The root-router/catalog files have
no difference between that base and the current local main except our uncommitted
scoped edits, so their transfer will not include another task's changes.

Independent read-only audit found 31 safe candidate files, 272 local links with
tracked/included dependencies, and no credential patterns. Existing Husky
pre-commit uses lint-staged with a default stash; repository rules forbid stash.
Its formatting checks must be satisfied without that behavior. Existing pre-push
runs Prisma generation and the full Jest suite; shared generated-resource changes
must not be run over the original dirty checkout. Record actual hook availability
and checks in the isolated worktree; do not claim an unrun gate passed.

## Verification before publication

- Managed worktree creation completed and attached. An earlier attach attempt
  made while creation was pending failed ownership verification; the completed
  create operation registered the worktree successfully.
- All 32 transferred files (31 authored files and this task) matched SHA-256
  hashes from the original checkout before publication-record updates.
- In the isolated worktree, the operating-doc checker passed with exit 0 for
  25 documents. Its unit suite passed with exit 0: 8 passed, 0 failed, 0 skipped.
- Scoped Prettier check passed with exit 0 for all 32 files, using the existing
  original checkout's installed Prettier and repository configuration.
- Worktree diff whitespace check passed with exit 0. The two tracked root/catalog
  diffs contain only the expected router links and catalog date update.
- The clean worktree has tracked hook sources but no installed Husky wrappers
  under the configured .husky/\_ hook path and no node_modules. Automatic Git
  hooks are therefore unavailable there. Equivalent scoped formatting and
  document/validator checks were invoked explicitly. Application type-check,
  full Jest and build were not run for this operating-doc change; no Prisma
  client or shared generated resource was changed.

## Continuation

Next: inspect the explicit staged allowlist, commit and push, then verify against
the remote-base checkout and publish the chosen branch. External Git actions
require the host's network/filesystem permission as well as Davin's authorization.

# LESSONS-LEARNED.md — Skill Memory (rules distilled from failures)

**What this is:** the seventh memory file — reflexes. Where Deviations record _what happened
once_ and the Decision Log records _what was chosen_, this file records **rules extracted
from failures** (test failures, CI/CD failures, build breaks, deploy incidents) so the same
mistake is never debugged twice by a fresh session.

**Who writes:** the Executor, at session close, whenever an error (a) cost more than ~30
minutes to diagnose, (b) recurred, or (c) reached CI or production. Write the RULE, not the
story — one entry, ≤6 lines.

**Who reads:** the Executor, at every session OPEN (this file is Tier-1: read in full).
**Therefore it must stay SHORT** — hard cap ~40 active lessons. When it grows past that, the
Advisor consolidates: merge duplicates, generalize, move rarely-relevant entries to
`LESSONS-ARCHIVE.md`. A bloated lessons file is worse than none — it buries the reflexes.

**What does NOT belong here:** one-off typos, anything already enforced by a tool (linter,
CI check — if a lesson can become a tool check, PREFER the tool check and note it here as
"automated"), plan changes (Advisor/playbook territory), decisions (Decision Log).

**Entry format:**

```
### L<N> — <short rule as imperative>
- Symptom: <what you saw — the error, the failing test, the CI red>
- Root cause: <the actual why>
- Rule: <what to always/never do from now on>
- Detect early: <the check that catches it in seconds next time>
- Source: <session / CI run / incident> · Status: ACTIVE | AUTOMATED (<check name>) | ARCHIVED
```

---

## Active lessons

_(Seeded 2026-07-11 from documented repo history — verify each on first encounter.)_

### L1 — Never trust a test suite that can't fail when the server changes

- Symptom: `lib/api/` client tests passed 36/36 while every real endpoint call was broken
  (wrong verbs, wrong paths).
- Root cause: the suites fully mocked `fetch` — they tested the mocks, not the contract.
- Rule: parity/contract tests must exercise recorded REAL responses or a live staging
  service; a green suite that mocks the entire boundary is decoration, not verification.
- Detect early: before trusting any suite, ask "what change in the real system would make
  this fail?" If the answer is "none", it proves nothing.
- Source: migration-stack-analysis.md `lib/api/` flag · Status: ACTIVE

### L2 — Never modify package.json overrides on a feature branch

- Symptom: repeated PR merge conflicts on `pnpm.overrides` (7+ documented incidents).
- Root cause: parallel branches independently "fixing" audit warnings collide on main.
- Rule: security overrides land only via dedicated PRs from main; ignore `pnpm audit` on
  feature branches.
- Detect early: `check-overrides.yml` fails the PR.
- Source: errors/continuous-pr-errors/ · Status: AUTOMATED (check-overrides.yml)

### L3 — Prisma migrations run on the DIRECT url; runtime goes through the pooler

- Symptom: (anticipated — from plan §1.4) migrations hang or fail through PgBouncer
  transaction mode.
- Root cause: PgBouncer transaction pooling breaks session-level features migrations need.
- Rule: `migrate deploy` → direct connection; application traffic → pooled URL with
  `pgbouncer=true`. Never swap them.
- Detect early: migration command hanging >60s through the pooler = this.
- Source: plan §3 step 1.4 · Status: ACTIVE (verify during Session 1-3)

### L4 — A ported test that "needs" its assertion changed is a finding, not a fix

- Symptom: ported suite fails in the new service; changing the expected value makes it green.
- Root cause: the port changed behavior; the assertion was the parity oracle doing its job.
- Rule: never edit a ported assertion to pass without first explaining WHY the behavior
  differs, in Deviations, with evidence. The old behavior is correct until proven otherwise.
- Detect early: any diff touching `expect(...)` lines in a ported test file.
- Source: TEMPLATE-PORT rules · Status: ACTIVE

### L5 — Feature branches are perishable: merge within days or salvage-and-delete

- Symptom: PRs from `claude/*` branches fail CI with compilation errors and show
  unmergeable conflicts (2026-07: 13 branches found 97–1,845 commits behind main; 8 had
  zero unique commits).
- Root cause: branches cut from old main and never rebased; main advanced ~1,800 commits;
  CI compiles ancient-branch + modern-main hybrids.
- Rule: never attempt to merge or rebase a branch that is hundreds of commits behind —
  cherry-pick its unique commits onto a fresh branch from today's main, verify, re-PR,
  delete the old branch. During the migration, CC-F applies: trunk-based + flags, no
  long-lived branches at all.
- Detect early: before opening any PR, `git rev-list --count origin/main..HEAD` and
  `...HEAD..origin/main` — behind >50 means salvage, not merge. Audit remote branches only
  after `git fetch --all --prune`; local tracking refs lie (2026-07-12: a brief built from
  stale local refs claimed 13 branches, 97–1,845 behind, 8 zero-commit; a fresh fetch found
  only 3 branches, all with real content — the other 10 were pre-cleanup fossils no longer
  on the remote).
- Source: git audit 2026-07-11 (Cowork session) · Status: ACTIVE

### L6 — Config-file paths must match filesystem case exactly

- Symptom: `tsc --noEmit` failed on `archive/part6-flask-mt5/lib/api/mt5-transform.ts`
  in both the husky pre-push hook and CI's `type-check` job — for every branch, not just
  one — even though `tsconfig.json` explicitly excludes that folder.
- Root cause: the exclude entry was `"Archive"` (capital A); the real directory is
  `archive` (lowercase). Case-insensitive filesystems (macOS default, Windows) silently
  matched it anyway, so the bug was invisible on those; case-sensitive Linux (every GitHub
  Actions runner, and this container) never matches it, so the folder always leaks in.
- Rule: any path string in a config file (`tsconfig.json` exclude/include, `.eslintignore`,
  jest `roots`/`testPathIgnorePatterns`, etc.) must match the on-disk casing exactly —
  never trust that it "worked locally" if local is macOS/Windows.
- Detect early: run type-check/lint/test validation in a Linux environment (or just trust
  CI) before declaring a config change correct — don't rely on a local green that was
  earned on a case-insensitive filesystem.
- Source: git audit 2026-07-12, `fix/tsconfig-exclude-case-sensitivity` · Status: ACTIVE

### L7 — A script's `require()` must be backed by a direct dependency, not a transitive one

- Symptom: `npm run validate:policies` → `Error: Cannot find module 'glob'` from
  `scripts/validate-file.js`, even though `glob` exists inside `node_modules/.pnpm`.
- Root cause: `scripts/validate-file.js` does a bare `require('glob')`, but `glob` is
  only a transitive dependency of something else in the tree — pnpm's strict
  `node_modules` doesn't hoist it to top level, so the require 404s.
- Rule: any package a script directly `require()`s must be a direct `dependencies`/
  `devDependencies` entry in `package.json` — never rely on pnpm's non-flat layout
  hoisting a transitive dep for you.
- Detect early: `npm run validate:policies` fails immediately on a fresh
  `pnpm install --frozen-lockfile`; not yet fixed — candidate for a future session
  (add `glob` to devDependencies).
- Source: git audit 2026-07-12 · Status: ACTIVE (not yet fixed)

---

## Archive

_(Consolidated-away or superseded lessons move to `LESSONS-ARCHIVE.md` when created.)_

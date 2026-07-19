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
- **Recurred Session 0-3:** ad-hoc `node -e` YAML-validation script hit the same
  `Cannot find module 'js-yaml'` on a bare `require()`, even though `js-yaml` and
  `yaml` both exist under `node_modules/.pnpm/`. Workaround (not a fix — same
  root cause as above, still not resolved): `require(path.resolve('node_modules/.pnpm/
js-yaml@4.1.1/node_modules/js-yaml'))` — resolve the exact `.pnpm` path directly
  instead of relying on hoisting. Generalizes L7 beyond `glob`: assume ANY package
  used only in an ad-hoc script (not imported by real app/lib code) will hit this.

### L8 — An existing spec covering a domain by path may document a superseded architecture, not lag

- Symptom: `part-04-tier-system` and `part-11-alerts` OpenAPI specs matched their live route
  paths by name, but every response schema, enum, and business rule described a 15-symbol,
  catalog-differentiated tier model the codebase no longer has — V8 rewrote it to a single
  symbol (XAUUSD) with feature-gated (not catalog-gated) tiers.
- Root cause: assumed "an existing spec covers this path" meant "mostly current, needs light
  patching" — didn't check whether the underlying product model itself had changed before
  triaging for mere drift.
- Rule: before patching any existing contract/spec, verify the business model it assumes
  (pricing tiers, feature gates, catalog size) against live config constants (e.g.
  `lib/tier-config.ts`), not just that route paths/methods line up. Separately, diff
  request/response field names individually — a spec can get the path right and a field
  name wrong (found: `newPassword` vs. live `password` in `part-05-authentication`).
- Detect early: grep the relevant `lib/*-config.ts` for version/architecture comments
  ("V8", "single-symbol", etc.) before trusting any spec's tier/business-rule claims.
- Source: Session 0-2 (F1 batch-1 triage) · Status: ACTIVE

### L9 — "5 candidate specs for this domain" can mean overlapping files, not 5 clean choices

- Symptom: 5 of 6 pre-existing OpenAPI specs for the money domain (`part-12`,
  `part-14`, `part-17`, `part-18`, `part19`) each claimed some subset of the batch's
  routes, but the subsets overlapped — e.g. `payments/dlocal/*` was fully duplicated
  in both `part-12` and `part-18`; `admin/affiliates/*` (9 paths) in both `part-14`
  and `part-17`. One file (`part-17`) additionally had every path missing the `/api`
  prefix — a file-wide bug, not a per-field one.
- Root cause: assumed "these filenames plausibly cover this domain" meant "each file
  owns a disjoint slice" — never checked whether two files claimed the _same_ path
  until diffing full path lists across all candidates side by side.
- Rule: when triaging N "likely-covering" specs for a batch, first build the full
  path list of every candidate file and diff for cross-file duplicates before
  triaging any single file's accuracy. A path appearing in 2+ files is a
  consolidation decision (who's the sole owner?) — escalate it, don't silently patch
  both copies independently or you'll leave two specs free to drift apart again.
- Detect early: `grep -E '^  /' <candidate files> | sort | uniq -d` — any output
  means overlap exists before you've read a single field.
- Source: Session 0-3 (F1 batch-2 triage) · Status: ACTIVE

### L10 — `ts-node` needs an explicit CommonJS override when tsconfig targets ESM

- Symptom: `pnpm run db:seed` (`ts-node prisma/seed.ts`) failed inside a fresh
  `node:20-alpine` container with `TypeError: Unknown file extension ".ts"` /
  `ERR_UNKNOWN_FILE_EXTENSION`, even though the identical script runs fine on
  contributors' existing machines.
- Root cause: `tsconfig.json` sets `"module": "esnext"` / `"moduleResolution": "bundler"`
  (correct for the Next.js app code) but `package.json` has no `"type": "module"`. Bare
  `ts-node` picks up tsconfig's ESM module setting and defers to Node's native ESM loader,
  which doesn't know how to parse a raw `.ts` file — it only works today because existing
  dev machines have some cached/global ts-node state papering over it.
- Rule: any one-off `ts-node <file>.ts` invocation in a clean environment (fresh container,
  CI, a new contributor machine) needs `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}'`
  set (env var or CLI flag) to force ts-node's classic CJS transpile path — don't assume
  ts-node "just works" from tsconfig alone when the package has no explicit `"type"` field.
- Detect early: `ERR_UNKNOWN_FILE_EXTENSION` on a `.ts` file being run via `ts-node` (not
  plain `node`) is this, not a missing dependency.
- Source: Session 0-5 (`docker-compose.dev.yml` seed-step verification) · Status: ACTIVE

### L11 — Never leave `docker-compose.dev.yml` running while pushing/testing

- Symptom: `git push` failed pre-push validation — `test:quick` (Jest) showed real
  failures (`Database connection failed`, unexpected `429` instead of `400`) on suites
  that were 100% green in the Session 0-4 baseline just one session earlier.
- Root cause: `jest.setup.js` hardcodes `DATABASE_URL=postgresql://test:test@localhost:
5432/test` and `REDIS_URL=redis://localhost:6379` for every test run, assuming nothing
  real is listening there. `docker-compose.dev.yml`'s `postgres`/`redis` services publish
  those exact same host ports — so instead of failing cleanly (no server) or being mocked,
  tests silently hit a **real** Postgres (wrong user/db → auth failure) and a **real**
  Redis (rate limiter actually engages, flipping expected `400`s to `429`s).
- Rule: stop the local dev stack (`docker compose -f docker-compose.dev.yml down`) before
  running the test suite, pre-push hooks, or CI-equivalent checks locally. The two are
  mutually exclusive on this machine as long as both use the default 5432/6379 ports.
- Detect early: any test failure mentioning a real DB/Redis error (not a mock) — check
  `docker compose -f docker-compose.dev.yml ps` first before assuming a regression.
- Source: Session 0-5 (pre-push validation on the session-close commit) · Status: ACTIVE

### L12 — Docker bind mounts from Git Bash need `MSYS_NO_PATHCONV=1`

- Symptom: `docker run -v "$(pwd)/dir:/dump" ... pg_dump ... -f /dump/file.dump` failed
  with `could not open output file "/dump/file.dump": No such file or directory`, even
  though the host directory existed and the mount flag looked correct.
- Root cause: Git Bash (MSYS) auto-converts any command-line argument that looks like a
  POSIX path — including the **container-side** half of a `-v host:container` mount
  (`/dump`), which Docker never asked to have translated. The container ends up with no
  real `/dump` mount point.
- Rule: prefix any `docker run -v ...` invocation from Git Bash with `MSYS_NO_PATHCONV=1`
  (env var, not a flag) to stop MSYS from rewriting paths it shouldn't touch.
- Detect early: a bind-mounted path working on the host but "not found" inside the
  container, specifically on Windows + Git Bash — not a Docker or permissions bug.
- Source: Session 1-1 (restore-rehearsal `pg_dump`/`pg_restore`) · Status: ACTIVE

### L13 — `postgres:17` (non-alpine) pulls can fail mid-layer on this network; alpine doesn't

- Symptom: `docker pull postgres:17` failed 3 times in a row with
  `failed to copy: local error: tls: bad record MAC`, always after several layers had
  already downloaded successfully.
- Root cause: unclear (network/proxy/TLS-stack interaction with Docker Hub's CDN for that
  specific image's larger layers) — not a Docker Desktop crash, not a disk issue.
- Rule: if a `docker pull` of a large official image fails with a TLS/transport error
  more than once, try the `-alpine` (or other minimal) variant before troubleshooting the
  network — it has fewer/smaller layers and may simply avoid the failure-prone one. Use
  the alpine tag for throwaway/scratch containers whenever the app itself doesn't need
  the full image's extra tooling.
- Detect early: `tls: bad record MAC` or similar transport errors during `docker pull`,
  recurring across retries of the same tag.
- Source: Session 1-1 (`postgres:17` failed 3x, `postgres:17-alpine` pulled clean on
  first try) · Status: ACTIVE

### L14 — A backgrounded dev server's launch PID is not its listening PID

- Symptom: `kill $(cat server.pid)` (PID captured right after `nohup ... &`) succeeded
  with no error, but the server was still listening on its port afterward.
- Root cause: the captured PID was the shell wrapper (`pnpm exec ...`) that `nohup`
  launched, not the actual `next-server` child process it spawned — killing the wrapper
  doesn't kill children that already detached.
- Rule: after killing a backgrounded dev-server PID, verify the port is actually free
  (`netstat`/`lsof`) before assuming teardown succeeded; if still listening, find the
  real PID via the port (not the launch command) and kill that one.
- Detect early: port still shows `LISTENING` in `netstat -ano` right after a "successful"
  kill of the captured launch PID.
- Source: Session 1-1 (restore-rehearsal app-boot teardown) · Status: ACTIVE

### L15 — Git Bash strips backslashes from Windows-style paths passed to native .exe args

- Symptom: `node -e "...fs.writeFileSync('C:\Users\WiN\...\file.txt', ...)..."` run via
  Bash failed with `ENOENT`, and the error message showed the path with backslashes
  **removed entirely** (`C:UsersWiN...`), not just mis-escaped.
- Root cause: Git Bash/MSYS rewrites arguments that look like paths before handing them to
  a native Win32 executable (`node.exe`); backslash sequences it doesn't recognize as
  escapes get silently dropped, not preserved. This is the same family of issue as L12
  (Docker bind-mount path mangling) but hits any native .exe invoked from bash, not just
  `docker run -v`.
- Rule: when constructing a Windows path to embed in a command passed to a native
  executable from Git Bash, use forward slashes (`C:/Users/WiN/...` — Node and most
  Win32 APIs accept this natively) instead of backslashes. Don't rely on
  `MSYS_NO_PATHCONV=1` here — that suppresses the opposite conversion (POSIX-style
  `/c/...` paths getting rewritten), not backslash-stripping.
- Detect early: a path argument that "worked" when typed but shows up mangled/truncated
  in the resulting error message, specifically when it contains backslashes and targets
  a native (non-MSYS) executable.
- Source: Session 1-3 (building a PgBouncer userlist file) · Status: ACTIVE

### L16 — Always run `migrate status` before `migrate deploy` against an unfamiliar production DB

- Symptom: (caught before it happened) about to run `prisma migrate deploy` against
  production Postgres just to verify direct-URL connectivity for an unrelated task
  (PgBouncer/L3 verification).
- Root cause: assumed a DB matching its Prisma schema meant its migration history was
  also in sync. It wasn't — `migrate status` revealed ALL migrations unapplied
  server-side (no tracked history), including one that would `DROP TABLE` two live,
  data-holding tables (`DECISION-LOG.md` F20).
- Rule: before ever running `prisma migrate deploy` against a database you didn't
  personally baseline, run `prisma migrate status` (read-only) first and read every
  pending migration's SQL, not just its name — a migration name like
  `drop_watchlists` is easy to skim past as "probably fine, already done" when it isn't.
  If any pending migration is destructive (DROP/TRUNCATE/irreversible ALTER) and the
  affected table has live data, stop and escalate — don't let a verification step for
  an unrelated task become the thing that silently applies it.
- Detect early: `migrate status` reporting more pending migrations than you expect,
  especially including migrations older than the feature you're actually working on.
- Source: Session 1-3 (L3/PgBouncer verification) · Status: ACTIVE

---

## Archive

_(Consolidated-away or superseded lessons move to `LESSONS-ARCHIVE.md` when created.)_

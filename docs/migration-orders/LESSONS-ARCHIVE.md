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

### L17 — Alpine's `pgbouncer` package has no built-in non-root user

- Symptom: container exited immediately with `FATAL PgBouncer should not run as root`,
  even though the Dockerfile never explicitly set `USER root` — it just never set any
  `USER` at all.
- Root cause: unlike the Debian/Ubuntu `pgbouncer` package (which creates a `pgbouncer`
  system user on install), Alpine's `pgbouncer` (1.22.1-r0) installs no dedicated user —
  confirmed via `grep pgbouncer /etc/passwd /etc/group` returning nothing after
  `apk add pgbouncer`. The binary itself refuses to start as UID 0 regardless.
- Rule: on Alpine, explicitly `addgroup -S pgbouncer && adduser -S -D -H -G pgbouncer
pgbouncer`, `chown` the config/auth-file directory to that user, and set
  `USER pgbouncer` in the Dockerfile — don't assume the package creates one for you the
  way other distros' packages do.
- Detect early: `docker run` a freshly-built pgbouncer image locally before ever
  deploying it — the failure is immediate and unambiguous in the logs, cheaper to catch
  there than after a Railway deploy.
- Source: Session 1-3b (PgBouncer image build) · Status: ACTIVE

### L18 — `railway domain` only creates HTTP(S) domains, never a raw TCP proxy

- Symptom: `railway domain --service <svc> --port 6432 --json` succeeded and returned a
  domain, but it was `https://<name>-production-<hash>.up.railway.app` — Railway's HTTP
  edge type (confirmed via `railway domain list --json`: `"type": "service"`), which
  cannot carry a non-HTTP protocol like Postgres wire format.
- Root cause: assumed `--port <arbitrary-tcp-port>` meant "expose this port over TCP"
  the way Postgres's own `RAILWAY_TCP_PROXY_DOMAIN`/`_PORT` variables suggested was
  possible for any service. In this CLI version (5.27.0) it doesn't — `railway domain`
  is HTTP-only; genuine TCP Proxy provisioning for a custom (non-database-template)
  service has no equivalent CLI command, and `railway config pull` (the IaC path that
  might expose it directly) requires installing a separate Railway TypeScript SDK not
  present in this environment.
- Rule: don't assume a CLI subcommand named generically ("domain") covers every kind of
  public networking a platform offers — check the actual `domain` `type` field in the
  JSON response (`"service"` vs. whatever a real TCP proxy would report) before relying
  on it, and prefer verifying private-network services via L19's pattern instead of
  chasing public TCP exposure for a custom service in this CLI version.
- Detect early: `railway domain list --json` immediately after creating one — `"type":
"service"` on a database-protocol service is the tell that it won't work.
- Source: Session 1-3b (PgBouncer external reachability) · Status: ACTIVE

### L19 — Verify a private-network-only service from inside the network, not via a new public proxy

- Symptom: needed to test a newly-deployed Railway service (PgBouncer) that only had a
  private (`*.railway.internal`) address, from a local dev environment with no VPN/direct
  access into Railway's private network.
- Root cause: the natural first instinct — expose it publicly (TCP proxy) just long
  enough to test it — adds real (if temporary) internet-facing attack surface for a
  database-adjacent service, and turned out to be blocked/unavailable anyway (L18).
- Rule: when verification is the only reason external reachability is needed, prefer
  deploying a small throwaway service into the _same_ Railway project/environment
  instead — it gets private-network DNS resolution to every sibling service for free
  (`<service>.railway.internal`), can run the verification as its own startup command,
  report results via `railway logs`, and gets deleted immediately after
  (`railway service delete`). Zero public exposure, same verification confidence, and
  it's also a better fit for a "never break the always-on paths" blast-radius
  discipline than temporary public exposure would be.
- Detect early: before requesting a public domain/proxy "just for testing," ask whether
  a same-environment throwaway service would reach the target privately instead —
  usually cheaper and strictly safer.
- Source: Session 1-3b (PgBouncer pass-through auth + Prisma CRUD verification) ·
  Status: ACTIVE

### L20 — `railway up --service <name>` needs explicit `--project`/`--environment` too, or it may create a whole new project

- Symptom: `railway up --service verify-1-4 --ci --json`, run from a scratch directory
  with no local `.railway` link file, deployed successfully — but into a **brand-new,
  separate Railway project** also named "verify-1-4", not the same-named service that
  already existed inside the intended `trading-alerts`/`production` project (created
  moments earlier via `railway add --service verify-1-4`).
- Root cause: `--service <name>` alone only selects which service to target _within
  whatever project/environment context is already established_. With no local link
  file and no `--project`/`--environment` flags, `railway up` falls back to its
  cold-start "create a new project" behavior — the same-named service in a different
  project is invisible to it; there's no error or prompt warning that a new project is
  about to be created instead.
- Rule: when deploying via `railway up` from a directory that isn't `railway link`ed to
  the target project (e.g. a throwaway scratch dir for a verification service), always
  pass **both** `--project <id>` **and** `--environment <id>` explicitly alongside
  `--service <name>` — never rely on `--service` alone to disambiguate. Get the project
  ID from `railway status --json` first.
- Detect early: after any `railway up`, check the JSON response's `projectName`/
  `projectId` (or absence thereof) against the intended project before doing anything
  else — don't assume success means "deployed to the place I meant."
- Source: Session 1-4 (combined smoke-test verifier deploy) · Status: ACTIVE

### L21 — A hand-maintained ambient type stub can shadow a real package's generated types

- Symptom: `new PrismaClient({ adapter, log: [...] })` failed `tsc` with "Object literal
  may only specify known properties, and 'adapter' does not exist in type
  'PrismaClientOptions'" — even though the actual generated `.d.ts`
  (`node_modules/.prisma/client/index.d.ts`) clearly declared `adapter?:` as a valid
  optional property, confirmed by reading the file directly.
- Root cause: `types/prisma-stubs.d.ts` (a hand-written fallback for environments where
  `prisma generate` can't reach the network, per its own header comment) declares its
  own `declare module '@prisma/client' { ... export type PrismaClientOptions = {...}
... export class PrismaClient {...} ... }` block — a full, independent redeclaration
  of the module, not just an augmentation. That stub predated the `adapter` option and
  was silently governing the type-check instead of the real generated types.
- Rule: when a `tsc` error about a package's shape flatly contradicts what the
  package's own installed `.d.ts` says, grep for `declare module '<package-name>'`
  across the repo (especially `types/*.d.ts`, `*.d.ts` at the root) before assuming the
  installed package is wrong or fighting the generic type machinery — a stub declaring
  the _entire_ module (not just augmenting one field) fully shadows the real types.
- Detect early: `grep -rn "declare module '<pkg>'" --include=*.d.ts` the moment a type
  error about a well-known package's own documented API "doesn't exist."
- Source: Session 2-1 (Prisma 7 upgrade, driver-adapter typing) · Status: ACTIVE

### L22 — When WebFetch/WebSearch both fail with an unrelated internal error, work around via curl, don't keep retrying URLs

- Symptom: both `WebFetch` and `WebSearch` returned the identical error "There's an
  issue with the selected model (MiniMax-M2)" against 3 different URLs (Prisma docs,
  GitHub releases, a generic search query) — clearly a tool/infrastructure fault, not
  anything about the specific URLs.
- Root cause: an internal summarization-model dependency these tools route through was
  unavailable this session; retrying different URLs through the same broken tool never
  helps.
- Rule: after ONE confirmed failure with the same generic error across 2+ different
  URLs/queries, stop retrying WebFetch/WebSearch and fall back to `curl -s -L <url> -o
<scratchpad-path>` + a small Node script stripping HTML tags to extract readable
  text, then `Read` the result directly — this fully substitutes for WebFetch when it's
  down. Write the curl output to the scratchpad directory using forward-slash paths
  (`C:/Users/...`), never `/tmp` — Git Bash mismaps `/tmp` to the wrong drive root on
  Windows (`D:\tmp` instead of the real temp dir), and native `node.exe` needs
  forward slashes anyway per L15.
- Detect early: the exact string "issue with the selected model" from either tool is
  the tell — don't waste a second call confirming it's not URL-specific unless the
  first retry is free.
- Source: Session 2-1 (Prisma 7 upgrade guide fetch) · Status: ACTIVE

### L23 — Check the playbook's own session numbering before inventing an ad-hoc follow-on label

- Symptom: at Session 2-2's close, PRE-DRAFTed a follow-on session self-labeled
  "2-2b" for the consumer-import-repointing work, without checking whether the
  playbook already scoped and numbered that work. Davin's next message asked to
  "PRE-DRAFT session 2-3's order" — which, per
  `monolith-to-microservices-migration-session-playbook.md` lines 175–194, is
  actually "Baseline migration + FK audit" (plan steps 2.3–2.4), a materially
  different and _earlier_ session than the import-repointing I'd invented. The
  import-repointing work I'd called "2-2b" is really the playbook's own **Session
  2-4** ("Rewire the monolith," plan steps 2.5–2.6) — meant to run **after** 2-3, not
  immediately after 2-2.
- Root cause: assumed the natural next step (cutover) needed its own session and
  invented a label for it, without first grepping the playbook for whether the next
  1-2 sessions were already numbered and scoped. Had the wrong PRE-DRAFT been
  CONFIRMed and executed as-is, it would have skipped the migration-baseline/FK-audit
  step entirely — repointing imports against an unbaselined migration history with
  the money↔User FK constraints still live, silently dropping the intended
  sequencing.
- Rule: before PRE-DRAFTing any follow-on session at close, grep
  `monolith-to-microservices-migration-session-playbook.md` for the current phase's
  session list first. If the playbook already numbers and scopes the next session(s),
  use those numbers/scopes verbatim — don't invent an ad-hoc sub-label (`<N>b`, `<N>c`)
  for work the playbook already assigns its own number. Only invent an ad-hoc label
  for genuinely unplanned/ad-hoc sessions (incidents, repairs) per
  `EXECUTOR-PROTOCOL.md` §6's "Ad-hoc sessions" rule — never for in-plan follow-on
  work.
- Detect early: before writing a PRE-DRAFT's session number, run
  `grep -n "Session <N+1>\|Session <N>b" docs/migration-orders/*session-playbook.md`
  — if the playbook already has an entry for what you're about to invent a label for,
  use its number and scope instead.
- Source: Session 2-2 follow-up close (2026-07-20) · Status: ACTIVE

### L24 — Prisma 7's migrations path is singular and config-driven, not per-`--schema`; don't assume one Postgres DB can safely host two independent migration histories

- Symptom: the Session 2-3 PRE-DRAFT assumed two split schema files
  (`prisma/market-data/schema.prisma`, `prisma/non-market-data/schema.prisma`) could
  each get their own migration history (`.../migrations/`) against the one shared
  production Postgres instance, baselined independently. At CONFIRM, this turned out
  to not be buildable as scoped.
- Root cause: `prisma migrate status --schema=<other-schema>` was assumed to also
  pick up a migrations folder next to that schema file (mirroring how `prisma
generate --schema=<path>` cleanly produces a separate client per schema — the exact
  mechanism F5 relied on). It doesn't. The migrations path is a single, global
  setting on `prisma.config.ts` (`migrations.path`), not a per-`--schema` resolution.
  Empirically confirmed: `prisma migrate status --schema=prisma/market-data/schema.prisma`
  still read from `prisma/migrations`, the one shared folder. Building the intended
  mechanism would have required new per-schema config files (`--config=`) _and_ an
  unverified assumption on top — that two independent histories can share Postgres's
  one `_prisma_migrations` table without one config's `migrate status`/`deploy`
  choking on rows left by the other's migrations. No staging environment exists to
  test that safely (Phase 0's CC-A gap).
- Rule: when a migration order's plan assumes "N schema files → N independent
  migration histories," verify the CLI/config mechanism empirically _before_ writing
  the Ordered Steps around it — test the exact command with `--schema=<other-file>`
  and read where it says it's finding migrations from, don't infer it from the
  generate-side behavior (client generation and migration-history resolution are
  governed by different config keys and don't necessarily parallel each other). If
  physically splitting a database is still a future goal, keep one shared migration
  history against the one shared database until that physical split actually
  happens — don't simulate a multi-database posture against a single database via
  config tricks alone.
- Detect early: `grep -A3 "migrations:" prisma.config.ts` — if `path` is a single
  hardcoded string (not derived from `--schema`), any "independent history per
  schema" plan needs new config scaffolding designed and reviewed before an order's
  Ordered Steps assume it already works.
- Source: Session 2-3 (baseline migration history + FK audit), CONFIRM phase,
  2026-07-20 · Status: ACTIVE

### L25 — A "known consumer files" grep is only as good as its blind spots: indirect consumption, case-sensitivity, and relation direction all hide real call sites

- Symptom: Session 2-4's CONFIRM inherited a "16 known consumer files" premise
  (literal `import ... from '@prisma/client'` grep, from Session 2-1). Re-running it
  found real drift (14, not 16) but the bigger problem was methodological: ~97 more
  files consume Prisma via the `lib/db/prisma.ts` singleton (`import { prisma } from
'@/lib/db/prisma'`), invisible to a grep for the literal package specifier. CONFIRM
  also claimed "zero files touch MarketDataV6" — false: 2 files use
  `prisma.marketDataV6` (the camelCase client property), which a grep for the
  PascalCase model name `MarketDataV6` never matches. And the FK-audit
  `.user`-include grep only ever checked ONE relation direction — `Subscription/
Payment/FraudAlert/AffiliateProfile → User` — never the reverse
  (`User.include.subscription/payments`), which broke 5 more files, only caught by
  `tsc --noEmit` after the first round of fixes.
- Root cause: each grep was scoped to how the code happened to look at the moment it
  was written, not to the actual mechanism (a shared singleton indirects almost all
  real consumption; Prisma model names and their generated client properties differ
  in case; a dropped `@relation` breaks both sides of it, not just the one being
  audited).
- Rule: when inventorying "who touches X" in a codebase with a shared client/service
  singleton, grep the SINGLETON'S OWN import graph, not a literal specifier string —
  and treat any singleton as the de facto choke point, not each direct importer.
  When grepping for a Prisma model by name, ALSO grep the camelCase client-property
  form (first letter lowercased) — they diverge in exactly this class of search.
  When a migration/schema change drops a relation, grep BOTH sides of it (the
  model's own includes AND the reverse side's), not just the side the change notes
  originally called out. Trust `tsc --noEmit` as the final backstop, not the grep —
  but don't treat a clean grep as proof there's nothing left for tsc to find.
- Detect early: after any "N known files" inventory, sanity-check it against the
  actual mechanism (singleton import count via `grep -rl 'from .@/lib/.../singleton.'`,
  not the wrapped package) before trusting the number for scope/entry-criteria
  purposes.
- Source: Session 2-4, CONFIRM phase and mid-execution (`tsc --noEmit` surfaced the
  camelCase and reverse-relation misses after the first fix pass), 2026-07-20 ·
  Status: ACTIVE

### L26 — A shared jest.mock() setup file only intercepts a module if it's imported before that module — and `eslint --fix`'s import/order rule doesn't know that

- Symptom: `__tests__/lib/jobs/alert-checker.test.ts`'s Prisma mock silently stopped
  applying — `prisma.alert.findMany` was a real, unmocked bound function, not a
  jest.fn(), with no error until `.mockResolvedValue()` was called on it. Separately,
  mid-session, a routine commit's pre-commit `eslint --fix` reordered
  `import { prismaMock } from '../../setup'` to AFTER the module-under-test import in
  5 other test files, and `npm run test:ci` silently dropped from 111/111 to 106/111
  — no lint error, no test-runner warning, just wrong results.
- Root cause: `jest.mock()` calls are hoisted to the top of the FILE THEY'RE WRITTEN
  IN by Jest's SWC/babel transform — that hoisting is per-file, not transitive. A
  shared `__tests__/setup.ts` that calls `jest.mock('@/lib/db/prisma', ...)` only
  registers that mock for a given test file if `setup.ts` itself is imported (and
  therefore evaluated) before anything else in that file requires `@/lib/db/prisma`
  — ES imports execute in declaration order. `alert-checker.test.ts` never imported
  `setup.ts` at all (it imported `{ prisma }` directly from `@/lib/db/prisma`), so it
  always got the real client regardless of anything else changed. The 5-file
  regression was the same mechanism from the opposite direction: `eslint --fix`'s
  `import/order` rule sorts relative parent imports (`'../../setup'`) after aliased
  `@/...` ones, with zero awareness that THIS particular relative import has a
  load-bearing side effect that must run first.
- Rule: any test file using a shared `jest.mock()`-based setup file must import that
  setup file as the FIRST import — before any import that transitively touches the
  mocked module. Wrap that import (and everything that must stay after it but before
  unrelated imports) in `/* eslint-disable import/order */` ... `/* eslint-enable
import/order */` so `eslint --fix` can't silently re-break it — a plain comment
  explaining "don't reorder this" is NOT sufficient, `eslint-disable-next-line` is
  NOT sufficient either (verified: it left the comment in place but still moved the
  import). A file that needs the shared mock but never imports the setup file at all
  (only imports the mocked module directly) gets NO benefit from the shared mock no
  matter what order anything is in — it needs its own local `jest.mock()` override
  written directly in that file (hoisting works fine for that, same-file).
- Detect early: after any commit that touches test files' imports (including via
  `eslint --fix`), re-run the full suite and compare pass count — a drop with no
  visible lint/type error is the signature of this bug, not a flaky test.
- Source: Session 2-4, mid-execution (`alert-checker.test.ts`) and again at session
  close via a pre-commit `eslint --fix` pass, 2026-07-20 · Status: ACTIVE

### L27 — A server-only import anywhere in a module taints the WHOLE module for every `'use client'` importer — and only `next build` catches it, not `tsc` or `jest`

- Symptom: `npm run type-check` (`tsc --noEmit`) and `npm run test:ci` were both
  fully green throughout Session 2-1 (which introduced the pattern) and Session
  2-4 (which touched the same files) — production would have deployed with a
  broken build undetected. `npm run build` alone failed with
  `Module not found: Can't resolve 'dns'`, traced to
  `app/affiliate/register/page.tsx` ('use client') → `lib/affiliate/constants.ts`
  → `lib/db/prisma.ts` → `@prisma/adapter-pg` → `pg`, which needs Node's `dns`,
  unavailable in a browser bundle.
- Root cause: `lib/affiliate/constants.ts` mixed one client-safe constant
  (`AFFILIATE_CONFIG`) with 6 server-only DB-backed functions in the same file,
  behind a single top-level `import { prisma } from '@/lib/db/prisma'`. Next.js's
  client/server module-graph boundary operates at the FILE level, not the
  export level — a `'use client'` page importing even one client-safe export from
  a file taints the entire module, pulling every one of that file's other
  imports (including transitively server-only ones) into the client bundle.
  Neither `tsc --noEmit` nor `jest` model Next's bundler-level module graph at
  all, so both stay clean regardless — only `next build`'s actual webpack/
  Turbopack bundling step evaluates which module ends up in which bundle.
- Rule: any file that exports both client-safe values (constants, types) and
  server-only logic (DB calls, Node built-ins, secrets) must be split into two
  files — never trust that "the client component only imports the safe export"
  is enough, because the import boundary is per-file, not per-export. When
  auditing a `lib/*` file for client-safety, check its own imports transitively
  (does it import a DB client, an adapter, `fs`, `crypto`'s Node module, etc.),
  not just what it exports.
- Detect early: `npm run build` must run at least once per session that touches
  any file imported by a `'use client'` page — `tsc --noEmit`/`jest` passing is
  NOT sufficient evidence a session's changes are deployable. Treat "build
  hasn't been run this session" as its own gap, same weight as a failing test.
- Source: Session 2-4 (F22, discovered via the corrected order's own "done when"
  checklist requiring `npm run build`; confirmed pre-existing to Session 2-1 via
  git blame, but invisible to both prior sessions' verification suites), 2026-07-20
  · Status: ACTIVE

### L28 — `cmd | tail` (or any pipe) hides the real command's exit code

- Symptom: `npm install 2>&1 | tail -40` reported exit 0 via `run_in_background`'s
  completion notification, but the tail of its own output clearly showed
  `npm error code ERR_SSL_CIPHER_OPERATION_FAILED` — the install had actually failed.
- Root cause: in a pipeline without `pipefail`, `$?` (and therefore the reported exit
  code) reflects the LAST command in the pipe (`tail`), not the one that matters
  (`npm install`). `tail` almost always succeeds, so the failure was fully invisible
  to anything checking only the exit code.
- Rule: never pipe a command whose exit code you intend to check (`| tail`, `| head`,
  `| grep`) without `set -o pipefail` first, or check `${PIPESTATUS[0]}` explicitly.
  When in doubt, redirect to a file and inspect separately instead of piping.
- Detect early: a "successful" background-task notification for any piped command is
  not proof of success — grep the actual output for `error`/`Error`/non-zero-looking
  strings before trusting it, especially for `npm install`/`npm ci`.
- Source: Session 3-1 (`operation-service` dependency install), 2026-07-21 · Status: ACTIVE

### L29 — A leftover `.prisma/client` from a manual `prisma generate` masks a missing build-step wiring; only a genuinely clean install exposes it

- Symptom: `operation-service`'s `npm run build` (`nest build`) passed locally every
  time it was tried, but Railway's first real deploy failed:
  `Module '"@prisma/client"' has no exported member 'PrismaClient'` — 4 TS errors,
  all downstream of the same missing export.
- Root cause: the `build` script (`nest build`) never ran `prisma generate`; nothing
  in `package.json` wired it in. Local testing had manually run `npx prisma generate`
  once early in the session, which silently left `node_modules/.prisma/client`
  populated for every subsequent local build — masking that the automated path
  (`npm ci` → `npm run build`, no human running `prisma generate` by hand in between)
  was broken. Railway's build starts from a genuinely clean `node_modules` every time,
  so it was the first environment to actually exercise the real, wired-up path.
- Rule: any service with a Prisma schema needs `prisma generate` wired into
  `postinstall` (or `prebuild`), matching the root app's own convention — never rely
  on a manual `prisma generate` run earlier in the same session to prove the build is
  self-sufficient. Before trusting a local "build succeeds," check whether anything in
  the CURRENT shell session already ran `prisma generate` by hand.
- Detect early: `rm -rf node_modules/.prisma dist && npm ci && npm run build` — a
  genuinely clean reinstall-and-build, not just `npm run build` again — is the only
  local check that would have caught this before the first real deploy attempt.
- Source: Session 3-1 (`operation-service` first Railway deploy), 2026-07-21 ·
  Status: ACTIVE

### L30 — A new standalone NestJS sibling project must be added to the root `tsconfig.json`'s `exclude` list the moment it's created

- Symptom: `git push` failed at the pre-push hook's `npm run type-check` — real `tsc`
  errors inside `operation-service/src/health/health.controller.ts` (decorator-related:
  TS1241/TS1270/TS1206), even though `operation-service`'s own `npm run build`/`npm test`
  were both green and had been re-verified moments earlier.
- Root cause: the root `tsconfig.json`'s `include` is `**/*.ts` (repo-wide) and its
  `exclude` list already carries a `"railway-gateway"` entry (comment: "Separate NestJS
  project, has own tsconfig.json + package.json") for exactly this reason — but
  `operation-service`, a brand-new sibling NestJS project created this session, was
  never added alongside it. Root's `tsconfig.json` has no `experimentalDecorators`/
  `emitDecoratorMetadata` (a Next.js app doesn't need them), so any NestJS decorator
  syntax root's `tsc` accidentally picks up fails to parse correctly. None of
  `operation-service`'s own local checks (`npm run build`, `npm test`, run from inside
  `operation-service/`) can catch this — they only ever see their own tsconfig, never
  the root's. Only the ROOT's `type-check`/`validate`/pre-push hook exercises the
  contaminated path, and nothing in this session's own verification loop ran it until
  `git push` did.
- Rule: the moment a new standalone sibling project (own `package.json`/`tsconfig.json`,
  e.g. a new NestJS service) is created anywhere in the repo root, add it to root
  `tsconfig.json`'s `exclude` array in the SAME commit that creates it, mirroring the
  existing `railway-gateway` entry exactly — don't wait for `npm run type-check` or a
  push to discover the gap.
- Detect early: after scaffolding any new sibling project, run root `npm run
type-check` (or `npm run validate`) once before considering the scaffold done — not
  just the new project's own build/test scripts. `grep -A20 '"exclude"' tsconfig.json`
  to confirm the new directory name is actually listed.
- Source: Session 3-1 (`operation-service` scaffold, discovered at `git push`),
  2026-07-21 · Status: ACTIVE

### L31 — `prisma.config.ts`'s `.env.local` load uses `override: true`; inline shell env vars for a "local-only" Prisma CLI command are silently defeated

- Symptom: `DATABASE_URL=<local> DIRECT_URL=<local> npx prisma db push --schema=prisma/non-market-data/schema.prisma`, intended to target a local Docker Postgres for local-only testing, instead printed `Datasource "db": PostgreSQL database "railway"... at "maglev.proxy.rlwy.net"` — the live PRODUCTION host — despite the inline env vars being set correctly in the same command.
- Root cause: `prisma.config.ts` calls `config({ path: '.env.local', override: true })` (dotenv) unconditionally on every `prisma` CLI invocation. `override: true` means .env.local's stored values overwrite already-set `process.env` entries — including ones a caller just set inline on the same command line — not just fill in gaps. Since `.env.local` holds the real production `DATABASE_URL`/`DIRECT_URL`, ANY bare `prisma <command>` run from repo root silently re-targets production regardless of what the invoking shell exported.
- Rule: never try to point a Prisma CLI command at a different database via inline env vars alone from this repo's root — it will not work and will not warn you. Instead, temporarily `mv .env.local .env.local.bak` (dotenv's `config()` no-ops silently on a missing file) so the override has nothing to load, run the command, then `mv` it back immediately — verify the restore with a `sha256sum` taken before the move, compared after. Never edit .env.local's contents in place for this — a rename-and-restore is zero-diff-risk; an in-place edit is not.
- Detect early: any `prisma` command's own printed `Datasource "db": ...` line — read it every time before trusting a "local" run; a hostname you didn't just type is the tell, and it appears BEFORE anything is actually applied, giving a chance to Ctrl-C. This session's actual `db push` turned out to be a harmless no-op (verified via a follow-up `migrate status` showing zero drift) purely because the schema already matched production — that was luck, not the safe case, and must not be relied on again.
- Source: Session 3-3 (local walkthrough setup), 2026-07-21 · Status: ACTIVE

### L32 — Local Docker Postgres needs SSL explicitly enabled to satisfy code written for Railway's Postgres, and this dev machine has a native `postgres.exe` already squatting on 5432

- Symptom: (a) `operation-service`'s `/health` reported `degraded`/`database: down`
  with `Error opening a TLS connection: The server does not support SSL connections`
  against a freshly-started `docker-compose.dev.yml` Postgres; (b) separately, a
  plain `prisma db push` against `localhost:5432` failed with `P1000: Authentication
failed`, even with the exact credentials `docker-compose.dev.yml` declares.
- Root cause: (a) every Prisma driver-adapter instantiation in this codebase
  (`lib/db/prisma.ts`, `prisma/seed.ts`, `operation-service/src/prisma/prisma.service.ts`)
  hardcodes `ssl: { rejectUnauthorized: false }` — written for Railway's
  TLS-terminating proxy, with no non-SSL branch for local dev; the stock
  `postgres:15-alpine` image has SSL off by default. (b) this dev machine has a
  native Windows `postgres.exe` service already bound to port 5432 (unrelated to
  this migration), silently shadowing Docker Desktop's own `5432:5432` port mapping
  — connections to `localhost:5432` were reaching the native service, not the
  container, hence the credential mismatch.
- Rule: to actually exercise a code path that assumes Railway-style SSL against a
  local Postgres, generate a throwaway self-signed cert (`openssl req -x509 -nodes
...`), `docker cp` it into the container (a Windows bind-mount leaves the key file
  world-readable, which Postgres refuses — copy, then `chown postgres:postgres` +
  `chmod 600` the key, `docker exec -u root`), enable via `ALTER SYSTEM SET ssl = on`
  - `ssl_cert_file`/`ssl_key_file` (each as its own `psql -c`, not combined — combined
    hits `ALTER SYSTEM cannot run inside a transaction block`), then restart the
    container. Separately, if `localhost:5432` auth fails with otherwise-correct
    credentials, check `netstat -ano | grep 5432` / `tasklist /FI "PID eq <pid>"` for a
    second, non-Docker listener before assuming the container's credentials are wrong —
    remap the container to a different host port (a scratch `docker-compose.override.yml`,
    deleted after) rather than touching a pre-existing native service that isn't this
    migration's to stop.
- Source: Session 3-3 (local walkthrough setup), 2026-07-21 · Status: ACTIVE

### L34 — Git Bash's `rm -rf node_modules` on Windows can silently leave partial directories behind, corrupting the next install

- Symptom: after a Railway deploy needed `operation-service/node_modules` temporarily
  removed (L33's workaround while diagnosing the upload-size issue), a fresh `npm ci`
  produced a broken install 3 times in a row — first `ts-jest`/`jest` binaries missing
  entirely, then (after a clean reinstall) `@prisma/client`'s own runtime files missing
  mid-package (`ENOENT ... index-browser.d.ts`), then (after another) the `nest` CLI
  binary missing from `node_modules/.bin` even though its package (`@nestjs/cli`) was
  present. Each looked like a different failure but had the same root cause.
- Root cause: Git Bash's `rm -rf` on a large, deeply-nested `node_modules` tree on
  Windows silently fails partway — `rm: cannot remove '...': Directory not empty` —
  leaving stale files behind (likely a file-lock/long-path interaction, same family as
  L12/L15's other Windows-Git-Bash path quirks). The next `npm ci` then installs on top
  of that partial leftover state, producing inconsistent, hard-to-predict corruption
  instead of a clean failure. A background `npm ci` that's stopped mid-flight (via
  `TaskStop`) compounds this the same way L14 describes for dev servers — the tracked
  PID isn't necessarily the process actually still writing files, so "stopped" doesn't
  mean "safe to touch node_modules again" without checking `tasklist`/`Get-Process`
  first.
- Rule: after any `rm -rf node_modules` on this platform, check the command's own
  output for `Directory not empty` before trusting the removal succeeded — if present,
  don't just re-run `npm ci` on top of it. Either retry the `rm -rf` until it reports no
  errors, or (faster and more reliable here) use PowerShell's
  `Remove-Item -Recurse -Force` instead of Git Bash's `rm -rf` for this specific
  directory. If `npm ci`/`npm test` then still fails with a missing-file error inside an
  otherwise-present package, don't chase it as an application bug first — suspect a
  partial node_modules and try `npm rebuild` (fixes missing `.bin` symlinks without a
  full reinstall) before doing another full `rm -rf` + `npm ci` cycle.
- Detect early: `rm -rf node_modules` printing any `Directory not empty` line is the
  tell — treat the removal as incomplete, not successful, regardless of exit code.
- Source: Session 3-4 (post-deploy local environment restoration), 2026-07-21 ·
  Status: ACTIVE

### L33 — `railway up`'s default upload scope isn't limited to the directory it's invoked from; use `--path-as-root` for a monorepo subdirectory

- Symptom: `railway up --service operation-service ...`, run from inside
  `operation-service/`, failed 3 times in a row with `UPLOAD_FAILED: File too large
(433MB)` — the byte count stayed identical (down to single-digit deltas explained only
  by a just-added file's own size) across: (a) the default invocation, (b) after adding
  `operation-service/.railwayignore` listing `node_modules`/`dist`/`coverage`, (c)
  after physically deleting `operation-service/node_modules` and `dist` from disk
  entirely. None of these changed the uploaded size at all.
- Root cause: the upload was never scoped to `operation-service/`'s own contents in the
  first place — `railway up`'s default archiving (no path argument, invoked from a
  subdirectory of a large monorepo) bundled far more than that one service's directory,
  regardless of any `.gitignore`/`.railwayignore` placed inside it. Neither ignore-file
  mechanism had any effect; only explicitly rescoping the archive root fixed it.
- Rule: when deploying a service that lives in a subdirectory of a larger repo, always
  pass an explicit path with `--path-as-root`: `railway up ./<service-dir>
--path-as-root --service <name> --environment <env> --ci --json`, run from the repo
  root — don't rely on `cd <service-dir> && railway up` plus a local ignore file, even
  though that's the pattern the CLI's own `--no-gitignore` flag implies should
  otherwise work.
- Detect early: if `railway up`'s reported failing byte count doesn't change at all
  after removing/ignoring the thing you assumed was too big, the upload was never
  scoped to your working directory to begin with — stop iterating on ignore files and
  add `--path-as-root` with an explicit path instead.
- Source: Session 3-4 (`operation-service` deploy, 2FA/email-flow endpoints),
  2026-07-21 · Status: ACTIVE

### L35 — "No Vercel dashboard access" blocks dashboard/CLI actions, not reaching the live public site

- Symptom: three consecutive sessions (3-3, 3-4, 3-5) recorded "confirm NextAuth
  production regression-free" as blocked by the standing Vercel-access gap
  (Waiting-on #4) and only ever ran the regression check against the local dev
  server — until Session 3-5 was explicitly asked to check production directly
  and it worked on the first try, no new access of any kind required.
- Root cause: conflated two different gaps. Vercel dashboard/CLI access
  (deployment logs, env-var inspection, build status, preview-branch listing)
  genuinely doesn't exist in this environment. But the production URL is
  public — a real browser (or plain HTTP) can hit it directly, and every prior
  session's own "regression check" (`/login` 200, NextAuth's
  `/api/auth/session` → `{}`, `/dashboard` redirect for a logged-out request)
  is entirely unauthenticated and read-only. None of that needs a Vercel
  account at all, only the URL — which was already sitting in
  `operation-service`'s own `NEXTAUTH_URL` Railway variable the whole time.
- Rule: before writing off a "confirm production behavior" step as blocked by
  the Vercel-access gap, ask whether the specific check is read-only/
  unauthenticated against the public site (works with just the URL) or
  actually needs dashboard/CLI-level information (deployment status, env-var
  values, logs — genuinely still blocked). Don't generalize one gap into the
  other without checking which kind of check is actually needed.
- Detect early: if a "verify production" step only needs a GET/fetch against
  known public routes with no auth, no dashboard login is required — just
  navigate a browser (or Node fetch) to the real production URL directly.
- Source: Session 3-5 (Davin explicitly requested the check; it succeeded
  immediately against `https://trading-alerts-saas-frontend.vercel.app`),
  2026-07-21 · Status: ACTIVE

### L36 — Don't copy a working service's Prisma `ssl` config to a new service without checking what it actually connects to

- Symptom: money-service's first Railway deploy came up ● Online, but `/health` reported
  `database: down` — `Error opening a TLS connection: The server does not support SSL
connections`. The `PrismaService` code was byte-copied from operation-service's own
  (already proven live in production), including `ssl: { rejectUnauthorized: false }` on
  the `PrismaPg` adapter.
- Root cause: `node-postgres`'s `ssl` option, once set to any truthy value, always
  attempts a TLS handshake before authentication even starts. operation-service's copy of
  this code works — but money-service's `DATABASE_URL` genuinely routes through
  `pgbouncer.railway.internal` per its own order's explicit instruction, and PgBouncer's
  listener in this environment rejects TLS outright. Whatever operation-service's own
  `DATABASE_URL` actually resolves to (never printed, per the "never printed" secret
  policy) must be reachable over TLS, or the identical code wouldn't work there — the two
  services' connection targets are NOT interchangeable even though the code was.
- Rule: when porting a `PrismaService`/database-adapter pattern from one already-working
  service to a brand-new one, don't assume `ssl`/TLS options transfer unchanged just
  because the code compiles and the source service works — the actual network path
  (direct-to-Postgres vs. through PgBouncer vs. a different pooler) determines whether TLS
  is even offered. Deploy once, check `/health`'s (or equivalent) database status, and
  read the error text literally — "does not support SSL connections" means remove `ssl`,
  it does not mean the credentials are wrong.
- Detect early: if a freshly-deployed service's DB healthcheck fails with a TLS-negotiation
  error (not an auth error like "password authentication failed" or "role does not
  exist"), the failure is happening before authentication is even attempted — fix the TLS
  option first, re-deploy, and only then re-diagnose if a real auth error surfaces.
- Source: Session 4A-1 (money-service's first deploy), 2026-07-21 · Status: ACTIVE

### L37 — Tracing "what does this file depend on" by grepping only relative (`./`/`../`) imports misses `@/`-alias imports entirely; the miss recurs at every layer, not just once

- Symptom: this session's dependency-tree tracing missed a required file or model
  THREE separate times, each caught later and more expensively than the last: (1) at
  CONFIRM, `User`/`Notification`/`AffiliateProfile` were missing from a Prisma
  schema-subset model list; (2) mid-port, `DisbursementAuditLog` (used by
  `transaction-logger.ts`/`batch-manager.ts`, themselves already-known dependencies of
  `disbursement-processor.ts`) was missing from the same list; (3) also mid-port,
  `types/disbursement.ts` — imported via `@/types/disbursement` by 7 of 11 already-known
  files — was invisible to an explicit CONFIRM-phase grep that only matched
  `from ['"]\.\.?/` (relative paths only), because the alias form starts with `@` not
  `.`/`..`.
- Root cause: each miss came from trusting a shallow trace (this file's own direct
  `prisma.*` calls, or a relative-import-only regex) instead of recursively reading
  every file's actual import list, including `@/`-alias and other non-relative forms.
  A dependency tree's leaves are only fully known once every file in it has been read,
  not once the files you already suspect have been grepped.
- Rule: when scoping "which files does X need," grep for BOTH relative
  (`from ['"]\.\.?/`) AND alias (`from ['"]@/`) import forms across every file already
  in the known set, and repeat on every newly-discovered file until a pass adds
  nothing new — don't stop after one grep pass or assume a shallow trace generalizes.
  For Prisma specifically, also check each file's actual `prisma.<model>.*` calls (not
  just its imports) — a dependency can be a table touched directly, not just an
  imported symbol.
- Detect early: after any "N files in this dependency tree" claim, re-run the alias-form
  grep (`from ['"]@/`) across the full set once — if it surfaces a file not already in
  the list, the trace was incomplete.
- Source: Session 4A-2 (money-service crons port, both at CONFIRM and mid-execution),
  2026-07-21 · Status: ACTIVE
- **Recurred Session 4A-4:** a variant one layer up — not a missing FILE this time, but
  a missing SCHEMA RELATION deliberately omitted by a prior session's own narrower
  scope. Session 4A-2's schema comment explicitly said `AffiliateCode.affiliateProfile`
  was "NOT traversed anywhere" and declared it a bare scalar — true for the crons-only
  scope at the time, but Session 4A-4's `conversion-processor.service.ts` genuinely
  does `include: { affiliateProfile: ... }`. `tsc` caught it immediately at `npm run
build` (`Type ... is not assignable to type 'never'`), so the generalized rule holds:
  a prior session's "not used, omitted" note is scoped to THAT session's file set, not
  a permanent property of the model — re-verify relation/field omissions against the
  NEW session's actual code, don't assume a previous CONFIRM's trace still holds.
- **Recurred Session 4A-6 (5th occurrence overall — 4th of this "prior session's
  narrower-scope omission" schema-relation variant):** same variant as the 4A-4
  recurrence above — Session 4A-4's own schema comment said `Commission.affiliateCodeId`
  stays "a bare scalar" because "nothing in scope traverses it." Session 4A-6's
  `commission-report/route.ts` port genuinely does `include: { affiliateCode: { code,
usedAt } } }` on `Commission`. Caught this time at CONFIRM (reading the route file
  before writing any code), not at `tsc` — proactive dependency tracing generalizes:
  before trusting ANY prior session's "not used, omitted" schema comment, grep the NEW
  session's actual route/service files for `include:`/`select:` blocks touching that
  relation, don't just read the comment and move on. This variant recurring on its 2nd
  try (4A-4, then 4A-6) means it is no longer an edge case — it is the DEFAULT
  expectation every time a new slice's scope expands on a schema shared with prior
  slices.

### L38 — A doc comment quoting a real path containing `*/` silently closes the comment block early, corrupting everything after it

- Symptom: `crons.scheduler.ts`'s first `npm run build` produced ~190 cascading,
  nonsensical parse errors (`Cannot find name 'CRON'`, `'$' — jQuery?`, `Unterminated
template literal` at the file's last line) with no single error pointing at the real
  cause.
- Root cause: the file's own opening `/** ... */` doc comment included the literal text
  `` `app/api/cron/*/route.ts` `` as a path example — the `*/` inside that glob path is
  indistinguishable from the comment's own closing delimiter to the parser, so the doc
  comment ended 3 lines in and everything after was parsed as real TypeScript.
- Rule: never write a literal `*/` sequence inside a `/** ... */` block comment, even
  inside inline code-formatting backticks — a glob path like `dir/*/file.ts` must be
  rewritten (e.g. `dir/<name>/file.ts`) before it's safe to quote in a doc comment.
  Applies to any `/* */`-style comment in any C-like language, not just this file.
- Detect early: ~100+ cascading parse errors from one file, especially ones naming
  totally unrelated identifiers ("Cannot find name 'vercel'", jQuery `$` mentions) is
  the signature of a prematurely-closed comment block, not a real logic bug — check the
  file's own doc comments for a stray `*/` before reading past the first few errors.
- Source: Session 4A-2 (money-service crons scheduler), 2026-07-21 · Status: ACTIVE

### L39 — Booting a full Nest app (`app.init()`) with `ScheduleModule` registered hangs Jest indefinitely unless every `CronJob` is explicitly stopped first

- Symptom: a verification test that called `Test.createTestingModule({...}).compile()`
  → `moduleRef.createNestApplication()` → `app.init()` → inspected
  `SchedulerRegistry.getCronJobs()` → `app.close()` hung forever — no output at all, not
  even a Jest failure, just a stuck process needing to be killed.
- Root cause: `@nestjs/schedule`'s registered `CronJob` instances hold live timers;
  `app.close()` alone doesn't stop them, and Node's event loop stays non-empty forever,
  so Jest waits indefinitely for the worker process to exit naturally (no
  `--forceExit`).
- Rule: don't boot a full Nest application (`app.init()`) just to verify `@Cron()`
  registration or schedule behavior in Jest. Test the decorated methods' business logic
  directly (call `service.methodName()`), and verify cron expressions by reading the
  decorator arguments directly against the source of truth (e.g. `vercel.json`) rather
  than instantiating the schedule at all. If a live `SchedulerRegistry` check is truly
  needed, explicitly `job.stop()` every registered job before the test ends.
- Detect early: a Jest test involving `ScheduleModule`/`SchedulerRegistry` that produces
  zero output and doesn't finish within a normal test's timeframe is this, not a slow
  test — kill it rather than waiting longer.
- Source: Session 4A-2 (money-service crons File 4/6 verification attempt), 2026-07-21 ·
  Status: ACTIVE

### L40 — A module-level `const X = process.env[...] || ''` can't be un-captured by a per-test `process.env` assignment; mock the function instead, and `jest.mock()` must be the file's literal first statement

- Symptom: `dlocal-webhook.controller.spec.ts` had 9 failing tests, all showing
  `console.warn [WARN] No webhook secret configured` — even though every test's
  `beforeEach` set `process.env['DLOCAL_WEBHOOK_SECRET']` before calling the
  controller.
- Root cause: `dlocal-payment.service.ts` reads
  `const DLOCAL_WEBHOOK_SECRET = process.env['DLOCAL_WEBHOOK_SECRET'] || ''` at
  MODULE level (same pattern as the monolith source it was ported from) — evaluated
  once, the moment the module is first `require()`d (via the test file's own `import`
  chain), which happens before ANY `beforeEach` in that file ever runs. Setting
  `process.env` afterward changes nothing; the constant already captured the empty
  string.
- Rule: never rely on a per-test `process.env` mutation to affect a module-level
  `const` read from `process.env` at import time — mock the function that reads it
  instead (`jest.mock('./the-module', () => ({ ...jest.requireActual('./the-module'),
theFunction: jest.fn() }))`). That `jest.mock()` call must be the literal FIRST
  statement in the file, before every `import` (including the one for the
  controller/service under test, which itself transitively `require()`s the module to
  be mocked) — `jest.mock()` only intercepts requires that happen after it registers;
  TypeScript allows non-import statements before `import` declarations at the top
  level, and ts-jest preserves that ordering in its CommonJS output (no
  babel-plugin-jest-hoist auto-hoisting the way a Babel-based Jest config would). This
  is a different failure mode than L26 (a shared `jest.mock()` setup file not imported
  first) — L26 is about inter-file import order; this is about a `jest.mock()` call's
  own position relative to imports within the SAME file.
- Detect early: a mocked/injected value having no effect, paired with console output
  showing the REAL implementation's own internal defaults/warnings (not a thrown error
  about a missing mock) — that combination means something read real `process.env`
  before your test's `beforeEach` ran, not that the mock is wired wrong.
- Source: Session 4A-4 (money-service webhooks, File 4/4 — `dlocal-webhook.controller.spec.ts`),
  2026-07-22 · Status: ACTIVE

---

**Header note, 2026-07-22 (Session 4A-6):** still at 40 active lessons (L1-L40) — this
session found 2 genuinely new lessons (an order-approval-chain-integrity gap, and a
"catch block checks `.message` instead of `.code`" dead-code bug pattern) but did NOT add
L41/L42, per this file's own explicit "pause and flag the Advisor... before adding
another" instruction — only appended a recurrence note to the existing L37 (maintenance
on an existing entry, not a new one). This is now the THIRD session in a row to hit the
cap without a consolidation pass happening (Sessions 4A-2, 4A-4, 4A-6 — see CLAUDE.md
Waiting-on #30, unresolved since Session 4A-2). The 2 new lessons' substance is recorded
in Session 4A-6's own order Deviations section and CLAUDE.md instead, for the Advisor to
fold in during the (increasingly overdue) consolidation pass — don't lose them by
treating "no numbered entry yet" as "nothing to consolidate."

## Archive

_(Consolidated-away or superseded lessons move to `LESSONS-ARCHIVE.md` when created.)_

---

## Session 4B-7 additions (2026-08-01) — Alerts CRUD cutover incident

**Numbering note, read before citing these.** These were requested as L41/L42/L43 but are
recorded as **L43/L44/L45**: `LESSONS-LEARNED.md` (the live file) already has an L41 (a
`railway.toml` `[[services]]` block declares intent, does not provision the service) and an L42
(Express 5 / path-to-regexp v8 removed the bare `'*'` wildcard), both cited by number from
`CLAUDE.md`. Reusing those numbers here would have made every existing cross-reference
ambiguous. L43 was the next free number in the live registry. The three lessons' substance and
titles are exactly as requested — only the numbers moved.

**Visibility caveat.** This is the ARCHIVE file; only `LESSONS-LEARNED.md` is Tier-1 (read in
full at every session OPEN). Lessons parked here will NOT be read by a fresh Executor, so as
written these three will not prevent recurrence. They are here because the active file is at
its ~40-lesson cap (CLAUDE.md Waiting-on #30, unresolved since Session 4A-2). Promote them into
`LESSONS-LEARNED.md` during the next consolidation pass — all three describe live production
deploy failures, which is exactly the reflex category the active file exists for.

### L43 — Anchor repo-root `.railwayignore` directory names with a leading slash, or they strip sub-service source

- Symptom: 8 consecutive `operation-service` Railway deploys FAILED; `nest build` had nothing
  to compile; production silently kept serving a 6-hour-old build with a known bug in it.
- Root cause: `.railwayignore` uses gitignore semantics, so a bare `src` matches at ANY depth —
  and `railway up --path-as-root` indexes from the _project directory_ (repo root), not the path
  argument. A root entry meant for the monolith's own `src/` also stripped `operation-service/src`,
  `operation-service/packages/types/src`, and `src/common/middleware` from every archive.
- Rule: in a monorepo root `.railwayignore`, anchor directory names to the root (`/src`,
  `/middleware`, `/docs`, `/public`, `/frontend`). Use a bare name only when you genuinely mean
  "at every depth."
- Detect early: after any `.railwayignore` edit, run `git check-ignore -v <service>/src` — it
  applies the same semantics. Also treat an unrelated commit touching `.railwayignore` as a
  deploy-affecting change (this one arrived inside a commit titled as a tier-lookup fix).
- Source: Session 4B-7 (Alerts CRUD cutover incident), 2026-08-01 · Status: ACTIVE

### L44 — Every independently-deployed Railway sub-service needs its own `railway.json`, or it silently inherits the repo-root one

- Symptom: deploys failed on healthcheck timeout while the service itself was fine —
  `GET /` returned 404, `GET /health` returned 200.
- Root cause: `operation-service` had no `railway.json`, so Railway resolved the repo-root file:
  `healthcheckPath: "/"` (right for the Next.js monolith, 404 for a Nest service that only maps
  `/health`) and `startCommand: "pnpm run start"` (the container is built with `npm ci`).
- Rule: every sub-service keeps its own `railway.json` declaring at minimum `healthcheckPath` and
  `startCommand`. Never rely on config inheritance from the repo root.
- Detect early: `curl -s -o /dev/null -w "%{http_code}" <service-url><healthcheckPath>` must be
  2xx before trusting a deploy; `railway deployment list --json` → `meta.fileServiceManifest`
  shows which config actually resolved, and `meta.configFile` shows which file it came from.
- Source: Session 4B-7, 2026-08-01 · Status: ACTIVE

### L45 — Bind a custom validation pipe to `@Body(...)`, never method-level `@UsePipes`, on a route that also takes `@Param`/`@Query`

- Symptom: every `PATCH /alerts/:id` returned `400 "Expected object, received string"` regardless
  of request body; the Alerts UI's optimistic Pause flipped and rolled back ~200ms later.
- Root cause: NestJS binds a method-level `@UsePipes` to EVERY handler parameter, so
  `@UsePipes(new ZodValidationPipe(updatePlainAlertSchema))` ran `z.object()` against
  `@Param('id') id: string`. Three successive "fixes" inside the pipe (validate body only, parse
  JSON strings, recursively unwrap) could not possibly help — the value was a route id, never JSON.
- Rule: attach body schemas at the parameter — `@Body(new ZodValidationPipe(schema))`. Reserve
  method-level `@UsePipes` for pipes that are genuinely safe on every parameter of that handler.
- Detect early: the error names the wrong type for the wrong argument ("expected object, received
  string") and ONLY routes carrying a path parameter fail while the collection route (`POST
/alerts`) passes. Reproduce in ~2 min with two controllers (method-level vs `@Body`-level) under
  `Test.createTestingModule` + `supertest` before touching the pipe's internals.
- Source: Session 4B-7, 2026-08-01 · Status: ACTIVE

## Unpromoted Candidates (archived 2026-08-03)

**One more candidate from Session 4B-4's close (2026-08-01), not promoted (no explicit direction
to exceed the cap for this one), described here for the next consolidation pass:** a live-boot
verification step used `taskkill //F //IM node.exe //T` to clean up a single spawned test
process ��  a blanket kill of every Node process on the machine, not scoped to the one PID actually
spawned. Caught and disclosed immediately, not repeated (switched to foreground-only `node -e`
scripts and `Test.createTestingModule` + `supertest`'s in-memory server for the rest of the
session, neither of which needs any manual process spawn/cleanup at all) ��  worth a rule along the
lines of "never `taskkill`/`pkill` by image name to clean up a test process you spawned; capture
and kill the specific PID, or better, avoid spawning a real background process for verification
when an in-memory test harness can prove the same thing." Full detail in
`4b-4-shared-infra-observability.migration-order.md`'s own Deviations (#11).

**One more candidate from Session 4B-5's close (2026-08-01), not promoted, described here for the
next consolidation pass:** `operation-service` does not consume the root `packages/types` package
at all ��  it has its own separately embedded, git-tracked copy at `operation-service/packages/types/`
(commit `87242f09`, created to solve the Railway single-directory-upload packaging risk, since
`operation-service` has no connected GitHub source, L38/CLAUDE.md Waiting-on #77/#79/#80). This
session hoisted new exports into the root package and only discovered the embedded copy was stale
when `tsc --noEmit` failed with "has no exported member" despite the root package building clean �� 
nothing about the root package's own build success signals whether `operation-service`'s embedded
copy is in sync. No automated sync mechanism exists between the two copies. Worth a rule along the
lines of "any change to `packages/types` must also sync (or verify already-synced)
`operation-service/packages/types`, and `operation-service`'s own `tsc --noEmit` is the check that
actually catches drift ��  the root package's own `npm run build` succeeding proves nothing about the
embedded copy." Full detail in `4b-5-alerts-crud-port.migration-order.md`'s own Deviations (#4).

**One more candidate from Session 4B-6's close (2026-08-01), not promoted, described here for the
next consolidation pass:** a background `tsc --noEmit` verification run gave a false "clean" (exit 0) result for a commit (`02917e9e`) that genuinely had 4 real `TS2322` errors, because an edit to a
file inside the check's scan scope landed while that check (or an earlier one) was still running �� 
`tsc --noEmit` scans the whole program on every invocation, not just a commit's staged files, so an
in-flight edit anywhere in the tree can invalidate a background check's result even if the edit
looks unrelated to the step actually being verified. Caught one step later by a fresh,
uncontaminated run with zero edits in flight; independently reproduced by stashing the fix and
re-running `tsc --noEmit` directly against the suspect commit alone. Fixed in the very next commit,
same session ��  no broken code reached `origin/main`. Worth a rule along the lines of "never trust a
background `tsc`/build/test verification result if any file edit happened anywhere in the repo
after that check was launched ��  re-run fresh, with nothing in flight, immediately before committing
on the strength of it." Full detail in
`4b-6-alerts-crud-write-transport.migration-order.md`'s own Deviations (#8) and `CLAUDE.md`
Waiting-on #88.

**One more candidate from Session 4B-8's close (2026-08-01), not promoted, described here for the
next consolidation pass:** the plain, unflagged `railway logs --service <svc>` command silently
returned output frozen more than 8 hours in the past (verified by comparing its last timestamp
against the real current time) ��  the same general "don't trust a Railway log command's freshness
at face value" class as Session 4B-7's own `railway logs --build` stale-cache incident (L38's own
recurrence note), but a NEW manifestation: this time the plain deploy-log stream itself was stale,
not just `--build`. Switching to `railway logs --http --path /drawings --since 2h` didn't fix it
either ��  that returned nothing at all, a false negative. The combination that actually worked was
`railway logs --http -n 20 --since 2h` (or any invocation pairing `--http`/`--since` with
`-n`/`--lines`) ��  omitting `-n` silently returns empty even when matching entries exist. Worth a
rule along the lines of "never trust a `railway logs` invocation's absence of output, or its most
recent timestamp, as proof of anything ��  always pair `--http` with an explicit `-n`/`--lines`
count, and sanity-check the returned timestamp range against the real current time before treating
a log query as authoritative." Full detail in
`4b-8-drawings-port-and-cutover.migration-order.md`'s own Deviations (#4).

**One more candidate from Session 4B-11's close (2026-08-02), not promoted, described here for the
next consolidation pass:** the shared monolith-to-operation-service forwarders
(`forwardRequestToOperationService()`/the money-service equivalent, used by EVERY cutover slice
since Session 4A-7a/4B-6) only ever propagate `Authorization` and `x-correlation-id` ��  `user-agent`
and `x-forwarded-for` are silently dropped on every forwarded request, and have been since these
forwarders were first built. Invisible for 6+ prior cutover slices (Tier/Notifications/Drawings/
Alerts/etc.) because none of their ported code reads those headers; found live, by the cutover's
own post-flip smoke test, the first time a slice's ported code actually needed them (session
device-tracking, IP/location in security-alert emails) ��  Davin's own session-list showed his
current session as "Unknown on Unknown" instead of his real browser. A `forwardedRequestContext()`
helper already existed in `client.ts` for exactly this purpose but was never wired into either
forwarder until this session found the gap. Not a security/auth-identity bug (session ownership was
always correct) ��  only descriptive metadata was wrong, but it silently degrades any FUTURE ported
route that reads `request.ip`/`user-agent` at operation-service, exactly the way this one did. Worth
a rule along the lines of "before porting any route whose behavior reads `request.ip` or a
`user-agent`/device-fingerprint header, verify the monolith's own forwarding helper actually
propagates those headers ��  the existing forwarders don't, by default, and the gap won't show up in
mocked unit tests, only in a live smoke test against real traffic." Full detail in
`4b-11-user-profile-2fa-sessions.migration-order.md`'s own Deviations (#9).

**One more candidate from Session 4B-12's close (2026-08-02), not promoted, described here for the
next consolidation pass:** `_prisma_migrations.applied_steps_count` recording a nonzero
`finished_at` timestamp does NOT mean a migration's DDL actually ran ��  Session 2-3's own
migration-history baseline (2026-07-20, resolving the whole pre-existing history at once via what
was almost certainly `prisma migrate resolve --applied`) marked `20260705000000_add_market_data_v6`
as finished with `applied_steps_count: 0`, and the underlying `CREATE TABLE market_data_v6` never
ran ��  undetected for 13 days and 11 subsequent sessions that touched `operation-service`'s own
`MarketDataV6` model (Session 4B-2 mirrored it, this session widened it) because nothing before this
session's live smoke test ever unconditionally executed a Prisma query against that specific table
in production (the alert-engine's own XAUUSD lookup prefers an HTTP gateway-pipeline call first).
Found only by directly querying `_prisma_migrations` and comparing `applied_steps_count` against a
genuinely-executed sibling migration (`20260721000000_add_refresh_token_table`, `steps: 1`) ��  a
`migrate status` read-only check alone would likely have reported this migration as "applied" too,
without revealing the zero-steps discrepancy. Worth a rule along the lines of "after any migration-
history baseline (`resolve --applied`), spot-check that each baselined migration's actual schema
change is present in the real database (e.g. `to_regclass()` for a `CREATE TABLE`, not just
`_prisma_migrations` row presence) ��  a baseline can be wrong for one migration in a batch while
being correct for all the others, and the failure stays completely invisible until something
finally exercises that specific table for real." Full detail in `DECISION-LOG.md` **F52** and
`4b-12-market-data-channel-proxy.migration-order.md`'s own Deviations (#6).

**One more candidate from Session 4B-17's close (2026-08-02), not promoted, described here for the
next consolidation pass:** `railway logs`'s default target (no `--latest`) silently shows the
**previous successful deployment's** logs when the most recent deployment failed ��  a real Railway
build failure (`socket.io-client` missing from `operation-service/package.json`, only resolvable
locally via this monorepo's root `node_modules`, absent in Railway's isolated single-directory
build) was invisible via the plain `railway logs --service operation-service --build` command,
which kept showing an OLDER, successful build's logs (confirmed via the embedded image-creation
timestamp inside the log output, hours stale). `--latest --build` correctly surfaced the real
`TS2307` error. But once the FIX was deployed and genuinely succeeded (`railway service list
--json`'s `latestDeployment.status: SUCCESS`, matching timestamps, non-stale), NO flag combination
tried (`--latest --deployment`, `-s <service-id>`, `--since 15m`, plain `-n 300`) surfaced any
application/boot-log output at all for that deployment ��  not even the usual flood of "Mapped
{route}" lines every prior session's boot log has shown. Independent live HTTP/protocol-level
checks (a health endpoint, a route's expected 401, or ��  the strongest signal used this session ��  a
raw Engine.IO handshake request, `GET /socket.io/?EIO=4&transport=polling` returning a real
`0{"sid":...}` packet) proved the deployment was genuinely live and correct when `railway logs`
could not. Worth a rule along the lines of "`--latest --build` is the one combination proven to
surface a FAILED deployment's real build error; for confirming what's actually running in
production right now, a direct protocol/HTTP-level check is more reliable than any `railway logs`
invocation tried so far." Full detail in
`4b-17-realtime-websocket-decision-and-build.migration-order.md`'s own Deviations (#5-#6).

**One more candidate from Session 4B-18's close (2026-08-02), not promoted, described here for the
next consolidation pass:** a `cors`-option `origin` value of the ARRAY `['*']` is not the same as
the bare STRING `'*'` ��  only the bare string means "allow any origin" to the standalone `cors`
npm package (and, by extension, `engine.io`'s own CORS handling, which delegates to it directly).
`RealtimeGateway`'s `cors: { origin: (process.env['ALLOWED_ORIGINS'] ?? '*').split(','), ... }`
always produces an array, even when the env var is literally `'*'` ��  so every real cross-origin
browser connection was silently CORS-rejected in production (confirmed via a live browser smoke
test, `DECISION-LOG.md` **F53**), while every `curl`-based Engine.IO handshake check performed
across 4B-17/4B-18 kept passing, because `curl` sends no `Origin` header and does not enforce CORS
at all ��  a `curl`-based "the gateway answers" check cannot prove a real browser can connect through
it. Worth a rule along the lines of "when deriving a CORS `origin` option from an env var via
`.split(',')`, special-case the literal `'*'` value to pass the bare string, never an array ��  and
never treat a `curl`/non-browser HTTP client's success as proof a CORS-gated path works, since
non-browser clients don't enforce `Access-Control-Allow-Origin` the way a real browser does." Full
detail in `4b-18-realtime-cutover.migration-order.md`'s own Deviations and `DECISION-LOG.md` F53.

**One more candidate from Session 4B-18b's close (2026-08-03), not promoted, described here for
the next consolidation pass ��  a direct continuation of the F53 lesson above, found by fixing F53
and then discovering the real browser smoke test STILL failed identically:** `Access-Control-
Allow-Origin` (the header the `cors` npm package sets) has **zero effect on a raw WebSocket
handshake** ��  browsers only enforce CORS-style origin allow-listing for `fetch`/XHR, never for
`WebSocket` connections (RFC 6455's own handshake has no CORS concept at all; Origin enforcement
for WS is the SERVER's own responsibility, not something a response header controls). Re-reading
`engine.io`'s `handleUpgrade()` confirmed its `cors` middleware chain DOES run on the WS upgrade
path too, but `cors`'s own `configureOrigin()` never aborts a request on an origin mismatch ��  it
only omits/sets a header and always calls `next()`. Since `hooks/use-realtime-socket.ts` requests
`transports: ['websocket', 'polling']` (websocket attempted first, Engine.IO v4's direct-connect
feature), F53's own CORS bug may never have actually been the layer blocking the live symptom �� 
real, and now genuinely fixed, but not proven to have been the (sole) cause. The actual blocker
(`DECISION-LOG.md` **F54**) was a separate, EARLIER browser-enforced gate: the monolith's
Content-Security-Policy `connect-src` directive never included operation-service's origin, which
blocks `fetch`/XHR/WebSocket alike, client-side, before any network request is ever sent ��  and,
critically, is **also invisible to every verification method this migration has used for this
feature so far**: a `curl` handshake check (no CSP enforcement, not a browser), an in-process Nest
e2e test with a real `socket.io-client` (Node, no CSP enforcement either), and even a raw Node
`ws`-package handshake with a real `Origin` header (still no CSP enforcement ��  confirmed this
session, the raw WS connection succeeded fine against the exact same deployed endpoint a real
browser couldn't reach). Worth a rule along the lines of "for any browser-only feature reaching a
different origin (a new API host, a WebSocket gateway, a CDN), CORS and CSP are TWO SEPARATE gates
that both must independently allow the destination ��  fixing one's misconfiguration is not evidence
the other is configured at all, and neither `curl` nor any Node-based script (including a real
`socket.io-client`/`ws` instance) can prove either one, since NEITHER CORS-response-reading NOR CSP
`connect-src` enforcement exist outside an actual browser JS engine. A real browser is the only
verification method that can prove a cross-origin browser-initiated connection actually works ��  no
protocol-level or server-log check, however thorough, substitutes for it." Full detail in
`4b-18b-realtime-cors-origin-fix.migration-order.md`'s own Deviations and `DECISION-LOG.md` F53/F54.

**One more candidate from Session 4B-18c's close (2026-08-03), not promoted, described here for
the next consolidation pass ��  two more, in the same live smoke test:** (1) the browser's own
**Resource Timing API** (`performance.getEntriesByType('resource')`) does not reliably capture
native **WebSocket** handshake connections in most Chromium versions ��  a check using it reported
"zero network activity" to operation-service's origin, which read as a genuine new blocker, until
DevTools' own dedicated **"WS"/"Socket" row filter** (a different, more reliable surface) showed a
real `101 Switching Protocols` row the whole time. Worth a rule along the lines of "never trust a
Resource-Timing-API-based 'zero requests' finding for a WebSocket-specific claim ��  re-check via
the Network panel's native WS filter before treating it as a real absence." (2) A server log line
proving an application-level event succeeded (here, `RealtimeGateway.handleConnection` logging
"Client X authenticated as user Y", immediately after a real `client.emit('authenticated', ...)`
call) proves that ONE request/connection instance succeeded ��  it does not prove the connection
STAYED open or usable. This session found the same real user re-authenticating via 15+ distinct
socket IDs across ~50 minutes, each disconnecting shortly after ��  genuine repeated success events
that, read in isolation without comparing their own timestamps against each other, could easily
be mistaken for one healthy connection rather than a reconnect loop. Worth a rule along the lines
of "when a log shows repeated success events for the same logical entity (same user/session), diff
their own timestamps against each other before concluding health ��  a cluster of short-lived
successes is a strong signal of a connect/disconnect loop, not proof of stability." Full detail in
`4b-18c-realtime-csp-connect-src-fix.migration-order.md`'s own Deviations and `DECISION-LOG.md` F55.

---

## L11 recurrence history (moved from LESSONS-LEARNED.md, Session 4B-19, 2026-08-03)

LESSONS-LEARNED.md's L11 ("Never trust an order's header status field alone; cross-check
entry-criteria checkboxes and git history") had accumulated 9 individually-narrated
"Recurrence (Session ...)" bullets - well past that file's own "5+ recurrences into a single
count line" hygiene rule. Collapsed to a count line in the active file; the full narrative is
preserved here, verbatim, for anyone who needs the detail behind a specific occurrence.

- Source: Session 4A-6. Symptom: an order arrived with header Status: APPROVED while its own
  Entry Criteria list still had an unchecked "Davin approves this DRAFT" box, and the file was
  untracked with no PRE-DRAFT to DRAFT to APPROVED commit history at all.
- Recurrence (Session 4A-3): same pattern - PRE-DRAFT note block vs. an uncommitted APPROVED
  status-line edit, no Advisor-DRAFT/Davin-approval commit history, and the paired evidence file
  (manual-trigger idempotency checklist) showed 0/8 boxes checked despite the claimed-done state.
  Resolved by asking Davin directly rather than trusting the file; this is now a 2nd occurrence,
  worth the Advisor's attention on how order status edits get made outside the Advisor to Davin
  pipeline.
- Recurrence (Session 5-1): same pattern - order file arrived untracked with Status: APPROVED
  header while 4/4 entry criteria checkboxes were unchecked. Resolved by asking Davin live ("Go")
  to confirm before execution. (3rd occurrence).
- Recurrence (Session 4A-7b): same pattern again - the order's own "Updated" note read "updated
  to DRAFT for authorization" while the header field one line above it claimed Status: APPROVED,
  and the edit was uncommitted with no PRE-DRAFT to DRAFT to APPROVED history. Resolved by asking
  Davin directly rather than trusting the file; he confirmed live approval and corrected the note.
  (4th occurrence - worth the Advisor's attention on why order-status edits keep arriving outside
  the normal pipeline with self-contradicting text.)
- Recurrence (Session 4A-W1): a new variant - git status showed the order file
  modified-but-uncommitted; git diff against the last commit showed Status: DRAFT to APPROVED
  with no approval commit trail, AND all five of the order's own entry-criteria line-count numbers
  had independently drifted by exactly +1 away from both the last commit and the live codebase.
  Resolved by asking Davin directly rather than trusting or silently correcting either field; he
  confirmed the status flip was his own intentional approval and separately fixed the line counts
  back to the wc -l baseline before execution began. (5th occurrence - first time the
  self-contradiction included corrupted evidence numbers alongside the status field, not just the
  status field alone. Worth the Advisor's attention on whether order files should be edited in a
  working copy at all versus only via a reviewable diff/PR.)
- Recurrence (Session 4A-W2): same pattern - order file modified-but-uncommitted,
  Status: PRE-DRAFT to APPROVED with no Advisor-DRAFT/Davin-approval commit trail, and all four
  of the order's own line-count entry-criteria numbers had shifted +1 away from both the
  committed version and the live codebase. Resolved by asking Davin directly; confirmed his own
  edit, numbers corrected to the wc -l baseline. (6th occurrence.)
- Recurrence (Session 4A-W3a): same pattern, first pass - order arrived with a self-reported
  "APPROVED" status but 4/6 entry criteria FAILED against live state (F39/F41 still open,
  WISE_API_TOKEN absent, three cited line counts stale by up to +212 lines from an intervening
  session's own migration commit). Reported in full, execution declined; second pass after Davin
  resolved the open flags confirmed the split/APPROVED status was his own intentional edit
  (again no commit trail). (7th occurrence.)
- Recurrence (Session 4A-W3b): same status-flip/no-commit-trail shape, plus a new variant: the
  rewritten order body had silently resolved two open design questions the PRE-DRAFT text had
  explicitly deferred to CONFIRM ("flag or flag-less?", "should the admin page allow an action or
  stay view-only?") with no visible decision recorded anywhere - not just the status field or
  line-count evidence drifting, but substantive scope questions being answered invisibly. Resolved
  by asking Davin directly for all three (status-flip provenance + both design questions) before
  marking CONFIRMED. (8th occurrence - worth the Advisor's attention on whether a PRE-DRAFT's own
  explicitly-flagged open questions should be answered as separate, individually-commit-tracked
  edits rather than folded silently into the APPROVED rewrite.)
- Recurrence (Session 4B-2): same shape again - only the PRE-DRAFT (Status: PRE-DRAFT) was ever
  committed; the working copy was fully rewritten to Status: APPROVED with no DRAFT to APPROVED
  commit trail, and the rewrite silently DROPPED a whole entry criterion the PRE-DRAFT had
  explicitly carried forward (the Waiting-on #79 Railway-packaging-risk item) rather than just
  drifting a status field or a line count. Resolved by reporting the full CONFIRM findings
  (including the dropped criterion) before execution and asking directly; confirmed as Davin's/the
  Advisor's own authentic edit, the dropped criterion was re-added, and explicit clearance to
  execute was given in chat. (9th occurrence - the "silently drops real content, not just
  metadata" variant first seen at 4A-W3b keeps recurring; still worth the Advisor's attention.)
- Recurrence (Session 4B-3): same shape, most severe yet - the committed version was an unusually
  HONEST PRE-DRAFT (explicitly listing every entry criterion as "NOT MET" and stating "there is no
  clock to report an end time for"), and the uncommitted working copy didn't just flip the status
  field - it deleted every one of those honest caveats wholesale while rewriting the entire
  document. Resolved the same way as every prior occurrence: reported the discrepancy directly
  rather than trusting or silently correcting it, then verified the underlying facts (deploy
  status, flag existence, live logs) independently regardless of which version of the text was
  "correct" - which is what actually caught the 7 further real gaps this session's own Deviations
  document. (10th occurrence - worth the Advisor's attention on whether order files should ever be
  edited as an in-place working-copy rewrite at all, versus only via a reviewable diff.)
- Recurrence (Session 4B-19, 2026-08-03): a fully benign variant - the order's entire body
  (Background, Entry Criteria, File Port Order, Rules, Slice-level verification, Next-session
  handoff) diffed byte-identical to the committed PRE-DRAFT; only header metadata (Status line,
  variant label, Generated line) changed in the uncommitted working copy. Confirmed live as
  Antigravity Advisor's own authentic edit before execution. (11th documented occurrence. Several
  further recurrences almost certainly happened in Sessions 4B-4 through 4B-18d per their own
  CLAUDE.md close-out notes, but were never individually appended to this list - not
  reconstructed retroactively here.)

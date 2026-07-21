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

---

## Archive

_(Consolidated-away or superseded lessons move to `LESSONS-ARCHIVE.md` when created.)_

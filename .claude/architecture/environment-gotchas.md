---
type: Concept/EnvironmentGotchas
status: active
updated_at: 2026-10-01
source: "'Gotcha' notes scattered through CLAUDE.md session logs 2026-08-30..09-26 (search state/history/ for the full story)"
tags: [windows, git, shell, jest, browser, tooling]
related_docs:
  - ./infrastructure.md
  - ../protocols/verification-checklist.md
---

# Local environment gotchas (Windows checkout)

Each of these cost a past session real time. Search `state/history/` for the incident.

## Git and files

- **Never use `git stash`.** The desktop app polls `git status` and holds `.git/index.lock`; a
  `stash push` failed silently and the following `pop` hit an unrelated old stash.
- If lint-staged / `git commit` fails on `index.lock`, wait ~2 s for the lock to stay free and retry.
- Windows intermittently refuses writes to files open elsewhere (`OSError 22`, Prettier `UNKNOWN`).
  Any mutation or rewrite harness must retry the write and verify the restore (sha256).
- The checkout is **CRLF** (`core.autocrlf=true`); Prettier expects LF. Use
  `prettier --check --end-of-line auto`. After an over-broad Prettier run, files can list as `M`
  with blob hashes equal to HEAD (stale stat only).
- The Bash tool collapses `\\` to `\`; make regex/escape edits with the Edit tool, not heredocs.
- **Check line endings with Python, not `grep` in Git Bash:** `grep -c $'\r$'` reported every line as
  CRLF for files that are LF only. Use `path.read_bytes().count(b"\r\n")`. Files written by tools in
  this checkout (the MCD kit and docs, `.claude/state/`) are LF only on disk despite the CRLF note
  above (found in the 2026-10-01 P6 re-check, `docs/handoffs/2026-10-01-0156-p6-recheck-kit.md` G4).
- `scratch/` is gitignored but inside `tsc`'s scope (`tsconfig` includes `**/*.ts`), so a
  type error there blocks the pre-push hook.
- **A repo-wide `find -mmin` takes more than two minutes here** and the harness moves it to the
  background. Name the folders you need, or use `git status` (found in the 2026-10-01 MCD2 P6 check,
  `docs/handoffs/2026-10-01-0430-mcd2-p6.md` §8).
- **`export_collector_validator_v2.py` is CRLF in the working tree** (the index is LF; `git ls-files --eol` shows
  `i/lf w/crlf`), while the push worker and the SQL schema are LF. The Edit tool keeps a file's endings, so edits stay
  uniform; a script that matches a multi-line pattern in the collector must translate `\n` to `\r\n` or it matches nothing
  (found 2026-10-02, build step 2 part 3: five mutation patterns silently matched 0 times).
- **A test fixture that builds 6,000 `market_data` rows is slow because of the schema's pruning trigger**
  (`trg_market_data_prune` re-scans up to 3,000 rows on every insert): 176 s per test file. The step 2 fixtures drop that trigger
  and copy a cached world (`cycle_test_support.py`); do the same for any new test that bulk-loads `market_data`.
- **Python scripts that print `°` or `θ` crash on the Windows console** (`UnicodeEncodeError`, cp1252);
  MCD commentary contains `°`. Run them with `PYTHONIOENCODING=utf-8` (same hand-off, §8).

## Tests

- "Passes in isolation, fails in the suite" is evidence of a **leak**, not a flake: usually a
  `LocaleProvider` geo-IP `fetch()` outliving jsdom teardown. Seed the locale in the test.
- `jest.mock` factories must not reference out-of-scope variables (babel-jest then won't hoist
  them and the real module — e.g. Prisma — runs). Use the injected `jest` global, not
  `@jest/globals`, inside hoisted factories.
- `jest.clearAllMocks()` does not clear queued `mockResolvedValueOnce` values; use
  `resetAllMocks()` when a function may call a mock a variable number of times.
- A mutation test only counts if the mutation landed where you think; restore byte-exact.
- `money-service` `prisma.shutdown.spec.ts` times out under full parallel runs
  (`LESSONS-LEARNED.md` L24); rerun it alone with `--runInBand` before calling it a regression.
- Run the full suite with both local TZ and `TZ=UTC` when touching dates (CI is UTC).
- **`railway-gateway` has no working lint.** `npm run lint` finds no files: the package has no ESLint config of its own
  and the root `eslint.config.mjs` ignores `railway-gateway/**`. Its `tsconfig` also excludes `test/`, so
  `npx tsc --noEmit` does not type-check the specs (ts-jest does when they run). Use `tsc`, the specs and
  `npx prettier --check --end-of-line auto` (found 2026-10-02, build step 2 part 1).
- **`railway-gateway`: every Bull queue the app registers must be overridden in each e2e spec**
  (`.overrideProvider(getQueueToken('<name>'))`). An un-mocked queue opens a real Redis connection; the specs still pass, then Jest
  prints "did not exit" or fails at teardown. Adding a queue means adding the override line to all e2e specs (build step 2 part 4
  added `cycle-ready` to the four existing ones).
- **Bull sums concurrency across named handlers** (`while (concurrency--)` in `node_modules/bull/lib/queue.js`, one processing loop
  per unit, per `process()` call), and a job goes to `handlers[job.name] || handlers['*']`. A second `@Process('name')` on a queue
  that must stay single-loop silently makes two loops. `MarketDataProcessor` therefore has ONE wildcard handler that dispatches on
  `job.name`; `test/market-data.processor.spec.ts` pins this against Bull's source, so a Bull upgrade that changes it fails there.
- **`railway-gateway` Jest only finds spec files under its own `test` folder** (the `testRegex` in `jest.config.js` needs a `test/` path segment), so a one-off spec kept in a
  scratch folder outside the package is never found, even with `--roots` or `--config`. Copy it into `test/` under a throwaway name, run it, and delete it (then check `git status`).
  Specs that need a real Postgres are kept in the repo instead and gated: `test/cycle-readers.pg.spec.ts` runs only with `CYCLE_PG_URL` (localhost only) and `CYCLE_PG_ALLOW_WIPE=yes`;
  the recipe is in its header and in `database-traps.md`. A normal `npm test` shows it as skipped.
- **`railway-gateway` is built alone on Railway** (nothing outside the package exists at build time), so a file it needs from
  `backend-stack-c` must be copied into the package. The cycle-manifest contract is kept in two byte-identical copies
  (`npm run sync:manifest-contract`, and a test fails when they differ); edit the Stack C one, then sync. Both must stay
  Prettier-stable because the pre-commit hook rewrites staged `.json`.

- **`URLSearchParams.size` is missing in jsdom** (and in older Node). Code that tests `params.size > 0` silently drops its query string under Jest and works in production, or the other way
  round. Use `params.toString()` (found 2026-10-02, build step 2 part 6, by a test of `lib/active-indicator/gateway-client.ts`).
- **A route that calls the gateway is tested with a mocked `fetch` and the gateway's own fixtures**: `railway-gateway/test/fixtures/cycles-current-*.json` are written by the gateway's
  `test/current-cycle.spec.ts` (`WRITE_FIXTURES=yes` regenerates them) and read by the monolith's tests, so the contract cannot change on one side only.
- **The VPS renderer's Python tests need matplotlib, pandas, pytest and boto3, which this machine does not have globally.** Make a throwaway
  virtual environment OUTSIDE the repo (the session scratchpad), install the four into it, and run
  `<venv>/Scripts/python -m pytest test_mtf_stamp.py test_mtf_render_upload_worker.py test_mtf_render.py -p no:cacheprovider` from
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/` (about 30 s; add `PYTHONDONTWRITEBYTECODE=1` to keep `__pycache__` out of the tree). Nothing global is installed (build step 2 part 7).
  Never bind a callable as a default argument if a test must patch it (`def f(urlopen=urllib.request.urlopen)` is bound at import, so `mock.patch` has no effect and a real network call is attempted): resolve it at call time.
- **A long mutation run must be started detached** (`Start-Process` from PowerShell, output to a log file): a tool timeout kills the harness mid-mutant and leaves a mutated source file behind. Copy the
  files being mutated to a backup folder first, check `git status` and the sha256 of each file afterwards. While it runs, do not run tests or builds that read those files.
  Several gateway specs READ the Python sources and the contract files (`test/helpers/push-worker-constants.ts`, `collector-constants.ts`, the contract specs), so those count as "files that
  read them": leave the Stack C files alone while a gateway mutation run is going. A gateway mutant costs about 12 s (one `npx jest` per spec file), so 110 mutants take about half an hour (build step 2 part 8).
- **A mutation harness must tell a failed test from a hung run** (found build step 2 part 8, in my own harness). A mutant that leaves a real, un-mocked Bull queue (a queue renamed in one
  module) makes the e2e jest hang on Redis; `spawnSync`'s timeout then returns an error that a naive `status !== 0` check counts as a KILL, and the orphaned jest processes live on (check `Get-CimInstance Win32_Process`
  for `jest` after a run and kill them). Run jest with `--forceExit`, give each run a short timeout, and classify every result: a failing test (`Tests: ... N failed`) is a kill; "Test suite failed to run" (a compile error)
  is a weak one; a timeout or crash is neither. Do the same for Python (`FAIL`/`ERROR` lines versus a traceback with no failing test).
- **An embedded Postgres (`prisma dev`) closes connections under many parallel writers** (`P1017`, "server has closed the connection"): a race test with 8 concurrent writers failed about one run in three. That is the
  engine, not the code. Race two writers (what two gateway instances are), and keep the deterministic unique-violation tests (`P2002` on a duplicate `(symbol, version)`) as the real evidence of the error shape.
- **A new Bull queue in `railway-gateway/` must be overridden in EVERY e2e spec** (`.overrideProvider(getQueueToken('<name>')).useValue(mock)`, 7 specs after build step 2 part 8): `AppModule` registers every queue,
  and an un-mocked one reaches for Redis and fails in teardown while every test still passes. The mock needs `add`, `process` and `on` (BullExplorer calls them in `app.init()`); BullExplorer calls
  `queue.process(name, concurrency, handler)`, so a test can read `queue.process.mock.calls` right after `init` to prove a processor is registered (clear mocks only afterwards).
- **The gateway's DTO generator (`scripts/generate-market-data-dto.js`) emits only type, enum and required.** A contract's `minimum`, `exclusiveMinimum`, `pattern` and `minLength` are NOT enforced by the
  generated DTOs (`economic-event.dto.ts`'s `value_id` pattern and `captured_at` minimum, for one). A contract whose numbers matter (`symbol_specs`: a contract size of 0 sizes a lot at nothing) needs a hand-written DTO
  plus a corpus test that runs one set of payloads through Ajv (the schema) and class-validator (the DTO) and fails on any disagreement (`test/symbol-specs-contract.spec.ts`).
- **A gated real-Postgres spec that lands several slots needs `jest.setTimeout(120_000)`** (build step 2 part 9). The default is 5 s; the test that times out keeps its queries running, and the NEXT
  test's `beforeEach` then fails with a foreign-key error (`indicator_statistics_config_hash_fkey` on `DELETE FROM indicator_configs`) that looks like a schema problem and is not.
- **`prisma migrate diff --from-empty --to-schema ... --script` prints NOTHING (exit 0) when run from a directory with no Prisma config** (Prisma 7.9.1). Give it a scratch config outside the repo and pass `--config`:
  a plain `prisma.config.mjs` exporting `{ schema, datasource: { url } }` is enough (no `defineConfig` import, so no `node_modules` is needed beside it), and it prints no dotenv lines either.
- **A Bash-tool heredoc holding Python with backticks, mixed quotes or `
` escapes fails with "unexpected EOF"** or silently turns `
` into a real newline inside a string literal. Write such a script
  with the Write tool into the scratchpad and run it, or make the edit with the Edit tool.
- **Stack C Python tests are standalone scripts** (`python test_x.py`, a `PASS`/`FAIL` line each; `jsonschema` is on the dev box, pytest is not). `test_extended_statistics.py` already fails 15 checks at HEAD
  (statistics parsing against the real captures; checked 2026-10-02 by running it against the HEAD collector), so a red run of that one file is not a regression until it differs from 15.
- **Never put a `.ts` file under `railway-gateway/scripts/`.** `tsconfig.json` includes `scripts/**/*.ts` next to `src/**/*.ts`, so one TypeScript script there moves the build's common root up a level
  and `nest build` writes `dist/src/main.js` instead of `dist/main.js`, which breaks `start` (`node dist/main`). Scripts stay plain `.js` (the existing generators are); a script that needs TypeScript logic
  loads it from `src/` with `require('ts-node/register/transpile-only')`, as `scripts/measure-cycles.js` does. `test/measure-cycles.spec.ts` fails if a `.ts` appears there (build step 2 part 10).
- **A script that reads the production Postgres from a laptop needs `DATABASE_PUBLIC_URL`, not `railway run`.** `railway run` injects the service's own `DATABASE_URL`, the private
  `postgres.railway.internal` address, which only resolves inside Railway (`prisma.production.config.ts` says the same for migrations). Pass the public URL in `DATABASE_URL` for the one command.
- **A Python mutation harness on Windows must decode jest's output as UTF-8** (`subprocess.run(..., encoding="utf-8", errors="replace")`): with `text=True` the reader thread decodes cp1252, dies on
  jest's `√` and box characters, and every mutant then reads as "crash" (build step 2 part 10). Also: killing a harness mid-mutant leaves the mutated source on disk. Keep ONE backup made before the first
  mutant, have the harness refuse to start when a source differs from it, and compare sha256 after any kill (this one did; the file was restored from the backup and re-checked).

## Dev server and browser

- Another session's `next dev` can hold the shared `.next/` directory; a second dev server then
  dies. Don't kill the other session's server — fall back to `tsc`/tests/`next build`.
- If every route 404s in dev, clear `.next/dev` (stale cache).
- The browser pane force-upgrades `localhost` to https; `127.0.0.1` is then blocked as a
  cross-origin dev request unless `allowedDevOrigins` allows it (hydration silently never happens).
- `ResizeObserver` / `requestAnimationFrame` do not fire while the browser pane is hidden
  (`document.hidden === true`); front the pane before trusting a layout measurement.
- React Strict Mode double-invokes effects in dev; an external script embed (TradingView) can log
  a harmless dev-only error. Confirm against `next build && next start` before calling it a bug.
- Authenticated pages cannot be verified by the Executor (it never enters credentials). Use a
  throwaway unauthenticated route outside the gated layout, delete it after, and say so.

## YAML registry files

- PyYAML (YAML 1.1) reads an unquoted `off`, `on`, `yes` and `no` as booleans. Quote them in
  MCD registry and parameter files (`flag: 'off'`); the standard's Appendix C.2 template quotes it
  since version 1.0.3 (`docs/handoffs/2026-10-01-0410-mcd2-p3.md` §7).

## Pre-commit hook and generated files

- The pre-commit hook (`lint-staged`) runs `prettier --write` on every staged `.json`, `.md` and
  `.yaml` file and puts the result in the commit and the working tree. A generated file that tests
  compare byte for byte is rewritten by it: the MCD fixtures (`.inputs.json` is one line, about 80 KB)
  came out as 3,700 lines and T9 failed on the committed state (2026-10-01, MCD2 commit). The MCD
  fixtures and `mcd*_output.json` are now in `.prettierignore`. Any other generated file a test
  compares byte for byte needs the same entry, and a test run after the commit, not only before it.
- `git stash list` holds 17 old "lint-staged automatic backup" stashes (3 to 5 weeks old, not from a
  current run). Do not drop them without Davin's say.

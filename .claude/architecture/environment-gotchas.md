---
type: Concept/EnvironmentGotchas
status: active
updated_at: 2026-10-03
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
- **`git stash apply` (and any restore from a stash) writes the files back with CRLF** (`core.autocrlf=true`), while every file the tools of this checkout write is LF on disk
  (`git ls-files --eol` shows `i/lf w/crlf` for the restored ones). A spec that reads script text then fails (`sensors-replay.spec.ts` wants the shebang line to end in `\n`).
  After a restore, convert the restored files back to LF (`bytes.replace(b"\r\n", b"\n")`, only the files the stash held), check `git ls-files --eol`, then run the suites
  (found 2026-10-09, restoring the part 6 stash; the commit is LF either way).
- **`pathlib.Path.write_text` on Windows writes CRLF** (text mode): a Python one-liner that edits a repo file this way converts the whole file (it did to the architecture document
  and the ADR index, 2026-10-09; `git diff --stat` stayed small only because git normalises on the way in). Edit with the Edit tool, or `read_bytes()` / `write_bytes()`.

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

- **A scratch Postgres started with `pg_ctl start` inside a tool call hangs the call and then dies** (build step 3 part 2): the server
  inherits the tool's output pipe, so the call never returns; when the tool task is stopped, the postmaster's console goes with it and every
  child fails with `0xC0000142` (the log says "client backend ... was terminated by exception 0xC0000142" and the server shuts down). Start
  `postgres.exe` with `Start-Process -WindowStyle Hidden -RedirectStandardError <file>` so it owns its console, poll `pg_isready`, and stop it
  with `pg_ctl stop -m fast` or by PID. A `role "WiN" does not exist` FATAL in its log is only `pg_isready`'s default-user probe.
- **Shell cwd drifts**: a `cd` inside one Bash call changes the primary working directory for later calls (it moved to `railway-gateway/` and to a fixtures
  folder in one session). Use absolute paths or `git -C`. A subshell, `( cd <dir> && npx jest ... )`, does not move it (used throughout build step 3 part 3).
- **`python -m mcd_worker.cli` runs nothing with the committed config**: `worker_config.yaml` has every MCD `off` (as it must until a person records evidence), so the result has `order: []` and `results: []`. A spec that wants readings passes `--config` with
  an all-`shadow` file, which is how the stored `mcd_worker/fixtures/*.cycle.json` were made (`railway-gateway/test/helpers/kit-runner.ts` writes one outside the repo). The MCD0 to MCD3 suites are run as
  `python -B -m unittest discover -s mcd0 -p "test_*_unit_tests.py"` from `engine-1-5-new/` (no `-t .`: the folders are not packages, and `-t .` fails with "Start directory is not importable").
- **JavaScript and Python do not write a float the same way** (`0.00001` against `1e-05`, `4005` against `4005.0`, `1.2345678901234568e+20` against `123456789012345680000`), so a canonical bundle text made in TypeScript hashes differently from the runner's `inputs_sha256`
  as soon as one number is small, large or integral. The three stored bundles happen to hold no such number (measured: the TypeScript hash equals the runner's on all three), live data may. The runner computes the hash from the parsed values, so SENDING a bundle from
  JavaScript is safe (v1 gave the stored `inputs_sha256` after a database round trip); STORING the bundle text (`market_cycle_inputs.bundle_gz`, part 4) must use the text the runner hashed, not a TypeScript re-serialisation.
  Since build step 3 part 4 the runner returns that text as `bundle_canonical_json` and the worker stores it (Davin's decision 3, option a); a spec shows `1e-05` in the stored text where `JSON.stringify` writes `0.00001`.
- **Bull's exponential back-off is `(2^n - 1) x delay`, with `n` the attempts already made** (`node_modules/bull/lib/backoffs.js`), so `LANE_JOB_OPTIONS` (3 attempts, delay 2000) retries after 2 s and then 6 s, not 2 s and 4 s. Inside a
  handler `job.attemptsMade` is the number of attempts BEFORE this one (0 on the first run; Bull increments it in `moveToFailed`), so "more attempts remain" is `attemptsMade + 1 < opts.attempts`. `job.discard()` stops further retries.
  Without Redis (Docker is not running here) the consumer's retry logic is shown on a fake queue that follows those two rules; a real queue with Redis is not exercised before phase B.
- **Ajv's `strict` mode refuses the kit's envelope schema on `strictTypes` only**: `mcd-output-1.schema.json` writes `maxItems` under `levels` with no sibling `type: "array"` (valid JSON Schema, read the same by Python's jsonschema). `EnvelopeValidator` sets
  `strictTypes: false` and keeps the rest of `strict`; the kit owns the schema and the copy must stay byte for byte, so the parity corpus in `test/sensors-envelope-validator.spec.ts` is what holds Ajv to the same meaning.
- **Booting a Bull consumer without Redis**: `Test.createTestingModule({ imports: [BullModule.forRoot(...), BullModule.registerQueue({ name }), <module under test>] }).overrideProvider(getQueueToken(name)).useValue(fakeQueue)`, then
  `await moduleRef.init()`: the real explorer calls `fakeQueue.process(name, concurrency, handler)` and `fakeQueue.on('failed', ...)`, so a spec can count what a module registers (`test/sensors-disabled-consumes-nothing.spec.ts`). Provide `PrismaService` with a stand-in global module.
- **A long heredoc to `python` through the Bash tool can arrive cut off (once at about 140 lines) and a `\\n` in it becomes a real newline**: an edit script failed with "unterminated triple-quoted string" and a mutant list lost its `\n` escapes. Write a script of any size with the Write tool and run the file;
  patterns with a newline go in a normal Python string with `\n`, and a regular expression in a raw string.
- **A mutation harness that restores the source from memory must not share the tree with an edit**: `mutate_worker.py` writes the original bytes back after every mutant, so an edit made to a mutated file during the run is lost (and the closing sha256 check stops the harness).
  Leave `src/sensors/*.ts` alone until it ends. A mutant that does not compile is not a kill (the previous run's four, B17, C11, T12 and D10, were re-run as variants that compile).
- **Waiting and process listing in the shell tools**: a foreground `sleep` (and PowerShell's `Start-Sleep`) is blocked: wait with a Monitor running `until <check>; do sleep 5; done`, or start the command with `run_in_background` and wait for its notification.
  `tasklist /FI ...` in the Bash tool is read as a path (`C:/Program Files/Git/FI`): use `tasklist | grep -i <name>` or PowerShell's `Get-Process`. PowerShell 5.1 wraps a native command's stderr in a `NativeCommandError` (jest writes its summary to stderr):
  run jest from the Bash tool in a subshell, `( cd <dir> && npx jest ... )`.
- **`npm run lint` in `railway-gateway/` finds no files** ("No files matching the pattern"): the root ESLint configuration ignores the package and the package has none of its own. This was already so before build step 3; the gateway's checks are `tsc`, Jest and `prettier --check`.
- **Python's `Path.write_text` writes CRLF on Windows** (build step 3 part 5): a patch script that read and wrote a LF file with `read_text` / `write_text` turned it into CRLF (two new files, 1,249 and 2,197 lines), while every other tool-written file in the sensors folders is LF, and `prettier --check --end-of-line auto`
  accepts either. Edit by bytes (`read_bytes` / `write_bytes`, which keep the endings), and check with `path.read_bytes().count(b"\r\n")`. The same applies to a mutation harness that rewrites a source file.
- **Skip one `describe` in a Jest run with a negative look-ahead on `-t`**: `npx jest test/x.spec.ts -t "^(?!replay with the real Python runner)"` runs every test whose full name does not start with that describe's title. The mutation harness of part 5 uses it as its fast tier (about 12 s against 55 s with the real Python runner).
- **A Jest run started in the background with its output sent to a file leaves the file empty until Jest ends** (it buffers), so an empty log is not a hang; look for the process (`Get-CimInstance Win32_Process` filtered on `jest`) before killing anything.
- **A script that spawns Python for a replay must hand the runner a worker configuration of its own**: the committed `worker_config.yaml` has every MCD `off`, so a replay under it would run nothing. `src/sensors/replay.ts` writes a temporary one (flags from the stored rows, every other engine MCD `off`) outside the repo and deletes it.

- **`mcd_worker/statistics/` shares its name with the standard library's `statistics`** (build step 3 part 6, the folder name is the plan's). Python run from INSIDE `mcd_worker/` puts the folder ahead of the standard library; run everything from
  `engine-1-5-new/` as the README says. The package imports no standard `statistics` itself (its quartiles are worked out in `aggregate.py` and a test checks them against `statistics.quantiles(method="inclusive")`, imported as `stdlib_statistics`).
- **The Python mutation tool pins its own list** (`mcd_worker/tools/mutation_check.py`): `tests/test_tools.py` demands that every test module on disk is in `TEST_MODULES` (so a new module must be added there) and that mutant ids are `M<number>`
  in ascending order (the part 6 statistics mutants are M130 to M226). A mutant killed first by a golden-file test says little: re-run the group with the golden test left out by monkeypatching `mutation_check.run_suite` in a scratch driver
  (done in part 6: 97 of 97 still killed). `mcd_worker/fixtures/` holds only slot-named files (a test pins it), so the statistics golden rows live in `mcd_worker/tests/data/state-statistics.rows.json`
  (`WRITE_FIXTURES=yes` regenerates it, then run `prettier --write` on it; the gateway's specs and the Python test read the parsed JSON, so formatting does not matter).
- **A Jest spec that scans the repo for a pattern needs the whole checkout** like the six pin tests of step 2: `test/no-direct-state-statistics-reads.spec.ts` reads about 1,200 files across the repository roots, and the state statistics specs read the Python engine's golden rows,
  `aggregate.py`, `outcomes.py` and the migration file (a copy of `railway-gateway/` alone fails them; the Railway build runs no tests).

- **`test/helpers/kit-runner.ts` deletes its own temporary folder** (build step 3 part 7): the all-`shadow` worker configuration it writes under `%TEMP%\mcd-shadow-<random>` is removed by an `afterAll` the helper registers when a spec file loads it
  (`removeShadowConfig`; `test/sensors-kit-runner-cleanup.spec.ts` pins it). Before that, one folder per Jest process stayed for good: 134 had piled up and were deleted by hand on 2026-10-03, each checked to hold only `shadow.yaml` with the helper's exact text.
- **A TypeScript mutation run is slow (about 14 s a mutant) and runs best on parallel copies** (part 7: 447 mutants of `measure-sensors.ts`). Copy `src`, `test`, `scripts`, `prisma` and the four config files of `railway-gateway/` into `scratchpad\m1..m4\railway-gateway`, and make
  junctions (`mklink /J`) for `node_modules`, and, one level up, for `davintrade-stack-d-and-e` and `docs` (the specs read the engine and the standard through `../..`); one harness instance per copy on a disjoint range of mutant ids, `jest --runInBand --bail=1` with `-t "^(?!<the command-line describe>)"`
  (the specs that spawn the script cost ten seconds each and judge only the wiring), `// @ts-nocheck` on every mutant. Start it detached (`Start-Process`), never kill it hard while a mutant is in place (restore from the copy and compare the SHA-256), and run Python's `subprocess` on Jest's output with `encoding="utf-8", errors="replace"`:
  the default Windows code page cannot decode Jest's check marks and the reader thread dies.
- **Tool limits met in part 7:** `grep -r` over the whole repository from the Bash tool passes two minutes (it walks `node_modules`): use the Grep tool or name the folders. The PowerShell tool refuses a command that contains `Remove-Item` when a path in it has a space and a variable (it read `D:\SaaS` as a system path): put deletions in their own command.
- **`ioredis-mock` (a gateway devDependency, with `@types/ioredis-mock`) speaks Bull's key layout well enough to test a reader of it** (`bull:<queue>:completed` is a sorted set of job ids, `bull:<queue>:<id>` the job's hash with `returnvalue` as JSON); `test/measure-sensors-real.spec.ts` seeds those keys and holds the kit to three read commands.

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
- The step 3 cycle runner (`engine-1-5-new/mcd_worker/`) refuses a flag read as a boolean, in `worker_config.yaml` and in the four registries, and says to quote it (build step 3 part 1).

## Pre-commit hook and generated files

- The pre-commit hook (`lint-staged`) runs `prettier --write` on every staged `.json`, `.md` and
  `.yaml` file and puts the result in the commit and the working tree. A generated file that tests
  compare byte for byte is rewritten by it: the MCD fixtures (`.inputs.json` is one line, about 80 KB)
  came out as 3,700 lines and T9 failed on the committed state (2026-10-01, MCD2 commit). The MCD
  fixtures and `mcd*_output.json` are now in `.prettierignore`. Any other generated file a test
  compares byte for byte needs the same entry, and a test run after the commit, not only before it.
- `mcd_worker/fixtures/*.json` is covered by the same `.prettierignore` pattern (`mcd*` matches `mcd_worker`). The `.source.md` notes next to them are NOT ignored, so the hook re-pads their tables;
  `mcd_worker.tools.build_fixtures.same_text` therefore compares a `.source.md` with the table padding removed, and `python -B -m mcd_worker.tools.build_fixtures --check` still says "same" after a commit.
- `git stash list` holds 17 old "lint-staged automatic backup" stashes (3 to 5 weeks old, not from a
  current run). Do not drop them without Davin's say.

---
type: Concept/EnvironmentGotchas
status: active
updated_at: 2026-10-13
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
- **A CRLF slip is invisible to `tsc` and Jest and fatal to a line-matching mutation harness** (build step 5 part 3, 2026-10-10): a Python edit with `write_text` turned `lib/engine4/offer.ts` into CRLF; the harness asserts each automatic mutant's `old_line` equals the scratch file's line, so all four workers crashed at the first mutant of that file, and the multi-line manual patterns of the same file matched nothing (`NOOP`). After a scripted edit, scan the changed files with Python (`b"\r\n" in path.read_bytes()`, not `grep`) and run `prettier --write` (the repository's `endOfLine` is `lf`) BEFORE the scratch copies are made.
- **Never stop a process by matching its command line on a word your own command also contains** (`Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'count_done' } | Stop-Process` ended the shell that was running it, exit 255, and the commands after it did not run). Match a script name that your own command does not spell out, or stop the ids you listed first.

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
- **`lib/engine4/` is held to exact arithmetic by a test** (`__tests__/lib/engine4/exactness-guard.test.ts`, build step 5 part 1): no `Math`, `parseFloat`, `parseInt`, `Number`, `toFixed` family, fractional or exponent literal, arithmetic on an operand the compiler types as `number` or `any`, and no import that is not a sibling file. A figure goes through `Rational` (`lib/engine4/exact.ts`); `-1` as a literal is the one allowed negative. `sizing-oracle.json` is tied to `scripts/engine4/oracle.py` by its SHA-256: after editing the oracle run it, then `npx prettier --write` the fixture.
- **Engine 4's database reader is imported by path, never through the barrel** (build step 5 part 2): `lib/engine4/read/structure-levels.ts` pulls in Prisma, `crypto` and `zlib`, and a client component that imports `@/lib/engine4` must not. `exactness-guard.test.ts` fails if a pure file imports or re-exports `./read/*` as a value. The twin of the zone builder's levels is held to the Python by `__tests__/lib/engine4/fixtures/structure-worlds.json` (`python scripts/engine4/structure_worlds.py --check`, then `npx prettier --write` the fixture after a rebuild); it records the SHA-256 of `zones.py`, so a builder change fails a test until the fixture is rebuilt and `ZONES_1` in `levels.ts` is re-pinned to `zone_params.yaml`.
- **A Jest mutation harness for the monolith (`next/jest`) in a scratch copy** needs, in the copy, a `package.json` and an (empty) `app/` folder or `next/jest` refuses to start, a junction to `node_modules`, and Jest 29's flag `--testPathPattern` (not `Patterns`). Run the test files one at a time: `--bail=1` with several workers stalls on a mutant that fails many tests (one hung for over 100 s while each file alone failed it in 3 s), and a naive harness then counts a hang as a kill (build step 5 part 1).

- **Root `tsc --noEmit` type-checks no file under `__tests__/`** (build step 6 part 1, 2026-10-11): the tsconfig excludes `__tests__` and `**/*.test.ts` (`npx tsc --noEmit --listFilesOnly` lists 3,190 files and not one test, Engine 4's included), and Jest's SWC never checks types, so a test file can hold type errors for good (four were found in `__tests__/lib/intake`). This corrects the build step 5 part 6 note above, which says the root run covers tests. Check a test folder with a throwaway `tsconfig.<name>.tmp.json` at the repo root (`{"extends": "./tsconfig.json", "compilerOptions": {"incremental": false, "noEmit": true, "plugins": []}, "include": ["__tests__/lib/<folder>/**/*.ts", "lib/<folder>/**/*.ts", "next-env.d.ts"], "exclude": ["node_modules"]}`), run `npx tsc -p` on it, delete it.
- **A mutation run of a monolith folder in parallel scratch copies** (build step 6 part 1: 978 mutants of `lib/intake/` in about 15 minutes on four copies, against 10.5 s a mutant alone through `npx`). Per copy: `package.json`, `next.config.js`, `tsconfig.json`, an empty `app/`, the folders under test, a junction to `node_modules` (`fs.symlinkSync(target, path, 'junction')`; also to read-only data such as `mcd_worker/`), and its own `jest.config.js` (`next/jest`, a `moduleNameMapper` for `@/`, no `setupFilesAfterEnv`). Call `node <repo>/node_modules/jest/bin/jest.js <suites> --runInBand --bail=1 --coverage=false --silent` from the copy (about 4 s a mutant). Generate mutants with the TypeScript compiler API (operators, `!`, conditions, booleans, plus or minus 1 on numbers, regex anchors) and run the wider suites only for a mutant that survives its own: in that run 2 of 136 first-pass survivors were killed only by a suite outside the first tier. Start each worker with `Start-Process` and one log per worker; keep the originals in a backup folder and compare sha256. A mutant that makes a module throw while it loads (here: the committed roster no longer parses) shows as "Test suite failed to run": count it as a kill at load, not as a compile error. Adding a test never un-kills a mutant, so after adding tests re-run only the survivors; after changing the code re-run that file's mutants.

- **`git push` runs the whole Jest suite first and outlives the Bash tool's 120 s** (build step 6 part 2, 2026-10-11): `.husky/pre-push` runs `type-check` and `test:quick` (`jest --bail`, 335 suites in about 4 minutes), so the push is moved to the background and finishes by notification; check `git rev-list --left-right --count origin/main...main`, not the first output. While it runs, do not add files under `lib/intake/` (`boundaries.test.ts` lists that folder). Every push also starts `E2E Tests`, `Check Production Migration Status` and `.github/workflows/deploy.yml`, which have failed on each push since at least 2026-10-09; `deploy.yml` is invalid ("workflow file issue": it calls `./.github/workflows/tests.yml` with `uses:`, and no workflow in the repository has `on: workflow_call`), so no job of it ever runs. How production is deployed is not shown by that file.
- **CI installs Python for the intake suites** (`tests.yml`: `setup-python` 3.11, `pip install pyyaml==6.0.2 jsonschema==4.25.0`, the versions the suites were verified with). Without them `describePython` skips the roster drift check, the canonical-JSON parity and both JSON Schema parity suites silently (the CI run of `88019649` shows `schema-parity.test.ts` at 14 s: it ran). A SECOND workflow, `Next.js CI (Progressive)`, runs the same Jest suites on the runner image's own Python, whose distro `python3-jsonschema` is 4.10: jsonschema up to 4.17 joins a relative `$id` such as `intake-packet/1` with itself and fails with `unknown url type: 'intake-packet/intake-packet/1'`, so `schema_verdicts.py` makes the `$id` absolute before it validates (build step 6 part 2, `d3eb05df`). Check a new Python-backed suite with `jsonschema` 4.10.3 and 4.25 by calling the helper with a venv's `python.exe` directly; putting a venv first on `PATH` from Git Bash does not change which `python` Node's `spawnSync` finds (use PowerShell's `$env:PATH`). `describe.skip` still RUNS its body: work that needs Python belongs in `beforeAll` or an `it`, never straight in the `describePython` callback.
- **A source written through the file tools can contain invisible characters as literals** (build step 6 part 2: 65 zero-width, bidirectional and control characters landed in six test files where `\uXXXX` escapes were meant, and a lone surrogate cannot be stored in a file at all). Scan new files for the ranges the normaliser removes (`Cc`, `Cf`, variation selectors, U+E0000 to U+E007F) and write them as escapes. A shell heredoc with a long TypeScript body also failed to parse once ("unexpected EOF"): write the body with the Write tool and splice it in.
- **Node 24 has Unicode 16, CI's Node 20 has 15**: a test that compares a hard-coded Unicode table with the engine (`\p{Nd}` against `DIGIT_ZEROS`) must accept a run the engine does not know yet (all ten digits or none) and fail on a digit the table lacks.
- **Read mutation survivors as code to delete, not only tests to add** (build step 6 part 2: 199 survivors of 1,230; a large part were guards that could not matter, such as an ASCII fast path, a string role that only the default branch read, a sort tie-break, and checks of a precondition the caller already guarantees). Removing them is cheaper than recording equivalents.
- **A long Jest run must BE the background task, not be sent to the background by `&` inside one** (build step 6 part 5): `(npx jest ... > log 2>&1; echo "exit $?" >> log) &` inside a `run_in_background` command was killed when the tool's shell ended; the log stopped after 46 suites with no summary and no `exit` line while the tool reported exit 0. Make the whole command the background task (`run_in_background: true`, output redirected to a file) and wait for the `exit` line with a Monitor.
- **A temporary `tsconfig` that checks the test folders must include `types/**/\*.d.ts`** (build step 6 part 5): without the `next-auth`module augmentation it reports about 40 errors in`lib/auth`and in any file that reads`session.user.tier`, which the root `tsc`does not have; the real errors (unused variables in tests, which`noUnusedLocals` makes errors) are the two or three at the top of its list. Delete the file before committing.

- **The knowledge service (`knowledge-service/`, build step 6 part 6) runs its tests on the real txtai and model** (506 tests, about 90 to 150 s): make a venv outside the repo from `knowledge-service/requirements.txt` with the real Python 3.14 (`C:\Users\k_kav\AppData\Local\Python\pythoncore-3.14-64\python.exe -m venv <scratch>\kvenv`), then `( cd knowledge-service && <venv>/Scripts/python.exe -m pytest -q -p no:cacheprovider )`. The first run fetches the pinned model (91 MB) into `knowledge-service/models/` (gitignored); `KNOWLEDGE_TEST_NO_DOWNLOAD=1` makes a missing model an error. Do not use the `python` Store alias (above).
- **A Windows Python cannot read a Git Bash path like `/c/Users/...`** (`FileNotFoundError`): pass it `C:/Users/...`. And a bare `cd subdir` in a Bash call moves the tool's working directory for the calls after it (seen again in part 6, three times): use `( cd subdir && command )`.
- **The Docker image runs Python 3.11 and this machine only has 3.14**, so a pin that resolves here may not exist there (found part 6: `numpy==2.5.4` has no 3.11 build; the image needs `2.4.6`). Prove `requirements.txt` for the image's target without Docker: `pip download --only-binary=:all: --python-version 3.11 --implementation cp --abi cp311 --platform manylinux_2_28_x86_64 --platform manylinux2014_x86_64 --platform manylinux_2_17_x86_64 --platform manylinux_2_27_x86_64 --platform manylinux_2_34_x86_64 --platform any -r requirements.txt -d <scratch>` (the CPU-only torch comes from the extra index in the file). `ast.parse(..., feature_version=(3, 11))` does NOT catch 3.12 f-string syntax (reusing the quote inside `{}`); `tests/test_config.py` has a guard for it.
- **txtai's hybrid fusion is the same linear mix whether keyword scores are normalised or not**, so checking `fused == w*dense + (1-w)*keyword` cannot tell `normalize: true` from rank fusion (found part 6): under rank fusion the dense-only result is just `1, 1/2, 1/3 ...`. `knowledge/verify.py` therefore also requires the dense-only score to be the model's cosine similarity (`embeddings.similarity`). txtai returns a list field of the content store (`state_codes`) from SQL as a JSON string, and a float as the second or third argument of `similar()` is read as hybrid weights, so a bound value that is a number is never passed there.

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
- **`next dev` rewrites the tracked `next-env.d.ts`** (double quotes and `./.next/dev/types/...` paths instead of the committed
  `'./.next/types/...'`): after any session that started the dev server, `git status` shows ` M next-env.d.ts`. It is not part of any
  change: restore it with `git checkout -- next-env.d.ts` before committing (build step 6 part 5, the intake preview).

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
- **`npx jest --runTestsByPath <file>` finds nothing on Windows for a `*.pg.spec.ts`** ("No tests found"), and the root Jest only collects `*.test.ts`. Run a gated spec with
  `npx jest --testMatch '**/__tests__/engine4/*.pg.spec.ts' --coverage=false` (build step 5 part 5). A `describe.skip` suite shows as skipped, not as missing.
- **`prisma migrate diff --from-config-datasource` needs a `schema` entry in the scratch config** (`export default { schema: '<abs path>', datasource: { url } }`), or it stops with "Could not find Prisma Schema" and exit 1 (not 2, which is drift).
  `--from-schema <old file> --to-schema <new file>` and `--from-empty --to-schema` need only the config's `datasource`, and print no dotenv lines with a config outside the repo.
- **A scratch copy of the tree for Jest (the mutation harness) needs four things the repository does not show** (build step 5 part 5): an empty `app/` folder (`next/jest` throws in `find-pages-dir` without one), a config that drops `setupFilesAfterEnv`
  (`jest.setup.js` mocks `@/lib/fx/shared-rate-store`, which is not in the copy), the golden cycles and fixtures under `davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/{golden,fixtures}` (the test helpers read them), and a CRLF scan limited to the
  files being mutated (`__mocks__/@auth/prisma-adapter.js` is CRLF in the repository and nothing touches it).
- **The root `tsconfig.json` type-checks `__tests__/` with `noPropertyAccessFromIndexSignature` and `noUncheckedIndexedAccess`** (build step 5 part 6): a test that types a parsed response as `Record<string, any>` fails with TS4111 on every `.field`; type it `any`. The Jest run (SWC) never sees it, so run `npx tsc --noEmit` before calling a test file done. The root run was 364 errors, all in the untracked `davintrade-mobile-app/`; since Davin's commits `00470ef3` to `f1adf52d` (the resizable-handle fixes, and `davintrade-mobile-app` in `tsconfig.json`'s `exclude`) it exits 0 with 0 errors, so a test file that breaks it is now visible at once.
- **A `jest.mock(...)` factory must sit in the test file, and may reach shared handles only through `jest.requireActual('./helpers/...')`** (build step 5 part 6, `__tests__/api/engine4/helpers/mocks.ts`): a `const mockX` declared below the imports is in its temporal dead zone when the factory runs at the first import of the route. `jest.mock` of a path that does not exist fails, so a mutation copy of the tree must hold `lib/auth/session.ts`, `lib/redis/client.ts`, `lib/active-indicator/`, `lib/tier-validation.ts`, `lib/tier-config.ts` and `lib/i18n/languages.ts` even though most are only mocked.
- **The exactness guard's small TypeScript program cannot resolve `@/` aliases, so those imports are `any`** (build step 5 part 6): `!x` on such a value was reported as "unary arithmetic on a number". The guard now treats only `-`, `~`, `++` and `--` as arithmetic prefix operators (self-tests both ways); `-x` of an `any` is still caught.
- **`formatCurrency()` converts to the viewer's currency and drops decimals above 1,000: for an amount that is already in its real currency use `formatChargedAmount` (`lib/billing/invoice-amounts.ts`)** (build step 5 part 7; `docs/policies/08-locale-i18n-compliance.md` section 4). Report 2's dollars go through it, and `Number()` is used only in `components/report2/format.ts`, on text already rounded for display.
- **A dictionary text may not state a figure beside a business word** (`__tests__/lib/systemconfig-figures-guard.test.ts` failed on "more than 5% from the live price"): write `{limit}` and fill it from the engine's constant. Routes under `app/dev*` are outside the compulsory-translation test by rule, so their words need a coverage test of their own (`__tests__/components/report2/translation-coverage.test.ts`).
- **A component test with `LocaleProvider` seeds `localStorage` and then WAITS for the language** (`waitForLanguage` in `__tests__/components/report2/helpers/render.tsx`): only th, en-GB and en-US are bundled, every other dictionary loads with an async `import()`. `jest.mock('next/navigation')` goes in the test file.
- **Shell quoting eats backslashes and escapes** (a regex or `\n` inside a heredoc, `node -e` or `node -`): a patch that matters is written to a file with the file tool and run (build step 5 part 7; the same family as the `\n` note above).
- **The built-in browser** (build step 5 part 7): a first compile of a route in `next dev` takes about 70 s (warm it with `curl --max-time 280 http://localhost:3000/<route>`), and the app stops an idle preview server; with the pane hidden a screenshot can be cropped or time out, while `resize_window` and `javascript_tool` still work; the app shell's floating "Support centre" pill covers the bottom of a narrow viewport (scroll the target up, or click it from script).
- **A file whose hash is signed must stay out of Prettier, and a generated index must not embed the sign-off** (build step 5 part 8, `__tests__/lib/engine4/worked-examples/`): the pre-commit hook rewrites staged `.json` and `.md`, which would change `scenario.json` and `expected.json` and silently invalidate every `approval.json`, so the folder is in `.prettierignore`; an `INDEX.md` that listed the approval statuses went stale the moment an example was approved and made `--require-approved` fail on a generated file, so it lists none. `python scripts/engine4/worked_examples.py list` shows the statuses.
- **Jest prints a coverage table longer than its result unless told not to**: pass `--coverage=false --silent` for a pass/fail answer (build step 5 part 8). Tests that run Python (`worked-examples.test.ts`) use `python` or `python3` and skip without one; run the tools with `python -B` so no `__pycache__` lands in `scripts/engine4/`.
- **A stored status that follows a sign-off is judged in one direction, and nothing generated lists it** (build step 6 part 3, `scripts/intake/glossary_tool.py`): the first draft of the review tool put the approval status in `review.md` (a column) and in `INDEX.md`, and wrote `approved` into the glossary's own `status` fields only when `record` ran, so signing an `approval.json` made three files stale and `check --require-approved` failed on files only `record` writes (the step 5 fact above, met again). Now the generated files hold content only (`list` shows the statuses), signing opens the gate at once, and the glossary's form statuses are judged one way: a form marked `approved` in an area that is not approved is a PROBLEM, a form still `draft` in an approved area is a NOTE (the safe direction; `record` marks it). Any later "content + sign-off + derived flag" tool should start from this.
- **A mutation run of a test file that spawns processes saturates at about 4 parallel slices** (build step 6 part 3, `glossary-tool.test.ts`, 60 to 80 s alone because it starts Python about 150 times): 10 slices on 12 cores took 11 minutes for the baseline and gained nothing (CPU at 99%), 4 slices ran about 8 minutes per 10 mutants. Sample instead of running everything (every logic mutant, every fifth of the wide kinds), build the tool's own small AST mutator when the target is Python (`gen-pymutants.py` in the session scratchpad, same JSON as the TypeScript one; the harness skips the `// @ts-nocheck` line for `.py`), run a second round only on the survivors' neighbours and on code that changed, and never `rm -rf` the temp trees (`%TEMP%/glossary-tool-*`) while a slice is running.
- **A file the tool writes and a person never edits has one layout, written by the tool** (build step 6 part 3): `config/intake/glossary.v1.json` is out of Prettier (`.prettierignore`) and `check` compares the file with `dump_glossary` of itself, so a hand edit or a Prettier run shows as a layout difference and `record` restores it. The statuses of its forms are the only thing in it a person's sign-off changes, and only `record` writes them.
- `git stash list` holds 17 old "lint-staged automatic backup" stashes (3 to 5 weeks old, not from a
  current run). Do not drop them without Davin's say.
- **On this machine `python` can be a dead Store alias, and the real interpreter has no `jsonschema` or `yaml`** (build step 6 part 4, 2026-10-13): `C:\Users\k_kav\AppData\Local\Microsoft\WindowsApps\python.exe` is a 0-byte app-execution alias that worked in one tool call and then answered exit 49 (Bash) or 9009 (PowerShell) for the rest of the session; `py` and `C:\Users\k_kav\AppData\Local\Python\pythoncore-3.14-64\python.exe` work but hold only pip. Node's `spawnSync('python')` then fails and **every Python-backed suite silently skips** (`glossary-tool`, `matrix-tool`, `matrix-parity`, and the ones that also need `jsonschema` and `yaml`: the roster drift check, the canonical-JSON parity and both JSON Schema parity suites); with a `python` that resolves but lacks the two packages, only that second group skips. Jest prints green either way. Make a venv outside the repo with the CI pins (`python -m venv <scratch>\venv`, then `pip install pyyaml==6.0.3 jsonschema==4.25.0`; CI pins PyYAML 6.0.2, which was not tried on Python 3.14 here) and put its `Scripts` first on PATH before `npx jest` (Bash: `export PATH=<venv>/Scripts:$PATH`). Check that a Python-backed suite really ran: `schema-parity.test.ts` takes about 25 s and `glossary-tool.test.ts` about 110 s; a few seconds means it skipped.
- **A Python tool's `print` writes CRLF on Windows**: a Jest assertion on its stdout needs `\r?\n` (build step 6 part 4, `matrix-tool.test.ts`). The files the tools WRITE are LF on purpose (`write_bytes`).
- **A scratch copy of the tree for a Jest mutation run needs `app/` and `types/`** (build step 6 part 4): `next/jest` stops with "Couldn't find any `pages` or `app` directory" without the first, and `lib/active-indicator/sources.ts` imports `@/types/indicator`. Copy `lib`, `config`, `types`, `__mocks__`, the test folders and the Jest config, make `node_modules` and `davintrade-stack-d-and-e` directory junctions (`fs.symlinkSync(target, path, 'junction')`), and **refresh the copies from the repo at the start of every run**: a copy made once goes stale the moment a test is edited (the first warnings.ts run used a stale test file). A mutant costs 1 to 2 s for a pure file and about 60 s for the suites that start Python.
- **A mutation harness over `lib/intake` found test gaps that a green suite and a coverage figure did not** (build step 6 part 4): `continue` to `break` survived because the test's unusable sensors were all of the list's tail, and an exported constant array nobody asserted survived as a string change. Put an unusable item BEFORE a usable one, and assert an exported list once.

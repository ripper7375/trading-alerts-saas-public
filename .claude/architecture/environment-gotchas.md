---
type: Concept/EnvironmentGotchas
status: active
updated_at: 2026-11-25
source: 'Distilled from gotcha notes 2026-08-30..10-24; full transcripts in details/environment-gotchas-archive.md'
tags: [windows, git, shell, jest, browser, tooling]
related_docs:
  - ./details/environment-gotchas-archive.md
  - ./infrastructure.md
  - ../protocols/verification-checklist.md
---

# Local environment gotchas (Windows checkout — Quick Reference)

Read only the section matching your task. Full incident details and long command recipes live in
[details/environment-gotchas-archive.md](./details/environment-gotchas-archive.md) (use `Grep`, do not bulk-read).

## Git and files

- **Never use `git stash`:** desktop app polls `git status` and holds `.git/index.lock`. If `lint-staged` /
  `git commit` hits `index.lock`, wait ~2 s and retry. Note: `lint-staged` creates/drops its own temporary stash inside `git commit`.
- **CRLF vs LF:** checkout is CRLF (`core.autocrlf=true`); Prettier uses `endOfLine: lf`. Check formatting with
  `prettier --check --end-of-line auto`. Do not use Python `Path.write_text()` or `grep -c $'\r$'` on Windows —
  use binary `read_bytes()`/`write_bytes()` and `git ls-files --eol`.
- **Thousands of phantom `M` entries:** caused by stale cached sizes (CRLF vs LF). With nothing staged, run
  `git read-tree HEAD` then `git update-index --refresh` (never set `GIT_OPTIONAL_LOCKS=0`). To sync a dirty
  checkout to `origin/main` without `stash`, back up hashes/diff, restore equal files, then `git reset --keep origin/main`.
- **Avoid `scratch/` TS errors:** `tsconfig.json` includes `**/*.ts`; broken `.ts` files in `scratch/` fail `pre-push`.
- **pnpm 10 vs 12:** repo requires `pnpm@10` (`npx -y pnpm@10 ...`); global pnpm 12.15 strips `overrides:` and can hang on engine locks.
- **Shell quoting & tools:** Bash heredocs/inline `-e` collapse `\\` and expand backticks; write scripts to a file first.
  Prefer `git -C` or `( cd dir && cmd )` over bare `cd`. Avoid `Start-Sleep` / `tasklist /FI` in Git Bash; use `python -B`
  or explicit venv Python (`WindowsApps\python.exe` is a dead Store alias). Never kill processes by a substring present in your own command.

## Tests

- **Isolation leaks & Jest mocks:** "passes alone, fails in suite" = leaked `LocaleProvider` geo-IP `fetch()`.
  `jest.mock` factories cannot reference out-of-scope `const`s (keep inside test file or `jest.requireActual`).
  Use `jest.resetAllMocks()` when `mockResolvedValueOnce` queues vary. Pass `--coverage=false --silent` for concise output.
- **Root `tsc` vs `__tests__/`:** `tsconfig.json` excludes `__tests__` (`npx tsc --noEmit` skips tests unless checked via a temp tsconfig).
- **`money-service` has no `node_modules` here:** run `tsc`/Jest in a `robocopy /MIR` scratch copy with `npm ci` or a junction
  (remove junctions with `cmd /c rmdir`, never recursive delete). Rerun `prisma.shutdown.spec.ts` with `--runInBand` if it times out.
- **`railway-gateway` quirks:** no ESLint config (check `tsc`, Jest, `prettier --check`); collects specs ONLY under `test/`;
  never put `.ts` under `railway-gateway/scripts/`; every Bull queue must be overridden in every e2e spec; keep `MarketDataProcessor`
  as one wildcard handler; gated DB specs need `CYCLE_PG_URL` + `CYCLE_PG_ALLOW_WIPE=yes` and `--testMatch` on Windows.
- **Scratch PostgreSQL on Windows:** never `pg_ctl start` inside a tool pipe (dies on exit `0xC0000142`); use `Start-Process` on
  `postgres.exe` hidden, poll `pg_isready`, stop with `pg_ctl stop -m fast`. Omit `sslmode=` in local TLS fixture URLs.
- **Mutation harnesses:** run detached with backups + SHA-256 verification, `windowsHide: true` (never pop-up consoles), UTF-8 output
  decoding, real copies (not junctions) for guard tests (`boundaries.test.ts`, `store-guard.test.ts`), and skip `// @ts-nocheck` on shebang files.
- **Python suites (`mcd_worker`, `knowledge-service`, Stack C):** run from `engine-1-5-new/` or `knowledge-service/` with `PYTHONIOENCODING=utf-8`
  and outside-repo venv (`pyyaml`, `jsonschema==4.25.0`, pinned Python 3.11 wheels for Docker). Wait for background Jest runs instead of `&`.

## Dev server and browser

- **Dev server & `next-env.d.ts`:** do not kill another session's `next dev`; clear `.next/dev` if all routes 404.
  `next dev` rewrites `next-env.d.ts` — restore with `git checkout -- next-env.d.ts` if unrelated.
- **Browser & CSS:** `ResizeObserver`/`rAF` pause when hidden; `localhost` upgrades to https (`127.0.0.1` needs `allowedDevOrigins`).
  Tailwind tokens must keep `/ <alpha-value>` (`oklch(var(--x) / <alpha-value>)`). Client `use()` must not precede hooks during SSR hydration.

## YAML registry files

- Quote `'off'`, `'on'`, `'yes'`, `'no'` in YAML registries (`flag: 'off'`); PyYAML 1.1 parses unquoted values as booleans and `mcd_worker` rejects them.

## Pre-commit hook and generated files

- `lint-staged` runs `prettier --write` on staged `.json`/`.md`/`.yaml`. Keep byte-exact fixtures/signed golden outputs in `.prettierignore`
  (`mcd_worker/fixtures/`, `worked-examples/`, `glossary.v1.json`, `eval-runs/`, `demo/`).
- Signed `approval.json` hashes invalidate on content edits; regenerate dependent catalogs/overlays when dictionaries change
  (`node scripts/i18n/generate-intake-refusal-messages.cjs`, `node scripts/i18n-build-en-us-overlay.js`, `npm run sync:sensor-kit`).
- Scripts importing `server-only` modules via `tsx` must require `scripts/server-only-stub.js` first.

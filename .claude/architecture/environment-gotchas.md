---
type: Concept/EnvironmentGotchas
status: active
updated_at: 2026-09-26
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
- `scratch/` is gitignored but inside `tsc`'s scope (`tsconfig` includes `**/*.ts`), so a
  type error there blocks the pre-push hook.

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

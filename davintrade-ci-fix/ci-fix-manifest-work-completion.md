# CI Fix: the 8 Always-Failing Checks — Work Completion Manifest

|                  |                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Request**      | Davin, 2026-09-24, in chat: "fix the CI checks that fail on every PR".                                                                                   |
| **Branch / PR**  | `fix/ci-failing-checks` → [PR #467](https://github.com/ripper7375/trading-alerts-saas-public/pull/467), **merged** into `main` @ `0c4752b9`.             |
| **PR CI result** | **24/24 checks pass**, including the 8 that failed on every PR, plus 2 that used to be skipped.                                                          |
| **Migration**    | **One new, guarded, idempotent migration:** `20260904110000_backfill_untracked_tables`. It is a no-op on production. **Not applied to production** (§6). |
| **App code**     | **Unchanged.** Only `package.json` scripts and one migration file.                                                                                       |

---

## 1. The problem

These 8 checks failed on PR #465, on PR #466, and on `main` itself:

| Check                         | Workflow                    |
| ----------------------------- | --------------------------- |
| TypeScript Type Check         | `security-checks.yml`       |
| ESLint Security Check         | `security-checks.yml`       |
| Security Check Summary        | `security-checks.yml`       |
| Unit & Component Tests (20.x) | `tests.yml`                 |
| Test Summary                  | `tests.yml`                 |
| TypeScript Type Checking      | `ci-nextjs-progressive.yml` |
| Run Tests                     | `ci-nextjs-progressive.yml` |
| api-tests                     | `api-tests.yml`             |

Locally, `tsc --noEmit` was clean and `npm run test:ci` passed, so the failures were specific to
the CI environment. Because every PR failed the same way, CI could no longer tell a good change
from a bad one. PRs #465 and #466 were both merged with these failures.

---

## 2. Three causes, found in the CI logs

### 2.1 The shared types package was never built in CI (6 of the 8 checks)

- `@trading-alerts/types` (`packages/types`) is consumed from its **built `dist/`**
  (`package.json` `exports` point only at `./dist/...`).
- `dist/` is **gitignored** (`.gitignore:52`), so a fresh checkout doesn't have it.
- The only thing that built it was the root `prebuild` script, which runs only before
  `pnpm run build`.
- The CI jobs run `pnpm install`, then type-check, lint and tests. None of those build the package.

**Evidence:** all **141** TypeScript errors in the PR #466 run traced back to three missing
modules, and nothing else:

| Missing module                      | Occurrences |
| ----------------------------------- | ----------- |
| `@trading-alerts/types/geometry`    | 11          |
| `@trading-alerts/types/validations` | 2           |
| `@trading-alerts/types/tier`        | 1           |

The rest were knock-on errors, such as `SharedTier` becoming unresolvable in
`lib/tier-validation.ts` and `lib/utils/constants.ts`. The same missing modules explain most of
the **21 failing test suites** (tier-config, tier-validation, validations/alert, the
drawing/geometry suites, and others). None of the 141 errors or 21 suites were in files changed
by #466.

### 2.2 `pnpm run lint` called a command Next.js 16 removed (2 of the 8 checks)

`"lint": "next lint"`. Next.js 16 no longer has `next lint`, and in CI it failed with
`Invalid project directory provided, no such directory: .../lint`. This was already known locally
(`LESSONS-LEARNED.md` L38: "use `npx eslint`, not `npm run lint`"), but CI still used the script.
It broke the ESLint Security Check and, through it, the Security Check Summary.

### 2.3 Migrations did not replay onto an empty database (`api-tests`)

`api-tests` runs `prisma migrate deploy` against a fresh Postgres. It failed with:

```
Migration name: 20260904120000_default_theme_light
ERROR: relation "UserAppearance" does not exist   (P3018 / 42P01)
```

`default_theme_light` alters `UserAppearance`, but **no migration ever creates that table**. It
was added with `prisma db push`, outside migration history. This is the same drift class as
`20260830020000_backfill_marketing_assets` (2026-09-01), and it is at least the fifth instance
recorded in `CLAUDE.md`.

The failure was reproduced locally first, on a disposable database (§5.1). Rather than fix one
missing table and replay again, every table and enum in both Prisma schemas was compared with
what the migrations create. The drift was wider than the error showed:

| Kind        | Objects no migration creates                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Enums (2)   | `LoginStatus`, `SecurityAlertType`                                                                                  |
| Tables (7)  | `user_sessions`, `login_history`, `security_alerts`, `UserAppearance`, `token_usage_log`, `Drawing`, `DrawingAlert` |
| Columns (4) | `User.twoFactorEnabled`, `twoFactorSecret`, `twoFactorBackupCodes`, `twoFactorVerifiedAt`                           |

The 2FA columns don't stop the replay; they were found by diffing the replayed database against
the schema. They mattered anyway: login reads them, so the API tests' server would have broken
on them next.

**Dependency check:** only `default_theme_light` actually uses any of these objects. The one
other textual match, in `20260912000000_add_currency_index_pro_tables`, is a comment. No later
migration alters these tables, so creating them in their current schema shape cannot clash with
anything after.

---

## 3. What changed

| File                                                                             | Change                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json` → `postinstall`                                                   | Still generates the Prisma clients as before; now **also** runs `npm run build --prefix packages/types` when that package exists. Every install (CI, fresh clones, Vercel) ends with a built `dist/`. One change fixes every workflow at once, instead of adding a build step after each of the ~20 install steps across 10 workflows. |
| `package.json` → `lint`, `lint:fix`                                              | `next lint` → `eslint app components lib src hooks types middleware.ts` (and `--fix`). `app`, `components`, `lib` and `src` are the folders `next lint` covered by default; `hooks`, `types` and `middleware.ts` are app code that was also clean, so they were added.                                                                 |
| `prisma/migrations/20260904110000_backfill_untracked_tables/migration.sql` (new) | 40 guarded statements, detailed below.                                                                                                                                                                                                                                                                                                 |

**What the backfill migration contains:**

- **Timing:** dated just before `20260904120000_default_theme_light`, its first dependent.
- **Source of the SQL:** generated by `prisma migrate diff --from-empty --to-schema
prisma/non-market-data/schema.prisma`, not hand-written.
- **Guards:** every statement checks before acting, so it can run on any database:

| Statements       | Guard                                 |
| ---------------- | ------------------------------------- |
| 2 enums          | `DO` block checking `pg_type`         |
| 7 tables         | `CREATE TABLE IF NOT EXISTS`          |
| 22 indexes       | `CREATE [UNIQUE] INDEX IF NOT EXISTS` |
| 5 foreign keys   | `DO` block checking `pg_constraint`   |
| 4 `User` columns | `ADD COLUMN IF NOT EXISTS`            |

- **Precedent:** follows `20260830020000_backfill_marketing_assets` exactly: a guarded backfill
  dated before its first dependent.

**Why ESLint wasn't simply run over the whole repo:** that linted 8,905 files and reported 9,112
errors. About 7,960 of those files, and nearly all the errors, were under `.claude/` (local
worktrees, which don't exist in CI). The rest came from `e2e/`,
`frontend-and-backend-python-stack/` and `__tests__/`. The app folders reported **0 errors**.

---

## 4. Commits

| Commit     | Summary                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------- |
| `c64ea4a2` | `fix(ci)`: build the shared types package, replace `next lint`, backfill untracked tables |
| `0cd6b31d` | `docs(claude-md)`: session entry                                                          |
| `0c4752b9` | Merge of PR #467 into `main`                                                              |

---

## 5. Verification

### 5.1 Migrations, on a disposable Postgres 16 container

| Check                                                                                                      | Result                                          |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Before the fix: replay all migrations onto an empty database                                               | Fails at `default_theme_light`, identical to CI |
| After the fix: replay all **28** migrations onto an empty database                                         | All applied                                     |
| Replayed database diffed against the **non-market-data** schema                                            | Nothing missing                                 |
| Replayed database diffed against the **market-data** schema                                                | Nothing missing                                 |
| Backfill removed from migration history, then re-applied to the fully built database (the production case) | Succeeds, no errors: a no-op                    |

The diff does list objects the database has beyond the non-market-data schema. All are expected:
market-data tables (in the other schema), the Stack D RAG tables (created by migration, not yet
modelled), and the legacy `Watchlist` tables. They don't affect CI.

**Isolation:** `prisma.config.ts` loads `.env.local` with `override: true`, so its `DIRECT_URL`
wins over any `DATABASE_URL` passed on the command line. Running the replay with the normal
config would have pointed `migrate deploy` at the real **staging** database. The replay used a
throwaway `prisma.replay.config.ts` instead: it loads no `.env` files and hardcodes the
container address. Each run printed `at "localhost:55432"`. The config, the container and the
temporary worktree were all removed afterwards.

### 5.2 CI emulation in a fresh checkout

A new `git worktree` of `c64ea4a2`, run the way CI runs it:

| Step                             | Result                                             |
| -------------------------------- | -------------------------------------------------- |
| Fresh checkout                   | `packages/types/dist` absent (0 entries), as in CI |
| `pnpm install --frozen-lockfile` | Passes; `dist/` built by `postinstall` (8 entries) |
| `pnpm run type-check`            | **0 errors** (CI had 141)                          |
| `pnpm run lint`                  | **0 errors**, 5 warnings (warnings don't fail it)  |
| `pnpm run test:ci`               | **230/230 suites · 2983/2983 tests**               |

### 5.3 GitHub Actions on PR #467

**24/24 pass**, including all 8 previously failing checks. The **Integration Tests** and
**Production Build Check** jobs, skipped on #466, now run and pass. The final `CLAUDE.md`-only
commit was merged without waiting for its own CI run, since it changes no code.

---

## 6. ⚠ Production: one step for Davin

The backfill is dated **before** migrations production has already applied, so
`prisma migrate status` against production will now list
`20260904110000_backfill_untracked_tables` as **pending**.

- **Effect of applying it:** none on the data or schema. Every object already exists in
  production, so every statement is skipped; it only records the migration as applied. This was
  tested (§5.1).
- **How to apply it:** check first with `prisma migrate status` (via `prisma.production.config.ts`),
  because `prisma migrate deploy` applies **every** pending migration, not just this one. This
  has caught unrelated migrations riding along four times before in this repo.
- **Until it's applied:** `check-production-migrations.yml` will report it as pending.
- **One assumption:** "no-op" assumes production's copies of these objects match the schema,
  which they should, since `db push` created them from it. If a production object differed, the
  `IF NOT EXISTS` guard would skip it, not change it.

---

## 7. Not done / open

1. **Other workflows still failing on `main`.** `check-production-migrations.yml` and
   `deploy.yml` also failed on `main` before this work. They were not among the 8 PR checks and
   were **not investigated**.
2. **Lint scope.** `e2e/` (49 errors), `__tests__/` (8) and `frontend-and-backend-python-stack/`
   (54) are not linted, matching what `next lint` covered before. Linting them would be a
   separate clean-up.
3. **The drift itself.** `prisma migrate status` and `deploy` cannot detect `db push` drift,
   because they compare only against migration history. What caught it here was replaying all
   migrations onto an empty database and diffing the result against both schemas. CI's
   `api-tests` job now does the first half of that on every PR, so new drift will fail CI instead
   of hiding.
4. **`mt5-pipeline-tests.yml`** installs with `npm ci`, not pnpm. The new `postinstall` step uses
   plain `npm run --prefix`, so it works there too, but that workflow was not exercised.

---

## 8. Rollback

Revert `c64ea4a2`.

- **Before production applies the backfill:** the revert simply removes the migration file.
- **After it's applied:** leave the migration file in place. Prisma warns when a recorded
  migration is missing from disk, and the file is harmless.

The `postinstall` and `lint` changes carry no state and revert cleanly.

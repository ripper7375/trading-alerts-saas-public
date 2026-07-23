# LESSONS-LEARNED.md — Skill Memory (rules distilled from failures)

**What this is:** the seventh memory file — reflexes. Where Deviations record _what happened once_ and the Decision Log records _what was chosen_, this file records **rules extracted from failures** so the same mistake is never debugged twice.

**Who writes:** the Executor, at session close. Write the RULE, not the story — one entry, ≤6 lines.
**Who reads:** the Executor, at every session OPEN.
**Hard cap ~40 active lessons.** (Consolidated by Advisor on 2026-07-22. Full history moved to `LESSONS-ARCHIVE.md`).

---

## Active lessons

### L1 — Never run Prisma schema migrations (`db push` / `migrate deploy`) from money-service

- Symptom: (Caught by Advisor before disaster) Running `db push` or `migrate deploy` from `money-service` drops all core tables.
- Root cause: `money-service` shares the monolith's database but only defines a _subset_ of the schema.
- Rule: ONLY run `prisma generate` in `money-service`. The monolith is the sole owner of the database schema and migrations. Never attempt to migrate the database from the `money-service` workspace.
- Source: Session 4A-6 (Advisor Review) · Status: ACTIVE

### L2 — Never trust a test suite that can't fail when the server changes

- Symptom: `lib/api/` client tests passed 36/36 while every real endpoint call was broken.
- Root cause: the suites fully mocked `fetch` — they tested the mocks, not the contract.
- Rule: parity/contract tests must exercise recorded REAL responses or a live staging service.
- Source: migration-stack-analysis.md `lib/api/` flag · Status: ACTIVE

### L3 — A ported test that "needs" its assertion changed is a finding, not a fix

- Rule: never edit a ported assertion to pass without first explaining WHY the behavior differs, in Deviations. The old behavior is correct until proven otherwise.

### L4 — Config-file paths and Bind mounts must match filesystem case and style exactly

- Rule: Path strings in config files (`tsconfig.json`, `.eslintignore`) must match the on-disk casing exactly. When constructing a Windows path to embed in a command passed to a native executable from Git Bash, use forward slashes (`C:/Users/WiN/...`). Git Bash strips backslashes.

### L5 — A script's `require()` must be backed by a direct dependency

- Rule: Any package a script directly `require()`s must be a direct `dependencies`/`devDependencies` entry. Never rely on pnpm's hoisting of transitive deps.

### L6 — A server-only import anywhere in a module taints the WHOLE module for every `'use client'` importer

- Rule: Any file that exports both client-safe values and server-only logic must be split into two files. Only `next build` catches this error, not `tsc` or `jest`. Run `npm run build` at least once per session that touches files imported by client components.

### L7 — `railway up`'s default upload scope needs `--path-as-root` for monorepos

- Rule: When deploying a service that lives in a subdirectory, pass `--path-as-root` (e.g., `railway up ./money-service --path-as-root ...`). `.railwayignore` inside the subdirectory has no effect on the archive root.

### L8 — "No Vercel dashboard access" blocks CLI actions, not reaching the live public site

- Rule: If a "verify production" step only needs a GET against known public routes, just navigate a browser or fetch the real production URL directly (`trading-alerts-saas-frontend.vercel.app`). Do not mark it blocked by Vercel access.

### L9 — `ts-node` needs an explicit CommonJS override when tsconfig targets ESM

- Rule: Any one-off `ts-node <file>.ts` invocation needs `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}'` set to avoid `ERR_UNKNOWN_FILE_EXTENSION`.

### L10 — A shared `jest.mock()` setup file only intercepts if imported BEFORE the mocked module

- Rule: Any test file using a shared `jest.mock()` setup must import that setup file as the FIRST import. Wrap it in `/* eslint-disable import/order */` so the linter doesn't reorder it.

### L11 — Never trust an order's header status field alone; cross-check entry-criteria checkboxes and git history

- Symptom: an order arrived with header `Status: APPROVED` while its own Entry Criteria list still had an unchecked "Davin approves this DRAFT" box, and the file was untracked with no PRE-DRAFT→DRAFT→APPROVED commit history at all.
- Rule: at CONFIRM, cross-check the header's claimed status against (a) the order's own entry-criteria checkboxes and (b) git history for that file. A self-contradicting order is a stop-and-ask trigger, not something to silently trust or silently fix.
- Source: Session 4A-6 · Status: ACTIVE
- Recurrence (Session 4A-3): same pattern — PRE-DRAFT note block vs. an uncommitted `APPROVED` status-line edit, no Advisor-DRAFT/Davin-approval commit history, and the paired evidence file (manual-trigger idempotency checklist) showed 0/8 boxes checked despite the claimed-done state. Resolved by asking Davin directly rather than trusting the file; this is now a 2nd occurrence, worth the Advisor's attention on how order status edits get made outside the Advisor→Davin pipeline.
- Recurrence (Session 5-1): same pattern — order file arrived untracked (`??`) with `Status: APPROVED` header while 4/4 entry criteria checkboxes were `[ ]` unchecked. Resolved by asking Davin live ("Go") to confirm before execution. (3rd occurrence).

### L12 — A catch block checking `error.message` for a marker the source only ever sets on `error.code` is dead code

- Symptom: 4 monolith routes' auth-error handling (`error.message.includes('AFFILIATE_REQUIRED')`) never fires — `lib/auth/session.ts`'s thrown errors set that marker on `.code`, never `.message` — every real auth failure silently falls through to a generic 500 in production, zero test coverage either way.
- Rule: when porting error-handling logic 1:1, read what the thrown error's fields ACTUALLY are, not just what the catch block appears to check — a plausible-looking condition can be permanently unreachable. Port the route's own documented/intended contract (its JSDoc `@returns`) when the actual behavior is a provably dead, zero-coverage bug.
- Source: Session 4A-6 · Status: ACTIVE

### L13 — Next.js 16 Turbopack CommonJS external resolution (`lucide-react` & `ioredis`)

- Symptom: `npm run build` under Next.js 16 Turbopack fails with `Can't resolve 'lucide-react/dist/esm/icons/*-icon'` or `Can't resolve './utils/argumentParsers'` inside `ioredis/built/Command.js`.
- Root cause: (1) Legacy `modularizeImports` for `lucide-react` appended `-icon` suffixes to icon filenames during build, whereas Next.js 16 natively tree-shakes ESM export maps. (2) `ioredis` internal CJS requires fail under Turbopack when untranspiled.
- Rule: Remove legacy `modularizeImports` for `lucide-react` under Next.js 16 (let native ESM export maps handle tree-shaking). Add `transpilePackages: ['ioredis']` in `next.config.js` for `ioredis` bundling under Turbopack.
- Source: Session 5-2 · Status: ACTIVE

### L14 — Next.js 16 (`next@16.2.10`) deprecates/removes `next lint` CLI command in favor of ESLint 9 Flat Config

- Symptom: `npm run validate:lint` (`next lint --max-warnings 0`) fails with `error: unknown option '--max-warnings'` or unknown command under Next.js 16.
- Root cause: Next.js 16 deprecated/removed `next lint` from Next CLI in favor of native ESLint 9 Flat Config (`eslint.config.mjs` exporting `eslint-config-next@16.2.10`).
- Rule: Under Next.js 16 / ESLint 9, create `eslint.config.mjs` importing native `eslint-config-next` flat config array and invoke ESLint directly (`eslint <dirs> --max-warnings 0`) in `package.json` scripts. Target application source directories (`app components lib hooks`) explicitly to avoid scanning out-of-scope separate-stack paths.
- Source: Session 5-3 · Status: ACTIVE


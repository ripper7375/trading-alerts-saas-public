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
- Recurrence (Session 4A-7b): same pattern again — the order's own "Updated" note read "updated to DRAFT for authorization" while the header field one line above it claimed `Status: APPROVED`, and the edit was uncommitted with no PRE-DRAFT→DRAFT→APPROVED history. Resolved by asking Davin directly rather than trusting the file; he confirmed live approval and corrected the note. (4th occurrence — worth the Advisor's attention on why order-status edits keep arriving outside the normal pipeline with self-contradicting text.)
- Recurrence (Session 4A-W1): a new variant — `git status` showed the order file modified-but-uncommitted; `git diff` against the last commit showed `Status: DRAFT → APPROVED` with no approval commit trail, **and** all five of the order's own entry-criteria line-count numbers had independently drifted by exactly `+1` away from both the last commit and the live codebase. Resolved by asking Davin directly rather than trusting or silently correcting either field; he confirmed the status flip was his own intentional approval and separately fixed the line counts back to the `wc -l` baseline before execution began. (5th occurrence — first time the self-contradiction included corrupted _evidence_ numbers alongside the status field, not just the status field alone. Worth the Advisor's attention on whether order files should be edited in a working copy at all versus only via a reviewable diff/PR.)
- Recurrence (Session 4A-W2): same pattern — order file modified-but-uncommitted, `Status: PRE-DRAFT → APPROVED` with no Advisor-DRAFT/Davin-approval commit trail, and all four of the order's own line-count entry-criteria numbers had shifted `+1` away from both the committed version and the live codebase. Resolved by asking Davin directly; confirmed his own edit, numbers corrected to the `wc -l` baseline. (6th occurrence.)
- Recurrence (Session 4A-W3a): same pattern, first pass — order arrived with a self-reported "APPROVED" status but 4/6 entry criteria FAILED against live state (F39/F41 still open, `WISE_API_TOKEN` absent, three cited line counts stale by up to +212 lines from an intervening session's own migration commit). Reported in full, execution declined; second pass after Davin resolved the open flags confirmed the split/`APPROVED` status was his own intentional edit (again no commit trail). (7th occurrence.)
- Recurrence (Session 4A-W3b): same status-flip/no-commit-trail shape, **plus a new variant**: the rewritten order body had silently resolved two open design questions the PRE-DRAFT text had explicitly deferred to CONFIRM ("flag or flag-less?", "should the admin page allow an action or stay view-only?") with no visible decision recorded anywhere — not just the status field or line-count evidence drifting, but substantive scope questions being answered invisibly. Resolved by asking Davin directly for all three (status-flip provenance + both design questions) before marking CONFIRMED. (8th occurrence — worth the Advisor's attention on whether a PRE-DRAFT's own explicitly-flagged open questions should be answered as separate, individually-commit-tracked edits rather than folded silently into the APPROVED rewrite.)

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

### L15 — Vercel Root Directory configuration vs monorepos/legacy subdirectories (`frontend/`)

- Symptom: Vercel production build installs stale `next@15.5.20` and `prisma@6.19` and chokes on legacy build-time lint rules despite root `package.json` specifying `next@16.2.10` and `prisma@7.8.0`.
- Root cause: Vercel Project Settings had **Root Directory** set to `frontend` (a legacy transitional subfolder) instead of `./` (root).
- Rule: Ensure Vercel Dashboard -> Settings -> Build and Deployment -> **Root Directory** is set to `./` (blank) so Vercel builds the root application (`trading-alerts-saas-v7`).
- Source: Session 5-4 Vercel Deployment · Status: ACTIVE

### L16 — `pnpm` strict dependency isolation & Prisma runtime bundling under Next.js 16 Turbopack

- Symptom: Vercel build fails with `Module not found: Can't resolve '@prisma/client-runtime-utils'` when bundling custom-generated Prisma Clients (`.prisma/market-client`, `.prisma/non-market-client`).
- Root cause: `pnpm` enforces strict symlink dependency isolation and does not hoist sub-packages like `@prisma/client-runtime-utils` unless explicitly declared or hoisted.
- Rule: When building custom Prisma Client output paths under `pnpm` on Vercel: (1) declare `"@prisma/client-runtime-utils": "7.8.0"` explicitly in `package.json` dependencies, (2) add `public-hoist-pattern[]=@prisma/*` to `.npmrc`, and (3) add `'@prisma/client'` and `'@prisma/client-runtime-utils'` to `serverExternalPackages` in `next.config.js`.
- Source: Session 5-4 Vercel Deployment · Status: ACTIVE

### L17 — Never use `railway variables --kv` (or any unfiltered dump) to check whether a secret is set

- Symptom: checking that `DLOCAL_WEBHOOK_SECRET` was set on Railway production printed the actual secret value into the session transcript.
- Root cause: `--kv` (and the default table view) print real values, not just key presence; there is no built-in "exists only" flag.
- Rule: to check whether a secret is SET without exposing its value, grep for the key name only and report a boolean (e.g. pipe through something that reports match/no-match, never the matched line's content) — never display the value in any tool output, chat message, or artifact. If a value is accidentally displayed, do not repeat it, flag the exposure to Davin, and let him decide on rotation.
- Source: Session 4A-5 · Status: ACTIVE

### L18 — A guard that rejects before the DB means "route works" was never proven; the first authenticated call is the first schema test

- Symptom: (pre-emptive, Session 4A-7a) 12 money-service routes were verified as "registered and protected" by unauthenticated requests returning 401 — but `JwtAuthGuard` rejects before Prisma is ever reached, so nothing about the database was tested.
- Root cause: a 401 from an auth guard exercises the guard, not the handler. Services that define a hand-mirrored schema **subset** (money-service, operation-service) can diverge from the monolith without any test noticing.
- Rule: the first **authenticated** call to a newly deployed route is its first real schema test. If it fails on a Prisma column/model/relation/enum, that is a SCHEMA finding — stop and scope it as its own session. Never patch the transport/client around it (`select`, `omit`, defaulting, mapping), and never author schema from the consuming service (L1). See `DECISION-LOG.md` **F46**.
- Source: Session 4A-7a (Advisor review, 2026-07-25) · Status: ACTIVE

### L19 — "Money-service shares the monolith's DB" is an architecture doc, not a runtime guarantee — compare actual `DATABASE_URL` hosts before trusting local-DB test results

- Symptom: seeded a test affiliate profile via the local Next.js dev server, minted a session token for that same user, called money-service (production) with it, and got a genuine `404 Profile not found` — not a bug, just a different database. Cost real diagnostic time (comparing masked `DATABASE_URL`/`DATABASE_PUBLIC_URL` hosts across services, querying both DBs directly) before the mismatch was confirmed.
- Root cause: local dev's `.env.local` `DATABASE_URL` (`turntable.proxy.rlwy.net:...`, likely the F34 staging Postgres project) is a **different host** than money-service's production `DATABASE_URL` (`postgres.railway.internal` / public proxy `maglev.proxy.rlwy.net:...`) — even though blueprint §5.1 correctly describes money-service and the monolith as sharing one production Postgres instance in principle, that doesn't mean _local dev_ is pointed at that same instance.
- Rule: before trusting "I seeded/verified it locally, so it'll be there when the Railway service reads it," diff the actual host in both services' `DATABASE_URL` (masked, per L17 — never print credentials) rather than relying on the architecture doc. If they differ, either seed through the target Railway service's own DB connection, or treat a "not found" from that service as inconclusive rather than a bug.
- Source: Session 4A-7a · Status: ACTIVE
- Recurrence (Session 4A-W2): same root cause, new manifestation — **within one checkout**, not cross-service. `prisma.config.ts` uses `DIRECT_URL` for all migrations/CLI (per L3); `lib/db/prisma.ts` uses `DATABASE_URL` for runtime. Ran `migrate deploy`, then verified via a script mirroring `lib/db/prisma.ts` (`DATABASE_URL`) and found zero new tables — looked like the migration silently failed. It hadn't: `DATABASE_URL` (`turntable.proxy.rlwy.net`) and `DIRECT_URL` (`maglev.proxy.rlwy.net`) are genuinely different databases (different `User`/`Subscription` row counts), `DATABASE_URL` being this checkout's staging target, `DIRECT_URL` being real production (confirmed live, Davin). Rule extension: when verifying a migration or schema change, query through the SAME connection string the migration itself used, not whichever one a generic "check the data" script happens to default to — the two env vars in this repo are not interchangeable even within one checkout.

### L20 — `npm run validate`'s `validate:format`/`validate:policies` steps are not part of this repo's actual green bar on Windows

- Symptom: `npm run validate` (the full chain) fails on `validate:format` (`prettier --check .`, 287 files) even on an otherwise-clean checkout with zero relevant edits.
- Root cause: `core.autocrlf=true` on Windows checkouts converts tracked LF files to CRLF on disk; prettier's default `endOfLine: "lf"` then flags nearly every file. No `.gitattributes` normalizes this. Every session's actual historical exit-suite report (`type-check`/`validate:lint`/`build`/`test:ci`) already omitted `validate:format`/`validate:policies` — this isn't a new regression, just never verified as failing until this session actually ran the full chain instead of the split scripts.
- Rule: on this repo, treat `tsc --noEmit` + `eslint --max-warnings 0` + `next build` + the relevant test suites as the real green bar, not the literal `npm run validate` chain, until a dedicated session adds `.gitattributes` line-ending normalization and re-baselines `validate:format`/`validate:policies`. Don't run `prettier --write` repo-wide as a drive-by fix inside an unrelated session.
- Source: Session 4A-7a · Status: ACTIVE

### L21 — A prior session's "added to X" doesn't mean the real target environment has it — verify the exact target, not the doc

- Symptom: 4A-7a's close-out said `MONEY_SERVICE_URL` + both Slice-3 flags were "added to `.env.example`" — true, but 4A-7b's CONFIRM found none of the 3 existed in Vercel production at all, only in the checked-in example file.
- Root cause: `.env.example` documents what an environment needs; it is not proof any real environment has it. A close-out's "added" doesn't specify which target it means, and the next session assumed the strongest reading.
- Rule: before any flag flip or cutover, value-blind-list (`vercel env ls`/equivalent) the exact vars the code path reads, in the exact target environment, and treat ".env.example coverage" and "present in the real target" as two separate facts that both need checking. Here the gap was not benign: the code's fallback (`?? 'http://localhost:3002'`) would have hard-failed 100% of the flipped group's traffic against an unreachable address, since the flag itself removes the monolith fallback.
- Source: Session 4A-7b · Status: ACTIVE

### L22 — `prisma migrate dev` does live drift detection against the target DB and can propose a full schema RESET; only `migrate diff`/`migrate deploy` are safe on a DB with pre-existing untracked drift

- Symptom: ran the order's literal `prisma migrate dev --create-only` against production. It printed "Drift detected... We need to reset the 'public' schema... All data will be lost" and only stopped short of the reset confirmation prompt because stdin wasn't a TTY (exit 130). The drift was pre-existing (untracked `db push`-applied tables/columns from past sessions) and had nothing to do with the schema edit being made.
- Root cause: `migrate dev` (any invocation, `--create-only` or not) first diffs the ACTUAL target database against what replaying the full migration history would produce; on any mismatch its only offered resolution is a destructive reset. This repo has no `SHADOW_DATABASE_URL` configured and no staging Postgres to rehearse against (F34/CC-A gap), so this check runs directly against production every time.
- Rule: **never run `prisma migrate dev` (in any form) against this production database.** To generate migration SQL for review without touching the database at all, use `prisma migrate diff --from-schema <pre-edit schema snapshot> --to-schema <schema.prisma> --script` (pure datamodel diff, zero DB connection). To apply an already-reviewed migration, use `prisma migrate deploy` (apply-only, no drift check, no reset path). Verify with `migrate status` (read-only) before and after, always through the SAME connection string the apply step used (see L19's recurrence).
- Source: Session 4A-W2 · Status: ACTIVE

### L23 — `railway up` from a monorepo subdirectory is unreliable; `git push` (GitHub auto-deploy) is the working path for money-service

- Symptom: `cd money-service && railway up` uploaded 438MB and got a Cloudflare 413 (no
  local `.gitignore` in the subdirectory — adding one made no difference, and the CLI's
  `.gitignore`-based exclusion apparently only resolves correctly when CWD is the actual
  git repo root). `railway up ./money-service --path-as-root` (from repo root) uploaded a
  correctly-scoped 220KB archive, but nixpacks then failed with "Failed to read app source
  directory" — consistent with the Railway service's dashboard-configured Root Directory
  expecting an unflattened archive that still contains a `money-service/` prefix.
- Root cause: unclear from the CLI alone (no way to inspect the dashboard's Root Directory
  setting from this environment) — likely a mismatch between `--path-as-root`'s flattening
  behavior and however this specific service's Root Directory is configured.
- Rule: for `money-service` (confirmed connected to a GitHub source), use `git push origin
main` and let Railway's auto-deploy trigger — confirmed working twice this session
  (clean build, correct routes registered, verified live). Don't burn time on `railway up`
  flag combinations for this service until someone checks the Railway dashboard's Root
  Directory setting directly. This narrows/updates L7 — L7's `--path-as-root` advice still
  applies to services where it's the ONLY way to deploy (no connected GitHub source), but
  isn't universal.
- Source: Session 4A-W3a · Status: ACTIVE

### L24 — An order's stated guard level for a proxy route is not evidence; read the live backend controller's actual guard before wiring a UI-BUILD session's proxy

- Symptom: the order specified guarding `POST /api/wise/recipients/[id]/revalidate` with `requireAdmin()` and placing its trigger button on an admin page. The already-built live backend endpoint (`wise-recipients.controller.ts`, frozen at a prior PORT session) is actually `AffiliateGuard`-scoped self-service only — it derives the target recipient from the CALLER's own token, using the URL's `:id` only for an ownership check, never to select which recipient to act on. Building it as specified would have meant an admin caller either 403s or silently revalidates the ADMIN's OWN recipient instead of the intended affiliate's.
- Root cause: the order's prose assumed a REST-ish "verb + path param" shape implies the caller can act on an arbitrary target by ID — true for admin-authored endpoints, false for a self-service-designed one. A UI-BUILD session consuming a PORT session's already-frozen backend inherits that backend's actual permission model, not the order's guess at it.
- Rule: before wiring any proxy route's own guard (`requireAffiliate()`/`requireAdmin()`), read the live backend controller's own guard decorator AND how the handler derives its target entity (from the caller's token vs. from the path param) — never trust an order's stated guard level alone for an endpoint someone else already built. A mismatch here is a live bug, not a style choice.
- Source: Session 4A-W3b · Status: ACTIVE

### L25 — `enableShutdownHooks()` is not optional; without it every `onModuleDestroy` is dead code

- Symptom: `PrismaService.onModuleDestroy()` existed in money-service since Session 4A-1 and had never once run — no Railway redeploy had ever actually drained an in-flight query.
- Root cause: Nest only invokes lifecycle hooks on SIGTERM/SIGINT when `app.enableShutdownHooks()` is called in `main.ts`. Registered-but-never-enabled reads as handled when it isn't.
- Rule: any service with a lifecycle hook (`onModuleDestroy`/`OnApplicationShutdown`), a queue consumer, or in-flight external calls must call `app.enableShutdownHooks()`. Verify with a real test, not a code read alone — a synthetic `process.emit('SIGTERM', 'SIGTERM')` proves the wiring, but Nest's own shutdown listener re-sends the OS signal via `process.kill(process.pid, signal)` after cleanup, which will kill the test runner unless `process.kill`/`process.exit` are stubbed first.
- Source: Session 4A-W4 (2 pre-existing defects found by Advisor review 2026-07-25, fixed and verified 2026-07-26) · Status: ACTIVE

### L26 — A global `APP_GUARD` throttler also throttles your provider webhooks

- Symptom: `/v1/webhooks/dlocal` inherited the app-wide `ThrottlerGuard` default (100 req/60s) with no per-route override — a legitimate provider retry burst would 429 and be read as a permanent delivery failure.
- Root cause: `ThrottlerGuard` registered as `APP_GUARD` applies to every route by default, including ones whose caller is a payment provider you don't control and can't ask to back off.
- Rule: every payment-provider webhook route needs an **explicit**, generous per-route `@Throttle()` — never the inherited global default, and never `@SkipThrottle()` either (that trades throttling for unbounded flooding). Prove the override actually raises the ceiling with a real burst test against the real guard, not just a metadata-presence check — `@Throttle()` doesn't change the handler body, so an unchanged behavioral test suite proves zero regression but not that the new limit is real.
- Source: Session 4A-W4 (2026-07-26) · Status: ACTIVE

### L27 — An order's own file-by-file prose can drift from the SAME session's cited ground truth, silently and more than once

- Symptom: 4A-W5's order text (Hard Invariants, File 1/8, File 2/8, File 5/8, File 8/8) disagreed with its own cited ground truth in FOUR separate places: told to use `@SkipThrottle()` when design §7.5 had been corrected to the opposite just one session earlier (4A-W4); paraphrased the frozen §5.2 state table incompletely (missing `charged_back`/`incoming_payment_initiated`, wrong `bounced_back`/`cancelled` behavior); named a `Commission.status = 'FAILED'` value that doesn't exist in the schema; named a `WiseBatchGroup.fundingDetected` field that doesn't exist (real name `fundingSource`). None of these were caught by the order's own CONFIRM-time entry-criteria checklist — they only surface by actually reading the cited ground truth (design doc sections, Prisma schema, LESSONS-LEARNED itself) before writing code, not by trusting the order's per-file description as a spec.
- Root cause: order text is written once, at PRE-DRAFT/DRAFT time, from a snapshot of the ground truth; the ground truth (design docs, schema, other lessons) keeps evolving underneath it (here: a same-repo dated correction, a frozen invariant table paraphrased instead of copied, and schema enum values never cross-checked against the prose). A PORT-variant order's own "Low creativity dial" instruction ("follow the design doc, not this order's own prose") is necessary but not sufficient — nothing forces a re-read of the cited sections before typing the implementation.
- Rule: for any order whose own text states "ground truth is §X, not this order's prose" (every PORT variant), actually re-read §X (and the live schema/enum values any described mutation touches) immediately before writing each file that implements it — do not implement from the order's paraphrase and only spot-check ground truth when something looks odd. A schema-invalid value (`'FAILED'` here) would be caught by `tsc`; a schema-valid-but-wrong value or an incomplete state table would not be, and would ship as a silent money-correctness bug.
- Source: Session 4A-W5 (2026-07-26) · Status: ACTIVE
- Recurrence (Session 4A-W6): five more mismatches in a single order — a wrong SLA default (24h vs.
  design's 72h), an invented interface shape in File 1's own prose (design §3.3's real
  `FundableProvider` has completely different members), a quote-direction example that predated and
  was superseded by a LATER binding decision (F38) recorded in a different document
  (`DECISION-LOG.md`) than the one the order cited, an undercounted REST endpoint surface (3 vs. the
  frozen OpenAPI's real 7), and two file-location disagreements with design §8's own module-layout
  table. The F38 case is new: ground truth itself can be split across documents that disagree with
  each other by DATE, not just an order paraphrasing one document imperfectly — the more recently
  dated source (here, `DECISION-LOG.md`) wins, but only re-reading BOTH and checking dates catches
  it.

### L28 — "Existing tests" cited as a parity oracle may not exist; verify the file is there before trusting it as a safety net

- Symptom: 4A-W6's own Hard Invariant #4 and Rules both said "every pre-existing test in
  `payment-orchestrator.service.spec.ts` MUST pass UNMODIFIED" — the file did not exist anywhere in
  the tree. Neither did `commission-aggregator.service.spec.ts`, another file this same session had
  to edit. Both are core, already-shipped, money-moving files with zero prior test coverage.
- Root cause: an order's own confidence that "existing tests protect the untouched code path" is
  itself an unverified claim — a `Read`/`Glob` on the literal file the order names is a cheap check
  that would have caught this before writing a single line of the new branch, but nothing prompts
  that check specifically (it looks like ordinary Verification/Rules prose, not a claim to audit).
- Rule: before relying on "existing tests" as a parity oracle for ANY file an order names, actually
  locate that spec file (`Glob`/`find`) before writing code — do not assume its existence from the
  order's confident tone. If it doesn't exist, building it first (covering the untouched code path
  AND the new one) is real, valuable, in-scope work, not a scope-creep detour — it's the safety net
  the order assumed it already had.
- Source: Session 4A-W6 (2026-07-26) · Status: ACTIVE

# LESSONS-LEARNED.md — Skill Memory (rules distilled from failures)

**What this is:** the seventh memory file — reflexes. Where Deviations record _what happened once_ and the Decision Log records _what was chosen_, this file records **rules extracted from failures** so the same mistake is never debugged twice.

**Who writes:** the Executor, at session close. Write the RULE, not the story — one entry, ≤6 lines.
**Who reads:** the Executor, at every session OPEN.
**Hard cap ~40 active lessons.** Currently at 62 (L1–L62) — a consolidation pass is overdue and
now more overdue than at last count; the next session that isn't itself time-constrained should
do it before adding more. Candidates promoted and preamble archived 2026-08-03; L11's own
9-recurrence narrative collapsed to a single count line same day (Session 4B-19), L27's own
7-recurrence narrative collapsed the same way Session 6-5 (2026-08-11, after Session 6-2's own
2026-08-10 recurrence was left un-collapsed inline; recurred again same day at Session 6-6), both
per this file's own hygiene rule, detail moved to `LESSONS-ARCHIVE.md`. Full history in
`LESSONS-ARCHIVE.md`.

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
- Recurrence count: 10+ times through Session 4B-3, each individually documented (full per-session
  detail moved to `LESSONS-ARCHIVE.md` per this file's own "5+ recurrences → single count line"
  hygiene rule) — Sessions 4A-3, 5-1, 4A-7b, 4A-W1, 4A-W2, 4A-W3a, 4A-W3b, 4B-2, 4B-3. Several
  further Sessions between 4B-4 and 4B-18d also flagged this exact pattern in their own CLAUDE.md
  close-outs (mostly benign — order body byte-identical to its committed PRE-DRAFT, only header
  metadata changed) without a matching entry ever being appended here; not reconstructed
  retroactively, flagged as its own gap. Recurred again at Session 4B-22: both the order file and
  `CLAUDE.md` were modified-but-uncommitted, `PRE-DRAFT → APPROVED`, matching committed `HEAD`'s own
  `PRE-DRAFT` — benign this time on two counts: the VERIFY-RETIRE variant is explicitly fast-path
  eligible per `EXECUTOR-PROTOCOL.md` §4 (no dropped DRAFT-stage requirement, unlike 4B-20's own
  case), and Davin's own chat message opening the session directly stated the APPROVED status and
  the F56 reconciliation, serving as the live confirmation this check exists to obtain. Most recent,
  and the most consequential to date:
  **Session 4B-20** (2026-08-03) — NOT benign: the working copy dropped its own committed
  PRE-DRAFT's explicit "not fast-path eligible under any circumstance... needs a full Advisor
  DRAFT and Davin APPROVED" framing entirely, jumped straight to `Status: APPROVED`/"Option B
  selected" with zero corresponding `DECISION-LOG.md` entry and all 4 Entry Criteria checkboxes
  still unchecked — on the single highest-blast-radius session in the whole migration (auth
  semantics). Resolved the same way as every prior instance (asked Davin directly rather than
  silently trusting or correcting); confirmed live as his own authentic decision and recorded as
  `DECISION-LOG.md` F56 before treating the entry criterion as satisfied. This is the single
  most-recurring finding class in this migration — still worth the Advisor's attention on whether
  the order-authoring pipeline itself should change (e.g. every status-field edit going through a
  reviewable commit) rather than relying on CONFIRM-time detection every single session, and this
  session is a concrete argument that the stakes of skipping that fix keep rising, not falling.
  Recurred again at Session 6-1 (2026-08-10) — benign: order + 5 supporting artifacts (`CLAUDE.md`,
  `DECISION-LOG.md`, cutover table, plan, playbook) rewritten in one internally consistent batch,
  no DRAFT-stage commit; confirmed live by Davin as his own authentic edit before treating any of
  it as trustworthy.
  Recurred again at Session 6-3 (2026-08-10) — this time with real body-content drift, not just
  header metadata: citation source swapped to a less-authoritative doc, an explicit "needs a
  design decision" open question silently resolved with no visible rationale, and a carried-forward
  Done-when item dropped. Confirmed live by Davin as authentic; he also resolved the design
  question directly and explicitly reinstated the dropped item rather than letting it stay lost.

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
- Recurrence (Session 4A-10b continuation, 2026-07-30): the risk isn't limited to `--kv`. `railway variable list --service <svc>` with NO flags at all (the default table view) ALSO prints real, unmasked values for every variable — `CRON_SECRET`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `REDIS_URL`, and 4 dLocal secrets were exposed this way, on the assumption the default table masked values the way some other CLIs do. It doesn't. Rule extension: for Railway specifically, the ONLY safe way to check presence is `railway variable list --service <svc> --json` piped through a script that checks `Object.keys(...)` and prints booleans only — never render the default table, `--kv`, or `--json` output directly, regardless of which flag combination is used.
- Recurrence (Session 4A-11, 2026-07-30): even the "safe" `--json` + script method has a hole — a `head -c 300`/`cat`-style sanity check on the raw JSON file (meant only to confirm the fetch/parse worked before trusting the boolean check) printed operation-service's real `DATABASE_URL` and `NEXTAUTH_SECRET` straight into the transcript. Rule extension: NEVER read, `cat`, `head`, or otherwise preview ANY byte of a Railway variable dump file's contents, even for debugging the check itself — only grep for an exact key-name match (`grep -q '"KEY_NAME"'`) and report the boolean. If the boolean check itself seems broken, debug it with synthetic/fake JSON, not the real file.
- Recurrence (Session 4B-3, 2026-08-01): a THIRD distinct failure mode — `railway variables
  --service <svc>` with no flags prints a box-drawn table (`║ KEY │ value ║`), and piping that
  through `head -30` "just to see if a variable is there" printed `operation-service-worker`'s
  real `DATABASE_URL` and `NEXTAUTH_SECRET` in full. Separately, this box-table format is ALSO why
  several earlier value-blind checks in this same session using an anchored `grep -c
'^MIGRATE_ALERT_ENGINE'` pattern silently returned false negatives — the real line starts with
  `║ `, never matching `^KEYNAME`. Rule extension: the only reliable safe method across this whole
  incident class is `railway variables --service <svc> --kv | cut -d'=' -f1` (or equivalent),
  which both avoids ever rendering a value AND is immune to the box-table anchoring trap — never
  use `head`/`cat`/`tail` on any raw `railway variables` output, in any flag combination, for any
  reason, including "just checking the format."

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
- Recurrence count: 7 further times through Session 6-6, each individually documented (full
  per-session detail moved to `LESSONS-ARCHIVE.md` per this file's own "5+ recurrences → single
  count line" hygiene rule) — Sessions 4A-W6, 4A-8, 4A-9, 4A-11, 6-2 (drift within a single order's
  own PRE-DRAFT→APPROVED rewrite, not against an external doc), 6-5 (a single order instruction
  conflating two genuinely different, both-live facts into one blanket claim), 6-6 (a fabricated
  batch-status vocabulary with zero matches anywhere in either Prisma schema, plus 2 of 6 target
  pages described as needing a small "wire"/"audit" edit that didn't exist at all).

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

### L29 — A quote/conversion amount field's currency isn't proven correct until a real non-default-currency case actually runs through it

- Symptom: `wise-quote.service.ts`'s `createQuote` passes `Commission.commissionAmount` (always
  USD) straight through as `targetAmount` with `targetCurrency` set to the recipient's local
  currency. For every prior test (sandbox GBP/USD fixtures, all 4A-W5/W6 unit and E2E coverage),
  this either matched or was never exercised against a currency where the bug would show — a `$50`
  commission became a request for `50 THB` (≈$1.49) the first time a real non-USD recipient
  (Thailand) was used, four sessions after the code was written and fully test-suite-green the
  whole time.
- Root cause: `commissionAmount`'s currency (USD, fixed by `DEFAULT_CURRENCY`) and the Wise API
  parameter it gets passed into (`targetAmount`, meaning "amount in `targetCurrency`") are silently
  different currencies whenever `targetCurrency !== 'USD'`. No test ever ran a same-code-path
  conversion between two different real currencies — sandbox fixtures used currencies where the
  units happened not to expose the mismatch, or mocked the Wise API response entirely.
- Rule: any field whose name implies "amount in currency X" must be checked against what currency
  the VALUE being passed in was actually computed/stored in — a same-named variable flowing across
  a currency boundary is a real bug class, not a style nit, and unit tests using a single currency
  (or mocks) cannot catch it. Before trusting a cross-currency amount conversion as correct, prove
  it with a real non-default-currency case against the real API, not just green tests in the
  system's own default currency.
- Source: Session 4A-W7 (2026-07-27), found live during the first-ever real non-USD Wise payout
  attempt · Status: ACTIVE · See `DECISION-LOG.md` F47.

### L30 — Porting a dependency into money-service needs the monolith's PINNED version, not `npm install <pkg>`'s latest

- Symptom: Session 4A-9's Step 0 (`cd money-service && npm install stripe`) pulled `stripe@22.3.2`
  (latest) while the monolith pins `stripe@^14.10.0` — an 8-major-version gap. Surfaced as a real
  `tsc` compile error (`Subscription.current_period_end` moved off the SDK's top-level type in
  later major versions), not a silent bug — but a subtler API-version mismatch could easily have
  shipped clean and only misbehaved against Stripe's real API at runtime.
- Root cause: `npm install <pkg>` with no version specifier always resolves to the latest tag;
  nothing prompts a check against what version the code being ported was actually written
  against and tested with.
- Rule: when a PORT session installs any dependency into money-service that the monolith already
  depends on, check the monolith's `package.json` for its pinned version FIRST and install that
  exact version/range (`npm install <pkg>@<same-range-as-monolith>`) — never a bare
  `npm install <pkg>`. Behavior preservation (the PORT variant's whole premise) starts at the SDK
  version, not just the code that calls it.
- Source: Session 4A-9 (2026-07-27) · Status: ACTIVE

### L31 — A cutover order's "flip the flag" step needs the flag to actually be READ somewhere; a BUILD session that only ships the new side leaves the flip a no-op

- Symptom (2nd occurrence): 4A-W6 built `WisePaymentProvider` but never wired `'WISE'` into
  `provider-factory.ts`/`disbursement.constants.ts` — 4A-W7's own literal cutover step
  ("flip `DISBURSEMENT_PROVIDER=MOCK → WISE`") would have silently done nothing
  (Waiting-on #54). Recurred at Slice 4: 4A-9 built all 10 money-service-side write
  controllers, but the monolith's 5 existing write routes have zero flag-check/forwarding code
  to money-service at all (`lib/money-service/routes.ts`/`flags.ts`, built 4A-7a, only cover
  Slice 3's reads) — 4A-10's own "Flip Feature Flags" checklist step would be a silent no-op,
  found while finalizing that PRE-DRAFT, before any flag was ever touched.
- Root cause: a PORT/BUILD session that only ships the NEW side (money-service's controllers,
  or a new provider class) can look 100% complete by its own Done-when checklist while the OLD
  side (the monolith route, or the provider-factory dispatch) never got the matching flag-check/
  dispatch-case added — nothing in either session's own scope forces a check that flipping the
  named flag would actually change which code path runs.
- Rule: before treating any BUILD/PORT session as sufficient prerequisite for its own named
  cutover flag, grep the ENTIRE codebase (not just the new side) for that flag's exact name —
  if it comes back with zero reads outside documentation/config, the cutover step is currently a
  no-op regardless of how complete the new side is. A PORT session that builds a new endpoint
  set behind a flag must also build (or explicitly hand off as a separate, scoped follow-up) the
  OLD side's flag-check/dispatch wiring — mirroring how 4A-7a built the monolith-side
  `lib/money-service/routes.ts`/`flags.ts` transport BEFORE 4A-7b's own cutover, not after.
- Source: Session 4A-W7 (2026-07-27, Waiting-on #54) · Recurrence: Session 4A-9 (2026-07-27,
  found while finalizing 4A-10's PRE-DRAFT, before execution) · Status: ACTIVE

### L32 — A PORT session moves code that reads config; it does not move the config itself into the new service's real environment

- Symptom: 4A-10b flipped `MIGRATE_WRITE_APIS_MONEY_STRIPE`/`_DLOCAL` true in production and both failed on real, live requests — not on the transport/auth/flag mechanism (proven working end-to-end both times via `money-service` logs), but because `STRIPE_PRO_PRICE_ID` was never set on `money-service`'s Railway production (`.env.example` had it; the real environment didn't — L21's exact class), and because `money-service`'s configured dLocal API credentials are genuinely invalid (`403 Invalid credentials` from dLocal itself). Two-for-two on the first two groups tested, not one-off bad luck.
- Root cause: 4A-9 (the PORT session) copied the CODE that reads `STRIPE_SECRET_KEY`/`STRIPE_PRO_PRICE_ID`/`DLOCAL_API_KEY`/etc. into `money-service`, and someone separately added SOME of the corresponding Railway variables afterward — but nothing in either session's scope was "verify every config value the newly-ported code needs is present AND correct in the new service's real target environment," so partial/wrong configuration shipped silently behind an off-by-default flag until a live cutover attempt exercised it.
- Rule: before any cutover session flips a flag for newly-PORTed code, enumerate every config value the ported code reads (grep the new service's source, not just its `.env.example`) and value-blind-verify (L17 method) each one is present on the real target environment — and where feasible, verify CORRECTNESS too (e.g., a real sandbox API call), not just presence, since a present-but-wrong credential (dLocal here) is invisible to a presence check alone.
- Source: Session 4A-10b (2026-07-28) · Status: ACTIVE

### L33 — A provider's "Invalid credentials" error can mean the request signing is wrong, not the secret values — check the code path before re-verifying config a second time

- Symptom: `money-service` returned the identical `403 Invalid credentials` (dLocal code 3001) on a
  dLocal payment-creation retry even after the credentials were refreshed and independently
  confirmed present. The real cause (found by re-reading the actual `fetch()` call, not by
  re-checking config again) was `dlocal-payment.service.ts:143-151` sending `X-Login`/
  `X-Trans-Key`/`Authorization` to the wrong fields — a byte-for-byte-preserved bug that predates
  this migration entirely (identical in the monolith's own original source).
- Root cause: L32 correctly established "verify the config is present in the new service's real
  environment" — but a provider's generic "invalid credentials" response is consistent with BOTH a
  wrong secret value AND a correctly-valued secret sent in the wrong header/field/signing scheme.
  Nothing distinguishes these from the error message alone.
- Rule: after a config-presence check passes (L32) and a provider still rejects credentials as
  invalid, read the actual outbound request construction (headers, signing/HMAC scheme, which
  field gets which secret) before asking for the credentials to be re-verified a second time —
  especially for code marked "ported byte-for-byte" from an older codebase, which may never have
  been exercised against the real provider API even before the migration. Compare against any
  sibling code path for the same provider that IS known-working (here, the inbound webhook
  verifier, fixed in Session 4A-5) — a working sibling often reveals the provider's real scheme
  directly.
- Source: Session 4A-10b continuation (2026-07-30), `DECISION-LOG.md` F48 · Status: ACTIVE

### L34 — This app's monolith routes authenticate via NextAuth session cookie, not a Bearer header; Bearer is only what money-service's OWN guards expect on the forwarded request

- Symptom: suggested `Authorization: Bearer <token>` for testing a monolith Next.js route
  (`/api/payments/dlocal/create`) and got a 401 that never reached money-service — the monolith's
  own `getServerSession(authOptions)` call reads NextAuth's `httpOnly` session cookie
  (`__Secure-next-auth.session-token` in production), never an `Authorization` header. Bearer auth
  only enters the picture INSIDE `forwardWriteRequestToMoneyService`, which reads the monolith's
  own resolved session and re-attaches it as a Bearer token when calling money-service — the
  external caller never supplies a Bearer token directly for these routes.
- Rule: when constructing a live test request against a MONOLITH Next.js API route, use a real
  session cookie (`WebRequestSession` + `System.Net.Cookie`, per L(Cookie via -Headers is dropped,
  Session 4A-10b prior entry) — never a Bearer header. Bearer headers are only correct when calling
  money-service's OWN endpoints directly (`JwtAuthGuard`-protected `/v1/...` routes).
- Source: Session 4A-10b continuation (2026-07-30) · Status: ACTIVE

### L35 — Fixing the first bug a request hits can unmask a second, previously-invisible bug in the same code path; a live-fixed error message changing shape (not just disappearing) is real progress, not a new failure to panic over

- Symptom: fixing F48 (dLocal outbound signing) turned a `403 Invalid credentials` into a
  `400 Missing parameter: payment_method_flow` (F49) — a completely different, previously-unseen
  dLocal error. The request had never gotten far enough to reach dLocal's payload-validation layer
  before, since auth always failed first; F49 had been silently present, untriggered, this whole
  time.
- Root cause: a request that fails at step 1 (auth) never exercises step 2 (payload validation) —
  fixing step 1 doesn't just fix the request, it also turns on the lights for whatever was already
  broken at step 2. Neither this migration's code reads nor its mocked-`fetch` unit tests could
  have caught F49 while F48 was still masking it.
- Rule: when a live-verification fix changes an error's status code/shape rather than making the
  call succeed outright, that's a signal to keep investigating one layer deeper, not to assume the
  fix failed or is complete. Read the NEW error on its own merits (here: a genuinely different
  dLocal error code, 5001 vs. 3001) before concluding anything about the original bug — a changed
  error is usually progress, and conflating "still failing" with "still the same bug" wastes
  diagnostic time. Don't fix the newly-revealed bug in the same session unless it's trivially in
  scope; a live cutover attempt that reveals a second real bug is itself the deliverable (a new,
  correctly-scoped finding), not a reason to keep patching deeper into the money-moving path
  live in production.
- Source: Session 4A-10c (2026-07-30), `DECISION-LOG.md` F48/F49 · Status: ACTIVE

### L36 — `vercel --prod` (or plain `vercel deploy`) fails outright on this monorepo without `--archive=tgz`

- Symptom: `npx vercel --prod --yes` failed immediately with
  `"files" should NOT have more than 15000 items, received 32981` / `missing_archive`, before any
  build even started.
- Root cause: Vercel's default deploy upload mode sends one file per HTTP multipart entry, capped
  at 15,000 files; this repo (monolith + money-service + operation-service + docs, all in one
  checkout) has over 32,000 files even after `.vercelignore`/`.gitignore` exclusions.
- Rule: always pass `--archive=tgz` on any `vercel deploy`/`vercel --prod` invocation in this repo
  (bundles the upload into a single tarball, sidesteps the file-count cap entirely). Every prior
  session's Vercel redeploys happened via `git push` (Vercel's own GitHub auto-deploy), which never
  hits this limit — this only bites when triggering a deploy directly via the CLI, which is
  necessary specifically for an env-var-only change (a flag flip) with no new commit to push.
- Source: Session 4A-10c (2026-07-30) · Status: ACTIVE

### L37 — An event's `aggregateId` is not always the right notification recipient; check each eventType's own emission call site, not just the field name

- Symptom: building operation-service's outbox consumer, the order's own text treated "resolve the
  recipient via `aggregateId` -> `User.id`" as a universal rule for all 6 `OutboxEvent` types. Five
  of six really do work that way (the aggregate IS the notified user). The sixth,
  `COMMISSION_CREDITED`, does not: `stripe-webhook.service.ts` emits it with `aggregateId` set to
  the PAYING SUBSCRIBER's id (reusing the same `userId` variable the checkout session's tier-write
  used), not the affiliate who actually earned the commission — a field named `aggregateId` reads as
  generically "the entity this event is about," which silently hid that it means something
  different per eventType here.
- Root cause: an event schema with one shared `aggregateId` field across multiple `eventType`
  values invites treating recipient resolution as uniform. It isn't, whenever an event's subject
  (whose tier/state changed) and its intended notification target (who should be emailed) are
  different people — commission crediting is inherently third-party (subscriber pays, affiliate
  earns), unlike every other tier/subscription event in this stream.
- Rule: for any event-driven consumer dispatching by `eventType`, read the ACTUAL EMISSION call
  site for each eventType (not just the payload shape) before assuming a single resolution strategy
  covers all of them — specifically check what value the emitting code passed as the identifier and
  whether that's provably the same person the notification should reach. Where it isn't (and the
  payload can't supply the real target), skip and flag rather than guess; a wrong-recipient email is
  a worse failure mode than a missed one.
- Source: Session 4A-11 (2026-07-30), `DECISION-LOG.md` F50 · Status: ACTIVE

### L38 — A BUILD session's "CONFIRMED, executed, fully closed" close-out can still mean the code was never pushed; CONFIRM must diff local `HEAD` against `origin/main`, not just the local working tree

- Symptom: 4A-11 closed CONFIRMED with green tests and a clean build, but `git push` never ran —
  local `main` sat 12 commits ahead of `origin/main`. 4A-12's own CONFIRM (same day) verified the
  local tree exhaustively (files present, tests green, build clean) and still missed this, because
  it never compared `HEAD` to `origin/main`. Surfaced only when probing the live target endpoint
  returned `404` instead of the expected `401`, mid-Checklist, after Davin had already approved the
  flag flip. A second, compounding gap: `operation-service` has no GitHub source connected at all
  (`railway service list --json` → `"source": null`) — some prior session deployed it by direct
  upload, so even a push would never have reached it regardless.
- Root cause: "committed, tested, build-clean" is a different claim than "deployed," and a
  close-out can state all three without ever confirming which deploy mechanism actually ran for
  which service.
- Rule: at CONFIRM, for any order whose Checklist touches a live production route, run `git log
origin/main -1` against local `HEAD` — do not infer deployment state from the local tree alone.
  Before assuming `git push` will deploy ANY service in this project, check that service's own
  `source` field via `railway service list --json` — `null` means push-triggered auto-deploy is
  structurally impossible, and `railway up --path-as-root --service <name>` (L7/L23) is the only
  path.
- Source: Session 4A-12 (2026-07-30) · Status: ACTIVE
- Recurrence (Session 4B-3, 2026-08-01): the gap isn't limited to a session's own close-out claim
  — a MID-session fix, reported as "committed and pushed" while work was still iterating, had the
  identical gap: commit `3248fb8e` (the fix that made the deployed worker actually behave
  correctly) existed in the local checkout but `git merge-base --is-ancestor 3248fb8e origin/main`
  came back false. It was only caught because the very next CONFIRM step re-ran `git fetch origin
main --quiet` and compared `git rev-parse origin/main` against `git rev-parse HEAD` explicitly,
  rather than trusting the "pushed" claim. Rule extension: this diff-against-origin check applies
  to every claim of "committed and pushed," not just a formal session close — re-verify it fresh
  each time, even the third or fourth time in the same session.

### L39 — A shared package's `exports` map is invisible to a consumer whose tsconfig uses classic/Node module resolution; `typesVersions` is the fix, not touching the consumer's tsconfig

- Symptom: `@trading-alerts/types`'s subpath exports (`./geometry`, `./alert-engine`, `./validations`)
  resolved fine for the monolith (`moduleResolution: bundler`) and for Node's own runtime `require()`
  (which understands `package.json` `exports` natively), but `operation-service`'s `tsc --noEmit`
  failed every subpath import with `TS2307` — its tsconfig has no `moduleResolution` set to
  `node16`/`nodenext`/`bundler`, so it defaults to TypeScript's older classic/Node algorithm, which
  does not consult the `exports` field at all.
- Root cause: TypeScript has (at least) two independent module-resolution behaviors gated by
  `moduleResolution` — only `node16`/`nodenext`/`bundler` read `package.json` `exports`; classic/Node
  resolution does a raw path lookup relative to the package root instead, so a subpath's real
  location under `dist/` is invisible to it regardless of how correct the `exports` map is.
- Rule: when a new shared package uses subpath `exports` and will be consumed by a service whose
  tsconfig you don't want to (or can't safely) change, add a `typesVersions` field to the package's
  own `package.json` mapping each subpath to its real `.d.ts` location — this is TypeScript's
  purpose-built compatibility shim for exactly this gap, understood under every `moduleResolution`
  setting. Verify with a real `tsc --noEmit` in the CONSUMING service (not just the monolith), not
  just a runtime `require()` check — Node's runtime resolver and TypeScript's compile-time resolver
  are different code paths that can disagree.
- Source: Session 4B-1 (2026-07-31), `DECISION-LOG.md` F9 · Status: ACTIVE

### L40 — A module shared into both an HTTP-process AppModule and a worker-process entrypoint auto-starts its side effects in EVERY process that constructs it

- Symptom: (caught by design before it shipped, not a live incident) 4B-2's own File 12 instruction
  ("Register AlertEngineModule in app.module.ts") means the module is imported by BOTH `main.ts`
  (HTTP process) and the new `main-worker.ts` (worker process) sharing one `app.module.ts`. A naive
  reading — `@Interval()` on the cron scheduler, an `OnModuleInit` subscribe loop on the worker
  service — would run BOTH the cron and the Redis pub/sub subscriber in EVERY process that
  constructs the module, not just the intended worker process: a genuine double-fire/
  double-consumption bug, not a hypothetical.
- Root cause: NestJS decorators (`@Cron()`, `@Interval()`) and lifecycle hooks (`OnModuleInit`) fire
  unconditionally in every application context that constructs the provider — module registration
  alone carries no notion of "which process is this," and neither does the decorator.
- Rule: when a module with active side effects (cron, queue consumer, pub/sub subscriber) is shared
  between two process entrypoints via one `app.module.ts`, gate the actual work behind an internal
  flag/method that only ONE entrypoint's own bootstrap flips on (e.g. `enable()`/`start()`) — never
  rely on module-registration or decorator presence alone to imply "this process should run it."
  money-service's own `CronsScheduler` already does exactly this shape (every `@Cron()` handler
  checks `isCronEnabled()` before doing real work) — same pattern, generalized to any module shared
  across a multi-process topology, not just a global on/off flag.
- Source: Session 4B-2 (2026-07-31) · Status: ACTIVE
- Recurrence (Session 4B-3, 2026-08-01): the exact mistake this lesson describes was made for
  real, one session after it was written — commit `0d74f645` made `operation-service`'s HTTP
  process (`main.ts`, replicated) call `AlertWorkerService.start()`/`AlertCronScheduler.enable()`
  directly, gated only on an env-var check inside the shared entrypoint, not on which entrypoint
  file was running. Caught by re-reading `AlertWorkerService`'s own class comment (which cites this
  exact lesson's rationale near-verbatim) before the flag was ever set live, and reverted. Rule
  extension: an env-var check inside a SHARED entrypoint file is not the same as "only one
  entrypoint's own bootstrap flips it on" — if the HTTP process and the worker process both run the
  same `main`-style file, gate by something that varies per-PROCESS-TYPE (e.g. Railway's own
  `RAILWAY_SERVICE_NAME`, checked against the specific worker service's name), not by an env var
  that could legitimately be set the same way across replicas of the wrong process.

### L41 — A `railway.toml` `[[services]]` block declares intent; it does not provision the service, and does not guarantee the deployed service actually runs the command it names

- Symptom: adding a second `[[services]]` array entry (`name = "operation-service-worker"`,
  `command = "npm run start:worker"`) to `operation-service/railway.toml` and pushing it to
  `origin/main` did nothing observable — `railway service list` still showed the same 6
  pre-existing services with no new one. Once a real service WAS separately created (through
  Railway's own service-creation flow, outside this config file), its first deployment ran `node
dist/main` (the plain `npm start` script) instead of the `start:worker` script named in
  `railway.toml` — the config file's command wasn't actually wired to that service's real deploy
  settings until fixed.
- Root cause: `railway.toml`'s `[[services]]` array is a declarative description Railway CAN apply
  to a service once one exists and is linked to that block — it is not, by itself, a
  provisioning trigger. Creating the actual service (a name, a deployment, a start command binding)
  is a separate action from writing the config file, and nothing in this repo's tooling makes that
  gap visible short of directly querying Railway's own service list.
- Rule: after any `railway.toml` edit that adds or changes a service definition, verify against
  `railway service list` (or `railway status`) — not just `git log`/the file's own content — that
  the named service actually exists, AND pull its live boot logs to confirm the command it's
  actually running matches what the config file says, before treating the config change as having
  taken effect. A clean `git push` and a healthy-looking `/health` 200 from a DIFFERENT,
  already-existing service in the same project proves nothing about a newly-declared one.
- Source: Session 4B-3 (2026-08-01) · Status: ACTIVE

### L42 — Express 5 / path-to-regexp v8 removed the bare `'*'` wildcard for catch-all routes and middleware

- Symptom: the obvious pattern for "match every route" — `consumer.apply(Middleware).forRoutes('*')`
  (or a raw Express `app.use('*', ...)`/`app.all('*', ...)`) — throws at construction time in this
  repo's real installed versions: calling the actual installed `pathToRegexp('*')` directly threw
  `"Missing parameter name at index 1: *"`, confirmed empirically before it could break anything.
- Root cause: `express@5.2.1` (both `operation-service` and `money-service`'s real installed
  version) depends on `path-to-regexp@8.4.2`, which removed the old bare-wildcard/`(.*)` syntax
  entirely (a breaking change carried since path-to-regexp v6). Neither service had any prior
  middleware/catch-all route registration to reveal this — first `forRoutes()`-style call in
  either service's history, so nothing in the existing codebase warned about it.
- Rule: for any Nest `MiddlewareConsumer.forRoutes()` (or raw Express route) that needs to match
  every path in this repo, use `'/{*splat}'` — verified empirically (via a standalone
  `pathToRegexp()` call against the real installed package) to match every path including bare
  `/`. Never assume the old bare `'*'`/`'(.*)'` syntax still works from memory or older
  Express/Nest documentation/tutorials — test the actual pattern against the real installed
  `path-to-regexp` (or just use `'/{*splat}'` directly) before relying on it.
- Source: Session 4B-4 (2026-08-01) · Status: ACTIVE

### L43 — NestJS `@Post()` defaults to `201`; a ported SOURCE route that returns `200` needs explicit `@HttpCode(200)`, and a controller-construction unit test can never catch the mismatch

- Symptom: `POST /notifications` (mark-all-read) and `POST /notifications/:id/read` (mark-one-read) both shipped to production returning `201 Created` — the ported monolith SOURCE (`app/api/notifications/route.ts` and `[id]/read/route.ts`) both return `200` via a bare `NextResponse.json(...)` with no explicit status. Found only via operation-service's real Railway HTTP access logs during the cutover's own live smoke test; the client-side response BODY looked identical either way, so nothing about the visible result signaled a problem.
- Root cause: NestJS assigns `201` as the default HTTP status for any `@Post()` handler (every other verb defaults to `200`) unless overridden with `@HttpCode()`. A PORT session's "preserve exact response structures" instinct checks the JSON body against SOURCE; nothing prompts a check of the per-verb default status against SOURCE's own implicit-200 behavior. Worse: every unit test written for the new controller (`new NotificationsController(mockService)`, called directly) never touches Nest's real HTTP pipeline at all — `@HttpCode()` resolution only happens when a real `INestApplication` handles a real HTTP request, so this class of bug is invisible to that entire test style.
- Rule: for any PORT session moving a POST-based mutating endpoint from a Next.js route (implicitly `200` via `NextResponse.json()`) to a NestJS `@Post()` handler, add `@HttpCode(200)` explicitly unless SOURCE genuinely returns `201`. Verify the REAL status via an e2e spec (`Test.createTestingModule` + `supertest` against a live Nest app, same pattern as `all-exceptions.filter.e2e.spec.ts`) — a controller-construction unit test proves the response body, never the status code Nest actually assigns.
- Source: Session 4B-9 (2026-08-02), found live via Railway HTTP logs during the cutover's own smoke test, fixed same-session · Status: ACTIVE

### L44 — Never `taskkill` by image name for test processes

- Symptom: A single test process spawned for verification caused a blanket kill of every Node process on the machine.
- Root cause: `taskkill //IM node.exe` is not scoped to the spawned PID.
- Rule: Capture and kill the specific PID, or avoid spawning a background process by using in-memory test harnesses instead.
- Source: Session 4B-4 · Status: ACTIVE

### L45 — Always manually sync `operation-service/packages/types`

- Symptom: `operation-service`'s `tsc` failed despite root `packages/types` building clean.
- Root cause: `operation-service` has an embedded, git-tracked copy of types without an automated sync mechanism.
- Rule: Any change to `packages/types` must sync to the embedded copy. The root build succeeding proves nothing.
- Detect early: Run `tsc --noEmit` inside `operation-service`.
- Source: Session 4B-5 · Status: ACTIVE

### L46 — Never trust a background verification result if edits happened in flight

- Symptom: Background `tsc --noEmit` gave a false "clean" result for a commit with TS errors.
- Root cause: `tsc` scans the whole program; an in-flight edit invalidated the check's result.
- Rule: Re-run verifications fresh, with nothing in flight, immediately before committing.
- Source: Session 4B-6 · Status: ACTIVE

### L47 — Railway logs are unreliable for freshness or absence of output

- Symptom: `railway logs` returned stale output or nothing at all for failed/successful builds.
- Root cause: Railway CLI caches logs and `--latest` behaves inconsistently across build states.
- Rule: Always pair `--http` with `-n`/`--lines`. Use `--latest --build` for failed builds. For success, a direct HTTP/protocol check is more reliable than reading logs.
- Source: Sessions 4B-8, 4B-17 (Extends L38) · Status: ACTIVE

### L48 — Verify headers like `user-agent` propagate in forwarders

- Symptom: Monolith-to-operation-service forwarders dropped `user-agent` and `x-forwarded-for`.
- Root cause: Forwarders did not wire `forwardedRequestContext()` by default.
- Rule: Before porting routes reading device headers, verify forwarders propagate them via live smoke test.
- Source: Session 4B-11 · Status: ACTIVE

### L49 — Spot-check real DB schema after Prisma baseline

- Symptom: `applied_steps_count: 0` but zero error, table wasn't actually created.
- Root cause: A migration-history baseline can mark a migration finished without executing its DDL.
- Rule: After any baseline, spot-check the schema change is in the real database (e.g., `to_regclass()`).
- Source: Session 4B-12 · Status: ACTIVE

### L50 — Verify cross-origin connections with a real browser, not non-browser clients

- Symptom: CORS `['*']` array blocked browsers but passed curl Engine.IO tests. CSP `connect-src` blocked it entirely.
- Root cause: Non-browser clients do not enforce CORS or CSP. CORS and CSP are two separate gates.
- Rule: A real browser is the only way to prove a cross-origin browser-initiated connection works.
- Source: Sessions 4B-18, 4B-18b · Status: ACTIVE

### L51 — Validate WebSocket health via DevTools WS filter and diff log timestamps

- Symptom: Resource Timing API falsely reported zero activity, while repeated success logs masked a reconnect loop.
- Root cause: Resource Timing misses native WS handshakes; single log lines don't prove connection stability.
- Rule: Use DevTools Network WS filter to confirm handshakes. Diff timestamps of repeated success logs to detect loops.
- Source: Session 4B-18c · Status: ACTIVE
- Recurrence (Session 4B-18d): DevTools does NOT retroactively show a WS connection that was already open before the Network panel started recording — a reload (with "Preserve log" checked) is required to capture the handshake and Messages tab for an existing connection.

### L52 — NestJS's `OnGatewayDisconnect` dispatch discards every socket.io disconnect argument except the client; widening `handleDisconnect`'s signature cannot recover the reason

- Symptom: needed the real Socket.IO disconnect `reason` string (`"ping timeout"`, `"transport close"`, etc.) for a live investigation; assumed `handleDisconnect(client, reason)` would work.
- Root cause: read the installed `@nestjs/websockets` source directly — `web-sockets-controller.js`'s `getConnectionHandler` feeds `handleDisconnect` via a bare RxJS `Subject<Socket>`, calling `.next(client)` only. No NestJS-provided path carries additional event args through to this lifecycle hook, for socket.io or `ws`.
- Rule: to capture a raw socket.io event argument NestJS's own gateway lifecycle doesn't expose (disconnect reason, or any multi-arg native event), attach a listener directly on the raw client inside `handleConnection` (`client.on('disconnect', (reason) => ...)`) — Socket.IO's own documented pattern — rather than trying to widen a Nest lifecycle hook's signature.
- Source: Session 4B-18d (2026-08-03), `DECISION-LOG.md` F55 · Status: ACTIVE

### L53 — `railway run` executes locally; Railway's internal `*.railway.internal` hostnames (`REDIS_URL`, etc.) only resolve from inside Railway's own network — use the resource's own `*_PUBLIC_URL` variable instead

- Symptom: `railway run --service operation-service node script.js` (using `process.env.REDIS_URL`) failed with `ENOTFOUND redis.railway.internal` — the injected env var's hostname is only DNS-resolvable from a container actually running on Railway.
- Root cause: `railway run` injects a service's real production env vars into a LOCAL process; it does not proxy or tunnel network access into Railway's private network. Same class as `DATABASE_URL` vs `DATABASE_PUBLIC_URL` (L19), but for Redis, and not yet documented for it.
- Rule: when scripting against a Railway resource from a local `railway run` process, use `railway run --service <the-resource-itself>` (not the consuming app service) and its own `*_PUBLIC_URL` variable (e.g., `REDIS_PUBLIC_URL` on the `Redis` service) — never the internal-hostname variable the app services reference via `${{Redis.REDIS_URL}}`.
- Source: Session 4B-18d (2026-08-03) · Status: ACTIVE

### L54 — The plan's "143 BACKEND files" is a `lib/*` service-layer census, not an `app/api/**` route census — the two exit criteria are about different file sets

- Symptom: at Phase 4 exit review, it was tempting to walk `app/api/**/route.ts` files against the "143 BACKEND files" figure directly — they don't correspond. `migration-stack-analysis.md`'s own 72 CORE + 71 BUSINESS FUNCTION appendix lists almost entirely `lib/*`/`__tests__/*` files; zero `app/api/**/route.ts` entries appear anywhere in it.
- Root cause: the plan's own readiness notes say it explicitly ("`FRONTEND (320 files)`... `app/api/**/route.ts` routes will need to become Railway API calls... as each BACKEND module migrates") — route files are tracked separately (the cutover table), not counted in the 143. Easy to miss without re-reading that specific paragraph.
- Rule: exit criterion 1 ("143 BACKEND files retired") is answered by checking `lib/*` file existence against the stack-analysis appendix; exit criterion 2 ("`app/api/**` reduced to intentional remainders") is answered by a separate route-file census against the cutover table and each slice's own close-out. Don't conflate the two when auditing either one.
- Source: Session 4B-22 (2026-08-04) · Status: ACTIVE

### L55 — Archiving a RESOLVED flag's full entry can silently carry still-OPEN flags out of `DECISION-LOG.md`'s main register table too

- Symptom: reviewing "every OPEN flag" for the Phase 4 exit review, `DECISION-LOG.md`'s own register table came up empty for F48-F52 — all 5 existed only in `history/decisions-archive.md` (2 RESOLVED, but F49/F50 genuinely still OPEN), only found by directly grepping the archive file after the table search came up empty.
- Root cause: the file's own hygiene rule says "after resolving a flag, move its full resolution entry to the archive" — but when a batch of flags (F48-F52) was archived together, the still-OPEN ones (F49, F50) went with them, dropping out of the one place ("register table + OPEN entries") a future session is told to check.
- Rule: when moving a resolved flag's full entry to `history/decisions-archive.md`, first re-verify every flag in that batch is actually RESOLVED — if any are still OPEN, they (and their register-table row) MUST stay in `DECISION-LOG.md`'s main body, archive entry or not.
- Source: Session 4B-22 (2026-08-04) · Status: ACTIVE

### L56 — A single-file-scoped `eslint --max-warnings 0` check at one session's close does not prove the FULL `validate:lint` scope stays clean later; dependency bumps between sessions can newly-flag files nobody touched

- Symptom: Session 4B-21 checked `eslint components/layout/header.tsx --max-warnings 0` (its own touched file) and got clean. Re-running the FULL scope (`eslint app components lib hooks --max-warnings 0`) at Session 6-1 found 3 warnings — `@next/next/no-location-assign-relative-destination` on that SAME `header.tsx` (unchanged since 4B-21) plus one pre-existing file from Dec 2025. Neither file was touched between the two checks.
- Root cause: `eslint-config-next` moved from whatever shipped at 4B-21's close to `16.3.0` in between — a dependency bump enabled/tightened a rule for files nobody edited. A file-scoped check only proves that ONE file was clean against THAT session's installed ruleset, not that the repo's real green bar (L20) stays clean going forward.
- Rule: when an order's entry criteria cite "`eslint --max-warnings 0` clean" as a prior baseline, always re-run the FULL scope (`app components lib hooks`) at CONFIRM, never trust a narrower single-file check from a past session as still valid — record the real current result even if it's worse than what's cited, per L20's own "record the real number" discipline. A regression found this way is not necessarily this session's fault; trace it to a dependency version change before assuming new code broke it.
- Source: Session 6-1 (2026-08-10) · Status: ACTIVE

### L57 — An "already-built-but-unused" component can carry a latent bug that's never been exercised in production; read its real implementation before wiring a real action into it, not just its prop signature

- Symptom: Session 6-1b's order named `components/billing/subscription-card.tsx` as ready to mount for `/settings/billing`'s real cancel action. Reading its implementation (not just its exported props) before wiring found a real bug: its optimistic-cancel "Undo" button only clears local React state — it never calls a reactivation API — while the real `onCancel()` has already been `await`ed and resolved by the time Undo is clickable. Wiring the real cancel endpoint into it as-is would have meant a user who clicks Cancel then Undo within its 5s window sees "still PRO" while the subscription was, in fact, already cancelled.
- Root cause: a component that's never been mounted anywhere has never had its interaction logic exercised against a real backend call, no matter how complete its code looks or how confidently an order describes it as "already built." Its own file existing and type-checking proves nothing about whether its own internal assumptions (here: that Undo can meaningfully cancel an in-flight or completed async action) are actually correct.
- Rule: before wiring a real, consequential action (money, auth, destructive writes) into any component an order describes as "already built, just mount it," read that component's own implementation in full — not just its prop signature — and trace what each of its interactive paths actually does end-to-end. A found defect in a shared, never-fixed-by-this-session component is a real finding to disclose and route around (keep the existing, working flow; register a flag for a future fix), not something to silently wire in or silently patch as a drive-by.
- Source: Session 6-1b (2026-08-10), `DECISION-LOG.md` F64 · Status: ACTIVE

### L58 — A backgrounded `npm run build` and a live `next dev` server share `node_modules/.prisma`; running both at once produces transient, misleading "module not found" errors that look like a real regression

- Symptom: mid-session, with `next dev` already serving requests, a backgrounded `npm run build` was kicked off to verify the whole app compiles. The live dev server's own logs immediately started showing `Module not found: Can't resolve '.prisma/non-market-client'` on unrelated routes (`/api/config/affiliate`, NextAuth) — looked exactly like a code regression from that session's own file moves.
- Root cause: this repo's `prebuild` script (`rimraf .next tsconfig.tsbuildinfo node_modules/.prisma && npm run prisma:generate:...`) deletes and regenerates the Prisma clients as its first step. A `next dev` server reading from `node_modules/.prisma` mid-request during that window sees the directory momentarily empty/mid-rewrite and throws — a pure timing artifact of two processes sharing one `node_modules`, not a code defect.
- Rule: never run `npm run build` (or anything invoking the `prebuild` script) while a `next dev` server from the same checkout is live. If a build-time and a dev-time check are both needed in one session, run them sequentially — stop the dev server first, or run the build in an isolated checkout/worktree. If this error appears while both are running concurrently, confirm the cause via `node_modules/.prisma`'s presence/timestamp and the build's own exit code before treating it as a regression.
- Source: Session 6-2 (2026-08-10) · Status: ACTIVE

### L59 — A `next/navigation` `useRouter()` test mock must return a stable object reference, not a fresh literal per call, whenever the component under test puts `router` in a memoized hook's dependency array

- Symptom: `notification-list.tsx`'s `fetchNotifications` is a `useCallback` with `router` in its dependency array (needed to redirect on a 401). The test's `jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))` returned a NEW object literal on every call — since Next's real `useRouter()` is memoized/stable across renders but the mock wasn't, every re-render produced a new `router` reference, which recomputed `fetchNotifications`, which re-fired its own mount-effect, which re-rendered — a genuine re-fetch storm inside the test (33 spurious `fetch` calls from one simulated tab click) that has nothing to do with the app's real behavior.
- Root cause: an unstable mock for a value the real implementation guarantees stable (`useRouter()`, `useSession()`, any context-backed hook) can manufacture an infinite-ish render loop in ANY component that puts that value in a `useCallback`/`useEffect`/`useMemo` dependency array — the bug is invisible by reading the component's own source, since the real app never exhibits it.
- Rule: when mocking `next/navigation`'s `useRouter` (or any hook Next/React itself memoizes), return a SINGLE stable object created once outside the mock factory (`const mockRouter = { push: mockPush }; jest.mock(..., () => ({ useRouter: () => mockRouter }))`), never a fresh literal per call. Before trusting a component test with unexpectedly high fetch/render counts, check whether any mocked hook's return value is memoized in the mock the way it is in production.
- Source: Session 6-4 (2026-08-10) — `edit.test.tsx` uses the same unstable-per-call mock shape and would hit the identical bug if that component's own effects ever grow a `router`-dependent `useCallback`; worth a follow-up check when that file is next touched. · Status: ACTIVE
- Recurrence: Session 6-8 (2026-08-11) — hit again writing `checkout-return.test.tsx`/`upgrade-success.test.tsx` (fresh `{ push: mockPush }` object per `useRouter()`/`useSearchParams()` call); caught before commit, fixed with the same hoisted-stable-object pattern.

### L60 — `middleware.ts`'s matcher and `app/(dashboard)/layout.tsx`'s own `getServerSession`+`redirect` are two INDEPENDENT auth gates; bypassing one alone does not make a page public

- Symptom: built two new pages meant to be reachable without a session (a public, token-based email-link flow) at `app/(dashboard)/settings/account/delete/{confirm,cancel}/page.tsx`, and added an exact-pathname allow-list to `middleware.ts` for both paths. Live, unauthenticated browser verification still showed both pages redirecting to `/login` — the middleware fix alone did nothing to stop the redirect.
- Root cause: `app/(dashboard)/layout.tsx` performs its own server-side `getServerSession()`+`redirect('/login')` on every page it wraps, entirely independent of `middleware.ts` — it exists specifically as defense-in-depth (per its own doc comment) and does not consult the middleware's decision at all. Any page file physically placed inside that route group inherits this gate regardless of URL, matcher, or an edge-level allow-list.
- Rule: to make a page genuinely public while it lives at a URL prefix an auth-gated route group's layout would otherwise wrap, the page file must be moved OUT of that route group entirely (a sibling route group with no auth-gated `layout.tsx` — Next.js route groups are transparent to the URL, so the path is unaffected) — a middleware allow-list is necessary but never sufficient on its own for a route group with its own server-side auth check in `layout.tsx`. Verify with a real unauthenticated browser request after ANY change meant to make a page public, not just a code read of `middleware.ts` — the two gates fail independently and a fix to one can look complete while the other still blocks everything.
- Source: Session 6-5 (2026-08-11) · Status: ACTIVE

### L61 — Duplicated business logic between the monolith and a microservice can silently drift out of sync; fixing one copy doesn't propagate to the other

- Symptom: money-service's `disbursement.constants.ts`/`provider-factory.ts` gained `WISE` support at Session 4A-W6/4A-W7 (2026-07-27); the monolith's separate, hand-maintained copy at `lib/disbursement/constants.ts`/`providers/provider-factory.ts` never did — `isProviderAvailable('WISE')` always returned `false` there, undetected across ~2 weeks and many intervening sessions, only surfaced when Session 6-6's admin config UI needed to read it from the monolith side.
- Root cause: this migration has, in several places, two independently maintained copies of the same business logic (one in the monolith, one in a microservice) rather than one shared source — nothing enforces the two staying in sync, and a session that fixes one side has no natural trigger to check whether a sibling copy exists and needs the identical fix.
- Rule: whenever a session ports or duplicates logic between the monolith and a microservice (provider factories, config constants, status enums, etc.), grep for a sibling copy of the SAME logic in the other codebase before assuming a one-sided fix is complete — and when building anything on one side that reads such logic, don't assume the other side's already-fixed state has propagated; verify the copy you're actually touching directly.
- Source: Session 6-6 (2026-08-11) · Status: ACTIVE

### L62 — A UI test that mocks a field name the real Prisma model doesn't have will never catch the crash that field name causes in production

- Symptom: `app/affiliate/dashboard/commissions/page.tsx` and `components/affiliate/commission-table.tsx` both read `commission.amount` and called `.amount.toFixed(2)` directly — the real Prisma field is `commissionAmount` (a Decimal, arriving as a string over JSON). Every real commission row would throw `TypeError: Cannot read properties of undefined (reading 'toFixed')` the instant it rendered — a live, unconditional crash for any affiliate with at least one real commission. Undetected because `commission-table.test.tsx`'s own mock data used `amount: 4.64`, matching the component's fictional field name instead of the real API shape.
- Root cause: nothing in this codebase's test suite ever exercised the real `GET /api/affiliate/dashboard/commission-report` response shape against this page — the mock and the component were internally consistent with each other and both wrong relative to the real Prisma model.
- Rule: when a component's own test mocks a field name, cross-check that name against the real Prisma model (or the actual route handler's response, not the frontend's own `interface` declaration) before trusting the test as proof the field exists — an `interface` in the frontend is a claim, not a source of truth; Prisma `Decimal` fields also serialize as strings over JSON, not numbers, so arithmetic call sites need `Number(...)` regardless of the field-name fix.
- Source: Session 6-7 (2026-08-11) · Status: ACTIVE

### L63 — Once a monolith write route forwards to a cut-over microservice, its own downstream logic (URL construction, response shaping, etc.) becomes dead code; editing only the monolith copy has zero live effect

- Symptom: `app/api/checkout/route.ts`'s `successUrl` construction (`/dashboard?upgrade=success`) looked like the file to fix for Session 6-8's new `/upgrade/success` landing page — but `MIGRATE_WRITE_APIS_MONEY_STRIPE` has been `true` in production since Session 4A-10b, so this route forwards the entire request to money-service's `stripe-checkout.controller.ts` before that line is ever reached. Editing only the monolith file would have shipped a fix with zero effect on what real users see.
- Root cause: a monolith write route's own flag-forwarding shim (built at the transport-layer BUILD session, e.g. 4A-10a) makes everything past the flag check in that same handler unreachable for real traffic once the cutover flag is flipped — but the code still compiles, still passes local tests (which exercise the flag-off branch), and still reads like the live implementation to anyone reading the file in isolation.
- Rule: before editing a monolith route file's own business logic (not just its flag check), grep for a `shouldUseMoneyServiceFor*()`/`shouldUseOperationServiceFor*()` guard earlier in the same handler and check `migration-cutover-table.md`/CLAUDE.md's own cutover state for that specific slice — if the flag is live, mirror the change into the microservice's own copy (or make it there instead) or it will have no real-world effect. Distinct from L61 (drift between two independently maintained copies): here one copy isn't just out of sync, it's structurally unreachable.
- Source: Session 6-8 (2026-08-11) · Status: ACTIVE

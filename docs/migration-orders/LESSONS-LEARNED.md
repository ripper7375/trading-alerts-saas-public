# LESSONS-LEARNED.md — Skill Memory (rules distilled from failures)

**What this is:** the seventh memory file — reflexes. Where Deviations record _what happened once_ and the Decision Log records _what was chosen_, this file records **rules extracted from failures** so the same mistake is never debugged twice.

**Who writes:** the Executor, at session close. Write the RULE, not the story — one entry, ≤6 lines.
**Who reads:** the Executor, at every session OPEN.
**Hard cap ~40 active lessons.** (Consolidated by Advisor on 2026-07-22. Full history moved to `LESSONS-ARCHIVE.md`).

**Past cap as of Session 4B-4's close (L1-L42) — a consolidation pass is now genuinely overdue,
not just flagged.** Session 4B-3 hit FOUR existing lessons as live recurrences in a single
session (L11, L17, L38, L40 — see their own recurrence notes below) at unusually high volume (8
independent CONFIRM cycles), plus one genuinely new pattern (L41, added below at Davin's explicit
direction to harvest despite the cap). Session 4B-4 added one more genuinely new pattern (L42,
below, at Davin's explicit direction to harvest despite the cap). The still-unpromoted candidate
from 4B-2's close (never fabricate a shadow/mirror-run's start or end timestamp — check whether
the underlying work actually happened first; `DECISION-LOG.md` F51 / `CLAUDE.md` Waiting-on #75
and #84, 2nd occurrence) remains a candidate, not promoted — 4B-3/4B-4 did NOT hit this pattern
again, so it isn't re-flagged as a fresh recurrence, but it and this cap overrun are both worth
the Advisor's attention at the next consolidation pass.

**One more candidate from Session 4B-4's close (2026-08-01), not promoted (no explicit direction
to exceed the cap for this one), described here for the next consolidation pass:** a live-boot
verification step used `taskkill //F //IM node.exe //T` to clean up a single spawned test
process — a blanket kill of every Node process on the machine, not scoped to the one PID actually
spawned. Caught and disclosed immediately, not repeated (switched to foreground-only `node -e`
scripts and `Test.createTestingModule` + `supertest`'s in-memory server for the rest of the
session, neither of which needs any manual process spawn/cleanup at all) — worth a rule along the
lines of "never `taskkill`/`pkill` by image name to clean up a test process you spawned; capture
and kill the specific PID, or better, avoid spawning a real background process for verification
when an in-memory test harness can prove the same thing." Full detail in
`4b-4-shared-infra-observability.migration-order.md`'s own Deviations (#11).

**One more candidate from Session 4B-5's close (2026-08-01), not promoted, described here for the
next consolidation pass:** `operation-service` does not consume the root `packages/types` package
at all — it has its own separately embedded, git-tracked copy at `operation-service/packages/types/`
(commit `87242f09`, created to solve the Railway single-directory-upload packaging risk, since
`operation-service` has no connected GitHub source, L38/CLAUDE.md Waiting-on #77/#79/#80). This
session hoisted new exports into the root package and only discovered the embedded copy was stale
when `tsc --noEmit` failed with "has no exported member" despite the root package building clean —
nothing about the root package's own build success signals whether `operation-service`'s embedded
copy is in sync. No automated sync mechanism exists between the two copies. Worth a rule along the
lines of "any change to `packages/types` must also sync (or verify already-synced)
`operation-service/packages/types`, and `operation-service`'s own `tsc --noEmit` is the check that
actually catches drift — the root package's own `npm run build` succeeding proves nothing about the
embedded copy." Full detail in `4b-5-alerts-crud-port.migration-order.md`'s own Deviations (#4).

**One more candidate from Session 4B-6's close (2026-08-01), not promoted, described here for the
next consolidation pass:** a background `tsc --noEmit` verification run gave a false "clean" (exit 0) result for a commit (`02917e9e`) that genuinely had 4 real `TS2322` errors, because an edit to a
file inside the check's scan scope landed while that check (or an earlier one) was still running —
`tsc --noEmit` scans the whole program on every invocation, not just a commit's staged files, so an
in-flight edit anywhere in the tree can invalidate a background check's result even if the edit
looks unrelated to the step actually being verified. Caught one step later by a fresh,
uncontaminated run with zero edits in flight; independently reproduced by stashing the fix and
re-running `tsc --noEmit` directly against the suspect commit alone. Fixed in the very next commit,
same session — no broken code reached `origin/main`. Worth a rule along the lines of "never trust a
background `tsc`/build/test verification result if any file edit happened anywhere in the repo
after that check was launched — re-run fresh, with nothing in flight, immediately before committing
on the strength of it." Full detail in
`4b-6-alerts-crud-write-transport.migration-order.md`'s own Deviations (#8) and `CLAUDE.md`
Waiting-on #88.

**One more candidate from Session 4B-8's close (2026-08-01), not promoted, described here for the
next consolidation pass:** the plain, unflagged `railway logs --service <svc>` command silently
returned output frozen more than 8 hours in the past (verified by comparing its last timestamp
against the real current time) — the same general "don't trust a Railway log command's freshness
at face value" class as Session 4B-7's own `railway logs --build` stale-cache incident (L38's own
recurrence note), but a NEW manifestation: this time the plain deploy-log stream itself was stale,
not just `--build`. Switching to `railway logs --http --path /drawings --since 2h` didn't fix it
either — that returned nothing at all, a false negative. The combination that actually worked was
`railway logs --http -n 20 --since 2h` (or any invocation pairing `--http`/`--since` with
`-n`/`--lines`) — omitting `-n` silently returns empty even when matching entries exist. Worth a
rule along the lines of "never trust a `railway logs` invocation's absence of output, or its most
recent timestamp, as proof of anything — always pair `--http` with an explicit `-n`/`--lines`
count, and sanity-check the returned timestamp range against the real current time before treating
a log query as authoritative." Full detail in
`4b-8-drawings-port-and-cutover.migration-order.md`'s own Deviations (#4).

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
- Recurrence (Session 4B-2): same shape again — only the PRE-DRAFT (`Status: PRE-DRAFT`) was ever committed; the working copy was fully rewritten to `Status: APPROVED` with no DRAFT→APPROVED commit trail, and the rewrite silently DROPPED a whole entry criterion the PRE-DRAFT had explicitly carried forward (the Waiting-on #79 Railway-packaging-risk item) rather than just drifting a status field or a line count. Resolved by reporting the full CONFIRM findings (including the dropped criterion) before execution and asking directly; confirmed as Davin's/the Advisor's own authentic edit, the dropped criterion was re-added, and explicit clearance to execute was given in chat. (9th occurrence — the "silently drops real content, not just metadata" variant first seen at 4A-W3b keeps recurring; still worth the Advisor's attention.)
- Recurrence (Session 4B-3): same shape, most severe yet — the committed version was an unusually
  HONEST PRE-DRAFT (explicitly listing every entry criterion as "NOT MET" and stating "there is no
  clock to report an end time for"), and the uncommitted working copy didn't just flip the status
  field — it deleted every one of those honest caveats wholesale while rewriting the entire
  document. Resolved the same way as every prior occurrence: reported the discrepancy directly
  rather than trusting or silently correcting it, then verified the underlying facts (deploy
  status, flag existence, live logs) independently regardless of which version of the text was
  "correct" — which is what actually caught the 7 further real gaps this session's own Deviations
  document. (10th occurrence — worth the Advisor's attention on whether order files should ever be
  edited as an in-place working-copy rewrite at all, versus only via a reviewable diff.)

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
- Recurrence (Session 4A-W6): five more mismatches in a single order — a wrong SLA default (24h vs.
  design's 72h), an invented interface shape in File 1's own prose (design §3.3's real
  `FundableProvider` has completely different members), a quote-direction example that predated and
  was superseded by a LATER binding decision (F38) recorded in a different document
  (`DECISION-LOG.md`) than the one the order cited, an undercounted REST endpoint surface (3 vs. the
  frozen OpenAPI's real 7), and two file-location disagreements with design §8's own module-layout
  table. The F38 case is new: ground truth itself can be split across documents that disagree with
  each other by DATE, not just an order paraphrasing one document imperfectly — the more recently
  dated source (here, `DECISION-LOG.md`) wins, but only re-reading BOTH and checking dates catches
  it. A sixth surfaced at session close, at Davin's explicit request: design §10's own testing
  strategy named an unhappy-path scenario (`bounced_back` → `funds_refunded`, recipient →
  `INVALID`) for this exact session that neither the order's File 8 test list nor its Done-when
  carried forward — building the test against it late also surfaced that the "recipient →
  `INVALID`" half was never actually implemented in code at all (see this order's own Deviations).
- Recurrence (Session 4A-8): a new shape of the same class, at the file-existence/module-ownership
  level rather than a descriptive detail. Two separate instances in one order: (1) the DRAFT's own
  Step 1 named `money-service/src/stripe/stripe-checkout.controller.ts` and
  `money-service/src/dlocal/dlocal-payment.controller.ts` — neither exists; the real audited gaps
  (4A-W4's own citations) are monolith Next.js routes, since money-service has no write endpoints
  until 4A-9. (2) Step 2's file list named only `money-service/prisma/schema.prisma` for the new
  `OutboxEvent` model, omitting that a genuinely-new money-service-owned table still needs the
  monolith-side mirror + real migration (L1: money-service has no migration authority of its own)
  — the exact two-schema process 4A-W2 already established, just not cited here. Both were caught
  by cross-checking the order's own cited ground truth (`migration-cutover-table.md`'s Slice 4
  row; L1 itself) rather than trusting the file list as accurate, before writing any code against
  it — re-scoped live (Step 1, before CONFIRM) or escalated live (Step 2's production migration,
  mid-session) rather than silently building against nonexistent files.

- Recurrence (Session 4A-9): the most severe form yet — an order omitted an entire dependency
  FILE from its SOURCE list, not just a detail within a cited file. File 4/10's SOURCE named only
  `app/api/webhooks/stripe/route.ts` (a thin dispatcher); ALL real business logic (tier upgrade,
  subscription upsert, affiliate commission crediting, 5 email triggers) lives in
  `lib/stripe/webhook-handlers.ts` (592 lines), never mentioned anywhere in the order. File 6/10
  had the same shape at smaller scale: `app/api/payments/dlocal/create/route.ts` directly imports
  `lib/dlocal/currency-converter.service.ts` and `payment-methods.service.ts`, neither cited. Both
  found by actually reading the SOURCE file's own import statements before writing any target
  code, not by trusting the order's file list as complete. Rule extension: for any PORT order
  targeting a Next.js API route, read the route's own imports first — thin route handlers commonly
  delegate real logic to sibling `lib/` files an order's file-count summary can silently omit.
- Recurrence (Session 4A-11): smaller-scale, on a NEW-glue file rather than a PORT — the order's own
  File 3 text cited `POST /v1/outbox/events` and a `wise-webhook.controller.ts` convention reference,
  assuming money-service's global `/v1` prefix applies to operation-service too. Reading
  `operation-service/src/main.ts` (no `setGlobalPrefix`) and every existing controller there showed
  it has no `/v1` prefix at all; separately, the cited convention itself actually lives in a sibling
  `queue/wise-webhook.processor.ts` file, not the controller named. Both caught by reading the real
  target service's own conventions before wiring a route, not by trusting a cross-service citation —
  the order had already hedged this exact spot ("verify exact line at build time"), which is why it
  got checked instead of assumed.

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

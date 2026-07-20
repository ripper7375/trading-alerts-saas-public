# Migration Order — Prisma 6.19.2 → 7.8.0 Upgrade (in isolation)

> `TEMPLATE-UPGRADE.md` variant. Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Medium** — how breakages get fixed is the Executor's call; "no
> behavior change, no metric regression" is not. One variable at a time: this session
> upgrades Prisma ONLY — no schema split (that's Session 2-2/F4/F5), no model changes.
> **Status: EXECUTED** — all 5 ordered steps complete, all Done-when items checked.
> Production confirmed on `prisma@7.8.0` (commit `1b5a3436`), live runtime logs clean.
> 2026-07-20.

**Session:** 2-1 · **Phase:** Phase 2 (`non_market_data` Prisma Schema, Workstream 6) ·
**Variant:** UPGRADE · **Generated:** 2026-07-19 · **Flags touched:** F19 (full audit,
currently OPEN — this session closes it) · **Estimated time:** unestimated (F12 open;
first Phase 2 session, no prior data point).
**From → To:** `prisma` + `@prisma/client`: `^6.19.2` → `7.8.0` (root `package.json` ONLY.
`railway-gateway/package.json` is EXPLICITLY DECOUPLED and remains on `6.19.2` due to NestJS CJS/ESM incompatibility. The `railway-gateway` service was never deployed per the Option A pivot).

## Context carried over from Session 1-4 / Phase 1 close

- **Phase 1 is not formally exit-clean.** F18's automated-backup-cadence gap is still
  open (dashboard-only, unverifiable via this CLI — re-confirmed at Session 1-4's
  close). This is **not a blocker for this session**: it's an operational
  risk-acceptance question for Davin about the existing Postgres instance, unrelated to
  Prisma's client-side version. Flagging so this session doesn't have to rediscover
  that reasoning, not asking it to resolve F18.
- **F19's npm-check portion was already resolved at Session 0-1** (`DECISION-LOG.md`):
  `prisma@7.8.0` confirmed to exist on the registry; the real jump is 6.19.2 → 7.8.0,
  ONE major version, not the "5→6→7" the plan's prose originally assumed. This session
  is the full breaking-change audit that npm-check explicitly deferred — read that
  Decision Log entry first so the audit doesn't re-litigate the version-count question.
- **F20 (production migration history unbaselined, destructive pending
  `drop_watchlists` migration) is still OPEN**, unrelated to this session's scope but
  sharing the same database. This session's own "Done when" (below) explicitly forbids
  running `migrate deploy` in a way that would trigger F20 — re-read
  `LESSONS-LEARNED.md` L16 (always `migrate status` before `migrate deploy` against an
  unfamiliar production DB) before touching the migration CLI at all this session.
- **L3** (migrations run on the DIRECT url; runtime goes through PgBouncer) is now a
  live, deployed fact, not a future concern — Phase 1's PgBouncer is up. Any staging/
  production verification this session does through the app must use the pooled URL for
  runtime and the direct URL for `prisma migrate`/`generate`, per that lesson.
- **Staging still doesn't exist** (`railway environment list --json`, re-confirmed
  unchanged through Sessions 1-3/1-3b/1-4: only `production`). If this session needs a
  staging deploy per its own step 5 and staging still isn't provisioned by the time it
  runs, that's the same escalation 1-3/1-3b made — get Davin's explicit waiver again
  (per-session, not standing) or treat "provision staging" as this session's own
  prerequisite deviation.

## Entry criteria

- [x] Official Prisma 6→7 upgrade/breaking-change guide(s) fetched and read (list URLs
      consulted in Deviations).
- [x] Baselines recorded before touching anything: `npm run type-check` clean,
      `npm run test:ci` suite/test counts (compare against Session 1-4's 111/111 suites,
      2046/2046 tests — if these numbers have drifted by the time this session runs,
      that's this session's OWN new baseline, not a discrepancy to explain away).
- [x] Blast-radius statement: Prisma's `@prisma/client` is imported throughout
      `app/api/**`, `lib/**`, and `railway-gateway/` (if it ever ships) — re-verify the
      real current count at CONFIRM (`grep -rl "@prisma/client" --include=*.ts` or
      equivalent) rather than trusting this estimate.
- [x] `money_svc`/`core_app` roles and PgBouncer (Phase 1) still live and enforcing —
      quick re-check only (`railway status`), not a full re-run of Session 1-4's smoke
      test; this session doesn't touch grants.

## Ordered steps

1. **Audit (F19):** fetch and read Prisma's official 6→7 upgrade guide + changelog; enumerate
   every breaking change against THIS codebase specifically — client output location/
   ESM changes, `previewFeatures` flags currently set in `schema.prisma`, PgBouncer/
   `directUrl` connection semantics (re-verify Phase 1.4's setup still matches whatever
   7.x expects), any `$use`/middleware usage, Decimal/JSON typing changes, Node version
   minimum. Write the hit-list with file paths and line numbers.
   _Verify:_ **STOP and present the hit-list to Davin; absolutely no code edits before he sees and approves it.**
2. **Bump:** update `prisma`/`@prisma/client` to exactly `7.8.0` in both root and
   `railway-gateway/package.json`; regenerate the Prisma Client; lockfile updated.
   _Verify:_ `prisma generate` succeeds with no warnings beyond expected deprecation
   notices.
3. **Codemods/fixes:** apply Prisma's official codemods first; manual fixes second, each
   one referencing its hit-list entry from step 1. **No schema changes** — this is a
   client-version bump only, the model census/split is Session 2-2's job.
   _Verify:_ `npm run type-check` clean.
4. **Parity:** full `npm run test:ci` vs Session 1-4's baseline (111 suites / 2046
   tests) — any count drift is a finding, not noise; explain it before proceeding.
   _Verify:_ suite/test counts match or every delta is explained.
5. **Staged rollout:** staging deploy → smoke test → production deploy. **Davin
   approves the production deploy explicitly** (`EXECUTOR-PROTOCOL.md` §7 — production
   deploys always escalate). If staging genuinely doesn't exist by the time this session
   runs, stop at this step and get Davin's explicit scoping decision (waive to
   production-only like 1-3/1-3b did, or hold for staging provisioning) rather than
   assuming either path.

## Rules specific to this variant

- Fix forward within the session or roll back fully — never leave a half-upgraded
  state EXCEPT for `railway-gateway`, which is explicitly authorized to remain on `6.19.2` due to NestJS ESM incompatibility.
- A test that fails after the bump is a finding, not an obstacle (`LESSONS-LEARNED.md`
  L4's sibling rule for upgrades): understand WHY before touching the test's assertion.
- Peer-dependency bumps ride along only if `7.8.0` actually requires them — list each
  with its reason in Deviations, don't bundle unrelated dependency bumps.
- **No `prisma migrate deploy` against production** unless F20 has been resolved
  (baselined) first — this session's scope is the client library version, not the
  migration history. If the audit reveals 7.x needs a migration for some client-side
  reason, stop and treat that as a NEW finding requiring its own session/escalation, not
  something to fold into this one.

## Done when

- [x] Production on `prisma@7.8.0`/`@prisma/client@7.8.0` (root only, `railway-gateway` left on `6.19.2`).
      **CONFIRMED** — Davin verified commit `1b5a3436` built and deployed successfully
      on Vercel; live runtime logs clean (no `P1010`/SSL errors, no connection timeouts).
- [x] Full test suite green, count parity (or explained deltas) vs Session 1-4's
      111/111 suites, 2046/2046 tests baseline.
- [x] Audit + hit-list + resolution committed; F19 marked fully RESOLVED in
      `DECISION-LOG.md` (closing the "full audit due Session 2-1" note from Session 0-1).
- [x] `prisma migrate status` still resolves cleanly via `DIRECT_URL` post-upgrade
      (F20 unchanged, not resolved by this session — just confirm the upgrade didn't
      somehow disturb it).

## Rollback

Revert the version bump commit + lockfile restore + previous deploy re-promoted on
Vercel/Railway. State explicitly before starting production deploy: does 7.8.0's
`prisma generate` output location or client API change in a way that a simple revert
wouldn't cleanly undo (e.g. a generated-client path baked into a deployed build)? If so,
document the exact re-deploy sequence needed, not just "git revert."

## Deviations

- **Step 1 audit completed 2026-07-20.** Guide fetched via direct `curl` (WebFetch/WebSearch
  tools were both erroring on an unrelated internal model-selection fault — confirmed
  against 3 different URLs before working around it) —
  https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7
  (full "Upgrade to v7" page, fetched and read in full). Full hit-list presented to Davin
  in-session; **STOPPED per the order's own gate — no code edits made** (no package.json
  bump, no schema.prisma edit, no new prisma.config.ts). See CLAUDE.md / chat for the
  hit-list Davin is reviewing. Headline finding not anticipated at drafting: the "client
  bump only" framing undersold the scope — Prisma 7 ships ESM-only and requires driver
  adapters for every PrismaClient instantiation, which is an architecture-level change,
  not a version bump.
- **Step 1 hit-list reviewed and approved by Davin (2026-07-20).** Davin authorized the following deviations to handle the Prisma 7 requirements:
  1. `railway-gateway` is decoupled and left on `6.19.2` to avoid wasting time on CJS/ESM interop for an undeployed service.
  2. The mandatory architectural changes (ESM for `db:seed`, driver adapters, `prisma.config.ts`, SSL configuration) are authorized to be completed in this session, as they are inseparable from the version bump.
- **Steps 2-4 completed 2026-07-20** (commits `7ab2a696`, `559c7cc8`, `256f6e43`).
  Bump: root `prisma`/`@prisma/client` → exactly `7.8.0`, `@prisma/adapter-pg@7.8.0`
  added; `railway-gateway` untouched (verified via `git diff --stat` across all
  commits — zero changes). Codemods, each tied to a Step 1 hit-list entry:
  - `datasource` block's `url`/`directUrl` turned out to be a **hard error** in
    7.8.0, not just deprecated — discovered empirically (`prisma generate`'s own
    error output), not from the guide's prose. New `prisma.config.ts` replaces it;
    loads `.env` then `.env.local` (mirrors Next.js's own precedence) since
    `DIRECT_URL` only lives in `.env.local` and v7's CLI no longer auto-loads any
    `.env` file — this gap would have surfaced regardless of this bump the moment
    anyone ran a bare `prisma.config.ts`-based command, but wasn't visible before
    since schema.prisma's lazy `env()` never actually resolved it at generate-time.
  - `lib/db/prisma.ts` + `prisma/seed.ts` + 3 MT5 scripts
    (`verify-sync-deployment.ts`, `test-mt5-deployment.ts`,
    `monitor-mt5-pipeline.ts`) — every `PrismaClient` instantiation now takes a
    `PrismaPg` driver adapter (mandatory in v7); `rejectUnauthorized: false` set
    explicitly to preserve the pre-v7 Rust engine's permissive cert handling.
  - `types/prisma-stubs.d.ts` (the network-restricted-environment fallback
    mentioned in `lib/db/prisma.ts`'s own comment) was found to be **shadowing**
    the real generated client's `PrismaClientOptions` type — its own ambient
    `declare module '@prisma/client'` block pre-dated the `adapter` option and
    was the actual source of the first `tsc` error, not Prisma's own types. Added
    `adapter?: unknown` to keep it in sync, per its own header's stated
    maintenance pattern ("Updated for Prisma X.x compatibility").
  - `provider = "prisma-client-js"` kept as-is — confirmed via a clean `prisma
generate` that it still works in 7.8.0 (not yet hard-removed despite the
    guide's "will be removed in future releases" wording) — avoided rewriting all
    16 files' `@prisma/client` import paths to a new generated-client location.
  - `db:seed`/`worker:alerts` swapped `ts-node`→`tsx`; removed the now-dead
    `TS_NODE_COMPILER_OPTIONS` workaround from `docker-compose.dev.yml` and the
    `ts-node` devDependency entirely (no remaining root-side usage).
  - Fixed 7 pre-existing `no-explicit-any`/unused-var lint errors in the 3 MT5
    scripts and `seed.ts` (required to pass the pre-commit hook on files this
    session was already touching, not separately in scope). Typing `redisClient`
    properly (was `any`) surfaced 4 real `noUncheckedIndexedAccess` gaps
    (`JSON.parse` on a possibly-empty array index) — fixed with `!` since each is
    already guarded by an immediately-preceding `.length > 0` check.
  - Parity re-verified 3 times across the session (initial bump, after lint
    fixes, after the pre-commit hook's own auto-formatting): `npm run type-check`
    clean every time; `npm run test:ci` → 111/111 suites, 2046/2046 tests, exact
    match to Session 1-4's baseline, zero drift.
  - `prisma migrate status` re-checked post-upgrade (read-only, per L16) —
    resolves cleanly via `DIRECT_URL` through the new config; F20's state
    reported identically to prior sessions (6 migrations unapplied,
    `drop_watchlists` still pending) — unchanged, not touched.
- **Stopping before Step 5** (staged rollout). Staging still doesn't exist
  (`railway status` this session: only a `production` environment) — exactly the
  scenario this order's own Step 5 text anticipated. Per that text and
  `EXECUTOR-PROTOCOL.md` §7 (production deploys always escalate), this needs
  Davin's explicit scoping decision before proceeding — not assumed either way.
- **Davin waived staging, authorized production-only deploy (2026-07-20).** Pushed
  all 4 commits to `origin/main` (`d90033e5..f7a2103c`); pre-push hook re-ran the
  full suite one more time before allowing it through — 111/111 · 2046/2046 again,
  fourth identical parity check this session. `.github/workflows/deploy.yml` failed
  immediately (0s) exactly as it has on every push since before Session 1-3 —
  confirmed unrelated to this bump, not a new break. Other CI workflows (Tests,
  Next.js CI, Security Checks, Bundle Size Monitor) were still sitting in `queued`
  status 5+ minutes after the push, with GitHub's own API returning transient
  HTTP 503s during polling — reads as a GitHub-side infrastructure hiccup, not
  something caused by this push, but not independently confirmed.
  **Cannot confirm the actual Vercel deployment succeeded or watch its runtime
  logs** — no Vercel CLI/dashboard access exists in this environment (same gap as
  `CLAUDE.md`'s "Waiting on" item 5, unchanged). Specifically flagged for Davin
  before pushing: this session's own `prisma.config.ts` makes `prisma generate`
  (runs during the Vercel build via `postinstall`/`prebuild`) hard-require
  `DIRECT_URL` — if that's still not set in Vercel's production env vars (per
  `CLAUDE.md`'s carried-over "Waiting on" item 1), the build itself would fail,
  not just a runtime connection error. **Davin needs to check the Vercel
  dashboard directly**: (1) did a new deployment trigger from this push at all,
  (2) did the build succeed (watch specifically for a `DIRECT_URL` config error),
  (3) runtime logs post-deploy for `P1010`/SSL or connection-timeout errors per
  his own request. Holding the final "Production on prisma@7.8.0" Done-when
  checkbox and the full session close-out (lessons, CLAUDE.md state, Session 2-2
  PRE-DRAFT) until that confirmation comes back — code-side work is done and
  green, but "deployed and verified" isn't something this environment can attest
  to on its own.
- **Davin confirmed deployment verified (2026-07-20).** Added `DIRECT_URL` to
  Vercel's production env vars himself (closes the risk flagged above) and
  manually triggered the deployment. Build for commit `1b5a3436` succeeded.
  Tested the live app directly — runtime logs completely clean, no `P1010`/SSL
  errors, no connection timeouts. Session closing out per this confirmation.

## Next-session handoff

_(DRAFT order for Session 2-2 — Model census + schema split, F4/F5 — once this session
closes; the Advisor should also fold in whatever staging-environment reality this
session encountered, since 2-2 will need it too)_

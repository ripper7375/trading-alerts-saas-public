# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 2, Session 2-1 (complete — Prisma 6.19.2 → 7.8.0 live in
  production, verified) — 2026-07-20. Phase 1 still formally NOT exit-clean (F18 the
  sole blocker, unchanged, dashboard-only). Phase 0 still formally open (CC-A gap
  unchanged, see below).
- **Current order:** `docs/migration-orders/2-1-prisma-upgrade.migration-order.md`
  (EXECUTED, all 5 ordered steps complete, all Done-when items checked)
- **Order status:** EXECUTED — root `prisma`/`@prisma/client` bumped to exactly
  `7.8.0` (`railway-gateway/package.json` explicitly decoupled, stays on `6.19.2` —
  Davin's call, never deployed anyway, NestJS's CJS build has no clean path to an
  ESM-only dependency). Real scope was far bigger than "client bump only": Prisma 7
  ships ESM-only, requires driver adapters (`@prisma/adapter-pg`) on every
  `PrismaClient`, and hard-errors (not just deprecates) on schema.prisma's
  `url`/`directUrl` — all handled, see `DECISION-LOG.md`'s F19 entry for the full
  breakdown. Test parity held at 111/111 suites · 2046/2046 tests through 5 separate
  re-runs across the session (initial bump, post-lint-fix, post-auto-format,
  pre-push hook ×2). Pushed to production, waived staging (doesn't exist yet) per
  Davin's explicit authorization. Davin added the missing `DIRECT_URL` Vercel env
  var himself, manually triggered the deploy, confirmed commit `1b5a3436` built
  successfully and runtime logs are clean (no `P1010`/SSL errors, no connection
  timeouts).
- **Waiting on:** (1, non-blocking, clarified this session) `deploy.yml` is still
  failing on **every** push to `main` at the GitHub workflow-file level (0s runtime)
  — re-confirmed unchanged this session (same failure pattern back through Session
  0-3). **Now known NOT to block real deploys** — Vercel's own deploy mechanism
  worked independently (Davin's manual trigger succeeded) once `DIRECT_URL` was set,
  so this workflow file is dead/broken but not on the critical path. Still worth
  diagnosing and fixing for CI hygiene (a permanently-red check is bad signal), just
  not urgent. `DIRECT_URL` on Vercel is now RESOLVED (Davin added it 2026-07-20).
  (2, urgent, unchanged) Production's Prisma migration history is still completely
  unbaselined (`prisma migrate status`: all 6 migrations unapplied server-side,
  re-confirmed this session via a fresh read-only check post-upgrade), and one
  pending migration (`drop_watchlists`) would DROP two live, data-holding tables
  (`Watchlist`/`WatchlistItem`) if `migrate deploy` is ever run as-is. F20 in
  `DECISION-LOG.md`. Session 2-2's PRE-DRAFT flags a new wrinkle: splitting the
  schema into two files (market vs non-market) against an unbaselined database adds
  complexity to whatever Session 2-3 does here — worth Davin deciding whether to
  pull F20's baselining forward again. (3, non-blocking, unchanged) F18's RPO
  gap — Railway automated-backup cadence still unverified via CLI (dashboard-only).
  (4, unchanged, carried over) Davin to grant Vercel dashboard/preview-branch access
  — Railway access exists in this environment, Vercel access still fully absent
  (confirmed again this session: no `vercel` CLI, no `.vercel` config) — this is
  exactly why Session 2-1 couldn't verify its own production deploy and had to hand
  that off to Davin. (5, unchanged, carried over) A human with delete permission to
  remove 5 remote branches — this session's git credential can push/create branches
  but gets `HTTP 403` on `git push --delete`. Branches:
  `fix/tsconfig-exclude-case-sensitivity`, `salvage/windowed-centroid-cfl-indicator`
  (both merged), plus 3 stale `claude/*` branches. (6, unchanged, carried over)
  `railway`'s `tcp-proxy`/`private-network` CLI commands (seen in `--help` since
  Session 1-4) still not verified against the item-(7)-class workaround from
  Session 1-3b — low priority, nobody's blocked on it. (7, new) Session 2-2 needs
  Prisma 7's multi-schema/multi-config support researched before its Ordered steps
  can be trusted — does `prisma.config.ts` support multiple schema paths, or does
  the two-file layout (F5) need two separate configs/`generate` invocations? Not
  researched this session, flagged in 2-2's PRE-DRAFT as the first thing to check.
  (8, new) The `RefreshToken` model the playbook calls for in Session 2-2 has no
  defined shape anywhere — likely coupled to F6/F7 (auth strategy, both OPEN, due
  Session 3-1) — worth Davin/the Advisor deciding whether 2-2 should stub it now or
  wait for F6/F7 to land first, so it isn't designed twice.
- **Last session did:** Session 2-1 (Prisma 6.19.2 → 7.8.0 upgrade, UPGRADE
  variant) — CONFIRM re-verified codebase/runtime (type-check clean, test:ci
  111/2046 parity, Postgres+pgbouncer RUNNING). **Step 1 audit** found the real
  scope was much larger than "client bump only" (see Order status above); presented
  the hit-list and STOPPED per the order's own hard gate before any code edit —
  Davin reviewed live, authorized decoupling `railway-gateway` and tackling the
  full architecture-level change set in one session. **Steps 2-4:** bumped, wired
  driver adapters into every `PrismaClient` instantiation (`lib/db/prisma.ts`,
  `prisma/seed.ts`, 3 legacy MT5 scripts found along the way), built
  `prisma.config.ts` to replace the schema's now-illegal `url`/`directUrl`, swapped
  `ts-node`→`tsx` for the two entry points that run outside Next's bundler, kept
  `provider = "prisma-client-js"` (confirmed still works, avoided rewriting 16
  files' import paths). Found and fixed a real gotcha: `types/prisma-stubs.d.ts` (a
  hand-maintained fallback stub) was shadowing the real generated Prisma types —
  that's what the first `tsc` error was actually about (`LESSONS-LEARNED.md` L21).
  Also worked around a WebFetch/WebSearch tool-level fault via direct `curl` (L22).
  **Step 5:** staging doesn't exist — stopped and asked, Davin waived to
  production-only, explicitly asked to watch for SSL/connection errors post-deploy.
  Pushed to production; flagged before pushing that the new `prisma.config.ts`
  hard-requires `DIRECT_URL` at build time and this environment has no Vercel
  access to verify it was set or watch the result — Davin confirmed both (added the
  var, triggered the deploy, verified clean runtime logs) from his side. F19 closed
  in `DECISION-LOG.md`. Two new lessons recorded (L21, L22). PRE-DRAFTed Session
  2-2 with a candidate model census (26 non-market-data models vs 1 market-data
  model, `MarketDataV6`) derived directly from the live schema.
- **Next session must:** Session 2-2 — Model census + schema split (F4, F5),
  `TEMPLATE-PORT.md` variant (explicitly listed for 2-2 in
  `00-SKELETON-AND-RULES.md` §2's table). PRE-DRAFTed:
  `docs/migration-orders/2-2-model-census-schema-split.migration-order.md` —
  currently **PRE-DRAFT** (needs the Advisor to produce the DRAFT, then Davin's
  APPROVAL). Two open technical questions flagged in Waiting-on items 7-8 above
  (Prisma 7 multi-schema support, `RefreshToken`'s shape) need resolving before
  2-2's Ordered steps can be trusted as more than a sketch.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · **F19 fully RESOLVED (Session
  2-1)** — audit + bump + codemods + production deploy, all verified · **F20 OPEN,
  urgent** (production migration history unbaselined, destructive pending drop —
  found Session 1-3, reconfirmed unchanged Session 2-1) · F4/F5 OPEN, due Session 2-2
  (candidate census drafted in 2-2's PRE-DRAFT, not yet Advisor/Davin-confirmed) ·
  F6–F16 OPEN
  (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

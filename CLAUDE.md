# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 0, Session 0-5 (complete, local-only scope) — 2026-07-17.
- **Current order:**
  `docs/migration-orders/0-5-staging-local-dev.migration-order.md`
  (CONFIRMED, executed — local-only scope)
- **Order status:** CONFIRMED — executed 2026-07-17 (steps 1, 4, 5 done; steps 2–3 deferred
  to Session 0-6, see Waiting on)
- **Waiting on:** (1, new) Davin to grant Railway + Vercel account/dashboard access so
  Session 0-6 can provision the staging environment/project + preview branch (this
  session's entry criterion couldn't clear it; Davin chose local-only scoping instead —
  see order's Deviations #1). (2, unchanged, carried over) A human with delete permission
  to remove 5 remote branches — this session's git credential can push/create branches but
  gets `HTTP 403` on `git push --delete` for every branch tried. Branches needing deletion:
  `fix/tsconfig-exclude-case-sensitivity` and `salvage/windowed-centroid-cfl-indicator`
  (both already merged), plus 3 stale `claude/*` branches (no open PRs on any). Unrelated
  to Phase 0 work; carried over from the 2026-07-12 git audit.
- **Last session did:** Session 0-5 (staging + local dev, INFRA, NOT read-only — first
  session this phase that creates/runs things rather than just cataloging). At CONFIRM,
  found the order's PRE-DRAFT→APPROVED edit was again in-place/uncommitted (same pattern as
  Session 0-4, by now a recognized workflow quirk, not a concern). Entry criterion 2
  (Railway/Vercel access) was unverifiable from the codebase — asked Davin directly; Davin
  chose **local-only scoping**, deferring Railway/Vercel provisioning to Session 0-6.
  **`docker-compose.dev.yml` (new, root):** Postgres + Redis + Next.js dev service;
  `mt5-service` excluded per the order's strict rule. Live-verified end to end: all 3
  containers up/healthy, `prisma db push` synced the schema, `prisma/seed.ts` ran clean
  (1 admin + 5 named e2e test users + 2 sample alerts + affiliate config, all synthetic —
  matches F17), `curl localhost:3000/` → `HTTP 200` real app HTML. Needed 2 fixes along the
  way, both scoped to the compose file only: `pnpm run seed` doesn't exist as a script
  (`"seed"` in `package.json` is a `prisma.seed` config field, not an npm script — the real
  alias is `db:seed`), and `ts-node prisma/seed.ts` needed
  `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}'` to avoid `ERR_UNKNOWN_FILE_EXTENSION`
  (tsconfig's `"module": "esnext"` makes bare ts-node default to an ESM loader that can't
  read `.ts` — now `LESSONS-LEARNED.md` L10). Also found the existing `docker-compose.yml`'s
  `web`/`alert-worker` services reference a root `Dockerfile` that **doesn't exist anywhere
  in the repo** — likely stale since Vercel, not Docker, is the actual prod deploy target;
  not fixed (out of scope), flagged in the order's Deviations for Davin.
  **F17 (staging-data strategy) RESOLVED** and logged in `DECISION-LOG.md`: synthetic seed
  only, never unmasked production/user data, evidenced by the live seed run above.
  **Post-verification, the stack was stopped again** (`docker compose -f
docker-compose.dev.yml down`, volumes kept) — its first `git push` attempt failed
  pre-push validation with real DB/Redis errors on suites green since Session 0-4; traced
  to `jest.setup.js` hardcoding `localhost:5432`/`6379` for tests, the same ports this
  compose file publishes, so tests hit the real containers instead of being isolated.
  Stopping the stack and re-running `git push` came back clean (111/111 suites, 2046/2046
  tests, exact 0-4 baseline) — now `LESSONS-LEARNED.md` L11. Davin can bring the stack back
  up with `docker compose -f docker-compose.dev.yml up -d` any time (seeded data persists
  in named volumes); just stop it again before running tests or pushing.
  **Phase 0 Exit Review run:** 4/5 exit criteria met; the sole gap is CC-A (staging
  shells) — Phase 0 is NOT yet closed. Next session stays in Phase 0.
- **Next session must:** Session 0-6 — staging shells only (Railway + Vercel provisioning,
  INFRA). PRE-DRAFT written: `docs/migration-orders/0-5-staging-local-dev.migration-order.md`'s
  "Next-session handoff" section (steps 2–3 carried over verbatim from this order). Entry
  criterion: Davin's Railway + Vercel account access (unchanged ask from this session).
  Once 0-6 closes, re-run the Phase 0 Exit Review — if CC-A goes green, Phase 0 formally
  exits and Phase 1 Session 1-1 (Railway PostgreSQL design) can be PRE-DRAFTED next.
- **Open flags:** F1 fully RESOLVED (both batches, Session 0-3) · F2 RESOLVED
  (Session 0-1) · F17 RESOLVED (Session 0-5: synthetic seed only) · F19 npm-check RESOLVED
  (Session 0-1), full audit still OPEN (due Session 2-1) · F3–F16, F18 OPEN (register:
  plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

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

# Migration Order — Staging + Local Dev (CC-A, CC-I openers)

> `TEMPLATE-INFRA.md` variant. **Status: CONFIRMED — executed (local-only scope)** —
> formulated by the Advisor from the Executor's Session 0-4 PRE-DRAFT notes; CONFIRMED and
> scoped to local-only by Davin 2026-07-17 (Railway/Vercel access not yet granted).

**Session:** 0-5 · **Phase:** Phase 0 (Foundation) · **Variant:** INFRA · **Status:** CONFIRMED — executed (local-only scope)
**Generated:** 2026-07-17 · **Flags touched:** F17 (staging-data strategy) — RESOLVED · **Estimated time:** unknown — budget for a split into two sessions if account setup runs long.

## Context carried over from Session 0-4

- **Playbook scope:** "Create root `docker-compose.dev.yml` (Postgres, Redis, Next.js dev; PgBouncer + services join later). Set up the staging environment shells (Railway staging environment/project + a Vercel preview branch). Decide F17 (staging data: recommend synthetic seed, never unmasked money data)."
- **Provisioning Session:** This session creates `docker-compose.dev.yml` AND provisions real cloud resources (Railway staging, Vercel preview). Davin must provide Railway + Vercel account access. This order cannot be executed past the local `docker-compose.dev.yml` step without that access.
- **F17 Decision Resolved:** Davin has decided F17: **synthetic seed only** (never unmasked money data).
- **Env Vars & Naming Drift:** The secret matrix (Session 0-4) provides `docker-compose.dev.yml`'s env vars. Reuse the `postgres`/`redis` service blocks from the existing `docker-compose.yml` almost as-is. Use live naming for variables, not template names.
- **`mt5-service` Exclusion:** `mt5-service` is SEPARATE_STACK (out of scope for this migration). Omit it entirely from `docker-compose.dev.yml` to avoid deepening dependencies on out-of-scope code.
- **Test Baseline Reality Check:** Zero existing test suites touch a real Postgres/Redis. Once `docker-compose.dev.yml` is running, we will eventually wire real-DB integration tests against it (out-of-scope for this session, but keep in mind per L1).

## Entry criteria

- [x] Session 0-4 artifacts committed and pushed: `docs/secret-matrix.md`, `docs/migration-test-baseline.md`, updated `CLAUDE.md`. — Verified at CONFIRM: `dba2a545` (docs), `922ebe8b` (CLAUDE.md), `origin/main` == local `main` (0 ahead/0 behind).
- [x] Davin has granted Railway + Vercel account/dashboard access (or explicitly scoped this session to the local-only `docker-compose.dev.yml` step). — Davin chose **local-only scoping** at CONFIRM (2026-07-17); Railway/Vercel access not yet granted. Steps 2–3 deferred to a follow-up session.

## Ordered steps

1. **Create `docker-compose.dev.yml`** — DONE
   - Include: Postgres, Redis, Next.js dev service (pointed at `next dev`).
   - Exclude: `mt5-service` (out-of-scope `SEPARATE_STACK`). PgBouncer and other services join later.
   - _Verify:_ `docker-compose -f docker-compose.dev.yml up` boots; app reachable on `localhost:3000`; Prisma connects and a seed script runs cleanly against the containers.
   - **Result:** all 3 containers (`postgres`, `redis`, `web`) up and healthy; `prisma db push` synced the schema (`Datasource "db": PostgreSQL database "trading_alerts_dev"`); `prisma/seed.ts` ran cleanly (1 admin user + 5 named e2e test users + 2 sample alerts + affiliate `SystemConfig` rows, all synthetic); `curl http://localhost:3000/` → `HTTP 200`, real app HTML (`<title>Trading Alerts - Real-Time Trading Signals</title>`), confirmed via container logs (`GET / 200 in 541ms`). See Deviations for 2 fixes needed to get here.

2. **Provision Railway staging environment/project** — DEFERRED (local-only scope, this session)
   - Use Davin's Railway access to create the staging environment.
   - _Verify:_ Staging environment exists and is reachable. Document its URL/identifiers in this order's notes (names-only rule).

3. **Provision Vercel preview branch** — DEFERRED (local-only scope, this session)
   - Use Davin's Vercel access to set up a preview branch.
   - _Verify:_ Preview deployment builds successfully from a throwaway branch.

4. **Record F17 decision in `DECISION-LOG.md`** — DONE
   - Log the staging data strategy as decided: synthetic seed only, never unmasked money/production data.
   - **Result:** recorded in `DECISION-LOG.md` (flag register row updated to RESOLVED + full resolution entry with evidence from the live seed run).

5. **Phase 0 Exit Review** — DONE (see dedicated section below)
   - Check the plan's Phase 0 section to ensure all exit criteria are met.

## Rules specific to this variant

- **No Production Data in Staging:** Do not put real/unmasked production data in any staging environment (non-negotiable #5).
- Escalate any money/auth/secrets/CORS decisions beyond what's explicitly authorized here to Davin per `EXECUTOR-PROTOCOL.md` §7.
- Creativity dial: Medium — `docker-compose.dev.yml`'s exact shape is flexible, but the exclusion of `mt5-service` is strict.

## Phase 0 Exit Review (plan §2 exit criteria)

| Exit criterion                                                    | Status                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAPI spec covering all public endpoints, committed             | ✅ DONE — F1 fully resolved (Session 0-3), 103/103 routes accounted for                                                                                                                                                                                              |
| Secret matrix and service topology documented                     | ✅ DONE — `docs/secret-matrix.md` (Session 0-4); topology (`operation-service`/`money-service`/`railway-gateway`) fixed in `migration-stack-analysis.md`'s CORE/BUSINESS FUNCTION split                                                                              |
| Baseline test results recorded                                    | ✅ DONE — `docs/migration-test-baseline.md` (Session 0-4), 114 suites / 2075 tests, all green                                                                                                                                                                        |
| Staging environment (CC-A) and local dev stack (CC-I) operational | ⚠️ **PARTIAL** — CC-I (`docker-compose.dev.yml`) ✅ DONE this session; CC-A (Railway staging + Vercel preview) DEFERRED, no Davin access yet                                                                                                                         |
| All Phase 0 flags resolved in the Decision Log                    | ✅ DONE for flags due in Phase 0 — F1 ✅, F2 ✅, F17 ✅ (this session), F19 npm-check portion ✅ (full 6→7 audit correctly deferred to Session 2-1, not a Phase 0 due-date). F16/F18 have later due-sessions (4A-1, 1-1) per the flag register — not Phase 0-gating. |

**Conclusion: Phase 0 is NOT yet fully closed.** The sole remaining gap is CC-A (staging
shells). A follow-up session (Session 0-6, INFRA) is needed once Davin grants Railway +
Vercel access, after which Phase 0 formally exits and Phase 1 Session 1-1 can begin.

## Done when

- [x] `docker-compose.dev.yml` committed; `docker-compose up` boots the monolith locally against a seeded Postgres.
- [ ] Staging shells exist (Railway environment/project + Vercel preview branch) — **local-only scoping recorded here**; deferred to Session 0-6.
- [x] F17 decided (synthetic seed) and recorded in `DECISION-LOG.md`.
- [x] Phase 0 exit criteria reviewed and checked (see table above — 4/5 met, CC-A open).

## Rollback

Local-only scope actually executed: the only new artifacts are `docker-compose.dev.yml`
(new file) and its Docker volumes/containers (all named distinctly from the existing
`docker-compose.yml`'s resources — see Deviations #5). Rollback = `docker compose -f
docker-compose.dev.yml down -v` + `git rm docker-compose.dev.yml`; zero impact on
production, staging, or the existing local dev setup, since nothing existing was touched.
(Original rollback text, for when Session 0-6 provisions Railway/Vercel: delete the newly
created staging environment/branch if misconfigured — still applies then.)

## Deviations

1. **Local-only scoping decision (Davin, at CONFIRM).** Entry criterion 2 (Railway/Vercel
   access) was unverifiable from the codebase — this is account/dashboard state only Davin
   has visibility into. Davin explicitly chose to scope this session to the local-only
   `docker-compose.dev.yml` step, deferring steps 2 (Railway) and 3 (Vercel) to a follow-up
   session. Recorded in `DECISION-LOG.md` as a scoping decision (not a flag).
2. **`web` service runs a bare `node:20-alpine` image with a bind mount, not a built
   Dockerfile.** The existing `docker-compose.yml`'s `web`/`alert-worker` services declare
   `build: { context: ., dockerfile: Dockerfile }`, but **no root `Dockerfile` exists in
   this repo** (confirmed via `Glob **/Dockerfile*` — only nested Dockerfiles in
   `mt5-service/`, `backend-stack-b/`, and various `seed-code/`/`Archive/` dirs). This looks
   like stale infra from before the app's production deploy target became Vercel (Next.js
   doesn't need a Dockerfile there). Not fixed — out of this session's scope (creating a
   root Dockerfile is a separate decision); `docker-compose.dev.yml` sidesteps it entirely
   by using the official Node image + a source bind mount, which is also the more idiomatic
   pattern for a _dev_ compose file (fast iteration, no rebuild-on-change). Flagging the
   existing `docker-compose.yml`'s broken `build:` block for Davin's awareness — it would
   fail today if anyone tried `docker-compose up` (non-dev) as-is.
3. **Two fixes needed to get the `web` container's verify step green, both scoped to
   `docker-compose.dev.yml` only (no application code or `package.json` touched):**
   - `pnpm run seed` (as originally written into the compose command) failed —
     `ERR_PNPM_NO_SCRIPT`. Root cause: `"seed": "ts-node prisma/seed.ts"` in `package.json`
     is a `prisma.seed` **config field** (read by Prisma's own CLI, e.g. `prisma migrate
dev`'s auto-seed), not an npm/pnpm script — the actual script alias is `db:seed`.
     Fixed by changing the compose command to `pnpm run db:seed`.
   - After that fix, the seed step failed again — `ERR_UNKNOWN_FILE_EXTENSION` on
     `prisma/seed.ts`. Root cause and fix: see `LESSONS-LEARNED.md` L10 (`ts-node` defaults
     to an ESM loader path because `tsconfig.json` sets `"module": "esnext"`, but
     `package.json` has no `"type": "module"`; needs
     `TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}'`). Fixed by adding that env var to
     the `web` service — scoped to this compose file only, no tsconfig/package.json change.
4. **Docker Hub image pulls (`postgres:15-alpine`, `node:20-alpine`) intermittently failed
   with `tls: bad record MAC`** on the first attempt for each image — a transient network
   condition in this environment, not a compose-file issue. Each image pulled successfully
   on retry (1–2 attempts); a tiny image (`hello-world`) pulled clean on the first try,
   confirming this is a large-transfer flakiness pattern, not a total network block. No
   deviation from the order needed, just noting the retries for anyone reproducing this.
5. **Local dev Postgres database named `trading_alerts_dev`**, not `trading_alerts` (the
   name the existing `docker-compose.yml` uses) — a deliberate, low-risk naming choice to
   keep the two compose files' data volumes distinct if both are ever run side by side.
   Named Docker volumes used throughout (`postgres_dev_data`, `redis_dev_data`,
   `web_node_modules`, `web_next_cache`) rather than reusing the existing file's volume
   names, same reasoning — plus a separate `web_node_modules` named volume specifically so
   the container's Linux-built `node_modules` (bcrypt native bindings, etc.) never collide
   with the host's Windows-built `node_modules` from the bind-mounted source tree.
6. **`docker-compose.dev.yml` stack stopped (not left running) at session close** —
   reversed from the original plan. `git push`'s pre-push hook (`test:quick`, Jest) failed
   with real DB/Redis errors on suites that were green in the Session 0-4 baseline; traced
   to `jest.setup.js` hardcoding `localhost:5432`/`localhost:6379` for tests, the exact
   ports this compose file publishes — tests were hitting the real containers instead of
   being isolated. Ran `docker compose -f docker-compose.dev.yml down` (data volumes kept,
   not `-v`), re-ran `git push`, tests passed clean (111/111 suites, 2046/2046 tests —
   exact Session 0-4 baseline). Now `LESSONS-LEARNED.md` L11: **never run this stack
   alongside the test suite/pre-push validation.** Davin can bring it back up any time with
   `docker compose -f docker-compose.dev.yml up -d` (seeded data persists in the named
   volumes) — just stop it again before running tests or pushing.
7. **Leftover `.pnpm-store/` (840MB) appeared in the bind-mounted repo root** after the
   `web` container's first `pnpm install` — pnpm's content-addressable store defaulted to
   a path inside `/app` (the bind mount), so it leaked onto the host as an untracked
   directory. Fixed by adding a 4th named volume (`web_pnpm_store:/app/.pnpm-store`) to
   shadow that path, same technique already used for `node_modules`/`.next`. Deleted the
   stale host-side directory (untracked, safe — pure cache, no user data) before committing.

## Next-session handoff

**PRE-DRAFT for Session 0-6 (Phase 0, INFRA — staging shells only), not Phase 1 Session
1-1** — Phase 0 is not yet closed (see Exit Review above); the only remaining gap is CC-A.

- **Scope:** steps 2–3 from this order, unchanged: provision a Railway staging
  environment/project and a Vercel preview branch, using Davin's account access.
- **Entry criteria for 0-6:** Davin has granted Railway + Vercel account/dashboard access
  (the same criterion this session couldn't clear); this order (0-5) committed and pushed
  with its Deviations filled in and `DECISION-LOG.md`/`CLAUDE.md` updated.
- **Carried findings:** the existing `docker-compose.yml`'s `web`/`alert-worker` services
  reference a root `Dockerfile` that doesn't exist (Deviation 2 above) — not this session's
  problem to fix, but worth Davin's awareness; if Railway staging provisioning needs a
  production-shaped Dockerfile, that gap will surface then.
- **Once 0-6 closes:** Phase 0 Exit Review can be re-run — if CC-A goes green, Phase 0
  formally exits and the PRE-DRAFT for Phase 1 Session 1-1 (Railway PostgreSQL design,
  resolving F3/F18) gets written at that session's close.

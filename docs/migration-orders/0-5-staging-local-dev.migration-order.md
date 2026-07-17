# Migration Order — Staging + Local Dev (CC-A, CC-I openers)

> `TEMPLATE-INFRA.md` variant. **Status: PRE-DRAFT** — written by the Executor at Session
> 0-4's close, informed by that session's findings (secret matrix, test baseline). Needs an
> Advisor DRAFT pass and Davin's APPROVED before the next Executor session can CONFIRM and
> run it.

**Session:** 0-5 · **Phase:** Phase 0 (Foundation) · **Variant:** INFRA · **Generated:**
2026-07-17 · **Flags touched:** F17 (staging-data strategy — decision needed) · **Estimated
time:** unknown — depends heavily on how much of the Railway/Vercel provisioning Davin does
vs. delegates; budget for a split into two sessions if account setup runs long.

## Context carried over from Session 0-4

- **Playbook scope:** "Create root `docker-compose.dev.yml` (Postgres, Redis, Next.js dev;
  PgBouncer + services join later). Set up the staging environment shells (Railway staging
  environment/project + a Vercel preview branch). Decide F17 (staging data: recommend
  synthetic seed, never unmasked money data)."
- **This is NOT a read-only session, unlike 0-1 through 0-4.** It creates a new file
  (`docker-compose.dev.yml`) AND provisions real cloud resources (a Railway staging
  environment/project, a Vercel preview branch). The playbook itself says "You provide:
  Railway + Vercel account access; F17 decision approval" — per `EXECUTOR-PROTOCOL.md`
  §7, production-adjacent provisioning and any money/staging-data decision escalate to
  Davin. This order cannot be CONFIRMED-and-executed past the local `docker-compose.dev.yml`
  step without that access being granted first.
- **Secret matrix (`docs/secret-matrix.md`, Session 0-4) is the direct input for
  `docker-compose.dev.yml`'s env vars.** Known local-dev-relevant names: `DATABASE_URL`,
  `REDIS_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (existing `docker-compose.yml` already
  has a working pattern for these — reuse its `postgres`/`redis` service blocks almost
  as-is). Note the matrix's naming-drift finding: local `.env`/`.env.local` use
  `MT5_LOGIN_01`/`MT5_PASSWORD_01`, not the `.env.example`/existing-`docker-compose.yml`
  names `MT5_LOGIN`/`MT5_PASSWORD` — if `docker-compose.dev.yml` needs MT5 vars at all,
  use the live naming, not the template's.
- **`mt5-service` is SEPARATE_STACK (out of scope for this migration).** The _existing_
  `docker-compose.yml` bundles it in as a dependency of the `web` service. Open question for
  the DRAFT/APPROVED pass: should `docker-compose.dev.yml` (the NEW file this session
  creates, scoped to "Postgres, Redis, Next.js dev" per the playbook) omit `mt5-service`
  entirely, since it's out-of-scope infrastructure? Recommend omitting it — the playbook's
  own service list for this file is "Postgres, Redis, Next.js dev," which doesn't include it,
  and CLAUDE.md's do-not-touch list argues for not deepening dependencies on SEPARATE_STACK
  code. Needs Davin's confirmation, not just an Executor assumption, since it changes local
  dev ergonomics (MT5-dependent features won't boot via this compose file).
- **Test baseline (Session 0-4) found zero suites touching a real Postgres/Redis.** Once
  `docker-compose.dev.yml` exists and boots a seeded Postgres, a natural (but out-of-scope
  for THIS session, flagging for later) follow-up is wiring at least one real-DB integration
  test against it, per L1 — the two mislabeled "integration" tests
  (`user-registration-flow.test.ts`, `api-client-workflow.test.ts`) found in 0-4 are the
  obvious first candidates.
- **Lessons directly applicable:** L1 (mocked suites prove nothing about real DB behavior —
  relevant once this session's seeded Postgres exists), L3 (Prisma migrations run on the
  DIRECT url, runtime through the pooler — relevant when PgBouncer joins later, not this
  session), L7/L9 (pnpm-strict `node_modules`; diff overlapping candidates before trusting
  any one file — less directly relevant here, carried forward as standing reflexes).

## Entry criteria

- [ ] Session 0-4 artifacts committed and pushed: `docs/secret-matrix.md`,
      `docs/migration-test-baseline.md`, updated `CLAUDE.md`, this order marked
      CONFIRMED-and-executed with a filled Deviations section.
- [ ] Davin has granted Railway + Vercel account/dashboard access (or explicitly scoped this
      session to the local-only `docker-compose.dev.yml` step, deferring staging-shell
      provisioning to a follow-up session).
- [ ] Davin has decided F17 (staging data strategy) — recommend synthetic/seeded data only,
      never unmasked real user or payment data in any staging environment, matching this
      repo's standing money/auth escalation rule (`CLAUDE.md` non-negotiable #5).

## Candidate ordered steps (Executor's raw suggestion — Advisor to firm up)

1. **`docker-compose.dev.yml`** — Postgres + Redis + Next.js dev service, modeled on the
   existing `docker-compose.yml`'s `postgres`/`redis`/`web` blocks but pointed at `next dev`
   instead of a production build, and (pending the open question above) likely omitting
   `mt5-service`. PgBouncer and other services join later per the playbook — don't add them
   prematurely.
   - _Verify:_ `docker-compose -f docker-compose.dev.yml up` boots; app reachable on
     `localhost:3000`; Prisma connects and a seed script runs cleanly against the containers.
2. **Railway staging environment/project** — needs Davin's Railway access. Scope TBD by the
   Advisor/Davin (new project vs. new environment within the existing one).
   - _Verify:_ staging environment exists and is reachable; document its URL/identifiers
     in this order's own notes (not secret values — matches the Session 0-4 names-only rule).
3. **Vercel preview branch** — needs Davin's Vercel access.
   - _Verify:_ preview deployment builds successfully from a throwaway branch.
4. **F17 decision, recorded in `DECISION-LOG.md`** — staging data strategy. Recommend
   synthetic seed data only.

## Rules specific to this variant

- Money/auth/secrets/CORS decisions beyond what's explicitly authorized here escalate to
  Davin per `EXECUTOR-PROTOCOL.md` §7 — this applies directly to F17 and to any staging
  environment variable that touches Stripe/dLocal/RiseWorks.
- Do not put real/unmasked production data in any staging environment, regardless of F17's
  final wording, without Davin's explicit live approval (non-negotiable #5).
- Creativity dial: Medium — `docker-compose.dev.yml`'s exact shape is flexible; which
  services it includes/excludes (the `mt5-service` question) should be confirmed, not
  unilaterally decided, given it's a scope judgment call, not a pure implementation detail.

## Done when

- [ ] `docker-compose.dev.yml` committed; `docker-compose up` boots the monolith locally
      against a seeded Postgres.
- [ ] Staging shells exist (Railway environment/project + Vercel preview branch) — or, if
      Davin scoped this session to local-only, that scoping is recorded here and staging-shell
      provisioning is handed to an explicit follow-up session.
- [ ] F17 decided and recorded in `DECISION-LOG.md`.
- [ ] Phase 0 exit criteria reviewed and checked (see the plan's Phase 0 section).

## Rollback

Provisioning session — new resources only (staging environment, preview branch), nothing
existing is modified. Rollback = delete the newly created staging environment/branch if
misconfigured; no impact to production or the existing local dev setup.

## Deviations

_(filled during execution)_

## Next-session handoff

_(PRE-DRAFT for the next session — written at this session's close, once Phase 0's exit
review clarifies what Phase 1 Session 1-1 needs)_

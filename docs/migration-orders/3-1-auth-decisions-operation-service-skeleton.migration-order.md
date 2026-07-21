# Migration Order — Auth decisions (F6/F7) + operation-service skeleton + JWT bridge

> Mixed session — `TEMPLATE-INFRA.md` is the dominant variant (the "done when" test is a
> live protected endpoint, and the bulk of the work is provisioning a new NestJS service),
> borrowing `TEMPLATE-CONTRACT.md`'s "Decision step (flag resolution)" section shape for the
> F6/F7 steps, which must be decided BEFORE the guard that depends on them is built — the
> same "dominant variant + borrowed rigor" pattern Session 2-3 used (PORT + INFRA-borrowed).
> Read `00-SKELETON-AND-RULES.md` §2 and §4 first.
> **Creativity dial: Medium** (INFRA default) — the end-state (a working `JwtAuthGuard`
> verifying real NextAuth-issued tokens) is fixed by the plan; how the service is scaffolded
> and how F6/F7 are resolved is this session's call, within the plan's pre-made architecture
> decisions (§5 of the plan doc — Pattern 1, bridge-first, Prisma-backed refresh tokens).
> **Status: CONFIRMED** — 2026-07-21. Re-verified against live codebase/Railway per
> EXECUTOR-PROTOCOL.md §1. Corrections made live at CONFIRM (Davin's resolutions, this
> session): (1) Phase 2 + F22 confirmed live in production by Davin — entry criterion #1
> satisfied. (2) `NEXTAUTH_SECRET`-grant entry criterion had a sequencing flaw (can't grant
> access to a service that doesn't exist yet) — Davin re-sequenced it to a post-scaffold
> Step 6 action; Claude will not handle the raw secret value itself (see Rules addendum
> below), Davin sets it directly via Railway. (3) CONFIRM's fresh full-repo search
> **found** the 3 "missing" F6 docs (`backend-stack-a/hybrid-authentication-for-backend-
stack-a/`, committed 2026-02-02, predates this migration) — contrary to this PRE-DRAFT's
> claim of zero matches. Davin reviewed and explicitly disregards them: they're exploratory
> OpenAuth seed material for a future end-state, superseded by the plan's own §5 decision;
> F6/F7 stand as resolved (bridge-first / Path B). (4) New gap found at CONFIRM, not in the
> original entry criteria: Step 5/Done-when's "staging" deploy target refers to CC-A's
> dedicated staging stack (plan §13, separate Postgres/Redis/Railway environment) — CC-A is
> still open (Phase 0, unchanged) and only required live before Phase 4, not Phase 3; the
> `trading-alerts` Railway project currently has exactly one environment (`production`).
> Steps 1-4 don't depend on this and can proceed; Steps 5-6's actual deploy target needs
> Davin's call before any Railway service is created — see Deviations.

**Session:** 3-1 · **Phase:** Phase 3 — Hybrid (Dual) JWT Authentication (Workstream 2),
plan steps 3.1 (partial) · **Variant:** INFRA (borrowing CONTRACT's decision-step shape) ·
**Generated:** 2026-07-21 (DRAFT, prepared by Advisor) · **Flags touched:** F6, F7 ·
**Estimated time:** unestimated (F12 open).
**Target service:** new `operation-service` (Railway, NestJS 11.1.28 per F2's confirmed pin
— **not** railway-gateway's installed NestJS 10.4.15; see reference-notes finding below).
**Contract:** new — this session defines `operation-service`'s first endpoint
(`GET /health-auth` per the playbook) and its JWT verification contract; no existing
contract is being replaced yet (NextAuth on Vercel keeps running unchanged, dual-running
per the plan's exit criteria).

## Context carried over from Phase 2's close (Sessions 2-1 through 2-4)

- **Phase 2 is CODE-COMPLETE and GREEN on `main`, not yet deployed to production** — see
  `CLAUDE.md`'s Current state. `npm run build` exits 0, `npm run type-check` clean,
  `npm run test:ci` 111/111 suites / 2046/2046 tests. Whether Davin wants Session 2-4 + F22
  deployed to production before this session starts is an open question (CLAUDE.md's "Next
  session" note) — **re-verify at CONFIRM**, don't assume either way.
- **The split Prisma schemas exist and are live in code:** `prisma/non-market-data/schema.prisma`
  owns `User` (and, per plan §1, will own the new `RefreshToken` model this phase's token
  endpoints — Session 3-2, not this session — will actually use). `RefreshToken` currently
  exists only as F4's minimal stub (`id`, `token`, `userId`, `expiresAt`) — this session
  doesn't need to touch it (Session 3-2's job per the playbook), but `operation-service`'s
  Prisma module (see below) should generate against this schema, not a placeholder.
- **`docs/railway-gateway-reference-notes.md`** (Session 0-1's output, 241 lines) is the
  authoritative template for scaffolding any new NestJS service — read it in full before
  writing a single file. Its own "What's directly copyable vs. pipeline-specific" table
  (bottom of the doc) is the fastest orientation:

  | Pattern                             | Copy as-is                | Adapt                                                                                                                         |
  | ----------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
  | `PrismaModule`/`PrismaService`      | Yes — verbatim            | Point at `prisma/non-market-data/schema.prisma`                                                                               |
  | Global `ThrottlerGuard`/`APP_GUARD` | Yes                       | Swap to Redis storage if multi-instance (operation-service will run replicas — see plan §5.2 module-wiring template takeaway) |
  | Health check fan-out shape          | Yes — pattern             | Swap DB/queue-specific sub-checks per service                                                                                 |
  | `ApiKeyGuard`                       | **No**                    | That's service-to-service auth; `JwtAuthGuard` (this session) is a different, user-facing guard built fresh                   |
  | Single-service `railway.toml`       | Yes, until load-justified | Don't pre-emptively split gateway/worker                                                                                      |

- **Preliminary finding, re-verify at CONFIRM — the F6 reference docs likely don't exist:**
  the plan's own flag (§5, 🚩) names three docs it expected to find but didn't while writing
  the plan (`auth-migration-recommendation.md`, `auth-migration-strategy.md`,
  `auth-implementation-roadmap.md`). A full-repo filename search this session (`find` for
  each of the three names, case-insensitive) returned **zero matches**. If this holds at
  CONFIRM, F6's "locate and read those three docs" sub-task is a no-op and the decision
  rests entirely on the plan's own pre-made recommendation (bridge-first, §5) plus this
  session's own judgment — don't spend time re-searching for files that don't appear to
  exist unless CONFIRM's fresh search finds something this one didn't.
- **Concrete technical landmine, found this session, worth flagging prominently — NextAuth's
  JWT is encrypted (JWE), not a plain signed JWT, as currently configured:**
  `lib/auth/auth-options.ts` sets `session.strategy: 'jwt'` (line 323) but defines **no**
  custom `jwt.encode`/`jwt.decode` pair. `next-auth@4.24.5`'s default behavior for
  `strategy: 'jwt'` with no custom encode/decode is to **encrypt** the session token as a
  JWE (`A256GCM`, via `jose`), not to sign a plain JWT. A NestJS `JwtAuthGuard` built the
  "standard" way (`@nestjs/jwt` + `passport-jwt`, `jwt.verify(token, NEXTAUTH_SECRET)`)
  will **fail to verify this token** — it isn't a signed JWT at all, it's an encrypted
  payload, and `jwt.verify()` expects the former. F7 (HS256 vs JWKS) as currently phrased
  ("shared secret vs JWKS") implicitly assumes a signed token; this finding means F7's real
  first decision is **signed vs encrypted**, not just the signing algorithm. Two paths, both
  viable, need Davin/Advisor judgment: (a) add a custom `jwt.encode`/`decode` pair to
  `auth-options.ts` that switches to a plain HS256-signed JWT (matches the plan's informal
  "NextAuth issues JWTs, Nest validates same secret" framing literally, but is itself an
  auth-semantics change to a live file — `CLAUDE.md` Non-negotiable 5 territory, needs
  explicit escalation); or (b) build `JwtAuthGuard` to decrypt the JWE directly (`jose`'s
  `jwtDecrypt`, same `NEXTAUTH_SECRET`-derived key NextAuth itself uses — no auth-options.ts
  change, but ties `operation-service` to `next-auth`'s specific JWE key-derivation scheme,
  a NextAuth-internal implementation detail, not a documented public contract). This session
  must choose one, record it as F7's resolution with real evidence (a token round-trip test:
  issue via NextAuth, verify via the guard), not assume.
- **`session.jwt` callback's actual claim set, confirmed live** (`lib/auth/auth-options.ts:436-503`):
  NextAuth's default merge adds standard `sub`/`email`/`name`/`picture`/`iat`/`exp`/`jti`;
  the app's own callback additionally sets `token.id`, `token.tier`, `token.role`,
  `token.isAffiliate`. The playbook's shorthand ("claims: sub/email/role/tier") is
  directionally right but imprecise — `role`/`tier` are custom claims this app added, not
  standard ones, and `id` (not `sub`) is the app's own user-id claim (though `sub` is also
  present, standard, and should also equal the user id per NextAuth's own convention — worth
  confirming they match, not assuming). `JwtAuthGuard`'s claim-extraction should target the
  real claim names confirmed here, not the playbook's paraphrase.
- **`NEXTAUTH_SECRET` is not yet available to any Railway service** — `docs/secret-matrix.md`
  currently scopes it to the web app's own env files only (`.env.example`, `.env`,
  `.env.local`, `docker-compose.yml` (web)). The playbook's own "You provide" line for this
  session names exactly this gap. **Blocking entry criterion** — see below.
- **`operation-service/` does not exist yet** — confirmed via `ls` this session. This is a
  from-scratch scaffold, not a port of existing code (no monolith code currently implements
  this — Phase 4's later BUILD sessions port monolith logic INTO this skeleton once it
  exists; this session only builds the skeleton + auth guard).
- **A later session already depends on this one's output:**
  `4B-2-alert-engine.migration-order.md` (a worked-example order, not yet active) lists
  "operation-service skeleton deployed (from 3-1), Railway Redis attached, staging env live"
  as one of its own entry criteria — whatever this session ships needs to actually satisfy
  that, not just the narrower `/health-auth` smoke test.

## Entry criteria

- [x] Phase 2's actual production-deploy status re-confirmed with Davin — **CONFIRMED LIVE**:
      Davin states Phase 2 (Session 2-4 + F22) is deployed and live in production, 2026-07-21.
- [x] Davin has granted `NEXTAUTH_SECRET` access to the new `operation-service` Railway
      service — **RE-SEQUENCED, not blocking**: Davin approved treating this as a post-scaffold
      step (can't grant access to a service that doesn't exist yet). Service is created in
      Step 3; Davin injects the secret directly via Railway (dashboard or his own CLI session)
      as part of Step 6 — Claude does not handle the raw value (see Rules addendum).
      `docs/secret-matrix.md` updated once granted.
- [x] Railway dashboard/CLI access for creating a new service in the `trading-alerts`
      project confirmed available in this environment — verified at CONFIRM: `railway whoami`
      succeeds (RipperAke), `trading-alerts` project reachable, and its existing `pgbouncer`
      service's deployment metadata shows `cliCaller: claude_code` from a prior session
      (this credential has created services here before).
- [x] `docs/railway-gateway-reference-notes.md` re-read in full at CONFIRM — done (241 lines).
- [x] Fresh full-repo search for the 3 F6 reference docs re-run at CONFIRM — **found all 3**
      (`backend-stack-a/hybrid-authentication-for-backend-stack-a/`, committed 2026-02-02,
      predates this migration; the PRE-DRAFT's "zero matches" claim was wrong, not stale).
      Davin reviewed and explicitly disregards them as superseded exploratory material —
      F6 stands as resolved (bridge-first).
- [ ] **New, found at CONFIRM, not in original criteria — unresolved:** Step 5/Done-when's
      "staging" deploy target assumes CC-A's dedicated staging stack (plan §13: separate
      Postgres/Redis/Railway environment) exists. It doesn't — Phase 0's CC-A gap is still
      open, only required live before Phase 4, and `trading-alerts` currently has one Railway
      environment (`production`). Needs Davin's call before Step 5/6 touch Railway — see
      Deviations. Steps 1-4 (decisions, F7 verification, local scaffold, guard + unit tests)
      do not depend on this and proceed now.
- [ ] Blast-radius statement: this session creates new infrastructure and modifies
      `lib/auth/auth-options.ts` only if path (a) above (custom JWT encode/decode) is
      chosen — that specific change is auth-semantics-touching and needs its own explicit
      Davin sign-off before implementation, not just before this order's approval. NextAuth
      on Vercel must keep working unchanged throughout (dual-running is the whole point of
      "bridge first" — a regression here breaks every existing logged-in user).

## Ordered steps

1. **Decision step (F6) — auth strategy.** Sources: plan §5 (the pre-made recommendation:
   bridge-first, replace later), the 3 referenced docs if CONFIRM's search finds them
   (unlikely per this PRE-DRAFT's search), `backend-stack-a/hybrid-authentication-for-
backend-stack-a/SUMMARY_hybrid-jwt-based-authentication-clarification-and-implementation.md`
   (cited in the plan as the auth-decisions source). Output: a Decision Log entry for F6,
   confirming or amending "bridge first" as the actual approach for this session.
   _Verify:_ Davin's sign-off recorded verbatim (F6 is his call per the plan's flag table).
2. **Decision step (F7) — signing/verification mechanism.** This is where the JWE-vs-signed
   finding above must be resolved, not just "HS256 vs JWKS" as originally phrased. Present
   both paths (custom encode/decode → plain HS256 JWT, or JWE decryption in the guard) with
   a real token round-trip test as evidence for whichever is chosen. Output: Decision Log
   entry for F7.
   _Verify:_ a token issued by the live (or locally-run) NextAuth flow is successfully
   verified by a standalone script using the chosen mechanism, BEFORE building the full
   NestJS guard around it — cheaper to fail fast here than mid-guard.
3. **Scaffold step — `operation-service` NestJS 11.1.28 skeleton.** Copy railway-gateway's
   copyable patterns per the table above: `PrismaModule`/`PrismaService` (pointed at
   `prisma/non-market-data/schema.prisma`, generate-only — same "must byte-match, no
   automated check" caveat as railway-gateway's own schema, worth deciding whether to close
   that gap here or defer), global `ThrottlerGuard` via `APP_GUARD` (Redis-backed from the
   start, since this service runs replicas — unlike railway-gateway's single-instance
   in-memory choice), health-check fan-out shape, single-service `railway.toml` until load
   justifies a split.
   _Verify:_ `npm run build` (NestJS) succeeds; service boots locally against a real
   (non-production) Postgres connection.
   _Rollback:_ delete the new `operation-service/` directory and any created Railway
   service — nothing else in the repo depends on its existence yet (confirmed via the
   4B-2 dependency note above, which is itself not-yet-active).
4. **Implement step — `JwtAuthGuard`.** Verifies the NextAuth-issued token per step 2's
   chosen mechanism; extracts the real claim set confirmed above (`id`/`sub`, `email`,
   `tier`, `role`, `isAffiliate`); attaches a typed request-user object for downstream
   guards/decorators (`RolesGuard`, per plan §5, is a later session's concern — this one
   only needs the base guard).
   _Verify:_ unit tests — valid token → request proceeds with correct claims attached;
   expired/malformed/wrong-secret token → 401, not a 500 or silent pass-through.
5. **Denial-test step — `/health-auth` endpoint.** A minimal protected route using the new
   guard, per the playbook's own "done when."
   _Verify:_ deployed to Railway staging; `curl` with a real NextAuth-issued JWT (obtained
   from a real login against the current Vercel deployment or local dev) → 200; without a
   token, or with a garbage token → 401.
6. **As-code step.** `operation-service/railway.toml` (or Railway's newer config
   mechanism — check current CLI conventions, don't assume `railway.toml` is still primary)
   committed, not dashboard-configured; secret matrix updated for `NEXTAUTH_SECRET`'s new
   scope and any new env vars this service needs (`DATABASE_URL` — same production Postgres
   per plan §1, `REDIS_*` if the Redis-backed throttler needs its own connection).
   _Verify:_ re-running the deploy config is a no-op (idempotent).

## Rules specific to this variant

- **Nothing dashboard-only** — every setting lands in a committed file or the secret matrix
  (INFRA rule, applies in full).
- **Never break the always-on paths** — NextAuth on Vercel must keep issuing/validating
  sessions exactly as today throughout this session; `operation-service` is purely additive.
  State explicitly, per step, how each avoids touching the live Vercel auth path.
- Production changes (if step 2 requires editing `auth-options.ts`) only after the identical
  change is verified in a non-production environment first, and only with Davin's explicit
  sign-off on that specific file change (Non-negotiable 5) — separate from the order's own
  APPROVAL, since that approval covers the order's plan, not a live auth-semantics edit
  discovered mid-session.
- Secrets: `NEXTAUTH_SECRET`'s value never appears in a CLI arg, script output, or commit —
  match Session 1-3b's `railway variable set --stdin` pattern exactly.
- **Addendum, set at CONFIRM:** Claude does not type, pipe, or otherwise handle the raw
  `NEXTAUTH_SECRET` value itself, even via CLI, even with Davin's authorization — this is a
  standing operating constraint, not order-specific. For local F7 round-trip verification
  (step 2), Claude reads it only indirectly via the existing local `.env.local` (already
  present for dev use, never printed/logged). For the Railway grant (step 6), Davin performs
  the `railway variables set` (or dashboard entry) himself; Claude verifies the grant
  succeeded (e.g. a boolean health-check response) without ever seeing the value.

## Done when

- [ ] A protected NestJS `/health-auth` endpoint on staging returns 200 with a real
      NextAuth-issued JWT, 401 without (the playbook's literal exit test).
- [x] F6 and F7 both resolved in `DECISION-LOG.md`, Davin's sign-off quoted for both.
- [ ] `operation-service/railway.toml` (or current equivalent) committed; secret matrix
      updated; `migration-stack-analysis.md` gets a new `operation-service/` entry.
- [ ] NextAuth on Vercel re-verified unregressed (a real login still works end-to-end)
      after any `auth-options.ts` change, if step 2 required one.

## Rollback

Whole-session rollback: delete the `operation-service` Railway service and local directory;
revert any `auth-options.ts` commit. Nothing else in the live system depends on this
session's output yet (Session 3-2 depends on it, but hasn't run). Low blast radius by
construction — additive-only per the Rules above.

## Deviations

- **CONFIRM, 2026-07-21:** Found the Step 5/Done-when "staging" deploy target assumes CC-A's
  dedicated staging stack (plan §13), which doesn't exist yet (Phase 0 gap, only required
  live before Phase 4; `trading-alerts` Railway project currently has one environment,
  `production`). Not resolved yet — proceeding with Steps 1-4 (no Railway dependency) while
  this is open; Steps 5-6 pause for Davin's direction on the actual deploy target before any
  Railway service is created.

## Next-session handoff

_Per the playbook, Session 3-2 ("Token endpoints") implements `/auth/login`, `/auth/
register`, `/auth/refresh`, `/auth/logout`, `/auth/me` in NestJS, reusing `lib/auth/*`
logic, with Prisma-backed refresh-token persistence — depends directly on this session's
`operation-service` skeleton and resolved F6/F7 existing first._

# Migration Order — INFRA variant (+ CONTRACT block for F13)

> For sessions that **provision or configure live systems** and build shared cross-cutting Nest
> infrastructure. Read `00-SKELETON-AND-RULES.md` first — §4 applies. **Creativity dial: Medium**
> (the approach is flexible; F13's actual backend choice is Davin's, not the Executor's).

**Session:** 4B-4 · **Variant:** INFRA + CONTRACT (F13) · **Status:** PRE-DRAFT
**Generated:** 2026-08-01 (Executor, at 4B-3's close, per `EXECUTOR-PROTOCOL.md` §3.5)
**Flags touched:** none yet — **F13** (Observability/tracing backend) is this session's own
central open decision, `DECISION-LOG.md` currently OPEN ("due by first Phase 4 cutover" — a
deadline already passed several cutovers ago; carried forward, not newly missed by this session).
**Estimated time:** unknown — depends heavily on which way F13 is resolved (a managed SaaS
backend is likely much faster than self-hosting Jaeger/Tempo).

**Per the session playbook** (`monolith-to-microservices-migration-session-playbook.md`, Phase 4B
section): _"Session 4B-4 — Shared infra: redis/cache/logger/errors/monitoring as Nest providers +
interceptors; OTel + correlation-ID middleware (F13 resolved here if not earlier)."_ This is a
genuinely distinct session from **4B-17 (Realtime, F8)** — confirm this distinction was checked
directly against `DECISION-LOG.md`'s own flag register this session, not assumed: F8 is registered
separately, "OPEN — due Session 4B-17." Do not conflate the two.

---

## Entry criteria

- [x] Session 4B-3 CONFIRMED and closed (2026-08-01) — Slice 6 CUT-OVER & LIVE, monolith
      alert-engine files retired, `tsc`/`test:ci` 100% green.
- [ ] **F13 (Observability/tracing backend) resolved — Davin's call, not the Executor's.** No
      tracing backend is chosen or provisioned anywhere in this codebase today (verified: no
      `@opentelemetry/*` dependency in either service's `package.json`, no APM/tracing env vars in
      either service's Railway variables as of this PRE-DRAFT). Real options, for Davin to choose
      from at CONFIRM (not an exhaustive list — the Advisor may add more):
  - **Option A — Managed SaaS** (e.g., Honeycomb, Datadog APM, Grafana Cloud Tempo): fastest to
    stand up, ongoing cost, no new Railway service to operate.
  - **Option B — Self-hosted** (Jaeger or Grafana Tempo as a new Railway service, alongside
    existing Postgres/Redis add-ons): no recurring SaaS cost, but a new service to provision,
    monitor, and keep healthy — this migration has no staging environment (F34/CC-A gap) to
    rehearse it in first.
  - **Option C — Defer again**: ship OTel SDK instrumentation + correlation-ID middleware now
    (useful on its own via structured logs), point the exporter at nothing/stdout, and pick a real
    backend in a later session. Matches this migration's established pattern of resolving the
    logging/correlation-ID piece narrowly first (4B-2's `alert-engine.logger.ts`) and deferring
    the backend.
- [ ] Davin confirms which of `money-service`'s existing pieces are the intended baseline to
      generalize, vs. which get rebuilt fresh — see Deviations-equivalent note below; this
      PRE-DRAFT does not assume an answer.

---

## What already exists (verified this session, not assumed — read before writing any code)

- **Logging:** `operation-service/src/alert-engine/alert-engine.logger.ts` — a **pino**-based
  wrapper, built narrowly at Session 4B-2 for per-fire correlation-ID logging inside
  `DispatcherService.dispatch()` only, explicitly scoped narrow at the time ("not a repo-wide
  `Logger` replacement... out of this PORT session's scope"). This is the first and only pino
  usage in either service. `money-service/src/common/logger.util.ts` exists separately and is
  **not** pino-based (uses Nest's built-in `Logger` or console, needs confirming at CONFIRM) — the
  two services currently have two different, unreconciled logging approaches.
- **Redis:** `operation-service/src/redis/{redis.module.ts,redis.service.ts}` — a `@Global()`
  singleton client, built at 4B-2, mirrors `lib/redis/client.ts`'s connection options. No
  equivalent dedicated Redis module was found under `money-service/src/` at a quick pass — confirm
  at CONFIRM whether money-service has its own inline Redis usage (e.g., for its throttler) that
  should be generalized to match, or is already using something else entirely.
- **Cache:** no dedicated cache abstraction exists in either service today (distinct from Redis as
  a raw client) — this is new work, not a generalization of something existing.
- **Errors:** no shared error-interceptor/filter module found under either service's `common`/
  equivalent directory at a quick pass — `money-service/src/common/` currently holds only
  `idempotency/` and `logger.util.ts`. Confirm at CONFIRM whether error handling is centralized
  anywhere (e.g., a global `ExceptionFilter`) or left to each controller today.
- **Monitoring/health:** both services already have their own `health/` module
  (`operation-service/src/health/`, presumably mirrored in `money-service/src/health/`) — confirm
  whether "monitoring" in the playbook's scope means extending these, or something separate
  (metrics export, uptime dashboards).
- **Domain-specific logger, NOT in scope to touch:** `money-service/src/disbursement/
transaction-logger.service.ts` — a business-logic logger for disbursement transactions, unrelated
  to this session's cross-cutting infra goal. Do not fold it into the shared logger without
  checking first whether its callers expect its current specific shape.

---

## Proposed Ordered steps (subject to Advisor DRAFT revision)

1. **Resolve F13** (Davin, live) — pick Option A/B/C above (or another). Record in
   `DECISION-LOG.md` with full rationale, same as every other F-numbered resolution this
   migration.
2. **Generalize the pino logger** — promote `alert-engine.logger.ts`'s pattern to a shared
   provider consumed by both services (likely via `@trading-alerts/types`-style shared package, or
   independently duplicated with parity per the money-service convention — Davin/Advisor to pick,
   this is itself worth a small CONTRACT-style note in the DRAFT). Wire correlation-ID middleware
   repo-wide (both services), not just the one `dispatch()` call site 4B-2 scoped it to.
   _Verify:_ a real request/job through each service produces a log line carrying the same
   correlation ID across at least two log statements in that request's lifecycle.
3. **Build a shared cache abstraction** over the existing Redis clients (both services) — exact
   shape TBD by the Advisor's DRAFT; likely a thin `CacheService` wrapping get/set/ttl over the
   existing `RedisService`/`lib/redis/client.ts` connections, not a new Redis instance.
   _Verify:_ a real cache write + read round-trips in both services.
4. **Build a shared error-handling interceptor/filter** — standardize error response shape across
   both services' controllers (check first whether one already exists ad hoc, per the note above).
   _Verify:_ an intentionally-thrown error in each service produces the same response shape.
5. **Wire OTel SDK instrumentation** (both services) — spans for at least: incoming HTTP request,
   outgoing Prisma query, outgoing Redis command. Exporter target depends on Step 1's outcome.
   _Verify:_ a real request produces a trace visible in whatever backend Step 1 chose (or, under
   Option C, a structured span log to stdout).
6. **Update `docs/secret-matrix.md`** with any new env vars (tracing endpoint/API key, etc.) —
   never commit real values, names + `.env.example` only, per this repo's own standing convention.

---

## Rules specific to this variant

- Nothing dashboard-only — any new Railway service (if Option B) lands in a committed
  `railway.toml`/equivalent, matching `LESSONS-LEARNED.md`'s now well-established lesson that a
  `railway.toml` service block alone doesn't provision anything (Session 4B-3) — this session must
  verify the resulting service is real via `railway service list`, not just the config file.
- Do not touch `lib/websocket/server.ts`, `lib/alert-engine/notify-bridge.ts`, or
  `lib/alert-engine/types.ts` — those stay in the monolith by design until Session 4B-17 (F8), per
  4B-3's own close-out note in `CLAUDE.md`.
- Do not touch `money-service/src/disbursement/transaction-logger.service.ts` (see note above).
- Money/auth/secrets rules unchanged — any new Railway/Vercel env var still needs Davin's own
  action to set the real value; the Executor documents names only.

## Done when

- [ ] F13 resolved and recorded in `DECISION-LOG.md`
- [ ] Shared logger + correlation-ID middleware live in both services, verified with a real
      cross-log-line correlation-ID match
- [ ] Cache abstraction built and verified round-tripping in both services
- [ ] Error-handling interceptor built and verified producing a consistent shape
- [ ] OTel instrumentation live, a real trace/span observed against whatever F13 chose
- [ ] `docs/secret-matrix.md` updated for any new env vars
- [ ] Both services' full test suites green, `tsc --noEmit`/`nest build` clean, monolith untouched
      and still 100% green

## Rollback

Each provider/interceptor is additive (new modules, not edits to existing request-handling logic)
— revert is `git revert` per commit. If Option B (self-hosted tracing backend) was chosen and
needs to be torn down, remove its `railway.toml` service block and delete the Railway service via
`railway service delete` (needs Davin's live confirmation, an infra-deletion action).

## Deviations

_(filled during execution)_

## Next-session handoff

_(DRAFT for whichever of 4B-5…16's domain slices comes first — alerts CRUD is named first in the
playbook's own ordering. Not pre-drafted yet; depends on how 4B-4 actually lands.)_

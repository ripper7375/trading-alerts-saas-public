# Migration Order: Alerts CRUD Port to operation-service (Session 4B-5)

> Migration Order for Session **4B-5** (Alerts CRUD API Port — BUILD).
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable; the source code is ground truth).
> Target Service: `operation-service` (`src/alerts/` module).

**Session:** 4B-5 (BUILD) — cutover is a separate follow-up session after transport layer
**Phase / plan section:** Phase 4B step 5, plan §6
**Target service:** `operation-service`
**Variant:** PORT · **Status:** CONFIRMED (2026-08-01)
**Generated:** 2026-08-01 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-01). Arrived as an
uncommitted rewrite of the committed PRE-DRAFT (`3a8d8c13`) with no DRAFT→APPROVED commit trail —
`LESSONS-LEARNED.md` L11, 12th occurrence. First CONFIRM pass (reported in chat) found the line
counts, tier-quota numbers, and Files 1-2's invented Redis-publish claim didn't match live SOURCE;
the order file was then corrected in place (also uncommitted) to match — re-verified line-by-line
below and one further discrepancy found and fixed (File 2's DELETE description). Resolved by Davin
authorizing execution directly in chat, the same resolution method as every prior L11 occurrence.
**Flags touched:** `MIGRATE_ALERTS_CRUD` (default `false`, defined at transport build time)
**Contract:** Parity with 4 monolith API route files (971 lines total): `app/api/alerts/route.ts` (244 lines), `app/api/alerts/[id]/route.ts` (304 lines), `app/api/alerts/line/route.ts` (235 lines), `app/api/alerts/line/[id]/route.ts` (188 lines). Preserves FREE tier 403 lock, PRO tier max 100 alert quota, XAUUSD/M5-M15 locks, PRO tier restrictions for line alerts, atomic `Alert`+`DrawingAlert` creation, and `alerts:changed` Redis invalidation publishing for line alerts only.
**Estimated session time:** ~3.0h

---

## Entry criteria

- [x] Session 4B-4 CONFIRMED and closed (2026-08-01) — Shared infra (Pino logging, `x-correlation-id` middleware, `CacheService`, `AllExceptionsFilter`, OTel SDK) live in `operation-service`.
- [x] `operation-service` owns Prisma models: `Alert`, `DrawingAlert`, `Drawing` mirrored in Session 4B-2. Zero DB migrations or schema changes needed for 4B-5.
- [x] Geometry math (`levelsForMark`, `MarkSnapshot`) available from `@trading-alerts/types/geometry` (Session 4B-1, F9).
- [x] `JwtAuthGuard` available in `operation-service/src/auth/jwt-auth.guard.ts` (Session 3-1, F7).
- [x] Auth mechanism audited: `getSession()` (used in `/alerts`) is a try/catch wrapper around `getServerSession(authOptions)` (used in `/alerts/line`). Both map 1:1 to `JwtAuthGuard` + `@Req() req: AuthenticatedRequest` in `operation-service`.
- [x] File inventory below re-verified against live codebase (`wc -l` verified: 244 + 304 + 235 + 188 = 971 lines total).

---

## Integration points

- **In:** HTTP client/proxy → `operation-service` (`AlertsController` & `LineAlertsController`).
- **Out:** Prisma DB (`Alert`, `DrawingAlert`, `Drawing`), Redis `alerts:changed` invalidation channel for line alerts (consumed by `AlertWorkerService` live worker).
- **Owns:** Alerts CRUD domain logic in `operation-service`.

---

## File Port Order

### Step 0: Dependency Hoisting & Module Setup

- **TARGET:** `@trading-alerts/types` (or `operation-service/src/alerts/dto/`) & `operation-service/src/alerts/alerts.module.ts`
- **Actions:**
  - Hoist line-alert validation schemas (`AlertAttachZ`, `AlertUpdateZ`) from `lib/drawing/schema.ts` and `getAlertLimit` from `lib/tier-validation.ts` into `@trading-alerts/types/validations/alert.ts` (or define in `operation-service/src/alerts/dto/line-alert.dto.ts`).
  - Create NestJS `AlertsModule` importing `PrismaModule` and `RedisModule`.
- **Parity proof:** `tsc --noEmit` clean in `packages/types` and `operation-service`.
- **Commit:** `feat(alerts): hoist line-alert schemas and set up AlertsModule in operation-service`

---

### File 1/4: Plain Alerts List & Create (GET / POST /api/alerts)

- **SOURCE:** `app/api/alerts/route.ts` (244 lines)
- **TARGET:** `operation-service/src/alerts/alerts.controller.ts` (`GET /alerts`, `POST /alerts`) & `alerts.service.ts`
- **Kind:** port + adapt (NextRequest/NextResponse → NestJS `@Controller('alerts')` with `JwtAuthGuard`)
- **Port steps:**
  - Port `GET /alerts` with status and symbol filtering.
  - Port `POST /alerts` validating `createAlertSchema` (XAUUSD symbol lock, M5/M15 timeframe lock, price_above/price_below/price_equals condition types).
  - Enforce tier quota validation matching ground truth: FREE tier is hard-blocked at 0 (returns 403 `{"error": "Alerts are a PRO feature"}`); PRO tier limit is 100 (`PRO_TIER_CONFIG.maxAlerts = 100`).
  - Note: Plain alerts do NOT publish to `alerts:changed` in source; preserve this ground truth (do NOT add an unconsumed Redis publish call).
- **Invariants:** Preserve error messages and status codes (400 for invalid symbol/timeframe, 403 for FREE tier or PRO quota exceeded, 401 for unauthorized).
- **Parity proof:** Port `__tests__/api/alerts.test.ts` GET/POST test cases to `src/alerts/alerts.controller.spec.ts`; tests pass green.
- **Commit:** `migrate(alerts): port GET and POST /alerts to operation-service`

---

### File 2/4: Plain Alert Detail, Update & Soft Delete (GET / PATCH / DELETE /api/alerts/[id])

- **SOURCE:** `app/api/alerts/[id]/route.ts` (304 lines)
- **TARGET:** `operation-service/src/alerts/alerts.controller.ts` (`GET /alerts/:id`, `PATCH /alerts/:id`, `DELETE /alerts/:id`) & `alerts.service.ts`
- **Kind:** port + adapt (NextRequest → NestJS route parameters `@Param('id')`)
- **Port steps:**
  - Port `GET /alerts/:id` with user ownership check (`userId === session.user.id`). Return 404 if not found or unauthorized.
  - Port `PATCH /alerts/:id` updating `isActive`, `name`, `targetValue`. Enforce PRO tier check (FREE users post-downgrade receive 403).
  - Port `DELETE /alerts/:id` as a **hard delete** (`prisma.alert.delete()`) — **corrected at CONFIRM**:
    the SOURCE file's own JSDoc header and an inline comment both claim "soft delete
    (isActive = false)," but the actual executed statement is `prisma.alert.delete({ where: { id } })`.
    Per L12 (a comment isn't the contract, the code is) and this PORT session's LOW dial, the real
    hard-delete behavior is what gets ported — not the stale comment.
  - Plain alerts do NOT publish to `alerts:changed` in source; preserve this ground truth.
- **Invariants:** Strict user ownership isolation; FREE tier blocked on PATCH (403); DELETE is a real
  hard delete, not soft.
- **Parity proof:** Port `__tests__/api/alerts.test.ts` detail/patch/delete test cases; tests pass green.
- **Commit:** `migrate(alerts): port GET, PATCH, and DELETE /alerts/:id to operation-service`

---

### File 3/4: Line Alerts List & Attach (GET / POST /api/alerts/line)

- **SOURCE:** `app/api/alerts/line/route.ts` (235 lines)
- **TARGET:** `operation-service/src/alerts/line-alerts.controller.ts` (`GET /alerts/line`, `POST /alerts/line`) & `line-alerts.service.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Port `GET /alerts/line` filtering by symbol and timeframe.
  - Port `POST /alerts/line` validating `AlertAttachZ` schema and checking drawing type (reject `TEXT` drawings with 400).
  - Validate `targetLevel` against `levelsForMark` from `@trading-alerts/types/geometry`.
  - Enforce PRO tier requirement for line alerts (FREE users receive 403).
  - Execute `Alert` + `DrawingAlert` creation atomically in `prisma.$transaction`.
  - Publish `alerts:changed` event to Redis channel via `RedisService` (preserved verbatim from source to notify `AlertWorkerService`).
- **Invariants:** Non-alertable `TEXT` drawings rejected; atomic `$transaction` write; geometry level validation preserved; `alerts:changed` Redis event published.
- **Parity proof:** Port `__tests__/drawing/alertsApi.test.ts` attach test cases to `src/alerts/line-alerts.controller.spec.ts`; tests pass green.
- **Commit:** `migrate(alerts): port GET and POST /alerts/line with geometry validation to operation-service`

---

### File 4/4: Line Alert Update & Delete (PATCH / DELETE /api/alerts/line/[id])

- **SOURCE:** `app/api/alerts/line/[id]/route.ts` (188 lines)
- **TARGET:** `operation-service/src/alerts/line-alerts.controller.ts` (`PATCH /alerts/line/:id`, `DELETE /alerts/line/:id`) & `line-alerts.service.ts`
- **Kind:** port + adapt (`:id` is `DrawingAlert.id`)
- **Port steps:**
  - Port `PATCH /alerts/line/:id` for rule updates & pause/resume. Enforce PRO tier check (FREE users post-downgrade cannot update or re-enable, returning 403).
  - Port `DELETE /alerts/line/:id` removing `DrawingAlert` and associated `Alert`. DELETE remains available to FREE users post-downgrade.
  - Traverse ownership via `DrawingAlert -> Drawing -> userId`.
  - Publish `alerts:changed` event to Redis channel via `RedisService`.
- **Invariants:** FREE tier blocked on PATCH (403), allowed on DELETE (200); ownership verified via `Drawing.userId`; `alerts:changed` Redis event published.
- **Parity proof:** Port `__tests__/drawing/alertsApi.test.ts` update/delete test cases; tests pass green.
- **Commit:** `migrate(alerts): port PATCH and DELETE /alerts/line/:id with PRO tier enforcement to operation-service`

---

## Rules specific to this variant

- Dial: **LOW** — code logic, status codes, error payloads, and ownership semantics preserved verbatim.
- Changing a ported assertion requires a written explanation in Deviations (L3).
- `JwtAuthGuard` enforces NextAuth session authentication across all 4 route controllers.
- No monolith files modified in this session (BUILD only).

---

## Slice-level verification (done when)

- [x] All 4 route files ported into `operation-service/src/alerts/`.
- [x] Ported/authored unit tests green in `operation-service` (42 new tests — see Deviations on
      Files 3-4's parity-proof citation not actually covering server route logic).
- [x] `operation-service` `nest build` and `tsc --noEmit` clean.
- [x] Monolith untouched (`git status` confirms zero files touched under `app/`, `lib/`,
      `__tests__/`, `components/`) and `tsc --noEmit` clean. Full `test:ci` NOT independently
      re-run this session (nothing in its dependency tree changed — same reasoning as 4B-4's own
      close); last recorded state remains 118/118 suites green.
- [x] 4 core invariants verified: XAUUSD/M5-M15 lock (tested), TEXT-drawing rejection (tested as the
      general `levelsForMark()` zero-levels case, not a hardcoded type check), FREE=0/PRO=100 tier
      quotas (tested, corrected from the order's originally-cited wrong numbers), Redis
      `alerts:changed` invalidation for line alerts only (tested; plain alerts deliberately do NOT
      publish — see Deviations).

---

## Rollback

Revert commits in `operation-service`. Zero monolith files or database schemas touched.

---

## Deviations

1. **Order provenance (L11, 12th occurrence).** Arrived as an uncommitted rewrite of the committed
   PRE-DRAFT with no DRAFT→APPROVED commit trail. First CONFIRM pass (reported in chat) found the
   line counts, tier-quota numbers, and Files 1-2's Redis-publish claim didn't match live SOURCE;
   Davin then corrected the order file in place to match (also uncommitted) and authorized execution
   directly in chat — resolved the same way as every prior L11 occurrence.
2. **File 2's DELETE description corrected.** The order (both versions) said `DELETE /api/alerts/[id]`
   does a "soft delete (`isActive = false`)" — the SOURCE file's own JSDoc header and an inline
   comment both make this claim, but the actually-executed statement is `prisma.alert.delete()`, a
   real hard delete. Per L12 (a comment isn't the contract) and this PORT session's LOW dial, ported
   the real hard-delete behavior.
3. **Two independent "create alert" Zod schemas already existed in this codebase; neither this
   session's DTOs nor Step 0's own text fully accounted for this.** `app/api/alerts/route.ts` and
   `app/api/alerts/[id]/route.ts` validate against their OWN route-local, inline `z.object()` schemas
   (3 condition types: `price_above`/`price_below`/`price_equals`; no `notes`/`enabled`/
   `notifyEmail`/`notifyPush` fields) — these are DIFFERENT from `@trading-alerts/types`'s
   `createAlertSchema`/`updateAlertSchema` (5 condition types incl. `price_crosses_above`/
   `price_crosses_below`, extra fields), which is a separate schema used by the already-ported
   alert-engine's internal validation (Session 4B-2). Step 0's "wrapping existing
   `@trading-alerts/types` validation schemas" assumed one schema pair covers both consumers; it
   doesn't. Built a new, local `operation-service/src/alerts/alerts.schemas.ts` matching the ROUTE's
   real (narrower) validation instead of reusing the broader hoisted one — using the wrong one would
   have silently accepted `conditionType` values the real SOURCE route rejects with 400.
4. **`AlertAttachZ`/`AlertUpdateZ`/`getAlertLimit` hoisted into `@trading-alerts/types`, matching the
   established single-source-of-truth precedent.** They existed only in the monolith-only
   `lib/drawing/schema.ts`/`lib/tier-validation.ts` before this session (`ALERT_TIER_LIMITS` there is
   a minimal, alert-quota-only slice of `lib/tier-config.ts` — pricing/trial/rate-limit config stays
   monolith-only, out of scope). **A second, real gap found while hoisting:** `operation-service`
   does not actually consume the root `packages/types` at all — it has its own separately embedded,
   git-tracked copy at `operation-service/packages/types/` (commit `87242f09`, "embed packages/types
   locally for Railway single-directory upload" — the fix for the long-standing Railway-packaging
   risk, CLAUDE.md Waiting-on #79/#80). The root hoist alone left `operation-service`'s copy stale;
   synced the one changed file (`validations/alert.ts`) into the embedded copy and rebuilt it. This
   embedded-copy mechanism has no automated sync — any future change to the root `packages/types`
   that `operation-service` needs will require the same manual re-sync step. Worth a future session
   building a real sync script or CI check rather than relying on each session's author to remember.
5. **Tier-quota numbers corrected against live SOURCE** (already reflected in the order file's own
   corrected text, re-verified here): FREE is hard-blocked at 0 alerts (`Alerts are a PRO feature`,
   unconditional 403), PRO's real limit is 100 — not the order's originally-drafted "FREE: 3 / PRO:
   50", which didn't match either `lib/tier-config.ts` or `lib/tier-validation.ts` (both independently
   confirmed FREE=0/PRO=100 before any code was written).
6. **Files 1-2 (plain alerts) do NOT publish to the `alerts:changed` Redis channel — ported as such,
   not added.** Verified directly: neither `app/api/alerts/route.ts` nor `app/api/alerts/[id]/route.ts`
   references Redis anywhere. Digging further: the live `AlertWorkerService.reload()` (the sole live
   real-time evaluator, cut over Session 4B-3) queries `prisma.drawingAlert.findMany(...)` only — it
   never reloads on plain `Alert` rows even if they did publish this signal. `app/api/drawings/[id]
/route.ts` (outside this order's scope) also publishes to this same channel "so the Phase 4 worker
   rebuilds affected watches," confirming the channel is scoped to the drawing/line-alert subsystem,
   not a general plain-`Alert` change notification. Adding an unconsumed publish call to Files 1-2
   would have been new behavior, not a port. **Flagged for a future session/Davin decision:** whether
   plain price alerts should become live-evaluable at all (they currently are not, by either
   mechanism) — out of this LOW-dial PORT session's own scope to decide unilaterally.
7. **No usable server-side test suite existed for Files 3-4 to "port" from — new tests authored
   instead (`LESSONS-LEARNED.md` L28 class).** The order's own cited "Parity proof,"
   `__tests__/drawing/alertsApi.test.ts`, tests a CLIENT-side `fetch` wrapper
   (`components/charts/drawing/alertsApi.ts`) that CALLS the line-alert routes from the browser — it
   contains zero assertions about the server route handlers' own logic (no PRO-gate test, no
   geometry/targetLevel validation test, no atomic-transaction test, no TEXT-rejection test, no
   Redis-publish test). Found while writing `line-alerts.service.spec.ts`. Authored 21 new tests
   directly against the real SOURCE route handlers (read in full) instead of porting nonexistent
   assertions.
8. **Error-response JSON envelope shape differs from the monolith by design — not reproduced
   byte-for-byte.** `operation-service`'s global `AllExceptionsFilter` (Session 4B-4) unifies every
   exception into `{statusCode, message, error, timestamp, path, correlationId?}`, extracting only
   `message`/`error` from a thrown exception's response payload — custom fields like the monolith's
   `code`/`upgradeUrl` do not survive it. Status codes (400/401/403/404/500) and the full
   human-readable message text are preserved exactly (put into the `message` field); the envelope
   shape itself follows this service's own already-established, session-4B-4-approved convention
   rather than the monolith's bespoke per-route shape — consistent with how every other ported
   module in this migration behaves. 401s are also now handled structurally by `JwtAuthGuard`
   (guaranteeing an authenticated caller before any handler runs) rather than a manual per-route
   session-null check, and uncaught errors fall through to the same global filter as a 500 instead of
   each handler's own try/catch — mechanism differs, observable behavior (unexpected error → 500) is
   the same.
9. **Auth-mechanism audit (entry criterion, re-verified directly against SOURCE, not just trusted):**
   `getSession()` (`lib/auth/session.ts:29`, used by Files 1-2) is a try/catch wrapper around
   `getServerSession(authOptions)` that swallows errors and returns `null`; Files 3-4 call
   `getServerSession(authOptions)` directly and let errors propagate. Functionally equivalent for
   this port's purposes (`JwtAuthGuard` covers both), but not literally "1-line" as an earlier draft
   of the order claimed — noted for the record.
10. **New module `ZodValidationPipe`** (`operation-service/src/common/pipes/zod-validation.pipe.ts`)
    established this session, applied per-route via `@UsePipes()` rather than class-validator
    decorators for all 4 body-validated endpoints. Chosen because `AlertAttachZ`/`AlertUpdateZ` carry
    real default-value and cross-field `.refine()` behavior (e.g. "Nothing to update") that's the
    actual behavior to preserve, not something to safely hand-translate into decorators without risk
    of subtle drift. `main.ts`'s existing global class-validator `ValidationPipe` is untouched and
    stays the default for every other module (it no-ops on the plain/non-class parameter types used
    here, confirmed no conflict). This is a new, reusable pattern for future sessions needing to wire
    a `@trading-alerts/types` Zod schema into a NestJS route.

---

## Known wrinkles / do-not-touch

- **Two different auth-read mechanisms in the 4 SOURCE files** (`getSession()` vs `getServerSession(authOptions)` directly) — resolved: `getSession()` is a try/catch wrapper around `getServerSession(authOptions)`; both map 1:1 to `JwtAuthGuard` in `operation-service`.
- Do not touch `lib/websocket/server.ts`, `lib/alert-engine/notify-bridge.ts`, or `lib/alert-engine/types.ts` — those stay in the monolith by design until Session 4B-17 (F8), per 4B-3's close-out note in `CLAUDE.md`. The `alerts:changed` Redis publish these line-alert routes use is a DIFFERENT channel from the fired-alert notification bridge F8 governs.
- `SYMBOLS`/`TIMEFRAMES`/`PRO_TIER_CONFIG` (`lib/tier-config`) and line-alert validation schemas (`AlertAttachZ`, `AlertUpdateZ`) will be hoisted to `@trading-alerts/types` in Step 0.

---

## Next-session handoff

Session 4B-6 (Monolith Write-Transport & Proxy Layer for Alerts CRUD — `lib/operation-service/routes.ts` & `flags.ts`).

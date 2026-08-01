# Migration Order: Alerts CRUD Port to operation-service (Session 4B-5)

> Migration Order for Session **4B-5** (Alerts CRUD API Port — BUILD).
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable; the source code is ground truth).
> Target Service: `operation-service` (`src/alerts/` module).

**Session:** 4B-5 (BUILD) — cutover is a separate follow-up session after transport layer
**Phase / plan section:** Phase 4B step 5, plan §6
**Target service:** `operation-service`
**Variant:** PORT · **Status:** APPROVED
**Generated:** 2026-08-01 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-01)
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
  - Port `DELETE /alerts/:id` soft deleting (`isActive = false`).
  - Plain alerts do NOT publish to `alerts:changed` in source; preserve this ground truth.
- **Invariants:** Strict user ownership isolation; FREE tier blocked on PATCH (403).
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

- [ ] All 4 route files ported into `operation-service/src/alerts/`.
- [ ] Ported unit/integration tests green in `operation-service`.
- [ ] `operation-service` `nest build` and `tsc --noEmit` clean.
- [ ] Monolith untouched and 118/118 test suites green.
- [ ] 4 core invariants verified (XAUUSD/M5-M15 lock, TEXT drawing rejection, FREE=0 / PRO=100 tier quotas, Redis `alerts:changed` invalidation for line alerts).

---

## Rollback

Revert commits in `operation-service`. Zero monolith files or database schemas touched.

---

## Deviations

_(filled during execution)_

---

## Known wrinkles / do-not-touch

- **Two different auth-read mechanisms in the 4 SOURCE files** (`getSession()` vs `getServerSession(authOptions)` directly) — resolved: `getSession()` is a try/catch wrapper around `getServerSession(authOptions)`; both map 1:1 to `JwtAuthGuard` in `operation-service`.
- Do not touch `lib/websocket/server.ts`, `lib/alert-engine/notify-bridge.ts`, or `lib/alert-engine/types.ts` — those stay in the monolith by design until Session 4B-17 (F8), per 4B-3's close-out note in `CLAUDE.md`. The `alerts:changed` Redis publish these line-alert routes use is a DIFFERENT channel from the fired-alert notification bridge F8 governs.
- `SYMBOLS`/`TIMEFRAMES`/`PRO_TIER_CONFIG` (`lib/tier-config`) and line-alert validation schemas (`AlertAttachZ`, `AlertUpdateZ`) will be hoisted to `@trading-alerts/types` in Step 0.

---

## Next-session handoff

Session 4B-6 (Monolith Write-Transport & Proxy Layer for Alerts CRUD — `lib/operation-service/routes.ts` & `flags.ts`).

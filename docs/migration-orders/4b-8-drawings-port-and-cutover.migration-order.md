# Migration Order: Drawings Extraction & Cutover to operation-service (Session 4B-8)

> Migration Order for Session **4B-8** (Drawings Domain Extraction & Cutover).
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable; the source code is ground truth).
> Target Service: `operation-service` (`src/drawings/` module) & Monolith (`app/api/drawings/...`).

**Session:** 4B-8 (PORT + CUTOVER)  
**Phase / plan section:** Phase 4B step 8, plan §6  
**Target service:** `operation-service` & Next.js Monolith  
**Variant:** PORT · **Status:** CONFIRMED (2026-08-01)  
**Generated:** 2026-08-01 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-01).  
**Flags touched:** `MIGRATE_DRAWINGS` (default `false`, defined in `lib/operation-service/flags.ts`)  
**Contract:** Parity with 2 monolith API route files (306 lines total): `app/api/drawings/route.ts` (159 lines), `app/api/drawings/[id]/route.ts` (147 lines). Preserves `XAUUSD`/`M5-M15` symbol/timeframe checks, drawing quota limits (`FREE`: 10, `PRO`: 200), drawing shape validations (`TRENDLINE`, `HLINE`, `CHANNEL`, `FIB_RETRACE`, `FIB_EXT`, `TEXT`), ownership checks, and `alerts:changed` Redis invalidation publishing on drawing update/delete.  
**Estimated session time:** ~3.0h

---

## Entry criteria

- [x] Session 4B-7 CONFIRMED & Closed (2026-08-01) — Plain alerts CRUD & Pause button live in production (`MIGRATE_ALERTS_CRUD=true`).
- [x] `operation-service` owns Prisma model `Drawing` (mirrored in Prisma schema `prisma/non-market-data/schema.prisma`). Zero DB migrations needed for 4B-8.
- [x] `forwardRequestToOperationService()` available in `lib/operation-service/write-routes.ts` and `getOperationServiceToken()` available in `lib/operation-service/client.ts`.
- [x] `RedisService` available in `@Global()` `operation-service/src/redis/redis.service.ts`.
- [x] `JwtAuthGuard` available in `operation-service/src/auth/jwt-auth.guard.ts`.
- [x] File inventory below re-verified against live codebase (`app/api/drawings/route.ts`: 159 lines, `app/api/drawings/[id]/route.ts`: 147 lines, 306 lines total).

---

## Integration points

- **In:** Monolith proxy / HTTP clients → `operation-service` (`DrawingsController`).
- **Out:** Prisma DB (`Drawing`, `DrawingAlert`), Redis `alerts:changed` invalidation channel (consumed by `AlertWorkerService` live worker).
- **Owns:** Chart drawings persistence & invalidation domain logic in `operation-service`.

---

## File Port Order

### Step 0: Schemas & DTO Setup

- **TARGET:** `operation-service/src/drawings/drawings.schemas.ts` & `operation-service/src/drawings/dto/drawing.dto.ts`
- **Actions:**
  - Create `createDrawingSchema` and `updateDrawingSchema` using Zod matching `lib/drawing/schema.ts` (type checks for `TRENDLINE`, `HLINE`, `CHANNEL`, `FIB_RETRACE`, `FIB_EXT`, `TEXT`, anchor count validation per type, style color `#RRGGBB` & line width 1-10 / line style).
  - Export TypeScript DTO types `CreateDrawingDto` and `UpdateDrawingDto`.
- **Parity proof:** `tsc --noEmit` clean in `operation-service`.
- **Commit:** `feat(drawings): create drawings Zod schemas and DTOs in operation-service`

---

### Step 1: Drawings Service Implementation

- **SOURCE:** `app/api/drawings/route.ts` & `app/api/drawings/[id]/route.ts`
- **TARGET:** `operation-service/src/drawings/drawings.service.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Implement `list(userId: string, filters: { symbol?: string; timeframe?: string })`: query `prisma.drawing.findMany` with `include: { alerts: true }`, `orderBy: { createdAt: 'desc' }`.
  - Implement `create(userId: string, tier: string, dto: CreateDrawingDto)`: validate symbol (`XAUUSD`) & timeframe (`M5`/`M15`), check tier quota (`FREE`: 10, `PRO`: 200), throw `ForbiddenException` if quota reached, create drawing in DB, return `{ success: true, drawing }`.
  - Implement `update(userId: string, id: string, dto: UpdateDrawingDto)`: verify drawing existence (`NotFoundException`) & ownership (`ForbiddenException`), update drawing, publish `alerts:changed` event to Redis channel via `RedisService`, return `{ success: true, drawing }`.
  - Implement `remove(userId: string, id: string)`: verify drawing existence & ownership, delete drawing, publish `alerts:changed` event to Redis channel via `RedisService`, return `{ success: true }`.
- **Invariants:** Quotas (`FREE`: 10, `PRO`: 200), symbol/timeframe validation, strict ownership isolation, Redis `alerts:changed` event published on update/delete.
- **Parity proof:** `tsc --noEmit` clean in `operation-service`.
- **Commit:** `migrate(drawings): implement DrawingsService with quota enforcement and Redis event publishing`

---

### Step 2: Drawings Controller Implementation

- **SOURCE:** `app/api/drawings/route.ts` (159 lines) & `app/api/drawings/[id]/route.ts` (147 lines)
- **TARGET:** `operation-service/src/drawings/drawings.controller.ts`
- **Kind:** port + adapt (NextRequest/NextResponse → NestJS `@Controller('drawings')` with `JwtAuthGuard`)
- **Port steps:**
  - Map `@Get()` -> `drawingsService.list(request.user.id, { symbol, timeframe })`. Return 200 OK.
  - Map `@Post()` -> `@Body(new ZodValidationPipe(createDrawingSchema)) dto: CreateDrawingDto`. Call `drawingsService.create()`. Return 201 Created.
  - Map `@Patch(':id')` -> `@Param('id') id: string`, `@Body(new ZodValidationPipe(updateDrawingSchema)) dto: UpdateDrawingDto`. Call `drawingsService.update()`. Return 200 OK.
  - Map `@Delete(':id')` -> `@Param('id') id: string`. Call `drawingsService.remove()`. Return 200 OK.
  - **CRITICAL (L45 Rule)**: Apply `@Body(new ZodValidationPipe(schema))` at parameter level ONLY. NEVER use method-level `@UsePipes()`.
- **Invariants:** 201 Created for POST, 200 OK for GET/PATCH/DELETE, parameter-level Zod validation pipe scope.
- **Parity proof:** `tsc --noEmit` clean.
- **Commit:** `migrate(drawings): implement DrawingsController with parameter-level ZodValidationPipe`

---

### Step 3: Module Wiring & Unit Tests

- **TARGET:** `operation-service/src/drawings/drawings.module.ts`, `operation-service/src/app.module.ts`, `drawings.controller.spec.ts`, `drawings.service.spec.ts`
- **Actions:**
  - Create `DrawingsModule` importing `PrismaModule` and `RedisModule`, register in `AppModule`.
  - Write unit tests in `drawings.controller.spec.ts` and `drawings.service.spec.ts` covering CRUD operations, quota checks, ownership validation, error cases, and Redis events.
- **Parity proof:** `npm run test` in `operation-service` passes green.
- **Commit:** `test(drawings): register DrawingsModule and add comprehensive unit tests`

---

### Step 4: Monolith Forwarding Layer & Flag Wiring

- **SOURCE:** `app/api/drawings/route.ts` & `app/api/drawings/[id]/route.ts`
- **TARGET:** `lib/operation-service/flags.ts`, `app/api/drawings/route.ts`, `app/api/drawings/[id]/route.ts`
- **Kind:** port + adapt
- **Port steps:**
  - Add `shouldUseOperationServiceForDrawings()` in `lib/operation-service/flags.ts` gated by `process.env['MIGRATE_DRAWINGS'] === 'true'`.
  - Update `GET` and `POST` in `app/api/drawings/route.ts` to check `shouldUseOperationServiceForDrawings()` after session auth, forwarding to `/drawings` via `forwardRequestToOperationService()`.
  - Update `PATCH` and `DELETE` in `app/api/drawings/[id]/route.ts` to check `shouldUseOperationServiceForDrawings()` after session auth, forwarding to `/drawings/:id` via `forwardRequestToOperationService()`.
- **Invariants:** Monolith session auth preserved before forwarding; response status codes (201 for POST, 200 for GET/PATCH/DELETE) preserved.
- **Parity proof:** `npm run build` in repo root passes clean with zero errors.
- **Commit:** `feat(drawings): wire monolith forwarding layer for drawings CRUD gated by MIGRATE_DRAWINGS`

---

### Step 5: Deployment & Cutover Verification

- **Actions:**
  - Deploy `operation-service` to Railway.
  - Verify `/health` endpoint returns 200 OK.
  - Davin live approval checkpoint before setting `MIGRATE_DRAWINGS=true` on Vercel environment variables.
  - Perform live chart drawings smoke test on frontend.
- **Commit:** `docs(drawings): complete Session 4B-8 drawings domain extraction and cutover`

---

## Rules specific to this variant

- Dial: **LOW** — preserve exact logic, status codes, error payloads, and ownership semantics.
- Parameter-level `ZodValidationPipe` ONLY (`@Body(new ZodValidationPipe(schema))`), NEVER method level (L45 rule).
- Monolith routes check session auth FIRST before forwarding.

---

## Slice-level verification (done when)

- [ ] All drawings endpoints ported into `operation-service/src/drawings/`.
- [ ] Unit tests pass green in `operation-service` (`npm run test`).
- [ ] `operation-service` `nest build` and `tsc --noEmit` clean.
- [ ] Monolith `npm run build` clean.
- [ ] `operation-service` deployed to Railway, `/health` returns 200 OK.
- [ ] `MIGRATE_DRAWINGS=true` set on Vercel and live chart drawing creation, update, listing, deletion smoke-tested.

---

## Rollback

Set `MIGRATE_DRAWINGS=false` in Vercel environment variables to instantly revert drawing API requests to monolith execution with zero downtime.

---

## Deviations

1. **Safe signature widening (Step 4):** `app/api/drawings/[id]/route.ts`'s
   `DELETE` handler had a previously-unused `_request: NextRequest`
   parameter, renamed to `request` — needed by
   `forwardRequestToOperationService()`. Zero risk (Next.js always passes
   the request object regardless of whether the handler declares a
   parameter for it); same precedent as Sessions 4A-10a/4B-6.
2. **Steps 0-4 verification:** `tsc --noEmit` clean after every step
   (operation-service and monolith). `operation-service` test suite grew
   28/28→30/30 suites, 234/234→253/253 tests (+19 new tests: quota
   enforcement at both tier ceilings, symbol/timeframe denial with the
   exact `lib/tier-validation.ts` reason strings, ownership checks, 404/403
   cases, Redis publish including a best-effort no-throw-on-failure case).
   Monolith `npm run build` clean (both `/api/drawings` routes in the route
   manifest); full `test:ci` 120/120 suites, 2129/2129 tests unchanged
   (drawings routes are flag-gated off by default — zero behavior change).
3. **Step 5 (deploy) executed and independently verified, not just trusted
   as "SUCCESS":** `operation-service` has no connected GitHub source
   (`"source": null`, confirmed via `railway service list --json` before
   deploying) — deployed via `railway up --path-as-root --service
operation-service` (L23/L38), not `git push` (pushed to `origin/main`
   separately first, pre-push hook re-ran the full 120/120 suite). Polled
   `latestDeployment.status` specifically, not the top-level `status` field
   (which reflects the still-serving OLD deployment while a new one
   builds — caught this distinction mid-session before trusting a
   false-early "SUCCESS" read, same general caution class as 4B-7's own
   stale-build-log incident). Once `latestDeployment.status` reached
   `SUCCESS`: `GET /health` → 200; all 4 drawings routes (unauthenticated)
   → 401 (not 404 — proves genuine registration, not a stale deploy); a
   real nonexistent route → 404 as a control. Boot log independently
   pulled for the exact new deployment ID: `DrawingsModule dependencies
initialized`, `DrawingsController {/drawings}` with all 4 routes mapped,
   `Nest application successfully started`, zero DI errors — and the log's
   own `Missing bearer token` / `Cannot GET` lines directly correlate with
   the test requests just sent (proof of a live, fresh boot, not a cached
   response).

---

## Known wrinkles / do-not-touch

- Do NOT apply `ZodValidationPipe` at method level (`@UsePipes(...)`) — it validates `@Param('id')` and throws 400 (L45 rule).
- Ensure `.railwayignore` anchored paths (`/src`, `/middleware`) are preserved (L43 rule).
- Ensure `railway.json` sets `healthcheckPath: "/health"` (L44 rule).

---

## Next-session handoff

Session 4B-9: Notifications domain extraction & cutover (`NotificationsController` & `NotificationsService`).

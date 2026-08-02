# Migration Order: Notifications Extraction & Cutover to operation-service (Session 4B-9)

> Migration Order for Session **4B-9** (Notifications Domain Extraction & Cutover).  
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable).  
> Target Service: `operation-service` (`src/notifications/` module) & Monolith (`app/api/notifications/...`).

**Session:** 4B-9  
**Phase / plan section:** Phase 4B step 9, plan §6  
**Target service:** `operation-service` & Next.js Monolith  
**Variant:** PORT · **Status:** CONFIRMED (2026-08-02)  
**Generated:** 2026-08-02 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-02).  
**CONFIRMED:** 2026-08-02 — PRE-DRAFT→APPROVED rewrite confirmed live by Davin as an authentic
Advisor edit (the recurring `LESSONS-LEARNED.md` L11 pattern — order file modified-but-uncommitted
with no visible DRAFT→APPROVED commit trail — resolved the same way as every prior occurrence: asked
directly rather than trusting the file). All 5 entry criteria independently re-verified against live
codebase/runtime and PASSED with zero drift (Contract line counts, Prisma model line range 141-160,
and `NotificationType`/`NotificationPriority` enum members are all EXACT matches — unusually clean
for this migration). Two additional findings from an independent audit, not in the order's own
checklist: (1) closes the PRE-DRAFT's own dropped question about other `Notification` writers —
`operation-service/src/alert-engine/dispatcher.service.ts`, `money-service/src/crons/
subscription.service.ts`, and `money-service/src/dlocal/dlocal-webhook.controller.ts` all write
directly to the same shared table via Prisma; no other READER exists outside these 3 targeted
files (repo-wide grep) — no changes needed for this order. (2) `app/api/notifications/route.ts`'s
`POST` (mark-all-read) handler currently takes ZERO parameters, not `_request` — Step 4 will need to
ADD a `request: NextRequest` parameter, not rename one, contrary to the "Known wrinkles" section's
blanket framing.  
**Flags touched:** `MIGRATE_NOTIFICATIONS` (default `false`, defined in `lib/operation-service/flags.ts`)  
**Contract:** Parity with 3 monolith API route files (519 lines total): `app/api/notifications/route.ts` (196 lines), `app/api/notifications/[id]/route.ts` (179 lines), `app/api/notifications/[id]/read/route.ts` (144 lines). Preserves notification filtering (`status`: all/unread/read, `type`: ALERT/SUBSCRIPTION/PAYMENT/SYSTEM, `page`/`pageSize`: 10-50 default 20), bulk mark-all-read (`updateMany`), single get/delete ownership checks, and the `alreadyRead` early return in `markRead` (which skips rewriting `readAt` if already read).  
**Estimated session time:** ~3.0h

---

## Entry criteria

- [x] Session 4B-8 CONFIRMED & Closed (2026-08-01) — Drawings CRUD live in production (`MIGRATE_DRAWINGS=true`). Re-verified: git log commit `9b800da4`; `MIGRATE_DRAWINGS` confirmed present in Vercel production (value-blind, L17 method); unauthenticated `/drawings` on operation-service → 401 (guard intact).
- [x] `operation-service` owns Prisma model `Notification` (mirrored in `operation-service/prisma/schema.prisma` lines 141-160, matching `NotificationType` & `NotificationPriority` enums). Zero DB migrations needed for 4B-9. Re-verified: model spans EXACTLY lines 141-160; enum members (`ALERT/SUBSCRIPTION/PAYMENT/SYSTEM`, `LOW/MEDIUM/HIGH`) match the monolith's `prisma/non-market-data/schema.prisma` AND `money-service/prisma/schema.prisma` byte-for-byte.
- [x] `forwardRequestToOperationService()` available in `lib/operation-service/write-routes.ts` and `getOperationServiceToken()` available in `lib/operation-service/client.ts`. Re-verified: lines 45 and 143 respectively.
- [x] `JwtAuthGuard` available in `operation-service/src/auth/jwt-auth.guard.ts`. Re-verified: exists; `AuthenticatedRequest.user` carries `id`/`email`/`tier`/`role`/`isAffiliate` — sufficient for all 5 planned service methods (only `userId` needed, no tier-gating in this domain).
- [x] File inventory below re-verified against live codebase (`app/api/notifications/route.ts`: 196 lines, `app/api/notifications/[id]/route.ts`: 179 lines, `app/api/notifications/[id]/read/route.ts`: 144 lines, 519 lines total). Re-verified: exact match, zero drift.

---

## Integration points

- **Direct callers:** Monolith Next.js route handlers (`app/api/notifications/...`), frontend components (`components/notifications/notification-bell.tsx`, `components/notifications/notification-list.tsx`).
- **Downstream dependencies:** PostgreSQL Database (`Notification` table via PrismaService).
- **Domain ownership:** `operation-service` becomes canonical reader and state-updater for user notification feeds when `MIGRATE_NOTIFICATIONS=true`.

---

## File Port Order

### Step 0: DTOs & Validation Schemas

- Create `operation-service/src/notifications/notifications.schemas.ts` and DTOs in `dto/notification.dto.ts`.
- Define query param validation schema for `GET /notifications`:
  - `status`: optional enum (`all`, `unread`, `read`), default `all`.
  - `type`: optional enum (`ALERT`, `SUBSCRIPTION`, `PAYMENT`, `SYSTEM`).
  - `page`: optional integer string/number, default 1, min 1.
  - `pageSize`: optional integer string/number, default 20, min 10, max 50.

### Step 1: NotificationsService

- Create `operation-service/src/notifications/notifications.service.ts` (`@Injectable()`).
- Implement methods:
  - `list(userId: string, query: NotificationQueryDto)`: paginated query returning `{ notifications, total, page, pageSize, totalPages, unreadCount }`.
  - `markAllRead(userId: string)`: bulk update `read: true`, `readAt: now()` for all unread notifications of user. Returns `{ success: true, count }`.
  - `getById(userId: string, id: string)`: fetch single notification, ownership-checked (throw `NotFoundException` if missing/not owned).
  - `remove(userId: string, id: string)`: hard delete notification, ownership-checked (throw `NotFoundException` if missing/not owned). Returns `{ success: true }`.
  - `markRead(userId: string, id: string)`: fetch single notification, ownership-checked. If `notification.read === true`, short-circuit return `{ success: true, alreadyRead: true }` WITHOUT modifying `readAt`. Otherwise update `read: true`, `readAt: now()` and return `{ success: true, notification }`.

### Step 2: NotificationsController

- Create `operation-service/src/notifications/notifications.controller.ts`.
- Decorate with `@Controller('notifications')` and `@UseGuards(JwtAuthGuard)`.
- Handlers:
  - `@Get()` `listNotifications(@Req() req: AuthenticatedRequest, @Query() query: NotificationQueryDto)`
  - `@Post()` `markAllRead(@Req() req: AuthenticatedRequest)`
  - `@Get(':id')` `getNotification(@Req() req: AuthenticatedRequest, @Param('id') id: string)`
  - `@Delete(':id')` `deleteNotification(@Req() req: AuthenticatedRequest, @Param('id') id: string)`
  - `@Post(':id/read')` `markNotificationRead(@Req() req: AuthenticatedRequest, @Param('id') id: string)`

### Step 3: Module Registration & Unit Tests

- Create `operation-service/src/notifications/notifications.module.ts`.
- Register `NotificationsModule` in `operation-service/src/app.module.ts`.
- Write unit test suites:
  - `operation-service/src/notifications/notifications.controller.spec.ts`
  - `operation-service/src/notifications/notifications.service.spec.ts`
- Run and verify: `npm run test` inside `operation-service`.

### Step 4: Monolith Transport Layer & Forwarding

- Add `shouldUseOperationServiceForNotifications()` in `lib/operation-service/flags.ts` (checks `process.env['MIGRATE_NOTIFICATIONS'] === 'true'`).
- Update monolith route handlers to widen `_request` -> `request` and forward traffic when flag is on:
  - `app/api/notifications/route.ts`
  - `app/api/notifications/[id]/route.ts`
  - `app/api/notifications/[id]/read/route.ts`
- Run and verify: `npm run build` and `tsc --noEmit` in monolith root.

### Step 5: Deployment, Davin Approval & Cutover

- Deploy `operation-service` to Railway (`railway up --path-as-root`).
- Verify `/health` -> 200 and unauthenticated `/notifications` -> 401.
- **STOP for Davin live approval checkpoint** before setting `MIGRATE_NOTIFICATIONS=true`.
- Set `MIGRATE_NOTIFICATIONS=true` in Vercel production environment variables and trigger redeploy.
- Perform live smoke test (fetch notifications, mark as read, delete notification).

---

## Rules specific to this variant

- **Creativity Dial:** **LOW**. Preserves exact response structures, pagination limits (10-50), and error codes (`404` for missing/unauthorized notification).
- **Invariant:** Preserve the `alreadyRead: true` short-circuit branch in `markRead` without updating `readAt` timestamp if already read.

---

## Slice-level verification

- [ ] Endpoints ported into `operation-service/src/notifications/`.
- [ ] Unit tests (`notifications.controller.spec.ts`, `notifications.service.spec.ts`) pass.
- [ ] `nest build` / `tsc --noEmit` clean in `operation-service`.
- [ ] Monolith `npm run build` / `tsc --noEmit` clean.
- [ ] Deployed to Railway, `/health` -> 200.
- [ ] `MIGRATE_NOTIFICATIONS=true` set on Vercel production + live smoke test verified.

---

## Rollback

If issues occur post-cutover:

1. Set `MIGRATE_NOTIFICATIONS=false` in Vercel production environment variables.
2. Redeploy Next.js monolith. Traffic immediately reverts to local monolith Prisma routes. Zero downtime.

---

## Deviations

1. **Step 1 response-shape corrections (SOURCE ground truth wins over this order's own paraphrase, per `LESSONS-LEARNED.md` L27):** `markAllRead` returns `{ success: true, updatedCount, message }` (matching `app/api/notifications/route.ts`'s real `POST` handler exactly), not this order's stated `{ success: true, count }`. `markRead`'s already-read short-circuit returns `{ notification, alreadyRead: true, message }` with **no `success` key** (matching `app/api/notifications/[id]/read/route.ts`'s real early-return exactly), not this order's stated `{ success: true, alreadyRead: true }`. `getById`/`remove`/`markRead` throw a 404 `NotFoundException` for a missing notification and a **403** `ForbiddenException` for a wrong-owner notification — two different status codes, matching real SOURCE and the established Drawings/Alerts convention — not the blanket "404 for missing/unauthorized" this order's own Rules section states. `getById` returns the raw notification object directly (no wrapper), matching SOURCE's `NextResponse.json(notification)`.

---

## Known wrinkles / do-not-touch

- **Rule L43:** Anchor root ignore patterns in `.railwayignore` with leading slashes (`/src`).
- **Rule L44:** Maintain `railway.json` with `healthcheckPath: "/health"` and `startCommand: "npm run start"`.
- **Parameter signature:** Monolith route handlers must use `request: NextRequest` (not `_request`) so `forwardRequestToOperationService(request, path)` can read the request context.

---

## Next-session handoff

- **Session 4B-10:** Phase 4B domain extraction review and next domain slice selection.

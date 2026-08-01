# Migration Order: Notifications Extraction & Cutover to operation-service (Session 4B-9)

> Migration Order for Session **4B-9** (Notifications Domain Extraction & Cutover).
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable).
> Target Service: `operation-service` (`src/notifications/` module) & Monolith (`app/api/notifications/...`).

**Session:** 4B-9  
**Phase / plan section:** Phase 4B step 9, plan §6  
**Target service:** `operation-service` & Next.js Monolith  
**Variant:** PORT · **Status:** PRE-DRAFT (2026-08-01)  
**Flags touched:** `MIGRATE_NOTIFICATIONS` (not introduced yet — reserved name only)

---

## Raw facts (Executor, for the Advisor to upgrade into a DRAFT)

**SOURCE (3 files, 519 lines total, re-verify at CONFIRM — these are this session's own fresh
`wc -l` counts, not carried forward from a stale prior citation):**

- `app/api/notifications/route.ts` (196 lines) — `GET` (paginated list, filters: `status`
  all/unread/read, `type` ALERT/SUBSCRIPTION/PAYMENT/SYSTEM, `page`/`pageSize` 10-50 default 20;
  returns `{ notifications, total, page, pageSize, totalPages, unreadCount }`), `POST` (mark ALL
  unread notifications as read, bulk `updateMany`, no body).
- `app/api/notifications/[id]/route.ts` (179 lines) — `GET` (single, ownership-checked, 404/403),
  `DELETE` (hard delete via `prisma.notification.delete()`, ownership-checked).
- `app/api/notifications/[id]/read/route.ts` (144 lines) — `POST` (mark ONE as read; has an
  `alreadyRead: true` short-circuit branch that returns early WITHOUT re-writing `readAt` if
  already read — a real invariant worth preserving exactly, not an incidental detail).

**Prisma model:** `operation-service/prisma/schema.prisma` already has `model Notification`
(confirmed present this session, lines 141-160) — `id`, `userId`, `type: NotificationType`,
`title`, `body`, `priority: NotificationPriority @default(MEDIUM)`, `read: Boolean @default(false)`,
`readAt`, `link`, `createdAt`, `updatedAt`. Likely mirrored during Session 4B-2 (alert-engine PORT,
`NotifyBridgeService` writes `Notification` rows) — **re-verify this session whether
`NotificationType`/`NotificationPriority` enum VALUES match the monolith's real schema exactly**
(not just that the model exists) before treating this as a zero-migration entry criterion; this
session did not check enum member lists, only model/field presence.

**Auth pattern:** all 3 files use `getServerSession(authOptions)` (same as the drawings routes,
Session 4B-8) — NOT the `getSession()` wrapper the Alerts CRUD routes use. No functional
difference, just note which pattern this domain's routes actually use before assuming a shape.

**Two files (`[id]/route.ts` GET and DELETE, `[id]/read/route.ts` POST) have unused `_request`
parameters** — expect the same safe `_request`→`request` widening Sessions 4A-10a/4B-6/4B-8 all
needed once the monolith forwarding layer is wired in (the forwarder needs the real request
object). Flag this in the DRAFT's own Step 4 so it isn't rediscovered as a surprise.

**Established transport pattern (reuse, don't reinvent):** `forwardRequestToOperationService()`
(`lib/operation-service/write-routes.ts`) + `getOperationServiceToken()` (`lib/operation-service/
client.ts`) + `shouldUseOperationServiceForNotifications()` (new, in `lib/operation-service/
flags.ts`, same shape as `shouldUseOperationServiceForDrawings()`/`_ForAlertsCrud()`).

**Scope question for the Advisor/Davin, not resolved here:** Session 4B-8 combined PORT+CUTOVER
into one order (a deliberate deviation from the 3-way split every earlier slice used), on the
reasoning that Drawings was small (2 files, no payment/webhook surface) and low-risk. Notifications
is comparably small (3 files, 519 lines, no payment surface either) — worth the Advisor explicitly
deciding whether 4B-9 should follow the same combined shape, or revert to the standard split, rather
than defaulting to either without a stated reason.

**Not re-verified this session (do so at DRAFT/CONFIRM time):** whether `JwtAuthGuard`'s
`AuthenticatedRequest.user` shape already carries everything these 3 files need (just `id` — no
tier-gating anywhere in this domain, unlike Drawings/Alerts), and whether any OTHER monolith code
reads/writes `Notification` rows outside these 3 route files (e.g., a cron, an admin route) that
would ALSO need auditing before a full cutover — not checked here, flagging as a gap for the DRAFT
to close rather than silently assuming these 3 files are the only writers/readers.

---

## Candidate steps (mirror Session 4B-8's structure — Advisor to confirm/adjust)

0. Schemas/DTOs (if any request-body validation exists — note: `route.ts`'s `GET` has a
   `querySchema` for query params, but NONE of the 3 files validate a request BODY with Zod; the
   `read`/`DELETE`/mark-all-read endpoints take no body at all — confirm whether a `ZodValidationPipe`
   is even needed here, or whether NestJS's built-in query-param handling covers it, before copying
   Drawings'/Alerts' `@Body(new ZodValidationPipe(...))` pattern reflexively where there's no body).
1. `NotificationsService` — port `list`/`markAllRead`/`getById`/`remove`/`markRead`.
2. `NotificationsController` — `GET/POST /notifications`, `GET/DELETE /notifications/:id`,
   `POST /notifications/:id/read`.
3. `NotificationsModule` + unit tests.
4. Monolith forwarding layer + `shouldUseOperationServiceForNotifications()` (watch for the
   `_request`→`request` widening on 3 handlers, flagged above).
5. Deploy + Davin live-approval checkpoint + cutover + live smoke test (same shape as 4B-8's Step
   5 — mind that 4B-8's own UI smoke test was blocked by an unrelated chart-WebSocket issue; a
   Notifications UI smoke test should be checked against `components/notifications/{notification-bell,
notification-list}.tsx` for any similar unrelated dependency before assuming the UI path is clear).

---

## Deviations

_(none yet — PRE-DRAFT, not executed)_

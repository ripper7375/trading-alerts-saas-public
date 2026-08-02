# Migration Order: User Profile / 2FA / Sessions Domain Extraction (Session 4B-11)

> Migration Order for Session **4B-11** (User Profile, Preferences, Password, 2FA, Sessions & Account Deletion Extraction & Cutover).  
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable).  
> Target Service: `operation-service` (`src/users/` module & extending `src/auth/two-factor.*`) & Monolith (`app/api/user/...`).

**Session:** 4B-11  
**Phase / plan section:** Phase 4B step 11, plan §6  
**Target service:** `operation-service` & Next.js Monolith  
**Variant:** PORT · **Status:** CONFIRMED (2026-08-02)  
**Generated:** 2026-08-02 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-02; CONFIRMED same day by Executor after independent audit — see Deviations).  
**Flags touched:** `MIGRATE_USER_PROFILE`, `MIGRATE_USER_2FA`, `MIGRATE_USER_SESSIONS` (defaults `false`, defined in `lib/operation-service/flags.ts`)  
**Contract:** Parity with 14 monolith API route files (2,060 lines total):

- Profile/Preferences/Password (494 lines): `app/api/user/profile/route.ts` (177 lines), `app/api/user/preferences/route.ts` (147 lines), `app/api/user/password/route.ts` (170 lines).
- Sessions/History (308 lines): `app/api/user/sessions/route.ts` (99 lines), `app/api/user/sessions/[id]/route.ts` (66 lines), `app/api/user/login-history/route.ts` (143 lines).
- 2FA Integration (883 lines): `app/api/user/2fa/setup/route.ts` (140 lines), `verify/route.ts` (180 lines — **unauthenticated mid-login JWT token challenge**), `verify-setup/route.ts` (185 lines), `backup-codes/route.ts` (188 lines), `disable/route.ts` (190 lines). Reuses and extends `operation-service/src/auth/two-factor.service.ts`.
- Account Deletion (375 lines): `app/api/user/account/deletion-request/route.ts` (107 lines), `deletion-confirm/route.ts` (133 lines), `deletion-cancel/route.ts` (135 lines). Preserves exact 7-day token-based deletion grace window (`AccountDeletionRequest.expiresAt = now + 7d`).

**Estimated session time:** ~3.5h

---

## Entry criteria

- [x] Session 4B-10 CONFIRMED & Closed (2026-08-02) — Tier domain & reusable `TierGuard` live in production (`MIGRATE_TIER=true`). Verified against `CLAUDE.md`'s recorded close-out and committed 4B-10 commits; not independently re-checked live in Vercel this session (no `vercel` CLI in this environment).
- [x] Additive schema subset sync needed in Step 0: Add missing models `AccountDeletionRequest`, `UserPreferences`, `LoginHistory`, `UserSession` to `operation-service/prisma/schema.prisma` and run `npx prisma generate` (zero DB migrations required, per L1). Confirmed at CONFIRM: none of these 4 models exist in `operation-service/prisma/schema.prisma` today (only `User`/`RefreshToken`/`SecurityAlert` + the 4B-2 alert-engine models do) — this step is a real, load-bearing prerequisite, not boilerplate.
- [x] `forwardRequestToOperationService()` available in `lib/operation-service/write-routes.ts` and `getOperationServiceToken()` available in `lib/operation-service/client.ts`. Verified live: `write-routes.ts:45`, `client.ts:143`.
- [x] `JwtAuthGuard` and `TwoFactorService` available in `operation-service/src/auth/`. Verified live: `jwt-auth.guard.ts:28`, `two-factor.service.ts:43`; confirmed it already shares the monolith's `encryptSecret`/`decryptSecret`/bcrypt backup-code scheme.
- [x] File inventory re-verified against live codebase (14 files, 2,060 lines total). Verified via `wc -l` on all 14 files: 494+308+883+375 = 2,060, exact match on every per-file citation.

---

## Integration points

- **Direct callers:** Monolith Next.js route handlers (`app/api/user/...`), user settings pages (`app/(dashboard)/settings/*`).
- **Downstream dependencies:** PostgreSQL Database (`User`, `UserPreferences`, `UserSession`, `RefreshToken`, `LoginHistory`, `AccountDeletionRequest` tables via PrismaService).
- **Domain ownership:** `operation-service` becomes canonical manager of user profiles, preferences, password updates, 2FA settings, session management, and account deletion when flags are enabled.

---

## File Port Order

### Step 0: Prisma Schema Mirror & DTOs

- Add missing models `AccountDeletionRequest`, `UserPreferences`, `LoginHistory`, `UserSession` to `operation-service/prisma/schema.prisma` (copied verbatim from monolith schema) and run `npx prisma generate`.
- Create `operation-service/src/users/users.schemas.ts` and `dto/user.dto.ts`.
- Define Zod/Class-validator DTOs for:
  - Profile update (`name`, `image`)
  - Preferences update (`theme`, `language`, `emailNotifications`, `pushNotifications`, `marketingEmails`)
  - Password change (`currentPassword`, `newPassword`)
  - 2FA setup/verify (`code`, `token`)
  - Account deletion request/confirm/cancel

### Step 1: UsersService & 2FA Integration

- Create `operation-service/src/users/users.service.ts` (`@Injectable()`):
  - Profile & Preferences: `getProfile`, `updateProfile`, `getPreferences`, `updatePreferences`, `changePassword`.
  - Sessions & History: `getSessions`, `revokeSession`, `getLoginHistory`.
  - 2FA Integration: Wire and expose methods reusing existing `TwoFactorService` (`setup2FA`, `verify2FASetup`, `verify2FA` [mid-login token verification], `disable2FA`, `getBackupCodes`, `generateBackupCodes`).
  - Account Deletion (F21): `requestDeletion` (sets 7-day token grace window `expiresAt: now() + 7d`), `confirmDeletion`, `cancelDeletion`.

### Step 2: UsersController & Auth-Guard Scoping

- Create `operation-service/src/users/users.controller.ts`.
- Decorate with `@Controller('user')`. Do **NOT** apply `@UseGuards(JwtAuthGuard)` at the class level to avoid requiring a session on unauthenticated routes!
- Apply `@UseGuards(JwtAuthGuard)` at method level for authenticated handlers. Leave `POST /user/2fa/verify` **unauthenticated** (verified via short-lived JWT token in body/header).
- Explicitly decorate all `@Get()`, `@Post()`, `@Patch()`, `@Delete()` handlers with `@HttpCode(200)` (or `@HttpCode(201)` for creation routes) matching monolith source behavior.
- Handlers:
  - Profile/Preferences/Password: `GET /user/profile`, `PATCH /user/profile`, `GET /user/preferences`, `PATCH /user/preferences`, `POST /user/password`.
  - Sessions/History: `GET /user/sessions`, `DELETE /user/sessions/:id`, `GET /user/login-history`.
  - 2FA: `POST /user/2fa/setup`, `POST /user/2fa/verify-setup`, `POST /user/2fa/verify` (UNAUTHENTICATED mid-login challenge), `POST /user/2fa/disable`, `GET /user/2fa/backup-codes`, `POST /user/2fa/backup-codes`.
  - Account Deletion: `POST /user/account/deletion-request`, `POST /user/account/deletion-confirm`, `POST /user/account/deletion-cancel`.

### Step 3: Module Registration & Unit Tests

- Create `operation-service/src/users/users.module.ts`.
- Register `UsersModule` in `operation-service/src/app.module.ts`.
- Write unit test suites:
  - `operation-service/src/users/users.controller.spec.ts`
  - `operation-service/src/users/users.service.spec.ts`
- Run and verify: `npm run test` inside `operation-service`.

### Step 4: Monolith Transport Layer & Forwarding

- Add flag readers in `lib/operation-service/flags.ts`:
  - `shouldUseOperationServiceForUserProfile()`
  - `shouldUseOperationServiceForUser2FA()`
  - `shouldUseOperationServiceForUserSessions()`
- Update all 14 monolith route handlers (`app/api/user/...`) to widen `_request` -> `request` and forward traffic to `operation-service` when flags are on.
- Run and verify: `npm run build` and `tsc --noEmit` in monolith root.

### Step 5: Deployment, Davin Approval & Cutover

- Deploy `operation-service` to Railway (`railway up --path-as-root`).
- Verify `/health` -> 200, unauthenticated `/user/profile` -> 401, and unauthenticated `POST /user/2fa/verify` accepts token payloads (not 401).
- **STOP for Davin live approval checkpoint** before setting feature flags in Vercel production.
- Set `MIGRATE_USER_PROFILE=true`, `MIGRATE_USER_2FA=true`, `MIGRATE_USER_SESSIONS=true` in Vercel production environment variables and trigger redeploy.
- Perform live smoke test (fetch profile, update preferences, fetch sessions).

---

## Rules specific to this variant

- **Creativity Dial:** **LOW**. Preserves exact response structures, field validations, and HTTP status codes (`@HttpCode(200)` / `@HttpCode(201)`).
- **Rule L43:** Ensure exact HTTP status codes are decorated on all NestJS controller handlers to prevent status code drift.
- **Rule L24 (Auth Semantics):** `POST /user/2fa/verify` MUST remain unauthenticated at the route level to handle mid-login 2FA challenges via token validation.

---

## Slice-level verification

- [ ] Missing models mirrored into `operation-service/prisma/schema.prisma` and `prisma generate` run clean.
- [ ] Endpoints ported into `operation-service/src/users/`.
- [ ] Unit tests (`users.controller.spec.ts`, `users.service.spec.ts`) pass.
- [ ] `nest build` / `tsc --noEmit` clean in `operation-service`.
- [ ] Monolith `npm run build` / `tsc --noEmit` clean.
- [ ] Deployed to Railway, `/health` -> 200.
- [ ] Feature flags set on Vercel production + live smoke test verified.

---

## Rollback

If issues occur post-cutover:

1. Set `MIGRATE_USER_PROFILE=false`, `MIGRATE_USER_2FA=false`, `MIGRATE_USER_SESSIONS=false` in Vercel production environment variables.
2. Redeploy Next.js monolith. Traffic immediately reverts to local monolith Prisma routes. Zero downtime.

---

## Deviations

1. **CONFIRM audit found and corrected 3 real gaps in the originally-APPROVED text before execution** (order file was found modified-but-uncommitted, `PRE-DRAFT → APPROVED` with a full rewrite and no visible Advisor-DRAFT/Davin-approval commit trail — the by-now-familiar `LESSONS-LEARNED.md` L11 pattern, 12th+ recurrence; the rewrite had also silently dropped both of the PRE-DRAFT's own explicitly-flagged open questions with no visible resolution). Reported to Davin in full before proceeding; Davin confirmed the rewrite was his/the Advisor's own authentic work and, live in chat, confirmed the following 3 corrections (independently verified against live code by the Executor, not taken on faith): (a) Entry Criterion #2's model list was both over- and under-inclusive — `Account` and `TwoFactorBackupCode` are never referenced anywhere in the 14 SOURCE files or their `lib/` dependencies (backup codes are a plain JSON string field on `User`, no such model exists), while `AccountDeletionRequest`, `UserPreferences`, `LoginHistory`, and `UserSession` (the real model behind "sessions" — distinct from the bare `RefreshToken` table and from NextAuth's own `Session` model, which `lib/auth/session-tracker.ts` also touches for cascade-delete on revoke) are genuinely missing from `operation-service/prisma/schema.prisma` and needed as a real Step 0 prerequisite, not assumed present; (b) the Contract's account-deletion description was factually wrong — real SOURCE (`app/api/user/account/deletion-request/route.ts`) uses a 7-day token-based `AccountDeletionRequest.expiresAt` grace window, not a 24h `scheduledDeletionAt` field (F21, `DECISION-LOG.md`, stays OPEN and out of this session's scope — this session ports the existing 7-day flow byte-for-byte only); (c) Step 2's originally-proposed class-level `@UseGuards(JwtAuthGuard)` would have broken `POST /user/2fa/verify`, which is unauthenticated by design (mid-login 2FA challenge, verified via a short-lived JWT minted at password-check time — no NextAuth session exists yet at that point in the login flow) — corrected to method-level guards with an explicit exception for that one handler.

---

## Known wrinkles / do-not-touch

- **Rule L43:** Anchor root ignore patterns in `.railwayignore` with leading slashes (`/src`).
- **Rule L44:** Maintain `railway.json` with `healthcheckPath: "/health"` and `startCommand: "npm run start"`.
- **2FA Secret Storage:** Must reuse existing `TwoFactorService` encryption/hashing methods so existing 2FA secrets and backup codes remain valid.

---

## Next-session handoff

- **Session 4B-12:** Phase 4B market-data channel proxy & final Phase 4B completion review.

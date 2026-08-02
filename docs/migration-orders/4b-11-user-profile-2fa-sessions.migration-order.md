# Migration Order: User Profile / 2FA / Sessions Domain Extraction (Session 4B-11)

> Migration Order for Session **4B-11** (User Profile, Preferences, Password, 2FA, Sessions & Account Deletion Extraction & Cutover).  
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable).  
> Target Service: `operation-service` (`src/users/` module & extending `src/auth/two-factor.*`) & Monolith (`app/api/user/...`).

**Session:** 4B-11  
**Phase / plan section:** Phase 4B step 11, plan §6  
**Target service:** `operation-service` & Next.js Monolith  
**Variant:** PORT · **Status:** CONFIRMED, executed, CLOSED (2026-08-02) — Slice 11 CUT-OVER & LIVE, all 3 flags `true` in production, verification complete (see Slice-level verification).  
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

- [x] Missing models mirrored into `operation-service/prisma/schema.prisma` and `prisma generate` run clean.
- [x] Endpoints ported into `operation-service/src/users/` (19 endpoints, not the ~16 originally enumerated — see Deviations #5).
- [x] Unit tests (`users.controller.spec.ts`, `users.service.spec.ts`) pass — 53 new tests, `operation-service` 38/38 suites, 348/348 tests (was 36/36, 295/295 at 4B-10's close).
- [x] `nest build` / `tsc --noEmit` clean in `operation-service`.
- [x] Monolith `npm run build` (`tsc --noEmit` + `eslint --max-warnings 0`) clean; full `test:ci` 122/122 suites, 2157/2157 tests — byte-identical to the pre-session baseline, zero regressions.
- [x] Deployed to Railway (`railway up --path-as-root --service operation-service`), `/health` -> 200. Live-verified: all 19 routes mapped, zero DI errors, `Nest application successfully started`. Unauthenticated guarded routes (`profile`, `sessions`, `2fa/setup`) -> 401; the 3 deliberately-unauthenticated routes reached real service logic instead of a guard 401 (`2fa/verify` -> 401 from token verification, `deletion-confirm` -> 404 from a real Prisma lookup, `deletion-cancel` -> 401 from the service's own dual-mode branch) — a genuine nonexistent route -> 404 as a control.
- [x] Feature flags set on Vercel production + live smoke test verified. `MIGRATE_USER_PROFILE`/`MIGRATE_USER_2FA`/`MIGRATE_USER_SESSIONS` all `true` in Vercel production (added via `vercel env add`, value-blind re-verified via `vercel env ls production`'s name-only listing per L17), redeployed via `vercel --prod --archive=tgz --yes` (L36), aliased to the real production URL. Davin ran the live smoke test himself from his own browser DevTools console (profile/preferences/sessions all returned real, correct data) — a real bug was found in that same pass (see Deviations #9), fixed same-session, and re-verified live with a second Davin-run fetch plus an independent Railway HTTP log cross-check.

---

## Rollback

If issues occur post-cutover:

1. Set `MIGRATE_USER_PROFILE=false`, `MIGRATE_USER_2FA=false`, `MIGRATE_USER_SESSIONS=false` in Vercel production environment variables.
2. Redeploy Next.js monolith. Traffic immediately reverts to local monolith Prisma routes. Zero downtime.

---

## Deviations

1. **CONFIRM audit found and corrected 3 real gaps in the originally-APPROVED text before execution** (order file was found modified-but-uncommitted, `PRE-DRAFT → APPROVED` with a full rewrite and no visible Advisor-DRAFT/Davin-approval commit trail — the by-now-familiar `LESSONS-LEARNED.md` L11 pattern, 12th+ recurrence; the rewrite had also silently dropped both of the PRE-DRAFT's own explicitly-flagged open questions with no visible resolution). Reported to Davin in full before proceeding; Davin confirmed the rewrite was his/the Advisor's own authentic work and, live in chat, confirmed the following 3 corrections (independently verified against live code by the Executor, not taken on faith): (a) Entry Criterion #2's model list was both over- and under-inclusive — `Account` and `TwoFactorBackupCode` are never referenced anywhere in the 14 SOURCE files or their `lib/` dependencies (backup codes are a plain JSON string field on `User`, no such model exists), while `AccountDeletionRequest`, `UserPreferences`, `LoginHistory`, and `UserSession` (the real model behind "sessions" — distinct from the bare `RefreshToken` table and from NextAuth's own `Session` model, which `lib/auth/session-tracker.ts` also touches for cascade-delete on revoke) are genuinely missing from `operation-service/prisma/schema.prisma` and needed as a real Step 0 prerequisite, not assumed present; (b) the Contract's account-deletion description was factually wrong — real SOURCE (`app/api/user/account/deletion-request/route.ts`) uses a 7-day token-based `AccountDeletionRequest.expiresAt` grace window, not a 24h `scheduledDeletionAt` field (F21, `DECISION-LOG.md`, stays OPEN and out of this session's scope — this session ports the existing 7-day flow byte-for-byte only); (c) Step 2's originally-proposed class-level `@UseGuards(JwtAuthGuard)` would have broken `POST /user/2fa/verify`, which is unauthenticated by design (mid-login 2FA challenge, verified via a short-lived JWT minted at password-check time — no NextAuth session exists yet at that point in the login flow) — corrected to method-level guards with an explicit exception for that one handler.

2. **The already-agreed guard-scoping fix (item 1c) turned out to be incomplete on its own** — reading the remaining SOURCE files during Step 0 found TWO MORE routes that are also unauthenticated-or-optionally-authenticated by design, not just `2fa/verify`: `POST /user/account/deletion-confirm` (public email-link token flow, zero auth check anywhere in SOURCE) and `POST /user/account/deletion-cancel` (SOURCE's own dual-mode branch accepts EITHER an anonymous token OR a logged-in session). `UsersController` was built with method-level guards omitted on all 3 (not just the 1 the order named), verified by a dedicated guard-metadata test (`users.controller.spec.ts`, `Reflect.getMetadata(GUARDS_METADATA, ...)`), not just delegation coverage.

3. **A second-order consequence of #2, found while wiring Step 4**: the established `forwardRequestToOperationService()` transport helper (used by every prior cutover slice) throws a 401 immediately if no NextAuth session cookie is present — it was never designed for a genuinely-unauthenticated target route. Forwarding these 3 routes through it as-is would have 401'd every real unauthenticated caller once the flag flipped, silently breaking the exact behavior #1c/#2 preserved on the operation-service side. Built a new `callOperationServiceWithOptionalTokenStatus()` (`lib/operation-service/client.ts`) + `forwardRequestToOperationServiceOptionalAuth()` (`lib/operation-service/write-routes.ts`) — same shape as the existing forwarder, but a missing session cookie forwards without an `Authorization` header instead of throwing. Used only for these 3 routes; every other route still uses the standard forwarder unchanged.

4. **`UsersController`'s own PATCH-vs-PUT mistake, self-caught before Step 4**: while building the controller, `profile` was initially decorated `@Put('profile')` — wrong; SOURCE's `app/api/user/profile/route.ts` exports `PATCH`, not `PUT` (only `preferences/route.ts` genuinely uses `PUT`). Caught by re-grepping SOURCE's own `export async function` lines before wiring the monolith side, fixed same-session (own commit), re-verified with `tsc --noEmit` + the full users test suite before proceeding.

5. **3 more real gaps in the APPROVED order's own Step 2 handler list, found by reading SOURCE directly rather than trusting the order's paraphrase** (same `LESSONS-LEARNED.md` L27 class as every prior session's recurrence of this pattern): (a) `app/api/user/2fa/setup/route.ts` exports BOTH `GET` (2FA status) and `POST` (initiate) — the order's own handler list named only the `POST`; added `GET /user/2fa/setup` → `TwoFactorService.getStatus()` to preserve full parity. (b) `app/api/user/sessions/route.ts` exports BOTH `GET` (list) and `DELETE` (revoke-ALL, no `:id`) — the order's own list only named the `[id]/route.ts` single-session `DELETE`; added `DELETE /user/sessions` (bulk revoke-all-except-current) as its own endpoint. (c) See item 4 above (profile PATCH vs PUT). Total real endpoint count is 19 across the 14 files, not the ~16 the order's own Step 2 text enumerated.

6. **Account Deletion has no flag of its own** — the order names exactly 3 flags (`MIGRATE_USER_PROFILE`/`_USER_2FA`/`_USER_SESSIONS`) across what the Contract section frames as 4 conceptual buckets (Profile/Preferences/Password, Sessions/History, 2FA, Account Deletion). Folded Account Deletion's 3 routes under `MIGRATE_USER_PROFILE` (account-level setting, not session- or 2FA-specific) rather than inventing a 4th flag not in the order's own Flags-touched line. Not escalated as a stop-and-ask — a flag-bucket assignment for an already-scoped, already-approved set of routes, not a new security/auth policy decision.

7. **Session-tracking behavior preserved exactly, including its own real-token dependency**: SOURCE's `GET /api/user/sessions` reads the raw NextAuth session-token cookie value to both track the CURRENT session (`trackSession()`) and mark it `isCurrent` in the response. In the ported architecture the monolith forwards the caller's session as a raw Bearer token (same JWE string, just delivered via `Authorization` instead of a cookie) — `UsersController.getSessions()` extracts it from the header for the identical purpose. Verified this really is the same value, not a re-derived one, by reading `getOperationServiceToken()`'s own implementation (forwards the httpOnly cookie's raw value verbatim) before relying on it.

8. **Deployment**: `operation-service` deployed via `railway up --path-as-root --service operation-service` (this service has no connected GitHub source — `git push` cannot reach it, per `LESSONS-LEARNED.md` L38/L23). See Slice-level verification for live health/guard confirmation.

9. **A real live bug found by the cutover's own smoke test, fixed same-session with Davin's explicit direction**: after flipping all 3 flags and redeploying, Davin's own `GET /api/user/sessions` showed his just-tracked current session as `"device": "Unknown on Unknown"` instead of his real Chrome/Windows (a second, pre-cutover row correctly showed "Chrome on Windows", confirming this was new). Root cause: `forwardRequestToOperationService()`/`forwardRequestToOperationServiceOptionalAuth()` (the shared transport EVERY cutover slice uses, not something new to this session) only ever forwarded `Authorization` + `x-correlation-id` — `user-agent`/`x-forwarded-for` were silently dropped on every forwarded request since these forwarders were first built. This was invisible on every prior slice (Tier/Notifications/Drawings/Alerts) because none of their ported code reads those headers; 4B-11 is the first slice that does (session device-tracking; IP/location in the password-change and 2FA enable/disable security-alert emails). Not a security or auth-identity issue — session ownership/authentication was never wrong, only descriptive metadata. Presented 3 options to Davin (fix forward / revert the 3 flags / leave as a known issue); he chose to fix forward. Wired the already-existing (previously unused) `forwardedRequestContext()` helper into both forwarders, added a dedicated test (`write-routes.test.ts`), redeployed the monolith only (fix is entirely monolith-side, no operation-service redeploy needed), and had Davin re-run the same fetch — his current session now correctly shows "Chrome on Windows". Independently cross-checked against `operation-service`'s own Railway HTTP access logs (`GET /user/sessions 200 37ms`, timestamp-matched to the fixed session's `createdAt`), not trusted from the response body alone (L18). The one stale "Unknown on Unknown" row from the ~26-minute pre-fix window was left as-is (a harmless historical artifact, not corrected retroactively). New `LESSONS-LEARNED.md` candidate (see that file's own header note — past the active cap).

---

## Known wrinkles / do-not-touch

- **Rule L43:** Anchor root ignore patterns in `.railwayignore` with leading slashes (`/src`).
- **Rule L44:** Maintain `railway.json` with `healthcheckPath: "/health"` and `startCommand: "npm run start"`.
- **2FA Secret Storage:** Must reuse existing `TwoFactorService` encryption/hashing methods so existing 2FA secrets and backup codes remain valid.

---

## Next-session handoff

- **Session 4B-12:** Phase 4B market-data channel proxy & final Phase 4B completion review.

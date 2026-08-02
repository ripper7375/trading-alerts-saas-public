# Migration Order: Tier (Guard) Extraction & Cutover to operation-service (Session 4B-10)

> Migration Order for Session **4B-10** (Tier Domain Extraction, TierGuard & Cutover).  
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable).  
> Target Service: `operation-service` (`src/tier/` module & `src/auth/tier.guard.ts`) & Monolith (`app/api/tier/...`).

**Session:** 4B-10  
**Phase / plan section:** Phase 4B step 10, plan §6  
**Target service:** `operation-service` & Next.js Monolith  
**Variant:** PORT · **Status:** CONFIRMED (2026-08-02)  
**Generated:** 2026-08-02 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-02; Davin
confirmed live in chat that the PRE-DRAFT→APPROVED rewrite and the "both" scope resolution
were his/the Advisor's authentic edits — same L11-class provenance check as every prior
session, resolved the same way).  
**Flags touched:** `MIGRATE_TIER` (default `false`, defined in `lib/operation-service/flags.ts`)  
**Contract:** Parity with 3 monolith API route files (387 lines total): `app/api/tier/symbols/route.ts` (118 lines), `app/api/tier/check/[symbol]/route.ts` (124 lines), `app/api/tier/combinations/route.ts` (145 lines). Preserves symbol access metadata (`SYMBOLS`: `FREE` vs `PRO`), symbol access checks (`canAccessSymbol`), and symbol×timeframe combinations matrix (`FREE`: XAUUSD/M5/M15, `PRO`: all). In addition, builds a reusable NestJS `@UseGuards(TierGuard)` in `operation-service/src/auth/tier.guard.ts` for clean tier-gating across NestJS endpoints.  
**Estimated session time:** ~3.0h

---

## Entry criteria

- [x] Session 4B-9 CONFIRMED & Closed (2026-08-02) — Notifications CRUD & mark-all-read live in production (`MIGRATE_NOTIFICATIONS=true`). Code-level re-verified (commits present, all 3 notification routes reference the forward/flag pattern); the live-production runtime claim was not independently re-checked this session (no `vercel` CLI available in this environment) — relying on the evidence already recorded in CLAUDE.md/cutover table.
- [x] `operation-service` `JwtAuthGuard` / `AuthenticatedRequest.user` provides `tier: 'FREE' | 'PRO'`. Confirmed (`jwt-auth.guard.ts:11-17`) — typed as plain `string` rather than the literal union, defaults to `'PRO'` if the JWE claim is missing (monolith SOURCE defaults missing tier to `'FREE'` instead). Zero practical impact on this domain (V8: FREE/PRO get identical data) — a pre-existing divergence, not introduced by this order, left untouched (out of this PORT session's scope to change shared guard behavior).
- [x] `forwardRequestToOperationService()` available in `lib/operation-service/write-routes.ts` and `getOperationServiceToken()` available in `lib/operation-service/client.ts`. Confirmed at `write-routes.ts:45` and `client.ts:143`.
- [x] File inventory below re-verified against live codebase (`app/api/tier/symbols/route.ts`: 118 lines, `app/api/tier/check/[symbol]/route.ts`: 124 lines, `app/api/tier/combinations/route.ts`: 145 lines, 387 lines total). Exact match via `wc -l`.

---

## Integration points

- **Direct callers:** Monolith Next.js route handlers (`app/api/tier/...`), frontend chart controls and tier-gating components (`components/charts/chart-controls.tsx`).
- **Domain ownership:** `operation-service` becomes canonical reader and validator for tier capabilities and symbol access matrix when `MIGRATE_TIER=true`.

---

## File Port Order

### Step 0: DTOs & Validation Schemas

- Create `operation-service/src/tier/tier.schemas.ts` and `operation-service/src/tier/dto/tier.dto.ts`.
- Re-export or define constants matching `lib/tier-config.ts`:
  - `FREE_SYMBOLS`, `PRO_SYMBOLS`, `FREE_TIMEFRAMES`, `PRO_TIMEFRAMES`.
- Define path parameter validation DTO for `GET /tier/check/:symbol`.

### Step 1: Reusable TierGuard & TierService

- Create `operation-service/src/auth/tier.guard.ts`:
  - Custom `@RequireTier(tier: 'PRO')` decorator and `@Injectable()` `TierGuard` implementing `CanActivate`. Reads request user tier and rejects unprivileged callers with `ForbiddenException`.
- Create `operation-service/src/tier/tier.service.ts` (`@Injectable()`):
  - Methods:
    - `getSymbols(userTier: Tier)`: returns symbol list with `proOnly` flags and `userTier`.
    - `checkSymbolAccess(userTier: Tier, symbol: string)`: checks `canAccessSymbol` for `userTier`, returning `{ symbol, allowed, tier: userTier }`.
    - `getCombinations(userTier: Tier)`: returns allowed symbol×timeframe matrix for `userTier`.

### Step 2: TierController

- Create `operation-service/src/tier/tier.controller.ts`.
- Decorate with `@Controller('tier')` and `@UseGuards(JwtAuthGuard)`.
- Handlers (all returning `@HttpCode(200)`):
  - `@Get('symbols')` `getSymbols(@Req() req: AuthenticatedRequest)`
  - `@Get('check/:symbol')` `checkSymbolAccess(@Req() req: AuthenticatedRequest, @Param('symbol') symbol: string)`
  - `@Get('combinations')` `getCombinations(@Req() req: AuthenticatedRequest)`

### Step 3: Module Registration & Unit Tests

- Create `operation-service/src/tier/tier.module.ts`.
- Register `TierModule` in `operation-service/src/app.module.ts`.
- Write unit test suites:
  - `operation-service/src/tier/tier.controller.spec.ts`
  - `operation-service/src/tier/tier.service.spec.ts`
  - `operation-service/src/auth/tier.guard.spec.ts`
- Run and verify: `npm run test` inside `operation-service`.

### Step 4: Monolith Transport Layer & Forwarding

- Add `shouldUseOperationServiceForTier()` in `lib/operation-service/flags.ts` (checks `process.env['MIGRATE_TIER'] === 'true'`).
- Update monolith route handlers to widen `_request` -> `request` and forward traffic when flag is on:
  - `app/api/tier/symbols/route.ts`
  - `app/api/tier/check/[symbol]/route.ts`
  - `app/api/tier/combinations/route.ts`
- Run and verify: `npm run build` and `tsc --noEmit` in monolith root.

### Step 5: Deployment, Davin Approval & Cutover

- Deploy `operation-service` to Railway (`railway up --path-as-root`).
- Verify `/health` -> 200 and unauthenticated `/tier/symbols` -> 401.
- **STOP for Davin live approval checkpoint** before setting `MIGRATE_TIER=true`.
- Set `MIGRATE_TIER=true` in Vercel production environment variables and trigger redeploy.
- Perform live smoke test (fetch symbols, check symbol access, fetch combinations).

---

## Rules specific to this variant

- **Creativity Dial:** **LOW**. Preserves exact response structures and status code (`200 OK`) for all endpoints.
- **Invariant:** Preserve exact symbol/timeframe tier mapping matching `lib/tier-config.ts`.

---

## Slice-level verification

- [x] Endpoints & `TierGuard` ported into `operation-service/src/tier/`.
- [x] Unit tests (`tier.controller.spec.ts`, `tier.service.spec.ts`, `tier.guard.spec.ts`) pass. 14 new tests; `operation-service` 36/36 suites, 295/295 tests (was 33/33, 281/281 at 4B-9 close).
- [x] `nest build` / `tsc --noEmit` clean in `operation-service`.
- [x] Monolith `npm run build` / `tsc --noEmit` clean. `test:ci` 122/122 suites, 2157/2157 tests (was 2150/2150 at 4B-9 close — +7, matching the 5 new `check/[symbol]` tests + 2 additional forwarding tests beyond the 1 already counted).
- [x] Deployed to Railway, `/health` -> 200. Deployment `1dbf7aab-8411-4b72-9f90-b853a2b1babe` SUCCESS; fresh boot log shows `TierModule dependencies initialized`, `TierController {/tier}` with all 3 routes mapped, zero DI errors, timestamps correlate with this deployment. Unauthenticated `/tier/symbols`, `/tier/check/XAUUSD`, `/tier/combinations` all -> 401 (not 404); a real nonexistent route -> 404 as a control.
- [ ] `MIGRATE_TIER=true` set on Vercel production + live smoke test verified. **Pending Davin's separate, explicit live approval per this order's own Step 5 checkpoint** (distinct from the session's general go-ahead).

---

## Rollback

If issues occur post-cutover:

1. Set `MIGRATE_TIER=false` in Vercel production environment variables.
2. Redeploy Next.js monolith. Traffic immediately reverts to local monolith Prisma routes. Zero downtime.

---

## Deviations

1. **CONFIRM (L11 recurrence, 12th+ occurrence):** order file, `CLAUDE.md`, and `migration-cutover-table.md` were all modified-but-uncommitted at session open, with only the committed PRE-DRAFT (`c1dcb339`) on record and no visible PRE-DRAFT→DRAFT→APPROVED commit trail for the rewrite. The PRE-DRAFT's own "Open question #1" (route port vs. reusable guard vs. both) was resolved to "both" with no visible decision trail either. Reported in full before proceeding; Davin confirmed live in chat that both the rewrite and the "both" scope resolution were his/the Advisor's own authentic edits.
2. **`canAccessSymbol` name collision, found at CONFIRM:** `lib/tier-config.ts` has `canAccessSymbol(symbol, tier)` (matches what the 3 SOURCE routes conceptually do, though they actually inline `SYMBOLS.includes()` rather than calling it); `lib/tier-validation.ts` has a _different_ `canAccessSymbol(tier, symbol)` — reversed argument order, already used by Drawings/Alerts. `TierService.checkSymbolAccess` is built against `tier-config.ts`'s semantics (argument order `(symbol, tier)`, tier-independent XAUUSD-only check) to match the real SOURCE, not `tier-validation.ts`'s.
3. **Step 4's "widen `_request` → `request`" is only accurate for 1 of 3 files, found at CONFIRM:** `check/[symbol]/route.ts` has an existing unused `_request: NextRequest` to widen. `symbols/route.ts` and `combinations/route.ts` currently take **zero parameters** — a `request: NextRequest` param is added fresh in both (same class of gap as 4B-9's own POST handler finding).
4. **Known Wrinkles' lesson citations were crossed, found at CONFIRM (not fixed in the order text, followed on their merits instead):** "L43" was used for two unrelated lessons (the archived `.railwayignore`-anchoring rule and the active file's real L43, about `@HttpCode`/status-code defaults), and "L44" (railway.json) only exists in `LESSONS-ARCHIVE.md`, not the active file. The underlying advice was still followed on its own merits: `railway.json`/`.railwayignore` were left untouched (no config drift since 4B-9), and all 3 `@Get()` handlers get explicit `@HttpCode(200)` per Step 2 (harmless — NestJS's `@Get()` already defaults to 200; the real active L43 risk is specifically about `@Post()`, which this domain has none of).

---

## Known wrinkles / do-not-touch

- **Rule L43:** Anchor root ignore patterns in `.railwayignore` with leading slashes (`/src`).
- **Rule L44:** Maintain `railway.json` with `healthcheckPath: "/health"` and `startCommand: "npm run start"`.
- **Rule L43 (HttpStatus):** Ensure `@Get()` endpoints explicitly return `200 OK` matching monolith behavior.

---

## Next-session handoff

- **Session 4B-11:** Phase 4B user/profile/2FA/sessions domain extraction & cutover.

# Migration Order: Market Data Channel Proxy Extraction & Cutover (Session 4B-12)

> Migration Order for Session **4B-12** (Market Data Channel Proxy Extraction & Cutover).  
> Variant: **PORT** (Creativity Dial: **LOW** — behavior preservation is the deliverable).  
> Target Service: `operation-service` (`src/market-data/` module) & Monolith (`app/api/market-data/channel/route.ts`).

**Session:** 4B-12  
**Phase / plan section:** Phase 4B step 12, plan §6  
**Target service:** `operation-service` & Next.js Monolith  
**Variant:** PORT · **Status:** CONFIRMED (2026-08-02)  
**Generated:** 2026-08-02 (Advisor upgrade from PRE-DRAFT, Davin APPROVED 2026-08-02, Executor CONFIRMED 2026-08-02).  
**Flags touched:** `MIGRATE_MARKET_DATA_CHANNEL` (default `false`, defined in `lib/operation-service/flags.ts`)  
**Contract:** Parity with `app/api/market-data/channel/route.ts` (125 lines):

- `GET /api/market-data/channel`: PRO-exclusive multi-timeframe centroid channel visualization endpoint.
- Validates query params (`symbol`: XAUUSD, `timeframe`: M5/M15, `variant`: centroid variants, `limit`: default 300, max 1000).
- Validates caller tier: returns 403 Forbidden with exact body `{ success: false, error: 'Multi-timeframe visualization is a PRO feature', message: 'Upgrade to PRO to overlay M5 channel structure on M15 charts.' }` for `FREE` tier users.
- Step 0 mirrors all 18 centroid channel fields (`best_fit`, `cherry_a`, `cherry_b`, `most_recent`, `non_a`, `non_b` x `uoedt`/`base_fl`/`loedt`) into `operation-service/prisma/schema.prisma` (`MarketDataV6` model) and runs `npx prisma generate`.
- Queries `MarketDataV6` and formats equal-distance channel points (`upper`, `mid`, `lower`).

**Estimated session time:** ~1.5h

---

## Entry criteria

- [x] Session 4B-11 CONFIRMED & Closed (2026-08-02) — User Profile / 2FA / Sessions domain live in production (`MIGRATE_USER_PROFILE=true`, `MIGRATE_USER_2FA=true`, `MIGRATE_USER_SESSIONS=true`).
- [x] Additive schema mirror sync in Step 0: Add 18 centroid channel fields (`Float?`) to `MarketDataV6` in `operation-service/prisma/schema.prisma` and run `npx prisma generate` (zero DB migrations required).
- [x] `TierGuard` and `JwtAuthGuard` available in `operation-service/src/auth/`.
- [x] `forwardRequestToOperationService()` available in `lib/operation-service/write-routes.ts` and `getOperationServiceToken()` available in `lib/operation-service/client.ts`.
- [x] SOURCE file re-verified against live codebase (`app/api/market-data/channel/route.ts`: 125 lines, not 126 — see Deviations #3).

---

## Integration points

- **Direct callers:** Monolith Next.js route handler (`app/api/market-data/channel/route.ts`), frontend multi-timeframe chart overlay components (`components/charts/trading-chart.tsx`).
- **Downstream dependencies:** PostgreSQL Database (`MarketDataV6` table via PrismaService).
- **Domain ownership:** `operation-service` becomes canonical provider for market-data channel queries when `MIGRATE_MARKET_DATA_CHANNEL=true`.

---

## File Port Order

### Step 0: Prisma Schema Mirror Sync, DTOs & Validation Schemas

- Add the 18 centroid variant fields (`Float?`) to `MarketDataV6` model in `operation-service/prisma/schema.prisma`:
  - `best_fit_uoedt`, `best_fit_base_fl`, `best_fit_loedt`
  - `cherry_a_uoedt`, `cherry_a_base_fl`, `cherry_a_loedt`
  - `cherry_b_uoedt`, `cherry_b_base_fl`, `cherry_b_loedt`
  - `most_recent_uoedt`, `most_recent_base_fl`, `most_recent_loedt`
  - `non_a_uoedt`, `non_a_base_fl`, `non_a_loedt`
  - `non_b_uoedt`, `non_b_base_fl`, `non_b_loedt`
- Run `npx prisma generate` inside `operation-service`.
- Create `operation-service/src/market-data/market-data.schemas.ts` and `dto/channel.dto.ts`:
  - Define `CENTROID_VARIANTS` and `CentroidVariant` type locally.
  - Define query param validation DTO (`symbol`, `timeframe`, `variant`, `limit`) with default values (limit: 300, min: 1, max: 1000).

### Step 1: MarketDataService & MarketDataController

- Create `operation-service/src/market-data/market-data.service.ts` (`@Injectable()`):
  - Method `getChannelData(userTier: Tier, symbol: string, timeframe: string, variant: CentroidVariant, limit: number)`:
    - Enforces `userTier === 'PRO'` (returning 403 Forbidden with exact payload `{ success: false, error: 'Multi-timeframe visualization is a PRO feature', message: 'Upgrade to PRO to overlay M5 channel structure on M15 charts.' }` for `FREE` tier).
    - Queries `MarketDataV6` (`symbol`, `timeframe`, `timestamp desc`, `take: limit`).
    - Maps rows to `ChannelPoint[]` (`upper`, `mid`, `lower`) and returns `{ success: true, symbol, timeframe, variant, points }`.
- Create `operation-service/src/market-data/market-data.controller.ts`:
  - Handlers: `@Get('market-data/channel')` decorated with `@UseGuards(JwtAuthGuard)`, `@HttpCode(200)`.

### Step 2: Module Registration & Unit Tests

- Create `operation-service/src/market-data/market-data.module.ts`.
- Register `MarketDataModule` in `operation-service/src/app.module.ts`.
- Write unit test suites:
  - `operation-service/src/market-data/market-data.controller.spec.ts`
  - `operation-service/src/market-data/market-data.service.spec.ts`
- Run and verify: `npm run test` inside `operation-service`.

### Step 3: Monolith Transport Layer & Forwarding

- Add `shouldUseOperationServiceForMarketDataChannel()` in `lib/operation-service/flags.ts` (checks `process.env['MIGRATE_MARKET_DATA_CHANNEL'] === 'true'`).
- Update `app/api/market-data/channel/route.ts` to forward traffic to `operation-service` when flag is on.
- Run and verify: `npm run build` and `tsc --noEmit` in monolith root.

### Step 4: Deployment, Davin Approval & Cutover

- Deploy `operation-service` to Railway (`railway up --path-as-root`).
- Verify `/health` -> 200 and unauthenticated `GET /market-data/channel` -> 401.
- **STOP for Davin live approval checkpoint** before setting `MIGRATE_MARKET_DATA_CHANNEL=true`.
- Set `MIGRATE_MARKET_DATA_CHANNEL=true` in Vercel production environment variables and trigger redeploy.
- Perform live smoke test (`fetch('/api/market-data/channel?timeframe=M5')`).

---

## Rules specific to this variant

- **Creativity Dial:** **LOW**. Preserves exact response structures, field validations, status codes (`200 OK`, `401 Unauthorized`, `403 Forbidden`, `400 Bad Request`), and error strings.
- **Rule L43:** Ensure exact `@HttpCode(200)` status is decorated on controller handlers.

---

## Slice-level verification

- [x] 18 centroid variant columns mirrored into `MarketDataV6` schema and `prisma generate` run clean.
- [x] Endpoints ported into `operation-service/src/market-data/`.
- [x] Unit tests (`market-data.controller.spec.ts`, `market-data.service.spec.ts`) pass — 11/11, plus 13 new monolith-side forwarding tests (`__tests__/api/market-data-channel.test.ts`, first-ever coverage for this route).
- [x] `nest build` / `tsc --noEmit` clean in `operation-service` — full suite 40/40 suites, 359/359 tests (was 38/38, 348/348 at 4B-11's close).
- [x] Monolith `npm run build` / `tsc --noEmit` clean — full `test:ci` 123/123 suites, 2171/2171 tests (was 122/122, 2158/2158); `eslint --max-warnings 0` clean.
- [x] Deployed to Railway, `/health` -> 200. Deployment `7a097df5` confirmed `SUCCESS` (not the stale top-level status — checked `latestDeployment.status` specifically per L-precedent). Unauthenticated `GET /market-data/channel` -> 401 (not 404 — proves the route is genuinely mapped); a real nonexistent route -> 404 as control. Fresh boot log for this exact deployment shows `MarketDataController {/market-data}` registered, `Mapped {/market-data/channel, GET}`, `Nest application successfully started`, zero DI errors — log lines timestamp-correlated to the verification requests just sent.
- [ ] **STOP — awaiting Davin's live approval checkpoint before this step.** `MIGRATE_MARKET_DATA_CHANNEL=true` NOT yet set on Vercel production; no live smoke test performed. Everything above this line is built, tested, and deployed with zero traffic cut over — `operation-service`'s new route receives none of the monolith's real traffic until this flag flips.

---

## Rollback

If issues occur post-cutover:

1. Set `MIGRATE_MARKET_DATA_CHANNEL=false` in Vercel production environment variables.
2. Redeploy Next.js monolith. Traffic immediately reverts to local monolith Prisma route. Zero downtime.

---

## Deviations

1. **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern**: the only commit
   touching this file is the honest PRE-DRAFT (4 explicit "not checked this session" open
   questions); the working tree carried an uncommitted `PRE-DRAFT → APPROVED` full rewrite with
   no DRAFT/approval commit trail, all 4 open questions silently resolved. Reported in full
   before proceeding; Davin confirmed live it was his/the Advisor's own authentic edit, and
   explicitly named 3 of the resolutions in his confirmation (Step 0 schema mirror sync, local
   `CENTROID_VARIANTS` definition, exact 403 payload parity).
2. **Entry Criterion #2 ("`MarketDataV6` model present") was technically true but practically
   insufficient — a real gap, not caught by the order's own literal text.** The model exists in
   `operation-service/prisma/schema.prisma` but was a 5-field subset (`id/symbol/timeframe/
timestamp/close`, mirrored Session 4B-2 for the alert-engine's own `close`-only lookup) missing
   all 18 columns this route actually reads (`${variant}_uoedt`/`${variant}_base_fl`/
   `${variant}_loedt` for each of the 6 `CENTROID_VARIANTS`). Confirmed by reading the real
   monolith `prisma/market-data/schema.prisma` directly. Added as an explicit Step 0 sub-step
   (below) rather than silently building Step 1 against an incomplete schema — additive only
   (`Float?` columns, `prisma generate` only, no migration, since the columns already exist in
   the live `market_data_v6` table; L1 still holds — operation-service never migrates).
3. **SOURCE line-count citation drifted `+1` in the APPROVED rewrite** (PRE-DRAFT said 125,
   matching `wc -l`; APPROVED said 126) — same class as the 4A-W1/4A-W2 "+1 across every
   citation" recurrence. Corrected to 125 (real).
4. **Error envelope shape**: this service's global `AllExceptionsFilter` (Session 4B-4)
   reshapes every thrown `HttpException` into `{statusCode, message, error, timestamp, path,
correlationId}` — not a literal `{success, error, message}` passthrough. Followed the same
   established convention as Drawings/Tier (throw `ForbiddenException`/`BadRequestException`
   with a `{success, error, message}` payload object; the filter extracts `error`/`message` and
   reshapes the envelope) — this is a repo-wide, already-shipped convention (4A-9's own
   Deviations documents the same decision for money-service), not something re-litigated here.
   The exact SOURCE error/message TEXT is preserved byte-for-byte; only the outer envelope
   shape differs, consistent with every other ported module.
5. **Validation split, not a single Zod schema**: `channelQuerySchema` (Zod, parameter-level via
   `@Query(new ZodValidationPipe(...))`, L45-safe — no `:id`/path param on this route) handles
   ONLY structural defaulting (uppercase symbol/timeframe, default variant, NaN-tolerant limit
   clamp, mirroring SOURCE's `Number(limit) || DEFAULT_LIMIT` exactly). Membership validation
   (is this symbol/timeframe/variant actually supported?) stays in `MarketDataService`, matching
   `DrawingsService`'s own established split — SOURCE's exact per-field 400 error strings
   (`'Unsupported symbol (XAUUSD only)'`, etc.) are hand-written checks, not schema-shaped, and a
   generic Zod enum error would not reproduce them.

---

## Known wrinkles / do-not-touch

- **Rule L43:** Anchor root ignore patterns in `.railwayignore` with leading slashes (`/src`).
- **Rule L44:** Maintain `railway.json` with `healthcheckPath: "/health"` and `startCommand: "npm run start"`.

---

## Next-session handoff

- **Session 4B-17 / Phase 4B Completion Review:** Final review of Phase 4B microservices extraction and readiness for Phase 5.

# Migration Order: Market-Data Channel Proxy (Session 4B-12)

> PRE-DRAFT — raw facts for the Advisor to upgrade into a DRAFT. Not yet reviewed by Davin.

**Session:** 4B-12
**Phase / plan section:** Phase 4B step 12, plan §6 (session playbook line ~326-327: "alerts CRUD →
drawings + drawing-alerts → notifications → tier (guard) → user/profile/2FA/sessions →
**market-data channel proxy**") — the last domain slice before Session 4B-17 (Realtime, F8).
**Target service:** `operation-service` & Next.js Monolith
**Variant:** likely PORT (LOW creativity dial) — this is a single read-only endpoint, by far the
smallest domain slice in the entire Phase 4B sequence (14 files/2,060 lines for 4B-11 vs. 1 file/
125 lines here).
**Status:** PRE-DRAFT (2026-08-02, written at Session 4B-11's close)

---

## Raw facts (Executor, for the Advisor to upgrade into a DRAFT)

**SOURCE (1 file, 125 lines, re-verify at DRAFT/CONFIRM):**

- `app/api/market-data/channel/route.ts` (125 lines) — `GET /api/market-data/channel?
timeframe=M5&variant=best_fit&limit=300`. Returns equal-distance channel lines (`uoedt`/`base_fl`/
  `loedt`) from `market_data_v6` for multi-timeframe chart overlays. **PRO-exclusive** (V8: this
  specific endpoint is tier-gated — checked directly against `session.user.tier`, not via the
  reusable `TierGuard` built in 4B-10, since that guard didn't exist yet when this route was
  written). Reads `marketPrisma` (the market-data Prisma client, `lib/db/market-prisma.ts` —
  distinct from the non-market `prisma` client every other 4B slice has used) and
  `SYMBOLS`/`TIMEFRAMES`/`Tier` from `lib/tier-config.ts`, `CENTROID_VARIANTS`/`CentroidVariant`
  from `types/indicator.ts`.

**Not checked this session, flag for DRAFT/CONFIRM:**

- Whether `operation-service`'s existing narrow-subset `MarketDataV6` model (mirrored in Session
  4B-2 for the alert-engine's own XAUUSD-only lookup, `operation-service/prisma/schema.prisma`) has
  the fields this route actually needs (`uoedt`/`base_fl`/`loedt` centroid-variant columns, plus
  whatever `timeframe`/`variant`/`limit` querying requires) — 4B-2's own mirror was deliberately a
  narrow 5-of-79-field subset scoped to ONE consumer (`fetchXauusdPriceFromGatewayPipeline`'s
  `close`-only read). This route reads different, likely additional columns — schema-sync work is
  probably needed here too, same shape as 4B-11's own Step 0 (see that session's Deviations #1 for
  the discovery pattern to follow: read the real SOURCE query's `select`, not just field names).
- Whether to reuse the existing `TierGuard`/`@RequireTier()` (built 4B-10, unused by any of its own
  3 handlers so far) for this route's PRO-exclusive check, or keep the inline tier check this route
  already does — `TierGuard` would be its first real consumer if used here.
- Whether `types/indicator.ts`'s `CentroidVariant`/`CENTROID_VARIANTS` need porting into
  `operation-service` (likely yes, small/pure) or can be redefined locally (matching the
  `tier.schemas.ts`/`drawings.schemas.ts` precedent of NOT importing monolith `lib/`/`types/`
  directly).
- Given this is the LAST domain slice before Session 4B-17 (Realtime, F8), whether 4B-12 should
  also serve as a natural checkpoint for a "final Phase 4B completion review" (per the session
  playbook's own framing in 4B-11's Next-session handoff) — i.e., does this session also update/
  audit the cutover table's overall Phase 4B status, or is that a separate step?

**Established transport pattern (reuse, don't reinvent):** `forwardRequestToOperationService()`
(`lib/operation-service/write-routes.ts`) + `getOperationServiceToken()`
(`lib/operation-service/client.ts`) + a new `shouldUseOperationServiceForMarketDataChannel()` (or
similarly-named) reader in `lib/operation-service/flags.ts`, matching every prior slice's shape.

**Given the very small scope (1 file, 1 endpoint, no writes, no auth-semantics complexity like
4B-11's), this session is a strong candidate for a fast, single-session PORT+CUTOVER combined
shape** (same as Sessions 4B-8/9/10/11), rather than a multi-session split.

---

## Candidate steps (Advisor to confirm/adjust)

0. Resolve the open questions above — especially the `MarketDataV6` schema-subset check (read the
   real SOURCE `marketPrisma` query's exact `select`/`where` shape before assuming the existing
   4B-2 mirror is sufficient).
1. Port the route into `operation-service/src/market-data/` (or similar) — `MarketDataController`/
   `MarketDataService`, `JwtAuthGuard` + tier check (guard vs. inline, per open question above).
2. Unit tests + module registration.
3. Monolith flag reader + forwarding wired into the 1 route file.
4. Deploy + Davin live-approval checkpoint + cutover + live smoke test.

---

## Deviations

_(none yet — PRE-DRAFT, not executed)_

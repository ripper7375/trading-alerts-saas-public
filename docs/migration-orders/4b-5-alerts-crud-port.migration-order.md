# Migration Order — PORT variant

> For sessions that **move existing code between stacks** (Next.js lib/routes → NestJS;
> monolith rewiring). Read `00-SKELETON-AND-RULES.md` first — §4 applies with the dial at
> **Low**: behavior preservation IS the deliverable. The current code is ground truth.

**Session:** 4B-5 · **Variant:** PORT · **Status:** PRE-DRAFT
**Generated:** 2026-08-01 (Executor, at 4B-4's close, per `EXECUTOR-PROTOCOL.md` §3.5)
**Flags touched:** none yet — this session is BUILD only (zero traffic cut over); the cutover flag
name is Davin/Advisor's call at DRAFT time, matching the `MIGRATE_*` naming convention already
established for Slices 3-5.
**Estimated time:** unknown — 971 lines across 4 route files + parity-oracle tests (762 lines);
depends on how much the Advisor scopes into this session vs. splits (line-alerts vs. plain alerts
could plausibly be two sessions, see Known wrinkles).
**Target service:** `operation-service`
**Contract:** no OpenAPI spec exists yet for these routes — the 4 SOURCE files' own real behavior
(request/response shapes, status codes, ownership checks) IS the contract for this PORT, per the
template's own "current code is ground truth" rule. Whether a formal OpenAPI spec gets frozen
for this surface is an Advisor/Davin call, not assumed here.

## Entry criteria

- [x] Session 4B-4 CONFIRMED and closed (2026-08-01) — F13 resolved, shared infra (logging/
      correlation-ID/cache/exception-filter) live in `operation-service`.
- [x] `operation-service` already owns the Prisma models this session needs — `Alert`,
      `DrawingAlert`, `Drawing` were mirrored additively in Session 4B-2 (found mid-session while
      porting the alert-engine's own `worker.ts`, not originally in that session's own Step 0
      list). **No new schema work should be needed for 4B-5** — verify this holds at CONFIRM,
      don't assume it.
- [x] `lib/validations/alert.ts` (39 lines) is already ported byte-identical into
      `operation-service/src/alert-engine/validations/alert.ts` (39 lines, re-exports
      `@trading-alerts/types/alert-engine`'s validations, Session 4B-1/4B-2) — reuse it, don't
      re-port it.
- [x] Geometry math (`levelsForMark`/`MarkSnapshot`) is already consumable from
      `@trading-alerts/types/geometry` (Session 4B-1, F9) — `operation-service/src/alert-engine/
watches.ts` already imports it this way; the line-alerts routes should follow the same pattern
      rather than re-importing from `@/components/charts/drawing/geometry` (a monolith-only path).
- [x] `JwtAuthGuard` (Session 3-1, F7) already exists in `operation-service/src/auth/` — the
      NextAuth-JWE verification bridge these new routes need for auth, already proven live on
      other operation-service routes.
- [ ] File inventory below re-verified against live codebase (paths + line counts) — cited numbers
      below are from this PRE-DRAFT's own read at 4B-4's close (2026-08-01); re-check at CONFIRM.

## Integration points

- **In:** browser (Next.js API routes today) → will become browser → monolith proxy →
  `operation-service` once a Slice-3/4-style transport layer exists for this route group (not
  built yet — this session's own scope is the operation-service side only, matching every prior
  PORT-then-transport-then-cutover sequence in this migration, e.g. 4A-7a/4A-9/4A-10a).
- **Out:** Prisma (`Alert`/`DrawingAlert`/`Drawing`, already available), the alert-engine's own
  `evaluator`/`state` (a NEW alert becoming immediately evaluable by the already-cut-over worker
  is a real invariant to preserve — verify the worker's Redis `watches loaded` mechanism actually
  picks up rows created via `INSERT` through Prisma, not just through its own bootstrap query, at
  DRAFT/CONFIRM time).
- **Owns:** no new tables — reuses `Alert`/`DrawingAlert`/`Drawing`, already schema-mirrored.

## File Port Order

_(dependency order: pure/leaf modules → stateful adapters → orchestration → entrypoints → tests
last, ported with assertions UNCHANGED — they are the parity oracle)_

### File 1/4

- **SOURCE:** `app/api/alerts/route.ts` (244 lines, `GET` list + `POST` create with tier-quota
  validation via `PRO_TIER_CONFIG`/`SYMBOLS`/`TIMEFRAMES` from `lib/tier-config`) → **TARGET:**
  `operation-service/src/alert-engine/alerts.controller.ts` (or a dedicated `alerts/` module —
  Advisor to decide whether this belongs inside the existing `AlertEngineModule` or a sibling
  `AlertsCrudModule`; either is defensible, not decided here)
- **Kind:** port + adapt (NextRequest/NextResponse → Nest controller/DTO; `getSession()` →
  `JwtAuthGuard` + `@Req() AuthenticatedRequest`)
- **Port steps:** re-derive the tier-quota check against whatever `operation-service` already
  knows about the user's tier (verify `AuthenticatedRequest.user.tier` — used elsewhere in this
  service, e.g. `health-auth` — actually carries the same tier value `PRO_TIER_CONFIG` checks
  against, don't assume it silently). `SYMBOLS`/`TIMEFRAMES` constants need a home — check whether
  `@trading-alerts/types` already carries them (from the geometry/alert-engine port) before
  duplicating.
- **Invariants:** V8's XAUUSD-only / M5-M15-only lock (`createAlertSchema`'s own `z.enum` error
  messages) must be preserved byte-for-byte — this is a real product constraint, not incidental.
- **Parity proof:** `__tests__/api/alerts.test.ts` (678 lines — covers both this file and File
  2/4; the SOURCE for both) — assertions ported unchanged.
- **Commit:** `migrate(alerts-crud): port GET/POST /api/alerts to operation-service`

### File 2/4

- **SOURCE:** `app/api/alerts/[id]/route.ts` (304 lines, `GET` single / `PATCH` update / `DELETE`
  soft-delete) → **TARGET:** `operation-service/src/alert-engine/alerts.controller.ts` (same
  controller as File 1, REST convention)
- **Kind:** port + adapt (same NextRequest→Nest, `getSession()`→`JwtAuthGuard` transform as File 1)
- **Port steps:** ownership check (alert belongs to the requesting user) must stay a real 403/404
  distinction if the SOURCE makes one — read the actual response codes before assuming a
  simplification is safe (PORT dial is LOW).
- **Invariants:** "soft delete" — confirm at CONFIRM time whether this sets a status flag or
  actually removes the row; the file's own header says "soft delete" but the literal code is
  ground truth, not the comment.
- **Parity proof:** same `__tests__/api/alerts.test.ts`.
- **Commit:** `migrate(alerts-crud): port GET/PATCH/DELETE /api/alerts/[id] to operation-service`

### File 3/4

- **SOURCE:** `app/api/alerts/line/route.ts` (235 lines, `GET` list / `POST` create — attaches an
  alert to a drawn chart line, validates `targetLevel` against `levelsForMark`, creates
  `Alert`+`DrawingAlert` atomically, publishes `alerts:changed`) → **TARGET:**
  `operation-service/src/alert-engine/line-alerts.controller.ts` (or folded into the same
  controller as Files 1-2 — Advisor's call; SOURCE treats these as a genuinely separate concern
  from plain alerts, which argues for a separate controller, not decided here)
- **Kind:** port + adapt. **Real auth-mechanism drift already found, not yet resolved:** this file
  uses `getServerSession(authOptions)` directly, NOT the `getSession()` wrapper Files 1-2 use —
  confirm at CONFIRM whether these are behaviorally identical (they may well be; `getSession()`
  could just be a thin wrapper) before assuming the same `JwtAuthGuard` swap applies uniformly.
- **Port steps:** swap `levelsForMark`/`MarkSnapshot` import from `@/components/charts/drawing/
geometry` (monolith-only path) to `@trading-alerts/types/geometry` (already the convention
  `watches.ts` uses, Session 4B-1/4B-2) — same underlying math, different import path only.
  `alerts:changed` publish target (Redis channel) must reach the SAME channel the already-live
  `AlertWorkerService` subscribes to (verified live since Session 4B-3) — a real cross-cutover
  invariant, not a detail.
- **Invariants:** TEXT drawings rejected (not alertable) — an explicit business rule in the
  SOURCE's own header comment, must survive the port. Atomicity (`Alert`+`DrawingAlert` created
  together) must stay a real transaction, not two separate writes.
- **Parity proof:** `__tests__/drawing/alertsApi.test.ts` (84 lines).
- **Commit:** `migrate(alerts-crud): port GET/POST /api/alerts/line to operation-service`

### File 4/4

- **SOURCE:** `app/api/alerts/line/[id]/route.ts` (188 lines, `PATCH` update/pause-resume /
  `DELETE` — `:id` is the `DrawingAlert` id, ownership via `drawing.userId`) → **TARGET:** same
  controller as File 3.
- **Kind:** port + adapt (same `getServerSession(authOptions)` question as File 3).
- **Port steps:** ownership check traverses `DrawingAlert → Drawing → userId`, not
  `DrawingAlert.userId` directly (matches the 4B-2 schema-mirror precedent — `DrawingAlert`'s
  relations to `Drawing`/`Alert` were built as real Prisma relations specifically because
  `worker.ts` already traverses them this way).
- **Invariants:** same `alerts:changed` publish-target requirement as File 3.
- **Parity proof:** `__tests__/drawing/alertsApi.test.ts` (same file as File 3, covers both).
- **Commit:** `migrate(alerts-crud): port PATCH/DELETE /api/alerts/line/[id] to operation-service`

## Rules specific to this variant

- Changing a ported test's assertion requires a written justification in Deviations (L3).
- Wrong Prisma client = boundary violation — these models live in the SAME unified
  `PrismaService` operation-service already uses (Session 4B-1 confirmed this, not the monolith's
  market/non-market split), so this specific risk is lower than earlier PORT sessions, but still
  verify at CONFIRM rather than assume.
- SOURCE files become **change-frozen (CC-F)** the moment a shadow-run starts (next session, not
  this one).
- This session ends with the NestJS side built and unit-tested; a transport/flag layer on the
  monolith side (mirroring 4A-7a's/4A-9→4A-10a's own pattern) is almost certainly its own
  follow-up session before any cutover can happen — flag this explicitly rather than assuming a
  cutover order can follow directly, per `LESSONS-LEARNED.md` L31 (a BUILD session shipping only
  the new side leaves the cutover flag a no-op).

## Slice-level verification (done when)

- [ ] Ported suites green in `operation-service` (both cited test files' assertions preserved)
- [ ] `operation-service` `tsc --noEmit`/`nest build` clean; monolith untouched, `tsc --noEmit`
      clean, `test:ci` green (source files not modified — this session doesn't rewire the
      monolith side at all, matching every prior PORT session's own scope)
- [ ] The 4 real invariants named above (XAUUSD/M5-M15 lock, ownership-check response codes,
      TEXT-drawing rejection, `alerts:changed` channel match) each have an explicit test, not just
      inherited coverage from the ported assertions

## Cutover & rollback (next session's order — reference only)

- **Mechanism / precondition / rollback:** not decided here — needs its own monolith-side
  transport+flag session first (see Rules above), then a VERIFY-RETIRE cutover session after that,
  matching the established 3-session shape (PORT → transport BUILD → CUTOVER) most other slices
  in this migration have used.

## Retire (after cutover proves stable)

- [ ] Delete the 4 SOURCE route files; update cutover table; `CLAUDE.md`; the monolith's
      `app/api/alerts/**` entry in `migration-stack-analysis.md`'s BACKEND list

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- **Two different auth-read mechanisms in the 4 SOURCE files** (`getSession()` vs.
  `getServerSession(authOptions)` directly) — not yet explained, needs checking at DRAFT/CONFIRM
  before assuming one `JwtAuthGuard` swap fits both uniformly.
- **Scope-split risk:** "plain alerts" (Files 1-2) and "line alerts" (Files 3-4) are different
  enough in their own right (different auth read, different atomicity/geometry concerns) that the
  Advisor may reasonably split this into two PORT sessions rather than one — not decided here,
  flagged for that judgment call.
- Do not touch `lib/websocket/server.ts`, `lib/alert-engine/notify-bridge.ts`, or
  `lib/alert-engine/types.ts` — those stay in the monolith by design until Session 4B-17 (F8), per
  4B-3's own close-out note in `CLAUDE.md`. The `alerts:changed` Redis publish these new routes
  need to preserve is a DIFFERENT channel from the fired-alert notification bridge F8 governs —
  confirm this distinction explicitly before touching either.
- `SYMBOLS`/`TIMEFRAMES`/`PRO_TIER_CONFIG` (`lib/tier-config`) have not been checked against
  `@trading-alerts/types` — may need a NEW additive export from that shared package (matching the
  geometry/validations precedent) rather than being duplicated inline in operation-service.

## Next-session handoff

_(DRAFT for the monolith-side write-transport BUILD, mirroring 4A-7a's/4A-9→4A-10a's own shape —
not pre-drafted yet; depends on how 4B-5 actually lands and whether the Advisor splits it.)_

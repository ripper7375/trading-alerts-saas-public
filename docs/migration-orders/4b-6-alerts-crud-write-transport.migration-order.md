# Migration Order — Standard Loop / UI-BUILD variant

> Read `00-SKELETON-AND-RULES.md` first. This session builds the **Monolith-side Write Transport
> Layer & Feature Flag Wiring** for Alerts CRUD (Session 4B-5's `operation-service` port) before any
> cutover can occur. Mirrors the established PORT → transport BUILD → CUTOVER shape (4A-7a→4A-7b,
> 4A-9→4A-10a→4A-10b, 4B-2→4B-3).

**Session:** 4B-6 (BUILD) · **Variant:** Standard Loop / UI-BUILD · **Status:** PRE-DRAFT
**Generated:** 2026-08-01 (Executor, at 4B-5's close, per `EXECUTOR-PROTOCOL.md` §3.5)
**Phase / plan section:** Phase 4B step 6
**Ground truth:** `4b-5-alerts-crud-port.migration-order.md` (all 4 routes now live in
`operation-service`), `lib/money-service/routes.ts`/`flags.ts` (Slice 3 read-transport precedent,
4A-7a) and `lib/money-service/write-routes.ts`/`flags.ts` (Slice 4 write-transport precedent,
4A-10a) — this session's own shape should mirror the write-transport precedent (forward the raw
request + auth), not the simpler read-transport one, since 3 of the 4 alerts routes are writes.
**Flags to define:** `MIGRATE_ALERTS_CRUD` (default `false` / stays on monolith) — the order's own
4B-5 predecessor already reserved this name; confirm it is STILL unused anywhere in code before
relying on that (re-verify at CONFIRM, don't assume from the name reservation alone).
**Estimated session time:** ~2h

---

## Entry criteria

- [ ] Session 4B-5 CONFIRMED and closed (2026-08-01) — verify live: all 4 routes exist and are
      guarded by `JwtAuthGuard` in `operation-service` (`AlertsController`/`LineAlertsController`).
- [ ] `MIGRATE_ALERTS_CRUD` still has zero readers anywhere in code (grep before writing any
      forwarding logic — per `LESSONS-LEARNED.md` L31, a BUILD session shipping only the
      operation-service side left the flag a reserved name only, not a wired no-op check yet).
- [ ] `lib/money-service/write-routes.ts`'s `forwardWriteRequestToMoneyService()` pattern reviewed
      as the template for an equivalent `lib/operation-service/` forwarding helper (or reuse an
      existing `lib/operation-service/routes.ts` if 4B-5's own predecessor sessions already built
      one for other operation-service domains — check before assuming a fresh file is needed).
- [ ] All 4 monolith SOURCE routes (`app/api/alerts/route.ts`, `app/api/alerts/[id]/route.ts`,
      `app/api/alerts/line/route.ts`, `app/api/alerts/line/[id]/route.ts`) re-read at CONFIRM to
      confirm they are still byte-identical to 4B-5's own cited line counts (971 total) — any drift
      since 4B-5 closed means the operation-service port may itself be stale and needs reconciling
      before a transport layer is built on top of it.

---

## Scope

- **In:** a monolith-side transport helper forwarding all 4 routes' requests (headers + body +
  auth) to `operation-service`'s new `/alerts*` endpoints when `MIGRATE_ALERTS_CRUD=true`; a single
  flag check per route, matching the established per-route (not per-group) granularity used for
  Slice 3/4's own flags where the domain is small enough not to need sub-flags.
- **Out:** flipping the flag (next session's job, VERIFY-RETIRE cutover), any change to
  `operation-service`'s own alerts module, any monolith business-logic change.

---

## Known wrinkles (carried forward from 4B-5's own Deviations — read before drafting)

- Files 1-2 (plain alerts) do NOT publish to `alerts:changed` in `operation-service` (deliberate,
  matches SOURCE) — this transport layer doesn't need to know or care, it's a pure proxy.
- `operation-service`'s error envelope (`{statusCode, message, error, timestamp, path,
correlationId}`, via `AllExceptionsFilter`) differs from the monolith's own per-route JSON shape
  (`{error, code, ...}`). Decide explicitly whether the monolith's forwarding layer re-shapes
  `operation-service`'s response back into the monolith's historical shape (matching Slice 3/4's own
  precedent, if any — check `lib/money-service/routes.ts` for how it handled this) or passes it
  through as-is. Not decided here — a real design question for this session, not a detail.
- Auth: `operation-service`'s `JwtAuthGuard` expects a `Bearer` NextAuth-JWE token, not a cookie —
  same bridge mechanism `lib/money-service/client.ts`/`routes.ts` already established (read the
  caller's session cookie server-side, re-attach as `Authorization: Bearer` when calling out). Reuse
  that pattern; do not invent a new auth bridge.

---

## Slice-level verification (done when)

- [ ] All 4 alerts routes have a `MIGRATE_ALERTS_CRUD` flag check + forwarding call, falling through
      to existing Prisma logic when the flag is off (the default in every environment).
- [ ] Flag defaults `false` everywhere — zero traffic cut over this session.
- [ ] Monolith `tsc --noEmit` / `eslint --max-warnings 0` clean; relevant test suites green.
- [ ] `operation-service` untouched this session (verify via `git status`).

---

## Rollback

Revert the transport-layer commits; `MIGRATE_ALERTS_CRUD` was never set `true` anywhere, so no
runtime behavior ever changed.

---

## Deviations

_(filled during execution)_

---

## Next-session handoff

Session 4B-7 (Alerts CRUD CUTOVER, VERIFY-RETIRE variant) — flip `MIGRATE_ALERTS_CRUD=true`, per-flag
Davin approval, same shape as every prior cutover session in this migration.

# Migration Order — UI-BUILD variant (form & admin UI)

> For sessions that build frontend surfaces. Read `00-SKELETON-AND-RULES.md` first — §4 applies
> with the dial at **High** for layout, component architecture, dynamic form rendering, and UX
> interactions. The DATA contract is constrained by `4A-W3a`'s live `/v1/wise/recipients/*`
> backend endpoints — not the idealized OpenAPI shapes alone, the ACTUAL shapes confirmed live
> in 4A-W3a (see §Contract below).

**Session:** 4A-W3b · **Variant:** UI-BUILD · **Status:** CONFIRMED
**Generated:** 2026-07-26 (Advisor) · **Estimated time:** ~2.5h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 3b of 9
**Target service:** monolith (`app/(dashboard)/affiliate/settings/payout`, `app/(dashboard)/admin/disbursement/recipients`, `lib/money-service/*`)
**Contract:** `4A-W3a`'s live `money-service` endpoints (see §Contract) + `part19.5-wise-disbursement-openapi.yaml` (frozen at 4A-W1) — where they diverge, the live endpoint wins
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md` §4 "4A-W3b" and `4A-W3a`'s own Next-session handoff + Deviations

---

## Why this session, why now

`4A-W3a` (CONFIRMED, executed 2026-07-26) built, tested, and deployed `money-service`'s `/v1/wise/recipients/*` backend module — live in production, guarded per F39 (affiliate self-service). This session builds the frontend surface affiliates actually use to submit their bank details, plus the admin read-only summary list page.

**Two real findings carry forward from 4A-W3a and shape this session's scope:**

1. **The write path (`POST /v1/wise/recipients`) is confirmed blocked** by the current `WISE_API_TOKEN`'s read-only scope (`403 unauthorized`, confirmed live via direct call to Wise sandbox). This session builds and unit-tests the submission flow fully, but handles the 403/500 failure state gracefully in the UI (surfacing "Bank details verification in progress; try again shortly").
2. **`refreshRequirementsOnChange` (dynamic field-refresh on a trigger field change) returns `{quoteId: null, groups}`** from `GET requirements`. Build the interaction pattern against the documented contract, covering field-refresh behavior with mocked-API component tests.

---

## Contract — the ACTUAL live shapes (confirmed 2026-07-26)

All calls go through `money-service`'s global `/v1` prefix. **Do not call money-service directly from the browser** — the NextAuth session cookie is `httpOnly` (F45, Session 4A-7a) and the browser cannot read it to construct an `Authorization: Bearer` header. Extend the SAME server-side-proxy pattern Slice 3 already uses — `lib/money-service/client.ts` (`callMoneyServiceWithToken`) + `lib/money-service/routes.ts`'s `fetchXxx()` wrapper convention using `getMoneyServiceToken()`.

- `GET /v1/wise/recipients/requirements?targetCurrency=X&recipientCountry=Y&legalType=Z&addressRequired=bool`
  → `{ quoteId: string | null, groups: AccountRequirementGroup[] }`. `AccountRequirementGroup` is Wise's raw response shape passed through unnormalized: `{ type, title, usageInfo?, fields: Array<{ group: AccountRequirementFieldGroup[] }> }`, where each field has `{ key, name, type, required, example?, minLength?, maxLength?, validationRegexp?, valuesAllowed?, refreshRequirementsOnChange? }`.
- `POST /v1/wise/recipients/requirements/refresh` body `{ quoteId: string, partial: Record<string, unknown> }` → `{ groups: AccountRequirementGroup[] }`.
- `POST /v1/wise/recipients` body `{ targetCurrency, recipientCountry, legalType: 'PRIVATE' | 'BUSINESS', accountHolderName, requirementsType, details }` → `201` with created recipient summary, or `500 { error: 'Wise provider error', message, providerStatus: 403, correlationId }` until a write-scoped token exists. `affiliateProfileId` is NOT sent — derived from the authenticated session server-side.
- `GET /v1/wise/recipients/me` → `200` with the summary, or `204` (empty body) if the affiliate has no recipient yet. Design the page's empty state around a real `204`.
- `GET /v1/wise/recipients` (admin, paginated) → `{ items: WiseRecipient[], total, page, pageSize }`. Params: `status?`, `page` (default 1), `pageSize` (default 25).
- `POST /v1/wise/recipients/:id/revalidate` → `200` refreshed summary, or `404`.
- `DELETE /v1/wise/recipients/:id` → `204`.

`RecipientSummaryDto`/`WiseRecipient` fields returned: `id`, `affiliateProfileId`, `wiseRecipientId` (nullable), `accountHolderName`, `targetCurrency`, `recipientCountry`, `legalType`, `accountTail` (nullable, last 4 digits), `status` (`DRAFT`|`PENDING_DETAILS`|`ACTIVE`|`INVALID`|`ARCHIVED`), `createdAt`.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [x] `4A-W3a` closed CONFIRMED; `/v1/wise/recipients/*` live on Railway — re-verified value-blind, `GET /v1/wise/recipients` → real `401` unauthenticated (curl against `money-service-production.up.railway.app`).
- [x] **F39** (affiliate self-service, `/affiliate/settings/payout`) and **F41** (Wise-managed PII; store only `accountTail` and `detailsFingerprint` SHA-256 hash) hold as resolved in `DECISION-LOG.md` and `CLAUDE.md`.
- [x] Codebase line counts verified against live tree before Step 1:
      `lib/money-service/routes.ts` (164 lines — confirmed exact),
      `lib/money-service/client.ts` (80 lines — confirmed exact),
      `app/(dashboard)/admin/disbursement/page.tsx` (455 lines — confirmed exact). Zero drift, unlike several prior sessions in this series.
- [x] Monolith frontend dev environment running cleanly (`npx tsc --noEmit` green).
- [x] Read `lib/money-service/client.ts` and `lib/money-service/routes.ts` in full before writing File 1.

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** Affiliate dashboard (`/affiliate/settings/payout`) and admin dashboard (`/admin/disbursement/recipients`) → Next.js API route handlers (server-side proxy) → `money-service`'s `/v1/wise/recipients/*`.
- **Out:** None new — frontend calls money-service via server-side proxy only.
- **Owns:** Purely additive frontend routes, components, and pages.

---

## Ordered File Breakdown (UI Surface)

### File 1/5 — Server-Side Proxy Wrappers & Route Handlers

- **TARGET:** `lib/money-service/routes.ts` (extend, +35 lines) + `app/api/wise/recipients/*` (new route handlers)
- **Kind:** Server-only transport (UI-BUILD dial: **Low** — strict proxy plumbing)
- **Description:**
  - Add typed `fetchWiseRecipientRequirements`, `fetchWiseRecipientMe`, `createWiseRecipient`, `fetchWiseRecipientsAdmin`, `revalidateWiseRecipient` wrappers to `lib/money-service/routes.ts`.
  - Create Next.js route handlers:
    - `app/api/wise/recipients/requirements/route.ts` (`GET`, `requireAffiliate()`)
    - `app/api/wise/recipients/me/route.ts` (`GET`, `requireAffiliate()`)
    - `app/api/wise/recipients/route.ts` (`POST` for affiliate creation, `GET` for admin list via `requireAdmin()`)
    - `app/api/wise/recipients/[id]/revalidate/route.ts` (`POST`, `requireAdmin()`)
  - Each handler maps `MoneyServiceError` to appropriate HTTP response (`401`, `403`, `500`).
- **Verification:** `npx tsc --noEmit` clean; unauthenticated request to each route handler returns HTTP 401/403.
- **Commit:** `build(wise-ui): add server-side proxy wrappers and API routes for wise recipients`

### File 2/5 — Dynamic Schema-Driven Recipient Form & Affiliate Page

- **TARGET:** `components/affiliate/wise-recipient-form.tsx` + `app/(dashboard)/affiliate/settings/payout/page.tsx`
- **Kind:** Dynamic Form Component + Page (UI-BUILD dial: **High** — rich aesthetics)
- **Description:**
  - Renders input controls from `AccountRequirementGroup[]` fetched from `/api/wise/recipients/requirements`.
  - Dynamically renders text, numeric, and select inputs with client-side pattern/length validation.
  - Listens for `refreshRequirementsOnChange: true` blur/change events → calls `/api/wise/recipients/requirements/refresh` to fetch dynamically revealed sub-fields.
  - Submits payload to `/api/wise/recipients`.
  - Handles real `201` success, existing recipient `200/204` state, and graceful `403/500` error banner ("Verification in progress").
  - Affiliate payout settings page (`/affiliate/settings/payout`) embeds `WiseRecipientForm` with current onboarding status card.
- **Verification:** Component renders cleanly; input changes trigger validation; empty state handled smoothly.
- **Commit:** `build(wise-ui): add dynamic recipient form and affiliate payout settings page`

### File 3/5 — Admin Recipient Management Page

- **TARGET:** `app/(dashboard)/admin/disbursement/recipients/page.tsx`
- **Kind:** Next.js Admin Page (UI-BUILD dial: **High**)
- **Description:** Admin dashboard page for inspecting affiliate Wise recipients.
  - Data table: Affiliate ID/Name, Country, Target Currency, `accountTail` (last 4 digits e.g. `•••• 3777`), Status (`ACTIVE` / `INVALID` / `ARCHIVED`), Created Date.
  - Actions: Revalidate button (triggers `POST /api/wise/recipients/[id]/revalidate`).
  - Read-only per F39 — no bank detail editing. Renders `accountTail` only — zero raw bank details displayed.
  - Filters: Status dropdown filter, pagination controls (`page`, `pageSize`).
- **Verification:** Page loads; table renders empty/mock data cleanly; status badges display correct color tokens.
- **Commit:** `build(wise-ui): add admin recipient management list page`

### File 4/5 — Component & Route Unit Tests

- **TARGET:** `__tests__/components/wise-recipient-form.test.tsx` + `__tests__/lib/money-service/wise-routes.test.ts`
- **Kind:** React Testing Library + Route Handler Test Suite
- **Description:**
  - Form test suite: Renders from mocked requirement groups, validates required fields & regex patterns, submits form, handles 403 error banner.
  - Route test suite: Verifies 401/403 auth guards and proxy forwarding for all 5 new route handlers.
- **Verification:** `npm run test` in monolith passes 100%.
- **Commit:** `test(wise-ui): add recipient form component and proxy route test suites`

### File 5/5 — Artefact Updates & Handoff

- Update `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md`.
- PRE-DRAFT `4A-W4` (CC-C/CC-D hardening gate for money surface).
- **Verification:** All suites green; git working tree clean.
- **Commit:** `docs(wise-ui): complete session 4A-W3b handoff artifacts`

---

## Rules specific to this variant

- **UI-BUILD Dial (High)**: Design a sleek, modern, glassmorphic UI. Ensure smooth transitions, responsive layouts, clear error messages, and loading feedback.
- **Zero Client-Side Raw Details**: Server-side proxy ONLY. Never cache raw bank details in `localStorage` or component state after submission.
- **Strict Server-Side Proxying**: Never call `money-service` directly from the browser. All requests pass through monolith Next.js API routes with httpOnly NextAuth session token.

---

## Done when

- [x] Server-side proxy routes (File 1) built, guarded correctly, `tsc --noEmit` clean.
- [x] Dynamic form renders requirement fields from live/mock `GET requirements` call (built against a mocked response — production still has no write-scoped token to prove a live requirement group end-to-end, unchanged from 4A-W3a's carried-forward gap).
- [x] Submission flow built and tested against success and 403/500 failure shapes.
- [x] Admin list page (`/admin/disbursement/recipients`) renders recipient summaries and status badges.
- [x] All new component and route test suites pass 100% (17 route tests + 6 component tests, 23/23).
- [x] `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md` updated.
- [x] Session `4A-W4` order exists at status `PRE-DRAFT`.

---

## Rollback

Revert git commits. Unlink page routes. No backend database migration or money-moving state is affected.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

**CONFIRM-time (before Step 1):**

- Order file found modified-but-uncommitted (header `PRE-DRAFT → APPROVED`, no
  Advisor-DRAFT/Davin-approval commit trail), paired with an uncommitted matching edit to
  `CLAUDE.md` — the same `LESSONS-LEARNED.md` L11 pattern, 8th+ recurrence in this series.
  Also found two open design questions the PRE-DRAFT had explicitly flagged for CONFIRM
  (File 1: flag vs flag-less on the new proxy routes; File 3: whether the admin page should
  allow deactivation, not just view/revalidate) silently resolved in the rewrite with no
  visible decision recorded. Stopped and asked Davin directly for all three rather than
  trusting or silently correcting: status flip confirmed as his own intentional edit;
  flag-less confirmed; "revalidate only, no deactivate" confirmed (this last one was later
  superseded mid-build — see below). All 5 entry criteria then verified live and PASSED with
  zero drift — a first for this series.

**Mid-build (File 1, real auth-semantics finding):**

- Reading the live `wise-recipients.controller.ts` (frozen at 4A-W3a) while building the
  last route showed `POST /wise/recipients/:id/revalidate` is `AffiliateGuard`-scoped
  self-service only — `WiseRecipientService.revalidateRecipient` derives the recipient from
  the CALLER's own token (`getAffiliateProfile(request.user.id)`), and the URL's `:id` is
  used only for an ownership check, never to select which recipient to act on. Building the
  Next.js proxy route guarded with `requireAdmin()` (as File 1's own text said) and putting a
  "Revalidate" button on the admin page (File 3's own text) would have meant: an admin
  calling it either gets 403'd (an admin isn't necessarily an affiliate) or — worse — silently
  revalidates the ADMIN's OWN Wise recipient instead of the target affiliate's, since the
  backend only reads the caller's own token. This is a real bug class, not a style
  disagreement — escalated per `EXECUTOR-PROTOCOL.md` §5 (auth semantics beyond the order's
  explicit steps) rather than building it as specified or silently reinterpreting scope.
  Davin's live call: move Revalidate to the affiliate's own `/affiliate/settings/payout`
  page, guarded with `requireAffiliate()` (matching the backend's actual design); the admin
  page (File 3) stays strictly view-only, no actions at all — supersedes the CONFIRM-time
  "revalidate only" answer, which had assumed revalidate was admin-triggerable.
- File 1's own route-handler bullet list omitted `POST /wise/recipients/requirements/refresh`
  even though the order's own Contract section documents it and File 2's
  `refreshRequirementsOnChange` interaction needs it to function. Added the wrapper
  (`refreshWiseRecipientRequirements`) + a new route
  (`app/api/wise/recipients/requirements/refresh/route.ts`) as a deviation — the endpoint was
  already frozen and documented, just missing from one bullet list, not new scope.
- Added `lib/money-service/wise-types.ts` (not in File 1's own TARGET line) — shared
  TypeScript interfaces for the Wise contract shapes, needed for File 1's own stated
  deliverable of "typed wrappers." Zero runtime behavior, type-only.
- `buildQuery()` in `lib/money-service/routes.ts` had its param type widened from
  `string | number | undefined` to also accept `boolean` (for `addressRequired`) —
  backward-compatible, no existing caller passes a boolean today.

**Mid-build (File 2, order-text vs. live-tree drift):**

- File 2's own TARGET line said `app/(dashboard)/affiliate/settings/payout/page.tsx` — the
  live `(dashboard)` route group has no `affiliate/` subtree at all (checked: `app/affiliate/*`
  is its own separate route tree with its own `layout.tsx`, entirely outside `(dashboard)`).
  Built at `app/affiliate/settings/payout/page.tsx` instead — matches F39's actual recorded
  URL (`DECISION-LOG.md`, Session 4A-W3a: "`/affiliate/settings/payout`"), with its own thin
  `layout.tsx` mirroring `app/affiliate/dashboard/layout.tsx`'s `getSession()`/`isAffiliate`
  auth check (the real security boundary is still each API route's own `requireAffiliate()`
  call, not this layout).
- Added one nav-link entry ("Payout Settings") to the existing
  `app/affiliate/dashboard/layout.tsx`'s `navLinks` array so the new page is actually
  discoverable — a single array entry, purely additive.
- The affiliate dashboard area uses a light theme (white cards, gray-900 text,
  `app/affiliate/dashboard/profile/page.tsx` precedent) while the admin disbursement area
  uses a dark theme (`app/(dashboard)/admin/disbursement/page.tsx` precedent) — these are two
  genuinely different existing design systems in this codebase, not a single one to pick from.
  Matched each surface's own existing convention (File 2 light, File 3 dark) rather than
  imposing the order's literal "glassmorphic" language uniformly, since that would have
  clashed visibly with sibling pages in each area.
- `refreshRequirementsOnChange` still can't be proven live — `GET requirements` still returns
  `quoteId: null` (4A-W3a's known, carried-forward gap). The form wires up the interaction but
  explicitly skips the network call when `quoteId` is null (the live Zod schema on
  `POST .../refresh` requires `quoteId.min(1)`, so a null-quoteId call would always 400) —
  tested against a mocked `quoteId` in the component test suite instead.
- Write path (`POST /v1/wise/recipients`) still returns 403 in production (read-only token,
  unchanged from 4A-W3a). Form handles this failure state gracefully with a calm banner
  ("Bank details verification is in progress...") rather than a raw provider error.

**Mid-build (File 3, contract gap):**

- The live admin-list endpoint (`GET /wise/recipients`) returns raw `AffiliateWiseRecipient`
  Prisma rows (not run through `toSummaryDto()`), and neither shape carries an affiliate
  display-name field — File 3's own "Affiliate ID/Name" column description assumed a name
  field that doesn't exist in the actual contract. Rendered `accountHolderName` (present on
  the row) alongside a truncated `affiliateProfileId` instead of inventing a client-side join;
  flagged in `CLAUDE.md` Waiting-on #51 as a minor future UX gap, not a blocker (no raw bank
  details are exposed either way, per F41).
- No revalidate/deactivate action on this page (superseding the order's own File 3 text and
  the CONFIRM-time "revalidate only" answer) — see the File 1 finding above. Admin stays
  strictly view + filter + paginate.

**Test-path deviation (File 4):**

- Placed at `__tests__/api/wise-recipients.test.ts` and
  `__tests__/components/affiliate/wise-recipient-form.test.tsx`, matching this repo's real
  test layout (`__tests__/api/*.test.ts`, `__tests__/components/<area>/*.test.tsx` — checked
  first), not the order's own suggested `__tests__/lib/money-service/wise-routes.test.ts` path
  (no such directory convention exists in this repo).

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — UI build only, no provider flip.
- **Do not call money-service directly from browser** — always use monolith server-side proxy routes.

---

## Next-session handoff

_(PRE-DRAFT `4a-w4-wise-hardening-gate.migration-order.md` at this session's close — variant `CONTRACT` + small `INFRA`, seeded from `04-rise-to-wise-migration-plan.md` §4 "4A-W4":_

- _Closes the plan §13 money gate (CC-C idempotency + CC-D rate limits) before any Wise money code._
- _Fixes 2 pre-existing live defects: adds `enableShutdownHooks()` and sets explicit generous `@Throttle()` on `/v1/webhooks/dlocal`._
- _Registers **F43** (funding-SLA alert delivery channel)._
- _Requires Davin present (`EXECUTOR-PROTOCOL.md` §7) because it touches already-cut-over money routes.)_

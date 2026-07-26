# Migration Order — UI-BUILD variant (form & admin UI)

> For sessions that build frontend surfaces. Read `00-SKELETON-AND-RULES.md` first — §4 applies
> with the dial at **High** for layout, component architecture, dynamic form rendering, and UX
> interactions. The DATA contract is constrained by `4A-W3a`'s live `/v1/wise/recipients/*`
> backend endpoints — not the idealized OpenAPI shapes alone, the ACTUAL shapes confirmed live
> this session (see §Contract below, several diverge from `part19.5-wise-disbursement-openapi.yaml`'s
> prose).

**Session:** 4A-W3b · **Variant:** UI-BUILD · **Status:** PRE-DRAFT
**Generated:** 2026-07-26 (Executor, at 4A-W3a's close, informed by its actual Deviations) ·
**Estimated time:** ~2.5h
**Phase / plan section:** Phase 4A — money-service · Part 19.5 (RiseWorks → Wise), session 3b of 9
**Target service:** monolith (`app/(dashboard)/affiliate/settings/payout`,
`app/(dashboard)/admin/disbursement/recipients`, `lib/money-service/*`)
**Contract:** `4A-W3a`'s live `money-service` endpoints (see §Contract) +
`part19.5-wise-disbursement-openapi.yaml` (frozen at 4A-W1) — where they diverge, the live
endpoint wins, note the divergence rather than silently trusting the OpenAPI prose
**Seeded from:** `docs/migration-orders/replace-rise-with-wise/04-rise-to-wise-migration-plan.md`
§4 "4A-W3b" and `4A-W3a`'s own Next-session handoff + Deviations

---

## Why this session, why now

`4A-W3a` (CONFIRMED, executed 2026-07-26) built and deployed `money-service`'s
`/v1/wise/recipients/*` backend — live in production, guarded per F39 (affiliate
self-service). This session builds the frontend surface affiliates actually use to submit
their bank details, plus the admin read-only summary list. **Two real gaps carry forward from
4A-W3a and shape this session's scope** (full detail in `4a-w3a-…`'s Deviations and
`DECISION-LOG.md`'s "Session 4A-W3a — Backend build findings" entry):

1. **The write path (`POST /v1/wise/recipients`) is confirmed blocked** by the current
   `WISE_API_TOKEN`'s read-only scope (`403 unauthorized`, confirmed live via a direct call to
   Wise sandbox). This session can build and unit-test the submission flow fully, but **cannot
   demonstrate a real successful submission** until a write-scoped token exists — don't treat a
   missing live-submission proof as this session's own bug.
2. **`refreshRequirementsOnChange` (dynamic field-refresh on a trigger field change) has no
   real quote to refresh against.** `GET requirements` returns `{quoteId: null, groups}` — no
   quote-scoping was built in 4A-W3a (out of its 10-file scope). Build the interaction pattern
   against the documented contract, but its actual field-refresh behavior can't be proven live
   this session either — cover it with mocked-API component tests instead.

---

## Contract — the ACTUAL live shapes (confirmed 2026-07-26, not the idealized OpenAPI prose)

All calls go through `money-service`'s global `/v1` prefix. **Do not call money-service directly
from the browser** — despite `main.ts` enabling CORS for direct-browser calls in general
(blueprint §5.4), the NextAuth session cookie is `httpOnly` (F45, Session 4A-7a) and the browser
cannot read it to construct an `Authorization: Bearer` header itself. Extend the SAME
server-side-proxy pattern Slice 3 already uses — `lib/money-service/client.ts`
(`callMoneyServiceWithToken`) + `lib/money-service/routes.ts`'s `fetchXxx()` wrapper convention

- `getMoneyServiceToken()` (reads the httpOnly cookie server-side) — do not re-derive this
  pattern, do not invent a client-side token-fetch flow.

* `GET /v1/wise/recipients/requirements?targetCurrency=X&recipientCountry=Y&legalType=Z&addressRequired=bool`
  → `{ quoteId: string | null, groups: AccountRequirementGroup[] }`. `quoteId` is currently
  ALWAYS `null` (see gap #2 above). `AccountRequirementGroup` is Wise's own raw response shape
  passed through unnormalized — `{ type, title, usageInfo?, fields: Array<{ group:
AccountRequirementFieldGroup[] }> }`, where each field has `{ key, name, type, required,
example?, minLength?, maxLength?, validationRegexp?, valuesAllowed?,
refreshRequirementsOnChange? }`. **This is NOT the OpenAPI's normalized `RequirementGroup`
  schema** (which adds a `name` at the `fields[]` level) — build against the real shape, spot-check
  against a live call before trusting either shape from memory.
* `POST /v1/wise/recipients/requirements/refresh` body `{ quoteId: string, partial: Record<string,
unknown> }` → `{ groups: AccountRequirementGroup[] }`. Cannot be exercised against a real quote
  this session (gap #2) — build it, test it with a mocked response.
* `POST /v1/wise/recipients` body `{ targetCurrency, recipientCountry, legalType: 'PRIVATE' |
'BUSINESS', accountHolderName, requirementsType, details }` → `201` with the created
  `WiseRecipient`-shaped summary, OR currently a `500 { error: 'Wise provider error', message,
providerStatus: 403, correlationId }` until a write-scoped token exists (gap #1). Note:
  `affiliateProfileId` is NOT sent — self-service mode always derives it from the authenticated
  session server-side; do not add an `affiliateProfileId` field to the form.
* `GET /v1/wise/recipients/me` → `200` with the summary, or `204` (empty body) if the affiliate
  has no recipient yet — design the page's empty state around a real `204`, not a `404`.
* `GET /v1/wise/recipients` (admin, paginated) → `{ items: WiseRecipient[], total, page,
pageSize }`. Query params: `status?`, `page` (default 1), `pageSize` (default 25, max 100).
* `POST /v1/wise/recipients/:id/revalidate` → `200` refreshed summary, or `404` if the id
  doesn't belong to the caller.
* `DELETE /v1/wise/recipients/:id` → `204`.

`RecipientSummaryDto`/`WiseRecipient` fields actually returned: `id`, `affiliateProfileId`,
`wiseRecipientId` (nullable), `accountHolderName`, `targetCurrency`, `recipientCountry`,
`legalType`, `accountTail` (nullable, last 4 digits), `status` (`DRAFT`|`PENDING_DETAILS`|
`ACTIVE`|`INVALID`|`ARCHIVED`), `createdAt`. Note: `requirementsType`/`invalidReason`/
`lastValidatedAt` exist on the DB row but are NOT in `wise-recipient.service.ts`'s
`toSummaryDto()` mapper as of 4A-W3a — if the admin list needs them, that's a small
`wise-recipient.service.ts` change, flag it rather than inventing fields client-side.

---

## Entry criteria

_(verified at CONFIRM time, not assumed — `EXECUTOR-PROTOCOL.md` §1.3)_

- [ ] `4A-W3a` closed CONFIRMED; `/v1/wise/recipients/*` live on Railway — re-verify value-blind
      that `GET /v1/wise/recipients` returns 401 unauthenticated (was true at 4A-W3a's close,
      confirm it's still true now).
- [ ] F39 (affiliate self-service, `/affiliate/settings/payout`) and F41 (Wise-managed PII)
      still hold as resolved in `DECISION-LOG.md` — no re-litigation needed unless something
      changed since 4A-W3a.
- [ ] Confirm whether a write-scoped `WISE_API_TOKEN` has been provided since 4A-W3a's close
      (value-blind check). If yes, this session's testing scope can include a real live
      submission proof; if no (expected), scope stays mocked-API component tests only for the
      submission flow — note this at CONFIRM either way, don't assume either state.
- [ ] Monolith frontend dev environment running cleanly (`npm run dev`, `tsc --noEmit`, existing
      test suite green before starting).
- [ ] Read `lib/money-service/client.ts` and `lib/money-service/routes.ts` in full before
      writing File 1 below — this session extends that existing pattern, not a new one.

**A failed entry criterion means do not start** — propose the fix or the session swap.

---

## Integration points

- **In:** affiliate dashboard (`/affiliate/settings/payout`) and admin dashboard
  (`/admin/disbursement/recipients`) → new Next.js API route handlers (server-side proxy,
  mirroring the existing Slice-3 pattern) → `money-service`'s `/v1/wise/recipients/*`.
- **Out:** none new — this session never calls Wise directly, only money-service.
- **Owns:** no new backend state; purely additive frontend routes/components/pages.

---

## Ordered File Breakdown (UI Surface)

### File 1/5 — Server-side proxy routes

- **TARGET:** `lib/money-service/routes.ts` (extend) + `lib/money-service/flags.ts` (extend, if a
  flag is wanted — TBD by Davin at CONFIRM: does this ship behind a flag like Slice 3, or is a
  brand-new zero-traffic surface safe to ship flag-less? Propose flag-less given F39/F41 are
  already resolved and nothing else reads these routes yet, but confirm rather than assume) +
  new Next.js route handlers under `app/api/wise/recipients/*`.
- **Kind:** Server-only transport (UI-BUILD dial: **Low** here — this is plumbing, not UX;
  follow the existing `fetchAdminXxx`/`fetchAffiliateDashboardXxx` naming convention exactly).
- **Description:** One `fetchXxx()` wrapper per endpoint in §Contract, all using
  `callMoneyServiceWithToken`/`getMoneyServiceToken()` exactly as the existing 12 Slice-3
  wrappers do. Each gets a matching Next.js route handler that runs the monolith's own
  existing auth check first (`requireAffiliate()`/`requireAdmin()`, matching each route's
  guard), then calls the wrapper, then maps `MoneyServiceError` back onto an HTTP response —
  same shape as the 12 existing Slice-3 route handlers already do.
- **Verification:** `tsc --noEmit` clean; unauthenticated request to each new route handler →
  401/403 per its guard (same pattern as the existing Slice-3 routes).
- **Commit:** `build(wise-ui): add server-side proxy routes for wise/recipients`

### File 2/5 — Schema-driven dynamic recipient form

- **TARGET:** `components/affiliate/wise-recipient-form.tsx` +
  `app/(dashboard)/affiliate/settings/payout/page.tsx`
- **Kind:** Dynamic Form Component + Page (UI-BUILD dial: **High**)
- **Description:** Renders form controls from the `AccountRequirementGroup[]` shape in
  §Contract (NOT the OpenAPI's normalized shape — verify against a real live call at build
  time). Text/numeric/select inputs per field `type`; client-side validation from
  `minLength`/`maxLength`/`validationRegexp`; `valuesAllowed` → select options. Wires the
  `refreshRequirementsOnChange` interaction per the documented contract (call the refresh
  endpoint on blur/change of a flagged field) — since it can't be proven live this session
  (gap #2), cover it with a mocked-response test instead and note in Deviations that it's
  unverified against a real Wise quote. Submit calls `POST /v1/wise/recipients` via File 1's
  wrapper; handle both the real success path AND the current `500`/`providerStatus: 403`
  failure path gracefully (don't let it read as a generic crash — surface something like "bank
  details couldn't be verified with our payment provider right now, try again shortly" since
  end users shouldn't see a raw token-scope error).
- **Verification:** loading/empty/error states all reachable and designed; role/tier gating
  from the JWT-derived session, never client-side-only trust.
- **Commit:** `build(wise-ui): add dynamic recipient form + affiliate payout settings page`

### File 3/5 — Admin recipient management page

- **TARGET:** `app/(dashboard)/admin/disbursement/recipients/page.tsx`
- **Kind:** Next.js Admin Page (UI-BUILD dial: **High**)
- **Description:** Table listing affiliate recipients via File 1's admin-list wrapper —
  `accountTail`, `targetCurrency`, `recipientCountry`, `status` badges (`ACTIVE`/`INVALID`/
  `ARCHIVED`/etc.), `createdAt`. Read-only per F39 — no create/edit action here, only view
  (and maybe a revalidate-trigger button if useful; deactivate is plausible too, confirm scope
  with Davin at CONFIRM rather than assuming admins should be able to deactivate an affiliate's
  recipient on their behalf).
- **Verification:** pagination works against real `{items,total,page,pageSize}` shape; empty
  state (zero recipients — true in production right now) renders sanely, not a blank/broken
  table.
- **Commit:** `build(wise-ui): add admin recipient management list page`

### File 4/5 — Component & route unit tests

- **TARGET:** `__tests__/components/wise-recipient-form.test.tsx` +
  `__tests__/lib/money-service/wise-routes.test.ts` (or co-located, match whatever convention
  `__tests__/lib/money-service/` already uses for the Slice-3 wrappers, if any exist — check
  first)
- **Kind:** React Testing Library + route-handler test suite
- **Description:** Form: renders from a mocked `AccountRequirementGroup[]` response, validates
  client-side rules, submits and handles both success and the current real 403/500 failure
  shape. Routes: each new route handler's guard (401/403) and happy-path proxying, mocking
  `fetch` the same way the existing Slice-3 route tests do.
- **Verification:** `npx jest` (or the project's real test runner) 100% pass.
- **Commit:** `test(wise-ui): add recipient form and proxy route test suites`

### File 5/5 — Artefact updates & handoff

- Update `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md`.
- Confirm whether `refreshRequirementsOnChange`'s live-quote gap (#2 above) needs its own
  follow-up session before `4A-W6`, or can ride along with whenever quote-scoping gets built.
- PRE-DRAFT `4A-W4` (already exists per 4A-W1/W2's handoff — CC-C/CC-D hardening gate) or
  whatever the Advisor/Davin decides is next; this session doesn't own that decision.

---

## Rules specific to this variant

- The recipient form's creativity is expected on layout/UX — record notable design decisions in
  Deviations so `4A-W6`'s batch UI (a later, related surface) stays coherent with it.
- Never render raw bank details from client-side math or unchecked props — the backend already
  never returns them (only `accountTail`), so this should be structurally hard to get wrong, but
  don't add a client-side cache/localStorage of form input that could linger a raw account
  number in the browser after submission either.
- Server-side proxy only (see §Contract) — no `NEXT_PUBLIC_MONEY_API_URL` direct-browser calls
  for these routes, regardless of what money-service's CORS config technically allows.

---

## Done when

- [ ] Server-side proxy routes (File 1) built, guarded correctly, `tsc --noEmit` clean.
- [ ] Dynamic form renders real requirement fields from a live `GET requirements` call (GBP or
      another sandbox-supported currency — not THB, still unavailable per 4A-W3a's Deviation).
- [ ] Submission flow built and tested against both the real success shape and the current real
      failure shape (403/500) — a literal live 201 is NOT required this session unless a
      write-scoped token has been provided (see Entry criteria).
- [ ] Admin list page renders real (currently empty) production data without breaking.
- [ ] All new component/route tests pass 100%.
- [ ] `CLAUDE.md`, `DECISION-LOG.md`, `migration-stack-analysis.md` updated.
- [ ] Next session's order exists at status `PRE-DRAFT`.

---

## Rollback

Revert the commits; flag off (if a flag is added per File 1's own open question) or just
unlinked/unrouted pages otherwise. No backend state, no money, no Wise API write access changes.

---

## Deviations

_(filled DURING execution — what / why / impact.)_

**Carried forward from 4A-W3a (do not silently re-discover these — they're already known):**

- `refreshRequirementsOnChange` cannot be proven against a real Wise quote — `quoteId` is
  always `null` from `GET requirements`. Build against the documented contract, test with
  mocks, note honestly that live behavior is unverified.
- Full recipient-creation success (a real `201`) cannot be demonstrated — confirmed live 403
  from Wise, current token is read-only-scoped. Build and test the full flow including this
  failure path; don't wait for a token to exist before building the UI around it.
- THB cannot be rendered against a real production schema yet (File 9 of `4a-w3a-…` deferred).
  Sandbox-supported currencies (GBP/USD/EUR) remain fully testable.

---

## Known wrinkles / do-not-touch

- **`lib/api/index.ts`** — known-broken by design until Phase 7. Do not touch.
- **RiseWorks source, schema, and rows** — Archived (F42), never deleted, never renamed.
- **`DISBURSEMENT_PROVIDER` stays `MOCK` in production** — this session builds UI only, no
  payout logic, no provider flip.
- **Do not call money-service directly from the browser** — see §Contract's server-side-proxy
  note; this is the single most important architectural constraint for this session.

---

## Next-session handoff

_(PRE-DRAFT the next Part 19.5 session at this session's close, informed by whatever this
session's own Deviations turn up — likely `4A-W4` per the existing plan sequence, but confirm
against the latest `CLAUDE.md`/`DECISION-LOG.md` state rather than assuming the sequence hasn't
shifted.)_

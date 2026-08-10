# Migration Order — Session 6-1b — Mock-Data Hotfix

> For a session that **wires already-existing UI to already-existing endpoints** (not a
> cross-stack PORT — everything here is monolith-internal, no NestJS service involved). Adapted
> from `TEMPLATE-PORT.md` with the dial at **Low**: bind the real data, change nothing else. No
> redesign, no new components beyond what's already built-and-unused, no layout changes — those
> are 6-2 (IA), 6-5 (settings/user), 6-6 (admin) and 6-11 (admin system ops)'s job, on pages that
> are truthful by the time they run.

**Session:** 6-1b · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** PORT (monolith-internal,
low dial) · **Status:** PRE-DRAFT · **Generated:** 2026-08-10 (at Session 6-1 close) ·
**Flags touched:** none · **Estimated time:** ~2-3h
**Target service:** monolith-internal (Next.js route handlers + React Server/Client Components
already in `app/`) · **Contract:** none (no OpenAPI surface changes; every endpoint used here
already exists and is already documented in `docs/migration-orders/phase-6-frontend-gap-matrix.md`
rows A1-1, A1-2, A1-3, A1-4)

---

## Context

Session 6-1 (CONFIRMED, executed, closed 2026-08-10 — `DECISION-LOG.md` F11 stays OPEN pending
Davin's triage) independently re-verified that three pages render **fabricated data in
production** today, plus one settings page shows a fabricated count:

- `/settings/billing` (`app/(dashboard)/settings/billing/page.tsx`) — zero `fetch(` calls in 439
  lines; a hardcoded `mockInvoices` array backs the entire invoice table, usage stats, and the
  cancel dialog does nothing.
- `/admin/fraud-alerts/[id]` (`app/(dashboard)/admin/fraud-alerts/[id]/page.tsx`) — renders a
  hardcoded `MOCK_ALERT` object to an admin making a real fraud/block decision.
- `/admin` (`app/(dashboard)/admin/page.tsx`) — the "Recent Activity" panel is a generated mock
  list (the rest of the page's stats ARE real, via `/api/admin/analytics`).
- `/settings` (`app/(dashboard)/settings/page.tsx`) — the alerts-remaining count shown in the
  overview card is hardcoded `alerts: 3`.

This is a genuine, disclosed, non-hypothetical production correctness gap — every user viewing
`/settings/billing` today sees invoice/usage numbers that are not theirs, and every admin viewing
`/admin/fraud-alerts/[id]` is making a decision against data that isn't the real alert.

## Entry criteria

- [ ] Session 6-1 CONFIRMED, executed, closed (2026-08-10) — done, see `CLAUDE.md` Current entry
      and `6-1-gap-matrix-f11.migration-order.md`.
- [ ] The four target rows (A1-1, A1-2, A1-3, A1-4) hold in `phase-6-frontend-gap-matrix.md` as
      verified — re-confirm at this session's own CONFIRM, don't assume Session 6-1's re-check is
      still current if any commit has landed on these 4 files since.
- [ ] The four backing endpoints below still return the shapes cited (re-verify at CONFIRM, per
      `LESSONS-LEARNED.md` L27 — order text can drift from its own cited ground truth):
  - `GET /api/invoices` → `{ invoices: InvoiceItem[], hasMore: boolean }`, `InvoiceItem = { id,
date, amount, currency, status: 'paid'|'open'|'failed', description, invoicePdfUrl,
    provider: 'STRIPE'|'DLOCAL', planType }` (`app/api/invoices/route.ts`).
  - `GET /api/subscription` → `{ tier: 'FREE'|'PRO', status, subscription: { id, status,
provider, planType, currentPeriodEnd, expiresAt, cancelAtPeriodEnd, trialEnd, paymentMethod,
dLocalPaymentMethod, dLocalCountry } | null }` (`app/api/subscription/route.ts`).
  - `POST /api/subscription/cancel` → cancels the live Stripe (or forwards to money-service per
    `shouldUseMoneyServiceForStripeWrite()`) subscription and downgrades to FREE
    (`app/api/subscription/cancel/route.ts`).
  - `GET /api/admin/fraud-alerts/[id]` → the real `FraudAlert` row (404 if missing, 403 if
    non-admin); `PATCH` (implicit via the file's `updateSchema`) accepts
    `{ status: 'PENDING'|'REVIEWED'|'DISMISSED'|'BLOCKED', resolution?, notes? }`
    (`app/api/admin/fraud-alerts/[id]/route.ts`).
  - `GET /api/alerts` — already live, used elsewhere in the app; confirm response includes a
    countable list for the FREE/PRO alert-count card.
- [ ] `tsc --noEmit` / `eslint app components lib hooks --max-warnings 0` baseline confirmed at
      CONFIRM (Session 6-1's own measurement: types clean, lint has 3 pre-existing, unrelated
      warnings — see that session's Deviations; this session does not need to fix them, but
      should not introduce new ones).
- [ ] Davin APPROVED (fast-path eligible per `EXECUTOR-PROTOCOL.md` §4? **No** — this is a
      Standard-Loop PORT session with real user-facing behavior change on 4 pages, not a
      VERIFY-RETIRE; needs Advisor DRAFT review + Davin APPROVED before CONFIRM, same as any
      other PORT session).

## Integration points

- **In:** real session (`getServerSession`), the 4 endpoints above (all already monolith-native
  or already flag-forwarded — no new transport code).
- **Out:** nothing new — no new routes, no new Prisma queries beyond what the 4 endpoints already
  run.
- **Owns:** no new tables, no new flags, no new queues.

## File Port Order

_(dependency order: read-only wiring first, the one destructive action — cancel — last)_

### File 1/4 — `/settings/billing`

- **SOURCE:** `app/(dashboard)/settings/billing/page.tsx` (439 lines, currently 100% mock) →
  **TARGET:** same file, rewired.
- **Kind:** port + adapt — replace `mockInvoices`/hardcoded usage stats with real `fetch` calls;
  mount the two already-built-but-unused components (`components/billing/invoice-list.tsx`,
  `components/billing/subscription-card.tsx`) instead of hand-rolled markup where they cover the
  same UI, per the source gap analysis's own recommendation.
- **Port steps:**
  1. `GET /api/subscription` on mount → drive tier badge, provider, `currentPeriodEnd`/
     `expiresAt`, payment method card, and a real trial-status banner from
     `User.trialStatus`/`trialConvertedAt`/`trialCancelledAt`/`hasUsedFreeTrial` (confirm these
     fields are present on the response first — if not, that's a real API gap, escalate rather
     than fabricate a second mock).
  2. `GET /api/invoices` → real invoice table via `invoice-list.tsx`.
  3. Cancel dialog's confirm action → `POST /api/subscription/cancel`; on success, re-fetch
     `/api/subscription` (don't assume the response shape — re-read it) and reflect the FREE
     downgrade in the UI without a full page reload.
  4. Remove `mockInvoices` and the two mock-data comments entirely — no fallback-to-mock-on-error
     path; a real fetch failure should show a real error state, not silently show fake data.
- **Invariants:** page must still render correctly for a FREE user with no subscription/invoices
  (empty states, not mock-filled ones); must not regress the existing dialog's confirmation copy
  (only its wiring changes).
- **Parity proof:** new component test(s) for the page (none exist today — this is the parity
  oracle to build, not assume, per `LESSONS-LEARNED.md` L28) covering: real data render, empty
  state, cancel-success flow, cancel-failure flow.
- **Commit:** `fix(6-1b): wire /settings/billing to real invoices/subscription endpoints`

### File 2/4 — `/admin/fraud-alerts/[id]`

- **SOURCE:** `app/(dashboard)/admin/fraud-alerts/[id]/page.tsx` → **TARGET:** same file, rewired.
- **Kind:** port + adapt — replace `MOCK_ALERT`/`setAlert(MOCK_ALERT)` with a real
  `fetch('/api/admin/fraud-alerts/' + id)`; add the status-transition action using the real
  `FraudAlertStatus` enum (`PENDING`/`REVIEWED`/`DISMISSED`/`BLOCKED`) against the route's own
  `updateSchema`.
- **Port steps:**
  1. Replace the mock fetch with a real one; handle 404 (alert not found) and 403 (non-admin,
     though the layout guard should already prevent reaching this page) explicitly.
  2. Wire the status-transition control to a `PATCH`/`POST` call matching the route's real
     `updateSchema` shape (`status`, optional `resolution`, optional `notes`) — read the route
     file's actual HTTP method for the update handler before wiring (not assumed from the GET
     handler shown in this order).
  3. Link out to the flagged user's own record and `LoginHistory`/`SecurityAlert` rows **only if**
     an existing route already exposes them cheaply (e.g. `/admin/users` list, filtered) — do
     NOT build new endpoints or a new user-detail page here; that's A2-10, session 6-6. If no
     cheap link exists, leave this out of scope rather than improvising a new surface.
- **Invariants:** admin actions here are real, consequential (blocking a user) — no optimistic
  UI update without a confirmed server response; a failed status update must show a real error,
  not silently revert.
- **Parity proof:** new component test(s) covering real-data render, 404 case, and the
  status-transition success/failure paths.
- **Commit:** `fix(6-1b): wire /admin/fraud-alerts/[id] to the real endpoint`

### File 3/4 — `/admin` Executive Dashboard (mock activity feed only)

- **SOURCE:** `app/(dashboard)/admin/page.tsx` (mock activity generated at line ~82; the rest of
  the page already calls the real `/api/admin/analytics`) → **TARGET:** same file, activity
  section only.
- **Kind:** port + adapt, deliberately conservative — this is the one row where "the real
  endpoint" doesn't exist as a single call. **Do not build a new aggregation endpoint or a new
  `SystemConfigHistory`/`DisbursementAuditLog` reader here** — that is 6-11's job
  (`/admin/system/config-history`, `/admin/system/outbox`, matrix rows B2-16/B2-17). The
  low-dial fix for THIS session: replace the generated mock list with the most recent real
  `LoginHistory` and `FraudAlert` rows already queryable via existing admin endpoints
  (`GET /api/admin/fraud-alerts` list endpoint already exists; check whether an existing
  admin endpoint already exposes recent `LoginHistory` before adding a new query — if none does
  cheaply, show ONLY the real `FraudAlert` feed and label the panel accurately, rather than
  half-fabricating a combined feed).
- **Port steps:**
  1. Read `GET /api/admin/fraud-alerts` (list) and confirm its response shape and whether it
     supports a small `?limit=` for a "recent activity" panel.
  2. Replace `// Generate mock recent activity for now` and its output with the real recent
     items from that call, formatted the same way the mock did (same visual shape, real data).
  3. If no cheap "recent activity" data source exists beyond fraud alerts, the panel's heading
     should say "Recent Fraud Alerts" (accurate) rather than "Recent Activity" (implying a
     broader feed the page doesn't actually have) — do not oversell what's shown.
- **Invariants:** the rest of the page (the `/api/admin/analytics`-backed stats) is untouched.
- **Parity proof:** extend the page's existing test coverage (check first whether one exists) to
  assert the panel renders real fetched data, not the removed mock generator.
- **Commit:** `fix(6-1b): replace admin dashboard mock activity feed with real fraud-alert data`

### File 4/4 — `/settings` Overview (alert count only)

- **SOURCE:** `app/(dashboard)/settings/page.tsx` (`alerts: 3, // Mock data` at line 41) →
  **TARGET:** same file, one field.
- **Kind:** pure port — replace the hardcoded count with a real `GET /api/alerts` count.
- **Port steps:** fetch `/api/alerts` (or reuse a count already fetched elsewhere on this page,
  if any) and set the real length; remove the mock comment and literal.
- **Invariants:** none beyond correctness — this is the smallest, lowest-risk file in the order.
- **Parity proof:** extend/add a test asserting the count reflects `/api/alerts`'s real response
  length, not a literal `3`.
- **Commit:** `fix(6-1b): show real alert count on /settings overview`

## Rules specific to this variant

- **No redesign, no new components beyond what's already built-and-unused
  (`invoice-list.tsx`, `subscription-card.tsx`), no layout/nav changes.** The settings grid's
  missing links (`account`/`security`/`help`/`language`/`terms`) and the admin nav's missing
  cross-links are 6-2's job, not this session's — do not touch either grid/nav here even though
  you'll be looking directly at both files.
- Every one of the 4 files must have real error states on fetch failure — no "fall back to mock"
  path anywhere, ever, for any of the 4.
- File 3's own scope is deliberately the narrowest of the four — read it twice before writing
  code; the temptation to "just also wire in `SystemConfigHistory`" is exactly the scope creep
  `EXECUTOR-PROTOCOL.md` §2 prohibits (that's 6-11's job).
- If any of the 4 endpoints' real response shape doesn't match what's cited in Entry criteria,
  that's a genuine finding — stop and record it in Deviations before adapting the page to a
  guessed shape.

## Slice-level verification (done when)

- [ ] All 4 files wired to real endpoints; zero mock data/comments remain in any of the 4.
- [ ] New/extended component tests for all 4 files pass; `tsc --noEmit` clean; `eslint app
    components lib hooks --max-warnings 0` introduces no NEW warnings (the 3 pre-existing ones
      from Session 6-1 are not this session's to fix, but also must not silently multiply).
- [ ] `test:ci` full suite green, count recorded (not assumed from Session 6-1's 2191).
- [ ] Live manual check (Davin or Executor, real session) of all 4 pages against real account
      data — same "first authenticated call is the first real test" discipline as
      `LESSONS-LEARNED.md` L18, since 3 of these 4 pages have apparently never been exercised
      against real data before.

## Cutover & rollback

Not applicable — no flag, no new service, no shadow-run. This is a direct, same-stack bugfix;
rollback is a plain `git revert` of the relevant file's commit if a live issue appears.

## Retire

Not applicable — nothing is being ported OUT of the monolith; the mock data/components being
removed were never real production logic, just placeholders.

## Deviations

_(filled during execution)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (known-broken by design until Phase 7,
  `EXECUTOR-PROTOCOL.md` §5) — none of these 4 files should route through it.
- `frontend/` mirror tree is out of scope per `EXECUTOR-PROTOCOL.md` §5.
- `DECISION-LOG.md` **F21** (GDPR account-deletion product decision) and **F50**
  (`COMMISSION_CREDITED` wrong recipient) are unrelated open flags that do not gate this session.

## Next-session handoff

Session **6-2** (IA + design system + shared shells) is next in the Phase 6 order — resolves F62
(admin tree consolidation), adds `app/not-found.tsx`, removes the `/analytics`/`/indicators` dead
nav links, and completes the `/settings` grid (the 5 missing subpage links this session
deliberately did not touch). Needs a full Advisor DRAFT given F62's own "structurally hard to
undo" framing — not fast-path eligible.

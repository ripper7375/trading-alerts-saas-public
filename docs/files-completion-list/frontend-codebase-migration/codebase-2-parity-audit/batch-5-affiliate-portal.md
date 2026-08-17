# Batch 5 — Affiliate Portal

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first.

## Scope

14 pages under `/affiliate/*` in both codebases (the partner/affiliate program portal,
distinct from the `/admin/affiliates/*` admin-side pages covered by Batches 6–7). Shared nav
component: `components/affiliate/affiliate-nav.tsx` — check this once, it affects every row
below.

If this batch feels too large for one session, split it at row 42
(`/affiliate/dashboard` overview) into "Affiliate Dashboard Suite" (35–42) and "Affiliate
Public/Onboarding" (43–48).

## Rows

| No. | Page Name                             | Route                                  | Codebase 1 file                                                                                                                                                                                                                                                                                                                                            | Codebase 2 file                                    |
| --- | ------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 35  | Affiliate Code Inventory              | `/affiliate/dashboard/code-inventory`  | evidence → `app/api/affiliate/dashboard/code-inventory/route.ts`; locate page at `app/affiliate/dashboard/code-inventory/page.tsx`                                                                                                                                                                                                                         | `app/affiliate/dashboard/code-inventory/page.tsx`  |
| 36  | Affiliate Dashboard - Referral Codes  | `/affiliate/dashboard/codes`           | `app/affiliate/dashboard/codes/page.tsx`                                                                                                                                                                                                                                                                                                                   | `app/affiliate/dashboard/codes/page.tsx`           |
| 37  | Affiliate Dashboard - Commissions     | `/affiliate/dashboard/commissions`     | evidence → `prisma/non-market-data/schema.prisma`; locate page at `app/affiliate/dashboard/commissions/page.tsx`                                                                                                                                                                                                                                           | `app/affiliate/dashboard/commissions/page.tsx`     |
| 38  | Affiliate Payouts / Transfer Status   | `/affiliate/dashboard/payouts`         | evidence → `prisma/non-market-data/schema.prisma`; locate page at `app/affiliate/dashboard/payouts/page.tsx`                                                                                                                                                                                                                                               | `app/affiliate/dashboard/payouts/page.tsx`         |
| 39  | Affiliate Dashboard - Payment Setup   | `/affiliate/dashboard/profile/payment` | evidence → `app/affiliate/dashboard/layout.tsx`; locate page at `app/affiliate/dashboard/profile/payment/page.tsx`                                                                                                                                                                                                                                         | `app/affiliate/dashboard/profile/payment/page.tsx` |
| 40  | Affiliate Dashboard - Partner Profile | `/affiliate/dashboard/profile`         | `app/affiliate/dashboard/profile/page.tsx`                                                                                                                                                                                                                                                                                                                 | `app/affiliate/dashboard/profile/page.tsx`         |
| 41  | Affiliate - Monthly Statements        | `/affiliate/dashboard/statements`      | `app/affiliate/dashboard/statements/page.tsx`                                                                                                                                                                                                                                                                                                              | `app/affiliate/dashboard/statements/page.tsx`      |
| 42  | Affiliate Portal Dashboard            | `/affiliate/dashboard`                 | `app/affiliate/dashboard/page.tsx`                                                                                                                                                                                                                                                                                                                         | `app/affiliate/dashboard/page.tsx`                 |
| 43  | Affiliate Join                        | `/affiliate/join`                      | `app/affiliate/join/page.tsx`                                                                                                                                                                                                                                                                                                                              | `app/affiliate/join/page.tsx`                      |
| 44  | Affiliate Partner Registration        | `/affiliate/register`                  | `app/affiliate/register/page.tsx`                                                                                                                                                                                                                                                                                                                          | `app/affiliate/register/page.tsx`                  |
| 45  | Affiliate - Marketing Resources       | `/affiliate/resources`                 | evidence → `app/affiliate/dashboard/resources/page.tsx` (note: C1 path has an extra `dashboard` segment — confirm whether Codebase 2's `app/affiliate/resources/page.tsx` (no `dashboard` segment) is a real URL divergence, and if so this is itself a Rule-1 URL-consistency issue worth flagging even though it wasn't asked about directly this round) | `app/affiliate/resources/page.tsx`                 |
| 46  | Affiliate Settings - Payout Options   | `/affiliate/settings/payout`           | `app/affiliate/settings/payout/page.tsx`                                                                                                                                                                                                                                                                                                                   | `app/affiliate/settings/payout/page.tsx`           |
| 47  | Affiliate Partner Verification        | `/affiliate/verify`                    | `app/affiliate/verify/page.tsx`                                                                                                                                                                                                                                                                                                                            | `app/affiliate/verify/page.tsx`                    |
| 48  | Affiliate Program Landing             | `/affiliate`                           | `app/affiliate/page.tsx`                                                                                                                                                                                                                                                                                                                                   | `app/affiliate/page.tsx`                           |

## Batch-specific notes

- **Row 45 is flagged above for a possible URL-structure mismatch** (`/affiliate/dashboard/resources`
  in Codebase 1 vs `/affiliate/resources` in Codebase 2, per the evidence-column paths) —
  verify this first before anything else in this batch, since a route-path mismatch is a
  bigger Rule-1 problem than any visual difference, and confirm whether it's real or just an
  artefact of how the evidence column was filled in.
- `wise-recipient-form.tsx` (shared component, used somewhere in the payment/payout flow —
  rows 38, 39, or 46) handles third-party payout integration (Wise); compare its field set
  against Codebase 1's equivalent payout form carefully, this is real functional logic, not
  content.
- Commission/payout/statement pages (37, 38, 41) are data-table-heavy — Rule-1 check should
  cover table columns, filters, and any export/download actions Codebase 1 offers, not just
  overall page structure.

## Findings

Executed in one session, all 14 rows (35–48), not split. Shared component
`components/affiliate/affiliate-nav.tsx` checked first per the batch note; row 45's
flagged URL question checked before any other work, per the session instruction.

### Row 45 investigation (checked first, before anything else)

**The literal URL-structure mismatch flagged in this file is NOT real.** Both
`/affiliate/resources` and `/affiliate/dashboard/resources` exist in **both**
codebases — the xlsx evidence column pointing at the `dashboard/resources` path was
just an artefact of how it was filled in, not a missing route. Codebase 2's
`app/affiliate/dashboard/resources/page.tsx` is a 5-line client re-export of
`app/affiliate/resources/page.tsx`, so both URLs already resolve in Codebase 2.

**However, investigating it surfaced a real, deeper Rule-1 gap**: in Codebase 1 these
are two _distinct_ pages by design — `/affiliate/resources` is a public, unauthenticated
marketing teaser, while `/affiliate/dashboard/resources` is the real authenticated tool
(live referral-link generator hitting `GET /api/affiliate/dashboard/codes`, copy-to-
clipboard, a dynamic FAQ built from `AFFILIATE_CONFIG`). Codebase 2 collapsed both URLs
down to one static brand-assets/swipe-copy page with **no referral-link generator and no
FAQ at all** — the single most functional element of the authenticated version was
completely absent from Codebase 2's resources surface.
**Fixed**: added a "Your Referral Links" section (per-code masked referral link + Copy
Link, mirroring the codes/page.tsx mock-data convention) and a "Frequently Asked
Questions" section (commission rate, payout cadence, links to Payouts/Payout Settings) to
`app/affiliate/resources/page.tsx` — used by both URLs since one re-exports the other.

### Shared component — `components/affiliate/affiliate-nav.tsx`

All 9 nav links match Codebase 1's `AffiliateDashboardLayout` navLinks 1:1
(Dashboard/My Codes/Code Inventory/Commissions/Payouts/Statements/Resources/Profile/
Payout Settings), styled with DavinTrade dark/amber tokens — no Rule-1 or Rule-2 gap in
the component itself. **But it was inconsistently included**: missing from
`app/affiliate/dashboard/page.tsx` (row 42) and `app/affiliate/settings/payout/page.tsx`
(row 46) while present on every other affiliate page. **Fixed**: added `<AffiliateNav />`
to both.

### Row 35 — Code Inventory (`app/affiliate/dashboard/code-inventory/page.tsx`)

Rule-1 gap: Codebase 1's version is a date-range **movement report** (opening/closing
balance, additions-by-reason, reductions-by-outcome, over a filterable period). Codebase
2 reinterprets "code inventory" as a per-code allocation-pool snapshot table — a
legitimate DavinTrade content-model difference given the rest of this codebase's promo-
code paradigm (not flagged as a defect). The concrete, fixable gap: the date-range filter
(a real form field + flow step in C1) was entirely absent in C2, and a `search` state +
`Input` were declared/imported but **never rendered** (dead code, the search box never
appeared on the page). **Fixed**: added a working Start/End Date filter (filters rows by
`expiry` falling in range) and wired the search box to actually filter the table by code;
added an empty-state row.

### Row 36 — Referral Codes (`app/affiliate/dashboard/codes/page.tsx`)

Rule-1 gap: Codebase 1 has a Status filter dropdown (All/Active/Used/Expired/Cancelled)
and a "Code Status Guide" legend; Codebase 2 had neither — only an unfiltered search box.
**Fixed**: added a Status filter select (using C2's own status enum ACTIVE/EXPIRED/
PAUSED — C2's promo-code model legitimately differs from C1's one-time-use code model, so
the enum itself wasn't force-matched) and a "Code Status Guide" legend at the bottom,
matching C1's page section.

### Row 37 — Commissions (`app/affiliate/dashboard/commissions/page.tsx`)

Rule-1 gaps: (1) the `search` input was rendered but **not wired to filter** the ledger
table at all — a real "form field must work" defect. (2) No status filter (C1 has one)
and no "Commission Status Guide" legend (C1 has one). **Fixed**: wired search to filter
by transaction ID/user/plan, added a status filter select (C2's own PENDING/PAID/HOLD
enum), added the status guide legend, and an empty-state row.

### Row 38 — Payouts (`app/affiliate/dashboard/payouts/page.tsx`)

Rule-1 gap: C1 has a "Payout Batch Status Guide" legend covering all possible batch
statuses; C2 had none (and all 3 mock rows are hardcoded COMPLETED, so the badge-color
logic for PROCESSING/SCHEDULED is never exercised — noted, not fixed, since it causes no
visible defect with current mock data). **Fixed**: added the status guide legend
(SCHEDULED/PROCESSING/COMPLETED, C2's own enum).

### Row 39 — Payment Setup (`app/affiliate/dashboard/profile/payment/page.tsx`) + shared `wise-recipient-form.tsx`

**Structural finding (flagged, not changed)**: Codebase 1 explicitly **retired** this
exact route — it's a server-side `redirect('/affiliate/settings/payout')` with a code
comment documenting the Session 6-7 consolidation. Codebase 2 keeps it as a full, live,
independent page rendering the same `WiseRecipientForm`, duplicating
`/affiliate/settings/payout` (row 46). Since Codebase 2 is a frontend-only static mockup
(no backend persistence either way, so no real data-drift risk) and this page is
reachable from a real, intentional nav link (Partner Profile → Payment Setup), this
wasn't force-changed into a dead-end redirect — flagging for Davin's call, following the
row-86 (`/test-api`) precedent of flagging retirement candidates rather than unilaterally
deciding. **Same pattern recurs at row 43 (`/affiliate/join`)** — see below.

**Field-set gap (fixed)**: batch note asked to compare `wise-recipient-form.tsx`'s field
set against Codebase 1's real form carefully. C1's real form (`components/affiliate/
wise-recipient-form.tsx` in Codebase 1) is a multi-step, schema-driven Wise onboarding
wizard (currency, 2-letter recipient country, legal type, then a dynamically-fetched
per-country/currency field set) — far too complex to replicate in a frontend-only mockup
without a live Wise integration, so not rebuilt as a wizard. But 3 concrete, always-
required fields were completely missing from Codebase 2's flat form: **Account Holder
Name** (required in C1, validated), **Payout Currency** (C1 supports 9 currencies, C2 had
none), and **Recipient Country** (2-letter code, required in C1). **Fixed**: added all 3
to the shared `WiseRecipientForm` component (Account Holder Name required for both Wise
and RiseWorks providers; Currency + Country shown for the Wise path), so the fix applies
to both row 39 and row 46 automatically.

### Row 40 — Partner Profile (`app/affiliate/dashboard/profile/page.tsx`)

Rule-1 gaps: (1) **Account Statistics section entirely missing** — C1 shows Codes
Distributed/Used, Total Earnings, Pending, Paid; C2 had none of this. (2) Social media
was collapsed from C1's 5 distinct tracked platforms (Twitter/YouTube/Instagram/
Facebook/TikTok) down to a single generic "Social Channel/Community URL" field. (3) No
Payout Settings quick-link card (C1 has one; the nav bar alone doesn't fully cover it
since C1 treats it as an explicit page-level CTA). **Fixed**: added an Account Statistics
card (5 stat tiles), expanded the single URL field into the 5 named platform fields, and
added a Payout Settings quick-link card linking to `/affiliate/settings/payout`.

### Row 41 — Monthly Statements (`app/affiliate/dashboard/statements/page.tsx`)

Rule-1 gaps: (1) the "PDF" download button called `alert('Downloading...')` — a fake
placeholder, not a real download, versus C1's genuinely-functional client-side CSV
generation. (2) No "Tax Summary Note" disclaimer (C1 has one). **Fixed**: replaced the
alert with a real CSV-generating download (matching the convention already used on row
37's Export CSV and C1's own statement CSV export) and added the Tax Summary Note card.
Table format (vs. C1's month-card layout) kept as-is — legitimate Rule-2 presentational
choice, nothing lost.

### Row 42 — Portal Dashboard (`app/affiliate/dashboard/page.tsx` + `components/affiliate/code-table.tsx`)

Rule-1 gaps: (1) missing `<AffiliateNav />` (see shared-component section above). (2)
`CodeTable`'s "Request Custom Code" button had **no `onClick` handler at all** — a
button present but non-functional. **Fixed**: added the nav bar and wired the button as a
`Link` to `/affiliate/dashboard/codes` (where real code creation already lives).
Skipped re-adding C1's separate "Quick Actions" shortcut grid and "How the Program Works"
info box — both are functionally superseded by the nav bar (once added) and the
dashboard's own top banner copy; adding them back would be redundant, not a gap.

### Row 43 — Affiliate Join (`app/affiliate/join/page.tsx`)

**Same structural pattern as row 39**: Codebase 1's `/affiliate/join` is _also_ a
retired, transparent-redirect-only page (→ `/affiliate/register`, per its own code
comment — "no live callers left... built anyway so any bookmark/external link still
resolves cleanly"). Codebase 2 has a full, well-designed standalone marketing landing
page here instead, which funnels correctly to `/affiliate/register` via its own CTA.
Flagged only, not changed — nothing is missing (C2 has strictly more content), and this
is the second occurrence of the same "C1 retired X in favour of Y, C2 kept X as a live
page" pattern, worth Davin's attention as a recurring theme across this batch.

### Row 44 — Partner Registration (`app/affiliate/register/page.tsx`)

**Largest gap in this batch.** Codebase 1's registration form collects: full name,
2-letter country code, a payment-method selector (PayPal/Bank Transfer/Crypto/Wise) with
conditional detail fields, 4 optional social-profile URLs, a required Terms & Conditions
checkbox (blocking submit, disclosing commission/payout terms), and a Benefits footer.
Codebase 2 had a bare 3-field form (name, email, optional website) with no country, no
terms gate, no social fields, no benefits disclosure. **Not** force-matched to C1's 4
legacy payment methods (PayPal/Bank/Crypto/Wise) — DavinTrade's own established payout
rails, consistent everywhere else in this codebase (payouts page, profile/payment,
settings/payout, `wise-recipient-form.tsx`), are Wise + RiseWorks, and full payout-detail
collection is deferred to the separate Settings → Payout page there, not at registration.
**Fixed**: added Country Code (required, 2-letter), 4 social-profile URL fields (Twitter/
YouTube/Instagram/TikTok, matching C1's set for this page — note profile page row 40 uses
5 incl. Facebook, registration page in C1 uses these same 4), a required Terms checkbox
(blocks submit, discloses the real 30%/$50 terms and points at Wise/RiseWorks
configuration), and a Partner Benefits footer.

### Row 46 — Payout Options Settings (`app/affiliate/settings/payout/page.tsx`)

Rule-1 gaps: (1) missing `<AffiliateNav />`. (2) C1's real settings page wraps the form
with a "Current Payout Details" status summary (account holder/currency/country/masked
account/status) plus a "Re-verify with provider" action and a link to payout history —
C2 was just the bare form with nothing around it. **Fixed**: added the nav bar and a
"Current Payout Account" status card (status badge, masked account summary, a working
mock Re-verify action with a loading state, and a link to Payout History) above the form.
The `WiseRecipientForm` field-set fix from row 39 applies here automatically (shared
component).

### Row 47 — Partner Verification (`app/affiliate/verify/page.tsx`)

Rule-1 gap: Codebase 1 has 4 states (pending/verifying/success/error); Codebase 2 only
had 3 — landing on this page with **no token** (the normal state right after registering,
before clicking the email link) was mapped straight to the scary red "Verification
Failed" error card instead of C1's calm "Check your inbox, here's a resend link" pending
state. Also missing: C1's auto-redirect to the dashboard 3s after a successful
verification. **Fixed**: added the distinct `pending` state (matching C1's copy/resend
affordance/back-to-registration link) and the 3-second auto-redirect on success.

### Row 48 — Affiliate Program Landing (`app/affiliate/page.tsx`)

No fix needed — Codebase 2 is already a strong DavinTrade superset here (hero, an
interactive earnings calculator with a live slider, a benefits grid, full marketing nav/
footer) with nothing from Codebase 1 missing functionally. The only things Codebase 1 has
that Codebase 2 doesn't are the admin-redirect and already-an-affiliate session-aware
states (`useSession` branches) — see the batch-wide note below on why these weren't
built.

### Batch-wide observation (not fixed, applies beyond this batch)

Every Codebase-1 page compared in this batch that branches on `useSession()` (rows 42,
44, 48 all do — admin-redirect, already-registered, already-affiliate states) has **no**
equivalent in Codebase 2, because this increment has no real NextAuth/session wiring
anywhere (`useSession` doesn't appear once in `seed-code/trading-conversational-ai-ui-
pages-increment`). This isn't a per-page defect — it's a structural gap that will recur
on every remaining batch until real auth/session integration happens, so it's recorded
here once rather than re-flagged per row.

### Verification

`npx tsc --noEmit` — clean. `npx next build` — succeeded, all 88 routes compiled
including all 14 affiliate rows, zero errors. ESLint could not be run — `npx eslint .`
reports every file in this increment as ignored by its own config (pre-existing,
unrelated to this batch's changes). Manually verified in a live dev server (run on a
separate port from inside `seed-code/trading-conversational-ai-ui-pages-increment` — the
repo's only `.claude/launch.json` entry runs Codebase 1 from the repo root, not this
increment, so the named preview config was NOT used for verification) — checked
`/affiliate/resources`, `/affiliate/dashboard/code-inventory`, `/affiliate/register`,
`/affiliate/dashboard`, `/affiliate/settings/payout`, `/affiliate/dashboard/profile`,
`/affiliate/verify`, and `/affiliate/dashboard/codes`: all render the expected new
content with zero console errors.

**Files touched** (all inside `seed-code/trading-conversational-ai-ui-pages-increment`):
`app/affiliate/resources/page.tsx`, `app/affiliate/dashboard/code-inventory/page.tsx`,
`app/affiliate/dashboard/codes/page.tsx`, `app/affiliate/dashboard/commissions/page.tsx`,
`app/affiliate/dashboard/payouts/page.tsx`, `components/affiliate/wise-recipient-form.tsx`,
`app/affiliate/dashboard/profile/page.tsx`, `app/affiliate/dashboard/statements/page.tsx`,
`app/affiliate/dashboard/page.tsx`, `components/affiliate/code-table.tsx`,
`app/affiliate/register/page.tsx`, `app/affiliate/settings/payout/page.tsx`,
`app/affiliate/verify/page.tsx`.

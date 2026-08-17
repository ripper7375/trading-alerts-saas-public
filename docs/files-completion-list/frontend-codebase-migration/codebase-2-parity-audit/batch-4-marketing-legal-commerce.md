# Batch 4 — Marketing, Legal & Commerce Pages

> Part of the Codebase 2 ↔ Codebase 1 parity audit. Read `00-MASTER-PLAN.md` first for the
> two rules, known exceptions, hard constraints, and the screenshot-path convention — this
> file only covers what's specific to this batch. Requires Batch 0 to have landed first
> (shared public-page header from `components/header.tsx`).

## Scope

15 xlsx rows, but **1 is Protected (see `00-MASTER-PLAN.md` §0) — only 14 are actually in
scope**: public marketing/legal content pages plus the pricing → checkout commerce flow.
Most of these are simple static/mostly-static content pages in Codebase 1 — expect Rule-2
(DavinTrade restyling) to dominate the findings here more than Rule-1 gaps, except for
pricing/checkout where real form/flow logic exists.

## Rows

| No. | Page Name                      | Route              | Codebase 1 file                                                                                                            | Codebase 2 file                                                                         |
| --- | ------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Landing Page                   | `/`                | —                                                                                                                          | **`PROTECTED — DO NOT MODIFY`** (confirmed by Davin 2026-08-17, already fully designed) |
| 2   | About                          | `/about`           | `app/(marketing)/about/page.tsx`                                                                                           | `app/about/page.tsx`                                                                    |
| 52  | Blog                           | `/blog`            | `app/(marketing)/blog/page.tsx`                                                                                            | `app/blog/page.tsx`                                                                     |
| 53  | Careers                        | `/careers`         | `app/(marketing)/careers/page.tsx`                                                                                         | `app/careers/page.tsx`                                                                  |
| 54  | Changelog                      | `/changelog`       | `app/(marketing)/changelog/page.tsx`                                                                                       | `app/changelog/page.tsx`                                                                |
| 60  | Payment Return / Status        | `/checkout/return` | evidence → `app/checkout/page.tsx` (check for a dedicated return/status sub-page or a query-param branch in the same file) | `app/checkout/return/page.tsx`                                                          |
| 61  | Checkout Page                  | `/checkout`        | `app/checkout/page.tsx`                                                                                                    | `app/checkout/page.tsx`                                                                 |
| 63  | Risk Disclaimer                | `/disclaimer`      | `app/(marketing)/disclaimer/page.tsx`                                                                                      | `app/disclaimer/page.tsx`                                                               |
| 64  | Documentation                  | `/docs`            | `app/(marketing)/docs/page.tsx`                                                                                            | `app/docs/page.tsx`                                                                     |
| 66  | Help Centre (public)           | `/help`            | `app/(marketing)/help/page.tsx`                                                                                            | `app/help/page.tsx`                                                                     |
| 69  | Pricing Page                   | `/pricing`         | `app/(marketing)/pricing/page.tsx`                                                                                         | `app/pricing/page.tsx`                                                                  |
| 70  | Privacy Policy (public)        | `/privacy`         | `app/(marketing)/privacy/page.tsx`                                                                                         | `app/privacy/page.tsx`                                                                  |
| 84  | System Status                  | `/status`          | `app/(marketing)/status/page.tsx`                                                                                          | `app/status/page.tsx`                                                                   |
| 85  | Terms of Service (public)      | `/terms`           | `app/(marketing)/terms/page.tsx`                                                                                           | `app/terms/page.tsx`                                                                    |
| 95  | Welcome / First-run Onboarding | `/welcome`         | **No C1 counterpart ("Proposed / Pending Creation")**                                                                      | `app/welcome/page.tsx` — Rule 2 only                                                    |

## Batch-specific notes

- **Row 1 (landing page) is Protected — do not open it expecting work.** It's cited in
  `00-MASTER-PLAN.md` §1 only as the worked example of "Codebase 2 is a DavinTrade superset,
  not a stripped-down replica" (illustrating the general design philosophy the other 13
  in-scope pages in this batch should follow) — Davin has separately confirmed it's already
  finished, so treat it as reference material only, never as an edit target.
- Rows 60/61 (checkout flow): this is the one pair in this batch with real transactional
  logic (multi-currency, dLocal/UK payment providers per this repo's own docs) — give the
  form fields, payment-method selection, and success/return-status handling the same
  field-by-field Rule-1 check as a settings form, not just a visual pass.
- Row 84 (`/status`) is also referenced by row 91 in Batch 8 (an admin-sidebar nav card
  linking to it) — if you find a structural issue with the status page itself, note it here;
  if it's specifically about the admin sidebar's link to it, that belongs in Batch 8's
  findings instead.
- Row 95 (`/welcome`) has no Codebase-1 page to match — Rule 1 N/A, Rule 2 only. This is a
  first-run onboarding flow unique to DavinTrade.
- The remaining rows (About, Blog, Careers, Changelog, Disclaimer, Docs, Help, Privacy,
  Terms) are mostly static content — Rule-1 check is mainly "does the same set of
  sections/links exist," Rule-2 check is "does it use DavinTrade dark theme + tokens
  instead of Codebase 1's plain light styling."

## Findings

> Row 1 (`/`, Protected) was skipped entirely, per §0. All other 14 rows were audited by
> reading the real C1 source file(s) + the real C2 source file(s) side by side (not just
> screenshots, since Rule-1 gaps in interactive/logic code — like a selector with no visible
> effect — don't show up in a static screenshot). Every row's C1/C2 file pair was confirmed to
> exist at the paths in this batch's own table before comparing.

### Fixed

**Row 63 — Risk Disclaimer (`app/disclaimer/page.tsx`)**

- **Wrong (Rule-1):** C1's disclaimer has 6 sections, ending with a "6. Acknowledgment" section
  that cross-links to `/terms` and `/privacy` ("this disclaimer should be read alongside our
  Terms of Service and Privacy Policy"). C2 only had 4 sections and no cross-reference links
  anywhere in the page body — a real, missing flow element for a compliance-relevant legal
  document, not just a cosmetic gap (batch notes explicitly name "does the same set of
  sections/links exist" as the Rule-1 test for these content pages).
- **Changed:** Added section 5 ("No Guarantee of Results," adapted from C1's own section 5) and
  section 6 ("Acknowledgment," with real `Link`s to `/terms` and `/privacy`, amber-accent
  styled to match the page's existing rose/amber palette). `Link` from `next/link` was already
  imported but unused in this file — now used for real.

**Row 70 — Privacy Policy (`app/privacy/page.tsx`)**

- **Wrong (Rule-1):** C1's privacy policy has 9 sections. C2 had only 3 ("Information We
  Collect," "How We Use Your Data," "Your Rights and Data Control") — missing "How We Share
  Your Information" (payment processors / infra / affiliates / law enforcement — a materially
  different topic from what's covered, not a rename), "Cookies & Session Data," "Data Retention
  & Security," "Children's Privacy," "Changes to This Policy," and "Contact Us" (no mailto link
  anywhere on the page at all).
- **Changed:** Added all 6 missing sections (renumbered 4–9), adapted to DavinTrade's own
  vendor list (dLocal/Stripe, `/settings/security/activity`, `/settings/account`) rather than
  copied verbatim from C1's Trading-Alerts-specific copy. Added a `mailto:privacy@davintrade.com`
  contact link, matching the `davintrade.com` (no hyphen) domain convention Batch 0 already
  established as the correct one for public pages.

**Row 85 — Terms of Service (`app/terms/page.tsx`)**

- **Wrong (Rule-1):** C1's terms page has 10 sections. C2 had only 3 ("Software License &
  Acceptable Use," "Subscription Fees & Billing Cycles," "Limitation of Liability") — missing
  "Description of Service," "User Accounts," "Financial Disclaimer" (C1's own version of this
  section links out to `/disclaimer` — a real cross-page flow link that was entirely absent),
  "Intellectual Property," "Termination," "Governing Law," and "Contact Information" (mailto).
  This is the same class of gap as row 70/63 — a legal document missing more than half its
  sections, not a wording/styling difference.
- **Changed:** Added all 7 missing sections (renumbered 1–10 to interleave correctly), including
  a real "5. Financial Disclaimer" callout box linking to `/disclaimer` (mirrors C1's own
  design: an amber warning box + inline link, not a full re-statement) and a
  `mailto:legal@davintrade.com` contact section.

**Row 84 — System Status (`app/status/page.tsx`)**

- **Wrong (Rule-1):** C1's status page ends with a pointer to the Admin Panel ("System
  operations... are managed in the Admin Panel" + a "Go to Admin System Panel →" link to
  `/admin/system/terminals`). C2's status page had no such link anywhere — a missing flow
  element, and `/admin/system/terminals` already exists in C2 (Batch 8's row 91 territory) so
  the link target is real, not dead.
- **Changed:** Added the same footer note + link, styled to match C2's existing card
  conventions on this page.
- **Found, not fixed (architectural, flagged like Batch 0's precedent):** C1's status page is a
  real server component that calls `getSystemStatus()` and reflects live checks (`dynamic =
'force-dynamic'`). C2's status page is 100% client-side hardcoded data — every component
  shows `OPERATIONAL` unconditionally, and the "Refresh Status" button is a fake `setTimeout`
  that changes only a timestamp, not a real check. This matches Rule 1's "non-functional
  interactive element" criterion literally, but fixing it for real would mean either building a
  live health-check endpoint (backend work, out of scope for a frontend-only codebase per master
  plan §0) or removing the interactive refresh affordance entirely (a bigger design call).
  Flagging for a future session/Davin decision rather than unilaterally deciding which way to
  resolve it, same discipline as Batch 0's middleware/Light-Clean-Mode flags.

**Row 69 — Pricing (`app/pricing/_components/pricing-content.tsx`)**

- **Wrong (Rule-1):** C1's `/pricing` lives under `app/(marketing)/`, so it inherits
  `app/(marketing)/layout.tsx`'s real public header (Sign In / Get Started CTAs, Features /
  Pricing / Affiliate nav) and footer (Product/Company/Resources/Legal columns). C2's pricing
  page instead rendered `AppHeader` — the **dashboard** chrome (brand logo linking to
  `/dashboard`, a PRO/FREE tier badge, no Login/Register CTA for a signed-out visitor) — with no
  footer at all. Every other page in this batch correctly uses `MarketingNavbar`/
  `MarketingFooter`; Pricing was the one outlier, and it's reachable directly from a signed-out
  visitor clicking "Pricing" in the navbar of any marketing page, so the mismatch is a real,
  reachable Rule-1 gap (no way back to Login/Register/other marketing pages without using the
  browser back button).
- **Changed:** Swapped `AppHeader` for `MarketingNavbar` + `MarketingFooter`, matching the
  container pattern (`flex min-h-screen flex-col`) every other page in this batch uses. Removed
  the now-unused `useLocale`/`AppHeader` imports and the `title`/`subtitle` props that had no
  equivalent in the marketing chrome. `TierComparison` (the actual pricing-card content) was not
  touched.

**Row 61 — Checkout (`app/checkout/page.tsx`, `components/payments/checkout-form.tsx`)**

- **Wrong (Rule-1, missing element):** C1's checkout page has a "Back to Pricing" link at the
  top. C2's had no back-navigation at all (the dashboard `AppHeader`'s logo links to
  `/dashboard`, not `/pricing`).
- **Changed:** Added a "Back to Pricing" link (`/pricing`) above the checkout form, styled to
  match the existing amber/slate palette.
- **Wrong (Rule-1, non-functional element):** The "Select Payment Method" toggle (Credit/Debit
  Card vs. dLocal) had **no effect on the form** — the Card Number / Expiration / CVC fields
  rendered unconditionally regardless of which method was selected, so selecting "dLocal (LATAM
  / APAC)" did nothing visible. This is exactly Rule 1's "non-functional interactive element"
  case. C1's own dLocal path shows country/plan/payment-method-specific fields instead of a
  card form, so this selector is meant to change what's shown.
- **Changed:** Card Number/Expiry/CVC fields now render only when `paymentMethod === 'card'`.
  When `'dlocal'` is selected, the form now shows the billing country's available local payment
  methods (a small static map covering the 11 countries in the existing country dropdown, e.g.
  UPI/Paytm/PhonePe for India, GoPay/OVO/Dana for Indonesia) and a note that the user will be
  redirected to dLocal's hosted page — mirroring C1's dLocal flow without requiring a real
  dLocal integration (frontend-only, per master plan §0).
- **Not touched:** `handleCheckout`'s fake `setTimeout` + redirect-to-`/` (no real payment
  processing exists in this frontend-only codebase, consistent with every other mock-data flow
  already established here) and the raw, unmasked card-number/CVC input fields — a real payment
  form would use Stripe Elements/hosted fields rather than plain `<Input>`s, but since nothing
  here actually transmits or stores this data (it's inert local state), this is a design-pattern
  observation for a future real-payment-integration session, not a parity gap for this audit.

**Row 60 — Payment Return / Status (`app/checkout/return/page.tsx`)**

- **Wrong (Rule-1, non-functional/misleading element):** If a visitor lands on
  `/checkout/return` with **no** `payment_id`/`paymentId` query param at all, C2 silently
  defaulted to the `SUCCESS` state and rendered "Payment Successful! Your PRO subscription is
  activated." C1's equivalent page explicitly handles this case — no payment reference means an
  "Unable to show payment status" error card with "Back to Checkout"/"Go to Dashboard" actions,
  never a false-positive success message. Defaulting to a fabricated success state on missing
  data is a real correctness bug, not just a missing section.
- **Changed:** Added a 4th status (`NO_REFERENCE`), set as the initial state whenever
  `paymentId` is absent, with its own render branch matching C1's error-state treatment
  (warning icon, "Unable to Show Payment Status" heading, `role="alert"
aria-live="assertive"`, "Back to Checkout" / "Go to Dashboard" buttons). The existing
  SUCCESS/PENDING/FAILED branches and the live `/api/payments/dlocal/[paymentId]` status-check
  effect were left as-is.

### Confirmed compliant — no gap found

- **Row 2 — About (`app/about/page.tsx`):** Fully DavinTrade-themed, superset content vs. C1
  (adds a "Global Infrastructure Stats" section). C1's bottom "View Pricing" CTA has no direct
  C2 equivalent, but `/pricing` is a top-level `MarketingNavbar` link on every page including
  this one, so it's not a lost flow — same reasoning applied consistently across this batch's
  static content pages (see next 3 rows).
- **Row 52 — Blog (`app/blog/page.tsx`):** Superset (category filter pills, newsletter box).
  C1's inline "see the Changelog" link has no direct equivalent, but Changelog is reachable from
  `MarketingNavbar`'s "More" dropdown and the footer's Product column on every page.
- **Row 53 — Careers (`app/careers/page.tsx`):** Structurally compliant (hero, positions list,
  contact). **Not a Rule-1/Rule-2 finding, but worth flagging:** C1's careers page deliberately
  shows "No open positions right now" with an explicit code comment citing a documented
  repo precedent (F64/6-1b) against presenting fabricated data as real. C2 lists 3 specific,
  invented job openings (title, department, salary-adjacent details) with working `mailto:`
  Apply buttons. This isn't a parity gap under this audit's two rules (C2 has strictly more
  content, not less/broken), but it does contradict that established precedent — flagging for
  Davin rather than unilaterally rewriting page content outside this audit's Rule-1/Rule-2
  scope.

  **Resolved (Davin's decision, 2026-08-17): fixed to match C1's precedent.** Replaced the 3
  invented job listings and their `mailto:` Apply buttons with C1's actual "No open positions
  right now" content and a general `careers@davintrade.com` contact line, restyled in
  DavinTrade's dark theme/tokens (not a revert to C1's plain light styling — satisfies both
  Rule 1's content-state parity and Rule 2's brand-token compliance at once). Removed the
  now-unused `Briefcase`/`Sparkles`/`ShieldCheck`/`Heart` icon imports and the `Link` import
  that were only used by the deleted listings grid. `tsc --noEmit` and `next build` clean.

- **Row 54 — Changelog (`app/changelog/page.tsx`):** Structurally compliant (dated entries,
  most-recent-first). Same category of observation as Careers: several v2.x entries describe
  specific capabilities (e.g. "12-language localization engine," "Telegram bot" alert delivery)
  that weren't verified against what's actually built elsewhere in this codebase. Flagging only,
  not fixed — content-accuracy auditing across the whole app is out of this batch's scope.
- **Row 64 — Documentation (`app/docs/page.tsx`):** 6 collapsible topic sections, a superset of
  C1's 6 topics (adds a "Conversational AI Copilot" section). Search input, matches C1's
  "does the same set of sections exist" bar.
- **Row 66 — Help Centre (`app/help/page.tsx`):** Categorized FAQs (Account/Signals/Billing) +
  live-chat card (`useSupportChat`) + email card. C1's prominent "Documentation & Guides" card
  has no direct in-page equivalent, but unlike the disclaimer/privacy/terms cross-links above,
  `/docs` is already a top-level `MarketingNavbar` item (not buried in a dropdown), so it's not
  a lost flow — no fix needed.
- **Row 95 — Welcome (`app/welcome/page.tsx`):** Rule-2-only per master plan §2 (no C1
  counterpart). Fully DavinTrade-themed 3-step onboarding wizard; the theme-accent step is wired
  to the real `useAppearance()` provider (not decorative), so it's functionally real, not just
  styled.

### Verification

- `npx tsc --noEmit` — clean, 0 errors, re-checked after every edit in this session.
- `npm run build` — clean, all 88 routes compiled, 0 errors (the only warning is the
  pre-existing, unrelated `middleware` → `proxy` deprecation notice Batch 0 already flagged).
- `npm run lint` — could not run: the project's ESLint config rejects its own `.`/`app` glob
  ("all files matching the glob pattern are ignored") on this checkout, a pre-existing tooling
  config issue unrelated to this batch's edits (not introduced by any file touched here).
- Mid-session, `tsc --noEmit` briefly failed on `app/(dashboard)/settings/profile/page.tsx`
  (unbalanced JSX) — that file is Batch 3 territory (row 79) and was actively being edited by a
  concurrent session at that moment (its mtime was ~19 seconds old when the error was seen); it
  resolved itself moments later on re-run and was never touched by this session. Confirmed via
  `git status`/`git diff` that this batch's commit only includes the 8 files actually edited
  here.
- No changes made outside `seed-code/trading-conversational-ai-ui-pages-increment/`.
- Row 1 (`/`) was not opened for editing at any point, per §0.

**Batch 4 complete.** 7 of 14 in-scope rows had real Rule-1 fixes applied (63, 70, 85, 84, 69,
61, 60); 7 rows (2, 52, 53, 54, 64, 66, 95) were confirmed already compliant, with 2 of those
(53, 54) carrying a flagged-but-not-fixed content-honesty observation outside this audit's
Rule-1/Rule-2 scope.

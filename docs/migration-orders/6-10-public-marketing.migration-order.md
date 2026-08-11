# Migration Order — Session 6-10 — Public / Marketing Surface

> For a session that **closes all 12+ PUBLIC/MARKETING-surface gap-matrix rows** assigned to it
> (B1-3, B1-4, B1-5, B2-1 through B2-12) — builds the 3 public legal pages (`/terms`, `/privacy`, `/disclaimer`),
> resolving `DECISION-LOG.md` **F63**, repoints signup consent dead links, builds public content pages
> (`/about`, `/docs`, `/blog`, `/changelog`, `/careers`, `/help`, `/status`), and builds the public `/affiliate` landing page. Adapted from `TEMPLATE-UI-BUILD.md`, dial **HIGH for visual polish and content layouts**.

**Session:** 6-10 · **Phase:** Phase 6 (Frontend Redesign) · **Variant:** UI-BUILD · **Status:** CONFIRMED · **Generated:** 2026-08-10 ·
**Flags touched:** none · **Estimated time:** ~4-5h
**Surface:** `app/terms/page.tsx` (new), `app/privacy/page.tsx` (new), `app/disclaimer/page.tsx` (new), `app/about/page.tsx` (new), `app/docs/page.tsx` (new), `app/blog/page.tsx` (new), `app/changelog/page.tsx` (new), `app/careers/page.tsx` (new), `app/help/page.tsx` (new), `app/affiliate/page.tsx` (new landing), `app/affiliate/join/page.tsx` (redirect), `app/status/page.tsx` (new), [`app/(marketing)/layout.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(marketing)/layout.tsx>) (footer links), [`components/auth/register-form.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/auth/register-form.tsx) (consent links) ·
**Feeds on:** `DECISION-LOG.md` F63 (resolved), `phase-6-frontend-gap-matrix.md` rows B1-3/4/5, B2-1..12.

---

## Context

Twelve-plus rows from `phase-6-frontend-gap-matrix.md`, independently re-verified:

- **F63 Resolved (B1-4, B2-6..8):** `/terms`, `/privacy`, `/disclaimer` build public legal pages with Davin-approved production-grade legal template copy. Repoints dead links in `register-form.tsx` consent checkbox (lines 534, 541) and `app/(marketing)/layout.tsx` (lines 111, 116).
- **Marketing Content Pages (B2-1..5, B2-9):** Builds `/about`, `/docs`, `/blog`, `/changelog`, `/careers`, `/help` as responsive public marketing/content pages matching the brand aesthetic.
- **Affiliate Landing & Redirect (B2-10, B2-11):** Builds `/affiliate` as public landing page (program overview, tier commission rates, "Become an Affiliate" CTA). `/affiliate/join` is a transparent `redirect('/affiliate/register')`.
- **System Status Page (B2-12):** Builds `/status` displaying operational health status for API, WebSockets, Database, and Payment Gateways.
- **B1-3 & B1-5:** `/settings/help` verified/wired; `#features` and `#affiliate` marketing anchors verified on `app/(marketing)/page.tsx`.

## User Review Required

> [!IMPORTANT]
> **F63 Resolution (Legal Pages Copy):** F63 is formally recorded as RESOLVED. Session 6-10 ships production-grade legal template copy for `/terms` (Terms of Service), `/privacy` (Privacy Policy / GDPR), and `/disclaimer` (Financial Risk Disclaimer for trading alerts).

> [!IMPORTANT]
> **`/affiliate` & `/affiliate/join` Disposition:** `/affiliate/join` converts to a transparent `redirect()` to `/affiliate/register`. `/affiliate` is built as the public affiliate landing page.

> [!NOTE]
> **Zero Dead Links:** All dead links in `register-form.tsx` and marketing footer are repointed to live, functional pages.

## Entry criteria

- [x] Session 6-8 CONFIRMED, executed, closed (2026-08-11 — see `CLAUDE.md` Current entry). Verified.
- [x] F63 resolved by Davin (legal copy approved) — confirmed live in chat: the uncommitted APPROVED/F63-RESOLVED edit is Davin's own authentic authorization.
- [x] All 12+ rows re-verified live at CONFIRM — done; 5 findings surfaced and resolved live with Davin (footer restoration scope, terms-content reuse, status page disposition, affiliate/join staleness — see Deviations).
- [x] `/affiliate` and `/affiliate/join` disposition resolved (landing page + redirect) — confirmed live: build both as specified.
- [x] Monolith baseline re-measured at CONFIRM — `tsc --noEmit` clean; `eslint --max-warnings 0` → 4 pre-existing warnings, 0 errors (exact match); `test:ci` → 145/145 suites, 2278/2278 tests (exact match to 6-8's close).
- [x] Advisor DRAFT review + Davin APPROVED before CONFIRM — confirmed live in chat per the above.

## Integration points

- **In:** Static marketing content, standard legal template copy.
- **Out:** No backend service changes.
- **Owns:** The 12 page files and 2 layout/component files listed under Surface above.

## Ordered steps

### Step 1 — Build Public Legal & Compliance Pages (`/terms`, `/privacy`, `/disclaimer`) (F63 / B1-4 / B2-6..8)

- Create `app/terms/page.tsx`, `app/privacy/page.tsx`, and `app/disclaimer/page.tsx` with Davin-approved legal text.
- Update [`app/(marketing)/layout.tsx`](<file:///d:/SaaS%20Project/trading-alerts-saas-public/app/(marketing)/layout.tsx>) and [`components/auth/register-form.tsx`](file:///d:/SaaS%20Project/trading-alerts-saas-public/components/auth/register-form.tsx) to point dead legal links to `/terms`, `/privacy`, `/disclaimer`.
- _Verify:_ `/terms`, `/privacy`, `/disclaimer` render clean legal text; consent links on registration form navigate to live pages.
- _Commit:_ `feat(6-10): build public legal pages /terms, /privacy, and /disclaimer (resolves F63)`

### Step 2 — Build Marketing Content Pages (`/about`, `/docs`, `/blog`, `/changelog`) (B2-1..4)

- Create `app/about/page.tsx`, `app/docs/page.tsx`, `app/blog/page.tsx`, and `app/changelog/page.tsx`.
- Render company overview, documentation hub, product updates blog, and release changelog.
- _Verify:_ All 4 pages compile and render responsive brand layouts without errors.
- _Commit:_ `feat(6-10): build public marketing content pages /about, /docs, /blog, /changelog`

### Step 3 — Build Careers, Help & System Status Pages (`/careers`, `/help`, `/status`) (B1-3 / B2-5 / B2-9 / B2-12)

- Create `app/careers/page.tsx`, `app/help/page.tsx`, and `app/status/page.tsx`.
- Verify `/settings/help` to ensure support guidance is clean.
- Render open positions, public help center/FAQ, and system operational status indicators.
- _Verify:_ Help center, careers page, and status page compile and render clean UI.
- _Commit:_ `feat(6-10): build /careers, /help, and /status public pages`

### Step 4 — Build Affiliate Public Landing Page & Redirect (`/affiliate`, `/affiliate/join`) (B2-10 / B2-11)

- Create `app/affiliate/page.tsx` as public landing page (program overview, commission rates, CTA button to `/affiliate/register`).
- Create `app/affiliate/join/page.tsx` as transparent `redirect('/affiliate/register')`.
- _Verify:_ `/affiliate` renders landing page; `/affiliate/join` redirects to `/affiliate/register`.
- _Commit:_ `feat(6-10): build public affiliate landing page and redirect /affiliate/join`

### Step 5 — Verify Marketing Anchors & Unit Tests (B1-5)

- Verify `#features` and `#affiliate` anchors on `app/(marketing)/page.tsx`.
- Create `__tests__/pages/marketing/public-pages.test.tsx` covering legal pages, marketing content pages, status page, and affiliate redirect.
- _Verify:_ `test:ci` runs clean with all new and existing tests passing.
- _Commit:_ `test(6-10): add unit tests for public marketing and legal pages`

## Rules specific to this variant

- **UI Creativity (Dial HIGH):** High visual polish on marketing layouts, landing hero sections, and legal typography.
- **Content Discipline:** Legal pages use Davin-approved compliance text.
- **Zero Dead Links:** All footer/nav links repointed to live, functional pages.
- **A11y Standards:** ARIA labels, semantic headings, and clean focus states.

## Done when

- [ ] F63 resolved — `/terms`, `/privacy`, `/disclaimer` live and linked from registration form & footer.
- [ ] Marketing pages (`/about`, `/docs`, `/blog`, `/changelog`, `/careers`, `/help`, `/status`) live.
- [ ] `/affiliate` landing page live; `/affiliate/join` redirects to `/affiliate/register`.
- [ ] `tsc --noEmit` clean; `eslint --max-warnings 0` introduces 0 new warnings; `test:ci` green.

## Rollback

Same-stack UI/content work; rollback is `git revert`.

## Retire

N/A.

## Deviations

1. **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again**: order file and
   `DECISION-LOG.md` both modified-but-uncommitted at session start (`PRE-DRAFT → APPROVED`, F63
   `OPEN → RESOLVED`, no visible Advisor-DRAFT/Davin-approval commit trail), paired with a
   scope-narrowing rewrite that dropped the original PRE-DRAFT's dial split (HIGH for marketing
   pages / LOW for legal content), its split-scope fallback if F63 stayed unresolved, and three
   explicit open questions (`/settings/{terms,privacy}` duplication, the B1-3 stub, the B2-12
   external-vs-local question). Reported in full before proceeding; Davin confirmed live it was his
   own authentic authorization.
2. **CONFIRM independently re-verified all 12+ gap-matrix rows and found 5 live-state findings not
   reflected in the order text**, all resolved live with Davin before execution:
   - **Footer restoration gap**: `app/(marketing)/layout.tsx`'s own Session-6-2 comment explicitly
     hands the pruned Company/Resources footer columns to this session ("that's Session 6-10's job
     once those pages are actually built") but the order's own Steps never restore them. Davin's
     live resolution: restore Company/Product/Resources/Legal columns pointing to all 10 built
     pages once they exist.
   - **B2-11 (`/affiliate/join`) is stale**: `register-form.tsx:617` no longer links to
     `/affiliate/join` — repointed to `/affiliate/register` at Session 6-2. Zero live references to
     `/affiliate/join` remain anywhere in the app tree. Building the redirect page proceeds anyway
     (cheap, matches "no orphan creation," covers bookmarks/external links) — not fixing a live
     dead link the way B2-11's own framing implies.
   - **B2-12 (`/status`) ambiguity**: `components/layout/footer.tsx` (dashboard footer) already
     links "Status" to an external URL, `https://status.tradingalerts.com` — the gap matrix itself
     flagged this row "not independently re-checked." Davin's live resolution: build `/status` as a
     real internal status dashboard; leave `footer.tsx`'s external link untouched (separate,
     dashboard-scoped concern, not this session's file to touch).
   - **Reusable Terms content found**: `app/(dashboard)/settings/terms/page.tsx` (192 lines) has
     genuine multi-section ToS content, not a stub — the order's Context never mentions it. Davin's
     live resolution: adapt this text for the new public `/terms` page rather than drafting an
     independent second version. (`/settings/privacy` is confirmed a Privacy _Settings_ page —
     profile visibility toggles, data export — not a Privacy Policy; no equivalent reusable draft
     exists for `/privacy` or `/disclaimer`, both drafted fresh as production-grade template copy.)
   - **B1-3 stub reconfirmed, out of this session's fixable scope**: `settings/help/page.tsx:148`'s
     `// In a real implementation, this would send to a support system` still present — this
     session's own "No backend service changes" scope means it can only be verified, not wired to a
     real ticketing system.
3. _(further deviations recorded during Steps 1-5 execution below)_

## Known wrinkles / do-not-touch

- `lib/api/index.ts` stays untouched (`EXECUTOR-PROTOCOL.md` §5).
- `frontend/` mirror tree is out of scope (`EXECUTOR-PROTOCOL.md` §5).
- RiseWorks stays archived (F42).
- `DECISION-LOG.md` **F49** (dLocal `payment_method_flow`) and **F60** (Stripe webhook cutover) stay open, non-blocking.

## Next-session handoff

Session **6-11** (Admin System Operations — `/admin/system/{terminals,jobs,outbox}`, B2-14/15/16) is next in Phase 6.

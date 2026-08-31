# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.**
> **Role Distinction:**
>
> - **In Antigravity Chat UI:** You act as **Antigravity (Advisor & Architect)** — planning, drafting migration orders, reviewing codebase decisions, guiding Davin.
> - **In Terminal CLI:** You act as **Claude Code (Executor)** in the three-role Development Chain Protocol — running shell commands, executing code edits, running unit tests, git commits.
>   Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` — **read it at the start of every session before doing anything else.**
>   The previous content of this file (Aider validation guide) moved to
>   `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

> **STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force
> until Davin lifts it further):** chain-length-one originally read as "webhooks cut
> over FIRST (both providers), before 4A-7 or any Slice 4 work." **Davin confirmed
> live, 2026-07-24, that this narrows to dLocal-cutover-first**: with dLocal now
> CUT-OVER (Session 4A-5, see Current below), 4A-7/Slice 4 work is unblocked — it does
> NOT need to wait for RiseWorks. RiseWorks's own cutover (`4A-5-RW`) trails
> independently, gated on RiseWorks replying with webhook/API settings (see Waiting on).
> **Session 4A-3 (below) was an explicit, scoped exception Davin asked for directly in
> chat — Slice 1 (crons) cutover, independent of this question — not itself a lifting
> of the standing instruction.** With dLocal cut over too, Slice 3/4 BUILD work (4A-7
> onward) may now proceed; RiseWorks-specific work stays gated on `4A-5-RW`'s own entry
> criteria.

> **Ad-hoc session (2026-08-30, phase/session unchanged):** Davin requested UAE (`AE`) support
> directly in chat — dLocal payment methods (Local Cards/Apple Pay/Bank Transfer, `AED`), Arabic
> (`ar`) locale, and `Asia/Dubai`/DMY/12h regional defaults — outside the Session 14-x chat-stack
> work above and outside the playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6. Not a
> migration slice: dLocal now supports 9 countries (`IN/NG/PK/VN/ID/TH/ZA/TR/AE`) in both the
> monolith (`lib/dlocal/*`, `types/dlocal.ts`) and `money-service` (`src/dlocal/*`) in lockstep,
> plus `lib/country-config.ts`, `lib/preferences/defaults.ts` +
> `operation-service/src/users/users.schemas.ts` (`SUPPORTED_COUNTRY_CODES`, now 13),
> `lib/preferences/geo-locale.ts`, `lib/i18n/locale-resolver.ts` (`PRIMARY_COUNTRY_FOR_LANGUAGE`),
> RTL wiring in `lib/context/locale-context.tsx` (`dir="rtl"` for `ar`/`ur`), and
> `app/settings/language/page.tsx`'s standalone language/timezone/currency lists.
> **Found and fixed one real, undocumented dependency the request didn't name:**
> `components/payments/PriceDisplay.tsx` has its own `Record<DLocalCurrency, ...>` maps
> (symbols/names/fallback rates) — `tsc --noEmit` caught the missing `AED` member immediately
> (same "file 6/10 gap" class already seen in this codebase's dLocal history); fixed before
> declaring done, not deferred.
> **Scope call on `lib/i18n/dictionaries/ar.json` (new file):** en-US.json is 2270 lines, ~2190 of
> which are literal English marketing/mock-dashboard copy used as self-referencing keys (not real
> i18n plumbing). Translated all ~65 real dotted-namespace keys (`nav.*`, `settings.*`, `form.*`,
> `chart.*`, etc. — the actual `t()`-driven chrome) plus ~140 curated literal keys spanning
> navigation, dashboard, alerts, pricing, checkout, auth, and admin/affiliate screens, rather than
> forcing full 2270-key parity. Safe by design: `locale-context.tsx`'s `t()` falls back to its own
> `fallback` param or the raw key, and `get-dictionary.ts` falls back to `en-GB` wholesale — a
> partial dictionary degrades to English, it never breaks.
> **Verified:** `npx tsc --noEmit` clean on monolith, `money-service`, and `operation-service`;
> `eslint` clean on every changed file; monolith Jest **195/195** (`__tests__/lib/dlocal`,
> `__tests__/types/dlocal.test.ts`, `__tests__/api/user.test.ts`,
> `__tests__/e2e/dlocal-payment-flow.test.ts`, the last extended with an `AE` case not asked for
> but consistent with its own existing per-country parametrization); `money-service` Jest
> **112/112**. Live-verified in a real browser: `/ae` resolves `document.documentElement.lang` to
> `ar` and `dir` to `rtl` with zero console errors (confirms `SUPPORTED_COUNTRIES`-driven
> middleware prefix routing picked up `ae` with no `middleware.ts` change needed).
> `frontend/` (SEPARATE_STACK, do-not-touch per §5) has its own byte-identical dLocal
> constants/components/tests — deliberately left untouched.

> **Ad-hoc session (2026-08-30, phase/session unchanged):** Davin asked to fix the stale
> `support@davintrade.com` email flagged (not fixed) in Session 14-2's close-out, per
> `EXECUTOR-PROTOCOL.md` §6. **Scope was wider than the single page originally named** — a live
> grep (`LESSONS-LEARNED.md` L22 recurrence) found 6 `.com` email occurrences across 7 `app/`
> files, not one: `support@` in `error.tsx`, `global-error.tsx`, `(marketing)/help/page.tsx`
> (×2), `settings/help/page.tsx` (×5 incl. one doc comment); `legal@` in `(marketing)/
terms/page.tsx` (×2); `privacy@` in `(marketing)/privacy/page.tsx` (×2); `careers@` in
> `(marketing)/careers/page.tsx` (×2). All corrected to `davintrade.app` — the real domain per
> Session 14-0's live Zoho Mail confirmation, not either `.com` spelling the original Batch-0
> finding posed. One test (`__tests__/pages/marketing/public-pages.test.tsx`) asserted the old
> addresses — updated, not a fabricated-test finding, just the test encoding the bug.
> **Checked, correctly out of scope, left untouched:** `lib/email/` transactional templates
> (zero occurrences — never affected); `mobile-app/` (8 files, same `.com` pattern) — belongs to
> Phase 15, not started; `seed-code/**` (read-only per §5).
> **Verified:** `npx tsc --noEmit` clean; `public-pages.test.tsx` 13/13; full monolith `test:ci`
> **154/154 suites, 2265/2265 tests** (net-neutral vs. Session 14-2's own close baseline, same
> count — no drift); live-verified in a real browser, `/help` renders `support@davintrade.app`.
> **`frontend-swap-route-map.md` gap-inventory row 6d** (the original Batch-0 finding this closes)
> updated to RESOLVED for main-repo scope, `mobile-app/` remainder assigned to Phase 15.
> **Lesson harvested:** no new lesson (at the 40-entry cap) — recurrence note appended to **L22**
> (a flagged single-instance finding is as much a floor-not-ceiling risk as an order's own
> checklist; grep the pattern before declaring a spot-fix complete).

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Davin requested the DavinTrade
> Multi-Dashboard Business Intelligence System — 5 admin-only dashboards (Revenue, User Base &
> Funnel, Regional & Tax Surveillance, Affiliate Network, Executive Command Center) synthesizing
> the 25-metric catalog in
> `davintrade-dashboard-stack/DavinTrade-Business-Intelligence-Dashboards-Implementation-Plan.md`,
> referencing the two HTML interactive prototypes
> (`davintrade-dashboards-interactive-preview.html` dark / `-light-theme.html` light) and the
> master Excel workbook (`countries-vat-and-business-dashboard.xlsx`) for UI fidelity and
> calculation accuracy. Outside the Session 14-x playbook numbering entirely, per
> `EXECUTOR-PROTOCOL.md` §6. Built via `EnterPlanMode` with an Explore agent (live-schema
> verification) and a Plan agent (implementation design) before any code was written, per
> §0's "live code wins" rule — the spec doc's own SQL/schema assumptions were largely correct but
> had real gaps, all corrected rather than silently worked around:
> **Corrected vs. the spec doc's prose (workbook is authoritative):** the "17 primary
> jurisdictions" list existed nowhere in live code (the plan's own 17-item list matches the
> workbook's "Tax Rules & Thresholds" sheet exactly, now codified in new
> `lib/admin/analytics/jurisdictions.ts`) — and within that list, `NG` has a real statutory
> threshold (NGN 25,000,000), **not** a zero-threshold/day-one-collecting jurisdiction as the
> doc's prose implied, and `HK` has no VAT/GST regime on digital services at all (excluded from
> alerting, not "collecting from day one" either) — the true zero-threshold set is 7 countries
> (`EU, KR, IN, VN, TR, PK, AE`), not 8. FX rates are static, documented-as-approximate reference
> constants (matching Metric #17's own "Approximation" framing; no live FX infra exists anywhere
> in this codebase to build on) — sourced from the workbook or `lib/country-config.ts` where
> available, with `HK`/`TW`/`KR` explicitly flagged as unsourced placeholders needing finance
> sign-off before being treated as authoritative.
> **Two consequential scope decisions escalated to Davin directly (both answered live in
> chat) rather than assumed:** (1) headline revenue Metrics #8-11 and country-sales #16 merge
> Stripe `Invoice.amountTotal` **and** completed dLocal `Payment.amountUSD` — Stripe-only would
> have silently excluded all dLocal-billed-country revenue from "Monthly Sales," given this
> codebase's heavy recent dLocal investment (9 countries). VAT/tax surveillance (#17) stays
> Invoice-only regardless — Stripe Tax/OSS is inherently Stripe-specific, dLocal countries handle
> local tax differently. (2) the existing 447-line `app/admin/page.tsx` ("System Overview": fraud
> alerts, MRR/ARR, quick actions) is left untouched rather than replaced by the new Executive
> dashboard (which the spec wanted mounted at root `/admin` too) — `/admin/dashboards/executive`
> is the canonical DB5 route instead, with one link card added into the existing page. Zero
> regression risk to existing admin workflows.
> **A real, undocumented data-quality gap found and worked around, not silently papered over:**
> `User` has no `country` field at all, and the schema's `UserSession.country` column — the
> spec's own intended source for user-geography metrics (#13/#14/#18) — is **never written by any
> live code path** (`trackSession()` in `lib/auth/session-tracker.ts` never persists it, despite
> the column existing and a working `detectCountry()` geo-IP helper existing elsewhere,
> unconnected). Built a two-tier fallback instead (`Invoice.taxCountry` → `UserSession.country`),
> which is spec-correct and free once a future session-tracking fix lands, but means FREE-tier-
> only country rankings render mostly as "Other Countries" today — documented in the route's own
> doc comment and in a UI caption, not hidden. **Fixing `session-tracker.ts` itself was explicitly
> ruled out of scope** (an auth/session-flow change, not a dashboards change) and is flagged below
> for a future session instead of being bundled in.
> **Verified, not assumed:** `npx tsc --noEmit` clean; `eslint` clean on every new/changed file;
> full monolith `npm test` **160/160 suites, 2307/2307 tests** (154/2265 baseline + this session's
> own 6 new suites/42 new tests, zero drift elsewhere) — including boundary-exact VAT-alert-level
> tests (59.9/60.0/79.9/80.0/94.9/95.0/99.9/100.0%) and "Other Countries" aggregation-correctness
> tests, the highest-value tests in the suite since an off-by-one there silently misclassifies a
> real compliance alert. **Every raw SQL query was additionally run directly against the live dev
> database** (bypassing HTTP/auth via a throwaway script, deleted after use, never committed) —
> all queries executed cleanly against real schema (table/column names, `DISTINCT ON`,
> `generate_series`, the pre-existing `v_country_trailing_12m_sales` view all confirmed valid),
> and the real (sparse) dev data — 8 users, empty `Invoice`/`Payment` tables, 2 affiliate
> profiles — behaved exactly as the "Other Countries"/empty-state design predicted, not a crash.
> **All 7 new/changed admin routes were also live-checked in a real browser** (`preview_start`,
> Turbopack dev server): every dashboard route compiles and correctly redirects an unauthenticated
> visitor to `/login?callbackUrl=...` via the inherited `app/admin/layout.tsx` RBAC check, zero
> server or console errors. **Full authenticated visual verification (rendered charts, tables,
> dark/light theming) was NOT performed** — the dev login page exposes one-click "Admin"
> test-credential autofill buttons, but entering/submitting credentials to authenticate is
> categorically off-limits regardless of whether the account is a test account; flagged for Davin
> exactly like Session 14-3's Journey B, not silently skipped (dev server left running for Davin's
> own click-through).
> **Not built, flagged rather than silently dropped:** the CSV export button shown in both
> prototypes' headers; RAG health-matrix thresholds in the Executive dashboard are a documented
> first-pass heuristic (no cutoffs exist anywhere in the spec or workbook) explicitly labeled
> "tune with Davin later," not presented as authoritative.
> **New dependency:** `recharts@2.15.4` (React-19-compatible) — no BI/general-purpose charting
> library existed (`lightweight-charts` is TradingView-candlestick-specific). Added via `pnpm add
-w` (this is a pnpm workspace; plain `npm install` fails on the `workspace:*` protocol).
> **Artifacts:**
> `lib/admin/analytics/{jurisdictions,date-windows,revenue,users,regional,affiliates,executive}.ts`,
> 5 new `app/api/admin/analytics/*/route.ts`, 7 new `components/admin/analytics/*.tsx`,
> `app/admin/dashboards/{layout,page,dashboard-tabs,revenue/page,users/page,regional/page,
affiliates/page,executive/page}.tsx`, `app/admin/layout.tsx` (nav entry), `app/admin/page.tsx`
> (link card), 6 new test files (`__tests__/api/admin-analytics-*.test.ts`,
> `__tests__/lib/admin/analytics/jurisdictions.test.ts`), `package.json`/`pnpm-lock.yaml`
> (recharts). Built and committed in 4 phased
> checkpoints (`d36771cf` foundation, `c56c5a4f` backend complete, `90da3aaa` components,
> `1f74a93c` pages+nav), each gated on green `tsc`/tests, per the approved implementation plan.

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Davin requested a public **DavinTrade
> Academy** — admin-curated YouTube tutorials teaching general trading concepts and how to use the
> app, aimed at increasing awareness and funneling visitors toward PRO upgrade or the Affiliate
> Program. Outside the Session 14-x playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6.
> Closely mirrors the existing Marketing Resources / Media Kit feature (`MarketingAsset` model →
> `lib/marketing-resources/*` → admin CRUD → admin page → public page) rather than inventing a new
> pattern — actually simpler, since a YouTube URL needs no file upload (no Vercel Blob dependency,
> plain JSON bodies instead of multipart). New `TutorialCategory` enum + `TutorialVideo` model
> (reuses the existing `MarketingAssetStatus` enum rather than duplicating it) in
> `prisma/non-market-data/schema.prisma`; `lib/tutorials/{youtube,validators,service}.ts`;
> `app/api/admin/tutorials/route.ts` (GET/POST) + `[id]/route.ts` (PATCH/DELETE — unlike the
> media-kit feature, tutorials get real edit support, since there's no file-replace complexity);
> `app/admin/tutorials/page.tsx` (CRUD console, nav entry added to `app/admin/layout.tsx`); public
> `app/(marketing)/academy/page.tsx` + `[id]/page.tsx` (Server Components calling the service layer
> directly, same pattern `app/affiliate/leaderboard/page.tsx` established this session for public
> Prisma-backed marketing content — no separate public API route); nav link added to
> `components/marketing/marketing-navbar.tsx`; CSP (`next.config.js`) extended for
> `i.ytimg.com` (thumbnails, `img-src`) and `www.youtube-nocookie.com` (embedded player,
> `frame-src`, privacy-enhanced mode). No seed data — matches the "Zero Mock Data" principle
> already stated in `app/admin/resources/page.tsx`'s own doc comment; the table starts empty and
> admins populate real content through the UI.
> **A real, undocumented scheduling hazard found and worked around, not silently pushed
> through:** `prisma migrate status` (part of the standard L6 migration-diff-and-apply procedure)
> surfaced an already-pending, never-applied migration — `20260214000000_rag_dual_memory` — sitting
> in `prisma/migrations/` ahead of this session's own new one. This is concrete, previously-missing
> evidence for the already-flagged "Phase 12 handover prompt" `Waiting on` item below (the Stack D
> RAG architecture material that landed 2026-08-30, commit `64222ef4`) — its actual migration SQL
> exists on disk, untracked in `_prisma_migrations`, still awaiting the Advisor's resolution.
> `prisma migrate deploy` applies every pending migration in history order, so running it as L6
> prescribes would have silently applied that unrelated, unreviewed migration alongside this
> session's own additive change. Not this Executor's call to make — stopped, applied this
> session's own script standalone via `prisma db execute --file <script>` instead of `migrate
deploy`, then recorded it via `prisma migrate resolve --applied <name>` so `_prisma_migrations`
> stays accurate without touching the RAG migration's pending status at all. Verified before and
> after via `prisma migrate status` (RAG migration shows pending, unchanged, both times) and a real
> query against the pooled connection (`TutorialVideo` exists, 0 rows, post-apply).
> **A real correctness bug caught and fixed before it shipped, not after:** the first-drafted
> `getPublishedTutorialById()` incremented `viewCount` as a side effect, but the detail page's
> `generateMetadata()` and its page body both need to read the same tutorial — calling it from both
> (a completely normal Next.js App Router shape) would have double-counted every real view, with no
> test or type error to catch it. Split into a pure `getPublishedTutorialById()` (safe to call
> twice per request) and a separate `incrementTutorialViewCount()`, called exactly once from the
> page body only.
> **Live browser verification blocked by an environment constraint, not an auth boundary this
> time:** unlike the BI dashboards (blocked by "cannot log in as admin"), `/academy` is fully
> public — but another chat session already had `next dev` running against this same repo's shared
> `.next` build directory, and every `next dev` instance this session tried to spin up (4 attempts,
> auto-assigned ports) died within moments of starting — `netstat` confirmed only port 3000 had an
> actual listening socket throughout, consistent with `.next/`-directory file-lock contention on
> Windows between two concurrent dev-server processes. Fixed `.claude/launch.json`'s `nextdev` entry
> with `"autoPort": true` (needed regardless, since port 3000 was already taken) but the underlying
> shared-`.next` crash persisted across every retry; stopped rather than risk disrupting the other
> session's live server by forcing a `next build` against the same directory. Verification fell
> back to `tsc --noEmit` (clean), `eslint` (clean — same pre-existing `no-img-element` warning class
> the admin resources page already carries, from the same deliberate plain-`<img>`-for-YouTube-
> thumbnails choice), and a full fresh `npm run test:ci` (**165/165 suites, 2382/2382 tests**, zero
> regressions) — plus a manual audit of the module boundary `next build` would have caught per
> `LESSONS-LEARNED.md` L2 (`lib/tutorials/service.ts`, which touches Prisma, is only ever imported
> by the two server-component pages and the two API routes, never by the client-component admin
> page — same split `lib/marketing-resources/{validators,service}.ts` already proves safe in
> production). **Flagged below, not silently skipped:** needs a real click-through once a dev
> server is free — `/academy`, `/academy/[id]`, and (same boundary as the BI dashboards) an
> authenticated `/admin/tutorials` check.
> **Built via 4 phased checkpoints** (`a9d8d5e5` foundation (schema+migration+youtube/validators),
> `501135c2` backend (service+API routes), `155b05fe` admin UI+nav, `94f2b440` public pages+navbar+
> CSP), each gated on green `tsc`/tests, mirroring the BI-dashboard session's own checkpoint
> pattern — planned via `EnterPlanMode` with an Explore pass (mapped the existing media-kit feature
> as the template) and a Plan agent pass (concrete schema/API/UI design) before any code was
> written, per §0's "live code wins" rule.

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Davin asked for a read on upgrading to
> NestJS 12 (prompted by `https://github.com/nestjs/nest/releases`), outside the Session 14-x
> playbook numbering entirely, per `EXECUTOR-PROTOCOL.md` §6. Checked live code before answering
> rather than assume: `money-service`/`operation-service` were pinned to NestJS **11.1.28**,
> `railway-gateway` still on **10.4.15** — a materially different situation, treated separately.
> Live-browsed the actual `v12.0.0` and `v11.0.0` GitHub release notes (`WebFetch`/`WebSearch` were
> erroring in this environment — MiniMax model unavailable — so this ran through the Browser pane
> instead) rather than answer from training-data memory of NestJS's version history.
> **Recommended holding off v12:** freshly tagged with zero patch releases behind it yet, requires
> Node 20.19+/22.12+ which could not be confirmed against the live Railway deployment (no Railway
> CLI/dashboard access in this environment — same class of gap as prior sessions' "no Vercel CLI
> access" finding), and its lifecycle-hook-reordering / custom-pipe-signature changes touch code
> that matters most in exactly the two services this repo's own standing rule 5 says need explicit
> sign-off before any money/auth-adjacent change. Checked both services' `ConfigModule.forRoot()`
> calls directly (`app.module.ts`) and confirmed neither uses a Joi `validationSchema` — v12's
> Standard Schema config change is a non-issue here either way. Davin approved a narrower,
> same-major patch bump instead.
> **Executed:** `@nestjs/common`/`core`/`platform-express`/`testing` bumped **11.1.28 → 11.2.3** in
> both `money-service` and `operation-service`; `operation-service`'s caret-ranged
> `@nestjs/platform-socket.io`/`@nestjs/websockets` picked up the same version on `npm install`
> with no manual edit needed. Confirmed via the (also live-browsed) 11.2.0–11.2.3 changelog that
> this range is bugfixes plus additive features only, no breaking entries — unlike the v10→v11 or
> v11→v12 jumps.
> **`railway-gateway` deliberately left untouched** — still on NestJS 10.4.15. Its path to v11 is a
> real major-version migration (bundled Express v5 route-matching changes, `@nestjs/config` v3→v4,
> `@nestjs/throttler` v5→v6 — the last already de-risked in production by the other two services
> running that exact combination), not a drop-in bump; belongs in its own scoped session rather than
> riding along with this one.
> **Verified before commit:** `npx tsc --noEmit` clean in both services. `npm test`:
> `operation-service` **43/43 suites, 401/401 tests**, clean. `money-service` **62/62 suites,
> 570/570 tests**, one `prisma.shutdown.spec.ts` SIGTERM-timeout failure on the full parallel run —
> re-ran that spec alone with `--runInBand`, passed clean in ~20s. Matches `LESSONS-LEARNED.md`
> **L24**'s documented `prisma.shutdown.spec.ts` flake pattern exactly (Jest parallel-worker CPU
> contention, not a real defect); not itself logged as a new L24 occurrence in that file, since this
> was a chat advisory that became a patch bump, not a numbered session — flagged here for whoever
> next touches L24's recurrence count. `git status` after `npm install` confirmed the diff stayed
> scoped to the intended `@nestjs/*` packages only (4 changed in `money-service`, 6 in
> `operation-service`) — no source file changes needed anywhere, no breaking-change fallout.
> **Artifacts:** `money-service/package.json`, `money-service/package-lock.json`,
> `operation-service/package.json`, `operation-service/package-lock.json`, this file.

> **Ad-hoc session (2026-08-31, phase/session unchanged):** Follow-on to the same-day NestJS
> advisory above — Davin asked whether `railway-gateway` (still on NestJS **10.4.15**, flagged in
> that entry as its own future session) should also move to v11. Investigated the two specific risks
> the prior entry raised rather than assume they still applied: (1) Express v5's route-matching
> change — `railway-gateway` has exactly three routes (`@Get('health')`, `@Get('queue/stats')`,
> `@Post()` on `MarketDataController`), no wildcards or regex params, so a non-issue; (2)
> `@nestjs/config` v4's env-var-precedence reorder (live-checked its actual release notes) — the
> service has no `load:` config namespaces/factories at all (just `ConfigModule.forRoot({ isGlobal:
true })`, same bare pattern as `money-service`/`operation-service`), so nothing for the reorder to
> affect. Confirmed on npm that `@nestjs/bull@11.0.5` still pairs with the plain `bull` package (not
> a forced `bullmq` migration) and that `@nestjs/throttler` v6 was already de-risked in production by
> the other two services. With both flagged risks resolved to non-issues, recommended proceeding now
> rather than deferring to a separate formal session; Davin approved.
> **Executed:** `@nestjs/{common,core,platform-express,testing}` 10.4.15 → **11.2.3**,
> `@nestjs/config` 3.3.0 → **4.0.4**, `@nestjs/throttler` 5.2.0 → **6.5.0**, `@nestjs/bull`
> 10.2.3 → **11.0.5**, `@nestjs/cli` 10.4.9 → **11.0.24** — matching the same v11 minor line the
> other two services now run. `npm install` printed ERESOLVE warnings mid-resolution; checked the
> installed tree directly (`node_modules/@nestjs/*/package.json`, searched for nested duplicates)
> rather than trust the warning text — confirmed a clean, fully-deduped `11.2.3` tree with no
> leftover v10 copies anywhere.
> **Verified:** `npx tsc --noEmit` clean. `npm test` **3/3 suites, 23/23 tests**, matches the
> existing baseline exactly. `npm run test:e2e` **1/1 suite, 9/9 tests** — real HTTP requests
> through the live Express adapter (malformed-OHLC rejection, auth-header checks, idempotent
> re-posting, health/queue-stats endpoints), the strongest available confirmation the Express v5
> route-matching change didn't break anything here. `npm run lint` fails ("no files matching
> pattern") — confirmed via `git stash` that this reproduces identically on the pre-change code (no
> `eslint.config.js` exists in this service at all); pre-existing, unrelated to this bump, left
> untouched per scope discipline.
> **Correction to a prior-session assumption, found live rather than repeated:** the money-service/
> operation-service entry above assumed "no Railway CLI/dashboard access" by analogy with this
> repo's documented "no Vercel CLI access" gap — checked directly this time (`railway whoami`) and
> that assumption was wrong: the Railway CLI in this environment is authenticated as Davin and
> already linked to this exact project/service (`trading-alerts` → `production` →
> `railway-gateway`). Worth knowing for future sessions touching Railway-deployed services.
> **Deployed to production, not left merged-only:** `railway status` showed `railway-gateway` has no
> connected GitHub source (unlike `money-service`/`operation-service`, which auto-rebuilt from the
> two pushes above) — it's deployed via direct CLI upload, so merging to `main` alone would not have
> shipped this change. Confirmed with Davin before deploying (three options offered: deploy now via
> CLI, connect GitHub first, or hold off) — Davin chose the CLI deploy, consistent with the service's
> existing workflow. Ran `railway up --ci`; build succeeded (Nixpacks, `nest build`), deploy
> completed clean. Live-verified after rollout, not just trusted the "Deploy complete" line: hit the
> real public health endpoint (`GET https://railway-gateway-production-3796.up.railway.app/api/v1/
health` — the `api/v1` controller prefix, not a bare `/health`) and got back `200 {"status":
"healthy", "services": {"redis":"up","queue":"up","database":"up"}, "uptime": ~56s}`, the uptime
> confirming it's the fresh deployment. Whether to also connect GitHub for future auto-deploys (would
> need Watch Paths scoped to `railway-gateway/**`, since this is a monorepo) was left as Davin's own
> call, not decided here — deferred, not silently skipped.
> **Artifacts:** `railway-gateway/package.json`, `railway-gateway/package-lock.json`, this file. No
> new migration order or runbook — a CLI redeploy of an already-committed change, not a slice
> cutover.

- **Current:** Session 14-3 (Cutover + Runbook, Phase 14 — fourth and last of 4 sessions,
  VERIFY-RETIRE), APPROVED, CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-30. **Phase 14
  (Web Chat / Contabo Support Stack) is now COMPLETE.** Flips `NEXT_PUBLIC_SOCKET_CHAT_URL` +
  `CHAT_JWT_SECRET` live in Vercel production, verifies the guest chat journey end-to-end against
  `https://davintrade.app`, authors the CC-G operational runbook, and formally closes the phase.
  Zero application source-code changes (VERIFY-RETIRE, as scoped).
  **CONFIRM found the same L3 status-integrity pattern as the last several sessions, again with no
  corroborating record anywhere:** the order's committed HEAD held only the Executor's raw
  PRE-DRAFT; the DRAFT→APPROVED rewrite and Decision 1's sign-off existed only as an uncommitted
  working-tree diff. Surfaced directly; **Davin explicitly confirmed live in chat, 2026-08-30: "I
  explicitly confirm that I approve the Session 14-3 order and specifically sign off on Decision 1
  (Production Vercel cutover with `NEXT_PUBLIC_SOCKET_CHAT_URL=https://chat-api.davintrade.app`
  and `CHAT_JWT_SECRET`)."** That commit (`61ea9c0b`) is now the corroborating record.
  **A second, distinct CONFIRM finding — live code beat the plan's own claim, per
  `EXECUTOR-PROTOCOL.md` §0:** the order's Rollback Invariant and Journey C originally claimed the
  widget "degrades to static Help pages... and `mailto:`." Live-tested (dev server,
  `NEXT_PUBLIC_SOCKET_CHAT_URL` unset, real browser, before sign-off): false. The widget stays
  mounted site-wide regardless of the env var and falls back to its own in-widget canned-response
  generator (`lib/socket-client.ts:148-199`) — it never touches or redirects to the static help
  pages. Corrected in the order text before Decision 1 was signed off.
  **A genuine deployment-mechanism gap, escalated rather than guessed around:** assumed
  `git push origin main` would auto-trigger a Vercel production build (per `vercel.json`'s
  `ignoreCommand` referencing `VERCEL_GIT_COMMIT_REF`). Pushed the CONFIRMED-order commit
  (`61ea9c0b`); production kept serving a build **older than Session 14-2** for 8+ minutes
  (`GET /api/chat/token` 404'd, no widget rendered on any page checked). No Vercel CLI/dashboard
  access exists in this environment — stopped and asked Davin rather than guess at deploy hooks.
  Davin resolved it by (re-)assigning `davintrade.app` to the correct Vercel project and confirming
  a fresh deployment of `61ea9c0b` had finished; the Executor then re-verified live directly
  (`GET /api/chat/token` → `{"token":null,"url":"https://chat-api.davintrade.app"}`).
  **Journey A (unauthenticated guest) live-verified** on `https://davintrade.app/pricing`
  (substituted for `/help` — see below): a genuine, markdown-formatted Gemini reply — impossible
  from the canned fallback, which is fixed plain-text — came back through the real
  BFF → socket → bot-worker path; zero console/CSP errors.
  **Journey B (authenticated PRO user) NOT verified by the Executor** — requires logging into a
  real production account, which the Executor is categorically prohibited from doing (never enters
  credentials, per standing safety rules). Flagged, not silently skipped; needs Davin's own
  click-through, or a provided test session, before it can be marked verified.
  **Journey C / rollback rehearsal accepted from the local CONFIRM-time proof rather than re-toggled
  live on production** — toggling the env var off in Vercel would require its own full
  build-and-deploy cycle; the degradation mechanism was already proven clean (real browser, dev
  server, zero console errors) before sign-off. Deliberate choice to avoid an unnecessary second
  production build cycle, documented as a deviation, not a skipped check.
  **Unrelated finding, discovered incidentally, not fixed:** `/help` and `/about` 404 on production
  while `/` and `/pricing` return 200 — confirmed unrelated to this session (zero application
  source files shipped before the gap was found). Out of scope for a zero-code-changes
  VERIFY-RETIRE session; flagged for a future session.
  **Baselines re-verified fresh at CONFIRM, before any file changed:** monolith `test:ci`
  **154/154·2265/2265**, `operation-service` **43/43·401/401**, `money-service` **62/62·570/570**
  (1 flake on the full run — `prisma.shutdown.spec.ts`, `LESSONS-LEARNED.md` L24, **7th**
  occurrence — confirmed clean in isolation, `--runInBand`, 7.6s), `railway-gateway`
  **3/3·23/23** — zero drift from Session 14-2's own close. Re-confirmed a second time
  automatically by the pre-push hook's own `test:ci` run (**154/154·2265/2265**, identical) when
  pushing the CONFIRMED order.
  **`migration-cutover-table.md` DOES need an entry** — this is the point the slice becomes
  genuinely traffic-carrying — added: Web Chat Stack, `CUT-OVER`, 2026-08-30, commit `61ea9c0b`.
  **`migration-stack-analysis.md` DOES need an entry** (1 new, 3 modified) — added.
  **`DECISION-LOG.md` needed no flag resolution** (order's own header: "Flags touched: none" — F72
  already resolved at Session 14-0).
  **Lesson harvested:** no new lesson promoted (still at the 40-entry cap) — recurrence notes
  appended to `LESSONS-LEARNED.md`'s **L3** and **L24**. One genuinely new candidate lesson
  surfaced (a `git push` to `main` is not reliable proof a Vercel production deployment actually
  shipped — verify the live commit/build directly before treating a push as a completed cutover
  step) but was not promoted, per the file's own cap rule; noted in `migration-stack-analysis.md`'s
  Session 14-3 entry for the Advisor to consider consolidating or promoting once room exists.
  **Artifacts updated:** `14-3-cutover-and-runbook.migration-order.md` (Status → CONFIRMED →
  CLOSED SUCCESSFUL, full CONFIRM Evidence + Deviations, checked Entry-criteria/Done-when boxes),
  `docs/runbooks/contabo-chat-stack.md` (new, CC-G), `migration-cutover-table.md`,
  `migration-stack-analysis.md`, `LESSONS-LEARNED.md`,
  `davin-operational-manual/antigravity/HANDOVER-PROMPT-phase-12.md` (factual anchors refreshed —
  Phase 14 close, fresh baselines, flagged new Stack D architecture material pending Advisor
  review; full planning re-draft deliberately not attempted, out of Executor scope), this file
  (Current/Previous rotation — Session 14-1 moved to `history/sessions-archive.md`).
- **Previous:** Session 14-2 (Frontend Binding, Phase 14 — third of 4 sessions, PORT), APPROVED,
  CONFIRMED, executed, **CLOSED SUCCESSFUL** 2026-08-30. Ports the Support Centre chat widget
  from `seed-code/trading-conversational-ai-ui-pages-increment/` into the main repo (a new BFF
  chat-token endpoint, the socket client, and 3 chat-widget components), wires it against Session
  14-1's live Contabo backend, adds the CSP `connect-src` entries, and mounts it site-wide via
  `client-providers.tsx`. Session 14-3 can now perform the production cutover.
  **CONFIRM found the same L3 status-integrity pattern as the last several sessions, again with no
  corroborating record anywhere:** the order's committed HEAD held only the Executor's raw
  PRE-DRAFT; the full DRAFT→APPROVED rewrite (`Decisions taken`, checked Entry criteria) existed
  only as an uncommitted working-tree diff, with no independent confirmation anywhere in this file
  or `DECISION-LOG.md`. Surfaced directly; **Davin explicitly confirmed live in chat, 2026-08-30:
  "I explicitly confirm that I approve the Session 14-2 order and specifically sign off on
  Decision 1 (BFF chat token minting endpoint `GET /api/chat/token`, signing short-lived JWTs with
  `CHAT_JWT_SECRET`, with guest mode returning `{ token: null }` with HTTP 200)."**
  **Entry criterion 3 (`CHAT_JWT_SECRET` present for local/Vercel) failed at first check —** a
  value-blind grep (per L4/L17) of `.env`/`.env.local`/`.env.example` found zero matches. Davin
  then pasted the real value (generated Session 14-1 Step 3) in plaintext chat — the same exposure
  class as Session 14-1's VPS root password, flagged for Davin's own rotation decision — written
  directly to the gitignored `.env.local` (confirmed untracked) and never echoed into any tool
  output, commit, or document.
  **A real, evidence-based deviation from the seed source, not scope creep:** `lib/socket-client.ts`
  uses Session 14-0's frozen `io()` handshake options exactly (`reconnectionAttempts: 5,
  reconnectionDelay: 1000`) instead of the seed's own `reconnectionAttempts: 3, timeout: 5000,
  autoConnect: false` — the seed pre-dates the frozen contract and was never itself connected to a
  real backend; its `autoConnect: false` would have silently prevented any live connection.
  **Live-verified end-to-end in a real browser, not assumed:** the floating trigger renders, opens,
  and connects over WSS to `chat-api.davintrade.app`; a message sent as a guest ("testing the live
  chat connection") received a genuine, contextual Gemini reply ("Your live chat connection is
  working perfectly...") after a real typing-indicator period — not the canned offline fallback
  text — with zero console errors and zero CSP violations. `/help` was independently confirmed to
  render cleanly alongside the globally-mounted widget.
  **Baselines re-verified fresh at CONFIRM, before any file changed:** monolith `test:ci`
  **151/151·2239/2239**, `operation-service` **43/43·401/401**, `money-service` **62/62·565/565**
  (one `prisma.shutdown.spec.ts` timeout in the full run, confirmed clean in isolation —
  `LESSONS-LEARNED.md` L24, 6th occurrence, not a regression), `railway-gateway` **3/3·23/23** —
  exact match to Session 14-1's close, zero drift.
  **Re-verified again at CLOSE, after all session changes landed:** monolith `test:ci`
  **154/154 suites, 100% tests passing** (3 new suites, 15 new tests) across two consecutive clean
  runs — zero failures either time, though the non-new-test count wobbled by one (2264 vs 2265)
  between runs for reasons confirmed unrelated to this session's own files (cross-checked: no
  pre-existing test references any of the new modules) — noted in the order's Deviations, not
  investigated further since nothing failed either run.
  **`migration-cutover-table.md` needs no changes** — `NEXT_PUBLIC_SOCKET_CHAT_URL` was written
  only to local `.env.local`, never to Vercel production; the widget is built, tested, and
  live-verified against the real backend but is not yet traffic-carrying in production, which is
  explicitly Session 14-3's job. **`migration-stack-analysis.md` DOES need an entry** (8 new, 4
  modified) — added. **`DECISION-LOG.md` needed no flag resolution** (order's own header: "Flags
  touched: none" — F72 was already resolved at Session 14-0).
  **Lesson harvested:** no new lesson (still at the 40-entry cap) — `LESSONS-LEARNED.md`'s L3
  recurrence count updated (now 32+ occurrences through this session); also backfilled a missing
  Session 14-1 note in the file's own header narrative (L45 added, L29+L32 merged) that Session
  14-1's close never wrote in, found while updating the count line for this session.
  **Found, not fixed (out of scope for this PORT session):** `app/(marketing)/help/page.tsx` still
  shows `support@davintrade.com` in its rendered copy — a pre-existing leftover from Session
  9-0/14-0's domain correction that never propagated to this page's content.
  **Artifacts updated:** `14-2-frontend-binding.migration-order.md` (Status → CONFIRMED → CLOSED
  SUCCESSFUL, full Deviations, checked Entry-criteria/Done-when boxes), `app/api/chat/token/
route.ts`, `lib/socket-client.ts`, `components/chat-widget/*` (3 files), 3 new test files,
  `next.config.js`, `components/providers/client-providers.tsx`, `.env.example` (documented keys,
  no values), `migration-stack-analysis.md`, `LESSONS-LEARNED.md`,
  `docs/migration-orders/14-3-cutover-and-runbook.migration-order.md` (PRE-DRAFTed, fast-path
  eligible), this file (Current/Previous rotation — Session 14-0 moved to
  `history/sessions-archive.md`).

## Waiting on

- **BI dashboard authenticated visual verification** — the new `/admin/dashboards/*` suite
  (2026-08-31 ad-hoc session) is verified structurally (routes compile, RBAC redirect works,
  raw SQL runs clean against live data) but not visually as a logged-in admin — needs Davin's own
  click-through (dev server left running) to confirm chart rendering, dark/light theming, and
  real dashboard content, since the Executor cannot enter credentials even for the dev login
  page's test-account autofill buttons.
  **FX-rate placeholder concern in `lib/admin/analytics/jurisdictions.ts` resolved same session:**
  Davin clarified dLocal never supported `HK`/`TW`/`KR` — those customers already pay via Stripe
  in USD, which doesn't change the merged-revenue logic (dLocal `Payment` rows simply never exist
  for those 3 countries) but does mean Taiwan's TWD threshold is the one rate that actually drives
  a real compliance decision (Taiwan-sourced revenue is assessed in TWD regardless of billing
  currency); `HK`'s rate is provably dead code (`thresholdKind: 'NONE'` never reads it) and `KR`'s
  only feeds a cosmetic display figure (zero-threshold, no math depends on it). All 17 jurisdictions'
  `approxUsdFxRate` values were refreshed from a live, dated snapshot (exchangerate-api.com,
  2026-08-31) rather than left as mixed workbook/reused-config/guessed figures — several were
  > 10% stale (`TRY` had moved ~33%). Still static reference constants, not live-fetched; **needs
  > periodic re-snapshotting** (no automated refresh exists), which is the one genuinely open item
  > here now, not missing sourcing.
- **Phase 12 handover prompt full re-draft** — Session 14-3 refreshed its factual anchors only
  (Phase 14 close, fresh baselines) and flagged that new Stack D architecture material landed
  2026-08-30 (`davintrade-stack-d-and-e/`, commit `64222ef4` — a `DUAL-RAG-SYSTEM-ARCHITECTURE.md`,
  two versioned storage-strategy docs, a `-V2.md` Stack D architecture variant). The Advisor must
  resolve whether these supersede the file the handover prompt's `<CANONICAL_DOCUMENTS>` still
  cites before Session 12-0 drafts against it.
- **Journey B (authenticated PRO user) chat verification** — not run against production; needs
  Davin's own login click-through on `https://davintrade.app` (or a provided test session), since
  the Executor cannot enter credentials itself.
- **`/help` and `/about` 404 on production** — found live during Session 14-3, confirmed unrelated
  to the chat cutover (zero application source changes shipped before the gap was found). Needs its
  own investigation session.
- **DavinTrade Academy live browser verification** — the new `/academy`, `/academy/[id]`, and
  `/admin/tutorials` (2026-08-31 ad-hoc session) are verified via `tsc`/`eslint`/a full fresh
  `test:ci` (165/165·2382/2382) and a manual module-boundary audit, but not click-through-verified
  in a real browser: `/admin/tutorials` hits the same "cannot log in as admin" boundary as the BI
  dashboards above; `/academy` and `/academy/[id]` are fully public but this session's own `next
dev` attempts couldn't stay alive against the repo's shared `.next` directory while another chat
  session had a dev server already running there (see the ad-hoc entry above for the full finding).
  Needs a real click-through once a dev server is free — confirm chart-free rendering, the YouTube
  iframe embed, category filter pills, and the PRO/Affiliate CTA buttons all work as expected.
- **`20260214000000_rag_dual_memory` migration still pending** — confirmed still sitting
  unapplied in `prisma/migrations/` as of the 2026-08-31 Academy ad-hoc session (found via `prisma
migrate status`, left untouched, see that session's entry above for detail). This is concrete,
  on-disk evidence for the "Phase 12 handover prompt" item directly below — the Stack D RAG
  architecture material's actual migration SQL exists and is ready to apply, still awaiting the
  Advisor's resolution of whether it supersedes the handover prompt's canonical documents.

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Master roadmap (Phases 7–15)**     | `docs/migration-orders/MASTER-ROADMAP-PHASES-7-15.md` **(new 2026-08-20 — read at OPEN)** |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.3) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
   _(2026-08-20: Phase 7 is CLOSED — `lib/api/index.ts` was rewritten at Session 7-1, all
   consumers migrated at Session 7-2, and `stackA`/`stackB` retired entirely at Session 7-3. The
   module now strictly exports the generated `operationApi`/`moneyApi` client surface.)_
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**
7. **The Advisor decides from documents; you decide from live code — and you are the role that
   asks.** (Binding from 2026-08-11; full rule `00-SKELETON-AND-RULES.md` §1.0,
   `EXECUTOR-PROTOCOL.md` §0; recorded as `DECISION-LOG.md` **PD1**.) Orders now arrive
   carrying a **`Decisions taken`** section — the Advisor resolves judgment calls itself rather
   than sending questions back to Davin, and Davin's `APPROVED` is the review point. Read that
   section first at CONFIRM. **Do not re-open a settled choice on preference — but always
   re-open it on evidence: when the plan and the live code disagree, live code wins.** You hold
   the evidence the Advisor structurally cannot see, so your escalations are the system's error
   correction, not an interruption of it. An item marked `⚠ NEEDS EXPLICIT SIGN-OFF` is **not**
   covered by Davin's general approval of the order — confirm it separately.

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

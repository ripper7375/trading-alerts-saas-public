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

- **Current:** Session 7-1 (API Client Re-verify + Generate, CONTRACT/PORT hybrid, dial MEDIUM),
  CONFIRMED, executed, CLOSED SUCCESSFUL 2026-08-12. First session of Phase 7 (API Client
  Rewrite) — `lib/api/index.ts` finally touched after being on `EXECUTOR-PROTOCOL.md` §5's
  standing do-not-touch list for the entire migration.
  **PD1 (the decision model, `DECISION-LOG.md`) went into effect this session for the first
  time** — the order arrived with a `Decisions taken` section (Advisor picked Option (b) —
  `@nestjs/swagger` spec emission + generated typed clients — over hand-authoring 107 service
  routes or a monolith-only client) instead of an open question. CONFIRM found the order and 3
  other governance docs (`EXECUTOR-PROTOCOL.md`, `00-SKELETON-AND-RULES.md`, `DECISION-LOG.md`)
  all modified-but-uncommitted — the by-now-familiar `LESSONS-LEARNED.md` L11 pattern, but this
  time as one large, internally consistent batch (the PD1 entry cites real, independently-
  checkable incidents — F52's missing table, F48/F49's dLocal bugs, gap-matrix row A2-12's false
  `BUILT` claim) rather than a lone status flip. Reported in full before proceeding; Davin
  explicitly confirmed the PD1 batch and this order's `APPROVED` status as authentic before
  execution began — recorded as `DECISION-LOG.md`'s own PD1 entry note, not silently trusted.
  **Independently re-verified every claim before executing, not just the ones in the order's own
  checklist:** re-derived all 7 headline counts in `OPENAPI-DRIFT-REPORT-pre-phase-7.md` from live
  code (112 unique spec paths / 129 monolith route files / 42 undocumented / 27 spec'd-but-absent
  / 62 operation-service operations / 45 money-service operations / 107 total) — all correct in
  aggregate, but found 4 real errors in the report's own internal breakdown (§2a's "18 token-_
  routes" header vs. a real count of 15 — 14 route files + `[...nextauth]`; §2d's header says "3"
  but lists 5; 3 wrong rows in the operation-service per-controller table that net-wash to the
  right 62 total; `/api/webhooks/riseworks` undocumented but never once mentioned in the report's
  own §2 breakdown despite being needed to make "42" add up) — see this order's own Deviation 0.
  Re-verified all 4 historical `lib/api/` mismatches (alerts PUT-vs-PATCH, notification read
  path, preferences PATCH-vs-PUT, market-data phantom path) against BOTH the live operation-
  service controllers AND the real monolith `route.ts` handlers `lib/api/index.ts` actually calls
  — all 4 still live and broken today, zero drift.
  **Built all 5 Ordered Steps, one commit each, plus a housekeeping commit for the PD1 batch:**
  Step 0 (housekeeping, not an Ordered Step) — committed `EXECUTOR-PROTOCOL.md`/`00-SKELETON-
AND-RULES.md`'s own PD1 edits, which had been sitting uncommitted since 2026-08-11. Step 1 —
  fixed the 4 genuinely-wrong monolith spec paths (`/api/auth/register` removed; both `/api/
  admin/disbursement/batches_`paths lost the`admin`segment AND gained the real`batchId`param
  name, not just a segment removal;`/api/wise/recipients/{id}`replaced with the real`POST
  .../revalidate`operation since the GET/DELETE it previously described were never built, not
  just renamed;`part-08`'s `/dashboard/watchlist`removed + a category-error notice added).
  Step 2 —`@nestjs/swagger@^11.4.6`added to both services;`scripts/generate-openapi-spec.ts`  boots the real`AppModule`DI graph and lets`SwaggerModule`introspect the live controllers —
  emits 47 unique paths/62 operations (operation-service) and 43 paths/45 operations (money-
  service, correctly under`/v1`except`/health`/`/health-auth`, replicating `main.ts`'s own
  `setGlobalPrefix()`call before`createDocument()`). **Request/response body schemas are
  deliberately generic (`type: object`), not fabricated** — both services validate via Zod
  through a custom `ZodValidationPipe`, not class-validator DTOs, so `@nestjs/swagger`has no
  decorator metadata to read for bodies; documented explicitly in both scripts' own headers and
  each spec's`info.description`, with a concrete follow-up plan (Zod-to-OpenAPI conversion, or
  targeted `@ApiBody()`on high-value routes) left for a future session rather than attempted here
  (100+ routes' worth of schema work is disproportionate to a MEDIUM-dial session). Found and
  worked around a real, pre-existing, unrelated bug while testing: money-service's
 `WiseWebhookProcessor.onModuleDestroy()`throws if`app.close()`runs before its BullMQ Worker
  finishes async-initializing — both generator scripts skip`app.close()`entirely (a one-shot
  script has nothing to gracefully drain) rather than touch that already-tested production file.
  Step 3 —`openapi-typescript`/`openapi-fetch` added to the monolith root via **pnpm**, not npm
  (`npm install`fails outright —`@trading-alerts/types`is referenced with a`workspace:_`   specifier the plain npm CLI can't parse, per F9's pnpm-workspace setup from Session 4B-1);
  `lib/api/generated/{operation-api,money-api}/{schema.ts,client.ts}`—`createOperationApi(token)`/
  `createMoneyApi(token)`wrap`openapi-fetch`'s real, path/method/param-typed client (typed
  against the Step-2-emitted specs, so a typo'd path or wrong method fails `tsc`, not just at
  runtime) for the network mechanics, with `unwrapOperationApi()`/`unwrapMoneyApi()`converting
  openapi-fetch's`{data,error,response}`result into the EXISTING`OperationServiceError`/
  `MoneyServiceError`throw-on-non-2xx convention every other caller of`lib/operation-service/
  client.ts`/`lib/money-service/client.ts` already expects — deliberately chosen over hand-writing
  ~107 named client methods (would itself become a second hand-maintained, driftable surface,
  directly contradicting Decision 1's own rationale) or a from-scratch fetch wrapper (`openapi-
  fetch`already solves path-param substitution and method-keyed typing correctly). Added
 `generate:api-client`to the root`package.json`, chaining both services' `openapi:generate`  with the two`openapi-typescript`invocations — verified idempotent (ran twice, identical 47/43
  path output both times). Step 4 —`lib/api/index.ts`rewritten: exports`operationApi`/
  `moneyApi`+`getOperationServiceToken`/`getMoneyServiceToken`; its own header now states
  explicitly that the WHOLE FILE is server-only (`LESSONS-LEARNED.md`L6 — re-exporting
  operationApi/moneyApi transitively pulls in`next/headers`via the error classes' home modules),
  verified safe today via a zero-current-importers grep across`app/`/`components/`/`hooks/`  before making the change (this file's only-ever real consumer,`app/test-api/page.tsx`, was
  deleted at Session 6-12). `stackA`/`stackB`kept exactly as-is and marked`@deprecated` rather
  than fixed or removed (Session 7-2/7-3's scope, per this order's own Retire section) — their
  previously module-private type interfaces are now exported (harmless, nothing imported them
  before). \*\*The token-_ bridge audit (Decision 3) resolved differently than its own literal
  framing implied**: `operationApi` wraps operation-service's OWN routes directly (e.g. `/auth/
2fa/setup`), which have no naming relationship to the monolith's separate `app/api/auth/token-*`
  bridge route FILES (Next.js handlers, never seen by `@nestjs/swagger`, never candidates for
  `operationApi`'s surface to begin with) — so there was nothing to literally "exclude" for this
  reason, the exclusion was already structurally true. Re-confirmed the 6 `token-2fa-*` monolith
  files are still dead (Session 4B-22's own finding, re-verified via a fresh zero-consumer grep)
  and documented this directly in `lib/api/index.ts`'s own header for a future retirement session
  — not deleted here. Step 5 — `__tests__/lib/api/generated-clients.test.ts`, 12 contract-style
  tests (root-prefix + path-param substitution, `/v1` prefix + the `health`/`health-auth`
  exclusion, Bearer-header attach/omit, `unwrap*` returning data on 2xx and throwing a REAL
  `OperationServiceError`/`MoneyServiceError` — not a mock double — with the right `.status`/
  `.body` on non-2xx including a 500, not just 4xx) — mocks `global.fetch` and asserts on the
  real `Request` object `openapi-fetch` constructs, exercising the actual generated client code
  (URL/path-param substitution, header merging, this session's own error mapping), not a vacuous
  mock; no live service process in this test run, matching this repo's own established `lib/api/`
  test convention and the order's own "contract-style unit tests" framing for Step 5.
  **Full verification:** `tsc --noEmit` clean throughout, re-checked after every step; `eslint app
components lib hooks --max-warnings 0` — same 4 pre-existing warnings, 0 introduced; monolith
  `test:ci` **154/154 suites, 2356/2356 tests** (was 153/153, 2344/2344 — +1 suite/+12 tests,
  exactly this session's own new file, zero regressions elsewhere); `operation-service` 42/42
  suites, 393/393 tests unchanged; `money-service` 62/62 suites, 522/522 tests on a clean run —
  first full run showed 1 flaky failure (`prisma.shutdown.spec.ts`, a SIGTERM-timing test already
  flagged sensitive to parallel-test load by `LESSONS-LEARNED.md` L25), independently confirmed
  unrelated to this session by passing in isolation and on two subsequent full-suite retries;
  money-service's own source was never touched this session (only `package.json` + a new
  `scripts/` file, nowhere near the Prisma shutdown code path).
  **No flag flipped, no cutover-table row** — pure client-SDK/tooling work, zero consumer
  rewiring (explicitly deferred to Session 7-2 per this order's own Rules), zero traffic-routing
  flag exists to touch; `migration-cutover-table.md` unchanged. The order's own header line
  "Flags touched: `MIGRATE_API_CLIENT`" was corrected before execution — that name is never
  referenced anywhere in code or docs, this session builds no traffic-routing flag at all.
  **Found, not fixed (out of scope):** a stale, contradictory CORS comment in `money-service/
src/main.ts` claiming the browser calls money-service directly via a `NEXT_PUBLIC_MONEY_API_URL`
  that doesn't exist anywhere else in the repo — leftover pre-F45 design documentation, directly
  contradicted by this session's own re-verification that `lib/money-service/client.ts` is
  genuinely server-only with zero client-side importers. Flagged in Waiting-on for whichever
  session next touches that file.
  **Artifacts updated:\*_ `7-1-api-client-reverify-and-generate.migration-order.md` (Status →
  CONFIRMED, executed; entry criteria all checked with CONFIRM-time findings recorded; Done-when
  all checked; Deviations filled in full — 9 entries), `DECISION-LOG.md` (PD1's own note on this
  session's confirmation), this file (Current/Previous rotation, Waiting-on, flag notes). New
  `7-2-api-client-migrate-consumers.migration-order.md` PRE-DRAFTed (migrate Phase 6 per-domain
  fetch wrappers onto `operationApi`/`moneyApi`; delete the already-empty leftover `app/api/auth/
register/` directory; audit which of the 6 dead `token-2fa-_` monolith files are safe to retire).
- **Previous:** Session 6-12 (A11y + Responsive Audit / Phase 6 Exit Review, UI-BUILD variant,
  dial MEDIUM), CONFIRMED, executed, CLOSED SUCCESSFUL 2026-08-11, same day as Session 6-11.
  **Phase 6 (Frontend Redesign) is now CLOSED — F11 RESOLVED, all 59 gap-matrix rows triaged.**
  **CONFIRM found the by-now-familiar `LESSONS-LEARNED.md` L11 pattern again, this time carrying
  a substantive false claim, not just header metadata:** the order arrived
  modified-but-uncommitted, `PRE-DRAFT → APPROVED`, asserting F11 already "RESOLVED... all 90
  gap matrix rows triaged" — but at first read, `phase-6-frontend-gap-matrix.md` itself (the one
  artifact that could prove or disprove that claim) had **zero** uncommitted changes: every one
  of its 59 rows still showed an unfilled `—` Triage value, and its own footer read "F11 stays
  OPEN — Triage column awaits Davin." A second, independent error compounded it: the order's own
  "90 rows" citation was itself wrong — the real, re-verified, deduplicated matrix has **59**
  rows (18 A1 + 12 A2 + 5 B1 + 20 B2 + 4 C, grep-counted); 90 is `ui-page-gap-register.xlsx`'s
  raw pre-dedup source count, a distinct artifact. Reported both findings in full before
  proceeding; Davin confirmed live the `APPROVED` rewrite was his own authentic authorization and
  that he had completed the row-by-row triage — moments later the gap matrix itself picked up
  real, substantive changes (a genuine `BUILT`/`VERIFIED`/`OUT_OF_SCOPE` value on every one of
  the 59 rows, footer updated to "F11 RESOLVED"), independently re-verified before treating the
  claim as settled rather than taken on trust. A third, smaller citation error (the order's own
  baseline test-count citation, "146/146 suites, 2291/2291 tests," was Session 6-10's number, not
  6-11's real close-out figure of 148/148, 2312/2312) was also found and corrected — a fresh
  `test:ci` run at CONFIRM confirmed 148/148, 2312/2312 was the accurate, zero-drift baseline.
  **Reconciled all three findings across the order file, `DECISION-LOG.md`'s F11 entries, and the
  gap matrix's own header/footer text** before proceeding, so no future reader hits the same
  "90 vs 59" confusion.
  **Built (5 Ordered Steps, one commit each):** Step 1 — the triage reconciliation above (docs
  only, no code). Step 2 — deleted `app/test-api/page.tsx` (confirmed zero references anywhere
  in `app/`, `components/`, `__tests__/` before removing it; `tsc --noEmit` clean after). Step 3
  — a real, evidence-based accessibility audit, **18 fixes across 13 files**: this codebase's
  baseline was already solid (Radix primitives handle dialog focus-trapping; most icon buttons
  already carried `aria-label`) — the audit found and fixed one genuinely **recurring** pattern
  (8 password/secret-visibility toggle buttons across 6 forms — login, register ×2,
  reset-password, forgot-password ×2, account-settings ×3, the 2FA secret toggle — were
  icon-only with no accessible name; one of them, `login-form.tsx`, also carried `tabIndex={-1}`,
  removing it from the keyboard tab order entirely, fixed by removing the override rather than
  just adding a label) plus several one-off gaps (an icon-only profile-photo-upload overlay
  button invisible on keyboard focus — `opacity-0 group-hover:opacity-100` with no
  focus-visible affordance; the notification-delete button; the global toast-dismiss button,
  which appears on every page; the 2FA secret copy button; 3 filter/search inputs relying on
  placeholder text alone as their only label). Step 4 — a real responsive-layout audit, **8
  fixes across 6 files**: 2 tables (`admin/affiliates` list, billing `invoice-list`) wrapped
  their `<table>` in `overflow-hidden` with no horizontal-scroll fallback — content wider than
  the viewport was clipped rather than scrollable, fixed to `overflow-x-auto` matching the
  convention already used correctly by the other 23 table-containing files in this codebase; 6
  stat-card/quick-link/filter grids (`admin/affiliates` quick-links + filters, and all 4 admin
  affiliate-report pages' summary-card grids) used a bare `grid-cols-3/4/5` with no responsive
  breakpoint downgrade — on a 320-480px viewport these crammed 3-5 columns of large-number stat
  cards or full-width form fields into slivers, fixed with a `grid-cols-1/2` mobile default and
  `sm:`/`lg:` breakpoints restoring the original column count from tablet up. Checked and
  deliberately left as-is (already correctly responsive, confirmed by reading each): fixed-width
  Select/Input elements inside `flex-wrap` or `flex-col sm:flex-row` containers (alerts filter
  row, `affiliate-filters`, the referral-link input) — these wrap or stack correctly, no
  overflow; a `min-w-[600px]` chart SVG (`pnl-trend-chart`) already had its own
  `overflow-x-auto` wrapper. Step 5 — new `__tests__/pages/phase-6-exit.test.tsx` (8 tests): the
  **first-ever direct test coverage** for `app/not-found.tsx`, `app/error.tsx`, and
  `app/global-error.tsx` (all built Session 6-2, never directly tested before — existing
  "not-found" test hits are dynamic-route `notFound()` calls, not these root-level boundary
  pages themselves), plus a route-integrity check (`app/test-api/page.tsx` genuinely gone from
  disk) and `ToastContainer`'s a11y fix (dismiss button now has an accessible name). Added 2
  more regression tests directly into the existing `login-form.test.tsx`/`register-form.test.tsx`
  harnesses (where the render setup already existed) covering this session's own password-toggle
  fixes, rather than duplicating that setup in the new file.
  **Full verification:** `tsc --noEmit` clean throughout, re-checked after every step; `eslint
app components lib hooks --max-warnings 0` — same 4 pre-existing warnings (all pre-existing
  routing-method lint, unrelated to a11y — `no-location-assign-relative-destination` ×3,
  `no-html-link-for-pages` ×1), 0 introduced; `test:ci` **149/149 suites, 2322/2322 tests** (was
  148/148, 2312/2312 — +1 suite/+10 tests, exactly this session's own new coverage — 8 in the new
  file + 1 each in `login-form.test.tsx`/`register-form.test.tsx` — zero regressions elsewhere).
  Live browser click-through not attempted this session — same standing gap as every Phase 6
  session since 6-1b (Waiting-on #117).
  **No flag beyond F11, no cutover-table row** — pure frontend audit/fix work, zero backend
  service changes, zero microservice feature flags touched; `migration-cutover-table.md`
  unchanged.
  **Artifacts updated:** `6-12-a11y-responsive-phase-exit.migration-order.md` (Status →
  CONFIRMED, executed, CLOSED SUCCESSFUL; Entry criteria all checked with the CONFIRM-time
  findings recorded; Done-when all checked; Deviations filled in full — 3 entries covering the
  L11 recurrence, the row-count reconciliation, and the baseline-citation fix),
  `DECISION-LOG.md` (F11 → RESOLVED, register row + full entry corrected to the real 59-row
  count), `phase-6-frontend-gap-matrix.md` (Triage column filled for all 59 rows by Davin; header
  note and "How to read" section updated to match; new Correction #7 documenting the 90-vs-59
  reconciliation), this file (session-history hygiene: Session 6-11's own full text demoted to
  Previous below; Session 6-10's own full text marked superseded-by-above, still needs its own
  move to `history/sessions-archive.md` — the larger pre-existing backlog flagged at Waiting-on
  #102/#129 is unchanged, still needs its own dedicated cleanup session). No new
  `LESSONS-LEARNED.md` entry — the L11 recurrence and the citation-drift findings are both
  already-documented pattern classes (L11, L27), not new failure classes; the file's own
  consolidation backlog (Waiting-on #30) is unchanged. **Phase 6 is CLOSED. Phase 7 (API Client
  Rewrite) opens next — `7-1-api-client-reverify-and-generate.migration-order.md` PRE-DRAFTed**
  (CONTRACT/PORT hybrid, per the session playbook's own Session 7-1 "Re-verify + generate"
  entry) — deliberately leaves Ordered Steps open pending a real re-verification pass against
  live NestJS routes, same discipline the last several Phase 6 PRE-DRAFTs adopted after
  pre-guessed step text repeatedly drifted from ground truth by CONFIRM.
- **Ad-hoc repair (2026-08-11, phase/session unchanged — Phase 6 stays CLOSED, Phase 7 has NOT
  opened):** run per `EXECUTOR-PROTOCOL.md` §6 (no Advisor DRAFT), same OPEN/CONFIRM/CLOSE rituals
  as any session. An independent post-6-12 re-audit of the live working tree found Phase 6's own
  exit claim — "all 59 gap-matrix rows triaged as BUILT/VERIFIED/OUT_OF_SCOPE" — did not hold for
  one row. **CONFIRM independently re-verified all 7 findings against live code before touching
  anything** (full detail in `phase-6-frontend-gap-matrix.md`'s own "Corrections found in ad-hoc
  verification" section): gap-matrix row **A2-12** (`/settings/security/activity`) was triaged
  `BUILT (Session 6-5)` though no such page, route, or `SecurityAlert` UI surface existed anywhere
  in the tree, and Session 6-5's own order never scoped it (its only touch on the security surface
  was a 2FA dummy-widget-to-link swap, Deviation 2b); row **A1-9** (`/settings/security`, A2-12's
  own cited evidence) was also wrongly `BUILT` — genuinely `PARTIAL`, since login-history's
  `?limit=20` cap and `SecurityAlert`'s zero-UI-consumer gap were both still exactly as originally
  documented. Corrected the record first (own commit, before any code): both rows' Triage cells,
  a new header correction note, and `DECISION-LOG.md`'s F11 entry (appended, F11 **not** reopened
  — the triage process was sound, this was one wrong verdict).
  **Then, per Davin's explicit two decisions:** **Decision A (build it, not re-triage
  `OUT_OF_SCOPE`)** — both rows built for real: new `app/(dashboard)/settings/security/
activity/page.tsx`; `GET /user/security-alerts` + `POST /user/security-alerts/:id/read` on
  `operation-service`'s `UsersController` (ownership-scoped `updateMany`, matches the existing
  `revokeSession` no-id-enumeration convention); the mirrored `SecurityAlert` model widened
  additively first (`deviceInfo`/`read`/`readAt` — `prisma generate` only, per
  `LESSONS-LEARNED.md` L1, confirmed as a real gap before fixing it, not assumed); matching
  monolith routes at `app/api/user/security-alerts{,/[id]/read}/route.ts`, flag-gated behind the
  existing `MIGRATE_USER_SESSIONS` flag (default off everywhere — zero traffic cut over; the
  `operation-service` deploy needed to make the flag meaningful was explicitly **not** attempted,
  an `EXECUTOR-PROTOCOL.md` §7 escalation correctly left for Davin); both `docs/open-api-documents/
part-13-settings-openapi.yaml` and `part-22-user-account-openapi.yaml` updated (Phase 7 generates
  its unified client from these specs — an endpoint absent from them would not exist in the
  generated client); login-history's own real gap fixed too — the backend
  (`app/api/user/login-history/route.ts`) had always supported `limit`/`offset` pagination, the
  page just never exposed it, fixed with a "Load more" control; a real, separate bug caught while
  wiring it (`onClick={fetchLoginHistory}` would have silently passed the click event object as
  the new `offset` parameter on every Refresh click — fixed to `onClick={() =>
fetchLoginHistory()}`). 30 new tests (8 `operation-service`, 22 monolith across 4 new test files).
  **Decision B (keep, don't retire)** — two endpoints orphaned as a side effect of otherwise-
  correct Phase 6 builds (`GET /api/affiliate/profile/payment`, `GET /api/disbursement/reports/
affiliate/[affiliateId]` + `.../commissions`) recorded `KEEP — retire in Phase 8's deletion sweep`
  rather than silently left for a future session to rediscover; `validate-code`/`exchange-rate`
  reconfirmed unchanged, no new decision needed (still deliberately orphaned per Session 6-8).
  **Full verification:** `tsc --noEmit` clean throughout (re-checked after every step);
  `eslint app components lib hooks --max-warnings 0` — same 4 pre-existing warnings tracked since
  Session 6-12, 0 introduced; `test:ci` **153/153 suites, 2344/2344 tests** (was 149/149,
  2322/2322 — +4 suites/+22 tests, exactly this session's own new files, zero regressions
  elsewhere); `operation-service` 42/42 suites, 393/393 tests, `tsc --noEmit` clean. Live-verified
  via the dev server: unauthenticated `/settings/security/activity` correctly redirects to
  `/login?callbackUrl=%2Fsettings%2Fsecurity%2Factivity` (proves the route compiles and the
  `(dashboard)` layout's auth gate covers it) — deeper authenticated click-through blocked by the
  same standing no-test-credentials gap as every Phase 6 session since 6-1b (Waiting-on #117); a
  pre-existing, unrelated dev-environment issue (`/api/auth/session`/`/api/auth/providers` 404s in
  this local Turbopack dev server) was found and disclosed, not chased — outside this session's
  own files entirely.
  **Lesson harvested:** a gap-matrix row's triage verdict must cite the commit or file that
  actually closed it — "BUILT (Session N)" is not evidence unless session N's own order genuinely
  scoped and shipped that work; A2-12 passed a full phase-exit review carrying a verdict that
  named a session which never touched it. See `LESSONS-LEARNED.md` for the numbered entry (added
  or consolidated per that file's own hygiene cap).
  **Artifacts updated:** `phase-6-frontend-gap-matrix.md` (A1-9/A2-12 Triage cells, header
  correction note, new "Corrections found in ad-hoc verification" section, footer),
  `DECISION-LOG.md` (F11 entry appended twice — the correction, then the repair + Decision B),
  this file (this entry + Waiting-on #130/#131), `LESSONS-LEARNED.md` (new entry per above). No
  `migration-cutover-table.md`/`migration-stack-analysis.md` change — no flag flipped, and this
  session's own new files are recorded in `DECISION-LOG.md`/this entry directly rather than
  duplicated into the stack-analysis file for a non-domain-slice ad-hoc repair. **No next session
  PRE-DRAFTed** — `7-1-api-client-reverify-and-generate.migration-order.md` already exists from
  Session 6-12's own close and is unaffected by this repair; it remains the literal next session.
- **Ad-hoc feature session (2026-08-19, phase/session unchanged — Phase 7 stays open on
  `7-1-api-client-reverify-and-generate.migration-order.md` as the next numbered session):** run
  per `EXECUTOR-PROTOCOL.md` §6 (no Advisor DRAFT — Davin scoped this directly in chat from
  `davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/
language_timezone_regional_format_spec.md`'s §6 server-side tasks, a hand-off doc unrelated to
  the microservices migration numbering). **CONFIRM found the hand-off doc's central assumption
  — that `UserPreference`/`/api/user/preferences` don't exist yet — was false against live code**:
  a generic-JSON `UserPreferences` model (note the plural — unrelated to the spec's proposed
  singular `UserPreference`) and a fully working, auth-gated `GET/PUT /api/user/preferences`
  already exist, already store `language`/`timezone`/`dateFormat`/`timeFormat`/`currency`, and
  are already mirrored into `operation-service`'s `UsersController` behind the (default-off)
  `MIGRATE_USER_PROFILE` flag. Per this repo's own live-code-wins doctrine, did NOT create a
  competing model/route (would have collided at the identical `/api/user/preferences` path and
  reintroduced exactly the kind of duplicate driftable surface Session 7-1 rejected for the API
  client) — extended the existing JSON-blob shape instead, requiring zero Prisma migrations on
  either side (sidesteps L1/L6 entirely). **Built:** `countryCode` (12-value enum, `SUPPORTED_COUNTRY_CODES`)
  added to `lib/preferences/defaults.ts`'s `UserPreferences` interface/`DEFAULT_PREFERENCES`
  (default `'US'`, matching the existing `en-US`/`USD` default — deliberately NOT the spec
  snippet's `GB`/`en-GB`/`GBP`, which would have silently changed the default currency shown to
  every zero-preference existing user); mirrored verbatim into `operation-service/src/users/
users.schemas.ts`. New `lib/preferences/geo-locale.ts` — a server-only `cf-ipcountry`/
  `x-vercel-ip-country` → locale-bundle resolver (real ISO alpha-2 codes, with 20 Eurozone
  member codes mapped to the seed-code `country-config.ts`'s synthetic `eu` bundle, since no
  GeoIP header ever literally sends `EU`) — wired into `GET /api/user/preferences`: resolves
  from the header ONLY when the user has no stored preferences row yet (explicit stored prefs,
  even partial, always win — matches seed-code's `resolvePreferences()` precedence). **Found,
  not fixed:** `operation-service`'s mirror path cannot replicate the GeoIP resolution as-is —
  `forwardRequestToOperationService()` only forwards `x-correlation-id`/`user-agent`/
  `x-forwarded-for` (`forwardedRequestContext()`), dropping `cf-ipcountry`/`x-vercel-ip-country`
  before they'd ever reach that process; moot today since `MIGRATE_USER_PROFILE` defaults off
  everywhere, documented as a comment on `UsersController` for whoever flips that flag next.
  **§6.C (AI system-prompt language injection) skipped, not deferred-silently**: grepped `app/
api` for any chat/LLM route — none exists, matching the spec's own §3.4 admission ("NOT YET
  BUILT ANYWHERE"); nothing to inject a language directive into yet. **§6.D (payment currency
  wiring) deliberately NOT touched**: `app/api/payments/dlocal/create/route.ts` already reads
  `currency` from an explicit, Zod-validated request body and converts via a real rate service
  (`lib/dlocal/currency-converter.service.ts`), never `country-config.ts`'s mock table — the
  actual risk §6.D warned about is already absent. Stripe (`lib/stripe/stripe.ts`) has a single
  hardcoded `STRIPE_PRO_PRICE_ID` (USD only) and zero multi-currency infrastructure — wiring
  `userPreference.currency` in for real would mean creating new per-currency Stripe Price
  objects, a product-catalog decision outside a code session. Per this repo's own rule 5/§7
  (money-code changes escalate), left both payment routes untouched rather than guess; currency
  is already exposed via the now-`countryCode`-complete `GET /api/user/preferences` response for
  a future checkout-UI session to read.
  **Full verification:** `tsc --noEmit` clean on both the monolith and `operation-service` (one
  PRE-EXISTING, unrelated `operation-service` error confirmed via `git stash`/clean-tree retest —
  `auth.service.ts(252,261)`, `PrismaService.affiliateProfile` — not touched this session, not
  introduced by it); monolith `eslint` on all 4 changed files clean, 0 warnings; monolith
  `test:ci` **157/157 suites, 2379/2379 tests** (8 new/updated cases in `__tests__/api/
user.test.ts` covering GeoIP resolution from both headers, unsupported-country fallback,
  stored-preference-wins-over-geo, and `countryCode` PUT accept/reject — zero regressions
  elsewhere); `operation-service` `src/users` suite 63/63 unchanged (schema widened, behavior
  untouched, no new test needed there — GeoIP path is the documented gap above). **Found, not
  investigated (unrelated to this session's own files):** working tree carried two unstaged
  deletions (`docs/MOBILE_UI_SPECIFICATION.md`,
  `docs/prompt-to-antigravity-to-executing-MOBILE_UI_SPECIFICATION_MD.md`) and an untracked
  `seed-code/lovable-mobile-app/docs/` not present in this session's own opening git snapshot;
  confirmed via `git stash`/pop that this session's own tooling didn't cause them (they survived
  a stash/pop round-trip untouched) — left as-is, not staged, not reverted; flagged to Davin for
  whichever session owns the docs reorg those belong to.
  **No flag touched, no cutover-table row** — this is a hand-off feature build, not a migration
  slice; `migration-cutover-table.md`/`migration-stack-analysis.md` unchanged. **No next session
  PRE-DRAFTed** — same reasoning as the entry above; `7-1-api-client-reverify-and-generate.
migration-order.md` remains the literal next numbered session, unaffected by this ad-hoc detour.
- **Ad-hoc feature session (2026-08-20, phase/session unchanged — Phase 7 stays open, next
  numbered session is `7-2-api-client-migrate-consumers.migration-order.md`):** run per
  `EXECUTOR-PROTOCOL.md` §6 (no Advisor DRAFT — Davin asked directly in chat, pointing at 4
  screenshots of 2 pages — `admin/resources` and `affiliate/resources` — in the read-only UI
  prototype at `seed-code/trading-conversational-ai-ui-pages-increment/` and asking for the real
  backend business logic behind them). **Read the actual source of both mock pages before writing
  any backend code** (`app/admin/resources/page.tsx`, `app/affiliate/resources/page.tsx` in that
  prototype tree) rather than working from the screenshots alone — confirmed both are pure
  client-side mocks with hardcoded arrays, zero API calls. **CONFIRM found this is fully
  greenfield**: no `MarketingAsset`-shaped Prisma model, no file-storage SDK/abstraction anywhere
  in the repo (`package.json` — zero hits for S3/Cloudinary/Blob/multer/formidable), and the
  live monolith's own `app/affiliate/dashboard/resources/page.tsx` (Session 6-7/B2-20) already
  carries an honest doc-comment stating brand assets "aren't published yet... no public/ brand
  asset files exist in this repo (checked)" — independently re-verified true (`public/` held only
  `manifest.json`). Existing, reusable plumbing: `AffiliateCode.discountPercent` (real, per-code)
  and the established `GET /api/affiliate/dashboard/codes` auth/response pattern.
  **Two decisions escalated to Davin directly in chat, both confirmed before writing code:**
  (1) file storage for admin-uploaded assets — offered Vercel Blob / Cloudinary / URL-only-defer;
  Davin chose **Vercel Blob** (matches this app's existing Vercel deployment, zero new account,
  `@vercel/blob` added at the pnpm workspace root per `LESSONS-LEARNED.md` L28); (2) whether to
  run `prisma db push` against the live `DATABASE_URL` (a non-localhost, Railway-hosted DB, no
  versioned migrations folder in this repo — `db push` is its own established schema-sync
  convention) — Davin said yes, run it now.
  **Built:** new additive-only `MarketingAsset` model + `MarketingAssetCategory`/
  `MarketingAssetStatus` enums (`prisma/non-market-data/schema.prisma`) — `fileUrl`/`fileSize` for
  4 real-file categories, `copyText` for `SWIPE_COPY`, no FK/relation changes to any existing
  model. `lib/marketing-resources/{validators,service,storage}.ts` — Zod schemas; Prisma-backed
  `listAssetsForAdmin`/`createAsset`/`deleteAsset`/`listPublishedAssets`/`recordAssetEngagement`
  shared by both surfaces; a thin `@vercel/blob` `put()`/`del()` wrapper, scoped to only ever
  delete blobs under its own `marketing-resources/` prefix (seeded `/public` paths are never
  touched). Admin: `GET/POST /api/admin/resources` (list+stats / multipart-upload create),
  `DELETE /api/admin/resources/[id]`. Affiliate: `GET /api/affiliate/dashboard/resources` (own
  active codes + all published assets), `GET .../[id]/download` (atomic engagement-count
  increment + redirect to the real file), `POST .../[id]/copy` (same counter, returns
  server-authoritative `copyText` for `SWIPE_COPY`) — both routes double as the "Partner
  Downloads" figure the admin stat card reports. Copied the 3 real brand-asset files
  (`davintrade-ai-icon.png`, `DavinTrade_Logo.jpg`, `icon.svg` → renamed `marketing-icon.svg` to
  avoid any future collision with Next's `app/icon.svg` convention) from the prototype's own
  `public/` into this repo's; seeded all 4 assets (3 file-backed + 1 `SWIPE_COPY`) both into
  `prisma/seed.ts` (idempotent, stable seed IDs, for future fresh databases) and, this session,
  directly into the live DB via a standalone one-off script — deliberately NOT via
  `npm run db:seed`, since that script's `prisma.alert.create` calls are non-idempotent and would
  have duplicated the 2 demo alerts on every rerun; script deleted after use. `next.config.js`:
  added the Blob storage hostname to both `images.remotePatterns` and the CSP `img-src` (would
  otherwise 404/CSP-block real asset previews once admin uploads start landing on Blob URLs).
  Wired the existing live `app/affiliate/dashboard/resources/page.tsx` to the new endpoint,
  replacing its honest "not published yet" stub with a real assets grid + a new Copywriting
  Swipes section (same minimal Tailwind the file already used — the prototype's own fuller
  redesign is future frontend-migration scope, not this session's).
  **Found and fixed one real bug via live verification, not by the unit tests**: the download
  route's `NextResponse.redirect(asset.fileUrl)` threw `TypeError: Invalid URL` for every
  relative `/public`-style `fileUrl` (3 of the 4 seeded assets) — Next's redirect helper requires
  an absolute URL, and the fully-mocked unit test suite was 100% green throughout because its
  mock echoed any string back uncritically. Fixed with `new URL(asset.fileUrl, request.url)`;
  added a dedicated regression test for the relative-input case; see `LESSONS-LEARNED.md` **L30**
  for the generalized rule. A second, unrelated jsdom-only quirk (`FormData.set()` silently
  stringifies real `File` objects in this repo's jsdom test environment — never a problem in the
  real Next.js runtime the route actually runs in) was hit and worked around in the admin POST
  test file with a documented `FakeFormData` stand-in; not promoted to its own lesson entry
  (resolved within-session, low future-recurrence risk, already commented in the one test file it
  affects).
  **Full verification:** `tsc --noEmit` clean; `eslint app components lib hooks --max-warnings 0`
  — same 5 pre-existing warnings (routing-method lint, unrelated to this session, none in any file
  this session touched), 0 introduced; `prettier --check` clean on every changed file;
  `test:ci` **163/163 suites, 2416/2416 tests** (was 157/157, 2379/2379 per the last recorded
  baseline — +6 suites/+37 tests: 6 new test files for the routes/service above, zero
  regressions elsewhere). **Live-verified end-to-end against the real dev server and the real
  (Railway) database, not just mocks** — logged in as the seeded `affiliate-test@trading-alerts.
test` user: the wired affiliate page correctly rendered real codes (`TESTCODE20`/`TESTCODE10`
  with live `discountPercent`) and all 4 seeded assets; clicked the real "Copy Text" button and
  confirmed the POST endpoint fired and returned an incremented `downloadCount`; hit the download
  redirect both before and after the URL fix (500 → 307 → real 200 on the destination file),
  confirming the atomic counter incremented on both attempts. Logged in as `admin-test@trading-
alerts.test` and exercised the full admin CRUD lifecycle live via `fetch()` (no admin UI page
  exists yet — building one is frontend-migration scope, not this backend session): list (`total:
4, totalDownloads` aggregate correct), create a `SWIPE_COPY` asset (real 201, real row), delete it
  (real 200, list count back to 4). The real Vercel Blob file-upload path itself was NOT
  live-exercised (`BLOB_READ_WRITE_TOKEN` isn't provisioned in this session's environment) — its
  code path is covered by mocked unit tests only. **Waiting on Davin:** provision a Blob store
  for this project (Vercel dashboard → Storage tab) and set `BLOB_READ_WRITE_TOKEN` (see
  `.env.example`'s new entry) — the real upload path can't be exercised end-to-end until then.
  **Same-conversation follow-up (still 2026-08-20):** Davin asked 3 questions after this
  session's own close-out — where the "left for you" items were tracked, whether MP4 could be
  uploaded, and for frontend/backend recommendations. Answering the MP4 question surfaced a real
  gap disclosed but not yet fixed: `POST /api/admin/resources` validated file **size** only, no
  MIME-type allowlist — so the upload form's own stated "Supports PNG, JPG, SVG, MP4, PDF" was
  unenforced and literally any file type would have been accepted and stored. Davin asked for the
  fix. Added `ACCEPTED_ASSET_MIME_TYPES`/`isAcceptedAssetMimeType()` to
  `lib/marketing-resources/validators.ts` (exactly the 5 types the UI already advertises) and a
  400-rejection check in the route between the existing "file present" and "under 50MB" checks.
  4 new tests (2 route-level: reject `text/html`, accept `video/mp4`; 2 in a new
  `validators.test.ts` covering the allowlist function directly, including a
  prototype-pollution-safety check via `hasOwnProperty`). **Live-verified against the real dev
  server**, still logged in as `admin-test@trading-alerts.test`: a `text/html` POST correctly
  400'd with the new message; an MP4 POST correctly passed the new type check and only then hit
  the already-known, already-disclosed `BLOB_READ_WRITE_TOKEN`-missing 500 (confirmed via server
  logs — not a new bug). `tsc`/`eslint`/`prettier` clean; `test:ci` **164/164 suites, 2422/2422
  tests** (was 163/163, 2416/2416 — +1 suite/+6 tests, zero regressions). Deliberately did NOT
  also derive `format`/cross-check it against the real uploaded MIME type (a related idea raised
  in chat) — out of scope for "implement the MIME-type allowlist fix" specifically; left as an
  unscoped idea for a future session if wanted, not silently done.
  **No cutover-table row** — this is a brand-new domain, not a monolith→microservice slice;
  `migration-cutover-table.md` unchanged. `migration-stack-analysis.md` also unchanged, matching
  the 2026-08-19 entry's own precedent for a non-domain-slice ad-hoc build (new files recorded
  here instead). **Deliberately monolith-only, not mirrored into `money-service`** — the existing
  affiliate read-API migration (Slice 3, `MIGRATE_READ_APIS_MONEY_AFFILIATE`) covers pre-existing
  affiliate data (codes/commissions/stats); this is a brand-new domain with no prior money-service
  presence, and mirroring it wasn't asked for — noted here as a real, scoped follow-up for a
  future session rather than attempted speculatively (no admin UI page exists yet either, for the
  same reason: this session's own scope was "backend business logic," per Davin's own framing). **No next session PRE-DRAFTed** — `7-2-api-client-migrate-
consumers.migration-order.md` remains the literal next numbered session, unaffected by this
  ad-hoc detour.

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
   _(2026-08-20: Phase 7 is open — `lib/api/index.ts` was rewritten at Session 7-1 and is no
   longer on the do-not-touch list; `stackA`/`stackB` inside it remain Session 7-3's scope.)_
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

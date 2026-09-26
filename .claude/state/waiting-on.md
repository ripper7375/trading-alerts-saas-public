---
type: Concept/BlockersAndTraps
status: active
severity: high
updated_at: 2026-09-26
tags: [blockers, deploys, migrations, verification, stack-c, stack-d]
related_docs:
  - ../architecture/database-traps.md
  - ./history/resolved-waiting-on.md
  - ./current-state.md
---

# Waiting on — open blockers and unverified items

Read this when your task touches deploys, migrations, the database, auth, the VPS pipeline, or
when you need to know what is still unconfirmed. Items are verbatim from the pre-OKF `CLAUDE.md`
(original line ranges in the comments). When an item is resolved, **move it** (don't delete it)
to [history/resolved-waiting-on.md](./history/resolved-waiting-on.md).

Quick index (newest first):

- Shared FX rates `REDIS_URL` · SystemConfig pricing deploy + test · Language & locale open items ·
  Disbursement payout go-live (G1–G4) · 15th indicator rollout order
- Chart-render: 2 unverified items · Socket-refactor trigger (decided: don't yet)
- **OPEN:** which gateway does the VPS push worker target? (blocks staging cleanup)
- `railway-gateway` Watch Paths unset · Preview deployments hit the production DB
- Push-worker throughput · Look-ahead bias in historical indicator values · Decision Layer BLOCKED
- Many "authenticated click-through not yet confirmed" items (Executor never enters credentials)
- Phase 12 handover re-draft · Journey B chat check · `/help` + `/about` 404 · `rag_dual_memory` tables missing

<!-- CLAUDE.md L4896-L4901 -->

- **Shared FX rates (2026-09-26 round 4): check Vercel's `REDIS_URL`.** The Next app shares the
  rate table with money-service only if its `REDIS_URL` (Vercel) points at money-service's Redis
  (Railway). If unset it silently keeps its own hourly cache. After deploy, confirm the key
  `fx:usd_rates` exists and its `fetchedAt` matches `/api/fx/rates`. Deploy both apps together
  (`creditAffiliateCommission` now requires `interval`).

<!-- CLAUDE.md L4902-L4912 -->

- **SystemConfig pricing (2026-09-26): deploy both apps together, then test a price change.**
  Stripe checkout is proxied to money-service when its flag is on, so deploy money-service and the
  Next app together. Then remove `NEXT_PUBLIC_PRO_PRICE_MONTHLY`/`_YEARLY` from Vercel if set (no
  longer read). On staging: set a different Base Price in `/admin/settings/affiliate`, run a Stripe
  test checkout (expect an inline price on the PRO product) and a dLocal test payment (expect the
  new amount). Repeat for the annual plan (Stripe: yearly interval; dLocal: 365 days) and set the
  Annual PRO Price in admin (default $290 until set). After deploy, open
  `https://davintrade.app/api/fx/rates`: `source` must be `"live"` (otherwise local prices are at
  the fixed fallback rates). Checklist: §7 of
  `davintrade-systemconfig/systemconfig-fix-manifest-work-completion.md`.

<!-- CLAUDE.md L4913-L4923 -->

- **Language & locale (2026-09-25): merge, then the open items.** Branch
  `fix/16-language-localization-reaudit` is pushed, not merged, not deployed. After deploy, do the
  signed-in click-through; the checklist is item 7 of §6 in
  `davintrade-16-language-localization-remediation/16-language-localization-remediation-manifest-work-completion.md`.
  The click-through should include Davin's round-2 case: change language, then open `/admin` without
  refreshing; the sidebar must follow (manifest §7). Round 2 is committed on the same branch;
  **round 3 (manifest §8), the SystemConfig/annual-plan work and the live exchange rates were committed and pushed 2026-09-26.**
  That §6 lists the open items. Tier-2 translation is done for compulsory pages; admin (not required)
  and affiliate (optional) remain. Two need Davin's call: loading saved preferences on a new device
  (auth-adjacent), and GB versus IP country on a first visit.

<!-- CLAUDE.md L4924-L4931 -->

- **⚠ Disbursement payout settings (F83/F84, 2026-09-23): deploy + go-live checks.** Branch
  `feat/disbursement-payout-settings` is unpushed. Deploy money-service first, then the Next app.
  Monthly payouts are live only when **G1** (money-service deployed), **G2** (`CRON_ENABLED=true`
  on Railway), **G3** (not paused; `DISBURSEMENT_ENABLED` not `false` on **both** Vercel and
  Railway) and **G4** (`DISBURSEMENT_PROVIDER=WISE` on **Railway** money-service) all hold. Then
  run the post-deploy checks and search the logs for `[disbursement-settings]`. The checklist is
  in `davintrade-disbursement-payout-settings-stack/disbursement-payout-settings-manifest-work-completion.md` §5.

<!-- CLAUDE.md L4932-L4938 -->

- **⚠ 15th indicator rollout (2026-09-22): migration → gateway → VPS (3 files) → attach.**
  `20260922000000_add_market_data_v6_sr2_levels` is authored, not applied, and nothing is
  committed. Apply it before `railway-gateway` deploys. Ship `sqlite_schema_v6_xauusd.sql` with
  the two `.py` files (the `DEPLOY_TO_CONTABO_VPS_READY/` package predates this change). Attach
  `S-R-AutoCalibration_v2_29.ex5` on A+B before restarting the collector, then give it a window
  that differs from the 14th's. Full steps: blueprint §13 item 10.

<!-- CLAUDE.md L4958-L4967 -->

- **Chart-render click-through — PARTLY RESOLVED 2026-09-11, two items remain** (2026-09-10).
  Verified by Davin in a real browser on `davintrade.app`: the M5-on-M15 toggle round-trips and the
  download serves the matching variant (OFF → `standard`, titled "M5 overlay OFF"; ON → `overlay`,
  titled "M15 channel + M5 channel OVERLAID (PRO)", M5 channel drawn on the lower panel), and the
  FREE tier shows a **locked** toggle with a PRO badge and a PRO-locked Download button. **Still
  unverified**, both needing a live click-through the Executor cannot perform: that `/terminal`
  opens **exactly two** WebSockets (not four or one — the operational cost of the dual-stacked
  layout, and the input to the socket-refactor trigger below), and that the pane-splitting maths
  looks right, since jsdom's `ResizeObserver` is a no-op stub and that path has no meaningful
  coverage.

<!-- CLAUDE.md L4968-L4976 -->

- **Socket-refactor trigger — DECIDED, do not refactor yet** (2026-09-10). Two WebSockets per
  viewer on `/terminal` and `/free`. Reviewed and deliberately declined: eventlet is green-threaded
  so this is a doubling of a small number, the fix means refactoring `useOhlcvSocket` (which the
  single-chart consumers also use) for no observed benefit, and **it cannot be measured today** —
  `/terminal` showed `Disconnected` and the VPS has not run a green cycle with the recompiled
  `.ex5`. **The trigger:** once the feed is live, measure peak concurrent connections and open file
  descriptors against `ulimit -n` on the Flask host; revisit only if connections approach that limit
  or push latency degrades. Detail + cheaper mitigations:
  `MTF-DUAL-STACKED-LAYOUT-MANIFEST-WORK-COMPLETION.md` §5.1.

<!-- CLAUDE.md L5035-L5047 -->

- **⚠ OPEN — which gateway does the VPS push worker target? Blocks the rest of the staging
  cleanup.** `backfill_worker_api_gateway_v5.py` reads
  `API_GATEWAY_URL = os.environ.get('API_GATEWAY_URL', ...)` — set on the Contabo VPS (NSSM
  service config / env), not in the repo, so it cannot be determined from here. It matters
  because **there are two `railway-gateway` services**: the production one in `trading-alerts`,
  and a second one still running in the staging project since 2026-08-24.
  - If the VPS points at **production**, the staging `railway-gateway` and `Redis` are dead weight
    and can be removed (further saving).
  - If it points at **staging**, that is a much more interesting finding — it would explain why
    production's queue has shown `completed 0` for days, and the pipeline has been pushing into a
    parallel stack all along.
    **Do not remove the staging `railway-gateway` or `Redis` until this is answered.** Check the
    push worker's `API_GATEWAY_URL` on the VPS.

<!-- CLAUDE.md L5078-L5081 -->

- **⚠ `railway-gateway` Watch Paths still unset** — every push anywhere in this monorepo rebuilds
  it. On 2026-09-09 that churn exposed a latent build failure (below) and produced three failed
  deployments from commits that changed nothing in `railway-gateway/`. Scope it to
  `railway-gateway/**` in Settings → Source.

<!-- CLAUDE.md L5092-L5096 -->

- **⚠ Preview deployments point at the production database** (noticed 2026-09-09, not changed).
  Vercel's `DATABASE_URL` is scoped to **All Environments**, so preview branches connect to
  production data; `DIRECT_URL` is Production-only, so the two are inconsistent. Deliberately left
  alone during the rotation — narrowing the scope would break previews and deserves its own
  change.

<!-- CLAUDE.md L5097-L5113 -->

- **Push-worker throughput — OPEN, arithmetic only, needs VPS measurement** (2026-09-09, raised
  while answering Davin's question about row volume/cadence; **predates and is unrelated to** the
  calculation-split removal — it applied equally to the 79-column architecture). Two mechanisms
  verified in code: (a) `promote_cycle()`'s `INSERT OR REPLACE` omits `synced_at`, so SQLite
  resets it to NULL and **every cycle re-queues all ~6000 in-window rows** (correct by design —
  MT5 recalculates the whole 3000-bar window); (b) the worker POSTs **one row per HTTP request**
  at `MAX_ROWS_PER_CYCLE=500` + `ACTIVE_SLEEP_SEC=30`. Demand ~800 rows/min vs a likely capacity
  of 375–600. Because selection is `ORDER BY timestamp ASC` (**oldest first**), the symptom would
  be **the newest bars — the ones alerts need — arriving late or never**, not a crash or data
  loss (the outbox is bounded by the ~6000 rows that exist). Note oldest-first is not arbitrary:
  it drains stragglers that scrolled out of MT5's window while unsynced, which is what stops
  SQLite growing — so a fix must satisfy freshness _and_ that guarantee. **Never observed in
  production** — the live gateway queue showed 0 completed jobs across ~5 days uptime with
  `removeOnComplete: 100`, so this has likely never run at sustained volume. Full write-up,
  the exact measurements to take first, ranked fixes and the invariants not to break:
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/
PUSH-WORKER-THROUGHPUT-OPEN-ISSUE.md`. Also listed as blueprint §12 item 7.

<!-- CLAUDE.md L5114-L5133 -->

- **Historical indicator values are not point-in-time (look-ahead bias) — OPEN, mechanism
  verified, magnitude never measured** (2026-09-09, raised while confirming for Davin that UPSERT
  overwrites a bar's row in place). Verified in the indicator sources: the centroid/SSA fitting
  window re-anchors to the live bar every pass (`startIdx = rates_total - InpSSAMathLookback`),
  so a bar's row is refitted for ~3000 bars (~2.2 weeks M5, ~6.5 weeks M15) before MT5 stops
  exporting it and the row **freezes forever**. Net effect: the stored value for bar T was
  computed using price action from up to ~2 weeks _after_ T. **Harmless for live alerting and
  charts** (they want the newest fit — this is the feature), **invalid for backtesting /
  walk-forward / fitness scoring**. ~56 of the 83 data fields drift (the 7 centroid families);
  OHLCV and the `body_*` z-score triple are genuinely causal (`InpZScoreLength=432` is a trailing
  window) and safe; `fractal_*`/`best_resistance`/`best_support` are stable but rewrite wholesale
  whenever their fixed anchors are re-set. **Sharp detail:** the honest point-in-time value _is_
  computed — it's the first write after the bar closes — and then ~3000 UPSERTs destroy it. Also
  documents a related nuance found the same way: the export includes shift 0, so **the newest row
  in `market_data_v6` is always a still-forming partial bar** until the next cycle. This is a
  **second, independent blocker on the Decision Layer** (noted in its banner too). Magnitude is
  unmeasured — the doc gives a cheap experiment (capture exports a week apart, diff the same
  timestamps) that must run before anything is built. Full write-up + four ranked options:
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/
HISTORICAL-VALUES-LOOK-AHEAD-BIAS-OPEN-ISSUE.md`. Also blueprint §12 item 8.

<!-- CLAUDE.md L5134-L5139 -->

- **Decision Layer is BLOCKED** (2026-09-09) — `v2_29_davintrade_decision_layer/
DAVINTRADE_DECISION_LAYER_BLUEPRINT.md` now carries a banner explaining why: its
  `param_search`/`fitness_scorer` core needs arbitrary-parameter recomputation and the
  R²/MSE/skew statistics substrate, both of which left with the parked calc stack. Needs Davin's
  call: revive the calc stack (see that folder's own doc, two open bugs to fix first), or
  redesign the layer around admin-fixed values only.

<!-- CLAUDE.md L5170-L5178 -->

- **Landing-page Language modal — live click-through not yet confirmed** (2026-09-04 ad-hoc
  session) — `tsc`/`eslint`/new-test (4/4)/full `test:ci` (168/168 · 2397/2397)/`npm run build`
  all clean, but live browser verification was blocked by another session's `next dev` holding
  the shared `.next/` directory (same Windows contention `2026-08-31`'s Academy session
  documented) — not an auth boundary this time, just port/process contention. Needs a pass once
  a dev server is free: open the public landing page, confirm the new "Language" nav item
  (desktop, between the logo and Features) and mobile-drawer equivalent both open the modal,
  that selecting a language re-locales the page immediately with no reload, and that the
  currently-active language shows the check-mark/highlighted state on reopen.

<!-- CLAUDE.md L5179-L5190 -->

- **Trading chart candle up/down colors — never actually seen rendered against live data**
  (2026-09-04 ad-hoc session) — `trading-chart.tsx` now correctly passes `chartUpColor`/
  `chartDownColor` from Settings → Appearance to `CandlestickSeries`, confirmed by reading the
  code and by the chart canvas background/toolbar/gridlines switching correctly in both local dev
  and live production. But every environment this session had available (local dev, a throwaway
  preview route, and the real `/terminal` page on production) showed `Disconnected` — no live
  Socket.IO/MT5 feed — so no actual candle was ever drawn to visually confirm the configured
  colors render correctly on a real bar. Needs Davin's own pass with the backend feed live: open
  `/terminal`, confirm bullish/bearish candles show the colors set in Settings → Appearance →
  Chart Candlestick Customization (default cyan `#00fbff`/magenta `#fb00ff`), and that changing
  those colors updates already-rendered candles live (the new reactive-update effect) without
  needing a page reload.

<!-- CLAUDE.md L5191-L5197 -->

- **Traditional Chinese (zh-TW) — Settings page selection not yet click-through-confirmed**
  (2026-09-03 ad-hoc session) — the dictionary and dropdown entry are live-verified via a public
  unauthenticated page (`/login`, seeded via `localStorage`), but the actual `/settings/language`
  page (where a real user picks it from the dropdown, saves, and sees it persist) is auth-gated —
  same "Executor never enters credentials" boundary as everything else on this list. Needs
  Davin's own pass: select "Chinese (Traditional) (繁體中文)" from the Language dropdown, Save,
  and confirm the app re-locales correctly and the choice survives a reload.

<!-- CLAUDE.md L5198-L5216 -->

- **18-batch site-wide locale audit — authenticated click-through not yet confirmed**
  (2026-09-03 ad-hoc session, CLOSED SUCCESSFUL) — `tsc`/`eslint`/full `test:ci` (166/166 ·
  2390/2390) held clean and constant across all 18 batches, and translation coverage was
  cross-checked programmatically each batch, but the large majority of the ~130 touched files sit
  behind an auth gate (settings, all of admin, the affiliate dashboard) — the Executor never
  enters credentials. Needs Davin's own pass, switched to French/Korean/Chinese, spot-checking at
  minimum: `/dashboard`, `/alerts` (the two highest-traffic pages this session started from),
  `/settings/security` (the largest file in the repo), the 7 `/admin/disbursement/*` pages, and
  the affiliate dashboard's payouts/profile/resources/statements pages. The genuinely public
  surfaces this effort touched (account-delete pages, the public affiliate resources page, the
  auth pages' pre-login state, and Batch 18's marketing/status pages) were structurally verified
  (clean build, zero server errors) but not click-through-verified in a real browser either.
  **`components/auth/social-auth-buttons.tsx` — RESOLVED same-day, ad-hoc follow-up** (Davin
  asked directly whether this component was real and needed his click-through): it renders on the
  public, pre-login `/login`/`/register` pages, so unlike the rest of this list it needed no
  authenticated verification at all. Wired and live-verified in a real browser — switching to
  French renders "Se connecter avec Google"/"Se connecter avec X" correctly, zero console errors.
  `tsc`/`eslint` clean; `login-form.test.tsx`/`register-form.test.tsx` (13/13) and full `test:ci`
  (166/166 · 2390/2390) unaffected. Commit `efe07233`.

<!-- CLAUDE.md L5217-L5224 -->

- **All Round Clock timezone dropdown — authenticated click-through not yet confirmed**
  (2026-09-03 ad-hoc session) — `tsc`/`eslint`/new-test (8/8)/full `test:ci` (166/166 · 2390/2390)
  all clean, and the real search/select interaction was live-verified in a browser via a temporary
  unauthenticated throwaway route (deleted after use) — but `/settings/language` itself is
  auth-gated, so needs Davin's own pass to confirm: the Timezone field shows the correct
  `(GMT ±HH:MM)` label for the user's saved preference on load, the search box filters as expected
  inside the real page's styling/positioning, selecting a new zone updates the "Current time"
  preview live, and Save persists it correctly.

<!-- CLAUDE.md L5225-L5235 -->

- **France/South Korea + French/Korean/Chinese — authenticated click-through not yet confirmed**
  (2026-09-03 ad-hoc session) — `tsc`/`eslint`/full `test:ci` (165/165 · 2382/2382) all clean, and
  a local dev server booted with zero build errors, but the header's "Select Country & Region"
  dropdown and `/settings/language` are both auth-gated (confirmed even `/free` redirects to
  `/login` despite not being in `middleware.ts`'s own protected-prefix list) — the Executor never
  authenticates, so needs Davin's own pass to confirm: the header shows `🇫🇷 France €` /
  `🇰🇷 South Korea ₩` and switching to either actually re-locales the app; the Language & Region
  page offers French/Korean/Chinese and each renders its own dictionary with zero console/
  hydration errors. Separately, `ar.json` is still missing a translated country name for every
  `SUPPORTED_COUNTRIES` entry except France/South Korea (added this session) — a pre-existing gap
  from the UAE ad-hoc session, not introduced here, flagged for a future pass.

<!-- CLAUDE.md L5236-L5244 -->

- **Sign-out fix — live click-through not yet confirmed** (2026-09-01 ad-hoc session) — fixed
  `/login` and `/verify-2fa`'s "already signed in" Sign Out buttons plus a second, independent bug
  in `token-logout/route.ts` (cookie clearing silently failing in production, `__Secure-` prefix +
  missing `Secure` attribute). `tsc`/`eslint`/full `test:ci` all clean, but the Executor never
  authenticates, so the actual "does Sign Out now work" click-through needs Davin. His existing
  Free Test User session will still carry the pre-fix orphaned cookie until the _first_ post-deploy
  Sign Out click or a manual browser cookie clear — not automatically resolved by the deploy alone.
  Also needs a pass across the other `FIXED_TEST_ACCOUNTS` (pro-test, admin-test, affiliate-test,
  etc.) Davin asked about — the fix isn't account-specific, but wasn't verified against each one.

<!-- CLAUDE.md L5252-L5269 -->

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

<!-- CLAUDE.md L5270-L5275 -->

- **Phase 12 handover prompt full re-draft** — Session 14-3 refreshed its factual anchors only
  (Phase 14 close, fresh baselines) and flagged that new Stack D architecture material landed
  2026-08-30 (`davintrade-stack-d-and-e/`, commit `64222ef4` — a `DUAL-RAG-SYSTEM-ARCHITECTURE.md`,
  two versioned storage-strategy docs, a `-V2.md` Stack D architecture variant). The Advisor must
  resolve whether these supersede the file the handover prompt's `<CANONICAL_DOCUMENTS>` still
  cites before Session 12-0 drafts against it.

<!-- CLAUDE.md L5276-L5278 -->

- **Journey B (authenticated PRO user) chat verification** — not run against production; needs
  Davin's own login click-through on `https://davintrade.app` (or a provided test session), since
  the Executor cannot enter credentials itself.

<!-- CLAUDE.md L5279-L5281 -->

- **`/help` and `/about` 404 on production** — found live during Session 14-3, confirmed unrelated
  to the chat cutover (zero application source changes shipped before the gap was found). Needs its
  own investigation session.

<!-- CLAUDE.md L5282-L5286 -->

- **DavinTrade Academy live browser verification — `/academy` and `/academy/[id]` RESOLVED
  2026-09-01** (locale-i18n-compliance ad-hoc session): both live-verified in a real browser
  (Arabic, `dir="rtl"`, translated chrome, zero console/server errors) once a dev server was free.
  `/admin/tutorials` still needs Davin's own click-through — same "cannot log in as admin" boundary
  as everything else below.

<!-- CLAUDE.md L5287-L5297 -->

- **Authenticated click-through for the locale-i18n-compliance session's 8 auth-gated pages**
  (2026-09-01 ad-hoc session) — `/settings/language`, `/admin/dashboards/*` (5 dashboards),
  `/settings/billing`, `/affiliate/dashboard/commissions`, `/admin/affiliates/[id]`,
  `/admin/tutorials`, and `/checkout` (mounts `CountrySelector`/`PaymentMethodSelector`/
  `PriceDisplay`) all compile and redirect cleanly for an unauthenticated visitor (zero server
  errors) but were not click-through-verified as a logged-in user — same "Executor never enters
  credentials" boundary as the BI dashboards and Academy items above. Needs Davin's own pass to
  confirm: the Settings→Language page's Save actually flips live app context and survives reload;
  the 5 BI dashboards, billing/invoice history, and affiliate commissions/admin pages render
  correctly with a non-English locale selected (`ar`/`th`); the checkout page's country/payment
  selectors and price display localize as expected.

<!-- CLAUDE.md L5298-L5317 -->

- **`20260214000000_rag_dual_memory` — recorded as APPLIED in production's ledger, but its 6
  tables DO NOT EXIST** (corrected 2026-09-13; the earlier "still pending" wording here was wrong
  for production). Production's `_prisma_migrations` row is `applied_steps_count = 0`: it was
  baselined with `prisma migrate resolve --applied` during Session 2-3's history baselining
  (`DECISION-LOG` F20, now in `history/decisions-archive.md`), never executed. Davin confirmed
  against the live production database that none of `mt5_accounts`, `upload_history`,
  `jsonl_sessions`, `behavioral_drift`, `advice_outcomes`, `compliance_audit` exist.
  **Consequence for Stack D:** `prisma migrate deploy` / `migrate status` will treat it as done and
  **never create these tables**. When Stack D RAG work starts, create them with
  `prisma db execute --file prisma/migrations/20260214000000_rag_dual_memory/migration.sql`
  (against production via `prisma.production.config.ts`'s target; the SQL uses
  `CREATE TABLE IF NOT EXISTS`), and **do not** run `migrate resolve` on it again, since the ledger
  row already exists. It is one of 5 zero-step baselined rows (with `20251227000000_init`,
  `20260224000000_update_kc_ha_body_columns`, `20260705000000_add_market_data_v6`,
  `20260705010000_drop_market_data`); `add_market_data_v6` was the same trap
  (`market_data_v6` absent until created by hand 2026-09-09), so check each one's physical objects
  rather than trusting its ledger row. Still also awaiting the Advisor's call on whether the
  2026-08-30 Stack D material supersedes the handover prompt's canonical documents (the "Phase 12
  handover prompt" item above).

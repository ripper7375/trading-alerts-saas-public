---
type: Concept/HistoryIndex
status: active
updated_at: 2026-09-26
tags: [history, index]
---

# Session history index

Archive of every session narrative that used to live in `CLAUDE.md`'s `## Current state`. **Search here
(Grep) before re-investigating a problem** — most bugs, gotchas and decisions were already written up.
Line numbers refer to the pre-OKF `CLAUDE.md` (backup `CLAUDE-480KB-PRE-OKF-BACKUP.md`; also git history
before commit of the OKF refactor).

| File                                                | Covers                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [2026-09-sessions.md](./2026-09-sessions.md)        | Ad-hoc sessions 2026-09-01 → 2026-09-26 (minus the 2 in current-state), plus the two standing notices (webhook-cutover instruction, Vultr VPS fact) |
| [2026-08-sessions.md](./2026-08-sessions.md)        | Ad-hoc sessions 2026-08-30/31 and the Session 14-3 / 14-2 Current/Previous entries                                                                  |
| [resolved-waiting-on.md](./resolved-waiting-on.md)  | Waiting-on items marked RESOLVED                                                                                                                    |
| `docs/migration-orders/history/sessions-archive.md` | Older numbered sessions (up to 14-1), archived by the pre-OKF protocol                                                                              |
| `docs/migration-orders/*.migration-order.md`        | Canonical record of each numbered session                                                                                                           |

## September 2026 — [2026-09-sessions.md](./2026-09-sessions.md)

| Orig. lines | Entry                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| L53–L63     | Same day (2026-09-26), follow-up to Davin's two screenshots — currency mixing fixed. Branch `fix/no-country-language-currency`, tested by Davin, me…  |
| L64–L118    | Same session (2026-09-26) — SystemConfig figures are no longer hardcoded: the admin's price is now what customers pay. Merged to `main` via PR #471…  |
| L119–L145   | Round 3 (2026-09-26) — every public, auth and FREE/PRO page is fully translated in all 16 languages, enforced by a test. Same branch `fix/16-langua…  |
| L146–L165   | Same session, round 2 (2026-09-25) — language and format changes now reach server-rendered parts without a refresh. Same branch (`e8350262`, `b64cc…  |
| L166–L194   | Ad-hoc session (2026-09-25) — final audit of language and locale, then fixes. Branch `fix/16-language-localization-reaudit`, pushed, NOT merged, NO…  |
| L195–L232   | Same session, round 3 — every place that shows a time, date or price now uses the user's own timezone, date format, time format and currency. Branc…  |
| L233–L257   | Same session, round 2 — Language & Region now works as Davin's annotated screenshot describes. Same branch, NOT pushed. The rules: the header's cou…  |
| L258–L282   | Ad-hoc session (2026-09-24, phase/session unchanged) — display currency now converts at its own rate, and choosing a language suggests its currency…  |
| L283–L312   | Ad-hoc session (2026-09-24, phase/session unchanged) — admin read-only "view as user" for customer support: a FREE or PRO user's Billing, Login His…  |
| L313–L366   | Ad-hoc session (2026-09-24, phase/session unchanged) — billing history: dLocal PDF receipts, an "amounts may differ" notice, and the full history i…  |
| L367–L395   | Ad-hoc session (2026-09-24, phase/session unchanged) — the 8 CI checks that failed on every PR now pass. PR #467, merged. The same 8 checks (api-te…  |
| L396–L425   | Ad-hoc session (2026-09-24, phase/session unchanged) — admin read-only "view as affiliate", plus a full page load after login. Code complete and ve…  |
| L426–L452   | Ad-hoc session (2026-09-23, phase/session unchanged) — Disbursement payout settings: `/admin/disbursement/settings` built end to end (DECISION-LOG…   |
| L453–L522   | Ad-hoc session (2026-09-22, phase/session unchanged) — Stack C 15th indicator: `S-R-AutoCalibration_v2_29` onboarded end to end as source `sr2_leve…  |
| L523–L567   | Ad-hoc session (2026-09-18, same day, phase/session unchanged) — landing-features.tsx translation gap, CLOSED SUCCESSFUL, committed and pushed (`84…  |
| L568–L624   | Ad-hoc session (2026-09-18, same day, phase/session unchanged) — public marketing chrome: full translation coverage, CLOSED SUCCESSFUL, committed a…  |
| L625–L731   | Ad-hoc session (2026-09-18, same day, phase/session unchanged) — locale/i18n compliance audit and remediation pass, CLOSED SUCCESSFUL, committed an…  |
| L732–L864   | Ad-hoc session (2026-09-18, phase/session unchanged) — Frozen Baseline (Pillar 1) and the event-driven Centroid Watchdog (Pillar 2) built end to en…  |
| L865–L919   | Ad-hoc session (2026-09-16, same day, phase/session unchanged) — workbench polish: one correct grip per divider, and no crosshair at the drawing to…  |
| L920–L984   | Ad-hoc session (2026-09-16, same day, phase/session unchanged) — workbench chart panel: the M5/M15 divider is now drag-resizable. Code complete, ve…  |
| L985–L1095  | Ad-hoc session (2026-09-16, phase/session unchanged) — Stack C 14th indicator: `SupportAndResistantAutoCalibration_v2_29` onboarded end to end, `ma…  |
| L1096–L1099 | Full account of this session's three rounds (workbench collapse, chart resize + toolbar fit, PRO page header buttons): `davintrade-frontend-ui-fix/…  |
| L1100–L1111 | Ad-hoc session (2026-09-14, phase/session unchanged) — PRO currency index page headers: "AI Workbench" + "28-Pair Screener" buttons. Done, verified…  |
| L1112–L1164 | Ad-hoc session (2026-09-14, phase/session unchanged) — `/terminal` + `/free` workbench: sidebar and panel collapse fixed. Code complete, verified,…   |
| L1165–L1176 | Ad-hoc session (2026-09-14, phase/session unchanged) — Currency Index Comparison PRO: the same index may now be chosen in both Index A and Index B.…  |
| L1177–L1216 | Ad-hoc session (2026-09-14, phase/session unchanged) — Currency Index PRO (`/pro/currency-index`): hide/show each of the 8 currency lines independe…  |
| L1217–L1247 | Ad-hoc session (2026-09-14, phase/session unchanged) — Currency Index Comparison PRO Round 4: ZigZag and Z-score candles ("MC") on `/pro/currency-i…  |
| L1248–L1306 | Ad-hoc session (2026-09-13, same day, phase/session unchanged) — Currency Index Comparison PRO: `/pro/currency-index/compare` + "Upgrade to PRO" on…  |
| L1307–L1377 | Ad-hoc session (2026-09-13, same day, phase/session unchanged) — Currency & Gold Index Stack ("Lane 4"): XAUX (Gold Index) formula corrected from a…  |
| L1378–L1391 | Ad-hoc session (2026-09-13, phase/session unchanged) — Active / Hot-Standby MT5 Terminal: Admin Promotion Tooling, Dual-Language Runbooks & Bluepri…  |
| L1392–L1508 | Ad-hoc session (2026-09-12, same day, phase/session unchanged) — Active / Hot-Standby MT5 Terminal architecture: design document written, then Part…  |
| L1509–L1549 | Ad-hoc session (2026-09-12, same day, phase/session unchanged) — Currency Index PRO Plan: production database migration applied, and the full test-…  |
| L1550–L1640 | Ad-hoc session (2026-09-12, same day, phase/session unchanged) — Currency Index PRO Plan Phase 5 of 5 (final phase), CLOSED SUCCESSFUL: every spec…   |
| L1641–L1722 | Ad-hoc session (2026-09-12, same day, phase/session unchanged) — Currency Index PRO Plan Phase 4 of 5 (and final frontend phase), CLOSED SUCCESSFUL…  |
| L1723–L1859 | Ad-hoc session (2026-09-12, same day, phase/session unchanged) — Currency Index PRO Plan Phase 3 of 5, CLOSED SUCCESSFUL: the relative-strength cha…  |
| L1860–L1969 | Ad-hoc session (2026-09-12, same day, phase/session unchanged) — Currency Index PRO Plan Phase 2 of 5, CLOSED SUCCESSFUL: the HRMA/SMMA signal engi…  |
| L1970–L2072 | Ad-hoc session (2026-09-12, phase/session unchanged) — Currency Index PRO Plan Phase 1 of 5, CLOSED SUCCESSFUL: database foundation + the "00:00 MT…  |
| L2073–L2157 | Ad-hoc session (2026-09-11, same day, phase/session unchanged) — Currency & Gold Index Stack ("Lane 4") Phases 3 and 4 of 5, CLOSED SUCCESSFUL: Red…  |
| L2158–L2231 | Ad-hoc session (2026-09-11, same day, phase/session unchanged) — Currency & Gold Index Stack ("Lane 4") Phase 2 of 5, CLOSED SUCCESSFUL: the NestJS…  |
| L2232–L2326 | Ad-hoc session (2026-09-11, same day, phase/session unchanged) — Currency & Gold Index Stack ("Lane 4") Phase 1 of 5, CLOSED SUCCESSFUL: the VPS ma…  |
| L2327–L2349 | Ad-hoc session (2026-09-11, phase/session unchanged) — CLOSED SUCCESSFUL, React bumped 19.2.3 → 19.3.0. Davin asked directly in chat, prompted by t…  |
| L2350–L2419 | Ad-hoc session (2026-09-11, phase/session unchanged) — CLOSED SUCCESSFUL, four small frontend slices shipped from `davintrade-stack-d-and-e/FRONTEN…  |
| L2420–L2432 | STANDING INSTRUCTION (Davin, 2026-07-22, NARROWED 2026-07-24 — still in force until Davin lifts it further): chain-length-one originally read as "w…  |
| L2433–L2445 | ⚠ STANDING FACT (Davin, 2026-09-11) — the VPS is VULTR. "Contabo" is a legacy name. This file, the pipeline blueprint and the folder `backend-stack… |
| L2446–L2559 | Ad-hoc session (2026-09-11, phase/session unchanged) — CLOSED SUCCESSFUL, the Cloudflare R2 chart-render path DEPLOYED and verified end to end: pri…  |
| L2560–L2709 | Ad-hoc session (2026-09-10, phase/session unchanged) — CLOSED SUCCESSFUL, Market Session clock + High-Impact News/Event countdown, and the complete…  |
| L2710–L2820 | Ad-hoc session (2026-09-10, phase/session unchanged) — CLOSED SUCCESSFUL, the chart-render chain end to end: `mtf_render` rewritten 3-panel → 2-pan…  |
| L2821–L2895 | Ad-hoc session (2026-09-04, phase/session unchanged) — CLOSED SUCCESSFUL, public dark/light theme toggle on the marketing navbar: Davin asked direc…  |
| L2896–L2973 | Ad-hoc session (2026-09-04, phase/session unchanged) — CLOSED SUCCESSFUL, landing-page "Language" modal: Davin asked directly in chat (with a scree…  |
| L2974–L3052 | Ad-hoc session (2026-09-04, phase/session unchanged) — CLOSED SUCCESSFUL, public "EconNews" Economic Calendar page via TradingView widget: Davin ga…  |
| L3053–L3171 | Ad-hoc session (2026-09-04, phase/session unchanged) — CLOSED SUCCESSFUL, Light Clean Mode (Theme Mode) never visually applying, plus the trading c…  |
| L3172–L3301 | Ad-hoc session (2026-09-03, phase/session unchanged) — CLOSED SUCCESSFUL, propagate the `best_fit_a`/`best_fit_b` split downstream of the gateway c…  |
| L3302–L3396 | Ad-hoc session (2026-09-03, phase/session unchanged) — CLOSED SUCCESSFUL, Stack C `best_fit` centroid variant split into `best_fit_a`/`best_fit_b`:…  |
| L3397–L3454 | Ad-hoc session (2026-09-03, phase/session unchanged) — CLOSED SUCCESSFUL, Traditional Chinese (zh-TW): Davin asked what Chinese variant the app's e…  |
| L3455–L3578 | Ad-hoc session (2026-09-03, phase/session unchanged) — CLOSED SUCCESSFUL, full 18-batch site-wide locale audit: Davin reported that the France/Sout…  |
| L3579–L3642 | Ad-hoc session (2026-09-01, phase/session unchanged): Executed `docs/migration-orders/adhoc-locale-i18n-compliance.migration-order.md` end to end —…  |
| L3986–L4059 | Ad-hoc session (2026-09-01, phase/session unchanged): Davin reported Google/Twitter OAuth passing the provider's own consent screen cleanly, then r…  |
| L4060–L4149 | Ad-hoc session (2026-09-01, same day, phase/session unchanged) — correction to the entry immediately above: the cookie-domain fix above was real, n…  |
| L4150–L4208 | Ad-hoc session (2026-09-01, same day, phase/session unchanged): Davin reported a follow-on bug found while verifying the OAuth fix above — the `/lo…  |
| L4209–L4272 | Ad-hoc session (2026-09-03, phase/session unchanged): Davin requested 2 new countries/regions (France `FR`/`fr`, South Korea `KR`/`kr`) in the head…  |
| L4273–L4327 | Ad-hoc session (2026-09-03, phase/session unchanged): Davin requested (a fully-specified task order given directly in chat) upgrading `/settings/la…  |
| L4328–L4434 | Ad-hoc session (2026-09-09, same day, phase/session unchanged) — CLOSED SUCCESSFUL, append-only statistic capture built end to end, MT5 → SQLite →…   |
| L4435–L4506 | Ad-hoc session (2026-09-09, same day, phase/session unchanged) — CLOSED SUCCESSFUL, EDT Quality Metrics Suite: statistical-data additions to 10 MQL…  |
| L4507–L4610 | Ad-hoc session (2026-09-09, phase/session unchanged) — CLOSED SUCCESSFUL, remove the MT5↔Python calculation split: MQL5 becomes the single source o… |
| L4611–L4712 | Ad-hoc session (2026-09-09, phase/session unchanged) — CLOSED SUCCESSFUL (with one major finding escalated, not fixed), end-to-end field name/type/…  |
| L4713–L4757 | Ad-hoc session (2026-09-08, phase/session unchanged) — CLOSED SUCCESSFUL, ingestion safety guard coercing inactive 0.0 price levels to NULL in Stac…  |

## August 2026 — [2026-08-sessions.md](./2026-08-sessions.md)

| Orig. lines | Entry                                                                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| L3643–L3677 | Ad-hoc session (2026-08-30, phase/session unchanged): Davin requested UAE (`AE`) support directly in chat — dLocal payment methods (Local Cards/App… |
| L3678–L3700 | Ad-hoc session (2026-08-30, phase/session unchanged): Davin asked to fix the stale `support@davintrade.com` email flagged (not fixed) in Session 14… |
| L3701–L3785 | Ad-hoc session (2026-08-31, phase/session unchanged): Davin requested the DavinTrade Multi-Dashboard Business Intelligence System — 5 admin-only da… |
| L3786–L3855 | Ad-hoc session (2026-08-31, phase/session unchanged): Davin requested a public DavinTrade Academy — admin-curated YouTube tutorials teaching genera… |
| L3856–L3896 | Ad-hoc session (2026-08-31, phase/session unchanged): Davin asked for a read on upgrading to NestJS 12 (prompted by `https://github.com/nestjs/nest… |
| L3897–L3947 | Ad-hoc session (2026-08-31, phase/session unchanged): Follow-on to the same-day NestJS advisory above — Davin asked whether `railway-gateway` (stil… |
| L3948–L3985 | Ad-hoc session (2026-08-31, phase/session unchanged): Davin asked to connect `railway-gateway` to GitHub too, closing the gap the entry above defer… |
| L4758–L4893 | Current: Session 14-3 (Cutover + Runbook, Phase 14 — fourth and last of 4 sessions,                                                                  |

## Resolved Waiting-on items — [resolved-waiting-on.md](./resolved-waiting-on.md)

| Orig. lines | Entry                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------- |
| L4939–L4957 | RESOLVED 2026-09-11 — the R2 chart-render path is DEPLOYED AND LIVE end to end. Bucket        |
| L4977–L4992 | RESOLVED 2026-09-11 — the MQL5 recompile and VPS deployment are DONE. This entry stood as the |
| L4993–L5022 | RESOLVED 2026-09-09 — the four pending migrations are applied to PRODUCTION, and the          |
| L5023–L5034 | RESOLVED 2026-09-09 — Postgres superuser password rotated after exposure. The credential      |
| L5048–L5077 | RESOLVED 2026-09-09 — staging project audited and the dead monolith service deleted. The      |
| L5082–L5091 | RESOLVED 2026-09-09 — `railway-gateway` could not build at all. `NODE_ENV=production` made    |
| L5140–L5144 | RESOLVED 2026-09-09 — centroid EDT fractal source / unreproducible certification. Dissolved   |
| L5145–L5161 | ~~MAJOR — centroid EDT fractal source: certification unreproducible, production may use the   |
| L5162–L5169 | RESOLVED 2026-09-09 — `market_data_v6` provenance NOT NULL migration applied.                 |
| L5245–L5251 | RESOLVED 2026-09-01: OAuth `error=Callback` — see the two same-day ad-hoc entries above.      |

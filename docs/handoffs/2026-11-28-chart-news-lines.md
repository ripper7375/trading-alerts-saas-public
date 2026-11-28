# Hand-off: news lines on the web chart and the timeframe lock (2026-11-28)

These notes were written for `.claude/state/`. They are kept here instead (Davin, 2026-11-28): the branch holds the
unpruned state files, and the pruned operating-document batch is in the main checkout. Fold the summary into
`current-state.md` and the follow-up into `waiting-on.md` there.

## Where it stands after the summary below was written

- Pull request: https://github.com/ripper7375/trading-alerts-saas-public/pull/542
  (`claude/jolly-volhard-f9b390` into `main`, base `fd4e18d5`). Code and tests are commit `63f4f4fe`; the only other
  change on the branch is this file. The summary below was written before the push, so its "not pushed" and "build
  not run" remarks are history.
- CI built the app on commit `271cc2dd`, which holds that code: `Install Dependencies & Build`,
  `Production Build Check` and `Monitor Bundle Size` (179 MB shipped output) succeeded. `npm run build` was not run
  on this machine.
- The pull request's own branch gets **no Vercel preview**: `vercel.json` (`ignoreCommand`) skips `claude/*` and
  `docs/*`. For inspection, commit `fb38bb08` was pushed to a temporary branch, `fix/chart-news-lines`, with no
  second pull request; that branch is deleted before the merge. The project notes say a preview deployment uses the
  production database (`.claude/architecture/database-traps.md`): look, do not change data.
- Where each change shows: `/terminal` (PRO) has the price chart lines, the empty margin and the timeframe lock.
  `/pro/currency-index` has only the relative strength chart (news lines and their tooltip) and the detail modal,
  which draws its warm-up line with the same primitive. The relative strength chart fits its data on load and keeps
  no margin, so an upcoming line there shows only after dragging the chart left.
- While the market is closed (2026-11-28 is a Saturday) no upcoming line can appear on the price chart: events more
  than 24 h past the last bar are not drawn.
- The four edited `.claude/state/` files were never committed and were discarded in the worktree after their content
  was copied here, so remarks below about those uncommitted files are history. The same edits rotated the
  `2026-11-23 bundle-size-monitor` entry into the November history; the main checkout already holds that entry there
  (same text apart from line wrapping).
- Davin leaves the three known chart limits (gold's daily halt, drawing clicks in the empty margin, history view under
  the timeframe lock) as they are for this pull request.

## Session summary

<!-- session 2026-11-28 chart-news-lines -->

> **Ad-hoc session (2026-11-28), worktree branch `claude/jolly-volhard-f9b390` (base `fd4e18d5`), code and tests committed locally as `63f4f4fe` (this note is NOT in that commit) on Davin’s word, not pushed: the high-impact news lines on the web chart were never visible; fixed on Davin’s approval in chat.**
> **Needs from Davin:** (1) Push and open the PR when wanted. (1b) These four state files are uncommitted: the pre-commit hook that runs for every worktree is the main checkout’s UNCOMMITTED one, whose document gate rejects any `.claude` change (29 old broken links under this branch’s checker; the state files are over its newer size budgets). (2) Two unverified points that can hide or misplace the lines in production: first item of [waiting-on](#follow-up-terminal-chart-feed) (proposed as a separate session).
> **Changed & verified:** new `components/charts/drawing/eventPlacement.ts`, used by `EventVerticalLine.ts`; `trading-chart.tsx` keeps 12 empty candles right of the last one on PRO charts (36 time-scale slots with the M5 overlay). Rules: a released event goes on the candle whose period holds it (market closed: the first candle after); an upcoming one on its future slot, at most 24 h past the last bar; older than the first bar: none. Tests failed first: new `__tests__/drawing/EventVerticalLine.real-chart.test.ts` (13, real library 5.2.0 standalone build) and 3 cases in `trading-chart.test.tsx`; 7 mutations each caught. `tsc` exit 0; lint 0 errors (5 existing warnings); related Jest 33 suites, 410 tests passed. Browser pane: a throwaway page (real library, the transpiled sources, synthetic bars) painted every expected line before and after 10 new bars.
> **Padlock TF (Davin: fix it before the commit):** the sync moved out of `mtf-stacked-charts.tsx` into `components/charts/mtf/linkTimeScales.ts` and changed. Before, locking dropped the empty area on BOTH charts (a visible time range ends at the newest bar); my first fix then let new bars push the view away (right margin 12 to 14.7 after one simulated hour). Now only the chart the user dragged or scrolled last leads (the other mirrors it), and both end at the same moment in their own slots. New `__tests__/components/charts/link-time-scales.real-chart.test.ts` (11, real library), 11 mutations caught; after it `tsc` exit 0, lint 0 errors, related Jest 34 suites, 421 tests passed. Browser pane (throwaway page): wheel, stepped drag events and 12 new bars kept the charts aligned. The pane was hidden, so frames were forced with screenshots; the tool’s own drag did not pan even unlocked. In history view the two right edges may differ by under one M15 candle (copied by visible time, as before).
> **Review before the commit** (Davin: commit only if nothing is left to fix): two defects of this change found and fixed, tests first. The relative-strength news tooltip matched by crosshair time, so it opened one bar off an off-bar line and never over an upcoming one: it now opens on the line itself (`series` prop, same `eventCoordinate`). With the M5 overlay switched on but showing nothing, the PRO M15 chart kept 36 empty candles: `useMtfOverlay` now returns `isShown` and the margin widens only then. 5 mutations caught. Full Jest from the worktree (wrapper config, coverage off): 643 suites passed, 6 skipped, 2 failed only because they read packages under the worktree’s own `node_modules`; both passed 73/73 with temporary junctions, since removed (21,443 tests passed, 319 skipped in all). `tsc` exit 0, lint 0 errors (5 existing warnings).
> **Unconfirmed / found:** not seen inside the app (`/dev/workspace` has no price feed), and the tooltip fix not in any browser; `build` not run (its `prebuild` regenerates Prisma clients in the shared `node_modules`), so CI is its first build. Limits: across gold’s daily halt an upcoming line sits up to 1 h of slots too far right until bars resume; drawing clicks in the empty margin are ignored (`pixelToAnchor` is null past the last bar). `logicalToCoordinate` returns 0 for a fractional index. Prettier already flags two class orders each in `trading-chart.tsx` and `mtf-stacked-charts.tsx` at `HEAD`.

## Follow-up: Preview sign-in treats a PRO account as FREE

Not caused by this pull request (it changes no auth code). A separate session. Observed during testing on 2026-11-28
(Davin):

- On the Preview `809ixlxlg`, `/api/auth/session` returned only `{ name, email, image }`: `id`, `tier`, `role` and
  `isAffiliate` were all missing, also after signing out and in again, so `/login` and `/terminal` treated
  `Pro Test User` as FREE. Production (`davintrade.app`) returned `tier: "PRO"`.
- Code reading (`lib/auth/auth-options.ts`, `callbacks.jwt`): at sign-in, a `prisma.user.findUnique` whose `select`
  includes `sessionVersion` runs inside a `try` whose `catch` logs and returns the token as it is. A failure of that
  query gives this session. The credentials sign-in's own select (`CREDENTIALS_USER_SELECT`) does not name
  `sessionVersion`, so the sign-in itself would still succeed.
- Hypothesis: WS-4 migration `20261024000000_add_session_version` is not applied to the database the Preview reads,
  with `NEXT_PUBLIC_AUTH_BRIDGE_ENABLED` not `true` there. OAuth sign-in on `davintrade.app` uses the same callback:
  check it too.
- Evidence against an unapplied migration in production: the project records say all migrations up to
  `20261026000000` were applied on 2026-10-31, and the production migration check of 2026-11-21 named only
  `20261114000000_add_trendline_context_tables`. `database-traps.md` still says "NOT applied". So either the Preview
  does not read that database, or the query fails for another reason.
- Not verified: no database, Preview variable or runtime log was read. Check first: the Preview runtime log line
  `[JWT] Callback error:`, which should name the cause.

## Follow-up: terminal chart feed

A separate session, "Check terminal chart feed time base and CSP", comes after the pull request's preview has been
inspected.

- Terminal chart feed (2026-11-28, ad-hoc, code reading only): **UNVERIFIED, can hide or misplace the news lines.** (a) `mt5-service/app/services/indicator_reader.py` sends MT5 `rates[time]` unconverted (apparently broker server time) while economic-event times are UTC: lines could be 2-3 h off. (b) The `next.config.js` CSP `connect-src` lists no price-socket host and no local env file of the main checkout sets `NEXT_PUBLIC_MT5_WS_URL` (Vercel not checked): the production chart may receive no bars. Check: open `/terminal` while the market is open, set the timezone to UTC, compare the newest candle with the real time. [Session entry](#session-summary).

# Currency Index Comparison PRO — Work Completion Report

**Date:** 2026-09-13
**Status:** Code complete and verified (Python, gateway unit + e2e, full monolith suite, live browser),
across two rounds; Round 2 (§7) covers Davin's follow-ups. Committed and pushed to `origin/main`
(§8). **`railway-gateway` is deployed and migration `20260913120000_add_currency_gold_index_ohlc` is APPLIED and VERIFIED**
on production Postgres (`maglev.proxy.rlwy.net:58290`). Gate and DB schema are fully in sync; safe for VPS engine deployment. VPS engine **not
redeployed**.
**Type:** Ad-hoc feature session, requested directly in chat with an annotated screenshot — outside
the phase/session numbering, per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6.

> **Scope:** the PRO layer on top of the public **XAUX vs USDX Comparison Page** ("Free plan",
> `davintrade-xaux-vs-usdx-comparison-page/xaux-vs-usdx-comparison-page-manifest-work-completion.md`).
> A new PRO page, `/pro/currency-index/compare`, plus the "Upgrade to PRO" entry point on
> `/xaux-vs-usdx`. It is separate from the 28-pair screener at `/pro/currency-index` (Currency Index
> PRO Plan), which it links to and from but otherwise does not touch.

---

## 1. What was asked, and the three decisions it forced

**Asked:** an "Upgrade to PRO" button on `/xaux-vs-usdx` (signed out → sign in; FREE → upgrade gate;
PRO → the PRO page), and a PRO page with: all 9 Lane 4 indices (8 currency + XAUX), any 2 at a time;
line, OHLC-candle and Heiken Ashi plot types; HRMA and SMMA with configurable periods and per-line
hide/show; up to 3000 bars on M5 and M15; everything in the Free plan (drawing tools, rebase) minus
the watermark. Reference material: the per-index `*_H1_{Open,High,Low,Close,OHLC Candles,HA
Candles}.mq5` files and `HRMA_Modified Buffers.mq5` / `SMMA_Modified Buffers.mq5` in this folder.

**Reading the live code before planning surfaced three things the request could not be built without
deciding.** All three were put to Davin with a recommendation; he took the recommendation each time.

| #   | Finding                                                                                                                                                                                                          | Options                                                                    | Chosen                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | `currency_gold_indices` stores **one value per M5 bar** (the close). OHLC and Heiken Ashi candles need open/high/low, which do not exist anywhere in Lane 4.                                                     | Genuine OHLC through the pipeline, or fake wickless candles from closes    | **Genuine OHLC via Lane 4** (engine → contract → DB)     |
| 2   | Every Lane 4 index **resets to 100 at its daily session open**. Over 3000 bars that is a sawtooth, which breaks Heiken Ashi (open averages the previous candle) and HRMA/SMMA (recursive filters) at each reset. | Chain days into one continuous series, or keep the reset and restart daily | **Chain into one continuous series** (display-only)      |
| 3   | A PRO page already exists at `/pro/currency-index` (the 28-pair screener).                                                                                                                                       | New sub-page, or a section inside the screener                             | **New page `/pro/currency-index/compare`**, cross-linked |

---

## 2. What was built

### 2.1 Lane 4 pipeline — genuine index OHLC

**Engine** (`currency_gold_index_engine.py`). `value` is, and always was, the index close; each row
now also carries the index **open/high/low** of the same M5 bar.

- The rule comes straight from the MQL5 references: `*_H1_High.mq5` takes each input's **High where
  the index holds it directly and its Low where inversely**; `*_H1_Low.mq5` mirrors it; Open/Close use
  the inputs' opens/closes.
- **Adapted, not transcribed:** the MQL5 files read real cross symbols (`EURJPY.i`), but Lane 4 reads
  only the 7 USD-quoted pairs + XAUUSD and triangulates the crosses. The engine therefore applies the
  rule to each index's **net exponent per raw symbol** (`symbol_exponents()`), derived mechanically
  from the same `CURRENCY_INDEX_TERMS` / `GOLD_INDEX_LEGS` tables the value formula uses. This is the
  same bound as the MQL5 per-term rule: every G8 index reduces to `u_X / ∏ u_Y^W`, with each primary
  pair mapping to exactly one currency, so no symbol ever needs its High in one term and its Low in
  another. For XAUX the derived exponents match `XAUX_H1_High.mq5`'s own direct/inverse flags
  exactly (pinned by a test).
- A symbol with no bar at exactly the target time (it didn't trade) contributes a **flat** bar at its
  forward-filled close, consistent with the close `value` already uses.
- A final `max`/`min` guards a malformed export row (High below its own Close) from producing an
  inverted candle. For well-formed input it is a no-op, and a test proves that.
- **Outbox:** three nullable `REAL` columns, plus `migrate_outbox_columns()` (idempotent
  `ALTER TABLE ADD COLUMN`), because `CREATE TABLE IF NOT EXISTS` is a no-op against an existing file.
  Rows pushed without OHLC omit the keys rather than sending null.
- **Not ported, deliberately:** the XAUX `*_H1_{Open,High,Low,Close}.mq5` files each carry a
  **different** set of inception rates (e.g. `XAUUSD_Inception` 4333.33 in Open, 4356.14 in High),
  which would make their O/H/L/C series mutually inconsistent. The engine uses one session inception
  for all four, so a candle's parts always share a base.

**Gateway contract / DTO / processor / Prisma / migration.**
`gateway_contract_currency_gold_indices.schema.json` gains **optional** `open`/`high`/`low`, so an
engine build that predates OHLC keeps validating during rollout. The DTO was regenerated via
`npm run generate:dto` (the other three DTOs came out byte-identical). The processor stores absent
values as `NULL`, never defaulting to `value`, so "no OHLC" stays distinguishable from a flat bar. Both
Prisma models gain `open`/`high`/`low Float?` (bodies kept identical). Migration
`20260913120000_add_currency_gold_index_ohlc` adds three nullable columns, **byte-identical to
`prisma migrate diff`'s own output** for the schema change.

### 2.2 Monolith — candle construction and indicators (pure, client-safe)

- `lib/currency-index-comparison/series.ts`
  - **`chainSessions()`** scales each session so its first bar's **open** continues from the previous
    session's last **close**. The **latest session keeps scale 1**, so today's values match the landing
    widget and the screener exactly, and earlier days are scaled to join it. What chaining cannot
    recover is stated in the code and on the page: the gap between sessions (gold's rollover halt, a
    weekend, missed bars) counts as zero movement.
  - **`toTimeframe()`** builds MT5-style clock-aligned M15 buckets: first open, max high, min low, last
    close; a bucket never spans two sessions.
- `lib/currency-index-comparison/indicators.ts` reuses `computeHrma`/`computeSmma` from
  `lib/currency-index-pro/math.ts`, already verified line for line against these same two `.mq5`
  files. It adds what that module never needed: each file's default **applied price** (HRMA
  `PRICE_TYPICAL` = (H+L+C)/3, SMMA `PRICE_CLOSE`) and HRMA's `rates_total < len_hrma → draw nothing`
  guard. `heikinAshi()` ports `*_H1_HA Candles.mq5` line for line. Indicators are computed from the
  **real** candles, never the HA ones, so switching plot type never moves an indicator line (as in MT5).
- `lib/currency-index-comparison/queries.ts` reads one index per call (one index's failure can't
  blank the other), selecting columns explicitly.

### 2.3 API route

`GET /api/market/currency-index-pro/comparison?indices=EURX,JPYX&timeframe=M5|M15`: the same PRO
gate as the other `currency-index-pro/*` routes (session, then `hasPermission` with a DB tier
re-check), 1–2 distinct valid indices or 400, candles rounded to 4 decimals (0.0001 of an index
point), Redis cache per (index, timeframe) shared across PRO viewers (the payload isn't per-user),
and a `private` response. HRMA/SMMA/HA are **not** computed server-side: the page recomputes them
instantly as sliders move, with no request.

### 2.4 The PRO page

- `app/pro/currency-index/compare/page.tsx`: auth comes from the parent layout. The PRO check is
  page-level with a **DB re-check** when the JWT says FREE, so a just-upgraded user isn't bounced;
  otherwise it redirects to `/pricing`.
- `components/currency-index-comparison/`
  - **Chart:** every series (per slot: line, candlestick, HRMA, SMMA) is created once and toggled with
    `visible`. The drawing engine attaches to a dedicated **host** line series (stroke hidden, series
    visible) that carries slot A's closes, so **drawings survive plot-type switches** (verified live).
  - **Colors follow the slot, not the index:** only two indices are on screen, and fixed slot hues keep
    any pair of the 9 maximally distinct. The palette was validated with the dataviz skill's
    `validate_palette.js`, all-pairs, against this chart's real surfaces: light `#c98500,#2a78d6` on
    `#ffffff`, dark `#c98500,#3987e5` on `#0a0e17`; every check passes in both modes. HRMA (dashed) and
    SMMA (dotted) share their slot's hue and carry on-chart titles, so identity never rests on hue.
    Candles use the hollow convention: rising = outline, falling = filled.
  - **Controls:** Index A / Index B pickers (B can be None; each disables the other's pick), Line /
    OHLC Candles / Heiken Ashi, M5/M15, HRMA and SMMA period sliders (2–200; MQL5 defaults 36 / 13),
    clickable legend chips to hide either line per index, the Free plan's rebase sliders, and both
    indices' definitions. **No watermark.** Nothing is persisted, matching the Free page.
- `components/currency-index-pro/pro-currency-index-cockpit.tsx`: one "Compare indices" link added to
  the screener header.

### 2.5 The Free page entry point

`components/market/currency-index-pro-upgrade-card.tsx` is placed top-right on `/xaux-vs-usdx`, per
the screenshot, with the requested copy.

| Visitor    | Result                                                                                                                                                                                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signed out | `/login?callbackUrl=/pro/currency-index/compare`; since Round 2 (§7) sign-in returns there                                                                                                         |
| FREE       | Opens `ProUpgradeModal`, the same gate `/free` uses for every PRO feature; its CTA goes to `/pricing`                                                                                              |
| PRO        | Straight to `/pro/currency-index/compare`. **Label changes to "Open PRO Chart"**, a small deviation from the literal "Upgrade to PRO", since that wording is wrong for someone who already has PRO |

---

## 3. Bugs found and fixed along the way

1. **Free page: the M15 XAUX line was silently always empty.** `isM15CloseBar()` measured offsets
   from XAUX's raw 01:01 anchor, but every real M5 bar sits on the 5-minute grid, so XAUX offsets were
   always 240/540/840 mod 900 and never 600. The original test passed only because its XAUX fixture
   bars sat at anchor + 600 (01:11), a time no M5 bar can have. Fixed by flooring the anchor to its
   containing 5-minute bar. The corrected tests **fail 2 of 6 against the pre-fix code**, proving the
   bug was real. There is no production data yet, so no user ever saw it.
2. **Candle price label lost its color on rising bars** (found live). A candlestick's last-value label
   takes the last bar's body color, which is transparent for a hollow rising candle. The close line
   series now carries the colored label in every plot type, with only its stroke hidden in candle
   modes. In Heiken Ashi mode that label shows the real close, not the synthetic HA close.
3. **A test that couldn't catch what it claimed to** (found by mutation). With the High/Low rule
   flipped, the engine's invariant tests still passed, because the final clamp pinned an inverted High
   to the body edge and a `>=` check accepted it. The tests now require a strictly wider range; the
   flipped rule fails 3 tests.
4. **An "on" chip with no line.** HRMA draws nothing with fewer bars than its period (MQL5 behavior),
   which left an enabled chip and no explanation. The chip now says "needs N bars".

---

## 4. Verification

| Check                                                                                                                       | Result                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test_currency_gold_index_ohlc.py` (new, standalone)                                                                        | **13/13**. Includes the exponent form reproducing `index_value()`/`xaux_value()` for all 9 indices (random rates, 1e-9), USDX High vs the MQL5 rule computed by hand, XAUX exponents vs `XAUX_H1_High.mq5`, idempotent outbox migration                                                 |
| Mutation: High/Low rule flipped (on a temp copy; real file hash unchanged)                                                  | **3 tests fail**                                                                                                                                                                                                                                                                        |
| `prisma migrate diff` vs authored migration                                                                                 | Identical; both schemas `prisma validate` clean                                                                                                                                                                                                                                         |
| railway-gateway `tsc` / `npm test` / `npm run test:e2e`                                                                     | Clean · **5/5 suites, 68/68** (+1) · **4/4 suites, 43/43** (+3: with OHLC, without OHLC, non-numeric high)                                                                                                                                                                              |
| Monolith `tsc --noEmit` / ESLint (0 warnings) on every touched file                                                         | Clean                                                                                                                                                                                                                                                                                   |
| Monolith `npm run test:ci`                                                                                                  | **203/203 suites, 2705/2705 tests** — the Free page's 198/2657 baseline plus exactly this session's 5 suites / 48 tests, zero regressions                                                                                                                                               |
| Live, real `next dev`                                                                                                       | Upgrade card placement matches the screenshot; signed-out click → `/login?callbackUrl=…`; direct signed-out visit to the PRO page → `/login`; the real API → **401** for an anonymous caller                                                                                            |
| Live, PRO workspace (throwaway unauthenticated preview route, synthetic candles via a page-local `fetch` stub; **deleted**) | Line / OHLC / Heiken Ashi each render correctly; HRMA/SMMA values identical across plot types; per-line hide works; rebase separates both indices; Index B swap and None both work; the drawn horizontal line survives plot-type and index switches; light and dark themes both correct |

**Not verified live:** a genuinely authenticated FREE click (modal) or PRO click (navigation). Both are
unit-tested, but the Executor never enters credentials. Also unverified: any real Lane 4 data, since
the VPS engine isn't deployed.

---

## 5. What Davin needs to do — ORDER MATTERS

### 5.0 Current state (after migration apply on 2026-09-13)

> **✔ `railway-gateway` is DEPLOYED and migration `20260913120000_add_currency_gold_index_ohlc` is APPLIED.**
>
> - Migration `20260913120000_add_currency_gold_index_ohlc` was applied to the live production database
>   (`maglev.proxy.rlwy.net:58290`) via `npx prisma migrate deploy --config prisma.production.config.ts`.
> - Status verified with `prisma migrate status`: "Database schema is up to date!".
> - Production PostgreSQL `currency_gold_indices` table now has `open`, `high`, and `low` columns.
> - The gateway processor's upsert queries will now safely execute once the VPS engine begins pushing.

1. ~~**Apply the migration:** `20260913120000_add_currency_gold_index_ohlc`~~ **APPLIED AND CONFIRMED LIVE (2026-09-13).**
2. ~~Only then deploy `railway-gateway`~~ **Already deployed** (see §5.0).
3. **Redeploy the VPS engine** (`currency_gold_index_engine.py`). Its outbox migrates itself on start.
   This rides along with Lane 4's still-open VPS deployment items.
4. **Authenticated click-through:** the FREE click (modal), the PRO click (page), a real sign-in
   landing on its `callbackUrl` (§7), and a PRO user with real data once Lane 4 is live.

---

## 6. Out of scope / still open

- No persistence of periods, plot type, selection or drawings (matches the Free page; `localStorage`
  would be the natural fit if wanted).
- Translation: 24 new strings identity-mapped in `en-US`/`en-GB` only, per Lane 4's precedent.
- Chaining treats inter-session gaps as zero movement (documented on the page itself).
- **Pre-existing, found during Round 2's sidebar check, not changed:** in a **collapsed** FREE sidebar
  the existing "Upgrade to PRO" CTA (`chat-sidebar.tsx`) isn't collapse-aware; its label overflows
  the 64px rail. Unrelated to the new buttons, which render as padlock icons when collapsed.

The three items originally flagged here (the Free chart's dark gold, `login-form.tsx` ignoring
`callbackUrl`, and the PRO layout redirecting without a return address) were **fixed in Round 2**;
see §7.

---

## 7. Round 2 — Davin's follow-ups (2026-09-13, same day)

Davin reviewed §2.5's two judgment calls and §6's three flagged items, and added one feature
(an annotated screenshot of `/terminal`). Asked item by item which way "fix" meant for the two
judgment calls, he chose to **keep both**.

| #   | Item                                                  | Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PRO users' card button reads "Open PRO Chart"         | **Kept** (confirmed by Davin). No code change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | "Compare indices" link in the 28-pair screener header | **Kept** (confirmed by Davin). No code change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 3   | Free chart's dark-mode gold failed the dataviz check  | **Fixed.** `xaux-usdx-comparison-chart.tsx` XAUX dark step `#eda100` → `#c98500`, the value that passes every check in both modes, all-pairs with the blue (the PRO chart already used it). The validator commands are recorded next to the constant.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 4   | Login ignored `callbackUrl`                           | **Fixed, safely.** New `lib/auth/safe-callback-url.ts` accepts **only a same-site relative path** and falls back to `/dashboard` otherwise. It rejects absolute and protocol-relative URLs, backslash tricks (`/\evil`), schemes, control characters and whitespace, and loops back to `/login`/`/register`/`/verify-2fa`, since honouring a query-string URL is a textbook open redirect. Wired into `login-form.tsx` (both the bridge and NextAuth paths), the **2FA step** (`callbackUrl` forwarded only when present, so the plain `/verify-2fa?token=` URL is unchanged), and Google/X sign-in.                                                        |
| 5   | `/pro/*` layout redirected to `/login` with no return | **Fixed in `middleware.ts`**, which already adds `callbackUrl` for its protected prefixes: added `'/pro/'`. The trailing slash is deliberate, so `/pricing` or a future `/promo` isn't gated. The layout's own redirect stays as the backstop (the middleware fails open by design).                                                                                                                                                                                                                                                                                                                                                                        |
| 6   | Two PRO buttons in the workbench sidebar              | **Built.** New `components/sidebar/pro-feature-links.tsx`, rendered by `chat-sidebar.tsx` above PNG Download: "28-Pair Screener" → `/pro/currency-index`, "Currency Index Comparison PRO" → `/pro/currency-index/compare`. On the FREE workbench (`/free`) each is **frosted glass with a padlock and "Upgrade to PRO"**, linking to `/pricing` (the same destination the sidebar's own locked PNG Download uses); the feature name stays visible, blurred, underneath. A collapsed sidebar shows icons (padlocks for FREE). The overlay tint uses literal colors, not `bg-background/NN`, which renders transparent in this app (§4 of the Free manifest). |

**Verification (Round 2):**

- New `safe-callback-url.test.ts` **25/25** (every rejection class above, plus accepted paths).
- `login-form.test.tsx` +3: lands on a safe `callbackUrl`; an off-site one lands on `/dashboard`;
  the `callbackUrl` is carried through 2FA.
- `auth-verify-2fa.test.tsx` +3: safe, off-site, and missing `callbackUrl`.
- `middleware.test.ts` +5: both PRO pages redirect with a return address; `/pricing`, `/products` and
  `/promo` aren't gated.
- New `pro-feature-links.test.tsx` **3/3**: PRO links, FREE locked links with accessible names, and
  the collapsed sidebar.
- Full monolith `npm run test:ci` **205/205 suites, 2744/2744 tests**: Round 1's 203/2705 plus
  exactly these 2 suites / 39 tests. `tsc` and ESLint are clean.
- **Live, real `next dev`:**
  - A signed-out fetch of `/pro/currency-index` follows the redirect to
    `/login?callbackUrl=%2Fpro%2Fcurrency-index`.
  - The real `ChatSidebar`, rendered for PRO, FREE and collapsed FREE on a throwaway unauthenticated
    route (deleted afterwards): both buttons sit above PNG Download exactly as in the screenshot; the
    FREE variants show the frosted padlock overlay (computed: `rgba(2,6,23,0.45)` tint, 2px backdrop
    blur, 1.5px blur on the label); all six links resolve to the right destinations; light and dark
    themes both correct.
- **Not verified live:** an actual sign-in round trip landing on the `callbackUrl` (the Executor never
  enters credentials; unit-tested only).

**Rollout:** see §5.0. The push deployed `railway-gateway` before the migration. That's harmless
while Lane 4 has no production writes; apply the migration before the VPS engine starts pushing.

---

## 8. Git history

Committed per logical step and pushed to `origin/main`. The pre-push hook's type check and full
`test:ci` passed.

| Commit     | Summary                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `466fad67` | `feat(lane4): index OHLC in engine, gateway contract, schema and migration`                      |
| `03a8be40` | `fix(currency-index): M15 XAUX bars on the 5-minute grid; validated dark gold on the free chart` |
| `741a7b68` | `feat(currency-index): Currency Index Comparison PRO page`                                       |
| `8a70ed8a` | `feat(currency-index): Upgrade to PRO card on /xaux-vs-usdx`                                     |
| `7c71d2ae` | `fix(auth): return to a safe callbackUrl after sign-in; gate /pro/ in middleware`                |
| `b87ade2f` | `feat(workbench): 28-Pair Screener and Currency Index Comparison PRO sidebar buttons`            |
| `a073a5dd` | `docs(ad-hoc): currency index comparison PRO manifest, MQL5 references and cross-links`          |
| _this_     | `docs(ad-hoc): record deployed-before-migration state; bring free page manifest up to date`      |

The MQL5 reference files in this folder are committed, since code comments cite them as ground truth.
Davin's screenshot `currency-index-pro-page.png` is left untracked, matching the Free page folder's
precedent.

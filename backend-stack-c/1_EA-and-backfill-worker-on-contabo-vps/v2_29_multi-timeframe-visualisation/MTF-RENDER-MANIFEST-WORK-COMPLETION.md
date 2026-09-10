# `mtf_render` — Manifest of Work Completion

**Work:** rewrite the multi-timeframe visualisation from three side-by-side panels
to two stacked panels, align it with the v2.29 pipeline, and support the eleven
overlay-producing indicators.
**Executed:** 2026-09-10, single session.
**Plan of record:** `MTF-RENDER-MODIFICATION-PLAN.md` (rev. 3, decisions D1–D5).
**Status:** implementation complete and verified. **Not committed** — left for
Davin's review, per this repo's log-first-defer-commit pattern.

---

## 1. ⚠ FLAGGED ITEMS — read this section first

Davin asked specifically that these three be carried into this document. They are
**not** defects introduced by this work; two pre-date it entirely and one is a
deliberate hold.

### 1.1 ⚠ The PNG download path is not tier-gated, and points at a file that does not exist

**Status: NOT FIXED. Out of scope, and it blocks this work from having any
production effect.**

`components/chat-sidebar.tsx:108-115`:

```typescript
const handleDownloadPng = () => {
  const link = document.createElement('a');
  link.href = '/mtf_render_xauusd_sample.png';
  link.download = 'XAUUSD_Matplotlib_2Panel_Vision_Render.png';
  ...
};
```

Three separate problems, all pre-existing:

| #   | Problem                                                                                                                                                               | Evidence                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | **No entitlement check.** `currentTier` is in scope and used for four other gates in the same file (lines 132, 133, 140, 386); the download button never consults it. | Read directly, 2026-09-10 |
| 2   | **The target file is absent.** `public/mtf_render_xauusd_sample.png` does not exist in the repo — the button downloads a 404.                                         | `ls` verified             |
| 3   | **It is a static placeholder, not wired to this pipeline.** A hardcoded `public/` path, not an R2 fetch.                                                              | Read directly             |

**Why this matters more than it looks.** The entire reason D2 exists — rendering
two variants so the M5-on-M15 overlay stays a PRO entitlement — is defeated if a
FREE user can click Download and receive whichever image the app hands them.
**The renderer now emits correctly-gated variants, and that will change nothing
a user experiences until this path is tier-gated and pointed at R2.** The
screenshot Davin supplied annotates "Image Download is for PRO User" as though it
were enforced; in the code it is not.

**Recommended:** its own session. It is a monolith entitlement + R2 wiring change,
not a renderer change, and it touches money-adjacent tier logic. Also recorded in
the plan (§0.7) and in Stack D V2 §9 item 4.

### 1.2 ⚠ The 3-Panel → 2-Panel rename was far wider than the two labels it appeared to be

**Status: DONE for everything except the pricing-page claim (see 1.3).**

The panel count was not confined to this module. It had **already been ported into
the monolith and translated**. Actual scope, verified rather than estimated:

| Site                                                                    | Count  | Done          |
| ----------------------------------------------------------------------- | ------ | ------------- |
| `components/chat-sidebar.tsx` — button subtitle                         | 1      | ✅            |
| `components/chat-sidebar.tsx` — hardcoded download filename             | 1      | ✅            |
| `lib/i18n/dictionaries/*.json` — `Matplotlib 3-Panel Vision Render`     | **12** | ✅            |
| `components/landing/landing-pricing.tsx` — `3-Panel Read-Only Terminal` | 1      | ⛔ held (1.3) |
| `lib/i18n/dictionaries/*.json` — `3-Panel Read-Only Terminal`           | **16** | ⛔ held (1.3) |

**The subtlety that made this bigger than a find-and-replace:** this codebase uses
the **literal English string as the dictionary key**. Renaming is therefore not a
value edit — the key changes in every dictionary that carries it, and both the key
_and_ its translated value must move together or the lookup silently falls through
to the raw key. Each translation also spells the panel count in its own way
(`Matplotlib-3-Panel-Bildausgabe`, `Render visual de 3 paneles con Matplotlib`,
`Matplotlib 3パネル画像描画`, …), so the value could not be renamed generically.

Handled with a text-level (not `json.load`/`dump`) edit so key order and file
formatting are untouched and the diff is one line per file, with a `json.loads`
validation before each write and an assertion that each value contained exactly
one `3` to change.

**Deliberately excluded:** `seed-code/trading-conversational-ai-ui-pages-increment/`
carries the same strings but is read-only per `CLAUDE.md` non-negotiable #4/#5. The
seed now drifts from the monolith by this rename — expected, not an oversight.

### 1.3 ⚠ AWAITING SIGN-OFF — `3-Panel Read-Only Terminal` on the public pricing page

**Status: DELIBERATELY NOT CHANGED. Needs Davin's explicit decision.**

`components/landing/landing-pricing.tsx:104` renders `t('3-Panel Read-Only
Terminal')` as a **tier feature bullet on the public pricing page**, and the string
is translated across **16** dictionaries.

This is a customer-facing advertised product claim, not internal copy. Changing
"3-Panel" to "2-Panel" there alters what the product is advertised to include, and
`CLAUDE.md` non-negotiable #7 is explicit that an item flagged as needing sign-off
is _not_ covered by general approval of the work. So it was left alone even though
the rest of the rename landed.

**The product is now inconsistent with this claim until it is resolved** — the
terminal renders two panels, the pricing page advertises three. Two ways out:

| Option                                                               | Consequence                                                                                                       |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Change to "2-Panel Read-Only Terminal"                               | Matches reality. Touches 1 component + 16 dictionaries. A visible change to an advertised feature.                |
| Reword to drop the count (e.g. "Read-Only Multi-Timeframe Terminal") | Matches reality and stops the pricing page depending on a layout decision that may change again. **Recommended.** |

Either way it is a marketing decision, not an engineering one.

---

## 2. What was built

### 2.1 The headline finding: the module was broken, not merely outdated

`data_source.py` shipped with `best_fit` in its variant list and built SQL by
interpolation (`f"{variant}_uoedt"`). The 2026-09-03 split renamed that column to
`best_fit_a`/`best_fit_b`, so **every call against a real `xauusd.db` raised
`no such column: best_fit_uoedt`.**

It went unnoticed because `fixture.py` declared its _own_ `best_fit_*` columns —
the test suite was validating the fixture against itself rather than against the
contract, so it stayed green while the module could not read a real database.

Both halves are now closed: the registry holds the real names, and the fixture is
**built from the registry** so it cannot invent a column the code does not use.

### 2.2 Files

| File                                                   | Change                                                                                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mtf_render/overlays.py`                               | **New.** Explicit registry: 10 overlays / 26 columns, every name written out.                                                                                |
| `mtf_render/data_source.py`                            | `Channel`→`Overlay`; `ChartData` gains `own_overlays` + `m5_overlays`; 2 panels keyed `M5`/`M15`; D1 windowing; D2 variant flag.                             |
| `mtf_render/renderer.py`                               | `subplots(1,3)` → `subplots(2,1, sharex=True)`; per-overlay styling; variant-aware titles.                                                                   |
| `mtf_render/fixture.py`                                | Rebuilt from the registry; real column names; M5+M15 over one shared window.                                                                                 |
| `mtf_render/__main__.py`                               | `--overlays`, `--m5-overlay/--no-m5-overlay`, `--both-variants`; `--variant` removed.                                                                        |
| `mtf_render/__init__.py`                               | Exports updated (was still exporting `Channel`/`VARIANTS`).                                                                                                  |
| `test_mtf_render.py`                                   | 3 tests → **15**.                                                                                                                                            |
| `Multi-Timeframe-Visualisation-Architecture-Design.md` | Rewritten for 2 panels / 10 overlays / 2 variants; timestamp caveat rewritten.                                                                               |
| `davintrade-stack-d-and-e/STACK-D-…-V2.md`             | 6 sites: §9 (panels, cadence, filenames, entitlement), Pillar 6, §8 payload comment, §10 orchestrator + `chartVariant` derivation, §12 acceptance criterion. |
| `components/chat-sidebar.tsx`                          | Label + download filename (1.2).                                                                                                                             |
| `lib/i18n/dictionaries/*.json` (12)                    | `Matplotlib 2-Panel Vision Render` key + value (1.2).                                                                                                        |

### 2.3 The eleven indicators

Ten drawable overlays; OHLCV is the candles themselves. ZigZag and Z-Score are
excluded — sparse pivot events and a body classification respectively, neither a
price-level line.

**Two shapes defeat any naming convention**, which is why the registry is a literal
map rather than interpolation:

- `fractal_edt`'s middle line is **`fractal_best_fl`**, not `*_base_fl`.
- `resistance` / `support` are **single lines** with no bands.

### 2.4 Decisions as implemented

| #   | Decision                              | Implemented as                                                                                                     |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| D1  | Match time span                       | `--limit` bounds M5; M15 clipped to `[m5.min, m5.max]`. Verified: M15 range sits inside M5's, ~⅓ the bars.         |
| D2  | Follow the PRO-gated toggle           | Two variants from one snapshot via `--both-variants`. Renderer stays tier-unaware; the caller selects.             |
| D3  | One centroid variant by default       | `DEFAULT_OVERLAY_KEYS = ("best_fit_a",)`; all 10 selectable.                                                       |
| D4  | Lower panel keeps its own M15 channel | `own_overlays` populated on both panels. Guarded by a test asserting the lower panel is never empty in `standard`. |
| D5  | FREE receives no PNG                  | Encoded in Stack D §9/§10 (`chartVariant: … \| null`), not in the renderer.                                        |

---

## 3. Verification

| Check                                       | Result                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `py_compile` on all module files            | clean                                                                                |
| `pytest test_mtf_render.py`                 | **15/15 passed**, no warnings (was 3 tests)                                          |
| Monolith `npx tsc --noEmit`                 | clean, exit 0                                                                        |
| `npx eslint components/chat-sidebar.tsx`    | clean, 0 problems                                                                    |
| Monolith `npm run test:ci`                  | **171/171 suites · 2416/2416 tests**, 141 s — exact baseline match, zero regressions |
| All 10 overlays render without SQL error    | pass                                                                                 |
| Irregular naming (`--overlays fractal_edt`) | renders — proves `fractal_best_fl` is mapped                                         |
| Stale key (`--overlays best_fit`)           | fails loudly with the valid list, before any work                                    |
| Warm-up (all channel columns NULL)          | renders, degrades correctly — see §3.5                                               |
| No M15 rows in range                        | renders, no exception                                                                |
| Visual inspection of rendered PNGs          | done — see §3.2                                                                      |

### 3.1 The parity test was proven to catch the real bug, not merely to pass

Running the check against the **old** column names before adopting the new ones:

```
market_data columns parsed: 87
OLD registry: ['best_fit_uoedt', 'best_fit_base_fl', 'best_fit_loedt']
  MISSING from live schema: all three  ->  verdict: FAIL (drift detected)
NEW registry: 26 columns
  MISSING from live schema: none       ->  verdict: PASS
```

The parser independently recovered **87 columns**, matching the blueprint's stated
count — evidence the DDL parse is correct rather than accidentally lenient.

### 3.2 Visual confirmation

Both variants were rendered and inspected directly, because panel alignment and
legend legibility cannot be asserted:

- **`overlay`** — upper M5 with its blue channel; lower M15 with its own blue
  channel **plus** the cyan dashed M5 channel; both panels on one shared axis
  (10:00–18:00 identical); title reads "M15 channel + M5 channel OVERLAID (PRO)".
- **`standard`** — identical upper panel; lower panel carries its own channel and
  is **not empty**; title reads "**M5 overlay OFF**".
- **multi-overlay** (`best_fit_a,resistance,support`) — remains legible; single
  lines render distinctly from the channel.

### 3.3 Monolith regression suite

**171/171 suites · 2416/2416 tests passed** (141 s) after the W8 rename — an exact
match to the baseline recorded in `CLAUDE.md`, so the 12 dictionary edits and the
component change caused zero drift. No test in `__tests__/` references either
string (verified by grep beforehand). W8 was sequenced last, as its own step,
precisely so any failure would have been unambiguously attributable to it.

### 3.5 A real bug found by edge-case testing, after the suite was already green

Testing a realistic production condition — the earliest bars of a real
`xauusd.db`, where the channel columns are still NULL during indicator warm-up —
surfaced a genuine defect in this session's own new titling logic:

**A PRO user with the toggle ON would have received an image captioned
"M5 overlay OFF".** The title keyed on whether the overlay had _data_, so absent
data was reported as if it were the user's setting. The suptitle had the same
fault and would have labelled a warm-up render `variant: standard` even while
writing it to `..._overlay.png`.

This is precisely the class of ambiguity the variant-aware titles exist to remove,
so it was fixed rather than noted: `ChartData` now distinguishes
`m5_overlay_requested` (the variant) from `has_m5_overlay` (data present), and the
title has **three** states rather than two:

| State                   | Title                                           |
| ----------------------- | ----------------------------------------------- |
| Requested, data present | `M15 channel + M5 channel OVERLAID (PRO)`       |
| Requested, no data      | `M5 overlay ON but NO DATA (indicator warm-up)` |
| Not requested           | `M5 overlay OFF`                                |

Covered by `test_warmup_nulls_are_not_reported_as_overlay_off`. Two further
degradation cases were confirmed non-fatal: all-NULL channels and an empty M15
range both render rather than raising. A `matplotlib` "no artists with labels"
warning surfaced by the same test was fixed at source (skip `legend()` when
nothing is labelled) rather than suppressed.

### 3.4 Not verified — flagged rather than skipped

| Gap                                           | Why                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A render against a real `xauusd.db`**       | No such database exists in this environment, and per deck §11 the VPS pipeline has not yet run a green cycle with the recompiled `.ex5`. All rendering above is against the fixture. The schema-parity test is the strongest available proxy: it checks the real DDL, but cannot prove real data renders sensibly. |
| **Live M5→M15 overlay fidelity**              | Gated on the `.ex5` redeploy (deck §11 action item 1). Ten of thirteen binaries are a build behind. Exact on fixture data; unvalidated on live data.                                                                                                                                                               |
| **Browser verification of the renamed label** | The changed string sits in the PRO chat sidebar behind authentication; the Executor does not enter credentials. `tsc`/`eslint`/suite are clean. Needs Davin's own click-through.                                                                                                                                   |
| **Dependencies**                              | `matplotlib`/`pandas`/`numpy` are absent from both system Pythons here. Verification used a disposable venv in the session scratchpad — nothing was installed into the user's global environment and nothing was added to the repo. `requirements.txt` is unchanged and still correct.                             |

---

## 4. Deviations from the plan

| Deviation                                               | Reason                                                                                                                                                                                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution order 2 and 3 were swapped                    | The plan had the fixture rewritten before the parity test, which would have made the test pass on its first run and prove nothing. The check was run against the old names **first** (§3.1), then the fixture was rebuilt. |
| `resolve()` called before fixture generation in the CLI | Found during verification: an invalid `--overlays` value built an entire fixture database before failing. Validating first is cheaper and puts the real error at the top of the output.                                    |
| The pricing-page string was not renamed                 | See 1.3 — held for sign-off.                                                                                                                                                                                               |
| A second parity test was added beyond the plan          | The plan specified registry-vs-live-schema. Fixture-vs-live-schema was added too, since the fixture inventing columns is the _other_ half of how the original bug hid.                                                     |
| A third title state was added beyond the plan's two     | Edge-case testing showed the two-state design misreported warm-up NULLs as the user's setting (§3.5). The plan's §2 rule 2 demanded the image state absence explicitly; two states could not do that honestly.             |
| 15 tests rather than the planned 13                     | The two extra cover §3.5.                                                                                                                                                                                                  |

---

## 5. What this work does NOT deliver

Stated plainly so it is not mistaken for a finished feature:

1. **No production behaviour change.** The renderer is not yet called by anything.
   R2 upload and the cron trigger are Stack D Engine 3 work (§9), unbuilt.
2. **No enforced entitlement.** Per 1.1, the download path ignores tier and points
   at a missing static file. The two variants exist; nothing selects between them
   yet.
3. **No validation against live data.** Per §3.4.
4. **No pricing-page consistency.** Per 1.3.

---

## 6. Recommended next steps

| #   | Action                                                                    | Owner       | Blocking?                           |
| --- | ------------------------------------------------------------------------- | ----------- | ----------------------------------- |
| 1   | Decide the pricing-page string (1.3)                                      | Davin       | Blocks W8 closing                   |
| 2   | Tier-gate the PNG download and wire it to R2 (1.1)                        | own session | **Blocks D2 having any effect**     |
| 3   | Build the R2 upload + 5-minute cron (Stack D §9)                          | Stack D     | Blocks the LLM ever seeing a render |
| 4   | Recompile the 10 statistic-emitting `.ex5` and redeploy (deck §11 item 1) | Davin       | Blocks live overlay fidelity        |
| 5   | Render against a real `xauusd.db` once 4 lands                            | —           | Closes §3.4                         |
| 6   | Decide §7.1 of the plan: drop the still-forming newest bar?               | Davin       | No                                  |

---

## 7. Still open from the plan

**§7.1 — the newest bar is always still forming.** Deck §10 records that the
export includes the in-progress bar, so the rightmost candle on both panels is
partial and will change. Nothing in the image says so, and a vision model could
read a wick rejection off an artifact. The plan recommends dropping it by default
with an opt-in flag. **Not implemented — it changes what "latest" means to the
LLM, so it needs Davin's call.**

**§7.2 — look-ahead bias is inherited and unfixable here.** Historical channel
values were refitted with data from up to ~2 weeks after the bar. Harmless for a
live chart, which wants the newest fit. Recorded only so the rendered history is
never mistaken for a point-in-time backtest input.

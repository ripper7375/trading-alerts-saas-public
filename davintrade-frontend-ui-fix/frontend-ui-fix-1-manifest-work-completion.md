# Frontend UI Fix 1 — Work Completion Report

**Date:** 2026-09-14 (one session, three rounds)
**Status:** Code complete, verified, committed and pushed to `origin/main` (§6), in three rounds:

- **Round 1** (§1): the `/terminal` and `/free` workbench. The sidebar and the AI Analyst / Market
  Comments panels now really collapse and expand.
- **Round 2** (§2): the charts inside that workbench now follow their panel's width, and the drawing
  toolbar fits the chart height.
- **Round 3** (§3): "AI Workbench" and "28-Pair Screener" buttons on both PRO currency index pages;
  the old back link on the comparison page is removed.

Browser-side only: no API, schema, migration or VPS change, so everything ships with the monolith
deploy. Final full suite: **218/218 suites, 2850/2850 tests**. Open items: §5.

**Type:** Ad-hoc UI fix session, requested directly in chat with annotated screenshots (shared in chat,
not saved to the repo). Outside the phase/session numbering, per
`docs/migration-orders/EXECUTOR-PROTOCOL.md` §6.

> **Scope:** the PRO and FREE workbench (`/terminal`, `/free`) and the headers of the two PRO currency
> index pages (`/pro/currency-index`, `/pro/currency-index/compare`). Every visual claim below was
> checked on a local `next dev` through a throwaway unauthenticated preview route, deleted before
> each commit; none was checked signed in on `davintrade.app` (§5).

---

## 1. Round 1 — sidebar and panel collapse

### 1.1 What was asked

Six annotated screenshots of `/terminal`:

| #   | Davin's step                                    | What he saw                                               |
| --- | ----------------------------------------------- | --------------------------------------------------------- |
| 1–2 | Clicked the sidebar's collapse chevron          | Icons appeared, but the sidebar kept its full width       |
| 3–4 | Dragged the sidebar narrow, then clicked expand | Labels came back squeezed into a panel that stayed narrow |
| 5–6 | Collapsed the AI Analyst panel                  | No button to expand it again                              |

### 1.2 Root cause, reproduced before changing anything

The collapse buttons changed what a panel **rendered**, never its **size**. Measured at 1600px on the
unmodified code:

| Step                | Sidebar   | AI Analyst | Chart | Comments  | Notes                                  |
| ------------------- | --------- | ---------- | ----- | --------- | -------------------------------------- |
| Initial             | 251px     | 377px      | 597px | 345px     |                                        |
| Collapse sidebar    | 251px     | 377px      | 597px | 345px     | Icons shown, nothing resized           |
| Collapse AI Analyst | **333px** | removed    | 790px | **457px** | Every panel grew, the sidebar included |

- **Sidebar:** `isSidebarCollapsed` only switched `ChatSidebar` to its icon column. The enclosing
  `ResizablePanel` stayed at `defaultSize={16}`. The collapsed state and the dragged width were two
  separate sources of truth, which is why expanding after a drag re-showed labels in a narrow panel.
- **AI Analyst / Market Comments:** these were **conditionally unmounted**. When a panel unmounts,
  `react-resizable-panels` 2.1.9 rebuilds the layout from the remaining panels' `defaultSize`s (16 / 38 /
  22, scaled to 100%). That grew every panel, including the sidebar, and threw away any manual
  resizing. The reopen button moved to a thin bar above the whole workspace, which Davin did not find.
- The seed prototype (`seed-code/trading-conversational-ai-ui-pages-increment/app/terminal/page.tsx`)
  has the identical code, so the bug was ported faithfully.
- `/terminal` and `/free` were line-for-line copies, so both had it.

### 1.3 What was built

- **`components/workspace/trading-workspace.tsx` (new):** the 4-panel workbench, now shared by both
  pages. `app/terminal/terminal-workspace.tsx` and `app/free/free-workspace.tsx` just render it with
  `tier="PRO"` / `tier="FREE"` (FREE also keeps its `ProUpgradeModal`).
  - All four panels stay mounted.
  - The sidebar, AI Analyst and Market Comments are `collapsible`, with a collapsed size (a rail).
  - **The panel group's layout is the single source of truth.** Buttons call the group's
    `setLayout`; dragging a handle past a panel's minimum collapses it. The library's
    `onCollapse`/`onExpand` callbacks decide which content each panel shows, whichever of the two moved
    it.
  - Space freed by a collapse goes **only to the chart**; the other panels keep their widths.
  - Reopening restores the width the panel had before it collapsed. For a drag, that is the width
    **before the drag started**, captured through the resize handle's `onDragging`. Without that, a
    drag-collapsed sidebar reopened at its minimum, because the drag passes through the minimum before
    snapping shut (the first version did exactly this: 199px instead of 251px).
- **`components/workspace/panel-layout.ts` (new):** the layout maths as pure functions.
  - Rails are sized in **pixels** (sidebar 64px, side panels 44px) and converted to percentages
    against the measured group width, because the library only accepts percentages and a fixed icon
    column needs a fixed width. A `ResizeObserver` keeps the conversion current.
  - The expanded sidebar's minimum is 200px, capped at its 16% default on narrow screens so the default
    never falls below the minimum.
  - Expanding takes space from the chart first (down to its 25% minimum), then from other expanded side
    panels, never from a collapsed one.
- **`components/workspace/collapsed-panel-rail.tsx` (new):** what a collapsed AI Analyst or Market
  Comments panel shows. It is a full-height button in the panel's own place, with a chevron, the panel
  icon and its name written vertically, named "Show AI Analyst" / "Show Comments" (the existing
  translation keys). **The old bar above the workspace is removed.**
- **`components/chat-sidebar.tsx`:** fixes that only became visible once the rail was really 64px wide.
  - The collapsed FREE "Upgrade to PRO" button is icon-only. Its label overflowed the rail (already
    recorded as a known issue in the comparison PRO manifest §6).
  - Management icons are centred (a stray `mr-2` applied even when collapsed).
  - Icon-only nav, management and session items get `title` and `aria-label` when collapsed.

### 1.4 Verification

| Check                                                                             | Result                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`, ESLint, Prettier                                                  | Clean                                                                                                                                                                                                    |
| New `panel-layout.test.ts`                                                        | **19/19**: pixel-exact rails at several widths, minimum capping, freed space to the chart only, restore, donor order, collapsed panels never donate, refusing an expand that can't fit                   |
| New `trading-workspace.test.tsx` (children stubbed, sizes from `data-panel-size`) | **5/5**: sidebar resize and content sync, AI Analyst and Market Comments stay mounted with an in-place reopen button, a keyboard resize past the minimum snaps the sidebar shut and switches its content |
| Mutation (file restored byte-exact, checked by sha256)                            | Toggle flips content only (the original bug): **4 fail**. Collapse callback no longer syncs content: **4 fail**. Freed space to the neighbouring panel: **3 fail**                                       |
| Full monolith `npm run test:ci`                                                   | **216/216 suites, 2833/2833 tests**: the 214/2809 baseline plus exactly these 2 suites / 24 tests                                                                                                        |
| Live, 1600px, all six screenshot steps                                            | Sidebar collapse **64px** (chart 597 → 784px, others unchanged); AI Analyst collapse **44px** (chart 929px); Market Comments collapse **44px**; each reopen restores 251 / 377 / 597 / 345 exactly       |
| Live, real mouse drag                                                             | Dragging the sidebar narrow snaps it to the 64px rail with icons; expand then restores **251px** (the pre-drag width)                                                                                    |
| Live, window 1600 → 1100px with all three collapsed                               | Rails stay **64 / 44 / 44px**                                                                                                                                                                            |
| Live, FREE collapsed sidebar                                                      | Upgrade button 43px wide, nothing overflows the rail; the FREE upgrade modal still opens                                                                                                                 |
| Console                                                                           | No panel-library or new React warnings (only the pre-existing ticker-tape `allowTransparency` warning)                                                                                                   |

**Not verified:** dark mode visually (a hand-set guest cookie didn't switch the page chrome; the rail
reuses the panel headers' own colour tokens and `dark:` classes).

---

## 2. Round 2 — charts follow their panel, drawing toolbar fits the chart

### 2.1 What was asked

A production screenshot of `/terminal` after Round 1 deployed, all panels collapsed: the chart did not
widen into the freed space (its inner border stopped mid-card), and the drawing toolbar ran past the M5
chart onto the M15 label.

### 2.2 Root cause

1. **Chart width.** `components/charts/trading-chart.tsx` resized the canvas only on the browser
   window's `resize` event. Collapsing or dragging a panel changes the chart's container without
   resizing the window, so the canvas kept its width from page load. Dragging a divider already had
   this bug before Round 1; Round 1 made it obvious by making collapse change widths.
2. **Toolbar height.** `components/charts/drawing/Toolbar.tsx` was a fixed single column of 11 buttons,
   about 460px tall with no limit. A stacked M5/M15 chart is about 375px tall on a 1024px-high window.
   The overlap is visible in Davin's very first Round 1 screenshot, so it predates this session.

### 2.3 What was built

- **`trading-chart.tsx`:** the window listener is replaced by a `ResizeObserver` on the chart's own
  container, applying `{ width }` when it changes and ignoring zero or unchanged widths. The container
  is a block box whose width comes from its parent, never from the canvas inside, so resizing the chart
  cannot loop.
- **`Toolbar.tsx`:** new `chartHeight` prop and exported `toolbarLayout()`:

  | Chart height | Layout                                                             | Toolbar height |
  | ------------ | ------------------------------------------------------------------ | -------------- |
  | ≥ 475px      | **One column**, as before                                          | 459px          |
  | 302–474px    | **Two columns**: tools, then actions (style, alerts, add, delete)  | 286px          |
  | < 302px      | **Grid**: every button, as many rows as fit, wrapping into columns | fits the chart |

  The pixel constants mirror the Tailwind classes (h-9 buttons, gap-1, padding, separator) and are
  documented next to them, so a class change must update them too.

- **`DrawingLayer.tsx`:** passes the chart height through; `trading-chart.tsx` supplies it.

### 2.4 Verification

| Check                                                | Result                                                                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`, ESLint, Prettier                     | Clean                                                                                                                                                      |
| New `__tests__/drawing/toolbar.test.tsx`             | **10/10**: each threshold on both sides, grid row count, all 11 buttons in every layout, tools and actions in separate columns                             |
| `trading-chart.test.tsx` (+4)                        | Observes the chart container; resizes to the new width; ignores zero and repeat widths; disconnects on unmount                                             |
| Mutation (restored byte-exact)                       | Chart no longer observed (window-only, the original bug): **4 fail**. Toolbar always one column: **8 fail**. Separator left out of the height: **1 fails** |
| Full monolith `npm run test:ci`                      | **217/217 suites, 2847/2847 tests**: 216/2833 plus exactly 1 suite / 14 tests                                                                              |
| Live, 2000×1024 (Davin's size), all panels collapsed | Canvas **1752px** in a 1753px container; toolbar two columns, 286px, inside the 436px chart area                                                           |
| Live, 1600×1300                                      | One column, measured **459px, matching the formula**, 107px clear of the chart bottom; canvas followed the window resize                                   |
| Live, 1600×680                                       | Grid of 6 rows × 2 columns (86×246px), all 11 buttons inside the frame, 10px clear of the chart bottom                                                     |

One reading during verification showed the canvas lagging after re-expansion (1072px in a 683px
container). It was the hidden preview pane throttling rendering: a second later it read 682 / 683px.

The "Error loading chart / websocket error" in Davin's production screenshot is the live price feed
connection, not part of this change (§5).

---

## 3. Round 3 — PRO page header buttons

### 3.1 What was asked

Two annotated screenshots:

- **`/pro/currency-index/compare`:** remove "← 28-pair relative-strength screener"; add orange "AI
  Workbench" and "28-Pair Screener" buttons.
- **`/pro/currency-index`:** add the same two buttons.

### 3.2 What was built

- **`components/currency-index-pro/pro-page-nav.tsx` (new):** the two amber buttons, shared by both
  pages.
  - **AI Workbench → `/terminal`**, the name the marketing footer already uses for it.
  - **28-Pair Screener → `/pro/currency-index`**, the workbench sidebar's existing name.
  - The link to the page you're on is marked `aria-current="page"`. On the screener page the "28-Pair
    Screener" button points to itself; it looks identical, as in the mockup.
  - Rendered as a `nav` named "PRO pages"; the buttons wrap on narrow screens.
- **`currency-index-comparison-workspace.tsx`:** the back link (and its `Link` / `ArrowLeft` imports) is
  removed. The buttons sit top-right with the M5/M15 toggle below them.
- **`pro-currency-index-cockpit.tsx`:** the buttons sit before "Compare indices" and "Settings".
- **Dictionaries:** the removed link's key is swapped for the nav's "PRO pages" label in `en-US` and
  `en-GB`, the only dictionaries holding it. "AI Workbench" and "28-Pair Screener" already had keys.

### 3.3 Verification

| Check                                                                | Result                                                                                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`, ESLint, Prettier; both dictionaries still valid JSON | Clean                                                                                                                                                    |
| New `pro-page-nav.test.tsx`                                          | **2/2**: labels, destinations and order; `aria-current` only on the screener link when on the screener                                                   |
| `currency-index-comparison-workspace.test.tsx` (+1)                  | The page heads with both buttons and the old link text is gone                                                                                           |
| Full monolith `npm run test:ci`                                      | **218/218 suites, 2850/2850 tests**: 217/2847 plus exactly 1 suite / 3 tests                                                                             |
| Live, 1600px                                                         | Comparison page: back link gone, buttons top-right above M5/M15. Screener page: AI Workbench, 28-Pair Screener, Compare indices, Settings, in that order |
| Live, 390px                                                          | Both headers wrap with no horizontal overflow                                                                                                            |

---

## 4. Process issues found and handled

Recorded because each could have left the repo or the report wrong.

1. **A push that looked failed but had landed (Round 1).** Filtering `git push` output with
   `Select-Object -First` in PowerShell stops the pipeline early, and the command reported exit -1.
   `git fetch` showed `origin/main` at the new commit; the pre-push hook blocks the push on failure, so
   it had passed. Later pushes wrote their full output to a log file instead.
2. **A byte-order mark (Round 1).** PowerShell 5.1's `Set-Content -Encoding utf8` wrote a BOM ahead of
   `'use client'` in `trading-workspace.tsx`. Found by inspecting the first bytes and stripped before
   commit.
3. **A commit under the wrong message (Round 3).** PowerShell 5.1 mangled the double quotes in the
   feature commit's message, so that commit failed and the staged files were swept into the docs
   commit. It was not yet pushed, so it was undone with `git reset --soft HEAD~1` and redone as two
   commits, with messages passed from files (`git commit -F`).
4. **Mutation runs** used a script that always restores the target and checks the sha256 before and
   after, so a crashed run can't leave a mutated file behind.

---

## 5. Out of scope / still open

- **Signed-in click-through on `davintrade.app`** for all three rounds. The Executor never enters
  credentials, so every live check ran on a local preview route.
- **Dark mode** of the collapsed rails and the new toolbar layouts, not seen visually (§1.4).
- **Pointer-drag restore** (reopening at the pre-drag width) is verified live only; jsdom has no layout
  for pointer drags. The keyboard-resize path is unit-tested.
- **Panel sizes are not remembered across page loads** (no `autoSaveId`). Unchanged from before; easy
  to add if wanted.
- **The production chart's "Connection failed: websocket error"** is the live price feed, unrelated to
  these changes.
- **Pre-existing, not changed:** the screener page's own "Currency Index PRO", "Compare indices" and
  "Settings" text is hardcoded English, not passed through `t()`.

---

## 6. Git history

Committed per logical step and pushed to `origin/main`. Each push's pre-push hook ran the type check
and full `test:ci`, which passed.

| Commit     | Summary                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------- |
| `fac6ffa8` | `fix(workspace): collapse sidebar and side panels by resizing them` (Round 1)                |
| `1786871c` | `docs(ad-hoc): record workbench sidebar/panel collapse fix in CLAUDE.md`                     |
| `4b1b0d9a` | `fix(charts): resize charts with their panel and fit the drawing toolbar` (Round 2)          |
| `27cc73a4` | `docs(ad-hoc): record chart resize and toolbar fit follow-up in CLAUDE.md`                   |
| `2130237e` | `feat(currency-index): AI Workbench and 28-Pair Screener buttons on the PRO pages` (Round 3) |
| `e801d719` | `docs(ad-hoc): record PRO page header buttons in CLAUDE.md`                                  |
| _this_     | `docs(ad-hoc): frontend UI fix 1 work completion manifest`                                   |

### Files changed

| Round | Files                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | New: `components/workspace/{trading-workspace.tsx, panel-layout.ts, collapsed-panel-rail.tsx}`, `__tests__/components/workspace/{panel-layout.test.ts, trading-workspace.test.tsx}`. Changed: `app/terminal/terminal-workspace.tsx`, `app/free/free-workspace.tsx`, `components/chat-sidebar.tsx`                                                                                                                          |
| 2     | New: `__tests__/drawing/toolbar.test.tsx`. Changed: `components/charts/trading-chart.tsx`, `components/charts/drawing/{Toolbar.tsx, DrawingLayer.tsx}`, `__tests__/components/charts/trading-chart.test.tsx`                                                                                                                                                                                                               |
| 3     | New: `components/currency-index-pro/pro-page-nav.tsx`, `__tests__/components/currency-index-pro/pro-page-nav.test.tsx`. Changed: `components/currency-index-comparison/currency-index-comparison-workspace.tsx`, `components/currency-index-pro/pro-currency-index-cockpit.tsx`, `__tests__/components/currency-index-comparison/currency-index-comparison-workspace.test.tsx`, `lib/i18n/dictionaries/{en-US,en-GB}.json` |

Davin's two untracked screenshots in `davintrade-currency-index-comparison-pro-stack/`
(`additional-modification.png`, `mutually-exclusive-rule-removal.png`) belong to earlier work and were
left untouched.

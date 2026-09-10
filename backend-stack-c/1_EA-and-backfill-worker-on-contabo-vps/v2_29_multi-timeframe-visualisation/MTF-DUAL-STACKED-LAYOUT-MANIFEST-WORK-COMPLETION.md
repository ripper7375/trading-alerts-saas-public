# Dual-Stacked Chart Layout — Manifest of Work Completion

**Work:** bring `/terminal` and `/free` to the two-stacked-chart layout (XAUUSD M5
upper, M15 lower), matching the rendered PNG.
**Executed:** 2026-09-10.
**Plan of record:** `MTF-DUAL-STACKED-LAYOUT-PLAN.md` (decisions D7–D10).
**Closes:** `MTF-RENDER-DELIVERY-MANIFEST-WORK-COMPLETION.md` §7.6.
**Status:** implementation complete, verified, **committed and pushed**.

| Commit     | Scope                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| `6cd42cbe` | The layout — chart props, the composite, both workspaces, 6 tests       |
| `8b486593` | This manifest, the plan, delivery-manifest §7.6, workspace doc comments |

---

## 1. What shipped

| File                                                                | Change                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `components/charts/trading-chart.tsx`                               | Four **defaulted** props: `height`, `showHeader`, `showFooter`, `label`. Plus a reactive height effect. |
| `components/charts/mtf-stacked-charts.tsx` **(new)**                | Composes an M5 instance above an M15 instance.                                                          |
| `app/terminal/terminal-workspace.tsx`                               | Uses the composite; timeframe selector + state removed.                                                 |
| `app/free/free-workspace.tsx`                                       | Same.                                                                                                   |
| `__tests__/components/charts/mtf-stacked-charts.test.tsx` **(new)** | 6 tests.                                                                                                |
| Module design doc, delivery manifest §7.6                           | Updated.                                                                                                |

**No new dependencies.**

## 2. The decision that made this small

D7 — **compose two existing `TradingChart` instances** rather than port the
seed's 856-line dual-chart component.

The monolith's chart was already self-contained and parameterized by timeframe,
and it carries three things the seed's version does not: the reactive
`applyOptions()` appearance effect (the 2026-09-04 Theme Mode fix), a real socket
feed, and the drawing layer plus alert markers. A wholesale port would have had
to reproduce all three, and the seed additionally reads theme through
next-themes' `useTheme()`, which this app **no longer keeps in sync** —
reintroducing a bug already fixed once.

**The best outcome of composing: the PRO overlay toggle needed no change at
all.** `trading-chart.tsx:99` gates it on `timeframe === 'M15'`, so in a stacked
pair it lands on the lower chart and nowhere else, for free.

**The gate that proved the approach:** the plan required the existing
`trading-chart.test.tsx` to pass **unedited** after the prop additions. It did —
19/19, zero changes to that file. Had it gone red, the composition premise was
wrong and the plan said to stop and re-plan.

## 3. ⚠ A test defect I introduced, found rather than dismissed

**This is the part worth reading.** The full suite failed on
`__tests__/components/auth/login-form.test.tsx` — a suite with no relationship to
charts — while my own suite passed.

**Two early conclusions were wrong, and both would have led somewhere bad:**

1. _"It reproduces on two consecutive runs, so it is a real regression."_ The
   third full run passed 175/175. Not deterministic.
2. _"It passes in isolation and alongside my suite, so it is a pre-existing
   flake."_ Also wrong. Removing **only** my test file restored 174/174, which
   proved it was mine — even though my suite itself was green.

**The control that settled it**, and which should have been run first: the
pre-existing chart suite alone is clean; mine alone leaks. Bisecting from there
ruled out, in order, my mock set (leak persisted with `trading-chart.test.tsx`'s
exact mocks), the `ResizeObserver` effect (leak persisted with `totalHeight`
short-circuiting it), and the two-chart composition (one bare chart leaked too).

**Root cause:** the suite wraps components in `LocaleProvider`, which performs a
real geo-IP `fetch()` unless `localStorage` is pre-seeded with locale
preferences. That floating promise resolves **after jsdom tears the window
down**, throwing:

```
TypeError: Cannot read properties of null (reading '_location')
  at Window.get location (jsdom/lib/jsdom/browser/Window.js:376)
  at processTicksAndRejections
```

Because the rejection surfaces in whichever suite Jest runs next in that worker,
it landed on `login-form` — which is why it looked unrelated, intermittent and
not mine, all at once.

**The answer was already written down.** `trading-chart.test.tsx`'s own
`beforeEach` seeds `LOCALE_STORAGE_KEY` with a comment naming the exact symptom
("races jsdom teardown") and citing `LESSONS-LEARNED.md` L40. I had read that
file and read past it. One line fixed it.

**Worth stating plainly:** had the output been filtered slightly differently, or
had the re-run happened to pass first, this would have been recorded as an
unrelated flake and shipped — a new test that intermittently breaks an unrelated
auth suite. The lesson is not "seed localStorage"; it is that _"passes in
isolation, fails in the suite"_ is evidence of a leak, never evidence of
innocence.

Recorded here rather than as a new `LESSONS-LEARNED.md` entry because that file
is at its 40-entry cap and L40 already covers it — this is a **recurrence**, and
arguably the most instructive one so far, since the fix was three lines above
where I was already looking.

## 4. Verification

| Check                                                | Result                                              |
| ---------------------------------------------------- | --------------------------------------------------- |
| `npx tsc --noEmit`                                   | clean                                               |
| `npx eslint` (4 changed files)                       | clean                                               |
| **Composition gate** — existing chart test, unedited | **19/19**                                           |
| New suite                                            | **6/6**                                             |
| Monolith `npm run test:ci`                           | **175/175 suites · 2439/2439 tests**, run **twice** |
| jsdom teardown leaks                                 | **0**, both runs (was 2)                            |

Baseline was 174 suites / 2433 tests, so the delta is exactly this work.

The suite was run twice deliberately: the original failure was intermittent, and
a single green run would not have distinguished "fixed" from "got lucky".

### 4.1 Not verified — flagged, not skipped

| Gap                                         | Why                                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| The layout rendering on screen              | Both workspaces sit behind auth; the Executor does not enter credentials.                                                                             |
| **Exactly two WebSockets, not four or one** | The one I would most want eyes on — it is the operational consequence of D8+D10. Browser devtools, `/terminal`.                                       |
| The FREE-tier locked toggle                 | Needs a FREE account click-through.                                                                                                                   |
| Live socket data at all                     | The earlier renderer session found `/terminal` showing `Disconnected`; the Flask backend may not be reachable from here regardless.                   |
| Height/`ResizeObserver` behaviour           | jsdom's polyfill is a **no-op stub** whose callback never fires, so the measuring path is untested by construction. Only a real browser exercises it. |

The last one is worth emphasising: the pane-splitting maths is the most likely
source of visual fiddliness and has **no** test coverage that means anything.

## 5. Open items

### 5.1 Two WebSockets per viewer, now on both workspaces

D8 + D10 together mean every `/terminal` and `/free` visitor holds two
connections against the single-instance Flask/eventlet backend. Eventlet is
green-threaded so this should be cheap, but it is a doubling. The remedy, if it
ever matters, is one shared socket with two `subscribe` calls — the protocol
already supports it.

### 5.2 The PNG shares a time axis; the screen does not

The renderer clips the M15 panel to the M5 panel's exact clock window, which is
what makes the two read as one comparison. The on-screen charts are independent
`lightweight-charts` instances that pan and zoom separately. M5 and M15 bars do
not map one-to-one, so naive syncing looks wrong. **Arrangement matches; axis
behaviour does not** — a known, chosen gap.

### 5.3 Still open from earlier plans

- Persisting `mtfEnabled` so the download and the LLM can follow the toggle
  (delivery manifest §7.5).
- Whether to drop the still-forming newest bar (renderer plan §7.1).
- The R2 bucket and credentials, without which the download does nothing
  (delivery manifest §5).

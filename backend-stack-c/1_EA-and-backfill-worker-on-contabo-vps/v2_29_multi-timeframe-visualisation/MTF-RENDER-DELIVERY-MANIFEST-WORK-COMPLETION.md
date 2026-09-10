# Chart Render Delivery & PRO Gating — Manifest of Work Completion

**Work:** wire the rendered chart PNGs to private Cloudflare R2 and put the
download behind the PRO entitlement.
**Executed:** 2026-09-10.
**Plan of record:** `MTF-RENDER-DELIVERY-AND-GATING-PLAN.md` (decisions D4–D6).
**Closes:** `MTF-RENDER-MANIFEST-WORK-COMPLETION.md` §1.1.
**Status:** implementation complete, verified, **committed and pushed**.

| Commit     | Scope                                                             |
| ---------- | ----------------------------------------------------------------- |
| `31b3206f` | Monolith download path — R2 client, gate, route, button, 17 tests |
| `55d598bb` | VPS `MT5Renderer` service + NSSM registration                     |
| `56cda36f` | Stack D §9 corrected, prior manifest §1.1 closed                  |
| `6f30ff70` | Plan marked executed                                              |

§3.1 was subsequently found to be **wrong** and is corrected below.

> ⚠ **This is built but not yet functional.** It needs the R2 bucket and
> credentials, which only Davin can create. Until then `/api/chart/download`
> returns **503** and nothing is uploaded. See §5.

---

## 1. What shipped

| File                                        | Role                                                                 |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `lib/storage/chart-keys.ts` **(new)**       | Variant type, object-key naming, untrusted-input coercion. No deps.  |
| `lib/storage/r2.ts` **(new)**               | Private-R2 presigned GET URLs.                                       |
| `lib/auth/permissions.ts`                   | `requireChartDownload()` — PRO gate **with a database re-check**.    |
| `app/api/chart/download/route.ts` **(new)** | `GET`, gated, 307 → presigned URL.                                   |
| `components/chat-sidebar.tsx`               | Plain anchor for PRO; FREE goes to `/pricing`. Dead handler removed. |
| `mtf_render_upload_worker.py` **(new)**     | VPS service: render both variants → upload → prune.                  |
| `install_services.bat`                      | `MT5Renderer` NSSM entry + R2 config block.                          |
| `.env.example`                              | Five `R2_*` keys documented, **names only**.                         |
| 3 new test files                            | 17 tests.                                                            |
| `STACK-D-…-V2.md` §9, the prior manifest    | Public-CDN text replaced; §1.1 closed.                               |

---

## 2. Three decisions, and what each actually bought

### D4 — private bucket + presigned URLs

The alternative was Stack D §9's public CDN URL. With deterministic object names
(`mtf_render_xauusd_m5_m15_overlay.png`), a public bucket makes the gate
**cosmetic**: a FREE user given the URL fetches the file regardless of what the
route decides. Private + ~60 s presigned URLs is the only option where the
entitlement actually holds, and egress still leaves from R2, so the zero-egress
rationale survives — only the _authorization_ moved.

### D5 — the gate re-checks the database

`checkFeatureAccess` reads the JWT only. `requireAffiliate`
(`lib/auth/session.ts:129-142`) deliberately does not, with the comment
"eliminate JWT stale session race condition". Following the JWT-only path here
would refuse a download to a user who had **just paid for PRO** — a billing bug
wearing an auth costume.

`requireChartDownload()` mirrors the affiliate precedent. The extra query runs
**only when the token says the user is not entitled**, so the common path (a PRO
user with a fresh token) costs nothing — pinned by a test asserting
`findUnique` is never called for a PRO session.

Scoped to this gate only, per D5's explicit choice — not the "fix
`checkFeatureAccess` centrally" variant, which would change shared auth
semantics for every PRO feature at once.

### D6 — download path only

The Pillar 6 LLM fetch stays with Session 12-2, whose orchestrator
(`execute7PillarRetrieval()`) does not exist yet.

---

## 3. Findings

### 3.1 ❌ CORRECTED — the toggle DOES exist in the monolith

**This section was wrong when written, 2026-09-10. Corrected the same day.**

**What it claimed:** that the `M5 on M15` toggle did not exist in the monolith at
all, only in seed-code.

**Why that was wrong:** the search was for `isM5OnM15` — the _seed's_ variable
name — rather than for the capability. The monolith implements the same feature
under different names, and has done for some time:

| File                                     | Role                                                           |
| ---------------------------------------- | -------------------------------------------------------------- |
| `components/charts/mtf/MtfToggle.tsx`    | The control. PRO-gated; FREE routes to `/pricing`.             |
| `components/charts/mtf/useMtfOverlay.ts` | Fetches the M5 channel, draws 3 line series on the host chart. |
| `components/charts/trading-chart.tsx`    | Wires both in (lines 98–105, 274).                             |
| `app/api/market-data/channel/route.ts`   | The backing endpoint.                                          |

Triple-gated — `isPro && mtfAvailable && mtfEnabled` — and the hook is inert
while disabled, so a FREE user never even fetches. `mtfAvailable` is
`timeframe === 'M15'`, on the reasoning that overlaying M5 structure onto the M5
chart itself adds nothing.

`useMtfOverlay.ts` is even named in `CLAUDE.md`'s own 2026-09-03 entry, which
this session had already read.

**The lesson, and this session has now hit it twice:** grepping for one
codebase's identifier does not establish that a _capability_ is absent. The
renderer's `best_fit` bug came from trusting a name over the concept; so did
this.

**What survives the correction and what does not:**

- ❌ "There is no toggle to follow" — **false**. There is one.
- ✅ "The route cannot read the toggle state" — **still true, for a different
  reason**: `mtfEnabled` is local React `useState` in `trading-chart.tsx`
  (line 100), never persisted to preferences, a cookie or the database, so a
  server-side route still has nothing to read.
- ✅ The implementation is therefore unchanged: default `overlay`, optional
  `?variant=`, safe because both variants are PRO-only.

The _conclusion_ was right; the _premise_ was wrong. Making the download actually
follow the toggle requires persisting that state — see §7.5.

### 3.2 The AWS SDK forced a better module split

`@aws-sdk/client-s3` ships ESM that Jest will not parse without loosening the
shared `transformIgnorePatterns`. Rather than weaken the test config for every
suite, the pure naming logic moved to `chart-keys.ts` with **no dependencies**.

That turned out better on its own merits: the route imports `parseChartVariant`
without dragging an S3 client into scope, and the parity test — the one that
matters — runs against plain string handling.

### 3.3 Three independent copies of the object name now agree, by test

The filename exists in three places, in two languages, with nothing linking
them: the renderer's `DEFAULT_OUT`, the VPS worker's `KEY_PREFIX`/`OUT_STEM`,
and `chartObjectKey()`. Drift would surface as a **404 on download**, not an
error — the same quiet failure mode that hid the renderer's `best_fit` rename
for months.

`r2-chart-keys.test.ts` parses `mtf_render/__main__.py` directly and asserts the
key matches the filename the CLI actually writes. A three-way check was also run
during this session and confirmed all three agree.

### 3.4 A misconfigured environment returns 503, not 500

Missing R2 credentials are not the caller's fault and must not read as a bug in
the render pipeline. `requireEnv` throws a recognisable message and the route
maps it to **503** with "not configured". Given the bucket does not exist yet,
this is the response Davin will actually see first.

---

## 4. Verification

| Check                       | Result                                                                       |
| --------------------------- | ---------------------------------------------------------------------------- |
| `npx tsc --noEmit`          | clean                                                                        |
| `npx eslint` (5 changed TS) | clean                                                                        |
| New tests                   | **17/17 passed**                                                             |
| Monolith `npm run test:ci`  | **174/174 suites · 2433/2433 tests** — baseline 171/2416 + exactly this work |
| `py_compile` on the worker  | clean                                                                        |
| Three-way key parity        | worker / TypeScript / renderer CLI all agree                                 |
| Live route, real runtime    | see below                                                                    |

### 4.1 The live check proved something the unit tests cannot

Against a real `next dev` with **no R2 credentials set**:

```
GET /api/chart/download                    -> 401 {"error":"Authentication required"}
GET /api/chart/download?variant=standard   -> 401
GET /api/chart/download?variant=<script>   -> 401   (no 500)
```

Zero server errors. The useful part is **401, not 503**: the R2 environment is
absent here, so if the gate ran _after_ signing we would have seen 503. Getting
401 proves the entitlement check short-circuits before any storage work — an
ordering guarantee the mocked tests assert but cannot demonstrate end to end.

### 4.2 Not verified — flagged, not skipped

| Gap                            | Why                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| The R2 round trip              | No bucket or credentials exist. Presigning is unit-tested against a mocked client only; nothing has ever been uploaded or fetched. |
| The VPS service                | No access to the Contabo box. `mtf_render_upload_worker.py` and the NSSM entry are authored and statically checked only.           |
| An authenticated click-through | The Executor never enters credentials. FREE→403 and PRO→307 are proven by test, not by a browser.                                  |
| The FREE-tier button state     | Renders behind auth; the `/pricing` fallback path was not exercised visually.                                                      |

---

## 5. ⚠ Davin's actions — without these, none of this functions

| #   | Action                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Create the **private** R2 bucket `davintrade-renders` and an API token. Do **not** enable public read — that defeats D4.                               |
| 2   | Set the five `R2_*` vars in Vercel. **Production scope** — note the existing preview/production scoping inconsistency already recorded in `CLAUDE.md`. |
| 3   | Fill the R2 block in `install_services.bat` and deploy `mtf_render_upload_worker.py` to `%ROOT%\renderer` on the VPS.                                  |
| 4   | `pip install boto3 matplotlib pandas numpy` on the VPS, then start `MT5Renderer`.                                                                      |
| 5   | Confirm both objects appear under `xauusd/` in R2.                                                                                                     |
| 6   | Click Download as a real PRO user, and confirm a FREE account is sent to `/pricing` instead.                                                           |

---

## 6. Out of scope

| Item                                    | Why                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Stack D Pillar 6 / the LLM fetch        | D6; `execute7PillarRetrieval()` does not exist yet.                     |
| Porting the `M5 on M15` toggle (§3.1)   | A chart-UI port from seed-code. The route is already ready for it.      |
| Fixing `checkFeatureAccess` centrally   | D5 chose the narrow fix; shared auth semantics need their own review.   |
| Consolidating the two storage providers | Vercel Blob (public media) and R2 (private renders) now coexist — §7.1. |

---

## 7. Open items

### 7.1 Two storage providers

The app now uses **Vercel Blob** (media kit, public) and **Cloudflare R2** (chart
renders, private). Defensible — genuinely different access models — but it is two
sets of credentials and two mental models. Recorded, not resolved.

### 7.2 Retention versus a stale download

Objects prune at 48 h. If `MT5Renderer` is down longer, the bucket empties and
Download 404s through the presigned URL. There is no last-known-good fallback.
Acceptable for a live-chart artifact; noted so the empty case is not mistaken for
a bug.

### 7.3 The download is the latest render, not what is on screen

The user's chart may be scrolled or zoomed; the PNG is whatever the last cycle
produced. Inherent to a pre-rendered artifact and matches Stack D §9, but it will
surprise someone. Per-request rendering is explicitly rejected — it would blow
Stack D §2's < 120 ms retrieval budget.

### 7.4 Still open from the renderer plan

`MTF-RENDER-MODIFICATION-PLAN.md` §7.1 — whether to drop the still-forming newest
bar. Unchanged, and it affects what both the download and the LLM receive.

### 7.5 Making the download follow the toggle would need the state persisted

Given §3.1's correction, the remaining gap is narrow and worth stating precisely.
`mtfEnabled` lives in `useState` inside `trading-chart.tsx`, so it is known only
to that component instance, in that tab, until reload. Two consequences:

- The **download route** cannot read it. It would need to become a stored
  preference (user settings, a cookie, or a query param passed by the client at
  click time — the last being cheapest, since `?variant=` already exists).
- The **Stack D Pillar 6 fetch** has the same problem for the same reason, and
  that is the one that actually matters: the LLM should arguably see whatever the
  trader is looking at.

Not built, and not obviously worth building until Pillar 6 exists. Recorded so
the `?variant=` parameter is understood as deliberate groundwork rather than
speculative.

### 7.6 ✅ RESOLVED — the monolith now uses the dual-stacked layout

**Was:** the seed rendered two stacked charts while the monolith rendered one
with a timeframe selector, so the downloaded PNG and the on-screen terminal did
not look alike.

**Built 2026-09-10**, planned as `MTF-DUAL-STACKED-LAYOUT-PLAN.md`.
`components/charts/mtf-stacked-charts.tsx` composes two existing `TradingChart`
instances (M5 above, M15 below) and both `/terminal` and `/free` now use it; the
timeframe selector is gone from both.

**One difference deliberately remains.** The PNG puts both panels on a _shared_
time axis (the renderer's D1). Two `lightweight-charts` instances each own a time
scale and pan independently, and M5/M15 bars do not map one-to-one, so syncing
them was excluded. **Arrangement matches; axis behaviour does not.**

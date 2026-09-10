# Chart Render Delivery & PRO Gating — Plan

**Status:** APPROVED and **EXECUTED**, 2026-09-10. Retained as the design record.
Outcome and deviations: `MTF-RENDER-DELIVERY-MANIFEST-WORK-COMPLETION.md`.
**Date:** 2026-09-10.
**Closes:** `MTF-RENDER-MANIFEST-WORK-COMPLETION.md` §1.1, the one item left open
after the renderer rewrite.
**Scope:** the VPS render→R2 upload service, a tier-gated download endpoint, and
the button that calls it. Implements Stack D V2 §9 (Engine 3) for the download
path only.

**The problem this solves.** The renderer now emits two correctly-separated
variants — `overlay` (PRO, M5-on-M15) and `standard` — but nothing consumes them.
The download button in the monolith is a dead placeholder: no tier check, and a
hardcoded path to a file that does not exist. Until that is wired, **the PRO
entitlement the two variants exist to express has no effect whatsoever.**

---

## 0. Findings — verified against live code before planning

### 0.1 ❌ WRONG — see the manifest's §3.1

> **This finding was incorrect and is retained only as the record of what the
> plan was written against.** The `M5 on M15` capability **does** exist in the
> monolith, as `components/charts/mtf/MtfToggle.tsx` +
> `useMtfOverlay.ts`, wired into `components/charts/trading-chart.tsx` and
> PRO-gated. The search below looked for the _seed's_ variable name rather than
> for the feature.
>
> **The plan's design is unaffected.** `mtfEnabled` is local React state, never
> persisted, so a server-side route still cannot read it — which is the reason
> the route defaults to `overlay` and accepts `?variant=`. Right conclusion,
> wrong premise. Full correction:
> `MTF-RENDER-DELIVERY-MANIFEST-WORK-COMPLETION.md` §3.1.

The original text follows.

`isM5OnM15` returns **zero hits** across the monolith's `app/`, `components/` and
`lib/`. `components/trading-chart.tsx` has no toggle, no M15 container, and no
`m15ViewMode` — it is single-timeframe. The dual-stacked chart, the PRO-gated
toggle and the overlay drawing all live **only in
`seed-code/trading-conversational-ai-ui-pages-increment/`**, unported.

**Consequence.** Decision D2 of the renderer plan was "the render follows the
UI's PRO-gated toggle". In production there is currently **no toggle to follow**
and no persisted state anywhere expressing that preference — it is local React
`useState` in the seed only.

So the download endpoint cannot resolve a variant from user state. It has to
either default, or be told. See D6.

**This does not invalidate the two-variant design** — the entitlement boundary is
real and the renderer is right to express it. It means the _selection_ mechanism
arrives later, with the toggle.

### 0.2 The tier gate already exists, and is already PRO-only

`lib/auth/permissions.ts:24-38` — `multi_timeframe_visualization` is in
`TIER_PERMISSIONS.PRO` and **absent** from `FREE`. Line 430 already exports:

```ts
export const requireMultiTimeframe = createPermissionMiddleware(
  'multi_timeframe_visualization'
);
```

No new permission needs inventing. The entitlement model for this exact feature
was built and then never consulted on the download path.

### 0.3 ⚠ That gate has a stale-session race the affiliate gate explicitly guards against

`requireMultiTimeframe` → `createPermissionMiddleware` → `checkFeatureAccess`
(line 136), which reads `session.user` from the **JWT only**.

`requireAffiliate` (`lib/auth/session.ts:129-142`) does not trust the token:

```ts
if (!session.user?.isAffiliate) {
  // Check database directly to eliminate JWT stale session race condition
  const dbUser = await prisma.user.findUnique({ ... });
```

**Net effect if unaddressed:** a user who has _just paid for PRO_ is refused
their download until the token refreshes. That reads as a billing bug, not an
auth subtlety. Addressed by D5.

### 0.4 There is already a gated-download route to copy

`app/api/affiliate/dashboard/resources/[id]/download/route.ts` is almost exactly
the shape needed: guard → resolve → `NextResponse.redirect(destination, 307)`,
with typed 401/403 handling. Its header notes it is "designed to be used as a
plain `<a href>` so the browser drives the actual download — no client JS
required," which is a better pattern than the current `createElement('a')` dance
and worth adopting.

### 0.5 Client-side tier is not trustworthy — the gate must be server-side

`components/chat-sidebar.tsx:65,71-74`:

```ts
tier = 'PRO',                          // prop default
const currentTier: Tier =
  pathname === '/free' ? 'FREE'
  : ((session?.user?.tier as Tier | undefined) ?? tier);
```

It **defaults to `PRO`** and is partly derived from the URL, so the button can
render enabled for a FREE user while the session is loading. Client gating here
is a UX affordance only; the entitlement has to hold at the route.

### 0.6 No S3/R2 client exists; the repo's existing blob storage is public

`@vercel/blob` is the only storage dependency, and
`lib/marketing-resources/storage.ts:28` uploads with `access: 'public'`.

So "public URL" is not an R2 quirk — it is the pattern already in use here, and
it is exactly what breaks an entitlement when the object name is deterministic
(`mtf_render_xauusd_m5_m15_overlay.png` is trivially guessable). Hence D4.

### 0.7 VPS conventions are NSSM services, not OS cron

`install_services.bat` registers `MT5Relay`, `MT5Collector`, `MT5PushWorker` via
NSSM, each with `AppDirectory`, `AppStdout`/`AppStderr` into `%LOGS%`,
`AppExit Default Restart`, `Start SERVICE_AUTO_START`, and secrets passed through
`nssm set … AppEnvironmentExtra`. The workers themselves are **long-running
Python loops with sleeps** (`IDLE_SLEEP_SEC`/`ACTIVE_SLEEP_SEC` in
`backfill_worker_api_gateway_v5.py`), not scheduled one-shots.

The render/upload service must follow that shape, not Windows Task Scheduler.

### 0.8 The current download handler is a dead placeholder

`components/chat-sidebar.tsx:108-115` — no tier check, and
`link.href = '/mtf_render_xauusd_sample.png'`, a static `public/` path that does
not exist in the repo. It downloads a 404 today.

---

## 1. Decisions taken

Confirmed by Davin in chat, 2026-09-10, before drafting.

| #   | Decision                 | Chosen                       | Rationale                                                                                                                                                                                             |
| --- | ------------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D4  | Storage & access control | **Private R2 + signed URLs** | The only option where the gate genuinely holds: a FREE user cannot fetch the object even knowing its name. Costs an S3-compatible client (none in repo) and contradicts Stack D §9's public-CDN text. |
| D5  | Stale-JWT handling       | **Re-check the DB**          | Follow the `requireAffiliate` precedent (§0.3) so a freshly-upgraded user is not refused. One extra query on a rare path.                                                                             |
| D6  | Scope                    | **Download path only**       | VPS upload + gated route + button. Stack D's Pillar 6 LLM fetch stays with Session 12-2, whose orchestrator does not exist yet.                                                                       |

**Deliberately scoped narrower than D5's third option.** Davin chose the
`requireAffiliate`-style re-check, **not** the "fix it centrally in
`checkFeatureAccess`" variant. So the DB fallback is added for _this_ gate only;
every other PRO gate keeps its current behaviour. Changing shared auth semantics
is a bigger blast radius and belongs in its own review.

---

## 2. Target architecture

```
┌─ Contabo VPS ────────────────────┐     ┌─ Cloudflare R2 (PRIVATE) ─┐
│                                  │     │  davintrade-renders/       │
│  xauusd.db                       │     │   xauusd/                  │
│      │                           │     │     …_m5_m15_overlay.png   │
│      ▼                           │     │     …_m5_m15_standard.png  │
│  MT5Renderer  (new NSSM service) │     └────────────┬───────────────┘
│    every 5 min:                  │                  │ no public read
│      render --both-variants   ───┼── S3 PUT ────────┘       ▲
│      upload both to R2           │                          │ presigned GET
│      prune objects > 48h         │                          │ (short TTL)
└──────────────────────────────────┘                          │
                                                              │
┌─ Vercel (monolith) ──────────────────────────────────────────┴──────┐
│  GET /api/chart/download?variant=overlay                            │
│    1. requireChartDownload()   ← PRO gate + DB re-check (D5)         │
│    2. resolve object key from variant                               │
│    3. mint presigned URL (TTL ~60s)                                 │
│    4. 307 redirect                                                  │
│                                                                     │
│  chat-sidebar: <a href="/api/chart/download">  (no client JS)        │
│    FREE → upgrade modal, button never links out                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Why the redirect rather than streaming:** keeps egress on R2 (Stack D §9's
zero-egress rationale survives), keeps the Vercel function fast and memory-flat,
and the short TTL means a leaked URL expires in a minute rather than forever.

---

## 3. Work items

### W1 — VPS: R2 uploader + render loop _(new service)_

New `mtf_render_upload_worker.py` alongside the existing workers. A long-running
loop per §0.7, not a scheduled task:

```
every RENDER_INTERVAL_SEC (300):
    render both variants from xauusd.db into a temp dir
    PUT each to R2 under xauusd/
    prune objects older than 48h
    log; on failure log and continue — never crash the service
```

- Uses `boto3` against R2's S3-compatible endpoint
  (`https://<account>.r2.cloudflarestorage.com`).
- Config via env, matching `backfill_worker`'s
  `os.environ.get(...)` style: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `MTF_DB_PATH`, `RENDER_INTERVAL_SEC`.
- **Must not touch `market_data`'s `synced_at` or any pipeline state.** It is a
  read-only consumer of `xauusd.db`, in the same spirit as the statistics lane's
  isolation rule: a rendering failure can never affect price ingestion.

### W2 — VPS: service registration

Extend `install_services.bat` with an `MT5Renderer` NSSM entry mirroring the
existing three — `AppDirectory`, `AppStdout`/`AppStderr` to `%LOGS%\renderer.log`,
`AppExit Default Restart`, `Start SERVICE_AUTO_START`, and R2 credentials via
`AppEnvironmentExtra`.

Also add `boto3` to the prerequisites comment (line 17 currently says
`pip install aiohttp requests`).

### W3 — Monolith: R2 client

New `lib/storage/r2.ts`. Two exports only:

```ts
export function chartObjectKey(variant: ChartVariant): string;
export async function getSignedChartUrl(variant: ChartVariant): Promise<string>;
```

New dependencies: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.
Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`,
`R2_SIGNED_URL_TTL_SECONDS` (default 60).

Deliberately **not** a general-purpose storage abstraction — it does one thing,
and `lib/marketing-resources/storage.ts` remains the Vercel Blob path for media
assets. Two providers is a real cost, recorded in §7.1.

### W4 — Monolith: the gate with a DB re-check (D5)

New `requireChartDownload()` in `lib/auth/permissions.ts`, modelled on
`requireAffiliate`:

1. `getSession()`; no session → `AuthError('UNAUTHORIZED', 401)`.
2. `hasPermission(session.user, 'multi_timeframe_visualization')` → allow.
3. Otherwise **re-query `prisma.user.findUnique({ select: { tier: true } })`** and
   allow if `tier === 'PRO'`.
4. Otherwise `AuthError('PRO subscription required…', 'PRO_REQUIRED', 403)`.

Step 3 is the whole point: it is what stops a just-upgraded user being refused.

### W5 — Monolith: `GET /api/chart/download`

New `app/api/chart/download/route.ts`, structured on the affiliate download route
(§0.4):

```ts
const variant = parseVariant(searchParams.get('variant')); // 'overlay' default
await requireChartDownload();
const url = await getSignedChartUrl(variant);
return NextResponse.redirect(url, { status: 307 });
```

- **`?variant=` is safe to accept from the client.** Both variants are PRO-only
  artifacts, so the parameter selects _which image_, never _whether you may have
  one_ — it carries no privilege. Unknown values fall back to `overlay` rather
  than erroring.
- Defaults to `overlay` because, per §0.1, there is no toggle state to read yet.
  When the toggle is ported, the client passes `?variant=` and **this route needs
  no change** — that is why the parameter exists now rather than later.
- Error mapping mirrors the affiliate route's: 401 unauthenticated, 403
  non-PRO, 500 otherwise. A missing object → 404 with a clear message (the render
  service may not have run yet).

### W6 — Monolith: the button

`components/chat-sidebar.tsx`:

- Delete `handleDownloadPng` and its `createElement('a')` body.
- PRO → render an `<a href="/api/chart/download">` styled as the existing button,
  per §0.4's precedent (browser drives the download; no client JS).
- FREE → keep the button visible but route it to the upgrade flow, matching how
  the seed's own `M5 on M15` toggle behaves (`onOpenUpgradeModal`) rather than
  hiding it. Consistent with the tier being an upsell surface.
- Update the subtitle if needed — it already reads
  `Matplotlib 2-Panel Vision Render`.

### W7 — Tests

| Test                                                 | Asserts                                                          |
| ---------------------------------------------------- | ---------------------------------------------------------------- |
| unauthenticated → 401                                | no session is refused                                            |
| FREE-tier session → 403                              | **the entitlement actually holds** — the core test               |
| PRO-tier session → 307 with a signed URL             | happy path                                                       |
| JWT says FREE, DB says PRO → 307                     | D5's re-check works (the just-upgraded user)                     |
| JWT says FREE, DB says FREE → 403, one query         | the fallback does not become an always-query path                |
| `?variant=standard` → the standard object key        | variant plumbing                                                 |
| `?variant=garbage` → falls back to `overlay`, no 500 | unknown input is inert                                           |
| `chartObjectKey()` matches the renderer's filenames  | **cross-checks against `__main__.py`'s `_variant_path`** so the  |
|                                                      | two cannot drift — the same class of bug as the `best_fit` split |

### W8 — Docs

| File                                          | Change                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `STACK-D-…-V2.md` §9                          | Bucket is **private**; public CDN URL replaced by the presigned-URL flow. Directly contradicts current text. |
| `STACK-D-…-V2.md` §9 item 4                   | Remove the "not tier-gated today" warning once true.                                                         |
| `MTF-RENDER-MANIFEST-WORK-COMPLETION.md`      | Close §1.1; note the toggle finding (§0.1) against D2.                                                       |
| `DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md` | Add `MT5Renderer` to the service inventory (§8.1/§8.2) if it lists services — confirm, do not assume.        |
| `.env.example`                                | Document the five `R2_*` keys, **names only, no values**.                                                    |

---

## 4. Execution order

1. **W3** R2 client + **W4** gate — pure additions, nothing calls them yet.
2. **W7** the 401/403 tests — written against W3/W4 before the route exists.
3. **W5** the route.
4. **W6** the button.
5. **W1 + W2** the VPS service — last, because it is the only piece that cannot
   be verified here (§5.2) and the monolith half must be provably correct first.
6. **W8** docs.

---

## 5. Verification

### 5.1 What can be verified here

| Check               | How                                                                      |
| ------------------- | ------------------------------------------------------------------------ |
| Type + lint         | `npx tsc --noEmit`, `npx eslint <changed>` (never `npm run lint` — L38)  |
| Regression          | `npm run test:ci` — baseline **171/171 suites · 2416/2416 tests**        |
| The gate            | W7, with the FREE→403 case as the one that actually matters              |
| Key/filename parity | W7's cross-check against the renderer's own `_variant_path()`            |
| Route reachability  | `next dev`; unauthenticated `GET /api/chart/download` → 401, not a crash |

### 5.2 ⚠ What cannot be verified here — flagged, not skipped

- **No R2 bucket or credentials exist.** Creating them is a Cloudflare dashboard
  action the Executor cannot perform. Until they exist, the presigned-URL path
  can only be unit-tested against a mocked S3 client, never end-to-end.
- **The VPS service cannot be run or installed from here** — no access to the
  Contabo box. W1/W2 will be authored and statically checked only, exactly like
  the MQL5 changes in the prior session.
- **A real authenticated click-through** — the Executor never enters credentials.
  The FREE→403 and PRO→307 behaviours will be proven by test, not by a browser.

### 5.3 Davin's actions, without which this cannot ship

| #                                                                          | Action                                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1                                                                          | Create the private R2 bucket `davintrade-renders` and an API token   |
| 2                                                                          | Set the five `R2_*` vars in Vercel (**Production scope** — note the  |
| existing preview/production scoping inconsistency recorded in `CLAUDE.md`) |
| 3                                                                          | Set the same on the VPS via `AppEnvironmentExtra`                    |
| 4                                                                          | Deploy the renderer + collector to the VPS and start `MT5Renderer`   |
| 5                                                                          | Confirm objects appear in R2, then click Download as a real PRO user |

---

## 6. Out of scope

| Item                                   | Why                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Stack D Pillar 6 / the LLM fetch path  | D6. `execute7PillarRetrieval()` does not exist yet; belongs to Session 12-2.                   |
| Porting the `M5 on M15` toggle (§0.1)  | A substantial chart-UI port from seed-code, not a delivery concern. The route is ready for it. |
| Fixing `checkFeatureAccess` centrally  | D5 explicitly chose the narrow fix; shared auth semantics need their own review.               |
| Migrating media assets off Vercel Blob | Two storage providers is a real cost (§7.1) but consolidating is its own decision.             |
| The renderer itself                    | Done and pushed (`7221c268`).                                                                  |

---

## 7. Open items & risks

### 7.1 Two storage providers

After this, the app uses **Vercel Blob** (media kit, public) and **Cloudflare R2**
(chart renders, private). Justifiable — different access models, and R2's
zero-egress matters for images fetched repeatedly by a vision model — but it is
two sets of credentials and two mental models. Recorded rather than resolved.

### 7.2 The 48-hour window versus a stale download

Stack D §9 prunes objects after 48h. If the render service is down longer than
that, the bucket empties and Download returns 404. W5 handles it with a clear
404, but there is no "last known good" fallback. Acceptable for a live-chart
artifact; noted so the empty case is not mistaken for a bug.

### 7.3 The download is always the _latest_ render, not what is on screen

The user's chart may be scrolled or zoomed; the PNG is whatever the last 5-minute
cycle produced. That is inherent to a pre-rendered artifact and matches Stack D
§9's design, but it will surprise someone eventually. A per-request render is the
alternative and is explicitly rejected — it would blow §2's < 120 ms budget.

### 7.4 Still open from the renderer plan

**§7.1 of `MTF-RENDER-MODIFICATION-PLAN.md`** — whether to drop the
still-forming newest bar. Unchanged and still needs a decision; it affects what
both the download and the LLM receive.

---

## 8. Summary

|                        | Before                                   | After                                             |
| ---------------------- | ---------------------------------------- | ------------------------------------------------- |
| Download button        | No tier check; 404 static path           | PRO-gated `<a href>` to a signed URL              |
| FREE user              | Could download whatever was served       | 403 at the route; upgrade modal in the UI         |
| Just-upgraded PRO user | Refused until JWT refresh                | Allowed, via DB re-check (D5)                     |
| Renders                | Written to VPS disk, consumed by nothing | Uploaded to private R2 every 5 min, pruned at 48h |
| Object access          | n/a                                      | Private bucket; ~60 s presigned URLs only         |
| Stack D §9             | Public CDN URL                           | Private bucket + presigned flow                   |

**New files:** 3 (`lib/storage/r2.ts`, the route, the VPS worker).
**Modified:** `permissions.ts`, `chat-sidebar.tsx`, `install_services.bat`,
`.env.example`, tests, 3 docs.
**New dependencies:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
(monolith); `boto3` (VPS).

**Blocked on:** nothing to start. **Cannot complete without** Davin's R2 bucket
and credentials (§5.3).

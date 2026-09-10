# Cloudflare R2 Chart Storage — Architecture & Deployment Plan

**Audience:** a fresh Claude Code session with **no prior context**, plus Davin for the
account-level steps.
**Written:** 2026-09-10.
**Status of the code this describes:** **already built, tested and pushed.** See §1 before
writing anything.

---

## 0. Read this first

### 0.0 STEP ZERO — run this before planning anything

Do not take §1's word for what exists. **Observe it.** Run this from the repo root and compare
against the expected output:

```bash
for f in lib/storage/r2.ts lib/storage/chart-keys.ts \
         app/api/chart/download/route.ts \
         lib/preferences/server-preferences.ts \
         components/charts/mtf/useMtfPreference.ts \
         backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/mtf_render_upload_worker.py; do
  [ -f "$f" ] && echo "BUILT    $f" || echo "MISSING  $f"
done
echo "--- R2 credentials configured locally? ---"
grep -q "^R2_ACCOUNT_ID=." .env.local 2>/dev/null && echo "yes" || echo "no (expected — this is the gap)"
```

**Expected output: six `BUILT` lines, and `no` for credentials.**

That is the whole situation in one command. The application code is finished; the credentials are
the gap.

- **Six `BUILT` + `no`** → proceed to §3. Your work is deployment and verification, not
  implementation.
- **Any `MISSING`** → something is wrong with your checkout (wrong branch, or the work was
  reverted). Confirm with `git log --oneline -25 | grep -i chart` before writing anything; the
  commits are `31b3206f`, `55d598bb`, `41fdcc56`.
- **`yes` for credentials** → someone has already done §4/T2 locally. Skip to §T4 and verify.

### 0.1 What this document is

The single standalone reference for getting rendered XAUUSD chart PNGs from the Contabo VPS into
Cloudflare R2, and back out to PRO users and (later) the vision LLM.

It is deliberately self-contained: a session should be able to work from this file alone, opening
the referenced documents only for deeper history. Everything needed to act — file paths, exact
environment-variable names, object keys, verification commands, failure modes — is reproduced here
rather than cited.

### 0.2 ⚠ The most important thing on this page

**The application code is finished.** A fresh session's largest risk is reading this as a
greenfield task and rebuilding `lib/storage/r2.ts`, the download route, or the VPS worker. They
exist, they are covered by tests, and they are on `main`.

**What is missing is not code. It is a bucket, four credentials, and a deployment.**

Read §1 (what exists) before §3 (what remains). If you find yourself about to create a file listed
in §1, stop — you are duplicating working code.

### 0.3 Context a fresh session will not have

| Thing                   | What it is                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **DavinTrade**          | A trading-alerts SaaS. One symbol in scope: **XAUUSD**, timeframes **M5 and M15** only.                                                                                                                |
| **The renders**         | Two-panel PNGs — M5 above M15 — generated every 5 minutes from indicator data. Consumed by (a) a PRO user's Download button and (b) later, a vision LLM doing chart analysis ("Stack D, Pillar 6").    |
| **FREE vs PRO**         | Both tiers get the same live market data. PRO adds alerts and the **M5-on-M15 overlay**. That overlay is the entitlement this storage design exists to protect.                                        |
| **The two variants**    | Every cycle renders **both** `overlay` (M5 channel drawn on the M15 panel) and `standard` (not drawn). The caller picks by tier + the user's toggle. The renderer itself is deliberately tier-unaware. |
| **The Contabo VPS**     | A **Windows** box running MetaTrader 5, a Python collector, and a push worker. Services are registered with **NSSM** (a Windows service wrapper), not systemd or cron.                                 |
| **The monolith**        | A Next.js app deployed on **Vercel**. `pnpm` workspace.                                                                                                                                                |
| **`operation-service`** | A separate NestJS service. Not involved in R2, but it mirrors some schemas — irrelevant here, noted so you do not go looking.                                                                          |

### 0.4 Repo conventions that will bite you

- **Never run `npm run lint`** — it is broken in this repo (`LESSONS-LEARNED.md` L38). Use
  `npx eslint <files>`.
- Run the full monolith suite with **`npm run test:ci`**. Current baseline: **176 suites /
  2445 tests**. Any other number means you changed something.
- **Stage files by name.** The working tree carries unrelated in-progress work (`.ex5` binaries,
  capture data). Never `git add -A`.
- `seed-code/**` is read-only by convention unless Davin says otherwise.
- Secrets never go in the repo. `.env.example` documents **names only**.
- A pre-push hook runs type-check + the full suite, so pushes take a few minutes.

---

## 1. What already exists — DO NOT REBUILD

All of the following is on `main` and green.

### 1.1 Monolith (Next.js / Vercel)

| File                                        | Lines | Responsibility                                                                                                                                               |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/storage/chart-keys.ts`                 | 36    | `ChartVariant` type, `CHART_VARIANTS`, `chartObjectKey(variant)`. **No dependencies** — deliberately, so callers and tests do not load the AWS SDK.          |
| `lib/storage/r2.ts`                         | 79    | `getSignedChartUrl(variant)` — presigned GET against a private bucket. Builds the S3 client lazily from env.                                                 |
| `app/api/chart/download/route.ts`           | 82    | `GET` — entitlement gate → read preference → sign → **307 redirect**. Takes **no query parameters**.                                                         |
| `lib/auth/permissions.ts`                   | —     | `requireChartDownload()` — PRO gate that re-queries the database when the JWT says otherwise, so a just-upgraded user is not refused. Returns the `Session`. |
| `lib/preferences/server-preferences.ts`     | 39    | `getM5OnM15Preference(userId)` — which variant this user should get. Degrades to `false` on any error.                                                       |
| `components/charts/mtf/useMtfPreference.ts` | —     | Client hook: loads and persists the toggle.                                                                                                                  |
| `components/chat-sidebar.tsx`               | —     | The Download button — a plain `<a href="/api/chart/download">` for PRO, `/pricing` for FREE.                                                                 |
| `.env.example`                              | —     | The five `R2_*` names, documented, **no values**.                                                                                                            |

**Dependencies already installed:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.

**Tests already covering this** (all passing):

- `__tests__/api/chart-download.test.ts` — 401 / 403 / variant selection / 503-on-misconfig.
- `__tests__/lib/auth/require-chart-download.test.ts` — including the stale-JWT case.
- `__tests__/lib/preferences/server-preferences.test.ts` — fallbacks and DB-failure degradation.
- `__tests__/lib/storage/r2-chart-keys.test.ts` — **object-key parity against the renderer's own
  output filenames.**

### 1.2 VPS (Contabo, Windows)

| File                                                                  | Lines | Responsibility                                                                                                                                             |
| --------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.../v2_29_multi-timeframe-visualisation/mtf_render_upload_worker.py` | 218   | The `MT5Renderer` service: render both variants from one DB read → upload to R2 → prune > 48h. A long-running loop with a sleep, **not** a scheduled task. |
| `.../v2_29_data_pipeline_architecture/install_services.bat`           | —     | NSSM registration for `MT5Renderer`, with an R2 config block to fill in.                                                                                   |
| `.../v2_29_multi-timeframe-visualisation/mtf_render/`                 | —     | The renderer package itself (`--both-variants` produces the pair).                                                                                         |

### 1.3 What is therefore _not_ your job

Do not write: an R2 client, a download route, an entitlement gate, a preferences reader, an upload
worker, or an NSSM entry. Do not add a `?variant=` parameter — it was removed on purpose (§2.4).

---

## 2. Architecture

### 2.1 The flow

```
┌─ Contabo VPS (Windows) ──────────────┐      ┌─ Cloudflare R2 ──────────────┐
│                                      │      │  bucket: davintrade-renders  │
│  xauusd.db  (SQLite, read-only here) │      │  ⚠ PRIVATE — no public read  │
│        │                             │      │                              │
│        ▼                             │      │  xauusd/                     │
│  MT5Renderer  (NSSM service)         │      │    …_m5_m15_overlay.png      │
│    every 300s:                       │      │    …_m5_m15_standard.png     │
│      render BOTH variants ───────────┼─PUT─►│                              │
│      (one DB read, temp dir)         │      └──────────┬───────────────────┘
│      prune objects older than 48h    │                 │ presigned GET only
└──────────────────────────────────────┘                 │ (~60s TTL)
                                                         │
┌─ Vercel (Next.js monolith) ─────────────────────────────┴──────────────────┐
│  GET /api/chart/download                                                   │
│    1. requireChartDownload()      → 401 / 403                              │
│    2. getM5OnM15Preference(id)    → 'overlay' | 'standard'                 │
│    3. getSignedChartUrl(variant)  → ~60s URL                               │
│    4. 307 redirect                                                         │
│                                                                            │
│  chat-sidebar: <a href="/api/chart/download">   (PRO)                      │
│                <a href="/pricing">              (FREE)                     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 ⚠ Why the bucket must be private — the load-bearing decision

Object names are **deterministic**: `xauusd/mtf_render_xauusd_m5_m15_overlay.png`. There is no
hash, no user id, no timestamp.

So if the bucket allows public read, the entitlement gate is **cosmetic**. A FREE user who is told
the URL — or who guesses it, which is trivial — fetches the PRO render directly, and every line of
`requireChartDownload()` is bypassed.

**This is the single setting the whole design rests on.** If you take one thing from this
document: do not enable public access, and do not add a public custom domain to this bucket.

An earlier revision of `STACK-D-…-V2.md` §9 specified a public CDN URL with zero-egress caching as
the rationale. That was superseded. **Egress still leaves from R2** under the presigned-URL flow,
so the zero-egress benefit is retained — only the _authorization_ moved.

### 2.3 Why presigned redirect, not streaming

The route could read the object and stream the bytes. It redirects instead:

- Egress stays on R2 rather than passing through Vercel.
- The serverless function stays memory-flat regardless of image size.
- A leaked link expires in ~60 seconds instead of forever.

### 2.4 Why there is no `?variant=` parameter

The route reads `UserPreferences.m5OnM15` server-side. An earlier draft accepted a client-supplied
`?variant=`. It was removed so that **one source decides** which render a user gets — the chart
toggle writes the preference, the download route reads it, and Stack D's Pillar 6 will read the
same thing. Two sources that can disagree is precisely the screen-vs-download divergence this work
existed to close.

### 2.5 Retention

The worker prunes objects older than **48 hours** on every cycle, and never prunes the two keys it
just wrote. §5.2 offers an R2-native lifecycle rule as a more robust alternative.

---

## 3. What remains

Split by who can actually do it. **A Claude Code session cannot create the bucket** — that is a
Cloudflare dashboard action on Davin's account.

| #      | Task                                                                                | Owner                  | Blocking?                   |
| ------ | ----------------------------------------------------------------------------------- | ---------------------- | --------------------------- |
| **T1** | Create the private R2 bucket + API token                                            | **Davin**              | **Yes — blocks everything** |
| **T2** | Set the 5 `R2_*` vars in Vercel (Production)                                        | **Davin**              | Yes, for downloads          |
| **T3** | Fill the R2 block in `install_services.bat`, deploy the worker, start `MT5Renderer` | **Davin** (VPS access) | Yes, for uploads            |
| **T4** | Write a verification script that proves the bucket is private                       | Claude Code            | No — but do it before T5    |
| **T5** | End-to-end verification                                                             | Both                   | —                           |
| **T6** | _(optional)_ R2 lifecycle rule instead of app-side pruning                          | Claude Code + Davin    | No                          |
| **T7** | _(later, separate)_ Stack D Pillar 6 consumer                                       | Session 12-2           | No                          |

---

## 4. Implementation

### T1 — Create the bucket and token (Davin)

1. Cloudflare dashboard → **R2** → **Create bucket**.
   - Name: **`davintrade-renders`** (this exact name is the default in code and in
     `install_services.bat`; changing it means changing `R2_BUCKET` in both places).
   - Location: nearest the VPS/users.
2. **Do not** enable public access. Do not connect a custom domain. (§2.2.)
3. **R2 → Manage API Tokens → Create API Token.**
   - Permission: **Object Read & Write**.
   - Scope to the single bucket `davintrade-renders`, not the whole account.
4. Record four values — these are the only secrets involved:

| Value                 | Where it appears in the dashboard                        |
| --------------------- | -------------------------------------------------------- |
| **Account ID**        | R2 overview sidebar (also in the S3 endpoint URL)        |
| **Access Key ID**     | Shown once on token creation                             |
| **Secret Access Key** | Shown once on token creation — **not retrievable later** |
| **Bucket name**       | `davintrade-renders`                                     |

The S3-compatible endpoint the code builds is
`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. You do not need to configure it; it is derived.

> **Secrets handling:** paste these into Vercel and the VPS directly. Do not put them in the repo,
> in a commit, or in a chat message. If one is ever pasted into a transcript, rotate it.

### T2 — Vercel environment variables (Davin)

Project → Settings → Environment Variables. **Production scope.**

| Name                        | Value                | Notes                                  |
| --------------------------- | -------------------- | -------------------------------------- |
| `R2_ACCOUNT_ID`             | from T1              |                                        |
| `R2_ACCESS_KEY_ID`          | from T1              |                                        |
| `R2_SECRET_ACCESS_KEY`      | from T1              | mark **Sensitive**                     |
| `R2_BUCKET`                 | `davintrade-renders` |                                        |
| `R2_SIGNED_URL_TTL_SECONDS` | `60`                 | optional; code defaults to 60 if unset |

Then **redeploy** — Vercel does not apply new variables to a running deployment.

> ⚠ **Scope carefully.** `CLAUDE.md` records an existing inconsistency where `DATABASE_URL` is
> scoped to _All Environments_ while `DIRECT_URL` is Production-only, meaning preview deployments
> hit production data. Do not repeat that here: Production scope unless you have a deliberate
> reason otherwise.

> ⚠ **`vercel env pull` cannot retrieve a Sensitive value.** It writes a `[SENSITIVE]` placeholder
> by design. Cloudflare is the source of truth; do not expect to read the secret back.

### T3 — VPS deployment (Davin)

1. Copy `mtf_render_upload_worker.py` **and the `mtf_render/` package** to `C:\Scripts\renderer\`.
2. Install Python dependencies on the VPS:
   ```
   pip install boto3 matplotlib pandas numpy
   ```
3. Edit the R2 block near the top of `install_services.bat`:
   ```bat
   set RENDERER=%ROOT%\renderer\mtf_render_upload_worker.py
   set R2_ACCOUNT_ID=PUT_R2_ACCOUNT_ID_HERE
   set R2_ACCESS_KEY_ID=PUT_R2_ACCESS_KEY_ID_HERE
   set R2_SECRET_ACCESS_KEY=PUT_R2_SECRET_ACCESS_KEY_HERE
   set R2_BUCKET=davintrade-renders
   ```
4. Run `install_services.bat` from an **elevated** cmd, or register just this service:
   ```bat
   nssm install MT5Renderer "C:\Python311\python.exe" "C:\Scripts\renderer\mtf_render_upload_worker.py"
   nssm set MT5Renderer AppDirectory "C:\Scripts\renderer"
   nssm set MT5Renderer AppEnvironmentExtra R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=davintrade-renders MTF_DB_PATH=C:\Scripts\database\xauusd.db
   nssm set MT5Renderer AppStdout "C:\Scripts\logs\renderer.log"
   nssm set MT5Renderer AppStderr "C:\Scripts\logs\renderer.err.log"
   nssm set MT5Renderer AppExit Default Restart
   nssm set MT5Renderer Start SERVICE_AUTO_START
   nssm start MT5Renderer
   ```
5. Tail `C:\Scripts\logs\renderer.log`. A healthy start logs the bucket, the DB path, the overlay
   set, the interval and retention, then `uploaded xauusd/... (N bytes)` twice per cycle.

**The VPS needs four `R2_*` vars, not five** — `R2_SIGNED_URL_TTL_SECONDS` is monolith-only.
Optional worker tuning, all with sane defaults, so omit unless you mean it:

| Var                      | Default                     | Meaning                                                                                     |
| ------------------------ | --------------------------- | ------------------------------------------------------------------------------------------- |
| `MTF_DB_PATH`            | `C:\Scripts\data\xauusd.db` | ⚠ Check this — `install_services.bat` uses `%ROOT%\database\xauusd.db`. Set it explicitly. |
| `RENDER_INTERVAL_SEC`    | `300`                       | Matches the M5 cadence                                                                      |
| `RENDER_RETENTION_HOURS` | `48`                        |                                                                                             |
| `RENDER_OVERLAYS`        | `best_fit_a`                | Any of the 10 registry keys, comma-separated                                                |

### T4 — Verification script (Claude Code)

Write a throwaway script that proves the setup, **including that the bucket is not public.** That
last assertion is the one that matters, and nothing currently tests it.

It should check, in order:

1. All four `R2_*` vars are present.
2. The bucket is reachable (`HeadBucket`).
3. A test object can be PUT and deleted.
4. `getSignedChartUrl('overlay')` returns a URL, and fetching it returns **200**.
5. **Fetching the same object's _unsigned_ public URL returns 401/403, not 200.** If it returns
   200, the bucket is public — stop and fix T1 step 2 before going further.
6. Both expected keys exist once `MT5Renderer` has run:
   `xauusd/mtf_render_xauusd_m5_m15_overlay.png` and `..._standard.png`.

Keep it out of the committed test suite — it needs real credentials and network. Put it in a
scratch directory, run it, report, delete. Do not commit anything containing a key.

### T5 — End-to-end verification

| #   | Check                                       | Expected                                                   |
| --- | ------------------------------------------- | ---------------------------------------------------------- |
| 1   | T4's script                                 | All pass, **especially the public-access check**           |
| 2   | R2 dashboard                                | Two objects under `xauusd/`, refreshing every ~5 min       |
| 3   | Log in as **PRO**, click Download           | A PNG downloads                                            |
| 4   | Toggle `M5 on M15` **on**, reload, Download | The `overlay` variant — M5 channel on the lower panel      |
| 5   | Toggle **off**, Download                    | The `standard` variant, whose title reads "M5 overlay OFF" |
| 6   | Log in as **FREE**, click Download          | Routed to `/pricing`; **no** PNG                           |
| 7   | `curl` the route unauthenticated            | `401 {"error":"Authentication required"}`                  |

Checks 4–6 are the entitlement working end to end; 7 can be run without credentials.

---

## 5. Failure modes

### 5.1 Symptom → cause

| Symptom                                                                  | Likely cause                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `503 {"error":"Chart downloads are not configured on this environment"}` | An `R2_*` var missing in Vercel, or set but not redeployed. **This is the expected response today**, before T1–T2.              |
| `401`                                                                    | Not signed in. Correct behaviour.                                                                                               |
| `403 PRO subscription required`                                          | FREE tier. Correct behaviour — including for a genuinely-FREE user whose DB row confirms it.                                    |
| Redirect works, then the presigned URL **404s**                          | The object is not there: `MT5Renderer` has not run, or is uploading under a different key. Compare against §6.2.                |
| Presigned URL returns **403 SignatureDoesNotMatch**                      | Wrong secret, or wrong account id in the endpoint.                                                                              |
| Worker logs `missing R2 credentials`                                     | `AppEnvironmentExtra` not applied. NSSM does **not** pick up variable changes without a service restart.                        |
| Worker logs `render failed (exit N)`                                     | The renderer subprocess failed — check its stderr in the log. Usually a missing Python dependency or an unreadable `xauusd.db`. |
| Uploads succeed but downloads 404                                        | Bucket name mismatch between VPS and Vercel.                                                                                    |

### 5.2 The prune loop is the weakest part

Pruning runs in the same loop as rendering. If the worker is down longer than 48 hours the bucket
simply stops updating (nothing is deleted, because nothing runs) — but if it runs with a wrong
clock, it could in principle delete more than intended. It never deletes the two keys just written,
which bounds the damage.

**Optional hardening (T6):** replace the app-side prune with an **R2 object lifecycle rule**
(Cloudflare: bucket → Settings → Object lifecycle rules), expiring objects after 1 day. That moves
retention to the storage layer where it cannot be affected by worker state, and lets `prune()` be
deleted. Requires Davin to add the rule; the code change is small.

### 5.3 There is no last-known-good fallback

If the renderer stops and the window empties, Download returns a 404 through the presigned URL. The
route surfaces it rather than pretending. Acceptable for a live-chart artifact, but worth knowing
so an empty bucket is not mistaken for a code bug.

---

## 6. Reference

### 6.1 Environment variables

| Name                        | Vercel | VPS | Default                                             | Notes                   |
| --------------------------- | ------ | --- | --------------------------------------------------- | ----------------------- |
| `R2_ACCOUNT_ID`             | ✅     | ✅  | —                                                   | Required                |
| `R2_ACCESS_KEY_ID`          | ✅     | ✅  | —                                                   | Required                |
| `R2_SECRET_ACCESS_KEY`      | ✅     | ✅  | —                                                   | Required, Sensitive     |
| `R2_BUCKET`                 | ✅     | ✅  | `davintrade-renders` on VPS; **required** on Vercel | Must match              |
| `R2_SIGNED_URL_TTL_SECONDS` | ✅     | ✗   | `60`                                                | Monolith only           |
| `MTF_DB_PATH`               | ✗      | ✅  | `C:\Scripts\data\xauusd.db`                         | Set explicitly — see T3 |
| `RENDER_INTERVAL_SEC`       | ✗      | ✅  | `300`                                               |                         |
| `RENDER_RETENTION_HOURS`    | ✗      | ✅  | `48`                                                |                         |
| `RENDER_OVERLAYS`           | ✗      | ✅  | `best_fit_a`                                        |                         |

### 6.2 Object keys — three copies that must agree

```
xauusd/mtf_render_xauusd_m5_m15_overlay.png
xauusd/mtf_render_xauusd_m5_m15_standard.png
```

This name exists in **three places, in two languages, with nothing linking them at compile time**:

| Where                         | How it is built                        |
| ----------------------------- | -------------------------------------- |
| `mtf_render/__main__.py`      | `DEFAULT_OUT` + `_variant_path()`      |
| `mtf_render_upload_worker.py` | `KEY_PREFIX` + `OUT_STEM` + `VARIANTS` |
| `lib/storage/chart-keys.ts`   | `chartObjectKey()`                     |

⚠ **Drift here surfaces as a 404 on download, not an error.** `__tests__/lib/storage/
r2-chart-keys.test.ts` parses the renderer's `__main__.py` directly and pins the TypeScript key
against it. If you change the name, change all three and re-run that test.

### 6.3 Endpoint

```
https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
region: "auto"   (R2 ignores it; the AWS SDK requires a value)
```

---

## 7. Document map

Everything below is in the repo. Nothing here is required to complete T1–T5 — this document is
self-contained — but these carry the reasoning.

| Document                                                                               | What it adds                                                                                                                 |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `v2_29_multi-timeframe-visualisation/MTF-RENDER-DELIVERY-AND-GATING-PLAN.md`           | The design plan for the download path; decisions D4–D6 with the alternatives that were rejected.                             |
| `…/MTF-RENDER-DELIVERY-MANIFEST-WORK-COMPLETION.md`                                    | What was actually built and verified; §5 is the deployment checklist this document expands.                                  |
| `…/MTF-RENDER-MODIFICATION-PLAN.md`                                                    | Why the renderer is 2-panel; the overlay registry.                                                                           |
| `…/MTF-RENDER-MANIFEST-WORK-COMPLETION.md`                                             | The renderer rewrite outcome.                                                                                                |
| `…/MTF-TOGGLE-PERSISTENCE-MANIFEST-WORK-COMPLETION.md`                                 | Why the route reads a preference instead of a query parameter (§2.4).                                                        |
| `…/MTF-DUAL-STACKED-LAYOUT-{PLAN,MANIFEST-WORK-COMPLETION}.md`                         | The on-screen layout the PNG mirrors.                                                                                        |
| `…/Multi-Timeframe-Visualisation-Architecture-Design.md`                               | The renderer's own README — overlays, CLI flags, variants.                                                                   |
| `davintrade-stack-d-and-e/STACK-D-CONVERSATIONAL-AI-CHART-ANALYSIS-ARCHITECTURE-V2.md` | **§9 is the R2 pipeline spec** (Engine 3) and §10 the Pillar 6 consumer. Corrected 2026-09-10 to private-bucket + presigned. |
| `…/v2_29_data_pipeline_architecture/DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md`       | Where `xauusd.db` comes from. §8 is VPS deployment.                                                                          |
| `…/ARCHITECTURE-SUMMARY-FOR-DECK.md`                                                   | The pipeline in plain terms, including the still-forming-bar nuance.                                                         |
| `CLAUDE.md`                                                                            | Session state and `Waiting on`. The R2 bucket is the top blocking item.                                                      |
| `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                           | The operating rules for sessions in this repo.                                                                               |
| `docs/migration-orders/LESSONS-LEARNED.md`                                             | L38 (`npm run lint` broken), L40 (jsdom teardown / provider leaks in tests).                                                 |

---

## 8. Out of scope

| Item                              | Why                                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Stack D Pillar 6 vision fetch** | Belongs to Session 12-2. `execute7PillarRetrieval()` does not exist yet. When built it reads the **same** `getM5OnM15Preference()` — do not add a second preferences fetch. |
| **Recompiling the MQL5 `.ex5`**   | A separate, older blocker. The renders work from `xauusd.db` regardless; it affects data freshness, not storage.                                                            |
| **The shared-socket refactor**    | Reviewed and declined with a measurement trigger. Unrelated to R2.                                                                                                          |
| **Rendering on demand**           | Explicitly rejected — it would blow Stack D §2's <120 ms retrieval budget. Renders are cron artifacts.                                                                      |

---

## 9. Opening prompt for a fresh session

Paste this **verbatim** as the first message. It matters more than any warning inside this file:
the first message sets the frame, and a session that starts believing this is greenfield will
often stay there.

> Read `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_multi-timeframe-visualisation/R2-CHART-STORAGE-ARCHITECTURE-AND-DEPLOYMENT.md` in full, then run its §0.0 Step Zero command and tell me what it printed **before** proposing anything.
>
> Important framing: **the application code for this feature is already written, tested and pushed.** This is a deployment and verification task, not an implementation task. Do not create `lib/storage/r2.ts`, `app/api/chart/download/route.ts`, or the VPS upload worker — they exist. If you believe one is missing, say so and stop; that would mean my checkout is wrong, not that you should write it.
>
> I will create the Cloudflare bucket and set the credentials myself — you cannot do that part. Your job is T4 (the verification script, including the check that the bucket is **not** publicly readable) and helping me work through T5.

**Why phrase it that way.** Three things are doing the work: it orders _observe before propose_;
it states the task type explicitly ("deployment, not implementation"), which is the frame the word
"implementation plan" would otherwise set; and it pre-authorises the session to **stop and
contradict you** if reality disagrees, rather than quietly building to fit the brief.

---

## 10. If you are that fresh session and you are unsure

The failure this document is designed against is subtle: everything here reads like a build brief,
so the natural response is to build. Two rules:

1. **Prefer the filesystem over any document, including this one.** Docs go stale; the tree does
   not. §0.0 exists so you never have to trust a claim you can check in one command.
2. **A missing file is a red flag about the checkout, not an invitation.** Say what you found and
   ask. Recreating a file that already exists on `main` silently discards working, tested code and
   is far more expensive than a question.

---

## 11. Definition of done

- [ ] Bucket `davintrade-renders` exists and is **private** — verified by T4's public-access check, not assumed
- [ ] Five `R2_*` vars set in Vercel (Production), deployment redeployed
- [ ] `MT5Renderer` running on the VPS, logging successful uploads
- [ ] Both objects present under `xauusd/`, refreshing every ~5 minutes
- [ ] PRO download returns a PNG; the variant follows the `M5 on M15` toggle
- [ ] FREE download routes to `/pricing` and yields no PNG
- [ ] Unauthenticated `GET /api/chart/download` returns 401
- [ ] `npm run test:ci` still **176 suites / 2445 tests**
- [ ] No credential committed, and nothing containing one left on disk

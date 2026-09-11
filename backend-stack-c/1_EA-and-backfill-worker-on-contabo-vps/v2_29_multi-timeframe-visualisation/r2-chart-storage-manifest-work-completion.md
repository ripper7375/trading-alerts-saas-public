# R2 Chart Storage — Manifest of Work Completion

**Work:** create the private Cloudflare R2 bucket, deploy the `MT5Renderer` upload service to the
Contabo VPS, and verify the chart-render delivery path end to end — T1 through T5.
**Executed:** 2026-09-11.
**Plan of record:** `R2-CHART-STORAGE-ARCHITECTURE-AND-DEPLOYMENT.md` (opened with its own §9
prompt, verbatim).
**Closes:** that document's §11 Definition of Done, and
`MTF-RENDER-DELIVERY-MANIFEST-WORK-COMPLETION.md` §5 ("Davin's actions — without these, none of
this functions"). Also closes the `Waiting on` item that had been the top blocking entry in
`CLAUDE.md` since 2026-09-10.
**Status:** deployed, live on `davintrade.app`, verified. One check deliberately left **UNPROVEN**
rather than passed — see §4.
**Type:** ad-hoc session, Davin-requested directly in chat, outside the phase/session numbering,
per `docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded in `CLAUDE.md`'s matching 2026-09-11
ad-hoc entry.

> **⚠ Scope note — this was a deployment session, not a build session. Zero tracked source files
> were changed.** The application code shipped on 2026-09-10 in commits `31b3206f`, `55d598bb` and
> `41fdcc56`, and is documented by the sibling manifests in this folder. Everything below is
> deployment, verification apparatus, findings and incidents. If you are reading this while
> planning work, the code exists — run §0.0 of the plan of record before proposing anything.

---

## 1. What was deployed

The division of labour is the point: an agent session cannot create a Cloudflare bucket or reach
the VPS, so most of this was Davin acting on instructions, with the Executor providing the
verification apparatus and the diagnosis.

| #      | Task                                                         | Owner    | Outcome                                                                        |
| ------ | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------ |
| **T1** | Private bucket `davintrade-renders` + scoped API token       | Davin    | ✅ Created. Public access off; r2.dev disabled, no custom domain               |
| **T2** | Five `R2_*` vars in Vercel (Production) + redeploy           | Davin    | ✅ Set and redeployed                                                          |
| **T3** | Deploy renderer to the VPS, register `MT5Renderer` with NSSM | Davin    | ✅ `SERVICE_RUNNING`, logging periodic uploads                                 |
| **T4** | Verification script, incl. the bucket-is-private check       | Executor | ✅ `scratch/verify-r2.ts` — see §3, and §4 for what it revealed                |
| **T5** | End-to-end verification                                      | Both     | ✅ 7/7 checks — 4 in-browser by Davin, the unauthenticated one by the Executor |
| **T6** | _(optional)_ R2 lifecycle rule instead of app-side pruning   | —        | Not done; still open (§9)                                                      |
| **T7** | _(later)_ Stack D Pillar 6 consumer                          | —        | Out of scope, Session 12-2 (§8)                                                |

---

## 2. Step Zero, and why it is worth reusing

The plan of record was written against a specific failure: everything in it reads like a build
brief, so the natural response is to build — recreating `lib/storage/r2.ts` or the download route
as greenfield, silently discarding tested code already on `main`.

It did not happen, and the mechanism is worth naming because it generalises to any
"deployment-not-implementation" handover:

- **§0.0 made the first action an observation, not a plan.** One command printed six `BUILT` lines
  and `no` for credentials — the entire situation, checkable in seconds, with an explicit routing
  rule attached (`six BUILT + no` → deployment; `any MISSING` → your checkout is wrong, stop).
- **§9 pre-authorised the session to contradict the brief.** "If you believe one is missing, say so
  and stop; that would mean my checkout is wrong, not that you should write it."

Both halves mattered. The first removes the need to trust a document's claim about itself; the
second removes the pressure to build something to fit the frame. The live code was then read
directly — `chartObjectKey()`, the worker's `KEY_PREFIX`/`OUT_STEM`/`VARIANTS`, and the route's
401/403/503 branches — and confirmed to match §6.2, rather than taking the document's description
of them on trust.

---

## 3. The verification script (T4)

**`scratch/verify-r2.ts`** — run from the repo root with `npx tsx scratch/verify-r2.ts`.

Untracked and gitignored (`.gitignore:190`), per the plan of record's instruction to keep it out of
the committed suite: it needs real credentials and network access, which is exactly what a test
suite must not.

**It is credential-free by construction.** Values are read from the process environment, falling
back to the gitignored `.env.local`; the shell wins, so a one-shot run needs nothing written to
disk. Presigned URLs are redacted to `origin + path` before printing, because the query string
carries the Access Key ID in `X-Amz-Credential` — a naive script that logs the URL it just tested
leaks a credential into the transcript. The redaction was confirmed working in practice: Davin's
pasted output stops at `?<signature redacted>`.

| Check  | What it establishes                                                          |
| ------ | ---------------------------------------------------------------------------- |
| **1**  | All four `R2_*` variables present (bucket and TTL echoed; no values printed) |
| **2**  | Bucket reachable — `HeadBucket`, falling back to `ListObjectsV2` (see below) |
| **3a** | A probe object can be written                                                |
| **4a** | A presigned GET of a **known-present** object returns 200/206                |
| **4b** | `getSignedChartUrl()` signs this account, this bucket, this key              |
| **4c** | Fetching the app-signed overlay URL returns 200 — the full path, end to end  |
| **5a** | An unsigned S3-endpoint GET does not serve the object — **necessary only**   |
| **5b** | A public hostname, if one is supplied, does not serve it                     |
| **5c** | Cloudflare's API confirms public access is off, if a token is supplied       |
| **6**  | Both render objects exist, with age (> 10 min is reported as stale)          |
| **3b** | The probe is deleted, and confirmed gone                                     |

Three design decisions inside it are load-bearing.

**The probe is held alive through checks 4–5, not deleted at 3.** The plan of record lists "PUT and
delete a test object" as step 3 and the public check as step 5. Deleting immediately leaves step 5
testing a key that does not exist — and **a missing object on a public bucket returns 404, which
reads exactly like "private"**. A public-access check is only sound against an object known to be
present. The probe is therefore deleted in a `finally`, so it is cleaned up even on failure.

**`HeadBucket` failure is not treated as fatal.** A token correctly scoped to a single bucket with
Object Read & Write may be refused bucket-level operations. The script falls back to a one-key
`ListObjectsV2` — the capability actually depended on — and reports which path it took, so a
correctly-tightened token does not read as a broken one.

**Statuses are four-valued, not pass/fail.** `PENDING` covers "expected before T3" (the objects do
not exist yet); `UNPROVEN` covers "this check could not be performed", which is reported separately
from PASS and never folded into it. §4 is why that distinction exists at all.

> **⚠ One caveat for future sessions.** `scratch/` is **not** in `tsconfig.json`'s exclude list
> while `include` is `**/*.ts`, so this file sits inside `tsc --noEmit`'s scope and therefore inside
> the pre-push hook's. It is type-clean and lint-clean as committed; if edited, it must stay that
> way or it will block pushes. It is kept rather than deleted — re-running it is how bucket privacy
> gets re-checked after any change — but it can be deleted freely.

---

## 4. ⚠ The finding that matters — the specified public-access check was vacuous

This is the reason the session exists in more than a checklist sense.

**§2.2 of the plan of record is correct and remains correct:** object names are deterministic
(`xauusd/mtf_render_xauusd_m5_m15_overlay.png` — no hash, no user id, no timestamp), so a publicly
readable bucket makes `requireChartDownload()` cosmetic. A FREE user told the URL simply fetches
the PRO render. That single setting is what the whole delivery design rests on.

**But the check specified to prove it could not.** T4 step 5 asked that fetching the object's
"unsigned public URL" return 401/403 rather than 200. Against the S3 endpoint
(`<account>.r2.cloudflarestorage.com`), **R2 refuses unsigned requests whatever the bucket's public
setting is** — its S3 API is never anonymous. The check therefore passes on a public bucket too. It
produces confidence without evidence, which on this particular setting is worse than no check.

Public read on R2 is exposed through a _different_ hostname: the managed `pub-<hash>.r2.dev`
domain, or a connected custom domain. Neither is guessable from the S3 credentials, which is
precisely why the naive check misses it.

**Restructured into three parts:**

- **5a** — the S3-endpoint probe, kept because a 200 there would be catastrophic, but relabelled in
  the script's own output as `(necessary, NOT sufficient)` so it cannot be skim-read later as an
  all-clear, with the reason restated in its detail line.
- **5b** — a real fetch of the probe object through a public hostname, when `R2_PUBLIC_BASE_URL` is
  supplied. A 200 here fails loudly: the bucket is public.
- **5c** — Cloudflare's API (`.../r2/buckets/<bucket>/domains/managed` and `/custom`), when
  `CF_API_TOKEN` is supplied. This is a **different credential** from the S3 keys and needs
  _Workers R2 Storage: Read_.

When neither 5b nor 5c can run, the script reports **UNPROVEN** and says so again in its summary
under a heading that reads "an unproven public-access check is not a pass".

**5c was then hardened against a subtler form of the same mistake.** As first written it read
`managed?.result?.enabled === true`, so if Cloudflare's response shape ever changed, `enabled` would
be `undefined` and the check would report **PASS** — an upstream API change silently becoming false
assurance about bucket privacy. It now requires `success === true` and
`typeof enabled === 'boolean'` before trusting a negative answer, and degrades to UNPROVEN
otherwise.

**Consequence, recorded rather than papered over:** bucket privacy is **dashboard-confirmed by
Davin** (r2.dev disabled, no custom domain) and **not script-proven**. The Definition of Done asked
for it to be "verified by T4's public-access check, not assumed", and that literal wording is not
met. §11 of the plan of record has been ticked with that caveat attached rather than ticked clean.
To close it properly: set `CF_API_TOKEN` and re-run the script.

---

## 5. Findings

### 5.1 Two bugs in the verification script itself

Both were reported as `FAIL` against a correctly-configured setup — the right direction for a check
to err, but both were the Executor's, not the infrastructure's. Recorded because anyone writing a
similar script will hit them.

**(a) Virtual-hosted addressing.** Check 4b asserted the presigned URL's host equalled
`<account>.r2.cloudflarestorage.com` — path-style. The AWS SDK defaults to **virtual-hosted** style,
so the bucket is a host prefix and the key is the whole path:
`davintrade-renders.<account>.r2.cloudflarestorage.com/xauusd/…`. The app was entirely correct; the
assertion was wrong. R2 accepts both styles, so the script now accepts either and names which one
it saw. Check 4a had already proved the arrangement worked by fetching real bytes through it — a
useful reminder that a behavioural check outranks a structural assertion.

**(b) R2 answers a missing `Authorization` header with `400 InvalidArgument`**, not the S3-standard
401/403. Refused either way. The script now treats any non-2xx as a refusal and reserves `FAIL` for
a 2xx, which is the only result that constitutes a finding.

### 5.2 ⚠ `install_services.bat` would have clobbered live credentials

T3 step 4 offers "run `install_services.bat` from an elevated cmd, **or** register just this
service". Taking the first option on a live VPS would have been destructive.

Batch files do not stop on error. For an already-installed service, `nssm install MT5PushWorker …`
fails harmlessly — and then the **next line still executes**:

```bat
nssm set MT5PushWorker AppEnvironmentExtra BACKFILL_API_KEY=%BACKFILL_API_KEY% API_GATEWAY_URL=%API_GATEWAY_URL%
```

Unless the operator has edited the CONFIG block, those still hold the file's literal
`PUT_REAL_KEY_HERE` and `PUT_REAL_RAILWAY_GATEWAY_URL_HERE`. The running push worker's real
credentials are overwritten and ingestion breaks at its next restart. It would also destroy the
only copy of `API_GATEWAY_URL` — which is exactly the value the still-open "which gateway does the
VPS push worker target, production or the staging project?" question in `CLAUDE.md` depends on.
`MT5Collector` has the same exposure through its `--db` / `--export-dir` arguments.

`MT5Renderer` was registered alone instead; nothing was damaged. **Registering one service at a
time should be the only documented option.** A background task has been raised to make the script
per-service, refuse to run while any `PUT_..._HERE` placeholder remains, and refuse to overwrite an
existing service without an explicit flag.

### 5.3 ⚠ The fixture at the collector's database path

With no real `xauusd.db` data available (the MQL5 `.ex5` rebuild is a separate, older blocker), a
synthetic fixture was built to give the renderer something to draw — at
`C:\Scripts\database\xauusd.db`. **That is the path `MT5Collector` is installed with
(`--db %ROOT%\database\xauusd.db`) and `MT5PushWorker` drains.**

Two reassurances, both established from the code rather than assumed:

- **Nothing was destroyed.** `build_fixture_db()` issues a plain `CREATE TABLE market_data` — no
  `IF NOT EXISTS` — and never deletes the target file. Against a real database it would have died
  with `table market_data already exists`. It succeeded, which is positive evidence that the file
  had no `market_data` table.
- **Synthetic prices could not have reached production.** The fixture table has no `synced_at`
  column, and the push worker's first statement is
  `SELECT COUNT(*) FROM market_data WHERE synced_at IS NULL`. It raises `no such column` and stops
  — the drain fails closed.

**The real hazard was a delayed one, and it is the part worth remembering.** The collector's own
`CREATE TABLE IF NOT EXISTS market_data (…)` is a silent no-op against a table that exists in the
wrong shape. `promote_cycle()`'s 87-column `INSERT OR REPLACE` then fails with `no such column`, so
**no cycle could ever promote** while that file remained. Nothing is flowing today, which is
precisely what would have made it dangerous: it would have surfaced weeks later, after the
indicator rebuild, as "the pipeline broke" with no visible link back to a chart-rendering session.

Resolved the same session: fixture rebuilt at `C:\Scripts\renderer\fixture.db`, `MTF_DB_PATH`
repointed via `AppEnvironmentExtra`, `MT5Renderer` restarted, and the pipeline path cleared so the
collector recreates the real schema itself.

> **General rule this produced:** a renderer, a test harness, or any read-only consumer must never
> be pointed at a writer's database path, even to read — because the failure mode is a schema
> landmine rather than an error. Note also that `AppEnvironmentExtra` **replaces the whole set**, so
> repointing one variable means repeating all four `R2_*` values on that line.

### 5.4 The plan of record's test baseline was already stale

§0.4 and §11 stated "176 suites / 2445 tests". That was correct when written on 2026-09-10 and was
overtaken hours later by the economic-events session, which took the suite to **181 / 2513**. Both
places corrected, with a line added telling the next reader to check the newest `CLAUDE.md` entry
rather than trust a number frozen in a standalone document.

### 5.5 `MTF_DB_PATH` — the documented caution resolves cleanly

The plan of record flags that the worker's built-in default (`C:\Scripts\data\xauusd.db`) disagrees
with `install_services.bat` (`%ROOT%\database\xauusd.db`). Checked: the `.bat` does pass
`MTF_DB_PATH=%DB%` explicitly on its `AppEnvironmentExtra` line, so the default never applies when
that script is used. It must still be set explicitly for a hand-registered service, which is what
was done — now pointing at the renderer's own fixture per §5.3.

---

## 6. Verification

| Check                                     | Result                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| T4 script against the live bucket         | **10 PASS / 0 FAIL / 0 PENDING / 2 UNPROVEN** (the two UNPROVEN are 5b/5c — §4)   |
| `GET /api/chart/download` unauthenticated | **401** `{"error":"Authentication required"}` — run by the Executor on production |
| PRO download, toggle OFF                  | `standard` variant, titled "M5 overlay OFF" — Davin, in-browser                   |
| PRO download, toggle ON                   | `overlay` variant, "M15 channel + M5 channel OVERLAID (PRO)" — Davin, in-browser  |
| Presigned redirect                        | 307 to the private bucket, verified — Davin                                       |
| FREE tier                                 | Toggle locked with PRO badge; Download locked to PRO — Davin, in-browser          |
| `npx tsc --noEmit` (monolith)             | 0 errors, with `scratch/verify-r2.ts` inside its scope                            |
| `npx eslint scratch/verify-r2.ts`         | 0 errors, 0 warnings                                                              |
| `npm run test:ci` (monolith)              | **181/181 suites · 2513/2513 tests**, exit 0 — no drift (§5.4)                    |
| `git status`                              | No tracked source file changed; the scratch script invisible to git               |

### 6.1 Two things the live checks proved that the suite cannot

**4c going 404 → 206 is the single strongest artifact here.** It exercises render → upload →
`chartObjectKey()` → presigned fetch in one line, across two languages and three machines. The
object-name parity test pins the TypeScript key against the renderer's `__main__.py`, but only a
real fetch proves the third copy — the VPS worker's `KEY_PREFIX`/`OUT_STEM` — agrees too. Drift
there surfaces as a 404 on download, never as an error.

**The unauthenticated 401 proves an ordering the mocked tests assert but cannot demonstrate.** With
R2 unconfigured the route returns 503; with no session it returns 401. Getting 401 while
credentials were absent proves the entitlement gate short-circuits _before_ any storage work. Note
that the apex domain 308-redirects to `www` at the edge, so the check must follow the redirect —
against the apex you see the 308, not the answer.

### 6.2 Not verified — flagged, not skipped

- **Every authenticated check was Davin's**, per the standing rule that the Executor never enters
  credentials. The four T5 browser results above are his, confirmed with screenshots.
- **Bucket privacy is dashboard-confirmed, not script-proven** — §4.
- **No render has been drawn from real market data.** Everything verified here ran against the
  synthetic fixture (§7).
- **Refresh cadence was observed once**, as objects one minute old plus periodic upload lines in
  the service log — not watched across a full 48-hour retention cycle. The prune path in particular
  has never been observed deleting anything.

---

## 7. Current operating state

| Thing          | State                                                             |
| -------------- | ----------------------------------------------------------------- |
| Bucket         | `davintrade-renders`, private (r2.dev disabled, no custom domain) |
| Vercel         | Five `R2_*` vars, Production scope, redeployed                    |
| VPS service    | `MT5Renderer`, NSSM, `SERVICE_RUNNING`, uploading every ~300s     |
| Renderer input | ⚠ `C:\Scripts\renderer\fixture.db` — **synthetic**               |
| Objects        | `xauusd/mtf_render_xauusd_m5_m15_{overlay,standard}.png`          |
| Download route | Live; 401 unauthenticated, 403 FREE, 307 → presigned for PRO      |

> **⚠ The renders are synthetic until the `.ex5` rebuild lands.** The fixture is seeded, so the
> candles are deterministic and dated around **9 June 2026**. A June-dated axis on a downloaded PNG
> is the fixture, not a bug. The T5 checks remain valid regardless, because they test entitlement
> and variant selection rather than prices — but nothing here says anything about data freshness,
> which is tracked separately as the MQL5 recompile blocker in `CLAUDE.md`.

---

## 8. Out of scope

| Item                              | Why                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Stack D Pillar 6 vision fetch** | Session 12-2. When built it must read the **same** `getM5OnM15Preference()` — do not add a second preferences fetch.     |
| **Recompiling the MQL5 `.ex5`**   | A separate, older blocker. Affects what the renders _show_, not whether storage works.                                   |
| **Rendering on demand**           | Rejected in the delivery plan — it would blow Stack D §2's <120 ms retrieval budget. Renders are cron artifacts.         |
| **Fixing `install_services.bat`** | Real and worth doing (§5.2), but a change to a hand-operated live-VPS script deserves its own session. Raised as a task. |
| **The `scratch/` tsconfig scope** | Noted in §3. Excluding `scratch/` from `tsconfig.json` is a repo-wide change, not this session's to make unilaterally.   |

---

## 9. Open items

**9.1 — Bucket privacy is not yet script-proven.** Set `CF_API_TOKEN` (Workers R2 Storage: Read)
and re-run `scratch/verify-r2.ts`; check 5c then answers definitively and the last Definition-of-
Done caveat clears. Until then the honest state is "confirmed by a human reading a dashboard",
which is true today and silently untrue the moment anyone changes the bucket.

**9.2 — `install_services.bat` is a trap for the next VPS deployment.** §5.2. A background task is
raised.

**9.3 — Two chart-render click-through items remain**, carried over in `CLAUDE.md`: that
`/terminal` opens **exactly two** WebSockets (the input to the socket-refactor trigger), and that
the pane-splitting maths is right, since jsdom's `ResizeObserver` is a no-op stub and that path has
no meaningful coverage.

**9.4 — T6, the R2 lifecycle rule, is still optional and still unbuilt.** Moving retention from
`prune()` to a bucket lifecycle rule puts it in the storage layer where worker state cannot affect
it. The prune loop remains the weakest part of the design (plan of record §5.2).

**9.5 — No last-known-good fallback.** If the renderer stops and the window empties, the download
404s through the presigned URL. The route surfaces that rather than pretending. Acceptable for a
live-chart artifact; worth knowing so an empty bucket is not mistaken for a code bug.

---

## 10. Git history

The application code this deployment activates landed on 2026-09-10, before this session:

| Commit     | Scope                                                             |
| ---------- | ----------------------------------------------------------------- |
| `31b3206f` | Monolith download path — R2 client, gate, route, button, 17 tests |
| `55d598bb` | VPS upload worker + NSSM registration                             |
| `41fdcc56` | Toggle persistence — the route reads the stored preference        |

This session changed **no tracked source file**. Its output is this manifest, the 2026-09-11 ad-hoc
entry in `CLAUDE.md` (including the two `Waiting on` rewrites), and the corrections to
`R2-CHART-STORAGE-ARCHITECTURE-AND-DEPLOYMENT.md` (§11 ticked with the §4 caveat, stale baseline
fixed) — landing together as the docs commit that introduces this file.

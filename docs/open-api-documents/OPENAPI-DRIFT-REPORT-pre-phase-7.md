# OpenAPI Drift Report — input for Session 7-1

**Produced:** 2026-08-11, after the post-6-12 ad-hoc repair closed and before Phase 7 opened.
**Status:** INPUT, not truth. Every row must be re-verified at Session 7-1's CONFIRM
(`LESSONS-LEARNED.md` L27 — order text drifts from its own cited ground truth; this report is
order text).
**Method:** extracted every `paths:` entry from all 21 specs in `docs/open-api-documents/`;
enumerated every `app/api/**/route.ts` in the monolith; enumerated every `@Controller` +
HTTP-verb decorator in `operation-service/src` and `money-service/src`. Compared mechanically.

---

## 0. Headline

| Measure                                         | Count                                                  |
| ----------------------------------------------- | ------------------------------------------------------ |
| Paths declared across the 21 specs              | **112**                                                |
| Real monolith endpoints (`app/api/**/route.ts`) | **129**                                                |
| Real monolith endpoints documented **nowhere**  | **42**                                                 |
| Spec'd paths that don't exist in the monolith   | **27** (most are legitimately other services — see §3) |
| `operation-service` routes                      | **62**                                                 |
| `money-service` routes                          | **45**                                                 |
| Service routes with an OpenAPI spec             | **≈0** (only 3 spec files even mention the services)   |

**The important finding is not the drift count.** It is that the specs describe the
**monolith's `/api/*` surface**, while Phase 7 must generate `operationApi` and `moneyApi`
clients for **107 NestJS service routes** that no spec describes.

---

## 1. Session 7-1's stated premise does not hold — read this first

`7-1-api-client-reverify-and-generate.migration-order.md`'s Surface section reads:

> `docs/open-api-documents/*` (read, not modified) as the source of truth.

And the plan's §9 step 7.2 says to rewrite the client **"generated from the OpenAPI specs
rather than hand-maintained."**

Both are unworkable as written, for one reason: **you cannot generate a service client from
specs that do not describe the service.** The 107 `operation-service` / `money-service` routes
are the thing Phase 7 needs to wrap, and they are undocumented.

**Three ways to resolve it. This is a Davin decision, not the Executor's:**

| Option                                  | What it means                                                                                                                                                                                 | Cost / risk                                                                                                                                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Author the service specs first**  | 7-1 (or a new 7-0) writes OpenAPI specs for both services from their live controllers + DTOs, then generates.                                                                                 | Highest fidelity, and the specs become a durable contract. Largest scope — 107 routes.                                                                                                         |
| **(b) Generate from NestJS at runtime** | Add `@nestjs/swagger` to both services (it already ships DTO classes), emit the spec from the running app, generate the client from that.                                                     | Far less hand-authoring, and the spec can never drift from the code because it _is_ the code. Adds a dependency + a build step to both services. **Recommended — worth 7-1 evaluating first.** |
| **(c) Narrow Phase 7's scope**          | Generate the client only for the monolith's `/api/*` surface (which the frontend actually calls), and treat the service routes as internal, reached only via the monolith's forwarding layer. | Smallest scope, and arguably correct: the browser never talks to the services directly (F45/F30 — server-side proxy only). But it leaves the services permanently undocumented.                |

Note in favour of **(c)**: `lib/operation-service/client.ts` is explicitly server-only and
states "browser never talks to operation-service directly." If that stays true, a browser-facing
generated client only ever needs the monolith's surface. **Whether that holds is the real
question 7-1 should answer before writing any code.**

---

## 2. Real monolith endpoints documented nowhere (42)

Grouped by cause. Cron routes are excluded throughout — they are server-triggered and
legitimately undocumented.

### 2a. The `token-*` auth bridge (18) — built Phase 3/4B, never spec'd

```
/api/auth/token-login              /api/auth/token-register
/api/auth/token-logout             /api/auth/token-refresh
/api/auth/token-verify-email       /api/auth/token-resend-verification
/api/auth/token-forgot-password    /api/auth/token-reset-password
/api/auth/token-2fa-setup          /api/auth/token-2fa-verify-setup
/api/auth/token-2fa-verify         /api/auth/token-2fa-status
/api/auth/token-2fa-disable        /api/auth/token-2fa-backup-codes
/api/auth/[...nextauth]
```

⚠️ **Do not spec these blind.** Session 4B-22 found the six `token-2fa-*` routes are
**dead/orphaned code** with zero UI consumers, superseded by the live `/api/user/2fa/*` cutover.
Spec'ing dead routes would generate dead client methods. 7-1 must confirm which of the 18 are
live before documenting any of them. `[...nextauth]` is a NextAuth catch-all and should be
marked internal-only, not spec'd as a normal endpoint.

### 2b. The `/api/disbursement/*` family (16) — never spec'd at all

```
/api/disbursement/affiliates/payable          /api/disbursement/affiliates/{affiliateId}
/api/disbursement/affiliates/{affiliateId}/commissions
/api/disbursement/audit-logs                  /api/disbursement/batches
/api/disbursement/batches/preview             /api/disbursement/batches/{batchId}
/api/disbursement/batches/{batchId}/execute   /api/disbursement/config
/api/disbursement/health                      /api/disbursement/pay
/api/disbursement/reports/affiliate/{affiliateId}
/api/disbursement/reports/summary             /api/disbursement/transactions
/api/disbursement/riseworks/accounts          /api/disbursement/riseworks/sync
```

Note `part-19.5-wise-disbursement-openapi.yaml` documents `/api/admin/disbursement/batches`,
which **does not exist** — the real path has no `admin` segment (see §3). The two RiseWorks
routes are archived-not-deleted per F42; spec them as deprecated or omit them deliberately.

### 2c. Built during Phase 6 (5)

```
/api/geo/detect                    (Session 6-8, F61)
/api/status                        (Session 6-10)
/api/admin/system/terminals        (Session 6-11)
/api/admin/system/jobs/{jobId}/trigger   (Session 6-11)
/api/admin/system/outbox/retry     (Session 6-11)
```

`/api/user/security-alerts` and `/api/user/security-alerts/{id}/read` were built in the same
era and **are** correctly documented (added by the ad-hoc repair to `part-13` and `part-22`) —
they are the one place this process worked as intended.

### 2d. Wise + realtime + dev (3)

```
/api/wise/recipients/me                      /api/wise/recipients/requirements/refresh
/api/wise/recipients/{id}/revalidate
/api/realtime/token                          (Session 4B-17, F8)
/api/test/seed                               (dev-only — mark internal, do not spec)
```

---

## 3. Spec'd paths absent from the monolith (27) — mostly NOT errors

Classification matters here; the raw number overstates the problem.

| Class                              | Count | Paths                                                                                                                                             | Verdict                                                                                                                                                                                                                                                  |
| ---------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flask MT5 service** (`part-06`)  | 9     | `/api/health`, `/api/symbols`, `/api/timeframes`, `/api/indicators/{symbol}/{timeframe}`, `/api/admin/terminals/*` (5)                            | **Correct as-is.** A different service with its own base URL. Not monolith routes and never were.                                                                                                                                                        |
| **railway-gateway** (`part-25`)    | 3     | `/api/v1/health`, `/api/v1/market-data`, `/api/v1/queue/stats`                                                                                    | **Correct as-is.** Separate service, own spec.                                                                                                                                                                                                           |
| **Internal utilities** (`part-16`) | 2     | `/internal/health`, `/internal/metrics`                                                                                                           | **Correct as-is** if these are real; 7-1 should confirm they exist somewhere.                                                                                                                                                                            |
| **UI page routes** (`part-08`)     | 6     | `/dashboard`, `/dashboard/alerts`, `/dashboard/alerts/new`, `/dashboard/charts`, `/dashboard/charts/{symbol}/{timeframe}`, `/dashboard/watchlist` | **Category error.** This spec documents _page_ routes in an _API_ spec. `/dashboard/watchlist` is doubly wrong — watchlists were removed from the product entirely (V8). Recommend retiring this file or converting it to a non-OpenAPI route inventory. |
| **NextAuth built-ins** (`part-05`) | 3     | `/api/auth/session`, `/api/auth/signin`, `/api/auth/signout`                                                                                      | Framework-provided, not hand-written routes. Mark internal-only.                                                                                                                                                                                         |
| **Genuinely dead** (`part-05`)     | 1     | `/api/auth/register`                                                                                                                              | **Real error.** Deleted at Session 4B-21 when credentials auth cut over. Remove.                                                                                                                                                                         |
| **Wrong path** (`part-19.5`)       | 3     | `/api/admin/disbursement/batches`, `/api/admin/disbursement/batches/{id}/execute`, `/api/wise/recipients/{id}`                                    | **Real errors.** Real paths are `/api/disbursement/batches*` (no `admin`) and `/api/wise/recipients/{id}/revalidate`. Correct or remove.                                                                                                                 |

**Net genuinely-wrong entries: 4**, not 27.

---

## 4. The 107 undocumented service routes

**Critical detail for client generation:** `money-service` sets
`app.setGlobalPrefix('v1', { exclude: ['health', 'health-auth'] })`. **`operation-service` sets
no global prefix at all** — its routes are served at the root. Any generated client must encode
this asymmetry, and no current spec records it.

- **`operation-service` — 62 routes across 10 controllers**, served at root:
  `alerts` (7), `alerts/line` (4), `auth` (9), `auth/2fa` (7), `drawings` (5),
  `market-data` (1), `notifications` (5), `outbox` (1), `tier` (3), `user` (18),
  plus `health` / `health-auth`.
- **`money-service` — 45 routes across 15 controllers**, served under `/v1`:
  `admin/affiliates` (+ `reports`) (8), `admin/analytics` (1), `affiliate/dashboard` (4),
  `cron-trigger` (8), `disbursement/batches` (1), `payments/dlocal` (1), `stripe/checkout` (1),
  `stripe/subscriptions` (1), `webhooks` (4: dlocal, riseworks, stripe, wise),
  `wise/batches` (7), `wise/recipients` (7), plus `health` / `health-auth`.

A full route inventory is reproducible in seconds — 7-1 should regenerate it live rather than
trusting this summary:

```bash
for f in $(find operation-service/src -name "*.controller.ts"); do
  ctrl=$(grep -oE "@Controller\('[^']*'\)" "$f" | sed "s/@Controller('//; s/')//")
  grep -oE "@(Get|Post|Patch|Put|Delete)\('[^']*'\)|@(Get|Post|Patch|Put|Delete)\(\)" "$f"
done
```

---

## 5. Recommendation for Session 7-1

1. **Resolve the premise first** (§1). Register it as a new flag — the specs cannot be both
   "read, not modified" and the source for a service client. Recommend evaluating option (b),
   `@nestjs/swagger`, before committing to hand-authoring: both services already define DTO
   classes, which is most of the work, and a generated spec cannot drift from its code.
2. **Confirm the browser-never-calls-services invariant.** If it holds (per
   `lib/operation-service/client.ts` and flags F45/F30), option (c) becomes defensible and
   Phase 7 shrinks dramatically. If it does not hold, (a) or (b) is mandatory.
3. **Do not spec the `token-2fa-*` routes without checking them first** — six are believed dead
   (Session 4B-22). Spec'ing them would generate dead client methods.
4. **Fix the 4 genuinely-wrong entries** in §3 regardless of which option is chosen —
   cheap, unambiguous, and they would otherwise generate broken client methods.
5. **Decide `part-08`'s fate.** It documents UI page routes in an OpenAPI file and includes a
   route (`/dashboard/watchlist`) for a feature removed from the product.
6. **Treat this report as input, not truth.** Re-verify at CONFIRM.

---

## 6. What this report deliberately did not do

- **No spec file was modified.** Hand-authoring ~107 service-route schemas without verifying
  each request/response shape against live DTOs is precisely the "asserted without verification"
  failure the post-6-12 repair existed to correct. That work belongs inside a session with
  CONFIRM discipline.
- **No request/response schemas were audited.** This report covers _path coverage only_. A path
  can be present and still document the wrong verb, parameters, or response shape — and the
  original `lib/api/` mismatch list (PUT vs PATCH on alerts, wrong notification read path,
  PATCH vs PUT on preferences, phantom market-data shape) is evidence that exactly this kind of
  error exists here. **Schema-level drift is unmeasured and could be larger than path drift.**

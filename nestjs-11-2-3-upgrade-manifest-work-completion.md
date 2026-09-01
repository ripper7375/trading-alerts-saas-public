# NestJS 11.2.3 Upgrade Manifest — Work Completion Report

**Date:** 2026-08-31
**Status:** Code complete, verified, committed, pushed to `origin/main`, and deployed live to Railway
production for all three services.
**Type:** Ad-hoc chat session (Davin-requested directly in chat, prompted by
`https://github.com/nestjs/nest/releases`) — outside the Session 14-x phase/session numbering, per
`docs/migration-orders/EXECUTOR-PROTOCOL.md` §6. Recorded across four dated entries in `CLAUDE.md`.

> **Scope note:** this document covers the NestJS dependency upgrade of `money-service`,
> `operation-service`, and `railway-gateway`, and the follow-on Railway deployment/infrastructure
> work that upgrade surfaced (production deploy, GitHub source connection, Root Directory fix). It
> does not touch or depend on the DavinTrade Academy, Business Intelligence dashboards, or UAE
> dLocal/Arabic sessions — those are separate ad-hoc sessions recorded independently in `CLAUDE.md`.

---

## 1. What was done

### 1.1 Background — why 11.2.3, not NestJS 12

Davin asked whether to upgrade to NestJS 12 (freshly released at the time). Live-checked the actual
codebase and the real GitHub release notes for both `v12.0.0` and `v11.0.0` (via the Browser pane —
`WebFetch`/`WebSearch` were erroring in this environment) rather than answer from memory:

- `money-service` and `operation-service` were pinned to NestJS **11.1.28**; `railway-gateway` was
  still on **10.4.15** — a materially different, larger jump.
- **v12 was recommended against, for now:** freshly tagged with zero patch releases behind it,
  requires Node 20.19+/22.12+ (unconfirmed against live Railway at the time), and its
  lifecycle-hook-reordering / custom-pipe-signature changes touch code that matters most in exactly
  the two services this repo's own standing rule 5 says need explicit sign-off before any
  money/auth-adjacent change.
- Checked both services' `ConfigModule.forRoot()` calls directly and confirmed neither uses a Joi
  `validationSchema` — v12's Standard Schema config change would have been a non-issue either way.
- Davin approved a narrower, same-major patch bump to the latest 11.x instead.

### 1.2 `money-service` / `operation-service`: 11.1.28 → 11.2.3

A same-major patch bump. Checked the 11.2.0–11.2.3 changelog directly (also live-browsed) before
applying: bugfixes only (a durable-provider circularity issue, an SSE-abort issue, an
`ObserveInstrument` startup crash) plus additive features (HTTP `QUERY` method support, an SSE
signal) — no breaking entries.

`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/testing` bumped explicitly in
both services. `operation-service`'s caret-ranged `@nestjs/platform-socket.io` and
`@nestjs/websockets` picked up the same 11.2.3 version automatically on `npm install` — no manual
edit needed for those two.

### 1.3 `railway-gateway`: 10.4.15 → 11.2.3

A real major-version migration, not a drop-in bump — investigated the two risks a v10→v11 jump
usually carries **before** executing, rather than assume they applied here:

- **Express v5's route-matching change (bundled into Nest v11):** checked live code —
  `railway-gateway` has exactly three routes (`@Get('health')`, `@Get('queue/stats')`, `@Post()` on
  `MarketDataController`, all under a static `api/v1` controller prefix), no wildcards or regex
  params. Confirmed non-issue.
- **`@nestjs/config` v4's env-var-precedence reorder:** live-checked the actual v4.0.0 release notes
  — the service has no `load:` config namespaces/factories at all (just
  `ConfigModule.forRoot({ isGlobal: true })`, the same bare pattern the other two services use), so
  there's nothing for the reorder to affect. Confirmed non-issue.
- `@nestjs/throttler` v6 was already de-risked in production by the other two services running it.
- `@nestjs/bull@11.0.5` confirmed on npm to still pair with the plain `bull` package (not a forced
  `bullmq` migration).

With both flagged risks resolved to non-issues, proceeded in the same session rather than deferring
to a separate formal migration order. Bumped: `@nestjs/{common,core,platform-express,testing}`
10.4.15 → **11.2.3**, `@nestjs/config` 3.3.0 → **4.0.4**, `@nestjs/throttler` 5.2.0 → **6.5.0**,
`@nestjs/bull` 10.2.3 → **11.0.5**, `@nestjs/cli` 10.4.9 → **11.0.24**.

`npm install` printed ERESOLVE warnings mid-resolution; checked the installed tree directly
(`node_modules/@nestjs/*/package.json`, searched for nested duplicates) rather than trust the
warning text at face value — confirmed a clean, fully-deduped 11.2.3 tree with no leftover v10
copies anywhere.

### 1.4 Production deployment of `railway-gateway`

`railway-gateway` has no GitHub-triggered deploy at the start of this work (unlike the other two
services, which auto-rebuild from `main`), so merging to `main` alone would not have shipped the
change. Deployed directly via the Railway CLI (`railway up --ci`) — the CLI was found to be already
authenticated in this environment and linked to the exact project/service, correcting an earlier
assumption (made by analogy with this repo's documented "no Vercel CLI access" gap) that no Railway
CLI/dashboard access existed here. Build succeeded (Nixpacks, `nest build`); live-verified afterward
by hitting the real public health endpoint rather than trusting the CLI's own "Deploy complete"
line — see §4.

### 1.5 Connecting `railway-gateway` to GitHub

A follow-on request: connect `railway-gateway` to GitHub too, matching the other two services'
auto-deploy setup. Connected via `railway service source connect --repo
ripper7375/trading-alerts-saas-public --branch main --service railway-gateway` (a CLI subcommand —
no browser OAuth click-through needed, since the Railway GitHub App was already installed and
authorized for this repo via the other two services' own connections).

**The exact risk flagged before connecting materialized immediately:** connecting auto-triggered a
build with no Root Directory set (confirmed via `--help` that `service source connect` has no flag
for it), and the build ran from the monorepo root instead of `railway-gateway/` — the log showed
Railway's Railpack builder trying to `deno cache components/affiliate/index.ts`, the Next.js
monolith's own code, entirely unrelated to this service. The build failed as a direct result.
Confirmed via `railway status` and a live health-endpoint hit that production was completely
unaffected first — Railway never cuts a failed build over; the prior good deployment kept serving
`200 healthy` throughout.

**Fix:** Root Directory is a web-UI-only field — no CLI flag exists, and the declarative
`railway config` tool needs an external SDK deliberately not installed for this one field. Talked
Davin through setting Root Directory to `railway-gateway` in Settings → Source and applying the
pending change via the UI's own "Deploy" button (confirmed this specific click was necessary:
`railway redeploy` would only re-run the last successful build's image unchanged, not a fresh build
honoring a browser-drafted setting change). Polled `railway deployment list --json` every 10s until
the new deployment left BUILDING/DEPLOYING, confirmed `SUCCESS`, then independently hit the live
health endpoint again to confirm it was genuinely serving traffic — see §4.

**Watch Paths were left unset — Davin explicitly decided not to implement this.** Any push to `main`
anywhere in the monorepo will still trigger a rebuild attempt on `railway-gateway`. Low severity (a
wasted/no-op rebuild, not a breakage — Railway never cuts over a redundant build over a good one),
recorded as a deliberate decision, not an oversight.

---

## 2. Files changed

| File                                  | Change                                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `money-service/package.json`          | `@nestjs/{common,core,platform-express,testing}` 11.1.28 → 11.2.3                                                                                                                                          |
| `money-service/package-lock.json`     | Regenerated (`npm install`) — 4 packages changed                                                                                                                                                           |
| `operation-service/package.json`      | `@nestjs/{common,core,platform-express,testing}` 11.1.28 → 11.2.3                                                                                                                                          |
| `operation-service/package-lock.json` | Regenerated (`npm install`) — 6 packages changed (includes caret-ranged `platform-socket.io`/`websockets`)                                                                                                 |
| `railway-gateway/package.json`        | `@nestjs/{common,core,platform-express,testing}` 10.4.15 → 11.2.3; `@nestjs/config` 3.3.0 → 4.0.4; `@nestjs/throttler` 5.2.0 → 6.5.0; `@nestjs/bull` 10.2.3 → 11.0.5; `@nestjs/cli` 10.4.9 → 11.0.24       |
| `railway-gateway/package-lock.json`   | Regenerated (`npm install`) — full dependency tree re-resolved for the major bump                                                                                                                          |
| `CLAUDE.md`                           | Four ad-hoc session entries appended (advisory + decision; money-service/operation-service bump; railway-gateway bump; production deploy + Railway CLI correction; GitHub connection + Root Directory fix) |

**7 files touched, 0 added, 0 deleted** — this was a dependency-version and documentation change
only; no application source files were created, modified, or removed. Across 4 commits, all on
`main`.

**Not a file change — Railway project configuration, no corresponding tracked file:**
`railway-gateway`'s GitHub source connection and Root Directory (`railway-gateway`) live entirely in
Railway's own project settings, not in this repository. `CLAUDE.md` is the only record of that
change.

---

## 3. Test verification

| Service             | Check                                     | Result                                                                                                                                                                                                                                                                                 |
| ------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `money-service`     | `tsc --noEmit`                            | Clean                                                                                                                                                                                                                                                                                  |
| `money-service`     | `npm test`                                | **62/62 suites, 570/570 tests.** One `prisma.shutdown.spec.ts` SIGTERM-timeout flake on the full parallel run — re-ran in isolation (`--runInBand`), passed clean in ~20s. Matches the pre-existing, previously-documented flake pattern (`LESSONS-LEARNED.md` L24), not a regression. |
| `operation-service` | `tsc --noEmit`                            | Clean                                                                                                                                                                                                                                                                                  |
| `operation-service` | `npm test`                                | **43/43 suites, 401/401 tests**, clean                                                                                                                                                                                                                                                 |
| `railway-gateway`   | `tsc --noEmit`                            | Clean                                                                                                                                                                                                                                                                                  |
| `railway-gateway`   | `npm test` (unit)                         | **3/3 suites, 23/23 tests**, matches the pre-existing baseline exactly                                                                                                                                                                                                                 |
| `railway-gateway`   | `npm run test:e2e`                        | **1/1 suite, 9/9 tests** — real HTTP requests through the live Express adapter (malformed-OHLC rejection, auth-header checks, idempotent re-posting, health/queue-stats endpoints); the strongest available confirmation the Express v5 route-matching change didn't break anything    |
| `railway-gateway`   | `npm run lint`                            | Fails ("no files matching pattern") — confirmed via `git stash` that this reproduces identically on the pre-change code (no `eslint.config.js` exists in this service at all). Pre-existing, unrelated to this upgrade, left untouched.                                                |
| Monolith (root)     | `npm run test:ci` (pre-push hook, run 3×) | **165/165 suites, 2,382/2,382 tests** every time — zero drift across all three pushes                                                                                                                                                                                                  |

Diff scope was double-checked after every `npm install`, not assumed: `git status`/install output
confirmed each service's changes stayed scoped to the intended `@nestjs/*` packages only, no source
file changes anywhere.

---

## 4. Live verification

- **`money-service` / `operation-service`:** pushing to `main` triggered their existing GitHub
  auto-deploy (confirmed via a Railway dashboard screenshot showing both services in a "Building"
  state immediately after the push). **Not independently re-verified against a live health endpoint
  after that auto-deploy completed** — see §7.
- **`railway-gateway`, first deploy (CLI, `railway up --ci`):** build succeeded; hit the real public
  health endpoint post-deploy — `GET https://railway-gateway-production-3796.up.railway.app/api/v1/
health` returned `200 {"status":"healthy","services":{"redis":"up","queue":"up","database":"up"},
"uptime":~56s}`, the uptime confirming it was genuinely the fresh deployment, not a cached response.
- **`railway-gateway`, GitHub-connect auto-build (no Root Directory set):** failed as documented in
  §1.5. Confirmed production was unaffected by hitting the same health endpoint immediately —
  `200 healthy` throughout, no interruption.
- **`railway-gateway`, post-Root-Directory-fix redeploy:** polled `railway deployment list --json`
  every 10s until the deployment left BUILDING/DEPLOYING; confirmed `SUCCESS`; hit the health
  endpoint again — `200 {"status":"healthy", ...}`, uptime ~26s confirming the new deployment was
  genuinely serving traffic.

---

## 5. Git history

Landed as 4 commits on `main`, each pushed individually (pre-push hook re-ran the full monolith
`test:ci` suite before allowing each push through):

| Commit     | Summary                                                                            |
| ---------- | ---------------------------------------------------------------------------------- |
| `d5a6c8c4` | `chore(deps): bump NestJS to 11.2.3 in money-service and operation-service`        |
| `a99495fb` | `chore(deps): upgrade railway-gateway to NestJS 11.2.3`                            |
| `41c9e9b8` | `docs: record railway-gateway production deploy and Railway CLI access correction` |
| `6d8489ad` | `docs: record railway-gateway GitHub connection and Root Directory fix`            |

All four are on `origin/main` as of this report.

---

## 6. Key decisions made

1. **Hold off on NestJS 12** — freshly tagged with no patch releases yet, and its lifecycle-hook and
   pipe-signature changes carry real risk for exactly the two money/auth-adjacent services. Same-major
   11.2.3 patch bump chosen instead. See §1.1.
2. **Investigate `railway-gateway`'s two flagged v10→v11 risks (Express v5 routing, config
   precedence) before deciding whether it needed its own separate session** — both turned out to be
   non-issues for this specific service's actual code, so it was done in the same pass rather than
   deferred. See §1.3.
3. **Deploy `railway-gateway` via CLI rather than wait to connect GitHub** — it wasn't GitHub-connected
   at the time, and the CLI was already authenticated and linked; deploying immediately was simpler
   and didn't require the monorepo Watch Paths decision to be made first. See §1.4.
4. **Confirm production was unaffected before attempting any fix**, both times something failed (the
   GitHub-connect auto-build, and before that nothing — no failures on the initial CLI deploy) — never
   assumed Railway's safe-rollout behavior, checked it directly via the live health endpoint each time.
5. **Root Directory required a manual browser step; Watch Paths was explicitly declined by Davin** —
   both are Railway web-UI-only settings with no CLI/API path found. The first was necessary to fix a
   failed build; the second was Davin's own call to skip, recorded as a decision, not an oversight.
   See §1.5.

---

## 7. Known gaps / explicitly out of scope

- **`money-service` and `operation-service`'s post-push production deploys were not independently
  live-verified** the way `railway-gateway`'s was — their GitHub auto-deploy was observed starting
  (a "Building" state in a Railway dashboard screenshot) but no live health-endpoint check was made
  against either service after that build completed. Worth a quick confirmation if not already
  routine practice for this repo's GitHub-triggered services.
- **Watch Paths remain unset on `railway-gateway`** — a deliberate decision by Davin (§1.5), not an
  oversight. Any push to `main` anywhere in the monorepo will still trigger a rebuild attempt here
  until this is set.
- **NestJS 12 upgrade for all three services remains open** — deliberately deferred until it has more
  patch releases behind it and the Node-version requirement can be confirmed against live Railway
  Node versions for each service. See §1.1.
- **`railway-gateway`'s pre-existing lint gap (no `eslint.config.js`) was not fixed** — confirmed
  unrelated to this upgrade (reproduces on pre-change code) and left untouched per scope discipline.

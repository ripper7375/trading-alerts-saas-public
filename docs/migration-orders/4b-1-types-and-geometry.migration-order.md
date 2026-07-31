# Migration Order: Session 4B-1 — Shared Types & Geometry Package

> Migration Order for Session **4B-1** (Shared Package Infrastructure & F9 Resolution).
> Variant: **INFRA / CONTRACT** · **Status:** CONFIRMED
> Target Services: Shared npm workspace / package (`@trading-alerts/types` or `@trading-alerts/geometry`), consumed by monolith and microservices (`operation-service`, `money-service`).

**Session:** 4B-1 (BUILD / INFRA) — next is Session 4B-2 (Alert Engine BUILD)
**Phase / plan section:** Phase 4B Step 1 — Types Package & Shared Geometry Extraction
**Target service:** Shared package workspace (`@trading-alerts/types`)
**Contract:** Exported TypeScript interfaces (`PriceEvent`, `AlertWatch`, `EvaluationContext`, `AlertFiredEvent`), Zod alert validation schemas, and shared drawing geometry math (`levelsForMark`, `MarkSnapshot`).
**Flags touched:** **F9** (resolved this session: shared package mechanics for monorepo/microservices).
**Estimated session time:** ~2.5h

---

## Entry criteria

- [x] Session 4A-12 (Slice 5 Outbox Email Worker) CUTOVER complete and live in production. Re-verified against `CLAUDE.md`'s own Current/Order-status blocks (CONFIRMED and executed 2026-07-30).
- [x] Codebase state re-verified: `lib/alert-engine/types.ts` exists (48 lines: `Direction`, `PriceEvent`, `AlertWatch`, `FireEvent`). `components/charts/drawing/geometry.ts` does not literally exist as a single file — it is a directory, `components/charts/drawing/geometry/` (7 files, 409 lines total: `channel.ts`, `fib.ts`, `horizontal.ts`, `index.ts`, `levels.ts`, `trendline.ts`, `types.ts`), already framework-free per its own header comment ("No imports from `lightweight-charts` or React are permitted anywhere under this directory"). Citation imprecision only — the module itself exists exactly where expected; recorded as a Deviation, not a blocker.
- [x] Resolution for **F9** decided at CONFIRM (see Deviations): **pnpm workspace** (`pnpm-workspace.yaml`, `packages/*`) for the monolith, since `pnpm-lock.yaml` (not the stale `package-lock.json`) is the actively-committed, Vercel-canonical lockfile (last touched by the Session 5-4 Vercel deploy fix, `be62d87f`). `operation-service`/`money-service` are deliberately NOT added as workspace members (they are independently deployed to Railway with their own `package-lock.json`/Root Directory, and root `tsconfig.json` already excludes them by design) — they instead consume the package via a local `file:` dependency, proven by a real `npm install` + `tsc --noEmit` in `operation-service`, not a live Railway deploy.

Provenance note (L11): this order file was untracked with no PRE-DRAFT→DRAFT→APPROVED commit history at CONFIRM time — consistent with the now-familiar pattern; resolved by Davin directing this CONFIRM and execution live in chat rather than trusting the header alone.

---

## Integration points

- **In:** Monolith `components/charts/drawing/geometry.ts`, `lib/alert-engine/types.ts`, `lib/validations/alert.ts`.
- **Out:** Consumed by monolith, `operation-service`, and `money-service`.
- **Owns:** Shared type definitions and drawing level calculation math (`levelsForMark`). Never fork the geometry math!

---

## Architectural Goal & Strategy

1. **Resolve F9:** Establish the packaging / workspace mechanics for `@trading-alerts/types` (and shared geometry utilities) so shared types and math can be imported by both the Next.js monolith (`@/components/...`) and NestJS microservices (`operation-service`, `money-service`).
2. **Extract Geometry Math:** Hoist `levelsForMark` and `MarkSnapshot` out of the Next.js frontend UI tree (`components/charts/drawing/geometry.ts`) into the shared package.
3. **Extract Core Types & Schemas:** Hoist `PriceEvent`, `AlertWatch`, `EvaluationContext`, and alert validations into `@trading-alerts/types`.
4. **Update Imports:** Update monolith imports (`lib/alert-engine/watches.ts`, `components/charts/drawing/*`) to consume the shared package, proving zero build breakages on Next.js monolith.

---

## Ordered Execution Steps

### Step 1: Package Workspace Infrastructure (F9 Resolution)

- Setup / configure package structure for `@trading-alerts/types` (or root `packages/types`).
- Ensure tsconfig, package.json build/export configs support both Next.js (Vercel) and NestJS (Railway) builds cleanly.
- **Commit:** `infra(types): establish @trading-alerts/types shared package workspace (F9)`

### Step 2: Extract & Hoist Drawing Geometry (`levelsForMark`)

- Extract pure geometry math (`levelsForMark`, `MarkSnapshot`, fib/trendline level math) into `@trading-alerts/types/geometry` (or `@trading-alerts/geometry`).
- Ensure zero React/DOM dependencies in the geometry module.
- **Commit:** `feat(types): hoist drawing geometry levelsForMark to shared package`

### Step 3: Extract Shared Core Types & Validations

- Move `PriceEvent`, `AlertWatch`, `EvaluationContext`, `AlertFiredEvent` into shared package.
- Move alert validation constants (`SYMBOLS`, `TIMEFRAMES`, `CONDITION_TYPES`) and Zod schemas into shared package.
- **Commit:** `feat(types): export alert engine core types and validation schemas`

### Step 4: Rewire Monolith Import References & Verify

- Update `lib/alert-engine/watches.ts`, `lib/alert-engine/types.ts`, `lib/validations/alert.ts`, and `components/charts/drawing/geometry.ts` (re-export or direct import) in monolith.
- Run monolith test suite and `tsc --noEmit`.
- **Commit:** `refactor(monolith): rewire alert-engine and geometry to @trading-alerts/types`

---

## Verification Plan (Done When)

- [x] `@trading-alerts/types` builds cleanly and exports geometry + alert types. `pnpm --filter @trading-alerts/types run build` (`tsc`) succeeds with zero errors; `dist/index.js` + subpath outputs (`dist/geometry/index.js`, `dist/alert-engine/types.js`, `dist/validations/alert.js`) all present with `.d.ts`.
- [x] Monolith `tsc --noEmit` and `npm run test:ci` pass 100% green. `tsc --noEmit`: 0 errors. `test:ci`: 122/122 suites, 2138/2138 tests — identical counts to the pre-session baseline (4A-12's close-out), confirming the rewire changed zero behavior.
- [x] `operation-service` can import `@trading-alerts/types` without TypeScript or runtime errors. Proved via a temporary smoke file (`src/__smoke-trading-alerts-types.ts`, deleted before close) importing all 3 subpaths + `tsc --noEmit` (clean) + `node -e "require('@trading-alerts/types')"` (resolved, all expected named exports present). `operation-service`'s own suite re-verified unaffected: 11/11 suites, 86/86 tests (matches its own pre-session baseline exactly).
- [x] F9 recorded as RESOLVED in `DECISION-LOG.md`.

---

## Deviations

1. **Entry-criteria citation imprecision:** `components/charts/drawing/geometry.ts` doesn't exist as a single file — it's a 7-file directory (409 lines). No impact; hoisted the whole module. Recorded at CONFIRM, not discovered mid-session.
2. **Contract-line types don't exist:** the order's own Contract line and Steps 3/56 cite `EvaluationContext`/`AlertFiredEvent` — neither exists anywhere in the codebase (grepped `lib/`, `__tests__/`). The real, live types are `Direction`, `PriceEvent`, `AlertWatch`, `FireEvent` (`lib/alert-engine/types.ts`). Hoisted the real names; did not invent the cited ones. Same class of drift as `LESSONS-LEARNED.md` L27.
3. **F9's own workspace-mechanics question, decided at CONFIRM:** pnpm workspace (`pnpm-workspace.yaml`, `packages/*`) for the monolith only — confirmed pnpm, not the stale `package-lock.json`, is Vercel-canonical via git history on `pnpm-lock.yaml` (last touched by the Session 5-4 Vercel deploy fix). `operation-service`/`money-service` deliberately NOT added as workspace members — they're independently deployed to Railway with their own lockfiles, and root `tsconfig.json` already excludes them by design (a pattern this session preserved rather than widened). Instead, `operation-service` consumes the package via a `file:../packages/types` dependency.
4. **Step 4's actual blast radius was larger than the order's own file list:** the order named only `lib/alert-engine/watches.ts`, `lib/alert-engine/types.ts`, `lib/validations/alert.ts`, and the geometry barrel. Grepping actual relative imports (not just the barrel path) found 6 more files under `components/charts/drawing/` (`types.ts`, `engine/coords.ts`, `marks/TrendlineMark.ts`, `marks/FibRetracementMark.ts`, `marks/ChannelMark.ts`, `marks/FibExtensionMark.ts`) that import individual geometry submodules directly by relative path (`../geometry/types`, `../geometry/trendline`, `../geometry/fib`, `../geometry/levels`), not through the barrel. The original plan (delete the underlying submodule files, keep only the barrel as a re-export) would have broken all 6. Fixed by turning every individual submodule file (`channel.ts`, `fib.ts`, `horizontal.ts`, `levels.ts`, `trendline.ts`, `types.ts`) into its own thin re-export shim, not just the barrel — caught before deleting anything, by re-checking relative-import patterns specifically (a plain substring grep for `drawing/geometry/` misses relative imports like `../geometry/fib`).
5. **A real TypeScript module-resolution gap, found and fixed:** `packages/types/package.json`'s subpath `exports` map (understood by the monolith's `bundler` resolution and by Node's own runtime `require()`) is NOT understood by `operation-service`'s classic/Node-style `moduleResolution` (its tsconfig doesn't set `node16`/`nodenext`/`bundler`) — `tsc --noEmit` failed on all 3 subpath imports with `TS2307`, even though the files existed and Node's runtime resolver found them fine. Fixed by adding a `typesVersions` field to `packages/types/package.json` (TypeScript's purpose-built mechanism for exactly this classic-resolution compatibility case), without touching `operation-service`'s own tsconfig at all. New `LESSONS-LEARNED.md` **L39**.
6. **Vercel/Railway build-time packaging, only half-closed this session:** added `pnpm --filter @trading-alerts/types run build` to the root `prebuild` script so the monolith's Vercel build always produces a fresh `dist/` before `next build` resolves the package (verified locally via `npm run prebuild`, full chain green). `operation-service`'s side is **not** closed the same way — its only working Railway deploy path (`railway up --path-as-root --service operation-service`, per `LESSONS-LEARNED.md` L23/L38, since it has no connected GitHub source) uploads a flattened archive of ONLY the `operation-service/` subdirectory. A `file:../packages/types` dependency almost certainly will NOT resolve under that upload mechanism, since the sibling `packages/types` directory isn't part of the archive. This session proved LOCAL resolution only (compile + runtime, per the order's own literal Done-When wording) — real Railway-deploy-time resolution for `operation-service` is an explicit, flagged follow-up for whichever session (most likely 4B-2, the first to actually import this package from `operation-service`'s live alert-engine source) first needs it to survive a real deploy.
7. **One-off Jest OOM, not a regression:** `operation-service`'s own `npm test` crashed 3 unrelated suites (`svc-token.guard`, `outbox-consumer.controller`, `two-factor.service` — none import `@trading-alerts/types`) with "Jest worker ran out of memory" immediately after a large monolith `test:ci` run. Re-ran clean seconds later: 11/11 suites, 86/86 tests, matching the exact pre-session baseline. Confirmed transient resource contention, not caused by this session's dependency change.
8. **Unrelated, not investigated further:** a `dotenv` startup "tip" banner line (`⌁ auth for agents [www.vestauth.com]`) appeared in `prisma generate`'s console output on two separate invocations this session. Not a directive, not something this session acted on; flagged to Davin directly in chat as unusual tool output rather than silently ignored.

---

## Next-session handoff

Session **4B-2 (Alert Engine BUILD)** already exists (`4b-2-alert-engine-build.migration-order.md`) — its own Entry Criterion 1 ("Session 4B-1 (`@trading-alerts/types` package & geometry hoist, F9) complete and verified") is now genuinely satisfied. Before starting it, re-verify Deviation 6 above (`operation-service`'s real Railway-deploy-time package resolution) — that session is the first one that will actually need this package to work in a live `operation-service` deploy, not just locally.

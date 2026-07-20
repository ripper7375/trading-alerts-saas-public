# Migration Order — Rewire the monolith (repoint imports + retire old schema)

> `TEMPLATE-PORT.md` variant (per `00-SKELETON-AND-RULES.md` §2's table — 2-2…2-4 all
> PORT). Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Low** — this is purely import-repointing; no model/field changes,
> no new business logic.
> **Status: EXECUTED** — approved by Davin, CONFIRMed this session (2026-07-20)
> after re-verifying codebase/runtime state found the original Entry Criteria #2/#3
> under-scoped (see the corrected criteria block below) — Davin approved the scope
> correction live and cleared execution. **Fully executed the same session** — all
> Slice-level verification items checked, including the one pre-existing,
> originally out-of-scope `npm run build` failure (F22 in `DECISION-LOG.md`), which
> Davin explicitly pulled into this session's scope as a same-session follow-up
> once found — see the Deviations section's F22 addendum. **Every "done when" item
> is now met**, including `npm run build` succeeding: `npm run build` exits 0,
> `npm run type-check` clean with zero exceptions, `npm run test:ci` 111/111
> suites / 2046/2046 tests, exact parity with Session 2-3's baseline. See the
> Deviations section for how much the actual scope grew beyond this order's
> original "repoint imports" framing.

**Session:** 2-4 · **Phase:** Phase 2 (`non_market_data` Prisma Schema, Workstream 6),
plan step 2.5–2.6 · **Variant:** PORT · **Generated:** 2026-07-20 (corrected) ·
**Flags touched:** none new (F4/F5 already closed by Session 2-2; F20 closed by
Session 2-3 — this session just finishes the rewire the plan's Phase 2 calls for).
**Estimated time:** unestimated (F12 open).
**Target service:** monolith-internal (same-repo, same-database import repointing — no
cross-stack move).
**Contract:** none (internal Prisma client import paths; no external API shape changes).

## Context carried over from Session 2-2 (schema split) and Session 2-3 (baseline + FK audit)

- **Two new schema files exist and are proven:** `prisma/market-data/schema.prisma`
  (1 model, `MarketDataV6`) and `prisma/non-market-data/schema.prisma` (26 models +
  `RefreshToken` stub, Session 2-2). Both `prisma validate` clean, both generate
  working clients (`node_modules/.prisma/market-client`,
  `node_modules/.prisma/non-market-client`).
- **Migration history baselined and FK audit applied — Session 2-3 executed and
  closed, F20 RESOLVED (re-verify still holds at CONFIRM, don't assume from this
  PRE-DRAFT's snapshot):** production's migration history is baselined. **One
  architectural deviation to be aware of, Davin-approved:** the two new schema
  files do NOT have independent migration histories — Prisma 7's migrations path is
  singular and config-driven, not per-`--schema` (confirmed empirically at 2-3's
  CONFIRM), so both schemas share the single `prisma/migrations/` folder as sole
  source of truth until a future physical DB split. This doesn't change this
  session's scope (consumer-repointing never touches migration history), but don't
  assume "two histories" if referencing the plan document, which still implies that.
  Full detail: `DECISION-LOG.md` F20, `LESSONS-LEARNED.md` L24.

  The money↔User FK audit (plan step 2.4) **has been applied to production**, not
  just planned. Confirmed dropped, each with column + index kept:

  | Model              | FK constraint dropped          | `userId` column | Index kept          |
  | ------------------ | ------------------------------ | --------------- | ------------------- |
  | `Subscription`     | `Subscription_userId_fkey`     | kept, unchanged | `@@index([userId])` |
  | `Payment`          | `Payment_userId_fkey`          | kept, unchanged | `@@index([userId])` |
  | `FraudAlert`       | `FraudAlert_userId_fkey`       | kept, unchanged | `@@index([userId])` |
  | `AffiliateProfile` | `AffiliateProfile_userId_fkey` | kept, unchanged | `@@index([userId])` |

  `User`'s 4 matching reverse fields (`subscription`, `payments`, `fraudAlerts`,
  `affiliateProfile`) are also gone from `prisma/non-market-data/schema.prisma`.
  Generated client's `SubscriptionInclude`/`PaymentInclude`/`FraudAlertInclude`/
  `AffiliateProfileInclude` no longer expose a `user` accessor (spot-checked in
  `index.d.ts` at 2-3's close). **This session's consumer-repointing work must
  account for that** — any of the 16 files that previously did
  `include: { user: true }` (or similar relation-based queries) on these 4 models
  will no longer compile once repointed to the non-market client, and needs a plain
  `prisma.user.findUnique({ where: { id: payment.userId } })`-style lookup instead
  — grep for `.user` includes on these 4 models specifically before repointing,
  don't assume Session 2-3 already caught every call site (it didn't try to — that
  was explicitly out of 2-3's scope).

- **Old `prisma/schema.prisma` is untouched and change-frozen (CC-F)** — it is still
  the only schema every existing consumer actually imports from (`@prisma/client` →
  `node_modules/.prisma/client`, the original default output). **Unless Session 2-3
  needed to touch it for baselining** (re-verify — baselining is usually
  migration-history-only, not schema-file changes, but confirm no drift).
- **Generation mechanism confirmed:** each new client needs its own
  `prisma generate --schema=<path>` invocation (`prisma.config.ts`'s `schema` field is
  a single string, can't hold both — confirmed via `@prisma/config@7.8.0`'s own
  `.d.ts`). `package.json` already has `prisma:generate:market-data` /
  `prisma:generate:non-market-data` scripts wired into `type-check`; this session
  should extend that wiring to `prebuild`/`postinstall` now that consumers actually
  depend on the new clients at runtime (not done in 2-2 — wasn't load-bearing yet;
  now it is).
- **Preliminary finding, re-verify at CONFIRM:** of the 16 known consumer files, an
  initial grep in Session 2-2 found **none** appear to touch `MarketDataV6` directly —
  all 16 reference disbursement/affiliate/auth/session models (the non-market set).
  If this holds, all 16 imports repoint to the **non-market** client and zero repoint
  to the market client — worth confirming explicitly rather than assuming, since a
  wrong-client repoint is this variant's core risk (see Rules below).

## Entry criteria

> **Corrected at CONFIRM (2026-07-20, this session)** — the original #2/#3 below
> scoped everything to "the 16 consumer files," a count that only ever meant "files
> with a literal `import ... from '@prisma/client'`" (Session 2-1's blast-radius
> grep). Live-state re-verification found that count is now 14, and — far more
> importantly — **97 additional files** get Prisma via the `{ prisma }` singleton
> exported from `lib/db/prisma.ts` and never appear in that grep at all. Confirmed
> zero of those 97 touch `MarketDataV6`, so repointing the singleton itself is safe
> and every downstream singleton-consumer inherits the correct client for free. But
> the FK-audit `.user`-include breakage isn't confined to the 14/16 — it hits ANY
> caller regardless of which import path it uses. A full-repo grep (not scoped to
> the 16-file list) found 3 such files / 6 call sites that were invisible to the
> original scoping. See `DECISION-LOG.md` (or this session's CONFIRM report) for the
> full finding. Corrected criteria below.

- [ ] Session 2-3 fully closed — migration history baselined (single shared
      `prisma/migrations/`, per the deviation, not two independent histories; F20
      RESOLVED in `DECISION-LOG.md`), money↔User FK audit applied and documented —
      re-verify at CONFIRM, don't assume from this PRE-DRAFT's context.
- [ ] **File inventory re-verified (corrected methodology):** `lib/db/prisma.ts` is
      the real repoint choke-point — every consumer that imports `{ prisma }` from
      `@/lib/db/prisma` (currently ~97 files) inherits whichever client that
      singleton is instantiated against; confirm none of them reference
      `MarketDataV6` (re-run
      `grep -rl MarketDataV6 app/** lib/** prisma/**` — expect zero hits, meaning the
      singleton can safely become the non-market client outright). Separately,
      re-run the literal-import grep
      (`grep -rlE "from ['\"]@prisma/client['\"]" app/** lib/** prisma/**`, excluding
      `frontend/`, `railway-gateway/`, `seed-code/` per the standing do-not-touch
      list) for the files that bypass the singleton and instantiate/import
      `@prisma/client` directly (own `PrismaClient` instance, or just `Prisma.*`
      namespace types) — confirm the current count and target client per file by
      reading its actual Prisma model usage, not just its import line.
- [ ] **Grep for `.user` relation includes/selects at full repo scope** — run
      `grep -rn "include:.*user\|select:.*user" app/** lib/**` (not restricted to the
      16/14-file list or test files only) for `.user` includes/selects on `Payment`,
      `Subscription`, `FraudAlert`, `AffiliateProfile` specifically — build the
      complete list of call sites needing a plain lookup instead of a relation
      include, per Session 2-3's FK-audit changes. The literal-import file list is
      not a valid proxy for this — files that only ever touch Prisma via the
      singleton can still hit dropped relations.
- [ ] `railway-gateway/prisma/schema.prisma`'s `MarketDataV6` mirror re-diffed against
      the now-separate `prisma/market-data/schema.prisma` — must stay byte-for-byte
      identical in field list (that file's own header comment requires it); confirm no
      drift crept in between sessions.
- [ ] `prisma.config.ts`'s `schema` field and `package.json`'s `prebuild`/
      `postinstall`/`db:generate` scripts still point at the bare default
      `prisma generate` (which resolves against `prisma/schema.prisma` via
      `prisma.config.ts`) — confirm this is still true; if so, the Retire step below
      needs the explicit config/script-wiring fix, not just a file deletion, or
      `npm run build` breaks immediately post-retirement.

## Integration points

- **In:** the same 16 files Session 2-2 identified — each gets its `@prisma/client`
  import repointed to whichever new client (`node_modules/.prisma/market-client` or
  `.../non-market-client`) actually owns the models it queries; plus any call sites
  found by the FK-audit grep above.
- **Out:** none new.
- **Owns:** same two schema files as 2-2/2-3; this session doesn't add/change models,
  only consumer wiring + retiring the old schema file.

## File Port Order

_(re-derive the exact 16-file list + per-file target client at CONFIRM — Session 2-2's
grep is a snapshot, not ground truth by then)_

### Repoint step (all 16 files)

- **SOURCE:** each file's `import { PrismaClient, ... } from '@prisma/client'` (or
  `lib/db/prisma.ts`'s `PrismaClient` instantiation specifically) → **TARGET:** the
  correct new client's generated import path.
- **Kind:** port + adapt (import path + `PrismaPg` adapter wiring per new client,
  following `lib/db/prisma.ts`'s Session 2-1 pattern for each of the two new clients;
  plus adapting any `.user` relation-include call site on `Payment`/`Subscription`/
  `FraudAlert`/`AffiliateProfile` per Session 2-3's FK audit).
- **Invariants:** no query logic changes beyond the FK-audit adaptation above — only
  which client module is imported/instantiated, and how the (now-dropped) 4 relations
  are looked up. Every existing call site's _observable behavior_ must be identical.
- **Parity proof:** full `npm run test:ci` re-run post-repoint, byte-for-byte parity
  vs Session 2-3's baseline.
- **Commit:** `migrate(2-4): repoint <N> consumer imports to split Prisma clients`

### Config/build-wiring step (added at CONFIRM — was missing from the original draft)

- **SOURCE:** `prisma.config.ts`'s `schema:` field (currently
  `'prisma/schema.prisma'`); `package.json`'s `prebuild`, `postinstall`, and
  `db:generate` scripts (currently bare `prisma generate`, which resolves against
  that same default schema).
- **Kind:** adapt. Repoint `prisma.config.ts`'s default `schema` at
  `prisma/non-market-data/schema.prisma` (the larger of the two, and the one
  `migrate deploy`/`status` most plausibly need a resolvable schema for); replace
  the bare `prisma generate` in `prebuild`/`postinstall`/`db:generate` with explicit
  calls to both `prisma:generate:market-data` and `prisma:generate:non-market-data`
  (both scripts already exist) so a fresh install/build still produces both
  clients without relying on the now-deleted default schema.
- **Invariants:** `npm run build` and a clean `npm ci && npm run build` must both
  succeed after this step — this is what the original draft's "done when" checklist
  assumed would just work without spelling out this step.
- **Commit:** part of the repoint commit (see below) — this is infrastructure the
  retire step depends on, not a separate deliverable.

### Retire step

- **SOURCE:** `prisma/schema.prisma` → deleted once all consumers (singleton +
  direct importers) are repointed, the config/build-wiring step above is done, and
  parity is re-confirmed.
- **Commit:** `migrate(2-4): retire prisma/schema.prisma, split complete`

## Rules specific to this variant

- Wrong Prisma client = boundary violation (market vs non-market) — this is the whole
  point of F5; get every one of the 16 files right, not just most of them.
- Changing a ported test's assertion requires a written justification in Deviations.
- Do not delete `prisma/schema.prisma` until every one of the 16 consumers is
  confirmed repointed AND `npm run test:ci` shows full parity — a half-repointed state
  is exactly the "half-deployed" state `EXECUTOR-PROTOCOL.md` §1 non-negotiable 2
  forbids ending a session in.
- `railway-gateway/prisma/schema.prisma`'s own `MarketDataV6` mirror is NOT touched by
  this session (it's SEPARATE_STACK, decoupled since Session 2-1) — only re-verify its
  field list still matches, per the entry criteria above.

## Slice-level verification (done when)

- [x] `lib/db/prisma.ts` singleton repointed to the non-market client; every direct
      `@prisma/client` importer repointed to whichever new client actually owns the
      models it queries; zero remaining imports of the old default `@prisma/client`
      output anywhere in `app/**`/`lib/**`/`prisma/seed.ts`.
- [x] All FK-audit call sites (Payment/Subscription/FraudAlert/AffiliateProfile → User
      includes), found via the full-repo grep (not the old 16-file scope), adapted to
      plain lookups; no compile errors from the dropped relations.
- [x] `prisma.config.ts` and `package.json`'s `prebuild`/`postinstall`/`db:generate`
      repointed off the deleted default schema (see Config/build-wiring step).
- [x] `prisma/schema.prisma` deleted; `migration-cutover-table.md` updated if
      applicable; `migration-stack-analysis.md`'s `prisma/` entries updated (file
      retired, not just added).
- [x] Full `npm run test:ci` still green, parity vs Session 2-3's baseline — any drift
      is a finding.
- [x] `npm run type-check` clean; `npm run build` succeeds (proves Next's bundler
      resolves both new client import paths correctly, not just `tsc`) — met via the
      F22 addendum in Deviations (fixed same session, at Davin's request, after the
      original build failure was first logged as out-of-scope).

## Cutover & rollback (reference only — no separate service to shadow-run against)

- **Mechanism:** no flag needed — this is an atomic in-place import rewrite within one
  repo, one database. Repoint + delete old schema in the same session (per PORT rules
  above, the session doesn't end until this is fully verified, not half-done).
- **Rollback:** revert the commit(s); old `prisma/schema.prisma` and all 16 original
  imports restored via git.

## Retire (after this session)

- [ ] Old `prisma/schema.prisma` deleted (see Retire step above).
- [ ] Update `migration-stack-analysis.md`'s `prisma/` block: old schema file leaves
      the inventory, both new files' status changes from "not yet consumed" to "live."

## Deviations

- **Scope grew far beyond "repoint imports" during execution, not just at CONFIRM.**
  CONFIRM's own corrected estimate (3 files / 6 FK-audit call sites) was itself
  wrong — the actual full-repo grep found 17 files / ~24 call sites, and several of
  those were only discovered via `tsc --noEmit` mid-execution, not the grep:
  - **Case-sensitivity miss:** CONFIRM's "zero files touch MarketDataV6" claim was
    false — 2 files use `prisma.marketDataV6` (camelCase client property), invisible
    to a grep for the PascalCase model name. Added a new `lib/db/market-prisma.ts`
    singleton (not in this order's original plan) so those 2 files get the market
    client without exposing it to every other consumer via the main singleton.
  - **Reverse relation direction never checked:** the FK audit (Session 2-3) dropped
    `Subscription`/`Payment`/`FraudAlert`/`AffiliateProfile`'s relation to `User`,
    but also `User`'s 4 reverse fields. This order's entry criteria (even corrected)
    only grepped the forward direction (`Subscription.include.user`); the reverse
    (`User.include.subscription`/`payments`) broke 5 more files, caught only by
    `tsc --noEmit` after the first fix pass.
  - **Missing config/build-wiring step**, added during CONFIRM correction:
    `prisma.config.ts`'s default schema and `package.json`'s
    `prebuild`/`postinstall`/`db:generate` still pointed at the schema this order
    deletes — without this step `npm run build` would have broken immediately post-
    retirement for an entirely different reason than F22.
  - **Test infrastructure needed real fixes, not just production code.** Every test
    mocking the old relation-embedded shape needed updating to stub the new separate
    lookups. Found and fixed a genuine Jest gotcha along the way (jest.mock()
    hoisting is per-file; a shared setup file's mock only applies if imported before
    the module under test) — cost real diagnostic time (see `LESSONS-LEARNED.md`
    L26), including a mid-session regression where the pre-commit `eslint --fix`
    silently re-broke 5 files' import order after they were first fixed.
- **`npm run build` still fails — confirmed pre-existing, not fixed.** A real bug
  (`lib/affiliate/constants.ts` mixing a client-safe constant with a top-level
  server-only Prisma import, breaking any `'use client'` page that imports it) was
  found but not fixed — confirmed via git blame to predate this session (Session
  2-1, same calendar day). Fixing it means splitting that file, a real architecture
  change outside this order's FK/relation-repoint mandate. Logged as new flag F22,
  OPEN, needs Davin's go-ahead. This order's own "done when" checklist item for
  `npm run build succeeding` is therefore NOT met — everything else is.
- **railway-gateway's MarketDataV6 mirror comment drift, found and fixed separately
  from the main repoint work** (commit `b48f74cd`, before the corrected order's
  entry criteria were even re-verified): Session 2-2 added explanatory inline
  comments to `prisma/market-data/schema.prisma` that were never mirrored back to
  `railway-gateway/prisma/schema.prisma`, violating that file's own byte-for-byte
  header requirement. Field list was already identical; synced the comments only —
  the "known wrinkle" below (do not touch railway-gateway's file layout/Prisma
  version) was respected throughout.
- **Addendum — F22 follow-up, requested and executed later the same session, after
  the Deviations above were already written and this order's status first read
  EXECUTED (commit `7d01adaa`):** the `npm run build` failure logged as F22 above
  was not left OPEN. Davin explicitly asked for it to be fixed live, same session
  ("A broken build means we cannot deploy, so we cannot leave Phase 2 with a
  failing `npm run build`"), pulling it into this order's scope after the fact
  rather than leaving it for a future session. This is a **material, boundary-
  touching change** by this order's own Rules-specific-to-this-variant standard —
  it edits `lib/affiliate/constants.ts`, a file this order's original File Port
  Order never listed — so it is recorded here as a deviation, not silently folded
  into the main narrative above.
  - **Fix:** `lib/affiliate/constants.ts` mixed a client-safe constant
    (`AFFILIATE_CONFIG`) with 6 server-only DB-backed functions behind one
    top-level `import { prisma } from '@/lib/db/prisma'`, which tainted the whole
    module — and therefore any `'use client'` page importing anything from it —
    with `@prisma/adapter-pg`'s `pg`/`dns` dependency chain, unresolvable in a
    browser bundle. Confirmed pre-existing (predates this order; introduced by
    Session 2-1's adapter-pg pattern, same calendar day but a prior session) via
    `git log`/`git blame` and a pristine-file-swap `npm run build` re-run — not
    something this order's repoint work introduced. Split into two files: the 6
    functions moved to a new `lib/affiliate/db.ts` (server-only); `constants.ts`
    now exports only `AFFILIATE_CONFIG`, `CODE_GENERATION`, and types. 5 consumers
    repointed to import the DB-backed functions from `./db` instead.
  - **Bonus fix, same follow-up, Davin approved live after being surfaced as a
    second, unrelated blocker:** once F22 was fixed, `npm run build` progressed
    further and failed at the `tsc`-within-`next-build` stage on 2 more
    pre-existing, unrelated errors — `app/api/drawings/route.ts` and
    `app/api/drawings/[id]/route.ts`, where `lib/drawing/schema.ts`'s Zod
    `.passthrough()` schema produces a type Prisma's strict `InputJsonValue`
    can't structurally verify. Also confirmed pre-existing via git blame before
    touching it. Fixed via `as Prisma.InputJsonValue` casts at both call sites
    (following the existing pattern already used in
    `lib/affiliate/registration.ts`), not by loosening the Zod schema.
  - **Why this belongs in Deviations, not just DECISION-LOG.md:** this order's own
    File Port Order (above) never named `lib/affiliate/constants.ts`,
    `lib/affiliate/db.ts`, or either `app/api/drawings/*` route as in-scope files —
    they were pulled in live, at Davin's explicit request, after the order's
    original Slice-level verification was already fully checked. Full technical
    detail, evidence, and Davin's exact request are in `DECISION-LOG.md` F22
    (RESOLVED).
  - **Parity proof:** full `npm run test:ci` re-run after both fixes — 111/111
    suites, 2046/2046 tests, no regressions, same as the main repoint work above.
  - **Commits:** `495cbea2` (constants/db split), `5b139acc` (Drawing
    `InputJsonValue` cast), `27257e59` (DECISION-LOG.md F22 marked RESOLVED).

## Known wrinkles / do-not-touch

- `railway-gateway/prisma/schema.prisma` mirrors `MarketDataV6` for its own
  `prisma generate` only — do not touch `railway-gateway`'s own file layout or bump
  its Prisma version as part of this session (still Session 2-1's decoupled,
  undeployed service).
- `lib/api/index.ts` — known-broken by design, Phase 7's problem, not this session's.
- If any of the 16 files turns out to need models from BOTH clients (hasn't been
  checked yet — Session 2-2's grep only confirmed the import line exists, not which
  specific models are queried), that file needs both clients instantiated side by
  side — flag it explicitly rather than picking one arbitrarily.

## Next-session handoff

_Per the plan/playbook, Phase 2 exit criteria are checked once this session closes
(plan step 2.6). Phase 3 (auth) begins with Session 3-1 — F6/F7 (auth strategy,
HS256 vs JWKS) are Davin's calls, due at that session's start._

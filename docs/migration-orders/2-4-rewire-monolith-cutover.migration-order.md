# Migration Order — Rewire the monolith (repoint imports + retire old schema)

> `TEMPLATE-PORT.md` variant (per `00-SKELETON-AND-RULES.md` §2's table — 2-2…2-4 all
> PORT). Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Low** — this is purely import-repointing; no model/field changes,
> no new business logic.
> **Status: PRE-DRAFT** — originally written by the Executor at Session 2-2's close
> (2026-07-20) under the ad-hoc label "2-2b"; **corrected and renumbered to match the
> playbook's own Session 2-4 ("Rewire the monolith")** at Session 2-2's follow-up
> close, once it became clear the playbook already sequences this work as 2-4, after
> a dedicated Session 2-3 (baseline + FK audit) — not as an immediate "2-2b" — see
> `LESSONS-LEARNED.md` L23. **Refreshed at Session 2-3's close (2026-07-20) now that
> 2-3 has actually executed** — the "should now be baselined" hedging below is
> replaced with confirmed facts; see `DECISION-LOG.md` F20 and `LESSONS-LEARNED.md`
> L24 for full detail. Needs the Advisor to produce the DRAFT, then Davin's APPROVAL,
> before a future session CONFIRMs and executes it. **Entry criteria depend on
> Session 2-3, which is now closed** (F20 RESOLVED).

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

- [ ] Session 2-3 fully closed — migration history baselined (single shared
      `prisma/migrations/`, per the deviation, not two independent histories; F20
      RESOLVED in `DECISION-LOG.md`), money↔User FK audit applied and documented —
      re-verify at CONFIRM, don't assume from this PRE-DRAFT's context.
- [ ] File inventory re-verified: re-run the 16-consumer-file grep against live
      `app/**`, `lib/**`, `prisma/seed.ts` (scoped to exclude `frontend/` mirror,
      `railway-gateway/`, `seed-code/` vendor dirs per the standing do-not-touch list)
      — confirm still 16, confirm which client(s) each one actually needs by reading
      its Prisma model usage, not just its import line.
- [ ] Grep all 16 files (plus any test files) for `.user` relation includes/selects on
      `Payment`, `Subscription`, `FraudAlert`, `AffiliateProfile` specifically — build
      the list of call sites that need a plain lookup instead of a relation include,
      per Session 2-3's FK-audit changes.
- [ ] `railway-gateway/prisma/schema.prisma`'s `MarketDataV6` mirror re-diffed against
      the now-separate `prisma/market-data/schema.prisma` — must stay byte-for-byte
      identical in field list (that file's own header comment requires it); confirm no
      drift crept in between sessions.

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

### Retire step

- **SOURCE:** `prisma/schema.prisma` → deleted once all 16 consumers are repointed and
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

- [ ] All 16 consumer files import from the correct new client (market vs
      non-market); zero remaining imports of the old default `@prisma/client` output
      in `app/**`/`lib/**`/`prisma/seed.ts`.
- [ ] All FK-audit call sites (Payment/Subscription/FraudAlert/AffiliateProfile → User
      includes) adapted to plain lookups; no compile errors from the dropped relations.
- [ ] `prisma/schema.prisma` deleted; `migration-cutover-table.md` updated if
      applicable; `migration-stack-analysis.md`'s `prisma/` entries updated (file
      retired, not just added).
- [ ] Full `npm run test:ci` still green, parity vs Session 2-3's baseline — any drift
      is a finding.
- [ ] `npm run type-check` clean; `npm run build` succeeds (proves Next's bundler
      resolves both new client import paths correctly, not just `tsc`).

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

_(filled during execution)_

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

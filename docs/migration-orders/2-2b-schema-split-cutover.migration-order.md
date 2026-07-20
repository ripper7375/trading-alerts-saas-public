# Migration Order — Schema split cutover (repoint imports + retire old schema)

> `TEMPLATE-PORT.md` variant (continuation of 2-2 — see `00-SKELETON-AND-RULES.md` §2's
> table, 2-2…2-4 all PORT). Read `00-SKELETON-AND-RULES.md` §4 first.
> **Creativity dial: Low** — this is purely import-repointing; no model/field changes,
> no new business logic.
> **Status: PRE-DRAFT** — written by the Executor at Session 2-2's close (2026-07-20).
> Needs the Advisor to produce the DRAFT, then Davin's APPROVAL, before a future
> session CONFIRMs and executes it.

**Session:** 2-2b · **Phase:** Phase 2 (`non_market_data` Prisma Schema, Workstream 6) ·
**Variant:** PORT · **Generated:** 2026-07-20 · **Flags touched:** none new (F4/F5
already closed by Session 2-2 — this session just finishes the cutover they specified).
**Estimated time:** unestimated (F12 open).
**Target service:** monolith-internal (same-repo, same-database import repointing — no
cross-stack move).
**Contract:** none (internal Prisma client import paths; no external API shape changes).

## Context carried over from Session 2-2 (schema split created + validated)

- **Two new schema files exist and are proven:** `prisma/market-data/schema.prisma`
  (1 model, `MarketDataV6`) and `prisma/non-market-data/schema.prisma` (26 models +
  new `RefreshToken` stub). Both `prisma validate` clean, both generate working
  clients (`node_modules/.prisma/market-client`,
  `node_modules/.prisma/non-market-client`).
- **Old `prisma/schema.prisma` is untouched and change-frozen (CC-F)** — it is still
  the only schema every existing consumer actually imports from (`@prisma/client` →
  `node_modules/.prisma/client`, the original default output).
- **Generation mechanism confirmed:** each new client needs its own
  `prisma generate --schema=<path>` invocation (`prisma.config.ts`'s `schema` field is
  a single string, can't hold both — confirmed via `@prisma/config@7.8.0`'s own
  `.d.ts`). `package.json` already has `prisma:generate:market-data` /
  `prisma:generate:non-market-data` scripts wired into `type-check`; this session
  should extend that wiring to `prebuild`/`postinstall` once consumers actually depend
  on the new clients at runtime (not done in 2-2 — wasn't load-bearing yet).
- **Preliminary finding, re-verify at CONFIRM:** of the 16 known consumer files, an
  initial grep in Session 2-2 found **none** appear to touch `MarketDataV6` directly —
  all 16 reference disbursement/affiliate/auth/session models (the non-market set).
  If this holds, all 16 imports repoint to the **non-market** client and zero repoint
  to the market client — worth confirming explicitly rather than assuming, since a
  wrong-client repoint is this variant's core risk (see Rules below).

## Entry criteria

- [ ] Session 2-2 fully closed — both new schema files validated, F4/F5 RESOLVED in
      `DECISION-LOG.md`, `npm run test:ci` parity confirmed (111/111, 2046/2046) —
      re-verify at CONFIRM, don't assume from this PRE-DRAFT's context.
- [ ] File inventory re-verified: re-run the 16-consumer-file grep against live
      `app/**`, `lib/**`, `prisma/seed.ts` (scoped to exclude `frontend/` mirror,
      `railway-gateway/`, `seed-code/` vendor dirs per the standing do-not-touch list)
      — confirm still 16, confirm which client(s) each one actually needs by reading
      its Prisma model usage, not just its import line.
- [ ] `railway-gateway/prisma/schema.prisma`'s `MarketDataV6` mirror re-diffed against
      the now-separate `prisma/market-data/schema.prisma` — must stay byte-for-byte
      identical in field list (that file's own header comment requires it); confirm no
      drift crept in between sessions.

## Integration points

- **In:** the same 16 files Session 2-2 identified — each gets its `@prisma/client`
  import repointed to whichever new client (`node_modules/.prisma/market-client` or
  `.../non-market-client`) actually owns the models it queries.
- **Out:** none new.
- **Owns:** same two schema files as 2-2; this session doesn't add/change models, only
  consumer wiring + retiring the old schema file.

## File Port Order

_(re-derive the exact 16-file list + per-file target client at CONFIRM — Session 2-2's
grep is a snapshot, not ground truth by then)_

### Repoint step (all 16 files)

- **SOURCE:** each file's `import { PrismaClient, ... } from '@prisma/client'` (or
  `lib/db/prisma.ts`'s `PrismaClient` instantiation specifically) → **TARGET:** the
  correct new client's generated import path.
- **Kind:** port + adapt (import path + `PrismaPg` adapter wiring per new client,
  following `lib/db/prisma.ts`'s Session 2-1 pattern for each of the two new clients).
- **Invariants:** no query logic changes — only which client module is imported and
  instantiated from. Every existing call site's behavior must be identical.
- **Parity proof:** full `npm run test:ci` re-run post-repoint, byte-for-byte parity
  vs Session 2-2's baseline (111/111, 2046/2046).
- **Commit:** `migrate(2-2b): repoint <N> consumer imports to split Prisma clients`

### Retire step

- **SOURCE:** `prisma/schema.prisma` → deleted once all 16 consumers are repointed and
  parity is re-confirmed.
- **Commit:** `migrate(2-2b): retire prisma/schema.prisma, split complete`

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
- [ ] `prisma/schema.prisma` deleted; `migration-cutover-table.md` updated if
      applicable; `migration-stack-analysis.md`'s `prisma/` entries updated (file
      retired, not just added).
- [ ] Full `npm run test:ci` still green, parity vs Session 2-2's baseline (111/111
      suites, 2046/2046 tests) — any drift is a finding.
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

_Session 2-3 — Baseline migration + FK audit._ Once 2-2b closes, Session 2-3 baselines
the migration history for both new schemas against the existing database
(`prisma migrate resolve --applied`), resolving the unbaselined history (F20) before
proceeding to Phase 3.

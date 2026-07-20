# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 2, Session 2-2 (complete — Prisma schema split into
  `prisma/market-data/schema.prisma` + `prisma/non-market-data/schema.prisma`,
  created + validated, F4/F5 resolved) — 2026-07-20. Phase 1 still formally NOT
  exit-clean (F18 the sole blocker, unchanged, dashboard-only). Phase 0 still
  formally open (CC-A gap unchanged, see below).
- **Current order:** `docs/migration-orders/2-2-model-census-schema-split.migration-order.md`
  (EXECUTED, both File Port Order steps complete, all 3 Done-when items checked)
- **Order status:** EXECUTED — 27 live models split as designed: `MarketDataV6` alone
  into `prisma/market-data/schema.prisma` (own client output
  `node_modules/.prisma/market-client`), the other 26 models + all 18 enums +
  one new minimal-stub model (`RefreshToken`: `id`/`token`/`userId`/`expiresAt` only,
  real shape deferred to F6/F7) into `prisma/non-market-data/schema.prisma` (own
  client output `node_modules/.prisma/non-market-client`). Both byte-for-byte ports
  of the original, both `prisma validate` clean, both generate working clients.
  Mechanism confirmed empirically (not just recommended): `@prisma/config@7.8.0`'s
  own `.d.ts` declares `schema?: string` (singular) — the config file can't hold two
  paths, so each client is generated via its own `prisma generate --schema=<path>`
  invocation; two new `package.json` scripts do this and are now wired into
  `type-check` so it's a real repeatable gate, not a one-off manual check. Old
  `prisma/schema.prisma` is untouched and now change-frozen (CC-F) — still the only
  schema all 16 existing consumers import from. Full `npm run test:ci` re-run
  post-split: 111/111 suites, 2046/2046 tests, exact parity with Session 2-1's
  baseline, no drift. Cutover (repointing those 16 imports, retiring the old schema
  file) explicitly deferred to Session 2-2b per the Advisor's own cutover-split
  decision recorded in the order — this session did NOT touch any consumer imports.
- **Waiting on:** (1, non-blocking, unchanged) `deploy.yml` still fails on every push
  to `main` at the GitHub workflow-file level (0s runtime) — known NOT to block real
  Vercel deploys (Session 2-1 confirmed Vercel's own mechanism works independently),
  just dead/broken CI hygiene, not urgent. `DIRECT_URL` on Vercel RESOLVED (Session
  2-1, Davin added it). (2, urgent, unchanged) Production's Prisma migration history
  is still completely unbaselined (`prisma migrate status`: all 6 migrations
  unapplied server-side), and one pending migration (`drop_watchlists`) would DROP
  two live, data-holding tables (`Watchlist`/`WatchlistItem`) if `migrate deploy` is
  ever run as-is. F20 in `DECISION-LOG.md`. **Now concrete, not hypothetical:** the
  schema split is done — Session 2-3 must baseline TWO schema files
  (`prisma/market-data/`, `prisma/non-market-data/`) against the one existing,
  unbaselined database, not one file as originally scoped. Worth Davin deciding
  whether to pull F20's baselining forward again given this added complexity.
  (3, non-blocking, unchanged) F18's RPO gap — Railway automated-backup cadence
  still unverified via CLI (dashboard-only). (4, unchanged, carried over) Davin to
  grant Vercel dashboard/preview-branch access — Railway access exists in this
  environment, Vercel access still fully absent. (5, unchanged, carried over) A
  human with delete permission to remove 5 remote branches — this session's git
  credential can push/create branches but gets `HTTP 403` on `git push --delete`.
  Branches: `fix/tsconfig-exclude-case-sensitivity`,
  `salvage/windowed-centroid-cfl-indicator` (both merged), plus 3 stale `claude/*`
  branches. (6, unchanged, carried over) `railway`'s `tcp-proxy`/`private-network`
  CLI commands still not verified — low priority, nobody's blocked on it.
  (7, new) Session 2-2's preliminary grep found none of the 16 known consumer files
  appear to touch `MarketDataV6` directly (all reference disbursement/affiliate/
  auth/session models) — if this holds at 2-2b's CONFIRM, all 16 repoint to the
  non-market client and zero to the market client, but this needs re-verifying
  per-file (by model usage, not just the import line), not assumed. (8, new)
  Session 2-2b (PRE-DRAFTed this session) needs the Advisor to produce its DRAFT,
  then Davin's APPROVAL, before a future session can CONFIRM and execute the
  cutover (repoint 16 imports, retire old schema file).
- **Last session did:** Session 2-2 (Model census + schema split, PORT variant,
  low creativity dial) — CONFIRM re-verified all 4 entry criteria against live
  state: Session 2-1 closed or 7.8.0 confirmed installed; Prisma 7's multi-schema
  mechanism confirmed empirically via `@prisma/config@7.8.0`'s own type def and
  `prisma generate --help`/`prisma migrate dev --help` (`--schema` flag, singular
  config field); file inventory re-verified (27 live models, exact name match
  against the PRE-DRAFT census, `MarketDataV6` confirmed relation-free); F4/F5
  classification held on the order's own "approved by Davin" header attestation.
  No failing entry criteria. **Executed both File Port Order steps:** created
  `prisma/market-data/schema.prisma` (pure port, `MarketDataV6` only) and
  `prisma/non-market-data/schema.prisma` (pure port of the other 26 models + all 18
  enums, plus the approved minimal `RefreshToken` stub — exactly the 4 approved
  fields, nothing more). Added two `package.json` scripts
  (`prisma:generate:market-data`, `prisma:generate:non-market-data`) and wired them
  into `type-check` so the split's build correctness is continuously checked, not
  just verified once manually — flagged as a deviation since it wasn't in the
  original File Port Order but was needed to make the order's own "done when" gate
  real. Ran the full verification suite: both schemas `prisma validate` clean, both
  generate working clients with correct types (spot-checked `RefreshToken` and
  `MarketDataV6` in the generated `.d.ts` files), `npm run type-check` clean (exit
  0), full `npm run test:ci` — 111/111 suites, 2046/2046 tests, exact parity, no
  drift. F4 and F5 both RESOLVED in `DECISION-LOG.md`. Did NOT touch any of the 16
  consumer imports or the old schema file — that's Session 2-2b, PRE-DRAFTed this
  session's close. No new `LESSONS-LEARNED.md` entry — nothing this session cost
  > 30 min to diagnose or surfaced a surprise; straightforward execution once the
  > mechanism was confirmed.
- **Next session must:** Session 2-2b — Schema split cutover (repoint all 16
  consumer imports to the correct new client, retire old `prisma/schema.prisma`),
  `TEMPLATE-PORT.md` variant (continuation of 2-2). PRE-DRAFTed:
  `docs/migration-orders/2-2b-schema-split-cutover.migration-order.md` — currently
  **PRE-DRAFT** (needs the Advisor to produce the DRAFT, then Davin's APPROVAL).
  Waiting-on item 7 above (which of the 16 files need which client) needs
  confirming per-file before 2-2b's Ordered steps can be trusted as more than a
  sketch.
- **Open flags:** F1 fully RESOLVED (Session 0-3) · F2 RESOLVED (Session 0-1) · F3
  RESOLVED (Session 1-1: on Railway, different instance than `railway-gateway`) · F17
  RESOLVED (Session 0-5: synthetic seed only) · F18 RESOLVED (Session 1-1: RPO ≤ 24h,
  RTO ≤ 1h, with an unverified-backup-cadence gap — re-confirmed unchanged Session 1-4;
  this is the reason Phase 1 isn't marked exit-clean) · **F19 fully RESOLVED (Session
  2-1)** — audit + bump + codemods + production deploy, all verified · **F20 OPEN,
  urgent** (production migration history unbaselined, destructive pending drop —
  found Session 1-3, now more complex per Waiting-on item 2 above) · **F4 fully
  RESOLVED (Session 2-2)** — model census, 1 market + 26 non-market + `RefreshToken`
  stub · **F5 fully RESOLVED (Session 2-2)** — two-file layout via explicit
  `--schema=` CLI invocations, cutover split into 2-2/2-2b · F6–F16 OPEN
  (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

## Key documents

| What                                 | Where                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Operating manual (YOUR rules)        | `docs/migration-orders/EXECUTOR-PROTOCOL.md`                                              |
| Migration plan (phases, flags)       | `docs/migration-orders/monolith-to-microservices-migration-implementation-plan.md` (v1.2) |
| Session playbook                     | `docs/migration-orders/monolith-to-microservices-migration-session-playbook.md`           |
| Order rules + templates              | `docs/migration-orders/00-SKELETON-AND-RULES.md` + `TEMPLATE-*.md`                        |
| Decision Log                         | `docs/migration-orders/DECISION-LOG.md`                                                   |
| Lessons learned (read at every OPEN) | `docs/migration-orders/LESSONS-LEARNED.md`                                                |
| Cutover table                        | `docs/migration-orders/migration-cutover-table.md`                                        |
| File inventory                       | `docs/migration-orders/migration-stack-analysis.md`                                       |

## Non-negotiables (short form — manual has details)

1. **Never execute an order that is not CONFIRMED.** Lifecycle: PRE-DRAFT → DRAFT →
   APPROVED (Davin) → CONFIRMED (you, after re-verifying code AND runtime state).
2. **One session = one verifiable unit of work.** Never end mid-cutover or half-deployed.
   Blocked? Document the blocker and stop — don't push into a broken state.
3. **Artifacts are the only channel.** Your session transcript dies with the session; the
   Deviations section, CLAUDE.md, Decision Log, cutover table, and file inventory are how
   the Advisor and Davin know what happened. Empty Deviations = starved next plan.
4. **Scope discipline.** No drive-by fixes to change-frozen (CC-F) or out-of-scope code.
   `lib/api/index.ts` is known-broken BY DESIGN — do not fix until Phase 7.
5. **Money and auth changes escalate.** Anything touching payments, grants, secrets, CORS,
   or auth semantics beyond the order's explicit steps → stop and ask Davin.
6. **Verification is never skipped, only strengthened.**

## Security Override Policy (retained from legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

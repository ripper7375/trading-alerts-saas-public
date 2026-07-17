# Migration Order — Orientation & Reference Study

> `TEMPLATE-CONTRACT.md` variant (research/document session, not running code) —
> `00-SKELETON-AND-RULES.md` §4 autonomy clause applies, creativity dial **Medium**: how the
> reference notes are organized is mine to choose; what counts as a verified fact is not.
> **No prior session exists for this repo** — there is no PRE-DRAFT to upgrade and no Advisor
> pass has run. Per `EXECUTOR-PROTOCOL.md` §1.2's bootstrap carve-out, I (the Executor)
> generated this order directly from the template and am stopping here for Davin's approval,
> skipping the normal Advisor DRAFT step this once only because the chain has nothing to
> hand off from yet.

**Session:** 0-1 · **Variant:** CONTRACT · **Status:** CONFIRMED (approved by Davin 2026-07-17)
**Generated:** 2026-07-17 · **Flags touched:** F2, F19 (npm-check portion only) · **Estimated time:** ~3h

## Entry criteria

- [x] `CLAUDE.md` (root) and `docs/migration-orders/EXECUTOR-PROTOCOL.md` exist and are
      current — verified this session (both present; last edited 2026-07-12/13).
- [x] No prior Phase 0 order exists — `CLAUDE.md` confirms "Current order: none yet"; this
      session bootstraps the chain, matching the playbook's Session 0-1 description.
- [x] `railway-gateway/` exists as a working NestJS service (30 files per
      `migration-stack-analysis.md`'s inventory) — the reference pattern this session studies.
      Confirmed present: `src/app.module.ts`, `src/auth/api-key.guard.ts`,
      `src/prisma/{prisma.module.ts,prisma.service.ts}`, `src/health/*`,
      `src/worker/{market-data.processor.ts,worker.module.ts}`, `railway.toml`,
      `docker-compose.yml`, `prisma/schema.prisma`.
- [x] npm registry reachable at execution time (needed for the F2/F19 version checks below).

## Ordered steps

_(each step = investigate → produce → verify; a claim without a source is not a finding)_

1. **Confirm bootstrap docs are live** — sources: `CLAUDE.md`, `EXECUTOR-PROTOCOL.md`,
   `00-SKELETON-AND-RULES.md`, `LESSONS-LEARNED.md`. Output: none (read-only gate).
   _Verify:_ each doc's content matches what `CLAUDE.md`'s "Key documents" table claims it
   contains; no doc is stale relative to the current repo layout.

2. **Read `railway-gateway/` end-to-end; write `docs/railway-gateway-reference-notes.md`**
   — sources: all 30 files in the inventory, specifically `src/app.module.ts`,
   `src/auth/api-key.guard.ts`, `src/prisma/prisma.{module,service}.ts`,
   `src/health/health.{controller,module}.ts`, `src/worker/market-data.processor.ts`,
   `src/worker/worker.module.ts`, `railway.toml`, `docker-compose.yml`,
   `prisma/schema.prisma`. Output: notes file covering project layout, Prisma service
   wiring, guard pattern, health-check pattern, `railway.toml` deploy config, BullMQ worker
   — the template every new NestJS service (operation-service, money-service) copies.
   _Verify:_ every section cites a specific file + line range; spot-check 3 claims (guard
   pattern, health endpoint, BullMQ queue name) side-by-side against source.

3. **Resolve F2 — verify `next@16.2.10` and `@nestjs/core@11.1.28` exist on npm** —
   sources: `npm view next@16.2.10 version`, `npm view @nestjs/core versions` (registry
   query); baseline comparison against currently installed `next@^15.5.11` (root
   `package.json`) and `@nestjs/core@^10.4.15` (`railway-gateway/package.json`). Output:
   Decision Log F2 entry — exact-version verdict, nearest-stable pin if either doesn't
   exist.
   _Verify:_ raw registry command output pasted into the Decision Log entry, not
   paraphrased.

4. **Resolve F19's npm-check sub-item — verify `prisma@7.8.0` exists on npm** — sources:
   `npm view prisma@7.8.0 version`; baseline `prisma@^6.19.2` (both root and
   `railway-gateway` `package.json`). Output: Decision Log F19 entry, scoped explicitly to
   the version-existence check only — the full 6→7 breaking-change audit is Session 2-1's
   job (plan §2 step 0.6/2.0), not this session's.
   _Verify:_ raw registry output as evidence. Also record as a **finding**: the plan's F19
   text frames this as a "5→6→7" jump, but the installed version is already `6.19.2` on
   both `package.json` files — propose the plan amendment (one major crossed, not two) in
   Deviations rather than silently absorbing the discrepancy.

5. **Update `CLAUDE.md` state block** — output: Current → Phase 0, Session 0-1 (complete);
   Current order → this file, CONFIRMED; Last session did / Next session must updated;
   flag register cross-referenced.
   _Verify:_ diff reviewed before commit; matches EXECUTOR-PROTOCOL §3 close checklist.

## Rules specific to this variant

- Ground truth priority: live code (`railway-gateway/`) > `migration-stack-analysis.md`
  inventory > plan/playbook prose > old `docs/build-orders/`.
- Distinguish verified facts (registry output, file contents read directly) from
  assumptions in the reference notes; mark assumptions explicitly.
- Plan/playbook contradictions found during investigation (e.g. the F19 major-version
  count above) are findings — record and propose the amendment, don't silently absorb it.

## Done when

- [x] `docs/railway-gateway-reference-notes.md` committed; covers all 6 required topics;
      every claim sourced to a file + line
- [x] F2 resolved in `DECISION-LOG.md` (verdict + raw evidence)
- [x] F19 npm-check sub-item resolved in `DECISION-LOG.md` (full audit stays OPEN, due
      Session 2-1); plan-discrepancy finding recorded
- [x] `CLAUDE.md` state block updated

## Rollback

None required — read-only session, no live system touched. New/changed artifacts
(`docs/railway-gateway-reference-notes.md`, this order file, `CLAUDE.md`,
`DECISION-LOG.md`) are all plain commits, reversible with `git revert` if needed.

## Deviations

- **Step order changed on Davin's explicit instruction:** executed steps 3 (F2) and 4 (F19
  npm-check) before step 2 (reference notes), and had the Decision Log entries reviewed
  before starting step 2. Why: Davin wanted flag-resolution evidence visible before the
  larger writing step. Impact: none — steps 2–4 have no dependency on each other, order was
  free to change per the Autonomy clause; sequencing directive came from Davin directly so
  this isn't a self-initiated deviation, just logged for the record.
- **F19 finding:** plan §2 step 0.6 describes the Prisma jump as "5→6→7"; actual installed
  version on both `package.json` files is already `6.19.2`, so it's a single-major jump
  (6→7). Proposed as an amendment in the F19 Decision Log entry rather than edited into the
  plan document directly (plan-text ownership is Advisor/Davin's, not the Executor's).
- **New finding while writing the reference notes (not tied to a numbered flag):** plan §2
  step 0.1 describes `railway-gateway/` as "NestJS 11 on Railway." It actually runs NestJS
  **10** (`railway-gateway/package.json` pins `@nestjs/common`/`@nestjs/core`/
  `@nestjs/platform-express`/`@nestjs/cli`/`@nestjs/testing` all to `^10.4.15`). Recorded in
  `docs/railway-gateway-reference-notes.md`'s Findings section rather than the Decision Log
  since no flag covers it directly — surfaced here so the Advisor can fold it into the next
  plan revision. Practical effect: new services (`operation-service`, `money-service`)
  should target the F2-verified `@nestjs/core@11.1.28`, not copy `railway-gateway`'s
  installed 10.x — they inherit its code shape, not its dependency versions.
- **`migration-stack-analysis.md` intentionally not touched this session:** the file's
  scope is the application-code inventory (frontend routes, lib/, backend stacks); it does
  not track `docs/` reference material, so the new
  `docs/railway-gateway-reference-notes.md` file has no corresponding inventory entry to
  add. No code files were created/moved/deleted this session.

## Next-session handoff

PRE-DRAFT written: `docs/migration-orders/0-2-openapi-contracts-batch-1.migration-order.md`
(OpenAPI contracts batch 1 — operation domain). Flags a scope surprise: 18 spec files
already exist in `docs/open-api-documents/`, not the 5 the plan text assumes — the session
may be reconciliation-heavy rather than from-scratch generation. Needs Advisor/Davin review
before `APPROVED`.

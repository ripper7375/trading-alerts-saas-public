# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 0, Session 0-1 (complete) — 2026-07-17.
- **Current order:** `docs/migration-orders/0-1-orientation-reference-study.migration-order.md`
  (CONFIRMED, executed)
- **Order status:** CONFIRMED — executed 2026-07-17
- **Waiting on:** A human with delete permission to remove 5 remote branches — this
  session's git credential can push/create branches but gets `HTTP 403` on `git push
--delete` for every branch tried (confirmed on 3 separate branches, so it's a permission
  scope, not a fluke). Branches needing deletion: `fix/tsconfig-exclude-case-sensitivity`
  and `salvage/windowed-centroid-cfl-indicator` (both already merged), plus the 3 stale
  `claude/*` branches below (no open PRs existed on any of them, so nothing to close —
  just delete). Unrelated to Session 0-1; carried over from the 2026-07-12 git audit.
- **Last session did:** Session 0-1 (Orientation & reference study, CONTRACT order). Read
  `railway-gateway/` end-to-end (all 30 files) and wrote
  `docs/railway-gateway-reference-notes.md` (project layout, Prisma service wiring, guard
  pattern, health module, `railway.toml`, BullMQ worker, plus a validation-layering and
  deployment section). Resolved **F2** (both `next@16.2.10` and `@nestjs/core@11.1.28`
  exist on npm exactly as specified — no nearest-stable substitution needed) and **F19's
  npm-check portion** (`prisma@7.8.0` exists on npm; full 6→7 breaking-change audit stays
  OPEN, due Session 2-1) — see `DECISION-LOG.md`. Two plan-text discrepancies surfaced and
  recorded as findings rather than silently absorbed: (1) F19 — plan describes a "5→6→7"
  Prisma jump but both `package.json` files already run `6.19.2`, so it's actually 6→7
  only; (2) plan §2 step 0.1 calls `railway-gateway/` "NestJS 11" but it runs NestJS 10
  (`@nestjs/core@^10.4.15`) — new services should target the F2-verified 11.1.28, not copy
  the reference service's installed version.
- **Next session must:** Session 0-2 — OpenAPI contracts, batch 1 (operation domain).
  Resolve F1 scope (PUBLIC endpoints only); generate OpenAPI specs from the live route
  handlers for auth, alerts, drawings, notifications, tier, user, market-data channel;
  commit to `docs/open-api-documents/`. PRE-DRAFT written:
  `docs/migration-orders/0-2-openapi-contracts-batch-1.migration-order.md` — flags that 18
  spec files already exist (plan text assumed only 5), so this session may be
  reconciliation-heavy rather than from-scratch generation; needs an Advisor/Davin pass
  before it's APPROVED. Backlog (not fixed, not urgent, unrelated to Phase 0): add `glob` as a direct
  `devDependency` — `scripts/validate-file.js` (`validate:policies`) `require()`s it but
  it's only present transitively (LESSONS-LEARNED L7).
- **Open flags:** F2 RESOLVED (Session 0-1) · F19 npm-check RESOLVED (Session 0-1), full
  audit still OPEN (due Session 2-1) · F1, F3–F18 OPEN (register: plan §11 · resolutions:
  `docs/migration-orders/DECISION-LOG.md`)

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

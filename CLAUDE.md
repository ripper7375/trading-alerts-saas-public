# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 0, Session 0-1 (not started) — 2026-07-12 session was an ad-hoc
  git-workflow audit/salvage, not a migration order; phase/session unchanged.
- **Current order:** none yet — Session 0-1 bootstraps without a PRE-DRAFT
- **Order status:** —
- **Waiting on:** A human with delete permission to remove 5 remote branches — this
  session's git credential can push/create branches but gets `HTTP 403` on `git push
--delete` for every branch tried (confirmed on 3 separate branches, so it's a permission
  scope, not a fluke). Branches needing deletion: `fix/tsconfig-exclude-case-sensitivity`
  and `salvage/windowed-centroid-cfl-indicator` (both already merged), plus the 3 stale
  `claude/*` branches below (no open PRs existed on any of them, so nothing to close —
  just delete).
- **Last session did:** Audited all `origin/claude/*` branches after `git fetch --all
--prune` (only 3 exist, not the 13 a stale-local-ref brief claimed). Content-diffed each
  against current `main` (not just commit hashes): `chart-centroid-display-issue-h69zev` =
  GENUINELY UNIQUE (2 new `backend-stack-c/` indicator files, SEPARATE_STACK, not on main)
  → cherry-picked onto `salvage/windowed-centroid-cfl-indicator`, **merged to main** (#463).
  `eloquent-hypatia-qma365` and `update-file-inventory-docs-ulqhgq` = SUPERSEDED (content
  already on main or main has since moved further — see LESSONS-LEARNED L5/L6 for detail)
  → no salvage needed, ready to delete (no open PRs). Also found and fixed a repo-wide
  blocker: `tsconfig.json` excluded `"Archive"` (wrong case) instead of `"archive"`, so
  `tsc --noEmit` failed for every branch on case-sensitive Linux (husky pre-push + CI
  `type-check` both use `ubuntu-latest`) — fixed and **merged to main** (#462) ahead of the
  salvage PR so it landed fast.
- **Next session must:** Once the 5 branches above are deleted (see Waiting on), the git
  workflow audit is fully closed out — nothing else pending from it. Backlog (not fixed,
  not urgent): add `glob` as a direct `devDependency` — `scripts/validate-file.js`
  (`validate:policies`) `require()`s it but it's only present transitively, so it 404s
  under pnpm's strict `node_modules` (see LESSONS-LEARNED L7).
- **Open flags:** F1–F19 (register: plan §11 · resolutions: `docs/migration-orders/DECISION-LOG.md`)

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

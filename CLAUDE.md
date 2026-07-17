# CLAUDE.md — Executor State & Standing Rules (Migration Mode)

> **This repo is in MIGRATION MODE.** You (Claude Code) are the **Executor** in the
> three-role Development Chain Protocol (Advisor = Claude Cowork plans, Davin authorizes,
> you execute). Full operating manual: `docs/migration-orders/EXECUTOR-PROTOCOL.md` —
> **read it at the start of every session before doing anything else.**
> The previous content of this file (Aider validation guide) moved to
> `docs/AIDER-VALIDATION-GUIDE-legacy.md`; its validation commands are still used (see manual).

---

## Current state _(update at the end of EVERY session)_

- **Current:** Phase 0, Session 0-2 (complete) — 2026-07-17.
- **Current order:** `docs/migration-orders/0-2-openapi-contracts-batch-1.migration-order.md`
  (CONFIRMED, executed)
- **Order status:** CONFIRMED — executed 2026-07-17
- **Waiting on:** A human with delete permission to remove 5 remote branches — this
  session's git credential can push/create branches but gets `HTTP 403` on `git push
--delete` for every branch tried (confirmed on 3 separate branches, so it's a permission
  scope, not a fluke). Branches needing deletion: `fix/tsconfig-exclude-case-sensitivity`
  and `salvage/windowed-centroid-cfl-indicator` (both already merged), plus the 3 stale
  `claude/*` branches below (no open PRs existed on any of them, so nothing to close —
  just delete). Unrelated to Session 0-1/0-2; carried over from the 2026-07-12 git audit.
- **Last session did:** Session 0-2 (OpenAPI contracts batch 1, CONTRACT order). At session
  open, found Session 0-1's artifacts uncommitted (failing entry criterion) — committed
  and pushed them first (`aa893c40`), then confirmed and ran this order. Resolved **F1 for
  batch 1**: all 34 routes across auth/alerts/drawings/notifications/tier/user/market-data-channel
  are PUBLIC, none excluded (see `DECISION-LOG.md`). Triaged the 4 existing specs that might
  cover these domains: `part-15-notifications-realtime` was CURRENT (untouched);
  `part-04-tier-system` and `part-11-alerts` were STALE — both described a pre-V8
  multi-symbol/multi-tier architecture the codebase no longer has, not just doc-lag, so both
  were regenerated from live handlers; `part-05-authentication` was PARTIAL — added the
  undocumented `track-login` route, fixed a real field-name bug
  (`newPassword`→`password`), added a missing 429 path. Wrote 3 brand-new specs for domains
  with no prior coverage: `part-21-drawings`, `part-22-user-account` (14 routes),
  `part-23-market-data-channel`. Naming: kept the `part-XX` numbering (no Davin sign-off
  needed since that's the non-convention-changing option) — new files are `part-21`/`22`/`23`.
  All 7 spec files verified to parse as valid YAML with path counts matching each domain's
  live route-file count exactly. Backlog (not fixed, not urgent, unrelated to Phase 0): add
  `glob` as a direct `devDependency` — `scripts/validate-file.js` (`validate:policies`)
  `require()`s it but it's only present transitively (LESSONS-LEARNED L7; recurred this
  session in a different script, `js-yaml`/`yaml`, when trying to validate the new specs —
  worked around with Python instead of fixing L7 itself, out of scope for a docs session).
- **Next session must:** Session 0-3 — OpenAPI contracts, batch 2 (money domain): checkout,
  subscription, invoices, payments/dlocal, admin/affiliates, affiliate, disbursement,
  webhooks (stripe/dlocal/riseworks), cron. Closes F1 fully once done. PRE-DRAFT written:
  `docs/migration-orders/0-3-openapi-contracts-batch-2.migration-order.md` — flags a
  route-count discrepancy (playbook says 99, Session 0-2 measured 103 — needs reconciling)
  and that the "5 existing part-XX specs" for this domain aren't yet confirmed by name;
  needs an Advisor/Davin pass before it's APPROVED.
- **Open flags:** F1 RESOLVED for batch 1 (Session 0-2), batch 2 due Session 0-3 · F2
  RESOLVED (Session 0-1) · F19 npm-check RESOLVED (Session 0-1), full audit still OPEN (due
  Session 2-1) · F3–F18 OPEN (register: plan §11 · resolutions:
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

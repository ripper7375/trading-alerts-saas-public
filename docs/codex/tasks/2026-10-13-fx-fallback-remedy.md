---
type: Concept/Task
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-fx-fallback-remedy
owner: Codex
integrator: Codex root
reviewer: Codex commit_scope_audit, read-only
shared_state_writer: handoff-only
approval: Davin asked how to fix fallback after forwarding Advisor advice about restarting local development.
order_mode: ad-hoc; phase/session unchanged
base_commit: bca43441e12f3dfabe9babc4ab2a3494fc120f37
worktree: D:/SaaS Project/trading-alerts-saas-public
branch: codex/intraday-subscription-prices
---

# Objective

Verify local key/provider readiness and explain a concrete deployment remedy,
including why restarting local development cannot fix a Vercel preview.

## Scope and ownership

- Root owns this record and a unique remedy report in Davin's relocated report
  folder. The reviewer reads current provider/cache source and recent merge.
- Read-only provider verification may use the existing key without printing
  credentials or storing rate values. No runtime source, environment, Redis,
  deployment, login, commit or push changes are authorized by this diagnosis.
- Preserve existing relocated documents, mobile deletions, untracked folders,
  modified `next-env.d.ts` and the main merge. Shared state remains untouched.
- Root owns documentation checks; no builds, client generators or mutations.

## Checklist

- [x] Reconcile live branch, recent merge and existing changes.
- [x] Verify key presence, local listener state and available deployment access.
- [x] Obtain read-only review of restart/cache semantics and source parity.
- [x] Check the actual CurrencyBeacon fetch with the existing local key.
- [x] Write and verify the concrete remedy report.

## Decisions and deviations

Advisor text is input to evaluate, not independent authorization to deploy or
alter Redis. The current key exists in both local service environments. No
listener was found on ports 3000, 3001, 3012 or 4000. A local restart does not
alter Vercel. A valid Frankfurter process/Redis table can defer a primary request
even when the key is configured; existing tests deliberately cover this case.
The recent main merge leaves FX provider/cache source unchanged.

No access token is configured in the process or checked local environment files;
the local Vercel project is unlinked and the checked CLI auth file is absent.
Only a Vercel OIDC variable name was observed; it is not treated as an API token.
No token was requested because the requested remedy can be explained without
changing deployment configuration. The preview's exact failure cause remains
unverified behind the previously observed Vercel login redirect.

## Verification

| Check                                                | Cwd             | Exit | Evidence / limitation                                                                                                    |
| ---------------------------------------------------- | --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ |
| Local environment presence inspection                | Repository root | 0    | Root and money keys present; credential values omitted                                                                   |
| Local listener inspection                            | Repository root | 0    | No matching listeners found on four candidate ports                                                                      |
| Read-only source/merge review                        | Repository root | 0    | Restart clears memory but shared fallback remains until expiry; root/money match                                         |
| Actual `fetchCurrencyBeaconRates` using existing key | Repository root | 0    | Valid CurrencyBeacon table for all 15 currencies in 934 ms; both local keys equal; no credentials or rate values printed |

## Continuation

Documentation verification: targeted Prettier exit 0; operating-document checker
exit 1 for the same 30 existing issues outside this task. No runtime source was
changed, so application test suites and builds were not rerun.

- Provider readiness verified; remedy explanation completed.
- Deployment activation remains a separate owner action; no runtime change is
  needed to implement the existing primary/fallback hierarchy.
- Handoff: `davintrade-intraday-subscription-prices/2026-10-13-fx-fallback-remedy-codex.md`.

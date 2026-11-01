---
type: Concept/Task
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-preview-fx-provider-clarification
owner: Codex
integrator: Codex root
reviewer: Codex commit_scope_audit, read-only
shared_state_writer: handoff-only
approval: Davin asked why the preview shows Frankfurter and how CurrencyBeacon works with it.
order_mode: ad-hoc; phase/session unchanged
base_commit: c6f71a2c1b300ff702e434ec8cafe0c3469f09f8
worktree: D:/SaaS Project/trading-alerts-saas-public
branch: codex/intraday-subscription-prices
---

# Objective

Explain the implemented provider hierarchy, the screenshot's active provider,
and the deployment conditions without claiming an unverified failure cause.

## Scope and ownership

- Root owns this record and the unique clarification handoff in Davin's
  `davintrade-intraday-subscription-prices/` folder.
- Reviewer reads provider/cache selection and checks only environment-file
  tracking status; no credentials are read or printed.
- Existing relocated handoffs, mobile deletions, untracked folders and modified
  `next-env.d.ts` remain untouched. No runtime source, environments, Redis or
  shared state changes; no commit, push, deployment or login action.
- Root owns documentation checks; no generators, builds or mutation tests.

## Checklist

- [x] Confirm live branch, instructions and provider/cache source.
- [x] Inspect relocated implementation evidence and local file tracking status.
- [x] Attempt a read-only preview FX request and document its access limitation.
- [x] Obtain a separate read-only source review.
- [x] Verify the new records and complete the clarification handoff.

## Decisions and deviations

The report is stored with the documents Davin relocated. The canonical task
remains under `docs/codex/tasks/`; no moved document or incoming link is changed.
The preview API redirects to Vercel login, so no live rate JSON or deployment
environment was obtained. Screenshots establish Frankfurter as the displayed
active snapshot, not the precise reason CurrencyBeacon was bypassed.

## Verification

| Check                             | Cwd             | Exit | Evidence / limitation                                                                                                |
| --------------------------------- | --------------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| Source and setup-guide inspection | Repository root | 0    | Both services select CurrencyBeacon first on a cache miss; fallback and cache parity independently confirmed         |
| Environment tracking status       | Repository root | 0    | Both local environment files exist, are ignored and untracked; no key values read                                    |
| Preview HTTP metadata GET         | Repository root | 0    | Final response is HTML at `vercel.com/login`, not FX JSON; an earlier JSON parse exited 1 for this reason            |
| Targeted Prettier                 | Repository root | 0    | Both owned documents formatted and checked; the initial check required formatting                                    |
| Operating-document checker        | Repository root | 1    | 30 existing issues in other documents, including the moved implementation handoff link; none attributed to this task |

## Continuation

- Clarification completed; implementation source and deployment configuration are unchanged.
- Deployment cause remains unconfirmed; server environment and function logs
  would distinguish missing key, failed primary and shared cached fallback.
- Handoff: [provider clarification](../../../davintrade-intraday-subscription-prices/2026-10-13-preview-fx-provider-clarification-codex.md).
- Shared-state publication is left to its named owner.

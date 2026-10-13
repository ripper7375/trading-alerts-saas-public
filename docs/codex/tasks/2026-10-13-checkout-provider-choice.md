---
type: Concept/Task
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-checkout-provider-choice
owner: Codex
integrator: Codex root
reviewer: Codex read-only subagent
shared_state_writer: handoff-only
approval: Davin requested an initial payment-method selection modal and separate Stripe and dLocal checkout pages.
order_mode: ad-hoc; phase/session unchanged
base_commit: f7d7368650179a0a4958133c451cc3f1ba6f2702
worktree: D:/SaaS Project/trading-alerts-saas-public
branch: main
---

# Objective

On entering `/checkout`, present an accessible modal explaining the two
alternative providers and when each suits a customer. Selecting one navigates
to `/checkout/stripe` or `/checkout/dlocal`, displaying only that provider's
existing form. Preserve checkout query context and existing access boundaries.

## Scope and ownership

- Root owns `app/checkout/page.tsx`, new provider routes, new checkout components
  under `components/payments/`, checkout tests and this task/handoff.
- Translation subagent owns only the 12 new keys in all 19
  `lib/i18n/dictionaries/*.json` files.
- Read-only reconnaissance/review subagents own no runtime writes.
- Excluded: payment APIs, amounts, grants, auth semantics, schemas, secrets,
  generated clients, dependencies, seed-code and unrelated dirty files.
- Initial checkout target is clean. Existing changes include mobile-app
  deletions, next-env.d.ts, recent-works.md, untracked projects/research/task
  records. Preserve all. Claude active-tasks.md is absent; do not create it.
- Root owns dev server and test execution. No build/client generation while
  dev processes share generated resources.
- Implementation checkpoint: commit/push/deploy were not requested. Davin
  subsequently authorized commit and push; see the
  [publication task](2026-10-13-checkout-provider-choice-publish.md).
  Manual deployment and production payment actions remain excluded.
- Publish individual records only; shared Claude/Codex state ownership is not
  assumed.

## Checklist

- [x] Inspect live source, instructions and relevant entry criteria.
- [x] Implement modal, provider routes and translated guidance.
- [x] Verify affected acceptance criteria and exact checks, including browser.
- [x] Complete read-only review and fix findings.
- [x] Write handoff; leave shared-state publication to its owner.

## Decisions and deviations

- Direct instruction authorizes checkout presentation/navigation changes.
  Existing charge requests and pricing remain the source of truth.
- dLocal supports ten countries in live constants; modal guidance must say that
  local methods vary by country. Neither provider is automatically selected.
- Preserve annual/referral/country query parameters through provider choice.
- Review focus-return defect fixed and rechecked. Arabic close/title overlap fixed
  and checked in the browser. All 19 dictionaries preserve existing values.
- Shared access UI is extracted with unchanged FREE/PRO behavior; login
  callbacks retain the selected checkout route and query.
- apply_patch did not return after several minutes and was terminated; the
  file had not been created. Use scoped file writes instead.

## Verification

| Check                                             | Cwd         | Exit | Result                      |
| ------------------------------------------------- | ----------- | ---- | --------------------------- |
| Root source tsc (no generators)                   | Repo root   | 0    | Pass                        |
| Scoped test tsc with project ambient declarations | Repo root   | 0    | Pass                        |
| Scoped ESLint runtime/test                        | Repo root   | 0    | Pass, zero warnings         |
| Existing affected Jest suites                     | Repo root   | 0    | 9 suites, 124 tests pass    |
| New provider-choice Jest suite                    | Repo root   | 0    | 1 suite, 14 tests pass      |
| Targeted Prettier and git diff --check            | Repo root   | 0    | Pass                        |
| Playwright browser verification                   | Local :3014 | 0    | 16 checks, zero page errors |
| Operating-doc checker                             | Repo root   | 1    | 29 pre-existing issues      |
| HEAD/current checker baseline comparison          | Repo root   | 0    | Same 29 issues; zero new    |

See the [handoff](../../handoffs/2026-10-13-checkout-provider-choice-codex.md)
for commands, browser fixture boundaries, exact limitations and review findings.

## Continuation

- Next action: local implementation complete; commit and push authorized in the
  [publication task](2026-10-13-checkout-provider-choice-publish.md).
- Blocked items: none. Shared-state publication belongs to its named writer.
- Handoff: `docs/handoffs/2026-10-13-checkout-provider-choice-codex.md`.

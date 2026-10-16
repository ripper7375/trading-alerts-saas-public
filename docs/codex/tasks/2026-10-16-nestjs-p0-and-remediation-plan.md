---
type: Concept/Task
status: completed
updated_at: 2026-10-16
task_id: 2026-10-16-nestjs-p0-and-remediation-plan
owner: Antigravity
integrator: Antigravity
reviewer: Claude Code
shared_state_writer: handoff-only
approval: 'Davin direct instruction (2026-10-16): update NestJS remediation plan (Step 1) and execute P0 auth/login-panel hotfix (Step 2)'
order_mode: ad-hoc; phase/session unchanged
base_commit: 0386e5dc
worktree: d:\SaaS Project\trading-alerts-saas-public
branch: main
---

# Objective

1. **Step 1 (Plan Revision 2):** Update `davintrade-nest-js-checklists/nestjs-production-remediation-plan.md` to incorporate all findings, corrections, and sequencing recommendations from Claude Code's review (`davintrade-nest-js-checklists/nestjs-production-remediation-plan-claude-code-recommendation.md`).
2. **Step 2 (P0 Hotfix):** Remove hardcoded admin accounts (`admin@tradingalerts.com`, `admin-test@trading-alerts.test`) from `FIXED_TEST_ACCOUNTS` in both `operation-service/src/auth/auth.service.ts` and `lib/auth/auth-options.ts`, gate the remaining non-admin test accounts behind a strict non-production allow-list (`development` / `test`, plus non-production `preview` on Vercel), and hide the `"Quick Test Credentials"` autofill UI panel in `components/auth/login-form.tsx` when running in production. Add unit tests verifying the production gate in both codebases.

## Scope and ownership

- Allowed writes:
  - `davintrade-nest-js-checklists/nestjs-production-remediation-plan.md`
  - `operation-service/src/auth/auth.service.ts`
  - `operation-service/src/auth/auth.service.spec.ts`
  - `lib/auth/auth-options.ts`
  - `components/auth/login-form.tsx`
  - `__tests__/components/auth/login-form.test.tsx`
  - `docs/codex/tasks/2026-10-16-nestjs-p0-and-remediation-plan.md`
  - `docs/handoffs/2026-10-16-nestjs-p0-and-remediation-plan-antigravity-built.md`
- Excluded writes and existing dirty paths: all unrelated untracked files in `dlocal-and-potential-countries/`, `mql5-indicators/`, and existing `docs/codex/tasks/2026-10-13-*`.
- Existing authorization for commit/push/deploy: None for P0 yet (commit/push only when Davin asks).

## Checklist

- [x] Inspect live source, Claude Code review recommendations, and relevant entry criteria.
- [x] Step 1: Update `davintrade-nest-js-checklists/nestjs-production-remediation-plan.md` (Revision 2).
- [x] Step 2: Implement P0 in `operation-service/src/auth/auth.service.ts`, `lib/auth/auth-options.ts`, and `components/auth/login-form.tsx` + unit tests.
- [x] Verify affected acceptance criteria (`tsc --noEmit` and Jest tests in root and `operation-service`).
- [x] Write handoff record.

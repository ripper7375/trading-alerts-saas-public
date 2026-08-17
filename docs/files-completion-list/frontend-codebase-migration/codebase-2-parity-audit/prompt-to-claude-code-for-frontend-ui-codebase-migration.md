# Batch 0

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, the 6 Protected pages in §0, hard constraints in §3), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-0-shared-shell.md for this batch's scope.

Execute the master plan's §5 "what done means" checklist against Batch 0's shared shell components and the 2 global pages (rows 92, 93). Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment. Never modify these 6 pages, even as a side effect of a shared-component fix: /, /terminal, /free, /dashboard, /settings/appearance, /settings/help — if a shared header/sidebar/middleware fix would change how any of them renders, stop and flag it in Findings instead of applying it.

When done, append your findings (component/file, what was wrong, what changed) to batch-0-shared-shell.md's Findings section, verify with tsc/build, and let me know it's ready for Batches 1–8 to start.

=========================

Batch 1

=========================

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, hard constraints), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-1-auth-account-token.md for your 9 rows (login, register, forgot/reset password, 2FA, email verification, account-deletion token pages).

Execute the master plan's §5 "what done means" checklist against every row. Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment. Rows 3/4's evidence points at API routes, not pages — check Codebase 1's real app/account/ tree before concluding there's no UI counterpart to match.

Files modification outside seed-code/trading-conversational-ai-ui-pages-increment is strictly prohibited.

When done, append your findings (row number, what was wrong, what changed, files touched) to batch-1-auth-account-token.md's Findings section, verify with tsc/build, and let me know when it's ready.

=======================

Batch 2

=======================

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, the 6 Protected pages in §0, hard constraints in §3), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-2-dashboard-alerts-workspace.md for your 12 rows.

3 of those 12 rows are Protected — skip them entirely, do not open expecting work: row 57 (/terminal), row 58 (/free), row 62 (/dashboard). 3 more (rows 55, 56, 59) are permanently retired in Codebase 2 — confirm they stay absent, don't build them. Row 86 (/test-api) has no live Codebase-1 counterpart anymore (already deleted there) — flag it as a retirement candidate, don't polish it. That leaves rows 49, 50, 51, 68, 87 as the real audit-and-fix work.

Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment.

Files modification outside seed-code/trading-conversational-ai-ui-pages-increment is strictly prohibited.

When done, append your findings to batch-2-dashboard-alerts-workspace.md's Findings section, verify with tsc/build, and let me know when it's ready.

========================

Batch 3

========================

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, the 6 Protected pages in §0, hard constraints in §3), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-3-settings-suite.md for your 11 rows.

2 of those 11 rows are Protected — skip them entirely: row 74 (/settings/appearance), row 76 (/settings/help). Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment. The settings sub-nav is shared by all 11 pages including the 2 protected ones — if a shared-nav fix would change how either protected page renders, stop and flag it instead of applying it.

Files modification outside seed-code/trading-conversational-ai-ui-pages-increment is strictly prohibited.

When done, append your findings to batch-3-settings-suite.md's Findings section, verify with tsc/build, and let me know when it's ready.

=======================

Batch 4

=======================

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, the 6 Protected pages in §0, hard constraints in §3), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-4-marketing-legal-commerce.md for your 15 rows.

1 of those 15 rows is Protected — skip it entirely: row 1 (/, the landing page). Row 95 (/welcome) has no Codebase-1 counterpart to match structurally — DavinTrade-token compliance only, not a structural fix. Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment.

Files modification outside seed-code/trading-conversational-ai-ui-pages-increment is strictly prohibited.

When done, append your findings to batch-4-marketing-legal-commerce.md's Findings section, verify with tsc/build, and let me know when it's ready.

======================

Batch 5

======================

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, hard constraints), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-5-affiliate-portal.md for your 14 rows.

Check row 45 first — the evidence columns suggest a possible URL-structure mismatch (/affiliate/dashboard/resources in Codebase 1 vs /affiliate/resources in Codebase 2); confirm whether that's real before anything else, since a route-path mismatch outranks any visual fix. Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment. If this batch feels too large for one session, it can be split at row 42 into "Dashboard Suite" (35–42) and "Public/Onboarding" (43–48) — your call.

Files modification outside seed-code/trading-conversational-ai-ui-pages-increment is strictly prohibited.

When done, append your findings to batch-5-affiliate-portal.md's Findings section, verify with tsc/build, and let me know when it's ready.

=====================

Batch 6

=====================

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, hard constraints), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-6-admin-affiliate-reports.md for your 7 rows.

This is one of three independent Admin sub-batches (6, 7, 8) — you only need your own 7 rows. components/admin/admin-nav.tsx is shared across all three; if another Admin batch already ran and touched it, git log/git diff it first rather than assuming it's untouched. Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment.

Files modification outside seed-code/trading-conversational-ai-ui-pages-increment is strictly prohibited.

When done, append your findings to batch-6-admin-affiliate-reports.md's Findings section, verify with tsc/build, and let me know when it's ready.

=====================

Batch 7

====================

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, hard constraints), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-7-admin-disbursement.md for your 10 rows.

This is real financial-operations tooling (payout approval controls, recipient bank/wire/crypto details) — treat every action button/toggle/confirmation-dialog Codebase 1 exposes as a hard functional requirement, not polish. Never treat screenshot figures as real data — placeholder/mock only, don't copy values or expose anything credential-shaped in your findings. Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment.

Files modification outside seed-code/trading-conversational-ai-ui-pages-increment is strictly prohibited.

When done, append your findings to batch-7-admin-disbursement.md's Findings section, verify with tsc/build, and let me know when it's ready.

=====================

Batch 8

====================

You're working in the trading-alerts-saas-public repo. First read docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/00-MASTER-PLAN.md in full (shared rules, hard constraints), then docs/files-completion-list/frontend-codebase-migration/codebase-2-parity-audit/batch-8-admin-core.md for your 15 rows.

Row 94 (/admin/notifications/broadcast) has no Codebase-1 counterpart — DavinTrade-token compliance only. Row 91 is specifically about the admin sidebar's nav card linking to /status, not the /status page's own content (that page is Batch 4's row 84 — cross-reference, don't duplicate the fix). components/admin/admin-nav.tsx is shared with Batches 6–7; check git log before assuming it's untouched. Only modify files inside seed-code/trading-conversational-ai-ui-pages-increment.

Files modification outside seed-code/trading-conversational-ai-ui-pages-increment is strictly prohibited.

When done, append your findings to batch-8-admin-core.md's Findings section, verify with tsc/build, and let me know when it's ready.

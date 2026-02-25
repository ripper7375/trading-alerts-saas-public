FIRST TIME : COMPILATION ERRORS

Root cause: Three transitive minimatch dependencies were locked to vulnerable versions:

minimatch@3.1.2 (via eslint) — vulnerable to ReDoS, patched at 3.1.3
minimatch@9.0.1 (via @typescript-eslint/typescript-estree) — same ReDoS, patched at 9.0.6
minimatch@9.0.5 (via editorconfig ← resend) — same issue, patched at 9.0.6
Fix applied in package.json pnpm.overrides:

"minimatch@<3.1.3": "3.1.3",
"minimatch@>=9.0.0 <9.0.6": "9.0.6"

Also bumped qs override from ^6.14.1 → ^6.14.2 to fix the low-severity qs DoS issue.

Result: pnpm audit --audit-level=high now exits 0 — only 1 moderate (ajv via ESLint internals) remains, which doesn't trigger the CI threshold.

=========================================

FIRST TIME : BRANCH CONFLICTS

Conflicts resolved and pushed. Here's what happened:

Conflicts were in package.json (2 sections):

Section Our branch main Resolution
npm "overrides" "jose" only added minimatch@^10.2.1, ajv@^6.14.0, test-exclude@^7.0.2 Took main's additions
pnpm "overrides" "minimatch@<3.1.3": "3.1.3" + "minimatch@>=9.0.0 <9.0.6": "9.0.6" "minimatch": "^10.2.1" + ajv + test-exclude Took main's simpler blanket override
Main's minimatch@^10.2.1 is a superset of our range-specific overrides — it resolves all three high-severity vulnerabilities in one entry and also adds the ajv moderate fix. Result: pnpm audit now reports 0 vulnerabilities (previously 5).

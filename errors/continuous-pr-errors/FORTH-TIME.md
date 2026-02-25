FORTH TIME : COMPILATION ERRORS

Root cause: All 5 vulnerabilities were in transitive dependencies — none could be fixed by updating direct deps. The correct solution is pnpm.overrides with pnpm's package@range selector syntax, which pins only the vulnerable version range without disturbing other consumers.

Changes to package.json:

Override Before After Severity
minimatch@<3.1.3 (missing) 3.1.3 HIGH — ReDoS via eslint
minimatch@>=9.0.0 <9.0.6 (missing) 9.0.6 HIGH — ReDoS via @typescript-eslint + editorconfig
ajv@<6.14.0 (missing) 6.14.0 MODERATE — ReDoS via eslint
qs ^6.14.1 (still vulnerable!) ^6.14.2 LOW — DoS via newman
The qs override was already present but pointed to ^6.14.1, which is within the vulnerable range >=6.7.0 <=6.14.1. The patched version is >=6.14.2.

pnpm audit --audit-level=low now reports "No known vulnerabilities found", so the CI workflow will pass.

=========================================

FORTH TIME : BRANCH CONFLICTS

Conflict source: Main had merged two PRs (#424, #425) that also fixed the security audit using a different strategy — blanket "minimatch": "^10.2.1" override instead of our version-range selectors, and added "test-exclude": "^7.0.2".

Resolution:

package.json — took main's override approach (blanket minimatch + test-exclude) for both overrides and pnpm.overrides blocks; kept our qs: "^6.14.2" bump which was non-conflicting
pnpm-lock.yaml — checked out main's lockfile as base, then ran pnpm install --no-frozen-lockfile to regenerate it cleanly from the merged package.json (manual lockfile merging is error-prone)
pnpm audit --audit-level=high still reports no known vulnerabilities and all pre-push tests passed.

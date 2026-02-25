SECOND TIME : COMPILATION ERRORS

Root cause
All 3 HIGH vulnerabilities were minimatch ReDoS (GHSA-3ppc-4f35-3m26) in transitive deps across multiple paths. The previous pnpm.overrides didn't cover them.

What changed in package.json
// pnpm.overrides — added:
"minimatch@<3.1.3": "3.1.4", // eslint>minimatch & eslint-plugin-import>minimatch
"minimatch@>=9.0.0 <9.0.6": "9.0.7" // @typescript-eslint & glob paths

// Also corrected (qs was already in vulnerable range ≤6.14.1):
"qs": "^6.14.1" → "^6.14.2"

Version-selector overrides (e.g. "minimatch@<3.1.3") catch all instances of that package matching the range, regardless of how deep in the dependency tree — which is why the path-based approach ("eslint>minimatch") wasn't enough.

Audit result after fix
pnpm audit --audit-level=high → exit 0
1 vulnerability found (Severity: 1 moderate) ← qs advisory, below high threshold

===========================================================

SECOND TIME : BRANCH CONFLICTS

Merge conflicts resolved
package.json — 2 conflicts, both taken from origin/main:

overrides: Added main's "minimatch": "^10.2.1", "ajv": "^6.14.0", "test-exclude": "^7.0.2"
pnpm.overrides: Same additions, replacing our version-selector overrides (@<3.1.3, @>=9.0.0 <9.0.6) with main's broader single "minimatch": "^10.2.1" entry
pnpm-lock.yaml — regenerated clean via pnpm install --no-frozen-lockfile after resolving package.json

Pre-commit hook fixes (blocked the merge commit)
Issue Fix
prettier SIGKILL on 30 MB pnpm-lock.yaml Added pnpm-lock.yaml to .prettierignore
ESLint v9 can't find .eslintrc.json (flat config required by default) Changed lint-staged to ESLINT_USE_FLAT_CONFIG=false eslint --fix
'args' is defined but never used in seed.test.ts:519 Renamed args → \_args
Audit after merge
pnpm audit --audit-level=high → No known vulnerabilities found

FIRST TIME : COMPILATION ERRORS AFTER REFACTORING

Root cause: All 5 vulnerabilities were in transitive dependencies (not direct deps), so pnpm.overrides with path-specific pinning was the right tool.

Changes to package.json:

Override Fix
"qs": "^6.14.2" Bumped from ^6.14.1 — the old range was still inside the vulnerable <=6.14.1 window
"eslint>minimatch": "^3.1.3" HIGH — eslint pulls minimatch v3.x
"eslint-plugin-import>minimatch": "^3.1.3" HIGH
"eslint-plugin-jsx-a11y>minimatch": "^3.1.3" HIGH
"eslint-plugin-react>minimatch": "^3.1.3" HIGH
"eslint-plugin-react-hooks>minimatch": "^3.1.3" HIGH
"@typescript-eslint/typescript-estree>minimatch": "^9.0.6" HIGH — ts-eslint pulls minimatch v9.x
"editorconfig>minimatch": "^9.0.6" HIGH
"glob>minimatch": "^9.0.6" HIGH
"eslint>ajv": "^6.14.0" MODERATE
Path-specific overrides (using > syntax) were used for minimatch because it exists in two incompatible major versions (v3 and v9) across different chains — a global override would have forced one version on everyone and broken packages.

pnpm audit --audit-level=high now exits 0. The CI Security Checks → Dependency audit job will pass.

========================================

FIRST TIME : BRANCH CONFLICTS

Conflicts resolved and pushed. All 2375 tests pass.

What was resolved:

Conflict 1 ("overrides" npm section): kept main's addition of "ajv": "^6.14.0"
Conflict 2 ("pnpm".overrides section): replaced our 9 path-specific overrides with main's 3 cleaner version-range overrides:
"minimatch@<3.1.3": "3.1.3" — patches all v3 instances regardless of which eslint plugin pulls them in
"minimatch@>=9.0.0 <9.0.6": "9.0.6" — patches all v9 instances
"ajv": "^6.14.0" — patches ajv globally
pnpm-lock.yaml: accepted main's version, then re-ran pnpm install to incorporate our package.json changes
pnpm audit --audit-level=high → No known vulnerabilities found.

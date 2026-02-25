THIRD TIME : COMPILATION ERRORS

Root cause: Multiple ESLint plugins and the resend production dependency pulled in vulnerable transitive versions of minimatch — the advisory iteratively revealed new paths as each previous one was patched.

Solution — pnpm.overrides additions in package.json:

Override Severity CVE What it fixes
"minimatch@<3.1.3": "^3.1.3" HIGH GHSA-3ppc-4f35-3m26 ReDoS; affects eslint, eslint-plugin-import, eslint-plugin-jsx-a11y
"minimatch@>=9.0.0 <9.0.6": "^9.0.6" HIGH GHSA-3ppc-4f35-3m26 ReDoS; affects @typescript-eslint/typescript-estree, editorconfig, glob
"qs": "^6.14.2" (was ^6.14.1) LOW GHSA-w7fw-mjwx-w883 DoS; affects newman>postman-request
"ajv": "^6.14.0" (new) MODERATE GHSA-2g4f-4pwh-qvx6 ReDoS; affects eslint>ajv
The version-range selector syntax ("minimatch@<3.1.3") is the key — it patches every instance of minimatch below the threshold regardless of which parent pulls it, so the fix won't need updating if new eslint plugins are added in future.

pnpm audit --audit-level=high now reports: No known vulnerabilities found ✅

==============================================================

THIRD TIME : BRANCH CONFLICTS

Conflicts resolved and pushed. Here's what happened:

The conflict was in pnpm.overrides — main had merged a parallel security fix that used a single "minimatch": "^10.2.1" override (from a different PR), while our branch used version-range selectors ("minimatch@<3.1.3" and "minimatch@>=9.0.0 <9.0.6").

Resolution: Adopted main's simpler flat override "minimatch": "^10.2.1" which covers the same CVEs (forcing all minimatch instances to 10.x, which is patched for all known ReDoS), and kept "test-exclude": "^7.0.2" that main added. The pnpm-lock.yaml conflict was resolved by regenerating it fresh with pnpm install.

pnpm audit --audit-level=high still reports No known vulnerabilities found ✅, and all 2375 tests pass.

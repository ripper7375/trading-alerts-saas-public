---
paths:
  - 'package.json'
  - '**/package.json'
  - 'pnpm-lock.yaml'
  - 'pnpm-workspace.yaml'
  - '**/package-lock.json'
type: Concept/StandingRules
authority: binding
source: "CLAUDE.md '## Security Override Policy' (pre-OKF L5361-L5366), verbatim + precedents from session history"
tags: [dependencies, security, pnpm, package-json]
---

<!-- `paths:` makes Claude Code load this rule only when a package manifest or lockfile is read. -->

# Security override policy (retained from the legacy guide — still binding)

Do **NOT** modify `overrides`/`pnpm.overrides` in `package.json` on feature branches, even
if `pnpm audit` complains. Security overrides are managed centrally on `main` via dedicated
PRs (`check-overrides.yml` enforces this; 7+ documented merge-conflict incidents caused the
rule — see `errors/continuous-pr-errors/`).

## Precedents worth knowing

- **2026-09-11 React 19.2.3 → 19.3.0:** `overrides` pinned `react`/`react-dom` to `^19.2.1`, so
  bumping `dependencies` alone would have been silently forced back. It was escalated with
  `AskUserQuestion`; Davin chose to bump the override in lockstep. Ask first, every time.
- This is a **pnpm workspace**: add root dependencies with `pnpm add -w <pkg>`. Plain
  `npm install` fails on the `workspace:*` protocol. The NestJS services (`money-service/`,
  `operation-service/`, `railway-gateway/`) use their own npm `package-lock.json`.
- An ESM-only release can break this repo's CJS `ts-jest` setup (`@nestjs/schedule` ≥ 7 did;
  pinned to `6.1.3`). Check `"type": "module"` in a new package before adopting it.
- **2026-10-18 production audit sweep (28 high/critical advisories, `pnpm audit --prod --audit-level=high`):**
  find WHICH parent keeps a package vulnerable before choosing. A parent whose range allows the patched
  release (caret ranges) needs only a lockfile re-resolution, no override (see the `pnpm update` gotcha in
  [environment-gotchas](../architecture/environment-gotchas.md)); an override is for a parent that pins the
  child exactly. `prisma@7.9.1` pins `mysql2` 3.15.3 and `@prisma/config@7.9.1` pins `deepmerge-ts` 7.1.5
  (the fix is a major, 8.x; the API Prisma uses, `deepmerge` as c12's `merger`, is unchanged), so
  `mysql2@<3.22.0` and `deepmerge-ts@<8.0.0` are the two NEW overrides; Prisma 7.10.1 pins the fixed
  versions itself, so both can go when Prisma is bumped (an ORM minor bump was judged a bigger change than
  two Prisma-CLI-only overrides). `lodash` was raised to `^4.18.0` (a floor). Direct bumps: `next-auth`
  `^4.24.15` (Davin's sign-off in the chat, 2026-10-18: auth), `undici` `^6.28.1`, `postcss` `^8.5.18`.
  The PR needs the GitHub label `security-override` (`check-overrides.yml`). The CI step "Production audit
  gate (high and critical)" is blocking from this PR on: a new advisory means a new dedicated PR.

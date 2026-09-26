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

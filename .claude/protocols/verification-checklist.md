---
type: Concept/Protocol
authority: binding
updated_at: 2026-09-26
tags: [verification, tests, lint, typecheck, build]
related_docs:
  - ../architecture/environment-gotchas.md
---

# Verification checklist

## Monolith (repo root, pnpm workspace)

| Check           | Command                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Types           | `npx tsc --noEmit` (or `npm run type-check`, which regenerates both Prisma clients first)               |
| Lint            | `npm run lint` (ESLint over `app components lib src hooks types middleware.ts`) or `npx eslint <files>` |
| Tests (CI mode) | `npm run test:ci`                                                                                       |
| Build           | `npm run build`                                                                                         |
| Everything      | `npm run validate` (types, lint, format, policies)                                                      |

Last known baseline: **251 suites / 3213 tests** (2026-09-26 round 5). A change in the count
should be explained by the tests you added.

## NestJS services (each has its own npm lockfile)

| Service              | Checks                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `money-service/`     | `npx tsc --noEmit`, `npm test` (baseline 66/66 · 650/650)                                          |
| `operation-service/` | `npx tsc --noEmit`, `npm test` (baseline 43/43 · 401/401)                                          |
| `railway-gateway/`   | `npx tsc --noEmit`, `npm test`, `npm run test:e2e`; after a contract change `npm run generate:dto` |

## Stack C (Python, `backend-stack-c/.../v2_29_data_pipeline_architecture/`)

No pytest config: run each `test_*.py` directly with `python`, plus `python -m py_compile`.
MQL5 cannot be compiled here — only Davin's MetaEditor can build `.ex5`.

## Rules

- UI changes: verify in the browser preview (`.claude/launch.json`), not only with tests.
- For risky logic, run a mutation check (break it, see a test fail, restore byte-exact).
- Report failures with their output; never mark done with a red suite.

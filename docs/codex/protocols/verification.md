---
type: Concept/Protocol
status: active
updated_at: 2026-10-11
---

# Codex verification adapter

Authority: the shared [verification checklist](../../../.claude/protocols/verification-checklist.md),
applicable order, current package scripts/configs and
[environment gotchas](../../../.claude/architecture/environment-gotchas.md).
This adapter records host-specific limits and command selection, not fixed
passing test counts. The shared checklist's September counts are historical.

## Select checks from the change

| Change / working directory                         | Checks                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Operating docs at repo root                        | `node scripts/agents/check-operating-docs.mjs`, targeted Prettier, `git diff --check`                                                                 |
| Validator implementation at repo root              | `node --test scripts/agents/check-operating-docs.test.mjs`, then the real document checker                                                            |
| Root runtime TypeScript                            | `npx tsc --noEmit`, relevant ESLint and Jest; broader `npm run test:ci` / build when required by scope or order                                       |
| `money-service/`                                   | `npx tsc --noEmit`, `npm test -- --runInBand`, build when relevant                                                                                    |
| `operation-service/`                               | `npx tsc --noEmit`, `npm test -- --runInBand`, build when relevant                                                                                    |
| `railway-gateway/`                                 | `npx tsc --noEmit`, `npm test -- --runInBand`, affected `npm run test:e2e -- --runInBand`, targeted Prettier                                          |
| Stack C Python pipeline directory                  | Relevant standalone `python -B test_<name>.py`; syntax-check changed source without leaving generated artifacts                                       |
| Stack D `davintrade-stack-d-and-e/engine-1-5-new/` | Relevant `python -B -m unittest discover -s mcd_common/tests -t .`, `mcd_worker/tests` or sensor directory; fixture/golden drift checks when affected |
| User interface                                     | Relevant automated checks plus browser evidence at affected sizes/locales                                                                             |
| Shared schema/API contract                         | Relevant producer and consumer tests, canonical drift/parity checks and regeneration owned by the integrator                                          |

This table is a routing aid. Inspect package/config/test headers before running
commands; paths and prerequisites can change. A numbered order's mandated
checks remain required. For a documentation-only change, verify documents;
do not regenerate clients or run the full application build by default.

## Exact targeted recipes

From repository root, after selecting the real test paths:

```powershell
npx jest --runTestsByPath <test-files> --runInBand --coverage=false
npx eslint <changed-runtime-files>
npx prettier --check --end-of-line auto <changed-format-eligible-files>
git diff --check
```

Replace placeholders with explicit paths. Use local installed tools; if a
dependency is missing, report it and follow host network/approval rules rather
than silently downloading a tool. Respect `.prettierignore` and signed/canonical
fixtures. The whole-repo `npm run validate` includes broad formatting and policy
scans; use it when the order requires it, not as a narrow docs check.

## Known coverage and prerequisite gaps

- Root `tsconfig.json` excludes `__tests__` and test/spec files. `next/jest`
  transpiles them without type-checking. A test edit needs test type coverage
  through an appropriate scoped tsconfig or existing package runner; root
  `tsc` alone does not prove it.
- `railway-gateway` tsc excludes `test/`; ts-jest checks specs when executed.
  Its lint script is not a meaningful gate with the current ESLint setup.
  Money and operation services have no lint script at this inspection date.
- Python-backed intake Jest parity can skip without Python, PyYAML or
  jsonschema. Report those skips. Stack D token-budget checks can skip when
  tokenizer data is absent. An off worker configuration proves no live reading.
- Root `*.pg.spec.ts` files are outside normal `*.test.ts[x]` collection.
  Run an affected gated suite explicitly with its required `--testMatch`.
  Gateway PostgreSQL specs need the opt-in variables named in their headers.
  Wipe opt-ins authorize only a dedicated disposable local test database;
  they must never be pointed at an existing shared or production database.
- Root `type-check` regenerates both Prisma clients. Root `build` has a
  destructive prebuild of generated files; coordinate shared resources via
  [collaboration](collaboration.md). `test:quick` runs the entire Jest suite
  with bail/maxWorkers, despite its name.
- Record command exit codes: all assertions passing can still yield a nonzero
  exit from coverage thresholds or teardown. A targeted run with coverage
  disabled is useful but does not satisfy an order requiring coverage.
- Run timezone-sensitive checks in the local timezone and UTC when changing
  date logic. Preserve Windows quoting, actual file endings and process IDs.

## Evidence before done

Use a table with command, cwd, exit, pass/fail/skip and note. Classify every
required gate as passed, failed, skipped or not run. Explain an unavailable
runtime/credential/MetaEditor check and assign its next owner. Do not turn a
historical failure into an accepted baseline without checking the current
unchanged revision. Investigate failures in the affected scope; preserve
unrelated work and report pre-existing failures with evidence.

The operating-doc checker enforces selected document budgets, frontmatter and
local-link existence. It does not measure token usage, performance, approval,
concurrency, test coverage or actual instruction loading in a new session.

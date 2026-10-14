---
type: Concept/Task
status: ready_for_review
updated_at: 2026-10-14
task_id: 2026-10-14-next164-opt-in-phase1
owner: Codex
integrator: Codex root
reviewer: Codex read-only subagents
shared_state_writer: handoff-only
approval: 'Davin requested feasibility assessment, Phase 1 flags, build/test verification and Phase 2–4 planning in this chat.'
order_mode: ad-hoc; phase/session unchanged
base_commit: 77bdeaca994e5cf3fd9b637108c0e5961ca81f1e
worktree: 'D:\SaaS Project\trading-alerts-saas-public'
branch: main
---

# Objective

Review the [canonical roadmap](../../../davintrade-nextjs16-4-configuration/NEXTJS-16-4-ADOPTION-ROADMAP-AND-FEASIBILITY.md)
against installed Next.js 16.4.0, React 19.3.0 and the live pnpm workspace.
Enable the three authorized Turbopack options, verify the production build and
full root Jest suite, and publish prerequisites for later phases.

## Scope and ownership

- Allowed writes: `next.config.js`, this task record and
  `docs/handoffs/2026-10-14-next164-opt-in-phase1-codex.md`.
- Generated outputs owned by root: `.next/`, `tsconfig.tsbuildinfo`, ignored
  Prisma clients and `packages/types/dist/` through package scripts.
  Preserve pre-existing `next-env.d.ts` bytes if Next.js rewrites them.
- Excluded writes: dependencies, lockfiles, security overrides, routes/UI,
  `lib/engine4/`, `lib/i18n/`, `seed-code/`, Claude state and other work.
- Existing dirt: edited `davintrade-recent-works/recent-works.md` and
  `next-env.d.ts`; deleted `mobile-app/**`; untracked roadmap, mobile design,
  pricing, gold-price, research images, MQL5 indicators and prior records.
  Exact status and 340 preserved-file hashes are saved at
  `C:\Users\WiN\AppData\Local\Temp\codex-next164-phase1-20261014\baseline.json`.
- Reviewer: read-only roadmap and config assessment; no separate owner
  sign-off gate is specified for this ad-hoc configuration change.
- Root alone runs builds, generators and tests. Subagents run none of them.
- No commit, push, deployment, production migration or Phase 2–4 changes.

## Checklist

- [x] Inspect live source, instructions and relevant entry criteria.
- [x] Implement the authorized scope.
- [x] Verify acceptance criteria; record exact checks and limitations.
- [x] Complete read-only review and fix findings.
- [x] Write handoff and publish owned state (handoff-only).

## Decisions and deviations

- Installed docs/schema require options directly under `experimental`, not
  nested in `experimental.turbopack`. Preserve top-level `turbopack: {}`.
- Enable only the user's three named options; do not add `agentUpgrade`.
- GC and plugin strategy affect Turbopack builds as well as dev. Only lazy
  client imports are dev-only. Zero production build risk is not guaranteed.
  Node 24.12.0 is below the documented fallback threshold of 24.13.1.
- The user calls route guards Phase 2; the roadmap calls them Phase 3 and
  puts View Transitions in Phase 2. Report this numbering mismatch explicitly.
- `ensureStatic` requires Cache Components; current root request data and
  client-only marketing pages need an architecture audit before adoption.
- Test/route counts are historical; record live counts, failures and skips.
- Current Python 3.11.9 has CI-pinned PyYAML 6.0.2 and jsonschema 4.25.0.
- The initial patch-tool invocation stalled without changing files and was
  terminated; equivalent narrowly scoped file edits are used instead.

- During verification, Claude's separate Step 6 Part 10 session advanced HEAD
  to 70d953e93f38efadf93a9d811f665f4f44819358 with runtime/UI/test changes.
  Its handoff explicitly stops for review and its active task file is absent.
  The first run passed 380 suites / 11,657 tests; the final current-source
  run passed 383 suites / 11,732 tests with zero failures or skips. New verification hashes cover 1,334 source/test files.
  No Codex commit or push occurred; the three external commits are preserved.
- Initial build and dev checks passed, but existing npm, middleware,
  Browserslist and caught dynamic-render diagnostics prevent a warning-free
  log. Do not claim that literal acceptance criterion passed or broaden this
  configuration task into auth/dependency/middleware cleanup.

## Verification

| Command                                                                                     | Cwd       | Exit           | Pass/fail/skip                                        | Evidence / limitation                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | --------- | -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pnpm build (initial sandbox attempt)                                                        | repo root | 1              | Failed before compilation                             | EPERM deleting pre-existing generated .next/dev/build-manifest.json.                                                                                     |
| pnpm build (current-HEAD filesystem-access retry)                                           | repo root | 0              | Passed                                                | 16.4.0 Turbopack compile, type check, prerender and route output complete; existing warnings/diagnostics remain.                                         |
| pnpm test --ci --maxWorkers=2 --coverage=false --silent --json --outputFile=$taskTestReport | repo root | 0              | 383 suites / 11,732 tests passed; 0 failed, 0 skipped | Current HEAD; 262.647 s. Coverage intentionally disabled for this regression run.                                                                        |
| node node_modules/typescript/bin/tsc --noEmit --incremental false                           | repo root | 0              | Passed                                                | Clients already regenerated by prebuild; no overlapping generation or incremental-file writes. Final byte-restoration type recheck also passed (exit 0). |
| pnpm lint                                                                                   | repo root | 0              | Passed, 0 errors / 5 existing warnings                | Four img warnings and register-form effect dependency.                                                                                                   |
| pnpm dev --hostname 127.0.0.1 --port 3104; GET /disclaimer                                  | repo root | 0 HTTP request | Ready in 3.5 s; HTTP 200                              | Cold dev compile served 43,255 bytes; external font/Redis/FX access unavailable in sandbox. Owned server stopped deliberately.                           |
| node --check next.config.js; installed configSchema.safeParse                               | repo root | 0              | Passed                                                | All three flags valid; no nested experimental.turbopack.                                                                                                 |
| node scripts/agents/check-operating-docs.mjs                                                | repo root | 1              | 29 existing issues                                    | Baseline-adapter comparison identical; task and handoff add zero issues.                                                                                 |
| Installed Prettier CLI and git diff --check                                                 | repo root | 0              | Passed                                                | Direct installed bin used because pnpm exec shim did not resolve prettier/tsc.                                                                           |

Evidence directory: C:/Users/WiN/AppData/Local/Temp/codex-next164-phase1-20261014.
Current test report: jest-current.json; build-current.log and command .exit files
capture results. Initial 380-suite run remains as superseded evidence.

## Continuation

- Next action and owner: Davin/Advisor may initiate Phase 2 prerequisite design or separately scope existing warning cleanup.
- Open item: literal warning-free build acceptance is unmet; existing-source cleanup is outside this configuration task.
- Verified final HEAD: 70d953e93f38efadf93a9d811f665f4f44819358; config SHA-256 ADC1DEFDAF0457500D863B0BA45ABCAF815C7DADE8F20DFDA525F3F34F265A81.
- Durable handoff: `docs/handoffs/2026-10-14-next164-opt-in-phase1-codex.md`.
- Shared state publication: handoff-only; canonical state owner may consume
  the report. No Codex continuity or Claude state ownership is claimed.

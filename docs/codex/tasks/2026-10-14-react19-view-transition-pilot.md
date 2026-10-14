---
type: Concept/Task
status: completed
updated_at: 2026-10-14
task_id: 2026-10-14-react19-view-transition-pilot
owner: Codex
integrator: Codex root
reviewer: Codex read-only subagent
shared_state_writer: handoff-only
approval: 'Davin selected Path A and requested React 19.3 typings, reduced-motion CSS, settings ViewTransition pilot, pnpm install and full verification in this chat.'
order_mode: ad-hoc; phase/session unchanged
base_commit: bff5b660825bdd346f5bafda815f860def8e4dda
worktree: 'D:\SaaS Project\trading-alerts-saas-public'
branch: main
---

# Objective

Align root React development typings to ^19.3.0 and pilot native crossfades on
Settings content while preserving auth, locale, navigation and layout behavior.
Read the [relocated feasibility handoff](../../../davintrade-nextjs16-4-configuration/2026-10-14-next164-opt-in-phase1-codex.md).
Deliver type/build/lint/full-Jest evidence and browser evidence, including
reduced-motion behavior and exact unavailable checks. Leave changes uncommitted.

## Scope and ownership

- Root owns writes to package.json devDependencies, pnpm-lock.yaml,
  app/globals.css, app/settings/layout.tsx, this task, and the handoff report at
  davintrade-nextjs16-4-configuration/2026-10-14-react19-view-transition-pilot-codex.md,
  its JSON test report and its evidence directory.
- Any new report is saved under davintrade-nextjs16-4-configuration per Davin.
  No report is written under docs/handoffs and the relocated prior report is
  preserved. The task record uses the explicit docs/codex/tasks path requested.
- No security override, runtime dependency, auth/grant, route guard, caching,
  chart/canvas, seed source, money or locale-text changes.
- Root exclusively owns install/build/Prisma/shared-types generated outputs;
  sequence these against dev and tests. Preserve generated next-env.d.ts's
  entry bytes after validation if rewritten.
- Existing dirt: recent-works edit, mobile-app deletions, untracked design,
  roadmap/reports, research images, MQL5 and prior task/handoff artifacts.
  Baseline hashes/status are in the temporary evidence directory.
- Reviewer is read-only; no edits, install, build, generators or test runs.
- No commit, push, deployment, production migration or credential entry.

## Checklist

- [x] Read guardrails, handoff, relevant installed Next.js guides and live source.
- [x] Update root type versions and install; preserve security overrides.
- [x] Apply reduced-motion CSS and settings content boundary.
- [x] Verify TypeScript and Testing Library type consumption.
- [x] Run production build, full root tests and lint.
- [x] Record unavailable authenticated playback per Davin; verify anonymous redirect and loaded CSS in browser.
- [x] Complete independent review, integrity checks and handoff.

## Decisions and deviations

- Installed Next.js 16.4 docs say App Router navigations trigger transitions
  without a config flag. Follow live docs rather than the older skill's
  experimental.viewTransition flag. Keep next.config.js unchanged.
- The user explicitly limits this pilot to Settings content and the supplied
  reduced-motion safeguard. Do not apply the skill's app-wide recipe/morph
  rollout or introduce directional motion between sibling tabs.
- Preserve the existing card and UserViewAsGate inside the new boundary.
- Live installed typings already report 19.3.0 while manifest/lock reference
  18.x; installation must reconcile them and prove the resolved versions.
- Testing Library 14 has React 18 peers/nested typings. Check consumer types
  directly; root tsc excludes tests and skipLibCheck cannot prove test typing.
- Settings is auth-protected and redirects anonymous requests to /login.
  Browser inventory has no signed-in tab. Asked Davin to sign in himself for
  authenticated smoke evidence; Davin selected “Record authenticated
  verification as unavailable.” Do not request login again or bypass auth.
- Current shared state describes Step 6 Session B as verified/stopped; no active
  Claude task file is present. Do not resume its open owner decisions.

- pnpm install and the scoped consumer type check passed. Lock semantic
  comparison found no runtime upgrades or non-root importer changes.
- Live suite count is 383 / 11,748, not historical 11,732, from existing
  Step 6 Session B additions before this task. Full run passed with zero skips.
- In-app browser lacks the native API; all three reduced-motion rules load,
  but authenticated playback and preference-enabled animation were not tested.
- The anonymous page logged a server-origin Redis EACCES; zero console errors
  are not claimed. Authenticated verification remains explicitly unavailable.

## Verification

| Command/check                                                                 | Cwd            | Exit      | Result and limitation                                                                                                                                              |
| ----------------------------------------------------------------------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install`                                                                | repo root      | 0         | Both root typings resolved to 19.3.0; Prisma/shared types regenerated. Existing deprecated-package/npm/peer warnings remain.                                       |
| `node node_modules/typescript/bin/tsc --noEmit`                               | repo root      | 0         | Application type resolution passed. Type check also passed after restoring generated next-env entry bytes.                                                         |
| Scoped Testing Library consumer tsc with `skipLibCheck: false`                | repo root      | 0         | ViewTransition, React DOM createRoot, render/wrapper, rerender and act typings compile together. Root tsc alone excludes tests.                                    |
| `pnpm build`                                                                  | repo root      | 0         | Turbopack production compile, type checking, prerender and route output passed. Existing middleware/Browserslist/npm/dynamic-render diagnostics remain.            |
| `pnpm test --ci --maxWorkers=2 --coverage=false --json --outputFile=<report>` | repo root      | 0         | 383 suites / 11,748 tests passed, zero failures or skips, 321.753 s. No tests were added/removed by this task; the 16 extra tests predate it at current HEAD.      |
| `pnpm lint`                                                                   | repo root      | 0         | Zero errors, the same five existing warnings (four img warnings and register-form effect dependency).                                                              |
| `pnpm dev --hostname 127.0.0.1 --port 3104`                                   | repo root      | ready     | Ready in 3.5 s. Temporary server stopped intentionally after evidence collection.                                                                                  |
| Cold anonymous GET `/settings/profile`, redirects disabled                    | local server   | 0 request | HTTP 307 to `/login?callbackUrl=%2Fsettings%2Fprofile`, confirming protection. This is not Settings HTTP 200 evidence.                                             |
| Browser redirect and loaded CSS inspection                                    | in-app browser | observed  | Login rendered; all three pseudo-elements have animationName none with important priority under prefers-reduced-motion. Native API is unavailable in this browser. |
| Installed Prettier CLI and git diff --check                                   | repo root      | 0         | Formatting and whitespace checks passed.                                                                                                                           |
| node scripts/agents/check-operating-docs.mjs                                  | repo root      | 1         | 29 existing issues, identical to baseline; zero issues in this task/report.                                                                                        |
| Preservation / verification hash comparison                                   | repo root      | 0         | All 343 entry hashes and all 1,334 checked source hashes match; HEAD unchanged.                                                                                    |

## Continuation

- Next action: Davin reviews the uncommitted implementation; optional authenticated playback before broader rollout.
- Authenticated browser verification: unavailable by Davin’s explicit choice; record the anonymous redirect honestly.
- Source: base SHA above; all four target files clean on entry.
- Durable handoff: davintrade-nextjs16-4-configuration/2026-10-14-react19-view-transition-pilot-codex.md.
- Shared state: handoff-only, with no canonical state ownership or transfer.

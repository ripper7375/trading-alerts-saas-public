---
type: Concept/Task
status: in_progress
updated_at: 2026-10-14
task_id: 2026-10-14-react193-path-a
owner: Codex
integrator: Codex root
reviewer: Codex read-only subagent
shared_state_writer: handoff-only
approval: 'Davin selected Path A and requested root React typings ^19.3.0 and a React DOM ViewTransition pilot; remaining instructions pending after truncated message.'
order_mode: ad-hoc; phase/session unchanged
base_commit: 7d2f452b4c878b87ec7ee24fd51767e476a09265
worktree: 'D:\SaaS Project\trading-alerts-saas-public'
branch: main
---

# Objective

Modernize root React/React DOM dev typings to the requested ^19.3.0 ranges,
verify compatibility, and pilot ViewTransition on the approved clean DOM
component. Read the [relocated Phase 1 report](./2026-10-14-next164-opt-in-phase1-codex.md).
The user message ends inside its dependency block; await remaining pilot scope
while performing independent dependency preparation.

## Scope and ownership

- Root owns package.json and pnpm-lock.yaml changes, generated build/client
  resources and all checks. Preserve package overrides and frozen seed-code.
- No runtime version upgrade, production flag, auth/money/CORS semantic change,
  commit, push, deployment or migration is authorized.
- Pilot files and narrow type-compatibility fixes will be named after the
  remaining instructions and compatibility review; no UI edit before that.
- Reports and this task record live in davintrade-nextjs16-4-configuration/ per
  Davin's current instruction, overriding the template's default directory.
- Allowed report writes: this file, relocated Phase 1 report link repair, and
  2026-10-14-react193-path-a-codex.md. Do not recreate the former report path.
- Existing dirt: edited recent-works log, deleted mobile-app tree, untracked
  roadmap/reports, pricing/gold/mobile design, MQL5, research images and prior
  records. Exact status and 341 hashes are in the local baseline.
- Reviewer is read-only; no other agent runs generators/tests/builds or installs.
- Canonical Claude/Codex state publication is handoff-only.

## Checklist

- [x] Read guardrails, relocated report, installed docs and live source.
- [ ] Confirm package availability and complete requested typing upgrade.
- [ ] Receive remaining pilot scope and implement the approved DOM pilot.
- [ ] Verify types, relevant/full tests, lint, build and browser behavior.
- [ ] Complete independent review and publish the final report.

## Decisions and deviations

- Runtime 16.4.0/19.3.0 already matches; installed root typings are React
  18.3.27 and React DOM 18.3.7. No change to overrides is needed or authorized.
- Installed Next.js guide is newer than parts of the skill: App Router needs
  no viewTransition flag, React 19.3 supports stable ViewTransition, and the
  guide names Chromium 125+ for React's newer transition features.
- Apply the skill audit/CSS guidance within the small pilot, rather than its
  generic whole-app rollout. Preserve localization and reduced-motion support.
- Phase 1 config was committed by the user between tasks as 7d2f452b; Codex
  did not perform that commit. Current entry source is the base SHA above.

## Verification

Pending package availability and remaining user instructions.

## Continuation

- Root continues dependency preparation; pilot component/scope pending.
- Local evidence: C:/Users/WiN/AppData/Local/Temp/codex-react193-path-a-20261014.
- Final report: davintrade-nextjs16-4-configuration/2026-10-14-react193-path-a-codex.md.

# Migration Orders — Index

> **This file is now an index.** The single template that used to live here grew into a
> family — the port-specific content moved to `TEMPLATE-PORT.md`.

**Read first:** `00-SKELETON-AND-RULES.md` — the shared skeleton, the session chain protocol
(draft next order at end of session N, confirm at start of N+1), and the Autonomy & Deviation
clause with the per-variant creativity dial.

**Variants** (choose by session type — mapping table in `00-SKELETON-AND-RULES.md` §2):

| File                        | For sessions that…                          | Dial      |
| --------------------------- | ------------------------------------------- | --------- |
| `TEMPLATE-CONTRACT.md`      | research, write specs/audits, resolve flags | Medium    |
| `TEMPLATE-INFRA.md`         | provision/configure live systems            | Medium    |
| `TEMPLATE-PORT.md`          | move existing code between stacks           | Low       |
| `TEMPLATE-UPGRADE.md`       | bump dependency/framework versions          | Medium    |
| `TEMPLATE-UI-BUILD.md`      | build/redesign frontend surfaces            | High      |
| `TEMPLATE-VERIFY-RETIRE.md` | cut over, delete, review phase exits        | Near zero |

**Worked example:** `4B-2-alert-engine.migration-order.md` (PORT variant, real file inventory).

**Naming:** `<session>-<slug>.migration-order.md`, e.g. `4A-2-money-crons.migration-order.md`.
Status lives in the header: `PRE-DRAFT` (Executor, end of prior session) → `DRAFT` (Advisor
upgrades with template + strategy) → `APPROVED` (Davin) → `CONFIRMED` (Executor re-verifies
vs live codebase + runtime state at session start) → executed. Full protocol + roles:
`00-SKELETON-AND-RULES.md` §1 and `development-chain-protocol.jpg`.

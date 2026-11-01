---
type: Concept/Task
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-annual-ten-month-rounding-check
owner: Codex
integrator: Codex root
reviewer: Codex commit_scope_audit, read-only
shared_state_writer: handoff-only
approval: Davin asked to check annual pricing against ten months and the displayed 17 percent savings after merging the feature.
order_mode: ad-hoc; phase/session unchanged
base_commit: bca43441e12f3dfabe9babc4ab2a3494fc120f37
worktree: D:/SaaS Project/trading-alerts-saas-public
branch: codex/intraday-subscription-prices
---

# Objective

Check the reported GBP monthly/annual discrepancy against live configuration,
the shared formatter and the ten-month rule; correct a defect only if established.

## Scope and ownership

- Root owns this record and its unique report in Davin's relocated folder.
- Reviewer independently checks arithmetic and source, with no writable scope.
- Public pricing and FX GETs are read-only. No runtime source, configuration,
  keys, payment semantics, database, Redis, shared state, branch, commit, push
  or deployment changes. Existing moves/deletions and unrelated edits preserved.
- Root owns the direct formatter assertions and documentation checks. No builds,
  generated resources or broad application tests are needed for this check.

## Checklist

- [x] Read instructions and reconcile branch/source changes.
- [x] Trace monthly and annual SystemConfig values and display rounding.
- [x] Read public production configuration and FX snapshot metadata.
- [x] Independently review ten-month and savings arithmetic.
- [x] Exercise the actual formatter and document the result.

## Decisions and deviations

The live USD monthly/annual configuration is 20/200, exactly ten months. The
same live snapshot reproduced the screenshot's GBP 15.13/151.26 display and
CurrencyBeacon timestamp. Monthly and annual conversion use the same table
and each final amount is independently rounded. Ten months implies 16.6667
percent savings against twelve months; the UI rounds that percentage to 17.
The screenshot annotation's 151.13 is not the product of 15.13 and ten.
No pricing defect was established, so no runtime change is appropriate.
No raw provider quote is persisted in this record or handoff.

## Verification

| Check                                      | Cwd             | Exit | Evidence / limitation                                                                                              |
| ------------------------------------------ | --------------- | ---- | ------------------------------------------------------------------------------------------------------------------ |
| Public production pricing and FX GETs      | Repository root | 0    | Both HTTP 200; configured annual/monthly ratio 10; active CurrencyBeacon snapshot matches screenshot timestamp     |
| Actual formatter and arithmetic assertions | Repository root | 0    | Five assertions passed: monthly display, annual display, ratio 10, rounded savings 17, displayed monthly times ten |
| Separate source/arithmetic review          | Repository root | 0    | No defect evidenced; independent rounding confirmed                                                                |

## Continuation

Documentation checks: targeted Prettier exit 0; operating-document checker exit 1
for 30 existing issues elsewhere, with none attributed to these records.

- Check completed; explain the rounding result to Davin.
- Handoff: [annual rounding check](../../../davintrade-intraday-subscription-prices/2026-10-13-annual-ten-month-rounding-check-codex.md).
- No deployment or charge was exercised; shared-state publication remains with
  its named owner. No input is required for this completed check.

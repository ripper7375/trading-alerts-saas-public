---
type: Concept/Handoff
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-preview-fx-provider-clarification
owner: Codex
shared_state_writer: handoff-only
---

# Handoff: preview FX provider clarification

Date: 2026-10-13, Asia/Bangkok.
From / to: Codex root and read-only reviewer / Davin and canonical state owner.
Task: [directly authorized clarification](../docs/codex/tasks/2026-10-13-preview-fx-provider-clarification.md).
Phase/session: unchanged, ad-hoc.
Source: `D:/SaaS Project/trading-alerts-saas-public`, branch
`codex/intraday-subscription-prices`, HEAD
`c6f71a2c1b300ff702e434ec8cafe0c3469f09f8`.
Status: explanation completed; deployment failure cause unconfirmed.

## Needs from Davin

None for this explanation. Deployment activation is a separate action.

## Changed and verified

Only this report and its task record were created. Source review establishes:

- On a provider fetch, CurrencyBeacon is primary when the server has a nonempty
  `CURRENCYBEACON_API_KEY`. A valid complete response is cached for one hour.
- A missing key or failed/invalid primary response selects Frankfurter. A
  configured primary failure uses a 15-minute retry interval; a missing key
  uses a one-hour interval. Refresh occurs on the next request after expiry.
- A valid process or shared Redis snapshot is returned before fetching either
  provider. Cached Frankfurter can therefore remain active until expiry.
- Both services implement this hierarchy. If they share Redis, every writer
  needs the deployed key; a writer without one can publish fallback data.
- Rates are not averaged or combined. Attribution names the provider of the
  current table; About describes the primary/fallback design.
- Five-minute browser polling reads the server table. It does not turn daily
  Frankfurter data into intraday data. Source updated is the provider's date,
  rather than the last browser/server check time.

Both local environment files exist and are ignored/untracked. Their contents
did not travel with the GitHub push. The earlier implementation report records
successful local CurrencyBeacon verification, which does not establish the
preview's server environment.

| Check                                     | Cwd             | Exit | Evidence / limitation                                                   |
| ----------------------------------------- | --------------- | ---- | ----------------------------------------------------------------------- |
| Provider/cache source and separate review | Repository root | 0    | Primary/fallback hierarchy and root/money parity confirmed              |
| Ignored/untracked local environment files | Repository root | 0    | Status only; no secrets read                                            |
| Preview HTTP metadata GET                 | Repository root | 0    | Redirected to Vercel login; live FX response unavailable                |
| Targeted Prettier                         | Repository root | 0    | Both owned records formatted and checked                                |
| Operating-document checker                | Repository root | 1    | 30 existing issues in other documents; no error attributed to this task |

## Review findings

No code defect established. The screenshot alone cannot distinguish a missing
deployment key, primary request failure or a valid cached fallback.

## Unconfirmed / found

The preview's protected API did not expose JSON to the unauthenticated check.
No Vercel environment, function logs or live Redis were inspected or changed.
To activate the primary, the server needs the key in its Vercel Preview
environment and a new deployment after configuration; deployed money-service
needs its own key and restart/deployment too. Deployment and cache state must
be checked to confirm the actual cause.

## Next action and ownership

Clarification scope is complete. Deployment configuration/log investigation
belongs to a separately assigned action. The canonical state owner may publish
this report; Codex did not edit shared state. No commit or push was performed
for these clarification documents.

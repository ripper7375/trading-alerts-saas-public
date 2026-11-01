---
type: Concept/Handoff
status: completed
updated_at: 2026-10-13
task_id: 2026-10-13-fx-fallback-remedy
owner: Codex
shared_state_writer: handoff-only
---

# Handoff: FX fallback remedy

Date: 2026-10-13, Asia/Bangkok.
From / to: Codex root and read-only reviewer / Davin and canonical state owner.
Task: [Advisor restart advice and remedy request](../docs/codex/tasks/2026-10-13-fx-fallback-remedy.md).
Phase/session: unchanged, ad-hoc.
Source: `D:/SaaS Project/trading-alerts-saas-public`, branch
`codex/intraday-subscription-prices`, HEAD
`bca43441e12f3dfabe9babc4ab2a3494fc120f37`.
Status: diagnosis and concrete operational remedy completed; no deployment change.

## Needs from Davin

None for the remedy explanation. Changing deployed environments, deploying and
invalidating shared Redis are separate owner actions.

## Changed and verified

Only this report and its task record were created. The actual app provider
function succeeded with the existing local key, returned a valid complete
15-currency CurrencyBeacon table and finished within its three-second timeout.
Both local service keys match. No credential or raw rate values were printed.

The local listener inspection found no server on ports 3000, 3001, 3012 or 4000.
The recent main merge did not change FX provider/cache source. Separate review
confirmed a restart clears process memory but can still read a valid Frankfurter
Redis table before trying the primary. Existing tests intentionally cover this.

### Concrete remedy

1. Confirm `CURRENCYBEACON_API_KEY` is configured for the actual Vercel **Preview**
   environment, including any branch-specific environment rules. Configure the
   deployed money-service and every other publisher sharing the FX Redis cache.
   Local environment files do not configure these deployments.
2. Redeploy the preview after the environment change and restart/redeploy the
   affected money-service. Restarting local development affects only local code.
3. Let the existing `fx:usd_rates:v2` snapshot expire, at most one hour under the
   current cache policy. On the next request, successful configured primary
   retrieval publishes CurrencyBeacon data. A publisher still missing its key
   can keep publishing fallback data, so configure every writer first.
4. Open `/api/fx/rates` in the authenticated preview browser and confirm
   `provider` is `currencybeacon`. The attribution should then change accordingly.
   If fallback persists, inspect function warnings for unavailable/invalid primary
   data and deployment environment scope; the key's local success does not prove
   deployed connectivity, quotas or configuration.

Immediate activation can additionally invalidate only the relevant environment's
`fx:usd_rates:v2` record and refresh/restart warm process caches. No such mutation
was performed; clearing Redis alone does not remove process caches.

| Check                                   | Cwd             | Exit | Evidence / limitation                                                             |
| --------------------------------------- | --------------- | ---- | --------------------------------------------------------------------------------- |
| Local keys and Vercel access presence   | Repository root | 0    | Keys present/equal; no access token found in checked locations; no values printed |
| Local TCP listener inspection           | Repository root | 0    | No matching listeners on four candidate ports                                     |
| Actual CurrencyBeacon provider function | Repository root | 0    | Valid 15-currency table, 934 ms                                                   |
| Separate source/cache review            | Repository root | 0    | Root/money parity and restart/cache caveat confirmed                              |

## Review findings

Documentation verification: targeted Prettier exit 0; operating-document checker
exit 1 for 30 existing issues elsewhere, with none attributed to this task.
Application tests/builds were not rerun because runtime source is unchanged.

Advisor advice is correct for loading a changed local environment but does not
guarantee immediate CurrencyBeacon selection when shared fallback is cached.
No code defect or specific preview failure cause was established.

## Unconfirmed / found

The protected preview's server environment, function logs and live Redis remain
uninspected. No local server was started or stopped. No runtime source, keys,
deployment settings, Redis, login credentials, commit or push were changed.
Only environment variable presence and names were checked for available Vercel
access; an OIDC variable was not treated as a general API access token.

## Next action and ownership

Clarification scope is complete. Deployment activation and authenticated preview
verification belong to a separately authorized action. The canonical state owner
may publish this report; Codex did not change shared state or the moved documents.

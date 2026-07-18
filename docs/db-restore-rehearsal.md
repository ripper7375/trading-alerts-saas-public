# Database Restore Rehearsal — Session 1-1

**Date:** 2026-07-18 · **Target:** `trading-alerts` Railway project, `Postgres` service
(`maglev.proxy.rlwy.net`, database `railway`) — see `DECISION-LOG.md` F3 for how this
instance was identified. **Method:** logical backup (`pg_dump`, custom format) restored
into an isolated, localhost-only scratch instance; destroyed immediately after
verification. No data was modified or deleted on the live instance at any point — every
operation against production was a read-only query or a snapshot read (`pg_dump`).

## Backup

- Tool: `pg_dump -Fc` (custom format), run inside a throwaway `postgres:17-alpine` Docker
  container so no client tooling needed installing on the host.
- Source: production `DATABASE_PUBLIC_URL`, injected via `railway run` directly into the
  container's environment — the connection string was never printed, logged, or written
  to any file; only its hostname was ever displayed (see `DECISION-LOG.md` F3).
- Result: 206,993-byte dump file, 26 tables, schema + data + indexes + FK constraints.

## Scratch instance

- A second throwaway `postgres:17-alpine` Docker container, bound only to
  `127.0.0.1:<docker-assigned-port>` — no network path from anywhere but this machine's
  loopback interface, satisfying the order's "no shared network access, no real traffic
  ever reaches it" rule more strictly than a second cloud instance would.
- Throwaway password generated locally for this container only (18 random bytes,
  base64url), never derived from or related to any production credential.
- Restored via `pg_restore --no-owner --no-privileges` — completed cleanly, all indexes
  and 21 foreign-key constraints recreated with no errors.

## Row-count verification

All 26 tables compared row-for-row between production and the restored scratch copy —
**exact match on every table**:

| Table           | Rows  | Table               | Rows |
| --------------- | ----- | ------------------- | ---- |
| `User`          | 1     | `SystemConfig`      | 5    |
| `login_history` | 4,994 | `security_alerts`   | 42   |
| `user_sessions` | 2     | All other 21 tables | 0    |

(`Account`, `AccountDeletionRequest`, `AffiliateCode`, `AffiliateProfile`,
`AffiliateRiseAccount`, `Alert`, `Commission`, `DisbursementAuditLog`,
`DisbursementTransaction`, `FraudAlert`, `Notification`, `Payment`, `PaymentBatch`,
`RiseWorksWebhookEvent`, `Session`, `Subscription`, `SystemConfigHistory`,
`UserPreferences`, `VerificationToken`, `Watchlist`, `WatchlistItem` — all 0 in both
source and restore.)

Note on data shape: production currently has a large `login_history`/`security_alerts`
audit trail but only 1 `User` row and 0 rows in every core transactional table
(`Alert`, `Subscription`, `Payment`, etc.). This was flagged and confirmed with Davin
mid-session as genuine current production state (not a fresh/reset instance — the
`Postgres` service was found offline and manually redeployed as a restart of the
existing volume, not a recreation) before being used as this rehearsal's baseline. See
`DECISION-LOG.md` F3 for the full offline/redeploy timeline.

## App-boot verification

- Built `.env.scratch` by copying `.env.local` and repointing only `DATABASE_URL` to the
  scratch container (`localhost`) — `.env.local` itself was never modified, per the
  order's explicit rule.
- Booted `next dev` on a scratch port (3099) with `.env.scratch`'s variables exported
  into the process environment (so they take precedence over any `.env.local`/`.env`
  Next.js would otherwise load — the app never had live production or scratch
  credentials mixed).
- `GET /` → `HTTP 200` (twice, 51,587-byte real rendered page), server log shows no
  Prisma/DB errors of any kind — clean boot.

## Teardown (rollback, completed same session)

- Scratch app process killed, scratch Docker container removed (`docker rm -f`), backup
  dump file deleted, `.env.scratch` deleted, all other temp working files deleted —
  confirmed via `git status` and `docker ps -a` that nothing from this rehearsal
  persists. Nothing in the scratch instance needed to survive past verification, per the
  order's own rollback note.

## Conclusion

Restore procedure works end-to-end: backup → restore → verify → boot, with an exact
row-count match and a clean application boot. See `DECISION-LOG.md` F18 for how this
maps to Davin's RPO/RTO targets.

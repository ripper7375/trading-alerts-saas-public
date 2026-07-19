-- Migration Order 1-3 (Plan §3 Stage A) — Postgres role/grant setup.
-- Option A scope: money_svc + core_app only. gateway_ingest is out of scope
-- (railway-gateway/market_data_v6 were never deployed — see DECISION-LOG.md,
-- "Session 1-1 close-out / 1-2b pivot").
--
-- Idempotent: safe to run any number of times. Re-running always converges on
-- the same end state (role exists, grants exactly as listed below) with no
-- errors.
--
-- Apply with (password values supplied at apply-time, never stored here):
--   psql "$DIRECT_URL" \
--     -v money_svc_password="$MONEY_SVC_PASSWORD" \
--     -v core_app_password="$CORE_APP_PASSWORD" \
--     -f prisma/roles/roles.sql
--
-- Must run against the DIRECT connection (LESSONS-LEARNED.md L3) — role/grant
-- DDL is exactly the kind of session-level operation PgBouncer transaction
-- pooling is unsafe for.

\set ON_ERROR_STOP on

-- 1. Create roles if missing. Password is set only at creation time — rerunning
--    this script does not reset an existing role's password (avoids treating a
--    routine idempotency check as a credential-rotation event).
SELECT format('CREATE ROLE money_svc LOGIN PASSWORD %L', :'money_svc_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'money_svc')
\gexec

SELECT format('CREATE ROLE core_app LOGIN PASSWORD %L', :'core_app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'core_app')
\gexec

-- 2. Baseline connect/usage privileges.
GRANT CONNECT ON DATABASE railway TO money_svc, core_app;
GRANT USAGE ON SCHEMA public TO money_svc, core_app;

-- 3. Reset each role's table grants to a known-clean slate before re-applying.
--    (Only affects money_svc/core_app — no other role's privileges are touched.)
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM money_svc;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM core_app;

-- 4. money_svc: ALL privileges on the money-domain tables, SELECT on nothing
--    else (Plan §3 — do not redesign).
GRANT ALL PRIVILEGES ON TABLE
  "AffiliateProfile",
  "AffiliateCode",
  "Commission",
  "Payment",
  "Subscription",
  "SystemConfig",
  "SystemConfigHistory",
  "FraudAlert",
  "AffiliateRiseAccount",
  "PaymentBatch",
  "DisbursementTransaction",
  "RiseWorksWebhookEvent",
  "DisbursementAuditLog"
TO money_svc;

-- 5. core_app: ALL privileges on every non-money table (everything the
--    monolith's "core" app domain owns today).
GRANT ALL PRIVILEGES ON TABLE
  "Account",
  "AccountDeletionRequest",
  "Alert",
  "Notification",
  "Session",
  "User",
  "UserPreferences",
  "VerificationToken",
  "Watchlist",
  "WatchlistItem",
  "login_history",
  "security_alerts",
  "user_sessions"
TO core_app;

-- 6. Temporary transition bridge (Plan §3, explicit exception): core_app may
--    read — never write — Subscription until cutover. Revoke this grant at
--    cutover; see migration-cutover-table.md.
GRANT SELECT ON TABLE "Subscription" TO core_app;

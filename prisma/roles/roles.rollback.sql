-- Paired rollback for prisma/roles/roles.sql (Migration Order 1-3).
-- Not applied unless needed — written up front per the order's Rollback section.
--
-- Apply with:
--   psql "$DIRECT_URL" -f prisma/roles/roles.rollback.sql

\set ON_ERROR_STOP on

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM money_svc;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM core_app;
REVOKE USAGE ON SCHEMA public FROM money_svc, core_app;
REVOKE CONNECT ON DATABASE railway FROM money_svc, core_app;

DROP ROLE IF EXISTS money_svc;
DROP ROLE IF EXISTS core_app;

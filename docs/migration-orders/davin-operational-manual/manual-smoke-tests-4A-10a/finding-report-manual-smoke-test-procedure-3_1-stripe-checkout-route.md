## Findings Report: Manual Smoke Test Procedure 3.1 — Stripe Checkout Route

**Date of Investigation:** 7/28/2026
**Investigated By:** Manual verification against live Railway project `trading-alerts` (environment: `production`)
**Conclusion:** The procedure does not match the actual deployed infrastructure and cannot be executed as written.

### 1. Environment Mismatch

The procedure assumes a `staging` environment (referencing `staging.trading-alerts.com`), but the only environment present in the Railway project is `production`. No separate staging environment exists.

### 2. Target Service Does Not Exist

The procedure instructs enabling the feature flag on a service named `trading-alerts-monolith`. This service does not exist anywhere in the project. The actual services present are: `money-service` (Online), `operation-service` (Online), `flask-api` (Offline/unexposed), `pgbouncer` (Online), `Postgres` (Online), and `Redis` (Online).

### 3. Feature Flag Not Present on Any Candidate Service

Investigated the two most plausible candidates for "the monolith" plus the retired one:

- **operation-service** (9 variables): `ALLOWED_ORIGINS`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NODE_ENV`, `PORT`, `REDIS_URL`, `RESEND_API_KEY`, `TWO_FACTOR_ENCRYPTION_KEY` (plus 8 Railway-injected variables). No `MIGRATE_WRITE_APIS_MONEY_STRIPE` flag and no Stripe-related variable of any kind.

- **money-service** (13 variables): `ALLOWED_ORIGINS`, `CRON_ENABLED`, `CRON_SECRET`, `DATABASE_URL`, `DISBURSEMENT_PROVIDER`, `DLOCAL_WEBHOOK_SECRET`, `NEXTAUTH_SECRET`, `REDIS_URL`, `RESEND_API_KEY`, `WISE_API_TOKEN`, `WISE_ENVIRONMENT`, `WISE_FUNDING_ALERT_EMAIL`, `WISE_PROFILE_ID`. Payment rail configuration present is Wise and dLocal — no Stripe variables present.

- **flask-api**: Offline, unexposed, zero configured variables. Railway's own UI reports it is still "Analyzing your repository for variables," indicating this service has never been actively deployed/configured in this project.

### 4. No Stripe Integration Evidence

Across all services in the project, there is no variable referencing Stripe (e.g., no `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, etc.), and no indication of a `StripeCheckoutController` or an `/api/checkout` → `/v1/stripe/checkout` forwarding path.

### 5. Recommendation

The procedure's target service, target environment, feature flag, and controller/endpoint described in Steps 1–6 do not correspond to anything present in the actual Railway deployment. Before any smoke test can be executed, the following need to be reconciled against the real codebase: which service (if any) is intended to own `/api/checkout`, whether the Stripe checkout migration code has actually been written and merged, and whether a staging environment needs to be provisioned before testing against production.

Let me know if you'd like me to adjust the tone, add more detail, or trim anything before you send it over.

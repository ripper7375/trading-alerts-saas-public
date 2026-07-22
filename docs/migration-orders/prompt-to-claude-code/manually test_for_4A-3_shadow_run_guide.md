# Shadow-Run Verification Guide (Session 4A-3)

## The Concept: Why are we doing this?

Right now, your **Vercel** app is automatically running your cron jobs on a schedule (e.g., every midnight).
We just deployed the new **Railway** (`money-service`) crons, but we told them to stay asleep (`CRON_ENABLED=false`).

We **cannot** let both Vercel and Railway run automatically at the same time. If they both ran the `process-pending-disbursements` job at the exact same millisecond, they might both create a payment batch for the same affiliate, resulting in a **double-payout**.

### The "Idempotency" Test

Instead of running them at the exact same time, we do this:

1. Let Vercel run automatically on its normal schedule. It will do the real work (update the database, send payouts, etc.).
2. Later in the day, we **manually** trigger the asleep Railway cron.
3. The Railway cron wakes up, looks at the database, and should realize: _"Oh, Vercel already processed these affiliates today. There is no work for me to do."_
4. Railway goes back to sleep without changing any data or sending duplicate payouts.

This behavior is called being **idempotent**. If Railway correctly ignores already-processed data, it passes the test. Once all 8 jobs pass this test, we know it is 100% safe to cutover.

## Step-by-Step Implementation

### Step 1: Get your setup ready

You will need a way to send HTTP `POST` requests. You can use **Thunder Client** (a VSCode extension), **Postman**, or **cURL** in your terminal.

- **Base URL:** The public URL of your `money-service` on Railway.
- **Header:** You must pass the secret you created so the server doesn't block you.
  - Key: `Authorization`
  - Value: `Bearer 2a8f9b4e7c3d1w6q8v5p0m4n7x2z9k1`

### Step 2: The Verification Process (For each job)

1. **Wait for Vercel:** Look at your Vercel logs and confirm the job ran normally on its schedule.
2. **Trigger Railway:** Send a `POST` request to `https://<YOUR_RAILWAY_URL>/v1/cron-trigger/<JOB_NAME>`.
3. **Check the Response:** The API should return a success message (e.g., 200 OK) but indicate 0 items were processed (since Vercel already did the work).
4. **Check Railway Logs:** Look at the `money-service` logs in the Railway dashboard. Ensure there are no crash errors.
5. **Check Database:** Briefly verify that no duplicate rows (like `PaymentBatch` or `DisbursementTransaction`) were created at the exact time you clicked the manual trigger.

### Step 3: The 8-Job Checklist

Keep this checklist and check them off as you test them over the next couple of days:

- [ ] `POST /v1/cron-trigger/check-expiring-subscriptions`
- [ ] `POST /v1/cron-trigger/daily-maintenance`
- [ ] `POST /v1/cron-trigger/distribute-codes`
- [ ] `POST /v1/cron-trigger/downgrade-expired-subscriptions`
- [ ] `POST /v1/cron-trigger/expire-codes`
- [ ] `POST /v1/cron-trigger/process-pending-disbursements` (⚠️ **CRITICAL**: ensure 0 batches created)
- [ ] `POST /v1/cron-trigger/send-monthly-reports`
- [ ] `POST /v1/cron-trigger/sync-riseworks-accounts`

## What happens after I check all 8 boxes?

Once you have verified all 8 endpoints behave idempotently, the shadow-run is complete!
You will then open `docs/migration-orders/4a-3-money-service-crons-cutover.migration-order.md`, change the status to **APPROVED**, and hand it to Claude Code to execute the final cutover.

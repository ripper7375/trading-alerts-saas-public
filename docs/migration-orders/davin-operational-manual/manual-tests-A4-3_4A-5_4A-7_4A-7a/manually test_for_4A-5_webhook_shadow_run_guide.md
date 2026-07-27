# Webhooks Shadow-Run Guide (Session 4A-5)

## The Concept

Just like the crons, we need to prove that the new webhooks in `money-service` work flawlessly in production before we actually cut over live traffic to them.
However, webhooks are protected by **HMAC signatures** (e.g., `x-signature` for dLocal and `x-rise-signature` for RiseWorks). This means we cannot easily test them using ThunderClient or cURL unless we manually generate a perfect cryptographic signature.

The easiest and safest way to test them is to use the provider's own dashboard to "replay" or "send a test webhook" to the new URL.

## Step-by-Step Implementation

### Step 1: Set the Secrets in Railway

Since Claude Code is not allowed to handle secrets, you must do this manually.

1. Go to your **Vercel Dashboard** for the monolith.
2. Find the values for `DLOCAL_WEBHOOK_SECRET` and `RISE_WEBHOOK_SECRET`.
3. Go to your **Railway Dashboard** -> `money-service` -> Variables.
4. Add those two secrets. This allows the new Railway webhooks to verify signatures!

### Step 2: Shadow-Run dLocal Webhooks

1. Log into your **dLocal Merchant Dashboard**.
2. Find the **Webhooks / IPN** section.
3. Look for a "Test Webhook" button, OR find a _recent, already-processed successful payment_ and click "Resend Webhook".
4. When it asks for the URL, provide the NEW Railway URL:
   `https://<YOUR_RAILWAY_URL>/v1/webhooks/dlocal`
5. **Verify:**
   - Look at the Railway logs for `money-service`. You should see `dLocal webhook received` and `Webhook processed successfully`.
   - Check your database. Because it is a replay of an old payment, the idempotency logic should prevent it from double-upgrading the user or double-processing the commission.

### Step 3: Shadow-Run RiseWorks Webhooks

1. Log into your **RiseWorks Dashboard**.
2. Find the Webhooks testing or delivery section.
3. Use the "Resend" or "Send Test" feature.
4. Point it to the NEW Railway URL:
   `https://<YOUR_RAILWAY_URL>/v1/webhooks/riseworks`
5. **Verify:**
   - Check the Railway logs for `money-service`.
   - Check the `RiseWorksWebhookEvent` table in your database to ensure the event was recorded and marked as processed/ignored correctly based on idempotency.

## What happens after I verify both?

Once you have successfully replayed a payload to both dLocal and RiseWorks, and verified that Railway can receive, authenticate, and process them correctly, the shadow-run is complete!

You can then open `docs/migration-orders/4a-5-money-service-webhooks-cutover.migration-order.md`, change the status from **DRAFT** to **APPROVED**, and tell Claude Code to execute the Cutover!

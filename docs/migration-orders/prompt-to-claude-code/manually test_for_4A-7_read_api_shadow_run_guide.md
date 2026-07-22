# Read APIs Shadow-Run Guide (Session 4A-7)

## The Concept

We need to prove that the new Read APIs (Slice 3) in `money-service` return the exact same data as the old monolith `/api/` routes, and that they correctly authenticate you using your NextAuth session token via the `Authorization: Bearer` header.

## Step-by-Step Implementation

### Step 1: Get your active Session Token

1. Log into your production frontend website (`trading-alerts-saas-frontend.vercel.app`) as an **Admin** or an **Affiliate**.
2. Open your browser's Developer Tools (F12).
3. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox).
4. Under **Cookies**, click on your website's domain.
5. Find the cookie named `next-auth.session-token` (or `__Secure-next-auth.session-token`).
6. Copy its value. This is your active JWT.

### Step 2: Test the Monolith (The Baseline)

1. Open Postman, ThunderClient, or even just a new browser tab.
2. Make a `GET` request to one of the old monolith routes (e.g., `https://<YOUR_VERCEL_DOMAIN>/api/affiliate/dashboard/stats`).
3. Save the JSON response. This is our baseline.

### Step 3: Test the new `money-service`

1. Open Postman or ThunderClient.
2. Create a new `GET` request pointing to the NEW Railway URL (e.g., `https://<YOUR_RAILWAY_URL>/v1/affiliate/dashboard/stats`).
3. Go to the **Headers** tab.
4. Add a new header:
   - Key: `Authorization`
   - Value: `Bearer <paste-your-cookie-value-here>`
5. Send the request.

### Step 4: Verify Parity

- Did it return a `200 OK`? (If it returns `401 Unauthorized`, your token wasn't passed correctly or the JWT secret isn't matching between Vercel and Railway).
- Does the JSON response match the baseline you saved in Step 2 exactly?

Once you have verified at least one Affiliate route and one Admin route, your shadow-run for 4A-7 is complete! You can hold onto this verification until it is time to cut over 4A-7.

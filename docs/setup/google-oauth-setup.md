# Google OAuth Setup Guide - Step-by-Step Instructions

**Project:** Trading Alerts SaaS V7
**Date:** 2025-11-17
**Estimated Time:** 10-15 minutes

---

## 📋 Prerequisites

- Google Account (your personal Gmail or Google Workspace account)
- Access to [Google Cloud Console](https://console.cloud.google.com/)
- This guide open for reference

---

## PART A: Create Google Cloud Project

### Step 1: Go to Google Cloud Console

1. Visit: https://console.cloud.google.com/
2. Sign in with your Google account

### Step 2: Create New Project

1. **Click** the project dropdown at the top (next to "Google Cloud")
2. **Click** "NEW PROJECT" button (top right of dropdown)
3. **Fill in project details:**
   - **Project name:** `Trading Alerts SaaS`
   - **Organization:** Leave as "No organization" (unless you have one)
   - **Location:** Leave as default
4. **Click** "CREATE"
5. **Wait** 10-15 seconds for project creation
6. **Select** your new project from the dropdown

**✅ Checkpoint:** You should see "Trading Alerts SaaS" in the top bar

---

## PART B: Enable Google+ API

### Step 3: Navigate to API Library

1. **Click** the hamburger menu (☰) in top-left
2. **Hover over** "APIs & Services"
3. **Click** "Library"

**Alternative path:** Dashboard → "Enable APIs and Services"

### Step 4: Search and Enable Google+ API

1. **Type** "Google+ API" in the search box
2. **Click** on "Google+ API" from results
3. **Click** the blue "ENABLE" button
4. **Wait** a few seconds for API to enable

**✅ Checkpoint:** You should see "API enabled" with a green checkmark

**Note:** Google+ API is being deprecated, but it's still required for OAuth user info. Google will migrate you automatically to newer APIs.

---

## PART C: Configure OAuth Consent Screen

### Step 5: Navigate to OAuth Consent Screen

1. **Click** hamburger menu (☰)
2. **Click** "APIs & Services"
3. **Click** "OAuth consent screen" (in left sidebar)

### Step 6: Choose User Type

**Question:** External or Internal?

**Answer:** Choose **"External"**

**Why?**

- **External:** Your app will be available to any Google account user (correct for public SaaS)
- **Internal:** Only available to Google Workspace organization users (not applicable for you)

**Click** "External" radio button, then **click** "CREATE"

### Step 7: Fill App Information (Page 1 of 4)

**OAuth consent screen → Edit app registration**

**Required fields:**

- **App name:** `Trading Alerts`
- **User support email:** `your-email@gmail.com` (select from dropdown)
- **App logo:** Skip for now (optional)
- **App domain** section:
  - **Application home page:** Leave blank for now
  - **Application privacy policy:** Leave blank for now
  - **Application terms of service:** Leave blank for now
- **Authorized domains:** Leave blank for now
- **Developer contact information:** `your-email@gmail.com`

**Click** "SAVE AND CONTINUE"

### Step 8: Scopes (Page 2 of 4)

**Click** "ADD OR REMOVE SCOPES"

**In the filter box, type:** `userinfo`

**Select these 2 scopes (check the boxes):**

1. ✅ `.../auth/userinfo.email` - See your primary Google Account email address
2. ✅ `.../auth/userinfo.profile` - See your personal info, including any personal info you've made publicly available

**Scroll down and click** "UPDATE"

**Click** "SAVE AND CONTINUE"

**✅ Checkpoint:** You should see 2 scopes listed

### Step 9: Test Users (Page 3 of 4)

**Add your email as a test user:**

1. **Click** "+ ADD USERS"
2. **Type** your Gmail address
3. **Click** "ADD"
4. **Click** "SAVE AND CONTINUE"

**Why?** While your app is in "Testing" mode, only test users can sign in with Google OAuth.

### Step 10: Summary (Page 4 of 4)

**Review** your settings, then **click** "BACK TO DASHBOARD"

**✅ Checkpoint:** OAuth consent screen configured. Status shows "Testing"

---

## PART D: Create OAuth 2.0 Client ID

### Step 11: Navigate to Credentials

1. **Click** "Credentials" in left sidebar (under OAuth consent screen)
2. **Click** "+ CREATE CREDENTIALS" at top
3. **Select** "OAuth client ID"

### Step 12: Configure Application Type

**Application type:** Select **"Web application"**

**Name:** `Trading Alerts Web Client`

### Step 13: Configure Authorized JavaScript Origins (Optional but Recommended)

**Click** "+ ADD URI" under "Authorized JavaScript origins"

**Add these 2 URIs:**

1. `http://localhost:3000`
2. `http://127.0.0.1:3000`

**Why?** This allows your local dev server to initiate OAuth flows.

**Note:** You can add production domain later after deployment

### Step 14: Configure Authorized Redirect URIs (CRITICAL)

**Click** "+ ADD URI" under "Authorized redirect URIs"

**Add these URIs EXACTLY (no trailing slash):**

1. `http://localhost:3000/api/auth/callback/google`
2. `http://127.0.0.1:3000/api/auth/callback/google`

**Important:**

- ✅ Correct: `http://localhost:3000/api/auth/callback/google`
- ❌ Wrong: `http://localhost:3000/api/auth/callback/google/` (trailing slash)
- ❌ Wrong: `http://localhost:3000/api/auth/callback` (missing /google)

**Note:** You'll add production URL later after deployment:

- `https://yourdomain.vercel.app/api/auth/callback/google`

**Click** "CREATE"

---

## PART E: Copy Your Credentials

### Step 15: Save Client ID and Client Secret

After clicking CREATE, you'll see a popup:

**"OAuth client created"**

📋 **Your Client ID**

```
123456789-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com
```

**Copy this** ← Click the copy icon

📋 **Your Client Secret**

```
GOCSPX-AbCdEfGhIjKlMnOpQrStUvWx
```

**Copy this** ← Click the copy icon

**Click** "OK"

**IMPORTANT:**

- These credentials are **permanent** (they don't change unless you delete them)
- You can always view them again by clicking on your OAuth client name
- Keep them **secret** (never commit to Git)

**✅ Checkpoint:** You now have Client ID and Client Secret copied

---

## PART F: Add Credentials to Your Project

### Step 16: Create .env.local File

**Open terminal in your project root:**

```bash
cd /path/to/trading-alerts-saas-v7
```

**Create .env.local file:**

```bash
# On Mac/Linux:
touch .env.local

# On Windows:
type nul > .env.local
```

### Step 17: Add Environment Variables

**Open .env.local in your code editor and paste:**

```bash
# ==============================================================================
# Google OAuth Configuration
# ==============================================================================
# Get from Google Cloud Console → Credentials → OAuth 2.0 Client IDs

GOOGLE_CLIENT_ID=paste_your_client_id_here
GOOGLE_CLIENT_SECRET=paste_your_client_secret_here

# ==============================================================================
# NextAuth.js Configuration
# ==============================================================================

# Local development URL
NEXTAUTH_URL=http://localhost:3000

# Generate a secret with: openssl rand -base64 32
# This should be different for dev and production
NEXTAUTH_SECRET=paste_generated_secret_here

# ==============================================================================
# Database Configuration
# ==============================================================================

# Your PostgreSQL connection string
DATABASE_URL=postgresql://username:password@localhost:5432/trading_alerts

# ==============================================================================
# Other Environment Variables (from .env.example)
# ==============================================================================

# Copy any other required variables from .env.example
```

### Step 18: Generate NEXTAUTH_SECRET

**Open terminal and run:**

```bash
openssl rand -base64 32
```

**Copy the output** (example: `8fj3K9d2mN4pL7qR5sT6uV8wX0yZ1aB2cD3eF4gH5iJ6`)

**Paste it** as the value for `NEXTAUTH_SECRET` in .env.local

### Step 19: Verify Your .env.local

**Your final .env.local should look like:**

```bash
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-YourSecretHere
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=8fj3K9d2mN4pL7qR5sT6uV8wX0yZ1aB2cD3eF4gH5iJ6
DATABASE_URL=postgresql://user:pass@localhost:5432/trading_alerts
```

**✅ Checkpoint:** .env.local created with all OAuth credentials

---

## PART G: Add Production Redirect URI (After Deployment)

### Step 20: Update OAuth Client After Production Deployment

**When you deploy to Vercel/production:**

1. **Go back to** Google Cloud Console → Credentials
2. **Click** on "Trading Alerts Web Client"
3. **Under "Authorized redirect URIs", click** "+ ADD URI"
4. **Add your production URL:**
   ```
   https://yourdomain.vercel.app/api/auth/callback/google
   ```
   Or if using custom domain:
   ```
   https://tradingalerts.com/api/auth/callback/google
   ```
5. **Click** "SAVE"

**Also add to Authorized JavaScript origins:**

```
https://yourdomain.vercel.app
```

**Update Vercel Environment Variables:**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add:
   - `GOOGLE_CLIENT_ID` = (same as dev)
   - `GOOGLE_CLIENT_SECRET` = (same as dev)
   - `NEXTAUTH_URL` = `https://yourdomain.vercel.app`
   - `NEXTAUTH_SECRET` = (generate NEW secret for production)

---

## PART H: Publish OAuth Consent Screen (Before Public Launch)

### Step 21: Submit for Verification (When Ready for Public)

**While in "Testing" status:**

- Only test users (emails you added) can sign in
- Good for development and internal testing

**To make public (production):**

1. **Go to** OAuth consent screen
2. **Click** "PUBLISH APP"
3. **Click** "CONFIRM"

**Note:** If you request sensitive or restricted scopes, Google may require verification. But `userinfo.email` and `userinfo.profile` are standard scopes that don't require verification.

**For now:** Keep it in "Testing" mode while developing.

---

## ✅ Setup Complete Checklist

- [x] Google Cloud project created: "Trading Alerts SaaS"
- [x] Google+ API enabled
- [x] OAuth consent screen configured (External, Testing mode)
- [x] Scopes added: userinfo.email, userinfo.profile
- [x] Test user added (your email)
- [x] OAuth 2.0 Client created: "Trading Alerts Web Client"
- [x] Redirect URIs added (localhost:3000)
- [x] Client ID and Secret copied
- [x] .env.local created with credentials
- [x] NEXTAUTH_SECRET generated
- [ ] Production redirect URI (add after deployment)
- [ ] Publish app (when ready for public)

---

## 🧪 Test OAuth Setup

### Step 22: Test Locally (After Aider Implements OAuth)

1. **Start dev server:**

   ```bash
   pnpm dev
   ```

2. **Visit:** http://localhost:3000/login

3. **Click** "Sign in with Google" button

4. **You should see:**
   - Google OAuth consent screen
   - "Trading Alerts wants to access your Google Account"
   - Your email listed
   - "Continue" button

5. **Click** "Continue"

6. **You should be:**
   - Redirected back to http://localhost:3000/dashboard
   - Logged in with your Google account
   - User created in database with FREE tier

**If you see an error:**

- Check redirect URI is exact: `/api/auth/callback/google`
- Verify .env.local has correct credentials
- Check your email is added as test user
- Review error message for specific issue

---

## 🔧 Troubleshooting

### Error: "redirect_uri_mismatch"

**Cause:** Redirect URI in Google Console doesn't match NextAuth callback URL

**Fix:**

1. Go to Google Console → Credentials → Your OAuth Client
2. Check "Authorized redirect URIs" section
3. Ensure EXACT match: `http://localhost:3000/api/auth/callback/google`
4. No trailing slash, correct path, correct port

### Error: "invalid_client"

**Cause:** GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is incorrect

**Fix:**

1. Go to Google Console → Credentials
2. Click on your OAuth client
3. Copy Client ID and Secret again
4. Update .env.local
5. Restart dev server

### Error: "Access blocked: This app's request is invalid"

**Cause:** OAuth consent screen not configured properly

**Fix:**

1. Ensure OAuth consent screen is published (or in Testing mode)
2. Verify your email is added as test user
3. Check scopes are added correctly

### Error: "User not created in database"

**Cause:** Database not running or schema not migrated

**Fix:**

1. Ensure PostgreSQL is running
2. Run migration: `npx prisma migrate dev`
3. Check DATABASE_URL in .env.local

---

## 📚 Additional Resources

- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## 🎯 Answers to Your Specific Questions

### Q1: Do I add BOTH URIs to the same OAuth client? Or separate clients?

**Answer:** ✅ **SAME OAuth client**

Add both development and production redirect URIs to the **single** OAuth client. This is simpler and recommended for small teams.

**Example:**

```
Authorized redirect URIs:
  http://localhost:3000/api/auth/callback/google  ← Dev
  http://127.0.0.1:3000/api/auth/callback/google  ← Dev (IPv4)
  https://yourdomain.vercel.app/api/auth/callback/google  ← Prod
```

### Q2: What should I put for "Authorized JavaScript origins"?

**Answer:** Add both dev and prod:

```
Authorized JavaScript origins:
  http://localhost:3000  ← Dev
  http://127.0.0.1:3000  ← Dev (IPv4)
  https://yourdomain.vercel.app  ← Prod (add after deployment)
```

**Why?** This allows your frontend to initiate OAuth flows from these domains.

### Q3: Exact format for redirect URIs? (no trailing slash, right?)

**Answer:** ✅ **Correct - NO trailing slash**

**✅ Correct format:**

```
http://localhost:3000/api/auth/callback/google
```

**❌ Incorrect (will fail):**

```
http://localhost:3000/api/auth/callback/google/  ← Trailing slash
http://localhost:3000/api/auth/callback          ← Missing /google
http://localhost:3000/callback/google            ← Missing /api/auth
```

**Must be EXACT match** - Google validates character-by-character.

---

**Setup complete!** 🎉

After Aider implements the OAuth system, you'll be able to test "Sign in with Google" on http://localhost:3000/login

**Next Step:** Wait for all documentation to be completed, then Aider will implement the OAuth system following all 12 approved decisions.

---

**Last Updated:** 2025-11-17
**Status:** ✅ Complete Setup Guide
**Estimated Setup Time:** 10-15 minutes

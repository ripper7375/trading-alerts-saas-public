# Google OAuth Error Fix Guide

**Error**: `redirect_uri_mismatch` (Error 400)
**Issue**: The redirect URI configured in Google Cloud Console doesn't match the one being used by the application
**Status**: 🔴 Blocking authentication

---

## 🔍 Problem Diagnosis

When users try to sign in with Google, they see:
```
การเข้าถึงถูกบล็อก: คำขอของแอปนี้ไม่ถูกต้อง
(Access blocked: This app's request is invalid)

Error code 400: redirect_uri_mismatch
```

This happens because:
1. **NextAuth.js** is sending a redirect URI like: `https://your-app.vercel.app/api/auth/callback/google`
2. **Google Cloud Console** doesn't have this URI in the authorized redirect URIs list
3. **Google blocks the request** for security reasons

---

## ✅ Solution: Update Google Cloud Console

### Step 1: Get Your Vercel Deployment URL

Find your current Vercel deployment URL:
- Go to your Vercel dashboard
- Find the project: `trading-alerts-frontend` (or your project name)
- Copy the production URL (e.g., `https://trading-alerts-frontend-xyz.vercel.app`)

### Step 2: Update Google Cloud Console

1. **Go to Google Cloud Console**:
   - Visit: https://console.cloud.google.com/apis/credentials
   - Sign in with your Google account

2. **Select Your Project**:
   - If you have multiple projects, select the correct one from the dropdown at the top

3. **Find Your OAuth 2.0 Client**:
   - Look for "OAuth 2.0 Client IDs" section
   - Click on your OAuth client (it should show your `GOOGLE_CLIENT_ID`)

4. **Add Authorized Redirect URIs**:

   Click "Edit" and add these URIs to the "Authorized redirect URIs" section:

   **For Local Development:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```

   **For Vercel Production:**
   ```
   https://your-actual-vercel-url.vercel.app/api/auth/callback/google
   ```

   **Example (replace with your actual URL):**
   ```
   https://trading-alerts-frontend-abc123.vercel.app/api/auth/callback/google
   ```

5. **Save Changes**:
   - Scroll down and click "Save"
   - Wait 5-10 seconds for changes to propagate

### Step 3: Update Authorized JavaScript Origins (Optional but Recommended)

Also add these to "Authorized JavaScript origins":

```
http://localhost:3000
https://your-actual-vercel-url.vercel.app
```

---

## 🔧 Required Environment Variables in Vercel

Make sure these are set in your Vercel project settings:

### Environment Variables (Vercel Dashboard → Settings → Environment Variables)

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# NextAuth Configuration
NEXTAUTH_SECRET=your_nextauth_secret_here
NEXTAUTH_URL=https://your-actual-vercel-url.vercel.app

# Database
DATABASE_URL=postgresql://postgres:password@host:5432/database
```

**⚠️ Important Notes:**
1. **NEXTAUTH_URL** must match your Vercel production URL exactly
2. **Don't include trailing slashes** (e.g., ~~`https://example.com/`~~  → `https://example.com`)
3. **Use HTTPS** in production (Vercel provides this automatically)

---

## 🧪 Testing the Fix

After updating Google Cloud Console and Vercel environment variables:

### Step 1: Trigger a New Deployment (if env vars changed)

If you changed environment variables in Vercel:
```bash
# Option A: Trigger redeploy via Vercel Dashboard
# Go to Deployments → Click "..." → Redeploy

# Option B: Push a small change to trigger deploy
git commit --allow-empty -m "chore: trigger redeploy for OAuth fix"
git push origin main
```

### Step 2: Test Google Sign-In

1. Go to your deployed site
2. Click "Sign in with Google"
3. You should now see the Google consent screen (not an error)
4. Select your Google account
5. Authorize the application
6. You should be redirected back to your dashboard

### Step 3: Verify User Creation

Check that the user was created in your database:
```sql
SELECT id, email, name, tier, role, "emailVerified", "createdAt"
FROM "User"
WHERE email = 'your-email@gmail.com';
```

Expected result:
- User exists in database
- `tier` = 'FREE'
- `role` = 'USER'
- `emailVerified` is set (auto-verified for OAuth)
- Profile picture URL in `image` field

---

## 🐛 Troubleshooting

### Issue: Still getting redirect_uri_mismatch after updating

**Possible causes:**
1. ✅ **Check exact URL match**: The redirect URI must match EXACTLY (including http/https, trailing slashes, etc.)
2. ✅ **Wait for propagation**: Google Cloud changes can take 5-10 minutes to propagate
3. ✅ **Clear browser cache**: Try in incognito/private browsing mode
4. ✅ **Check NEXTAUTH_URL**: Verify it matches your Vercel URL exactly
5. ✅ **Verify OAuth Client**: Make sure you're editing the correct OAuth client in Google Cloud Console

### Issue: Environment variables not updating

**Solution:**
```bash
# After changing env vars in Vercel, trigger a new deployment
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

### Issue: Google consent screen shows "This app isn't verified"

**This is normal for development**. Options:
1. **Click "Advanced" → "Go to [App Name] (unsafe)"** - Safe for your own testing
2. **Submit for OAuth verification** - Required for public apps (takes 1-2 weeks)

### Issue: Database connection error after OAuth

**Check:**
1. `DATABASE_URL` is set correctly in Vercel
2. Prisma client is generated (should happen during build)
3. Database is accessible from Vercel (check Railway/database provider firewall)

---

## 📋 Complete Redirect URI Checklist

Use this checklist to ensure all URIs are configured:

### Google Cloud Console (OAuth Client Settings)

**Authorized redirect URIs:**
- [ ] `http://localhost:3000/api/auth/callback/google` (for local dev)
- [ ] `https://YOUR-VERCEL-URL.vercel.app/api/auth/callback/google` (production)
- [ ] Any preview/staging URLs (optional)

**Authorized JavaScript origins:**
- [ ] `http://localhost:3000` (for local dev)
- [ ] `https://YOUR-VERCEL-URL.vercel.app` (production)

### Vercel Environment Variables

- [ ] `GOOGLE_CLIENT_ID` - From Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- [ ] `NEXTAUTH_SECRET` - Generated with `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` - Your Vercel production URL
- [ ] `DATABASE_URL` - PostgreSQL connection string

---

## 🎯 Expected Behavior After Fix

1. **User clicks "Sign in with Google"**
   → Redirects to Google consent screen (no error)

2. **User authorizes the app**
   → Redirects back to your app at `/dashboard` (or configured callback)

3. **User is created in database**
   - Email from Google account
   - Profile picture from Google
   - Tier: FREE
   - Role: USER
   - Email automatically verified

4. **User can access dashboard**
   → See their watchlist, alerts, etc.

---

## 📞 Need Help?

If you're still experiencing issues after following this guide:

1. **Check Vercel logs**: Vercel Dashboard → Project → View Function Logs
2. **Check browser console**: F12 → Console tab (look for errors)
3. **Verify NextAuth configuration**: Check `frontend/lib/auth/auth-options.ts`
4. **Test locally first**: Set up `.env.local` and test on `localhost:3000`

---

**Last Updated**: 2026-01-09
**Status**: Awaiting user configuration in Google Cloud Console

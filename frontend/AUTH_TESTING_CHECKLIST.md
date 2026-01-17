# Authentication Testing Checklist

**Date**: 2026-01-17
**Purpose**: Verify all authentication methods are working correctly on the deployed frontend
**Time Required**: 20-30 minutes

---

## Prerequisites

Before testing, ensure you have:

- [ ] Vercel deployment URL (e.g., `https://your-app.vercel.app`)
- [ ] Access to email account for verification testing
- [ ] Private/incognito browser window (for clean testing)
- [ ] COMPLETE_AUTH_FIX_GUIDE.md completed (if not, complete it first)

---

## Environment Variables Check

First, verify all required environment variables are set in Vercel:

### Required for ALL authentication:
- [ ] `NEXTAUTH_URL` - Must match your deployment URL exactly
- [ ] `NEXTAUTH_SECRET` - 32+ character secret
- [ ] `DATABASE_URL` - PostgreSQL connection string

### Required for Google OAuth:
- [ ] `GOOGLE_CLIENT_ID` - From Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` - From Google Cloud Console

### Required for Twitter OAuth:
- [ ] `TWITTER_CLIENT_ID` - From Twitter Developer Portal
- [ ] `TWITTER_CLIENT_SECRET` - From Twitter Developer Portal

### Required for LinkedIn OAuth (optional):
- [ ] `LINKEDIN_CLIENT_ID` - From LinkedIn Developer
- [ ] `LINKEDIN_CLIENT_SECRET` - From LinkedIn Developer

### Required for Email verification:
- [ ] `RESEND_API_KEY` - From Resend dashboard
- [ ] `RESEND_FROM_EMAIL` - Sender email address (optional, defaults to onboarding@resend.dev)

**To check**: Go to Vercel Dashboard → Your Project → Settings → Environment Variables

---

## Test 1: Homepage Access (2 minutes)

### Steps:
1. Open private/incognito browser window
2. Navigate to your deployment URL
3. Verify homepage loads correctly

### Expected Results:
- ✅ Page loads without errors
- ✅ "Sign In" or "Login" button visible
- ✅ "Sign Up" or "Register" button visible
- ✅ No console errors (press F12 → Console tab)

### If Failed:
- Check Vercel deployment status (should be "Ready")
- Check browser console for errors
- Verify NEXTAUTH_URL is set correctly

**Status**: [ ] PASS / [ ] FAIL

---

## Test 2: Google OAuth Login (5 minutes)

### Steps:
1. Click "Sign in with Google" button
2. Select your Google account
3. Grant permissions if requested
4. Wait for redirect back to your site

### Expected Results:
- ✅ Google consent screen appears (blue Google logo)
- ✅ NOT an error: "redirect_uri_mismatch"
- ✅ Successfully redirected to dashboard/homepage
- ✅ Logged in state (profile picture or name visible)
- ✅ Can access protected pages (e.g., /dashboard)

### If Failed:
| Error | Solution |
|-------|----------|
| "redirect_uri_mismatch" | Check Google Console redirect URIs match exactly |
| "This app isn't verified" | Click "Advanced" → "Go to [App] (unsafe)" |
| Infinite redirect loop | Check NEXTAUTH_URL matches deployment URL |
| "Invalid client" | Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET |

### Database Verification:
1. Go to your database (Railway, Supabase, etc.)
2. Check `User` table
3. Verify user created with:
   - ✅ `email` = your Google email
   - ✅ `emailVerified` = timestamp (not null)
   - ✅ `tier` = 'FREE'
   - ✅ `role` = 'USER'
   - ✅ `image` = Google profile picture URL

**Status**: [ ] PASS / [ ] FAIL

**User ID**: ________________

---

## Test 3: Twitter OAuth Login (5 minutes)

### Steps:
1. Logout from the site
2. Click "Sign in with Twitter" or "Sign in with X" button
3. Click "Authorize app" on Twitter
4. Wait for redirect back to your site

### Expected Results:
- ✅ Twitter authorization page appears
- ✅ NOT an error: "Something went wrong"
- ✅ Successfully redirected to dashboard/homepage
- ✅ Logged in state visible
- ✅ Can access protected pages

### If Failed:
| Error | Solution |
|-------|----------|
| "Something went wrong" | Check Twitter Developer Portal callback URLs |
| "Access denied" | Verify app is in "Production" environment |
| "Invalid client" | Verify TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET |
| "OAuth 2.0 is disabled" | Enable OAuth 2.0 in Twitter app settings |

### Database Verification:
1. Check `User` table
2. Verify user created with:
   - ✅ `email` = your Twitter email (or placeholder if no email)
   - ✅ `emailVerified` = timestamp
   - ✅ `tier` = 'FREE'
   - ✅ `role` = 'USER'
   - ✅ `image` = Twitter profile picture URL (if available)

**Status**: [ ] PASS / [ ] FAIL

**User ID**: ________________

---

## Test 4: Email Registration & Verification (10 minutes)

### Part A: Registration

#### Steps:
1. Logout from the site
2. Click "Sign Up" or "Register"
3. Fill in registration form:
   - Name: Test User
   - Email: your-real-email@example.com
   - Password: TestPass123!
   - Confirm Password: TestPass123!
4. Click "Sign Up" or "Register"

#### Expected Results:
- ✅ Form submits successfully
- ✅ Redirected to "Check your email" page
- ✅ Message shows: "Verification email sent to [your-email]"
- ✅ No error messages

#### If Failed:
| Error | Solution |
|-------|----------|
| "Email already exists" | Use different email or delete previous test user |
| "Failed to send email" | Check RESEND_API_KEY is set correctly |
| Validation errors | Check password meets requirements (8+ chars, number, etc.) |

**Registration Status**: [ ] PASS / [ ] FAIL

### Part B: Email Verification

#### Steps:
1. Check your email inbox (and spam folder!)
2. Open verification email from "Trading Alerts"
3. Click verification link
4. Wait for redirect back to your site

#### Expected Results:
- ✅ Verification email received within 2 minutes
- ✅ Email has "Verify your email" subject (or similar)
- ✅ Email contains clickable verification link
- ✅ Clicking link redirects to your site
- ✅ Success message: "Email verified successfully"
- ✅ Automatically logged in or redirected to login

#### If Failed:
| Error | Solution |
|-------|----------|
| No email received | Check Resend dashboard → Logs for errors |
| Email in spam | Mark as "Not Spam" and check RESEND_FROM_EMAIL |
| Link expired/invalid | Check link was clicked within expiration time |
| RESEND_API_KEY error | Verify API key is correct (starts with `re_`) |

**Verification Status**: [ ] PASS / [ ] FAIL

### Part C: Resend Verification Email

#### Steps:
1. Before clicking verification link, click "Resend verification email" button
2. Check email again

#### Expected Results:
- ✅ New verification email received
- ✅ No error message
- ✅ Both links work (original and resent)

**Resend Status**: [ ] PASS / [ ] FAIL

---

## Test 5: Email Login (3 minutes)

### Steps:
1. Logout from the site
2. Click "Login" or "Sign In"
3. Enter credentials:
   - Email: the email you registered with in Test 4
   - Password: TestPass123!
4. Click "Login"

### Expected Results:
- ✅ Successfully logged in
- ✅ Redirected to dashboard/homepage
- ✅ Can access protected pages
- ✅ Session persists (refresh page, still logged in)

### If Failed:
| Error | Solution |
|-------|----------|
| "Invalid credentials" | Verify email and password are correct |
| "Email not verified" | Complete Test 4 Part B first |
| "User not found" | Complete Test 4 Part A first |

**Status**: [ ] PASS / [ ] FAIL

---

## Test 6: Logout (2 minutes)

### Steps:
1. While logged in, click "Logout" or "Sign Out" button
2. Verify redirect to homepage or login page
3. Try accessing a protected page (e.g., /dashboard)

### Expected Results:
- ✅ Successfully logged out
- ✅ Session cleared (profile picture/name disappears)
- ✅ Protected pages redirect to login
- ✅ Refresh page, still logged out

**Status**: [ ] PASS / [ ] FAIL

---

## Test 7: Session Persistence (2 minutes)

### Steps:
1. Login with any method
2. Refresh the page (Ctrl+R or Cmd+R)
3. Close browser tab and reopen site
4. Wait 5 minutes and refresh

### Expected Results:
- ✅ Session persists after page refresh
- ✅ Session persists after closing/reopening tab
- ✅ Session persists after waiting (up to 30 days)
- ✅ Still logged in, can access protected pages

**Status**: [ ] PASS / [ ] FAIL

---

## Test 8: Profile Picture Display (2 minutes)

### Steps:
1. Login with Google OAuth
2. Check if profile picture displays

### Expected Results (Google OAuth):
- ✅ Google profile picture displays in header/navbar
- ✅ Image loads correctly (no broken image icon)

### Expected Results (Email/Password):
- ✅ Default avatar/initials display
- ✅ OR no picture (depending on implementation)

**Status**: [ ] PASS / [ ] FAIL

---

## Test 9: Browser Console Check (2 minutes)

### Steps:
1. With site open, press F12 (or Cmd+Opt+I on Mac)
2. Go to "Console" tab
3. Look for errors (red text)

### Expected Results:
- ✅ No NextAuth errors
- ✅ No "Failed to fetch" errors
- ✅ No "Unauthorized" errors
- ✅ No database connection errors

### Common Errors to Watch For:
| Error | Meaning |
|-------|---------|
| "NEXTAUTH_URL not set" | Environment variable missing |
| "Failed to sign in" | OAuth configuration issue |
| "Database connection failed" | DATABASE_URL incorrect |
| "CSRF token mismatch" | Cookie/session issue |

**Status**: [ ] PASS / [ ] FAIL

---

## Test 10: Vercel Function Logs Check (3 minutes)

### Steps:
1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on latest deployment
3. Go to "Functions" tab
4. Look for authentication-related logs

### Expected Results:
- ✅ See "[Auth] User created successfully" logs (for new users)
- ✅ See "[SignIn] Allowing sign-in" logs
- ✅ See "[JWT] Token populated from DB" logs
- ✅ No error logs

### Common Errors:
| Error Log | Meaning |
|-----------|---------|
| "GOOGLE_CLIENT_ID not configured" | Missing environment variable |
| "OAuth user has no email" | OAuth provider didn't return email |
| "Prevented OAuth account takeover" | Security check triggered |
| "Prisma error" | Database issue |

**Status**: [ ] PASS / [ ] FAIL

---

## Summary

### Overall Results:

| Test | Status | Notes |
|------|--------|-------|
| 1. Homepage Access | [ ] PASS / [ ] FAIL | |
| 2. Google OAuth Login | [ ] PASS / [ ] FAIL | |
| 3. Twitter OAuth Login | [ ] PASS / [ ] FAIL | |
| 4. Email Registration | [ ] PASS / [ ] FAIL | |
| 5. Email Login | [ ] PASS / [ ] FAIL | |
| 6. Logout | [ ] PASS / [ ] FAIL | |
| 7. Session Persistence | [ ] PASS / [ ] FAIL | |
| 8. Profile Picture | [ ] PASS / [ ] FAIL | |
| 9. Console Check | [ ] PASS / [ ] FAIL | |
| 10. Function Logs | [ ] PASS / [ ] FAIL | |

### Authentication Methods Working:
- [ ] ✅ Google OAuth
- [ ] ✅ Twitter OAuth
- [ ] ✅ LinkedIn OAuth (if configured)
- [ ] ✅ Email/Password

### Issues Found:
1. ________________________________________
2. ________________________________________
3. ________________________________________

### Next Steps:

**If ALL tests pass (10/10)**:
- ✅ Authentication is fully working!
- ✅ Mark "Test login and authentication" todo as completed
- ✅ Proceed to "Test dashboard and key pages"
- ✅ Continue with UI optimization (Option A)

**If ANY test fails**:
- ❌ Review COMPLETE_AUTH_FIX_GUIDE.md
- ❌ Fix the specific issue(s)
- ❌ Redeploy and re-test
- ❌ Document issues in CRITICAL_ISSUES_FOUND.md

---

## Quick Reference

### Environment Variables Summary:
```bash
# Core Auth (Required)
NEXTAUTH_URL=https://your-deployment-url.vercel.app
NEXTAUTH_SECRET=your_32_char_secret
DATABASE_URL=postgresql://...

# Google OAuth
GOOGLE_CLIENT_ID=123456-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123

# Twitter OAuth
TWITTER_CLIENT_ID=abc123xyz
TWITTER_CLIENT_SECRET=xyz789abc

# Email Service
RESEND_API_KEY=re_abc123xyz
RESEND_FROM_EMAIL=Trading Alerts <noreply@yourdomain.com>
```

### Common Commands:
```bash
# Check Vercel deployment status
vercel list

# View Vercel logs
vercel logs [deployment-url]

# Redeploy (if needed)
vercel --prod

# Check database users
# Run in your database console:
SELECT id, email, "emailVerified", tier, role FROM "User" ORDER BY "createdAt" DESC LIMIT 10;
```

---

**Testing completed by**: ________________

**Date**: 2026-01-17

**Overall Status**: [ ] ALL PASS (10/10) / [ ] PARTIAL (___/10) / [ ] FAILED (___/10)

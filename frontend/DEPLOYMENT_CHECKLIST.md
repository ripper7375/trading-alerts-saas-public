# 🚀 Interactive Vercel Deployment Checklist

**Status**: In Progress
**Started**: 2026-01-09
**Project**: Trading Alerts SaaS - Frontend (Modular)

---

## Pre-Deployment Checklist

### Step 1: Gather Your Environment Variables ✅

Before deploying, you'll need these values from your current setup:

#### ✅ **Required Variables** (Must Have)

```bash
# 1. Database URL (from Railway or your current hosting)
DATABASE_URL=postgresql://user:password@host:port/database

# 2. NextAuth Secret (copy from your current .env.local)
NEXTAUTH_SECRET=<your-current-secret>

# 3. NextAuth URL (will be your NEW Vercel deployment URL)
NEXTAUTH_URL=https://trading-alerts-frontend.vercel.app  # (You'll get this after creating project)
```

#### 🔧 **Optional Variables** (Add Later if Needed)

```bash
# Google OAuth (if using)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Stripe (if processing payments)
STRIPE_SECRET_KEY=<your-stripe-secret>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-stripe-public>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook>

# Email (if using Resend)
RESEND_API_KEY=<your-resend-key>

# Redis (if using caching)
REDIS_URL=<your-redis-url>
```

**Action Required**:
- [ ] Copy your current `DATABASE_URL` from Railway/hosting
- [ ] Copy your current `NEXTAUTH_SECRET` from .env.local
- [ ] Keep these ready for Step 4

---

## Deployment Steps

### Step 2: Create New Vercel Project via Dashboard 🌐

**Why Dashboard?** Easier for first-time setup, visual interface, fewer errors.

#### Instructions:

1. **Open Vercel Dashboard**
   - Go to: https://vercel.com/new
   - Sign in if needed

2. **Import Repository**
   - Click "Import Git Repository"
   - Search for: `ripper7375/trading-alerts-saas-public`
   - Click "Import"

3. **⚠️ CRITICAL: Use Different Project Name**
   - **Existing Project**: `trading-alerts-saas` (DON'T touch this!)
   - **New Project Name**: `trading-alerts-frontend` or `trading-alerts-v2`
   - This creates a SEPARATE deployment

4. **Configure Project**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: Type `frontend` ⬅️ **CRITICAL!**
   - **Build Command**: Leave default
   - **Output Directory**: Leave default (`.next`)
   - **Install Command**: Leave default or set to `pnpm install`

5. **DON'T Deploy Yet!**
   - Click "Environment Variables" instead
   - Proceed to Step 3

**Status**:
- [ ] Vercel project created
- [ ] Root directory set to `frontend`
- [ ] Project named differently from existing deployment

---

### Step 3: Add Environment Variables 🔐

In the Vercel project configuration page:

#### Required Variables (Add These Now):

1. **DATABASE_URL**
   - Key: `DATABASE_URL`
   - Value: (paste your DATABASE_URL from Step 1)
   - Environment: Production, Preview, Development (check all)

2. **NEXTAUTH_SECRET**
   - Key: `NEXTAUTH_SECRET`
   - Value: (paste your NEXTAUTH_SECRET from Step 1)
   - Environment: Production, Preview, Development (check all)

3. **NEXTAUTH_URL** (Temporary - we'll update after first deploy)
   - Key: `NEXTAUTH_URL`
   - Value: `https://your-project-name.vercel.app`
   - Environment: Production only
   - Note: Replace with actual URL after first deploy

4. **NEXT_PUBLIC_DEPLOYMENT_TYPE**
   - Key: `NEXT_PUBLIC_DEPLOYMENT_TYPE`
   - Value: `modular-frontend`
   - Environment: Production, Preview, Development (check all)

#### How to Add:
1. Click "Add" for each variable
2. Fill in Key and Value
3. Select environments (Production/Preview/Development)
4. Click "Add" to save

**Status**:
- [ ] DATABASE_URL added
- [ ] NEXTAUTH_SECRET added
- [ ] NEXTAUTH_URL added (temporary)
- [ ] NEXT_PUBLIC_DEPLOYMENT_TYPE added

---

### Step 4: First Deployment 🎬

1. **Click "Deploy"**
   - Vercel will now build and deploy your frontend
   - This takes 2-5 minutes

2. **Watch Build Log**
   - Monitor for errors
   - Look for "Build Completed" message

3. **Expected Build Output**:
   ```
   Route (app)                              Size     First Load JS
   ┌ ○ /                                    X kB          XX kB
   ├ ○ /(auth)/login                        X kB          XX kB
   ├ λ /(dashboard)/admin                   X kB          XX kB

   ○  (Static)
   λ  (Server)
   ```

4. **Get Deployment URL**
   - After successful build, you'll get a URL like:
   - `https://trading-alerts-frontend.vercel.app`
   - **Copy this URL!**

**Status**:
- [ ] Deployment started
- [ ] Build completed successfully
- [ ] Deployment URL obtained

---

### Step 5: Update NEXTAUTH_URL 🔄

Now that you have the actual deployment URL:

1. **Go to Vercel Dashboard**
   - Project → Settings → Environment Variables

2. **Find NEXTAUTH_URL**
   - Click the "..." menu
   - Click "Edit"

3. **Update Value**
   - Old: `https://your-project-name.vercel.app`
   - New: (your actual deployment URL from Step 4)
   - Example: `https://trading-alerts-frontend.vercel.app`

4. **Redeploy**
   - Go to Deployments tab
   - Click "Redeploy" on latest deployment
   - This triggers a new build with correct NEXTAUTH_URL

**Status**:
- [ ] NEXTAUTH_URL updated with real URL
- [ ] Redeployment triggered
- [ ] Redeployment completed

---

### Step 6: Verify Deployment ✅

**Test These Pages:**

1. **Homepage** (Marketing)
   - URL: `https://your-deployment.vercel.app`
   - [ ] Page loads
   - [ ] No console errors (F12)
   - [ ] Styling looks correct

2. **Pricing Page**
   - URL: `https://your-deployment.vercel.app/pricing`
   - [ ] Page loads
   - [ ] Pricing tiers display

3. **Login Page**
   - URL: `https://your-deployment.vercel.app/login`
   - [ ] Form renders
   - [ ] Can type in fields
   - [ ] Try logging in with test credentials

4. **Dashboard** (After Login)
   - URL: `https://your-deployment.vercel.app/dashboard`
   - [ ] Dashboard loads
   - [ ] Data displays
   - [ ] No errors in console

**Status**:
- [ ] All pages verified
- [ ] No critical errors
- [ ] Authentication working

---

### Step 7: Performance Check 📊

#### Run Lighthouse Audit:

1. **Open Chrome DevTools**
   - F12 or Right-click → Inspect
   - Go to "Lighthouse" tab

2. **Run Audit**
   - Device: Mobile
   - Categories: Performance, Accessibility, Best Practices
   - Click "Analyze page load"

3. **Check Scores**
   - [ ] Performance: >70 (target: >90 after optimizations)
   - [ ] Accessibility: >90
   - [ ] Best Practices: >90

**Current vs Target:**

| Metric | Current (Baseline) | Target (Optimized) |
|--------|-------------------|-------------------|
| Performance | ~45 | >90 |
| Time to Interactive | 8-12s | 1.5-2s |
| First Contentful Paint | 3-5s | 0.5-1s |

**Note**: We expect current performance to match the monolith. Improvements come after converting to Server Components (Step 8+).

**Status**:
- [ ] Lighthouse audit run
- [ ] Baseline metrics recorded
- [ ] No critical issues

---

## Post-Deployment

### Step 8: Compare with Monolith

**Old Deployment** (Keep Running):
- URL: (your current production URL)
- Type: Monolith (frontend + backend)
- Status: Production traffic

**New Deployment** (Testing):
- URL: `https://trading-alerts-frontend.vercel.app`
- Type: Frontend only (optimized)
- Status: Staging/testing

**Action**:
- [ ] Both deployments accessible
- [ ] New deployment works correctly
- [ ] Ready for optimization phase

---

## What's Next?

Now that deployment is successful:

1. **Phase 2: Optimize (Next Steps)**
   - Convert pages to Server Components
   - Implement tier-based loading
   - Reduce bundle size by 75-80%

2. **Phase 3: Traffic Migration**
   - Gradual rollout: 10% → 50% → 100%
   - Monitor metrics
   - Full cutover

---

## Troubleshooting

### Build Fails: "Module not found"
```bash
# Check if all dependencies in package.json
# May need to add missing packages
```

### Error: "Prisma Client not generated"
```bash
# Check package.json has:
# "postinstall": "prisma generate"
```

### Login Not Working
```bash
# Check NEXTAUTH_URL matches deployment URL
# Check NEXTAUTH_SECRET is correct
# Check DATABASE_URL is accessible
```

---

## Support Contacts

- **Vercel Docs**: https://vercel.com/docs
- **Deployment Guide**: `frontend/DEPLOYMENT.md`
- **Conversion Guide**: `frontend/CONVERSION_GUIDE.md`

---

**Last Updated**: 2026-01-09
**Deployment Status**: 🟡 In Progress

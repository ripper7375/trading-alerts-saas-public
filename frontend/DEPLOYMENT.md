# Vercel Deployment Instructions

## ⚠️ CRITICAL: Fresh Deployment Required

This frontend MUST be deployed as a **NEW/FRESH** Vercel project, completely separate from any existing deployment.

## Why a Fresh Deployment?

1. **Zero Risk**: Existing monolith remains functional
2. **A/B Testing**: Compare performance between old and new
3. **Rollback Ready**: Old deployment still live if issues arise
4. **Gradual Migration**: Switch traffic only when ready

---

## Deployment Steps

### Step 1: Create New Vercel Project

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Import your GitHub repository: `ripper7375/trading-alerts-saas-public`
3. **IMPORTANT**: Give it a DIFFERENT name than existing project
   - Existing: `trading-alerts-saas`
   - New: `trading-alerts-frontend` or `trading-alerts-v2`
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: Leave default (auto-detected)
   - **Output Directory**: Leave default (`.next`)
   - **Install Command**: `pnpm install`
5. Click "Deploy" (will fail first time - need environment variables)

#### Option B: Via Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Navigate to frontend directory
cd frontend

# Login to Vercel
vercel login

# Deploy (will prompt for project name)
vercel

# When prompted:
# - Link to existing project? NO
# - Project name: trading-alerts-frontend
# - Continue? YES
```

---

### Step 2: Configure Environment Variables

In the NEW Vercel project settings, add these environment variables:

#### Required Variables

```bash
# Database - Same as monolith (for now)
DATABASE_URL=postgresql://user:password@host:port/database

# Auth - Same secrets as monolith (session compatibility)
NEXTAUTH_SECRET=<copy-from-monolith>
NEXTAUTH_URL=https://your-new-deployment-url.vercel.app

# Backend API - Will be Railway URL after Step 5
# For now, use the monolith API
NEXT_PUBLIC_API_URL=https://your-monolith-url.vercel.app
```

#### Optional Variables

```bash
# Feature Flags
NEXT_PUBLIC_USE_MODULAR_BACKEND=false  # Enable after Step 5
NEXT_PUBLIC_DEPLOYMENT_TYPE=modular-frontend

# Email (if using Resend)
RESEND_API_KEY=<your-resend-key>

# Stripe (if processing payments)
STRIPE_SECRET_KEY=<your-stripe-secret>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<your-stripe-public-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>

# Redis (if using caching)
REDIS_URL=<your-redis-url>

# Monitoring (optional)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=<auto-provided-by-vercel>
```

---

### Step 3: Configure Deployment Settings

In Vercel project settings:

#### General Settings
- **Root Directory**: `frontend`
- **Framework**: Next.js
- **Node Version**: 20.x

#### Build & Development Settings
- **Build Command**: `pnpm run build` (or leave default)
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`

#### Git Settings
- **Production Branch**: `main` (or your default branch)
- **Preview Deployments**: Enable for `claude/*` branches
- **Auto-deploy**: Enable

---

### Step 4: Deploy

#### First Deployment

```bash
# From frontend/ directory
vercel --prod

# Or from Vercel Dashboard
# Click "Deploy" after configuring environment variables
```

#### Subsequent Deployments

```bash
# Development/Preview
git push  # Auto-deploys preview for feature branches

# Production
git push origin main  # Auto-deploys to production
```

---

### Step 5: Verify Deployment

After deployment completes:

#### Check Build Output

Look for these indicators of successful optimization:

```
Route (app)                              Size     First Load JS
┌ ○ /                                    X kB          XX kB
├ ○ /(auth)/login                        X kB          XX kB
├ λ /(dashboard)/admin                   X kB          XX kB
├ λ /(dashboard)/dashboard               X kB          XX kB
├ ○ /(marketing)/pricing                 X kB          XX kB

○  (Static)  automatically rendered as static
λ  (Server)  server-side renders at runtime
```

**Expected:**
- Most routes should be ○ (Static) or λ (Server)
- Minimal ● (Client) routes
- Total bundle size < 200MB (down from ~380MB)

#### Test Key Pages

Visit and test:

1. **Marketing Pages**
   - [ ] Homepage loads quickly
   - [ ] Pricing page renders correctly

2. **Auth Pages**
   - [ ] Login works
   - [ ] Registration works
   - [ ] Session persists

3. **Dashboard**
   - [ ] Dashboard loads
   - [ ] Data displays correctly
   - [ ] No console errors

4. **Admin (if applicable)**
   - [ ] Admin dashboard accessible
   - [ ] Metrics load correctly

#### Performance Check

Run Lighthouse audit:

```bash
# Via Chrome DevTools
# 1. Open deployed URL
# 2. F12 → Lighthouse tab
# 3. Run audit

# Target scores:
# Performance: >90
# Accessibility: >95
# Best Practices: >90
# SEO: >90
```

---

## Deployment Architecture

### Current State (During Transition)

```
┌──────────────────────────────────────────────┐
│          OLD MONOLITH (Keep Running)         │
│  Domain: trading-alerts.vercel.app           │
│  Type: Full Next.js (frontend + backend)     │
│  Traffic: 100% (for now)                     │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│         NEW FRONTEND (Testing Phase)         │
│  Domain: trading-alerts-v2.vercel.app        │
│  Type: Frontend only (optimized)             │
│  Backend: Points to old monolith API         │
│  Traffic: 0% (staging/testing)               │
└──────────────────────────────────────────────┘
```

### After Step 5 (Complete Migration)

```
┌──────────────────────────────────────────────┐
│         FRONTEND (Vercel)                    │
│  Domain: trading-alerts.com                  │
│  Type: Next.js frontend only                 │
│  Bundle: ~50KB (optimized)                   │
└──────────────────────────────────────────────┘
                    ↓
                   API
                    ↓
┌──────────────────────────────────────────────┐
│         BACKEND (Railway)                    │
│  Domain: api.trading-alerts.com              │
│  Type: NestJS API                            │
│  Database: PostgreSQL                        │
└──────────────────────────────────────────────┘
```

---

## Rollback Plan

If issues arise after deployment:

### Option 1: DNS Rollback (Instant)

```bash
# Change DNS back to old deployment
# No code changes needed
# Takes effect in ~5 minutes
```

### Option 2: Environment Variable Switch

```bash
# In Vercel dashboard:
# Set: NEXT_PUBLIC_USE_OLD_API=true
# Redeploys automatically
```

### Option 3: Delete New Deployment

```bash
# In Vercel dashboard:
# Settings → Delete Project
# Old deployment remains untouched
```

---

## Gradual Traffic Migration

Once validated, gradually shift traffic:

### Week 1: 10% Traffic
- Use Vercel Edge Config for A/B testing
- Monitor error rates
- Check performance metrics

### Week 2: 50% Traffic
- If metrics good, increase to 50%
- Continue monitoring

### Week 3: 100% Traffic
- Full cutover to new deployment
- Keep old deployment for 1 week as backup
- Then deprecate

---

## Monitoring

### Key Metrics to Watch

1. **Performance**
   - Time to First Byte (TTFB)
   - First Contentful Paint (FCP)
   - Time to Interactive (TTI)
   - Cumulative Layout Shift (CLS)

2. **Errors**
   - 4xx errors (client errors)
   - 5xx errors (server errors)
   - Console errors

3. **Usage**
   - Active users
   - Pageviews
   - Conversion rates

### Vercel Analytics

Built-in metrics available at:
- https://vercel.com/your-project/analytics

### External Monitoring (Recommended)

- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **Mixpanel**: User analytics

---

## Troubleshooting

### Build Fails: "Module not found"

```bash
# Check package.json dependencies
# Ensure all required packages listed

# Fix: Add missing package
pnpm add <package-name>
```

### Runtime Error: "Prisma Client not generated"

```bash
# Add to package.json scripts:
"postinstall": "prisma generate"

# Or set in Vercel build settings:
# Build Command: pnpm run build
# Will automatically run postinstall
```

### Error: "NEXTAUTH_URL missing"

```bash
# Add to Vercel environment variables:
NEXTAUTH_URL=https://your-deployment-url.vercel.app
```

### Slow Build Times

```bash
# Enable Vercel build cache
# Settings → Build & Development → Build Cache: ON

# Or use Turbopack (experimental):
# next.config.js:
# experimental: { turbo: true }
```

---

## Next Steps

After successful deployment:

1. ✅ Verify all pages load correctly
2. ✅ Test auth flow (login/register)
3. ✅ Check performance metrics
4. ⏳ Begin page conversions (Client → Server Components)
5. ⏳ Implement tier-based loading
6. ⏳ Deploy NestJS backend to Railway (Step 5)
7. ⏳ Switch `NEXT_PUBLIC_API_URL` to Railway
8. ⏳ Gradual traffic migration

---

## Support

For issues:
1. Check Vercel deployment logs
2. Review `frontend/CONVERSION_GUIDE.md`
3. Check main migration docs
4. File GitHub issue with `deployment` label

---

**Last Updated**: 2026-01-09
**Status**: Ready for deployment
**Next**: Deploy to fresh Vercel project

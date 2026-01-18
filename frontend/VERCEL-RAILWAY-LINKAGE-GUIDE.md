# 🔗 Vercel ↔️ Railway Linkage Guide

**How NEXT_PUBLIC_API_URL Connects Your Frontend to Backend**

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    STEP 4 (Current - Monolith)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Vercel (Frontend)                  Next.js API Routes              │
│  ├─ trading-alerts-saas-frontend   ├─ /api/alerts                  │
│  ├─ All UI pages                   ├─ /api/auth/*                  │
│  └─ Client Components              ├─ /api/subscription            │
│                                    └─ /api/indicators              │
│       │                                     ▲                       │
│       │  API Calls to /api/*                │                       │
│       └─────────────────────────────────────┘                       │
│                                                                     │
│  NEXT_PUBLIC_API_URL = not set (defaults to "/api")               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                              ⬇️ MIGRATION ⬇️

┌─────────────────────────────────────────────────────────────────────┐
│              STEP 5+ (After Migration - Modular)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Vercel (Frontend)                  Railway (Backend)               │
│  ├─ trading-alerts-saas-frontend   ├─ Nest.js API                  │
│  ├─ All UI pages                   ├─ /api/alerts                  │
│  └─ Client Components              ├─ /api/auth/*                  │
│                                    ├─ /api/subscription            │
│       │                            └─ /api/indicators              │
│       │                                     ▲                       │
│       │  API Calls to Railway URL           │                       │
│       └─────────────────────────────────────┘                       │
│                                                                     │
│  NEXT_PUBLIC_API_URL = "https://your-api.railway.app"             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 How the API Client Works

### The Magic of `NEXT_PUBLIC_API_URL`

Your `frontend/lib/api-client.ts` automatically switches between Next.js and Nest.js:

```typescript
// frontend/lib/api-client.ts (line 56)
export class ApiClient {
  private baseURL: string;

  constructor(config?: ApiClientConfig) {
    // 🔥 THIS IS THE KEY LINE:
    this.baseURL = config?.baseURL ||
                   process.env['NEXT_PUBLIC_API_URL'] ||
                   '/api';

    // If NEXT_PUBLIC_API_URL is not set → uses '/api' (Next.js routes)
    // If NEXT_PUBLIC_API_URL is set → uses Railway URL (Nest.js API)
  }

  async get<T>(endpoint: string): Promise<T> {
    // Combines baseURL + endpoint
    const url = `${this.baseURL}${endpoint}`;
    // Example:
    // Step 4: '/api' + '/alerts' = '/api/alerts' (Next.js)
    // Step 5: 'https://api.railway.app' + '/alerts' = 'https://api.railway.app/alerts' (Nest.js)

    const response = await fetch(url);
    return response.json();
  }
}

// Single instance used throughout app
export const apiClient = new ApiClient();
```

---

## 🚀 Step-by-Step Migration Process

### **Step 4 (Current) - Vercel Deployment Settings**

**Vercel Environment Variables:**
```bash
# No NEXT_PUBLIC_API_URL needed
# Frontend uses local /api routes

NEXTAUTH_URL=https://trading-alerts-saas-frontend.vercel.app
NEXTAUTH_SECRET=your-secret-here
DATABASE_URL=your-postgres-connection-string
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

**How API calls work:**
```javascript
// In any component:
import { apiClient } from '@/lib/api-client';

// This calls /api/alerts (Next.js route in same deployment)
const alerts = await apiClient.get('/alerts');
```

---

### **Step 5 (After Nest.js Deployment) - Railway + Vercel**

#### 1️⃣ Deploy Nest.js to Railway

**Railway Project Setup:**
```bash
# 1. Create new Railway project
railway login
railway init

# 2. Deploy Nest.js backend
cd backend  # Your Nest.js directory
railway up

# 3. Railway gives you a URL:
# https://trading-alerts-backend-production.up.railway.app
```

**Railway Environment Variables:**
```bash
# Backend environment on Railway:
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-jwt-secret
NEXTAUTH_SECRET=same-as-vercel  # Must match!
PORT=3001
```

#### 2️⃣ Update Vercel Environment Variables

**Add this ONE variable to Vercel:**
```bash
# Go to: Vercel Dashboard → Project Settings → Environment Variables
# Add:

NEXT_PUBLIC_API_URL=https://trading-alerts-backend-production.up.railway.app
```

**Full Vercel Environment Variables (Step 5):**
```bash
# ✅ NEW - Points to Railway backend
NEXT_PUBLIC_API_URL=https://trading-alerts-backend-production.up.railway.app

# Existing variables (keep these)
NEXTAUTH_URL=https://trading-alerts-saas-frontend.vercel.app
NEXTAUTH_SECRET=your-secret-here
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# ❌ REMOVE - No longer needed on frontend
# DATABASE_URL=...  (now only on Railway)
# REDIS_URL=...     (now only on Railway)
```

#### 3️⃣ Redeploy Frontend

```bash
# In Vercel Dashboard:
# 1. Go to Deployments tab
# 2. Click "Redeploy" on latest deployment
# OR just push to GitHub - Vercel auto-deploys

# The redeploy picks up new NEXT_PUBLIC_API_URL
```

---

## 🔄 What Happens After Redeployment?

### Before (Step 4):
```javascript
// Component makes API call
const alerts = await apiClient.get('/alerts');

// apiClient.baseURL = '/api'
// Full URL: https://trading-alerts-saas-frontend.vercel.app/api/alerts
// Handled by: app/api/alerts/route.ts (Next.js route in Vercel)
```

### After (Step 5):
```javascript
// SAME component code (no changes!)
const alerts = await apiClient.get('/alerts');

// apiClient.baseURL = 'https://trading-alerts-backend-production.up.railway.app'
// Full URL: https://trading-alerts-backend-production.up.railway.app/alerts
// Handled by: alerts.controller.ts (Nest.js on Railway)
```

**✨ Zero Code Changes Required!**

---

## 🎯 Detailed Vercel ↔️ Railway Connection Flow

### Request Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER VISITS WEBSITE                                              │
│    https://trading-alerts-saas-frontend.vercel.app                  │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. VERCEL SERVES HTML/JS                                            │
│    - Next.js renders page                                           │
│    - Sends to browser with embedded JS                              │
│    - JS includes api-client.ts with NEXT_PUBLIC_API_URL baked in    │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. BROWSER LOADS PAGE                                               │
│    - User sees UI                                                   │
│    - React components mount                                         │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. COMPONENT MAKES API CALL                                         │
│    const alerts = await apiClient.get('/alerts')                    │
│                                                                     │
│    api-client.ts reads NEXT_PUBLIC_API_URL at BUILD TIME:           │
│    baseURL = 'https://trading-alerts-backend-production.railway.app'│
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. BROWSER MAKES FETCH REQUEST                                      │
│    fetch('https://trading-alerts-backend-production.railway.app/alerts', {
│      headers: {                                                     │
│        'Content-Type': 'application/json',                          │
│        'Cookie': 'session-token=...'  // NextAuth session           │
│      },                                                             │
│      credentials: 'include'  // Sends cookies cross-origin          │
│    })                                                               │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. RAILWAY RECEIVES REQUEST                                         │
│    - Nest.js running on Railway                                     │
│    - CORS configured to allow Vercel domain                         │
│    - Validates session token                                        │
│    - Queries PostgreSQL on Railway                                  │
│    - Returns JSON response                                          │
└────────────────────────────────────┬────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. BROWSER RECEIVES RESPONSE                                        │
│    { alerts: [...] }                                                │
│    - React component updates state                                  │
│    - UI re-renders with data                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Flow (Vercel + Railway)

### How NextAuth Works Across Deployments

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER LOGS IN                                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 1. User submits credentials at:                                     │
│    https://trading-alerts-saas-frontend.vercel.app/login           │
│                                                                     │
│ 2. NextAuth (on Vercel) handles authentication                      │
│    - Verifies credentials                                           │
│    - Creates session in PostgreSQL (DATABASE_URL on Vercel)         │
│    - Sets cookie: next-auth.session-token                           │
│    - Cookie domain: .vercel.app                                     │
│                                                                     │
│ 3. User redirected to dashboard                                     │
│    - Cookie stored in browser                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ API REQUEST WITH SESSION                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ 1. Component makes authenticated request:                           │
│    const alerts = await apiClient.get('/alerts')                    │
│                                                                     │
│ 2. Browser includes cookie in request to Railway:                   │
│    Cookie: next-auth.session-token=eyJhbGc...                       │
│                                                                     │
│ 3. Railway backend validates session:                               │
│    - Option A: Query PostgreSQL session table (shared DB)           │
│    - Option B: Verify JWT token (if using JWT strategy)            │
│                                                                     │
│ 4. Railway returns data if session valid                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Important**: Both Vercel and Railway must:
- ✅ Share same `NEXTAUTH_SECRET`
- ✅ Use same PostgreSQL database (or sync sessions)
- ✅ Have CORS configured properly

---

## ⚙️ CORS Configuration (Critical!)

When frontend (Vercel) calls backend (Railway), you MUST configure CORS on Railway:

```typescript
// backend/src/main.ts (Nest.js on Railway)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔥 CORS Configuration - REQUIRED for Vercel → Railway
  app.enableCors({
    origin: [
      'https://trading-alerts-saas-frontend.vercel.app',  // Production
      'https://trading-alerts-saas-frontend-*.vercel.app', // Preview deployments
      'http://localhost:3000',                             // Local development
    ],
    credentials: true,  // Allow cookies (for NextAuth sessions)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  await app.listen(process.env.PORT || 3001);
}
bootstrap();
```

**Without CORS**: Browser will block requests from Vercel to Railway with error:
```
❌ Access to fetch at 'https://api.railway.app/alerts' from origin
'https://frontend.vercel.app' has been blocked by CORS policy
```

---

## 📝 Complete Migration Checklist

### ✅ Pre-Migration (Step 4)
- [x] Frontend deployed to Vercel
- [x] Using Next.js API routes (`/api`)
- [x] API client configured with default `'/api'`
- [x] All features working on Vercel

### 🚧 During Migration (Step 5)

#### Railway Backend Setup
- [ ] 1. Create Nest.js backend project
- [ ] 2. Deploy to Railway: `railway up`
- [ ] 3. Note Railway URL: `https://your-app.railway.app`
- [ ] 4. Configure Railway environment variables:
  ```bash
  DATABASE_URL=postgresql://...
  REDIS_URL=redis://...
  JWT_SECRET=your-secret
  NEXTAUTH_SECRET=same-as-vercel  # CRITICAL!
  PORT=3001
  ```
- [ ] 5. Configure CORS to allow Vercel origin
- [ ] 6. Test Railway API directly: `curl https://your-app.railway.app/health`

#### Vercel Frontend Update
- [ ] 7. Go to Vercel → Project Settings → Environment Variables
- [ ] 8. Add: `NEXT_PUBLIC_API_URL=https://your-app.railway.app`
- [ ] 9. Remove backend-only variables:
  - `DATABASE_URL` (moved to Railway)
  - `REDIS_URL` (moved to Railway)
  - Any API keys now on backend
- [ ] 10. Keep frontend variables:
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET` (must match Railway!)
  - `NEXT_PUBLIC_*` variables
- [ ] 11. Redeploy on Vercel

#### Testing
- [ ] 12. Test API calls work: Check browser DevTools Network tab
- [ ] 13. Verify CORS working: No CORS errors in console
- [ ] 14. Test authentication: Login and make authenticated requests
- [ ] 15. Test all critical user flows

### ✅ Post-Migration
- [ ] Monitor Railway logs for errors
- [ ] Monitor Vercel logs for frontend errors
- [ ] Update documentation with new architecture
- [ ] Remove old Next.js API routes from frontend repo

---

## 🧪 Testing the Connection

### 1. Verify Environment Variable is Set

**Check in Vercel Dashboard:**
```
Vercel → Project → Settings → Environment Variables
Look for: NEXT_PUBLIC_API_URL = https://your-app.railway.app
```

### 2. Check Build Logs

**During Vercel deployment:**
```
Building...
ℹ Using NEXT_PUBLIC_API_URL: https://trading-alerts-backend-production.railway.app
```

### 3. Test in Browser DevTools

**Open your deployed Vercel site → DevTools → Console:**
```javascript
// Check what URL the API client is using
console.log('API Base URL:', apiClient.getBaseURL());
// Should log: https://trading-alerts-backend-production.railway.app

// Check if external API
console.log('Is External:', apiClient.isExternalAPI());
// Should log: true
```

### 4. Monitor Network Requests

**DevTools → Network Tab:**
```
Look for requests to:
✅ https://trading-alerts-backend-production.railway.app/alerts
✅ Status: 200
✅ Response: JSON data

NOT:
❌ https://trading-alerts-saas-frontend.vercel.app/api/alerts
```

---

## 🔍 Troubleshooting Common Issues

### Issue 1: API calls still going to `/api` instead of Railway

**Cause**: Environment variable not set or deployment not redeployed

**Fix**:
```bash
# 1. Verify variable in Vercel Dashboard
# 2. Trigger new deployment (push to GitHub or click Redeploy)
# 3. Check build logs confirm NEXT_PUBLIC_API_URL is read
```

### Issue 2: CORS errors in browser console

**Error**: `Access to fetch has been blocked by CORS policy`

**Fix**:
```typescript
// backend/src/main.ts - Update CORS origin
app.enableCors({
  origin: 'https://trading-alerts-saas-frontend.vercel.app',
  credentials: true,
});
```

### Issue 3: Authentication not working (401 Unauthorized)

**Cause**: Sessions not shared between Vercel and Railway

**Fix**:
```bash
# Ensure NEXTAUTH_SECRET matches on both:
# Vercel:  NEXTAUTH_SECRET=abc123
# Railway: NEXTAUTH_SECRET=abc123

# If using database sessions, ensure both use same DATABASE_URL
```

### Issue 4: Railway backend not responding

**Check**:
```bash
# 1. Railway service running?
railway status

# 2. Check Railway logs
railway logs

# 3. Test directly
curl https://your-app.railway.app/health
```

---

## 💰 Cost Considerations

### Vercel (Frontend)
- **Free Tier**: 100GB bandwidth/month
- **Pro**: $20/month - 1TB bandwidth
- **Best for**: Static frontend, serverless functions

### Railway (Backend)
- **Free Trial**: $5 credit
- **Pay-as-you-go**: ~$5-20/month for small API
- **Best for**: Long-running Node.js/Nest.js apps, WebSockets

**Total Cost**: ~$5-20/month for both services

---

## 🎯 Summary

**The entire migration is controlled by ONE environment variable:**

```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

**When you set this in Vercel:**
1. ✅ All API calls automatically route to Railway
2. ✅ No code changes needed in components
3. ✅ Frontend and backend can scale independently
4. ✅ Can rollback by removing the variable

**Zero downtime migration:**
1. Deploy Nest.js to Railway (backend ready)
2. Add `NEXT_PUBLIC_API_URL` to Vercel (switch traffic)
3. Done! 🎉

---

**Last Updated**: 2026-01-17
**Status**: Ready for Step 5 Migration
**Next**: Deploy Nest.js backend to Railway

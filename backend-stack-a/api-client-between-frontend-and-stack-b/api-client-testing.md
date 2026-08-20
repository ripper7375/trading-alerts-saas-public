# API Client Testing Guide - Localhost

> ⚠️ **HISTORICAL / SUPERSEDED (2026-08-20, Phase 7):** This document describes the legacy Stack A/Stack B API client architecture, which was retired in Phase 7 (Session 7-3). See `docs/architecture/api-client-architecture.md` for the modern generated OpenAPI client system.

This guide provides step-by-step instructions to test the API Client (`lib/api/index.ts`) on your local development environment.

---

## 📋 Prerequisites

Before testing, ensure you have:

- ✅ Node.js installed (v18 or higher recommended)
- ✅ npm or pnpm installed
- ✅ PostgreSQL database running (local or Railway)
- ✅ All dependencies installed

---

## 🚀 Step 1: Environment Setup

### 1.1 Create Environment File

```bash
# Copy the example environment file
cp .env.example .env.local
```

### 1.2 Configure Required Variables

Edit `.env.local` and set these **minimum required** variables for API testing:

```bash
# Database (Required)
DATABASE_URL=postgresql://username:password@localhost:5432/trading_alerts

# NextAuth (Required for authenticated endpoints)
NEXTAUTH_SECRET=your-secret-here-generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# Optional: Google OAuth (if testing auth)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Generate secrets:**

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32
```

---

## 🗄️ Step 2: Database Setup

### 2.1 Setup Prisma and Database

```bash
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# (Optional) Seed database with test data
npx prisma db seed
```

### 2.2 Verify Database Connection

```bash
# Open Prisma Studio to view/edit data
npx prisma studio
```

This will open `http://localhost:5555` where you can view your database tables.

---

## 🏃 Step 3: Start Development Server

```bash
# Start Next.js development server
npm run dev

# Alternative: if using pnpm
pnpm dev
```

The server will start at `http://localhost:3000`

**Expected output:**

```
▲ Next.js 15.5.9
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 2.3s
```

---

## 🧪 Step 4: Testing Methods

You have **5 different methods** to test the API Client:

### Method 1: Browser DevTools Console ⭐ (Quickest)

1. Open `http://localhost:3000` in your browser
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to the **Console** tab
4. Import and test the API client:

```javascript
// Import the API client
const { api } = await import('/lib/api/index.ts');

// Test Stack A endpoint (should work)
const alerts = await api.stackA.getAlerts();
console.log('Alerts:', alerts);

// Test Stack B endpoint (will throw 404 - expected)
try {
  const leaderboard = await api.stackB.getLeaderBoard('H4');
  console.log('Leaderboard:', leaderboard);
} catch (error) {
  console.log('Expected 404 error:', error.message);
}
```

---

### Method 2: Create a Test Page

#### 2.1 Create Test Page Component

Create `app/test-api/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function TestAPIPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testEndpoint = async (
    testName: string,
    apiCall: () => Promise<any>
  ) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log(`Testing: ${testName}`);
      const data = await apiCall();
      setResult({ testName, data, status: 'success' });
      console.log(`✅ ${testName} succeeded:`, data);
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      setError(`❌ ${testName} failed: ${errorMsg}`);
      console.error(`❌ ${testName} failed:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>API Client Test Page</h1>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Stack A Endpoints (Should Work)</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            onClick={() => testEndpoint('Get Alerts', () => api.stackA.getAlerts())}
            disabled={loading}
          >
            GET /api/alerts
          </button>
          <button
            onClick={() =>
              testEndpoint('Get Watchlist', () => api.stackA.getWatchlist())
            }
            disabled={loading}
          >
            GET /api/watchlist
          </button>
          <button
            onClick={() =>
              testEndpoint('Get Chart Data', () =>
                api.stackA.getChartData('XAUUSD')
              )
            }
            disabled={loading}
          >
            GET /api/candles/XAUUSD
          </button>
          <button
            onClick={() => testEndpoint('Get User', () => api.stackA.getUser())}
            disabled={loading}
          >
            GET /api/user/profile
          </button>
          <button
            onClick={() =>
              testEndpoint('Get Subscription', () => api.stackA.getSubscription())
            }
            disabled={loading}
          >
            GET /api/subscription
          </button>
          <button
            onClick={() =>
              testEndpoint('Get Notifications', () =>
                api.stackA.getNotifications()
              )
            }
            disabled={loading}
          >
            GET /api/notifications
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Stack B Endpoints (Will Return 404 - Expected)</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            onClick={() =>
              testEndpoint('Get Leaderboard', () =>
                api.stackB.getLeaderBoard('H4')
              )
            }
            disabled={loading}
          >
            GET /api/leaderboard/H4
          </button>
          <button
            onClick={() =>
              testEndpoint('Get Market Data', () =>
                api.stackB.getMarketData('XAUUSD')
              )
            }
            disabled={loading}
          >
            GET /api/market-data/XAUUSD
          </button>
          <button
            onClick={() =>
              testEndpoint('Get Surveillance', () => api.stackB.getSurveillance())
            }
            disabled={loading}
          >
            GET /api/surveillance
          </button>
        </div>
      </div>

      <div>
        <h2>Results:</h2>
        {loading && <p>⏳ Loading...</p>}
        {error && (
          <pre style={{ background: '#fee', padding: '1rem', color: 'red' }}>
            {error}
          </pre>
        )}
        {result && (
          <pre style={{ background: '#efe', padding: '1rem' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
```

#### 2.2 Access Test Page

Open `http://localhost:3000/test-api` and click buttons to test endpoints.

---

### Method 3: Using Example Hooks

The codebase includes example hooks in `frontend/hooks/use-api-client-example.ts`.

#### 3.1 Create Demo Page Using Hooks

Create `app/demo/page.tsx`:

```typescript
'use client';

import {
  useAlerts,
  useWatchlist,
  useChartData,
} from '@/frontend/hooks/use-api-client-example';

export default function DemoPage() {
  const { alerts, isLoading: alertsLoading } = useAlerts();
  const { watchlist, isLoading: watchlistLoading } = useWatchlist();
  const { candles, isLoading: chartLoading } = useChartData('XAUUSD');

  return (
    <div style={{ padding: '2rem' }}>
      <h1>API Client Demo - Using Hooks</h1>

      <section>
        <h2>Alerts</h2>
        {alertsLoading ? (
          <p>Loading...</p>
        ) : (
          <pre>{JSON.stringify(alerts, null, 2)}</pre>
        )}
      </section>

      <section>
        <h2>Watchlist</h2>
        {watchlistLoading ? (
          <p>Loading...</p>
        ) : (
          <pre>{JSON.stringify(watchlist, null, 2)}</pre>
        )}
      </section>

      <section>
        <h2>Chart Data (XAUUSD)</h2>
        {chartLoading ? (
          <p>Loading...</p>
        ) : (
          <pre>{JSON.stringify(candles, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
```

#### 3.2 Access Demo Page

Open `http://localhost:3000/demo`

---

### Method 4: Using Jest Tests

#### 4.1 Run Specific Test File

```bash
# Run Stack A client tests
npm test -- __tests__/lib/api/stack-a-client.test.ts

# Run Stack B client tests
npm test -- __tests__/lib/api/stack-b-client.test.ts

# Run integration workflow tests
npm test -- __tests__/integration/api-client-workflow.test.ts

# Run all API client tests
npm test -- __tests__/lib/api/
```

#### 4.2 Run Tests in Watch Mode

```bash
npm run test:watch -- __tests__/lib/api/stack-a-client.test.ts
```

This will re-run tests automatically when you save changes.

---

### Method 5: Using cURL or Postman

#### 5.1 Test with cURL

```bash
# Test GET /api/alerts
curl http://localhost:3000/api/alerts

# Test GET /api/watchlist
curl http://localhost:3000/api/watchlist

# Test GET /api/candles/XAUUSD
curl http://localhost:3000/api/candles/XAUUSD

# Test POST /api/alerts (create new alert)
curl -X POST http://localhost:3000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{"symbol":"XAUUSD","condition":"above","value":2000,"enabled":true}'

# Test Stack B endpoint (will return 404)
curl http://localhost:3000/api/leaderboard/H4
```

#### 5.2 Test with Postman

If you have Postman collections:

```bash
# Run Postman collection
npm run test:api
```

---

## 📊 Step 5: Understanding Test Results

### ✅ Stack A Endpoints - Expected Behavior

Stack A endpoints (Parts 1-19) are **currently deployed** and should work:

| Endpoint                    | Expected Response                       |
| --------------------------- | --------------------------------------- |
| `GET /api/alerts`           | 200 OK - Array of alerts                |
| `GET /api/watchlist`        | 200 OK - Array of symbols               |
| `GET /api/candles/XAUUSD`   | 200 OK - Candle data                    |
| `GET /api/user/profile`     | 200 OK - User object (if authenticated) |
| `GET /api/subscription`     | 200 OK - Subscription object            |
| `GET /api/notifications`    | 200 OK - Array of notifications         |
| `GET /api/admin/analytics`  | 200 OK - Analytics data (if admin)      |
| `GET /api/invoices`         | 200 OK - Billing history                |
| `GET /api/user/preferences` | 200 OK - User settings                  |

**If you see 401 Unauthorized:**

- The endpoint requires authentication
- Sign in first at `http://localhost:3000/sign-in`

**If you see 404 Not Found:**

- The API route doesn't exist yet
- Check if the route file exists in `app/api/`

**If you see 500 Internal Server Error:**

- Check database connection
- Check server logs in terminal
- Check database has required tables

---

### ⚠️ Stack B Endpoints - Expected Behavior

Stack B endpoints (Parts 20-26) are **NOT deployed yet** and should return 404:

| Endpoint                      | Expected Response |
| ----------------------------- | ----------------- |
| `GET /api/leaderboard/H4`     | 404 Not Found     |
| `GET /api/market-data/XAUUSD` | 404 Not Found     |
| `GET /api/confluence/XAUUSD`  | 404 Not Found     |
| `GET /api/surveillance`       | 404 Not Found     |
| `GET /api/queue/status`       | 404 Not Found     |

**This is CORRECT behavior!** Stack B features are for future deployment.

---

## 🐛 Step 6: Debugging Common Issues

### Issue 1: "Cannot find module '@/lib/api'"

**Solution:**

```bash
# Verify the file exists
ls -la lib/api/index.ts

# Check tsconfig.json has path alias
cat tsconfig.json | grep -A 3 "paths"

# Restart dev server
# Press Ctrl+C and run: npm run dev
```

---

### Issue 2: "Database connection error"

**Solution:**

```bash
# Check DATABASE_URL in .env.local
cat .env.local | grep DATABASE_URL

# Test database connection
npx prisma db push

# View database in browser
npx prisma studio
```

---

### Issue 3: "401 Unauthorized"

**Solution:**

The endpoint requires authentication. Two options:

**Option A: Sign in via UI**

1. Go to `http://localhost:3000/sign-in`
2. Sign in with Google or email
3. Try API request again

**Option B: Test without auth**

Modify the API route to temporarily skip auth:

```typescript
// app/api/alerts/route.ts
export async function GET(req: NextRequest) {
  // Comment out auth check temporarily
  // const session = await getServerSession();
  // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const alerts = await prisma.alert.findMany();
  return NextResponse.json(alerts);
}
```

---

### Issue 4: "Fetch failed" or Network Error

**Possible causes:**

1. **Dev server not running**

   ```bash
   # Make sure server is running
   npm run dev
   ```

2. **Wrong port**
   - Check if server is on `http://localhost:3000`
   - Check terminal output for actual port

3. **CORS issues**
   - Only occurs if testing from different origin
   - Use same origin (localhost:3000)

---

## 📈 Step 7: Monitor API Requests

### Method 1: Browser Network Tab

1. Open DevTools (F12)
2. Go to **Network** tab
3. Filter by **Fetch/XHR**
4. Make API requests
5. Click on requests to see:
   - Request headers
   - Request payload
   - Response headers
   - Response body
   - Status code
   - Timing

### Method 2: Server Logs

Watch terminal where `npm run dev` is running:

```
GET /api/alerts 200 in 45ms
POST /api/alerts 201 in 102ms
GET /api/leaderboard/H4 404 in 12ms
```

### Method 3: Add Console Logs

Edit `lib/api/index.ts` to add debug logs:

```typescript
async function apiCall(endpoint: string, options: RequestInit = {}) {
  console.log('🔵 API Call:', endpoint, options.method || 'GET');

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  console.log('🟢 API Response:', endpoint, response.status);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    console.error('🔴 API Error:', endpoint, error);
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  const data = await response.json();
  console.log('📦 API Data:', endpoint, data);
  return data;
}
```

---

## ✅ Step 8: Verification Checklist

Test the following to ensure API Client is working correctly:

### Stack A Tests (Should Pass ✅)

- [ ] `api.stackA.getAlerts()` returns array
- [ ] `api.stackA.getWatchlist()` returns array
- [ ] `api.stackA.getChartData('XAUUSD')` returns candle data
- [ ] `api.stackA.getUser()` returns user object (if authenticated)
- [ ] `api.stackA.getSubscription()` returns subscription
- [ ] `api.stackA.getNotifications()` returns notifications
- [ ] `api.stackA.createAlert(data)` creates new alert
- [ ] `api.stackA.updateAlert(id, data)` updates alert
- [ ] `api.stackA.deleteAlert(id)` deletes alert

### Stack B Tests (Should Fail with 404 ⚠️)

- [ ] `api.stackB.getLeaderBoard('H4')` throws 404 error
- [ ] `api.stackB.getMarketData('XAUUSD')` throws 404 error
- [ ] `api.stackB.getConfluenceScores('XAUUSD')` throws 404 error
- [ ] `api.stackB.getSurveillance()` throws 404 error

### Type Safety Tests

- [ ] TypeScript auto-completion works in IDE
- [ ] No `any` types in API client
- [ ] All parameters have proper types
- [ ] Return types are inferred correctly

---

## 🎯 Quick Test Script

Copy and paste this into your browser console at `http://localhost:3000`:

```javascript
// Quick API Client Test Script
(async () => {
  const { api } = await import('/lib/api/index.ts');

  console.log('🧪 Testing API Client...\n');

  // Test Stack A
  console.log('📊 Testing Stack A (Should Work):');
  try {
    const alerts = await api.stackA.getAlerts();
    console.log('✅ GET /api/alerts:', alerts);
  } catch (err) {
    console.error('❌ GET /api/alerts:', err.message);
  }

  try {
    const watchlist = await api.stackA.getWatchlist();
    console.log('✅ GET /api/watchlist:', watchlist);
  } catch (err) {
    console.error('❌ GET /api/watchlist:', err.message);
  }

  try {
    const candles = await api.stackA.getChartData('XAUUSD');
    console.log('✅ GET /api/candles/XAUUSD:', candles);
  } catch (err) {
    console.error('❌ GET /api/candles/XAUUSD:', err.message);
  }

  // Test Stack B
  console.log('\n📊 Testing Stack B (Should Return 404):');
  try {
    const leaderboard = await api.stackB.getLeaderBoard('H4');
    console.log('⚠️ Unexpected success:', leaderboard);
  } catch (err) {
    console.log('✅ Expected 404:', err.message);
  }

  console.log('\n✅ API Client test complete!');
})();
```

---

## 📝 Summary

You now have **5 methods** to test the API Client:

1. **Browser Console** - Fastest for quick tests
2. **Test Page** - Interactive UI testing
3. **Example Hooks** - Real-world component testing
4. **Jest Tests** - Automated unit/integration testing
5. **cURL/Postman** - Direct HTTP testing

**Expected Results:**

- ✅ Stack A endpoints work (200 OK)
- ⚠️ Stack B endpoints return 404 (expected, not deployed yet)
- ✅ TypeScript types work correctly
- ✅ No ESLint errors

---

## 🆘 Need Help?

If you encounter issues not covered in this guide:

1. Check terminal logs where `npm run dev` is running
2. Check browser DevTools Console for errors
3. Verify `.env.local` has correct DATABASE_URL
4. Verify database is running and accessible
5. Run `npx prisma studio` to check database content

---

**Happy Testing! 🚀**

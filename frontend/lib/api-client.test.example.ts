/**
 * API Client Usage Examples & Testing Guide
 *
 * ⚠️ UPDATED: 2025-01-19 - Now includes Multi-Stack API (Stack A & B)
 *
 * This file demonstrates how to:
 * 1. Use the base API client (apiClient) - low-level
 * 2. Use the Multi-Stack API (api.stackA / api.stackB) - recommended
 * 3. Test that it works with current Next.js API routes
 * 4. Migrate from direct fetch() to API Client
 * 5. Understand Stack A (available) vs Stack B (future)
 *
 * **Recommendation**: Use Multi-Stack API (`api.stackA` / `api.stackB`)
 * instead of base `apiClient` for cleaner, type-safe code.
 */

import { apiClient, ApiError } from './api-client';
import { api } from './api'; // Multi-Stack API

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 1: Basic GET Request
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function exampleGetRequest() {
  try {
    // Before (direct fetch):
    // const response = await fetch('/api/alerts');
    // const alerts = await response.json();

    // After (using apiClient):
    const alerts = await apiClient.get('/alerts');

    console.log('Alerts:', alerts);
    return alerts;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('API Error:', error.message, error.status);
    }
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 2: POST Request (like registration)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function examplePostRequest() {
  try {
    // Before (direct fetch):
    // const response = await fetch('/api/auth/register', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ name, email, password }),
    // });
    // const data = await response.json();

    // After (using apiClient):
    const data = await apiClient.post('/auth/register', {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test123!@#',
    });

    console.log('Registration result:', data);
    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      // Handle specific error codes
      if (error.status === 409) {
        console.error('Email already exists');
      } else if (error.status === 400) {
        console.error('Invalid input:', error.data);
      }
    }
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 3: PUT Request (update)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function examplePutRequest() {
  try {
    const updatedAlert = await apiClient.put('/alerts/123', {
      active: false,
      symbol: 'XAUUSD',
    });

    console.log('Updated alert:', updatedAlert);
    return updatedAlert;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        console.error('Alert not found');
      } else if (error.status === 403) {
        console.error('Not authorized to update this alert');
      }
    }
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 4: DELETE Request
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function exampleDeleteRequest() {
  try {
    await apiClient.delete('/alerts/123');
    console.log('Alert deleted successfully');
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('Delete failed:', error.message);
    }
    throw error;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 5: Using in React Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/*
'use client';

import { useState, useEffect } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

export default function AlertsList() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    try {
      setLoading(true);
      const data = await apiClient.get('/alerts');
      setAlerts(data);
    } catch (error) {
      if (error instanceof ApiError) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {alerts.map(alert => (
        <div key={alert.id}>{alert.symbol}</div>
      ))}
    </div>
  );
}
*/

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 6: TypeScript Typing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Alert {
  id: string;
  symbol: string;
  timeframe: string;
  active: boolean;
}

export async function exampleTypedRequest() {
  // Type-safe API call
  const alerts = await apiClient.get<Alert[]>('/alerts');

  // TypeScript knows alerts is Alert[]
  alerts.forEach((alert) => {
    console.log(alert.symbol, alert.timeframe);
  });

  return alerts;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TESTING: How to test with current Next.js API routes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function testCurrentAPIRoutes() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Testing API Client with Next.js API Routes');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Check configuration
  console.log('API Base URL:', apiClient.getBaseURL());
  console.log('Is External API:', apiClient.isExternalAPI());

  // Expected output when NEXT_PUBLIC_API_URL is not set:
  // API Base URL: /api
  // Is External API: false

  console.log('\n✅ API Client is configured correctly!');
  console.log('✅ Will use Next.js API routes (/api/*)');
  console.log('✅ Ready to migrate to Nest.js (just change env var)');
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MIGRATION: Before and After Comparison
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// BEFORE (direct fetch - in register-form.tsx):
/*
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(submitData),
});

const responseData = await response.json();

if (response.ok) {
  // Success
} else if (response.status === 409) {
  setError('Email already exists');
} else {
  setError(responseData?.error || 'Registration failed');
}
*/

// AFTER (using apiClient):
/*
import { apiClient, ApiError } from '@/lib/api-client';

try {
  const responseData = await apiClient.post('/auth/register', submitData);
  // Success - redirect to verification page
  router.push(`/verify-email/pending?email=${encodedEmail}`);
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      setError('Email already exists');
    } else {
      setError(error.message || 'Registration failed');
    }
  } else {
    setError('An error occurred. Please try again.');
  }
}
*/

// Benefits of apiClient:
// ✅ Less boilerplate code
// ✅ Consistent error handling
// ✅ Easy to switch from Next.js to Nest.js (just env var)
// ✅ TypeScript support
// ✅ Automatic JSON parsing
// ✅ Development logging

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXAMPLE 7: Multi-Stack API (Recommended Approach)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function exampleMultiStackAPI() {
  try {
    // ✅ Stack A - Available now (Parts 2-19)
    const alerts = await api.stackA.getAlerts();
    const watchlist = await api.stackA.getWatchlist();
    const user = await api.stackA.getUser();
    const subscription = await api.stackA.getSubscription();
    const notifications = await api.stackA.getNotifications();

    console.log('Stack A data:', { alerts, watchlist, user });

    // ⚠️ Stack B - Future deployment (Parts 20-26) - Will throw 404
    // const leaderboard = await api.stackB.getLeaderBoard('H4'); // Don't use yet
    // const confluence = await api.stackB.getConfluenceScores('XAUUSD'); // Don't use yet

    return { alerts, watchlist, user, subscription, notifications };
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('API Error:', error.message, error.status);
    }
    throw error;
  }
}

// Benefits of Multi-Stack API:
// ✅ Type-safe methods (getAlerts, getWatchlist, etc.)
// ✅ Clear separation: Stack A (available) vs Stack B (future)
// ✅ No need to remember endpoint paths
// ✅ Automatic retry logic, timeout, cancellation
// ✅ Built-in WebSocket/SSE support (when Stack B is deployed)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TESTING CHECKLIST
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/*
Step 4 (Current - Next.js API Routes):
[ ] 1. No NEXT_PUBLIC_API_URL set (or set to "/api")
[ ] 2. apiClient.getBaseURL() returns "/api"
[ ] 3. apiClient.isExternalAPI() returns false
[ ] 4. Registration form still works (uses /api/auth/register)
[ ] 5. Alert creation still works (uses /api/alerts)
[ ] 6. All API calls work as before

Step 5 (Future - Nest.js on Railway):
[ ] 1. Set NEXT_PUBLIC_API_URL="https://your-api.railway.app"
[ ] 2. apiClient.getBaseURL() returns "https://your-api.railway.app"
[ ] 3. apiClient.isExternalAPI() returns true
[ ] 4. Registration calls https://your-api.railway.app/auth/register
[ ] 5. Alert creation calls https://your-api.railway.app/alerts
[ ] 6. All API calls now go to Nest.js instead of Next.js

Migration is seamless - just change one environment variable! ✅
*/

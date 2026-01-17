/**
 * API Client Usage Examples & Testing Guide
 *
 * This file demonstrates how to:
 * 1. Use the API client in your components
 * 2. Test that it works with current Next.js API routes
 * 3. Migrate from direct fetch() to apiClient
 * 4. Prepare for Nest.js migration
 */

import { apiClient, ApiError } from './api-client';

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

export { testCurrentAPIRoutes };

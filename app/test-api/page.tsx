'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface TestResult {
  testName: string;
  data: unknown;
  status: 'success';
}

export default function TestAPIPage() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testEndpoint = async (
    testName: string,
    apiCall: () => Promise<unknown>
  ) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log(`Testing: ${testName}`);
      const data = await apiCall();
      setResult({ testName, data, status: 'success' });
      console.log(`✅ ${testName} succeeded:`, data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
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
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            GET /api/alerts
          </button>
          <button
            onClick={() => testEndpoint('Get Chart Data', () => api.stackA.getChartData('XAUUSD'))}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            GET /api/candles/XAUUSD
          </button>
          <button
            onClick={() => testEndpoint('Get User', () => api.stackA.getUser())}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            GET /api/user/profile
          </button>
          <button
            onClick={() => testEndpoint('Get Subscription', () => api.stackA.getSubscription())}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            GET /api/subscription
          </button>
          <button
            onClick={() => testEndpoint('Get Notifications', () => api.stackA.getNotifications())}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            GET /api/notifications
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Stack B Endpoints (Will Return 404 - Expected)</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            onClick={() => testEndpoint('Get Leaderboard', () => api.stackB.getLeaderBoard('H4'))}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            GET /api/leaderboard/H4
          </button>
          <button
            onClick={() => testEndpoint('Get Market Data', () => api.stackB.getMarketData('XAUUSD'))}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            GET /api/market-data/XAUUSD
          </button>
          <button
            onClick={() => testEndpoint('Get Surveillance', () => api.stackB.getSurveillance())}
            disabled={loading}
            style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
          >
            GET /api/surveillance
          </button>
        </div>
      </div>

      <div>
        <h2>Results:</h2>
        {loading && <p>⏳ Loading...</p>}
        {error && (
          <pre style={{ background: '#fee', padding: '1rem', color: 'red', borderRadius: '4px' }}>
            {error}
          </pre>
        )}
        {result && (
          <pre style={{ background: '#efe', padding: '1rem', borderRadius: '4px' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
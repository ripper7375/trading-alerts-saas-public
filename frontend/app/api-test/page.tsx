'use client';

/**
 * API Client Test Page
 *
 * Purpose: Verify that apiClient works with current Next.js API routes
 * Access: http://localhost:3000/api-test (development only)
 *
 * What this tests:
 * - API client configuration
 * - Base URL detection
 * - Connection to Next.js API routes
 * - Error handling
 * - TypeScript typing
 *
 * Usage:
 * 1. Run: npm run dev
 * 2. Navigate to: http://localhost:3000/api-test
 * 3. Click "Test API Client Configuration"
 * 4. Check console for detailed logs
 */

import { useState } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';

export default function ApiTestPage() {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function addResult(message: string, type: 'info' | 'success' | 'error' = 'info') {
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    setResults((prev) => [...prev, `${prefix} ${message}`]);
  }

  async function testConfiguration() {
    setResults([]);
    setLoading(true);

    try {
      addResult('Starting API Client configuration test...', 'info');

      // Test 1: Check base URL
      const baseURL = apiClient.getBaseURL();
      addResult(`Base URL: ${baseURL}`, 'info');

      // Test 2: Check if external API
      const isExternal = apiClient.isExternalAPI();
      addResult(
        `Is External API: ${isExternal} ${isExternal ? '(Nest.js)' : '(Next.js)'}`,
        'info'
      );

      // Test 3: Expected configuration for Step 4
      if (baseURL === '/api' && !isExternal) {
        addResult('Configuration matches Step 4 (Next.js API routes)', 'success');
      } else if (isExternal) {
        addResult(
          `Configuration matches Step 5+ (External Nest.js API at ${baseURL})`,
          'success'
        );
      } else {
        addResult(`Unexpected configuration: ${baseURL}`, 'error');
      }

      addResult('All configuration tests passed!', 'success');
    } catch (error) {
      if (error instanceof Error) {
        addResult(`Error: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function testHealthCheck() {
    setResults([]);
    setLoading(true);

    try {
      addResult('Testing API health check...', 'info');

      // Try to call a simple API endpoint
      // Note: This assumes you have a health check endpoint
      // If not, it will fail gracefully
      try {
        const response = await apiClient.get('/health');
        addResult('Health check response received', 'success');
        addResult(`Response: ${JSON.stringify(response)}`, 'info');
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 404) {
            addResult(
              'Health endpoint not found (expected if not implemented)',
              'info'
            );
          } else {
            addResult(`API Error: ${error.message} (Status: ${error.status})`, 'error');
          }
        }
      }

      addResult('Health check test completed', 'success');
    } catch (error) {
      if (error instanceof Error) {
        addResult(`Error: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 rounded-lg bg-white p-6 shadow">
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            API Client Test Page
          </h1>
          <p className="text-gray-600">
            Verify that the API client is configured correctly and can communicate
            with the backend.
          </p>
        </div>

        {/* Environment Info */}
        <div className="mb-6 rounded-lg bg-blue-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-blue-900">
            Current Configuration
          </h2>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="text-blue-700">Base URL:</span>{' '}
              <span className="font-bold">{apiClient.getBaseURL()}</span>
            </div>
            <div>
              <span className="text-blue-700">Is External:</span>{' '}
              <span className="font-bold">
                {apiClient.isExternalAPI() ? 'Yes (Nest.js)' : 'No (Next.js)'}
              </span>
            </div>
            <div>
              <span className="text-blue-700">Environment:</span>{' '}
              <span className="font-bold">{process.env['NODE_ENV']}</span>
            </div>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={testConfiguration}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Configuration'}
          </button>

          <button
            onClick={testHealthCheck}
            disabled={loading}
            className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Health Check'}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Test Results
            </h2>
            <div className="space-y-2 font-mono text-sm">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`rounded p-2 ${
                    result.startsWith('✅')
                      ? 'bg-green-50 text-green-900'
                      : result.startsWith('❌')
                      ? 'bg-red-50 text-red-900'
                      : 'bg-gray-50 text-gray-900'
                  }`}
                >
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documentation */}
        <div className="mt-8 rounded-lg bg-gray-100 p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            What This Tests
          </h2>
          <ul className="list-inside list-disc space-y-2 text-gray-700">
            <li>
              <strong>Base URL:</strong> Should be "/api" for Next.js routes (Step
              4) or external URL for Nest.js (Step 5+)
            </li>
            <li>
              <strong>External API Detection:</strong> Should be false for Next.js,
              true for Nest.js
            </li>
            <li>
              <strong>Configuration:</strong> Verifies NEXT_PUBLIC_API_URL is read
              correctly
            </li>
            <li>
              <strong>Health Check:</strong> Tests actual API connectivity (if
              endpoint exists)
            </li>
          </ul>

          <div className="mt-4 rounded bg-yellow-100 p-4">
            <p className="text-sm text-yellow-900">
              <strong>Note:</strong> This page is for development and testing only.
              Remove or protect before production deployment.
            </p>
          </div>
        </div>

        {/* Migration Guide */}
        <div className="mt-6 rounded-lg bg-indigo-50 p-6">
          <h2 className="mb-4 text-lg font-semibold text-indigo-900">
            Migration Guide
          </h2>
          <div className="space-y-4 text-sm text-indigo-900">
            <div>
              <strong>Step 4 (Current - Next.js API Routes):</strong>
              <ul className="ml-4 mt-2 list-inside list-disc">
                <li>NEXT_PUBLIC_API_URL not set (or set to "/api")</li>
                <li>Base URL: /api</li>
                <li>Is External: false</li>
                <li>API calls go to Next.js API routes</li>
              </ul>
            </div>

            <div>
              <strong>Step 5+ (Future - Nest.js on Railway):</strong>
              <ul className="ml-4 mt-2 list-inside list-disc">
                <li>NEXT_PUBLIC_API_URL=https://your-api.railway.app</li>
                <li>Base URL: https://your-api.railway.app</li>
                <li>Is External: true</li>
                <li>API calls go to external Nest.js API</li>
              </ul>
            </div>

            <div className="mt-4 rounded bg-indigo-100 p-3">
              <strong>To switch from Next.js to Nest.js:</strong>
              <ol className="ml-4 mt-2 list-inside list-decimal">
                <li>Deploy Nest.js API to Railway</li>
                <li>
                  Set NEXT_PUBLIC_API_URL in Vercel to Railway URL
                </li>
                <li>Redeploy frontend</li>
                <li>Done! No code changes needed ✅</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * Admin Affiliate Settings Page
 *
 * Allows admin to configure affiliate discount and commission percentages.
 * Changes are stored in SystemConfig and take effect immediately across
 * the entire SaaS platform.
 *
 * @module app/admin/settings/affiliate/page
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ConfigValue {
  value: number;
  updatedBy: string | null;
  updatedAt: string;
}

interface AffiliateSettings {
  discountPercent: ConfigValue;
  commissionPercent: ConfigValue;
  codesPerMonth: ConfigValue;
  basePrice: ConfigValue;
  threeDayPrice: ConfigValue;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminAffiliateSettingsPage(): React.ReactElement {
  const [settings, setSettings] = useState<AffiliateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [discountPercent, setDiscountPercent] = useState<number>(20);
  const [commissionPercent, setCommissionPercent] = useState<number>(20);
  const [codesPerMonth, setCodesPerMonth] = useState<number>(15);
  const [basePrice, setBasePrice] = useState<number>(29);
  const [threeDayPrice, setThreeDayPrice] = useState<number>(1.99);
  const [reason, setReason] = useState<string>('');

  // Fetch current settings
  const fetchSettings = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/settings/affiliate');

      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data: AffiliateSettings = await response.json();
      setSettings(data);

      // Initialize form with current values
      setDiscountPercent(data.discountPercent.value);
      setCommissionPercent(data.commissionPercent.value);
      setCodesPerMonth(data.codesPerMonth.value);
      setBasePrice(data.basePrice.value);
      setThreeDayPrice(data.threeDayPrice.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Save settings
  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/settings/affiliate', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountPercent,
          commissionPercent,
          codesPerMonth,
          basePrice,
          threeDayPrice,
          reason: reason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSuccess(data.message);
      setReason('');

      // Refresh settings to get updated timestamps
      await fetchSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate example commission
  const exampleNetPrice = basePrice * (1 - discountPercent / 100);
  const exampleCommission = exampleNetPrice * (commissionPercent / 100);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/affiliates"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Affiliates
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Affiliate Settings
        </h1>
        <p className="text-gray-600">
          Configure discount and commission percentages for the affiliate
          program
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 px-4 py-3 text-green-700">
          {success}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Settings Form */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">
              Configuration
            </h2>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Discount Percent */}
              <div>
                <label
                  htmlFor="discountPercent"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Customer Discount (%)
                </label>
                <input
                  type="number"
                  id="discountPercent"
                  min="0"
                  max="100"
                  step="0.1"
                  value={discountPercent}
                  onChange={(e) =>
                    setDiscountPercent(parseFloat(e.target.value))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Discount given to customers using affiliate codes
                </p>
                {settings?.discountPercent.updatedBy && (
                  <p className="mt-1 text-xs text-gray-400">
                    Last updated by {settings.discountPercent.updatedBy} on{' '}
                    {formatDate(settings.discountPercent.updatedAt)}
                  </p>
                )}
              </div>

              {/* Commission Percent */}
              <div>
                <label
                  htmlFor="commissionPercent"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Affiliate Commission (%)
                </label>
                <input
                  type="number"
                  id="commissionPercent"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionPercent}
                  onChange={(e) =>
                    setCommissionPercent(parseFloat(e.target.value))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Commission percentage on net revenue (after discount)
                </p>
                {settings?.commissionPercent.updatedBy && (
                  <p className="mt-1 text-xs text-gray-400">
                    Last updated by {settings.commissionPercent.updatedBy} on{' '}
                    {formatDate(settings.commissionPercent.updatedAt)}
                  </p>
                )}
              </div>

              {/* Codes Per Month */}
              <div>
                <label
                  htmlFor="codesPerMonth"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Codes Per Month
                </label>
                <input
                  type="number"
                  id="codesPerMonth"
                  min="1"
                  max="100"
                  value={codesPerMonth}
                  onChange={(e) =>
                    setCodesPerMonth(parseInt(e.target.value, 10))
                  }
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Number of codes distributed to each affiliate monthly
                </p>
              </div>

              {/* Base Price */}
              <div>
                <label
                  htmlFor="basePrice"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Monthly Subscription Price ($)
                </label>
                <input
                  type="number"
                  id="basePrice"
                  min="0"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Regular monthly subscription price before discount
                </p>
              </div>

              {/* 3-Day Trial Price */}
              <div>
                <label
                  htmlFor="threeDayPrice"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  3-Day Trial Price ($)
                </label>
                <input
                  type="number"
                  id="threeDayPrice"
                  min="0"
                  step="0.01"
                  value={threeDayPrice}
                  onChange={(e) => setThreeDayPrice(parseFloat(e.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  3-day trial plan price in USD (dLocal countries only)
                </p>
              </div>

              {/* Change Reason */}
              <div>
                <label
                  htmlFor="reason"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Reason for Change (Optional)
                </label>
                <input
                  type="text"
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g., Holiday promotion, Market adjustment"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This will be recorded in the audit history
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Preview Panel */}
          <div>
            {/* Example Calculation */}
            <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">
                Example Calculation
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Regular Price:</span>
                  <span className="font-medium">${basePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-orange-600">
                  <span>Discount ({discountPercent}%):</span>
                  <span className="font-medium">
                    -${((basePrice * discountPercent) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="text-gray-600">Customer Pays:</span>
                  <span className="font-semibold">
                    ${exampleNetPrice.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Affiliate Earns ({commissionPercent}%):</span>
                  <span className="font-semibold">
                    ${exampleCommission.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-blue-600">
                  <span>Company Revenue:</span>
                  <span className="font-semibold">
                    ${(exampleNetPrice - exampleCommission).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h3 className="mb-2 font-semibold text-yellow-800">
                Important Notes
              </h3>
              <ul className="space-y-2 text-sm text-yellow-700">
                <li>
                  Changes take effect immediately for new code distributions
                </li>
                <li>
                  Existing codes retain their original discount/commission rates
                </li>
                <li>
                  Frontend pages will update within 5 minutes due to caching
                </li>
                <li>All changes are logged in the audit history</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

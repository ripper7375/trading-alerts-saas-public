/**
 * Affiliate Payment Settings Page
 *
 * Allows affiliates to manage their payment preferences.
 * Update payment method and details.
 *
 * @module app/affiliate/dashboard/profile/payment/page
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PaymentInfo {
  paymentMethod: (typeof AFFILIATE_CONFIG.PAYMENT_METHODS)[number];
  paymentDetails: Record<string, string>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Payment Settings Page
 * Manage payment method and details
 */
export default function AffiliatePaymentPage(): React.ReactElement {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    paymentMethod: 'PAYPAL',
    paymentDetails: {},
  });

  useEffect(() => {
    const fetchPaymentInfo = async (): Promise<void> => {
      try {
        const response = await fetch('/api/affiliate/profile/payment');

        if (!response.ok) {
          throw new Error('Failed to load payment settings');
        }

        const data = await response.json();
        setPaymentInfo({
          paymentMethod: data.paymentMethod || 'PAYPAL',
          paymentDetails: data.paymentDetails || {},
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load payment settings'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentInfo();
  }, []);

  const handlePaymentMethodChange = (
    method: (typeof AFFILIATE_CONFIG.PAYMENT_METHODS)[number]
  ): void => {
    setPaymentInfo({
      paymentMethod: method,
      paymentDetails: {},
    });
  };

  const handlePaymentDetailChange = (field: string, value: string): void => {
    setPaymentInfo((prev) => ({
      ...prev,
      paymentDetails: {
        ...prev.paymentDetails,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/affiliate/profile/payment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentInfo),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update payment settings');
      }

      setSuccess('Payment settings updated successfully!');
      setTimeout(() => {
        router.push('/affiliate/dashboard/profile');
      }, 2000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update payment settings'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
        <p className="text-gray-600">
          Manage how you receive your commission payouts
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Payment Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-md p-6 space-y-6"
      >
        {/* Payment Method Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-4">
            {AFFILIATE_CONFIG.PAYMENT_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => handlePaymentMethodChange(method)}
                className={`p-4 border rounded-lg text-left ${
                  paymentInfo.paymentMethod === method
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <p className="font-medium">{method.replace('_', ' ')}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Payment Details */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Payment Details
          </h3>

          {/* PayPal */}
          {paymentInfo.paymentMethod === 'PAYPAL' && (
            <div>
              <label
                htmlFor="paypalEmail"
                className="block text-sm text-gray-600 mb-1"
              >
                PayPal Email Address
              </label>
              <input
                type="email"
                id="paypalEmail"
                value={paymentInfo.paymentDetails['email'] || ''}
                onChange={(e) =>
                  handlePaymentDetailChange('email', e.target.value)
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="your@paypal.com"
              />
            </div>
          )}

          {/* Bank Transfer */}
          {paymentInfo.paymentMethod === 'BANK_TRANSFER' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={paymentInfo.paymentDetails['bankName'] || ''}
                  onChange={(e) =>
                    handlePaymentDetailChange('bankName', e.target.value)
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  value={paymentInfo.paymentDetails['accountHolder'] || ''}
                  onChange={(e) =>
                    handlePaymentDetailChange('accountHolder', e.target.value)
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Account Number / IBAN
                </label>
                <input
                  type="text"
                  value={paymentInfo.paymentDetails['accountNumber'] || ''}
                  onChange={(e) =>
                    handlePaymentDetailChange('accountNumber', e.target.value)
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  SWIFT / BIC Code
                </label>
                <input
                  type="text"
                  value={paymentInfo.paymentDetails['swiftCode'] || ''}
                  onChange={(e) =>
                    handlePaymentDetailChange('swiftCode', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          )}

          {/* Cryptocurrency */}
          {paymentInfo.paymentMethod === 'CRYPTOCURRENCY' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Cryptocurrency
                </label>
                <select
                  value={paymentInfo.paymentDetails['currency'] || 'USDT'}
                  onChange={(e) =>
                    handlePaymentDetailChange('currency', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="USDT">USDT (Tether)</option>
                  <option value="BTC">BTC (Bitcoin)</option>
                  <option value="ETH">ETH (Ethereum)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Network
                </label>
                <select
                  value={paymentInfo.paymentDetails['network'] || 'TRC20'}
                  onChange={(e) =>
                    handlePaymentDetailChange('network', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="TRC20">TRC20 (Tron)</option>
                  <option value="ERC20">ERC20 (Ethereum)</option>
                  <option value="BEP20">BEP20 (BSC)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Wallet Address
                </label>
                <input
                  type="text"
                  value={paymentInfo.paymentDetails['walletAddress'] || ''}
                  onChange={(e) =>
                    handlePaymentDetailChange('walletAddress', e.target.value)
                  }
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  placeholder="Your wallet address"
                />
              </div>
            </div>
          )}

          {/* Wise */}
          {paymentInfo.paymentMethod === 'WISE' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                Wise Email Address
              </label>
              <input
                type="email"
                value={paymentInfo.paymentDetails['email'] || ''}
                onChange={(e) =>
                  handlePaymentDetailChange('email', e.target.value)
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="your@wise.com"
              />
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.push('/affiliate/dashboard/profile')}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Payment Settings'}
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Payout Information</h3>
        <ul className="text-sm text-gray-600 space-y-2">
          <li>
            - Payouts are processed monthly for balances over $
            {AFFILIATE_CONFIG.MINIMUM_PAYOUT}
          </li>
          <li>- Processing typically takes 5-7 business days</li>
          <li>- You will receive an email notification when payout is sent</li>
          <li>
            - For cryptocurrency payments, please ensure you use the correct
            network
          </li>
        </ul>
      </div>
    </div>
  );
}

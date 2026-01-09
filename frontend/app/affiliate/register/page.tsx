/**
 * Affiliate Registration Page
 *
 * Allows authenticated users to register as affiliates.
 * Collects required information and submits to registration API.
 *
 * @module app/affiliate/register/page
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface FormData {
  fullName: string;
  country: string;
  paymentMethod: (typeof AFFILIATE_CONFIG.PAYMENT_METHODS)[number];
  paymentDetails: Record<string, string>;
  terms: boolean;
  twitterUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Registration Page
 * Form for users to register as affiliates
 */
export default function AffiliateRegisterPage(): React.ReactElement {
  const router = useRouter();

  // Fetch dynamic config from SystemConfig
  const { discountPercent, commissionPercent, codesPerMonth } =
    useAffiliateConfig();

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    country: '',
    paymentMethod: 'PAYPAL',
    paymentDetails: {},
    terms: false,
    twitterUrl: '',
    youtubeUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    tiktokUrl: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handlePaymentDetailChange = (field: string, value: string): void => {
    setFormData((prev) => ({
      ...prev,
      paymentDetails: {
        ...prev.paymentDetails,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/affiliate/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          country: formData.country,
          paymentMethod: formData.paymentMethod,
          paymentDetails: formData.paymentDetails,
          terms: formData.terms,
          twitterUrl: formData.twitterUrl || undefined,
          youtubeUrl: formData.youtubeUrl || undefined,
          instagramUrl: formData.instagramUrl || undefined,
          facebookUrl: formData.facebookUrl || undefined,
          tiktokUrl: formData.tiktokUrl || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      router.push('/affiliate/verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Become an Affiliate
          </h1>
          <p className="mt-2 text-gray-600">
            Earn {commissionPercent}% commission on every referral
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-lg shadow-md space-y-6"
        >
          {/* Personal Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Personal Information
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name *
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  minLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label
                  htmlFor="country"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Country Code *
                </label>
                <input
                  type="text"
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleInputChange}
                  required
                  maxLength={2}
                  pattern="[A-Za-z]{2}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="US"
                />
                <p className="mt-1 text-xs text-gray-500">
                  2-letter country code (e.g., US, UK, CA)
                </p>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Payment Information
            </h2>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="paymentMethod"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Payment Method *
                </label>
                <select
                  id="paymentMethod"
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {AFFILIATE_CONFIG.PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* PayPal Email */}
              {formData.paymentMethod === 'PAYPAL' && (
                <div>
                  <label
                    htmlFor="paypalEmail"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    PayPal Email *
                  </label>
                  <input
                    type="email"
                    id="paypalEmail"
                    value={formData.paymentDetails['email'] || ''}
                    onChange={(e) =>
                      handlePaymentDetailChange('email', e.target.value)
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your@paypal.com"
                  />
                </div>
              )}

              {/* Bank Transfer Details */}
              {formData.paymentMethod === 'BANK_TRANSFER' && (
                <>
                  <div>
                    <label
                      htmlFor="bankName"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      id="bankName"
                      value={formData.paymentDetails['bankName'] || ''}
                      onChange={(e) =>
                        handlePaymentDetailChange('bankName', e.target.value)
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="accountNumber"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Account Number *
                    </label>
                    <input
                      type="text"
                      id="accountNumber"
                      value={formData.paymentDetails['accountNumber'] || ''}
                      onChange={(e) =>
                        handlePaymentDetailChange(
                          'accountNumber',
                          e.target.value
                        )
                      }
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Cryptocurrency Address */}
              {formData.paymentMethod === 'CRYPTOCURRENCY' && (
                <div>
                  <label
                    htmlFor="walletAddress"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Wallet Address (USDT/BTC) *
                  </label>
                  <input
                    type="text"
                    id="walletAddress"
                    value={formData.paymentDetails['walletAddress'] || ''}
                    onChange={(e) =>
                      handlePaymentDetailChange('walletAddress', e.target.value)
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Your crypto wallet address"
                  />
                </div>
              )}

              {/* Wise Email */}
              {formData.paymentMethod === 'WISE' && (
                <div>
                  <label
                    htmlFor="wiseEmail"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Wise Email *
                  </label>
                  <input
                    type="email"
                    id="wiseEmail"
                    value={formData.paymentDetails['email'] || ''}
                    onChange={(e) =>
                      handlePaymentDetailChange('email', e.target.value)
                    }
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your@wise.com"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Social Media (Optional) */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Social Media (Optional)
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Add your social media profiles to help us verify your identity
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="twitterUrl"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Twitter/X
                </label>
                <input
                  type="url"
                  id="twitterUrl"
                  name="twitterUrl"
                  value={formData.twitterUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://twitter.com/username"
                />
              </div>

              <div>
                <label
                  htmlFor="youtubeUrl"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  YouTube
                </label>
                <input
                  type="url"
                  id="youtubeUrl"
                  name="youtubeUrl"
                  value={formData.youtubeUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://youtube.com/@channel"
                />
              </div>

              <div>
                <label
                  htmlFor="instagramUrl"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Instagram
                </label>
                <input
                  type="url"
                  id="instagramUrl"
                  name="instagramUrl"
                  value={formData.instagramUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://instagram.com/username"
                />
              </div>

              <div>
                <label
                  htmlFor="tiktokUrl"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  TikTok
                </label>
                <input
                  type="url"
                  id="tiktokUrl"
                  name="tiktokUrl"
                  value={formData.tiktokUrl}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://tiktok.com/@username"
                />
              </div>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="pt-4 border-t border-gray-200">
            <label className="flex items-start">
              <input
                type="checkbox"
                name="terms"
                checked={formData.terms}
                onChange={handleInputChange}
                required
                className="mt-1 mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">
                I agree to the affiliate program terms and conditions. I
                understand that I will earn {commissionPercent}% commission on
                referrals and that payouts are processed monthly for balances
                over ${AFFILIATE_CONFIG.MINIMUM_PAYOUT}.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading || !formData.terms}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Register as Affiliate'}
            </button>
          </div>

          {/* Benefits Section */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Affiliate Benefits:
            </h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>
                - Earn {commissionPercent}% commission on every successful
                referral
              </li>
              <li>
                - Your referrals get {discountPercent}% off their subscription
              </li>
              <li>- Receive {codesPerMonth} unique codes per month</li>
              <li>
                - Monthly payouts for balances over $
                {AFFILIATE_CONFIG.MINIMUM_PAYOUT}
              </li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
}

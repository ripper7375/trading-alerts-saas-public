/**
 * Affiliate Resource Center Page (Session 6-7, B2-20)
 *
 * No dedicated backend endpoint exists for this page — per Davin's live
 * CONFIRM-time direction, built as a client-side resource hub: a real
 * referral-link generator (reuses the existing GET
 * /api/affiliate/dashboard/codes?status=ACTIVE feed and the real `?ref=`
 * query param register-form.tsx already reads), promo-code copy widgets,
 * and an FAQ built from real AFFILIATE_CONFIG values. No public/ brand
 * asset files exist in this repo (checked) — the Brand Assets section says
 * so honestly rather than linking to files that would 404.
 *
 * @module app/affiliate/dashboard/resources/page
 */

'use client';

import React, { useEffect, useState } from 'react';

import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateCode {
  id: string;
  code: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
}

interface CodesResponse {
  codes: AffiliateCode[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AffiliateResourcesPage(): React.ReactElement {
  const [codes, setCodes] = useState<AffiliateCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);

    const fetchCodes = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(
          '/api/affiliate/dashboard/codes?status=ACTIVE&limit=100'
        );

        if (!response.ok) {
          throw new Error('Failed to load your referral codes');
        }

        const data: CodesResponse = await response.json();
        setCodes(data.codes);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load your referral codes'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCodes();
  }, []);

  async function copyToClipboard(key: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — no-op, the
      // value is still visible and selectable in the input for manual copy.
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Affiliate Resource Center
        </h1>
        <p className="text-gray-600">
          Everything you need to share your referral link and promote your codes
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      )}

      {/* Referral Link & Code Generator */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Your Referral Links
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : codes.length === 0 ? (
          <p className="text-sm text-gray-500">
            You don&apos;t have any active codes right now. New codes are
            distributed monthly — check{' '}
            <a
              href="/affiliate/dashboard/codes"
              className="text-blue-600 underline hover:text-blue-800"
            >
              My Codes
            </a>{' '}
            for your full history.
          </p>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => {
              const link = `${origin}/register?ref=${code.code}`;
              return (
                <div
                  key={code.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 p-3"
                >
                  <span className="font-mono text-sm font-semibold text-gray-900">
                    {code.code}
                  </span>
                  <input
                    readOnly
                    value={link}
                    className="min-w-[240px] flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-sm"
                    onFocus={(e) => e.target.select()}
                    aria-label={`Referral link for code ${code.code}`}
                  />
                  <button
                    onClick={() => copyToClipboard(`link-${code.id}`, link)}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {copiedKey === `link-${code.id}` ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(`code-${code.id}`, code.code)
                    }
                    className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    {copiedKey === `code-${code.id}` ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Brand Assets */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">
          Brand Assets
        </h2>
        <p className="text-sm text-gray-600">
          Logo files and banner assets aren&apos;t published yet. Reach out to
          your account contact and we&apos;ll send you the current brand kit
          directly.
        </p>
      </div>

      {/* FAQ */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Frequently Asked Questions
        </h2>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-gray-900">
              How much do I earn per referral?
            </dt>
            <dd className="mt-1 text-gray-600">
              You earn {AFFILIATE_CONFIG.COMMISSION_PERCENT}% of net revenue on
              each referral&apos;s subscription — your dashboard&apos;s
              displayed rate always reflects the current program configuration.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">
              How often do I get new codes?
            </dt>
            <dd className="mt-1 text-gray-600">
              Up to {AFFILIATE_CONFIG.CODES_PER_MONTH} new codes are distributed
              monthly, each valid for {AFFILIATE_CONFIG.CODE_EXPIRY_DAYS} days
              from distribution.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">
              What&apos;s the minimum payout?
            </dt>
            <dd className="mt-1 text-gray-600">
              Balances need to reach ${AFFILIATE_CONFIG.MINIMUM_PAYOUT} before a
              payout is scheduled. See{' '}
              <a
                href="/affiliate/dashboard/payouts"
                className="text-blue-600 underline hover:text-blue-800"
              >
                Payouts
              </a>{' '}
              for the real status of each batch.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">
              Where do I set up how I get paid?
            </dt>
            <dd className="mt-1 text-gray-600">
              <a
                href="/affiliate/settings/payout"
                className="text-blue-600 underline hover:text-blue-800"
              >
                Payout Settings
              </a>{' '}
              is the single place to configure your bank details.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

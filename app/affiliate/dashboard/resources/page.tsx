/**
 * Affiliate Resource Center Page (Session 6-7, B2-20; wired to real media
 * kit data ad-hoc 2026-08-20)
 *
 * Fetches GET /api/affiliate/dashboard/resources — the affiliate's own
 * active codes (with discount %) plus every published (ACTIVE)
 * MarketingAsset: brand logos/mascots/banners/docs are real downloadable
 * files (served through the download-tracking redirect route), and
 * SWIPE_COPY assets are copy-to-clipboard text (tracked via the copy
 * route). Both engagement routes increment the same `downloadCount` the
 * admin Marketing Resources dashboard reports.
 *
 * @module app/affiliate/dashboard/resources/page
 */

'use client';

import React, { useEffect, useState } from 'react';

import { AFFILIATE_CONFIG } from '@/lib/affiliate/constants';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateCode {
  id: string;
  code: string;
  discountPercent: number;
  expiresAt: string;
}

interface MarketingAsset {
  id: string;
  title: string;
  category: 'BRAND_LOGOS' | 'MASCOTS' | 'AD_BANNERS' | 'SWIPE_COPY' | 'DOCS';
  format: string;
  resolution: string;
  fileUrl: string | null;
  fileSize: number | null;
  copyText: string | null;
  downloadCount: number;
}

interface ResourcesResponse {
  codes: AffiliateCode[];
  assets: MarketingAsset[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AffiliateResourcesPage(): React.ReactElement {
  const { t, formatCurrency } = useLocale();
  const [codes, setCodes] = useState<AffiliateCode[]>([]);
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);

    const fetchResources = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/affiliate/dashboard/resources');

        if (!response.ok) {
          throw new Error(
            t(
              'affiliate.resources.error_load_media_kit',
              'Failed to load your media kit'
            )
          );
        }

        const data: ResourcesResponse = await response.json();
        setCodes(data.codes);
        setAssets(data.assets);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'affiliate.resources.error_load_media_kit',
                'Failed to load your media kit'
              )
        );
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function copySwipe(asset: MarketingAsset): Promise<void> {
    if (!asset.copyText) return;

    // Copy immediately from already-fetched text (no round trip needed to
    // show the result), then fire the engagement-tracking call.
    await copyToClipboard(`swipe-${asset.id}`, asset.copyText);

    try {
      await fetch(`/api/affiliate/dashboard/resources/${asset.id}/copy`, {
        method: 'POST',
      });
    } catch {
      // Non-fatal: the clipboard copy already succeeded for the user.
    }
  }

  const downloadableAssets = assets.filter((a) => a.category !== 'SWIPE_COPY');
  const swipeAssets = assets.filter((a) => a.category === 'SWIPE_COPY');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('affiliate.resources.title', 'Affiliate Resource Center')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'affiliate.resources.subtitle',
            'Everything you need to share your referral link and promote your codes'
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Referral Link & Code Generator */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('affiliate.resources.your_referral_links', 'Your Referral Links')}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-500" />
          </div>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              'affiliate.resources.no_active_codes_prefix',
              "You don't have any active codes right now. New codes are distributed monthly — check"
            )}{' '}
            <a
              href="/affiliate/dashboard/codes"
              className="text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
            >
              {t('affiliate.codes.my_codes', 'My Codes')}
            </a>{' '}
            {t(
              'affiliate.resources.no_active_codes_suffix',
              'for your full history.'
            )}
          </p>
        ) : (
          <div className="space-y-3">
            {codes.map((code) => {
              const link = `${origin}/register?ref=${code.code}`;
              return (
                <div
                  key={code.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
                >
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {code.code}
                  </span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    {t(
                      'affiliate.resources.percent_off',
                      '{percent}% OFF'
                    ).replace('{percent}', String(code.discountPercent))}
                  </span>
                  <input
                    readOnly
                    value={link}
                    className="min-w-[240px] flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-sm text-foreground"
                    onFocus={(e) => e.target.select()}
                    aria-label={t(
                      'affiliate.resources.referral_link_for_code_aria',
                      'Referral link for code {code}'
                    ).replace('{code}', code.code)}
                  />
                  <button
                    onClick={() => copyToClipboard(`link-${code.id}`, link)}
                    className="rounded-md bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-sm font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500"
                  >
                    {copiedKey === `link-${code.id}`
                      ? t('affiliate.resources.copied', 'Copied!')
                      : t('affiliate.resources.copy_link', 'Copy Link')}
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(`code-${code.id}`, code.code)
                    }
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    {copiedKey === `code-${code.id}`
                      ? t('affiliate.resources.copied', 'Copied!')
                      : t('affiliate.resources.copy_code', 'Copy Code')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Brand Assets */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('affiliate.resources.brand_assets', 'Brand Assets')}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-500" />
          </div>
        ) : downloadableAssets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t(
              'affiliate.resources.no_brand_assets',
              'No brand assets have been published yet — check back soon.'
            )}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {downloadableAssets.map((asset) => (
              <div
                key={asset.id}
                className="space-y-3 rounded-md border border-border p-4 text-center"
              >
                {asset.fileUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- external Blob/public URLs, arbitrary formats (svg/jpg/png)
                  <img
                    src={asset.fileUrl}
                    alt={asset.title}
                    className="mx-auto h-20 w-20 rounded-md object-contain"
                  />
                )}
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {asset.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {asset.format} · {asset.resolution}
                  </p>
                </div>
                <a
                  href={`/api/affiliate/dashboard/resources/${asset.id}/download`}
                  className="inline-block w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
                >
                  {t(
                    'affiliate.resources.download_format',
                    'Download {format}'
                  ).replace('{format}', asset.format)}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Copywriting Swipes */}
      {swipeAssets.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {t(
              'affiliate.resources.copywriting_swipes',
              'High-Converting Copywriting Swipes'
            )}
          </h2>
          <div className="space-y-3">
            {swipeAssets.map((asset) => (
              <div
                key={asset.id}
                className="space-y-2 rounded-md border border-border p-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground">
                    {asset.title}
                  </h4>
                  <button
                    onClick={() => copySwipe(asset)}
                    className="rounded-md bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1.5 text-sm font-bold text-slate-950 hover:from-amber-400 hover:to-amber-500"
                  >
                    {copiedKey === `swipe-${asset.id}`
                      ? t('affiliate.resources.copied', 'Copied!')
                      : t('affiliate.resources.copy_text', 'Copy Text')}
                  </button>
                </div>
                <p className="bg-muted/40 select-all rounded p-3 font-mono text-xs text-foreground">
                  {asset.copyText}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAQ */}
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('affiliate.resources.faq_title', 'Frequently Asked Questions')}
        </h2>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-medium text-foreground">
              {t(
                'affiliate.resources.faq_earn_question',
                'How much do I earn per referral?'
              )}
            </dt>
            <dd className="mt-1 text-muted-foreground">
              {t(
                'affiliate.resources.faq_earn_answer',
                "You earn {percent}% of net revenue on each referral's subscription — your dashboard's displayed rate always reflects the current program configuration."
              ).replace(
                '{percent}',
                String(AFFILIATE_CONFIG.COMMISSION_PERCENT)
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">
              {t(
                'affiliate.resources.faq_codes_question',
                'How often do I get new codes?'
              )}
            </dt>
            <dd className="mt-1 text-muted-foreground">
              {t(
                'affiliate.resources.faq_codes_answer',
                'Up to {count} new codes are distributed monthly, each valid for {days} days from distribution.'
              )
                .replace('{count}', String(AFFILIATE_CONFIG.CODES_PER_MONTH))
                .replace('{days}', String(AFFILIATE_CONFIG.CODE_EXPIRY_DAYS))}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">
              {t(
                'affiliate.resources.faq_minimum_payout_question',
                "What's the minimum payout?"
              )}
            </dt>
            <dd className="mt-1 text-muted-foreground">
              {t(
                'affiliate.resources.faq_minimum_payout_answer_prefix',
                'Balances need to reach {amount} before a payout is scheduled. See'
              ).replace(
                '{amount}',
                formatCurrency(AFFILIATE_CONFIG.MINIMUM_PAYOUT)
              )}{' '}
              <a
                href="/affiliate/dashboard/payouts"
                className="text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
              >
                {t('affiliate.payouts.payouts_link', 'Payouts')}
              </a>{' '}
              {t(
                'affiliate.resources.faq_minimum_payout_answer_suffix',
                'for the real status of each batch.'
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">
              {t(
                'affiliate.resources.faq_setup_payment_question',
                'Where do I set up how I get paid?'
              )}
            </dt>
            <dd className="mt-1 text-muted-foreground">
              <a
                href="/affiliate/settings/payout"
                className="text-amber-600 underline hover:text-amber-700 dark:text-amber-400"
              >
                {t('affiliate.payouts.payout_settings', 'Payout Settings')}
              </a>{' '}
              {t(
                'affiliate.resources.faq_setup_payment_answer',
                'is the single place to configure your bank details.'
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

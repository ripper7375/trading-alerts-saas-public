'use client';

/**
 * Upgrade Prompt Component
 *
 * Client component that displays a PRO upgrade prompt with dynamic pricing
 * from SystemConfig. Used in server components that need to show upgrade CTAs.
 *
 * @module components/dashboard/upgrade-prompt
 */

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { useLocale } from '@/lib/context/locale-context';

export function UpgradePrompt(): React.ReactElement {
  // Get dynamic PRO price from SystemConfig
  const { regularPrice } = useAffiliateConfig();
  const { t } = useLocale();

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="text-4xl sm:text-5xl">⭐</div>
          <div className="flex-1">
            <h2 className="mb-2 text-xl font-bold sm:text-2xl">
              {t('dashboard.upgrade_to_pro', 'Upgrade to PRO')}
            </h2>
            <p className="mb-4 text-white/90">
              {t(
                'dashboard.upgrade_desc',
                'Get the full alert system and advanced chart tools for just ${price}/month'
              ).replace('{price}', String(regularPrice))}
            </p>
            <ul className="mb-4 grid grid-cols-1 gap-2 text-sm text-white/80 sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <span>✓</span>{' '}
                {t(
                  'dashboard.feature_alerts',
                  '100 price alerts (XAUUSD M5/M15)'
                )}
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span>{' '}
                {t('dashboard.feature_drawing', 'Drawing engine line alerts')}
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span>{' '}
                {t('dashboard.feature_mtf', 'Multi-timeframe visualization')}
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span>{' '}
                {t('dashboard.feature_priority', 'Priority updates (30s)')}
              </li>
            </ul>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/settings/billing">
                <Button className="bg-white px-6 font-semibold text-blue-600 hover:bg-white/90">
                  {t(
                    'dashboard.upgrade_now',
                    'Upgrade Now - ${price}/month'
                  ).replace('{price}', String(regularPrice))}
                </Button>
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-white/80 underline underline-offset-2 hover:text-white"
              >
                {t('dashboard.see_full_comparison', 'See full comparison')}
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

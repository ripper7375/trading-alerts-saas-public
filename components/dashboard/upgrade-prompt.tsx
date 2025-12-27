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

export function UpgradePrompt(): React.ReactElement {
  // Get dynamic PRO price from SystemConfig
  const { regularPrice } = useAffiliateConfig();

  return (
    <Card className="bg-gradient-to-r from-blue-600 to-purple-600 border-0 text-white overflow-hidden">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="text-4xl sm:text-5xl">⭐</div>
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">
              Upgrade to PRO
            </h2>
            <p className="text-white/90 mb-4">
              Get 15 symbols, 9 timeframes, and 20 alerts for just $
              {regularPrice}/month
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-white/80 mb-4">
              <li className="flex items-center gap-2">
                <span>✓</span> 15 trading symbols
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span> 9 timeframes (M5-D1)
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span> 20 active alerts
              </li>
              <li className="flex items-center gap-2">
                <span>✓</span> Priority updates (30s)
              </li>
            </ul>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Link href="/dashboard/settings/billing">
                <Button className="bg-white text-blue-600 hover:bg-white/90 font-semibold px-6">
                  Upgrade Now - ${regularPrice}/month
                </Button>
              </Link>
              <Link
                href="/pricing"
                className="text-white/80 hover:text-white text-sm underline underline-offset-2"
              >
                See full comparison
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

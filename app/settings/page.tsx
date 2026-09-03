'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Loader2,
  ArrowUpRight,
  UserCircle,
  ShieldCheck,
  HelpCircle,
  Languages,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';
import { type Tier } from '@/types/tier';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Settings Hub (Row 83)
 *
 * Landing page for /settings: current tier/plan card with real usage
 * stats, plus quick links into every settings sub-section.
 */

interface UsageData {
  alerts: number;
}

export default function SettingsPage(): React.ReactElement {
  const { t } = useLocale();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [usageData, setUsageData] = useState<UsageData>({ alerts: 0 });
  const [error, setError] = useState<string | null>(null);

  const tier = (session?.user?.tier || 'FREE') as Tier;
  const { regularPrice } = useAffiliateConfig();

  useEffect(() => {
    let cancelled = false;

    async function fetchAlertCount(): Promise<void> {
      try {
        const response = await fetch('/api/alerts');
        if (!response.ok) {
          throw new Error('Failed to fetch alert count');
        }
        const data = await response.json();
        if (!cancelled) {
          setUsageData({
            alerts: Array.isArray(data.alerts) ? data.alerts.length : 0,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t('settings.error_fetch_alerts', 'Failed to fetch alert count')
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetchAlertCount();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-2xl font-bold text-foreground">
        {t('settings.your_plan', 'Your Plan')}
      </h2>

      {/* Current Plan Display */}
      <Card
        className={
          tier === 'PRO'
            ? 'border-primary/40 bg-primary/5 border-2'
            : 'border-2 border-border'
        }
      >
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <Badge
                  className={
                    tier === 'PRO'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }
                >
                  {tier} {t('alerts.tier', 'TIER')}
                </Badge>
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {t('alerts.status_active', 'Active')}
                </Badge>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {tier} {t('settings.plan', 'Plan')}
              </div>
              <div className="mt-1 text-muted-foreground">
                {tier === 'FREE'
                  ? t('settings.free_forever', 'Free Forever')
                  : `$${regularPrice}/${t('checkout.month', 'month')}`}
              </div>
            </div>

            {tier === 'FREE' && (
              <Link href="/pricing">
                <Button>
                  {t('settings.upgrade_to_pro', 'Upgrade to Pro')}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>

          {/* Current Usage with CORRECT limits */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between border-b border-border py-2">
              <span className="text-muted-foreground">{t('Symbol')}</span>
              <span className="font-medium text-foreground">XAUUSD (Gold)</span>
            </div>

            <div className="flex items-center justify-between border-b border-border py-2">
              <span className="text-muted-foreground">{t('Timeframe')}s</span>
              <span className="font-medium text-foreground">M5, M15</span>
            </div>

            <div className="flex items-center justify-between border-b border-border py-2">
              <span className="text-muted-foreground">
                {t('alerts.page_title', 'Alerts')}
              </span>
              <span className="font-medium text-foreground">
                {tier === 'FREE'
                  ? t('dashboard.stat_pro_feature', 'PRO feature')
                  : error
                    ? t('settings.unable_to_load', 'Unable to load')
                    : `${usageData.alerts} / 100`}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-border py-2">
              <span className="text-muted-foreground">
                {t('settings.indicators', 'Indicators')}
              </span>
              <span className="font-medium text-foreground">
                {t('settings.all_included', 'All included')}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">
                {t('settings.api_rate_limit', 'API Rate Limit')}
              </span>
              <span className="font-medium text-foreground">
                {tier === 'FREE'
                  ? t('settings.rate_60', '60/hour')
                  : t('settings.rate_300', '300/hour')}
              </span>
            </div>
          </div>

          {/* Upgrade Prompt for FREE users (non-affiliate) */}
          {tier === 'FREE' &&
            (session?.user as { role?: string })?.role !== 'AFFILIATE' && (
              <div className="border-primary/20 bg-primary/5 mt-6 rounded-lg border p-4">
                <h3 className="mb-2 font-semibold text-foreground">
                  {t('settings.unlock_more', 'Unlock More with Pro')}
                </h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓
                    </span>
                    {t(
                      'alerts.feature_100_desc',
                      '100 price alerts (XAUUSD M5/M15)'
                    )}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓
                    </span>
                    {t('alerts.feature_drawing_title', 'Drawing Line Alerts')}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓
                    </span>
                    {t('alerts.feature_mtf_title', 'Multi-Timeframe View')}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓
                    </span>
                    {t(
                      'settings.full_alert_system',
                      'Full alert & notification system'
                    )}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓
                    </span>
                    {t('settings.rate_limit_5x', '5x API rate limit')}
                  </li>
                </ul>
                <Link href="/pricing">
                  <Button className="mt-4 w-full">
                    {t('alerts.start_trial', 'Start 7-Day Free Trial')}
                  </Button>
                </Link>
              </div>
            )}

          {/* Affiliate Partner Hub Card */}
          {(session?.user as { role?: string })?.role === 'AFFILIATE' && (
            <div className="mt-6 rounded-lg bg-indigo-50 p-4 dark:bg-indigo-900/30">
              <h3 className="mb-2 font-semibold text-indigo-900 dark:text-indigo-100">
                {t('settings.affiliate_hub_title', 'Affiliate Partner Hub')}
              </h3>
              <p className="text-sm text-indigo-800 dark:text-indigo-200">
                {t(
                  'settings.affiliate_hub_desc',
                  'You are enrolled in the Affiliate Partner Program. Distribute promo discount codes and track commission disbursements.'
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Link href="/affiliate/dashboard">
                    {t('settings.partner_dashboard', 'Partner Dashboard')}
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href="/affiliate/settings/payout">
                    {t('settings.payout_settings', 'Payout Settings')}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* PRO tier info */}
          {tier === 'PRO' && (
            <div className="mt-6 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/30">
              <h3 className="mb-2 font-semibold text-emerald-900 dark:text-emerald-100">
                {t('settings.you_have_pro', 'You have Pro Access')}
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                {t(
                  'settings.pro_access_desc',
                  'Enjoy 100 price alerts, drawing engine line alerts, and multi-timeframe visualization on XAUUSD M5/M15.'
                )}
              </p>
              <Link href="/settings/billing">
                <Button
                  variant="outline"
                  className="mt-4 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                >
                  {t('checkout.manage_subscription', 'Manage Subscription')}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/settings/profile">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground">
                {t('settings.profile_settings', 'Profile Settings')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(
                  'settings.profile_settings_desc',
                  'Update your name, email, and profile picture'
                )}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/billing">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground">
                {t('checkout.billing_invoices', 'Billing & Invoices')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(
                  'settings.billing_desc',
                  'Manage payment methods and view invoices'
                )}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/appearance">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground">
                {t('settings.nav.appearance', 'Appearance')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(
                  'settings.appearance_desc',
                  'Customize theme and display preferences'
                )}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/privacy">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <h3 className="font-semibold text-foreground">
                {t('settings.privacy_security', 'Privacy & Security')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(
                  'settings.privacy_security_desc',
                  'Manage privacy settings and security options'
                )}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/account">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <UserCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-foreground">
                  {t('settings.account_settings', 'Account Settings')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.account_settings_desc',
                    'Manage your account details and sign-in methods'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/security">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-foreground">
                  {t('settings.security_settings', 'Security Settings')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.security_settings_desc',
                    'Two-factor authentication and active sessions'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/help">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-foreground">
                  {t('settings.help_support', 'Help & Support')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.help_support_desc',
                    'Get help, contact support, or browse FAQs'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/language">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-start gap-3 p-4">
              <Languages className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <h3 className="font-semibold text-foreground">
                  {t('nav.language', 'Language & Region')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'settings.language_desc',
                    'Choose your preferred display language'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

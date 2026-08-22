'use client';

/**
 * Upgrade Success Landing Page
 *
 * Stripe redirects the customer back here after a completed Checkout
 * session (successUrl, app/api/checkout/route.ts /
 * money-service/src/stripe/stripe-checkout.controller.ts). The `upgrade`
 * query param is a hint only -- actual PRO status is always confirmed via
 * GET /api/subscription, since Stripe's webhook can take a moment to land
 * and a query param alone can't be trusted.
 *
 * @module app/upgrade/success/page
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PartyPopper,
  Check,
  Loader2,
  RefreshCw,
  Bell,
  LineChart,
  Zap,
  Headphones,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//
// Mirrors app/(marketing)/pricing/page.tsx's own PRO_TIER.features list
// (kept as a small local copy rather than importing, since that array
// isn't exported) -- same real product features, not invented copy.
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const UNLOCKED_FEATURES: Array<{
  icon: typeof Bell;
  name: string;
  detail: string;
}> = [
  {
    icon: Bell,
    name: '100 Active Alerts',
    detail: 'Price alerts on XAUUSD M5/M15',
  },
  {
    icon: LineChart,
    name: 'Drawing Engine Line Alerts',
    detail: 'Draw a line, get alerted when price touches it',
  },
  {
    icon: Zap,
    name: 'Priority Chart Updates',
    detail: '30s refresh rate, 300 API requests/hour',
  },
  {
    icon: Headphones,
    name: 'Priority Support & All Notifications',
    detail: 'Email, push, and SMS alerts',
  },
];

interface SubscriptionState {
  tier: 'FREE' | 'PRO';
  provider: 'STRIPE' | 'DLOCAL' | null;
  planType: string | null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UPGRADE SUCCESS CONTENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function UpgradeSuccessContent(): React.ReactElement {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [subscription, setSubscription] = useState<SubscriptionState | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const res = await fetch('/api/subscription');

      if (!res.ok) {
        throw new Error('Failed to load subscription status');
      }

      const data = await res.json();
      setSubscription({
        tier: data.tier,
        provider: data.subscription?.provider ?? null,
        planType: data.subscription?.planType ?? null,
      });
    } catch (err) {
      console.error('Failed to fetch subscription status:', err);
      setError('Failed to load your subscription status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSubscription();
    }
  }, [status, fetchSubscription]);

  const handleRefresh = (): void => {
    setRefreshing(true);
    fetchSubscription();
  };

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">Confirming your upgrade...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/login?callbackUrl=/upgrade/success');
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Redirecting to login...</p>
      </div>
    );
  }

  const isPro = subscription?.tier === 'PRO';

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center">
          {isPro ? (
            <>
              <PartyPopper
                className="mx-auto mb-2 h-12 w-12 text-primary"
                aria-hidden="true"
              />
              <CardTitle
                className="text-2xl text-foreground"
                role="status"
                aria-live="polite"
              >
                Welcome to PRO!
              </CardTitle>
              <Badge className="bg-primary/10 mx-auto mt-2 w-fit text-primary">
                {subscription?.provider === 'DLOCAL'
                  ? 'Activated'
                  : 'Subscription Active'}
              </Badge>
            </>
          ) : (
            <>
              <Loader2
                className="mx-auto mb-2 h-12 w-12 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
              <CardTitle
                className="text-2xl text-foreground"
                role="status"
                aria-live="polite"
              >
                Finishing up your upgrade
              </CardTitle>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {isPro ? (
            <>
              <p className="text-center text-muted-foreground">
                Your PRO subscription is active. Here&apos;s what you just
                unlocked:
              </p>

              <ul className="space-y-3">
                {UNLOCKED_FEATURES.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <li key={feature.name} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                        <Check
                          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                          aria-hidden="true"
                        />
                      </span>
                      <div>
                        <p className="font-medium text-foreground">
                          {feature.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {feature.detail}
                        </p>
                      </div>
                      <Icon
                        className="ml-auto h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </li>
                  );
                })}
              </ul>

              <Button asChild className="w-full" size="lg">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-center text-muted-foreground" role="alert">
                {error ||
                  "Your payment went through, but we're still waiting for confirmation from your payment provider. This is usually instant but can take a minute."}
              </p>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                  />
                  Check Again
                </Button>
                <Button asChild>
                  <Link href="/dashboard">Go to Dashboard</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN EXPORT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function UpgradeSuccessPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <UpgradeSuccessContent />
    </Suspense>
  );
}

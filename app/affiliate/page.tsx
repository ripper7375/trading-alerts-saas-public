'use client';

/**
 * Public Affiliate Landing Page (B2-10)
 *
 * Lives directly under app/affiliate/ (not app/(marketing)/affiliate/) --
 * that directory already exists with real subroutes (register, dashboard,
 * settings, verify) and its own passthrough layout.tsx, so a competing
 * (marketing) route would collide on the same /affiliate URL. Imports
 * MarketingLayout directly instead, to get the same header/nav/footer
 * chrome every other Session-6-10 page gets without that collision.
 *
 * @module app/affiliate/page
 */

import Link from 'next/link';
import {
  DollarSign,
  Percent,
  Users,
  Link2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

import MarketingLayout from '@/app/(marketing)/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

const steps = [
  {
    icon: Link2,
    title: 'Get your referral link',
    description:
      'Register as an affiliate and get a personal referral code and link instantly.',
  },
  {
    icon: Users,
    title: 'Share it with traders',
    description:
      'Anyone who signs up through your link gets a discount on their PRO subscription.',
  },
  {
    icon: DollarSign,
    title: 'Earn commission monthly',
    description:
      'You earn a percentage of every referred subscription, paid out monthly once you hit the minimum payout balance.',
  },
];

export default function AffiliateLandingPage(): React.ReactElement {
  const { commissionPercent, discountPercent } = useAffiliateConfig();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.role === 'ADMIN' && typeof window !== 'undefined') {
      window.location.assign('/admin');
    }
  }, [session]);

  if (session?.user?.role === 'ADMIN') {
    return (
      <MarketingLayout>
        <div className="flex min-h-[60vh] items-center justify-center bg-background px-4 py-16">
          <Card className="w-full max-w-lg p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Administrator Hub
            </h1>
            <p className="mt-2 text-muted-foreground">
              You are signed in with System Administrator privileges. Affiliate
              program oversight is managed from the Admin console.
            </p>
            <div className="mt-6">
              <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
                <Link href="/admin">Go to Admin Executive Dashboard</Link>
              </Button>
            </div>
          </Card>
        </div>
      </MarketingLayout>
    );
  }

  if (session?.user?.isAffiliate) {
    return (
      <MarketingLayout>
        <div className="flex min-h-[60vh] items-center justify-center bg-background px-4 py-16">
          <Card className="w-full max-w-lg p-8 text-center shadow-lg">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              You&apos;re Already an Affiliate Partner
            </h1>
            <p className="mt-2 text-muted-foreground">
              Your account is active in our Affiliate Partner Program. You can
              access your referral codes, earnings, and promotional resources
              below.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="bg-blue-600 hover:bg-blue-700">
                <Link href="/affiliate/dashboard">
                  Go to Affiliate Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard">Go to Trading Dashboard</Link>
              </Button>
            </div>
          </Card>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <div className="bg-background">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h1 className="mb-4 text-4xl font-bold text-foreground sm:text-5xl">
              Become a Trading Alerts Affiliate
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Earn {commissionPercent}% commission on every subscriber you
              refer, and give them {discountPercent}% off in return.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/affiliate/register">Become an Affiliate</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/affiliate/dashboard">Affiliate Sign In</Link>
              </Button>
            </div>
          </div>

          <div className="mb-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Card>
              <CardContent className="p-6 text-center">
                <Percent
                  className="mx-auto mb-3 h-8 w-8 text-primary"
                  aria-hidden="true"
                />
                <p className="text-3xl font-bold text-foreground">
                  {commissionPercent}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Commission on every referred subscription
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <DollarSign
                  className="mx-auto mb-3 h-8 w-8 text-primary"
                  aria-hidden="true"
                />
                <p className="text-3xl font-bold text-foreground">
                  {discountPercent}%
                </p>
                <p className="text-sm text-muted-foreground">
                  Discount your referrals get on PRO
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mb-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={step.title}>
                  <CardContent className="p-6">
                    <div className="bg-primary/10 mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-sm font-semibold text-primary">
                      {index + 1}
                    </div>
                    <Icon
                      className="mb-3 h-5 w-5 text-primary"
                      aria-hidden="true"
                    />
                    <h2 className="mb-2 font-semibold text-foreground">
                      {step.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="bg-muted/50">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <h2 className="text-2xl font-bold text-foreground">
                Ready to start earning?
              </h2>
              <p className="max-w-xl text-muted-foreground">
                Registration takes a couple of minutes. Payouts are handled
                through your bank account once your balance clears the monthly
                minimum.
              </p>
              <Button asChild size="lg">
                <Link href="/affiliate/register">Become an Affiliate</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketingLayout>
  );
}

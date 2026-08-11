import type { Metadata } from 'next';
import Link from 'next/link';
import { Target, Zap, ShieldCheck, LineChart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Public About Page (B2-1)
 *
 * @module app/(marketing)/about/page
 */

export const metadata: Metadata = {
  title: 'About',
  description:
    'Why Trading Alerts exists and what we believe about trading tools.',
};

const values = [
  {
    icon: Target,
    title: 'Focus over feature-bloat',
    description:
      'One symbol, done properly. XAUUSD across M5 and M15 with full fractal analysis, instead of a shallow feature spread across a hundred instruments nobody uses well.',
  },
  {
    icon: Zap,
    title: 'Signal, not noise',
    description:
      'Every alert is a price condition you set, evaluated in real time. No black-box "AI predictions" — just the levels you drew and the conditions you configured, delivered the moment they trigger.',
  },
  {
    icon: ShieldCheck,
    title: 'Your data, your account',
    description:
      'We never touch your funds and never see full payment details — those go straight to our payment providers. You can export or delete your data at any time from Settings.',
  },
  {
    icon: LineChart,
    title: 'Built by traders',
    description:
      'The drawing engine, multi-timeframe overlays, and line-touch alerts all came from the same question: "what do I wish my charting platform actually did?"',
  },
];

export default function AboutPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground sm:text-5xl">
            About Trading Alerts
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            We built the alerting platform we wanted for ourselves: real-time
            price alerts and a real drawing engine, with nothing standing
            between the chart and the notification.
          </p>
        </div>

        <div className="mb-16 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {values.map((value) => {
            const Icon = value.icon;
            return (
              <Card key={value.title}>
                <CardContent className="p-6">
                  <div className="bg-primary/10 mb-4 flex h-10 w-10 items-center justify-center rounded-lg">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-foreground">
                    {value.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-muted/50">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              Start free, no card required
            </h2>
            <p className="max-w-xl text-muted-foreground">
              FREE gets you full market data on XAUUSD M5/M15. Upgrade to PRO
              when you want the drawing engine, line-touch alerts, and up to 100
              active price alerts.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/register">Create Free Account</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

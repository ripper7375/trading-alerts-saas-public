'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Rocket,
  Bell,
  LineChart,
  Code,
  CreditCard,
  Users,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Public Documentation Hub (B2-2)
 *
 * A single-page documentation index -- no CMS/sub-route docs system exists
 * in this codebase, so each topic is a real, substantive summary rather than
 * a link out to a page that doesn't exist.
 *
 * @module app/(marketing)/docs/page
 */

interface DocTopic {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  body: string[];
}

const topics: DocTopic[] = [
  {
    icon: Rocket,
    title: 'Getting Started',
    summary: 'Create an account and take your first look at live XAUUSD data.',
    body: [
      'Register for a free account -- no card required. FREE gets you full market data on XAUUSD across the M5 and M15 timeframes, including every indicator overlay PRO users see.',
      'From the dashboard, open Charts to see live price action, or head to Alerts once you upgrade to PRO to start configuring price conditions.',
    ],
  },
  {
    icon: Bell,
    title: 'Alerts & Notifications',
    summary: 'Price alerts and drawing-engine line alerts, explained.',
    body: [
      'A price alert fires when XAUUSD crosses a target value you set. Line alerts are different: draw a line directly on the chart and get notified the instant price touches it.',
      'PRO includes up to 100 active alerts, delivered by email, push, or both, with 30-second price updates (FREE checks every 60 seconds).',
    ],
  },
  {
    icon: LineChart,
    title: 'Charts & Drawing Tools',
    summary: 'Multi-timeframe visualization and the drawing engine.',
    body: [
      'The chart supports trend lines, horizontal levels, and fractal structure overlays. PRO unlocks multi-timeframe visualization -- overlay M5 structure directly on an M15 chart.',
      'Any line you draw can be converted into a line-touch alert with one click.',
    ],
  },
  {
    icon: Code,
    title: 'API Access',
    summary: 'Programmatic access to the same signals you see on the chart.',
    body: [
      'FREE accounts get 60 API requests/hour; PRO accounts get 300/hour with priority throughput. Manage API usage from Settings once your account is upgraded.',
    ],
  },
  {
    icon: CreditCard,
    title: 'Billing & Subscriptions',
    summary: 'How PRO billing, cancellation, and receipts work.',
    body: [
      'PRO is billed monthly and can be cancelled at any time from Settings > Billing -- your PRO features stay active until the end of the current billing period, then your account moves to FREE automatically.',
      'Affiliate discount codes are applied at checkout or from Settings > Billing before your renewal date.',
    ],
  },
  {
    icon: Users,
    title: 'Affiliate Program',
    summary: 'Earn commission for every subscriber you refer.',
    body: [
      'Register as an affiliate to get a personal referral code and link. Referred signups get a discount, and you earn a commission on their subscription -- see the Affiliate Program page for current rates.',
    ],
  },
];

export default function DocsPage(): React.ReactElement {
  const [openTopic, setOpenTopic] = useState<string | null>(
    topics[0]?.title ?? null
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">
            Documentation
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Everything you need to get set up with alerts, charts, and the
            affiliate program. Need something more specific?{' '}
            <Link
              href="/help"
              className="hover:text-primary/80 text-primary underline"
            >
              Visit the Help Center
            </Link>
            .
          </p>
        </div>

        <div className="space-y-3">
          {topics.map((topic) => {
            const Icon = topic.icon;
            const isOpen = openTopic === topic.title;
            return (
              <Card key={topic.title} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenTopic(isOpen ? null : topic.title)}
                  aria-expanded={isOpen}
                  className="hover:bg-muted/50 flex w-full items-center justify-between gap-4 p-5 text-left transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                      <Icon
                        className="h-5 w-5 text-primary"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground">
                        {topic.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {topic.summary}
                      </p>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    <div className="space-y-3 text-sm text-muted-foreground">
                      {topic.body.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

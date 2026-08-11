'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Book, Mail, LineChart, ChevronDown, ChevronUp } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

/**
 * Public Help Center (B2-9)
 *
 * Distinct from the auth-gated app/(dashboard)/settings/help/page.tsx --
 * this is reachable by signed-out visitors and doesn't assume an account
 * exists. Uses a real mailto: contact rather than settings/help's own
 * simulated-submit form (`await new Promise(...)`), to avoid extending
 * that stub pattern onto a brand-new public page.
 *
 * @module app/(marketing)/help/page
 */

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'What does Trading Alerts do?',
    answer:
      'Real-time price charts and alerts for Gold (XAUUSD) on the M5 and M15 timeframes, plus a drawing engine that can turn any line you draw into a line-touch alert.',
  },
  {
    question: 'What is the difference between FREE and PRO?',
    answer:
      'Both tiers get identical market data on XAUUSD M5/M15 with every indicator overlay. PRO adds the full alert system (up to 100 price alerts, drawing-engine line alerts, multi-timeframe visualization), 30-second price updates instead of 60, and a higher API rate limit.',
  },
  {
    question: 'Do I need a card to start?',
    answer:
      'No -- FREE accounts never require a card. You only enter payment details when you choose to upgrade to PRO.',
  },
  {
    question: 'How do I cancel PRO?',
    answer:
      'From Settings > Billing once you’re signed in. Your PRO features stay active until the end of the current billing period.',
  },
  {
    question: 'Do you offer an affiliate program?',
    answer:
      'Yes -- see the Affiliate Program page for current commission rates and how to get a referral link.',
  },
];

export default function PublicHelpPage(): React.ReactElement {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">
            Help Center
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Answers to common questions. Already have an account? Signed-in help
            and support requests live under Settings &gt; Help.
          </p>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link href="/docs">
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                  <Book className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">
                    Documentation
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Guides on alerts, charts, billing, and the API
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link href="/status">
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex items-start gap-4 p-5">
                <div className="bg-primary/10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                  <LineChart
                    className="h-5 w-5 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">
                    System Status
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Live status of the API, database, and payments
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mb-10 space-y-3">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <Card key={item.question} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="hover:bg-muted/50 flex w-full items-center justify-between gap-4 p-4 text-left transition-colors"
                >
                  <span className="font-medium text-foreground">
                    {item.question}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      {item.answer}
                    </p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <Card className="bg-muted/50">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Mail className="h-6 w-6 text-primary" aria-hidden="true" />
            <p className="text-muted-foreground">
              Still need help? Reach us directly.
            </p>
            <a
              href="mailto:support@tradingalerts.com"
              className="hover:text-primary/80 font-medium text-primary"
            >
              support@tradingalerts.com
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

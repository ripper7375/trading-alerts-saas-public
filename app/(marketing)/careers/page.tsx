import type { Metadata } from 'next';
import { Mail, Users } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

/**
 * Public Careers Page (B2-5)
 *
 * No ATS/job-board backend exists behind this page -- rather than fabricate
 * specific fake job listings (the F64/6-1b anti-pattern), this honestly
 * states there are no open roles posted right now and invites contact.
 *
 * @module app/(marketing)/careers/page
 */

export const metadata: Metadata = {
  title: 'Careers',
  description: 'Open positions at Trading Alerts.',
};

export default function CareersPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mb-6 flex justify-center">
          <div className="bg-primary/10 flex h-14 w-14 items-center justify-center rounded-full">
            <Users className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
        </div>
        <h1 className="mb-4 text-4xl font-bold text-foreground">Careers</h1>
        <p className="mb-10 text-lg text-muted-foreground">
          We&apos;re a small, focused team working on real-time market data,
          alerting, and payments infrastructure.
        </p>

        <Card>
          <CardContent className="p-8">
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              No open positions right now
            </h2>
            <p className="mb-6 text-muted-foreground">
              We don&apos;t have any roles posted at the moment, but we&apos;re
              always interested in hearing from engineers who care about trading
              tools, real-time systems, or payments. Openings will be listed
              here when we have them.
            </p>
            <a
              href="mailto:careers@tradingalerts.com"
              className="hover:text-primary/80 inline-flex items-center gap-2 text-primary"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              careers@tradingalerts.com
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

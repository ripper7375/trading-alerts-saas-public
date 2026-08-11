import type { Metadata } from 'next';
import { Sparkles, Wrench, Shield } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

/**
 * Public Changelog Page (B2-4)
 *
 * Static content page -- entries describe real, already-shipped changes
 * (not fabricated data), grouped by month.
 *
 * @module app/(marketing)/changelog/page
 */

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'A dated list of everything that changed in Trading Alerts.',
};

type EntryKind = 'new' | 'improved' | 'fixed';

interface ChangelogEntry {
  kind: EntryKind;
  text: string;
}

interface ChangelogMonth {
  month: string;
  entries: ChangelogEntry[];
}

const kindMeta: Record<EntryKind, { label: string; className: string }> = {
  new: {
    label: 'New',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  improved: {
    label: 'Improved',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  },
  fixed: {
    label: 'Fixed',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  },
};

const months: ChangelogMonth[] = [
  {
    month: 'August 2026',
    entries: [
      {
        kind: 'new',
        text: 'Real-time delivery for fired alerts -- notification-bell updates and chart markers now arrive instantly instead of on the next poll.',
      },
      {
        kind: 'new',
        text: 'Alerts can now be edited in place (name, target value) from the Alerts page.',
      },
      {
        kind: 'new',
        text: 'Added a dedicated Notifications page and a checkout return / upgrade success flow with live payment status.',
      },
      {
        kind: 'new',
        text: 'Added account-deletion confirm/cancel pages with a 7-day grace period.',
      },
      {
        kind: 'improved',
        text: 'Consolidated the entire admin area under one guarded navigation shell.',
      },
      {
        kind: 'fixed',
        text: 'Added a real 404 page and a global error boundary across the app.',
      },
    ],
  },
  {
    month: 'July 2026',
    entries: [
      {
        kind: 'new',
        text: 'Affiliate payouts to international bank accounts, with a payout-status page and monthly statement export.',
      },
      {
        kind: 'new',
        text: 'Added a code-inventory report and a referral-link generator to the affiliate dashboard.',
      },
      {
        kind: 'improved',
        text: 'Commission history now shows real payout batch status instead of a static placeholder.',
      },
      {
        kind: 'improved',
        text: 'Login, password reset, and two-factor authentication moved to a faster, dedicated authentication path.',
      },
    ],
  },
  {
    month: 'Earlier',
    entries: [
      {
        kind: 'new',
        text: 'Launched the drawing engine: trend lines, horizontal levels, and line-touch alerts on the chart.',
      },
      {
        kind: 'new',
        text: 'Launched multi-timeframe visualization for PRO accounts.',
      },
      {
        kind: 'new',
        text: 'Launched the affiliate program with referral codes and percentage-based commission.',
      },
    ],
  },
];

const kindIcon: Record<
  EntryKind,
  React.ComponentType<{ className?: string }>
> = {
  new: Sparkles,
  improved: Wrench,
  fixed: Shield,
};

export default function ChangelogPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">Changelog</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Everything that changed in Trading Alerts, most recent first.
          </p>
        </div>

        <div className="space-y-12">
          {months.map((group) => (
            <div key={group.month}>
              <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.month}
              </h2>
              <ul className="space-y-4">
                {group.entries.map((entry, index) => {
                  const meta = kindMeta[entry.kind];
                  const Icon = kindIcon[entry.kind];
                  return (
                    <li key={index} className="flex items-start gap-3">
                      <Badge
                        className={`mt-0.5 flex-shrink-0 gap-1 border-0 ${meta.className}`}
                      >
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {meta.label}
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        {entry.text}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <Separator className="mt-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

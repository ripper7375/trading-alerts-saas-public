import type { Metadata } from 'next';
import { CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import {
  getSystemStatus,
  type ComponentStatus,
} from '@/lib/status/check-system-status';

/**
 * Public System Status Page (B2-12)
 *
 * Built as a real internal status dashboard per Davin's direction at
 * CONFIRM -- the existing dashboard footer's external link
 * (https://status.tradingalerts.com, in components/layout/footer.tsx)
 * stays untouched; that's a separate, dashboard-scoped concern.
 *
 * Server component -- calls getSystemStatus() directly rather than
 * self-fetching app/api/status/route.ts (that route exists as the same
 * check exposed as a public JSON endpoint for external monitors).
 *
 * @module app/(marketing)/status/page
 */

export const metadata: Metadata = {
  title: 'System Status',
  description: 'Live operational status of Trading Alerts.',
};

export const dynamic = 'force-dynamic';

const statusMeta: Record<
  ComponentStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  operational: {
    label: 'Operational',
    icon: CheckCircle2,
    className: 'text-green-600 dark:text-green-400',
  },
  degraded: {
    label: 'Degraded',
    icon: AlertTriangle,
    className: 'text-amber-600 dark:text-amber-400',
  },
  not_configured: {
    label: 'Not Configured',
    icon: MinusCircle,
    className: 'text-muted-foreground',
  },
};

export default async function StatusPage(): Promise<React.ReactElement> {
  const status = await getSystemStatus();
  const overall = statusMeta[status.overall];
  const OverallIcon = overall.icon;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">
            System Status
          </h1>
          <div
            className={`inline-flex items-center gap-2 text-lg font-medium ${overall.className}`}
          >
            <OverallIcon className="h-6 w-6" aria-hidden="true" />
            {status.overall === 'operational'
              ? 'All systems operational'
              : status.overall === 'degraded'
                ? 'Some systems are degraded'
                : 'Status partially unavailable'}
          </div>
        </div>

        <div className="space-y-3">
          {status.components.map((component) => {
            const meta = statusMeta[component.status];
            const Icon = meta.icon;
            return (
              <Card key={component.name}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="font-medium text-foreground">
                      {component.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {component.detail}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 text-sm font-medium ${meta.className}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {meta.label}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Last checked {new Date(status.checkedAt).toLocaleString()}. This page
          reflects live checks against this environment.
        </p>
      </div>
    </div>
  );
}

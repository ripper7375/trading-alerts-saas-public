import type { Metadata } from 'next';
import { CheckCircle2, AlertTriangle, MinusCircle } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusRefreshButton } from '@/components/marketing/status-refresh-button';
import {
  getSystemStatus,
  type ComponentStatus,
} from '@/lib/status/check-system-status';

/**
 * Public System Status Page (B2-12, restyled Session 9-2).
 *
 * Server component -- calls getSystemStatus() directly, same as before
 * (also exposed as JSON at app/api/status/route.ts for external monitors).
 * Ported seed-code's richer visual layout (badge, overall-status banner,
 * per-component status cards, refresh control) but NOT its data: seed-code
 * hardcoded 6 fabricated components (MT5 Feed Gateway, WebSocket Pipeline,
 * Davin AI Engine, etc.) each with a fake static latency/uptime figure and
 * a permanently-"OPERATIONAL" refresh button that only faked a spinner --
 * exactly the F64/6-1b mock-data anti-pattern this repo's own check-system-
 * status.ts module was built to avoid. This page binds to the real 4
 * components getSystemStatus() actually checks (API, Database, Realtime,
 * Payment Gateways) and their real detail strings; no invented latency/
 * uptime numbers. Refresh triggers a genuine router.refresh() reload of
 * this force-dynamic page, not a timed fake spinner.
 *
 * @module app/(marketing)/status/page
 */

export const metadata: Metadata = {
  title: 'System Status',
  description: 'Live operational status of DavinTrade AI.',
};

export const dynamic = 'force-dynamic';

const statusMeta: Record<
  ComponentStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    dotClassName: string;
    textClassName: string;
  }
> = {
  operational: {
    label: 'Operational',
    icon: CheckCircle2,
    dotClassName: 'bg-emerald-500',
    textClassName: 'text-emerald-700 dark:text-emerald-400',
  },
  degraded: {
    label: 'Degraded',
    icon: AlertTriangle,
    dotClassName: 'bg-amber-500',
    textClassName: 'text-amber-700 dark:text-amber-400',
  },
  not_configured: {
    label: 'Not Configured',
    icon: MinusCircle,
    dotClassName: 'bg-slate-400',
    textClassName: 'text-slate-600 dark:text-slate-400',
  },
};

export default async function StatusPage(): Promise<React.ReactElement> {
  const status = await getSystemStatus();
  const overall = statusMeta[status.overall];
  const OverallIcon = overall.icon;
  const bannerClass =
    status.overall === 'operational'
      ? 'border-emerald-500/30 bg-emerald-500/10'
      : status.overall === 'degraded'
        ? 'border-amber-500/30 bg-amber-500/10'
        : 'border-slate-300 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40';

  return (
    <div className="bg-slate-50 text-slate-900 dark:bg-[#050609] dark:text-slate-100">
      <div className="container mx-auto max-w-4xl px-4 py-16 md:px-6">
        <div className="space-y-8">
          <div className="space-y-3">
            <Badge className="border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-xs text-emerald-700 dark:text-emerald-400">
              Live Telemetry Monitor
            </Badge>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 md:text-4xl">
                  DavinTrade System Status
                </h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Last checked {new Date(status.checkedAt).toLocaleString()}
                </p>
              </div>
              <StatusRefreshButton />
            </div>
          </div>

          {/* Overall Banner */}
          <Card className={bannerClass}>
            <CardContent className="flex items-center gap-4 p-6">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${overall.textClassName} ${bannerClass}`}
              >
                <OverallIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h3 className={`text-base font-bold ${overall.textClassName}`}>
                  {status.overall === 'operational'
                    ? 'All Systems Operational'
                    : status.overall === 'degraded'
                      ? 'Some Systems Are Degraded'
                      : 'Status Partially Unavailable'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Live check against this environment -- not a rolling
                  historical average.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Component List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Subsystem Health
            </h3>

            <div className="space-y-2">
              {status.components.map((component) => {
                const meta = statusMeta[component.status];
                const Icon = meta.icon;
                return (
                  <Card
                    key={component.name}
                    className="border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:hover:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
                          <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-200">
                            {component.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {component.detail}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          {component.status === 'operational' && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          )}
                          <span
                            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dotClassName}`}
                          />
                        </span>
                        <span
                          className={`text-xs font-semibold ${meta.textClassName}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center dark:border-slate-800 dark:bg-[#090b14]/60">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              System operations, Flask API terminals, scheduled jobs, and queue
              diagnostics are managed in the Admin Panel.
            </p>
            <a
              href="/admin/system/terminals"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:underline dark:text-amber-400"
            >
              Go to Admin System Panel →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

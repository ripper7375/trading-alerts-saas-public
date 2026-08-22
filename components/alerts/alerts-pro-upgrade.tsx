/**
 * Alerts PRO Upgrade Landing — V8
 *
 * Shown to FREE users in place of the alerts list/creation UI.
 * Alerts are a PRO-exclusive feature in the V8 architecture.
 *
 * @module components/alerts/alerts-pro-upgrade
 */

import { Bell, PenLine, Layers, ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export function AlertsProUpgrade(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      {/* Hero */}
      <div className="text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
          <Bell className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
          Alerts are a PRO feature
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Never miss a move on Gold. PRO members get the full alert and
          notification system for XAUUSD on M5 and M15 — up to 100 alerts,
          delivered by email, push, and SMS.
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6">
          <Bell className="mb-3 h-6 w-6 text-amber-600 dark:text-amber-400" />
          <h3 className="mb-1 font-semibold text-foreground">
            100 Price Alerts
          </h3>
          <p className="text-sm text-muted-foreground">
            Set price-above, price-below, and crossing conditions on XAUUSD
            M5/M15.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <PenLine className="mb-3 h-6 w-6 text-amber-600 dark:text-amber-400" />
          <h3 className="mb-1 font-semibold text-foreground">
            Drawing Line Alerts
          </h3>
          <p className="text-sm text-muted-foreground">
            Draw a trendline or level on the chart and get alerted the moment
            price touches it.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <Layers className="mb-3 h-6 w-6 text-amber-600 dark:text-amber-400" />
          <h3 className="mb-1 font-semibold text-foreground">
            Multi-Timeframe View
          </h3>
          <p className="text-sm text-muted-foreground">
            Overlay M5 structure on M15 charts to time entries with
            higher-timeframe context.
          </p>
        </div>
      </div>

      {/* What you keep on FREE */}
      <div className="bg-muted/40 rounded-xl p-6">
        <p className="mb-3 text-sm font-medium text-foreground">
          Your FREE plan already includes:
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            XAUUSD (Gold) charts on M5 and M15
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Full market data and every indicator overlay — same data as PRO
          </li>
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-8 py-3 font-semibold text-slate-950 shadow-md shadow-amber-500/20 transition-colors hover:from-amber-400 hover:to-amber-500"
        >
          Start 7-Day Free Trial
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-3 text-xs text-muted-foreground">
          Full PRO access during the trial. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

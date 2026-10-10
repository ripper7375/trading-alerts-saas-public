'use client';

/**
 * Report 2 as a card (architecture 6.10, ADR-068; build step 5, part 7).
 *
 * The card is the fixed template drawn: `buildReport2` turns the server's
 * `ValidatedSetup`, the badge and the offer into a document, and this component only
 * lays the document out in the viewer's language. It has no state and makes no call:
 * give it the same answer and it shows the same report. A model writes none of it;
 * every figure is one Engine 4 produced, every label is a reviewed text.
 *
 * Every report carries the three compulsory texts (the single-order notice,
 * "you place the order with your broker", the calculation-tool disclaimer), whether
 * or not the setup passed its checks, and declared and actual risk stand side by side.
 *
 * @module components/report2/report2-card
 */

import { TrendingDown, TrendingUp } from 'lucide-react';
import { useId, type ReactElement, type ReactNode } from 'react';

import { buildReport2, type Shown } from '@/lib/engine4/templates/report2';
import type {
  WireBadgeView,
  WireBlackoutResult,
  WireOfferResult,
  WireValidatedSetup,
} from '@/lib/engine4/templates/wire';
import { cn } from '@/lib/utils';

import { ChecksList } from './checks';
import {
  CompulsoryNotices,
  NotOfferedNotice,
  OfferNotices,
  ReleaseWarnings,
} from './notices';
import { RiskPair } from './risk-pair';
import { RoomAndBadge, ScenarioTable } from './scenario-table';
import { UnderflowHelp } from './underflow-help';
import { useReport2 } from './use-report2';

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-end text-sm font-medium tabular-nums">
        {children}
      </dd>
    </div>
  );
}

export interface Report2CardProps {
  setup: WireValidatedSetup;
  badge: WireBadgeView;
  offer?: WireOfferResult;
  blackout?: WireBlackoutResult;
  className?: string;
}

export function Report2Card({
  setup,
  badge,
  offer,
  blackout,
  className,
}: Report2CardProps): ReactElement {
  const { tr, fig, say, dir } = useReport2();
  const heading = useId();
  const doc = buildReport2({ setup, badge, offer, blackout });
  const long = doc.header.side === 'BUY';
  const Arrow = long ? TrendingUp : TrendingDown;
  const show = (shown: Shown | null): string =>
    shown === null ? '—' : fig(shown);
  const s = doc.setup;

  return (
    <article
      dir={dir}
      aria-labelledby={heading}
      data-testid="report2-card"
      data-template-version={doc.version.template}
      data-disclaimer-version={doc.version.disclaimer}
      data-ok={doc.ok ? 'true' : 'false'}
      className={cn(
        'min-w-0 space-y-5 rounded-lg border bg-card p-4 text-card-foreground shadow-sm sm:p-6',
        className
      )}
    >
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {tr('report2.card.heading')}
        </p>
        <h2 id={heading} className="text-lg font-semibold">
          {tr('report2.title')}
          <span className="ms-2 text-sm font-normal text-muted-foreground">
            {tr('report2.subtitle')}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {doc.header.directionKey === null ? null : (
            <span
              data-testid="report2-card-direction"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
                long
                  ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                  : 'bg-red-500/15 text-red-800 dark:text-red-300'
              )}
            >
              <Arrow className="h-4 w-4" aria-hidden="true" />
              {tr(doc.header.directionKey)}
            </span>
          )}
          {doc.header.directionKey === null ? null : (
            <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
              {tr(
                doc.header.counterTrend
                  ? 'report2.setup.counter_trend'
                  : 'report2.setup.with_trend'
              )}
            </span>
          )}
          {doc.header.pinned === null ? null : (
            <span className="text-xs text-muted-foreground">
              {tr('report2.card.pinned', { time: fig(doc.header.pinned) })}
            </span>
          )}
        </div>
      </header>

      {doc.offerReason === null ? null : (
        <NotOfferedNotice reason={doc.offerReason} />
      )}
      <OfferNotices notices={doc.notices} />

      <section
        aria-label={tr('report2.entry.heading')}
        data-testid="report2-card-setup"
      >
        <dl className="divide-y rounded-md border px-3">
          <Row label={tr('report2.entry.heading')}>
            <bdi>{show(s.entry)}</bdi>
            {s.entrySource === null ? null : (
              <span className="ms-2 text-xs font-normal text-muted-foreground">
                {say(s.entrySource)}
              </span>
            )}
          </Row>
          <Row label={tr('report2.label.stop_price')}>
            <bdi>{show(s.stopPrice)}</bdi>
            {s.stopHow === null ? null : (
              <span className="ms-2 text-xs font-normal text-muted-foreground">
                {say(s.stopHow)}
              </span>
            )}
          </Row>
          {s.stopChartLevel === null ? null : (
            <Row label={tr('report2.label.on_chart')}>
              <bdi>{fig(s.stopChartLevel)}</bdi>
            </Row>
          )}
          <Row label={tr('report2.label.stop_distance')}>
            <bdi>{show(s.stopDistance)}</bdi>
          </Row>
          <Row label={tr('report2.equity.label')}>
            <bdi>{show(s.equity)}</bdi>
          </Row>
          <Row label={tr('report2.risk.label')}>
            <bdi>{show(s.riskPct)}</bdi>
            {s.halfRisk === null ? null : (
              <span className="ms-2 block text-xs font-normal text-muted-foreground sm:inline">
                {tr('report2.risk.half', {
                  preset: fig(s.halfRisk.preset),
                  max: fig(s.halfRisk.max),
                })}
              </span>
            )}
          </Row>
          <Row label={tr('report2.rrr.label')}>
            <bdi>{show(s.rrr)}</bdi>
          </Row>
        </dl>
        {s.halfRisk !== null && s.halfRisk.reasons.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {tr('report2.risk.reasons', {
              reasons: s.halfRisk.reasons.join(', '),
            })}
          </p>
        ) : null}
        {s.override === null ? null : (
          <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
            {tr('report2.risk.override')}
          </p>
        )}
      </section>

      {doc.risk === null ? null : <RiskPair risk={doc.risk} />}
      {doc.underflow === null ? null : <UnderflowHelp help={doc.underflow} />}
      <ScenarioTable scenarios={doc.scenarios} omitted={doc.omitted} />
      <RoomAndBadge room={doc.room} badge={doc.badge} />
      <ReleaseWarnings warnings={doc.warnings} />
      <ChecksList checks={doc.checks} mode="all" />
      <CompulsoryNotices />
    </article>
  );
}

'use client';

/**
 * Declared risk and actual risk, side by side (architecture 6.7 and 6.10, ADR-065).
 *
 * "Declared" is what the trader chose (a percentage of their equity). "Actual" is
 * what the lot they can trade really risks at the stop, commission included, after
 * the lot was rounded DOWN to the broker's lot step. The two are never merged,
 * because the gap between them is the information: at the default profile and
 * today's gold price the leverage limit, not the risk limit, sets the lot, and the
 * actual risk can be a fraction of the declared one (plan decision D17). The report
 * says so in plain words.
 *
 * @module components/report2/risk-pair
 */

import type { ReactElement } from 'react';

import type { RiskPairDoc } from '@/lib/engine4/templates/report2';
import { cn } from '@/lib/utils';

import { useReport2 } from './use-report2';

const DASH = '—';

function Box({
  title,
  money,
  pct,
  hint,
  tone,
}: {
  title: string;
  money: string;
  pct: string;
  hint: string;
  tone: 'declared' | 'actual';
}): ReactElement {
  return (
    <div
      className={cn(
        'min-w-0 rounded-md border p-3',
        tone === 'actual' && 'border-primary/50 bg-primary/5'
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">
        <bdi>{money}</bdi>
      </p>
      <p className="text-sm tabular-nums">
        <bdi>{pct}</bdi>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">
        <bdi>{value}</bdi>
        {note === undefined ? null : (
          <span className="ms-2 text-xs font-normal text-muted-foreground">
            {note}
          </span>
        )}
      </dd>
    </div>
  );
}

export function RiskPair({ risk }: { risk: RiskPairDoc }): ReactElement {
  const { tr, fig, say } = useReport2();
  return (
    <section
      aria-label={tr('report2.pair.heading')}
      data-testid="report2-risk-pair"
      className="space-y-3"
    >
      <h3 className="text-sm font-semibold">{tr('report2.pair.heading')}</h3>
      <div className="grid grid-cols-2 gap-2">
        <Box
          tone="declared"
          title={tr('report2.pair.declared')}
          money={fig(risk.declared.money)}
          pct={fig(risk.declared.pct)}
          hint={tr('report2.pair.declared_hint', {
            pct: fig(risk.declared.pct),
          })}
        />
        <Box
          tone="actual"
          title={tr('report2.pair.actual')}
          money={risk.actual === null ? DASH : fig(risk.actual.money)}
          pct={risk.actual === null ? DASH : fig(risk.actual.pct)}
          hint={tr('report2.pair.actual_hint')}
        />
      </div>
      <dl className="divide-y rounded-md border px-3">
        {risk.lot === null ? null : (
          <Row label={tr('report2.pair.lot')} value={fig(risk.lot)} />
        )}
        {risk.leverageUsed === null ? null : (
          <Row
            label={tr('report2.pair.leverage')}
            value={fig(risk.leverageUsed)}
            note={tr('report2.pair.leverage_limit', {
              max: fig(risk.leverageMax),
            })}
          />
        )}
        <Row label={tr('report2.pair.spread')} value={fig(risk.spread)} />
        <Row
          label={tr('report2.pair.commission')}
          value={fig(risk.commission)}
        />
      </dl>
      {risk.limitedBy === null ? null : (
        <p className="text-sm">{say(risk.limitedBy)}</p>
      )}
      {risk.roundedDown ? (
        <p className="text-xs text-muted-foreground">
          {tr('report2.pair.rounded_down')}
        </p>
      ) : null}
    </section>
  );
}

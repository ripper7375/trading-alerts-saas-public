'use client';

/**
 * The three sized scenarios, and the room to the next opposing level with the badge
 * (architecture 6.5 and 6.7, ADR-063).
 *
 * Normal is the target RRR; Conservative is one notch lower, Aggressive one notch
 * higher (a scenario that would fall outside 1.50 to 3.50, or past the 2.50 cap of
 * a counter-trend setup, is left out and said to be). A scenario is a card, not a
 * table column, so three of them stand side by side on a desktop and stack on a
 * phone with no horizontal scroll.
 *
 * The room section names the level the targets were measured against. When no
 * scenario's target sits before it there is NO badge, and the report says which
 * level stopped it (the 18 Sep example: no badge, 4369.57 named).
 *
 * @module components/report2/scenario-table
 */

import { Award } from 'lucide-react';
import type { ReactElement } from 'react';

import type {
  BadgeDoc,
  OmittedDoc,
  RoomDoc,
  ScenarioDoc,
} from '@/lib/engine4/templates/report2';
import { cn } from '@/lib/utils';

import { useReport2 } from './use-report2';

function Line({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}): ReactElement {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 py-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-sm tabular-nums',
          strong === true && 'font-semibold'
        )}
      >
        <bdi>{value}</bdi>
      </dd>
    </div>
  );
}

export function ScenarioTable({
  scenarios,
  omitted,
}: {
  scenarios: readonly ScenarioDoc[];
  omitted: readonly OmittedDoc[];
}): ReactElement {
  const { tr, fig, say } = useReport2();
  return (
    <section
      aria-label={tr('report2.scenarios.heading')}
      data-testid="report2-scenarios"
      className="space-y-3"
    >
      <h3 className="text-sm font-semibold">
        {tr('report2.scenarios.heading')}
      </h3>
      {scenarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tr('report2.scenarios.empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {scenarios.map((scenario) => (
            <li
              key={scenario.name}
              data-scenario={scenario.name}
              data-badge={scenario.badge ? 'true' : 'false'}
              className={cn(
                'min-w-0 rounded-md border p-3',
                scenario.badge &&
                  'bg-primary/5 border-primary ring-1 ring-primary'
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h4 className="text-sm font-semibold">
                  {tr(scenario.nameKey)}
                </h4>
                {scenario.badge ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                    <Award className="h-3 w-3" aria-hidden="true" />
                    {tr('report2.scenarios.has_badge')}
                  </span>
                ) : null}
              </div>
              <dl className="mt-1 divide-y">
                <Line
                  label={tr('report2.scenarios.rrr')}
                  value={fig(scenario.rrr)}
                />
                <Line
                  label={tr('report2.scenarios.distance')}
                  value={fig(scenario.distance)}
                />
                <Line
                  label={tr('report2.scenarios.target_price')}
                  value={fig(scenario.price)}
                />
                {scenario.chartLevel === null ? null : (
                  <Line
                    label={tr('report2.label.on_chart')}
                    value={fig(scenario.chartLevel)}
                  />
                )}
                <Line
                  label={tr('report2.scenarios.net_profit')}
                  value={
                    scenario.netProfit === null ? '—' : fig(scenario.netProfit)
                  }
                  strong
                />
              </dl>
            </li>
          ))}
        </ul>
      )}
      {omitted.length === 0 ? null : (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {omitted.map((item) => (
            <li key={item.name}>
              {tr('report2.scenarios.omitted', {
                name: tr(item.nameKey),
                reason: say(item.reason),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The next opposing level (named) and the badge it decides. */
export function RoomAndBadge({
  room,
  badge,
}: {
  room: RoomDoc;
  badge: BadgeDoc;
}): ReactElement {
  const { tr, fig, say } = useReport2();
  return (
    <section
      aria-label={tr('report2.room.heading')}
      data-testid="report2-room"
      className="space-y-2"
    >
      <h3 className="text-sm font-semibold">{tr('report2.room.heading')}</h3>
      <p className="text-sm" data-room={room.state}>
        {room.state === 'NAMED'
          ? tr('report2.room.named', {
              level: fig(room.level),
              price: fig(room.price),
              room: fig(room.room),
            })
          : room.state === 'NONE'
            ? tr('report2.room.none')
            : room.state === 'UNKNOWN'
              ? tr('report2.room.unknown')
              : tr('report2.scenarios.empty')}
      </p>
      <div
        className="flex flex-wrap items-center gap-2"
        data-testid="report2-badge"
        data-badge={badge.badge ?? 'NONE'}
      >
        <span className="text-xs font-medium text-muted-foreground">
          {tr('report2.badge.heading')}
        </span>
        {badge.nameKey === null ? (
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
            {tr('report2.badge.none')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            <Award className="h-3 w-3" aria-hidden="true" />
            {tr(badge.nameKey)}
          </span>
        )}
      </div>
      {badge.why === null ? null : (
        <p className="text-sm text-muted-foreground">{say(badge.why)}</p>
      )}
    </section>
  );
}

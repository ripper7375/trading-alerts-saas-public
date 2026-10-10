'use client';

/**
 * The entry pills (architecture 6.13: "zone prices, in rank order"; ADR-033, ADR-034).
 *
 * One pill per zone of the pinned reading, at the zone's reference price, in rank
 * order (Z1 first), plus a pill for an entry of the trader's own. A zone the price has
 * already passed is still drawn so the rank order never shifts under a finger, but it
 * is marked "no longer valid" and cannot be selected. A custom entry must lie inside
 * the bounds the definition gave (the one-day range widened by half its height, and
 * within 5% of the live price); the allowed range is shown beside the field and a
 * value outside it says why. The server checks the same bound again on every size.
 *
 * Built on real radio inputs inside labels, so the keyboard (Tab, arrow keys, Space)
 * and screen readers work without any scripting of their own.
 *
 * @module components/report2/entry-pills
 */

import { Ban } from 'lucide-react';
import { useId, type ReactElement } from 'react';

import { shownEntryRange } from '@/lib/engine4/templates/fields';
import {
  describeCheckCode,
  type MessageLimits,
} from '@/lib/engine4/templates/messages';
import {
  readWire,
  type WireEntryBounds,
  type WirePill,
} from '@/lib/engine4/templates/wire';
import { cn } from '@/lib/utils';

import { useReport2 } from './use-report2';

export type EntrySelection =
  | { kind: 'ZONE'; zoneId: string }
  | { kind: 'CUSTOM' }
  | null;

const PILL =
  'relative inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';

export function EntryPills({
  pills,
  selection,
  onSelectZone,
  onSelectCustom,
  customValue,
  onCustomChange,
  customIssue,
  bounds,
  limits,
  disabled,
}: {
  pills: readonly WirePill[];
  selection: EntrySelection;
  onSelectZone: (zoneId: string) => void;
  onSelectCustom: () => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  /** the code of the check the custom entry fails, or null (the parent decides when to show one) */
  customIssue: string | null;
  bounds: WireEntryBounds;
  limits: MessageLimits;
  disabled?: boolean;
}): ReactElement {
  const { tr, fig, say } = useReport2();
  const group = useId();
  const customId = useId();
  const noteId = useId();
  const errorId = useId();
  const range = shownEntryRange(bounds);
  const customSelected = selection !== null && selection.kind === 'CUSTOM';

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="text-sm font-semibold">
        {tr('report2.entry.zones')}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2" data-testid="report2-pills">
        {pills.map((pill) => {
          const selected =
            selection !== null &&
            selection.kind === 'ZONE' &&
            selection.zoneId === pill.zoneId;
          return (
            <label
              key={pill.zoneId}
              data-zone={pill.zoneId}
              data-invalidated={pill.invalidated ? 'true' : 'false'}
              title={
                pill.invalidated
                  ? tr('report2.entry.invalidated_hint')
                  : undefined
              }
              className={cn(
                PILL,
                pill.invalidated
                  ? 'cursor-not-allowed border-dashed border-red-500/60 bg-red-500/5 text-muted-foreground'
                  : 'cursor-pointer hover:bg-accent',
                selected && 'bg-primary/10 border-primary ring-1 ring-primary'
              )}
            >
              <input
                type="radio"
                name={group}
                value={pill.zoneId}
                className="sr-only"
                checked={selected}
                disabled={disabled === true || pill.invalidated}
                onChange={() => onSelectZone(pill.zoneId)}
              />
              <span className="font-semibold">{pill.zoneId}</span>
              <bdi
                className={cn(
                  'tabular-nums',
                  pill.invalidated && 'line-through'
                )}
              >
                {fig({
                  kind: 'price',
                  text: readWire(pill.price).toDecimal(2),
                })}
              </bdi>
              {pill.invalidated ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-300">
                  <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {tr('report2.entry.invalidated')}
                </span>
              ) : null}
            </label>
          );
        })}
        <label
          data-zone="CUSTOM"
          className={cn(
            PILL,
            'cursor-pointer border-dashed hover:bg-accent',
            customSelected && 'bg-primary/10 border-primary ring-1 ring-primary'
          )}
        >
          <input
            type="radio"
            name={group}
            value="CUSTOM"
            className="sr-only"
            checked={customSelected}
            disabled={disabled}
            onChange={onSelectCustom}
          />
          <span>{tr('report2.entry.own')}</span>
        </label>
      </div>

      {customSelected ? (
        <div className="mt-3 space-y-1" data-testid="report2-custom-entry">
          <label htmlFor={customId} className="text-sm font-medium">
            {tr('report2.entry.custom_label')}
          </label>
          <input
            id={customId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            dir="ltr"
            value={customValue}
            disabled={disabled}
            onChange={(event) => onCustomChange(event.target.value)}
            aria-invalid={customIssue !== null}
            aria-describedby={`${noteId}${customIssue === null ? '' : ` ${errorId}`}`}
            className={cn(
              'w-full max-w-xs rounded-md border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              customIssue !== null && 'border-red-500'
            )}
          />
          <p id={noteId} className="text-xs text-muted-foreground">
            {range === null
              ? tr('report2.entry.custom_unavailable')
              : tr('report2.entry.custom_range', {
                  low: fig({ kind: 'price', text: range.low }),
                  high: fig({ kind: 'price', text: range.high }),
                })}
          </p>
          {customIssue === null ? null : (
            <p
              id={errorId}
              role="alert"
              className="text-xs font-medium text-red-700 dark:text-red-300"
            >
              {say(describeCheckCode(customIssue, limits))}
            </p>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}

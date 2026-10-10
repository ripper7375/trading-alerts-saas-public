'use client';

/**
 * The stop picker (architecture 6.5, ADR-062, plan decision D7).
 *
 * The options are the structure levels on the stop side of the entry whose stop, 50
 * cents beyond the level, is at least the trader's Min SLD away: nearest first, each
 * NAMED ("behind M5 LOEDT"). The nearest three show; the rest sit under "more levels".
 * A zone whose own invalidation has no structure behind it offers the "minimum stop
 * distance" and says so; it is never passed off as a structural level. "Custom"
 * takes a distance of the trader's own, at least their Min SLD. If the levels could
 * not be read, only the zone's own stop is offered and the picker says that other
 * levels are missing: it never guesses a level.
 *
 * With an entry of the trader's own the definition holds no option list (the options
 * depend on the entry), so `choices` is null and only the custom stop is offered.
 *
 * @module components/report2/stop-options
 */

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useId, useState, type ReactElement } from 'react';

import {
  sameStopSelection,
  type StopSelection,
} from '@/lib/engine4/templates/fields';
import {
  describeCheckCode,
  type MessageLimits,
} from '@/lib/engine4/templates/messages';
import {
  readWire,
  type WireStopChoices,
  type WireStopOption,
} from '@/lib/engine4/templates/wire';
import { cn } from '@/lib/utils';

import { Callout } from './notices';
import { useReport2 } from './use-report2';

const ROW =
  'flex min-w-0 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring';

/** D7 (b): the modal shows the nearest three; the rest sit under "more levels". */
export const VISIBLE_STOP_OPTIONS = 3;

export function StopOptions({
  choices,
  selection,
  onSelect,
  customValue,
  onCustomChange,
  customIssue,
  limits,
  minDistance,
  disabled,
}: {
  /** the options behind the picked zone; null for an entry of the trader's own */
  choices: WireStopChoices | null;
  selection: StopSelection;
  onSelect: (selection: StopSelection) => void;
  customValue: string;
  onCustomChange: (value: string) => void;
  customIssue: string | null;
  limits: MessageLimits;
  /** a custom stop is at least this far from the entry */
  minDistance: string;
  disabled?: boolean;
}): ReactElement {
  const { tr, fig, say } = useReport2();
  const group = useId();
  const customId = useId();
  const noteId = useId();
  const errorId = useId();

  const structural = choices === null ? [] : choices.structural;
  const primary = structural.slice(0, VISIBLE_STOP_OPTIONS);
  const more = structural.slice(VISIBLE_STOP_OPTIONS);
  const selectedInMore =
    selection.kind === 'OPTION' &&
    more.some((option) => option.stopPrice === selection.stopPrice);
  const [openMore, setOpenMore] = useState(false);
  const showMore = openMore || selectedInMore;

  const suggestedPrice =
    choices === null
      ? null
      : choices.preselected.kind === 'ZONE_INVALIDATION'
        ? choices.preselected.stopPrice
        : choices.preselected.kind === 'NEAREST_OPTION'
          ? choices.preselected.option.stopPrice
          : null;

  const price = (text: string): string =>
    fig({ kind: 'price', text: readWire(text).toDecimal(2) });

  const optionRow = (option: WireStopOption): ReactElement => {
    const chosen: StopSelection = {
      kind: 'OPTION',
      stopPrice: option.stopPrice,
    };
    const selected = sameStopSelection(selection, chosen);
    const level = `${option.level.tf} ${option.level.name}`;
    return (
      <label
        key={option.stopPrice}
        data-stop={option.stopPrice}
        className={cn(
          ROW,
          selected && 'bg-primary/10 border-primary ring-1 ring-primary'
        )}
      >
        <input
          type="radio"
          name={group}
          className="mt-1 shrink-0"
          checked={selected}
          disabled={disabled}
          onChange={() => onSelect(chosen)}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="font-medium">
              {tr('report2.stop.behind', { level })}
            </span>
            {suggestedPrice !== null && suggestedPrice === option.stopPrice ? (
              <span className="rounded-full border px-1.5 text-[11px] text-muted-foreground">
                {tr('report2.stop.suggested')}
              </span>
            ) : null}
          </span>
          <span className="block text-xs tabular-nums text-muted-foreground">
            <bdi>{price(option.stopPrice)}</bdi>
            {' · '}
            {tr('report2.stop.away', { distance: price(option.stopDistance) })}
          </span>
          {option.alsoAt.length === 0 ? null : (
            <span className="block text-xs text-muted-foreground">
              {tr('report2.stop.also_at', {
                levels: option.alsoAt
                  .map((other) => `${other.tf} ${other.name}`)
                  .join(', '),
              })}
            </span>
          )}
        </span>
      </label>
    );
  };

  const minimum = choices === null ? null : choices.minimumStop;
  const customSelected = selection.kind === 'CUSTOM';
  const minimumSelected = selection.kind === 'MINIMUM';

  return (
    <fieldset className="min-w-0 space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold">
        {tr('report2.stop.heading')}
      </legend>

      {choices !== null && choices.mode === 'DEGRADED' ? (
        <Callout tone="caution" role="status">
          {tr('report2.stop.degraded')}
        </Callout>
      ) : null}

      {structural.length === 0 ? null : (
        <p className="text-xs text-muted-foreground">
          {tr('report2.stop.nearest')}
        </p>
      )}

      <div className="space-y-2" data-testid="report2-stop-options">
        {primary.map(optionRow)}
        {more.length === 0 ? null : (
          <>
            <button
              type="button"
              aria-expanded={showMore}
              disabled={disabled}
              onClick={() => setOpenMore((open) => !open)}
              className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showMore ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {showMore
                ? tr('report2.stop.fewer')
                : tr('report2.stop.more', { count: String(more.length) })}
            </button>
            {showMore ? (
              <div className="space-y-2" data-testid="report2-more-levels">
                {more.map(optionRow)}
              </div>
            ) : null}
          </>
        )}

        {minimum === null ? null : (
          <label
            data-stop="MINIMUM"
            className={cn(
              ROW,
              minimumSelected &&
                'bg-primary/10 border-primary ring-1 ring-primary'
            )}
          >
            <input
              type="radio"
              name={group}
              className="mt-1 shrink-0"
              checked={minimumSelected}
              disabled={disabled}
              onChange={() => onSelect({ kind: 'MINIMUM' })}
            />
            <span className="min-w-0 flex-1">
              <span className="font-medium">{tr('report2.stop.minimum')}</span>
              <span className="block text-xs tabular-nums text-muted-foreground">
                <bdi>{price(minimum.stopPrice)}</bdi>
                {' · '}
                {tr('report2.stop.away', {
                  distance: price(minimum.stopDistance),
                })}
              </span>
              <span className="block text-xs text-muted-foreground">
                {tr('report2.stop.minimum_note')}
              </span>
            </span>
          </label>
        )}

        <label
          data-stop="CUSTOM"
          className={cn(
            ROW,
            customSelected && 'bg-primary/10 border-primary ring-1 ring-primary'
          )}
        >
          <input
            type="radio"
            name={group}
            className="mt-1 shrink-0"
            checked={customSelected}
            disabled={disabled}
            onChange={() => onSelect({ kind: 'CUSTOM' })}
          />
          <span className="min-w-0 flex-1 font-medium">
            {tr('report2.stop.custom')}
          </span>
        </label>
      </div>

      {customSelected ? (
        <div className="space-y-1" data-testid="report2-custom-stop">
          <label htmlFor={customId} className="text-sm font-medium">
            {tr('report2.stop.custom_label')}
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
            {tr('report2.stop.custom_hint', { min: price(minDistance) })}
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

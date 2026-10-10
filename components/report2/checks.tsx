'use client';

/**
 * The eight checks of the single validator (architecture 6.10), as the trader reads
 * them: which passed, and for each that did not, why, in their language. The card
 * lists all eight; the modal lists only the ones that failed (a trader editing a
 * field does not need eight green ticks, but must see what blocks Accept).
 *
 * @module components/report2/checks
 */

import { CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import type { ReactElement } from 'react';

import type { CheckDoc } from '@/lib/engine4/templates/report2';
import type { Report2Key } from '@/lib/engine4/templates/text';
import { cn } from '@/lib/utils';

import { useReport2 } from './use-report2';

const STATUS_KEYS: Record<CheckDoc['status'], Report2Key> = {
  PASS: 'report2.check.pass',
  FAIL: 'report2.check.fail',
  SKIPPED: 'report2.check.skipped',
};

export function ChecksList({
  checks,
  mode,
  hideKeys,
}: {
  checks: readonly CheckDoc[];
  /** `all`: every check with its status; `failures`: only the ones that failed */
  mode: 'all' | 'failures';
  /** message keys already shown beside a field, so the same sentence is not said twice */
  hideKeys?: ReadonlySet<string>;
}): ReactElement | null {
  const { tr, say } = useReport2();
  const passed = checks.filter((check) => check.status === 'PASS').length;

  if (mode === 'failures') {
    const hidden = hideKeys ?? new Set<string>();
    const rows = checks
      .filter((check) => check.status === 'FAIL')
      .map((check) => ({
        check,
        messages: check.messages.filter((message) => !hidden.has(message.key)),
      }))
      .filter((row) => row.messages.length > 0);
    if (rows.length === 0) return null;
    return (
      <ul
        className="space-y-1 text-sm text-red-700 dark:text-red-300"
        data-testid="report2-failed-checks"
      >
        {rows.map(({ check, messages }) => (
          <li key={check.id} className="flex items-start gap-1.5">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">
              <span className="font-medium">{tr(check.nameKey)}: </span>
              {messages.map((message) => say(message)).join(' ')}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section
      aria-label={tr('report2.checks.heading')}
      data-testid="report2-checks"
      className="space-y-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {tr('report2.checks.heading')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {tr('report2.checks.passed', {
            passed: String(passed),
            total: String(checks.length),
          })}
        </p>
      </div>
      <ul className="divide-y rounded-md border px-3">
        {checks.map((check) => (
          <li
            key={check.id}
            data-check={check.id}
            data-status={check.status}
            className="flex items-start gap-2 py-2 text-sm"
          >
            {check.status === 'PASS' ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            ) : check.status === 'FAIL' ? (
              <XCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                aria-hidden="true"
              />
            ) : (
              <CircleDashed
                className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            <span className="min-w-0 flex-1 break-words">
              <span className="font-medium">{tr(check.nameKey)}</span>
              <span
                className={cn(
                  'ms-2 text-xs',
                  check.status === 'FAIL'
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-muted-foreground'
                )}
              >
                {tr(STATUS_KEYS[check.status])}
              </span>
              {check.messages.length === 0 ? null : (
                <span className="block text-xs text-muted-foreground">
                  {check.messages.map((message) => say(message)).join(' ')}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

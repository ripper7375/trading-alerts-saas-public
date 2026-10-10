'use client';

/**
 * A lot below the broker's minimum (architecture 6.8, plan decision D4).
 *
 * Report 2 never rounds a lot up to the minimum. The help it offers stays inside the
 * trader's own limits: a risk percentage that is at or under Max RPT, a nearer
 * structural stop, or Decline. What equity the setup would need is stated as a FACT,
 * never as a button and never as a number to type: the trader's equity is their real
 * balance, and the report does not suggest entering another one. No option raises
 * the leverage limit.
 *
 * @module components/report2/underflow-help
 */

import type { ReactElement } from 'react';

import type {
  UnderflowActionDoc,
  UnderflowDoc,
} from '@/lib/engine4/templates/report2';

import { Callout } from './notices';
import { useReport2 } from './use-report2';

export function UnderflowHelp({
  help,
  onApply,
  disabled,
}: {
  help: UnderflowDoc;
  /** the trader pressed an option: the modal puts the figure in its field */
  onApply?: (action: UnderflowActionDoc) => void;
  disabled?: boolean;
}): ReactElement {
  const { tr, fig, say } = useReport2();
  return (
    <Callout tone="caution" role="alert" className="space-y-2">
      <div className="space-y-2" data-testid="report2-underflow">
        <p className="font-medium">{tr('report2.underflow.heading')}</p>
        <p>
          {tr('report2.underflow.body', {
            loss: fig(help.minLotLoss),
            pct: fig(help.minLotRiskPct),
          })}
        </p>
        {help.facts.length === 0 ? null : (
          <ul className="list-disc space-y-0.5 ps-5">
            {help.facts.map((fact) => (
              <li key={fact.key}>{say(fact)}</li>
            ))}
          </ul>
        )}
        {help.actions.length === 0 || onApply === undefined ? null : (
          <div>
            <p className="text-xs font-medium">
              {tr('report2.underflow.options')}
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {help.actions.map((action) => (
                <button
                  key={
                    action.kind === 'RAISE_RISK'
                      ? `risk-${action.riskPct}`
                      : `stop-${action.stopDistance}`
                  }
                  type="button"
                  disabled={disabled}
                  onClick={() => onApply(action)}
                  className="hover:bg-foreground/5 rounded-md border border-current px-2.5 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  {say(action.label)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Callout>
  );
}

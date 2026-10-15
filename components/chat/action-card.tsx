'use client';

/**
 * The reply to "open the trade setup" (build step 7 part 8; plan part 7: a REPORT_2 request makes NO
 * model call): nothing to read, only the button that opens Report 2's Trade Setup modal over the cycle
 * and the zones the server named. Sizing is Engine 4's and runs there.
 *
 * @module components/chat/action-card
 */

import type { ReactElement } from 'react';

import { AiNotice } from './ai-notice';
import { DataStampLine } from './data-stamp';
import { OpenSetupButton, ReplyNotes } from './reply-extras';
import type { ActionResult, TradeSetupAction } from './types';

export function ActionCard({
  result,
  onOpenTradeSetup,
}: {
  result: ActionResult;
  /** left out, no button is drawn (a recorded example) */
  onOpenTradeSetup?: (action: TradeSetupAction) => void;
}): ReactElement {
  return (
    <article
      data-testid="action-card"
      data-kind="ACTION"
      className="space-y-2.5 rounded-xl border border-border bg-card p-3 text-xs shadow-sm"
    >
      {onOpenTradeSetup === undefined ? null : (
        <OpenSetupButton action={result.action} onOpen={onOpenTradeSetup} />
      )}
      <DataStampLine stamp={result.stamp} />
      <ReplyNotes result={result} />
      <AiNotice result={result} />
    </article>
  );
}

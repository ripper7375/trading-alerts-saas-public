'use client';

/**
 * One reply, whatever its kind (build step 7 part 8): the full Report 1, a short answer, the answer
 * from the sensor board, or the Trade Setup action. The kind is the server's (`reply-result/1`); the
 * panel never decides it.
 *
 * @module components/chat/result-card
 */

import type { ReactElement } from 'react';

import { ActionCard } from './action-card';
import { AnswerCard } from './answer-card';
import { FixedAnswerCard } from './fixed-answer-card';
import { Report1Card } from './report1-card';
import type { ReplyResult, TradeSetupAction } from './types';

export function ResultCard({
  result,
  onOpenTradeSetup,
}: {
  result: ReplyResult;
  /** left out, no button is drawn (a recorded example) */
  onOpenTradeSetup?: (action: TradeSetupAction) => void;
}): ReactElement {
  switch (result.kind) {
    case 'REPORT1':
      return (
        <Report1Card
          result={result}
          {...(onOpenTradeSetup === undefined ? {} : { onOpenTradeSetup })}
        />
      );
    case 'ANSWER':
      return (
        <AnswerCard
          result={result}
          {...(onOpenTradeSetup === undefined ? {} : { onOpenTradeSetup })}
        />
      );
    case 'FIXED_ANSWER':
      return <FixedAnswerCard result={result} />;
    case 'ACTION':
      return (
        <ActionCard
          result={result}
          {...(onOpenTradeSetup === undefined ? {} : { onOpenTradeSetup })}
        />
      );
  }
}

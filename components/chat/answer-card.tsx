'use client';

/**
 * A short answer (build step 7 part 8; `answer.v1`, plan decision D9): the text the model wrote for a
 * question that is not a full analysis (exit targets, risk sizing, an explanation, the news), its
 * placeholders already filled and any figure it could not verify already marked. It may carry ONE
 * action, the Trade Setup button (a risk-sizing question points there instead of sizing: sizing is
 * Engine 4's and the model never computes a position).
 *
 * @module components/chat/answer-card
 */

import type { ReactElement } from 'react';

import { textDirection } from '@/lib/i18n/languages';

import { AiNotice } from './ai-notice';
import { DataStampLine } from './data-stamp';
import { ChangesList, OpenSetupButton, ReplyNotes } from './reply-extras';
import type { AnswerResult, TradeSetupAction } from './types';
import { useChatWords } from './use-chat-words';

export interface AnswerCardProps {
  result: AnswerResult;
  /** the Trade Setup button; left out, no button is drawn (a recorded example) */
  onOpenTradeSetup?: (action: TradeSetupAction) => void;
}

export function AnswerCard({
  result,
  onOpenTradeSetup,
}: AnswerCardProps): ReactElement {
  const { tr, inline } = useChatWords();
  const locale = result.reply_locale;
  const cites = result.answer.cites;
  return (
    <article
      data-testid="answer-card"
      data-kind="ANSWER"
      className="space-y-2.5 rounded-xl border border-border bg-card p-3 text-xs shadow-sm"
    >
      <p
        lang={locale}
        dir={textDirection(locale)}
        data-testid="answer-text"
        className="break-words text-sm leading-relaxed"
      >
        {result.answer.text}
      </p>
      {cites.length === 0 ? null : (
        <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          {tr('chat.answer.cites', {
            ids: cites.map((cite) => inline(cite)).join(', '),
          })}
        </p>
      )}
      <DataStampLine stamp={result.stamp} />
      <ChangesList changes={result.changes} />
      <ReplyNotes result={result} />
      {result.action === null || onOpenTradeSetup === undefined ? null : (
        <OpenSetupButton action={result.action} onOpen={onOpenTradeSetup} />
      )}
      <AiNotice result={result} />
    </article>
  );
}

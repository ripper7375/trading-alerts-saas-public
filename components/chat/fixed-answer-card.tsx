'use client';

/**
 * The answer built from the sensor board (build step 7 part 8; architecture 5.9, 7.6; plan decision
 * D20): what the reader gets when no model may or can answer. The data stopped (no direction, the
 * stamp is the stop time), the written analysis failed its checks twice, the schema was still wrong
 * after the one retry, both models are down, the request ran out of time, the market is closed, or no
 * synthesis reading exists.
 *
 * It carries no free text from a sensor: a direction word (or none), a rule id, each sensor's status
 * and state code, the levels, the stamp. Those are the same in all 19 languages, so the one sentence
 * that says WHY is the only thing translated, from a code (`fixed.reason`).
 *
 * @module components/chat/fixed-answer-card
 */

import { LayoutList } from 'lucide-react';
import type { ReactElement } from 'react';

import { AiNotice } from './ai-notice';
import { DataStampLine } from './data-stamp';
import { DirectionLine } from './direction-line';
import { Code, Pill } from './figure';
import { ChangesList, ReplyNotes } from './reply-extras';
import { Level, STATUS_KEY, STATUS_TONE } from './report1-card';
import type { ChatKey } from './text';
import type { FixedAnswerResult, FixedReason } from './types';
import { useChatWords } from './use-chat-words';

const REASON_KEY: Record<FixedReason, ChatKey> = {
  DATA_STALE: 'chat.fixed.reason.DATA_STALE',
  WORDING_FAILED: 'chat.fixed.reason.WORDING_FAILED',
  SCHEMA_FAILED: 'chat.fixed.reason.SCHEMA_FAILED',
  MODEL_UNAVAILABLE: 'chat.fixed.reason.MODEL_UNAVAILABLE',
  DEADLINE: 'chat.fixed.reason.DEADLINE',
  MARKET_CLOSED: 'chat.fixed.reason.MARKET_CLOSED',
  NO_SYNTHESIS: 'chat.fixed.reason.NO_SYNTHESIS',
};

export function FixedAnswerCard({
  result,
}: {
  result: FixedAnswerResult;
}): ReactElement {
  const { tr } = useChatWords();
  const { fixed } = result;
  const uid = `fx-${result.provenance.request_id.slice(0, 12)}`;
  return (
    <article
      data-testid="fixed-answer-card"
      data-kind="FIXED_ANSWER"
      data-reason={fixed.reason}
      aria-labelledby={`${uid}-title`}
      className="space-y-3 rounded-xl border border-amber-500/40 bg-card p-3 text-xs shadow-sm"
    >
      <h3
        id={`${uid}-title`}
        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400"
      >
        <LayoutList className="h-3.5 w-3.5" aria-hidden="true" />
        {tr('chat.fixed.title')}
      </h3>
      <p
        data-testid="fixed-reason"
        className="break-words text-sm leading-relaxed"
      >
        {tr(REASON_KEY[fixed.reason])}
      </p>
      {fixed.direction === null ? (
        <p data-testid="no-direction" className="font-semibold">
          {tr('chat.fixed.no_direction')}
        </p>
      ) : (
        <DirectionLine direction={fixed.direction} />
      )}
      <DataStampLine stamp={result.stamp} />

      {fixed.board.length === 0 ? null : (
        <section aria-label={tr('chat.fixed.board')} className="space-y-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            {tr('chat.fixed.board')}
          </h4>
          <ul className="space-y-1">
            {fixed.board.map((line) => (
              <li
                key={line.mcd_id}
                data-testid="board-line"
                className="border-border/60 flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1"
              >
                <Code>{line.mcd_id}</Code>
                <Pill tone={STATUS_TONE[line.status]}>
                  {tr(STATUS_KEY[line.status])}
                </Pill>
                {line.state_code === null ? null : (
                  <Code>{line.state_code}</Code>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {fixed.levels.length === 0 ? null : (
        <ul className="space-y-1">
          {fixed.levels.map((level) => (
            <Level key={level.id} level={level} />
          ))}
        </ul>
      )}

      <ChangesList changes={result.changes} />
      <ReplyNotes result={result} />
      <AiNotice result={result} />
    </article>
  );
}

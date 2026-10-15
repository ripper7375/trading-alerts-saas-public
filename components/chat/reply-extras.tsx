'use client';

/**
 * The parts several cards share (build step 7 part 8): the model's lines, the notes about the reply's
 * own inputs, the count of numbers that could not be verified, what changed since the last answer, and
 * the Trade Setup button.
 *
 * A model's line arrives with its figures ALREADY filled by id and formatted for the reply's language,
 * and a number that could not be verified is ALREADY the "not verified" mark of that language
 * (`lib/reply/checks/number-check.ts`). Nothing here reads a number out of a line or puts the model's
 * own digits back: a line is drawn as it came, in its own language and direction (`lang`, `dir`).
 *
 * @module components/chat/reply-extras
 */

import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { textDirection } from '@/lib/i18n/languages';

import { Code, Pill } from './figure';
import type { ChatKey } from './text';
import type {
  Locale,
  ReplyResult,
  ResolvedLine,
  ResultNote,
  StateChange,
  TradeSetupAction,
} from './types';
import { useChatWords } from './use-chat-words';

/** A model's lines: the text as it came, then the ids it rests on as small codes. */
export function ReplyLines({
  lines,
  locale,
  testId,
}: {
  lines: readonly ResolvedLine[];
  locale: Locale;
  testId?: string;
}): ReactElement | null {
  if (lines.length === 0) return null;
  return (
    <ul
      data-testid={testId}
      className="list-disc space-y-1 ps-4 text-xs leading-relaxed"
    >
      {lines.map((line, index) => (
        <li key={index} className="break-words">
          <span lang={locale} dir={textDirection(locale)}>
            {line.text}
          </span>
          {line.cites.length === 0 ? null : (
            <span className="ms-1.5 inline-flex flex-wrap gap-1 align-baseline text-muted-foreground">
              {line.cites.map((cite) => (
                <Code key={cite}>{cite}</Code>
              ))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

const NOTE_KEY: Record<ResultNote, ChatKey> = {
  CHART_OTHER_CYCLE: 'chat.note.CHART_OTHER_CYCLE',
  CHART_UNAVAILABLE: 'chat.note.CHART_UNAVAILABLE',
};

/** What the reply says about its own inputs (a chart that was dropped), from codes, in the reader's words. */
export function ReplyNotes({
  result,
}: {
  result: ReplyResult;
}): ReactElement | null {
  const { tr, count, inline } = useChatWords();
  const flagged = result.checks.numbers_flagged;
  if (result.notes.length === 0 && flagged === 0) return null;
  return (
    <ul
      data-testid="reply-notes"
      className="space-y-1 text-[11px] text-muted-foreground"
    >
      {result.notes.map((note) => (
        <li key={note}>{tr(NOTE_KEY[note])}</li>
      ))}
      {flagged === 0 ? null : (
        <li data-testid="flagged-note">
          {tr('chat.flagged.note', { count: inline(count(flagged)) })}
        </li>
      )}
    </ul>
  );
}

/** The sensors whose state moved since the last answer of the thread. */
export function ChangesList({
  changes,
}: {
  changes: readonly StateChange[];
}): ReactElement | null {
  const { tr } = useChatWords();
  if (changes.length === 0) return null;
  const none = tr('chat.changes.none');
  return (
    <div data-testid="changes" className="space-y-1">
      <p className="text-[11px] font-semibold text-muted-foreground">
        {tr('chat.changes.title')}
      </p>
      <ul className="space-y-0.5 text-xs">
        {changes.map((change) => (
          <li key={change.mcd_id} className="flex flex-wrap items-center gap-1">
            <Code>{change.mcd_id}</Code>
            <Pill>
              {change.from === null ? none : <Code>{change.from}</Code>}
            </Pill>
            <span aria-hidden="true">→</span>
            <Pill>{change.to === null ? none : <Code>{change.to}</Code>}</Pill>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The Trade Setup button: it opens Report 2's modal over the same cycle and zones. */
export function OpenSetupButton({
  action,
  onOpen,
  disabled = false,
}: {
  action: TradeSetupAction;
  onOpen: (action: TradeSetupAction) => void;
  disabled?: boolean;
}): ReactElement {
  const { tr } = useChatWords();
  return (
    <div data-testid="open-setup" className="space-y-1">
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        onClick={() => onOpen(action)}
        className="h-7 bg-amber-500 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
      >
        {tr('chat.action.open_setup')}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {tr('chat.action.hint')}
      </p>
    </div>
  );
}

'use client';

/**
 * The stages a request goes through while its answer is made (build step 7 part 8; ADR-054: the stages
 * are PROGRESS, the checked reply is delivered whole): gate, understand, data, context, model, checks.
 *
 * It is a live region for a screen reader: the list is `aria-live="polite"`, and each item carries its
 * state as text (`waiting`, `in progress`, `done`, `skipped`), so a change is announced in the reader's
 * language and the colour and icon are never the only signal. A stage a request never reaches (the
 * Understand call of a button press) is SKIPPED and says so. The Stop button ends the request; before
 * the model is called that costs nothing.
 *
 * @module components/chat/progress-stages
 */

import { Check, Circle, Loader2, Minus } from 'lucide-react';
import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { StageState } from './chat-state';
import { STAGES } from './limits';
import type { ChatKey } from './text';
import type { ReplyStage } from './types';
import { useChatWords } from './use-chat-words';

const STAGE_KEY: Record<ReplyStage, ChatKey> = {
  GATE: 'chat.stage.GATE',
  UNDERSTAND: 'chat.stage.UNDERSTAND',
  DATA: 'chat.stage.DATA',
  CONTEXT: 'chat.stage.CONTEXT',
  MODEL: 'chat.stage.MODEL',
  CHECKS: 'chat.stage.CHECKS',
};

const STATE_KEY: Record<StageState, ChatKey> = {
  PENDING: 'chat.stage.waiting',
  STARTED: 'chat.stage.active',
  DONE: 'chat.stage.done',
  SKIPPED: 'chat.stage.skipped',
};

function Icon({ state }: { state: StageState }): ReactElement {
  const className = 'h-3.5 w-3.5 shrink-0';
  switch (state) {
    case 'DONE':
      return (
        <Check
          className={cn(className, 'text-emerald-600 dark:text-emerald-400')}
          aria-hidden="true"
        />
      );
    case 'STARTED':
      return (
        <Loader2
          className={cn(
            className,
            'text-amber-600 motion-safe:animate-spin dark:text-amber-400'
          )}
          aria-hidden="true"
        />
      );
    case 'SKIPPED':
      return (
        <Minus
          className={cn(className, 'text-muted-foreground')}
          aria-hidden="true"
        />
      );
    case 'PENDING':
      return (
        <Circle
          className={cn(className, 'text-muted-foreground/50')}
          aria-hidden="true"
        />
      );
  }
}

export interface ProgressStagesProps {
  stages: Readonly<Record<ReplyStage, StageState>>;
  /** the Stop button; left out, none is drawn */
  onStop?: () => void;
}

export function ProgressStages({
  stages,
  onStop,
}: ProgressStagesProps): ReactElement {
  const { tr } = useChatWords();
  return (
    <div
      data-testid="progress-stages"
      aria-busy="true"
      className="bg-muted/30 space-y-2 rounded-xl border border-border p-3 text-xs"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {tr('chat.stages.label')}
      </p>
      <ol
        aria-live="polite"
        aria-atomic="false"
        aria-label={tr('chat.stages.label')}
        className="space-y-1"
      >
        {STAGES.map((stage) => {
          const state = stages[stage];
          return (
            <li
              key={stage}
              data-stage={stage}
              data-state={state}
              className={cn(
                'flex items-center gap-2',
                state === 'PENDING' || state === 'SKIPPED'
                  ? 'text-muted-foreground'
                  : 'text-foreground',
                state === 'STARTED' && 'font-semibold'
              )}
            >
              <Icon state={state} />
              <span>{tr(STAGE_KEY[stage])}</span>
              <span className="sr-only">{tr(STATE_KEY[state])}</span>
            </li>
          );
        })}
      </ol>
      {onStop === undefined ? null : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onStop}
          className="h-6 px-2 text-[11px]"
        >
          {tr('chat.composer.stop')}
        </Button>
      )}
    </div>
  );
}

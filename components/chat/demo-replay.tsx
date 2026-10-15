'use client';

/**
 * The recorded example the Free tier sees (build step 7 part 8; architecture 7.3; ADR-072, plan
 * decision D19): a real conversation of a golden scenario, replayed from storage, so it costs nothing
 * per view and no model is called.
 *
 * It is labelled "Recorded example, data as of ..." at the top, in a banner that cannot be missed,
 * because a replayed picture of the market must never be mistaken for live data. The cards are the
 * real ones the live panel draws, fed the recorded replies, with no Trade Setup button (there is no
 * live cycle to size on). The recording itself is content (`config/reply/demo/`, build step 7 part
 * 10); until it exists the panel says the example is not available yet.
 *
 * @module components/chat/demo-replay
 */

import { Lock } from 'lucide-react';
import type { ReactElement } from 'react';

import { UserBubble } from './message-list';
import { ResultCard } from './result-card';
import type { DemoRecording } from './types';
import { useChatWords } from './use-chat-words';

export function DemoReplay({
  demo,
}: {
  demo: DemoRecording | null;
}): ReactElement {
  const { tr, time, inline } = useChatWords();

  return (
    <div
      data-testid="demo-replay"
      className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3"
    >
      {demo === null ? (
        <p
          role="status"
          data-testid="demo-empty"
          className="bg-muted/30 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
        >
          {tr('chat.demo.empty')}
        </p>
      ) : (
        <>
          <div
            role="note"
            data-testid="demo-banner"
            className="space-y-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs"
          >
            <p className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span data-testid="demo-label">
                {tr('chat.demo.label', { time: inline(time(demo.as_of)) })}
              </span>
            </p>
            <p className="text-muted-foreground">{tr('chat.demo.body')}</p>
          </div>
          {demo.turns.map((turn, index) => (
            <div key={index} data-testid="demo-turn" className="space-y-3">
              <UserBubble
                input={
                  turn.instant !== null
                    ? { kind: 'INSTANT', intent: turn.instant }
                    : { kind: 'TYPED', question: turn.question ?? '' }
                }
              />
              <ResultCard result={turn.result} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

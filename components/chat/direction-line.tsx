'use client';

/**
 * The direction of a reply (build step 7 part 8; architecture 5.7; ADR-052): the bias, the trend
 * relation, the rule and the archetype, COPIED by the server from the synthesis reading for the
 * trader's type. The model has no say in it, and the card says so in a line of its own, so a reader
 * knows where the direction comes from. The rule id and the archetype letter are codes and stay
 * untranslated, left to right.
 *
 * @module components/chat/direction-line
 */

import type { ReactElement } from 'react';

import { Pill, type Tone } from './figure';
import type { ChatKey } from './text';
import type { Bias, DirectionLine as Direction, TraderType } from './types';
import { useChatWords } from './use-chat-words';

const BIAS_TONE: Record<Bias, Tone> = {
  LONG: 'good',
  SHORT: 'bad',
  NEUTRAL: 'neutral',
  STAND_ASIDE: 'warn',
};

const BIAS_KEY: Record<Bias, ChatKey> = {
  LONG: 'chat.bias.LONG',
  SHORT: 'chat.bias.SHORT',
  NEUTRAL: 'chat.bias.NEUTRAL',
  STAND_ASIDE: 'chat.bias.STAND_ASIDE',
};

export const PROFILE_KEY: Record<TraderType, ChatKey> = {
  DAY_TRADER: 'chat.profile.DAY_TRADER',
  SCALPER: 'chat.profile.SCALPER',
};

export function BiasPill({ bias }: { bias: Bias }): ReactElement {
  const { tr } = useChatWords();
  return (
    <Pill tone={BIAS_TONE[bias]} testId="bias-pill">
      {tr(BIAS_KEY[bias])}
    </Pill>
  );
}

export function DirectionLine({
  direction,
}: {
  direction: Direction;
}): ReactElement {
  const { tr, inline } = useChatWords();
  return (
    <div data-testid="direction-line" className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="sr-only">{tr('chat.direction.label')}</span>
        <BiasPill bias={direction.bias} />
        {direction.trend_relation === null ? null : (
          <Pill>
            {tr(
              direction.trend_relation === 'WITH_TREND'
                ? 'chat.trend.WITH_TREND'
                : 'chat.trend.COUNTER_TREND'
            )}
          </Pill>
        )}
        <Pill>{tr(PROFILE_KEY[direction.profile])}</Pill>
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span>
          {tr('chat.direction.rule', {
            rule: inline(direction.rule_id),
          })}
        </span>
        {direction.archetype === null ? null : (
          <span>
            {tr('chat.direction.archetype', {
              archetype: inline(direction.archetype),
            })}
          </span>
        )}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {tr('chat.direction.note')}
      </p>
    </div>
  );
}

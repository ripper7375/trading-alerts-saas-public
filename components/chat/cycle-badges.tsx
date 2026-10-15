'use client';

/**
 * The badges in the panel's header (build step 7 part 8): the cycle the data is on and its status, and
 * the trader's type (day trader or scalper). Both come from `GET /api/chat/state`; either is null when
 * the server could not read it, and a badge that is not known is not drawn rather than guessed.
 *
 * @module components/chat/cycle-badges
 */

import type { ReactElement } from 'react';

import { StatusPill } from './data-stamp';
import { PROFILE_KEY } from './direction-line';
import { Pill } from './figure';
import type { ChatInfo } from './types';
import { useChatWords } from './use-chat-words';

export function CycleBadges({
  info,
}: {
  info: ChatInfo | null;
}): ReactElement | null {
  const { tr, time, inline } = useChatWords();
  if (info === null) return null;
  const { cycle, profile } = info;
  if (cycle === null && profile === null) return null;
  return (
    <div
      data-testid="cycle-badges"
      className="border-border/70 flex flex-wrap items-center gap-1 border-b px-3.5 py-1.5"
    >
      {cycle === null ? null : (
        <>
          <Pill testId="cycle-badge">
            {cycle.slot === null
              ? tr('chat.badge.no_cycle')
              : tr('chat.badge.cycle', { time: inline(time(cycle.slot)) })}
          </Pill>
          <StatusPill status={cycle.data_status} />
        </>
      )}
      {profile === null ? null : (
        <Pill tone="info" testId="profile-badge">
          {tr(PROFILE_KEY[profile.trader_type])}
        </Pill>
      )}
    </div>
  );
}

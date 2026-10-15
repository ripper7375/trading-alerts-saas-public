'use client';

/**
 * The data stamp of a reply (build step 7 part 8; architecture 5.3, 5.7): which cycle the reply is
 * about, whether the data is live, and anything the reader must know about the data. The stamp is data
 * (`stamp` of `reply-result/1`); the time is formatted here, in the reader's zone and format, so no
 * translated string is made twice.
 *
 * @module components/chat/data-stamp
 */

import type { ReactElement } from 'react';

import { Pill, type Tone } from './figure';
import type { ChatKey } from './text';
import type { DataFlag, DataStamp as Stamp, DataStatus } from './types';
import { useChatWords } from './use-chat-words';

const STATUS_TONE: Record<DataStatus, Tone> = {
  FRESH: 'good',
  DELAYED: 'warn',
  STALE: 'bad',
  MARKET_CLOSED: 'neutral',
  UNKNOWN: 'neutral',
};

const STATUS_KEY: Record<DataStatus, ChatKey> = {
  FRESH: 'chat.status.FRESH',
  DELAYED: 'chat.status.DELAYED',
  STALE: 'chat.status.STALE',
  MARKET_CLOSED: 'chat.status.MARKET_CLOSED',
  UNKNOWN: 'chat.status.UNKNOWN',
};

const FLAG_KEY: Record<DataFlag, ChatKey> = {
  SENSORS_NOT_LIVE: 'chat.flag.SENSORS_NOT_LIVE',
  GATEWAY_UNREACHABLE: 'chat.flag.GATEWAY_UNREACHABLE',
};

/** The status of the data as a pill (used by the stamp and by the header badges). */
export function StatusPill({ status }: { status: DataStatus }): ReactElement {
  const { tr } = useChatWords();
  return (
    <Pill tone={STATUS_TONE[status]} testId="status-pill">
      {tr(STATUS_KEY[status])}
    </Pill>
  );
}

export function DataStampLine({ stamp }: { stamp: Stamp }): ReactElement {
  const { tr, time, inline } = useChatWords();
  return (
    <div
      data-testid="data-stamp"
      className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"
    >
      <span>
        {stamp.as_of === null
          ? tr('chat.stamp.no_cycle')
          : tr('chat.stamp.as_of', { time: inline(time(stamp.as_of)) })}
      </span>
      <StatusPill status={stamp.data_status} />
      {stamp.retuning ? (
        <Pill tone="warn">{tr('chat.stamp.retuning')}</Pill>
      ) : null}
      {stamp.flags.map((flag) => (
        <Pill key={flag} tone="warn">
          {tr(FLAG_KEY[flag])}
        </Pill>
      ))}
    </div>
  );
}

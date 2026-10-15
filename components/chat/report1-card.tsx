'use client';

/**
 * Report 1 as the trader reads it (build step 7 part 8; architecture 5.7, ADR-052): the headline and
 * the direction, then six sections: alignment, levels, entry zones with their invalidation and room,
 * what would change the picture, risks and news. The server composed the whole of it
 * (`lib/reply/report1/compose.ts`): the model's words with their figures filled by id, the engines'
 * levels and zones, the direction copied from the synthesis reading, the data stamp.
 *
 * This component only draws it. It adds no number and no direction of its own; a figure the engines
 * gave is written in the same style as the lines around it (`format.ts`), and a code (a sensor, a
 * level, a state, a zone, a rule) is shown as it came, left to right, in every language.
 *
 * @module components/chat/report1-card
 */

import { FileText } from 'lucide-react';
import type { ReactElement } from 'react';

import { textDirection } from '@/lib/i18n/languages';

import { AiNotice } from './ai-notice';
import { DataStampLine } from './data-stamp';
import { BiasPill, DirectionLine } from './direction-line';
import { Code, Figure, Pill, Row, Section, type Tone } from './figure';
import {
  ChangesList,
  OpenSetupButton,
  ReplyLines,
  ReplyNotes,
} from './reply-extras';
import type { ChatKey } from './text';
import type {
  BoardStatus,
  ChannelLine,
  ComposedZone,
  EventsStatus,
  LevelLine,
  NewsBlock,
  Report1Result,
  TradeSetupAction,
} from './types';
import { useChatWords } from './use-chat-words';

export const STATUS_TONE: Record<BoardStatus, Tone> = {
  VALID: 'good',
  CAUTIONARY: 'warn',
  INVALID: 'bad',
  STALE: 'bad',
  ABSENT: 'neutral',
};

export const STATUS_KEY: Record<BoardStatus, ChatKey> = {
  VALID: 'chat.channel.status.VALID',
  CAUTIONARY: 'chat.channel.status.CAUTIONARY',
  INVALID: 'chat.channel.status.INVALID',
  STALE: 'chat.channel.status.STALE',
  ABSENT: 'chat.channel.status.ABSENT',
};

const BASIS_KEY: Record<ComposedZone['invalidation_basis'], ChatKey> = {
  LEVEL: 'chat.zone.basis.LEVEL',
  MINIMUM_STOP: 'chat.zone.basis.MINIMUM_STOP',
  NO_LEVEL: 'chat.zone.basis.NO_LEVEL',
};

const NEWS_TONE: Record<EventsStatus, Tone> = {
  OK: 'good',
  LATE: 'warn',
  UNAVAILABLE: 'bad',
};

const NEWS_KEY: Record<EventsStatus, ChatKey> = {
  OK: 'chat.news.status.OK',
  LATE: 'chat.news.status.LATE',
  UNAVAILABLE: 'chat.news.status.UNAVAILABLE',
};

const DASH = '—';

function Channel({ channel }: { channel: ChannelLine }): ReactElement {
  const { tr } = useChatWords();
  return (
    <li
      data-testid="channel"
      className="border-border/60 flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1"
    >
      <Code>{channel.mcd_id}</Code>
      <Code>{channel.timeframe}</Code>
      <Pill tone={STATUS_TONE[channel.status]}>
        {tr(STATUS_KEY[channel.status])}
      </Pill>
      {channel.state_code === null ? null : <Code>{channel.state_code}</Code>}
      {channel.bias === null ? null : <BiasPill bias={channel.bias} />}
    </li>
  );
}

export function Level({ level }: { level: LevelLine }): ReactElement {
  const { tr, price } = useChatWords();
  return (
    <li
      data-testid="level"
      className="flex flex-wrap items-baseline justify-between gap-x-2"
    >
      <span className="flex min-w-0 flex-wrap items-baseline gap-1.5">
        <Code>{level.name}</Code>
        <span className="text-[11px] text-muted-foreground">
          {tr(
            level.kind === 'CHANNEL'
              ? 'chat.levels.channel'
              : 'chat.levels.context'
          )}
        </span>
        {level.timeframe === null ? null : <Code>{level.timeframe}</Code>}
      </span>
      <Figure className="font-semibold">{price(level.price)}</Figure>
    </li>
  );
}

function Zone({ zone }: { zone: ComposedZone }): ReactElement {
  const { tr, price, ratio, count, inline } = useChatWords();
  return (
    <li
      data-testid="zone"
      data-zone-id={zone.zone_id}
      className="border-border/70 space-y-1.5 rounded-md border p-2"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={zone.bias === 'LONG' ? 'good' : 'bad'}>
          {tr(zone.bias === 'LONG' ? 'chat.zone.long' : 'chat.zone.short')}
        </Pill>
        <span className="font-semibold">
          {tr('chat.zone.heading', { zone: inline(zone.zone_id) })}
        </span>
      </div>
      <dl className="space-y-0.5">
        <Row label={tr('chat.zone.band')}>
          <Figure>{price(zone.low)}</Figure> –{' '}
          <Figure>{price(zone.high)}</Figure>
        </Row>
        <Row label={tr('chat.zone.reference')}>
          <Figure>{price(zone.reference_price)}</Figure>
        </Row>
        <Row label={tr('chat.zone.invalidation')}>
          <Figure>{price(zone.invalidation_price)}</Figure>{' '}
          <span className="text-[11px] font-normal text-muted-foreground">
            {tr(BASIS_KEY[zone.invalidation_basis])}
          </span>
        </Row>
        <Row label={tr('chat.zone.stop')}>
          <Figure>{price(zone.stop_distance)}</Figure>
        </Row>
        <Row label={tr('chat.zone.room')}>
          {zone.runway === null ? DASH : <Figure>{price(zone.runway)}</Figure>}
        </Row>
        <Row label={tr('chat.zone.room_ratio')}>
          {zone.runway_ratio === null ? (
            DASH
          ) : (
            <Figure>{ratio(zone.runway_ratio)}</Figure>
          )}
        </Row>
        <Row label={tr('chat.zone.confluence')}>
          <Figure>{count(zone.confluence_count)}</Figure>
        </Row>
        <Row label={tr('chat.zone.sources')}>
          <span className="inline-flex flex-wrap justify-end gap-1">
            {zone.source_sensors.map((sensor) => (
              <Code key={sensor}>{sensor}</Code>
            ))}
          </span>
        </Row>
      </dl>
    </li>
  );
}

function News({ news }: { news: NewsBlock }): ReactElement {
  const { tr, time, count, inline } = useChatWords();
  return (
    <div data-testid="news" className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={NEWS_TONE[news.status]}>{tr(NEWS_KEY[news.status])}</Pill>
        {news.calendar_age_seconds === null ? null : (
          <span className="text-[11px] text-muted-foreground">
            {tr('chat.news.age', {
              minutes: inline(
                count(Math.round(news.calendar_age_seconds / 60))
              ),
            })}
          </span>
        )}
      </div>
      {news.status !== 'UNAVAILABLE' && news.items.length === 0 ? (
        <p className="text-muted-foreground">{tr('chat.news.none')}</p>
      ) : (
        <ul className="space-y-1">
          {news.items.map((item) => (
            <li
              key={item.event_id}
              data-testid="news-item"
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
            >
              <span dir="auto" className="min-w-0 break-words font-medium">
                {item.name}
              </span>
              <Figure className="text-muted-foreground">
                {time(item.time)}
              </Figure>
              <Code>{item.currency}</Code>
              <Code>{item.importance}</Code>
              {item.tier1 ? (
                <Pill tone="warn">{tr('chat.news.tier1')}</Pill>
              ) : null}
              {item.approximate ? (
                <span className="text-[11px] text-muted-foreground">
                  {tr('chat.news.approximate')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The action Report 1 offers, built from what it shows: only a directional reading with zones. */
export function actionOf(result: Report1Result): TradeSetupAction | null {
  const { report, stamp } = result;
  const directional =
    !report.direction.stand_aside &&
    (report.direction.bias === 'LONG' || report.direction.bias === 'SHORT');
  if (!directional || report.zones.length === 0 || stamp.as_of === null) {
    return null;
  }
  return {
    type: 'OPEN_TRADE_SETUP',
    cycle_slot: stamp.as_of,
    trader_type: report.direction.profile,
    zone_ids: report.zones.map((zone) => zone.zone_id),
  };
}

export interface Report1CardProps {
  result: Report1Result;
  /** the Trade Setup button; left out, no button is drawn (a recorded example) */
  onOpenTradeSetup?: (action: TradeSetupAction) => void;
}

export function Report1Card({
  result,
  onOpenTradeSetup,
}: Report1CardProps): ReactElement {
  const { tr } = useChatWords();
  const { report } = result;
  const locale = result.reply_locale;
  const action = onOpenTradeSetup === undefined ? null : actionOf(result);
  const uid = `r1-${result.provenance.request_id.slice(0, 12)}`;

  return (
    <article
      data-testid="report1-card"
      data-kind="REPORT1"
      aria-labelledby={`${uid}-title`}
      className="space-y-3 rounded-xl border border-border bg-card p-3 text-xs shadow-sm"
    >
      <header className="space-y-2">
        <h3
          id={`${uid}-title`}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          {tr('chat.report1.title')}
        </h3>
        <p
          lang={locale}
          dir={textDirection(locale)}
          data-testid="headline"
          className="break-words text-sm font-semibold leading-snug"
        >
          {report.headline}
        </p>
        <DirectionLine direction={report.direction} />
        <DataStampLine stamp={result.stamp} />
      </header>

      <Section id={`${uid}-alignment`} title={tr('chat.section.alignment')}>
        {report.alignment.trend_relation === null ? null : (
          <p className="font-medium">
            {tr(
              report.alignment.trend_relation === 'WITH_TREND'
                ? 'chat.trend.WITH_TREND'
                : 'chat.trend.COUNTER_TREND'
            )}
          </p>
        )}
        {report.alignment.channels.length === 0 ? null : (
          <ul className="space-y-1">
            {report.alignment.channels.map((channel) => (
              <Channel
                key={`${channel.mcd_id}-${channel.timeframe}`}
                channel={channel}
              />
            ))}
          </ul>
        )}
        <ReplyLines
          lines={report.alignment.lines}
          locale={locale}
          testId="alignment-lines"
        />
      </Section>

      <Section id={`${uid}-levels`} title={tr('chat.section.levels')}>
        {report.levels.length === 0 ? (
          <p className="text-muted-foreground">{tr('chat.levels.none')}</p>
        ) : (
          <ul className="space-y-1">
            {report.levels.map((level) => (
              <Level key={level.id} level={level} />
            ))}
          </ul>
        )}
      </Section>

      <Section id={`${uid}-zones`} title={tr('chat.section.zones')}>
        {report.zones.length === 0 ? (
          <p className="text-muted-foreground">{tr('chat.zone.none')}</p>
        ) : (
          <ul className="space-y-2">
            {report.zones.map((zone) => (
              <Zone key={zone.zone_id} zone={zone} />
            ))}
          </ul>
        )}
      </Section>

      <Section id={`${uid}-watch`} title={tr('chat.section.watch')}>
        <ReplyLines lines={report.watch} locale={locale} testId="watch-lines" />
      </Section>

      <Section id={`${uid}-risks`} title={tr('chat.section.risks')}>
        <ReplyLines lines={report.risks} locale={locale} testId="risk-lines" />
        <News news={report.news} />
      </Section>

      <ChangesList changes={result.changes} />
      <ReplyNotes result={result} />
      {action === null || onOpenTradeSetup === undefined ? null : (
        <OpenSetupButton action={action} onOpen={onOpenTradeSetup} />
      )}
      <AiNotice result={result} />
    </article>
  );
}

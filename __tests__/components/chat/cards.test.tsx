/**
 * The cards of the chat panel (build step 7 part 8), the REAL components over the REAL recorded
 * replies of the message route (`app/dev/chat/recorded.json`): Report 1 with its six sections, the
 * short answer, the answer from the sensor board in each of its seven reasons, the Trade Setup action,
 * the refusal in each of its ten codes, the error in each of its codes, the stages, the footer.
 *
 * `LocaleProvider` wraps every render (LESSONS-LEARNED L40), and nothing here uses fake timers.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActionCard } from '@/components/chat/action-card';
import { AiNotice } from '@/components/chat/ai-notice';
import { AnswerCard } from '@/components/chat/answer-card';
import { ErrorCard } from '@/components/chat/error-card';
import { FixedAnswerCard } from '@/components/chat/fixed-answer-card';
import { formatPrice } from '@/components/chat/format';
import { REFUSAL_CODES_UI, STAGES } from '@/components/chat/limits';
import { ProgressStages } from '@/components/chat/progress-stages';
import { RefusalCard } from '@/components/chat/refusal-card';
import { actionOf, Report1Card } from '@/components/chat/report1-card';
import { ResultCard } from '@/components/chat/result-card';
import { CHAT_TEXT } from '@/components/chat/text';
import type {
  FixedAnswerResult,
  IntakeRefusal,
  Report1Result,
} from '@/components/chat/types';
import { emptyStages } from '@/components/chat/chat-state';
import { notVerifiedMark } from '@/lib/reply/checks/wording-lists';

import { plain, renderIn } from '../report2/helpers/render';
import { refusalOf, resultOfKind } from './helpers/fake-fetch';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/chat',
}));

const report = (): Report1Result => resultOfKind('report1-long', 'REPORT1');
const short = (): Report1Result =>
  resultOfKind('report1-short-instant', 'REPORT1');
const t = (key: keyof typeof CHAT_TEXT): string => CHAT_TEXT[key];

describe('Report 1', () => {
  it('draws the headline, the direction copied from the reading, and the stamp', () => {
    const result = report();
    renderIn(<Report1Card result={result} />);
    expect(screen.getByTestId('headline')).toHaveTextContent(
      result.report.headline
    );
    const direction = within(screen.getByTestId('direction-line'));
    expect(direction.getByTestId('bias-pill')).toHaveTextContent('Long (buy)');
    expect(direction.getByText('Counter-trend')).toBeInTheDocument();
    expect(direction.getByText('Day trader')).toBeInTheDocument();
    expect(
      direction.getByText(`Rule ${result.report.direction.rule_id}`)
    ).toBeInTheDocument();
    expect(
      direction.getByText(`Archetype ${result.report.direction.archetype}`)
    ).toBeInTheDocument();
    expect(direction.getByText(t('chat.direction.note'))).toBeInTheDocument();
    expect(screen.getByTestId('data-stamp')).toHaveTextContent(/^Data as of /);
    expect(
      within(screen.getByTestId('data-stamp')).getByTestId('status-pill')
    ).toHaveTextContent('Live');
  });

  it('the direction is the SHORT of a scalper’s reading when that is what the server sent', () => {
    renderIn(<Report1Card result={short()} />);
    const direction = within(screen.getByTestId('direction-line'));
    expect(direction.getByTestId('bias-pill')).toHaveTextContent(
      'Short (sell)'
    );
    expect(direction.getByText('Scalper')).toBeInTheDocument();
  });

  it('has the six sections, each a labelled region with its own heading', () => {
    renderIn(<Report1Card result={report()} />);
    const names = [
      'M15 and M5 alignment',
      'Levels',
      'Entry zones',
      'What would change the picture',
      'Risks and news',
    ];
    for (const name of names) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    // the summary is the card’s own title and headline
    expect(
      screen.getByRole('article', { name: 'Market analysis' })
    ).toBeInTheDocument();
  });

  it('alignment: the trend relation, every channel with its id, status and state code, and the model’s lines', () => {
    const result = report();
    renderIn(<Report1Card result={result} />);
    const channels = screen.getAllByTestId('channel');
    expect(channels).toHaveLength(result.report.alignment.channels.length);
    result.report.alignment.channels.forEach((channel, index) => {
      const row = within(channels[index] as HTMLElement);
      expect(row.getByText(channel.mcd_id)).toBeInTheDocument();
      expect(row.getByText(channel.timeframe)).toBeInTheDocument();
      if (channel.state_code !== null)
        expect(row.getByText(channel.state_code)).toBeInTheDocument();
    });
    const lines = within(screen.getByTestId('alignment-lines')).getAllByRole(
      'listitem'
    );
    expect(lines.map((li) => plain(li.textContent))).toEqual(
      result.report.alignment.lines.map(
        (line) => `${line.text}${line.cites.join('')}`
      )
    );
  });

  it('levels: every level with its own name and its price, written the way the lines are', () => {
    const result = report();
    renderIn(<Report1Card result={result} />);
    const levels = screen.getAllByTestId('level');
    expect(levels).toHaveLength(result.report.levels.length);
    result.report.levels.forEach((level, index) => {
      const row = within(levels[index] as HTMLElement);
      expect(row.getByText(level.name)).toBeInTheDocument();
      expect(
        row.getByText(formatPrice(level.price, 'en-US'))
      ).toBeInTheDocument();
    });
  });

  it('zones: band, reference, invalidation with its basis, stop, room, confluence and sensors', () => {
    const result = report();
    renderIn(<Report1Card result={result} />);
    const zones = screen.getAllByTestId('zone');
    expect(zones.map((z) => z.getAttribute('data-zone-id'))).toEqual(
      result.report.zones.map((z) => z.zone_id)
    );
    result.report.zones.forEach((zone, index) => {
      const block = within(zones[index] as HTMLElement);
      expect(block.getByText(`Zone ${zone.zone_id}`)).toBeInTheDocument();
      expect(
        block.getByText(zone.bias === 'LONG' ? 'Long zone' : 'Short zone')
      ).toBeInTheDocument();
      expect(
        block.getByText(formatPrice(zone.low, 'en-US'))
      ).toBeInTheDocument();
      expect(
        block.getByText(formatPrice(zone.high, 'en-US'))
      ).toBeInTheDocument();
      expect(
        block.getByText(formatPrice(zone.reference_price, 'en-US'))
      ).toBeInTheDocument();
      expect(
        block.getByText(formatPrice(zone.invalidation_price, 'en-US'))
      ).toBeInTheDocument();
      expect(
        block.getByText(formatPrice(zone.stop_distance, 'en-US'))
      ).toBeInTheDocument();
      for (const sensor of zone.source_sensors) {
        expect(block.getByText(sensor)).toBeInTheDocument();
      }
    });
  });

  it('zones: a missing room is a dash, not a made-up number', () => {
    const result = report();
    const zone = {
      ...result.report.zones[0]!,
      runway: null,
      runway_ratio: null,
      next_opposing_price: null,
    };
    renderIn(
      <Report1Card
        result={{ ...result, report: { ...result.report, zones: [zone] } }}
      />
    );
    const block = within(screen.getByTestId('zone'));
    expect(block.getAllByText('—').length).toBe(2);
  });

  it('no zones and no levels say so', () => {
    const result = report();
    renderIn(
      <Report1Card
        result={{
          ...result,
          report: { ...result.report, zones: [], levels: [] },
        }}
      />
    );
    expect(screen.getByText(t('chat.zone.none'))).toBeInTheDocument();
    expect(screen.getByText(t('chat.levels.none'))).toBeInTheDocument();
  });

  it('what would change the picture, and the risks, are the model’s lines as they came', () => {
    const result = report();
    renderIn(<Report1Card result={result} />);
    const watch = within(screen.getByTestId('watch-lines')).getAllByRole(
      'listitem'
    );
    expect(watch.map((li) => plain(li.textContent))).toEqual(
      result.report.watch.map((line) => `${line.text}${line.cites.join('')}`)
    );
    const risks = within(screen.getByTestId('risk-lines')).getAllByRole(
      'listitem'
    );
    expect(risks).toHaveLength(result.report.risks.length);
  });

  it('news: the calendar status and its age, and a line for an empty window', () => {
    renderIn(<Report1Card result={report()} />);
    const news = within(screen.getByTestId('news'));
    expect(news.getByText('Calendar up to date')).toBeInTheDocument();
    expect(news.getByText('Calendar age: 2 min')).toBeInTheDocument();
    expect(news.getByText(t('chat.news.none'))).toBeInTheDocument();
  });

  it('news: each event with its name, time, currency, importance, Tier 1 and "approximate"', () => {
    const result = report();
    const items = [
      {
        event_id: 'cpi-1',
        name: 'US CPI y/y',
        time: '2026-09-18T12:30:00Z',
        currency: 'USD',
        importance: 'HIGH',
        approximate: true,
        tier1: true,
      },
      {
        event_id: 'pmi-1',
        name: 'Flash PMI',
        time: '2026-09-18T13:45:00Z',
        currency: 'USD',
        importance: 'MEDIUM',
        approximate: false,
        tier1: false,
      },
    ];
    renderIn(
      <Report1Card
        result={{
          ...result,
          report: {
            ...result.report,
            news: { status: 'LATE', calendar_age_seconds: 5400, items },
          },
        }}
      />
    );
    const rows = screen.getAllByTestId('news-item');
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0] as HTMLElement).getByText('US CPI y/y')
    ).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByText('Tier 1')
    ).toBeInTheDocument();
    expect(
      within(rows[0] as HTMLElement).getByText('time approximate')
    ).toBeInTheDocument();
    expect(
      within(rows[1] as HTMLElement).queryByText('Tier 1')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Calendar is late')).toBeInTheDocument();
    expect(screen.getByText('Calendar age: 90 min')).toBeInTheDocument();
  });

  it('news: a calendar that is not available says that, not "no events"', () => {
    const result = report();
    renderIn(
      <Report1Card
        result={{
          ...result,
          report: {
            ...result.report,
            news: {
              status: 'UNAVAILABLE',
              calendar_age_seconds: null,
              items: [],
            },
          },
        }}
      />
    );
    expect(screen.getByText('Calendar unavailable')).toBeInTheDocument();
    expect(screen.queryByText(t('chat.news.none'))).not.toBeInTheDocument();
  });

  it('says what changed since the last answer, with the codes untouched', () => {
    const result = report();
    renderIn(
      <Report1Card
        result={{
          ...result,
          changes: [
            {
              mcd_id: 'MCD2',
              from: 'MCD2_UP_IN_CORRIDOR',
              to: 'MCD2_DOWN_BREAKOUT',
            },
            {
              mcd_id: 'MCD3',
              from: null,
              to: 'MCD3_NON_CONSOLIDATED_TREND_CONFLICT',
            },
          ],
        }}
      />
    );
    const changes = within(screen.getByTestId('changes'));
    expect(
      changes.getByText('Changed since your last answer')
    ).toBeInTheDocument();
    expect(changes.getByText('MCD2_UP_IN_CORRIDOR')).toBeInTheDocument();
    expect(changes.getByText('MCD2_DOWN_BREAKOUT')).toBeInTheDocument();
    expect(changes.getByText('none')).toBeInTheDocument();
  });

  it('says a chart was not used, from the code', () => {
    renderIn(<Report1Card result={report()} />);
    expect(screen.getByTestId('reply-notes')).toHaveTextContent(
      t('chat.note.CHART_UNAVAILABLE')
    );
    renderIn(
      <Report1Card result={{ ...report(), notes: ['CHART_OTHER_CYCLE'] }} />
    );
    expect(screen.getAllByTestId('reply-notes').at(-1)).toHaveTextContent(
      t('chat.note.CHART_OTHER_CYCLE')
    );
  });

  it('the data is not live: a stopped status and the flags show in the stamp', () => {
    const result = report();
    renderIn(
      <Report1Card
        result={{
          ...result,
          stamp: {
            ...result.stamp,
            data_status: 'DELAYED',
            retuning: true,
            flags: ['SENSORS_NOT_LIVE', 'GATEWAY_UNREACHABLE'],
          },
        }}
      />
    );
    const stamp = within(screen.getByTestId('data-stamp'));
    expect(stamp.getByText('Delayed')).toBeInTheDocument();
    expect(stamp.getByText('Sensors are retuning')).toBeInTheDocument();
    expect(stamp.getByText('Sensors are not live')).toBeInTheDocument();
    expect(stamp.getByText('Data gateway unreachable')).toBeInTheDocument();
  });

  it('no cycle could be read: the stamp says so', () => {
    const result = report();
    renderIn(
      <Report1Card
        result={{ ...result, stamp: { ...result.stamp, as_of: null } }}
      />
    );
    expect(screen.getByTestId('data-stamp')).toHaveTextContent(
      t('chat.stamp.no_cycle')
    );
  });
});

describe('Report 1: the Trade Setup button', () => {
  it('opens Report 2 with the cycle of the reply, the trader’s type and the zones it names', async () => {
    const result = report();
    const onOpen = jest.fn();
    renderIn(<Report1Card result={result} onOpenTradeSetup={onOpen} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Open trade setup' })
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith({
      type: 'OPEN_TRADE_SETUP',
      cycle_slot: result.stamp.as_of,
      trader_type: 'DAY_TRADER',
      zone_ids: result.report.zones.map((z) => z.zone_id),
    });
  });

  it('is not drawn without a handler (a recorded example has no live cycle to size on)', () => {
    renderIn(<Report1Card result={report()} />);
    expect(
      screen.queryByRole('button', { name: 'Open trade setup' })
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      'a reading that says stand aside',
      (r: Report1Result): Report1Result => ({
        ...r,
        report: {
          ...r.report,
          direction: { ...r.report.direction, stand_aside: true },
        },
      }),
    ],
    [
      'a neutral reading',
      (r: Report1Result): Report1Result => ({
        ...r,
        report: {
          ...r.report,
          direction: { ...r.report.direction, bias: 'NEUTRAL' },
        },
      }),
    ],
    [
      'a reading with no zones',
      (r: Report1Result): Report1Result => ({
        ...r,
        report: { ...r.report, zones: [] },
      }),
    ],
    [
      'no cycle',
      (r: Report1Result): Report1Result => ({
        ...r,
        stamp: { ...r.stamp, as_of: null },
      }),
    ],
  ])('is not offered for %s', (_name, make) => {
    expect(actionOf(make(report()))).toBeNull();
    renderIn(
      <Report1Card result={make(report())} onOpenTradeSetup={jest.fn()} />
    );
    expect(
      screen.queryByRole('button', { name: 'Open trade setup' })
    ).not.toBeInTheDocument();
  });
});

describe('a number that could not be verified', () => {
  it('shows the mark of the language in its place, and never the model’s own digits', () => {
    const result = resultOfKind('report1-flagged', 'REPORT1');
    renderIn(<Report1Card result={result} />);
    expect(screen.getByTestId('headline')).toHaveTextContent(
      notVerifiedMark('en-US')
    );
    expect(document.body.textContent).not.toContain('4999.99');
    expect(document.body.textContent).not.toContain('4,999.99');
    expect(screen.getByTestId('flagged-note')).toHaveTextContent(
      'Numbers that could not be verified are marked: 1.'
    );
  });

  it('a report with nothing flagged has no such note', () => {
    renderIn(<Report1Card result={report()} />);
    expect(screen.queryByTestId('flagged-note')).not.toBeInTheDocument();
  });

  it('draws the mark of each of the 19 languages as the server put it, untouched', () => {
    const result = resultOfKind('report1-flagged', 'REPORT1');
    const english = notVerifiedMark('en-US');
    expect(result.report.headline).toContain(english);
    for (const locale of [
      'en-US',
      'de',
      'ar',
      'ja',
      'th',
      'fr',
      'tr',
    ] as const) {
      const mark = notVerifiedMark(locale);
      const localized: Report1Result = {
        ...result,
        reply_locale: locale,
        report: {
          ...result.report,
          headline: result.report.headline.replace(english, mark),
        },
      };
      const { unmount } = renderIn(<Report1Card result={localized} />);
      const headline = screen.getByTestId('headline');
      expect(headline).toHaveTextContent(mark);
      expect(headline).toHaveAttribute('lang', locale);
      expect(document.body.textContent).not.toContain('4999.99');
      unmount();
    }
  });
});

describe('the footer of a reply', () => {
  it('says AI wrote it, names the model, the version of the prompt and the request id, and shows the disclaimer', () => {
    const result = report();
    renderIn(<AiNotice result={result} />);
    expect(screen.getByText(t('chat.notice.ai'))).toBeInTheDocument();
    expect(screen.getByTestId('provenance-model')).toHaveTextContent(
      result.provenance.model as string
    );
    expect(screen.getByTestId('provenance-prompt')).toHaveTextContent(
      result.provenance.prompt_version as string
    );
    expect(screen.getByTestId('provenance-request')).toHaveTextContent(
      result.provenance.request_id
    );
    expect(
      screen.getByText(t('chat.disclaimer.text'), { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByTestId('disclaimer-version')).toHaveTextContent(
      `Version ${result.disclaimer_version}`
    );
  });

  it('is on every kind of reply', () => {
    for (const [name, kind] of [
      ['report1-long', 'REPORT1'],
      ['answer', 'ANSWER'],
      ['fixed-stale', 'FIXED_ANSWER'],
      ['action', 'ACTION'],
    ] as const) {
      const { unmount } = renderIn(
        <ResultCard
          result={resultOfKind(name, kind)}
          onOpenTradeSetup={jest.fn()}
        />
      );
      expect(screen.getByTestId('ai-notice')).toBeInTheDocument();
      expect(screen.getByTestId('provenance-request')).toHaveTextContent(
        resultOfKind(name, kind).provenance.request_id
      );
      unmount();
    }
  });

  it('does not claim a reply was written by AI when no model wrote it', () => {
    const result = resultOfKind('fixed-stale', 'FIXED_ANSWER');
    expect(result.provenance.model).toBeNull();
    renderIn(<AiNotice result={result} />);
    expect(screen.queryByText(t('chat.notice.ai'))).not.toBeInTheDocument();
    expect(screen.getByTestId('provenance-model')).toHaveTextContent(
      t('chat.provenance.no_model')
    );
    expect(screen.queryByTestId('provenance-prompt')).not.toBeInTheDocument();
  });
});

describe('the short answer', () => {
  it('draws the text as it came, the ids it rests on, the stamp and the action', async () => {
    const result = resultOfKind('answer', 'ANSWER');
    const onOpen = jest.fn();
    renderIn(<AnswerCard result={result} onOpenTradeSetup={onOpen} />);
    expect(screen.getByTestId('answer-text')).toHaveTextContent(
      result.answer.text
    );
    expect(
      screen.getByText(`Based on: ${result.answer.cites.join(', ')}`)
    ).toBeInTheDocument();
    expect(screen.getByTestId('data-stamp')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Open trade setup' })
    );
    expect(onOpen).toHaveBeenCalledWith(result.action);
  });

  it('has no button when the model asked for no action, and none without a handler', () => {
    const result = resultOfKind('answer', 'ANSWER');
    renderIn(
      <AnswerCard
        result={{ ...result, action: null }}
        onOpenTradeSetup={jest.fn()}
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    renderIn(<AnswerCard result={result} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('has no "based on" line when it cites nothing', () => {
    const result = resultOfKind('answer', 'ANSWER');
    renderIn(
      <AnswerCard
        result={{ ...result, answer: { ...result.answer, cites: [] } }}
      />
    );
    expect(screen.queryByText(/^Based on/)).not.toBeInTheDocument();
  });
});

describe('the answer from the sensor board', () => {
  const REASONS = [
    'DATA_STALE',
    'WORDING_FAILED',
    'SCHEMA_FAILED',
    'MODEL_UNAVAILABLE',
    'DEADLINE',
    'MARKET_CLOSED',
    'NO_SYNTHESIS',
  ] as const;

  it.each(REASONS)(
    'says why, in the words of the language, for %s',
    (reason) => {
      const base = resultOfKind('fixed-model-down', 'FIXED_ANSWER');
      const result: FixedAnswerResult = {
        ...base,
        fixed: {
          ...base.fixed,
          reason,
          direction:
            reason === 'DATA_STALE' || reason === 'NO_SYNTHESIS'
              ? null
              : base.fixed.direction,
        },
      };
      renderIn(<FixedAnswerCard result={result} />);
      expect(screen.getByTestId('fixed-answer-card')).toHaveAttribute(
        'data-reason',
        reason
      );
      expect(screen.getByTestId('fixed-reason')).toHaveTextContent(
        t(`chat.fixed.reason.${reason}`)
      );
    }
  );

  it('states the direction the reading gave when it has one, and the board line by line', () => {
    const result = resultOfKind('fixed-model-down', 'FIXED_ANSWER');
    renderIn(<FixedAnswerCard result={result} />);
    expect(screen.getByTestId('bias-pill')).toHaveTextContent('Long (buy)');
    const lines = screen.getAllByTestId('board-line');
    expect(lines).toHaveLength(result.fixed.board.length);
    result.fixed.board.forEach((line, index) => {
      const row = within(lines[index] as HTMLElement);
      expect(row.getByText(line.mcd_id)).toBeInTheDocument();
      if (line.state_code !== null)
        expect(row.getByText(line.state_code)).toBeInTheDocument();
    });
  });

  it('states NO direction when the data stopped: no bias pill, and the time of the last reading', () => {
    const result = resultOfKind('fixed-stale', 'FIXED_ANSWER');
    expect(result.fixed.direction).toBeNull();
    renderIn(<FixedAnswerCard result={result} />);
    expect(screen.getByTestId('no-direction')).toHaveTextContent(
      t('chat.fixed.no_direction')
    );
    expect(screen.queryByTestId('bias-pill')).not.toBeInTheDocument();
    expect(screen.queryByTestId('direction-line')).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId('data-stamp')).getByTestId('status-pill')
    ).toHaveTextContent('Stopped');
  });

  it('carries no free text from a sensor: only ids, statuses, state codes and levels', () => {
    const result = resultOfKind('fixed-model-down', 'FIXED_ANSWER');
    expect(Object.keys(result.fixed).sort()).toEqual([
      'board',
      'direction',
      'levels',
      'reason',
    ]);
    expect(Object.keys(result.fixed.board[0] as object).sort()).toEqual([
      'mcd_id',
      'state_code',
      'status',
    ]);
  });
});

describe('the Trade Setup action', () => {
  it('is the button and nothing to read, with no model behind it', async () => {
    const result = resultOfKind('action', 'ACTION');
    const onOpen = jest.fn();
    renderIn(<ActionCard result={result} onOpenTradeSetup={onOpen} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Open trade setup' })
    );
    expect(onOpen).toHaveBeenCalledWith(result.action);
    expect(screen.getByTestId('provenance-model')).toHaveTextContent(
      t('chat.provenance.no_model')
    );
  });

  it('draws no button without a handler', () => {
    renderIn(<ActionCard result={resultOfKind('action', 'ACTION')} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('a refusal', () => {
  const refusal = (
    code: IntakeRefusal['code'],
    reply = `The reply to ${code}.`
  ): IntakeRefusal => ({
    schema: 'intake-refusal/1',
    code,
    stage: 'GATE',
    reply_locale: 'en-US',
    reply,
  });

  it.each([...REFUSAL_CODES_UI])(
    '%s: shows the server’s reply as it came, in a status region',
    (code) => {
      renderIn(<RefusalCard refusal={refusal(code)} />);
      const card = screen.getByTestId('refusal-card');
      expect(card).toHaveAttribute('role', 'status');
      expect(card).toHaveAttribute('data-code', code);
      expect(screen.getByTestId('refusal-reply')).toHaveTextContent(
        `The reply to ${code}.`
      );
      expect(screen.getByText('Not answered')).toBeInTheDocument();
    }
  );

  it('shows the reply in the language of the reply, with its own direction', () => {
    renderIn(
      <RefusalCard
        refusal={{ ...refusal('OUT_OF_SCOPE', 'عذرًا'), reply_locale: 'ar' }}
      />
    );
    expect(screen.getByTestId('refusal-reply')).toHaveAttribute('lang', 'ar');
    expect(screen.getByTestId('refusal-reply')).toHaveAttribute('dir', 'rtl');
  });

  it('the recorded refusals are drawn from the real answers', () => {
    for (const name of [
      'refusal-out-of-scope',
      'refusal-quota',
      'refusal-tier',
      'refusal-profile',
    ]) {
      const { unmount } = renderIn(<RefusalCard refusal={refusalOf(name)} />);
      expect(screen.getByTestId('refusal-reply')).toHaveTextContent(
        refusalOf(name).reply
      );
      unmount();
    }
  });

  it.each([
    [
      { limit_units: 20_000_000, available_units: 0, needed_units: 44_302 },
      '0%',
    ],
    [
      {
        limit_units: 20_000_000,
        available_units: 30_000,
        needed_units: 44_302,
      },
      '0%',
    ],
    [
      {
        limit_units: 20_000_000,
        available_units: 10_000_000,
        needed_units: 44_302,
      },
      '50%',
    ],
    [
      {
        limit_units: 20_000_000,
        available_units: 20_000_000,
        needed_units: 44_302,
      },
      '100%',
    ],
  ])('an allowance refusal with %j says the share left: %s', (quota, share) => {
    renderIn(
      <RefusalCard refusal={refusal('QUOTA_INSUFFICIENT')} quota={quota} />
    );
    expect(screen.getByTestId('refusal-allowance')).toHaveTextContent(
      `Allowance left this month: ${share}`
    );
  });

  it('never prints the balance as a number of units or tokens', () => {
    renderIn(
      <RefusalCard
        refusal={refusal('QUOTA_INSUFFICIENT')}
        quota={{
          limit_units: 20_000_000,
          available_units: 30_000,
          needed_units: 44_302,
        }}
      />
    );
    const text = screen.getByTestId('refusal-card').textContent as string;
    for (const raw of [
      '20000000',
      '20,000,000',
      '30000',
      '30,000',
      '44302',
      '44,302',
    ]) {
      expect(text).not.toContain(raw);
    }
  });

  it('has no allowance line without a balance, or with an allowance of nothing', () => {
    renderIn(<RefusalCard refusal={refusal('QUOTA_INSUFFICIENT')} />);
    renderIn(
      <RefusalCard
        refusal={refusal('QUOTA_INSUFFICIENT')}
        quota={{ limit_units: 0, available_units: 0, needed_units: 1 }}
      />
    );
    expect(screen.queryByTestId('refusal-allowance')).not.toBeInTheDocument();
  });

  it('offers the upgrade only for "PRO only", and only with a handler', async () => {
    const onUpgrade = jest.fn();
    renderIn(
      <RefusalCard refusal={refusal('TIER_REQUIRED')} onUpgrade={onUpgrade} />
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Upgrade to PRO' })
    );
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    renderIn(<RefusalCard refusal={refusal('TIER_REQUIRED')} />);
    renderIn(
      <RefusalCard
        refusal={refusal('QUOTA_INSUFFICIENT')}
        onUpgrade={onUpgrade}
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('an error', () => {
  it.each([
    ['INTERNAL', 'chat.error.INTERNAL'],
    ['LEDGER_UNAVAILABLE', 'chat.error.LEDGER_UNAVAILABLE'],
    ['PERSISTENCE_FAILED', 'chat.error.PERSISTENCE_FAILED'],
    ['NETWORK', 'chat.error.NETWORK'],
    ['BAD_STREAM', 'chat.error.BAD_STREAM'],
    ['BAD_REQUEST', 'chat.error.HTTP'],
    ['SOMETHING_NEW', 'chat.error.HTTP'],
  ] as const)('%s says %s', (code, key) => {
    renderIn(<ErrorCard code={code} requestId={null} retryable={false} />);
    const card = screen.getByTestId('error-card');
    expect(card).toHaveAttribute('role', 'alert');
    expect(card).toHaveAttribute('data-code', code);
    expect(card).toHaveTextContent(t(key));
    expect(card).toHaveTextContent(t('chat.error.title'));
  });

  it('a reply that was paid for and not filed says it is not shown, and gives the request id to support', () => {
    const id = 'a'.repeat(64);
    renderIn(
      <ErrorCard code="PERSISTENCE_FAILED" requestId={id} retryable={false} />
    );
    expect(screen.getByTestId('error-request-id')).toHaveTextContent(
      `Request ID ${id}`
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('Try again is offered only when the request may be sent again, and only with a handler', async () => {
    const onRetry = jest.fn();
    renderIn(
      <ErrorCard code="NETWORK" requestId={null} retryable onRetry={onRetry} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    renderIn(
      <ErrorCard
        code="NETWORK"
        requestId={null}
        retryable={false}
        onRetry={onRetry}
      />
    );
    renderIn(<ErrorCard code="NETWORK" requestId={null} retryable />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('Try again is disabled while another request runs', () => {
    renderIn(
      <ErrorCard
        code="NETWORK"
        requestId={null}
        retryable
        onRetry={jest.fn()}
        retryDisabled
      />
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
  });
});

describe('the stages', () => {
  it('is a polite live region, and every stage says its state in words', () => {
    renderIn(
      <ProgressStages
        stages={{
          ...emptyStages(),
          GATE: 'DONE',
          UNDERSTAND: 'SKIPPED',
          DATA: 'STARTED',
        }}
      />
    );
    const list = screen.getByRole('list', { name: 'Progress' });
    expect(list).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('progress-stages')).toHaveAttribute(
      'aria-busy',
      'true'
    );
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-stage'))).toEqual([
      ...STAGES,
    ]);
    expect(items.map((li) => li.getAttribute('data-state'))).toEqual([
      'DONE',
      'SKIPPED',
      'STARTED',
      'PENDING',
      'PENDING',
      'PENDING',
    ]);
    expect(items[0]).toHaveTextContent('Checking your accessDone');
    expect(items[1]).toHaveTextContent('Understanding your questionSkipped');
    expect(items[2]).toHaveTextContent('Reading the latest dataIn progress');
    expect(items[3]).toHaveTextContent('Preparing the contextWaiting');
  });

  it('has a Stop button only when it is given one', async () => {
    const onStop = jest.fn();
    renderIn(<ProgressStages stages={emptyStages()} onStop={onStop} />);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
    renderIn(<ProgressStages stages={emptyStages()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('ResultCard', () => {
  it.each([
    ['report1-long', 'REPORT1', 'report1-card'],
    ['answer', 'ANSWER', 'answer-card'],
    ['fixed-stale', 'FIXED_ANSWER', 'fixed-answer-card'],
    ['action', 'ACTION', 'action-card'],
  ] as const)('%s is a %s: the %s', (name, kind, testId) => {
    renderIn(<ResultCard result={resultOfKind(name, kind)} />);
    expect(screen.getByTestId(testId)).toHaveAttribute('data-kind', kind);
  });
});

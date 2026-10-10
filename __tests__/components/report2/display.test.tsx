/**
 * The display pieces of Report 2 on their own (build step 5, part 7): the scenario
 * table, the room and badge, the declared/actual risk pair, the help for a lot below
 * the minimum, and the notices. Documents are built from the real Engine 4 output of
 * the stored 18 Sep cycle and altered only to reach a state that cycle does not
 * produce.
 */

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  CompulsoryNotices,
  NotOfferedNotice,
  OfferNotices,
  ReleaseWarnings,
} from '@/components/report2/notices';
import { RiskPair } from '@/components/report2/risk-pair';
import {
  RoomAndBadge,
  ScenarioTable,
} from '@/components/report2/scenario-table';
import { UnderflowHelp } from '@/components/report2/underflow-help';
import {
  buildReport2,
  type Report2Document,
} from '@/lib/engine4/templates/report2';
import { REPORT2_TEXT } from '@/lib/engine4/templates/text';

import { scene, sizeAnswer } from './helpers/engine-api';
import { renderIn } from './helpers/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/report2',
}));

const Z1 = {
  zoneId: 'Z1',
  entry: '4367.20',
  equity: '10000',
  riskPct: '0.75',
  stopDistance: '16.78',
  rrr: '1.75',
};

function doc(
  options: Parameters<typeof scene>[0] = {},
  fields: Record<string, unknown> = Z1
): Report2Document {
  const answer = sizeAnswer(scene(options), fields);
  return buildReport2({
    setup: answer.setup,
    badge: answer.badge,
    offer: answer.offer,
  });
}

describe('ScenarioTable', () => {
  test('is a list of three cards that stack on a phone and stand side by side from the small breakpoint', () => {
    const d = doc();
    renderIn(<ScenarioTable scenarios={d.scenarios} omitted={d.omitted} />);
    const list = within(screen.getByTestId('report2-scenarios')).getByRole(
      'list'
    );
    expect(list).toHaveClass('grid-cols-1', 'sm:grid-cols-3');
    expect(within(list).getAllByRole('listitem')).toHaveLength(3);
  });

  test('each card lists RRR, distance, price and net profit; the chart level only when it differs', () => {
    const d = doc();
    renderIn(<ScenarioTable scenarios={d.scenarios} omitted={d.omitted} />);
    const normal = screen.getAllByRole('listitem')[1]!;
    expect(normal).toHaveTextContent('RRR1.75×');
    expect(normal).toHaveTextContent('Target distance');
    expect(normal).toHaveTextContent('Target price');
    expect(normal).toHaveTextContent('Net profit$119.49');
    expect(normal).not.toHaveTextContent('On the chart');
  });

  test('a SELL shows the chart level beside the order price', () => {
    const d = doc(
      { golden: '07-' },
      {
        zoneId: 'Z1',
        entry: '4282.0',
        equity: '10000',
        riskPct: '0.5',
        stopDistance: '20.5',
        rrr: '1.75',
      }
    );
    renderIn(<ScenarioTable scenarios={d.scenarios} omitted={d.omitted} />);
    for (const item of screen.getAllByRole('listitem')) {
      expect(item).toHaveTextContent('On the chart');
    }
  });

  test('the scenario that carries the badge is marked, the others are not', () => {
    const d = doc(
      { golden: '07-' },
      {
        zoneId: 'Z1',
        entry: '4282.0',
        equity: '10000',
        riskPct: '0.5',
        stopDistance: '20.5',
        rrr: '1.75',
      }
    );
    renderIn(<ScenarioTable scenarios={d.scenarios} omitted={d.omitted} />);
    const marked = screen
      .getAllByRole('listitem')
      .filter((i) => i.getAttribute('data-badge') === 'true');
    expect(marked).toHaveLength(1);
    expect(within(marked[0]!).getByText('Badge')).toBeInTheDocument();
  });

  test('a scenario left out is named with the reason', () => {
    const d = doc({}, { ...Z1, rrr: '2.5' });
    renderIn(<ScenarioTable scenarios={d.scenarios} omitted={d.omitted} />);
    // two cards in the first list; the left-out one is a line in the second
    expect(
      within(screen.getAllByRole('list')[0]!).getAllByRole('listitem')
    ).toHaveLength(2);
    expect(
      screen.getByText(
        /^Not shown: Aggressive, its RRR would pass the counter-trend cap of 2\.50×$/
      )
    ).toBeInTheDocument();
  });

  test('says what to do when there is nothing to show', () => {
    renderIn(<ScenarioTable scenarios={[]} omitted={[]} />);
    expect(
      screen.getByText('Fill in the fields to see the scenarios.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  test('a net profit that is not known is a dash, not zero', () => {
    const d = doc();
    const scenarios = d.scenarios.map((s) => ({ ...s, netProfit: null }));
    renderIn(<ScenarioTable scenarios={scenarios} omitted={[]} />);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Net profit—');
  });
});

describe('RoomAndBadge', () => {
  test('names the next level, how far it is, and says there is no badge and why (18 Sep: 4369.57)', () => {
    const d = doc();
    renderIn(<RoomAndBadge room={d.room} badge={d.badge} />);
    expect(screen.getByTestId('report2-room')).toHaveTextContent(
      'The next opposing level is M15 sr_1 at 4,369.57, 2.37 away.'
    );
    expect(screen.getByTestId('report2-badge')).toHaveAttribute(
      'data-badge',
      'NONE'
    );
    expect(
      screen.getByText(
        'No scenario has its target before M15 sr_1 at 4,369.57, so none gets a badge.'
      )
    ).toBeInTheDocument();
  });

  test.each([
    ['CONSERVATIVE', 'Conservative'],
    ['NORMAL', 'Normal'],
    ['AGGRESSIVE', 'Aggressive'],
  ] as const)('a %s badge is named', (badge, name) => {
    const d = doc();
    renderIn(
      <RoomAndBadge
        room={d.room}
        badge={{
          badge,
          nameKey:
            `report2.scenario.${badge.toLowerCase()}` as 'report2.scenario.normal',
          why: null,
        }}
      />
    );
    expect(screen.getByTestId('report2-badge')).toHaveAttribute(
      'data-badge',
      badge
    );
    expect(
      within(screen.getByTestId('report2-badge')).getByText(name)
    ).toBeInTheDocument();
    expect(screen.queryByText('No badge')).not.toBeInTheDocument();
  });

  test.each([
    [{ state: 'NONE' } as const, REPORT2_TEXT['report2.room.none']],
    [{ state: 'UNKNOWN' } as const, REPORT2_TEXT['report2.room.unknown']],
    [{ state: 'NOT_SIZED' } as const, REPORT2_TEXT['report2.scenarios.empty']],
  ])('the room %j reads as its own sentence', (room, text) => {
    renderIn(
      <RoomAndBadge
        room={room}
        badge={{ badge: null, nameKey: null, why: null }}
      />
    );
    expect(screen.getByTestId('report2-room')).toHaveTextContent(text);
  });

  test('no badge because the levels could not be read says so', () => {
    renderIn(
      <RoomAndBadge
        room={{ state: 'UNKNOWN' }}
        badge={{
          badge: null,
          nameKey: null,
          why: { key: 'report2.badge.not_decided', params: {} },
        }}
      />
    );
    expect(
      screen.getByText(REPORT2_TEXT['report2.badge.not_decided'])
    ).toBeInTheDocument();
  });
});

describe('RiskPair', () => {
  test('puts declared and actual risk in two boxes of one row, with the lot and the leverage under them', () => {
    const d = doc();
    renderIn(<RiskPair risk={d.risk!} />);
    const pair = screen.getByTestId('report2-risk-pair');
    expect(pair.querySelector('.grid-cols-2')).not.toBeNull();
    expect(pair).toHaveTextContent('Declared risk$75.00');
    expect(pair).toHaveTextContent('Actual risk$68.28');
    expect(pair).toHaveTextContent('What you chose: 0.75% of your equity.');
    expect(pair).toHaveTextContent('Leverage used1.75×Your limit: 5.00×');
  });

  test('says plainly when the leverage limit, not the risk limit, set the lot (decision D17)', () => {
    const d = doc(
      {
        profile: {
          style: 'TREND_FOLLOWING',
          maxRiskPct: '1.5',
          maxLeverage: '1.5',
          equity: '5000',
        },
      },
      { ...Z1, equity: '5000' }
    );
    renderIn(<RiskPair risk={d.risk!} />);
    expect(
      screen.getByText('Your leverage limit set this lot, not your risk limit.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('report2-risk-pair')).toHaveTextContent(
      'Actual risk$17.07'
    );
  });

  test('says when the lot was rounded down, and not when it was not', () => {
    const d = doc();
    const risk = d.risk!;
    renderIn(<RiskPair risk={{ ...risk, roundedDown: true }} />);
    expect(
      screen.getByText(
        "The lot is rounded down to the broker's lot step, never up."
      )
    ).toBeInTheDocument();
  });

  test('without a lot there is no actual risk to show: a dash', () => {
    const d = doc(
      { profile: { equity: '300' } },
      { ...Z1, equity: '300', riskPct: '0.5' }
    );
    renderIn(<RiskPair risk={d.risk!} />);
    expect(screen.getByTestId('report2-risk-pair')).toHaveTextContent(
      'Actual risk—'
    );
    expect(screen.queryByText('Lot size')).not.toBeInTheDocument();
  });
});

describe('UnderflowHelp', () => {
  const underflow = () =>
    doc(
      { profile: { equity: '300' } },
      { ...Z1, equity: '300', riskPct: '0.5' }
    ).underflow!;

  test('states the facts and offers no button when nothing can be applied', () => {
    renderIn(<UnderflowHelp help={underflow()} />);
    const help = screen.getByTestId('report2-underflow');
    expect(help).toHaveTextContent(
      "The lot would be below your broker's minimum"
    );
    expect(help).toHaveTextContent('Report 2 never rounds a lot up.');
    expect(within(help).queryAllByRole('button')).toHaveLength(0);
  });

  test('pressing an option hands the trader’s own limit back, never a different equity', async () => {
    const onApply = jest.fn();
    const help = underflow();
    renderIn(<UnderflowHelp help={help} onApply={onApply} />);
    const buttons = within(
      screen.getByTestId('report2-underflow')
    ).queryAllByRole('button');
    expect(buttons.length).toBe(help.actions.length);
    if (buttons.length > 0) {
      await userEvent.setup().click(buttons[0]!);
      expect(onApply).toHaveBeenCalledWith(help.actions[0]);
    }
    for (const action of help.actions)
      expect(['RAISE_RISK', 'NEARER_STOP']).toContain(action.kind);
  });

  test('disabled turns the options off', () => {
    const help = underflow();
    renderIn(<UnderflowHelp help={help} onApply={jest.fn()} disabled />);
    for (const b of within(
      screen.getByTestId('report2-underflow')
    ).queryAllByRole('button')) {
      expect(b).toBeDisabled();
    }
  });

  test('is an alert', () => {
    renderIn(<UnderflowHelp help={underflow()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('the notices', () => {
  test('CompulsoryNotices carry the three texts in order, the broker line set apart', () => {
    renderIn(<CompulsoryNotices />);
    const note = screen.getByRole('note');
    const lines = within(note).getAllByText(/./);
    expect(lines.map((l) => l.textContent)).toEqual([
      REPORT2_TEXT['report2.notice.single_order'],
      REPORT2_TEXT['report2.notice.broker_order'],
      REPORT2_TEXT['report2.notice.calculation_tool'],
    ]);
    expect(lines[1]).toHaveClass('font-medium');
  });

  test('OfferNotices: a refresh button only when the caller can refresh', async () => {
    const notices = [
      {
        key: 'report2.notice.newer_cycle' as const,
        params: { time: { kind: 'time' as const, text: '1789765200' } },
      },
    ];
    const onRefresh = jest.fn();
    const { unmount } = renderIn(<OfferNotices notices={notices} />);
    expect(
      screen.queryByRole('button', { name: 'Refresh' })
    ).not.toBeInTheDocument();
    unmount();
    renderIn(<OfferNotices notices={notices} onRefresh={onRefresh} />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('OfferNotices is nothing at all when there is nothing to say', () => {
    const { container } = renderIn(<OfferNotices notices={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('NotOfferedNotice is an alert with the reason', () => {
    renderIn(
      <NotOfferedNotice
        reason={{ key: 'report2.not_offered.market_closed', params: {} }}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Report 2 is not available right now'
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The market is closed.'
    );
  });

  test('ReleaseWarnings lists each release and says when its time is approximate', () => {
    renderIn(
      <ReleaseWarnings
        warnings={[
          {
            name: { kind: 'raw', text: 'US Retail Sales' },
            time: { kind: 'time', text: '1789775700' },
            approximate: true,
          },
          {
            name: { kind: 'raw', text: 'US PPI' },
            time: { kind: 'time', text: '1789779300' },
            approximate: false,
          },
        ]}
      />
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText(/US Retail Sales is due at/)).toBeInTheDocument();
    expect(screen.getAllByText('The time is approximate.')).toHaveLength(1);
  });

  test('ReleaseWarnings is nothing at all with no release', () => {
    const { container } = renderIn(<ReleaseWarnings warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

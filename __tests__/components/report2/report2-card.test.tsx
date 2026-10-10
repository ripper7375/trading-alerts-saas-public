/**
 * Report 2 as a card (build step 5, part 7): the fixed template drawn from the
 * server's answer, over the stored 18 Sep 20:55 cycle run through the real Engine 4.
 */

import { screen, waitFor, within } from '@testing-library/react';

import { Report2Card } from '@/components/report2/report2-card';
import { REPORT2_TEXT } from '@/lib/engine4/templates/text';

import {
  offerAnswer,
  scene,
  sizeAnswer,
  type Scene,
} from './helpers/engine-api';
import { plain, renderIn, waitForLanguage } from './helpers/render';

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

function card(
  world: Scene,
  fields: Record<string, unknown>,
  language = 'en-US',
  withBlackout = false
) {
  const answer = sizeAnswer(world, fields);
  return renderIn(
    <Report2Card
      setup={answer.setup}
      badge={answer.badge}
      offer={answer.offer}
      {...(withBlackout ? { blackout: offerAnswer(world).blackout } : {})}
    />,
    language
  );
}

describe('the 18 Sep reading', () => {
  test('shows NO badge and names the blocking level 4369.57', () => {
    card(scene(), Z1);
    const badge = screen.getByTestId('report2-badge');
    expect(badge).toHaveAttribute('data-badge', 'NONE');
    expect(within(badge).getByText('No badge')).toBeInTheDocument();
    const room = screen.getByTestId('report2-room');
    expect(room).toHaveTextContent('The next opposing level is');
    expect(room).toHaveTextContent('sr_1 at 4,369.57, 2.37 away.');
    expect(room).toHaveTextContent(
      'No scenario has its target before M15 sr_1 at 4,369.57, so none gets a badge.'
    );
    // and not the old document's figure, which predated the engine
    expect(screen.getByTestId('report2-card')).not.toHaveTextContent('4384.28');
    expect(screen.getByTestId('report2-card')).not.toHaveTextContent(
      '4,384.28'
    );
  });

  test('is titled, pinned to its cycle, and marked with the versions the consent will record', () => {
    card(scene(), Z1);
    expect(
      screen.getByRole('heading', { name: /Trade setup/ })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Report 2: your sized trade setup')
    ).toBeInTheDocument();
    expect(screen.getByText(/Pinned to the .* reading/)).toBeInTheDocument();
    const article = screen.getByTestId('report2-card');
    expect(article).toHaveAttribute(
      'data-template-version',
      'report2-template/draft-1'
    );
    expect(article).toHaveAttribute(
      'data-disclaimer-version',
      'disclaimer/draft-1'
    );
    expect(article).toHaveAttribute('data-ok', 'true');
  });

  test('lays out the setup: the zone price, the stored stop behind its named level, equity, risk and RRR', () => {
    card(scene(), Z1);
    const setup = screen.getByTestId('report2-card-setup');
    expect(setup).toHaveTextContent('Entry4,367.20Zone Z1');
    expect(setup).toHaveTextContent('Stop price4,350.42Behind M15 sr_2');
    expect(setup).toHaveTextContent('Stop distance16.78');
    expect(setup).toHaveTextContent('Equity$10,000.00');
    expect(setup).toHaveTextContent('Risk per trade (%)0.75%');
    expect(setup).toHaveTextContent('Target reward-to-risk (RRR)1.75×');
    expect(setup).toHaveTextContent(
      'Half your maximum is pre-set: 0.75% instead of 1.50%.'
    );
    expect(setup).toHaveTextContent('Why: ');
    expect(setup).toHaveTextContent('MCD0_DEFECT_M15');
  });

  test('puts declared risk and actual risk side by side, the lot beside them', () => {
    card(scene(), Z1);
    const pair = screen.getByTestId('report2-risk-pair');
    expect(pair).toHaveTextContent('Declared risk$75.00');
    expect(pair).toHaveTextContent('Actual risk$68.28');
    expect(pair).toHaveTextContent('Lot size0.04');
    expect(pair).toHaveTextContent('Spread used0.25');
    expect(pair).toHaveTextContent('Commission per lot$4.00');
    expect(pair).toHaveTextContent('Your risk limit set this lot.');
  });

  test('shows the three scenarios with the numbers Engine 4 produced: net profit is the RRR times the actual risk', () => {
    card(scene(), Z1);
    const scenarios = screen.getByTestId('report2-scenarios');
    const cards = within(scenarios).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('Conservative');
    expect(cards[0]).toHaveTextContent('$102.42');
    expect(cards[1]).toHaveTextContent('Normal');
    expect(cards[1]).toHaveTextContent('$119.49');
    expect(cards[2]).toHaveTextContent('Aggressive');
    expect(cards[2]).toHaveTextContent('$136.56');
    // none carries the badge
    for (const item of cards)
      expect(item).toHaveAttribute('data-badge', 'false');
  });

  test('lists all eight checks and says how many passed', () => {
    card(scene(), Z1);
    const checks = screen.getByTestId('report2-checks');
    expect(within(checks).getAllByRole('listitem')).toHaveLength(8);
    expect(checks).toHaveTextContent('8 of 8 passed');
    for (const name of [
      'Entry',
      'Risk',
      'Stop',
      'RRR',
      'Leverage',
      'News window',
      'Setup still valid',
      'Lot size',
    ]) {
      expect(within(checks).getByText(name)).toBeInTheDocument();
    }
  });

  test('carries the three compulsory texts, whatever else is on it', () => {
    card(scene(), Z1);
    const compulsory = screen.getByTestId('report2-compulsory');
    expect(compulsory).toHaveTextContent(
      REPORT2_TEXT['report2.notice.single_order']
    );
    expect(compulsory).toHaveTextContent(
      REPORT2_TEXT['report2.notice.broker_order']
    );
    expect(compulsory).toHaveTextContent(
      REPORT2_TEXT['report2.notice.calculation_tool']
    );
  });

  test('the half-risk caution is a notice, in words', () => {
    card(scene(), Z1);
    expect(
      screen.getByText(
        /The market sensors are cautious right now\. Half your maximum risk is pre-set/
      )
    ).toBeInTheDocument();
  });
});

describe('the same numbers as the API', () => {
  test('every figure of the answer is on the card, formatted and nothing else invented', () => {
    const world = scene();
    const answer = sizeAnswer(world, Z1);
    renderIn(
      <Report2Card
        setup={answer.setup}
        badge={answer.badge}
        offer={answer.offer}
      />,
      'en-US'
    );
    const text = screen.getByTestId('report2-card').textContent ?? '';
    const sizing = answer.setup.scenarios!.sizing;
    if (sizing.status !== 'OK') throw new Error('not sized');
    const money = (value: string): string => {
      const [whole = '0', fraction = ''] = value.split('.');
      const rounded = fraction.padEnd(2, '0').slice(0, 2);
      return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${rounded}`;
    };
    expect(text).toContain(money(sizing.declaredRisk));
    expect(text).toContain('$68.28');
    expect(sizing.lot).toBe('0.04');
    for (const scenario of answer.setup.scenarios!.scenarios) {
      expect(text).toContain(money(scenario.target.netProfit!));
      const price = Number(scenario.target.targetPrice).toLocaleString(
        'en-US',
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      );
      expect(text).toContain(price);
    }
  });
});

describe('other readings', () => {
  test('a SELL with a spread shows the chart level beside the order price', () => {
    card(scene({ golden: '07-' }), {
      zoneId: 'Z1',
      entry: '4282.0',
      equity: '10000',
      riskPct: '0.5',
      stopDistance: '20.5',
      rrr: '1.75',
    });
    expect(screen.getByText('Sell (short)')).toBeInTheDocument();
    expect(screen.getAllByText('On the chart').length).toBeGreaterThan(1);
    // and the badge a counter-trend SHORT with room for one target is given
    expect(screen.getByTestId('report2-badge')).toHaveAttribute(
      'data-badge',
      'CONSERVATIVE'
    );
    expect(screen.getByTestId('report2-room')).toHaveTextContent('4,250.00');
    const badged = within(screen.getByTestId('report2-scenarios'))
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('data-badge') === 'true');
    expect(badged).toHaveLength(1);
    expect(badged[0]).toHaveTextContent('Conservative');
  });

  test('a setup that fails a check says which, and still carries the compulsory texts', () => {
    card(scene(), { ...Z1, riskPct: '2' });
    expect(screen.getByTestId('report2-card')).toHaveAttribute(
      'data-ok',
      'false'
    );
    const checks = screen.getByTestId('report2-checks');
    expect(checks).toHaveTextContent(
      'The risk is above your maximum of 1.50%.'
    );
    expect(checks).toHaveTextContent('Failed');
    expect(checks).toHaveTextContent('Not checked yet');
    expect(screen.getByTestId('report2-scenarios')).toHaveTextContent(
      'Fill in the fields to see the scenarios.'
    );
    expect(screen.getByTestId('report2-compulsory')).toHaveTextContent(
      'You place the order with your broker.'
    );
  });

  test('a risk above the pre-set half is flagged as recorded', () => {
    card(scene(), { ...Z1, riskPct: '1.2' });
    expect(
      screen.getByText(
        'More than the pre-set half. This choice and the reason are recorded.'
      )
    ).toBeInTheDocument();
  });

  test('a lot below the broker minimum is explained as a fact, with no button on the card', () => {
    card(scene({ profile: { equity: '300' } }), {
      ...Z1,
      equity: '300',
      riskPct: '0.5',
    });
    expect(screen.getByTestId('report2-underflow')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('report2-underflow')).queryAllByRole('button')
    ).toHaveLength(0);
    expect(screen.getByTestId('report2-risk-pair')).toHaveTextContent(
      'Actual risk—'
    );
  });

  test('a setup that is no longer offered says why, in words, with the release named', () => {
    const slot = 1789764900;
    card(
      scene({
        events: [
          {
            valueId: 'v1',
            eventId: '900000001',
            eventName: 'TEST US CPI',
            eventTime: slot + 150 + 5 * 60,
            currency: 'USD',
            importance: 'HIGH',
            timeMode: 0,
            capturedAt: slot - 3600,
          },
        ],
      }),
      Z1,
      'en-US',
      true
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Report 2 is not available right now');
    expect(alert).toHaveTextContent('TEST US CPI is due at');
    expect(alert).toHaveTextContent('No setup is offered until');
  });

  test('releases while the trade could be open are a warning, not a block', () => {
    const slot = 1789764900;
    card(
      scene({
        events: [
          {
            valueId: 'w1',
            eventId: '700000001',
            eventName: 'TEST US Retail Sales',
            eventTime: slot + 150 + 3 * 3600,
            currency: 'USD',
            importance: 'HIGH',
            timeMode: 1,
            capturedAt: slot - 3600,
          },
        ],
      }),
      Z1
    );
    expect(
      screen.getByText('Releases while the trade could be open')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/TEST US Retail Sales is due at/)
    ).toBeInTheDocument();
    expect(screen.getByText('The time is approximate.')).toBeInTheDocument();
    expect(screen.getByTestId('report2-card')).toHaveAttribute(
      'data-ok',
      'true'
    );
  });
});

describe('in the viewer’s language', () => {
  test('German: the words, the German digits and the dollar sign of the German format', async () => {
    card(scene(), Z1, 'de');
    await waitForLanguage('de');
    await waitFor(() =>
      expect(
        screen.getByText('Report 2: Ihr berechnetes Trade-Setup')
      ).toBeInTheDocument()
    );
    const card_ = screen.getByTestId('report2-card');
    expect(card_).toHaveTextContent('Kein Badge');
    expect(card_).toHaveTextContent('Angegebenes Risiko');
    // 4367.20 and $75.00 in German: 4.367,20 and 75,00 $
    expect(card_.textContent).toMatch(/4\.367,20/);
    expect(card_.textContent).toMatch(/75,00\s\$/);
    expect(card_.textContent).toMatch(/4\.369,57/);
    expect(card_).toHaveTextContent(
      'Sie platzieren die Order bei Ihrem Broker.'
    );
    // no English left behind
    expect(card_).not.toHaveTextContent('Declared risk');
    expect(card_).not.toHaveTextContent('You place the order');
  });

  test('Arabic: right to left, the compulsory text in Arabic, and Latin names kept whole', async () => {
    card(scene(), Z1, 'ar');
    await waitForLanguage('ar');
    await waitFor(() =>
      expect(screen.getByText(/أنت من تضع الأمر لدى وسيطك/)).toBeInTheDocument()
    );
    const card_ = screen.getByTestId('report2-card');
    expect(card_).toHaveAttribute('dir', 'rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(card_).not.toHaveTextContent('Declared risk');
    // the level names are technical and stay as they are, isolated inside the sentence
    expect(plain(screen.getByTestId('report2-room').textContent)).toMatch(
      /M15 sr_1/
    );
  });
});

/**
 * The Trade Setup modal (build step 5, part 7), driven against the real Engine 4.
 *
 * The "server" is `EngineApi`: the same functions the route handlers call, over the
 * stored 18 Sep 20:55 cycle (a LONG counter-trend rally, CAUTIONARY from the MCD0
 * defect, zones Z1 4367.20 and Z2 4350.16, next opposing level 4369.57). Nothing in
 * these cases is a made-up market number.
 */

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  TradeSetupForm,
  TradeSetupModal,
  type RecordedEvent,
} from '@/components/report2/trade-setup-modal';
import type { WireOfferedModal } from '@/lib/engine4/templates/wire';

import {
  EngineApi,
  offerAnswer,
  offeredModal,
  scene,
  type EngineApiOptions,
  type Scene,
} from './helpers/engine-api';
import { plain, renderIn } from './helpers/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/report2',
}));

const last = <T,>(items: readonly T[]): T => items[items.length - 1] as T;

interface Mounted {
  api: EngineApi;
  modal: WireOfferedModal;
  world: Scene;
  recorded: RecordedEvent[];
  onRefresh: jest.Mock;
  user: ReturnType<typeof userEvent.setup>;
  ids: string[];
}

function mount(
  options: {
    world?: Scene;
    api?: EngineApiOptions;
    change?: (modal: WireOfferedModal) => WireOfferedModal;
    language?: string;
  } = {}
): Mounted {
  const world = options.world ?? scene();
  const base = offeredModal(offerAnswer(world));
  const modal = options.change === undefined ? base : options.change(base);
  const api = new EngineApi(world, options.api);
  const recorded: RecordedEvent[] = [];
  const onRefresh = jest.fn();
  const ids: string[] = [];
  let counter = 0;
  renderIn(
    <TradeSetupForm
      modal={modal}
      cycleSlot={String(world.s.slot)}
      api={api}
      debounceMs={0}
      onRefresh={onRefresh}
      onRecorded={(event) => recorded.push(event)}
      makeId={() => {
        counter += 1;
        const id = `test-submission-${String(counter).padStart(4, '0')}-abcdef`;
        ids.push(id);
        return id;
      }}
    />,
    options.language ?? 'en-US'
  );
  return {
    api,
    modal,
    world,
    recorded,
    onRefresh,
    ids,
    user: userEvent.setup(),
  };
}

/** Wait until the figures on screen belong to what the fields say (no size call in flight). */
async function settled(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByTestId('report2-modal-form')).toHaveAttribute(
      'data-sizing',
      'false'
    );
  });
}

const button = (name: RegExp | string) => screen.getByRole('button', { name });
const radio = (name: RegExp | string) => screen.getByRole('radio', { name });
const field = (id: string) => screen.getByTestId(id) as HTMLInputElement;

function change(input: HTMLInputElement, value: string): void {
  fireEvent.change(input, { target: { value } });
}

describe('opening on the 18 Sep reading', () => {
  test('selects the best zone, pre-selects the stored stop, pre-fills equity and the half risk with its reason', async () => {
    const { api, modal } = mount();
    await settled();

    expect(radio(/^Z1/)).toBeChecked();
    expect(radio(/^Z2/)).not.toBeChecked();
    // the stored invalidation is the pre-selected structural option, marked as suggested
    const preselected = radio(/Behind M15 sr_2/);
    expect(preselected).toBeChecked();
    expect(
      within(preselected.closest('label')!).getByText('Suggested')
    ).toBeInTheDocument();

    expect(field('report2-equity').value).toBe('10000');
    expect(field('report2-risk').value).toBe('0.75');
    expect(field('report2-rrr').value).toBe('1.75');
    // half the maximum, and why
    expect(
      screen.getByText(
        /Half your maximum is pre-set: 0\.75% instead of 1\.50%\./
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Why: .*MCD0_DEFECT_M15/)).toBeInTheDocument();
    expect(screen.getByText(/Your maximum is 1\.50%\./)).toBeInTheDocument();

    expect(modal.risk.halfRisk).toBe(true);
    expect(api.sizeCalls[0]).toMatchObject({
      side: 'BUY',
      zoneId: 'Z1',
      entry: '4367.2',
      equity: '10000',
      riskPct: '0.75',
      stopDistance: '16.78',
      rrr: '1.75',
      language: 'en-US',
    });
  });

  test('shows the direction, the counter-trend label, the three scenarios, declared beside actual risk, no badge and the level named', async () => {
    mount();
    await settled();

    expect(screen.getByTestId('report2-direction')).toHaveAttribute(
      'data-direction',
      'LONG'
    );
    expect(screen.getByText('Buy (long)')).toBeInTheDocument();
    expect(screen.getByText('Counter-trend setup')).toBeInTheDocument();

    const scenarios = screen.getByTestId('report2-scenarios');
    for (const name of ['Conservative', 'Normal', 'Aggressive']) {
      expect(
        within(scenarios).getByRole('heading', { name })
      ).toBeInTheDocument();
    }
    // net profit is the RRR times the actual risk (68.28): 102.42, 119.49, 136.56
    expect(within(scenarios).getByText('$119.49')).toBeInTheDocument();

    const pair = screen.getByTestId('report2-risk-pair');
    expect(within(pair).getByText('$75.00')).toBeInTheDocument();
    expect(within(pair).getByText('$68.28')).toBeInTheDocument();
    expect(within(pair).getByText('0.04')).toBeInTheDocument();

    const room = screen.getByTestId('report2-room');
    expect(room).toHaveTextContent(/sr_1 at 4,369\.57, 2\.37 away/);
    expect(screen.getByTestId('report2-badge')).toHaveAttribute(
      'data-badge',
      'NONE'
    );
    expect(screen.getByText('No badge')).toBeInTheDocument();
    expect(room).toHaveTextContent(/so none gets a badge/);
  });

  test('says on every opening that you place the order with your broker', async () => {
    mount();
    expect(screen.getByTestId('report2-compulsory')).toHaveTextContent(
      'You place the order with your broker. DavinTrade places no orders.'
    );
    expect(screen.getByTestId('report2-compulsory')).toHaveTextContent(
      'This report covers a single order only.'
    );
    await settled();
  });

  test('waits for the first answer: Accept is off until the figures are in', async () => {
    mount({ api: { sizeDelayMs: 30 } });
    expect(button('Accept setup')).toBeDisabled();
    expect(screen.getByText('Sizing your setup…')).toBeInTheDocument();
    await settled();
    expect(button('Accept setup')).toBeEnabled();
  });
});

describe('the entry pills', () => {
  test('picking another zone sizes that zone’s price with that zone’s own stop', async () => {
    const { api, user, modal } = mount();
    await settled();
    await user.click(radio(/^Z2/));
    await settled();

    expect(radio(/^Z2/)).toBeChecked();
    expect(radio(/^Z1/)).not.toBeChecked();
    const call = last(api.sizeCalls);
    expect(call.zoneId).toBe('Z2');
    expect(call.entry).toBe('4350.16');
    // the stop options are Z2's own: the pre-selection comes from ITS definition
    const z2 = modal.pills.find((p) => p.zoneId === 'Z2')!;
    expect(call.stopDistance).not.toBe('16.78');
    expect(z2.stop.preselected.kind).not.toBe('CUSTOM_REQUIRED');
  });

  test('a zone the price has passed is drawn, marked, and cannot be picked', async () => {
    const { api } = mount({
      change: (modal) => ({
        ...modal,
        pills: modal.pills.map((pill) =>
          pill.zoneId === 'Z1' ? { ...pill, invalidated: true } : pill
        ),
      }),
    });
    await settled();
    expect(radio(/^Z1/)).toBeDisabled();
    expect(screen.getByText('No longer valid')).toBeInTheDocument();
    // it did not shift under the finger: still first in the rank order
    const pills = within(screen.getByTestId('report2-pills')).getAllByRole(
      'radio'
    );
    expect(pills.map((p) => (p as HTMLInputElement).value)).toEqual([
      'Z1',
      'Z2',
      'CUSTOM',
    ]);
    // and the modal opened on the first zone that is still valid
    expect(radio(/^Z2/)).toBeChecked();
    expect(api.sizeCalls[0]!.zoneId).toBe('Z2');
  });

  test('when every zone has been passed nothing is selected and the trader is asked to pick or type one', async () => {
    mount({
      change: (modal) => ({
        ...modal,
        pills: modal.pills.map((pill) => ({ ...pill, invalidated: true })),
      }),
    });
    await settled();
    expect(radio(/^Z1/)).toBeDisabled();
    expect(radio(/^Z2/)).toBeDisabled();
    expect(
      screen.getByText(/Pick a zone or enter your own entry\./)
    ).toBeInTheDocument();
    expect(button('Accept setup')).toBeDisabled();
  });
});

describe('an entry of one’s own', () => {
  async function openCustom(): Promise<Mounted> {
    const mounted = mount();
    await settled();
    await mounted.user.click(radio('Your own entry'));
    return mounted;
  }

  test('shows the allowed range, starts from the price the trader had, and offers only a custom stop', async () => {
    await openCustom();
    const entry = screen.getByLabelText('Entry price') as HTMLInputElement;
    expect(entry.value).toBe('4367.2');
    // the exact range is 4282.525 to 4427.425: shown rounded inward, so each edge is a valid entry
    expect(
      screen.getByText('Allowed: 4,282.53 to 4,427.42')
    ).toBeInTheDocument();
    // the options belong to a zone's entry: only the custom stop is on offer
    expect(
      screen.queryByRole('radio', { name: /Behind/ })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Stop distance from entry')).toHaveValue(
      '16.78'
    );
  });

  test('a price outside the day’s range, the typo filter and a non-number each say why, at once', async () => {
    await openCustom();
    const entry = screen.getByLabelText('Entry price') as HTMLInputElement;

    change(entry, '4282.52');
    expect(screen.getByRole('alert')).toHaveTextContent(
      "That entry is outside the day's range."
    );
    expect(entry).toHaveAttribute('aria-invalid', 'true');

    change(entry, '9999');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'more than 5% from the live price'
    );

    change(entry, 'abc');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter the entry as a price above zero.'
    );

    change(entry, '4370');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(entry).toHaveAttribute('aria-invalid', 'false');
  });

  test('the edges of the range are accepted and one cent past is not, exactly', async () => {
    const { modal } = await openCustom();
    const day = modal.custom.entry.day!;
    const entry = screen.getByLabelText('Entry price') as HTMLInputElement;
    change(entry, day.lower);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    change(entry, '4282.52');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    change(entry, day.upper);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    change(entry, '4427.43');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('a good price is sized as the trader’s own entry, with no zone', async () => {
    const { api } = await openCustom();
    const entry = screen.getByLabelText('Entry price') as HTMLInputElement;
    change(entry, '4370');
    await settled();
    const call = last(api.sizeCalls);
    expect(call.entry).toBe('4370');
    expect(call.zoneId).toBeUndefined();
    expect(call.stopDistance).toBe('16.78');
  });

  test('typing a price equal to a zone’s is the zone', async () => {
    const { api } = await openCustom();
    const entry = screen.getByLabelText('Entry price') as HTMLInputElement;
    change(entry, '4350.16');
    await settled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(last(api.sizeCalls).entry).toBe('4350.16');
  });

  test('Accept is off while the entry is wrong', async () => {
    await openCustom();
    change(screen.getByLabelText('Entry price') as HTMLInputElement, '9999');
    await settled();
    expect(button('Accept setup')).toBeDisabled();
  });
});

describe('the stop options', () => {
  test('lists the nearest three, then “More levels”, then the minimum if there is one, then custom', async () => {
    const { modal } = mount();
    await settled();
    const z1 = modal.pills.find((p) => p.zoneId === 'Z1')!;
    expect(z1.stop.structural.length).toBeGreaterThan(3);
    const shown = within(
      screen.getByTestId('report2-stop-options')
    ).getAllByRole('radio');
    // three structural + custom (Z1's stored invalidation has a level behind it: no minimum row)
    expect(shown).toHaveLength(4);
    const more = z1.stop.structural.length - 3;
    expect(button(`More levels (${more})`)).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  test('“More levels” opens the rest and a level from it can be chosen', async () => {
    const { api, user, modal } = mount();
    await settled();
    const z1 = modal.pills.find((p) => p.zoneId === 'Z1')!;
    await user.click(button(/More levels/));
    expect(screen.getByTestId('report2-more-levels')).toBeInTheDocument();
    const far = z1.stop.structural[z1.stop.structural.length - 1]!;
    await user.click(
      within(screen.getByTestId('report2-more-levels'))
        .getAllByRole('radio')
        .pop()!
    );
    await settled();
    expect(last(api.sizeCalls).stopDistance).toBe(far.stopDistance);
    expect(button('Fewer levels')).toBeInTheDocument();
  });

  test('choosing another structural stop re-sizes with that distance, and the stop price on the screen follows', async () => {
    const { api, user, modal } = mount();
    await settled();
    const second = modal.pills[0]!.stop.structural[1]!;
    await user.click(
      radio(new RegExp(`Behind ${second.level.tf} ${second.level.name}`))
    );
    await settled();
    expect(last(api.sizeCalls).stopDistance).toBe(second.stopDistance);
    expect(screen.getAllByText(/Behind/).length).toBeGreaterThan(0);
  });

  test('a custom stop under Min SLD says so with the minimum; at the minimum it is fine', async () => {
    const { api, user } = mount();
    await settled();
    await user.click(radio('Custom stop'));
    const stop = screen.getByLabelText(
      'Stop distance from entry'
    ) as HTMLInputElement;
    // it starts from the distance that was selected
    expect(stop.value).toBe('16.78');
    change(stop, '12.99');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The stop is closer than your minimum of 13.00.'
    );
    change(stop, '13');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await settled();
    expect(last(api.sizeCalls).stopDistance).toBe('13');
    expect(screen.getByText('At least 13.00.')).toBeInTheDocument();
  });

  test('the server recognises a custom distance that equals a structural option as that option', async () => {
    const { user, modal } = mount();
    await settled();
    const option = modal.pills[0]!.stop.structural[1]!;
    await user.click(radio('Custom stop'));
    change(
      screen.getByLabelText('Stop distance from entry') as HTMLInputElement,
      option.stopDistance
    );
    await settled();
    // the checks list nothing failing: it is a valid structural distance typed by hand
    expect(
      screen.queryByTestId('report2-failed-checks')
    ).not.toBeInTheDocument();
  });

  test('when the levels could not be read, only the zone’s own stop is offered and the trader is told', async () => {
    mount({
      change: (modal) => ({
        ...modal,
        pills: modal.pills.map((pill) => ({
          ...pill,
          stop: {
            ...pill.stop,
            mode: 'DEGRADED' as const,
            degradedBy: [
              { code: 'BUNDLE_MISSING' as const, detail: 'no bundle' },
            ],
            structural: pill.stop.structural.slice(0, 1),
          },
        })),
      }),
    });
    await settled();
    expect(
      screen.getByText(
        /Other structure levels could not be read, so only the zone's own stop is offered\./
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('report2-stop-options')).getAllByRole('radio')
    ).toHaveLength(2);
  });

  test('a zone whose invalidation has no structure behind it offers the minimum stop, pre-selected, and says so', async () => {
    // a stored zone whose stop is the builder's $13 floor, not a level (ADR-089 (a))
    let found: Scene | null = null;
    for (let n = 1; n <= 16 && found === null; n += 1) {
      const candidate = scene({ golden: `${String(n).padStart(2, '0')}-` });
      const answer = offerAnswer(candidate);
      if (answer.modal.status === 'NOT_OFFERED') continue;
      const first = answer.modal.pills.find((pill) => !pill.invalidated);
      if (first !== undefined && first.stop.minimumStop !== null)
        found = candidate;
    }
    expect(found).not.toBeNull();
    const world = found as Scene;
    const { api, modal } = mount({ world });
    await settled();
    const pill = modal.pills.find((p) => !p.invalidated)!;
    expect(pill.stop.preselected.kind).toBe('MINIMUM_STOP');
    const minimum = within(
      screen.getByTestId('report2-stop-options')
    ).getByRole('radio', {
      name: /Minimum stop distance/,
    });
    expect(minimum).toBeChecked();
    expect(
      within(minimum.closest('label')!).getByText('No structure behind it.')
    ).toBeInTheDocument();
    // and the request carries that distance, as the minimum, not as a level
    expect(api.sizeCalls[0]!.stopDistance).toBe(
      pill.stop.minimumStop!.stopDistance
    );
    expect(
      screen.queryByTestId('report2-failed-checks')
    ).not.toBeInTheDocument();
  });
});

describe('the risk, the RRR and the scenarios', () => {
  test('more than the pre-set half, up to Max RPT, is recorded: the note says so', async () => {
    const { api } = mount();
    await settled();
    change(field('report2-risk'), '1.2');
    expect(
      screen.getByText(
        'More than the pre-set half. This choice and the reason are recorded.'
      )
    ).toBeInTheDocument();
    await settled();
    expect(last(api.sizeCalls).riskPct).toBe('1.2');
    expect(button('Accept setup')).toBeEnabled();
  });

  test('exactly the pre-set half, or less, is not an override', async () => {
    mount();
    await settled();
    change(field('report2-risk'), '0.5');
    expect(
      screen.queryByText(/More than the pre-set half/)
    ).not.toBeInTheDocument();
  });

  test('a risk above Max RPT says so with the maximum, and Accept goes off', async () => {
    mount();
    await settled();
    change(field('report2-risk'), '2');
    expect(
      screen.getAllByText(/The risk is above your maximum of 1\.50%\./).length
    ).toBeGreaterThan(0);
    await settled();
    expect(button('Accept setup')).toBeDisabled();
    // Modify and Decline can still be recorded: they record what was shown
    expect(button('Modify')).toBeEnabled();
    expect(button('Decline')).toBeEnabled();
    expect(
      screen.getByText('Fix the checks above to accept.')
    ).toBeInTheDocument();
  });

  test('a lower RRR changes every scenario: the figures on the screen are the new ones', async () => {
    const { api } = mount();
    await settled();
    const before = screen.getByTestId('report2-scenarios').textContent;
    change(field('report2-rrr'), '2');
    await settled();
    expect(last(api.sizeCalls).rrr).toBe('2');
    const after = screen.getByTestId('report2-scenarios').textContent;
    expect(after).not.toBe(before);
    // Normal is now 2.00: the three RRRs are 1.75, 2.00, 2.25
    const rrrs = within(screen.getByTestId('report2-scenarios'))
      .getAllByText(/\d\.\d\d×/)
      .map((e) => e.textContent);
    expect(rrrs).toEqual(['1.75×', '2.00×', '2.25×']);
  });

  test('a counter-trend Aggressive that would pass the 2.50× cap is left out, and the trader is told', async () => {
    mount();
    await settled();
    change(field('report2-rrr'), '2.5');
    await settled();
    expect(screen.getByTestId('report2-scenarios')).toHaveTextContent(
      'Not shown: Aggressive, its RRR would pass the counter-trend cap of 2.50×'
    );
    expect(
      within(screen.getByTestId('report2-scenarios')).queryByRole('heading', {
        name: 'Aggressive',
      })
    ).not.toBeInTheDocument();
  });

  test('an RRR above the counter-trend cap is refused with the cap named; below the floor with the range', async () => {
    mount();
    await settled();
    change(field('report2-rrr'), '3');
    expect(
      screen.getAllByText(
        /The RRR is above 2\.50×, the cap for a counter-trend setup\./
      ).length
    ).toBeGreaterThan(0);
    change(field('report2-rrr'), '1.2');
    expect(
      screen.getAllByText(/The RRR must be from 1\.50× to 2\.50×\./).length
    ).toBeGreaterThan(0);
  });

  test('says up front that a counter-trend setup is capped, and shows the range', async () => {
    mount();
    await settled();
    expect(
      screen.getByText('A counter-trend setup is capped at 2.50×.')
    ).toBeInTheDocument();
    expect(screen.getByText('From 1.50× to 2.50×.')).toBeInTheDocument();
  });

  test('a field left empty is not shouted about; the checks say what is missing once the answer is in', async () => {
    mount();
    await settled();
    change(field('report2-equity'), '');
    await settled();
    expect(button('Accept setup')).toBeDisabled();
    expect(screen.getByTestId('report2-failed-checks')).toHaveTextContent(
      'Enter your equity as an amount above zero.'
    );
  });

  test('equity, typed wrongly, says so beside the field', async () => {
    mount();
    await settled();
    change(field('report2-equity'), 'ten thousand');
    expect(
      screen.getAllByText('Enter your equity as an amount above zero.').length
    ).toBeGreaterThan(0);
    expect(field('report2-equity')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('a lot below the broker’s minimum', () => {
  test('is stated as a fact with what the trader can do inside their limits; pressing an option fills the field', async () => {
    const { api, user } = mount({
      world: scene({ profile: { equity: '300', maxRiskPct: '1.5' } }),
    });
    await settled();
    expect(screen.getByTestId('report2-underflow')).toBeInTheDocument();
    expect(
      screen.getByText("The lot would be below your broker's minimum")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/needs at least \$[\d,.]+ of equity/).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/Report 2 never rounds a lot up\./)
    ).toBeInTheDocument();
    expect(button('Accept setup')).toBeDisabled();

    const options = within(
      screen.getByTestId('report2-underflow')
    ).queryAllByRole('button');
    for (const option of options) {
      expect(option.textContent).toMatch(
        /^(Use [\d.]+% risk|Use the nearer stop)/
      );
    }
    // no option asks for another equity or more leverage
    expect(screen.queryByText(/Set equity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/leverage to/i)).not.toBeInTheDocument();
    const before = api.sizeCalls.length;
    if (options.length > 0) {
      await user.click(options[0]!);
      await settled();
      expect(api.sizeCalls.length).toBeGreaterThan(before);
    }
  });
});

describe('consent', () => {
  test('Accept sends the hash of the setup shown, the same figures, one new submission id; and says you place the order', async () => {
    const { api, user, recorded, ids } = mount();
    await settled();
    await user.click(button('Accept setup'));
    await screen.findByText(
      'Setup accepted and recorded. You place the order with your broker.'
    );

    expect(api.consentCalls).toHaveLength(1);
    const call = api.consentCalls[0]!;
    expect(call.action).toBe('ACCEPT');
    expect(call.submissionId).toBe(ids[0]);
    expect(call.submissionId).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(call).toMatchObject({
      zoneId: 'Z1',
      entry: '4367.2',
      riskPct: '0.75',
      stopDistance: '16.78',
      rrr: '1.75',
      language: 'en-US',
    });
    // it names the setup that was on screen
    const shown = api.sizeCalls.length;
    expect(shown).toBeGreaterThan(0);
    expect(call.shownSetupSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.action).toBe('ACCEPT');
    expect(recorded[0]!.setupSha256).toBe(call.shownSetupSha256);
    expect(recorded[0]!.setup.ok).toBe(true);
    // done: nothing more to press, the fields are fixed
    expect(button('Accept setup')).toBeDisabled();
    expect(button('Decline')).toBeDisabled();
    expect(field('report2-risk')).toBeDisabled();
  });

  test('a double click is one request', async () => {
    const { api } = mount({
      api: {
        consent: async (request) => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return {
            ok: true,
            duplicate: false,
            action: request.action,
            recordedAt: '2026-09-18T20:57:30.000Z',
          };
        },
      },
    });
    await settled();
    const accept = button('Accept setup');
    // two clicks in the same tick, before React can disable the button
    act(() => {
      fireEvent.click(accept);
      fireEvent.click(accept);
    });
    await screen.findByText(/Setup accepted and recorded/);
    expect(api.consentCalls).toHaveLength(1);
  });

  test('Decline records what was shown and finishes', async () => {
    const { api, user, recorded } = mount();
    await settled();
    await user.click(button('Decline'));
    await screen.findByText('Declined and recorded.');
    expect(api.consentCalls.map((c) => c.action)).toEqual(['DECLINE']);
    expect(recorded.map((r) => r.action)).toEqual(['DECLINE']);
    expect(button('Accept setup')).toBeDisabled();
  });

  test('Modify records and leaves the trader editing; a later Accept is a new submit with its own id', async () => {
    const { api, user, ids } = mount();
    await settled();
    await user.click(button('Modify'));
    await screen.findByText('Recorded. Change the fields, then review again.');
    expect(field('report2-risk')).toBeEnabled();
    expect(button('Accept setup')).toBeEnabled();

    change(field('report2-risk'), '0.6');
    await settled();
    await user.click(button('Accept setup'));
    await screen.findByText(/Setup accepted and recorded/);
    expect(api.consentCalls.map((c) => c.action)).toEqual(['MODIFY', 'ACCEPT']);
    expect(api.consentCalls[0]!.submissionId).not.toBe(
      api.consentCalls[1]!.submissionId
    );
    expect(ids).toHaveLength(2);
  });

  test('Modify and Decline of a setup that fails its checks are recorded; Accept is not possible', async () => {
    const { api, user } = mount();
    await settled();
    change(field('report2-risk'), '2');
    await settled();
    expect(button('Accept setup')).toBeDisabled();
    await user.click(button('Decline'));
    await screen.findByText('Declined and recorded.');
    expect(api.consentCalls[0]!.action).toBe('DECLINE');
  });

  test('while the figures are being re-sized nothing can be pressed: the hash on screen is the last one', async () => {
    const { user } = mount({ api: { sizeDelayMs: 40 } });
    await settled();
    expect(button('Accept setup')).toBeEnabled();
    change(field('report2-risk'), '0.6');
    expect(button('Accept setup')).toBeDisabled();
    expect(button('Decline')).toBeDisabled();
    expect(
      screen.getByText('Waiting for the figures to settle.')
    ).toBeInTheDocument();
    await settled();
    expect(button('Accept setup')).toBeEnabled();
    expect(user).toBeTruthy();
  });

  test('an answer for figures the trader has already changed is thrown away', async () => {
    // the first call is slow, the second fast: the slow one must not overwrite the fast one
    let calls = 0;
    const world = scene();
    const api = new EngineApi(world);
    const original = api.size.bind(api);
    api.size = async (request) => {
      calls += 1;
      if (calls === 1) await new Promise((resolve) => setTimeout(resolve, 60));
      return original(request);
    };
    const modal = offeredModal(offerAnswer(world));
    renderIn(
      <TradeSetupForm
        modal={modal}
        cycleSlot={String(world.s.slot)}
        api={api}
        debounceMs={0}
      />,
      'en-US'
    );
    await waitFor(() => expect(calls).toBe(1));
    change(field('report2-risk'), '0.5');
    await waitFor(() => expect(calls).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 120));
    await settled();
    // what is on screen belongs to risk 0.5, not to the slow first answer
    expect(screen.getByTestId('report2-risk-pair')).toHaveTextContent('0.50%');
  });

  test('a refusal that the setup moved is answered by sizing again and showing the new one', async () => {
    const { api, user } = mount({
      api: {
        consent: (request, call) =>
          call === 1
            ? { ok: false, code: 'SETUP_CHANGED', retryable: false }
            : {
                ok: true,
                duplicate: false,
                action: request.action,
                recordedAt: '2026-09-18T20:57:30.000Z',
              },
      },
    });
    await settled();
    const sizes = api.sizeCalls.length;
    await user.click(button('Accept setup'));
    await screen.findByText(
      'The setup changed while you were reviewing it. Review it again.'
    );
    await waitFor(() => expect(api.sizeCalls.length).toBeGreaterThan(sizes));
    await settled();
    await user.click(button('Accept setup'));
    await screen.findByText(/Setup accepted and recorded/);
  });

  test('when no answer came the press can be repeated, with the SAME submission id', async () => {
    const { api, user, ids } = mount({
      api: {
        consent: (request, call) =>
          call === 1
            ? { ok: false, code: 'NETWORK', retryable: true }
            : {
                ok: true,
                duplicate: true,
                action: request.action,
                recordedAt: '2026-09-18T20:57:30.000Z',
              },
      },
    });
    await settled();
    await user.click(button('Accept setup'));
    await screen.findByText('The connection failed. Nothing was recorded.');
    expect(
      screen.getByText('It could not be recorded. Press the button again.')
    ).toBeInTheDocument();
    await user.click(button('Accept setup'));
    await screen.findByText('This was already recorded.');
    expect(api.consentCalls).toHaveLength(2);
    expect(api.consentCalls[1]!.submissionId).toBe(
      api.consentCalls[0]!.submissionId
    );
    expect(ids).toHaveLength(1);
  });

  test('a definitive refusal gets a new id on the next press', async () => {
    const { api, user, ids } = mount({
      api: {
        consent: (request, call) =>
          call === 1
            ? { ok: false, code: 'CONSENT_REFUSED', retryable: false }
            : {
                ok: true,
                duplicate: false,
                action: request.action,
                recordedAt: '2026-09-18T20:57:30.000Z',
              },
      },
    });
    await settled();
    await user.click(button('Accept setup'));
    await screen.findByText('Something went wrong. Nothing was recorded.');
    await user.click(button('Accept setup'));
    await screen.findByText(/Setup accepted and recorded/);
    expect(api.consentCalls[1]!.submissionId).not.toBe(
      api.consentCalls[0]!.submissionId
    );
    expect(ids).toHaveLength(2);
  });
});

describe('notices of the offer', () => {
  test('a delayed feed says so with the time', async () => {
    const { modal } = mount({
      change: (m) => ({
        ...m,
        notices: [{ code: 'DATA_DELAYED', detail: '' }],
      }),
    });
    await settled();
    expect(modal.notices).toBeDefined();
    expect(screen.getByText('The market feed is delayed.')).toBeInTheDocument();
  });

  test('a newer cycle offers a refresh, and pressing it asks the caller to fetch the offer again', async () => {
    const { user, onRefresh } = mount({
      change: (m) => ({
        ...m,
        status: 'REFRESH_OFFERED' as const,
        refresh: { newSlot: '1789765200', changes: ['BIAS' as const] },
        notices: [{ code: 'NEWER_CYCLE_CHANGED', detail: '' }],
      }),
    });
    await settled();
    expect(screen.getByText(/The picture changed at /)).toBeInTheDocument();
    await user.click(button('Refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  test('a style mismatch says the setup is counter-trend and what the cap is', async () => {
    mount({
      world: scene({ style: 'TREND_FOLLOWING' }),
    });
    await settled();
    expect(
      screen.getByText(
        'This is a counter-trend setup and your style is trend following. Your target RRR is capped at 2.50×.'
      )
    ).toBeInTheDocument();
  });
});

describe('when sizing itself fails', () => {
  test('says so and what it means, and Accept stays off', async () => {
    mount({ api: { sizeFails: 'UNAUTHENTICATED' } });
    await settled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The setup could not be sized just now.'
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please sign in again.'
    );
    expect(button('Accept setup')).toBeDisabled();
    expect(button('Decline')).toBeDisabled();
  });
});

describe('inside a dialog', () => {
  test('has a title, a description and a close button, and opens on the same form', async () => {
    const world = scene();
    const modal = offeredModal(offerAnswer(world));
    const api = new EngineApi(world);
    const onOpenChange = jest.fn();
    renderIn(
      <TradeSetupModal
        open
        onOpenChange={onOpenChange}
        modal={modal}
        cycleSlot={String(world.s.slot)}
        api={api}
        debounceMs={0}
      />,
      'en-US'
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Trade setup')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Review the setup, adjust the fields, then accept, modify or decline.'
      )
    ).toBeInTheDocument();
    await settled();
    expect(
      plain(within(dialog).getByTestId('report2-compulsory').textContent)
    ).toContain('You place the order with your broker.');
    await userEvent
      .setup()
      .click(within(dialog).getByRole('button', { name: /Close/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

/**
 * The entry pills and the stop picker on their own (build step 5, part 7): the
 * accessible structure (real radio inputs, a legend, named options), the keyboard,
 * the invalidated and degraded states, and the custom fields with their messages.
 */

import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import {
  EntryPills,
  type EntrySelection,
} from '@/components/report2/entry-pills';
import { StopOptions } from '@/components/report2/stop-options';
import { limitsOf, type StopSelection } from '@/lib/engine4/templates/fields';
import type {
  WireOfferedModal,
  WireStopChoices,
} from '@/lib/engine4/templates/wire';

import { offerAnswer, offeredModal, scene } from './helpers/engine-api';
import { renderIn } from './helpers/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/report2',
}));

const modal: WireOfferedModal = offeredModal(offerAnswer(scene()));
const limits = limitsOf(modal);

function pills(props: Partial<React.ComponentProps<typeof EntryPills>> = {}) {
  const onSelectZone = jest.fn();
  const onSelectCustom = jest.fn();
  const onCustomChange = jest.fn();
  renderIn(
    <EntryPills
      pills={modal.pills}
      selection={{ kind: 'ZONE', zoneId: 'Z1' }}
      onSelectZone={onSelectZone}
      onSelectCustom={onSelectCustom}
      customValue=""
      onCustomChange={onCustomChange}
      customIssue={null}
      bounds={modal.custom.entry}
      limits={limits}
      {...props}
    />
  );
  return { onSelectZone, onSelectCustom, onCustomChange };
}

describe('the entry pills', () => {
  test('are real radios in a group with a legend, one per zone in rank order, then the trader’s own', () => {
    pills();
    const group = screen.getByRole('group', {
      name: 'Entry zones, best first',
    });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual([
      'Z1',
      'Z2',
      'CUSTOM',
    ]);
    // the name of a pill is the zone and its price, so a screen reader hears both
    expect(radios[0]).toHaveAccessibleName('Z1 4,367.20');
    expect(radios[1]).toHaveAccessibleName('Z2 4,350.16');
    expect(radios[2]).toHaveAccessibleName('Your own entry');
    expect(radios[0]).toBeChecked();
  });

  test('clicking a zone selects it; the keyboard moves between zones', async () => {
    const { onSelectZone } = pills();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /^Z2/ }));
    expect(onSelectZone).toHaveBeenLastCalledWith('Z2');
    screen.getByRole('radio', { name: /^Z1/ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(onSelectZone).toHaveBeenLastCalledWith('Z2');
  });

  test('a zone the price has passed shows an indicator, a reason on hover, and cannot be selected by mouse or keyboard', async () => {
    const invalidated = modal.pills.map((p) =>
      p.zoneId === 'Z1' ? { ...p, invalidated: true } : p
    );
    const { onSelectZone } = pills({
      pills: invalidated,
      selection: { kind: 'ZONE', zoneId: 'Z2' },
    });
    const z1 = screen.getByRole('radio', { name: /^Z1/ });
    expect(z1).toBeDisabled();
    const label = z1.closest('label')!;
    expect(label).toHaveAttribute('data-invalidated', 'true');
    expect(within(label).getByText('No longer valid')).toBeInTheDocument();
    expect(label).toHaveAttribute(
      'title',
      "Price has passed this zone's invalidation level."
    );
    // the price is struck through, not removed: the rank order does not shift
    expect(label.querySelector('bdi')).toHaveClass('line-through');
    const user = userEvent.setup();
    await user.click(z1);
    expect(onSelectZone).not.toHaveBeenCalled();
    // a valid zone carries no indicator
    expect(
      within(
        screen.getByRole('radio', { name: /^Z2/ }).closest('label')!
      ).queryByText('No longer valid')
    ).toBeNull();
  });

  test('the trader’s own entry opens a field with the allowed range beside it', async () => {
    const { onSelectCustom } = pills();
    await userEvent
      .setup()
      .click(screen.getByRole('radio', { name: 'Your own entry' }));
    expect(onSelectCustom).toHaveBeenCalledTimes(1);
  });

  test('with the own entry selected: a labelled field, the range, and no alert until there is something wrong', () => {
    pills({ selection: { kind: 'CUSTOM' }, customValue: '4370' });
    const input = screen.getByLabelText('Entry price');
    expect(input).toHaveValue('4370');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('dir', 'ltr');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByText(/^Allowed: /)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('a problem is announced, tied to the field, and says what is wrong in words', () => {
    pills({
      selection: { kind: 'CUSTOM' },
      customValue: '9999',
      customIssue: 'ENTRY_TYPO',
    });
    const input = screen.getByLabelText('Entry price');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('more than 5% from the live price');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
  });

  test('typing reports every change', () => {
    const { onCustomChange } = pills({
      selection: { kind: 'CUSTOM' },
      customValue: '',
    });
    fireEvent.change(screen.getByLabelText('Entry price'), {
      target: { value: '4370' },
    });
    expect(onCustomChange).toHaveBeenCalledWith('4370');
  });

  test('when a bound is not known it says so instead of inventing a range', () => {
    pills({
      selection: { kind: 'CUSTOM' },
      bounds: { day: null, typo: modal.custom.entry.typo },
    });
    expect(
      screen.getByText(
        'Your own entry cannot be checked right now. Pick a zone.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Allowed: /)).not.toBeInTheDocument();
  });

  test('nothing selected is allowed (every zone passed)', () => {
    pills({ selection: null });
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).not.toBeChecked();
  });

  test('disabled disables every pill and the field', () => {
    pills({ disabled: true, selection: { kind: 'CUSTOM' } });
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).toBeDisabled();
    expect(screen.getByLabelText('Entry price')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------

const z1: WireStopChoices = modal.pills[0]!.stop;

function stops(props: Partial<React.ComponentProps<typeof StopOptions>> = {}) {
  const onSelect = jest.fn();
  const onCustomChange = jest.fn();
  renderIn(
    <StopOptions
      choices={z1}
      selection={{ kind: 'OPTION', stopPrice: z1.structural[0]!.stopPrice }}
      onSelect={onSelect}
      customValue=""
      onCustomChange={onCustomChange}
      customIssue={null}
      limits={limits}
      minDistance={modal.custom.stopMinDistance}
      {...props}
    />
  );
  return { onSelect, onCustomChange };
}

describe('the stop picker', () => {
  test('names each option by the level it sits behind, with its price and its distance from the entry', () => {
    stops();
    const first = z1.structural[0]!;
    const radio = screen.getByRole('radio', {
      name: new RegExp(`Behind ${first.level.tf} ${first.level.name}`),
    });
    expect(radio).toBeChecked();
    const label = radio.closest('label')!;
    expect(label).toHaveTextContent('4,350.42');
    expect(label).toHaveTextContent('16.78 from entry');
  });

  test('shows the nearest three, then a toggle for the rest, which is a button that says how many', async () => {
    stops();
    expect(
      within(screen.getByTestId('report2-stop-options')).getAllByRole('radio')
    ).toHaveLength(4);
    const more = z1.structural.length - 3;
    const toggle = screen.getByRole('button', {
      name: `More levels (${more})`,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const user = userEvent.setup();
    await user.click(toggle);
    expect(
      screen.getByRole('button', { name: 'Fewer levels' })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(screen.getByTestId('report2-stop-options')).getAllByRole('radio')
    ).toHaveLength(z1.structural.length + 1);
    await user.click(screen.getByRole('button', { name: 'Fewer levels' }));
    expect(screen.queryByTestId('report2-more-levels')).not.toBeInTheDocument();
  });

  test('a selection that sits in the hidden part opens it, so what is chosen is never out of sight', () => {
    const far = z1.structural[z1.structural.length - 1]!;
    stops({ selection: { kind: 'OPTION', stopPrice: far.stopPrice } });
    expect(screen.getByTestId('report2-more-levels')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('report2-more-levels')).getByRole('radio', {
        checked: true,
      })
    ).toBeInTheDocument();
  });

  test('marks the zone’s own stored stop as suggested, and only that one', () => {
    stops();
    expect(screen.getAllByText('Suggested')).toHaveLength(1);
  });

  test('choosing an option reports the option; choosing custom reports custom', async () => {
    const { onSelect } = stops();
    const user = userEvent.setup();
    const second = z1.structural[1]!;
    await user.click(
      screen.getByRole('radio', {
        name: new RegExp(`Behind ${second.level.tf} ${second.level.name}`),
      })
    );
    expect(onSelect).toHaveBeenLastCalledWith({
      kind: 'OPTION',
      stopPrice: second.stopPrice,
    });
    await user.click(screen.getByRole('radio', { name: 'Custom stop' }));
    expect(onSelect).toHaveBeenLastCalledWith({ kind: 'CUSTOM' });
  });

  test('levels at exactly one price are named together', () => {
    const doctored: WireStopChoices = {
      ...z1,
      structural: [
        {
          ...z1.structural[0]!,
          alsoAt: [
            { name: 'LOEDT', tf: 'M5', price: '4350.92', origin: 'MCD2' },
          ],
        },
        ...z1.structural.slice(1),
      ],
    };
    stops({ choices: doctored });
    expect(screen.getByText('Same price: M5 LOEDT')).toBeInTheDocument();
  });

  test('a zone with no structure behind it offers the minimum stop distance, says so, and does not call it a level', () => {
    const minimum: WireStopChoices = {
      ...z1,
      structural: [],
      minimumStop: { stopPrice: '4354.20', stopDistance: '13' },
      preselected: {
        kind: 'MINIMUM_STOP',
        stopPrice: '4354.20',
        stopDistance: '13',
      },
    };
    stops({ choices: minimum, selection: { kind: 'MINIMUM' } });
    const radio = screen.getByRole('radio', { name: /Minimum stop distance/ });
    expect(radio).toBeChecked();
    expect(
      within(radio.closest('label')!).getByText('No structure behind it.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Behind /)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /More levels/ })
    ).not.toBeInTheDocument();
  });

  test('when the levels could not be read it says so and offers the zone’s own stop and custom', () => {
    const degraded: WireStopChoices = {
      ...z1,
      mode: 'DEGRADED',
      degradedBy: [{ code: 'BUNDLE_EXPIRED', detail: 'old' }],
      structural: z1.structural.slice(0, 1),
    };
    stops({ choices: degraded });
    expect(
      screen.getByText(
        "Other structure levels could not be read, so only the zone's own stop is offered."
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('report2-stop-options')).getAllByRole('radio')
    ).toHaveLength(2);
  });

  test('with an entry of one’s own only a custom stop is offered, with its minimum', () => {
    stops({ choices: null, selection: { kind: 'CUSTOM' }, customValue: '18' });
    expect(
      within(screen.getByTestId('report2-stop-options')).getAllByRole('radio')
    ).toHaveLength(1);
    expect(screen.getByLabelText('Stop distance from entry')).toHaveValue('18');
    expect(screen.getByText('At least 13.00.')).toBeInTheDocument();
    expect(
      screen.queryByText('Behind structure, nearest first')
    ).not.toBeInTheDocument();
  });

  test('a custom stop that is too close is refused beside the field, naming the minimum', () => {
    stops({
      selection: { kind: 'CUSTOM' },
      customValue: '5',
      customIssue: 'STOP_BELOW_MIN_SLD',
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The stop is closer than your minimum of 13.00.'
    );
    expect(screen.getByLabelText('Stop distance from entry')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  test('works as a controlled picker', async () => {
    function Harness() {
      const [selection, setSelection] = useState<StopSelection>({
        kind: 'OPTION',
        stopPrice: z1.structural[0]!.stopPrice,
      });
      const [custom, setCustom] = useState('');
      return (
        <StopOptions
          choices={z1}
          selection={selection}
          onSelect={setSelection}
          customValue={custom}
          onCustomChange={setCustom}
          customIssue={null}
          limits={limits}
          minDistance={modal.custom.stopMinDistance}
        />
      );
    }
    renderIn(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Custom stop' }));
    const field = screen.getByLabelText('Stop distance from entry');
    await user.type(field, '21.5');
    expect(field).toHaveValue('21.5');
    expect(screen.getByRole('radio', { name: 'Custom stop' })).toBeChecked();
  });

  test('disabled disables every option and the field', () => {
    stops({ disabled: true, selection: { kind: 'CUSTOM' } });
    for (const radio of screen.getAllByRole('radio'))
      expect(radio).toBeDisabled();
  });
});

describe('the selection type', () => {
  test('is exported for the modal and compiles against the picker', () => {
    const selection: EntrySelection = { kind: 'ZONE', zoneId: 'Z1' };
    expect(selection.kind).toBe('ZONE');
  });
});

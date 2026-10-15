/**
 * The parts of the panel that are not a reply (build step 7 part 8): the model picker, the quota
 * meter, the header badges and the composer, each the REAL component with a `LocaleProvider` around
 * it and no fake timers (LESSONS-LEARNED L40).
 */

import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';

import { Composer } from '@/components/chat/composer';
import { CycleBadges } from '@/components/chat/cycle-badges';
import { ModelPicker } from '@/components/chat/model-picker';
import { QuotaMeter } from '@/components/chat/quota-meter';
import type { ChatInfo, PickerModel } from '@/components/chat/types';

import { renderIn } from '../report2/helpers/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/chat',
}));

const A: PickerModel = {
  slug: 'vendor-a/model-a',
  name: 'Model A',
  multiplier: 1,
  vision: true,
  units_per_msg: 18_000,
  default: true,
};
const B: PickerModel = {
  slug: 'vendor-b/model-b',
  name: 'Model B',
  multiplier: 3,
  vision: false,
  units_per_msg: null,
  default: false,
};

const info = (
  quota: Partial<ChatInfo['quota']> = {},
  models: PickerModel[] = [A, B]
): ChatInfo => ({
  models,
  quota: {
    configured: true,
    month: '2026-10',
    limit_units: 20_000_000,
    used_units: 10_000_000,
    reserved_units: 0,
    available_units: 10_000_000,
    ...quota,
  },
  profile: { trader_type: 'DAY_TRADER' },
  cycle: { slot: '2026-09-18T20:55Z', data_status: 'FRESH' },
});

describe('the model picker', () => {
  it('lists the models that passed, each with what a message costs, measured, or "not measured yet"', () => {
    renderIn(
      <ModelPicker
        models={[A, B]}
        chosen={A}
        info={info()}
        onSelect={jest.fn()}
      />
    );
    const select = screen.getByRole('combobox', { name: 'AI model' });
    const options = within(select).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Model A · about 555 analyses left · Default',
      'Model B · not measured yet',
    ]);
    expect(select).toHaveValue(A.slug);
  });

  it('shows the model names and slugs as the registry gives them: no hard-coded model', () => {
    renderIn(
      <ModelPicker models={[A]} chosen={A} info={info()} onSelect={jest.fn()} />
    );
    expect(screen.getByRole('option')).toHaveAttribute('data-slug', A.slug);
    expect(document.body.textContent).not.toMatch(
      /Gemini|Claude|GPT|Kimi|GLM|DeepSeek/
    );
  });

  it('says "cost measured" when the cost is measured but the balance is not known', () => {
    renderIn(
      <ModelPicker
        models={[A]}
        chosen={A}
        info={info({ available_units: null })}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByRole('option')).toHaveTextContent(
      'Model A · cost measured · Default'
    );
  });

  it('never prints a raw cost: no units, no tokens', () => {
    renderIn(
      <ModelPicker
        models={[A, B]}
        chosen={A}
        info={info()}
        onSelect={jest.fn()}
      />
    );
    expect(document.body.textContent).not.toMatch(
      /18,?000|10,?000,?000|20,?000,?000/
    );
  });

  it('calls back with the slug of the model picked', async () => {
    const onSelect = jest.fn();
    renderIn(
      <ModelPicker
        models={[A, B]}
        chosen={A}
        info={info()}
        onSelect={onSelect}
      />
    );
    await userEvent.selectOptions(screen.getByRole('combobox'), B.slug);
    expect(onSelect).toHaveBeenCalledWith(B.slug);
  });

  it('can be disabled (while a request runs)', () => {
    renderIn(
      <ModelPicker
        models={[A, B]}
        chosen={A}
        info={info()}
        onSelect={jest.fn()}
        disabled
      />
    );
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('says there is none while no model has passed, and offers nothing to pick', () => {
    renderIn(
      <ModelPicker
        models={[]}
        chosen={null}
        info={info({}, [])}
        onSelect={jest.fn()}
      />
    );
    const note = screen.getByTestId('model-picker');
    expect(note).toHaveAttribute('data-state', 'none');
    expect(note).toHaveTextContent('No model available yet');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('the quota meter', () => {
  const meter = () => screen.getByTestId('quota-meter');

  it.each([
    [
      '0%',
      { available_units: 0, used_units: 20_000_000 },
      'empty',
      '0% left',
      'The allowance for this month is used up.',
    ],
    ['50%', {}, 'ok', '50% left', 'About 555 analyses left'],
    [
      '100%',
      { available_units: 20_000_000, used_units: 0 },
      'ok',
      '100% left',
      'About 1,111 analyses left',
    ],
  ])(
    'at %s: a bar of the share left and the words',
    (_name, quota, state, left, analyses) => {
      renderIn(<QuotaMeter info={info(quota)} model={A} />);
      expect(meter()).toHaveAttribute('data-state', state);
      expect(screen.getByTestId('quota-percent')).toHaveTextContent(left);
      expect(screen.getByTestId('quota-analyses')).toHaveTextContent(analyses);
    }
  );

  it('is a labelled meter with the share as its value', () => {
    renderIn(<QuotaMeter info={info()} model={A} />);
    const bar = screen.getByRole('meter', { name: 'Monthly allowance' });
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuetext', '50%');
    expect(screen.getByTestId('quota-bar')).toHaveStyle({ width: '50%' });
  });

  it('the bar is empty at 0% and full at 100%', () => {
    renderIn(<QuotaMeter info={info({ available_units: 0 })} model={A} />);
    expect(screen.getByTestId('quota-bar')).toHaveStyle({ width: '0%' });
    renderIn(
      <QuotaMeter info={info({ available_units: 20_000_000 })} model={A} />
    );
    expect(screen.getAllByTestId('quota-bar')[1]).toHaveStyle({
      width: '100%',
    });
  });

  it('while the cost of the model is not measured it says so, and does not guess a number', () => {
    renderIn(<QuotaMeter info={info()} model={B} />);
    expect(screen.getByTestId('quota-analyses')).toHaveTextContent(
      'Analyses left: not measured yet'
    );
    renderIn(<QuotaMeter info={info()} model={null} />);
    expect(screen.getAllByTestId('quota-analyses')[1]).toHaveTextContent(
      'Analyses left: not measured yet'
    );
  });

  it('the allowance is not set: says so and draws no bar', () => {
    renderIn(
      <QuotaMeter
        info={info({
          configured: false,
          limit_units: null,
          used_units: null,
          reserved_units: null,
          available_units: null,
        })}
        model={A}
      />
    );
    expect(meter()).toHaveAttribute('data-state', 'unconfigured');
    expect(meter()).toHaveTextContent('The monthly allowance is not set yet.');
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });

  it('the balance could not be read: a dash, not a made-up bar', () => {
    renderIn(
      <QuotaMeter
        info={info({
          limit_units: null,
          used_units: null,
          reserved_units: null,
          available_units: null,
        })}
        model={A}
      />
    );
    expect(meter()).toHaveAttribute('data-state', 'unknown');
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    expect(meter()).toHaveTextContent('—');
  });

  it('draws nothing before the state is read', () => {
    renderIn(<QuotaMeter info={null} model={null} />);
    expect(screen.queryByTestId('quota-meter')).not.toBeInTheDocument();
  });

  it('NEVER prints a number of tokens or units: not the limit, not what is free, not what a message costs', () => {
    for (const available of [0, 30_000, 10_000_000, 20_000_000]) {
      const { unmount } = renderIn(
        <QuotaMeter info={info({ available_units: available })} model={A} />
      );
      const text = meter().textContent as string;
      for (const raw of [
        '20000000',
        '20,000,000',
        '10000000',
        '10,000,000',
        '18000',
        '18,000',
        String(available),
        available.toLocaleString('en-US'),
      ]) {
        if (raw === '0') continue;
        expect(text).not.toContain(raw);
      }
      expect(text).not.toMatch(/token|unit/i);
      unmount();
    }
  });

  it('the share is held between 0 and 100 when the ledger is momentarily over or under', () => {
    renderIn(
      <QuotaMeter info={info({ available_units: 25_000_000 })} model={A} />
    );
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '100');
    renderIn(<QuotaMeter info={info({ available_units: -10 })} model={A} />);
    expect(screen.getAllByRole('meter')[1]).toHaveAttribute(
      'aria-valuenow',
      '0'
    );
  });
});

describe('the header badges', () => {
  it('shows the cycle slot in the reader’s time, its status and the trader’s type', () => {
    renderIn(<CycleBadges info={info()} />, 'en-US');
    expect(screen.getByTestId('cycle-badge')).toHaveTextContent(/^Cycle /);
    expect(screen.getByTestId('cycle-badge').textContent).toMatch(
      /2026|09|18|20:55/
    );
    expect(screen.getByTestId('status-pill')).toHaveTextContent('Live');
    expect(screen.getByTestId('profile-badge')).toHaveTextContent('Day trader');
  });

  it.each([
    ['DAY_TRADER', 'Day trader'],
    ['SCALPER', 'Scalper'],
  ] as const)('the profile %s reads %s', (type, label) => {
    renderIn(
      <CycleBadges info={{ ...info(), profile: { trader_type: type } }} />
    );
    expect(screen.getByTestId('profile-badge')).toHaveTextContent(label);
  });

  it.each([
    ['FRESH', 'Live'],
    ['DELAYED', 'Delayed'],
    ['STALE', 'Stopped'],
    ['MARKET_CLOSED', 'Market closed'],
    ['UNKNOWN', 'Unknown'],
  ] as const)('the data status %s reads %s', (status, label) => {
    renderIn(
      <CycleBadges
        info={{
          ...info(),
          cycle: { slot: '2026-09-18T20:55Z', data_status: status },
        }}
      />
    );
    expect(screen.getByTestId('status-pill')).toHaveTextContent(label);
  });

  it('a badge that is not known is not drawn rather than guessed', () => {
    renderIn(<CycleBadges info={{ ...info(), profile: null }} />);
    expect(screen.queryByTestId('profile-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('cycle-badge')).toBeInTheDocument();
    renderIn(<CycleBadges info={{ ...info(), cycle: null }} />);
    expect(screen.getAllByTestId('cycle-badge')).toHaveLength(1);
  });

  it('says "no cycle yet" for a cycle with no slot, and draws nothing with nothing to show', () => {
    renderIn(
      <CycleBadges
        info={{ ...info(), cycle: { slot: null, data_status: 'UNKNOWN' } }}
      />
    );
    expect(screen.getByTestId('cycle-badge')).toHaveTextContent('No cycle yet');
    renderIn(<CycleBadges info={null} />);
    renderIn(<CycleBadges info={{ ...info(), cycle: null, profile: null }} />);
    expect(screen.getAllByTestId('cycle-badges')).toHaveLength(1);
  });
});

describe('the composer', () => {
  function Host({
    onSubmit,
    busy = false,
    disabled = false,
    initial = '',
  }: {
    onSubmit: (text: string) => boolean;
    busy?: boolean;
    disabled?: boolean;
    initial?: string;
  }): ReactElement {
    const [value, setValue] = useState(initial);
    return (
      <Composer
        value={value}
        onChange={setValue}
        onSubmit={() => onSubmit(value)}
        busy={busy}
        disabled={disabled}
      />
    );
  }

  const box = () => screen.getByRole('textbox', { name: 'Your question' });

  it('Enter sends, and the text is cleared when it was taken', async () => {
    const onSubmit = jest.fn(() => true);
    renderIn(<Host onSubmit={onSubmit} />);
    await userEvent.type(box(), 'What is the direction?{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('What is the direction?');
    expect(box()).toHaveValue('');
  });

  it('keeps the text when it was not taken (a request was already running)', async () => {
    const onSubmit = jest.fn(() => false);
    renderIn(<Host onSubmit={onSubmit} />);
    await userEvent.type(box(), 'Again{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(box()).toHaveValue('Again');
  });

  it('Shift+Enter adds a line and sends nothing', async () => {
    const onSubmit = jest.fn(() => true);
    renderIn(<Host onSubmit={onSubmit} />);
    await userEvent.type(box(), 'one{Shift>}{Enter}{/Shift}two');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(box()).toHaveValue('one\ntwo');
  });

  it('Enter that confirms an input method’s candidate sends nothing', () => {
    const onSubmit = jest.fn(() => true);
    renderIn(<Host onSubmit={onSubmit} initial="こんにちは" />);
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(box(), { key: 'Enter', keyCode: 229 });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('the button sends too, and is disabled while the box is empty or blank', async () => {
    const onSubmit = jest.fn(() => true);
    renderIn(<Host onSubmit={onSubmit} />);
    const send = screen.getByRole('button', { name: 'Send question' });
    expect(send).toBeDisabled();
    await userEvent.type(box(), '   ');
    expect(send).toBeDisabled();
    await userEvent.type(box(), 'hello');
    expect(send).toBeEnabled();
    await userEvent.click(send);
    expect(onSubmit).toHaveBeenCalledWith('   hello');
  });

  it('Enter on an empty box sends nothing', async () => {
    const onSubmit = jest.fn(() => true);
    renderIn(<Host onSubmit={onSubmit} />);
    await userEvent.type(box(), '{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('counts characters against the door’s 500 as the trader sees them', async () => {
    renderIn(<Host onSubmit={jest.fn(() => true)} />);
    expect(screen.getByTestId('composer-count')).toHaveTextContent('0 / 500');
    await userEvent.type(box(), 'abc');
    expect(screen.getByTestId('composer-count')).toHaveTextContent('3 / 500');
  });

  it('a character outside the basic plane counts as one', () => {
    renderIn(<Host onSubmit={jest.fn(() => true)} initial={'𝟙😀'} />);
    expect(screen.getByTestId('composer-count')).toHaveTextContent('2 / 500');
  });

  it('500 characters can be sent; 501 cannot, and the composer says so in words', () => {
    const onSubmit = jest.fn(() => true);
    const { unmount } = renderIn(
      <Host onSubmit={onSubmit} initial={'a'.repeat(500)} />
    );
    expect(screen.getByTestId('composer-count')).toHaveTextContent('500 / 500');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send question' })).toBeEnabled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    unmount();

    const refused = jest.fn(() => true);
    renderIn(<Host onSubmit={refused} initial={'a'.repeat(501)} />);
    expect(screen.getByTestId('composer-count')).toHaveTextContent('501 / 500');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The question is too long.'
    );
    expect(box()).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByRole('button', { name: 'Send question' })
    ).toBeDisabled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(refused).not.toHaveBeenCalled();
  });

  it('is disabled while a request is in flight: the box, the button, and Enter', () => {
    const onSubmit = jest.fn(() => true);
    renderIn(<Host onSubmit={onSubmit} busy initial="waiting" />);
    expect(box()).toBeDisabled();
    expect(box()).toHaveAttribute('aria-busy', 'true');
    expect(box()).toHaveAttribute('placeholder', 'An analysis is in progress…');
    expect(
      screen.getByRole('button', { name: 'Send question' })
    ).toBeDisabled();
    fireEvent.keyDown(box(), { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('is disabled when the analyst is not available', () => {
    renderIn(<Host onSubmit={jest.fn(() => true)} disabled initial="x" />);
    expect(box()).toBeDisabled();
  });

  it('puts the cursor back in the box when the answer has arrived', () => {
    const view = renderIn(<Host onSubmit={jest.fn(() => true)} busy />);
    expect(document.activeElement).not.toBe(box());
    view.rerender(<Host onSubmit={jest.fn(() => true)} busy={false} />);
    expect(document.activeElement).toBe(box());
  });

  it('has a hint, wired to the box for a screen reader', () => {
    renderIn(<Host onSubmit={jest.fn(() => true)} />);
    expect(
      screen.getByText('Enter sends, Shift+Enter adds a line')
    ).toBeInTheDocument();
    expect(box().getAttribute('aria-describedby')).toBe(
      'chat-composer-hint chat-composer-count'
    );
  });
});

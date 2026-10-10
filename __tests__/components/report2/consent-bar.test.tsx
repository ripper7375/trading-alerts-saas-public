/**
 * "Accept setup", "Modify", "Decline" (build step 5, part 7): one press is one submit
 * with one submission id, and the server writes at most one record per id. The bar
 * keeps its half of that promise; these tests hold it to it.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ConsentBar,
  type ConsentOutcome,
} from '@/components/report2/consent-bar';
import { newSubmissionId } from '@/components/report2/submission';
import type { ConsentAction } from '@/lib/engine4/templates/wire';

import { renderIn } from './helpers/render';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/report2',
}));

const OK = (action: ConsentAction, duplicate = false): ConsentOutcome => ({
  ok: true,
  duplicate,
  action,
  recordedAt: '2026-09-18T20:57:30.000Z',
});

interface Call {
  action: ConsentAction;
  id: string;
}

function mount(
  onSubmit: (action: ConsentAction, id: string) => Promise<ConsentOutcome>,
  props: Partial<React.ComponentProps<typeof ConsentBar>> = {}
) {
  let n = 0;
  const calls: Call[] = [];
  const submit = jest.fn(async (action: ConsentAction, id: string) => {
    calls.push({ action, id });
    return onSubmit(action, id);
  });
  const view = renderIn(
    <ConsentBar
      setupSha256={'a'.repeat(64)}
      canAccept
      canRecord
      onSubmit={submit}
      makeId={() => `id-${String((n += 1)).padStart(4, '0')}-abcdefghij`}
      {...props}
    />
  );
  const again = (next: Partial<React.ComponentProps<typeof ConsentBar>>) =>
    view.rerender(
      <ConsentBar
        setupSha256={'a'.repeat(64)}
        canAccept
        canRecord
        onSubmit={submit}
        makeId={() => `id-${String((n += 1)).padStart(4, '0')}-abcdefghij`}
        {...props}
        {...next}
      />
    );
  return { calls, submit, again, user: userEvent.setup() };
}

const press = (name: string) => screen.getByRole('button', { name });

describe('what can be pressed', () => {
  test('nothing before a setup was sized', () => {
    mount(async () => OK('ACCEPT'), {
      setupSha256: null,
      canAccept: false,
      canRecord: false,
    });
    for (const name of ['Accept setup', 'Modify', 'Decline'])
      expect(press(name)).toBeDisabled();
    expect(
      screen.getByText('Waiting for the figures to settle.')
    ).toBeInTheDocument();
  });

  test('Modify and Decline without Accept when the setup failed a check, with the reason', () => {
    mount(async () => OK('ACCEPT'), { canAccept: false, canRecord: true });
    expect(press('Accept setup')).toBeDisabled();
    expect(press('Modify')).toBeEnabled();
    expect(press('Decline')).toBeEnabled();
    expect(
      screen.getByText('Fix the checks above to accept.')
    ).toBeInTheDocument();
  });

  test('all three when the setup on screen passed', () => {
    mount(async () => OK('ACCEPT'));
    for (const name of ['Accept setup', 'Modify', 'Decline'])
      expect(press(name)).toBeEnabled();
  });

  test('nothing once it is finished', () => {
    mount(async () => OK('ACCEPT'), { finished: true });
    for (const name of ['Accept setup', 'Modify', 'Decline'])
      expect(press(name)).toBeDisabled();
  });

  test('the three buttons are in a fixed order: the primary last in the markup order a reader meets', () => {
    mount(async () => OK('ACCEPT'));
    const order = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-action'));
    expect(order).toEqual(['DECLINE', 'MODIFY', 'ACCEPT']);
  });
});

describe('double-click protection', () => {
  test('two clicks in the same tick are one submit', async () => {
    const { calls } = mount(async (action) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return OK(action);
    });
    const accept = press('Accept setup');
    act(() => {
      fireEvent.click(accept);
      fireEvent.click(accept);
      fireEvent.click(accept);
    });
    await screen.findByText(/Setup accepted and recorded/);
    expect(calls).toHaveLength(1);
  });

  test('a second DIFFERENT button while one is in flight is also refused', async () => {
    const { calls } = mount(async (action) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return OK(action);
    });
    act(() => {
      fireEvent.click(press('Accept setup'));
      fireEvent.click(press('Decline'));
    });
    await screen.findByText(/Setup accepted and recorded/);
    expect(calls.map((c) => c.action)).toEqual(['ACCEPT']);
  });

  test('while one is in flight every button is off and the bar says it is recording', async () => {
    let release: (outcome: ConsentOutcome) => void = () => undefined;
    mount(
      () =>
        new Promise<ConsentOutcome>((resolve) => {
          release = resolve;
        })
    );
    await userEvent.setup().click(press('Accept setup'));
    expect(screen.getByText('Recording…')).toBeInTheDocument();
    for (const name of ['Accept setup', 'Modify', 'Decline'])
      expect(press(name)).toBeDisabled();
    expect(press('Accept setup')).toHaveAttribute('aria-busy', 'true');
    await act(async () => release(OK('ACCEPT')));
    await screen.findByText(/Setup accepted and recorded/);
  });

  test('after it settles the next press is allowed again', async () => {
    const { calls, user } = mount(async (action) => OK(action));
    await user.click(press('Modify'));
    await screen.findByText('Recorded. Change the fields, then review again.');
    await user.click(press('Modify'));
    await waitFor(() => expect(calls).toHaveLength(2));
  });
});

describe('the submission id', () => {
  test('is a valid id the server accepts', async () => {
    const { calls, user } = mount(async (action) => OK(action));
    await user.click(press('Accept setup'));
    await screen.findByText(/Setup accepted and recorded/);
    expect(calls[0]!.id).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  });

  test('the default generator makes a new valid id each time', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const id = newSubmissionId();
      expect(id).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(50);
  });

  test('a press that got no answer is repeated with the SAME id, so a record that was written is returned, not written twice', async () => {
    let call = 0;
    const { calls, user } = mount(async (action) => {
      call += 1;
      return call < 3
        ? { ok: false, code: 'NETWORK', retryable: true }
        : OK(action, true);
    });
    await user.click(press('Accept setup'));
    await screen.findByText('The connection failed. Nothing was recorded.');
    await user.click(press('Accept setup'));
    await waitFor(() => expect(calls).toHaveLength(2));
    await screen.findByText('The connection failed. Nothing was recorded.');
    await user.click(press('Accept setup'));
    await screen.findByText('This was already recorded.');
    expect(new Set(calls.map((c) => c.id)).size).toBe(1);
  });

  test('a thrown error is "no answer": the same id is kept', async () => {
    let call = 0;
    const { calls, user } = mount(async (action) => {
      call += 1;
      if (call === 1) throw new Error('boom');
      return OK(action);
    });
    await user.click(press('Accept setup'));
    await screen.findByText('The connection failed. Nothing was recorded.');
    await user.click(press('Accept setup'));
    await screen.findByText(/Setup accepted and recorded/);
    expect(calls[0]!.id).toBe(calls[1]!.id);
  });

  test('a definitive refusal, a success, or a different button gets a new id', async () => {
    let call = 0;
    const { calls, user } = mount(async (action) => {
      call += 1;
      return call === 1
        ? { ok: false, code: 'CONSENT_REFUSED', retryable: false }
        : OK(action);
    });
    await user.click(press('Accept setup'));
    await screen.findByText('Something went wrong. Nothing was recorded.');
    await user.click(press('Accept setup'));
    await screen.findByText(/Setup accepted and recorded/);
    expect(calls[1]!.id).not.toBe(calls[0]!.id);
  });

  test('another button gets its own id; and the first button, pressed again later, still gets the id whose outcome was never known', async () => {
    let call = 0;
    const { calls, user } = mount(async (action) => {
      call += 1;
      return call === 1
        ? { ok: false, code: 'NETWORK', retryable: true }
        : OK(action);
    });
    await user.click(press('Accept setup'));
    await screen.findByText('The connection failed. Nothing was recorded.');
    await user.click(press('Decline'));
    await screen.findByText('Declined and recorded.');
    await user.click(press('Accept setup'));
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls.map((c) => c.action)).toEqual(['ACCEPT', 'DECLINE', 'ACCEPT']);
    // the Decline is another submit; the second Accept is the SAME submit as the first
    expect(calls[1]!.id).not.toBe(calls[0]!.id);
    expect(calls[2]!.id).toBe(calls[0]!.id);
  });

  test('a retry is a NEW id when the setup on screen changed: the server refuses an id reused for another request', async () => {
    let call = 0;
    const { calls, user, again } = mount(async (action) => {
      call += 1;
      return call === 1
        ? { ok: false, code: 'NETWORK', retryable: true }
        : OK(action);
    });
    await user.click(press('Accept setup'));
    await screen.findByText('The connection failed. Nothing was recorded.');
    again({ setupSha256: 'b'.repeat(64) });
    await user.click(press('Accept setup'));
    await screen.findByText(/Setup accepted and recorded/);
    expect(calls[1]!.id).not.toBe(calls[0]!.id);
  });

  test('"in flight" at the server is retryable with the same id', async () => {
    let call = 0;
    const { calls, user } = mount(async (action) => {
      call += 1;
      return call === 1
        ? { ok: false, code: 'SUBMISSION_IN_FLIGHT', retryable: true }
        : OK(action, true);
    });
    await user.click(press('Accept setup'));
    await screen.findByText('This is already being recorded.');
    await user.click(press('Accept setup'));
    await screen.findByText('This was already recorded.');
    expect(calls[0]!.id).toBe(calls[1]!.id);
  });
});

describe('what it says afterwards', () => {
  test.each([
    [
      'ACCEPT',
      'Accept setup',
      'Setup accepted and recorded. You place the order with your broker.',
    ],
    ['MODIFY', 'Modify', 'Recorded. Change the fields, then review again.'],
    ['DECLINE', 'Decline', 'Declined and recorded.'],
  ] as const)('%s says "%s" in words', async (action, button, text) => {
    const { user } = mount(async (a) => OK(a));
    await user.click(press(button));
    await screen.findByText(text);
    expect(screen.getByText(/^Recorded at /)).toBeInTheDocument();
  });

  test('a duplicate says it was already recorded', async () => {
    const { user } = mount(async (a) => OK(a, true));
    await user.click(press('Accept setup'));
    await screen.findByText('This was already recorded.');
  });

  test('a refusal is an alert; one that can be repeated says to press again', async () => {
    const { user } = mount(async () => ({
      ok: false,
      code: 'TIER_REQUIRED',
      retryable: false,
    }));
    await user.click(press('Accept setup'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Report 2 is part of the Pro plan.');
    expect(alert).not.toHaveTextContent('Press the button again');
  });

  test('the outcome is announced politely, not as an interruption', async () => {
    const { user } = mount(async (a) => OK(a));
    await user.click(press('Accept setup'));
    await screen.findByText(/Setup accepted and recorded/);
    expect(screen.getByRole('status').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite'
    );
  });
});

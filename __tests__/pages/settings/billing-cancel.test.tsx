/**
 * Cancel subscription page -- Manage Subscription S2, workflow W3.
 *
 * Three steps (what happens, why, confirm); nothing is cancelled until the
 * third posts to POST /api/subscription/cancel, which cancels at the END of the
 * paid period. Who may cancel is the server's `allowedActions`, so a dLocal
 * plan (D8), a failed payment and an already scheduled cancellation get an
 * explanation instead of the steps.
 *
 * @module __tests__/pages/settings/billing-cancel.test
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CancelSubscriptionPage from '@/app/settings/billing/cancel/page';
import { UserViewAsProvider } from '@/components/admin/user-view-as/user-view-as-context';
import { LocaleProvider } from '@/lib/context/locale-context';
import ar from '@/lib/i18n/dictionaries/ar.json';
import de from '@/lib/i18n/dictionaries/de.json';
import ja from '@/lib/i18n/dictionaries/ja.json';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/settings/billing/cancel',
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a) }),
}));

const US_PREFERENCES = {
  countryCode: 'US',
  language: 'en-US',
  timezone: 'America/New_York',
  dateFormat: 'MDY',
  timeFormat: '12h',
  currency: 'USD',
};

function renderPage(viewAs: unknown = null): ReturnType<typeof render> {
  return render(
    <LocaleProvider>
      <UserViewAsProvider value={viewAs as never}>
        <CancelSubscriptionPage />
      </UserViewAsProvider>
    </LocaleProvider>
  );
}

const PERIOD_END = '2026-11-21T12:00:00.000Z';

const active = {
  tier: 'PRO',
  status: 'ACTIVE',
  allowedActions: ['update_card', 'cancel'],
  displayState: 'ACTIVE',
  subscription: {
    provider: 'STRIPE',
    currentPeriodEnd: PERIOD_END,
    expiresAt: null,
    trialEnd: null,
  },
  trial: { status: 'CONVERTED' },
};

const trialing = {
  ...active,
  displayState: 'TRIALING',
  subscription: { ...active.subscription, trialEnd: PERIOD_END },
  trial: { status: 'ACTIVE' },
};

interface FetchOptions {
  subscription?: unknown;
  subscriptionOk?: boolean;
  cancelOk?: boolean;
  cancelBody?: unknown;
  /** What the next read of the subscription returns after a refused cancel. */
  afterRefusal?: unknown;
}

function mockFetch(options: FetchOptions = {}): jest.Mock {
  const {
    subscription = active,
    subscriptionOk = true,
    cancelOk = true,
    cancelBody,
    afterRefusal,
  } = options;
  let refused = false;
  return jest.fn((url: string, init?: RequestInit) => {
    if (url === '/api/subscription') {
      return Promise.resolve({
        ok: subscriptionOk,
        json: async () =>
          subscriptionOk
            ? refused && afterRefusal !== undefined
              ? afterRefusal
              : subscription
            : { error: 'Failed to fetch subscription' },
      });
    }
    if (url === '/api/subscription/cancel' && init?.method === 'POST') {
      if (!cancelOk) refused = true;
      return Promise.resolve({
        ok: cancelOk,
        json: async () =>
          cancelBody ??
          (cancelOk
            ? { success: true, cancelAtPeriodEnd: true, cancelAt: PERIOD_END }
            : { error: 'Cancellation failed', code: 'CANCEL_ERROR' }),
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function cancelBodyOf(fetchMock: jest.Mock): unknown {
  const call = fetchMock.mock.calls.find(
    (c) => c[0] === '/api/subscription/cancel'
  );
  return call ? JSON.parse((call[1] as RequestInit).body as string) : undefined;
}

async function toStep(user: ReturnType<typeof userEvent.setup>, step: number) {
  for (let i = 1; i < step; i++) {
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(US_PREFERENCES));
});

describe('CancelSubscriptionPage', () => {
  describe('step 1: what happens', () => {
    it('says PRO continues until the end of the paid period, and what pauses after it', async () => {
      global.fetch = mockFetch() as unknown as typeof fetch;

      renderPage();

      expect(
        await screen.findByRole('heading', {
          name: 'What happens when you cancel',
        })
      ).toBeInTheDocument();
      expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
      expect(
        screen.getByText(/You keep PRO until .*2026\./)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/you can resume at any time before/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/After .*2026, these PRO features pause:/)
      ).toBeInTheDocument();
      for (const feature of [
        'Price Alerts',
        'Drawing Engine Line Alerts',
        'Multi-Timeframe Visualization',
      ]) {
        expect(screen.getByText(feature)).toBeInTheDocument();
      }
      expect(
        screen.getByText(/Your account then moves to the FREE plan/)
      ).toBeInTheDocument();
    });

    it('offers to keep the subscription (back to billing) and to continue, and cancels nothing yet', async () => {
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      renderPage();

      expect(
        await screen.findByRole('link', { name: 'Keep Subscription' })
      ).toHaveAttribute('href', '/settings/billing');
      expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
      expect(cancelBodyOf(fetchMock)).toBeUndefined();
    });

    it('says a trial ends on that date with no charge', async () => {
      global.fetch = mockFetch({
        subscription: trialing,
      }) as unknown as typeof fetch;

      renderPage();

      expect(
        await screen.findByText(
          /Your free trial ends on .*2026\. You will not be charged\./
        )
      ).toBeInTheDocument();
      expect(screen.queryByText(/You keep PRO until/)).not.toBeInTheDocument();
    });
  });

  describe('step 2: why', () => {
    it('lists the reasons, with "I would rather not say" selected, and moves back and forth', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch() as unknown as typeof fetch;

      renderPage();
      await toStep(user, 2);

      expect(
        screen.getByRole('heading', { name: 'Why are you cancelling?' })
      ).toBeInTheDocument();
      expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: 'I would rather not say' })
      ).toBeChecked();
      for (const label of [
        'Too expensive',
        'Not using enough',
        'Missing features',
        'Switching to competitor',
        'Other',
      ]) {
        expect(screen.getByRole('radio', { name: label })).not.toBeChecked();
      }

      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(
        screen.getByRole('heading', { name: 'What happens when you cancel' })
      ).toBeInTheDocument();
    });

    it('moves focus to the new step’s heading', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch() as unknown as typeof fetch;

      renderPage();
      await toStep(user, 2);

      expect(
        screen.getByRole('heading', { name: 'Why are you cancelling?' })
      ).toHaveFocus();
    });

    it('asks for details only for "Other", capped so the whole reason fits the server limit', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch() as unknown as typeof fetch;

      renderPage();
      await toStep(user, 2);

      expect(
        screen.queryByLabelText('Tell us more (optional)')
      ).not.toBeInTheDocument();
      await user.click(screen.getByRole('radio', { name: 'Other' }));
      const box = screen.getByLabelText('Tell us more (optional)');
      // "other: " + 493 characters = 500, the server's limit.
      expect(box).toHaveAttribute('maxlength', '493');
      await user.click(screen.getByRole('radio', { name: 'Too expensive' }));
      expect(
        screen.queryByLabelText('Tell us more (optional)')
      ).not.toBeInTheDocument();
    });
  });

  describe('step 3: confirm', () => {
    it('shows when PRO ends and the chosen reason, and confirming schedules the cancellation (B6: the reason is sent)', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      renderPage();
      await toStep(user, 2);
      await user.click(screen.getByRole('radio', { name: 'Too expensive' }));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(
        screen.getByRole('heading', { name: 'Confirm your cancellation' })
      ).toBeInTheDocument();
      expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Your PRO subscription will end on .*2026\. Until then, nothing changes\./
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Your reason: Too expensive/)
      ).toBeInTheDocument();

      await user.click(
        screen.getByRole('button', { name: 'Confirm Cancellation' })
      );

      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith('/settings/billing?done=cancel')
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/subscription/cancel',
        expect.objectContaining({ method: 'POST' })
      );
      expect(cancelBodyOf(fetchMock)).toEqual({ reason: 'too_expensive' });
    });

    it('sends no reason when none was chosen, and shows none', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      renderPage();
      await toStep(user, 3);

      expect(screen.queryByText(/Your reason:/)).not.toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: 'Confirm Cancellation' })
      );

      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      expect(cancelBodyOf(fetchMock)).toEqual({});
    });

    it('sends "other: ..." with the user’s own words', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      renderPage();
      await toStep(user, 2);
      await user.click(screen.getByRole('radio', { name: 'Other' }));
      await user.type(
        screen.getByLabelText('Tell us more (optional)'),
        '  found a cheaper tool  '
      );
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(
        screen.getByText(/Your reason: Other — found a cheaper tool/)
      ).toBeInTheDocument();
      await user.click(
        screen.getByRole('button', { name: 'Confirm Cancellation' })
      );

      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      expect(cancelBodyOf(fetchMock)).toEqual({
        reason: 'other: found a cheaper tool',
      });
    });

    it('sends plain "other" when the details are blank', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;

      renderPage();
      await toStep(user, 2);
      await user.click(screen.getByRole('radio', { name: 'Other' }));
      await user.type(screen.getByLabelText('Tell us more (optional)'), '   ');
      await user.click(screen.getByRole('button', { name: 'Continue' }));
      await user.click(
        screen.getByRole('button', { name: 'Confirm Cancellation' })
      );

      await waitFor(() => expect(mockPush).toHaveBeenCalled());
      expect(cancelBodyOf(fetchMock)).toEqual({ reason: 'other' });
    });

    it('keeps the user on the page, with an error and a usable button, when the server refuses', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({ cancelOk: false }) as unknown as typeof fetch;

      renderPage();
      await toStep(user, 3);
      await user.click(
        screen.getByRole('button', { name: 'Confirm Cancellation' })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not schedule your cancellation. Please try again.'
      );
      expect(mockPush).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Confirm Cancellation' })
      ).toBeEnabled();
      expect(
        screen.getByRole('heading', { name: 'Confirm your cancellation' })
      ).toBeInTheDocument();
    });

    it('disables the buttons and says so while the request is running', async () => {
      const user = userEvent.setup();
      let release: (value: unknown) => void = () => undefined;
      const fetchMock = jest.fn((url: string, init?: RequestInit) => {
        if (url === '/api/subscription') {
          return Promise.resolve({ ok: true, json: async () => active });
        }
        if (init?.method === 'POST') {
          return new Promise((resolve) => {
            release = resolve;
          });
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      renderPage();
      await toStep(user, 3);
      await user.click(
        screen.getByRole('button', { name: 'Confirm Cancellation' })
      );

      expect(
        await screen.findByRole('button', { name: 'Cancelling...' })
      ).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
      // A second click cannot send a second request.
      await user.click(screen.getByRole('button', { name: 'Cancelling...' }));
      expect(
        fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST')
      ).toHaveLength(1);

      release({ ok: true, json: async () => ({ success: true }) });
      await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1));
    });

    it.each([
      'ALREADY_SCHEDULED',
      'ACTION_NOT_ALLOWED',
      'NO_SUBSCRIPTION',
      'DLOCAL_NO_CANCEL',
    ])(
      'looks again instead of showing an error when the server answers %s (the situation changed)',
      async (code) => {
        const user = userEvent.setup();
        global.fetch = mockFetch({
          cancelOk: false,
          cancelBody: { error: 'x', code },
          afterRefusal: {
            ...active,
            allowedActions: ['resume', 'update_card'],
            displayState: 'CANCEL_SCHEDULED',
          },
        }) as unknown as typeof fetch;

        renderPage();
        await toStep(user, 3);
        await user.click(
          screen.getByRole('button', { name: 'Confirm Cancellation' })
        );

        expect(
          await screen.findByText(
            /Your cancellation is already scheduled\. PRO ends on/
          )
        ).toBeInTheDocument();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(mockPush).not.toHaveBeenCalled();
      }
    );
  });

  describe('when cancelling is not available', () => {
    const cases: Array<[string, unknown, RegExp]> = [
      [
        'a cancellation is already scheduled',
        {
          ...active,
          allowedActions: ['resume', 'update_card'],
          displayState: 'CANCEL_SCHEDULED',
        },
        /Your cancellation is already scheduled\. PRO ends on .*2026\./,
      ],
      [
        'a payment is overdue',
        {
          ...active,
          allowedActions: ['pay_now', 'update_card'],
          displayState: 'PAST_DUE',
        },
        /Pay the open invoice or update your card on the billing page, then you can cancel\./,
      ],
      [
        'the plan is dLocal (D8)',
        {
          ...active,
          allowedActions: [],
          subscription: {
            provider: 'DLOCAL',
            currentPeriodEnd: null,
            expiresAt: '2026-12-05T12:00:00.000Z',
            trialEnd: null,
          },
        },
        /Your plan is prepaid and ends on .*2026\. It does not renew automatically, so there is nothing to cancel\./,
      ],
      [
        'the user has no PRO subscription',
        {
          tier: 'FREE',
          allowedActions: [],
          displayState: 'FREE',
          subscription: null,
          trial: { status: 'NOT_STARTED' },
        },
        /You do not have a PRO subscription to cancel\./,
      ],
    ];

    it.each(cases)(
      'explains it instead of the steps when %s',
      async (_name, subscription, message) => {
        const fetchMock = mockFetch({ subscription });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderPage();

        expect(
          await screen.findByRole('heading', {
            name: 'Cancellation is not available right now',
          })
        ).toBeInTheDocument();
        expect(screen.getByText(message)).toBeInTheDocument();
        expect(
          screen.getByRole('link', { name: 'Back to billing' })
        ).toHaveAttribute('href', '/settings/billing');
        expect(
          screen.queryByRole('button', { name: 'Continue' })
        ).not.toBeInTheDocument();
        expect(cancelBodyOf(fetchMock)).toBeUndefined();
      }
    );

    it('shows a short error and the way back when the subscription cannot be read', async () => {
      global.fetch = mockFetch({
        subscriptionOk: false,
      }) as unknown as typeof fetch;

      renderPage();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Back to billing' })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Continue' })
      ).not.toBeInTheDocument();
    });

    it('offers nothing in admin view: it would act on the admin’s own account', async () => {
      global.fetch = mockFetch() as unknown as typeof fetch;

      renderPage({
        id: 'user_42',
        name: 'Carol Customer',
        email: 'carol@example.com',
        tier: 'PRO',
        role: 'USER',
      });

      expect(
        await screen.findByText(/Plan actions are hidden in admin view/)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Continue' })
      ).not.toBeInTheDocument();
    });
  });

  // The new keys exist in every dictionary (compulsory-translation-coverage);
  // this holds that the page asks for the right ones, in a script that is not
  // English and in the one that reads right to left.
  it.each([
    ['ar', ar],
    ['de', de],
    ['ja', ja],
  ] as const)(
    'renders the three steps in %s, from the dictionary',
    async (language, dictionary) => {
      const words = dictionary as Record<string, string>;
      const user = userEvent.setup();
      localStorage.setItem(
        LOCALE_STORAGE_KEY,
        JSON.stringify({ ...US_PREFERENCES, language })
      );
      global.fetch = mockFetch() as unknown as typeof fetch;

      renderPage();

      expect(
        await screen.findByRole('heading', {
          name: words['billing.cancel_flow.step1_title']!,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByText(words['billing.price_alerts']!)
      ).toBeInTheDocument();
      await user.click(
        screen.getByRole('button', {
          name: words['billing.cancel_flow.continue']!,
        })
      );
      expect(
        screen.getByRole('heading', {
          name: words['billing.cancel_flow.step2_title']!,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radio', {
          name: words['billing.cancel_flow.reason_none']!,
        })
      ).toBeChecked();
      await user.click(
        screen.getByRole('button', {
          name: words['billing.cancel_flow.continue']!,
        })
      );
      const step3 = screen.getByRole('heading', {
        name: words['billing.cancel_flow.step3_title']!,
      });
      expect(step3).toBeInTheDocument();
      expect(
        within(document.body).getByRole('button', {
          name: words['billing.confirm_cancellation']!,
        })
      ).toBeInTheDocument();
    }
  );
});

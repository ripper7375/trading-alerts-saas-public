/**
 * Change billing period -- Manage Subscription S3, workflows W5a and W5b.
 *
 * Two surfaces:
 * - /settings/billing: the "Change billing period" link, the banner for a
 *   switch to monthly that waits for the renewal date with its "Keep yearly"
 *   dialog, the status badge, and the notices when the user comes back;
 * - /settings/billing/change-plan: both plans with the SystemConfig prices, the
 *   quote and its confirmation for the upgrade (decisions D2, E2, E3), and the
 *   scheduled switch to monthly with no refund.
 * Who may do what is the server's `allowedActions`; nothing is charged until a
 * confirm button is pressed.
 *
 * @module __tests__/pages/settings/billing-change-plan.test
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BillingSettingsPage from '@/app/settings/billing/page';
import ChangePlanPage from '@/app/settings/billing/change-plan/page';
import { UserViewAsProvider } from '@/components/admin/user-view-as/user-view-as-context';
import { LocaleProvider } from '@/lib/context/locale-context';
import ar from '@/lib/i18n/dictionaries/ar.json';
import de from '@/lib/i18n/dictionaries/de.json';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/settings/billing',
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a) }),
}));

jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    config: { regularPrice: 29, annualPrice: 290 },
    regularPrice: 29,
    annualPrice: 290,
    annualSavingsPercent: 16,
    isLoading: false,
    error: undefined,
  }),
}));

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const US_PREFERENCES = {
  countryCode: 'US',
  language: 'en-US',
  timezone: 'America/New_York',
  dateFormat: 'MDY',
  timeFormat: '12h',
  currency: 'USD',
};

const RENEWAL = '2026-11-21T12:00:00.000Z';
const NEXT_YEAR = '2027-11-21T12:00:00.000Z';

const trial = {
  status: 'CONVERTED',
  convertedAt: '2026-07-01T00:00:00.000Z',
  cancelledAt: null,
  hasUsedFreeTrial: true,
};

function subscriptionBody(
  overrides: {
    allowedActions?: string[];
    displayState?: string;
    planType?: string;
    provider?: string | null;
    pendingPlanChange?: unknown;
    trialStatus?: string;
    trialEnd?: string | null;
  } = {}
): Record<string, unknown> {
  const {
    allowedActions = ['update_card', 'upgrade_to_yearly', 'cancel'],
    displayState = 'ACTIVE',
    planType = 'MONTHLY',
    provider = 'STRIPE',
    pendingPlanChange = null,
    trialStatus,
    trialEnd = null,
  } = overrides;
  return {
    tier: 'PRO',
    status: 'active',
    allowedActions,
    displayState,
    subscription: {
      id: 'sub_1',
      status: 'active',
      provider,
      planType,
      amountUsd: planType === 'YEARLY' ? 290 : 29,
      currentPeriodEnd: RENEWAL,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      trialEnd,
      paymentMethod: {
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
      },
      dLocalPaymentMethod: null,
      dLocalCountry: null,
      openInvoiceUrl: null,
      pendingPlanChange,
    },
    trial: trialStatus ? { ...trial, status: trialStatus } : trial,
  };
}

const monthlySub = subscriptionBody();
const yearlySub = subscriptionBody({
  planType: 'YEARLY',
  allowedActions: ['update_card', 'switch_to_monthly', 'cancel'],
});
const pendingSub = subscriptionBody({
  planType: 'YEARLY',
  displayState: 'DOWNGRADE_PENDING',
  allowedActions: ['keep_yearly', 'update_card', 'cancel'],
  pendingPlanChange: { planType: 'MONTHLY', effectiveAt: RENEWAL },
});

const quoteBody = {
  amountDueNowUsd: 270.35,
  prorationDate: 1_793_412_900,
  renewsOn: NEXT_YEAR,
  yearlyPriceUsd: 290,
  creditUsd: 19.65,
  taxUsd: 0,
  inTrial: false,
};

interface FetchOptions {
  /** Each read of the subscription returns the next one; the last repeats. */
  subscription?: unknown[];
  subscriptionOk?: boolean;
  quote?: unknown[];
  quoteOk?: boolean[];
  quoteError?: unknown;
  post?: { ok: boolean; body: unknown };
  del?: { ok: boolean; body: unknown };
}

function mockFetch(options: FetchOptions = {}): jest.Mock {
  const subscriptions = options.subscription ?? [monthlySub];
  const quotes = options.quote ?? [quoteBody];
  let subReads = 0;
  let quoteReads = 0;
  return jest.fn((url: string, init?: RequestInit) => {
    // Admin view-as adds ?view_as=user to the reads.
    const path = url.split('?')[0];
    if (path === '/api/subscription') {
      const body = subscriptions[Math.min(subReads, subscriptions.length - 1)];
      subReads += 1;
      const ok = options.subscriptionOk ?? true;
      return Promise.resolve({
        ok,
        json: async () =>
          ok ? body : { error: 'Failed to fetch subscription' },
      });
    }
    if (path === '/api/invoices') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ invoices: [], hasMore: false }),
      });
    }
    if (path === '/api/alerts') {
      return Promise.resolve({ ok: true, json: async () => ({ alerts: [] }) });
    }
    if (url.startsWith('/api/subscription/change-plan/preview')) {
      const index = Math.min(quoteReads, quotes.length - 1);
      const body = quotes[index];
      const ok =
        options.quoteOk?.[Math.min(quoteReads, options.quoteOk.length - 1)] ??
        true;
      quoteReads += 1;
      return Promise.resolve({
        ok,
        json: async () =>
          ok ? body : (options.quoteError ?? { code: 'PREVIEW_ERROR' }),
      });
    }
    if (url === '/api/subscription/change-plan' && init?.method === 'POST') {
      const response = options.post ?? { ok: true, body: { success: true } };
      return Promise.resolve({
        ok: response.ok,
        json: async () => response.body,
      });
    }
    if (url === '/api/subscription/change-plan' && init?.method === 'DELETE') {
      const response = options.del ?? { ok: true, body: { success: true } };
      return Promise.resolve({
        ok: response.ok,
        json: async () => response.body,
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function bodyOf(fetchMock: jest.Mock, method: string): any {
  const call = fetchMock.mock.calls.find(
    (c) => c[0] === '/api/subscription/change-plan' && c[1]?.method === method
  );
  return call?.[1]?.body ? JSON.parse(call[1].body as string) : undefined;
}

const sent = (fetchMock: jest.Mock, method: string): boolean =>
  fetchMock.mock.calls.some(
    (c) => c[0] === '/api/subscription/change-plan' && c[1]?.method === method
  );

const adminView = {
  id: 'user_42',
  name: 'Carol Customer',
  email: 'carol@example.com',
  tier: 'PRO',
  role: 'USER',
};

function renderBilling(viewAs: unknown = null): ReturnType<typeof render> {
  return render(
    <LocaleProvider>
      <UserViewAsProvider value={viewAs as never}>
        <BillingSettingsPage />
      </UserViewAsProvider>
    </LocaleProvider>
  );
}

function renderChangePlan(viewAs: unknown = null): ReturnType<typeof render> {
  return render(
    <LocaleProvider>
      <UserViewAsProvider value={viewAs as never}>
        <ChangePlanPage />
      </UserViewAsProvider>
    </LocaleProvider>
  );
}

const originalLocation = window.location;

function setSearch(search: string): void {
  delete (window as unknown as { location?: Location }).location;
  (window as unknown as { location: unknown }).location = {
    ...originalLocation,
    pathname: '/settings/billing',
    search,
    assign: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(US_PREFERENCES));
  setSearch('');
  mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
});

afterEach(() => {
  (window as unknown as { location: unknown }).location = originalLocation;
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('/settings/billing: billing-period actions (S3)', () => {
  it('a monthly plan gets a "Change billing period" link to the change-plan page', async () => {
    global.fetch = mockFetch() as unknown as typeof fetch;
    renderBilling();

    expect(
      await screen.findByRole('link', { name: 'Change billing period' })
    ).toHaveAttribute('href', '/settings/billing/change-plan');
    // Cancel stays where it was.
    expect(
      screen.getByRole('link', { name: 'Cancel Plan' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/switches to monthly billing/)).toBeNull();
  });

  it('a yearly plan gets the same link', async () => {
    global.fetch = mockFetch({
      subscription: [yearlySub],
    }) as unknown as typeof fetch;
    renderBilling();
    expect(
      await screen.findByRole('link', { name: 'Change billing period' })
    ).toBeInTheDocument();
    expect(screen.getByText('/year', { exact: false })).toBeInTheDocument();
  });

  it.each([
    [
      'a failed payment',
      subscriptionBody({
        displayState: 'PAST_DUE',
        allowedActions: ['update_card'],
      }),
    ],
    [
      'a scheduled cancellation',
      subscriptionBody({
        displayState: 'CANCEL_SCHEDULED',
        allowedActions: ['resume', 'update_card'],
      }),
    ],
    [
      'a dLocal plan',
      subscriptionBody({ provider: 'DLOCAL', allowedActions: [] }),
    ],
  ])('offers no link during %s', async (_label, subscription) => {
    global.fetch = mockFetch({
      subscription: [subscription],
    }) as unknown as typeof fetch;
    renderBilling();
    await screen.findByText('PRO TIER');
    expect(
      screen.queryByRole('link', { name: 'Change billing period' })
    ).toBeNull();
  });

  it('offers nothing in admin view, whatever the server sent', async () => {
    global.fetch = mockFetch({
      subscription: [pendingSub],
    }) as unknown as typeof fetch;
    renderBilling(adminView);
    await screen.findByText('PRO TIER');
    expect(
      screen.queryByRole('link', { name: 'Change billing period' })
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep yearly' })).toBeNull();
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('/settings/billing: a switch to monthly waits for the renewal (W5b)', () => {
  it('says when it happens, that the yearly access carries on, and offers Keep yearly', async () => {
    global.fetch = mockFetch({
      subscription: [pendingSub],
    }) as unknown as typeof fetch;
    renderBilling();

    const title = await screen.findByText(
      /Your plan switches to monthly billing on/
    );
    expect(title).toHaveTextContent('2026');
    const banner = title.closest('[role="status"]') as HTMLElement;
    expect(banner).toHaveTextContent(
      /You keep your yearly PRO access until then/
    );
    expect(banner).toHaveTextContent(/Nothing is charged or refunded now/);
    expect(
      within(banner).getByRole('button', { name: 'Keep yearly' })
    ).toBeInTheDocument();

    expect(screen.getByText('PRO TIER')).toBeInTheDocument();
    expect(screen.getByText('Switching to monthly')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('offers Keep yearly in the plan card too, and no second switch; Cancel is still there', async () => {
    global.fetch = mockFetch({
      subscription: [pendingSub],
    }) as unknown as typeof fetch;
    renderBilling();
    await screen.findByText('Switching to monthly');

    expect(screen.getAllByRole('button', { name: 'Keep yearly' })).toHaveLength(
      2
    );
    expect(
      screen.queryByRole('link', { name: 'Change billing period' })
    ).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Cancel Plan' })
    ).toBeInTheDocument();
  });

  it('asks first, and says what keeping yearly does; nothing is sent until the user says yes', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ subscription: [pendingSub] });
    global.fetch = fetchMock as unknown as typeof fetch;
    renderBilling();

    const banner = (
      await screen.findByText(/Your plan switches to monthly billing on/)
    ).closest('[role="status"]') as HTMLElement;
    await user.click(
      within(banner).getByRole('button', { name: 'Keep yearly' })
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Keep yearly billing?');
    expect(dialog).toHaveTextContent(
      /switch to monthly billing will be withdrawn/
    );
    expect(dialog).toHaveTextContent('2026');
    expect(sent(fetchMock, 'DELETE')).toBe(false);
  });

  it('withdraws the switch, re-reads the subscription and shows the ordinary yearly view with a notice', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ subscription: [pendingSub, yearlySub] });
    global.fetch = fetchMock as unknown as typeof fetch;
    renderBilling();

    const banner = (
      await screen.findByText(/Your plan switches to monthly billing on/)
    ).closest('[role="status"]') as HTMLElement;
    await user.click(
      within(banner).getByRole('button', { name: 'Keep yearly' })
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Yes, keep yearly',
      })
    );

    await waitFor(() => expect(sent(fetchMock, 'DELETE')).toBe(true));
    expect(
      await screen.findByText(
        'Your plan stays yearly. The scheduled switch was withdrawn.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Your plan switches to monthly billing on/)
    ).toBeNull();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Change billing period' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the switch and says so when the server refuses; the dialog stays open to try again', async () => {
    const user = userEvent.setup();
    global.fetch = mockFetch({
      subscription: [pendingSub],
      del: { ok: false, body: { code: 'KEEP_YEARLY_ERROR' } },
    }) as unknown as typeof fetch;
    renderBilling();

    const banner = (
      await screen.findByText(/Your plan switches to monthly billing on/)
    ).closest('[role="status"]') as HTMLElement;
    await user.click(
      within(banner).getByRole('button', { name: 'Keep yearly' })
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Yes, keep yearly',
      })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not keep your yearly plan. Please try again.'
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Yes, keep yearly' })
    ).toBeEnabled();
  });

  it('treats "nothing to undo" as done: the switch had already gone, and the fresh read shows it', async () => {
    const user = userEvent.setup();
    global.fetch = mockFetch({
      subscription: [pendingSub, yearlySub],
      del: { ok: false, body: { code: 'NOT_PENDING' } },
    }) as unknown as typeof fetch;
    renderBilling();

    const banner = (
      await screen.findByText(/Your plan switches to monthly billing on/)
    ).closest('[role="status"]') as HTMLElement;
    await user.click(
      within(banner).getByRole('button', { name: 'Keep yearly' })
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Yes, keep yearly',
      })
    );

    expect(
      await screen.findByText(
        'Your plan stays yearly. The scheduled switch was withdrawn.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes without sending anything on "Not now"', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch({ subscription: [pendingSub] });
    global.fetch = fetchMock as unknown as typeof fetch;
    renderBilling();

    const banner = (
      await screen.findByText(/Your plan switches to monthly billing on/)
    ).closest('[role="status"]') as HTMLElement;
    await user.click(
      within(banner).getByRole('button', { name: 'Keep yearly' })
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Not now',
      })
    );

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(sent(fetchMock, 'DELETE')).toBe(false);
  });

  it('is written in the reader’s language: German banner from the real dictionary', async () => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify({ ...US_PREFERENCES, language: 'de', countryCode: 'DE' })
    );
    global.fetch = mockFetch({
      subscription: [pendingSub],
    }) as unknown as typeof fetch;
    renderBilling();

    const expected = (de as Record<string, string>)[
      'billing.banner.switch_pending_title'
    ];
    expect(
      await screen.findByText(expected.split('{date}')[0]!.trim(), {
        exact: false,
      })
    ).toBeInTheDocument();
    // In the banner and in the plan card.
    expect(
      screen.getAllByRole('button', {
        name: (de as Record<string, string>)['billing.action.keep_yearly'],
      })
    ).toHaveLength(2);
  });

  it('is written in Arabic from the real dictionary too', async () => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify({ ...US_PREFERENCES, language: 'ar', countryCode: 'SA' })
    );
    global.fetch = mockFetch({
      subscription: [pendingSub],
    }) as unknown as typeof fetch;
    renderBilling();

    expect(
      await screen.findAllByRole('button', {
        name: (ar as Record<string, string>)['billing.action.keep_yearly'],
      })
    ).toHaveLength(2);
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('/settings/billing: coming back from the change-plan page', () => {
  it('?done=upgraded says the plan is yearly now, and drops the marker from the address', async () => {
    const replaceState = jest.spyOn(window.history, 'replaceState');
    setSearch('?done=upgraded');
    global.fetch = mockFetch({
      subscription: [yearlySub],
    }) as unknown as typeof fetch;
    renderBilling();

    expect(
      await screen.findByText('You are now on the yearly plan. Thank you!')
    ).toBeInTheDocument();
    expect(replaceState).toHaveBeenCalledWith(null, '', '/settings/billing');
    replaceState.mockRestore();
  });

  it('?done=upgraded claims nothing when the fresh data is still monthly', async () => {
    setSearch('?done=upgraded');
    global.fetch = mockFetch({
      subscription: [monthlySub],
    }) as unknown as typeof fetch;
    renderBilling();
    await screen.findByText('PRO TIER');
    expect(screen.queryByText(/You are now on the yearly plan/)).toBeNull();
  });

  it('?done=switch says when the plan switches to monthly', async () => {
    setSearch('?done=switch');
    global.fetch = mockFetch({
      subscription: [pendingSub],
    }) as unknown as typeof fetch;
    renderBilling();

    const notice = await screen.findByText(
      /Your plan will switch to monthly billing on .*2026\. You keep yearly PRO access until then\./
    );
    expect(notice).toBeInTheDocument();
  });

  it('?done=switch claims nothing when no switch is pending', async () => {
    setSearch('?done=switch');
    global.fetch = mockFetch({
      subscription: [yearlySub],
    }) as unknown as typeof fetch;
    renderBilling();
    await screen.findByText('PRO TIER');
    expect(
      screen.queryByText(/Your plan will switch to monthly billing on/)
    ).toBeNull();
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('/settings/billing/change-plan', () => {
  describe('the two plans (D3: SystemConfig prices, never typed in)', () => {
    it('shows the monthly and yearly prices, marks the current plan, and shows the annual saving', async () => {
      global.fetch = mockFetch() as unknown as typeof fetch;
      renderChangePlan();

      expect(
        await screen.findByRole('heading', { name: 'Change billing period' })
      ).toBeInTheDocument();
      const monthly = screen.getByTestId('plan-card-monthly');
      const yearly = screen.getByTestId('plan-card-yearly');
      expect(monthly).toHaveTextContent('$29.00');
      expect(monthly).toHaveTextContent('/month');
      expect(monthly).toHaveTextContent('Current plan');
      expect(yearly).toHaveTextContent('$290.00');
      expect(yearly).toHaveTextContent('/year');
      expect(yearly).not.toHaveTextContent('Current plan');
      // 12 x 29 - 290 = 58
      expect(yearly).toHaveTextContent(
        'Save $58.00 a year compared with paying monthly'
      );
    });

    it('a monthly plan offers the upgrade only', async () => {
      global.fetch = mockFetch() as unknown as typeof fetch;
      renderChangePlan();
      expect(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      ).toBeEnabled();
      expect(
        screen.queryByRole('button', { name: 'Switch to monthly' })
      ).toBeNull();
    });

    it('a yearly plan offers the switch to monthly only, and marks yearly as current', async () => {
      global.fetch = mockFetch({
        subscription: [yearlySub],
      }) as unknown as typeof fetch;
      renderChangePlan();
      expect(
        await screen.findByRole('button', { name: 'Switch to monthly' })
      ).toBeEnabled();
      expect(
        screen.queryByRole('button', { name: 'Upgrade to yearly' })
      ).toBeNull();
      expect(screen.getByTestId('plan-card-yearly')).toHaveTextContent(
        'Current plan'
      );
    });

    it('nothing is requested from the preview or the change endpoints just by opening the page', async () => {
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;
      renderChangePlan();
      await screen.findByRole('button', { name: 'Upgrade to yearly' });
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes('change-plan'))
      ).toBe(false);
    });

    it('links back to billing', async () => {
      global.fetch = mockFetch() as unknown as typeof fetch;
      renderChangePlan();
      expect(
        await screen.findByRole('link', { name: 'Back to billing' })
      ).toHaveAttribute('href', '/settings/billing');
    });
  });

  describe('upgrade to yearly, now (W5a)', () => {
    it('asks the server for a quote and shows the calculation: price, credit, and what is charged today', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );

      const panel = await screen.findByTestId('upgrade-panel');
      await within(panel).findByText('Yearly plan');
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/subscription/change-plan/preview?billingPeriod=yearly'
      );
      expect(panel).toHaveTextContent('Upgrade to yearly billing');
      expect(panel).toHaveTextContent('$290.00');
      expect(panel).toHaveTextContent(
        'Credit for the unused part of your monthly plan'
      );
      expect(panel).toHaveTextContent('−$19.65');
      expect(within(panel).getByTestId('amount-due')).toHaveTextContent(
        '$270.35'
      );
      expect(panel).toHaveTextContent(
        /Your plan then renews yearly on .*2027\./
      );
      expect(panel).toHaveTextContent(
        /the switch is not made and you are not charged/
      );
      expect(panel).toHaveTextContent(/You are charged in US dollars/);
      expect(within(panel).queryByText('Tax')).toBeNull();
      expect(
        within(panel).getByRole('button', { name: 'Confirm and pay $270.35' })
      ).toBeEnabled();
      // Quoting charges nothing.
      expect(sent(fetchMock, 'POST')).toBe(false);
    });

    it('shows the tax line when the quote has tax', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({
        quote: [{ ...quoteBody, taxUsd: 54.07, amountDueNowUsd: 324.42 }],
      }) as unknown as typeof fetch;
      renderChangePlan();
      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );

      const panel = await screen.findByTestId('upgrade-panel');
      await within(panel).findByText('Tax');
      expect(panel).toHaveTextContent('$54.07');
      expect(within(panel).getByTestId('amount-due')).toHaveTextContent(
        '$324.42'
      );
    });

    it('confirms with the quote’s time and the yearly price on screen, then goes back to billing', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm and pay $270.35' })
      );

      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith('/settings/billing?done=upgraded')
      );
      expect(bodyOf(fetchMock, 'POST')).toEqual({
        billingPeriod: 'yearly',
        prorationDate: 1_793_412_900,
        expectedYearlyPriceUsd: 290,
      });
    });

    it('during the free trial says nothing is charged today and when the first charge is (E3)', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch({
        subscription: [
          subscriptionBody({ trialStatus: 'ACTIVE', trialEnd: RENEWAL }),
        ],
        quote: [
          {
            ...quoteBody,
            amountDueNowUsd: 0,
            creditUsd: 0,
            inTrial: true,
            renewsOn: RENEWAL,
          },
        ],
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );

      const panel = await screen.findByTestId('upgrade-panel');
      await within(panel).findByText(
        /Your free trial continues and nothing is charged today/
      );
      expect(panel).toHaveTextContent(
        /yearly price of \$290\.00, is on .*2026\./
      );
      expect(within(panel).queryByTestId('amount-due')).toBeNull();
      await user.click(
        within(panel).getByRole('button', { name: 'Confirm upgrade' })
      );
      await waitFor(() => expect(mockPush).toHaveBeenCalled());
    });

    it('E2: a declined card keeps the user monthly, says nothing was charged, and stays on the quote', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({
        post: { ok: false, body: { code: 'PAYMENT_FAILED' } },
      }) as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm and pay $270.35' })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Your card was not charged and you are still on the monthly plan. Update your card or try another one.'
      );
      expect(mockPush).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Confirm and pay $270.35' })
      ).toBeEnabled();
    });

    it('E2: after a declined card it asks for a fresh quote, so a retry is a new attempt and not a replay of the refusal', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch({
        quote: [
          quoteBody,
          {
            ...quoteBody,
            prorationDate: 1_793_414_000,
            amountDueNowUsd: 269.9,
          },
        ],
        post: { ok: false, body: { code: 'PAYMENT_FAILED' } },
      });
      global.fetch = fetchMock as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm and pay $270.35' })
      );

      expect(
        await screen.findByRole('button', { name: 'Confirm and pay $269.90' })
      ).toBeEnabled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Your card was not charged/
      );
      const previews = fetchMock.mock.calls.filter((c) =>
        String(c[0]).startsWith('/api/subscription/change-plan/preview')
      );
      expect(previews).toHaveLength(2);

      // The retry carries the NEW quote time.
      await user.click(
        screen.getByRole('button', { name: 'Confirm and pay $269.90' })
      );
      await waitFor(() => {
        const posts = fetchMock.mock.calls.filter(
          (c) =>
            c[0] === '/api/subscription/change-plan' && c[1]?.method === 'POST'
        );
        expect(posts).toHaveLength(2);
        expect(JSON.parse(posts[1]![1].body as string).prorationDate).toBe(
          1_793_414_000
        );
      });
    });

    it.each([
      ['PRORATION_EXPIRED', /The quote was out of date/],
      ['INVALID_PRORATION_DATE', /The quote was out of date/],
      ['PRICE_CHANGED', /The price has changed/],
    ])(
      '%s: fetches a fresh quote and asks again instead of charging',
      async (code, message) => {
        const user = userEvent.setup();
        const fetchMock = mockFetch({
          quote: [
            quoteBody,
            {
              ...quoteBody,
              prorationDate: 1_793_414_000,
              amountDueNowUsd: 269.9,
            },
          ],
          post: { ok: false, body: { code } },
        });
        global.fetch = fetchMock as unknown as typeof fetch;
        renderChangePlan();

        await user.click(
          await screen.findByRole('button', { name: 'Upgrade to yearly' })
        );
        await user.click(
          await screen.findByRole('button', { name: 'Confirm and pay $270.35' })
        );

        expect(await screen.findByText(message)).toBeInTheDocument();
        // The new amount is on the button; the old one is gone.
        expect(
          await screen.findByRole('button', { name: 'Confirm and pay $269.90' })
        ).toBeEnabled();
        const previews = fetchMock.mock.calls.filter((c) =>
          String(c[0]).startsWith('/api/subscription/change-plan/preview')
        );
        expect(previews).toHaveLength(2);
        expect(mockPush).not.toHaveBeenCalled();
      }
    );

    it('re-reads the subscription and closes the quote when the situation changed (for example already yearly)', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({
        subscription: [monthlySub, yearlySub],
        post: { ok: false, body: { code: 'ACTION_NOT_ALLOWED' } },
      }) as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm and pay $270.35' })
      );

      await screen.findByRole('button', { name: 'Switch to monthly' });
      expect(screen.queryByTestId('upgrade-panel')).toBeNull();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('says so when the quote cannot be calculated, and tries again on request', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({
        quote: [quoteBody, quoteBody],
        quoteOk: [false, true],
      }) as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not calculate the charge. Please try again.'
      );
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(
        await screen.findByRole('button', { name: 'Confirm and pay $270.35' })
      ).toBeInTheDocument();
    });

    it('says a generic error, with nothing charged, when the change fails', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({
        post: { ok: false, body: { code: 'CHANGE_PLAN_ERROR' } },
      }) as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm and pay $270.35' })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not change your plan. Nothing was charged. Please try again.'
      );
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('"Not now" closes the quote without changing anything', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch();
      global.fetch = fetchMock as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Upgrade to yearly' })
      );
      await screen.findByTestId('upgrade-panel');
      await user.click(screen.getByRole('button', { name: 'Not now' }));

      expect(screen.queryByTestId('upgrade-panel')).toBeNull();
      expect(sent(fetchMock, 'POST')).toBe(false);
    });
  });

  describe('switch to monthly, at renewal (W5b)', () => {
    it('explains the date, the monthly price and that nothing is refunded, and schedules nothing until confirmed', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch({ subscription: [yearlySub] });
      global.fetch = fetchMock as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Switch to monthly' })
      );

      const panel = await screen.findByTestId('downgrade-panel');
      expect(panel).toHaveTextContent('Switch to monthly billing');
      expect(panel).toHaveTextContent(
        /From .*2026 you will be billed \$29\.00 a month/
      );
      expect(panel).toHaveTextContent(
        /You keep your yearly PRO access until then/
      );
      expect(panel).toHaveTextContent(
        'There is no refund and no credit for the current year, and nothing is charged now.'
      );
      expect(panel).toHaveTextContent(
        /keep yearly billing any time before .*2026/
      );
      expect(sent(fetchMock, 'POST')).toBe(false);
    });

    it('schedules the switch with the monthly price on screen, then goes back to billing', async () => {
      const user = userEvent.setup();
      const fetchMock = mockFetch({ subscription: [yearlySub] });
      global.fetch = fetchMock as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Switch to monthly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm switch to monthly' })
      );

      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith('/settings/billing?done=switch')
      );
      expect(bodyOf(fetchMock, 'POST')).toEqual({
        billingPeriod: 'monthly',
        expectedMonthlyPriceUsd: 29,
      });
    });

    it('PRICE_CHANGED: says so and stays, without scheduling', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({
        subscription: [yearlySub],
        post: { ok: false, body: { code: 'PRICE_CHANGED' } },
      }) as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Switch to monthly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm switch to monthly' })
      );

      expect(
        await screen.findByText(/The price has changed/)
      ).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('re-reads the subscription when the situation changed (for example already pending)', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({
        subscription: [yearlySub, pendingSub],
        post: { ok: false, body: { code: 'ALREADY_PENDING' } },
      }) as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Switch to monthly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm switch to monthly' })
      );

      expect(
        await screen.findByText(/already set to switch to monthly billing on/)
      ).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('says a generic error when scheduling fails', async () => {
      const user = userEvent.setup();
      global.fetch = mockFetch({
        subscription: [yearlySub],
        post: { ok: false, body: { code: 'CHANGE_PLAN_ERROR' } },
      }) as unknown as typeof fetch;
      renderChangePlan();

      await user.click(
        await screen.findByRole('button', { name: 'Switch to monthly' })
      );
      await user.click(
        await screen.findByRole('button', { name: 'Confirm switch to monthly' })
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not change your plan. Nothing was charged. Please try again.'
      );
    });
  });

  describe('when the server does not offer a change', () => {
    it.each([
      [
        'a failed payment',
        subscriptionBody({
          displayState: 'PAST_DUE',
          allowedActions: ['pay_now', 'update_card'],
        }),
        /last payment needs attention first/,
      ],
      [
        'a scheduled cancellation',
        subscriptionBody({
          displayState: 'CANCEL_SCHEDULED',
          allowedActions: ['resume', 'update_card'],
        }),
        /Resume your subscription on the billing page first/,
      ],
      [
        'a pending switch',
        pendingSub,
        /already set to switch to monthly billing on .*2026\. To stay on yearly billing, use "Keep yearly"/,
      ],
      [
        'a dLocal plan',
        subscriptionBody({ provider: 'DLOCAL', allowedActions: [] }),
        /Your plan is prepaid\. You choose the billing period each time you renew it\./,
      ],
      [
        'nothing to change',
        subscriptionBody({ allowedActions: ['update_card', 'cancel'] }),
        /do not have a PRO subscription whose billing period can be changed/,
      ],
    ])(
      'explains instead of offering buttons: %s',
      async (_label, subscription, message) => {
        global.fetch = mockFetch({
          subscription: [subscription],
        }) as unknown as typeof fetch;
        renderChangePlan();

        expect(
          await screen.findByText(
            'Changing the billing period is not available right now'
          )
        ).toBeInTheDocument();
        expect(screen.getByText(message)).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: 'Upgrade to yearly' })
        ).toBeNull();
        expect(
          screen.queryByRole('button', { name: 'Switch to monthly' })
        ).toBeNull();
        expect(
          screen.getByRole('link', { name: 'Back to billing' })
        ).toBeInTheDocument();
      }
    );

    it('shows nothing to do in admin view', async () => {
      global.fetch = mockFetch() as unknown as typeof fetch;
      renderChangePlan(adminView);
      expect(
        await screen.findByText(/Plan actions are hidden in admin view/)
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Upgrade to yearly' })
      ).toBeNull();
    });

    it('says so when the subscription cannot be read', async () => {
      global.fetch = mockFetch({
        subscriptionOk: false,
      }) as unknown as typeof fetch;
      renderChangePlan();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'We could not change your plan. Nothing was charged. Please try again.'
      );
    });
  });

  describe('currencies and languages', () => {
    it('shows an indicative price note for a viewer whose currency is not USD', async () => {
      localStorage.setItem(
        LOCALE_STORAGE_KEY,
        JSON.stringify({
          countryCode: 'GB',
          language: 'en-GB',
          timezone: 'Europe/London',
          dateFormat: 'DMY',
          timeFormat: '24h',
          currency: 'GBP',
        })
      );
      global.fetch = mockFetch() as unknown as typeof fetch;
      renderChangePlan();

      await screen.findByRole('button', { name: 'Upgrade to yearly' });
      expect(
        screen.getAllByText(/Approximate price in GBP/).length
      ).toBeGreaterThan(0);
    });

    it('is written in the reader’s language: German page title and buttons from the real dictionary', async () => {
      localStorage.setItem(
        LOCALE_STORAGE_KEY,
        JSON.stringify({ ...US_PREFERENCES, language: 'de', countryCode: 'DE' })
      );
      global.fetch = mockFetch() as unknown as typeof fetch;
      renderChangePlan();

      const dict = de as Record<string, string>;
      expect(
        await screen.findByRole('heading', {
          name: dict['billing.change_plan.title'],
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: dict['billing.change_plan.upgrade_cta'],
        })
      ).toBeInTheDocument();
    });

    it('is written in Arabic too', async () => {
      localStorage.setItem(
        LOCALE_STORAGE_KEY,
        JSON.stringify({ ...US_PREFERENCES, language: 'ar', countryCode: 'SA' })
      );
      global.fetch = mockFetch({
        subscription: [yearlySub],
      }) as unknown as typeof fetch;
      renderChangePlan();

      const dict = ar as Record<string, string>;
      expect(
        await screen.findByRole('heading', {
          name: dict['billing.change_plan.title'],
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: dict['billing.change_plan.downgrade_cta'],
        })
      ).toBeInTheDocument();
    });
  });
});

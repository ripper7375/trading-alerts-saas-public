/**
 * /settings/billing -- the dLocal expiring banner and "Renew now"
 * (Manage Subscription S4, workflow W6; plan §7 and §8).
 *
 * A dLocal plan is prepaid and never renews by itself. Within three days of its
 * end the server reports `displayState: 'EXPIRING'`; the page then shows
 * "Your plan expires on {date}" with "Renew now", which opens /checkout with the
 * current period preselected and a renew marker. After paying, the user returns
 * with `?done=renewed`, which only triggers the notice (and only when the fresh
 * data agrees). The server decides what is offered: the buttons come from
 * `allowedActions`, so they are absent in admin view.
 *
 * @module __tests__/pages/settings/billing-dlocal-renew.test
 */

import { render, screen, waitFor, within } from '@testing-library/react';

import BillingSettingsPage from '@/app/settings/billing/page';
import { UserViewAsProvider } from '@/components/admin/user-view-as/user-view-as-context';
import { LocaleProvider } from '@/lib/context/locale-context';
import ar from '@/lib/i18n/dictionaries/ar.json';
import de from '@/lib/i18n/dictionaries/de.json';
import ja from '@/lib/i18n/dictionaries/ja.json';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/settings/billing',
}));

jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    regularPrice: 29.0,
    annualPrice: 290.0,
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

const TRIAL = {
  status: 'CONVERTED',
  convertedAt: '2026-07-01T00:00:00.000Z',
  cancelledAt: null,
  hasUsedFreeTrial: true,
};

function dLocalSubscription(overrides: {
  displayState: string;
  allowedActions: string[];
  planType?: string;
  expiresAt?: string;
}): Record<string, unknown> {
  return {
    tier: 'PRO',
    status: 'ACTIVE',
    allowedActions: overrides.allowedActions,
    displayState: overrides.displayState,
    subscription: {
      id: 'sub_dl',
      status: 'ACTIVE',
      provider: 'DLOCAL',
      planType: overrides.planType ?? 'MONTHLY',
      amountUsd: 29,
      currentPeriodEnd: null,
      expiresAt: overrides.expiresAt ?? '2026-12-05T12:00:00.000Z',
      renewsAutomatically: false,
      cancelAtPeriodEnd: false,
      trialEnd: null,
      paymentMethod: null,
      dLocalPaymentMethod: 'UPI',
      dLocalCountry: 'IN',
      openInvoiceUrl: null,
      pendingPlanChange: null,
    },
    trial: TRIAL,
  };
}

const expiring = dLocalSubscription({
  displayState: 'EXPIRING',
  allowedActions: ['renew_now'],
});
const activeFar = dLocalSubscription({
  displayState: 'ACTIVE',
  allowedActions: ['renew_now'],
});

const stripeSubscription = {
  tier: 'PRO',
  status: 'ACTIVE',
  allowedActions: ['update_card', 'upgrade_to_yearly', 'cancel'],
  displayState: 'ACTIVE',
  subscription: {
    id: 'sub_st',
    status: 'ACTIVE',
    provider: 'STRIPE',
    planType: 'MONTHLY',
    amountUsd: 29,
    currentPeriodEnd: '2026-12-05T12:00:00.000Z',
    expiresAt: '2026-12-05T12:00:00.000Z',
    renewsAutomatically: true,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    paymentMethod: {
      brand: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2030,
    },
    dLocalPaymentMethod: null,
    dLocalCountry: null,
    openInvoiceUrl: null,
    pendingPlanChange: null,
  },
  trial: TRIAL,
};

function mockFetch(subscription: unknown): typeof fetch {
  return jest.fn((url: string) => {
    if (url.startsWith('/api/subscription')) {
      return Promise.resolve({ ok: true, json: async () => subscription });
    }
    if (url.startsWith('/api/invoices')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ invoices: [], hasMore: false }),
      });
    }
    if (url.startsWith('/api/alerts')) {
      return Promise.resolve({ ok: true, json: async () => ({ alerts: [] }) });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  }) as unknown as typeof fetch;
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

function renderBilling(viewAs: Record<string, string> | null = null) {
  return render(
    <LocaleProvider>
      <UserViewAsProvider value={viewAs as never}>
        <BillingSettingsPage />
      </UserViewAsProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(US_PREFERENCES));
  mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
  setSearch('');
});

afterEach(() => {
  (window as unknown as { location: unknown }).location = originalLocation;
});

describe('the dLocal expiring banner (W6)', () => {
  it('says when the plan expires, that renewing keeps PRO, and that the days left are added', async () => {
    global.fetch = mockFetch(expiring);

    renderBilling();
    const banner = await screen.findByRole('status');

    expect(banner).toHaveTextContent('Your plan expires on');
    expect(banner).toHaveTextContent('2026');
    expect(banner).toHaveTextContent(
      'Renew now to keep your PRO features. The days you have left are added to the new period.'
    );
  });

  it('has a Renew now button that opens /checkout with the period, the country and the renew marker', async () => {
    global.fetch = mockFetch(expiring);

    renderBilling();
    const banner = await screen.findByRole('status');
    const link = within(banner).getByRole('link', { name: 'Renew now' });

    const url = new URL(link.getAttribute('href') ?? '', 'http://localhost');
    expect(url.pathname).toBe('/checkout');
    expect(url.searchParams.get('renew')).toBe('1');
    expect(url.searchParams.get('plan')).toBe('MONTHLY');
    expect(url.searchParams.get('country')).toBe('IN');
  });

  it('preselects the yearly plan for a yearly subscriber', async () => {
    global.fetch = mockFetch(
      dLocalSubscription({
        displayState: 'EXPIRING',
        allowedActions: ['renew_now'],
        planType: 'YEARLY',
      })
    );

    renderBilling();
    const banner = await screen.findByRole('status');
    const href = within(banner)
      .getByRole('link', { name: 'Renew now' })
      .getAttribute('href');

    const url = new URL(href ?? '', 'http://localhost');
    expect(url.searchParams.get('plan')).toBe('YEARLY');
    expect(url.searchParams.get('billing')).toBe('yearly');
    expect(url.searchParams.get('renew')).toBe('1');
  });

  it('a 3-day plan renews as monthly: it can only be bought once', async () => {
    global.fetch = mockFetch(
      dLocalSubscription({
        displayState: 'EXPIRING',
        allowedActions: ['renew_now'],
        planType: 'THREE_DAY',
      })
    );

    renderBilling();
    const banner = await screen.findByRole('status');
    const href = within(banner)
      .getByRole('link', { name: 'Renew now' })
      .getAttribute('href');

    expect(
      new URL(href ?? '', 'http://localhost').searchParams.get('plan')
    ).toBe('MONTHLY');
  });

  it('marks the plan "Expires soon" and keeps the prepaid note, with no cancel', async () => {
    global.fetch = mockFetch(expiring);

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.getByText('Expires soon')).toBeInTheDocument();
    expect(
      screen.getByText(
        /This plan is prepaid\. It ends on .*2026 and does not renew automatically\./
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cancel Plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Update card' })).toBeNull();
  });

  it('offers Renew now in the plan card as well as in the banner', async () => {
    global.fetch = mockFetch(expiring);

    renderBilling();
    await screen.findByRole('status');

    expect(screen.getAllByRole('link', { name: 'Renew now' })).toHaveLength(2);
  });

  it('shows no banner and no badge for a dLocal plan that is not close to its end', async () => {
    global.fetch = mockFetch(activeFar);

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('Expires soon')).toBeNull();
  });

  it('still lets a dLocal plan that is not close to its end be renewed, from the plan card only', async () => {
    global.fetch = mockFetch(activeFar);

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.getAllByRole('link', { name: 'Renew now' })).toHaveLength(1);
  });

  it('shows no Renew now button when the server did not allow it', async () => {
    global.fetch = mockFetch(
      dLocalSubscription({ displayState: 'EXPIRING', allowedActions: [] })
    );

    renderBilling();
    const banner = await screen.findByRole('status');

    expect(
      within(banner).queryByRole('link', { name: 'Renew now' })
    ).toBeNull();
    expect(screen.queryByRole('link', { name: 'Renew now' })).toBeNull();
  });

  it('hides Renew now in admin view-as whatever the server sent', async () => {
    global.fetch = mockFetch(expiring);

    renderBilling({
      id: 'user_42',
      name: 'Carol',
      email: 'carol@example.com',
      tier: 'PRO',
      role: 'USER',
    });
    await screen.findByText('PRO TIER');

    expect(screen.queryByRole('link', { name: 'Renew now' })).toBeNull();
  });

  it('a Stripe subscriber never sees Renew now or the expiring banner', async () => {
    global.fetch = mockFetch(stripeSubscription);

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.queryByRole('link', { name: 'Renew now' })).toBeNull();
    expect(
      screen.queryByText('Your plan expires on', { exact: false })
    ).toBeNull();
  });
});

describe('coming back from the renewal checkout (?done=renewed)', () => {
  it('says the plan was renewed and until when, once the fresh data agrees, and drops the marker', async () => {
    const replaceState = jest.spyOn(window.history, 'replaceState');
    setSearch('?done=renewed');
    global.fetch = mockFetch(activeFar);

    renderBilling();
    const notice = await screen.findByRole('status');

    expect(notice).toHaveTextContent(
      'Your plan has been renewed. PRO now runs until'
    );
    expect(notice).toHaveTextContent('2026');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/settings/billing');
    // The subscription was read again as the page loaded.
    expect(global.fetch).toHaveBeenCalledWith('/api/subscription');
    replaceState.mockRestore();
  });

  it('does NOT claim a renewal while the plan is still close to its end (a hand-typed marker)', async () => {
    setSearch('?done=renewed');
    global.fetch = mockFetch(expiring);

    renderBilling();
    const banner = await screen.findByRole('status');

    expect(banner).toHaveTextContent('Your plan expires on');
    expect(screen.queryByText(/Your plan has been renewed/)).toBeNull();
  });

  it('does NOT claim a renewal for a Stripe subscriber', async () => {
    setSearch('?done=renewed');
    global.fetch = mockFetch(stripeSubscription);

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.queryByText(/Your plan has been renewed/)).toBeNull();
  });

  it('shows no notice on an ordinary visit', async () => {
    global.fetch = mockFetch(activeFar);

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.queryByText(/Your plan has been renewed/)).toBeNull();
  });
});

// The new keys exist in every dictionary (compulsory-translation-coverage);
// this holds that the page asks for the right ones, in a script that is not
// English and in the one that reads right to left.
describe('the dLocal texts come from the dictionary', () => {
  it.each([
    ['ar', ar],
    ['de', de],
    ['ja', ja],
  ] as const)(
    'shows the banner, the badge and Renew now in %s',
    async (language, dictionary) => {
      const words = dictionary as Record<string, string>;
      localStorage.setItem(
        LOCALE_STORAGE_KEY,
        JSON.stringify({ ...US_PREFERENCES, language })
      );
      global.fetch = mockFetch(expiring);

      renderBilling();
      const banner = await screen.findByRole('status');

      await waitFor(() => {
        expect(banner).toHaveTextContent(
          words['billing.banner.expiring_title']!.split('{date}')[0]!.trim()
        );
      });
      expect(banner).toHaveTextContent(words['billing.banner.expiring_body']!);
      expect(
        within(banner).getByRole('link', {
          name: words['billing.action.renew_now'],
        })
      ).toBeInTheDocument();
      expect(
        screen.getByText(words['billing.status.expiring']!)
      ).toBeInTheDocument();
    }
  );
});

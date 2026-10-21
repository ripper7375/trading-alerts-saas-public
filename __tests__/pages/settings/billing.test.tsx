/**
 * Billing Settings Page Tests
 *
 * Session 6-1b: verifies /settings/billing renders real subscription,
 * trial, invoice, and usage data instead of the removed `mockInvoices`
 * and hardcoded usage stats — real data render, empty state, and both
 * cancel outcomes.
 *
 * @module __tests__/pages/settings/billing.test
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BillingSettingsPage from '@/app/settings/billing/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import ar from '@/lib/i18n/dictionaries/ar.json';
import de from '@/lib/i18n/dictionaries/de.json';
import ja from '@/lib/i18n/dictionaries/ja.json';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

// BillingSettingsPage calls useLocale() -- needs a LocaleProvider ancestor
// (LESSONS-LEARNED.md L40). Pre-seed localStorage with US/USD preferences so
// formatCurrency()/formatDate() reproduce this file's pre-existing literal
// "$X.XX" assertions (LocaleProvider's own default, absent a seeded
// preference, resolves to GB/GBP -- a real conversion, not the same numbers).
jest.mock('next/navigation', () => ({
  usePathname: () => '/settings/billing',
}));

const US_PREFERENCES = {
  countryCode: 'US',
  language: 'en-US',
  timezone: 'America/New_York',
  dateFormat: 'MDY',
  timeFormat: '12h',
  currency: 'USD',
};

function renderBilling(): ReturnType<typeof render> {
  return render(
    <LocaleProvider>
      <BillingSettingsPage />
    </LocaleProvider>
  );
}

jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    config: undefined,
    discountPercent: 20,
    commissionPercent: 20,
    codesPerMonth: 15,
    regularPrice: 29.0,
    threeDayPrice: 1.99,
    calculateDiscountedPrice: (price: number) => price * 0.8,
    calculateCommissionAmount: (price: number) => price * 0.8 * 0.2,
    calculateDiscountAmount: (price: number) => price * 0.2,
    isLoading: false,
    error: undefined,
  }),
}));

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const proSubscription = {
  tier: 'PRO',
  status: 'active',
  // What GET /api/subscription now sends (Manage Subscription S1).
  allowedActions: ['update_card', 'cancel'],
  displayState: 'ACTIVE',
  subscription: {
    id: 'sub_1',
    status: 'active',
    provider: 'STRIPE',
    planType: 'MONTHLY',
    currentPeriodEnd: '2026-09-01T00:00:00.000Z',
    expiresAt: null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    paymentMethod: {
      brand: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2027,
    },
    dLocalPaymentMethod: null,
    dLocalCountry: null,
    openInvoiceUrl: null,
  },
  trial: {
    status: 'CONVERTED',
    convertedAt: '2026-07-01T00:00:00.000Z',
    cancelledAt: null,
    hasUsedFreeTrial: true,
  },
};

const freeSubscription = {
  tier: 'FREE',
  status: 'none',
  allowedActions: [],
  displayState: 'FREE',
  subscription: null,
  trial: {
    status: 'NOT_STARTED',
    convertedAt: null,
    cancelledAt: null,
    hasUsedFreeTrial: false,
  },
};

function mockFetchImplementation(overrides: {
  subscription?: unknown;
  subscriptionOk?: boolean;
  invoices?: unknown[];
  invoicesOk?: boolean;
  alertCount?: number;
  cancelOk?: boolean;
  cancelBody?: unknown;
  portalOk?: boolean;
  portalBody?: unknown;
}) {
  const {
    subscription = proSubscription,
    subscriptionOk = true,
    invoices = [],
    invoicesOk = true,
    alertCount = 0,
    cancelOk = true,
    cancelBody = {
      success: true,
      message: 'Subscription cancelled successfully',
      tier: 'FREE',
    },
    portalOk = true,
    portalBody = { url: 'https://billing.stripe.com/p/session/bps_1' },
  } = overrides;

  let cancelled = false;

  return jest.fn((url: string, init?: RequestInit) => {
    if (url === '/api/subscription') {
      const body = cancelled ? freeSubscription : subscription;
      return Promise.resolve({
        ok: subscriptionOk,
        json: async () =>
          subscriptionOk ? body : { error: 'Failed to fetch subscription' },
      });
    }
    if (url === '/api/invoices') {
      return Promise.resolve({
        ok: invoicesOk,
        json: async () =>
          invoicesOk
            ? { invoices, hasMore: false }
            : { error: 'Failed to fetch invoices' },
      });
    }
    if (url === '/api/alerts') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          alerts: Array.from({ length: alertCount }, (_, i) => ({
            id: `${i}`,
          })),
        }),
      });
    }
    if (
      url === '/api/subscription/payment-method-session' &&
      init?.method === 'POST'
    ) {
      return Promise.resolve({
        ok: portalOk,
        json: async () =>
          portalOk
            ? portalBody
            : { error: 'Card update failed', code: 'PORTAL_SESSION_ERROR' },
      });
    }
    if (url === '/api/subscription/cancel' && init?.method === 'POST') {
      if (cancelOk) {
        cancelled = true;
      }
      return Promise.resolve({
        ok: cancelOk,
        json: async () =>
          cancelOk
            ? cancelBody
            : {
                error: 'Cancellation failed',
                message: 'Failed to cancel subscription. Please try again.',
              },
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe('BillingSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(US_PREFERENCES));
  });

  it('renders real subscription, payment method, and invoice data for a PRO user', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      invoices: [
        {
          id: 'in_1',
          date: '2026-07-01T00:00:00.000Z',
          amount: 29,
          currency: 'USD',
          status: 'paid',
          description: 'Trading Alerts PRO - Monthly',
          invoicePdfUrl: 'https://pay.stripe.com/invoice/in_1/pdf',
        },
      ],
      alertCount: 7,
    }) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByText('PRO TIER')).toBeInTheDocument();
    expect(screen.getByText(/Visa ending in \*\*\*\*4242/)).toBeInTheDocument();
    expect(
      screen.getByText('Trading Alerts PRO - Monthly')
    ).toBeInTheDocument();
    expect(screen.getByText('7/100')).toBeInTheDocument();

    // The old mock invoice/comment must never appear.
    expect(screen.queryByText('INV-001')).not.toBeInTheDocument();
  });

  it('shows the VAT breakdown for a taxed EU invoice (davintrade-vat-stack)', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      invoices: [
        {
          id: 'in_eu',
          date: '2026-07-01T00:00:00.000Z',
          amount: 34.51,
          currency: 'EUR',
          status: 'paid',
          description: 'Trading Alerts PRO - Monthly',
          invoicePdfUrl: 'https://pay.stripe.com/invoice/in_eu/pdf',
          hostedInvoiceUrl: 'https://invoice.stripe.com/i/in_eu',
          taxAmount: 5.51,
          taxRate: 0.19,
          taxCountry: 'DE',
          reverseCharge: false,
        },
      ],
      alertCount: 0,
    }) as unknown as typeof fetch;

    renderBilling();

    // Shown in the currency actually charged (EUR), exactly as the Stripe
    // PDF shows it. Before 2026-09-24 this rendered "$34.51" -- the EUR
    // figure mislabelled as dollars.
    expect(await screen.findByText('€34.51')).toBeInTheDocument();
    expect(screen.getByText('incl. €5.51 VAT (19%, DE)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View/ })).toHaveAttribute(
      'href',
      'https://invoice.stripe.com/i/in_eu'
    );
    expect(screen.queryByText(/Reverse charge/)).not.toBeInTheDocument();
  });

  it('shows a reverse-charge badge instead of a VAT line for a validated B2B invoice', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      invoices: [
        {
          id: 'in_b2b',
          date: '2026-07-01T00:00:00.000Z',
          amount: 58,
          currency: 'EUR',
          status: 'paid',
          description: 'Trading Alerts PRO - Monthly',
          invoicePdfUrl: 'https://pay.stripe.com/invoice/in_b2b/pdf',
          hostedInvoiceUrl: null,
          taxAmount: 0,
          taxRate: 0,
          taxCountry: 'DE',
          reverseCharge: true,
        },
      ],
      alertCount: 0,
    }) as unknown as typeof fetch;

    renderBilling();

    // Charged in EUR, so shown in EUR (see the VAT test above).
    expect(await screen.findByText('€58.00')).toBeInTheDocument();
    expect(screen.getByText('Reverse charge — 0% VAT')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /View/ })
    ).not.toBeInTheDocument();
  });

  it('shows no tax line for an untaxed dLocal/US invoice, matching current behavior', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      invoices: [
        {
          id: 'in_us',
          date: '2026-07-01T00:00:00.000Z',
          amount: 19.99,
          currency: 'USD',
          status: 'paid',
          description: 'Trading Alerts PRO - Monthly',
          invoicePdfUrl: 'https://pay.stripe.com/invoice/in_us/pdf',
          hostedInvoiceUrl: null,
          taxAmount: 0,
          taxRate: 0,
          taxCountry: 'US',
          reverseCharge: false,
        },
      ],
      alertCount: 0,
    }) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByText('$19.99')).toBeInTheDocument();
    expect(screen.queryByText(/VAT/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reverse charge/)).not.toBeInTheDocument();
  });

  it('renders correctly for a FREE user with no subscription or invoices', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'FREE' } } });
    global.fetch = mockFetchImplementation({
      subscription: freeSubscription,
      invoices: [],
      alertCount: 0,
    }) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByText('FREE TIER')).toBeInTheDocument();
    expect(screen.getByText('View Pricing Plans')).toBeInTheDocument();
    // No invoice section is rendered at all for FREE users (matches SOURCE).
    expect(screen.queryByText('Invoice History')).not.toBeInTheDocument();
  });

  it('cancels the subscription and reflects the FREE downgrade without a page reload', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({}) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    await user.click(screen.getByRole('button', { name: 'Cancel Plan' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirm Cancellation' })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/subscription/cancel', {
        method: 'POST',
      });
    });

    expect(await screen.findByText('FREE TIER')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Confirm Cancellation' })
    ).not.toBeInTheDocument();
  });

  it('shows a real error and stays PRO when cancellation fails', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      cancelOk: false,
    }) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    await user.click(screen.getByRole('button', { name: 'Cancel Plan' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirm Cancellation' })
    );

    expect(
      await screen.findByText(
        'Failed to cancel subscription. Please try again.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('PRO TIER')).toBeInTheDocument();
  });

  //━━ 2026-09-24: dLocal receipts, amount-difference notice, full history ━━

  const dLocalInvoice = {
    id: 'pay_inr_1',
    date: '2026-08-01T00:00:00.000Z',
    amount: 1930.34,
    currency: 'INR',
    amountUsd: 23.2,
    provider: 'DLOCAL',
    status: 'paid',
    description: 'Trading Alerts PRO - Monthly',
    invoicePdfUrl: '/api/invoices/pay_inr_1/receipt',
    hostedInvoiceUrl: null,
    taxAmount: 0,
    taxRate: 0,
    taxCountry: 'IN',
    reverseCharge: false,
  };

  it('shows the exact local charge, an indicative conversion, a receipt link and the difference notice for a dLocal payment', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      invoices: [dLocalInvoice],
    }) as unknown as typeof fetch;

    renderBilling();

    // Exact charge, in the currency paid -- matches the receipt PDF.
    expect(await screen.findByText('₹1,930.34')).toBeInTheDocument();
    // Indicative figure in the viewer's display currency (USD here), from
    // the net-of-discount USD value, not the $29 list price.
    expect(screen.getByText('≈ $23.20')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Download receipt (PDF)' })
    ).toHaveAttribute('href', '/api/invoices/pay_inr_1/receipt');

    const notice = screen.getByRole('note', { name: 'Why amounts may differ' });
    expect(notice).toHaveTextContent(/exactly what you were charged/);
    expect(notice).toHaveTextContent(/Local payments \(via dLocal\)/);
    // No USD card charge that differs from a USD display currency.
    expect(notice).not.toHaveTextContent(/Card payments are charged in USD/);
  });

  it('shows no indicative line and no notice when the charge is already in the display currency', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      invoices: [
        {
          ...dLocalInvoice,
          id: 'in_usd',
          provider: 'STRIPE',
          currency: 'USD',
          amount: 19.99,
          amountUsd: 19.99,
          invoicePdfUrl: 'https://pay.stripe.com/invoice/in_usd/pdf',
        },
      ],
    }) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByText('$19.99')).toBeInTheDocument();
    expect(screen.queryByText(/^≈/)).not.toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Download invoice (PDF)' })
    ).toHaveAttribute('href', 'https://pay.stripe.com/invoice/in_usd/pdf');
  });

  it('explains USD card charges and the approximate plan price for a GBP viewer', async () => {
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
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      invoices: [
        {
          ...dLocalInvoice,
          id: 'in_card',
          provider: 'STRIPE',
          currency: 'USD',
          amount: 19.99,
          amountUsd: 19.99,
        },
      ],
    }) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByText('US$19.99')).toBeInTheDocument();
    const notice = screen.getByRole('note', { name: 'Why amounts may differ' });
    expect(notice).toHaveTextContent(/into GBP, your display currency/);
    expect(notice).toHaveTextContent(/Card payments are charged in USD/);
    expect(
      screen.getByText(
        /Approximate price in GBP\. The plan is priced at US\$29\.00 USD/
      )
    ).toBeInTheDocument();
  });

  it('pages through the COMPLETE invoice history, not just the latest 12', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    const history = Array.from({ length: 30 }, (_, i) => ({
      ...dLocalInvoice,
      id: `in_${i}`,
      provider: 'STRIPE',
      currency: 'USD',
      amount: 29,
      amountUsd: 29,
      description: `Invoice row ${i}`,
    }));
    global.fetch = mockFetchImplementation({
      invoices: history,
    }) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByText('Invoice row 0')).toBeInTheDocument();
    expect(screen.getByText('Showing 12 of 30 invoices')).toBeInTheDocument();
    expect(screen.queryByText('Invoice row 12')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load More' }));
    expect(screen.getByText('Invoice row 23')).toBeInTheDocument();
    expect(screen.getByText('Showing 24 of 30 invoices')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByText('Invoice row 29')).toBeInTheDocument();
    expect(screen.getByText('Showing 30 of 30 invoices')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Load More' })
    ).not.toBeInTheDocument();
  });

  it('keeps past invoices downloadable for a FREE user who used to pay', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'FREE' } } });
    global.fetch = mockFetchImplementation({
      subscription: freeSubscription,
      invoices: [dLocalInvoice],
    }) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByText('Invoice History')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Download receipt (PDF)' })
    ).toBeInTheDocument();
  });
});

//━━ Manage Subscription S1 (B3, W1, W2) ━━

const INVOICE_URL = 'https://invoice.stripe.com/i/acct_1/test_1';
const PORTAL_URL = 'https://billing.stripe.com/p/session/bps_1';

const pastDueSubscription = {
  ...proSubscription,
  status: 'PAST_DUE',
  allowedActions: ['pay_now', 'update_card'],
  displayState: 'PAST_DUE',
  subscription: {
    ...proSubscription.subscription,
    status: 'PAST_DUE',
    openInvoiceUrl: INVOICE_URL,
  },
};

// UNPAID: Stripe gave up retrying, PRO is paused (tier FREE), the invoice is
// still open (B2: this user used to get `subscription: null`).
const unpaidSubscription = {
  ...pastDueSubscription,
  tier: 'FREE',
  status: 'UNPAID',
  displayState: 'UNPAID',
  subscription: {
    ...pastDueSubscription.subscription,
    status: 'UNPAID',
  },
};

describe('BillingSettingsPage -- Manage Subscription S1', () => {
  const originalLocation = window.location;
  let assign: jest.Mock;

  function setLocation(search: string): void {
    assign = jest.fn();
    // jsdom 20 (jest-environment-jsdom 29) lets the test swap the whole object.
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: unknown }).location = {
      ...originalLocation,
      pathname: '/settings/billing',
      search,
      assign,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(US_PREFERENCES));
    setLocation('');
  });

  afterEach(() => {
    (window as unknown as { location: unknown }).location = originalLocation;
  });

  it('no longer shows the dead "Manage Subscription" button (B3)', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({}) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.queryByText('Manage Subscription')).not.toBeInTheDocument();
    // Nothing on a billing page should link back to the billing page.
    expect(
      screen
        .queryAllByRole('link')
        .some((a) => a.getAttribute('href') === '/settings/billing')
    ).toBe(false);
    // The rest of the action row is intact.
    expect(
      screen.getByRole('button', { name: 'Cancel Plan' })
    ).toBeInTheDocument();
  });

  it('shows no banner and an "Update card" button in the payment method block for a healthy Stripe subscriber', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({}) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay now')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Update card' })
    ).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows the red banner with Pay now and Update card while PAST_DUE, keeping PRO and hiding Cancel', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      subscription: pastDueSubscription,
    }) as unknown as typeof fetch;

    renderBilling();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Your last payment failed');
    expect(banner).toHaveTextContent(/Your PRO access continues/);
    const payNow = screen.getByRole('link', { name: 'Pay now' });
    expect(payNow).toHaveAttribute('href', INVOICE_URL);
    expect(payNow).toHaveAttribute('target', '_blank');
    expect(payNow).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      within(banner).getByRole('button', { name: 'Update card' })
    ).toBeInTheDocument();

    // Still PRO, flagged overdue, and no cancel until the payment is resolved.
    expect(screen.getByText('PRO TIER')).toBeInTheDocument();
    expect(screen.getByText('Payment overdue')).toBeInTheDocument();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancel Plan' })
    ).not.toBeInTheDocument();
  });

  it('offers only Update card while PAST_DUE when Stripe has no open invoice page', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      subscription: {
        ...pastDueSubscription,
        allowedActions: ['update_card'],
        subscription: {
          ...pastDueSubscription.subscription,
          openInvoiceUrl: null,
        },
      },
    }) as unknown as typeof fetch;

    renderBilling();

    await screen.findByRole('alert');
    expect(screen.queryByText('Pay now')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: 'Update card' }).length
    ).toBeGreaterThan(0);
  });

  it('shows the paused banner, the card and Pay now to a FREE user whose subscription is UNPAID (B2)', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'FREE' } } });
    global.fetch = mockFetchImplementation({
      subscription: unpaidSubscription,
    }) as unknown as typeof fetch;

    renderBilling();

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Your PRO plan is paused');
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute(
      'href',
      INVOICE_URL
    );
    expect(screen.getByText('PRO paused')).toBeInTheDocument();
    // The card they have to fix is shown...
    expect(screen.getByText(/Visa ending in \*\*\*\*4242/)).toBeInTheDocument();
    // ...and they are not pushed to buy a second subscription.
    expect(screen.getByText('FREE TIER')).toBeInTheDocument();
    expect(screen.queryByText('Upgrade to PRO')).not.toBeInTheDocument();
    expect(screen.queryByText('Unlock More with PRO')).not.toBeInTheDocument();
  });

  // The new keys exist in every dictionary (compulsory-translation-coverage);
  // this holds that the page asks for the right ones, in a script that is
  // not English and in the one that reads right to left.
  it.each([
    ['ar', ar],
    ['de', de],
    ['ja', ja],
  ] as const)(
    'shows the failed-payment banner and its buttons in %s, from the dictionary',
    async (language, dictionary) => {
      const words = dictionary as Record<string, string>;
      localStorage.setItem(
        LOCALE_STORAGE_KEY,
        JSON.stringify({ ...US_PREFERENCES, language })
      );
      mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
      global.fetch = mockFetchImplementation({
        subscription: pastDueSubscription,
      }) as unknown as typeof fetch;

      renderBilling();
      const banner = await screen.findByRole('alert');

      await waitFor(() => {
        expect(banner).toHaveTextContent(
          words['billing.banner.past_due_title']!
        );
      });
      expect(banner).toHaveTextContent(words['billing.banner.past_due_body']!);
      expect(
        within(banner).getByRole('link', {
          name: words['billing.action.pay_now'],
        })
      ).toHaveAttribute('href', INVOICE_URL);
      expect(
        within(banner).getByRole('button', {
          name: words['billing.action.update_card'],
        })
      ).toBeInTheDocument();
      expect(
        screen.getByText(words['billing.status.past_due']!)
      ).toBeInTheDocument();
    }
  );

  it('opens Stripe’s card form from the banner and from the payment method block', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      subscription: pastDueSubscription,
    }) as unknown as typeof fetch;

    renderBilling();
    const banner = await screen.findByRole('alert');

    await user.click(
      within(banner).getByRole('button', { name: 'Update card' })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/subscription/payment-method-session',
        { method: 'POST' }
      );
    });
    await waitFor(() => expect(assign).toHaveBeenCalledWith(PORTAL_URL));
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('opens the card form from the payment method block of a healthy subscriber', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({}) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    await user.click(screen.getByRole('button', { name: 'Update card' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(PORTAL_URL));
  });

  it('shows a translated error and stays on the page when the card form cannot be opened', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      portalOk: false,
    }) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    await user.click(screen.getByRole('button', { name: 'Update card' }));

    expect(
      await screen.findByText(
        'We could not open the card update page. Please try again.'
      )
    ).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    // The button is usable again.
    expect(screen.getByRole('button', { name: 'Update card' })).toBeEnabled();
  });

  it.each([
    ['not a URL', { url: 'not a url' }],
    ['not https', { url: 'http://billing.stripe.com/p/session/x' }],
    ['no url at all', {}],
  ])(
    'refuses to navigate when the portal answer is %s',
    async (_label, body) => {
      const user = userEvent.setup();
      mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
      global.fetch = mockFetchImplementation({
        portalBody: body,
      }) as unknown as typeof fetch;

      renderBilling();
      await screen.findByText('PRO TIER');

      await user.click(screen.getByRole('button', { name: 'Update card' }));

      expect(
        await screen.findByText(
          'We could not open the card update page. Please try again.'
        )
      ).toBeInTheDocument();
      expect(assign).not.toHaveBeenCalled();
    }
  );

  it('says so when Stripe sends the user back (?done=card), and drops the marker from the address', async () => {
    const replaceState = jest.spyOn(window.history, 'replaceState');
    setLocation('?done=card');
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({}) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Back from Stripe. Your latest card details are shown below.'
    );
    expect(replaceState).toHaveBeenCalledWith(null, '', '/settings/billing');
    // The subscription was read again as the page loaded.
    expect(global.fetch).toHaveBeenCalledWith('/api/subscription');
    replaceState.mockRestore();
  });

  it('mentions the automatic retry when the user comes back while a payment is overdue', async () => {
    setLocation('?done=card');
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      subscription: pastDueSubscription,
    }) as unknown as typeof fetch;

    renderBilling();

    expect(await screen.findByRole('status')).toHaveTextContent(
      /overdue payment is retried automatically/
    );
  });

  it('does not show the "back from Stripe" notice on an ordinary visit', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({}) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('looks again when the user returns from paying in the other tab', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    const fetchMock = mockFetchImplementation({
      subscription: pastDueSubscription,
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    renderBilling();
    await screen.findByRole('alert');
    const subscriptionReads = (): number =>
      fetchMock.mock.calls.filter((c) => c[0] === '/api/subscription').length;
    const before = subscriptionReads();

    document.dispatchEvent(new Event('visibilitychange'));

    await waitFor(() => expect(subscriptionReads()).toBe(before + 1));
  });

  it('does not re-read on tab focus while the subscription is healthy', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    const fetchMock = mockFetchImplementation({});
    global.fetch = fetchMock as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');
    const before = fetchMock.mock.calls.length;

    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock.mock.calls.length).toBe(before);
  });

  it('draws the plan action row from allowedActions: no cancel when the server did not allow it', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      subscription: { ...proSubscription, allowedActions: ['update_card'] },
    }) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(
      screen.queryByRole('button', { name: 'Cancel Plan' })
    ).not.toBeInTheDocument();
  });

  it('offers no Update card for a dLocal subscriber (nothing to update in Stripe)', async () => {
    mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
    global.fetch = mockFetchImplementation({
      subscription: {
        ...proSubscription,
        allowedActions: ['cancel'],
        subscription: {
          ...proSubscription.subscription,
          provider: 'DLOCAL',
          paymentMethod: null,
          dLocalPaymentMethod: 'UPI',
          dLocalCountry: 'IN',
        },
      },
    }) as unknown as typeof fetch;

    renderBilling();
    await screen.findByText('PRO TIER');

    expect(screen.getByText(/Paid via dLocal/)).toBeInTheDocument();
    expect(screen.queryByText('Update card')).not.toBeInTheDocument();
  });
});

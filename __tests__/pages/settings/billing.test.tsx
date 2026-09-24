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

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import BillingSettingsPage from '@/app/settings/billing/page';
import { LocaleProvider } from '@/lib/context/locale-context';
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

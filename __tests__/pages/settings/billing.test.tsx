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

    expect(await screen.findByText('$34.51')).toBeInTheDocument();
    expect(screen.getByText('incl. $5.51 VAT (19%, DE)')).toBeInTheDocument();
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

    // $58.00 (not $29.00) avoids colliding with the plan-price card's own
    // "$29.00" text elsewhere on the page.
    expect(await screen.findByText('$58.00')).toBeInTheDocument();
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
});

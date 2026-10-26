/**
 * Checkout for an early dLocal renewal (Manage Subscription S4, workflow W6).
 *
 * "Renew now" on /settings/billing opens /checkout with the period preselected
 * and `renew=1`. An active PRO user is normally stopped at the checkout; the
 * renewal marker lifts that stop only after `GET /api/subscription` says the
 * plan is a dLocal one and offers `renew_now` (the marker alone proves
 * nothing, and the create-payment route decides again on the server). A
 * renewal is paid with dLocal only, takes no discount code, and remembers the
 * payment so the return page can send the user back to /settings/billing.
 *
 * @module __tests__/pages/checkout/dlocal-renewal.test
 */
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { DLocalCountry, PlanType } from '@/types/dlocal';

let mockPathname = '/checkout';
let mockSearchParams = new URLSearchParams();
const mockReplace = jest.fn();
const mockRedirect = jest.fn();
const mockRouter = { replace: mockReplace };
const mockUseSession = jest.fn();
const mockFetch = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));
jest.mock('next-auth/react', () => ({ useSession: () => mockUseSession() }));
jest.mock('@/lib/context/locale-context', () => ({
  useLocale: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    formatCurrency: (amount: number) => `$${amount}`,
    formatDate: (value: string) => `DATE(${value})`,
    currency: 'USD',
    language: 'en-US',
  }),
  Translated: ({ k, fallback }: { k: string; fallback?: string }) =>
    fallback ?? k,
}));
jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    regularPrice: 20,
    threeDayPrice: 2,
    annualPrice: 200,
    annualSavingsPercent: 17,
  }),
}));
jest.mock('@/components/payments/fx-rate-attribution', () => ({
  FxRateAttribution: () => null,
}));
jest.mock('@/components/payments', () => ({
  CountrySelector: ({
    value,
    onChange,
  }: {
    value: DLocalCountry | null;
    onChange: (country: DLocalCountry) => void;
  }) => (
    <label>
      Country
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value as DLocalCountry)}
      >
        <option value="">Choose a country</option>
        <option value="IN">India</option>
        <option value="TH">Thailand</option>
      </select>
    </label>
  ),
  PlanSelector: ({
    value,
    showThreeDayPlan,
  }: {
    value: PlanType;
    showThreeDayPlan?: boolean;
  }) => (
    <output aria-label="Plan">
      {value}
      {showThreeDayPlan ? ' +3-day' : ''}
    </output>
  ),
  PaymentMethodSelector: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (method: string) => void;
  }) => (
    <label>
      Local payment option
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose payment option</option>
        <option value="UPI">UPI</option>
      </select>
    </label>
  ),
  DiscountCodeInput: () => (
    <label>
      Discount code
      <input readOnly />
    </label>
  ),
  PriceDisplay: ({ usdAmount }: { usdAmount: number }) => (
    <output aria-label="Local total">{usdAmount}</output>
  ),
  PaymentButton: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick: () => Promise<void>;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

import CheckoutPage from '@/app/checkout/page';
import StripeCheckoutPage from '@/app/checkout/stripe/page';
import DLocalCheckoutPage from '@/app/checkout/dlocal/page';
import { RENEW_PENDING_STORAGE_KEY } from '@/lib/billing/renew';

function setRoute(href: string): void {
  const url = new URL(href, 'https://davintrade.app');
  mockPathname = url.pathname;
  mockSearchParams = url.searchParams;
}

const EXPIRES_AT = '2026-10-30T00:00:00.000Z';

/** What GET /api/subscription sends for a dLocal subscriber. */
const dLocalSubscription = {
  tier: 'PRO',
  allowedActions: ['renew_now'],
  displayState: 'EXPIRING',
  subscription: { provider: 'DLOCAL', expiresAt: EXPIRES_AT },
};

function subscriptionIs(body: unknown, ok = true): void {
  mockFetch.mockImplementation(async (url: string) => {
    if (url === '/api/subscription') return { ok, json: async () => body };
    if (url === '/api/payments/dlocal/check-three-day-eligibility') {
      return { ok: true, json: async () => ({ eligible: false }) };
    }
    if (url === '/api/payments/dlocal/create') {
      return {
        ok: true,
        json: async () => ({
          paymentId: 'dl-pay-9',
          paymentUrl: 'https://sandbox.dlocal.com/pay/9',
        }),
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

function signedIn(tier: 'PRO' | 'FREE'): void {
  mockUseSession.mockReturnValue({
    data: { user: { id: 'buyer-1', tier } },
    status: 'authenticated',
  });
}

const subscriptionCalls = (): unknown[][] =>
  mockFetch.mock.calls.filter((call) => call[0] === '/api/subscription');

const alreadyPro = (): HTMLElement =>
  screen.getByRole('heading', { name: "You're Already a PRO Member" });

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  setRoute('/checkout');
  signedIn('PRO');
  global.fetch = mockFetch;
});

afterEach(() => {
  cleanup();
});

describe('the renewal gate on the checkout routes', () => {
  it('without the marker an active PRO user is still stopped, and nothing is requested', () => {
    setRoute('/checkout/dlocal?plan=MONTHLY');
    subscriptionIs(dLocalSubscription);

    render(<DLocalCheckoutPage />);

    expect(alreadyPro()).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('with the marker, opens the checkout once the server offers renew_now for a dLocal plan', async () => {
    setRoute('/checkout/dlocal?plan=MONTHLY&renew=1&country=IN');
    subscriptionIs(dLocalSubscription);

    render(<DLocalCheckoutPage />);

    expect(await screen.findByLabelText('Country')).toBeInTheDocument();
    expect(screen.queryByText("You're Already a PRO Member")).toBeNull();
    expect(subscriptionCalls()).toHaveLength(1);
  });

  it('shows the loading state while the server is being asked, not the checkout', async () => {
    setRoute('/checkout/dlocal?plan=MONTHLY&renew=1');
    mockFetch.mockImplementation(() => new Promise(() => undefined));

    render(<DLocalCheckoutPage />);

    expect(screen.getByText('Loading checkout...')).toBeInTheDocument();
    expect(screen.queryByLabelText('Country')).toBeNull();
    expect(screen.queryByText("You're Already a PRO Member")).toBeNull();
  });

  it('keeps the stop for a Stripe subscriber who adds the marker by hand', async () => {
    setRoute('/checkout/dlocal?renew=1');
    subscriptionIs({
      tier: 'PRO',
      allowedActions: ['update_card', 'cancel'],
      subscription: { provider: 'STRIPE', expiresAt: null },
    });

    render(<DLocalCheckoutPage />);

    await waitFor(() => expect(alreadyPro()).toBeInTheDocument());
    expect(screen.queryByLabelText('Country')).toBeNull();
  });

  it('keeps the stop for a Stripe plan even if renew_now were sent (a dLocal-only flow)', async () => {
    setRoute('/checkout/dlocal?renew=1');
    subscriptionIs({
      tier: 'PRO',
      allowedActions: ['renew_now'],
      subscription: { provider: 'STRIPE', expiresAt: null },
    });

    render(<DLocalCheckoutPage />);

    await waitFor(() => expect(alreadyPro()).toBeInTheDocument());
    expect(screen.queryByLabelText('Country')).toBeNull();
  });

  it('keeps the stop when the server does not offer renew_now', async () => {
    setRoute('/checkout/dlocal?renew=1');
    subscriptionIs({
      tier: 'PRO',
      allowedActions: [],
      subscription: { provider: 'DLOCAL', expiresAt: EXPIRES_AT },
    });

    render(<DLocalCheckoutPage />);

    await waitFor(() => expect(alreadyPro()).toBeInTheDocument());
  });

  it('keeps the stop when the subscription cannot be read', async () => {
    setRoute('/checkout/dlocal?renew=1');
    subscriptionIs({ error: 'boom' }, false);

    render(<DLocalCheckoutPage />);

    await waitFor(() => expect(alreadyPro()).toBeInTheDocument());
  });

  it('keeps the stop when the request itself fails', async () => {
    setRoute('/checkout/dlocal?renew=1');
    mockFetch.mockRejectedValue(new Error('offline'));

    render(<DLocalCheckoutPage />);

    await waitFor(() => expect(alreadyPro()).toBeInTheDocument());
  });

  it('a FREE user with the marker is an ordinary buyer: no subscription is read', async () => {
    signedIn('FREE');
    setRoute('/checkout/dlocal?renew=1');
    subscriptionIs(dLocalSubscription);

    render(<DLocalCheckoutPage />);

    expect(await screen.findByLabelText('Country')).toBeInTheDocument();
    expect(subscriptionCalls()).toHaveLength(0);
  });
});

describe('/checkout for a renewing subscriber', () => {
  it('goes straight to dLocal, keeping the plan, the country and the marker (Stripe would start a second subscription)', async () => {
    setRoute('/checkout?plan=YEARLY&billing=yearly&renew=1&country=IN');
    subscriptionIs(dLocalSubscription);

    render(<CheckoutPage />);

    await waitFor(() => expect(mockRedirect).toHaveBeenCalled());
    const target = new URL(
      mockRedirect.mock.calls[0]?.[0] as string,
      'https://davintrade.app'
    );
    expect(target.pathname).toBe('/checkout/dlocal');
    expect(target.searchParams.get('renew')).toBe('1');
    expect(target.searchParams.get('plan')).toBe('YEARLY');
    expect(target.searchParams.get('country')).toBe('IN');
  });

  it('does not redirect an ordinary buyer: both providers stay on offer', () => {
    signedIn('FREE');
    setRoute('/checkout');

    render(<CheckoutPage />);

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(
      screen.getByRole('link', { name: /Continue with Stripe/ })
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Continue with dLocal/ })
    ).toBeTruthy();
  });

  it('turns /checkout/stripe into the dLocal checkout for a renewal', async () => {
    setRoute('/checkout/stripe?renew=1&plan=MONTHLY');
    subscriptionIs(dLocalSubscription);

    render(<StripeCheckoutPage />);

    await waitFor(() => expect(mockRedirect).toHaveBeenCalled());
    expect(
      new URL(
        mockRedirect.mock.calls[0]?.[0] as string,
        'https://davintrade.app'
      ).pathname
    ).toBe('/checkout/dlocal');
  });
});

describe('the dLocal checkout in renewal mode', () => {
  async function openRenewal(href: string): Promise<void> {
    setRoute(href);
    subscriptionIs(dLocalSubscription);
    render(<DLocalCheckoutPage />);
    await screen.findByLabelText('Country');
  }

  it('tells the customer when the plan ends and that the days left are added', async () => {
    await openRenewal('/checkout/dlocal?plan=MONTHLY&renew=1&country=IN');

    expect(screen.getByRole('note')).toHaveTextContent(
      `It ends on DATE(${EXPIRES_AT}), and the days you have left are added to the new period you pay for now.`
    );
  });

  it('goes back to billing, not to pricing, and has no way to switch to Stripe', async () => {
    await openRenewal('/checkout/dlocal?plan=MONTHLY&renew=1&country=IN');

    expect(
      screen.getByRole('link', { name: /Back to billing/ })
    ).toHaveAttribute('href', '/settings/billing');
    expect(screen.queryByRole('link', { name: /Back to Pricing/ })).toBeNull();
    expect(
      screen.queryByRole('link', { name: /Change payment method/ })
    ).toBeNull();
  });

  it('preselects the plan from the link and offers no 3-day plan and no discount code', async () => {
    await openRenewal(
      '/checkout/dlocal?plan=YEARLY&billing=yearly&renew=1&country=IN&ref=FRIEND'
    );

    expect(await screen.findByLabelText('Plan')).toHaveTextContent(/^YEARLY$/);
    expect(screen.queryByLabelText('Discount code')).toBeNull();
  });

  it('pays with renew: true, sends no discount code even for a ref link, and remembers the payment', async () => {
    const assign = jest.fn();
    const original = window.location;
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: unknown }).location = {
      ...original,
      assign,
      href: '',
    };

    await openRenewal(
      '/checkout/dlocal?plan=MONTHLY&renew=1&country=IN&ref=FRIEND'
    );
    fireEvent.change(screen.getByLabelText('Local payment option'), {
      target: { value: 'UPI' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Pay with Local Method' })
    );

    await waitFor(() =>
      expect(window.sessionStorage.getItem(RENEW_PENDING_STORAGE_KEY)).toBe(
        'dl-pay-9'
      )
    );
    const create = mockFetch.mock.calls.find(
      (call) => call[0] === '/api/payments/dlocal/create'
    );
    const body = JSON.parse(create?.[1]?.body as string);
    expect(body).toEqual(
      expect.objectContaining({
        planType: 'MONTHLY',
        country: 'IN',
        paymentMethod: 'UPI',
        renew: true,
      })
    );
    expect(body.discountCode).toBeUndefined();

    (window as unknown as { location: unknown }).location = original;
  });
});

describe('the dLocal checkout for a new buyer is unchanged', () => {
  it('shows pricing and the provider switch, takes a discount code and sends no renew flag', async () => {
    signedIn('FREE');
    setRoute('/checkout/dlocal?plan=MONTHLY&country=IN&ref=FRIEND');
    subscriptionIs(dLocalSubscription);
    const original = window.location;
    delete (window as unknown as { location?: Location }).location;
    (window as unknown as { location: unknown }).location = {
      ...original,
      href: '',
    };

    render(<DLocalCheckoutPage />);
    await screen.findByLabelText('Country');

    expect(screen.getByRole('link', { name: /Back to Pricing/ })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Change payment method/ })
    ).toBeTruthy();
    expect(screen.getByLabelText('Discount code')).toBeInTheDocument();
    expect(screen.queryByRole('note')).toBeNull();

    fireEvent.change(screen.getByLabelText('Local payment option'), {
      target: { value: 'UPI' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Pay with Local Method' })
    );
    await waitFor(() =>
      expect(
        mockFetch.mock.calls.some(
          (call) => call[0] === '/api/payments/dlocal/create'
        )
      ).toBe(true)
    );
    const create = mockFetch.mock.calls.find(
      (call) => call[0] === '/api/payments/dlocal/create'
    );
    const body = JSON.parse(create?.[1]?.body as string);
    expect(body.renew).toBeUndefined();
    expect(body.discountCode).toBe('FRIEND');
    expect(window.sessionStorage.getItem(RENEW_PENDING_STORAGE_KEY)).toBeNull();

    (window as unknown as { location: unknown }).location = original;
  });
});

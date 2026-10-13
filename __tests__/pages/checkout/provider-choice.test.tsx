/**
 * Checkout provider choice and provider-specific routes.
 * Existing payment widgets are isolated so these tests exercise the routing,
 * access boundaries, modal and checkout intent without background quote calls.
 */
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { DLocalCountry, DLocalCurrency, PlanType } from '@/types/dlocal';

let mockPathname = '/checkout';
let mockSearchParams = new URLSearchParams();
const mockReplace = jest.fn();
const mockRouter = { replace: mockReplace };
const mockUseSession = jest.fn();
const mockFetch = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
}));
jest.mock('next-auth/react', () => ({ useSession: () => mockUseSession() }));
jest.mock('@/lib/context/locale-context', () => ({
  useLocale: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    formatCurrency: (amount: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount),
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
        <option value="TH">Thailand</option>
        <option value="IN">India</option>
      </select>
    </label>
  ),
  PlanSelector: ({
    value,
    onChange,
  }: {
    value: PlanType;
    onChange: (plan: PlanType) => void;
  }) => (
    <label>
      Plan
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as PlanType)}
      >
        <option value="MONTHLY">Monthly</option>
        <option value="YEARLY">Annual</option>
        <option value="THREE_DAY">3-Day</option>
      </select>
    </label>
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
        <option value="Thai QR">Thai QR</option>
        <option value="UPI">UPI</option>
      </select>
    </label>
  ),
  DiscountCodeInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (code: string) => void;
  }) => (
    <label>
      Discount code
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  ),
  PriceDisplay: ({
    usdAmount,
    currency,
  }: {
    usdAmount: number;
    currency: DLocalCurrency;
  }) => (
    <output aria-label="Local total">
      {currency}: {usdAmount}
    </output>
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

function setRoute(href: string): void {
  const url = new URL(href, 'https://davintrade.app');
  mockPathname = url.pathname;
  mockSearchParams = url.searchParams;
}
function destination(name: string): URL {
  const link = screen.getByRole('link', { name });
  return new URL(link.getAttribute('href') as string, 'https://davintrade.app');
}

beforeEach(() => {
  jest.clearAllMocks();
  setRoute('/checkout');
  mockUseSession.mockReturnValue({
    data: { user: { id: 'buyer-1', tier: 'FREE' } },
    status: 'authenticated',
  });
  mockFetch.mockImplementation(async () => ({
    ok: true,
    json: async () => ({ eligible: true }),
  }));
  global.fetch = mockFetch;
});

describe('initial checkout payment choice', () => {
  it('immediately presents two alternative providers with suitability guidance and no payment form or requests', () => {
    render(<CheckoutPage />);
    const dialog = screen.getByRole('dialog', { name: 'Choose how to pay' });
    expect(dialog).toHaveAccessibleDescription(
      'Choose one of two payment options for your PRO purchase. You only need to use one.'
    );
    expect(within(dialog).getAllByRole('link')).toHaveLength(2);
    expect(
      within(dialog).getByRole('link', { name: 'Continue with Stripe' })
    ).toHaveAttribute('href', '/checkout/stripe');
    expect(
      within(dialog).getByRole('link', { name: 'Continue with dLocal' })
    ).toHaveAttribute('href', '/checkout/dlocal');
    expect(
      within(dialog).getByText(/international debit or credit card/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Payments are charged in USD/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/pay in local currency/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Payment methods vary by country/)
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey, United Arab Emirates, Brazil/
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue to Payment' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pay with Local Method' })
    ).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('keeps locale, billing, plan, country and referral intent in either choice', () => {
    setRoute(
      '/th/checkout?country=TH&plan=YEARLY&billing=yearly&ref=FRIEND+CODE'
    );
    render(<CheckoutPage />);
    for (const provider of ['Stripe', 'dLocal']) {
      const target = destination(`Continue with ${provider}`);
      expect(target.pathname).toBe(`/th/checkout/${provider.toLowerCase()}`);
      expect(Object.fromEntries(target.searchParams)).toEqual({
        country: 'TH',
        plan: 'YEARLY',
        billing: 'yearly',
        ref: 'FRIEND CODE',
      });
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('allows closing with the close button or Escape and reopening without losing the choices', async () => {
    render(<CheckoutPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Choose your preferred payment method',
        })
      ).toHaveFocus()
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Choose your preferred payment method',
      })
    );
    expect(
      screen.getByRole('dialog', { name: 'Choose how to pay' })
    ).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Choose your preferred payment method',
        })
      ).toHaveFocus()
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Choose your preferred payment method',
      })
    );
    expect(
      within(screen.getByRole('dialog')).getAllByRole('link')
    ).toHaveLength(2);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('separate provider checkout routes', () => {
  it('renders only Stripe checkout and never requests dLocal eligibility', () => {
    setRoute('/checkout/stripe?billing=yearly&ref=FRIEND');
    render(<StripeCheckoutPage />);
    expect(
      screen.getByRole('heading', { name: 'Stripe checkout' })
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Annual/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByText(/\$200\.00/)).toBeInTheDocument();
    expect(screen.getByText(/FRIEND/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continue to Payment' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Country')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Pay with Local Method' })
    ).not.toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('renders only dLocal checkout and initializes country, annual plan and referral', async () => {
    setRoute('/checkout/dlocal?country=TH&billing=yearly&ref=FRIEND');
    render(<DLocalCheckoutPage />);
    expect(
      await screen.findByRole('heading', { name: 'dLocal checkout' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Country')).toHaveValue('TH');
    expect(screen.getByLabelText('Plan')).toHaveValue('YEARLY');
    expect(screen.getByLabelText('Discount code')).toHaveValue('FRIEND');
    expect(screen.getByLabelText('Local total')).toHaveTextContent('THB: 200');
    expect(
      screen.queryByRole('radio', { name: /^Annual/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Continue to Payment' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pay with Local Method' })
    ).toBeDisabled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/payments/dlocal/check-three-day-eligibility'
    );
  });

  it('honors an explicit dLocal plan even when the pricing link says annual', async () => {
    setRoute('/checkout/dlocal?country=IN&plan=THREE_DAY&billing=yearly');
    render(<DLocalCheckoutPage />);
    expect(await screen.findByLabelText('Plan')).toHaveValue('THREE_DAY');
    expect(screen.getByLabelText('Local total')).toHaveTextContent('INR: 2');
  });

  it('keeps a changed Stripe billing choice through the chooser into dLocal', async () => {
    setRoute('/th/checkout/stripe?country=TH&billing=yearly&ref=FRIEND');
    render(<StripeCheckoutPage />);
    fireEvent.click(screen.getByRole('radio', { name: 'Monthly' }));
    const chooser = destination('Change payment method');
    expect(chooser.pathname).toBe('/th/checkout');
    expect(Object.fromEntries(chooser.searchParams)).toEqual({
      country: 'TH',
      billing: 'monthly',
      ref: 'FRIEND',
      plan: 'MONTHLY',
    });
    cleanup();
    setRoute(chooser.pathname + chooser.search);
    render(<CheckoutPage />);
    const dlocal = destination('Continue with dLocal');
    cleanup();
    setRoute(dlocal.pathname + dlocal.search);
    render(<DLocalCheckoutPage />);
    expect(await screen.findByLabelText('Plan')).toHaveValue('MONTHLY');
    expect(screen.getByLabelText('Country')).toHaveValue('TH');
    expect(screen.getByLabelText('Discount code')).toHaveValue('FRIEND');
  });

  it('keeps changed dLocal country, annual plan and referral through the chooser into Stripe', async () => {
    setRoute('/th/checkout/dlocal?country=TH&ref=OLD');
    render(<DLocalCheckoutPage />);
    fireEvent.change(await screen.findByLabelText('Country'), {
      target: { value: 'IN' },
    });
    fireEvent.change(screen.getByLabelText('Plan'), {
      target: { value: 'YEARLY' },
    });
    fireEvent.change(screen.getByLabelText('Discount code'), {
      target: { value: 'NEW' },
    });
    const chooser = destination('Change payment method');
    expect(Object.fromEntries(chooser.searchParams)).toEqual({
      country: 'IN',
      ref: 'NEW',
      plan: 'YEARLY',
      billing: 'yearly',
    });
    cleanup();
    setRoute(chooser.pathname + chooser.search);
    render(<CheckoutPage />);
    const stripe = destination('Continue with Stripe');
    cleanup();
    setRoute(stripe.pathname + stripe.search);
    render(<StripeCheckoutPage />);
    expect(screen.getByRole('radio', { name: /^Annual/ })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByText(/NEW/)).toBeInTheDocument();
  });
});

describe('checkout access boundaries', () => {
  const routes = [
    { path: '/checkout', Page: CheckoutPage },
    { path: '/checkout/stripe', Page: StripeCheckoutPage },
    { path: '/checkout/dlocal', Page: DLocalCheckoutPage },
  ];

  it.each(routes)(
    'keeps $path and its locale/query in the unauthenticated login callback',
    async ({ path, Page }) => {
      setRoute(`/th${path}?country=TH&billing=yearly&ref=FRIEND`);
      const expectedCallback = `${mockPathname}?${mockSearchParams.toString()}`;
      mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
      render(<Page />);
      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith(
          `/login?callbackUrl=${encodeURIComponent(expectedCallback)}`
        )
      );
      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Continue to Payment' })
      ).not.toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    }
  );

  it.each(routes)(
    'shows the existing active-PRO notice instead of purchasing on $path',
    ({ path, Page }) => {
      setRoute(path);
      mockUseSession.mockReturnValue({
        data: { user: { id: 'buyer-1', tier: 'PRO' } },
        status: 'authenticated',
      });
      render(<Page />);
      expect(
        screen.getByRole('heading', { name: "You're Already a PRO Member" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'Manage Subscription' })
      ).toHaveAttribute('href', '/settings/billing');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Continue to Payment' })
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Country')).not.toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    }
  );
});

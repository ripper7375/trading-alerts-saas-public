/**
 * /checkout/return after a dLocal renewal (Manage Subscription S4, W6).
 *
 * dLocal sends the customer back to this page. A renewal started in this tab
 * (the checkout remembers its payment id) gets a "Back to billing" button, which
 * carries `?done=renewed` once the payment is COMPLETED so /settings/billing can
 * say so. A first purchase, or another browser tab, sees the page as before.
 *
 * @module __tests__/pages/checkout/checkout-return-renewal.test
 */

import React from 'react';
import {
  render as rtlRender,
  screen,
  waitFor,
  type RenderOptions,
} from '@testing-library/react';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import {
  RENEW_PENDING_STORAGE_KEY,
  rememberRenewalPayment,
} from '@/lib/billing/renew';

const mockGet = jest.fn();
const mockSearchParams = { get: mockGet };
const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
  usePathname: () => '/checkout/return',
}));

import CheckoutReturnPage from '@/app/checkout/return/page';

function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: LocaleProvider, ...options });
}

const mockFetch = jest.fn();
global.fetch = mockFetch;

const payment = {
  id: 'pay_1',
  paymentId: 'dlocal-123',
  providerStatus: 'PAID',
  amount: { local: '2407.48', usd: '29.00', currency: 'INR' },
  country: 'IN',
  paymentMethod: 'UPI',
  planType: 'MONTHLY',
  duration: 30,
  createdAt: '2026-10-21T10:00:00.000Z',
  updatedAt: '2026-10-21T10:00:00.000Z',
};

function paymentIs(status: string): void {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ...payment, status }),
  } as Response);
}

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  mockGet.mockImplementation((key: string) =>
    key === 'payment_id' ? 'dlocal-123' : null
  );
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
});

describe('the return page after a renewal', () => {
  it('offers Back to billing with ?done=renewed for a COMPLETED renewal started in this tab', async () => {
    rememberRenewalPayment('dlocal-123');
    paymentIs('COMPLETED');

    render(<CheckoutReturnPage />);

    const link = await screen.findByRole('link', { name: 'Back to billing' });
    expect(link).toHaveAttribute('href', '/settings/billing?done=renewed');
    expect(
      screen.getByRole('link', { name: 'Go to Dashboard' })
    ).toBeInTheDocument();
  });

  it('offers Back to billing WITHOUT the marker while the payment is still PENDING', async () => {
    rememberRenewalPayment('dlocal-123');
    paymentIs('PENDING');

    render(<CheckoutReturnPage />);

    const link = await screen.findByRole('link', { name: 'Back to billing' });
    expect(link).toHaveAttribute('href', '/settings/billing');
  });

  it('offers Back to billing without the marker for a FAILED renewal, next to Try Again', async () => {
    rememberRenewalPayment('dlocal-123');
    paymentIs('FAILED');

    render(<CheckoutReturnPage />);

    const link = await screen.findByRole('link', { name: 'Back to billing' });
    expect(link).toHaveAttribute('href', '/settings/billing');
    expect(screen.getByRole('link', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('shows no Back to billing for a first purchase (nothing was remembered)', async () => {
    paymentIs('COMPLETED');

    render(<CheckoutReturnPage />);

    await waitFor(() =>
      expect(screen.getByText('Payment Successful')).toBeInTheDocument()
    );
    expect(screen.queryByRole('link', { name: 'Back to billing' })).toBeNull();
  });

  it('shows no Back to billing when the remembered payment is another one', async () => {
    rememberRenewalPayment('some-other-payment');
    paymentIs('COMPLETED');

    render(<CheckoutReturnPage />);

    await waitFor(() =>
      expect(screen.getByText('Payment Successful')).toBeInTheDocument()
    );
    expect(screen.queryByRole('link', { name: 'Back to billing' })).toBeNull();
  });

  it('works when storage is blocked: the page just offers its usual buttons', async () => {
    const getItem = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key: string) => {
        if (key === RENEW_PENDING_STORAGE_KEY) throw new Error('blocked');
        return null;
      });
    paymentIs('COMPLETED');

    render(<CheckoutReturnPage />);

    await waitFor(() =>
      expect(screen.getByText('Payment Successful')).toBeInTheDocument()
    );
    expect(screen.queryByRole('link', { name: 'Back to billing' })).toBeNull();
    getItem.mockRestore();
  });
});

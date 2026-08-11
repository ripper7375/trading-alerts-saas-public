/**
 * Checkout Return Page Tests (Session 6-8, A2-8)
 *
 * Verifies /checkout/return renders the real, previously-orphaned
 * GET /api/payments/dlocal/[paymentId] response -- missing-param,
 * unauthenticated redirect, not-found/forbidden errors, and each real
 * PaymentStatus value (PENDING/COMPLETED/FAILED/CANCELLED/REFUNDED).
 *
 * @module __tests__/pages/checkout/checkout-return.test
 */

import { render, screen, waitFor } from '@testing-library/react';

const mockGet = jest.fn();
const mockPush = jest.fn();
// Stable object references, matching next/navigation's real
// useRouter()/useSearchParams() (memoized across renders) -- a fresh
// literal per call would make fetchPayment's useCallback (deps include
// `router`) recompute every render and re-fire its mount effect in a
// loop, a pure test-mock artifact unrelated to app behavior.
const mockSearchParams = { get: mockGet };
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
}));

import CheckoutReturnPage from '@/app/checkout/return/page';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const mockFetch = jest.fn();
global.fetch = mockFetch;

const basePayment = {
  id: 'pay_1',
  paymentId: 'dlocal-123',
  providerStatus: 'PAID',
  amount: { local: '2407.48', usd: '29.00', currency: 'INR' },
  country: 'IN',
  paymentMethod: 'UPI',
  planType: 'MONTHLY',
  duration: 30,
  createdAt: '2026-08-11T10:00:00.000Z',
  updatedAt: '2026-08-11T10:00:00.000Z',
};

describe('CheckoutReturnPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((key: string) =>
      key === 'payment_id' ? 'dlocal-123' : null
    );
  });

  it('shows an error when no payment reference is present in the URL', async () => {
    mockGet.mockReturnValue(null);
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/no payment reference was provided/i)
      ).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('redirects to login when the payment lookup is unauthenticated', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(401, { error: 'Unauthorized' })
    );
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining('/login?callbackUrl=')
      );
    });
  });

  it('shows a not-found message on a 404', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(404, { error: 'Not found' }));
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(screen.getByText(/could not find a payment/i)).toBeInTheDocument();
    });
  });

  it('shows an ownership error on a 403', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(403, { error: 'Forbidden' }));
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/does not belong to your account/i)
      ).toBeInTheDocument();
    });
  });

  it('renders a success card for a COMPLETED payment with the real order summary', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { ...basePayment, status: 'COMPLETED' })
    );
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Successful')).toBeInTheDocument();
    });
    expect(screen.getByText('Monthly PRO')).toBeInTheDocument();
    expect(screen.getByText('dlocal-123')).toBeInTheDocument();
  });

  it('renders a pending state for a PENDING payment', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { ...basePayment, status: 'PENDING' })
    );
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Pending')).toBeInTheDocument();
    });
  });

  it('renders a failed state with a Try Again link for a FAILED payment', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { ...basePayment, status: 'FAILED' })
    );
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Failed')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /try again/i })).toHaveAttribute(
      'href',
      '/checkout'
    );
  });

  it('renders a cancelled state for a CANCELLED payment', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { ...basePayment, status: 'CANCELLED' })
    );
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Cancelled')).toBeInTheDocument();
    });
  });

  it('renders a refunded state for a REFUNDED payment', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, { ...basePayment, status: 'REFUNDED' })
    );
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Refunded')).toBeInTheDocument();
    });
  });

  it('accepts the camelCase paymentId param as a fallback', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'paymentId' ? 'dlocal-456' : null
    );
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        ...basePayment,
        paymentId: 'dlocal-456',
        status: 'COMPLETED',
      })
    );
    render(<CheckoutReturnPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/payments/dlocal/dlocal-456');
    });
  });
});

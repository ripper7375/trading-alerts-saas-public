/**
 * Upgrade Success Page Tests (Session 6-8, A2-9)
 *
 * Verifies /upgrade/success confirms real PRO status via
 * GET /api/subscription (not the `upgrade` query param alone), since
 * Stripe's webhook can lag the redirect -- unauthenticated redirect, PRO
 * success card, and the still-processing (FREE tier) state with a working
 * "Check Again" retry.
 *
 * @module __tests__/pages/checkout/upgrade-success.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockPush = jest.fn();
// Stable object reference, matching next/navigation's real useRouter()
// (memoized across renders) -- a fresh literal per call would make
// fetchSubscription's useCallback (deps include `router` transitively via
// re-renders) recompute every render and re-fire its mount effect in a
// loop, a pure test-mock artifact unrelated to app behavior.
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

import UpgradeSuccessPage from '@/app/upgrade/success/page';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('UpgradeSuccessPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redirects to login when unauthenticated', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<UpgradeSuccessPage />);

    expect(mockPush).toHaveBeenCalledWith(
      '/login?callbackUrl=/upgrade/success'
    );
  });

  it('renders the PRO success card once GET /api/subscription confirms PRO', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1' } },
      status: 'authenticated',
    });
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        tier: 'PRO',
        status: 'active',
        subscription: { provider: 'STRIPE', planType: null },
        trial: {
          status: 'NONE',
          convertedAt: null,
          cancelledAt: null,
          hasUsedFreeTrial: false,
        },
      })
    );

    render(<UpgradeSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to PRO!')).toBeInTheDocument();
    });
    expect(screen.getByText('Subscription Active')).toBeInTheDocument();
    expect(screen.getByText('100 Active Alerts')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /go to dashboard/i })
    ).toHaveAttribute('href', '/dashboard');
  });

  it('shows a processing state and lets the user retry when still FREE', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1' } },
      status: 'authenticated',
    });
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(200, {
          tier: 'FREE',
          status: 'none',
          subscription: null,
          trial: {
            status: 'NONE',
            convertedAt: null,
            cancelledAt: null,
            hasUsedFreeTrial: false,
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          tier: 'PRO',
          status: 'active',
          subscription: { provider: 'STRIPE', planType: null },
          trial: {
            status: 'NONE',
            convertedAt: null,
            cancelledAt: null,
            hasUsedFreeTrial: false,
          },
        })
      );

    const user = userEvent.setup();
    render(<UpgradeSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Finishing up your upgrade')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /check again/i }));

    await waitFor(() => {
      expect(screen.getByText('Welcome to PRO!')).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('shows an "Activated" badge for a dLocal-originated upgrade', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1' } },
      status: 'authenticated',
    });
    mockFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        tier: 'PRO',
        status: 'active',
        subscription: { provider: 'DLOCAL', planType: 'MONTHLY' },
        trial: {
          status: 'NONE',
          convertedAt: null,
          cancelledAt: null,
          hasUsedFreeTrial: false,
        },
      })
    );

    render(<UpgradeSuccessPage />);

    await waitFor(() => {
      expect(screen.getByText('Activated')).toBeInTheDocument();
    });
  });
});

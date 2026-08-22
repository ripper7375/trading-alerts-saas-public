/**
 * Settings Overview Page Tests
 *
 * Session 6-1b: verifies the alert count reflects the real GET /api/alerts
 * response length, not the previously hardcoded `alerts: 3`.
 *
 * @module __tests__/pages/settings/overview.test
 */

import { render, screen, waitFor } from '@testing-library/react';

import SettingsPage from '@/app/settings/page';

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

describe('SettingsPage overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('shows the real alert count from GET /api/alerts for a PRO user', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { tier: 'PRO' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        alerts: [
          { id: '1' },
          { id: '2' },
          { id: '3' },
          { id: '4' },
          { id: '5' },
        ],
      }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('5 / 100')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/alerts');
  });

  it('shows an error state instead of a fabricated count when the fetch fails', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { tier: 'PRO' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to fetch alerts' }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load')).toBeInTheDocument();
    });
    expect(screen.queryByText('3 / 100')).not.toBeInTheDocument();
  });

  it('shows the PRO-feature label for FREE users without fetching a count', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { tier: 'FREE' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ alerts: [] }),
    });

    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('PRO feature')).toBeInTheDocument();
    });
  });
});

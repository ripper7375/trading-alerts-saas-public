/**
 * Payout Setup Consolidation Tests (Session 6-7, A1-16)
 *
 * Verifies the legacy /affiliate/dashboard/profile/payment page is now a
 * transparent redirect to /affiliate/settings/payout, and that the
 * canonical payout-settings page's form state (recipient present/absent,
 * revalidate flow) behaves correctly.
 *
 * @module __tests__/pages/affiliate/payout-consolidation.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock('@/components/affiliate/wise-recipient-form', () => ({
  __esModule: true,
  default: ({ onSubmitted }: { onSubmitted: (r: unknown) => void }) => (
    <button onClick={() => onSubmitted({ id: 'new-recipient' })}>
      Mock Wise Form Submit
    </button>
  ),
}));

import AffiliatePaymentPageRedirect from '@/app/affiliate/dashboard/profile/payment/page';
import AffiliatePayoutSettingsPage from '@/app/affiliate/settings/payout/page';

describe('Legacy payment page redirect', () => {
  it('redirects to /affiliate/settings/payout', () => {
    expect(() => AffiliatePaymentPageRedirect()).toThrow(
      'NEXT_REDIRECT:/affiliate/settings/payout'
    );
  });
});

describe('AffiliatePayoutSettingsPage', () => {
  const recipient = {
    id: 'recipient-1',
    accountHolderName: 'Jane Doe',
    targetCurrency: 'THB',
    recipientCountry: 'TH',
    accountTail: '4321',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows current payout details when a recipient exists', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => recipient,
    });

    render(<AffiliatePayoutSettingsPage />);

    await waitFor(() =>
      expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    );
    expect(screen.getByText('THB')).toBeInTheDocument();
    expect(screen.getByText('•••• 4321')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('shows the onboarding form when no recipient exists (204)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => null,
    });

    render(<AffiliatePayoutSettingsPage />);

    await waitFor(() =>
      expect(
        screen.getByText(/haven't set up payout details yet/i)
      ).toBeInTheDocument()
    );
    expect(screen.getByText('Mock Wise Form Submit')).toBeInTheDocument();
  });

  it('calls the self-service /me endpoint, not the admin-only list endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => recipient,
    });

    render(<AffiliatePayoutSettingsPage />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/wise/recipients/me')
    );
  });

  it('re-verifies with the provider on Revalidate click', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => recipient,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...recipient, status: 'ACTIVE' }),
      });

    const user = userEvent.setup();
    render(<AffiliatePayoutSettingsPage />);

    await waitFor(() => screen.getByText('Jane Doe'));
    await user.click(
      screen.getByRole('button', { name: /re-verify with provider/i })
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/wise/recipients/recipient-1/revalidate',
        { method: 'POST' }
      )
    );
  });

  it('shows an error message when revalidation fails', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => recipient,
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });

    const user = userEvent.setup();
    render(<AffiliatePayoutSettingsPage />);

    await waitFor(() => screen.getByText('Jane Doe'));
    await user.click(
      screen.getByRole('button', { name: /re-verify with provider/i })
    );

    await waitFor(() =>
      expect(
        screen.getByText(/could not re-verify these details/i)
      ).toBeInTheDocument()
    );
  });

  it('toggles the change-details form', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => recipient,
    });

    const user = userEvent.setup();
    render(<AffiliatePayoutSettingsPage />);

    await waitFor(() => screen.getByText('Jane Doe'));
    await user.click(
      screen.getByRole('button', { name: /change payout details/i })
    );

    expect(screen.getByText('Mock Wise Form Submit')).toBeInTheDocument();
  });
});

/**
 * Fraud Alert Detail Page Tests
 *
 * Session 6-1b: verifies the page renders the real GET /api/admin/fraud-alerts/[id]
 * response instead of the removed MOCK_ALERT, handles 404, and wires status
 * transitions to the real PATCH endpoint without optimistic updates.
 *
 * @module __tests__/pages/admin/fraud-alerts-detail.test
 */

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import FraudAlertDetailPage from '@/app/admin/fraud-alerts/[id]/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'fa-1' }),
  usePathname: () => '/admin/fraud-alerts/fa-1',
}));

const realAlert = {
  id: 'fa-1',
  severity: 'CRITICAL',
  pattern: '3DAY_PLAN_REUSE',
  description: 'User attempted to purchase 3-day plan 5 times.',
  userId: 'user_123',
  country: 'IN',
  paymentMethod: 'UPI',
  amount: '165.17',
  currency: 'INR',
  createdAt: new Date('2026-08-01T10:00:00.000Z').toISOString(),
  status: 'PENDING',
  ipAddress: '103.21.45.67',
  resolution: null,
  notes: null,
  reviewedBy: null,
  reviewedAt: null,
  user: {
    id: 'user_123',
    email: 'suspicious@example.com',
    name: 'Suspicious User',
    tier: 'FREE',
  },
};

describe('FraudAlertDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify({
        countryCode: 'US',
        language: 'en-US',
        timezone: 'America/New_York',
        dateFormat: 'MDY',
        timeFormat: '12h',
        currency: 'USD',
      })
    );
  });

  it('renders the real fraud alert, not the removed MOCK_ALERT', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ alert: realAlert }),
    });

    render(<FraudAlertDetailPage />);

    expect(
      await screen.findByText('User attempted to purchase 3-day plan 5 times.')
    ).toBeInTheDocument();
    expect(screen.getByText('suspicious@example.com')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/fraud-alerts/fa-1');

    // Mock-only fields must not appear — they don't exist on the real model.
    expect(screen.queryByText('Risk Score')).not.toBeInTheDocument();
    expect(screen.queryByText(/85\/100/)).not.toBeInTheDocument();
  });

  it('shows the not-found state on a real 404', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Alert not found' }),
    });

    render(<FraudAlertDetailPage />);

    expect(await screen.findByText('Alert not found')).toBeInTheDocument();
  });

  it('wires the Dismiss action to a real PATCH call and reflects the confirmed status only', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ alert: realAlert }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          alert: { ...realAlert, status: 'DISMISSED' },
        }),
      });

    render(<FraudAlertDetailPage />);
    await screen.findByText('User attempted to purchase 3-day plan 5 times.');

    await user.click(screen.getByRole('button', { name: /dismiss/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/admin/fraud-alerts/fa-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'DISMISSED' }),
        })
      );
    });

    // Action buttons are hidden once status leaves PENDING (post-confirmation).
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /dismiss/i })
      ).not.toBeInTheDocument();
    });
  });

  it('shows a real error and keeps the alert PENDING when the status update fails', async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ alert: realAlert }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Failed to update fraud alert' }),
      });

    render(<FraudAlertDetailPage />);
    await screen.findByText('User attempted to purchase 3-day plan 5 times.');

    await user.click(screen.getByRole('button', { name: /mark reviewed/i }));

    expect(
      await screen.findByText('Failed to update fraud alert')
    ).toBeInTheDocument();
    // Still PENDING — action buttons remain visible, no optimistic flip.
    expect(
      screen.getByRole('button', { name: /mark reviewed/i })
    ).toBeInTheDocument();
  });
});

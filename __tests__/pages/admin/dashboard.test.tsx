/**
 * Admin Dashboard Page Tests
 *
 * Session 6-1b: verifies the "Recent Fraud Alerts" panel renders real data
 * fetched from GET /api/admin/fraud-alerts, not the removed mock generator.
 * The `/api/admin/analytics`-backed metric cards are unrelated to this
 * session's scope and are stubbed only enough to let the page render.
 *
 * @module __tests__/pages/admin/dashboard.test
 */

import { render, screen, waitFor } from '@testing-library/react';

import AdminDashboardPage from '@/app/admin/page';

const mockMetrics = {
  overview: {
    totalUsers: 100,
    freeUsers: 80,
    proUsers: 20,
    freePercentage: 80,
    proPercentage: 20,
  },
  revenue: { mrr: 580, arr: 6960, conversionRate: 20, pricePerUser: 29 },
  growth: { newUsersThisMonth: 5, churnedThisMonth: 1 },
};

function mockFetchImplementation(
  overrides: Partial<{
    analyticsOk: boolean;
    fraudAlertsOk: boolean;
    alerts: unknown[];
  }> = {}
) {
  const { analyticsOk = true, fraudAlertsOk = true, alerts = [] } = overrides;

  return jest.fn((url: string) => {
    if (url.startsWith('/api/admin/analytics')) {
      return Promise.resolve({
        ok: analyticsOk,
        json: async () =>
          analyticsOk ? mockMetrics : { error: 'Failed to fetch analytics' },
      });
    }
    if (url.startsWith('/api/admin/fraud-alerts')) {
      return Promise.resolve({
        ok: fraudAlertsOk,
        json: async () =>
          fraudAlertsOk
            ? { alerts }
            : { error: 'Failed to fetch fraud alerts' },
      });
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe('AdminDashboardPage recent activity panel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders real fraud alerts, not the removed mock generator', async () => {
    global.fetch = mockFetchImplementation({
      alerts: [
        {
          id: 'fa-1',
          severity: 'CRITICAL',
          pattern: '3DAY_PLAN_REUSE',
          description: 'Multiple 3-day plan attempts',
          createdAt: new Date().toISOString(),
          userEmail: 'suspicious@example.com',
        },
      ],
    }) as unknown as typeof fetch;

    render(<AdminDashboardPage />);

    expect(await screen.findByText('Recent Fraud Alerts')).toBeInTheDocument();
    expect(
      await screen.findByText('Multiple 3-day plan attempts')
    ).toBeInTheDocument();
    expect(screen.getByText('suspicious@example.com')).toBeInTheDocument();

    // The old mock-generated items must never appear.
    expect(screen.queryByText('New user registered')).not.toBeInTheDocument();
    expect(screen.queryByText('User upgraded to PRO')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no real fraud alerts', async () => {
    global.fetch = mockFetchImplementation({
      alerts: [],
    }) as unknown as typeof fetch;

    render(<AdminDashboardPage />);

    expect(
      await screen.findByText('No recent fraud alerts')
    ).toBeInTheDocument();
  });

  it('shows a real error state when the fraud-alerts fetch fails', async () => {
    global.fetch = mockFetchImplementation({
      fraudAlertsOk: false,
    }) as unknown as typeof fetch;

    render(<AdminDashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to fetch fraud alerts')
      ).toBeInTheDocument();
    });
  });

  it('leaves the /api/admin/analytics-backed stats untouched', async () => {
    global.fetch = mockFetchImplementation({
      alerts: [],
    }) as unknown as typeof fetch;

    render(<AdminDashboardPage />);

    expect(await screen.findByText('100')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});

/**
 * Admin System Operations Pages Tests (Session 6-11, B2-14..17)
 *
 * Covers the 4 new /admin/system/* pages: terminals' offline/not-configured
 * fallback and real-telemetry rendering, jobs' listing + manual trigger flow,
 * outbox's real queue counts + retry action, and config-history's real rows
 * + honest empty state.
 *
 * @module __tests__/pages/admin/system-operations.test
 */

import {
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminSystemTerminalsPage from '@/app/admin/system/terminals/page';
import AdminSystemJobsPage from '@/app/admin/system/jobs/page';
import AdminSystemOutboxPage from '@/app/admin/system/outbox/page';
import AdminSystemConfigHistoryPage from '@/app/admin/system/config-history/page';
import { SYSTEM_CRON_JOBS } from '@/lib/admin/system-jobs';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

const mockRouterRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
  usePathname: () => '/admin/system/terminals',
}));

const mockCookieStore = { get: jest.fn(() => undefined) };
const mockHeaderStore = { get: jest.fn(() => null) };
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
  headers: jest.fn(() => Promise.resolve(mockHeaderStore)),
}));

const mockGroupBy = jest.fn();
const mockOutboxFindMany = jest.fn();
const mockOutboxCount = jest.fn();
const mockConfigFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    outboxEvent: {
      groupBy: (...args: unknown[]) => mockGroupBy(...args),
      findMany: (...args: unknown[]) => mockOutboxFindMany(...args),
      count: (...args: unknown[]) => mockOutboxCount(...args),
    },
    systemConfigHistory: {
      findMany: (...args: unknown[]) => mockConfigFindMany(...args),
    },
  },
}));

beforeEach(() => {
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /admin/system/terminals (B2-14)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('AdminSystemTerminalsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "API Key Not Configured" when MT5_ADMIN_API_KEY is unset', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        status: 'not_configured',
        message: 'MT5_ADMIN_API_KEY is not set in this environment.',
      }),
    });

    render(<AdminSystemTerminalsPage />);

    await waitFor(() =>
      expect(screen.getByText('API Key Not Configured')).toBeInTheDocument()
    );
  });

  it('shows "Service Unavailable" when flask-api is unreachable, without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        status: 'offline',
        message: 'flask-api is unreachable -- attempting reconnection.',
      }),
    });

    render(<AdminSystemTerminalsPage />);

    await waitFor(() =>
      expect(
        screen.getByText('Service Unavailable — Attempting Reconnection')
      ).toBeInTheDocument()
    );
  });

  it('shows "Restricted Access" when the admin key is rejected', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        status: 'restricted',
        message: 'flask-api rejected the configured admin API key (401).',
      }),
    });

    render(<AdminSystemTerminalsPage />);

    await waitFor(() =>
      expect(screen.getByText('Restricted Access')).toBeInTheDocument()
    );
  });

  it('renders real terminal telemetry when online', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        status: 'online',
        health: {
          status: 'ok',
          version: '6.0.0',
          total_terminals: 2,
          connected_terminals: 1,
          terminals: {
            XAUUSD: {
              connected: true,
              terminal_id: 'MT5_01',
              last_check: '2026-08-11T00:00:00Z',
              uptime_percentage: 99.5,
              reconnect_count: 1,
            },
            BTCUSD: {
              connected: false,
              terminal_id: 'MT5_02',
              last_check: '2026-08-11T00:00:00Z',
            },
          },
        },
        stats: null,
      }),
    });

    render(<AdminSystemTerminalsPage />);

    await waitFor(() => expect(screen.getByText('1 / 2')).toBeInTheDocument());
    expect(screen.getByText('XAUUSD')).toBeInTheDocument();
    expect(screen.getByText('BTCUSD')).toBeInTheDocument();
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /admin/system/jobs (B2-15)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('AdminSystemJobsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists all 8 registered jobs with the honest scheduler badge, no fabricated last-run time', () => {
    render(<AdminSystemJobsPage />);

    expect(
      screen.getAllByText('Managed by Money-Service Scheduler')
    ).toHaveLength(SYSTEM_CRON_JOBS.length);
    expect(screen.getByText('Daily Maintenance')).toBeInTheDocument();
    expect(screen.getByText('Sync RiseWorks Accounts')).toBeInTheDocument();
    expect(screen.queryByText(/last run/i)).not.toBeInTheDocument();
  });

  it('triggers the first job after confirmation and shows the real result', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        jobId: 'daily-maintenance',
        result: { expiredCodes: { count: 3 } },
        triggeredAt: '2026-08-11T00:00:00.000Z',
      }),
    });

    render(<AdminSystemJobsPage />);

    const runButtons = screen.getAllByRole('button', { name: 'Run Now' });
    await user.click(runButtons[0]);

    const confirmButton = await screen.findByRole('button', {
      name: 'Run now',
    });
    await user.click(confirmButton);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/system/jobs/daily-maintenance/trigger',
        { method: 'POST' }
      )
    );
    await waitFor(() =>
      expect(screen.getByText(/Last triggered/)).toBeInTheDocument()
    );
  });

  it('shows the real error message when money-service rejects the trigger', async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: 'money-service unreachable' }),
    });

    render(<AdminSystemJobsPage />);

    const runButtons = screen.getAllByRole('button', { name: 'Run Now' });
    await user.click(runButtons[0]);
    const confirmButton = await screen.findByRole('button', {
      name: 'Run now',
    });
    await user.click(confirmButton);

    await waitFor(() =>
      expect(screen.getByText('money-service unreachable')).toBeInTheDocument()
    );
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /admin/system/outbox (B2-16)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('AdminSystemOutboxPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders real event counts by status and recent failure logs', async () => {
    mockGroupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 2 } },
      { status: 'FAILED', _count: { _all: 1 } },
    ]);
    mockOutboxFindMany.mockResolvedValue([
      {
        id: 'evt-1',
        eventType: 'TIER_UPGRADED',
        aggregateType: 'User',
        aggregateId: 'u1',
        attemptCount: 5,
        lastError: 'ECONNREFUSED',
        createdAt: new Date('2026-08-01'),
      },
    ]);
    mockOutboxCount.mockResolvedValue(3);

    const jsx = await AdminSystemOutboxPage();
    render(jsx);

    const pendingBadges = screen.getAllByText('PENDING');
    const pendingCard = pendingBadges[pendingBadges.length - 1]?.closest(
      '[data-slot="card"]'
    ) as HTMLElement;
    expect(within(pendingCard).getByText('2')).toBeInTheDocument();

    expect(screen.getByText('TIER_UPGRADED')).toBeInTheDocument();
    expect(screen.getByText('ECONNREFUSED')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Retry 1 Failed Events' })
    ).toBeInTheDocument();
  });

  it('shows an honest zero state with no retry action when nothing has failed', async () => {
    mockGroupBy.mockResolvedValue([
      { status: 'PENDING', _count: { _all: 0 } },
      { status: 'PROCESSED', _count: { _all: 0 } },
    ]);
    mockOutboxFindMany.mockResolvedValue([]);
    mockOutboxCount.mockResolvedValue(0);

    const jsx = await AdminSystemOutboxPage();
    render(jsx);

    expect(
      screen.getByText('No failed outbox events recorded.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Retry/ })
    ).not.toBeInTheDocument();
  });
});

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// /admin/system/config-history (B2-17)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('AdminSystemConfigHistoryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders real audit history rows', async () => {
    mockConfigFindMany.mockResolvedValue([
      {
        id: 'c1',
        configKey: 'DISBURSEMENT_PROVIDER',
        oldValue: 'RISE',
        newValue: 'WISE',
        changedBy: 'admin@example.com',
        reason: 'Provider migration',
        changedAt: new Date('2026-08-01'),
      },
    ]);

    const jsx = await AdminSystemConfigHistoryPage();
    render(jsx);

    expect(screen.getByText('DISBURSEMENT_PROVIDER')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('renders an honest empty state rather than fabricating audit rows', async () => {
    mockConfigFindMany.mockResolvedValue([]);

    const jsx = await AdminSystemConfigHistoryPage();
    render(jsx);

    expect(
      screen.getByText(/No config changes have been recorded yet/)
    ).toBeInTheDocument();
  });
});

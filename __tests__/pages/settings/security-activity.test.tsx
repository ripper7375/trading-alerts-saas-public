/**
 * Security Activity Page Tests
 *
 * Post-6-12 gap-matrix correction (A1-9/A2-12): `/settings/security/activity`
 * is the first-ever UI surface for `SecurityAlert` rows, which have had real
 * writers since Session 3-4 (password change, 2FA enable/disable, new-device
 * login) with no reader anywhere until now.
 *
 * @module __tests__/pages/settings/security-activity.test
 */

import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'authenticated' }),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/settings/security/activity',
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }): React.ReactElement {
    return <a href={href}>{children}</a>;
  };
});

import SecurityActivityPage from '@/app/settings/security/activity/page';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function makeAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alert-1',
    type: 'PASSWORD_CHANGED',
    title: 'Password changed',
    message: 'Your password was changed',
    ipAddress: '1.2.3.4',
    deviceInfo: 'Chrome on Windows',
    location: 'New York, NY, US',
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('SecurityActivityPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders the empty state when there are no alerts', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        alerts: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      })
    ) as unknown as typeof fetch;

    render(<SecurityActivityPage />);

    expect(
      await screen.findByText('No security activity yet')
    ).toBeInTheDocument();
  });

  it('renders alerts with type badge, device info, and location', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        alerts: [makeAlert()],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      })
    ) as unknown as typeof fetch;

    render(<SecurityActivityPage />);

    expect(await screen.findByText('Password changed')).toBeInTheDocument();
    expect(screen.getByText('Your password was changed')).toBeInTheDocument();
    expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    expect(screen.getByText('New York, NY, US')).toBeInTheDocument();
    expect(screen.getByText('Password Changed')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('does not show a "New" badge or Mark read button for an already-read alert', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        alerts: [makeAlert({ read: true, readAt: new Date().toISOString() })],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      })
    ) as unknown as typeof fetch;

    render(<SecurityActivityPage />);

    await screen.findByText('Password changed');
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('Mark read')).not.toBeInTheDocument();
  });

  it('marks an unread alert as read on click and removes the New badge', async () => {
    const user = userEvent.setup();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          alerts: [makeAlert()],
          pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          alreadyRead: false,
          message: 'Security alert marked as read',
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SecurityActivityPage />);

    await screen.findByText('Password changed');
    await user.click(screen.getByRole('button', { name: /mark read/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/user/security-alerts/alert-1/read',
        { method: 'POST' }
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('New')).not.toBeInTheDocument();
    });
  });

  it('loads more alerts, appending to the existing list', async () => {
    const user = userEvent.setup();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          alerts: [makeAlert({ id: 'alert-1', title: 'First alert' })],
          pagination: { total: 2, limit: 20, offset: 0, hasMore: true },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          alerts: [makeAlert({ id: 'alert-2', title: 'Second alert' })],
          pagination: { total: 2, limit: 20, offset: 20, hasMore: false },
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SecurityActivityPage />);

    await screen.findByText('First alert');
    await user.click(screen.getByRole('button', { name: /load more/i }));

    await screen.findByText('Second alert');
    expect(screen.getByText('First alert')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/user/security-alerts?limit=20&offset=20'
    );
  });

  it('shows an error state when the fetch fails', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(500, { error: 'boom' }));

    render(<SecurityActivityPage />);

    expect(
      await screen.findByText('Failed to load security activity')
    ).toBeInTheDocument();
  });

  it('links back to /settings/security', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        alerts: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      })
    ) as unknown as typeof fetch;

    render(<SecurityActivityPage />);

    await screen.findByText('No security activity yet');
    const backLink = screen.getByText('Back to Security Settings').closest('a');
    expect(backLink).toHaveAttribute('href', '/settings/security');
  });
});

/**
 * Security Settings Page -- Login History Pagination + Security Activity Link
 *
 * Post-6-12 gap-matrix correction (A1-9): `/settings/security` hardcoded
 * `?limit=20` with no way to see more -- the backend
 * (app/api/user/login-history/route.ts) has always supported offset-based
 * pagination up to 100, the page just never exposed it. Scoped to the two
 * things this ad-hoc session actually changed on this page (pagination +
 * the new "View All Activity" link); the page's much larger pre-existing
 * surface (2FA setup/disable/backup-codes, preferences) had zero test
 * coverage before this session and stays untouched/unverified here.
 *
 * @module __tests__/pages/settings/security-login-history-pagination.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'authenticated' }),
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

import SecuritySettingsPage from '@/app/settings/security/page';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function loginEntry(id: string) {
  return {
    id,
    status: 'SUCCESS',
    provider: 'credentials',
    device: 'Desktop',
    browser: 'Chrome',
    os: 'Windows',
    location: 'Unknown',
    ipAddress: '1.2.3.4',
    isNewDevice: false,
    createdAt: new Date().toISOString(),
  };
}

/** Routes every fetch call this page makes on mount to a sane default. */
function routeFetch(overrides: Record<string, () => Promise<Response>> = {}) {
  return jest.fn((url: string) => {
    for (const [pattern, handler] of Object.entries(overrides)) {
      if (url.includes(pattern)) return handler();
    }
    if (url.includes('/api/user/login-history')) {
      return Promise.resolve(
        jsonResponse(200, {
          history: [loginEntry('login-1')],
          pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
        })
      );
    }
    if (url.includes('/api/user/preferences')) {
      return Promise.resolve(jsonResponse(200, { preferences: {} }));
    }
    if (url.includes('/api/user/2fa/setup')) {
      return Promise.resolve(jsonResponse(200, { enabled: false }));
    }
    if (url.includes('/api/user/2fa/backup-codes')) {
      return Promise.resolve(jsonResponse(200, { remaining: 0 }));
    }
    return Promise.resolve(jsonResponse(200, {}));
  }) as unknown as typeof fetch;
}

describe('SecuritySettingsPage -- login history pagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a plain summary line, no Load more, when hasMore is false', async () => {
    global.fetch = routeFetch();
    render(<SecuritySettingsPage />);

    await screen.findByText(/1 login attempt/);
    expect(
      screen.queryByRole('button', { name: /load more/i })
    ).not.toBeInTheDocument();
  });

  it('shows a Load more button when hasMore is true, and appends on click', async () => {
    global.fetch = routeFetch({
      '/api/user/login-history': () => {
        const calls = (global.fetch as jest.Mock).mock.calls.length;
        // First call (offset=0) -> hasMore true; second call (offset=1, the
        // append) -> hasMore false, matching a real 2-page history.
        if (calls <= 1) {
          return Promise.resolve(
            jsonResponse(200, {
              history: [loginEntry('login-1')],
              pagination: { total: 2, limit: 20, offset: 0, hasMore: true },
            })
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            history: [loginEntry('login-2')],
            pagination: { total: 2, limit: 20, offset: 1, hasMore: false },
          })
        );
      },
    });

    const user = userEvent.setup();
    render(<SecuritySettingsPage />);

    const loadMoreButton = await screen.findByRole('button', {
      name: /load more/i,
    });
    await user.click(loadMoreButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=1')
      );
    });
    await screen.findByText(/2 login attempts/);
  });

  it('refresh button calls the API with offset=0, not a synthetic event as the offset', async () => {
    global.fetch = routeFetch();
    const user = userEvent.setup();
    render(<SecuritySettingsPage />);

    await screen.findByText(/1 login attempt/);
    (global.fetch as jest.Mock).mockClear();

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      const historyCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url]: [string]) => url.includes('/api/user/login-history')
      );
      expect(historyCalls[0][0]).toBe(
        '/api/user/login-history?limit=20&offset=0'
      );
    });
  });

  it('links "View All Activity" to /settings/security/activity', async () => {
    global.fetch = routeFetch();
    render(<SecuritySettingsPage />);

    await screen.findByText(/1 login attempt/);
    const link = screen.getByText('View All Activity').closest('a');
    expect(link).toHaveAttribute('href', '/settings/security/activity');
  });
});

/**
 * Account Settings Page Tests (server + pending-deletion banner)
 *
 * Session 6-5: verifies the new server/client split of
 * /settings/account -- unauthenticated redirect, the pending-deletion
 * banner sourced from a direct Prisma read (PENDING vs CONFIRMED copy),
 * session-based cancellation clearing the banner, and the real "Manage
 * 2FA" link replacing the former dummy toggle (Finding B, option a --
 * the real 2FA flows live on /settings/security).
 *
 * @module __tests__/pages/settings/account-settings-page.test
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
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

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  getSession: () => mockGetSession(),
}));

const mockFindFirst = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    accountDeletionRequest: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

import AccountSettingsPage from '@/app/settings/account/page';

function sessionsResponse(): Response {
  return {
    ok: true,
    json: async () => ({ sessions: [] }),
  } as Response;
}

describe('AccountSettingsPage (server component)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({ data: null });
    global.fetch = jest.fn(() =>
      Promise.resolve(sessionsResponse())
    ) as unknown as typeof fetch;
  });

  it('redirects unauthenticated callers to /login', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(AccountSettingsPage()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('renders with no pending-deletion banner when there is no active request', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue(null);

    const jsx = await AccountSettingsPage();
    render(jsx);

    expect(await screen.findByText('Account Settings')).toBeInTheDocument();
    expect(
      screen.queryByText('Account Deletion Pending')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Account Deletion Confirmed')
    ).not.toBeInTheDocument();
  });

  it('shows the PENDING banner (7-day link-expiry copy) with a working cancel button', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue({
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      confirmedAt: null,
    });
    const fetchMock = jest.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (
          url === '/api/user/account/deletion-cancel' &&
          init?.method === 'POST'
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              message:
                'Account deletion cancelled. Your account will not be deleted.',
            }),
          } as Response);
        }
        return Promise.resolve(sessionsResponse());
      }
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();

    const jsx = await AccountSettingsPage();
    render(jsx);

    expect(
      await screen.findByText('Account Deletion Pending')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Confirm via the link in your email/i)
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Cancel Deletion Request' })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/user/account/deletion-cancel',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({}) })
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByText('Account Deletion Pending')
      ).not.toBeInTheDocument();
    });
  });

  it('shows the CONFIRMED banner (24h execution-window copy)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue({
      status: 'CONFIRMED',
      expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      confirmedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    });

    const jsx = await AccountSettingsPage();
    render(jsx);

    expect(
      await screen.findByText('Account Deletion Confirmed')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/permanently deleted in about/i)
    ).toBeInTheDocument();
  });

  it('links "Manage 2FA" to /settings/security instead of a local dummy toggle', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue(null);

    const jsx = await AccountSettingsPage();
    render(jsx);

    const link = await screen.findByRole('link', { name: 'Manage 2FA' });
    expect(link).toHaveAttribute('href', '/settings/security');
    expect(screen.queryByText('Enable 2FA')).not.toBeInTheDocument();
    expect(screen.queryByText('Disable 2FA')).not.toBeInTheDocument();
  });

  it('sets the pending banner immediately from the deletion-request response, without a reload', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockFindFirst.mockResolvedValue(null);
    const fetchMock = jest.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (
          url === '/api/user/account/deletion-request' &&
          init?.method === 'POST'
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              message:
                'Deletion request created. Check your email for confirmation.',
              requestId: 'req-1',
              expiresAt: new Date(
                Date.now() + 7 * 24 * 60 * 60 * 1000
              ).toISOString(),
            }),
          } as Response);
        }
        return Promise.resolve(sessionsResponse());
      }
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();

    const jsx = await AccountSettingsPage();
    render(jsx);

    await user.click(screen.getByRole('button', { name: 'Delete Account' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByPlaceholderText('Type DELETE to confirm'),
      'DELETE'
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete Account' })
    );

    await waitFor(() => {
      expect(screen.getByText('Account Deletion Pending')).toBeInTheDocument();
    });
  });
});

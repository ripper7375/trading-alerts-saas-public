/**
 * Account Deletion Confirm/Cancel Page Tests
 *
 * Session 6-5: verifies the new /settings/account/delete/confirm and
 * /settings/account/delete/cancel pages -- the email-link destinations for
 * POST /api/user/account/deletion-confirm and .../deletion-cancel, both
 * live since Session 4B-11. Covers the human-in-the-loop confirm gate
 * (never auto-fires), the cancel page's auto-fire-on-mount (safe, since
 * cancelling is non-destructive), missing-token handling, and both
 * success/error response shapes.
 *
 * @module __tests__/pages/settings/account-deletion.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockGet = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
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

import DeleteConfirmPage from '@/app/(public)/settings/account/delete/confirm/page';
import DeleteCancelPage from '@/app/(public)/settings/account/delete/cancel/page';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('DeleteConfirmPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders an error card and never calls the API when the token is missing', async () => {
    mockGet.mockReturnValue(null);
    global.fetch = jest.fn() as unknown as typeof fetch;

    render(<DeleteConfirmPage />);

    expect(
      await screen.findByText('Invalid or Missing Token')
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not call deletion-confirm on mount -- only after an explicit click', async () => {
    mockGet.mockReturnValue('tok-1');
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DeleteConfirmPage />);

    expect(
      await screen.findByRole('button', { name: 'Confirm Account Deletion' })
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fires the confirm POST with the token on click and shows the 24h success message', async () => {
    mockGet.mockReturnValue('tok-1');
    const fetchMock = jest.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          success: true,
          message:
            'Account deletion confirmed. Your account will be deleted in 24 hours.',
          scheduledDeletionTime: '2026-08-12T00:00:00.000Z',
        })
      )
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const user = userEvent.setup();

    render(<DeleteConfirmPage />);
    await user.click(
      screen.getByRole('button', { name: 'Confirm Account Deletion' })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/user/account/deletion-confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'tok-1' }),
      })
    );
    expect(
      await screen.findByText('Account Scheduled for Deletion')
    ).toBeInTheDocument();
    expect(screen.getByText(/deleted in 24 hours/i)).toBeInTheDocument();
  });

  it('shows the real API error message when confirmation fails', async () => {
    mockGet.mockReturnValue('expired-tok');
    global.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse(400, {
          error: 'Token expired',
          message:
            'The deletion request has expired. Please submit a new request.',
        })
      )
    ) as unknown as typeof fetch;
    const user = userEvent.setup();

    render(<DeleteConfirmPage />);
    await user.click(
      screen.getByRole('button', { name: 'Confirm Account Deletion' })
    );

    expect(await screen.findByText('Confirmation Failed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The deletion request has expired. Please submit a new request.'
      )
    ).toBeInTheDocument();
  });
});

describe('DeleteCancelPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('auto-fires cancel with the URL token on mount and shows the success card', async () => {
    mockGet.mockReturnValue('tok-2');
    const fetchMock = jest.fn(() =>
      Promise.resolve(
        jsonResponse(200, {
          success: true,
          message:
            'Account deletion cancelled. Your account will not be deleted.',
        })
      )
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DeleteCancelPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/user/account/deletion-cancel',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'tok-2' }),
        })
      );
    });
    expect(
      await screen.findByText('Account Deletion Cancelled')
    ).toBeInTheDocument();
  });

  it('falls back to a session-based cancel (empty body) when no token is present', async () => {
    mockGet.mockReturnValue(null);
    const fetchMock = jest.fn(() =>
      Promise.resolve(jsonResponse(200, { success: true, message: 'ok' }))
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<DeleteCancelPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/user/account/deletion-cancel',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({}) })
      );
    });
    expect(
      await screen.findByText('Account Deletion Cancelled')
    ).toBeInTheDocument();
  });

  it('shows the real API error message when cancellation fails', async () => {
    mockGet.mockReturnValue(null);
    global.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse(401, {
          error: 'Unauthorized - provide token or be logged in',
        })
      )
    ) as unknown as typeof fetch;

    render(<DeleteCancelPage />);

    expect(await screen.findByText('Cancellation Failed')).toBeInTheDocument();
    expect(
      screen.getByText('Unauthorized - provide token or be logged in')
    ).toBeInTheDocument();
  });
});

/**
 * admin/login page bridge-path tests (Session 4B-21, DECISION-LOG.md F56/F57)
 *
 * Covers the new NEXT_PUBLIC_AUTH_BRIDGE_ENABLED-gated branch (calls
 * /api/auth/token-login, reads role from its response body, reverts via
 * token-logout on a non-admin role) and confirms the default (flag off)
 * path is unchanged.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSignIn = jest.fn();
const mockGetSession = jest.fn();
const mockSignOut = jest.fn();
jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  getSession: () => mockGetSession(),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

const mockIsAuthBridgeEnabled = jest.fn();
jest.mock('@/lib/auth/auth-bridge-flag', () => ({
  isAuthBridgeEnabled: () => mockIsAuthBridgeEnabled(),
}));

import AdminLoginPage from '@/app/admin/login/page';

async function fillAndSubmit(): Promise<void> {
  fireEvent.change(screen.getByPlaceholderText('Admin Email'), {
    target: { value: 'admin@example.com' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'Sup3r$ecret1' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Access Dashboard/i }));
}

describe('admin/login page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('calls signIn + getSession (unchanged behavior) when the bridge flag is off', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    mockSignIn.mockResolvedValue({ ok: true, error: null });
    mockGetSession.mockResolvedValue({ user: { role: 'ADMIN' } });

    render(<AdminLoginPage />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls token-login and redirects when the bridge flag is on and the user is an admin', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: '1', role: 'ADMIN' } }),
    });

    render(<AdminLoginPage />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/token-login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'admin@example.com',
            password: 'Sup3r$ecret1',
          }),
        })
      )
    );
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/admin/dashboard')
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('reverts via token-logout and shows an error when the bridge login succeeds but the user is not an admin', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: '1', role: 'USER' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    render(<AdminLoginPage />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        '/api/auth/token-logout',
        {
          method: 'POST',
        }
      )
    );
    await waitFor(() =>
      expect(
        screen.getByText(
          /Unauthorized: Access restricted to Administrators only\./i
        )
      ).toBeInTheDocument()
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows a generic invalid-credentials error on a bridge twoFactorRequired response', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ twoFactorRequired: true, token: 'tok-123' }),
    });

    render(<AdminLoginPage />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText(/Invalid admin credentials/i)).toBeInTheDocument()
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});

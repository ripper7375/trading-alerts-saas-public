/**
 * LoginForm bridge-path tests (Session 4B-20, DECISION-LOG.md F56)
 *
 * Covers the new NEXT_PUBLIC_AUTH_BRIDGE_ENABLED-gated branch (calls
 * /api/auth/token-login) and confirms the default (flag off) path is
 * unchanged — still calls next-auth/react's signIn('credentials', ...).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

const mockSignIn = jest.fn();
jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  getProviders: jest.fn().mockResolvedValue(null),
}));

const mockIsAuthBridgeEnabled = jest.fn();
jest.mock('@/lib/auth/auth-bridge-flag', () => ({
  isAuthBridgeEnabled: () => mockIsAuthBridgeEnabled(),
}));

import LoginForm from '@/components/auth/login-form';

async function fillAndSubmit(): Promise<void> {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'alice@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'Sup3r$ecret1' },
  });
  const submitButton = screen.getByRole('button', { name: 'Sign In' });
  await waitFor(() => expect(submitButton).not.toBeDisabled());
  fireEvent.click(submitButton);
}

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('calls next-auth/react signIn when the bridge flag is off (default, unchanged behavior)', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    mockSignIn.mockResolvedValue({ ok: true, error: null });

    render(<LoginForm />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: 'alice@example.com',
        password: 'Sup3r$ecret1',
        redirect: false,
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls token-login instead of signIn when the bridge flag is on', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: '1', email: 'alice@example.com' } }),
    });

    render(<LoginForm />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/token-login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'alice@example.com',
            password: 'Sup3r$ecret1',
          }),
        })
      )
    );
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('redirects to /verify-2fa when the bridge reports twoFactorRequired', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ twoFactorRequired: true, token: 'tok-123' }),
    });

    render(<LoginForm />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/verify-2fa?token=tok-123')
    );
  });

  it('shows the unverified error state on an EMAIL_NOT_VERIFIED bridge response', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'EMAIL_NOT_VERIFIED', message: 'nope' }),
    });

    render(<LoginForm />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText(/verify your email address/i)).toBeInTheDocument()
    );
  });

  it('shows the invalid-credentials error state on any other bridge error', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      }),
    });

    render(<LoginForm />);
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    );
  });
});

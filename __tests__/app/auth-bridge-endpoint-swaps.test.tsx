/**
 * Endpoint-swap bridge-path tests (Session 4B-21, DECISION-LOG.md F56)
 *
 * Covers forgot-password, reset-password, verify-email, and
 * verify-email/pending — none of these complete a login, so (unlike
 * login-form/verify-2fa/header/admin-login) they need no getSession()
 * refresh (Entry Criterion 1 doesn't apply). Each just swaps its fetch
 * endpoint to the matching token-* bridge route when the flag is on, and
 * is unchanged when it's off.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockGet = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
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

const mockIsAuthBridgeEnabled = jest.fn();
jest.mock('@/lib/auth/auth-bridge-flag', () => ({
  isAuthBridgeEnabled: () => mockIsAuthBridgeEnabled(),
}));

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import ResetPasswordPage from '@/app/(auth)/reset-password/page';
import VerifyEmailPage from '@/app/(auth)/verify-email/page';
import VerifyEmailPendingPage from '@/app/(auth)/verify-email/pending/page';

describe('auth bridge endpoint swaps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'ok' }),
    });
  });

  it('forgot-password: calls token-forgot-password when the bridge flag is on', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    mockGet.mockReturnValue(null);

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'alice@example.com' },
    });
    const button = screen.getByRole('button', { name: /Send Reset Link/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/token-forgot-password',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('forgot-password: calls the legacy endpoint (unchanged) when the bridge flag is off', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    mockGet.mockReturnValue(null);

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: 'alice@example.com' },
    });
    const button = screen.getByRole('button', { name: /Send Reset Link/i });
    await waitFor(() => expect(button).not.toBeDisabled());
    fireEvent.click(button);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/forgot-password',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('reset-password: calls token-reset-password when the bridge flag is on', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    mockGet.mockReturnValue('reset-token-abc');

    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('New Password'), {
      target: { value: 'Sup3r$ecret1!' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm New Password'), {
      target: { value: 'Sup3r$ecret1!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Reset Password/i }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/token-reset-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            token: 'reset-token-abc',
            password: 'Sup3r$ecret1!',
          }),
        })
      )
    );
  });

  it('verify-email: calls token-verify-email when the bridge flag is on', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    mockGet.mockReturnValue('verify-token-abc');

    render(<VerifyEmailPage />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/token-verify-email?token=verify-token-abc'
      )
    );
  });

  it('verify-email: calls the legacy endpoint (unchanged) when the bridge flag is off', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    mockGet.mockReturnValue('verify-token-abc');

    render(<VerifyEmailPage />);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/verify-email?token=verify-token-abc'
      )
    );
  });

  it('verify-email/pending: calls token-resend-verification when the bridge flag is on', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    mockGet.mockReturnValue('alice%40example.com');

    render(<VerifyEmailPendingPage />);
    fireEvent.click(
      screen.getByRole('button', { name: /Resend verification email/i })
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/token-resend-verification',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });
});

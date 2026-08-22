/**
 * verify-2fa page bridge-path tests (Session 4B-21, DECISION-LOG.md F56/F57)
 *
 * Covers the new NEXT_PUBLIC_AUTH_BRIDGE_ENABLED-gated login-completion
 * branch (calls /api/auth/token-login with the '__2fa_verified__' sentinel
 * instead of next-auth/react's signIn) and confirms the default (flag off)
 * path is unchanged.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockGet = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
  // LocaleProvider (now mounted via withLocale() below) calls usePathname()
  // -- Session 9-2's own public-pages.test.tsx established this same stub.
  usePathname: () => '/',
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
const mockGetSession = jest.fn();
jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  getSession: () => mockGetSession(),
}));

const mockIsAuthBridgeEnabled = jest.fn();
jest.mock('@/lib/auth/auth-bridge-flag', () => ({
  isAuthBridgeEnabled: () => mockIsAuthBridgeEnabled(),
}));

import TwoFactorVerificationPage from '@/app/(auth)/verify-2fa/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

// The verify-2fa page now calls useLocale() (Session 9-3) -- needs a
// LocaleProvider ancestor. Pre-seed localStorage with a known preference so
// LocaleProvider's first-visit branch never fires its real geo-IP fetch()
// (LESSONS-LEARNED.md L40) -- this file's own tests assert an exact
// global.fetch call count (only /api/user/2fa/verify), which a stray
// LocaleProvider fetch would break.
function withLocale(ui: React.ReactElement) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function typeCode(): void {
  const inputs = screen.getAllByLabelText(/^Digit \d$/);
  const code = ['1', '2', '3', '4', '5', '6'];
  inputs.forEach((input, i) => {
    fireEvent.change(input, { target: { value: code[i] } });
  });
}

describe('verify-2fa page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockGet.mockReturnValue('login-token-abc');
    mockGetSession.mockResolvedValue(null);
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('calls signIn (unchanged behavior) when the bridge flag is off', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, verified: true, method: 'totp' }),
    });
    mockSignIn.mockResolvedValue({ ok: true, error: null });

    render(withLocale(<TwoFactorVerificationPage />));
    typeCode();

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: '__2fa_verified__',
        password: 'login-token-abc',
        redirect: false,
      })
    );
    expect(global.fetch).toHaveBeenCalledTimes(1); // only /api/user/2fa/verify
  });

  it('calls token-login instead of signIn when the bridge flag is on, then refreshes the session', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, verified: true, method: 'totp' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: '1', role: 'USER' } }),
      });

    render(withLocale(<TwoFactorVerificationPage />));
    typeCode();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        '/api/auth/token-login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: '__2fa_verified__',
            password: 'login-token-abc',
          }),
        })
      )
    );
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});

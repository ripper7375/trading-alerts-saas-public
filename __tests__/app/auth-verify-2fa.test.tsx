/**
 * verify-2fa page bridge-path tests (Session 4B-21, DECISION-LOG.md F56/F57)
 *
 * Covers the new NEXT_PUBLIC_AUTH_BRIDGE_ENABLED-gated login-completion
 * branch (calls /api/auth/token-login with the '__2fa_verified__' sentinel
 * instead of next-auth/react's signIn) and confirms the default (flag off)
 * path is unchanged.
 *
 * CODE-01A: the page posts the one-use COMPLETION token the verify step
 * returns, never the challenge from the URL, and it shows success only when
 * the sign-in itself succeeded.
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

// Post-2FA landing is a full page load, not a router push -- see
// lib/auth/post-login-navigation.ts.
const mockNavigateAfterLogin = jest.fn();
jest.mock('@/lib/auth/post-login-navigation', () => ({
  navigateAfterLogin: (destination: string) =>
    mockNavigateAfterLogin(destination),
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

/** What POST /api/user/2fa/verify answers once the code was right. */
const VERIFIED_BODY = {
  success: true,
  verified: true,
  method: 'totp',
  completionToken: 'completion-token-xyz',
};

/** The page navigates 1.5 s after a successful sign-in. */
const NAVIGATION_DELAY_MS = 1500;

describe('verify-2fa page', () => {
  // A test that ends in success leaves that 1.5 s navigation timer running; it would fire during a
  // later test and fake a navigation there. Each test clears the ones it started.
  const navigationTimers: ReturnType<typeof setTimeout>[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockGet.mockReturnValue('login-token-abc');
    mockGetSession.mockResolvedValue(null);
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    const realSetTimeout = global.setTimeout;
    jest.spyOn(global, 'setTimeout').mockImplementation(((
      handler: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      const id = realSetTimeout(handler as () => void, delay, ...args);
      if (delay === NAVIGATION_DELAY_MS) navigationTimers.push(id);
      return id;
    }) as unknown as typeof setTimeout);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    navigationTimers.splice(0).forEach((id) => clearTimeout(id));
  });

  it('calls signIn with the completion token (not the challenge) when the bridge flag is off', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => VERIFIED_BODY,
    });
    mockSignIn.mockResolvedValue({ ok: true, error: null });

    render(withLocale(<TwoFactorVerificationPage />));
    typeCode();

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: '__2fa_verified__',
        password: 'completion-token-xyz',
        redirect: false,
      })
    );
    expect(global.fetch).toHaveBeenCalledTimes(1); // only /api/user/2fa/verify
    // The challenge from the URL went to the verify step and nowhere else.
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/user/2fa/verify',
      expect.objectContaining({
        body: JSON.stringify({ code: '123456', token: 'login-token-abc' }),
      })
    );
  });

  it('calls token-login with the completion token instead of signIn when the bridge flag is on, then refreshes the session', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => VERIFIED_BODY,
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
            password: 'completion-token-xyz',
          }),
        })
      )
    );
    await waitFor(() => expect(mockGetSession).toHaveBeenCalled());
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('shows an error and does not navigate when NextAuth refuses the sign-in', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => VERIFIED_BODY,
    });
    mockSignIn.mockResolvedValue({ ok: false, error: 'INVALID_CREDENTIALS' });

    render(withLocale(<TwoFactorVerificationPage />));
    typeCode();

    expect(
      await screen.findByText('Session expired. Please log in again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Verified!')).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(mockNavigateAfterLogin).not.toHaveBeenCalled();
  });

  it('shows an error and does not navigate when the bridge sign-in is refused', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => VERIFIED_BODY,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'INVALID_CREDENTIALS' }),
      });

    render(withLocale(<TwoFactorVerificationPage />));
    typeCode();

    expect(
      await screen.findByText('Session expired. Please log in again.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Verified!')).not.toBeInTheDocument();
    expect(mockGetSession).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(mockNavigateAfterLogin).not.toHaveBeenCalled();
  });

  it.each([[false], [true]])(
    'shows an error and signs nobody in when the verify answer carries no completion token (bridge %s)',
    async (bridge) => {
      mockIsAuthBridgeEnabled.mockReturnValue(bridge);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, verified: true, method: 'totp' }),
      });

      render(withLocale(<TwoFactorVerificationPage />));
      typeCode();

      expect(
        await screen.findByText('Something went wrong. Please try again.')
      ).toBeInTheDocument();
      expect(mockSignIn).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1); // no token-login call either
      expect(screen.queryByText('Verified!')).not.toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 1700));
      expect(mockNavigateAfterLogin).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['a safe callbackUrl forwarded by the login form', '/alerts', '/alerts'],
    ['an off-site callbackUrl', 'https://evil.example/', '/dashboard'],
    ['no callbackUrl', null, '/dashboard'],
  ])(
    'lands on the right page for %s',
    async (_label, callbackUrl, expected) => {
      mockGet.mockImplementation((key: string) =>
        key === 'token'
          ? 'login-token-abc'
          : key === 'callbackUrl'
            ? callbackUrl
            : null
      );
      mockIsAuthBridgeEnabled.mockReturnValue(false);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => VERIFIED_BODY,
      });
      mockSignIn.mockResolvedValue({ ok: true, error: null });

      render(withLocale(<TwoFactorVerificationPage />));
      typeCode();

      await waitFor(
        () => expect(mockNavigateAfterLogin).toHaveBeenCalledWith(expected),
        { timeout: 3000 }
      );
      expect(mockPush).not.toHaveBeenCalled();
    }
  );
});

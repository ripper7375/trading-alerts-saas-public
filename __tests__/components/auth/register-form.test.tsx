/**
 * RegisterForm bridge-path tests (Session 4B-20, DECISION-LOG.md F56)
 *
 * Covers the new NEXT_PUBLIC_AUTH_BRIDGE_ENABLED-gated endpoint switch
 * (/api/auth/token-register vs. the monolith's own /api/auth/register) and
 * confirms the default (flag off) path is unchanged.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
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

jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
  getProviders: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    discountPercent: 20,
    regularPrice: 29,
    calculateDiscountedPrice: (price: number) => price * 0.8,
  }),
}));

const mockIsAuthBridgeEnabled = jest.fn();
jest.mock('@/lib/auth/auth-bridge-flag', () => ({
  isAuthBridgeEnabled: () => mockIsAuthBridgeEnabled(),
}));

import RegisterForm from '@/components/auth/register-form';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

// RegisterForm now calls useLocale() (Session 9-3) -- needs a LocaleProvider
// ancestor. Pre-seed localStorage with a known preference so
// LocaleProvider's first-visit branch never fires its real geo-IP fetch()
// (LESSONS-LEARNED.md L40) -- this file's own tests assert exact
// global.fetch call counts/args for the auth-bridge endpoints.
function withLocale(ui: React.ReactElement) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

async function fillAndSubmit(): Promise<void> {
  fireEvent.change(screen.getByLabelText(/full name/i), {
    target: { value: 'Alice Trader' },
  });
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'alice@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'Sup3r$ecret1' },
  });
  fireEvent.change(screen.getByLabelText(/confirm password/i), {
    target: { value: 'Sup3r$ecret1' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
  const submitButton = screen.getByRole('button', { name: /create account/i });
  await waitFor(() => expect(submitButton).not.toBeDisabled());
  fireEvent.click(submitButton);
}

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('posts to /api/auth/register when the bridge flag is off (default, unchanged behavior)', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        userId: 'u1',
        message: 'ok',
        autoVerified: false,
      }),
    });

    render(withLocale(<RegisterForm />));
    await fillAndSubmit();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('posts to /api/auth/token-register when the bridge flag is on', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        userId: 'u1',
        message: 'ok',
        autoVerified: false,
      }),
    });

    render(withLocale(<RegisterForm />));
    await fillAndSubmit();

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/token-register',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('redirects to the verify-email pending page on success, regardless of the flag', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        userId: 'u1',
        message: 'ok',
        autoVerified: false,
      }),
    });

    render(withLocale(<RegisterForm />));
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/verify-email/pending?email=alice%40example.com'
      )
    );
  });

  it('shows the account-exists error on a 409 bridge response', async () => {
    mockIsAuthBridgeEnabled.mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'ACCOUNT_EXISTS', message: 'exists' }),
    });

    render(withLocale(<RegisterForm />));
    await fillAndSubmit();

    await waitFor(() =>
      expect(
        screen.getByText(/account with this email already exists/i)
      ).toBeInTheDocument()
    );
  });

  // Session 6-12 a11y audit: both password-visibility toggles were
  // icon-only with no accessible name.
  it('exposes accessibly-named password and confirm-password visibility toggles', () => {
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    render(withLocale(<RegisterForm />));

    expect(
      screen.getByRole('button', { name: 'Show password' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show password confirmation' })
    ).toBeInTheDocument();
  });
});

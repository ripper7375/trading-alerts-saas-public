/**
 * LoginForm and the Turnstile challenge (CODE-15).
 *
 * With a site key the form shows the widget, keeps "Sign In" disabled until the widget has handed
 * it a token, sends the token with the credentials (NextAuth `signIn` or the bridge's
 * `token-login`), starts a fresh widget after EVERY attempt (a token is single use) and shows the
 * existing translated message when the server answers TURNSTILE_FAILED. Without a site key the
 * form is exactly what it was.
 */
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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
  getProviders: jest.fn().mockResolvedValue(null),
}));

const mockIsAuthBridgeEnabled = jest.fn();
jest.mock('@/lib/auth/auth-bridge-flag', () => ({
  isAuthBridgeEnabled: () => mockIsAuthBridgeEnabled(),
}));

jest.mock('@/lib/auth/post-login-navigation', () => ({
  navigateAfterLogin: jest.fn(),
}));

import LoginForm from '@/components/auth/login-form';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

import {
  TURNSTILE_TEST_SITE_KEY,
  installFakeTurnstile,
  setTurnstileSiteKey,
  uninstallFakeTurnstile,
  type FakeTurnstile,
} from '../../helpers/fake-turnstile';

function withLocale(ui: React.ReactElement): React.ReactElement {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function fillCredentials(): void {
  fireEvent.change(screen.getByLabelText(/email address/i), {
    target: { value: 'alice@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^password$/i), {
    target: { value: 'Sup3r$ecret1' },
  });
}

const signInButton = (): HTMLElement =>
  screen.getByRole('button', { name: 'Sign In' });

const FAILED_MESSAGE = 'Security check failed. Please try again.';

describe('LoginForm: Turnstile', () => {
  let savedKey: string | undefined;
  let fake: FakeTurnstile;

  beforeAll(() => {
    savedKey = process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockGetSession.mockResolvedValue(null);
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    uninstallFakeTurnstile();
    fake = installFakeTurnstile();
    setTurnstileSiteKey(TURNSTILE_TEST_SITE_KEY);
  });

  afterEach(() => {
    uninstallFakeTurnstile();
  });

  afterAll(() => {
    setTurnstileSiteKey(savedKey);
  });

  describe('with a site key (NextAuth path)', () => {
    it('shows the widget and keeps Sign In disabled until it has a token', async () => {
      render(withLocale(<LoginForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalledTimes(1));
      expect(fake.api.render.mock.calls[0]?.[1]).toMatchObject({
        sitekey: TURNSTILE_TEST_SITE_KEY,
      });

      fillCredentials();
      await act(async () => {});

      expect(signInButton()).toBeDisabled();
      fireEvent.click(signInButton());
      expect(mockSignIn).not.toHaveBeenCalled();

      fake.solve('cf-token-1');
      await waitFor(() => expect(signInButton()).not.toBeDisabled());
    });

    it('sends the token with the credentials', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });
      render(withLocale(<LoginForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillCredentials();
      fake.solve('cf-token-1');
      await waitFor(() => expect(signInButton()).not.toBeDisabled());

      fireEvent.click(signInButton());

      await waitFor(() =>
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          email: 'alice@example.com',
          password: 'Sup3r$ecret1',
          turnstileToken: 'cf-token-1',
          redirect: false,
        })
      );
    });

    it('starts a fresh widget after a failed attempt and never sends the same token twice', async () => {
      mockSignIn.mockResolvedValue({ ok: false, error: 'INVALID_CREDENTIALS' });
      render(withLocale(<LoginForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillCredentials();
      fake.solve('cf-token-1');
      await waitFor(() => expect(signInButton()).not.toBeDisabled());

      fireEvent.click(signInButton());
      await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(1));

      await waitFor(() => expect(fake.widgets).toHaveLength(2));
      expect(fake.api.remove).toHaveBeenCalledWith('widget-1');
      expect(fake.live().map((w) => w.id)).toEqual(['widget-2']);
      await waitFor(() => expect(signInButton()).toBeDisabled());

      fake.solve('cf-token-2');
      await waitFor(() => expect(signInButton()).not.toBeDisabled());
      fireEvent.click(signInButton());

      await waitFor(() => expect(mockSignIn).toHaveBeenCalledTimes(2));
      expect(mockSignIn.mock.calls[1]?.[1]).toMatchObject({
        turnstileToken: 'cf-token-2',
      });
    });

    it('shows the security-check message when the server answers TURNSTILE_FAILED', async () => {
      mockSignIn.mockResolvedValue({ ok: false, error: 'TURNSTILE_FAILED' });
      render(withLocale(<LoginForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillCredentials();
      fake.solve('cf-token-1');
      await waitFor(() => expect(signInButton()).not.toBeDisabled());

      fireEvent.click(signInButton());

      expect(await screen.findByText(FAILED_MESSAGE)).toBeTruthy();
      expect(
        screen.queryByText('Invalid email or password. Please try again.')
      ).toBeNull();
    });

    it('does not show the security-check message for a wrong password', async () => {
      mockSignIn.mockResolvedValue({ ok: false, error: 'INVALID_CREDENTIALS' });
      render(withLocale(<LoginForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillCredentials();
      fake.solve('cf-token-1');
      await waitFor(() => expect(signInButton()).not.toBeDisabled());

      fireEvent.click(signInButton());

      expect(
        await screen.findByText('Invalid email or password. Please try again.')
      ).toBeTruthy();
      expect(screen.queryByText(FAILED_MESSAGE)).toBeNull();
    });
  });

  describe('with a site key (bridge path)', () => {
    beforeEach(() => {
      mockIsAuthBridgeEnabled.mockReturnValue(true);
    });

    it('sends the token in the body of token-login', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: '1' } }),
      });
      render(withLocale(<LoginForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillCredentials();
      fake.solve('cf-token-1');
      await waitFor(() => expect(signInButton()).not.toBeDisabled());

      fireEvent.click(signInButton());

      await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/token-login',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              email: 'alice@example.com',
              password: 'Sup3r$ecret1',
              turnstileToken: 'cf-token-1',
            }),
          })
        )
      );
      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('shows the security-check message when token-login answers TURNSTILE_FAILED', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'TURNSTILE_FAILED' }),
      });
      render(withLocale(<LoginForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillCredentials();
      fake.solve('cf-token-1');
      await waitFor(() => expect(signInButton()).not.toBeDisabled());

      fireEvent.click(signInButton());

      expect(await screen.findByText(FAILED_MESSAGE)).toBeTruthy();
      await waitFor(() => expect(fake.widgets).toHaveLength(2));
    });
  });

  describe('without a site key (local development)', () => {
    beforeEach(() => {
      setTurnstileSiteKey(undefined);
    });

    it('shows no widget, needs no token and signs in with the plain credentials', async () => {
      mockSignIn.mockResolvedValue({ ok: true, error: null });
      render(withLocale(<LoginForm />));
      fillCredentials();
      await waitFor(() => expect(signInButton()).not.toBeDisabled());

      fireEvent.click(signInButton());

      await waitFor(() =>
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          email: 'alice@example.com',
          password: 'Sup3r$ecret1',
          redirect: false,
        })
      );
      expect(Object.keys(mockSignIn.mock.calls[0]?.[1] ?? {})).not.toContain(
        'turnstileToken'
      );
      expect(fake.api.render).not.toHaveBeenCalled();
      expect(
        document.querySelectorAll(
          'script[src^="https://challenges.cloudflare"]'
        )
      ).toHaveLength(0);
    });
  });
});

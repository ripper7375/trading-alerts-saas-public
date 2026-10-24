/**
 * The forgot-password form and the Turnstile challenge (CODE-15).
 *
 * With a site key the form shows the widget, keeps "Send Reset Link" disabled until the widget
 * has handed it a token, sends the token with the address, starts a fresh widget after every
 * attempt (a token is single use) and shows the translated security-check message when the
 * server answers 400 TURNSTILE_FAILED. Without a site key the request is what it was.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockGet = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
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

const mockIsAuthBridgeEnabled = jest.fn();
jest.mock('@/lib/auth/auth-bridge-flag', () => ({
  isAuthBridgeEnabled: () => mockIsAuthBridgeEnabled(),
}));

import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
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

function fillEmail(): void {
  fireEvent.change(screen.getByLabelText(/Email Address/i), {
    target: { value: 'alice@example.com' },
  });
}

const sendButton = (): HTMLElement =>
  screen.getByRole('button', { name: /Send Reset Link/i });

const FAILED_MESSAGE = 'Security check failed. Please try again.';

describe('Forgot password: Turnstile', () => {
  let savedKey: string | undefined;
  let fake: FakeTurnstile;

  beforeAll(() => {
    savedKey = process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(null);
    mockIsAuthBridgeEnabled.mockReturnValue(false);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'ok' }),
    });
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

  describe('with a site key', () => {
    it('shows the widget and keeps Send Reset Link disabled until it has a token', async () => {
      render(withLocale(<ForgotPasswordPage />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalledTimes(1));
      expect(fake.api.render.mock.calls[0]?.[1]).toMatchObject({
        sitekey: TURNSTILE_TEST_SITE_KEY,
      });

      fillEmail();
      await waitFor(() => expect(sendButton()).toBeDisabled());
      fireEvent.click(sendButton());
      expect(global.fetch).not.toHaveBeenCalled();

      fake.solve('cf-token-1');
      await waitFor(() => expect(sendButton()).not.toBeDisabled());
    });

    it.each([
      [
        'token-forgot-password (bridge on)',
        true,
        '/api/auth/token-forgot-password',
      ],
      ['the monolith route (bridge off)', false, '/api/auth/forgot-password'],
    ])(
      'sends the token with the address to %s',
      async (_label, bridge, endpoint) => {
        mockIsAuthBridgeEnabled.mockReturnValue(bridge);
        render(withLocale(<ForgotPasswordPage />));
        await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
        fillEmail();
        fake.solve('cf-token-1');
        await waitFor(() => expect(sendButton()).not.toBeDisabled());

        fireEvent.click(sendButton());

        await waitFor(() =>
          expect(global.fetch).toHaveBeenCalledWith(
            endpoint,
            expect.objectContaining({
              method: 'POST',
              body: JSON.stringify({
                email: 'alice@example.com',
                turnstileToken: 'cf-token-1',
              }),
            })
          )
        );
      }
    );

    it('shows the translated security-check message on 400 TURNSTILE_FAILED and starts a fresh widget', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'TURNSTILE_FAILED' }),
      });
      render(withLocale(<ForgotPasswordPage />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillEmail();
      fake.solve('cf-token-1');
      await waitFor(() => expect(sendButton()).not.toBeDisabled());

      fireEvent.click(sendButton());

      expect(await screen.findByText(FAILED_MESSAGE)).toBeTruthy();
      expect(
        screen.queryByText('Something went wrong. Please try again later.')
      ).toBeNull();
      await waitFor(() => expect(fake.widgets).toHaveLength(2));
      expect(fake.api.remove).toHaveBeenCalledWith('widget-1');
      await waitFor(() => expect(sendButton()).toBeDisabled());
    });

    it('keeps the generic server message for any other failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      });
      render(withLocale(<ForgotPasswordPage />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillEmail();
      fake.solve('cf-token-1');
      await waitFor(() => expect(sendButton()).not.toBeDisabled());

      fireEvent.click(sendButton());

      expect(
        await screen.findByText('Something went wrong. Please try again later.')
      ).toBeTruthy();
      expect(screen.queryByText(FAILED_MESSAGE)).toBeNull();
    });

    it('only a 400 counts as the security check: a 500 that carries the same code is the generic server message', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'TURNSTILE_FAILED' }),
      });
      render(withLocale(<ForgotPasswordPage />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillEmail();
      fake.solve('cf-token-1');
      await waitFor(() => expect(sendButton()).not.toBeDisabled());

      fireEvent.click(sendButton());

      expect(
        await screen.findByText('Something went wrong. Please try again later.')
      ).toBeTruthy();
      expect(screen.queryByText(FAILED_MESSAGE)).toBeNull();
    });

    it('still reaches the confirmation step on success', async () => {
      render(withLocale(<ForgotPasswordPage />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillEmail();
      fake.solve('cf-token-1');
      await waitFor(() => expect(sendButton()).not.toBeDisabled());

      fireEvent.click(sendButton());

      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: /Send Reset Link/i })
        ).toBeNull()
      );
    });
  });

  describe('without a site key (local development)', () => {
    it('shows no widget and sends the address alone', async () => {
      setTurnstileSiteKey(undefined);
      render(withLocale(<ForgotPasswordPage />));
      fillEmail();
      await waitFor(() => expect(sendButton()).not.toBeDisabled());

      fireEvent.click(sendButton());

      await waitFor(() =>
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/forgot-password',
          expect.objectContaining({
            body: JSON.stringify({ email: 'alice@example.com' }),
          })
        )
      );
      expect(fake.api.render).not.toHaveBeenCalled();
    });
  });
});

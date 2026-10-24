/**
 * RegisterForm and the Turnstile challenge (CODE-15).
 *
 * With a site key the form shows the widget, keeps "Create Account" disabled until the widget has
 * handed it a token, sends the token in the registration request, starts a fresh widget after
 * every attempt (a token is single use) and shows the translated security-check message instead
 * of the raw error code when the server answers TURNSTILE_FAILED. Without a site key the request
 * is what it was.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
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

function fillForm(): void {
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
}

const createButton = (): HTMLElement =>
  screen.getByRole('button', { name: /create account/i });

function sentBody(): Record<string, unknown> {
  const init = (global.fetch as jest.Mock).mock.calls[0]?.[1] as {
    body: string;
  };
  return JSON.parse(init.body) as Record<string, unknown>;
}

const FAILED_MESSAGE = 'Security check failed. Please try again.';

describe('RegisterForm: Turnstile', () => {
  let savedKey: string | undefined;
  let fake: FakeTurnstile;

  beforeAll(() => {
    savedKey = process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockIsAuthBridgeEnabled.mockReturnValue(true);
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
    it('shows the widget and keeps Create Account disabled until it has a token', async () => {
      render(withLocale(<RegisterForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalledTimes(1));
      expect(fake.api.render.mock.calls[0]?.[1]).toMatchObject({
        sitekey: TURNSTILE_TEST_SITE_KEY,
      });

      fillForm();
      await waitFor(() => expect(createButton()).toBeDisabled());
      fireEvent.click(createButton());
      expect(global.fetch).not.toHaveBeenCalled();

      fake.solve('cf-token-1');
      await waitFor(() => expect(createButton()).not.toBeDisabled());
    });

    it.each([
      ['token-register (bridge on)', true, '/api/auth/token-register'],
      ['the legacy endpoint (bridge off)', false, '/api/auth/register'],
    ])(
      'sends the token in the request to %s',
      async (_label, bridge, endpoint) => {
        mockIsAuthBridgeEnabled.mockReturnValue(bridge);
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({ success: true }),
        });
        render(withLocale(<RegisterForm />));
        await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
        fillForm();
        fake.solve('cf-token-1');
        await waitFor(() => expect(createButton()).not.toBeDisabled());

        fireEvent.click(createButton());

        await waitFor(() =>
          expect(global.fetch).toHaveBeenCalledWith(
            endpoint,
            expect.objectContaining({ method: 'POST' })
          )
        );
        expect(sentBody()).toMatchObject({
          email: 'alice@example.com',
          turnstileToken: 'cf-token-1',
        });
      }
    );

    it('starts a fresh widget after an attempt that failed, and needs a new token', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'EMAIL_EXISTS' }),
      });
      render(withLocale(<RegisterForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillForm();
      fake.solve('cf-token-1');
      await waitFor(() => expect(createButton()).not.toBeDisabled());

      fireEvent.click(createButton());
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

      await waitFor(() => expect(fake.widgets).toHaveLength(2));
      expect(fake.api.remove).toHaveBeenCalledWith('widget-1');
      await waitFor(() => expect(createButton()).toBeDisabled());

      fake.solve('cf-token-2');
      await waitFor(() => expect(createButton()).not.toBeDisabled());
      fireEvent.click(createButton());
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
      const second = (global.fetch as jest.Mock).mock.calls[1]?.[1] as {
        body: string;
      };
      expect(JSON.parse(second.body)).toMatchObject({
        turnstileToken: 'cf-token-2',
      });
    });

    it('shows the translated security-check message, not the raw code, on TURNSTILE_FAILED', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'TURNSTILE_FAILED',
          message: 'Security check failed',
        }),
      });
      render(withLocale(<RegisterForm />));
      await waitFor(() => expect(fake.api.render).toHaveBeenCalled());
      fillForm();
      fake.solve('cf-token-1');
      await waitFor(() => expect(createButton()).not.toBeDisabled());

      fireEvent.click(createButton());

      expect(await screen.findByText(FAILED_MESSAGE)).toBeTruthy();
      expect(screen.queryByText('TURNSTILE_FAILED')).toBeNull();
    });
  });

  describe('without a site key (local development)', () => {
    it('shows no widget and sends the request without a token', async () => {
      setTurnstileSiteKey(undefined);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ success: true }),
      });
      render(withLocale(<RegisterForm />));
      fillForm();
      await waitFor(() => expect(createButton()).not.toBeDisabled());

      fireEvent.click(createButton());

      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      expect(Object.keys(sentBody())).not.toContain('turnstileToken');
      expect(fake.api.render).not.toHaveBeenCalled();
    });
  });
});

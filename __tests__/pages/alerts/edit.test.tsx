/**
 * Alert Edit Route Tests
 *
 * Session 6-3 (A2-4): verifies the new /alerts/[id]/edit page renders the
 * real alert via a direct Prisma read (matching /alerts/page.tsx's own
 * server-component convention), gates FREE tier behind the PRO-upgrade
 * landing, 404s on a missing/not-owned alert, and that EditAlertClient
 * submits real changes via PATCH /api/alerts/[id].
 *
 * @module __tests__/pages/alerts/edit.test
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// EditAlertPage now resolves a dictionary via getServerLanguage() (batch-3
// locale wiring), which calls next/headers's cookies()/headers() -- these
// aren't available when a Server Component is invoked directly as a plain
// function in a test (no real Next.js request scope). Mock both to no-op
// cookie/header stores so resolvePreferences() falls back to its own
// defaultPreferences (matches this file's existing English-text
// assertions either way).
const mockCookieStore = { get: jest.fn(() => undefined) };
const mockHeaderStore = { get: jest.fn(() => undefined) };
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
  headers: jest.fn(() => Promise.resolve(mockHeaderStore)),
}));

import EditAlertPage from '@/app/alerts/[id]/edit/page';
import { EditAlertClient } from '@/app/alerts/[id]/edit/edit-alert-client';
import type { AlertFormData } from '@/components/alerts/alert-form';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  // Session 9-4: EditAlertPage now mounts AppHeader, which calls
  // usePathname() directly, and LocaleProvider (wrapped below) needs its
  // own usePathname() too -- LESSONS-LEARNED.md L40's own stub.
  usePathname: () => '/alerts/alert-1/edit',
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

// AppHeader calls useLocale() -- needs a LocaleProvider ancestor. Pre-seed
// localStorage with a known preference so LocaleProvider's first-visit
// branch never fires its real geo-IP fetch() (LESSONS-LEARNED.md L40) --
// this file's own mockTierFetches() rejects any unexpected fetch URL.
function withLocale(ui: React.ReactElement): React.ReactElement {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  getSession: () => mockGetSession(),
}));

// AppHeader (mounted by EditAlertPage, Session 9-4) calls useSession() for
// real user identity/tier and getSession()/signOut() inside its logout
// handler -- not exercised by these tests, stubbed so the real
// next-auth/react module (and its own fetch('/api/auth/session')) never
// loads.
const mockUseSession = jest.fn(() => ({
  data: null,
  status: 'unauthenticated',
}));
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  getSession: jest.fn(),
  signOut: jest.fn(),
}));

const mockFindUnique = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    alert: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

const realAlert = {
  id: 'alert-1',
  userId: 'user-1',
  name: 'Gold breakout',
  symbol: 'XAUUSD',
  timeframe: 'M5',
  condition: JSON.stringify({ type: 'price_above', targetValue: 2500 }),
};

/** Resolves the 3 tier endpoints AlertForm self-fetches, plus an optional PATCH mock. */
function mockTierFetches(patchImpl?: () => Promise<Response>): void {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === '/api/tier/symbols') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, symbols: ['XAUUSD'] }),
      } as Response);
    }
    if (url === '/api/tier/combinations') {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          timeframes: [
            { value: 'M5', label: '5 Minutes', proOnly: false },
            { value: 'M15', label: '15 Minutes', proOnly: false },
          ],
        }),
      } as Response);
    }
    if (url.startsWith('/api/tier/check/')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, symbol: 'XAUUSD', allowed: true }),
      } as Response);
    }
    if (url === '/api/alerts/alert-1' && patchImpl) {
      return patchImpl();
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  }) as unknown as typeof fetch;
}

describe('EditAlertPage (server component)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('renders existing alert data in the form for a PRO user', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
    mockFindUnique.mockResolvedValue(realAlert);
    mockTierFetches();

    const jsx = await EditAlertPage({
      params: Promise.resolve({ id: 'alert-1' }),
    });
    render(withLocale(jsx));

    expect(
      await screen.findByRole('heading', { name: 'Edit Alert', level: 1 })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Gold breakout')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue('2500')).toBeInTheDocument();
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'alert-1' } })
    );
  });

  it('renders the PRO-upgrade landing for FREE tier users', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });

    const jsx = await EditAlertPage({
      params: Promise.resolve({ id: 'alert-1' }),
    });
    render(withLocale(jsx));

    expect(screen.getByText('Alerts are a PRO feature')).toBeInTheDocument();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('calls notFound() for a non-existent alert ID', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
    mockFindUnique.mockResolvedValue(null);

    await expect(
      EditAlertPage({ params: Promise.resolve({ id: 'missing-alert' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('calls notFound() (not 403) when the alert belongs to another user', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', tier: 'PRO' } });
    mockFindUnique.mockResolvedValue({ ...realAlert, userId: 'someone-else' });

    await expect(
      EditAlertPage({ params: Promise.resolve({ id: 'alert-1' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('EditAlertClient submit flow', () => {
  const initialData: AlertFormData = {
    symbol: 'XAUUSD',
    timeframe: 'M5',
    conditionType: 'price_above',
    targetValue: 2500,
    name: 'Gold breakout',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Session/batch-3: EditAlertClient itself now calls useLocale() (for
    // error-message translation) -- needs the same LocaleProvider wrapper
    // and pre-seeded preference as the describe block above
    // (LESSONS-LEARNED.md L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('submits the new target value via PATCH /api/alerts/[id] and redirects on success', async () => {
    const user = userEvent.setup();
    mockTierFetches(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          alert: {
            ...realAlert,
            condition: JSON.stringify({
              type: 'price_above',
              targetValue: 2600,
            }),
          },
          message: 'Alert updated successfully',
        }),
      } as Response)
    );

    render(
      withLocale(
        <EditAlertClient
          alertId="alert-1"
          userTier="PRO"
          limit={100}
          initialData={initialData}
        />
      )
    );

    const targetInput = await screen.findByDisplayValue('2500');
    await user.clear(targetInput);
    await user.type(targetInput, '2600');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/alerts/alert-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Gold breakout', targetValue: 2600 }),
        })
      );
    });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/alerts');
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('shows a real error and does not redirect when the PATCH call fails', async () => {
    const user = userEvent.setup();
    mockTierFetches(() =>
      Promise.resolve({
        ok: false,
        json: async () => ({ error: 'Failed to update alert' }),
      } as Response)
    );

    render(
      withLocale(
        <EditAlertClient
          alertId="alert-1"
          userTier="PRO"
          limit={100}
          initialData={initialData}
        />
      )
    );

    await screen.findByDisplayValue('2500');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(
      await screen.findByText('Failed to update alert')
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('locks symbol, timeframe, and condition type in edit mode', async () => {
    mockTierFetches();

    render(
      withLocale(
        <EditAlertClient
          alertId="alert-1"
          userTier="PRO"
          limit={100}
          initialData={initialData}
        />
      )
    );

    await screen.findByDisplayValue('2500');
    expect(await screen.findByLabelText('Symbol')).toBeDisabled();
    expect(screen.getByLabelText('Timeframe')).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Price Above' })).toBeDisabled();
  });
});

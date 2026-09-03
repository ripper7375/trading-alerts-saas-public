/**
 * Notifications Page Tests
 *
 * Session 6-4: verifies the new /notifications page renders the real,
 * previously-orphaned NotificationList against the live
 * /api/notifications/* routes (Session 4B-9, CUT-OVER & LIVE) --
 * unauthenticated redirect, authenticated render, status/type filter
 * switching, mark-read, mark-all-read, delete, and the realtime
 * onNotification refresh wired this session.
 *
 * @module __tests__/pages/notifications/notifications-page.test
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// NotificationsPage now resolves a dictionary via getServerLanguage()
// (batch-4 locale wiring), which calls next/headers's cookies()/headers()
// -- unavailable when a Server Component is invoked directly as a plain
// function in a test (no real Next.js request scope). Mock both to no-op
// stores so resolvePreferences() falls back to defaultPreferences (matches
// this file's existing English-text assertions either way).
const mockCookieStore = { get: jest.fn(() => undefined) };
const mockHeaderStore = { get: jest.fn(() => undefined) };
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
  headers: jest.fn(() => Promise.resolve(mockHeaderStore)),
}));

import NotificationsPage from '@/app/notifications/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

const mockPush = jest.fn();
// A stable object reference, matching next/navigation's real useRouter()
// (memoized across renders) -- a fresh literal per call would make
// fetchNotifications' useCallback (deps include `router`) recompute every
// render and re-fire its mount effect in a loop, a pure test-mock artifact
// unrelated to app behavior.
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  // Session 9-4: the page now mounts AppHeader (components/layout/
  // app-header.tsx), which calls usePathname() directly, and LocaleProvider
  // (wrapped in tests below) needs its own usePathname() too --
  // LESSONS-LEARNED.md L40's own stub.
  usePathname: () => '/notifications',
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

// AppHeader calls useLocale() -- needs a LocaleProvider ancestor. Pre-seed
// localStorage with a known preference so LocaleProvider's first-visit
// branch never fires its real geo-IP fetch() (LESSONS-LEARNED.md L40) --
// this file's own tests assert exact global.fetch call counts/args.
function withLocale(ui: React.ReactElement): React.ReactElement {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

const mockGetSession = jest.fn();
jest.mock('@/lib/auth/session', () => ({
  getSession: () => mockGetSession(),
}));

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockUseRealtimeSocket = jest.fn();
jest.mock('@/hooks/use-realtime-socket', () => ({
  useRealtimeSocket: (opts: { onNotification?: () => void }) =>
    mockUseRealtimeSocket(opts),
}));

interface MockNotification {
  id: string;
  type: 'ALERT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  read: boolean;
  readAt: string | null;
  link: string | null;
  createdAt: string;
}

const notification1: MockNotification = {
  id: 'notif-1',
  type: 'ALERT',
  title: 'XAUUSD alert fired',
  body: 'Price crossed 2500',
  priority: 'HIGH',
  read: false,
  readAt: null,
  link: null,
  createdAt: '2026-08-10T10:00:00.000Z',
};

const notification2: MockNotification = {
  id: 'notif-2',
  type: 'SYSTEM',
  title: 'Welcome',
  body: 'Thanks for joining',
  priority: 'LOW',
  read: true,
  readAt: '2026-08-09T10:00:00.000Z',
  link: null,
  createdAt: '2026-08-09T09:00:00.000Z',
};

function listResponse(
  notifications: MockNotification[],
  overrides: Partial<{
    total: number;
    unreadCount: number;
    totalPages: number;
    page: number;
  }> = {}
): Response {
  return {
    ok: true,
    json: async () => ({
      notifications,
      total: overrides.total ?? notifications.length,
      page: overrides.page ?? 1,
      pageSize: 20,
      totalPages: overrides.totalPages ?? 1,
      unreadCount:
        overrides.unreadCount ?? notifications.filter((n) => !n.read).length,
    }),
  } as Response;
}

describe('NotificationsPage (server component)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('redirects unauthenticated callers to /login', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(NotificationsPage()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('renders NotificationList for an authenticated session', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
    mockUseSession.mockReturnValue({ data: { user: { tier: 'FREE' } } });
    global.fetch = jest.fn(() =>
      Promise.resolve(listResponse([notification1, notification2]))
    ) as unknown as typeof fetch;

    const jsx = await NotificationsPage();
    render(withLocale(jsx));

    expect(await screen.findByText('XAUUSD alert fired')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('2 total, 1 unread')).toBeInTheDocument();
  });
});

describe('NotificationList interactions (mounted via NotificationsPage)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({ data: { user: { tier: 'FREE' } } });
    mockGetSession.mockResolvedValue({ user: { id: 'user-1', tier: 'FREE' } });
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  async function renderList(
    fetchImpl: (url: string, init: RequestInit | undefined) => Promise<Response>
  ): Promise<void> {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      return fetchImpl(url, init);
    }) as unknown as typeof fetch;

    const jsx = await NotificationsPage();
    render(withLocale(jsx));
    await screen.findByText('XAUUSD alert fired');
  }

  it('switches status tabs and re-fetches with the selected status filter', async () => {
    const user = userEvent.setup();
    const fetchImpl = jest.fn((url: string) => {
      if (url.includes('status=unread')) {
        return Promise.resolve(listResponse([notification1]));
      }
      return Promise.resolve(listResponse([notification1, notification2]));
    });
    await renderList(fetchImpl);

    await user.click(screen.getByRole('tab', { name: /unread/i }));

    await waitFor(() => {
      expect(
        fetchImpl.mock.calls.some(([url]) => url.includes('status=unread'))
      ).toBe(true);
    });
  });

  it('filters by notification type and re-fetches with the type param', async () => {
    const user = userEvent.setup();
    const fetchImpl = jest.fn((url: string) => {
      if (url.includes('type=SYSTEM')) {
        return Promise.resolve(listResponse([notification2]));
      }
      return Promise.resolve(listResponse([notification1, notification2]));
    });
    await renderList(fetchImpl);

    await user.click(screen.getByRole('button', { name: 'System' }));

    await waitFor(() => {
      expect(
        fetchImpl.mock.calls.some(([url]) => url.includes('type=SYSTEM'))
      ).toBe(true);
    });
  });

  it('marks a notification as read via POST and updates the unread count', async () => {
    const user = userEvent.setup();
    const fetchImpl = jest.fn((url: string, init?: RequestInit) => {
      if (
        url === '/api/notifications/notif-1/read' &&
        init?.method === 'POST'
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      return Promise.resolve(listResponse([notification1, notification2]));
    });
    await renderList(fetchImpl);

    expect(screen.getByText('2 total, 1 unread')).toBeInTheDocument();

    await user.click(screen.getByText('XAUUSD alert fired'));

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/notifications/notif-1/read',
        expect.objectContaining({ method: 'POST' })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('2 total, 0 unread')).toBeInTheDocument();
    });
  });

  it('marks all notifications as read via the mark-all-read button', async () => {
    const user = userEvent.setup();
    const fetchImpl = jest.fn((url: string, init?: RequestInit) => {
      if (url === '/api/notifications' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      return Promise.resolve(listResponse([notification1, notification2]));
    });
    await renderList(fetchImpl);

    await user.click(screen.getByRole('button', { name: /mark all as read/i }));

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/notifications',
        expect.objectContaining({ method: 'POST' })
      );
    });
    await waitFor(() => {
      expect(screen.getByText('2 total, 0 unread')).toBeInTheDocument();
    });
  });

  it('deletes a notification via DELETE and shows the undo banner', async () => {
    const user = userEvent.setup();
    const fetchImpl = jest.fn((url: string, init?: RequestInit) => {
      if (url === '/api/notifications/notif-2' && init?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        } as Response);
      }
      return Promise.resolve(listResponse([notification1, notification2]));
    });
    await renderList(fetchImpl);

    const title = screen.getByText('Welcome');
    const header = title.closest('div.justify-between') as HTMLElement;
    const deleteButton = within(header).getByRole('button');
    await user.click(deleteButton);

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/notifications/notif-2',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    expect(screen.getByText('Notification deleted')).toBeInTheDocument();
    expect(screen.queryByText('Welcome')).not.toBeInTheDocument();
  });

  it('re-fetches the list and announces a realtime notification event to screen readers', async () => {
    const fetchImpl = jest.fn(() =>
      Promise.resolve(listResponse([notification1, notification2]))
    );
    await renderList(fetchImpl);

    const callsBefore = fetchImpl.mock.calls.length;
    const onNotification = mockUseRealtimeSocket.mock.calls[0]?.[0]
      ?.onNotification as ((n: { title: string }) => void) | undefined;
    expect(typeof onNotification).toBe('function');

    onNotification?.({ title: 'Price alert triggered' });

    expect(
      await screen.findByText('New notification: Price alert triggered')
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchImpl.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});

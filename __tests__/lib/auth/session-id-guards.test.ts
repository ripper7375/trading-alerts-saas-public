/**
 * @jest-environment node
 */
/**
 * "Signed in" means the session names an account.
 *
 * The `jwt` callback neither issues nor accepts a session without an account id
 * (`session-without-id.test.ts`). This is the second lock: every server-side gate asks for
 * `session.user.id` itself, not only for `session.user`. Each is called here as NextAuth would
 * answer with such a session, and must refuse before touching the database.
 *
 * A new page, layout, route or permission helper that treats a session as signed in belongs in the
 * tables below.
 */

/** Every database call made through the mocked client, as `model.method`. */
const mockDbCalls: string[] = [];

jest.mock('@/lib/db/prisma', () => {
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_target, method) => async () => {
          mockDbCalls.push(`${name}.${String(method)}`);
          if (method === 'findMany') return [];
          if (method === 'count') return 0;
          // A write answers with a row.
          if (method === 'upsert') return {};
          return null;
        },
      }
    );
  const prisma = new Proxy({}, { get: (_target, name) => model(String(name)) });
  return { __esModule: true, prisma };
});

// jest.config.js maps `next-auth` and every `next-auth/*` import to ONE stub. The routes call
// `getServerSession` themselves and `getSession()` wraps the same function.
const mockGetServerSession = jest.fn();
jest.mock('next-auth', () => ({
  __esModule: true,
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
  default: (options: { id: string }) => ({ id: options.id, options }),
}));

jest.mock('next/navigation', () => ({
  __esModule: true,
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/headers', () => ({
  __esModule: true,
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, getAll: () => [] }),
}));

import { AuthError } from '@/lib/auth/errors';
import {
  checkFeatureAccess,
  createAnyPermissionMiddleware,
  requireChartDownload,
  requirePro,
  validateMultiplePermissions,
} from '@/lib/auth/permissions';

const person = {
  name: 'Pro Test User',
  email: 'pro@example.com',
  image: null,
};
const privileged = { tier: 'PRO', role: 'ADMIN', isAffiliate: true };

/** The shapes a session without an account can take. */
const BROKEN_SESSIONS = [
  ['name, e-mail and image only', { user: { ...person } }],
  ['privileged claims but no id', { user: { ...person, ...privileged } }],
  ['an empty id', { user: { ...person, ...privileged, id: '' } }],
] as const;

type Handler = (...args: unknown[]) => Promise<unknown>;
type Loader = () => Promise<Record<string, unknown>>;

async function handler(load: Loader, name: string): Promise<Handler> {
  const found = (await load())[name];
  if (typeof found !== 'function') throw new Error(`no export ${name}`);
  return found as Handler;
}

const PAGES: [string, Loader][] = [
  ['app/admin/layout', () => import('@/app/admin/layout')],
  [
    'app/admin/disbursement/layout',
    () => import('@/app/admin/disbursement/layout'),
  ],
  [
    'app/affiliate/dashboard/layout',
    () => import('@/app/affiliate/dashboard/layout'),
  ],
  [
    'app/affiliate/settings/layout',
    () => import('@/app/affiliate/settings/layout'),
  ],
  ['app/alerts/layout', () => import('@/app/alerts/layout')],
  ['app/alerts/page', () => import('@/app/alerts/page')],
  ['app/alerts/new/page', () => import('@/app/alerts/new/page')],
  ['app/alerts/[id]/edit/page', () => import('@/app/alerts/[id]/edit/page')],
  ['app/dashboard/layout', () => import('@/app/dashboard/layout')],
  ['app/dashboard/page', () => import('@/app/dashboard/page')],
  ['app/free/layout', () => import('@/app/free/layout')],
  ['app/free/page', () => import('@/app/free/page')],
  ['app/notifications/layout', () => import('@/app/notifications/layout')],
  ['app/notifications/page', () => import('@/app/notifications/page')],
  [
    'app/pro/currency-index/layout',
    () => import('@/app/pro/currency-index/layout'),
  ],
  [
    'app/pro/currency-index/page',
    () => import('@/app/pro/currency-index/page'),
  ],
  [
    'app/pro/currency-index/compare/page',
    () => import('@/app/pro/currency-index/compare/page'),
  ],
  ['app/settings/layout', () => import('@/app/settings/layout')],
  ['app/terminal/layout', () => import('@/app/terminal/layout')],
  ['app/terminal/page', () => import('@/app/terminal/page')],
];

const ROUTES: [string, string, Loader][] = [
  ['GET', 'invoices', () => import('@/app/api/invoices/route')],
  // POST /api/subscription has no gate of its own: it forwards the cookie to /api/checkout.
  ['GET', 'subscription', () => import('@/app/api/subscription/route')],
  [
    'POST',
    'subscription/cancel',
    () => import('@/app/api/subscription/cancel/route'),
  ],
  [
    'POST',
    'subscription/change-plan',
    () => import('@/app/api/subscription/change-plan/route'),
  ],
  [
    'DELETE',
    'subscription/change-plan',
    () => import('@/app/api/subscription/change-plan/route'),
  ],
  [
    'GET',
    'subscription/change-plan/preview',
    () => import('@/app/api/subscription/change-plan/preview/route'),
  ],
  [
    'POST',
    'subscription/payment-method-session',
    () => import('@/app/api/subscription/payment-method-session/route'),
  ],
  [
    'POST',
    'subscription/resume',
    () => import('@/app/api/subscription/resume/route'),
  ],
  ['POST', 'checkout', () => import('@/app/api/checkout/route')],
  [
    'POST',
    'disbursement/pay',
    () => import('@/app/api/disbursement/pay/route'),
  ],
  [
    'GET',
    'market/currency-index-pro/chart',
    () => import('@/app/api/market/currency-index-pro/chart/route'),
  ],
  [
    'GET',
    'market/currency-index-pro/comparison',
    () => import('@/app/api/market/currency-index-pro/comparison/route'),
  ],
  [
    'GET',
    'market/currency-index-pro/detail',
    () => import('@/app/api/market/currency-index-pro/detail/route'),
  ],
  [
    'GET',
    'market/currency-index-pro/preferences',
    () => import('@/app/api/market/currency-index-pro/preferences/route'),
  ],
  [
    'PUT',
    'market/currency-index-pro/preferences',
    () => import('@/app/api/market/currency-index-pro/preferences/route'),
  ],
  [
    'GET',
    'market/currency-index-pro/screener',
    () => import('@/app/api/market/currency-index-pro/screener/route'),
  ],
  [
    'GET',
    'market/economic-events',
    () => import('@/app/api/market/economic-events/route'),
  ],
  [
    'GET',
    'market/indicator-statistics',
    () => import('@/app/api/market/indicator-statistics/route'),
  ],
];

const HELPERS: [string, () => Promise<unknown>][] = [
  [
    'checkFeatureAccess',
    () => checkFeatureAccess('multi_timeframe_visualization'),
  ],
  ['requirePro', () => requirePro()],
  ['requireChartDownload', () => requireChartDownload()],
  [
    'validateMultiplePermissions',
    () => validateMultiplePermissions(['multi_timeframe_visualization']),
  ],
  [
    'createAnyPermissionMiddleware',
    () => createAnyPermissionMiddleware(['multi_timeframe_visualization'])(),
  ],
];

function apiRequest(method: string, path: string): unknown {
  const url = new URL(`https://davintrade.app/api/${path}`);
  return {
    method,
    url: url.href,
    nextUrl: url,
    headers: new Headers(),
    cookies: { get: () => undefined },
    json: async () => ({}),
    text: async () => '',
  };
}

const pageProps = () => ({
  children: null,
  params: Promise.resolve({ id: 'alert-1' }),
  searchParams: Promise.resolve({}),
});

beforeEach(() => {
  mockDbCalls.length = 0;
  mockGetServerSession.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(BROKEN_SESSIONS)('a session with %s', (_label, session) => {
  beforeEach(() => {
    mockGetServerSession.mockResolvedValue(session);
  });

  it.each(PAGES)('is sent to sign in by %s', async (_name, load) => {
    const render = await handler(load, 'default');

    await expect(render(pageProps())).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockDbCalls).toEqual([]);
  });

  it.each(ROUTES)(
    'is answered 401 by %s /api/%s',
    async (method, path, load) => {
      const route = await handler(load, method);

      const response = (await route(apiRequest(method, path))) as Response;

      expect(response.status).toBe(401);
      expect(mockDbCalls).toEqual([]);
    }
  );

  it.each(HELPERS)('is refused by %s()', async (_name, call) => {
    const refusal = await call().then(
      () => null,
      (error: unknown) => error
    );

    expect(refusal).toBeInstanceOf(AuthError);
    expect(refusal).toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
    expect(mockDbCalls).toEqual([]);
  });

  it('gets no chat token: it is a guest', async () => {
    const route = await handler(
      () => import('@/app/api/chat/token/route'),
      'GET'
    );

    const response = (await route()) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ token: null });
  });
});

/** The tables above prove nothing if a gate refused everybody. */
describe('a session that names its account', () => {
  const session = { user: { ...person, ...privileged, id: 'user-1' } };

  beforeEach(() => {
    mockGetServerSession.mockResolvedValue(session);
  });

  it.each(PAGES)('is not sent to sign in by %s', async (_name, load) => {
    const render = await handler(load, 'default');

    const outcome = await render(pageProps()).then(
      () => '',
      (error: Error) => error.message
    );

    expect(outcome).not.toContain('NEXT_REDIRECT:/login');
  });

  it.each(ROUTES)(
    'is not answered 401 by %s /api/%s',
    async (method, path, load) => {
      const route = await handler(load, method);

      const response = (await route(apiRequest(method, path))) as Response;

      expect(response.status).not.toBe(401);
    }
  );
});

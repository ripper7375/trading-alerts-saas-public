/**
 * Independent reads on the server pages are asked for together (Next.js remediation T2-b).
 *
 * Each read here is a promise that never settles, so the test sees only WHICH reads the page has
 * started by the time it is waiting, and in what order they were started:
 *
 *   - the admin pages ask nothing while `requireAdminPage()` is still pending (the guard stays
 *     awaited first, T1-e), and then ask for their reads at once;
 *   - the payouts page asks for the payout rows with the locale and the rates, after it knows
 *     which affiliate it is showing.
 */

const mockStarted: string[] = [];
const mockPending = (label: string): Promise<never> => {
  mockStarted.push(label);
  return new Promise<never>(() => undefined);
};

let mockGuardOpen: () => void = () => undefined;
const mockGuard = jest.fn(
  () =>
    new Promise<void>((resolve) => {
      mockGuardOpen = resolve;
    })
);
jest.mock('@/lib/auth/session', () => ({
  __esModule: true,
  requireAdminPage: () => mockGuard(),
  getAffiliateProfile: async () => ({ id: 'prof-1' }),
}));

jest.mock('@/lib/affiliate/view-as', () => ({
  __esModule: true,
  getAdminViewAs: async () => null,
}));

jest.mock('@/lib/i18n/server-locale', () => ({
  __esModule: true,
  getServerLocalePreferences: () => mockPending('locale'),
  getServerLanguage: () => mockPending('language'),
}));

jest.mock('@/lib/fx/usd-rates', () => ({
  __esModule: true,
  getDisplayUsdRates: () => mockPending('rates'),
}));

jest.mock('@/lib/admin/analytics/executive', () => ({
  __esModule: true,
  getExecutiveAnalytics: () => mockPending('analytics'),
}));
jest.mock('@/lib/admin/analytics/revenue', () => ({
  __esModule: true,
  getRevenueAnalytics: () => mockPending('analytics'),
}));
jest.mock('@/lib/admin/analytics/affiliates', () => ({
  __esModule: true,
  getAffiliatesAnalytics: () => mockPending('analytics'),
}));
jest.mock('@/lib/admin/analytics/regional', () => ({
  __esModule: true,
  getRegionalAnalytics: () => mockPending('analytics'),
}));
jest.mock('@/lib/admin/analytics/users', () => ({
  __esModule: true,
  getUsersAnalytics: () => mockPending('analytics'),
}));

jest.mock('@/lib/db/prisma', () => ({
  __esModule: true,
  prisma: {
    user: { findUnique: () => mockPending('user') },
    disbursementTransaction: { findMany: () => mockPending('payouts') },
    alert: { count: () => mockPending('alert-count') },
  },
}));

jest.mock('next/navigation', () => ({
  __esModule: true,
  notFound: jest.fn(),
  redirect: jest.fn(),
  usePathname: () => '/',
}));

import AffiliatesPage from '@/app/admin/dashboards/affiliates/page';
import ExecutivePage from '@/app/admin/dashboards/executive/page';
import RegionalPage from '@/app/admin/dashboards/regional/page';
import RevenuePage from '@/app/admin/dashboards/revenue/page';
import UsersPage from '@/app/admin/dashboards/users/page';
import AdminUserDetailPage from '@/app/admin/users/[id]/page';
import AffiliatePayoutsPage from '@/app/affiliate/dashboard/payouts/page';

const flush = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

const NO_PARAMS = Promise.resolve({});

const ADMIN_PAGES: [string, () => Promise<unknown>, string[]][] = [
  ['executive', () => ExecutivePage(), ['analytics', 'locale', 'rates']],
  [
    'revenue',
    () => RevenuePage({ searchParams: NO_PARAMS }),
    ['analytics', 'locale', 'rates'],
  ],
  [
    'affiliates',
    () => AffiliatesPage({ searchParams: NO_PARAMS }),
    ['analytics', 'locale', 'rates'],
  ],
  ['regional', () => RegionalPage(), ['analytics', 'locale', 'rates']],
  ['users', () => UsersPage(), ['analytics', 'language']],
  [
    'user detail',
    () => AdminUserDetailPage({ params: Promise.resolve({ id: 'user-1' }) }),
    ['locale', 'rates', 'user'],
  ],
];

describe('the admin pages ask for their independent reads together, after the guard', () => {
  beforeEach(() => {
    mockStarted.length = 0;
    mockGuard.mockClear();
  });

  it.each(ADMIN_PAGES)(
    '%s: nothing is read while the guard is pending',
    async (_name, render) => {
      void render();
      await flush();

      expect(mockGuard).toHaveBeenCalledTimes(1);
      expect(mockStarted).toEqual([]);
    }
  );

  it.each(ADMIN_PAGES)(
    '%s: every independent read is started before any of them answers',
    async (_name, render, expected) => {
      void render();
      await flush();
      mockGuardOpen();
      await flush();

      expect(mockStarted).toEqual(expected);
    }
  );
});

describe('the affiliate payouts page', () => {
  beforeEach(() => {
    mockStarted.length = 0;
  });

  it('asks for the locale, the rates and the payout rows at once, once the affiliate is known', async () => {
    void AffiliatePayoutsPage();
    await flush();

    expect(mockStarted).toEqual(['locale', 'rates', 'payouts']);
  });
});

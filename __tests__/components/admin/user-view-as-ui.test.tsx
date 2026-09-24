/**
 * Admin "view as user" -- the settings UI in view mode.
 *
 * - Billing and Security Activity read the viewed user (every GET carries
 *   ?view_as=user) and hide the controls that would act on the ADMIN's own
 *   account (Cancel Plan, Manage Subscription, Mark read).
 * - The settings nav shows only the pages that render the viewed user, and
 *   the gate replaces every other settings page with a notice.
 * - Outside view mode all three behave exactly as before.
 */

import { render, screen, waitFor } from '@testing-library/react';

import { UserViewAsProvider } from '@/components/admin/user-view-as/user-view-as-context';
import UserViewAsGate from '@/components/admin/user-view-as/user-view-as-gate';
import { SettingsNav } from '@/app/settings/_components/settings-nav';
import BillingSettingsPage from '@/app/settings/billing/page';
import SecurityActivityPage from '@/app/settings/security/activity/page';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

let mockPathname = '/settings/billing';
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

// The signed-in account is the admin; the viewed user is a PRO customer.
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'admin_1', role: 'ADMIN', tier: 'PRO' } },
    status: 'authenticated',
  }),
}));

jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({ regularPrice: 29 }),
}));

const VIEWED = {
  id: 'user_42',
  name: 'Carol Customer',
  email: 'carol@example.com',
  tier: 'PRO',
  role: 'USER',
};

function renderIn(
  ui: React.ReactElement,
  viewAs: typeof VIEWED | null
): ReturnType<typeof render> {
  return render(
    <LocaleProvider>
      <UserViewAsProvider value={viewAs}>{ui}</UserViewAsProvider>
    </LocaleProvider>
  );
}

const PRO_SUBSCRIPTION = {
  tier: 'PRO',
  status: 'active',
  subscription: {
    id: 'sub_1',
    status: 'active',
    provider: 'STRIPE',
    planType: 'MONTHLY',
    currentPeriodEnd: '2026-10-01T00:00:00.000Z',
    expiresAt: null,
    cancelAtPeriodEnd: false,
    trialEnd: null,
    paymentMethod: null,
    dLocalPaymentMethod: null,
    dLocalCountry: null,
  },
  trial: {
    status: 'CONVERTED',
    convertedAt: null,
    cancelledAt: null,
    hasUsedFreeTrial: true,
  },
};

const fetchMock = jest.fn();

beforeEach(() => {
  mockPathname = '/settings/billing';
  localStorage.setItem(
    LOCALE_STORAGE_KEY,
    JSON.stringify({
      countryCode: 'US',
      language: 'en-US',
      timezone: 'America/New_York',
      dateFormat: 'MDY',
      timeFormat: '12h',
      currency: 'USD',
    })
  );
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    const path = url.split('?')[0];
    const bodies: Record<string, unknown> = {
      '/api/subscription': PRO_SUBSCRIPTION,
      '/api/invoices': { invoices: [] },
      '/api/alerts': { alerts: [{ id: 'a1' }, { id: 'a2' }] },
      '/api/user/security-alerts': {
        alerts: [
          {
            id: 'sa_1',
            type: 'NEW_DEVICE_LOGIN',
            title: 'New Device Login Detected',
            message: 'Login from Desktop in Bangkok',
            ipAddress: '171.96.136.183',
            deviceInfo: 'Chrome on Windows',
            location: 'Bangkok, Thailand',
            read: false,
            readAt: null,
            createdAt: '2026-09-24T00:00:00.000Z',
          },
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      },
    };
    return { ok: true, json: async () => bodies[path ?? ''] ?? {} };
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

function requestedUrls(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

describe('billing page', () => {
  it('in view mode reads the viewed user and hides the plan actions', async () => {
    renderIn(<BillingSettingsPage />, VIEWED);

    expect(await screen.findByText('Pro Plan')).toBeInTheDocument();
    expect(requestedUrls()).toEqual(
      expect.arrayContaining([
        '/api/subscription?view_as=user',
        '/api/invoices?view_as=user',
        '/api/alerts?view_as=user',
      ])
    );
    expect(requestedUrls().every((url) => url.includes('view_as=user'))).toBe(
      true
    );
    expect(screen.queryByText('Cancel Plan')).not.toBeInTheDocument();
    expect(screen.queryByText('Manage Subscription')).not.toBeInTheDocument();
    expect(screen.getByText(/Plan actions are hidden/)).toBeInTheDocument();
    expect(screen.getByText('2/100')).toBeInTheDocument();
  });

  it('outside view mode is unchanged: own data, actions shown', async () => {
    renderIn(<BillingSettingsPage />, null);

    expect(await screen.findByText('Cancel Plan')).toBeInTheDocument();
    expect(screen.getByText('Manage Subscription')).toBeInTheDocument();
    expect(requestedUrls().some((url) => url.includes('view_as'))).toBe(false);
  });
});

describe('security activity page', () => {
  it('in view mode reads the viewed user and hides "Mark read"', async () => {
    mockPathname = '/settings/security/activity';
    renderIn(<SecurityActivityPage />, VIEWED);

    expect(
      await screen.findByText('New Device Login Detected')
    ).toBeInTheDocument();
    expect(requestedUrls()[0]).toContain('view_as=user');
    expect(screen.queryByText('Mark read')).not.toBeInTheDocument();
  });

  it('outside view mode still offers "Mark read"', async () => {
    mockPathname = '/settings/security/activity';
    renderIn(<SecurityActivityPage />, null);

    expect(await screen.findByText('Mark read')).toBeInTheDocument();
    expect(requestedUrls()[0]).not.toContain('view_as');
  });
});

describe('settings nav and gate', () => {
  it('view mode shows only the Security and Billing tabs', () => {
    renderIn(<SettingsNav />, VIEWED);
    // Desktop sidebar + mobile tabs each render the list once.
    expect(
      screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    ).toEqual([
      '/settings/security',
      '/settings/billing',
      '/settings/security',
      '/settings/billing',
    ]);
  });

  it('normal mode shows every tab', () => {
    renderIn(<SettingsNav />, null);
    expect(screen.getAllByRole('link').length).toBe(16);
  });

  it('replaces a page that would show the admin account', async () => {
    mockPathname = '/settings/profile';
    renderIn(
      <UserViewAsGate>
        <p>admin profile</p>
      </UserViewAsGate>,
      VIEWED
    );
    await waitFor(() =>
      expect(
        screen.getByText('Not available in admin view')
      ).toBeInTheDocument()
    );
    expect(screen.queryByText('admin profile')).not.toBeInTheDocument();
  });

  it('lets the view-as pages through, and everything outside view mode', () => {
    mockPathname = '/settings/security';
    const { unmount } = renderIn(
      <UserViewAsGate>
        <p>security page</p>
      </UserViewAsGate>,
      VIEWED
    );
    expect(screen.getByText('security page')).toBeInTheDocument();
    unmount();

    mockPathname = '/settings/profile';
    renderIn(
      <UserViewAsGate>
        <p>own profile</p>
      </UserViewAsGate>,
      null
    );
    expect(screen.getByText('own profile')).toBeInTheDocument();
  });
});

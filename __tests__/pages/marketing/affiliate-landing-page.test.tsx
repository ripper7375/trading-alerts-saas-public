/**
 * /affiliate and /affiliate/join (T3-b): Server Component pages. The server
 * builds all three versions of /affiliate (administrator, existing affiliate,
 * visitor) and the browser picks one from the session; the sentences that
 * quote the commission and price, and the earnings calculator, are the only
 * client pieces.
 *
 * @module __tests__/pages/marketing/affiliate-landing-page.test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  defaultPreferences,
  LOCALE_STORAGE_KEY,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';

const mockRequest: LocalePreferences = {
  ...defaultPreferences,
  countryCode: 'US',
  language: 'en-US',
  currency: 'USD',
  timezone: 'Europe/London',
  timezoneSetByUser: true,
};
jest.mock('@/lib/i18n/server-locale', () => ({
  getServerLocalePreferences: jest.fn(() => Promise.resolve(mockRequest)),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  usePathname: () => '/affiliate',
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/app/actions/locale', () => ({
  syncLocaleCookiesAction: jest.fn(() => Promise.resolve({ success: true })),
}));

let mockSession: {
  data: { user: { role?: string; isAffiliate?: boolean } } | null;
};
jest.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

let mockConfig = { commissionPercent: 25, regularPrice: 29 };
jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => mockConfig,
}));

jest.mock('@/components/marketing/marketing-navbar', () => ({
  MarketingNavbar: () => <nav data-testid="navbar" />,
}));
jest.mock('@/components/marketing/marketing-footer', () => ({
  MarketingFooter: () => <footer data-testid="footer" />,
}));

import AffiliateLandingPage from '@/app/affiliate/page';
import AffiliateJoinPage from '@/app/affiliate/join/page';

function inApp(ui: React.ReactElement): React.ReactElement {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(mockRequest));
  return (
    <LocaleProvider
      initialPreferences={mockRequest}
      detectedTimezone={mockRequest.timezone}
    >
      {ui}
    </LocaleProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockPush.mockClear();
  mockSession = { data: null };
  mockConfig = { commissionPercent: 25, regularPrice: 29 };
});

describe('/affiliate for a visitor', () => {
  it('quotes the live commission in the hero and the benefits', async () => {
    render(inApp(await AffiliateLandingPage()));
    expect(
      screen.getByText(
        'Earn 25% recurring monthly revenue by introducing traders to DavinTrade AI precision fractal analytics and conversational copilots.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('25% Lifetime Recurring Commission')
    ).toBeInTheDocument();
  });

  it('follows the commission when the config changes', async () => {
    mockConfig = { commissionPercent: 30, regularPrice: 29 };
    render(inApp(await AffiliateLandingPage()));
    expect(
      screen.getByText('30% Lifetime Recurring Commission')
    ).toBeInTheDocument();
  });

  it('states the basis of the calculator in the viewer’s currency', async () => {
    render(inApp(await AffiliateLandingPage()));
    expect(
      screen.getByText(
        'Based on active PRO subscriptions at $29.00/mo with 25% commission.'
      )
    ).toBeInTheDocument();
  });

  it('estimates the earnings of 50 referrals, then of the number picked', async () => {
    const user = userEvent.setup();
    render(inApp(await AffiliateLandingPage()));

    // 50 x $29 x 25% = $362.50, shown rounded; a year of it is 12 x $363.
    expect(screen.getByText('50 traders')).toBeInTheDocument();
    expect(screen.getByText('$363.00')).toBeInTheDocument();
    expect(screen.getByText('$4,356')).toBeInTheDocument();

    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}');
    // 55 x $29 x 25% = $398.75
    expect(screen.getByText('55 traders')).toBeInTheDocument();
    expect(screen.getByText('$399.00')).toBeInTheDocument();
    expect(screen.getByText('$4,788')).toBeInTheDocument();
  });

  it('links to registration, the leaderboard and the partner dashboard', async () => {
    render(inApp(await AffiliateLandingPage()));
    expect(
      screen.getByRole('link', { name: /Join Affiliate Program/ })
    ).toHaveAttribute('href', '/affiliate/register');
    expect(
      screen.getByRole('link', { name: /See Top Earners/ })
    ).toHaveAttribute('href', '/affiliate/leaderboard');
    expect(screen.getByRole('link', { name: /Partner Login/ })).toHaveAttribute(
      'href',
      '/affiliate/dashboard'
    );
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('/affiliate by who is signed in', () => {
  it('shows the administrator page to an administrator and sends them to /admin', async () => {
    mockSession = { data: { user: { role: 'ADMIN' } } };
    render(inApp(await AffiliateLandingPage()));
    expect(
      screen.getByRole('heading', { name: 'Administrator Hub' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /Partner with the Leader in/ })
    ).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/admin');
  });

  it('shows the existing-affiliate page to an affiliate', async () => {
    mockSession = { data: { user: { role: 'USER', isAffiliate: true } } };
    render(inApp(await AffiliateLandingPage()));
    expect(
      screen.getByRole('heading', {
        name: "You're Already an Affiliate Partner",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Go to Affiliate Dashboard/ })
    ).toHaveAttribute('href', '/affiliate/dashboard');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the visitor page to a signed-in user who is neither', async () => {
    mockSession = { data: { user: { role: 'USER', isAffiliate: false } } };
    render(inApp(await AffiliateLandingPage()));
    expect(
      screen.getByRole('heading', { name: /Partner with the Leader in/ })
    ).toBeInTheDocument();
  });

  it('wraps every version in the site chrome', async () => {
    mockSession = { data: { user: { role: 'ADMIN' } } };
    const { unmount } = render(inApp(await AffiliateLandingPage()));
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    unmount();

    mockSession = { data: null };
    render(inApp(await AffiliateLandingPage()));
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });
});

describe('/affiliate/join', () => {
  it('quotes the live commission in its subtitle and its first highlight', async () => {
    render(inApp(await AffiliateJoinPage()));
    expect(
      screen.getByText(
        'Instant partner application. Start creating custom promo codes and earning 25% lifetime recurring commissions immediately.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('25% Recurring Monthly Share')).toBeInTheDocument();
  });

  it('leads to partner registration and the partner dashboard', async () => {
    render(inApp(await AffiliateJoinPage()));
    expect(
      screen.getByRole('link', { name: /Proceed to Partner Registration/ })
    ).toHaveAttribute('href', '/affiliate/register');
    expect(
      screen.getByRole('link', { name: 'Access Partner Dashboard' })
    ).toHaveAttribute('href', '/affiliate/dashboard');
  });
});

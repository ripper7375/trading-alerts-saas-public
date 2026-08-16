/**
 * Public Marketing & Legal Pages Tests (Session 6-10, F63/B1-3/B1-4/B2-1..12)
 *
 * Covers the legal pages (/terms, /privacy, /disclaimer), the marketing
 * content pages (/about, /docs, /blog, /changelog, /careers, /help), the
 * status page (async server component + real DB/realtime checks, mocked),
 * the affiliate landing page, and the /affiliate/join redirect.
 *
 * @module __tests__/pages/marketing/public-pages.test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---- next/navigation: redirect() throws, matching the established
// Session 6-3/6-6 convention for testing server-component redirects. ----
const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// ---- lib/db/prisma: mocked for the status page's real SELECT 1 check ----
const mockQueryRaw = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

// ---- useAffiliateConfig: mocked, matching register-form.test.tsx's
// established pattern -- avoids a real SWR fetch in tests. ----
jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    discountPercent: 20,
    commissionPercent: 20,
    codesPerMonth: 15,
    regularPrice: 29,
    threeDayPrice: 5,
  }),
}));

import TermsPage from '@/app/(marketing)/terms/page';
import PrivacyPage from '@/app/(marketing)/privacy/page';
import DisclaimerPage from '@/app/(marketing)/disclaimer/page';
import AboutPage from '@/app/(marketing)/about/page';
import DocsPage from '@/app/(marketing)/docs/page';
import BlogPage from '@/app/(marketing)/blog/page';
import ChangelogPage from '@/app/(marketing)/changelog/page';
import CareersPage from '@/app/(marketing)/careers/page';
import PublicHelpPage from '@/app/(marketing)/help/page';
import StatusPage from '@/app/(marketing)/status/page';
import AffiliateLandingPage from '@/app/affiliate/page';
import AffiliateJoinRedirectPage from '@/app/affiliate/join/page';

describe('Public legal pages (F63)', () => {
  it('renders /terms with the Terms of Service heading', () => {
    render(<TermsPage />);
    expect(
      screen.getByRole('heading', { name: 'Terms of Service', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Financial Disclaimer/)).toBeInTheDocument();
  });

  it('renders /privacy with the Privacy Policy heading', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Your Rights/)).toBeInTheDocument();
  });

  it('renders /disclaimer with the Financial Risk Disclaimer heading', () => {
    render(<DisclaimerPage />);
    expect(
      screen.getByRole('heading', {
        name: 'Financial Risk Disclaimer',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/No Financial Advice/)).toBeInTheDocument();
  });
});

describe('Public marketing content pages', () => {
  it('renders /about', () => {
    render(<AboutPage />);
    expect(
      screen.getByRole('heading', { name: /About Trading Alerts/, level: 1 })
    ).toBeInTheDocument();
  });

  it('renders /docs with all topic sections and expands one on click', async () => {
    const user = userEvent.setup();
    render(<DocsPage />);
    expect(
      screen.getByRole('heading', { name: 'Documentation', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Alerts & Notifications')).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /API Access/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders /blog with post entries', () => {
    render(<BlogPage />);
    expect(
      screen.getByRole('heading', { name: 'Blog', level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Real-time alert delivery, end to end')
    ).toBeInTheDocument();
  });

  it('renders /changelog grouped by month', () => {
    render(<ChangelogPage />);
    expect(
      screen.getByRole('heading', { name: 'Changelog', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
  });

  it('renders /careers with an honest no-open-roles state', () => {
    render(<CareersPage />);
    expect(screen.getByText('No open positions right now')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /careers@tradingalerts\.com/ })
    ).toHaveAttribute('href', 'mailto:careers@tradingalerts.com');
  });

  it('renders /help with FAQ and quick links, expands a question on click', async () => {
    const user = userEvent.setup();
    render(<PublicHelpPage />);
    expect(
      screen.getByRole('heading', { name: 'Help Center', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Documentation/ })).toHaveAttribute(
      'href',
      '/docs'
    );

    const question = screen.getByRole('button', {
      name: /Do I need a card to start\?/,
    });
    await user.click(question);
    expect(
      screen.getByText(/FREE accounts never require a card/)
    ).toBeInTheDocument();
  });
});

describe('Public status page (B2-12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  it('shows all systems operational when every real check passes', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    process.env['OPERATION_SERVICE_URL'] = 'https://operation-service.test';
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_x';
    process.env['DLOCAL_LOGIN'] = 'login';

    const jsx = await StatusPage();
    render(jsx);

    expect(screen.getByText('All systems operational')).toBeInTheDocument();
    expect(screen.getAllByText('Operational')).toHaveLength(4);
  });

  it('reports the database as degraded when the SELECT 1 check throws', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    process.env['OPERATION_SERVICE_URL'] = 'https://operation-service.test';
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_x';
    process.env['DLOCAL_LOGIN'] = 'login';

    const jsx = await StatusPage();
    render(jsx);

    expect(screen.getByText('Some systems are degraded')).toBeInTheDocument();
    expect(screen.getByText('Connection check failed')).toBeInTheDocument();
  });
});

describe('Public affiliate landing page (B2-10)', () => {
  it('renders live commission/discount rates and CTAs to /affiliate/register', () => {
    render(<AffiliateLandingPage />);
    expect(
      screen.getByRole('heading', {
        name: 'Become a Trading Alerts Affiliate',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Become an Affiliate' })[0]
    ).toHaveAttribute('href', '/affiliate/register');
  });
});

describe('/affiliate/join redirect (B2-11)', () => {
  it('redirects to /affiliate/register', () => {
    expect(() => AffiliateJoinRedirectPage()).toThrow(
      'NEXT_REDIRECT:/affiliate/register'
    );
    expect(mockRedirect).toHaveBeenCalledWith('/affiliate/register');
  });
});

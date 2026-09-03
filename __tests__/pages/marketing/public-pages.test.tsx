/**
 * Public Marketing & Legal Pages Tests (Session 6-10, F63/B1-3/B1-4/B2-1..12;
 * content + assertions updated Session 9-2 for the DavinTrade rebrand)
 *
 * Covers the legal pages (/terms, /privacy, /disclaimer), the marketing
 * content pages (/about, /docs, /blog, /changelog, /careers, /help), the
 * status page (async server component + real DB/realtime checks, mocked),
 * the affiliate landing page, and the /affiliate/join redirect.
 *
 * Session 9-2 ported all ten (marketing) pages to DavinTrade content/branding
 * -- per LESSONS-LEARNED.md L3 ("test:ci must never go backwards"), a test
 * needing its assertion changed for an intentional rebrand is a finding, not
 * a bug: every assertion below was re-derived from the actual ported page
 * content, not just patched to pass.
 *
 * @module __tests__/pages/marketing/public-pages.test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LocaleProvider } from '@/lib/context/locale-context';

// ---- next/navigation: redirect() throws, matching the established
// Session 6-3/6-6 convention for testing server-component redirects.
// usePathname/useRouter are needed as of Session 9-2 -- MarketingNavbar
// (mounted by every ported page via app/(marketing)/layout.tsx, and
// directly by app/affiliate/page.tsx, which imports that layout for shared
// chrome) calls usePathname() to highlight the active nav link, and
// StatusRefreshButton (mounted by the status page below) calls useRouter()
// for its router.refresh() reload. ----
const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const mockRouterRefresh = jest.fn();
jest.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  usePathname: () => '/',
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

// ---- next-auth/react: app/affiliate/page.tsx calls useSession() to gate
// its admin/already-affiliate branches -- unauthenticated by default so
// the public marketing content (the branch under test) renders. Matches
// the established mockUseSession pattern (e.g. settings/billing.test.tsx). ----
const mockUseSession = jest.fn(() => ({
  data: null,
  status: 'unauthenticated',
}));
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

// ---- lib/db/prisma: mocked for the status page's real SELECT 1 check ----
const mockQueryRaw = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

// ---- next/headers: the status page (Server Component) now resolves
// locale preferences via getServerLocalePreferences(), which calls
// cookies()/headers() -- both throw "called outside a request scope"
// when unmocked in a Jest render (LESSONS-LEARNED.md L3 recurrence). ----
const mockCookieStore = { get: jest.fn(() => undefined) };
const mockHeaderStore = { get: jest.fn(() => null) };
jest.mock('next/headers', () => ({
  __esModule: true,
  cookies: jest.fn(() => Promise.resolve(mockCookieStore)),
  headers: jest.fn(() => Promise.resolve(mockHeaderStore)),
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
    calculateDiscountedPrice: (price: number) => price * 0.8,
  }),
}));

/**
 * Every ported (marketing) page and MarketingNavbar/MarketingFooter (built
 * Session 9-1) call useLocale() -- needs a LocaleProvider ancestor, same
 * pattern __tests__/pages/phase-6-exit.test.tsx established for NotFound.
 *
 * LocaleProvider's first-visit branch calls the REAL global.fetch()
 * (jest.setup.js wires a genuine undici fetch, not a mock) to
 * https://ipapi.co/json/ for geo-detection when no cookie/localStorage
 * preference exists -- which it never does in a clean jsdom test. Left
 * un-mocked, this fires a real network request that's still in flight when
 * the test file's jsdom window tears down, crashing the worker process on
 * teardown (LESSONS-LEARNED.md L40). Reject it by default; the Status page
 * describe block below overrides global.fetch per-test for its own real
 * checks (realtime health) and restores nothing extra since its own
 * beforeEach already fully replaces the reference.
 */
const originalFetch = global.fetch;
beforeAll(() => {
  global.fetch = jest
    .fn()
    .mockRejectedValue(new Error('network disabled in tests'));
});
afterAll(() => {
  global.fetch = originalFetch;
});

function withLocale(ui: React.ReactElement) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

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
import AffiliateJoinPage from '@/app/affiliate/join/page';

describe('Public legal pages (F63)', () => {
  it('renders /terms with the Terms of Service heading', () => {
    render(withLocale(<TermsPage />));
    expect(
      screen.getByRole('heading', { name: 'Terms of Service', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Financial Disclaimer/)).toBeInTheDocument();
  });

  it('renders /privacy with the DavinTrade Privacy Policy heading', () => {
    render(withLocale(<PrivacyPage />));
    expect(
      screen.getByRole('heading', {
        name: 'DavinTrade AI Privacy Policy',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your Rights and Data Control/)
    ).toBeInTheDocument();
  });

  it('renders /disclaimer with the risk disclosure heading', () => {
    render(withLocale(<DisclaimerPage />));
    expect(
      screen.getByRole('heading', {
        name: 'Financial Risk Disclosure & Legal Disclaimer',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No Financial or Investment Advice/)
    ).toBeInTheDocument();
  });
});

describe('Public marketing content pages', () => {
  it('renders /about', () => {
    render(withLocale(<AboutPage />));
    expect(
      screen.getByRole('heading', {
        name: /Precision Gold Analytics Powered by/,
        level: 1,
      })
    ).toBeInTheDocument();
  });

  it('renders /docs with all topic sections and expands one on click', async () => {
    const user = userEvent.setup();
    render(withLocale(<DocsPage />));
    expect(
      screen.getByRole('heading', {
        name: 'Documentation & Platform Guides',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(screen.getByText('1. Getting Started & Setup')).toBeInTheDocument();
    expect(screen.getByText('4. Real-Time Alert Engine')).toBeInTheDocument();

    const toggle = screen.getByRole('button', {
      name: /5\. Subscriptions, Invoicing/,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/Upgrade seamlessly through \/checkout/)
    ).toBeInTheDocument();
  });

  it('renders /blog with post entries', () => {
    render(withLocale(<BlogPage />));
    expect(
      screen.getByRole('heading', {
        name: 'Trading Intelligence Blog',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Decoding Gold Fractal Geometry/)
    ).toBeInTheDocument();
  });

  it('renders /changelog with versioned release entries', () => {
    render(withLocale(<ChangelogPage />));
    expect(
      screen.getByRole('heading', { name: 'DavinTrade Changelog', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByText('v2.4.0')).toBeInTheDocument();
    expect(screen.getByText('Latest Release')).toBeInTheDocument();
  });

  it('renders /careers with an honest no-open-roles state', () => {
    render(withLocale(<CareersPage />));
    expect(screen.getByText('No open positions right now')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /careers@davintrade\.app/ })
    ).toHaveAttribute('href', 'mailto:careers@davintrade.app');
  });

  it('renders /help with FAQ content and a real email support channel', () => {
    render(withLocale(<PublicHelpPage />));
    expect(
      screen.getByRole('heading', {
        name: 'How can we help you today?',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Email Support Desk/ })
    ).toHaveAttribute('href', 'mailto:support@davintrade.app');
    expect(
      screen.getByText('Can I cancel my subscription anytime?')
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
    render(withLocale(jsx));

    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
    expect(screen.getAllByText('Operational')).toHaveLength(4);
  });

  it('reports the database as degraded when the SELECT 1 check throws', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
    process.env['OPERATION_SERVICE_URL'] = 'https://operation-service.test';
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_x';
    process.env['DLOCAL_LOGIN'] = 'login';

    const jsx = await StatusPage();
    render(withLocale(jsx));

    expect(screen.getByText('Some Systems Are Degraded')).toBeInTheDocument();
    expect(screen.getByText('Connection check failed')).toBeInTheDocument();
  });
});

describe('Public affiliate landing page (B2-10, restyled Session 9-7a)', () => {
  it('renders live commission/discount rates and CTAs to /affiliate/register', () => {
    render(withLocale(<AffiliateLandingPage />));
    expect(
      screen.getByRole('heading', {
        name: 'Partner with the Leader in Quantitative AI Trading',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /Join Affiliate Program/i })[0]
    ).toHaveAttribute('href', '/affiliate/register');
  });
});

// Session 9-7a (Decision 3, approved): the legacy 1-line redirect to
// /affiliate/register was replaced with a real DavinTrade partner
// onboarding page, per Codebase 2 -- this block replaces the retired
// B2-11 redirect-only assertion (LESSONS-LEARNED.md L3: a test needing
// its assertion changed for an intentional, approved content change is a
// finding, not a bug).
describe('/affiliate/join partner onboarding (B2-11, replaced Session 9-7a)', () => {
  it('renders the partner onboarding highlights page with a CTA to /affiliate/register', () => {
    render(withLocale(<AffiliateJoinPage />));
    expect(
      screen.getByRole('heading', {
        name: 'Join the DavinTrade Partner Network',
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Proceed to Partner Registration/i })
    ).toHaveAttribute('href', '/affiliate/register');
  });
});

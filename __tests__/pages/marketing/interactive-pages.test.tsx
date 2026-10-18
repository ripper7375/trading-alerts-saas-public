/**
 * The marketing pages that have something to click (T3-b): each is a Server
 * Component that renders its text on the server, with a small Client Component
 * for the part that needs the browser. These tests render the page the way
 * Next does (call it, render what it returns) and use it.
 *
 * @module __tests__/pages/marketing/interactive-pages.test
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LocaleProvider } from '@/lib/context/locale-context';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import {
  defaultPreferences,
  LOCALE_STORAGE_KEY,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import { preloadDictionaries } from '@/lib/i18n/client-dictionaries';
import { resolveTradingViewLocale } from '@/lib/utils/tradingview-locale';
import de from '@/lib/i18n/dictionaries/de.json';

const german = (key: string): string =>
  (de as Record<string, string>)[key] as string;

// ---- the request: what the server resolves from the cookies and headers ----
let mockRequest: LocalePreferences;
jest.mock('@/lib/i18n/server-locale', () => ({
  getServerLocalePreferences: jest.fn(() => Promise.resolve(mockRequest)),
  getServerLanguage: jest.fn(() => Promise.resolve(mockRequest.language)),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock('@/app/actions/locale', () => ({
  syncLocaleCookiesAction: jest.fn(() => Promise.resolve({ success: true })),
}));
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    discountPercent: 20,
    commissionPercent: 25,
    codesPerMonth: 15,
    regularPrice: 29,
    threeDayPrice: 5,
    calculateDiscountedPrice: (price: number) => price * 0.8,
  }),
}));

// The calendar is a third-party embed; record what it is asked to show.
const mockCalendarProps: Record<string, unknown>[] = [];
jest.mock('@/components/calendar/economic-calendar-widget', () => ({
  EconomicCalendarWidget: (props: Record<string, unknown>) => {
    mockCalendarProps.push(props);
    return <div data-testid="calendar" />;
  },
}));

import BlogPage from '@/app/(marketing)/blog/page';
import DocsPage from '@/app/(marketing)/docs/page';
import PublicHelpPage from '@/app/(marketing)/help/page';
import EconNewsPage from '@/app/(marketing)/econ-news/page';

const preferencesFor = (
  language: string,
  extra: Partial<LocalePreferences> = {}
): LocalePreferences => ({
  ...defaultPreferences,
  language,
  timezone: 'Europe/London',
  timezoneSetByUser: true,
  ...extra,
});

beforeAll(() => preloadDictionaries(['de']));

beforeEach(() => {
  localStorage.clear();
  mockCalendarProps.length = 0;
  mockRequest = preferencesFor('en-GB');
});

/** The providers the app mounts above every page, seeded as the server saw it. */
function inApp(ui: React.ReactElement): React.ReactElement {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(mockRequest));
  return (
    <LocaleProvider
      initialPreferences={mockRequest}
      detectedTimezone={mockRequest.timezone}
    >
      <AppearanceProvider>{ui}</AppearanceProvider>
    </LocaleProvider>
  );
}

describe('/blog', () => {
  it('shows every post, then only the category picked, then every post again', async () => {
    const user = userEvent.setup();
    render(inApp(await BlogPage()));

    const riskTitle = /Asymmetric Risk-to-Reward/;
    const fractalTitle = /Decoding Gold Fractal Geometry/;
    const aiTitle = /Conversational Quantitative Copilots/;
    for (const title of [fractalTitle, aiTitle, riskTitle]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: 'Risk Management' }));
    expect(screen.getByText(riskTitle)).toBeInTheDocument();
    expect(screen.queryByText(fractalTitle)).toBeNull();
    expect(screen.queryByText(aiTitle)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'All' }));
    for (const title of [fractalTitle, aiTitle, riskTitle]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('writes the dates in the visitor’s format, on the server', async () => {
    render(inApp(await BlogPage()));
    expect(screen.getByText('14/08/2026')).toBeInTheDocument();
    expect(screen.getByText('04/08/2026')).toBeInTheDocument();
  });

  it('names the categories in the request language but filters on the same ones', async () => {
    mockRequest = preferencesFor('de');
    const user = userEvent.setup();
    render(inApp(await BlogPage()));

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: german('Trading Intelligence Blog'),
      })
    ).toBeInTheDocument();
    // The pill says "Risikomanagement"; the post is filed under "Risk Management".
    await user.click(
      screen.getByRole('button', { name: german('Risk Management') })
    );
    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    // One post card (its title is an h3) and the newsletter's h3.
    expect(titles).toHaveLength(2);
    expect(titles.join(' ')).toMatch(/Asymmetrisch|Asymmetric/);
  });
});

describe('/docs', () => {
  it('opens the first two sections and leaves the rest closed', async () => {
    render(inApp(await DocsPage()));
    const toggles = screen.getAllByRole('button', { expanded: false });
    const open = screen.getAllByRole('button', { expanded: true });
    expect(open).toHaveLength(2);
    expect(toggles).toHaveLength(4);
  });

  it('filters the sections by the search text', async () => {
    const user = userEvent.setup();
    render(inApp(await DocsPage()));

    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(2);
    await user.type(
      screen.getByPlaceholderText('Search topics, signals, webhooks...'),
      'alert'
    );
    expect(screen.getByText('4. Real-Time Alert Engine')).toBeInTheDocument();
    expect(screen.queryByText('1. Getting Started & Setup')).toBeNull();
    expect(
      screen.queryByText('5. Subscriptions, Invoicing & dLocal/Stripe Billing')
    ).toBeNull();
  });

  it('fills the live commission rate into the affiliate section', async () => {
    const user = userEvent.setup();
    render(inApp(await DocsPage()));

    await user.click(
      screen.getByRole('button', { name: /6\. Affiliate Partner Program/ })
    );
    expect(
      screen.getByText(
        'Receive 25% recurring commissions disbursed directly to your Wise or RiseWorks account.'
      )
    ).toBeInTheDocument();
  });

  it('writes the sections in the request language', async () => {
    mockRequest = preferencesFor('de');
    render(inApp(await DocsPage()));
    expect(
      screen.getByText(german('1. Getting Started & Setup'))
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(german('Search topics, signals, webhooks...'))
    ).toBeInTheDocument();
  });
});

describe('/help', () => {
  it('has a search box that takes typing, and every question stays', async () => {
    const user = userEvent.setup();
    render(inApp(await PublicHelpPage()));

    const box = screen.getByPlaceholderText(
      'Search questions, billing, signals...'
    );
    await user.type(box, 'refund');
    expect(box).toHaveValue('refund');
    // Unchanged behaviour: the box has never narrowed the list.
    expect(
      screen.getByText('How do I reset my account password?')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Can I cancel my subscription anytime?')
    ).toBeInTheDocument();
  });
});

describe('/econ-news', () => {
  const last = (): Record<string, unknown> =>
    mockCalendarProps[mockCalendarProps.length - 1] ?? {};

  it('starts on every impact level and every region', async () => {
    render(inApp(await EconNewsPage()));
    expect(screen.getByTestId('calendar')).toBeInTheDocument();
    expect(last()['importanceFilter']).toBe('-1,0,1');
    expect(last()['countryFilter']).toBeUndefined();
    expect(last()['locale']).toBe(resolveTradingViewLocale('en-GB'));
  });

  it('passes the impact the visitor picks to the calendar', async () => {
    const user = userEvent.setup();
    render(inApp(await EconNewsPage()));

    await user.click(screen.getByRole('button', { name: 'High Impact Only' }));
    expect(last()['importanceFilter']).toBe('1');
    await user.click(screen.getByRole('button', { name: 'Medium & High' }));
    expect(last()['importanceFilter']).toBe('0,1');
    await user.click(screen.getByRole('button', { name: 'All Impact' }));
    expect(last()['importanceFilter']).toBe('-1,0,1');
  });

  it('passes the region the visitor picks to the calendar', async () => {
    const user = userEvent.setup();
    render(inApp(await EconNewsPage()));

    await user.click(screen.getByRole('button', { name: 'US Only' }));
    expect(last()['countryFilter']).toBe('us');
    await user.click(screen.getByRole('button', { name: 'Forex Majors' }));
    expect(last()['countryFilter']).toBe('us,eu,gb,jp,ca,au,ch,nz');
    await user.click(screen.getByRole('button', { name: 'Global (All)' }));
    expect(last()['countryFilter']).toBeUndefined();
  });

  it('keeps the two filters independent', async () => {
    const user = userEvent.setup();
    render(inApp(await EconNewsPage()));

    await user.click(screen.getByRole('button', { name: 'High Impact Only' }));
    await user.click(screen.getByRole('button', { name: 'Asia-Pacific' }));
    expect(last()['importanceFilter']).toBe('1');
    expect(last()['countryFilter']).toBe('cn,jp,au,nz,in,sg');
  });

  it('labels the toolbar in the request language', async () => {
    mockRequest = preferencesFor('de');
    render(inApp(await EconNewsPage()));
    expect(
      screen.queryByRole('button', { name: 'High Impact Only' })
    ).toBeNull();
    for (const key of ['All Impact', 'Medium & High', 'High Impact Only']) {
      expect(
        screen.getByRole('button', { name: german(key) })
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole('button', { name: german('econNews.region.us') })
    ).toBeInTheDocument();
  });
});

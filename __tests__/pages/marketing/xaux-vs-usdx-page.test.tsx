/**
 * /xaux-vs-usdx (T3-b): a Server Component page (heading, definitions) around
 * one client workspace -- the M5/M15 toggle in its header, the rebase panel and
 * the chart share state and the history fetch. The chart itself is loaded on
 * demand (T3-a).
 *
 * @module __tests__/pages/marketing/xaux-vs-usdx-page.test
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

const mockRequest: LocalePreferences = {
  ...defaultPreferences,
  language: 'en-GB',
  timezone: 'Europe/London',
  timezoneSetByUser: true,
};
jest.mock('@/lib/i18n/server-locale', () => ({
  getServerLocalePreferences: jest.fn(() => Promise.resolve(mockRequest)),
}));
jest.mock('next/navigation', () => ({ usePathname: () => '/xaux-vs-usdx' }));
jest.mock('@/app/actions/locale', () => ({
  syncLocaleCookiesAction: jest.fn(() => Promise.resolve({ success: true })),
}));

// The history fetch: record the timeframe it is asked for.
const mockTimeframes: string[] = [];
let mockHistory: { series: unknown[]; isLoading: boolean } = {
  series: [],
  isLoading: false,
};
jest.mock('@/components/market/useCurrencyIndexHistory', () => ({
  useCurrencyGoldIndexHistory: (timeframe: string) => {
    mockTimeframes.push(timeframe);
    return mockHistory;
  },
}));

// The upgrade card has its own session logic and tests.
jest.mock('@/components/market/currency-index-pro-upgrade-card', () => ({
  CurrencyIndexProUpgradeCard: () => <div data-testid="upgrade-card" />,
}));

// The chart is a canvas: record what it is given.
const mockChartProps: Record<string, unknown>[] = [];
jest.mock('@/components/market/xaux-usdx-comparison-chart', () => ({
  XauxUsdxComparisonChart: (props: Record<string, unknown>) => {
    mockChartProps.push(props);
    return <div data-testid="chart" />;
  },
}));

import XauxVsUsdxComparisonPage from '@/app/(marketing)/xaux-vs-usdx/page';

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

/** Renders the page and waits for the chart that loads on demand. */
async function renderPage(): Promise<ReturnType<typeof render>> {
  const view = render(inApp(await XauxVsUsdxComparisonPage()));
  await screen.findByTestId('chart');
  return view;
}

const lastChart = (): Record<string, unknown> =>
  mockChartProps[mockChartProps.length - 1] ?? {};

beforeEach(() => {
  localStorage.clear();
  mockTimeframes.length = 0;
  mockChartProps.length = 0;
  mockHistory = { series: [], isLoading: false };
});

describe('/xaux-vs-usdx', () => {
  it('renders the heading and both index definitions on the server', async () => {
    await renderPage();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'XAUX vs USDX Comparison Chart',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Gold Index (XAUX)')).toBeInTheDocument();
    expect(screen.getByText('USD Index (USDX)')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-card')).toBeInTheDocument();
  });

  it('loads the chart on demand, at the default rebase', async () => {
    await renderPage();
    expect(lastChart()['rebase']).toEqual({ XAUX: 100, USDX: 100 });
  });

  it('asks for M15 first and for M5 once the toggle is pressed', async () => {
    const user = userEvent.setup();
    await renderPage();
    expect(mockTimeframes.at(-1)).toBe('M15');

    await user.click(screen.getByRole('button', { name: 'M5' }));
    expect(mockTimeframes.at(-1)).toBe('M5');
    await user.click(screen.getByRole('button', { name: 'M15' }));
    expect(mockTimeframes.at(-1)).toBe('M15');
  });

  it('rebases a series from its slider, and Reset puts both back', async () => {
    const user = userEvent.setup();
    await renderPage();

    const reset = screen.getByRole('button', { name: 'Reset' });
    expect(reset).toBeDisabled();

    const [xauxSlider] = screen.getAllByRole('slider');
    xauxSlider?.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(lastChart()['rebase']).toEqual({ XAUX: 102, USDX: 100 });
    expect(reset).toBeEnabled();

    await user.click(reset);
    expect(lastChart()['rebase']).toEqual({ XAUX: 100, USDX: 100 });
    expect(reset).toBeDisabled();
  });

  it('says there is no data yet over the chart, until there is some', async () => {
    mockHistory = { series: [], isLoading: false };
    const { unmount } = await renderPage();
    expect(screen.getByText('No data available yet.')).toBeInTheDocument();
    unmount();

    mockHistory = {
      series: [{ symbol: 'XAUX', bars: [{ time: 1 }] }],
      isLoading: false,
    };
    await renderPage();
    expect(screen.queryByText('No data available yet.')).toBeNull();
  });

  it('does not say it while the history is still loading', async () => {
    mockHistory = { series: [], isLoading: true };
    await renderPage();
    expect(screen.queryByText('No data available yet.')).toBeNull();
  });
});

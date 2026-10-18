/**
 * The BI dashboards' charts are loaded on demand (T3-a): a placeholder of the
 * chart's own box first, the chart once its code has arrived.
 */
import { render, screen, waitFor } from '@testing-library/react';

import {
  LazyDonutMarketShare,
  LazyHistoricalTrendChart,
} from '@/components/admin/analytics/lazy-charts';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/admin/dashboards/regional',
}));

// recharts warns that jsdom gives its ResponsiveContainer no size; not the point here.
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function renderWithLocale(ui: React.ReactElement) {
  // Storage seeded so the provider makes no geo-IP call (LESSONS-LEARNED L40).
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
  return render(ui, { wrapper: LocaleProvider });
}

const slices = [
  { country: 'Thailand', iso: 'TH', count: 120, percentage: 60 },
  { country: 'Other Countries', iso: 'OTHERS', count: 80, percentage: 40 },
];

describe('LazyDonutMarketShare', () => {
  it('shows a ring-sized placeholder, then the chart with its legend', async () => {
    const { container } = renderWithLocale(
      <LazyDonutMarketShare
        data={slices}
        centerLabel="Total Users"
        centerValue="200"
      />
    );

    const placeholder = container.querySelector('[aria-busy="true"]');
    expect(placeholder).toHaveClass('h-52', 'w-52');
    expect(screen.queryByText('Thailand')).toBeNull();

    await waitFor(() => expect(screen.getByText('Thailand')).toBeVisible());
    expect(screen.getByText('Total Users')).toBeVisible();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });
});

describe('LazyHistoricalTrendChart', () => {
  it('shows a box of the chart height, then hands over to the chart', async () => {
    const { container } = renderWithLocale(
      <LazyHistoricalTrendChart
        data={[
          { monthLabel: 'Jan', conversionRate: 4, churnRate: 2 },
          { monthLabel: 'Feb', conversionRate: 5, churnRate: 1.5 },
        ]}
      />
    );

    expect(container.querySelector('[aria-busy="true"]')).toHaveClass(
      'h-64',
      'w-full'
    );

    // The chart's own wrapper is the same h-64 box, so nothing moves.
    await waitFor(() =>
      expect(container.querySelector('[aria-busy="true"]')).toBeNull()
    );
    expect(container.querySelector('.h-64.w-full')).not.toBeNull();
  });
});

/**
 * /pro/currency-index/compare workspace -- the controls added for ZigZag and
 * the Z-score candles, and what they hand the chart. The chart itself is a
 * canvas and is stubbed; the indicator math has its own suites.
 */
import React from 'react';
import {
  fireEvent,
  render as rtlRender,
  screen,
  within,
} from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

// 'jest' deliberately not imported from @jest/globals (hoisted factories).
jest.mock('next/navigation', () => ({
  usePathname: () => '/pro/currency-index/compare',
}));
jest.mock('@/components/providers/appearance-provider', () => ({
  useChartAppearance: () => ({
    resolvedTheme: 'dark',
    gridOpacityDecimal: 0.1,
  }),
}));
jest.mock(
  '@/components/currency-index-comparison/use-currency-index-comparison',
  () => ({
    useCurrencyIndexComparison: () => ({ series: [], isLoading: false }),
  })
);

const chartProps: Record<string, unknown>[] = [];
jest.mock(
  '@/components/currency-index-comparison/currency-index-comparison-chart',
  () => {
    const actual = jest.requireActual(
      '@/components/currency-index-comparison/currency-index-comparison-chart'
    ) as Record<string, unknown>;
    return {
      ...actual,
      CurrencyIndexComparisonChart: (props: Record<string, unknown>) => {
        chartProps.push(props);
        return null;
      },
    };
  }
);

import { CurrencyIndexComparisonWorkspace } from '@/components/currency-index-comparison/currency-index-comparison-workspace';

function render() {
  return rtlRender(<CurrencyIndexComparisonWorkspace />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>{children}</LocaleProvider>
    ),
  });
}

const lastChartProps = () => chartProps[chartProps.length - 1] ?? {};

describe('CurrencyIndexComparisonWorkspace', () => {
  beforeEach(() => {
    chartProps.length = 0;
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('offers four plot types in order, including No Plot', () => {
    render();
    const group = screen.getByRole('group', { name: 'Plot type' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual(['No Plot', 'Line', 'OHLC Candles', 'Heiken Ashi']);

    fireEvent.click(within(group).getByRole('button', { name: 'No Plot' }));
    expect(lastChartProps().plotType).toBe('none');
  });

  it('starts ZigZag and MC at the requested defaults, shown on both indices', () => {
    render();
    expect(lastChartProps()).toMatchObject({
      zigzagDepth: 12,
      zscoreLength: 54,
      zscoreThreshold1: 1.5,
      zscoreThreshold2: 2.5,
    });
    for (const symbol of ['XAUX', 'USDX']) {
      const group = screen.getByRole('group', { name: symbol });
      expect(
        within(group)
          .getAllByRole('button')
          .map((b) => [b.textContent, b.getAttribute('aria-pressed')])
      ).toEqual([
        ['HRMA(36)', 'true'],
        ['SMMA(13)', 'true'],
        ['ZigZag (12,5,3)', 'true'],
        ['MC (54,1.5,2.5)', 'true'],
      ]);
    }
  });

  it("hides ZigZag and MC per index, leaving the other index's untouched", () => {
    render();
    const slotFlags = () => {
      const slots = lastChartProps().slots as Record<
        'A' | 'B',
        { showZigzag: boolean; showZscore: boolean }
      >;
      return {
        A: [slots.A.showZigzag, slots.A.showZscore],
        B: [slots.B.showZigzag, slots.B.showZscore],
      };
    };
    const xaux = within(screen.getByRole('group', { name: 'XAUX' }));
    const usdx = within(screen.getByRole('group', { name: 'USDX' }));
    expect(slotFlags()).toEqual({ A: [true, true], B: [true, true] });

    fireEvent.click(xaux.getByRole('button', { name: /ZigZag \(12,5,3\)/ }));
    expect(slotFlags()).toEqual({ A: [false, true], B: [true, true] });

    fireEvent.click(usdx.getByRole('button', { name: /MC \(54,1\.5,2\.5\)/ }));
    expect(slotFlags()).toEqual({ A: [false, true], B: [true, false] });
    expect(
      usdx.getByRole('button', { name: /ZigZag \(12,5,3\)/ })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('has sliders for Depth and all three MC inputs, and no slider for Deviation or Back Step', () => {
    render();
    for (const name of [
      'HRMA period',
      'SMMA period',
      'Depth',
      'Z-Score MA Length',
      'First Threshold',
      'Second Threshold',
    ]) {
      expect(screen.getByRole('slider', { name })).toBeInTheDocument();
    }
    const sliderLabels = screen
      .getAllByRole('slider')
      .map((el) => el.getAttribute('aria-label'));
    expect(sliderLabels.some((l) => /Deviation|Back Step/.test(l ?? ''))).toBe(
      false
    );

    // Shown as fixed values, with the reason.
    expect(screen.getByText('Deviation').nextSibling).toHaveTextContent('5');
    expect(screen.getByText('Back Step').nextSibling).toHaveTextContent('3');
    expect(
      screen.getByText(/MT5 ZigZag v43 does not use them/)
    ).toBeInTheDocument();
  });

  it('keys the ZigZag weights and the four MC classes while any index shows them', () => {
    render();
    for (const label of [
      'Normal',
      'Large',
      'Extreme',
      'Up Large',
      'Up Extreme',
      'Down Large',
      'Down Extreme',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    const mcChip = (symbol: string) =>
      within(screen.getByRole('group', { name: symbol })).getByRole('button', {
        name: /MC \(54,1\.5,2\.5\)/,
      });

    fireEvent.click(mcChip('XAUX'));
    expect(screen.getByText('Up Extreme')).toBeInTheDocument();

    fireEvent.click(mcChip('USDX'));
    expect(screen.queryByText('Up Extreme')).toBeNull();
    expect(screen.getByText('Extreme')).toBeInTheDocument();
  });
});

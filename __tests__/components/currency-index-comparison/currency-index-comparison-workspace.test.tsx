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

  it('starts ZigZag and MC at the requested defaults, both shown', () => {
    render();
    expect(lastChartProps()).toMatchObject({
      zigzagDepth: 12,
      zscoreLength: 54,
      zscoreThreshold1: 1.5,
      zscoreThreshold2: 2.5,
      showZigzag: true,
      showZscore: true,
    });
    expect(
      screen.getByRole('button', { name: /ZigZag \(12,5,3\)/ })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: /MC \(54,1\.5,2\.5\)/ })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides and shows ZigZag and MC independently with one chip each', () => {
    render();
    const zigzag = screen.getByRole('button', { name: /ZigZag \(12,5,3\)/ });
    const mc = screen.getByRole('button', { name: /MC \(54,1\.5,2\.5\)/ });

    fireEvent.click(zigzag);
    expect(lastChartProps()).toMatchObject({
      showZigzag: false,
      showZscore: true,
    });
    expect(zigzag).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(mc);
    expect(lastChartProps()).toMatchObject({
      showZigzag: false,
      showZscore: false,
    });

    fireEvent.click(zigzag);
    expect(lastChartProps()).toMatchObject({
      showZigzag: true,
      showZscore: false,
    });
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
      // components/ui/slider.tsx puts aria-label on the Radix Root, not on
      // the role="slider" thumb, so query the labelled root.
      expect(screen.getByLabelText(name)).toHaveAttribute(
        'data-slot',
        'slider'
      );
    }
    const sliderLabels = Array.from(
      document.querySelectorAll('[data-slot="slider"]')
    ).map((el) => el.getAttribute('aria-label'));
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

  it('keys the ZigZag weights and the four MC classes while each is shown', () => {
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
    fireEvent.click(
      screen.getByRole('button', { name: /MC \(54,1\.5,2\.5\)/ })
    );
    expect(screen.queryByText('Up Extreme')).toBeNull();
    expect(screen.getByText('Extreme')).toBeInTheDocument();
  });
});

/**
 * The two comparison charts (`/pro/currency-index/compare` and the public
 * `/xaux-vs-usdx`) -- the mouse wheel must scroll the page with the pointer
 * over the chart, and Ctrl/Cmd+wheel must still reach the chart to zoom it.
 *
 * lightweight-charts is a canvas and is mocked: it takes every vertical wheel
 * event to zoom and cancels it, so the real chart would swallow the page
 * scroll. A child element of the chart's container with its own `wheel`
 * listener stands in for the chart's own DOM, as `release-wheel-to-page.test.ts`
 * does for the helper. The drawing layer is stubbed; it needs a real chart.
 */
import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';

jest.mock('next/navigation', () => ({
  usePathname: () => '/xaux-vs-usdx',
}));

// 'jest' deliberately not imported from @jest/globals (hoisted factories).
jest.mock('lightweight-charts', () => {
  // Every method the charts call on the chart or on a series is a no-op.
  const stub = (own: Record<string, unknown> = {}): unknown =>
    new Proxy(own, {
      get: (target, key) =>
        key in target
          ? target[key as string]
          : typeof key === 'string'
            ? jest.fn()
            : undefined,
    });
  return {
    createChart: jest.fn(() =>
      stub({
        addSeries: () => stub(),
        // No pane: the XAUX chart then skips its watermark.
        panes: () => [],
        timeScale: () => stub(),
      })
    ),
    createTextWatermark: jest.fn(() => stub()),
    LineSeries: 'Line',
    CandlestickSeries: 'Candlestick',
    LineStyle: { Dashed: 2, Dotted: 1 },
    ColorType: { Solid: 'solid' },
  };
});
jest.mock('@/components/providers/appearance-provider', () => ({
  useChartAppearance: () => ({
    resolvedTheme: 'dark',
    gridOpacityDecimal: 0.1,
  }),
}));
jest.mock('@/components/market/comparison-drawing-layer', () => ({
  ComparisonDrawingLayer: () => null,
}));

import { CurrencyIndexComparisonChart } from '@/components/currency-index-comparison/currency-index-comparison-chart';
import { XauxUsdxComparisonChart } from '@/components/market/xaux-usdx-comparison-chart';

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

const wheel = (init: WheelEventInit = {}): WheelEvent =>
  new WheelEvent('wheel', {
    deltaY: 100,
    bubbles: true,
    cancelable: true,
    ...init,
  });

const charts: [string, () => React.ReactElement][] = [
  [
    'CurrencyIndexComparisonChart (/pro/currency-index/compare)',
    () => (
      <CurrencyIndexComparisonChart
        slots={{ A: null, B: null }}
        plotType="line"
        hrmaPeriod={20}
        smmaPeriod={20}
        zigzagDepth={12}
        zscoreLength={20}
        zscoreThreshold1={2}
        zscoreThreshold2={3}
        fitKey="M15"
      />
    ),
  ],
  [
    'XauxUsdxComparisonChart (/xaux-vs-usdx)',
    () => <XauxUsdxComparisonChart series={[]} />,
  ],
];

describe.each(charts)('%s', (_name, makeChart) => {
  beforeEach(() => {
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
  });

  it('lets the wheel scroll the page over the chart, and Ctrl+wheel zoom it', () => {
    const { container, unmount } = render(makeChart());
    // The element createChart() receives; the chart's own DOM goes inside it.
    const chartHost = container.querySelector(
      'div.relative > div.w-full'
    ) as HTMLElement;
    const chartElement = document.createElement('div');
    chartHost.appendChild(chartElement);
    const chartSaw = jest.fn();
    chartElement.addEventListener('wheel', chartSaw);

    const plain = wheel();
    chartElement.dispatchEvent(plain);
    expect(chartSaw).not.toHaveBeenCalled();
    // Uncancelled, so the browser scrolls the page.
    expect(plain.defaultPrevented).toBe(false);

    chartElement.dispatchEvent(wheel({ ctrlKey: true }));
    expect(chartSaw).toHaveBeenCalledTimes(1);
    chartElement.dispatchEvent(wheel({ metaKey: true }));
    expect(chartSaw).toHaveBeenCalledTimes(2);

    // The interception goes with the chart: nothing is left on the container.
    unmount();
    chartElement.dispatchEvent(wheel());
    expect(chartSaw).toHaveBeenCalledTimes(3);
  });
});

/**
 * RelativeStrengthChart -- hiding currency lines, and keeping the corridor
 * bands and news markers on screen whichever lines are hidden.
 *
 * lightweight-charts is a canvas and is mocked; each addSeries() call gets
 * its own recording series so the test can tell the host from the 8 lines.
 */
import React from 'react';
import { act, render as rtlRender } from '@testing-library/react';
import { describe, it, expect, beforeEach } from '@jest/globals';

import { LocaleProvider, useLocale } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';
import type { CurrencyCode } from '@/lib/currency-index-pro/pairs';
import type { CurrencyIndexChartData } from '@/components/currency-index-pro/hooks/use-currency-index-chart';

jest.mock('next/navigation', () => ({
  usePathname: () => '/pro/currency-index',
}));

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: LocaleProvider });
}

interface MockSeries {
  options: Record<string, unknown>;
  applyOptions: jest.Mock;
  setData: jest.Mock;
  createPriceLine: jest.Mock;
  removePriceLine: jest.Mock;
  attachPrimitive: jest.Mock;
  detachPrimitive: jest.Mock;
}

const mockSeries: MockSeries[] = [];

// 'jest' deliberately not imported from @jest/globals (hoisted factories).
jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => ({
    addSeries: (_type: unknown, options: Record<string, unknown>) => {
      const series = {
        options,
        applyOptions: jest.fn(),
        setData: jest.fn(),
        createPriceLine: jest.fn((opts: unknown) => opts),
        removePriceLine: jest.fn(),
        attachPrimitive: jest.fn(),
        detachPrimitive: jest.fn(),
      };
      mockSeries.push(series);
      return series;
    },
    applyOptions: jest.fn(),
    remove: jest.fn(),
    timeScale: () => ({ fitContent: jest.fn(), timeToCoordinate: () => 0 }),
    subscribeCrosshairMove: jest.fn(),
    unsubscribeCrosshairMove: jest.fn(),
  })),
  LineSeries: 'Line',
  LineStyle: { Dashed: 2, Dotted: 1 },
  ColorType: { Solid: 'solid' },
}));
jest.mock('@/components/providers/appearance-provider', () => ({
  useChartAppearance: () => ({
    resolvedTheme: 'dark',
    gridOpacityDecimal: 0.1,
  }),
}));

import { RelativeStrengthChart } from '@/components/currency-index-pro/chart/relative-strength-chart';

const data: CurrencyIndexChartData = {
  timeframe: 'M15',
  serverTime: 0,
  todaySessionOpen: 900,
  corridor: {
    date: 0,
    lookbackDays: 20,
    strikeZonePct: 0.78,
    extremeZonePct: 1.2,
    meanExcursion: 0.5,
    stdDev: 0.3,
  },
  highImpactNews: [
    {
      valueId: '1',
      eventId: '1',
      eventName: 'Nonfarm Payrolls',
      eventTime: 1800,
      currency: 'USD',
      countryCode: 'US',
      importance: 'HIGH',
      forecastValue: null,
      previousValue: null,
      digits: null,
      timeMode: null,
      sourceUrl: null,
    },
  ],
  series: {
    USDX: [
      { barTime: 900, changePct: 0 },
      { barTime: 1800, changePct: 0.2 },
    ],
    EURX: [
      { barTime: 900, changePct: 0 },
      { barTime: 2700, changePct: -0.1 },
    ],
  },
};

// Host is added first, then the 8 currencies in ALL_CURRENCIES order.
const host = () => mockSeries[0] as MockSeries;
const line = (currency: CurrencyCode) =>
  mockSeries.find((s) => s.options.title === currency) as MockSeries;
const lastVisible = (s: MockSeries) =>
  s.applyOptions.mock.calls
    .map(([opts]) => (opts as { visible?: boolean }).visible)
    .filter((v) => v !== undefined)
    .at(-1);

describe('RelativeStrengthChart', () => {
  beforeEach(() => {
    mockSeries.length = 0;
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

  it('creates a stroke-less host beneath the 8 currency lines, outside autoscale', () => {
    render(<RelativeStrengthChart data={data} />);

    expect(mockSeries).toHaveLength(9);
    expect(host().options).toMatchObject({
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const provider = host().options.autoscaleInfoProvider as () => unknown;
    expect(provider()).toBeNull();
    expect(mockSeries.slice(1).map((s) => s.options.title)).toEqual([
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'AUD',
      'CAD',
      'CHF',
      'NZD',
    ]);
  });

  it('gives the host every bar time any currency has', () => {
    render(<RelativeStrengthChart data={data} />);
    expect(host().setData).toHaveBeenLastCalledWith([
      { time: 900, value: 0 },
      { time: 1800, value: 0 },
      { time: 2700, value: 0 },
    ]);
  });

  it('shows every line when nothing is hidden', () => {
    render(<RelativeStrengthChart data={data} />);
    for (const s of mockSeries.slice(1)) expect(lastVisible(s)).toBe(true);
  });

  it('hides exactly the chosen lines, and shows them again', () => {
    const { rerender } = render(
      <RelativeStrengthChart
        data={data}
        hiddenCurrencies={new Set<CurrencyCode>(['USD', 'JPY'])}
      />
    );
    expect(lastVisible(line('USD'))).toBe(false);
    expect(lastVisible(line('JPY'))).toBe(false);
    expect(lastVisible(line('EUR'))).toBe(true);
    // The host is never hidden.
    expect(lastVisible(host())).toBeUndefined();

    rerender(
      <RelativeStrengthChart
        data={data}
        hiddenCurrencies={new Set<CurrencyCode>(['JPY'])}
      />
    );
    expect(lastVisible(line('USD'))).toBe(true);
    expect(lastVisible(line('JPY'))).toBe(false);
  });

  it('draws the corridor bands and news markers on the host, never on a currency line', () => {
    render(
      <RelativeStrengthChart
        data={data}
        hiddenCurrencies={new Set<CurrencyCode>(['USD'])}
      />
    );

    expect(
      host().createPriceLine.mock.calls.map(
        ([opts]) => (opts as { title: string; price: number }).title
      )
    ).toEqual(['Overbought', 'Oversold', 'Extreme', 'Extreme']);
    expect(host().attachPrimitive).toHaveBeenCalledTimes(1);

    for (const s of mockSeries.slice(1)) {
      expect(s.createPriceLine).not.toHaveBeenCalled();
      expect(s.attachPrimitive).not.toHaveBeenCalled();
    }
  });

  it('leaves the corridor alone when lines are hidden or shown', () => {
    const { rerender } = render(<RelativeStrengthChart data={data} />);
    const created = host().createPriceLine.mock.calls.length;

    rerender(
      <RelativeStrengthChart
        data={data}
        hiddenCurrencies={new Set<CurrencyCode>(['USD', 'EUR'])}
      />
    );
    expect(host().createPriceLine.mock.calls.length).toBe(created);
    expect(host().removePriceLine).not.toHaveBeenCalled();
  });

  // The band titles are drawn on the canvas, so they do not re-render with
  // React; they must be redrawn when the language changes.
  it('redraws the corridor band titles in a new language', () => {
    let setPrefs: ReturnType<
      typeof useLocale
    >['setLocalePreferences'] = () => {};
    function LanguageSwitch(): null {
      setPrefs = useLocale().setLocalePreferences;
      return null;
    }
    render(
      <>
        <LanguageSwitch />
        <RelativeStrengthChart data={data} />
      </>
    );
    const titles = () =>
      host()
        .createPriceLine.mock.calls.slice(-4)
        .map(([opts]) => (opts as { title: string }).title);
    expect(titles()).toEqual(['Overbought', 'Oversold', 'Extreme', 'Extreme']);

    act(() => setPrefs({ language: 'th' }));

    expect(titles()).toEqual([
      'ซื้อมากเกินไป',
      'ขายมากเกินไป',
      'รุนแรง',
      'รุนแรง',
    ]);
    // The English lines were taken down, not left underneath.
    expect(host().removePriceLine).toHaveBeenCalledTimes(4);
  });
});

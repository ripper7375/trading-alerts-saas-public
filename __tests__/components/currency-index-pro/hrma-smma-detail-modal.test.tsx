/**
 * HrmaSmmaDetailModal -- the HRMA/SMMA show/hide chips, the helper series
 * that keeps the bands, marker and warm-up line on screen, and line color
 * following the inspected currency.
 *
 * lightweight-charts is a canvas and is mocked; each addSeries() call gets its
 * own recording series so the test can tell the host from HRMA and SMMA.
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
import type { CurrencyCode } from '@/lib/currency-index-pro/pairs';
import type { CurrencyIndexDetailData } from '@/components/currency-index-pro/hooks/use-currency-index-detail';

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
const mockMarkerHosts: unknown[] = [];

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
  })),
  createSeriesMarkers: jest.fn((series: unknown) => {
    mockMarkerHosts.push(series);
    return { setMarkers: jest.fn(), detach: jest.fn() };
  }),
  LineSeries: 'Line',
  LineStyle: { Dashed: 2, Dotted: 1 },
  ColorType: { Solid: 'solid' },
}));
jest.mock('next/navigation', () => ({
  usePathname: () => '/pro/currency-index',
}));
jest.mock('@/components/providers/appearance-provider', () => ({
  useChartAppearance: () => ({
    resolvedTheme: 'dark',
    gridOpacityDecimal: 0.1,
  }),
}));

const detail: CurrencyIndexDetailData = {
  currency: 'EUR',
  indexName: 'EURX',
  serverTime: 0,
  corridor: {
    date: 0,
    lookbackDays: 20,
    strikeZonePct: 0.78,
    extremeZonePct: 1.2,
    meanExcursion: 0.5,
    stdDev: 0.3,
  },
  hrmaPeriod: 5,
  smmaPeriod: 3,
  minBarsForSignal: 5,
  signal: 'NONE',
  series: Array.from({ length: 12 }, (_, i) => ({
    barTime: 1000 + i * 900,
    changePct: Math.sin(i / 2) * 0.5,
    zone: 'NEUTRAL' as const,
    hrma: 0,
    smma: null,
  })),
};

jest.mock(
  '@/components/currency-index-pro/hooks/use-currency-index-detail',
  () => ({
    useCurrencyIndexDetail: () => ({ data: detail, isLoading: false }),
  })
);

class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

import { HrmaSmmaDetailModal } from '@/components/currency-index-pro/chart/hrma-smma-detail-modal';

function renderModal(currency: CurrencyCode = 'EUR') {
  return rtlRender(
    <HrmaSmmaDetailModal open currency={currency} onOpenChange={jest.fn()} />,
    {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <LocaleProvider>{children}</LocaleProvider>
      ),
    }
  );
}

// Host is added first, then HRMA, then SMMA.
const host = () => mockSeries[0] as MockSeries;
const byTitle = (title: string) =>
  mockSeries.find((s) => s.options.title === title) as MockSeries;
const lastOption = (s: MockSeries, key: string) =>
  s.applyOptions.mock.calls
    .map(([opts]) => (opts as Record<string, unknown>)[key])
    .filter((v) => v !== undefined)
    .at(-1);
const chip = (name: RegExp) =>
  within(screen.getByRole('group', { name: 'Indicator lines' })).getByRole(
    'button',
    { name }
  );

describe('HrmaSmmaDetailModal', () => {
  beforeEach(() => {
    mockSeries.length = 0;
    mockMarkerHosts.length = 0;
    // Seeding skips LocaleProvider's real geo-IP fetch() (L40).
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  it('adds a stroke-less host carrying the HRMA values beneath both lines', () => {
    renderModal();

    expect(mockSeries.map((s) => s.options.title)).toEqual([
      undefined,
      'HRMA',
      'SMMA',
    ]);
    expect(host().options).toMatchObject({
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    const hostData = host().setData.mock.calls.at(-1)?.[0] as unknown[];
    expect(hostData).toHaveLength(detail.series.length);
    expect(hostData).toEqual(byTitle('HRMA').setData.mock.calls.at(-1)?.[0]);
  });

  it('puts the bands, BUY/SELL marker and warm-up line on the host only', () => {
    renderModal();

    expect(
      host().createPriceLine.mock.calls.map(
        ([opts]) => (opts as { title: string }).title
      )
    ).toEqual(['Overbought', 'Oversold']);
    expect(host().attachPrimitive).toHaveBeenCalled();
    expect(mockMarkerHosts).toEqual([host()]);

    for (const title of ['HRMA', 'SMMA']) {
      expect(byTitle(title).createPriceLine).not.toHaveBeenCalled();
      expect(byTitle(title).attachPrimitive).not.toHaveBeenCalled();
    }
  });

  it("colors both lines with the inspected currency's hue, not USD's or EUR's", () => {
    const { rerender } = renderModal('EUR');
    // EUR's dark slot hue (lib/currency-index-pro/colors.ts).
    expect(lastOption(byTitle('HRMA'), 'color')).toBe('#d95926');
    expect(lastOption(byTitle('SMMA'), 'color')).toBe('#d95926');
    expect(byTitle('SMMA').options.lineStyle).toBe(2); // dashed

    rerender(
      <HrmaSmmaDetailModal open currency="JPY" onOpenChange={jest.fn()} />
    );
    expect(lastOption(byTitle('HRMA'), 'color')).toBe('#c98500');
    expect(lastOption(byTitle('SMMA'), 'color')).toBe('#c98500');
  });

  it('shows both lines by default, with pressed chips naming each period', () => {
    renderModal();
    expect(chip(/HRMA \(5\)/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/SMMA \(3\)/)).toHaveAttribute('aria-pressed', 'true');
    expect(lastOption(byTitle('HRMA'), 'visible')).toBe(true);
    expect(lastOption(byTitle('SMMA'), 'visible')).toBe(true);
  });

  it('hides and re-shows HRMA and SMMA independently, never the host', () => {
    renderModal();
    const bandsBuilt = host().createPriceLine.mock.calls.length;
    expect(bandsBuilt).toBeGreaterThan(0);

    fireEvent.click(chip(/HRMA/));
    expect(chip(/HRMA/)).toHaveAttribute('aria-pressed', 'false');
    expect(chip(/HRMA/)).toHaveAttribute('title', 'Click to show');
    expect(lastOption(byTitle('HRMA'), 'visible')).toBe(false);
    expect(lastOption(byTitle('SMMA'), 'visible')).toBe(true);

    fireEvent.click(chip(/SMMA/));
    expect(lastOption(byTitle('SMMA'), 'visible')).toBe(false);

    fireEvent.click(chip(/HRMA/));
    expect(lastOption(byTitle('HRMA'), 'visible')).toBe(true);

    expect(lastOption(host(), 'visible')).toBeUndefined();
    // Toggling never rebuilds or removes the bands.
    expect(host().createPriceLine.mock.calls.length).toBe(bandsBuilt);
    expect(host().removePriceLine).not.toHaveBeenCalled();
  });
});

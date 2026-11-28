/**
 * HighImpactNewsTooltip against a REAL lightweight-charts chart: it must open
 * over the news line, wherever the line was placed.
 */

import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import type {
  IChartApi,
  ISeriesApi,
  Logical,
  MouseEventParams,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';

import { HighImpactNewsTooltip } from '@/components/currency-index-pro/chart/high-impact-news-tooltip';
import type { CurrencyIndexNewsEvent } from '@/components/currency-index-pro/hooks/use-currency-index-chart';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

import {
  loadRealLibrary,
  settle,
  type Library,
} from '../../helpers/real-lightweight-charts';

jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
}));

const MINUTE = 60;
const M15 = 15 * MINUTE;
const FIRST_BAR = Date.UTC(2026, 10, 25, 8, 0) / 1000;
const BAR_COUNT = 20;
const LAST = BAR_COUNT - 1;
const barTime = (index: number): number => FIRST_BAR + index * M15;

const news = (eventName: string, eventTime: number): CurrencyIndexNewsEvent =>
  ({
    eventName,
    eventTime,
    countryCode: 'US',
    currency: 'USD',
    forecastValue: null,
    previousValue: null,
  }) as CurrencyIndexNewsEvent;

/** A speech ten minutes into bar 5, and a release two bars from now. */
const EVENTS = [
  news('Speech', barTime(5) + 10 * MINUTE),
  news('Release', barTime(LAST) + 2 * M15),
];

let library: Library;
let chart: IChartApi | null = null;

async function renderTooltip(): Promise<{
  hover: (slot: number, time?: number) => void;
}> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const created = library.createChart(container, {
    width: 800,
    height: 400,
    timeScale: { rightOffset: 10 },
  });
  chart = created;
  const series: ISeriesApi<'Line'> = created.addSeries(library.LineSeries);
  series.setData(
    Array.from({ length: BAR_COUNT }, (_, index) => ({
      time: barTime(index) as UTCTimestamp,
      value: 100,
    }))
  );
  created.timeScale().fitContent();
  await settle();

  const subscribe = jest.spyOn(created, 'subscribeCrosshairMove');
  render(
    <LocaleProvider>
      <HighImpactNewsTooltip chart={created} series={series} events={EVENTS} />
    </LocaleProvider>
  );
  const handler = subscribe.mock.calls[subscribe.mock.calls.length - 1]![0];

  return {
    // What the library reports with the pointer over that slot: no `time`
    // right of the last bar.
    hover: (slot, time) => {
      const x = created.timeScale().logicalToCoordinate(slot as Logical)!;
      act(() =>
        handler({
          point: { x, y: 20 },
          time: time as Time | undefined,
        } as unknown as MouseEventParams<Time>)
      );
    },
  };
}

describe('HighImpactNewsTooltip on a real chart', () => {
  beforeAll(() => {
    library = loadRealLibrary();
    // Skips LocaleProvider's geo-IP request.
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
  });

  afterEach(() => {
    chart?.remove();
    chart = null;
    document.body.innerHTML = '';
  });

  it('opens over a line that sits on the bar containing its event', async () => {
    const { hover } = await renderTooltip();

    hover(5, barTime(5));

    expect(screen.getByText('Speech')).toBeInTheDocument();
  });

  it('stays closed on the neighbouring bar, which has no line', async () => {
    const { hover } = await renderTooltip();

    hover(6, barTime(6));

    expect(screen.queryByText('Speech')).toBeNull();
  });

  it('opens over an upcoming line, right of the last bar', async () => {
    const { hover } = await renderTooltip();

    hover(LAST + 2);

    expect(screen.getByText('Release')).toBeInTheDocument();
  });

  it('stays closed away from every line', async () => {
    const { hover } = await renderTooltip();

    hover(LAST + 6);
    expect(screen.queryByText('Release')).toBeNull();
    hover(12, barTime(12));
    expect(screen.queryByText('Speech')).toBeNull();
  });
});

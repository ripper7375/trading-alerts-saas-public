/**
 * EventVerticalLine against the REAL lightweight-charts time scale: a stubbed
 * `timeToCoordinate` cannot show where a line really lands.
 */

import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import type {
  IChartApi,
  ISeriesApi,
  Logical,
  SeriesType,
  UTCTimestamp,
} from 'lightweight-charts';

import { EventVerticalLine } from '@/components/charts/drawing/EventVerticalLine';

import {
  loadRealLibrary,
  settle,
  type Library,
} from '../helpers/real-lightweight-charts';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const BAR_SECONDS = 15 * MINUTE;
/** Wednesday 2026-11-25 08:00 UTC, an ordinary trading morning. */
const FIRST_BAR = Date.UTC(2026, 10, 25, 8, 0) / 1000;
const BAR_COUNT = 20;
const LAST = BAR_COUNT - 1;
/** Empty bar slots left of the price scale, so the near future is on screen. */
const RIGHT_OFFSET = 10;

const barTime = (index: number): number => FIRST_BAR + index * BAR_SECONDS;

const barTimes = (count: number): number[] =>
  Array.from({ length: count }, (_, index) => barTime(index));

const candles = (times: number[]) =>
  times.map((time) => ({
    time: time as UTCTimestamp,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
  }));

const points = (times: number[]) =>
  times.map((time) => ({ time: time as UTCTimestamp, value: 100 }));

let library: Library;
let chart: IChartApi | null = null;

function createChart(): IChartApi {
  const container = document.createElement('div');
  document.body.appendChild(container);
  chart = library.createChart(container, {
    width: 800,
    height: 400,
    timeScale: { rightOffset: RIGHT_OFFSET },
  });
  return chart;
}

async function renderCandles(times: number[] = barTimes(BAR_COUNT)): Promise<{
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'>;
}> {
  const created = createChart();
  const series = created.addSeries(library.CandlestickSeries);
  series.setData(candles(times));
  created.timeScale().fitContent();
  await settle();
  return { chart: created, series };
}

/** Runs the primitive's own draw path and returns where it painted, if it did. */
function drawnX(line: EventVerticalLine): number | null {
  const painted: number[] = [];
  line.updateAllViews();
  const target = {
    useBitmapCoordinateSpace: (draw: (scope: unknown) => void) =>
      draw({
        context: { fillStyle: '', fillRect: (x: number) => painted.push(x) },
        horizontalPixelRatio: 1,
        bitmapSize: { width: 800, height: 400 },
      }),
  };
  const renderer = line.paneViews()[0]!.renderer()!;
  renderer.draw(target as unknown as Parameters<typeof renderer.draw>[0]);
  return painted[0] ?? null;
}

function attachLine(
  target: IChartApi,
  series: ISeriesApi<SeriesType>,
  time: number
): EventVerticalLine {
  const line = new EventVerticalLine(target, series, time as UTCTimestamp);
  series.attachPrimitive(line);
  return line;
}

const xOfIndex = (target: IChartApi, index: number): number =>
  target.timeScale().logicalToCoordinate(index as Logical)!;

/** The line sits on that slot of the time scale (one pixel of rounding). */
function expectOnSlot(
  target: IChartApi,
  line: EventVerticalLine,
  index: number
): void {
  const x = drawnX(line);
  expect(x).not.toBeNull();
  expect(Math.abs(x! - xOfIndex(target, index))).toBeLessThanOrEqual(1);
}

describe('EventVerticalLine on a real lightweight-charts time scale', () => {
  beforeAll(() => {
    library = loadRealLibrary();
  });

  afterEach(() => {
    chart?.remove();
    chart = null;
    document.body.innerHTML = '';
  });

  describe('an event inside the recorded bars', () => {
    it('draws on a bar when the time is exactly that bar', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(rendered, series, barTime(5));

      expect(rendered.timeScale().width()).toBeGreaterThan(0);
      expectOnSlot(rendered, line, 5);
    });

    it('draws on the candle whose period contains it', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(rendered, series, barTime(5) + 10 * MINUTE);

      expectOnSlot(rendered, line, 5);
    });

    it('draws on the forming candle when it is inside the last one', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(rendered, series, barTime(LAST) + 10 * MINUTE);

      expectOnSlot(rendered, line, LAST);
    });

    it('draws on the first candle after a closed market', async () => {
      const beforeClose = barTimes(10);
      const reopen = barTime(9) + 4 * HOUR;
      const afterReopen = barTimes(10).map(
        (_, index) => reopen + index * BAR_SECONDS
      );
      const { chart: rendered, series } = await renderCandles([
        ...beforeClose,
        ...afterReopen,
      ]);
      const line = attachLine(rendered, series, barTime(9) + 2 * HOUR);

      expectOnSlot(rendered, line, 10);
    });

    it('draws nothing for an event older than the first bar', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(rendered, series, barTime(0) - 5 * MINUTE);

      expect(drawnX(line)).toBeNull();
    });

    it('draws on a line-series host as well as on candles', async () => {
      const rendered = createChart();
      const series = rendered.addSeries(library.LineSeries, {
        lineVisible: false,
      });
      series.setData(points(barTimes(BAR_COUNT)));
      rendered.timeScale().fitContent();
      await settle();

      const exact = attachLine(rendered, series, barTime(7));
      const inside = attachLine(rendered, series, barTime(8) + MINUTE);

      expectOnSlot(rendered, exact, 7);
      expectOnSlot(rendered, inside, 8);
    });
  });

  describe('an upcoming event', () => {
    it('draws in the visible future area, in the slot of its candle', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(rendered, series, barTime(LAST) + 30 * MINUTE);
      const slot = xOfIndex(rendered, LAST + 2);

      // Guard: the slot under test is on screen, to the right of the last bar.
      expect(slot).toBeGreaterThan(xOfIndex(rendered, LAST));
      expect(slot).toBeLessThan(rendered.timeScale().width());
      expectOnSlot(rendered, line, LAST + 2);
    });

    it('uses the same slot for a time between two future candle opens', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(rendered, series, barTime(LAST) + 40 * MINUTE);

      expectOnSlot(rendered, line, LAST + 2);
    });

    it('stays on that candle once the bars arrive', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(rendered, series, barTime(LAST) + 40 * MINUTE);
      expectOnSlot(rendered, line, LAST + 2);

      series.setData(candles(barTimes(BAR_COUNT + 4)));
      await settle();

      expectOnSlot(rendered, line, LAST + 2);
    });

    it('is drawn up to 24 hours past the last bar', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(rendered, series, barTime(LAST) + 24 * HOUR);

      expectOnSlot(rendered, line, LAST + 96);
    });

    it('is not drawn further than 24 hours past the last bar', async () => {
      const { chart: rendered, series } = await renderCandles();
      const line = attachLine(
        rendered,
        series,
        barTime(LAST) + 24 * HOUR + MINUTE
      );

      expect(drawnX(line)).toBeNull();
    });
  });

  /**
   * The M15 chart's multi-timeframe overlay adds M5 points, so a candle is
   * three slots of the time scale apart from the next, not one.
   */
  describe('with an M5 overlay on an M15 chart', () => {
    const OVERLAY_FROM = 10;
    /** Slot of candle `index` (>= OVERLAY_FROM) once the overlay is on. */
    const slotOfCandle = (index: number): number =>
      OVERLAY_FROM + (index - OVERLAY_FROM) * 3;

    async function renderWithOverlay() {
      const rendered = await renderCandles();
      const overlay = rendered.chart.addSeries(library.LineSeries);
      // M5 points from candle 10 to ten minutes past the last candle's open.
      const count = (LAST - OVERLAY_FROM) * 3 + 3;
      overlay.setData(
        points(
          Array.from(
            { length: count },
            (_, index) => barTime(OVERLAY_FROM) + index * 5 * MINUTE
          )
        )
      );
      rendered.chart.timeScale().fitContent();
      await settle();
      expect(
        rendered.chart.timeScale().timeToIndex(barTime(LAST) as UTCTimestamp)
      ).toBe(slotOfCandle(LAST));
      return rendered;
    }

    it('draws a past event on its candle, not on an overlay point', async () => {
      const { chart: rendered, series } = await renderWithOverlay();
      const line = attachLine(rendered, series, barTime(15) + 10 * MINUTE);

      expectOnSlot(rendered, line, slotOfCandle(15));
    });

    it('draws an upcoming event three slots per candle ahead', async () => {
      const { chart: rendered, series } = await renderWithOverlay();
      const line = attachLine(rendered, series, barTime(LAST) + 30 * MINUTE);

      expectOnSlot(rendered, line, slotOfCandle(LAST + 2));
    });
  });
});

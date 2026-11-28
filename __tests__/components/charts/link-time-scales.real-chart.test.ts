/**
 * The "Padlock TF" sync between two REAL lightweight-charts charts. The linked
 * charts must end at the same moment, including the empty area right of the
 * last candle, where upcoming news lines are drawn.
 */

import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

import { linkTimeScales } from '@/components/charts/mtf/linkTimeScales';

import {
  loadRealLibrary,
  settle,
  type Library,
} from '../../helpers/real-lightweight-charts';

const M5 = 5 * 60;
const M15 = 15 * 60;
/** Open of the newest M15 candle; the newest M5 candle opened ten minutes on. */
const NOW = Date.UTC(2026, 10, 25, 12, 0) / 1000;
const M5_LAST = NOW + 2 * M5;
const RIGHT_OFFSET = 12;
/** Frames for a change to be painted, copied to the other chart and settle. */
const FRAMES = 5;

let library: Library;
const series = new Map<IChartApi, ISeriesApi<'Candlestick'>>();
let unlink: (() => void) | null = null;

const times = (last: number, step: number, count: number): UTCTimestamp[] =>
  Array.from(
    { length: count },
    (_, index) => (last - (count - 1 - index) * step) as UTCTimestamp
  );

const candle = (time: number) => ({
  time: time as UTCTimestamp,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
});

function createChart(
  candleTimes: UTCTimestamp[],
  rightOffset = RIGHT_OFFSET
): IChartApi {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chart = library.createChart(container, {
    width: 800,
    height: 300,
    timeScale: { rightOffset },
  });
  const candles = chart.addSeries(library.CandlestickSeries);
  candles.setData(candleTimes.map(candle));
  series.set(chart, candles);
  return chart;
}

/** The M15 chart over the M5 chart, as the terminal stacks them. */
async function renderPair({
  upperTimes = times(NOW, M15, 100),
  lowerTimes = times(M5_LAST, M5, 300),
  rightOffset = RIGHT_OFFSET,
} = {}): Promise<{ upper: IChartApi; lower: IChartApi }> {
  const upper = createChart(upperTimes, rightOffset);
  const lower = createChart(lowerTimes, rightOffset);
  upper.timeScale().fitContent();
  lower.timeScale().fitContent();
  await settle(FRAMES);
  return { upper, lower };
}

/** Adds the M5 points the multi-timeframe overlay puts on the M15 chart. */
function addOverlay(chart: IChartApi): void {
  chart
    .addSeries(library.LineSeries)
    .setData(times(M5_LAST, M5, 30).map((time) => ({ time, value: 100 })));
}

/** The moment a chart ends at: where its right-most slot is over. */
const rightEdge = (chart: IChartApi, last: number, step: number): number =>
  last + (chart.timeScale().scrollPosition() + 1) * step;

async function link(upper: IChartApi, lower: IChartApi): Promise<void> {
  unlink = linkTimeScales(upper, lower);
  await settle(FRAMES);
}

/** What the browser reports before the library acts on a drag or the wheel. */
const touch = (chart: IChartApi, type: 'pointerdown' | 'wheel'): void => {
  const inner =
    chart.chartElement().querySelector('canvas') ?? chart.chartElement();
  // A real wheel event with no movement: the library reads its deltas too.
  const init = { bubbles: true };
  inner.dispatchEvent(
    type === 'wheel' ? new WheelEvent(type, init) : new Event(type, init)
  );
};

describe('linkTimeScales on real charts', () => {
  beforeAll(() => {
    library = loadRealLibrary();
  });

  afterEach(() => {
    unlink?.();
    unlink = null;
    [...series.keys()].forEach((chart) => chart.remove());
    series.clear();
    document.body.innerHTML = '';
  });

  it('keeps the empty area right of the candles when the link is made', async () => {
    const { upper, lower } = await renderPair();
    await link(upper, lower);

    expect(upper.timeScale().scrollPosition()).toBeCloseTo(RIGHT_OFFSET, 3);
    expect(rightEdge(lower, M5_LAST, M5)).toBeCloseTo(
      rightEdge(upper, NOW, M15),
      0
    );
    expect(lower.timeScale().getVisibleRange()!.from).toBe(
      upper.timeScale().getVisibleRange()!.from
    );
  });

  it('keeps the newest candles in view when there is no empty area', async () => {
    const { upper, lower } = await renderPair({ rightOffset: 0 });
    await link(upper, lower);

    expect(lower.timeScale().scrollPosition()).toBeCloseTo(0, 3);
    expect(upper.timeScale().scrollPosition()).toBeCloseTo(0, 3);
  });

  it('follows the upper chart further ahead', async () => {
    const { upper, lower } = await renderPair();
    await link(upper, lower);

    touch(upper, 'pointerdown');
    upper.timeScale().scrollToPosition(24, false);
    await settle(FRAMES);

    expect(upper.timeScale().scrollPosition()).toBeCloseTo(24, 3);
    expect(rightEdge(lower, M5_LAST, M5)).toBeCloseTo(
      rightEdge(upper, NOW, M15),
      0
    );
  });

  it.each(['pointerdown', 'wheel'] as const)(
    'follows the lower chart once the user moves it (%s)',
    async (gesture) => {
      const { upper, lower } = await renderPair();
      await link(upper, lower);

      touch(lower, gesture);
      lower.timeScale().scrollToPosition(60, false);
      await settle(FRAMES);

      expect(lower.timeScale().scrollPosition()).toBeCloseTo(60, 3);
      expect(rightEdge(upper, NOW, M15)).toBeCloseTo(
        rightEdge(lower, M5_LAST, M5),
        0
      );
    }
  );

  it('does not drift while new candles arrive on both charts', async () => {
    const { upper, lower } = await renderPair();
    await link(upper, lower);
    const width = (): number => {
      const range = upper.timeScale().getVisibleLogicalRange()!;
      return range.to - range.from;
    };
    const widthBefore = width();

    // One hour: an M5 candle every five minutes, an M15 one every third time.
    let newestM15 = NOW;
    let newestM5 = M5_LAST;
    for (let step = 1; step <= 12; step++) {
      newestM5 = M5_LAST + step * M5;
      if (newestM5 >= newestM15 + M15) {
        newestM15 += M15;
        series.get(upper)!.update(candle(newestM15));
      }
      series.get(lower)!.update(candle(newestM5));
      await settle(FRAMES);
    }

    expect(upper.timeScale().scrollPosition()).toBeCloseTo(RIGHT_OFFSET, 3);
    expect(Math.abs(width() - widthBefore)).toBeLessThanOrEqual(1);
    expect(rightEdge(lower, newestM5, M5)).toBeCloseTo(
      rightEdge(upper, newestM15, M15),
      0
    );
  });

  it('settles once the charts agree', async () => {
    const { upper, lower } = await renderPair();
    await link(upper, lower);
    let changes = 0;
    const count = (): void => {
      changes++;
    };
    upper.timeScale().subscribeVisibleLogicalRangeChange(count);
    lower.timeScale().subscribeVisibleLogicalRangeChange(count);

    series.get(lower)!.update(candle(M5_LAST + M5));
    await settle(FRAMES * 2);
    const afterNewCandle = changes;
    await settle(FRAMES * 2);

    expect(changes).toBe(afterNewCandle);
  });

  it('counts the finer slots an overlay adds to the upper chart', async () => {
    // Three slots per M15 candle at the right edge, so 36 for the same room.
    const upper = createChart(times(NOW, M15, 100), 3 * RIGHT_OFFSET);
    addOverlay(upper);
    const lower = createChart(times(M5_LAST, M5, 300));
    upper.timeScale().fitContent();
    lower.timeScale().fitContent();
    await settle(FRAMES);

    await link(upper, lower);

    expect(lower.timeScale().scrollPosition()).toBeCloseTo(36, 3);
    expect(rightEdge(lower, M5_LAST, M5)).toBeCloseTo(
      rightEdge(upper, M5_LAST, M5),
      0
    );
  });

  it('leaves the leading chart alone when the other has less history', async () => {
    const { upper, lower } = await renderPair({
      lowerTimes: times(M5_LAST, M5, 100),
    });
    const before = upper.timeScale().getVisibleLogicalRange()!;

    await link(upper, lower);

    const after = upper.timeScale().getVisibleLogicalRange()!;
    expect(after.from).toBeCloseTo(before.from, 3);
    expect(after.to).toBeCloseTo(before.to, 3);
  });

  // Further back than the overlay reaches, a slot is 15 minutes again, so
  // counting slots from the newest point would give the wrong moment.
  it('copies a stretch of history from beyond an overlay', async () => {
    const upper = createChart(times(NOW, M15, 100));
    addOverlay(upper);
    const lower = createChart(times(M5_LAST, M5, 300));
    upper.timeScale().fitContent();
    lower.timeScale().fitContent();
    await settle(FRAMES);
    await link(upper, lower);

    touch(upper, 'pointerdown');
    upper.timeScale().scrollToPosition(-40, false);
    await settle(FRAMES);

    const seen = upper.timeScale().getVisibleRange()!;
    const copied = lower.timeScale().getVisibleRange()!;
    expect(lower.timeScale().scrollPosition()).toBeLessThan(0);
    expect(
      Math.abs((copied.to as number) - (seen.to as number))
    ).toBeLessThanOrEqual(M15);
    expect(
      Math.abs((copied.from as number) - (seen.from as number))
    ).toBeLessThanOrEqual(M15);
  });

  it('stops following once unlinked', async () => {
    const { upper, lower } = await renderPair();
    await link(upper, lower);
    unlink!();
    unlink = null;
    const before = lower.timeScale().scrollPosition();

    touch(upper, 'pointerdown');
    upper.timeScale().scrollToPosition(24, false);
    await settle(FRAMES);

    expect(lower.timeScale().scrollPosition()).toBe(before);
  });
});

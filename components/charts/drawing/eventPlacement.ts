/**
 * eventPlacement — where an event time belongs on a chart's time scale.
 *
 * `timeToCoordinate` only answers for a time that is exactly a point of the time
 * scale, which an event usually is not: an upcoming one is past the last bar and
 * a released one can be inside a bar. So the event goes on the bar of the host
 * series whose period contains it:
 *
 *  - within the recorded bars: on that bar, or on the first bar afterwards when
 *    the market was closed at that time;
 *  - past the last bar: on the slot its bar will take, counted from the last one;
 *  - before the first bar, or more than MAX_SECONDS_AHEAD ahead: nowhere.
 *
 * Slots ahead are counted in clock time, so across a short market closure (gold's
 * daily halt) a position is too far right until bars resume. The limit ahead is
 * shorter than a weekend, so nothing is placed on the far side of one.
 *
 * @module components/charts/drawing/eventPlacement
 */

import type {
  Coordinate,
  IChartApi,
  ISeriesApi,
  Logical,
  MismatchDirection,
  SeriesType,
  Time,
} from 'lightweight-charts';

export const MAX_SECONDS_AHEAD = 24 * 60 * 60;

/** Recent bars the bar period is measured on: enough to outvote a few gaps. */
const SAMPLE_BARS = 20;
/** Newest bar-to-bar steps the slot width of one bar is measured on. */
const SLOT_SAMPLE_STEPS = 5;

// MismatchDirection values, used as numbers so tests that mock
// lightweight-charts do not need the enum.
const NEAREST_LEFT = -1 as MismatchDirection;
const NEAREST_RIGHT = 1 as MismatchDirection;

/** A bar of the host series and the time-scale slot it occupies. */
interface Bar {
  time: number;
  slot: number;
}

/** The host bar at `slot`, or the nearest one in `direction`. */
function findBar(
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  slot: number,
  direction: MismatchDirection
): Bar | null {
  const time = series.dataByIndex(slot, direction)?.time;
  if (typeof time !== 'number') return null;
  const found = chart.timeScale().timeToIndex(time, false);
  return found === null ? null : { time, slot: found };
}

/** The last bars of the host series, newest first. */
function recentBars(chart: IChartApi, series: ISeriesApi<SeriesType>): Bar[] {
  const bars: Bar[] = [];
  let bar = findBar(chart, series, Number.MAX_SAFE_INTEGER, NEAREST_LEFT);
  while (bar && bars.length <= SAMPLE_BARS) {
    bars.push(bar);
    bar = findBar(chart, series, bar.slot - 1, NEAREST_LEFT);
  }
  return bars;
}

const median = (values: number[]): number | undefined =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export function eventCoordinate(
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  time: Time
): Coordinate | null {
  const timeScale = chart.timeScale();
  if (typeof time !== 'number') return timeScale.timeToCoordinate(time);

  const bars = recentBars(chart, series);
  const steps = bars.slice(1).map((older, i) => ({
    seconds: bars[i]!.time - older.time,
    slots: bars[i]!.slot - older.slot,
  }));
  const last = bars[0];
  const period = median(steps.map((step) => step.seconds));
  // Fewer than two bars say nothing about a period: exact matches only.
  if (!last || period === undefined) return timeScale.timeToCoordinate(time);

  const x = (slot: number): Coordinate | null =>
    timeScale.logicalToCoordinate(slot as Logical);

  if (time >= last.time) {
    const secondsAhead = time - last.time;
    if (secondsAhead > MAX_SECONDS_AHEAD) return null;
    // More than one slot per bar when another series adds finer points, as the
    // multi-timeframe overlay does. Measured on the newest bars, because such a
    // series need not reach back as far as the host does.
    const slotsPerBar = median(
      steps
        .filter((step) => step.seconds === period)
        .slice(0, SLOT_SAMPLE_STEPS)
        .map((step) => step.slots)
    )!;
    return x(last.slot + Math.floor(secondsAhead / period) * slotsPerBar);
  }

  // The first time-scale point at or after the event; its bar may be later.
  const next = timeScale.timeToIndex(time, true);
  if (next === null) return null;
  let bar = findBar(chart, series, next, NEAREST_LEFT);
  if (bar && bar.time > time) {
    bar = findBar(chart, series, next - 1, NEAREST_LEFT);
  }
  if (bar && time - bar.time >= period) {
    bar = findBar(chart, series, bar.slot + 1, NEAREST_RIGHT);
  }
  return bar ? x(bar.slot) : null;
}

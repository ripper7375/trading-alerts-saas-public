/**
 * linkTimeScales — the "Padlock TF" sync of the stacked M15 and M5 charts.
 *
 * A visible TIME range ends at the newest point, so copying it alone removed the
 * empty area right of the last candle, where upcoming news lines are drawn, from
 * both charts. When a chart shows its newest candle, the moment at its right
 * edge is worked out and given to the other chart in that chart's own slots.
 *
 * Only one chart leads at a time: the one the user moved last. A new candle
 * moves a chart by one of its own candles, so copying every change in both
 * directions added the two charts' moves together and the view drifted away.
 *
 * @module components/charts/mtf/linkTimeScales
 */

import type {
  IChartApi,
  ITimeScaleApi,
  Logical,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';

/** Later than any bar: asking for it returns the newest time-scale point. */
const AFTER_EVERY_BAR = 1e12 as UTCTimestamp;
/** Newest point-to-point steps the length of one slot is measured on. */
const SLOT_SAMPLE_STEPS = 5;
/** The newest point is still on screen while less than half of it has left. */
const NEWEST_IN_VIEW = -0.5;

/** The newest point of a time scale and the seconds one slot stands for. */
interface RightEnd {
  slot: number;
  time: number;
  slotSeconds: number;
}

function rightEnd(timeScale: ITimeScaleApi<Time>): RightEnd | null {
  const slot = timeScale.timeToIndex(AFTER_EVERY_BAR, true);
  if (slot === null) return null;

  // Newest first. A scale answers for a time only through a coordinate.
  const times: number[] = [];
  for (let back = 0; back <= SLOT_SAMPLE_STEPS && back <= slot; back++) {
    const x = timeScale.logicalToCoordinate((slot - back) as number as Logical);
    const time = x === null ? null : timeScale.coordinateToTime(x);
    if (typeof time !== 'number') break;
    times.push(time);
  }
  const steps = times
    .slice(1)
    .map((older, i) => times[i]! - older)
    .sort((a, b) => a - b);
  const slotSeconds = steps[Math.floor(steps.length / 2)];
  return slotSeconds ? { slot, time: times[0]!, slotSeconds } : null;
}

/** Shows on `target` the stretch of time `source` shows. */
function copyTimeWindow(source: IChartApi, target: IChartApi): void {
  const from = source.timeScale();
  const to = target.timeScale();
  const range = from.getVisibleRange();
  if (!range) return;

  // Empty slots right of the newest point; negative when looking at history.
  const emptySlots = from.scrollPosition();
  if (emptySlots > NEWEST_IN_VIEW) {
    const sourceEnd = rightEnd(from);
    const targetEnd = rightEnd(to);
    const first = to.timeToIndex(range.from, true);
    if (sourceEnd && targetEnd && first !== null) {
      // A slot lasts until the next one starts, so both charts end where their
      // right-most slot is over, not where it begins.
      const edge = sourceEnd.time + (emptySlots + 1) * sourceEnd.slotSeconds;
      to.setVisibleLogicalRange({
        from: first,
        to:
          targetEnd.slot + (edge - targetEnd.time) / targetEnd.slotSeconds - 1,
      });
      return;
    }
  }
  to.setVisibleRange(range);
}

/**
 * Keeps two charts on the same stretch of time until the returned function is
 * called. The first chart leads when the link is made; the lead passes to
 * whichever chart the user drags or scrolls.
 */
export function linkTimeScales(
  upperChartApi: IChartApi,
  lowerChartApi: IChartApi
): () => void {
  let leader = upperChartApi;
  // Runs on a change of either chart: the follower's own moves are undone. It
  // ends by itself, because setting the same range again reports no change.
  const follow = (): void => {
    const follower = leader === upperChartApi ? lowerChartApi : upperChartApi;
    try {
      copyTimeWindow(leader, follower);
    } catch {
      // Safe guard if a chart timeScale is not ready
    }
  };

  const watch = (chart: IChartApi): (() => void) => {
    const takeLead = (): void => {
      leader = chart;
    };
    // Capture phase: the lead must change before the chart reports its move.
    const element = chart.chartElement();
    element.addEventListener('pointerdown', takeLead, true);
    element.addEventListener('wheel', takeLead, {
      capture: true,
      passive: true,
    });
    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange(follow);

    return () => {
      element.removeEventListener('pointerdown', takeLead, true);
      element.removeEventListener('wheel', takeLead, true);
      try {
        timeScale.unsubscribeVisibleLogicalRangeChange(follow);
      } catch {
        // Cleanup guard
      }
    };
  };

  follow();
  const stops = [watch(upperChartApi), watch(lowerChartApi)];
  return () => stops.forEach((stop) => stop());
}

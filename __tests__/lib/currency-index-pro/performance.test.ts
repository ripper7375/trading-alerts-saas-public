/**
 * Phase 5 V5 verification: "Adjusting OB/OS sliders updates chart threshold
 * lines and table badges in < 5ms" -- previously asserted from Big-O
 * reasoning alone (a single pass over <=~100 data points). This turns that
 * claim into a measured, regression-tested number using the exact same
 * pure functions the HRMA/SMMA detail modal's what-if sliders call on every
 * `onValueChange` tick.
 *
 * @module __tests__/lib/currency-index-pro/performance
 */
import { computeHrma, computeSmma } from '@/lib/currency-index-pro/math';
import {
  classifyZone,
  detectStageBSignal,
  type SignalBar,
} from '@/lib/currency-index-pro/signals';

const CORRIDOR = { strikeZonePct: 0.78 };
// A full trading day of M15 bars: 24h * 4 bars/hour = 96, the maximum this
// app's data model ever produces for one currency in one day (Phase 1's own
// daily-reset design) -- the realistic upper bound for a what-if recompute.
const BAR_COUNT = 96;

function syntheticChangePcts(n: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    values.push(0.9 * Math.sin(i / 6));
  }
  return values;
}

/** One full what-if recompute: exactly what a slider's onValueChange does. */
function recomputeOnce(
  changePcts: number[],
  hrmaPeriod: number,
  smmaPeriod: number
): void {
  const hrma = computeHrma(changePcts, hrmaPeriod);
  const smma = computeSmma(changePcts, smmaPeriod);
  const bars: SignalBar[] = changePcts.map((changePct, i) => ({
    zone: classifyZone(changePct, CORRIDOR),
    hrma: hrma[i] as number,
    smma: smma[i] as number | null,
  }));
  detectStageBSignal(bars, 6, Math.max(hrmaPeriod, smmaPeriod));
}

describe('what-if recompute performance (spec V5: "< 5ms" reactivity)', () => {
  it('recomputes a full 96-bar day well under 5ms on average', () => {
    const changePcts = syntheticChangePcts(BAR_COUNT);
    const iterations = 200;

    // One untimed warm-up pass so JIT warm-up doesn't inflate the first
    // measured iteration.
    recomputeOnce(changePcts, 36, 13);

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      // Vary the period each iteration, same as a slider actually dragging
      // through a range rather than recomputing the identical call.
      recomputeOnce(changePcts, 10 + (i % 90), 5 + (i % 45));
    }
    const elapsedMs = performance.now() - start;
    const perCallMs = elapsedMs / iterations;

    console.log(
      `what-if recompute: ${perCallMs.toFixed(4)}ms/call average over ${iterations} calls (96 bars each)`
    );

    expect(perCallMs).toBeLessThan(5);
  });
});

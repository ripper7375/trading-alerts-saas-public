import { Timeframe } from './slot';

/**
 * "1 day of OHLC" (STACK-D-ARCHITECTURE.md section 1.3, rule 4, ADR-003): the
 * last 288 closed M5 bars and 96 closed M15 bars, trading bars only.
 *
 * The same numbers are the sender's priority set (PRIORITY_CLOSED_BARS in the
 * push worker) and the window the closed-bar digest covers, so a cycle is
 * declared ready on exactly the bars the sensors and the prompt will read.
 * test/closed-bars-digest.spec.ts pins them to the architecture document.
 */
export const ONE_DAY_CLOSED_BARS: Readonly<Record<Timeframe, number>> =
  Object.freeze({
    M5: 288,
    M15: 96,
  });

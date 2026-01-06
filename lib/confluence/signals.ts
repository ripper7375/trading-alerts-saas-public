/**
 * Part 20 - Phase 06: Signal Detection
 *
 * Detects bullish/bearish/neutral signals from indicator data.
 * Used by confluence calculator to determine trend direction and strength.
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 9
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 6
 */

import type {
  TimeframeData,
  SignalDetail,
  SignalDirection,
} from './types';

/**
 * Detect all signals from timeframe data
 *
 * Analyzes 10 indicators (excluding OHLC, fractals, trendlines):
 * 1. Momentum candles
 * 2. Keltner channels (price position)
 * 3. TEMA (price vs moving average)
 * 4. HRMA (price vs moving average)
 * 5. SMMA (price vs moving average)
 * 6. ZigZag (trend direction)
 *
 * @param tfData - Timeframe indicator data
 * @returns Array of signal details
 */
export function detectSignals(tfData: TimeframeData): SignalDetail[] {
  const signals: SignalDetail[] = [];
  const currentPrice = tfData.ohlc.close;

  // 1. Moving Average Signals (TEMA, HRMA, SMMA)
  // Price above MA = bullish, below = bearish
  if (tfData.tema !== null) {
    signals.push({
      indicator: 'tema',
      direction: currentPrice > tfData.tema ? 'bullish' : 'bearish',
      weight: 0.15,
      reason: `Price ${currentPrice > tfData.tema ? 'above' : 'below'} TEMA`,
    });
  }

  if (tfData.hrma !== null) {
    signals.push({
      indicator: 'hrma',
      direction: currentPrice > tfData.hrma ? 'bullish' : 'bearish',
      weight: 0.15,
      reason: `Price ${currentPrice > tfData.hrma ? 'above' : 'below'} HRMA`,
    });
  }

  if (tfData.smma !== null) {
    signals.push({
      indicator: 'smma',
      direction: currentPrice > tfData.smma ? 'bullish' : 'bearish',
      weight: 0.15,
      reason: `Price ${currentPrice > tfData.smma ? 'above' : 'below'} SMMA`,
    });
  }

  // 2. Momentum Candles
  // UP_LARGE/EXTREME = bullish, DOWN_LARGE/EXTREME = bearish
  const recentMomentum = tfData.momentum_candles
    .slice(0, 5) // Check last 5 candles
    .filter((mc) => mc.type === 1 || mc.type === 2 || mc.type === 4 || mc.type === 5);

  if (recentMomentum.length > 0) {
    const bullishCount = recentMomentum.filter((mc) => mc.type === 1 || mc.type === 2).length;
    const bearishCount = recentMomentum.filter((mc) => mc.type === 4 || mc.type === 5).length;

    if (bullishCount > bearishCount) {
      signals.push({
        indicator: 'momentum_candles',
        direction: 'bullish',
        weight: 0.2,
        reason: `${bullishCount} bullish momentum candles in last 5`,
      });
    } else if (bearishCount > bullishCount) {
      signals.push({
        indicator: 'momentum_candles',
        direction: 'bearish',
        weight: 0.2,
        reason: `${bearishCount} bearish momentum candles in last 5`,
      });
    }
  }

  // 3. Keltner Channels
  // Price position relative to channels indicates trend strength
  const keltner = tfData.keltner_channels;
  if (keltner && keltner.upper && keltner.lower && keltner.upper.length > 0) {
    const upperBand = keltner.upper[0];
    const lowerBand = keltner.lower[0];
    const upperMiddle = keltner.upper_middle?.[0];
    const lowerMiddle = keltner.lower_middle?.[0];

    if (upperBand !== null && lowerBand !== null) {
      // Strong bullish: above upper middle
      if (upperMiddle !== undefined && upperMiddle !== null && currentPrice > upperMiddle) {
        signals.push({
          indicator: 'keltner_channels',
          direction: 'bullish',
          weight: 0.15,
          reason: 'Price in upper half of Keltner Channel',
        });
      }
      // Strong bearish: below lower middle
      else if (lowerMiddle !== undefined && lowerMiddle !== null && currentPrice < lowerMiddle) {
        signals.push({
          indicator: 'keltner_channels',
          direction: 'bearish',
          weight: 0.15,
          reason: 'Price in lower half of Keltner Channel',
        });
      }
      // Neutral: in middle
      else {
        signals.push({
          indicator: 'keltner_channels',
          direction: 'neutral',
          weight: 0.05,
          reason: 'Price in middle of Keltner Channel',
        });
      }
    }
  }

  // 4. ZigZag (Trend Direction)
  // Recent peak > previous peak = bullish
  // Recent bottom < previous bottom = bearish
  const zigzag = tfData.zigzag;
  if (zigzag && zigzag.peaks.length >= 2 && zigzag.bottoms.length >= 2) {
    const latestPeak = zigzag.peaks[0];
    const previousPeak = zigzag.peaks[1];
    const latestBottom = zigzag.bottoms[0];
    const previousBottom = zigzag.bottoms[1];

    // Higher highs and higher lows = strong bullish
    if (
      latestPeak &&
      previousPeak &&
      latestBottom &&
      previousBottom &&
      latestPeak.price > previousPeak.price &&
      latestBottom.price > previousBottom.price
    ) {
      signals.push({
        indicator: 'zigzag',
        direction: 'bullish',
        weight: 0.2,
        reason: 'Higher highs and higher lows (uptrend)',
      });
    }
    // Lower highs and lower lows = strong bearish
    else if (
      latestPeak &&
      previousPeak &&
      latestBottom &&
      previousBottom &&
      latestPeak.price < previousPeak.price &&
      latestBottom.price < previousBottom.price
    ) {
      signals.push({
        indicator: 'zigzag',
        direction: 'bearish',
        weight: 0.2,
        reason: 'Lower highs and lower lows (downtrend)',
      });
    }
    // Mixed signals = neutral
    else {
      signals.push({
        indicator: 'zigzag',
        direction: 'neutral',
        weight: 0.1,
        reason: 'Mixed highs and lows (ranging)',
      });
    }
  }

  return signals;
}

/**
 * Get overall trend direction from signals
 *
 * @param signals - Array of signal details
 * @returns Overall trend direction
 */
export function getTrendDirection(signals: SignalDetail[]): SignalDirection {
  if (signals.length === 0) return 'neutral';

  // Calculate weighted score
  let bullishScore = 0;
  let bearishScore = 0;
  let neutralScore = 0;

  for (const signal of signals) {
    if (signal.direction === 'bullish') {
      bullishScore += signal.weight;
    } else if (signal.direction === 'bearish') {
      bearishScore += signal.weight;
    } else {
      neutralScore += signal.weight;
    }
  }

  // Determine dominant direction
  const maxScore = Math.max(bullishScore, bearishScore, neutralScore);

  // Require at least 10% advantage to avoid neutral
  const threshold = 0.1;

  if (maxScore === bullishScore && bullishScore > bearishScore + threshold) {
    return 'bullish';
  } else if (maxScore === bearishScore && bearishScore > bullishScore + threshold) {
    return 'bearish';
  } else {
    return 'neutral';
  }
}

/**
 * Get signal strength (0-1 scale)
 *
 * Strength is based on:
 * - How many signals agree on direction
 * - Total weight of aligned signals
 *
 * @param signals - Array of signal details
 * @returns Strength value between 0 and 1
 */
export function getSignalStrength(signals: SignalDetail[]): number {
  if (signals.length === 0) return 0;

  const direction = getTrendDirection(signals);
  if (direction === 'neutral') return 0.3; // Neutral has low strength

  // Calculate alignment strength
  const alignedSignals = signals.filter((s) => s.direction === direction);
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  const alignedWeight = alignedSignals.reduce((sum, s) => sum + s.weight, 0);

  // Strength = (aligned weight / total weight)
  const strength = totalWeight > 0 ? alignedWeight / totalWeight : 0;

  // Normalize to 0-1 range
  return Math.max(0, Math.min(1, strength));
}

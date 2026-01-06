/**
 * Part 20 - Phase 06: Confluence Score Calculator
 *
 * Calculates confluence score by analyzing 117 indicators (13 indicators × 9 timeframes).
 * Score range: 0-10
 * - 0-3: Weak/conflicting signals
 * - 4-6: Moderate confluence
 * - 7-10: Strong confluence (high-probability setup)
 *
 * @see docs/sqlite-and-mt5service/part-20-architecture-design.md Section 9
 * @see docs/sqlite-and-mt5service/part-20-implementation-plan.md Phase 6
 */

import type {
  MultiTimeframeData,
  ConfluenceResult,
  TimeframeSignal,
} from './types';
import { detectSignals, getTrendDirection, getSignalStrength } from './signals';
import { VALID_TIMEFRAMES } from '@/lib/constants/business-rules';

/**
 * Calculate confluence score from multi-timeframe data
 *
 * Algorithm:
 * 1. Analyze each timeframe independently
 * 2. Detect bullish/bearish/neutral signals
 * 3. Calculate alignment (how many timeframes agree)
 * 4. Calculate strength (how strong the signals are)
 * 5. Combine into 0-10 score: alignment * 5 + avgStrength * 5
 *
 * @param data - Multi-timeframe indicator data (117 indicators)
 * @returns Confluence result with score, breakdown, and all indicator data
 *
 * @example
 * const data = await getMultiTimeframeData('EURUSD', '2026-01-03T17:00:00Z');
 * const confluence = calculateConfluenceScore(data);
 * console.log(confluence.confluence_score); // 7.5
 * console.log(confluence.signals); // { bullish: 5, bearish: 2, neutral: 2 }
 */
export function calculateConfluenceScore(
  data: MultiTimeframeData
): ConfluenceResult {
  const breakdown: Record<string, TimeframeSignal> = {};
  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;
  let totalStrength = 0;
  let validTimeframes = 0;

  // Analyze each timeframe
  for (const timeframe of VALID_TIMEFRAMES) {
    const tfData = data[timeframe];

    // Skip timeframes with no data
    if (!tfData) {
      console.warn(
        `[ConfluenceCalculator] No data for timeframe ${timeframe}, skipping`
      );
      continue;
    }

    try {
      // Detect signals for this timeframe
      const signals = detectSignals(tfData);
      const trend = getTrendDirection(signals);
      const strength = getSignalStrength(signals);

      // Store breakdown
      breakdown[timeframe] = {
        trend,
        strength,
        signals,
      };

      // Update counts
      if (trend === 'bullish') {
        bullishCount++;
      } else if (trend === 'bearish') {
        bearishCount++;
      } else {
        neutralCount++;
      }

      totalStrength += strength;
      validTimeframes++;
    } catch (error) {
      console.error(
        `[ConfluenceCalculator] Error analyzing ${timeframe}:`,
        error
      );
    }
  }

  // Handle edge case: no valid timeframes
  if (validTimeframes === 0) {
    console.warn('[ConfluenceCalculator] No valid timeframes, returning zero score');
    return {
      confluence_score: 0,
      max_score: 10,
      signals: {
        bullish: 0,
        bearish: 0,
        neutral: 0,
      },
      breakdown: {} as Record<string, TimeframeSignal>,
      all_117_indicators: data,
    };
  }

  // Calculate alignment score (0-1)
  // How much do timeframes agree?
  // Perfect alignment (all bullish or all bearish) = 1.0
  // Complete disagreement (equal split) = 0.0
  const dominantCount = Math.max(bullishCount, bearishCount, neutralCount);
  const alignment = dominantCount / validTimeframes;

  // Calculate average strength (0-1)
  const avgStrength = totalStrength / validTimeframes;

  // Calculate final confluence score (0-10)
  // Formula: alignment * 5 + avgStrength * 5
  // - alignment contributes 0-5 points
  // - avgStrength contributes 0-5 points
  const confluenceScore = alignment * 5 + avgStrength * 5;

  // Round to 1 decimal place
  const roundedScore = Math.round(confluenceScore * 10) / 10;

  return {
    confluence_score: roundedScore,
    max_score: 10,
    signals: {
      bullish: bullishCount,
      bearish: bearishCount,
      neutral: neutralCount,
    },
    breakdown,
    all_117_indicators: data,
  };
}

/**
 * Get confluence interpretation
 *
 * Provides human-readable interpretation of the confluence score.
 *
 * @param score - Confluence score (0-10)
 * @returns Interpretation string
 */
export function getConfluenceInterpretation(score: number): string {
  if (score >= 8) {
    return 'Very Strong - High-probability trading setup with strong multi-timeframe alignment';
  } else if (score >= 6.5) {
    return 'Strong - Good confluence across timeframes, favorable for entry';
  } else if (score >= 5) {
    return 'Moderate - Some confluence present, but mixed signals';
  } else if (score >= 3) {
    return 'Weak - Conflicting signals across timeframes, caution advised';
  } else {
    return 'Very Weak - No clear direction, avoid trading until clarity emerges';
  }
}

/**
 * Get dominant trend from confluence result
 *
 * @param result - Confluence result
 * @returns Dominant trend direction
 */
export function getDominantTrend(
  result: ConfluenceResult
): 'bullish' | 'bearish' | 'neutral' {
  const { bullish, bearish, neutral } = result.signals;
  const max = Math.max(bullish, bearish, neutral);

  if (max === bullish) return 'bullish';
  if (max === bearish) return 'bearish';
  return 'neutral';
}

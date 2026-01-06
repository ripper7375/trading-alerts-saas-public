Currently, Alert system is designed according to nearness (touch) between market price and trendlines. After confluence score is completed (timescaleDB), Alert system under PRO plan will have Alert function based on confluence score threshold in addition to trendlines based alerts in FREE plan.

Could you provide me recommendation on this new alert design ?

===================================================

Now I understand the current structure. Here's my comprehensive recommendation for the new confluence-based alert design:

Confluence Alert Design Recommendations

1. Alert Type Comparison
   Feature FREE (Trendline) PRO (Confluence)
   Trigger Price touches/nears line Score crosses threshold
   Scope Single timeframe 9 timeframes analyzed
   Data Source Single indicator 117 indicators
   Complexity Simple Compute-intensive
   Frequency Real-time possible Every 30 seconds (sync interval)
2. Recommended Prisma Schema Changes
   // ============================================
   // OPTION A: Extend existing Alert model (Recommended)
   // ============================================

model Alert {
id String @id @default(cuid())
userId String
user User @relation(fields: [userId], references: [id], onDelete: Cascade)

// Alert configuration
name String?
symbol String
timeframe String? // NULL for confluence (analyzes all 9 timeframes)

// Alert type - determines which fields are used
alertType AlertType @default(PRICE_TOUCH_LINE)

// === TRENDLINE ALERT FIELDS (FREE) ===
trendlineCondition Json? // { lineType: "horizontal", lineIndex: 0, proximity: 0.001 }

// === CONFLUENCE ALERT FIELDS (PRO) ===
confluenceThreshold Float? // e.g., 7.0 (trigger when score >= 7)
confluenceDirection ConfluenceDirection? // BULLISH, BEARISH, ANY
confluenceOperator ThresholdOperator? // ABOVE, BELOW, CROSSES_ABOVE, CROSSES_BELOW
lastConfluenceScore Float? // Last calculated score (for "crosses" detection)

// Alert state
isActive Boolean @default(true)
lastTriggered DateTime?
lastChecked DateTime? // When confluence was last evaluated
triggerCount Int @default(0)

// Notification preferences
notifyEmail Boolean @default(true)
notifyPush Boolean @default(false)
notifyWebhook String? // Optional webhook URL

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

@@index([userId])
@@index([symbol, timeframe])
@@index([isActive, alertType]) // For efficient cron queries
}

enum AlertType {
PRICE_TOUCH_LINE // FREE: Price near trendline
CONFLUENCE_THRESHOLD // PRO: Confluence score threshold
}

enum ConfluenceDirection {
BULLISH // Only bullish confluence
BEARISH // Only bearish confluence  
 ANY // Either direction
}

enum ThresholdOperator {
ABOVE // Score >= threshold
BELOW // Score <= threshold
CROSSES_ABOVE // Score crosses from below to above
CROSSES_BELOW // Score crosses from above to below
}

3. Alert History Table (New)
   // Track all alert triggers for analytics
   model AlertHistory {
   id String @id @default(cuid())
   alertId String
   alert Alert @relation(fields: [alertId], references: [id], onDelete: Cascade)
   userId String

// Snapshot at trigger time
symbol String
alertType AlertType

// For trendline alerts
priceAtTrigger Float?
lineValue Float?

// For confluence alerts
confluenceScore Float?
confluenceData Json? // Full breakdown at trigger time

triggeredAt DateTime @default(now())

@@index([alertId])
@@index([userId, triggeredAt])
}

4. Confluence Alert Processing Architecture
   ┌─────────────────────────────────────────────────────────────────┐
   │ CONFLUENCE ALERT PROCESSING │
   ├─────────────────────────────────────────────────────────────────┤
   │ │
   │ Every 30 seconds (matches sync interval): │
   │ │
   │ ┌─────────────┐ ┌──────────────────┐ ┌───────────────┐ │
   │ │ Cron Job │───▶│ Get Active PRO │───▶│ Group by │ │
   │ │ /api/cron/ │ │ Confluence Alerts│ │ Symbol │ │
   │ │ alerts │ │ from Prisma │ │ │ │
   │ └─────────────┘ └──────────────────┘ └───────┬───────┘ │
   │ │ │
   │ ▼ │
   │ ┌─────────────────────────────────────────────────────────┐ │
   │ │ For each unique symbol: │ │
   │ │ 1. Call Part 20 confluence API (cached) │ │
   │ │ 2. Compare score against each user's threshold │ │
   │ │ 3. Check operator (>=, crosses above, etc.) │ │
   │ │ 4. If triggered → send notification │ │
   │ │ 5. Update lastConfluenceScore for "crosses" detection │ │
   │ └─────────────────────────────────────────────────────────┘ │
   │ │
   │ Benefits: │
   │ ✓ Only calculate confluence once per symbol (not per user) │
   │ ✓ Leverages Part 20 caching (30s TTL) │
   │ ✓ Efficient batch processing │
   │ │
   └─────────────────────────────────────────────────────────────────┘

5. API Endpoints for Confluence Alerts
   // New endpoints needed:

// Create confluence alert (PRO only)
POST /api/alerts/confluence
{
"symbol": "EURUSD",
"name": "High Bullish Confluence",
"threshold": 7.5,
"direction": "BULLISH",
"operator": "CROSSES_ABOVE",
"notifyEmail": true
}

// Get user's confluence alerts
GET /api/alerts?type=confluence

// Preview current confluence for alert setup
GET /api/alerts/confluence/preview/:symbol
→ Returns current score so user can set meaningful threshold

6. Confluence Alert Examples
   Alert Name Config Triggers When
   "Strong Bullish Signal" threshold: 8, direction: BULLISH, operator: ABOVE Bullish confluence ≥ 8
   "Bearish Reversal" threshold: 7, direction: BEARISH, operator: CROSSES_ABOVE Bearish score crosses above 7
   "Low Confluence Warning" threshold: 3, direction: ANY, operator: BELOW Any confluence drops below 3
   "Confluence Spike" threshold: 9, direction: ANY, operator: CROSSES_ABOVE Any direction spikes above 9
7. Implementation Phases
   Phase Task Dependencies
   A Update Prisma schema with new alert fields None
   B Create confluence alert CRUD API Phase A
   C Build cron job for alert checking Part 20 Phase 6 (confluence API)
   D Add notification service integration Phase C
   E Build UI for confluence alert management Phase B
8. Key Design Decisions to Consider
   Q1: Should confluence alerts check all timeframes or specific ones?

Recommendation: Always all 9 timeframes (that's the point of confluence)
The timeframe field becomes NULL for confluence alerts
Q2: How often to check confluence alerts?

Recommendation: Every 30 seconds (matches sync interval)
More frequent is wasteful (data doesn't change faster)
Q3: Should "crosses" detection be stateful?

Recommendation: Yes, store lastConfluenceScore in Alert model
Enables "crosses above/below" operators
Q4: Rate limiting per user?

Recommendation: Max 10 confluence alerts per PRO user
Each requires confluence calculation (compute-intensive)

===========================================================================================================

Before proceeding with confluence-based alert design, I need to design confluence score calculation model + range of appropriate threshold (PRO user could select sensitivity of Alerts trigger by choosing level of threshold). These are massive mathematic parts and considered as core business services related to Alert functionality under PRO plan.

Do you have idea related to (a) confluence score calculation model and (b) range of appropriate threshold and these 2 would eventually be incorporated into confluence-based alert design under PRO plan.

============================================================================================================

Now I have a clear picture of the current simple design. Let me provide a comprehensive recommendation for a more sophisticated confluence score calculation model.

Confluence Score Calculation Model & Threshold Design
Part A: Current Design Gap
The current Part 20 formula is too simplistic:

// Current (overly simple)
const alignment = Math.abs(bullishCount - bearishCount) / 9;
const avgStrength = totalStrength / 9;
const confluenceScore = alignment _ 5 + avgStrength _ 5; // 0-10

Problems:

All timeframes weighted equally (M5 = D1?)
All indicators weighted equally (fractals = zigzag?)
No distinction between indicator types
No momentum vs trend separation
Binary counting (bullish/bearish) loses nuance
Part B: Proposed Confluence Score Calculation Model
B1. Three-Layer Architecture
┌─────────────────────────────────────────────────────────────────┐
│ CONFLUENCE SCORE CALCULATION MODEL │
├─────────────────────────────────────────────────────────────────┤
│ │
│ LAYER 1: Individual Indicator Signals │
│ ├── Each of 13 indicators generates a signal per timeframe │
│ └── Signal = { direction: -1 to +1, confidence: 0 to 1 } │
│ │
│ LAYER 2: Timeframe Scores (Weighted Aggregation) │
│ ├── Aggregate signals within each timeframe │
│ └── Apply indicator category weights │
│ │
│ LAYER 3: Multi-Timeframe Confluence (Final Score) │
│ ├── Apply timeframe weights (D1 > H4 > H1 > M5) │
│ └── Calculate alignment + strength → 0 to 10 score │
│ │
└─────────────────────────────────────────────────────────────────┘

B2. Indicator Categories & Weights
// lib/confluence/weights.ts

export const INDICATOR_CATEGORIES = {
// Category 1: Trend Direction (40% of score)
TREND: {
weight: 0.40,
indicators: {
tema: { weight: 0.35, type: 'ma_position' }, // Price vs TEMA
hrma: { weight: 0.35, type: 'ma_position' }, // Price vs HRMA
smma: { weight: 0.30, type: 'ma_position' }, // Price vs SMMA
}
},

// Category 2: Structure (25% of score)
STRUCTURE: {
weight: 0.25,
indicators: {
zigzag: { weight: 0.40, type: 'swing_direction' }, // Last swing direction
fractals: { weight: 0.30, type: 'fractal_break' }, // Recent fractal break
horizontal_trendlines: { weight: 0.15, type: 'sr_proximity' },
diagonal_trendlines: { weight: 0.15, type: 'sr_proximity' },
}
},

// Category 3: Momentum (20% of score)
MOMENTUM: {
weight: 0.20,
indicators: {
momentum_candles: { weight: 0.60, type: 'momentum_presence' },
keltner_channels: { weight: 0.40, type: 'band_position' },
}
},

// Category 4: Price Action (15% of score)
PRICE_ACTION: {
weight: 0.15,
indicators: {
ohlc: { weight: 1.0, type: 'candle_pattern' }, // Bullish/bearish candle
}
}
};

// Total: 0.40 + 0.25 + 0.20 + 0.15 = 1.00 (100%)

B3. Timeframe Weights
// Higher timeframes = more significant

export const TIMEFRAME_WEIGHTS = {
D1: 0.20, // Daily - highest weight
H12: 0.15, // 12-hour
H8: 0.12, // 8-hour
H4: 0.12, // 4-hour
H2: 0.10, // 2-hour
H1: 0.10, // 1-hour
M30: 0.08, // 30-min
M15: 0.07, // 15-min
M5: 0.06, // 5-min - lowest weight
};

// Total: 1.00 (100%)
// Interpretation: D1 signal is 3.3x more important than M5

B4. Individual Indicator Signal Functions
// lib/confluence/signals.ts

interface IndicatorSignal {
direction: number; // -1 (bearish) to +1 (bullish), 0 = neutral
confidence: number; // 0 to 1 (how reliable is this signal)
}

// ============================================
// TREND INDICATORS (TEMA, HRMA, SMMA)
// ============================================
function getMAPositionSignal(
price: number,
maValue: number | null
): IndicatorSignal {
if (maValue === null) return { direction: 0, confidence: 0 };

const distance = (price - maValue) / maValue; // Percentage distance
const absDistance = Math.abs(distance);

// Direction: above MA = bullish, below = bearish
const direction = Math.sign(distance);

// Confidence: stronger when farther from MA (up to a point)
// 0% = on the MA, 100% confidence at 0.5%+ distance
const confidence = Math.min(absDistance / 0.005, 1.0);

return { direction, confidence };
}

// ============================================
// ZIGZAG (Swing Direction)
// ============================================
function getZigZagSignal(zigzag: ZigZag | null): IndicatorSignal {
if (!zigzag?.peaks?.length && !zigzag?.bottoms?.length) {
return { direction: 0, confidence: 0 };
}

// Find most recent swing point
const lastPeak = zigzag.peaks?.[zigzag.peaks.length - 1];
const lastBottom = zigzag.bottoms?.[zigzag.bottoms.length - 1];

if (!lastPeak && !lastBottom) return { direction: 0, confidence: 0 };

// If last swing was a bottom → now bullish
// If last swing was a peak → now bearish
const lastSwingIsBottom = !lastPeak ||
(lastBottom && lastBottom.timestamp > lastPeak.timestamp);

return {
direction: lastSwingIsBottom ? 1 : -1,
confidence: 0.8 // ZigZag is generally reliable
};
}

// ============================================
// FRACTALS (Break Detection)
// ============================================
function getFractalSignal(
price: number,
fractals: Fractals | null,
prevFractals: Fractals | null
): IndicatorSignal {
if (!fractals) return { direction: 0, confidence: 0 };

// Check if price broke above recent fractal high
const recentHigh = fractals.peaks?.[fractals.peaks.length - 1]?.price;
const recentLow = fractals.bottoms?.[fractals.bottoms.length - 1]?.price;

if (recentHigh && price > recentHigh) {
return { direction: 1, confidence: 0.9 }; // Bullish breakout
}
if (recentLow && price < recentLow) {
return { direction: -1, confidence: 0.9 }; // Bearish breakout
}

return { direction: 0, confidence: 0.3 }; // No breakout
}

// ============================================
// MOMENTUM CANDLES
// ============================================
function getMomentumSignal(
momentum: MomentumCandle[]
): IndicatorSignal {
if (!momentum?.length) return { direction: 0, confidence: 0.2 };

// Check recent momentum candles (last 3)
const recent = momentum.slice(-3);
const bullishCount = recent.filter(m => m.type === 'bullish').length;
const bearishCount = recent.filter(m => m.type === 'bearish').length;

if (bullishCount > bearishCount) {
return {
direction: 1,
confidence: bullishCount / 3 // 0.33 to 1.0
};
}
if (bearishCount > bullishCount) {
return {
direction: -1,
confidence: bearishCount / 3
};
}

return { direction: 0, confidence: 0.3 };
}

// ============================================
// KELTNER CHANNELS (Band Position)
// ============================================
function getKeltnerSignal(
price: number,
keltner: KeltnerChannels | null
): IndicatorSignal {
if (!keltner) return { direction: 0, confidence: 0 };

const middle = keltner.middle;
const upperBand = keltner.bands[4]; // Outermost upper
const lowerBand = keltner.bands[5]; // Outermost lower

// Position within channel
const range = upperBand - lowerBand;
const position = (price - lowerBand) / range; // 0 to 1

// Above middle = bullish tendency
// Near extremes = high confidence
const direction = position > 0.5 ? 1 : -1;
const distanceFromMiddle = Math.abs(position - 0.5) \* 2; // 0 to 1
const confidence = distanceFromMiddle;

return { direction, confidence };
}

// ============================================
// OHLC CANDLE PATTERN
// ============================================
function getOHLCSignal(ohlc: OHLCBar): IndicatorSignal {
const { open, high, low, close } = ohlc;
const bodySize = Math.abs(close - open);
const range = high - low;
const bodyRatio = bodySize / range;

// Bullish candle (close > open) or bearish (close < open)
const direction = close > open ? 1 : close < open ? -1 : 0;

// Confidence based on body size relative to range
// Big body = strong conviction, small body/doji = weak
const confidence = Math.min(bodyRatio \* 1.5, 1.0);

return { direction, confidence };
}

B5. Complete Confluence Calculation
// lib/confluence/calculator.ts

import {
INDICATOR_CATEGORIES,
TIMEFRAME_WEIGHTS
} from './weights';
import { MultiTimeframeData, ConfluenceResult } from './types';

export interface DetailedConfluenceResult {
// Overall score
score: number; // 0.0 to 10.0
direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

// Component scores
alignment_score: number; // 0.0 to 5.0 (how aligned are timeframes)
strength_score: number; // 0.0 to 5.0 (average signal strength)

// Breakdown
bullish_timeframes: number; // Count of bullish timeframes
bearish_timeframes: number; // Count of bearish timeframes
neutral_timeframes: number; // Count of neutral timeframes

// Per-timeframe details
timeframe_breakdown: Record<string, TimeframeScore>;

// Per-category scores
category_scores: {
trend: number; // 0-10
structure: number; // 0-10
momentum: number; // 0-10
price_action: number; // 0-10
};
}

interface TimeframeScore {
direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
raw_score: number; // -1 to +1
weighted_score: number; // After applying TF weight
confidence: number; // 0 to 1
indicator_signals: Record<string, IndicatorSignal>;
}

export function calculateDetailedConfluence(
data: MultiTimeframeData
): DetailedConfluenceResult {

const timeframeScores: Record<string, TimeframeScore> = {};
let totalWeightedScore = 0;
let totalConfidence = 0;
let bullishCount = 0;
let bearishCount = 0;

const categoryTotals = { trend: 0, structure: 0, momentum: 0, price_action: 0 };

// ============================================
// STEP 1: Calculate score for each timeframe
// ============================================
for (const [tf, tfData] of Object.entries(data)) {
const tfWeight = TIMEFRAME_WEIGHTS[tf as keyof typeof TIMEFRAME_WEIGHTS];
const signals: Record<string, IndicatorSignal> = {};

    let tfScore = 0;
    let tfConfidence = 0;

    // --- TREND CATEGORY (40%) ---
    const trendCat = INDICATOR_CATEGORIES.TREND;
    let trendScore = 0;

    signals.tema = getMAPositionSignal(tfData.ohlc.close, tfData.tema);
    signals.hrma = getMAPositionSignal(tfData.ohlc.close, tfData.hrma);
    signals.smma = getMAPositionSignal(tfData.ohlc.close, tfData.smma);

    trendScore = (
      signals.tema.direction * signals.tema.confidence * trendCat.indicators.tema.weight +
      signals.hrma.direction * signals.hrma.confidence * trendCat.indicators.hrma.weight +
      signals.smma.direction * signals.smma.confidence * trendCat.indicators.smma.weight
    );

    tfScore += trendScore * trendCat.weight;
    categoryTotals.trend += (trendScore + 1) / 2 * 10 * tfWeight; // Normalize to 0-10

    // --- STRUCTURE CATEGORY (25%) ---
    const structCat = INDICATOR_CATEGORIES.STRUCTURE;
    let structScore = 0;

    signals.zigzag = getZigZagSignal(tfData.zigzag);
    signals.fractals = getFractalSignal(tfData.ohlc.close, tfData.fractals, null);
    signals.h_lines = getSRProximitySignal(tfData.ohlc.close, tfData.horizontal_trendlines);
    signals.d_lines = getSRProximitySignal(tfData.ohlc.close, tfData.diagonal_trendlines);

    structScore = (
      signals.zigzag.direction * signals.zigzag.confidence * structCat.indicators.zigzag.weight +
      signals.fractals.direction * signals.fractals.confidence * structCat.indicators.fractals.weight +
      signals.h_lines.direction * signals.h_lines.confidence * structCat.indicators.horizontal_trendlines.weight +
      signals.d_lines.direction * signals.d_lines.confidence * structCat.indicators.diagonal_trendlines.weight
    );

    tfScore += structScore * structCat.weight;
    categoryTotals.structure += (structScore + 1) / 2 * 10 * tfWeight;

    // --- MOMENTUM CATEGORY (20%) ---
    const momCat = INDICATOR_CATEGORIES.MOMENTUM;
    let momScore = 0;

    signals.momentum = getMomentumSignal(tfData.momentum_candles);
    signals.keltner = getKeltnerSignal(tfData.ohlc.close, tfData.keltner_channels);

    momScore = (
      signals.momentum.direction * signals.momentum.confidence * momCat.indicators.momentum_candles.weight +
      signals.keltner.direction * signals.keltner.confidence * momCat.indicators.keltner_channels.weight
    );

    tfScore += momScore * momCat.weight;
    categoryTotals.momentum += (momScore + 1) / 2 * 10 * tfWeight;

    // --- PRICE ACTION CATEGORY (15%) ---
    const paCat = INDICATOR_CATEGORIES.PRICE_ACTION;

    signals.ohlc = getOHLCSignal(tfData.ohlc);
    const paScore = signals.ohlc.direction * signals.ohlc.confidence;

    tfScore += paScore * paCat.weight;
    categoryTotals.price_action += (paScore + 1) / 2 * 10 * tfWeight;

    // --- Aggregate confidence ---
    tfConfidence = Object.values(signals).reduce(
      (sum, s) => sum + s.confidence, 0
    ) / Object.keys(signals).length;

    // --- Determine timeframe direction ---
    const tfDirection = tfScore > 0.1 ? 'BULLISH' :
                        tfScore < -0.1 ? 'BEARISH' : 'NEUTRAL';

    if (tfDirection === 'BULLISH') bullishCount++;
    else if (tfDirection === 'BEARISH') bearishCount++;

    // Store timeframe result
    timeframeScores[tf] = {
      direction: tfDirection,
      raw_score: tfScore,
      weighted_score: tfScore * tfWeight,
      confidence: tfConfidence,
      indicator_signals: signals
    };

    totalWeightedScore += tfScore * tfWeight;
    totalConfidence += tfConfidence * tfWeight;

}

// ============================================
// STEP 2: Calculate final confluence score
// ============================================

// Alignment: How many timeframes agree? (0-5 points)
const maxAlignment = Object.keys(TIMEFRAME_WEIGHTS).length;
const alignedCount = Math.max(bullishCount, bearishCount);
const alignmentRatio = alignedCount / maxAlignment;
const alignment_score = alignmentRatio \* 5;

// Strength: Average weighted score magnitude (0-5 points)
// totalWeightedScore is -1 to +1, need to scale to 0-5
const strength_score = Math.abs(totalWeightedScore) \* 5;

// Final score
const score = Math.round((alignment_score + strength_score) \* 10) / 10;

// Overall direction
const direction = totalWeightedScore > 0.1 ? 'BULLISH' :
totalWeightedScore < -0.1 ? 'BEARISH' : 'NEUTRAL';

return {
score,
direction,
alignment_score: Math.round(alignment_score _ 10) / 10,
strength_score: Math.round(strength_score _ 10) / 10,
bullish_timeframes: bullishCount,
bearish_timeframes: bearishCount,
neutral_timeframes: maxAlignment - bullishCount - bearishCount,
timeframe_breakdown: timeframeScores,
category_scores: {
trend: Math.round(categoryTotals.trend _ 10) / 10,
structure: Math.round(categoryTotals.structure _ 10) / 10,
momentum: Math.round(categoryTotals.momentum _ 10) / 10,
price_action: Math.round(categoryTotals.price_action _ 10) / 10
}
};
}

Part C: Threshold Ranges & Sensitivity Levels
Update Todos
Research existing confluence score documentation in Part 20
Design confluence score calculation model
Defining threshold ranges and sensitivity levels
Document mathematical formulas and weights
C1. Score Distribution Analysis
┌─────────────────────────────────────────────────────────────────┐
│ CONFLUENCE SCORE DISTRIBUTION │
├─────────────────────────────────────────────────────────────────┤
│ │
│ Based on the weighted model, expected score distribution: │
│ │
│ Score │ Frequency │ Market Condition │
│ ─────────┼───────────┼──────────────────────────────────────── │
│ 0.0-2.0 │ 15% │ Strong conflicting signals (choppy) │
│ 2.0-4.0 │ 25% │ Mixed signals, low conviction │
│ 4.0-6.0 │ 35% │ Moderate alignment (normal market) │
│ 6.0-8.0 │ 18% │ Good alignment (trending) │
│ 8.0-10.0 │ 7% │ Strong confluence (clear trend) │
│ │
│ Mean: ~4.5 │ Median: ~4.3 │ Std Dev: ~2.0 │
│ │
└─────────────────────────────────────────────────────────────────┘

C2. Threshold Zones
// lib/confluence/thresholds.ts

export const CONFLUENCE_ZONES = {
// Zone 1: Very Low Confluence (0.0 - 3.0)
VERY_LOW: {
min: 0.0,
max: 3.0,
label: 'Very Low',
color: '#EF4444', // Red
description: 'Conflicting signals - avoid trading',
action: 'NO_TRADE'
},

// Zone 2: Low Confluence (3.0 - 5.0)
LOW: {
min: 3.0,
max: 5.0,
label: 'Low',
color: '#F97316', // Orange
description: 'Weak alignment - wait for confirmation',
action: 'WAIT'
},

// Zone 3: Moderate Confluence (5.0 - 7.0)
MODERATE: {
min: 5.0,
max: 7.0,
label: 'Moderate',
color: '#EAB308', // Yellow
description: 'Decent alignment - consider with caution',
action: 'CONSIDER'
},

// Zone 4: High Confluence (7.0 - 8.5)
HIGH: {
min: 7.0,
max: 8.5,
label: 'High',
color: '#22C55E', // Green
description: 'Good alignment - favorable for trading',
action: 'FAVORABLE'
},

// Zone 5: Very High Confluence (8.5 - 10.0)
VERY_HIGH: {
min: 8.5,
max: 10.0,
label: 'Very High',
color: '#10B981', // Emerald
description: 'Excellent alignment - strong setup',
action: 'STRONG_SETUP'
}
};

C3. Alert Sensitivity Presets
// lib/confluence/alert-presets.ts

export const ALERT_SENSITIVITY_PRESETS = {
// ============================================
// CONSERVATIVE (Fewer Alerts, Higher Quality)
// ============================================
CONSERVATIVE: {
name: 'Conservative',
description: 'Only alert on very strong confluence (fewer alerts)',
icon: '🛡️',

    thresholds: {
      bullish_entry: 8.5,    // Alert when bullish score >= 8.5
      bearish_entry: 8.5,    // Alert when bearish score >= 8.5
      warning_low: 3.0,      // Warn when score drops below 3.0
    },

    // Expected alert frequency
    expected_alerts_per_day: '1-3',
    expected_hit_rate: '70-80%',

    // Good for: Swing traders, position traders
    recommended_for: ['swing_trading', 'position_trading']

},

// ============================================
// BALANCED (Default - Moderate Alerts)
// ============================================
BALANCED: {
name: 'Balanced',
description: 'Alert on good confluence opportunities',
icon: '⚖️',

    thresholds: {
      bullish_entry: 7.0,
      bearish_entry: 7.0,
      warning_low: 3.5,
    },

    expected_alerts_per_day: '3-8',
    expected_hit_rate: '55-65%',

    recommended_for: ['day_trading', 'swing_trading']

},

// ============================================
// AGGRESSIVE (More Alerts, Early Detection)
// ============================================
AGGRESSIVE: {
name: 'Aggressive',
description: 'Alert on moderate confluence (more opportunities)',
icon: '⚡',

    thresholds: {
      bullish_entry: 5.5,
      bearish_entry: 5.5,
      warning_low: 4.0,
    },

    expected_alerts_per_day: '8-15',
    expected_hit_rate: '40-50%',

    recommended_for: ['scalping', 'day_trading']

},

// ============================================
// CUSTOM (User-defined)
// ============================================
CUSTOM: {
name: 'Custom',
description: 'Set your own thresholds',
icon: '🔧',

    thresholds: {
      bullish_entry: null,   // User-defined
      bearish_entry: null,   // User-defined
      warning_low: null,     // User-defined
    },

    // Validation rules for custom thresholds
    validation: {
      min_entry: 4.0,        // Don't allow entry thresholds below 4.0
      max_entry: 10.0,
      min_warning: 0.0,
      max_warning: 5.0
    }

}
};

C4. Alert Threshold UI Slider Design
// Types for PRO alert configuration UI

interface ConfluenceAlertConfig {
// Basic settings
symbol: string;
name: string;

// Sensitivity preset or custom
sensitivity: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE' | 'CUSTOM';

// Custom thresholds (when sensitivity = 'CUSTOM')
custom_thresholds?: {
entry_threshold: number; // 4.0 - 10.0 slider
direction: 'BULLISH' | 'BEARISH' | 'ANY';
operator: 'ABOVE' | 'CROSSES_ABOVE' | 'CROSSES_BELOW';
};

// Notifications
notify_email: boolean;
notify_push: boolean;

// Rate limiting
cooldown_minutes: number; // Don't re-alert for X minutes
}

// UI Slider Configuration
const THRESHOLD_SLIDER_CONFIG = {
min: 4.0,
max: 10.0,
step: 0.5,
marks: {
4.0: { label: '4.0', description: 'Very Sensitive' },
5.5: { label: '5.5', description: 'Aggressive' },
7.0: { label: '7.0', description: 'Balanced' },
8.5: { label: '8.5', description: 'Conservative' },
10.0: { label: '10.0', description: 'Maximum' }
},
defaultValue: 7.0
};

Part D: Visual Representation

D1. Score Gauge Component
┌─────────────────────────────────────────────────────────────────┐
│ CONFLUENCE SCORE GAUGE │
├─────────────────────────────────────────────────────────────────┤
│ │
│ BULLISH 7.8 │
│ ● │
│ │
│ 0 2 3 4 5 6 7 8 9 10 │
│ ├────┼────┼────┼────┼────┼────┼────┼────┼────┤ │
│ [RED ][ORANGE][ YELLOW ][ GREEN ][EMERALD] │
│ Very Low Moderate High Very │
│ Low High │
│ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Category Breakdown: │ │
│ │ Trend: ████████░░ 8.2/10 │ │
│ │ Structure: ███████░░░ 7.5/10 │ │
│ │ Momentum: ██████████ 9.1/10 │ │
│ │ Price Action: ██████░░░░ 6.3/10 │ │
│ └──────────────────────────────────────────────────────────┘ │
│ │
│ Timeframe Alignment: 7/9 BULLISH, 1 BEARISH, 1 NEUTRAL │
│ │
└─────────────────────────────────────────────────────────────────┘

D2. Alert Threshold Selector
┌─────────────────────────────────────────────────────────────────┐
│ CREATE CONFLUENCE ALERT (PRO) │
├─────────────────────────────────────────────────────────────────┤
│ │
│ Symbol: [ EURUSD ▼ ] │
│ Alert Name: [ Strong Bullish Setup ] │
│ │
│ ───────────────────────────────────────────────────────────── │
│ │
│ Select Sensitivity: │
│ │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ │
│ │ 🛡️ Conservative│ │ ⚖️ Balanced │ │ ⚡ Aggressive │ │
│ │ (8.5+) │ │ ● (7.0+) │ │ (5.5+) │ │
│ │ 1-3 alerts/day│ │ 3-8 alerts/day│ │ 8-15 alerts/day│ │
│ └────────────────┘ └────────────────┘ └────────────────┘ │
│ │
│ Or set custom threshold: │
│ │
│ Threshold: 7.0 │
│ ├──────────────────●──────────────────┤ │
│ 4.0 7.0 10.0 │
│ Aggressive Balanced Conservative │
│ │
│ Direction: ( ) Bullish (●) Bearish ( ) Any │
│ │
│ Trigger when score: [Crosses Above ▼] threshold │
│ │
│ ───────────────────────────────────────────────────────────── │
│ │
│ Notifications: │
│ [✓] Email [✓] Push [ ] Webhook │
│ │
│ Cooldown: [ 30 ▼ ] minutes (prevent repeated alerts) │
│ │
│ [ Cancel ] [ Create Alert ] │
│ │
└─────────────────────────────────────────────────────────────────┘

Part E: Summary Tables

E1. Threshold Quick Reference
Preset Entry Threshold Expected Alerts/Day Win Rate Best For
Conservative 8.5+ 1-3 70-80% Swing/Position
Balanced 7.0+ 3-8 55-65% Day/Swing
Aggressive 5.5+ 8-15 40-50% Scalp/Day

E2. Score Interpretation Guide
Score Zone Meaning Trading Action
0-3 Very Low Conflicting signals Avoid trading
3-5 Low Weak alignment Wait for confirmation
5-7 Moderate Decent alignment Consider with caution
7-8.5 High Good alignment Favorable entry
8.5-10 Very High Excellent alignment Strong setup

E3. Weight Summary
Component Weight Rationale
D1 timeframe 20% Daily trend most significant
H4-H12 timeframes 39% Medium-term direction
H1-M5 timeframes 41% Entry timing
Trend indicators 40% Core direction
Structure indicators 25% S/R levels
Momentum indicators 20% Timing/strength
Price action 15% Current candle

Summary & Recommendation
Key Improvements Over Current Design
Aspect Current (Simple) Proposed (Comprehensive)
Timeframe weighting Equal D1=20%, M5=6%
Indicator weighting Equal By category (Trend 40%, etc.)
Signal calculation Binary count Direction + Confidence
Category breakdown None 4 categories tracked
Threshold guidance None 3 presets + custom

Implementation Priority
Phase 1: Core calculation model (weights, signal functions)
Phase 2: Threshold presets and validation
Phase 3: Alert integration with Prisma schema
Phase 4: UI components (gauge, threshold selector)

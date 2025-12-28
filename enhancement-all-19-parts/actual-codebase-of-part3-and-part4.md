Summary: Part 3 (Types) & Part 4 (Tier System) Implementation
PART 3: Type Definitions
Files: types/

1. Tier Type (types/tier.ts:7)
   // Canonical definition in lib/tier-config.ts, re-exported
   export type Tier = 'FREE' | 'PRO';

2. Timeframe Type & Constants (types/tier.ts:70-163)
   export type Timeframe =
   | 'M5' // PRO only
   | 'M15' // PRO only
   | 'M30' // PRO only
   | 'H1' // FREE + PRO
   | 'H2' // PRO only
   | 'H4' // FREE + PRO
   | 'H8' // PRO only
   | 'H12' // PRO only
   | 'D1'; // FREE + PRO

export const FREE_TIER_TIMEFRAMES: Timeframe[] = ['H1', 'H4', 'D1'];

export const PRO_TIER_TIMEFRAMES: Timeframe[] = [
'M5', 'M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'H12', 'D1'
];

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
M5: '5 Minutes',
M15: '15 Minutes',
M30: '30 Minutes',
H1: '1 Hour',
H2: '2 Hours',
H4: '4 Hours',
H8: '8 Hours',
H12: '12 Hours',
D1: '1 Day',
};

3. Symbol Constants (types/tier.ts:103-139)
   export const FREE_TIER_SYMBOLS = [
   'BTCUSD', // Bitcoin
   'EURUSD', // Euro
   'USDJPY', // Yen
   'US30', // Dow Jones
   'XAUUSD', // Gold
   ] as const;

export const PRO_TIER_EXCLUSIVE_SYMBOLS = [
'AUDJPY', // Forex Cross
'AUDUSD', // Forex Major
'ETHUSD', // Crypto - Ethereum
'GBPJPY', // Forex Cross
'GBPUSD', // Forex Major
'NDX100', // Index - Nasdaq 100
'NZDUSD', // Forex Major
'USDCAD', // Forex Major
'USDCHF', // Forex Major
'XAGUSD', // Commodities - Silver
] as const;

export const PRO_TIER_SYMBOLS = [
...FREE_TIER_SYMBOLS,
...PRO_TIER_EXCLUSIVE_SYMBOLS,
] as const; // 15 total

export type Symbol = (typeof PRO_TIER_SYMBOLS)[number];

4. TIER_CONFIG Structure (types/tier.ts:168-203)
   export interface TierLimits {
   maxAlerts: number;
   maxWatchlists: number;
   allowedSymbols: string[];
   allowedTimeframes: Timeframe[];
   pricing: {
   monthlyPrice: number;
   yearlyPrice?: number;
   hasFreeTrial: boolean;
   trialDays?: number;
   };
   features: {
   advancedCharts: boolean;
   exportData: boolean;
   apiAccess: boolean;
   prioritySupport: boolean;
   };
   }

export const TIER_CONFIG: Record<Tier, TierLimits> = {
FREE: {
maxAlerts: 5,
maxWatchlists: 1,
allowedSymbols: [...FREE_TIER_SYMBOLS],
allowedTimeframes: FREE_TIER_TIMEFRAMES,
pricing: {
monthlyPrice: 0,
hasFreeTrial: false,
},
features: {
advancedCharts: false,
exportData: false,
apiAccess: false,
prioritySupport: false,
},
},
PRO: {
maxAlerts: 20,
maxWatchlists: 5,
allowedSymbols: [...PRO_TIER_SYMBOLS],
allowedTimeframes: PRO_TIER_TIMEFRAMES,
pricing: {
monthlyPrice: 29,
yearlyPrice: 290,
hasFreeTrial: true,
trialDays: 7,
},
features: {
advancedCharts: true,
exportData: true,
apiAccess: true,
prioritySupport: true,
},
},
};

5. Other Important Types
   TrialStatus (types/tier.ts:27-32):

export type TrialStatus =
| 'NOT_STARTED' | 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED';

SubscriptionStatus (types/tier.ts:270-276):

export type SubscriptionStatus =
| 'ACTIVE' | 'INACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING';

PART 4: Tier System & Constants
File 1: lib/tier-config.ts - Core Configuration
TierConfig Interface & Constants
export type Tier = 'FREE' | 'PRO';

export interface TierConfig {
name: string;
price: number;
symbols: number;
timeframes: number;
chartCombinations: number;
maxAlerts: number;
maxWatchlistItems: number;
rateLimit: number; // requests per hour
}

export const FREE_TIER_CONFIG: TierConfig = {
name: 'FREE',
price: 0,
symbols: 5,
timeframes: 3,
chartCombinations: 15, // 5 × 3
maxAlerts: 5,
maxWatchlistItems: 5,
rateLimit: 60,
};

export const PRO_TIER_CONFIG: TierConfig = {
name: 'PRO',
price: 29,
symbols: 15,
timeframes: 9,
chartCombinations: 135, // 15 × 9
maxAlerts: 20,
maxWatchlistItems: 50,
rateLimit: 300,
};

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
FREE: FREE_TIER_CONFIG,
PRO: PRO_TIER_CONFIG,
};

Symbol/Timeframe Arrays
export const FREE_SYMBOLS = [
'BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'
] as const;

export const PRO_EXCLUSIVE_SYMBOLS = [
'AUDJPY', 'AUDUSD', 'ETHUSD', 'GBPJPY', 'GBPUSD',
'NDX100', 'NZDUSD', 'USDCAD', 'USDCHF', 'XAGUSD'
] as const;

export const PRO_SYMBOLS = [...FREE_SYMBOLS, ...PRO_EXCLUSIVE_SYMBOLS] as const;

export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'] as const;

export const PRO_EXCLUSIVE_TIMEFRAMES = [
'M5', 'M15', 'M30', 'H2', 'H8', 'H12'
] as const;

export const PRO_TIMEFRAMES = [...FREE_TIMEFRAMES, ...PRO_EXCLUSIVE_TIMEFRAMES] as const;

export const TRIAL_CONFIG = {
DURATION_DAYS: 7,
PRICE: 0,
GRANT_PRO_ACCESS: true,
};

Helper Functions
function getTierConfig(tier: Tier): TierConfig
function getAccessibleSymbols(tier: Tier): readonly string[]
function getAccessibleTimeframes(tier: Tier): readonly string[]
function getChartCombinations(tier: Tier): number

File 2: lib/tier-validation.ts - Validation Functions
ValidationResult Interface
export interface ValidationResult {
allowed: boolean;
reason?: string;
}

Core Validation Functions
// Symbol validation
function validateTierAccess(tier: Tier, symbol: string): ValidationResult
function canAccessSymbol(tier: Tier, symbol: string): boolean

// Timeframe validation
function validateTimeframeAccess(tier: Tier, timeframe: string): ValidationResult

// Chart (symbol+timeframe) validation
function validateChartAccess(tier: Tier, symbol: string, timeframe: string): ValidationResult

// Limit checks
function canCreateAlert(tier: Tier, currentAlerts: number): ValidationResult
function canAddWatchlistItem(tier: Tier, currentItems: number): ValidationResult

// Getters
function getSymbolLimit(tier: Tier): number // FREE: 5, PRO: 15
function getAlertLimit(tier: Tier): number // FREE: 5, PRO: 20
function getWatchlistLimit(tier: Tier): number // FREE: 5, PRO: 50
function getRateLimit(tier: Tier): number // FREE: 60, PRO: 300

function getAvailableSymbols(tier: Tier): string[]
function getAvailableTimeframes(tier: Tier): string[]
function getCombinationCount(tier: Tier): number
function getAllCombinations(tier: Tier): Array<{ symbol: string; timeframe: string }>

File 3: lib/tier-helpers.ts - Helper Utilities
function hasChartAccess(tier: Tier, symbol: string, timeframe: string): boolean
function getAvailableSymbols(tier: Tier): string[]
function getAvailableTimeframes(tier: Tier): string[]
function getChartCombinations(tier: Tier): number
function allowsCombination(tier: Tier, symbol: string, timeframe: string): boolean
function getTierDisplayName(tier: Tier): string // 'Free' | 'Pro'
function canUpgradeTier(currentTier: Tier, targetTier: Tier): boolean
function getUpgradePath(tier: Tier): Tier[] // FREE → ['PRO'], PRO → []

Files 4-6: lib/tier/ - Indicator Tier System
Constants (lib/tier/constants.ts)
export const PRO_ONLY_INDICATORS = [
'momentum_candles', 'keltner_channels', 'tema', 'hrma', 'smma', 'zigzag'
] as const;

export const BASIC_INDICATORS = ['fractals', 'trendlines'] as const;

export const ALL_INDICATORS = [...BASIC_INDICATORS, ...PRO_ONLY_INDICATORS] as const;

// Types
export type ProOnlyIndicator = (typeof PRO_ONLY_INDICATORS)[number];
export type BasicIndicator = (typeof BASIC_INDICATORS)[number];
export type IndicatorId = (typeof ALL_INDICATORS)[number];

// Indicator Metadata (label, description, category, color)
export const INDICATOR_METADATA: Record<IndicatorId, IndicatorMeta> = { ... };

// Color Constants
export const KELTNER_COLORS = { ... };
export const MOMENTUM_COLORS = { UP_NORMAL, UP_LARGE, UP_EXTREME, DOWN_NORMAL, DOWN_LARGE, DOWN_EXTREME };
export const MA_COLORS = { tema: '#808080', hrma: '#00CED1', smma: '#0000FF' };
export const ZIGZAG_COLORS = { peaks: '#f23645', bottoms: '#00c853', line: '#ffa726' };

Validator (lib/tier/validator.ts)
function canAccessIndicator(tier: Tier, indicator: string): boolean
function isProOnlyIndicator(indicator: string): boolean
function getAccessibleIndicators(tier: Tier): IndicatorId[]
function getLockedIndicators(tier: Tier): IndicatorId[]
function filterAccessibleIndicators(tier: Tier, indicators: string[]): IndicatorId[]
function getIndicatorUpgradeInfo(tier: Tier, requestedIndicators: string[]): {
upgradeRequired: boolean;
lockedIndicators: string[];
accessibleIndicators: string[];
}
function isValidIndicatorId(id: string): id is IndicatorId

Quick Reference Table
Feature FREE Tier PRO Tier
Symbols 5 15
Timeframes 3 (H1, H4, D1) 9 (all)
Chart Combinations 15 135
Max Alerts 5 20
Max Watchlist Items 5 50
Rate Limit 60/hr 300/hr
Price $0 $29/mo ($290/yr)
Free Trial No 7 days
Indicators Basic (fractals, trendlines) All 8 indicators
Advanced Features None Charts, Export, API, Priority Support

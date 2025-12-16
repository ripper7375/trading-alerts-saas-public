// Mock data and constants for chart controls

export type UserTier = 'FREE' | 'PRO';

export interface Symbol {
  code: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  isPositive: boolean;
  category: 'Forex' | 'Crypto' | 'Indices' | 'Commodities';
}

export interface Timeframe {
  code: string;
  name: string;
}

export const FREE_SYMBOLS = ['BTCUSD', 'EURUSD', 'USDJPY', 'US30', 'XAUUSD'];
export const FREE_TIMEFRAMES = ['H1', 'H4', 'D1'];

export const PRO_TIMEFRAMES = [
  'M5',
  'M15',
  'M30',
  'H1',
  'H2',
  'H4',
  'H8',
  'H12',
  'D1',
];

export const ALL_SYMBOLS: Symbol[] = [
  // Forex
  {
    code: 'EURUSD',
    name: 'Euro / US Dollar',
    price: '$1.0856',
    change: '+$0.0023',
    changePercent: '+0.21%',
    isPositive: true,
    category: 'Forex',
  },
  {
    code: 'GBPUSD',
    name: 'British Pound / US Dollar',
    price: '$1.2634',
    change: '-$0.0012',
    changePercent: '-0.09%',
    isPositive: false,
    category: 'Forex',
  },
  {
    code: 'USDJPY',
    name: 'US Dollar / Japanese Yen',
    price: '¥149.85',
    change: '+¥0.45',
    changePercent: '+0.30%',
    isPositive: true,
    category: 'Forex',
  },
  {
    code: 'AUDUSD',
    name: 'Australian Dollar / US Dollar',
    price: '$0.6523',
    change: '+$0.0034',
    changePercent: '+0.52%',
    isPositive: true,
    category: 'Forex',
  },
  {
    code: 'AUDJPY',
    name: 'Australian Dollar / Yen',
    price: '¥97.78',
    change: '+¥0.56',
    changePercent: '+0.58%',
    isPositive: true,
    category: 'Forex',
  },
  {
    code: 'GBPJPY',
    name: 'British Pound / Yen',
    price: '¥189.35',
    change: '-¥0.23',
    changePercent: '-0.12%',
    isPositive: false,
    category: 'Forex',
  },
  {
    code: 'NZDUSD',
    name: 'New Zealand Dollar / USD',
    price: '$0.5892',
    change: '+$0.0021',
    changePercent: '+0.36%',
    isPositive: true,
    category: 'Forex',
  },
  {
    code: 'USDCAD',
    name: 'US Dollar / Canadian Dollar',
    price: 'C$1.3876',
    change: '-C$0.0015',
    changePercent: '-0.11%',
    isPositive: false,
    category: 'Forex',
  },
  {
    code: 'USDCHF',
    name: 'US Dollar / Swiss Franc',
    price: 'CHF 0.8834',
    change: '+CHF 0.0012',
    changePercent: '+0.14%',
    isPositive: true,
    category: 'Forex',
  },

  // Crypto
  {
    code: 'BTCUSD',
    name: 'Bitcoin',
    price: '$43,256.80',
    change: '+$1,245.30',
    changePercent: '+2.96%',
    isPositive: true,
    category: 'Crypto',
  },
  {
    code: 'ETHUSD',
    name: 'Ethereum',
    price: '$2,298.45',
    change: '+$78.20',
    changePercent: '+3.52%',
    isPositive: true,
    category: 'Crypto',
  },

  // Indices
  {
    code: 'US30',
    name: 'Dow Jones Industrial Average',
    price: '38,654.25',
    change: '+125.45',
    changePercent: '+0.33%',
    isPositive: true,
    category: 'Indices',
  },
  {
    code: 'NDX100',
    name: 'Nasdaq 100',
    price: '16,234.78',
    change: '-45.23',
    changePercent: '-0.28%',
    isPositive: false,
    category: 'Indices',
  },

  // Commodities
  {
    code: 'XAUUSD',
    name: 'Gold',
    price: '$2,650.50',
    change: '+$12.50',
    changePercent: '+0.47%',
    isPositive: true,
    category: 'Commodities',
  },
  {
    code: 'XAGUSD',
    name: 'Silver',
    price: '$31.25',
    change: '-$0.35',
    changePercent: '-1.11%',
    isPositive: false,
    category: 'Commodities',
  },
];

export const ALL_TIMEFRAMES: Timeframe[] = [
  { code: 'M5', name: '5 Minutes' },
  { code: 'M15', name: '15 Minutes' },
  { code: 'M30', name: '30 Minutes' },
  { code: 'H1', name: '1 Hour' },
  { code: 'H2', name: '2 Hours' },
  { code: 'H4', name: '4 Hours' },
  { code: 'H8', name: '8 Hours' },
  { code: 'H12', name: '12 Hours' },
  { code: 'D1', name: '1 Day' },
];

export const SYMBOL_CATEGORIES = {
  Forex: { icon: '💱', label: 'Forex' },
  Crypto: { icon: '₿', label: 'Crypto' },
  Indices: { icon: '📊', label: 'Indices' },
  Commodities: { icon: '🏆', label: 'Commodities' },
} as const;

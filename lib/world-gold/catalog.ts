/** Shared source definitions, transcribed from the supplied pricing and hours HTML. */
export const TROY_OUNCE_GRAMS = 31.1034768;
export const FORMULA_VERSION = 'world-gold-1';
export const WORLD_GOLD_CURRENCIES = [
  'GBP',
  'THB',
  'HKD',
  'JPY',
  'INR',
  'AED',
  'TRY',
  'EUR',
  'CHF',
  'AUD',
] as const;
export type WorldGoldCurrency = (typeof WORLD_GOLD_CURRENCIES)[number];

export interface GoldUnit {
  id: string;
  labelKey: string;
  /** Fine-gold grams, except units with an explicit purity below. */
  grams: number;
  purity?: number;
  multiplier?: number;
  fixedPremium?: number;
}
export interface GoldSession {
  startMinutes: number;
  endMinutes: number;
  /** Ending on the day after the session starts. */
  overnight?: boolean;
  fridayStartMinutes?: number;
}
export interface GoldMarket {
  id: string;
  countryCode: string;
  countryKey: string;
  currency: WorldGoldCurrency;
  timeZone: string;
  centre: string;
  hoursKey: string;
  notesKey: string;
  formula: string[];
  units: GoldUnit[];
  closeMinutes: number;
  daily?: boolean;
  sessions: GoldSession[];
}
const unit = (
  id: string,
  grams: number,
  extra: Partial<GoldUnit> = {}
): GoldUnit => ({
  id,
  labelKey: `worldGold.unit.${id}`,
  grams,
  ...extra,
});
const market = (
  input: Omit<GoldMarket, 'countryKey' | 'hoursKey' | 'notesKey'>
): GoldMarket => ({
  ...input,
  countryKey: `worldGold.country.${input.id}`,
  hoursKey: `worldGold.hours.${input.id}`,
  notesKey: `worldGold.notes.${input.id}`,
});
export const MARKETS: GoldMarket[] = [
  market({
    id: 'gb',
    countryCode: 'GB',
    currency: 'GBP',
    timeZone: 'Europe/London',
    centre: 'London Bullion Market (LBMA) / LME',
    closeMinutes: 17 * 60,
    sessions: [{ startMinutes: 480, endMinutes: 1020 }],
    formula: [
      'Price/oz = XAUUSD / GBPUSD',
      'Sovereign = (Price/oz / 31.1034768) × 7.3224',
    ],
    units: [unit('oz', TROY_OUNCE_GRAMS), unit('sovereign', 7.3224)],
  }),
  market({
    id: 'th',
    countryCode: 'TH',
    currency: 'THB',
    timeZone: 'Asia/Bangkok',
    centre: 'Gold Traders Association / Yaowarat',
    closeMinutes: 17 * 60 + 30,
    sessions: [{ startMinutes: 540, endMinutes: 1050 }],
    formula: [
      'Price/baht = XAUUSD × USDTHB × (15.244 × 0.965 / 31.1034768)',
      'Price/g = Price/baht / 15.244',
    ],
    units: [
      unit('baht', 15.244, { purity: 0.965 }),
      unit('gram', 1, { purity: 0.965 }),
    ],
  }),
  market({
    id: 'hk',
    countryCode: 'HK',
    currency: 'HKD',
    timeZone: 'Asia/Hong_Kong',
    centre: 'Chinese Gold and Silver Exchange (CGSE)',
    closeMinutes: 16 * 60 + 30,
    sessions: [
      { startMinutes: 540, endMinutes: 990 },
      { startMinutes: 420, endMinutes: 300, overnight: true },
    ],
    formula: [
      'Price/oz = XAUUSD × USDHKD',
      'Price/g = Price/oz / 31.1034768',
      'Price/tael = Price/g × 37.428499',
    ],
    units: [
      unit('oz', TROY_OUNCE_GRAMS),
      unit('gram', 1),
      unit('tael', 37.428499),
    ],
  }),
  market({
    id: 'jp',
    countryCode: 'JP',
    currency: 'JPY',
    timeZone: 'Asia/Tokyo',
    centre: 'Osaka Exchange (JPX) / Tanaka',
    closeMinutes: 15 * 60 + 45,
    sessions: [
      { startMinutes: 525, endMinutes: 945 },
      { startMinutes: 1020, endMinutes: 360, overnight: true },
    ],
    formula: [
      'Base/g = XAUUSD × USDJPY / 31.1034768',
      'Retail/g = Base/g × 1.10',
    ],
    units: [unit('baseGram', 1), unit('retailGram', 1, { multiplier: 1.1 })],
  }),
  market({
    id: 'in',
    countryCode: 'IN',
    currency: 'INR',
    timeZone: 'Asia/Kolkata',
    centre: 'Multi Commodity Exchange (MCX)',
    closeMinutes: 23 * 60 + 30,
    sessions: [{ startMinutes: 540, endMinutes: 1410 }],
    formula: [
      'Base/g = XAUUSD × USDINR / 31.1034768',
      'Retail/g = Base/g × 1.06 × 1.03',
      'Price/tola = Retail/g × 11.6638',
    ],
    units: [
      unit('retailGram', 1, { multiplier: 1.06 * 1.03 }),
      unit('tola', 11.6638, { multiplier: 1.06 * 1.03 }),
    ],
  }),
  market({
    id: 'ae',
    countryCode: 'AE',
    currency: 'AED',
    timeZone: 'Asia/Dubai',
    centre: 'Dubai Gold Souk / DMCC',
    closeMinutes: 22 * 60,
    daily: true,
    sessions: [
      { startMinutes: 600, endMinutes: 1320, fridayStartMinutes: 960 },
    ],
    formula: [
      'Price/oz = XAUUSD × USDAED',
      'Price/g = Price/oz / 31.1034768',
      'Price/tola = Price/g × 11.6638',
    ],
    units: [
      unit('oz', TROY_OUNCE_GRAMS),
      unit('gram', 1),
      unit('tola', 11.6638),
    ],
  }),
  market({
    id: 'tr',
    countryCode: 'TR',
    currency: 'TRY',
    timeZone: 'Europe/Istanbul',
    centre: 'Borsa Istanbul (BIST) / Grand Bazaar',
    closeMinutes: 18 * 60,
    sessions: [
      { startMinutes: 580, endMinutes: 1080 },
      { startMinutes: 540, endMinutes: 1140 },
    ],
    formula: [
      'Base/g = (XAUUSD × USDTRY / 31.1034768) × 1.015',
      'Price/Çeyrek = Base/g × 1.608 + 120 TRY',
    ],
    units: [
      unit('gram', 1, { multiplier: 1.015 }),
      unit('ceyrek', 1.608, { multiplier: 1.015, fixedPremium: 120 }),
    ],
  }),
  market({
    id: 'de',
    countryCode: 'DE',
    currency: 'EUR',
    timeZone: 'Europe/Berlin',
    centre: 'Deutsche Börse (Xetra / Frankfurt)',
    closeMinutes: 17 * 60 + 30,
    sessions: [{ startMinutes: 540, endMinutes: 1050 }],
    formula: ['Price/oz = XAUUSD / EURUSD', 'Price/g = Price/oz / 31.1034768'],
    units: [unit('oz', TROY_OUNCE_GRAMS), unit('gram', 1)],
  }),
  market({
    id: 'ch',
    countryCode: 'CH',
    currency: 'CHF',
    timeZone: 'Europe/Zurich',
    centre: 'SIX Swiss Exchange / Physical OTC',
    closeMinutes: 17 * 60 + 30,
    sessions: [{ startMinutes: 540, endMinutes: 1050 }],
    formula: ['Price/oz = XAUUSD × USDCHF', 'Price/kg = Price/oz × 32.1507466'],
    units: [
      unit('oz', TROY_OUNCE_GRAMS),
      unit('kg', TROY_OUNCE_GRAMS * 32.1507466),
    ],
  }),
  market({
    id: 'au',
    countryCode: 'AU',
    currency: 'AUD',
    timeZone: 'Australia/Perth',
    centre: 'The Perth Mint',
    closeMinutes: 17 * 60,
    sessions: [{ startMinutes: 540, endMinutes: 1020 }],
    formula: ['Price/oz = XAUUSD / AUDUSD', 'Price/kg = Price/oz × 32.1507466'],
    units: [
      unit('oz', TROY_OUNCE_GRAMS),
      unit('kg', TROY_OUNCE_GRAMS * 32.1507466),
    ],
  }),
];
export { getMarketSchedule } from './schedule';

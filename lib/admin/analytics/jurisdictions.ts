/**
 * BI Dashboard Jurisdiction & VAT/Sales-Tax Threshold Reference Data
 *
 * The 17 "primary statutory jurisdictions" used throughout the DavinTrade
 * Business Intelligence dashboards (Metrics #13-#19), sourced from
 * `davintrade-dashboard-stack/countries-vat-and-business-dashboard.xlsx`'s
 * "Tax Rules & Thresholds" sheet -- the only place in this codebase (or its
 * spec doc) that actually enumerates 17 jurisdictions. Deliberately separate
 * from `lib/country-config.ts` (13-country dLocal payment/locale list,
 * missing SG/HK/TW/KR) -- that file answers "which countries can pay via
 * dLocal", this one answers "which jurisdictions does BI/tax reporting
 * track", and the two lists differ.
 *
 * Two corrections versus the plan doc's prose (workbook is authoritative):
 * - NG has a real threshold (NGN 25,000,000) -- NOT a zero-threshold,
 *   day-one-collecting jurisdiction like the doc's prose implied.
 * - HK has no VAT/GST regime on digital services at all -- excluded from
 *   alerting entirely, not "collecting from day one" either.
 *
 * @module lib/admin/analytics/jurisdictions
 */

export type AlertLevel =
  | 'LEVEL_0_SAFE'
  | 'LEVEL_1_WARN'
  | 'LEVEL_2_ACTION'
  | 'LEVEL_3_CRITICAL'
  | 'ACTIVE_COLLECTING'
  | 'NOT_APPLICABLE'; // HK only -- no VAT/GST regime exists

export type ThresholdKind = 'ZERO' | 'AMOUNT' | 'NONE'; // NONE = HK

export interface JurisdictionConfig {
  iso: string;
  name: string;
  /** Raw country codes that roll up into this jurisdiction (e.g. EU's 27 members). */
  countryCodesInGroup: string[];
  thresholdKind: ThresholdKind;
  thresholdCurrency: string;
  /** null for ZERO (no threshold to exceed) and NONE (no regime at all). */
  thresholdLocalAmount: number | null;
  evaluationPeriod: string;
  /**
   * Static, approximate reference FX rate (local currency units per 1 USD).
   * NOT live-fetched -- matches Metric #17's own "Approximation" framing
   * (see spec §4.3) and no live FX infrastructure exists in this codebase
   * to build on (verified: grepped for FX/exchangeRate/fxRate, only hit is
   * this module and lib/country-config.ts's own equally-static rates).
   */
  approxUsdFxRate: number;
}

/** The 27 EU member state ISO codes (Non-Union OSS aggregation, spec §2.1). */
const EU_MEMBER_CODES = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
] as const;

export const OTHERS_ISO = 'OTHERS';
export const OTHERS_NAME = 'Other Countries';

export const JURISDICTIONS: JurisdictionConfig[] = [
  {
    iso: 'EU',
    name: 'European Union',
    countryCodesInGroup: [...EU_MEMBER_CODES, 'EU'],
    thresholdKind: 'ZERO',
    thresholdCurrency: 'EUR',
    thresholdLocalAmount: null,
    evaluationPeriod: 'From first transaction (Non-Union OSS)',
    approxUsdFxRate: 0.92, // source: workbook "Tax Rules & Thresholds"
  },
  {
    iso: 'GB',
    name: 'United Kingdom',
    countryCodesInGroup: ['GB', 'UK'],
    thresholdKind: 'AMOUNT',
    thresholdCurrency: 'GBP',
    thresholdLocalAmount: 90_000,
    evaluationPeriod: 'Rolling 12-month UK domestic sales',
    approxUsdFxRate: 0.78, // source: workbook
  },
  {
    iso: 'US',
    name: 'United States',
    countryCodesInGroup: ['US'],
    thresholdKind: 'AMOUNT',
    thresholdCurrency: 'USD',
    thresholdLocalAmount: 100_000, // per-state economic nexus; see recommendedAction note
    evaluationPeriod:
      'Per state / calendar year (also 200-txn threshold, not modeled here)',
    approxUsdFxRate: 1.0,
  },
  {
    iso: 'TH',
    name: 'Thailand',
    countryCodesInGroup: ['TH'],
    thresholdKind: 'AMOUNT',
    thresholdCurrency: 'THB',
    thresholdLocalAmount: 1_800_000,
    evaluationPeriod: 'Fiscal/accounting year',
    approxUsdFxRate: 36.5, // source: workbook
  },
  {
    iso: 'SG',
    name: 'Singapore',
    countryCodesInGroup: ['SG'],
    thresholdKind: 'AMOUNT',
    thresholdCurrency: 'SGD',
    thresholdLocalAmount: 100_000,
    evaluationPeriod: 'Rolling 12-month SG B2C sales',
    approxUsdFxRate: 1.34, // source: workbook
  },
  {
    iso: 'HK',
    name: 'Hong Kong',
    countryCodesInGroup: ['HK'],
    thresholdKind: 'NONE', // no VAT/GST regime on digital services at all
    thresholdCurrency: 'HKD',
    thresholdLocalAmount: null,
    evaluationPeriod: 'Not applicable -- no VAT/GST regime',
    // Not in the workbook or lib/country-config.ts -- flagged placeholder,
    // needs finance sign-off before this rate is treated as authoritative.
    approxUsdFxRate: 7.82,
  },
  {
    iso: 'JP',
    name: 'Japan',
    countryCodesInGroup: ['JP'],
    thresholdKind: 'AMOUNT',
    thresholdCurrency: 'JPY',
    thresholdLocalAmount: 10_000_000,
    evaluationPeriod: 'Base-year taxable sales in JP',
    approxUsdFxRate: 155, // source: lib/country-config.ts
  },
  {
    iso: 'TW',
    name: 'Taiwan',
    countryCodesInGroup: ['TW'],
    thresholdKind: 'AMOUNT',
    thresholdCurrency: 'TWD',
    thresholdLocalAmount: 480_000,
    evaluationPeriod: 'Per year (or TWD 40,000/month)',
    // Not in the workbook or lib/country-config.ts -- flagged placeholder.
    approxUsdFxRate: 32.0,
  },
  {
    iso: 'KR',
    name: 'South Korea',
    countryCodesInGroup: ['KR'],
    thresholdKind: 'ZERO',
    thresholdCurrency: 'KRW',
    thresholdLocalAmount: null,
    evaluationPeriod: 'From first transaction',
    // Not in the workbook or lib/country-config.ts -- flagged placeholder,
    // display-only since ZERO-kind jurisdictions have no threshold math.
    approxUsdFxRate: 1_380,
  },
  {
    iso: 'ID',
    name: 'Indonesia',
    countryCodesInGroup: ['ID'],
    thresholdKind: 'AMOUNT',
    thresholdCurrency: 'IDR',
    thresholdLocalAmount: 600_000_000,
    evaluationPeriod:
      'Rolling 12-month sales (also 12k-txn traffic threshold, not modeled here)',
    approxUsdFxRate: 15_800, // source: workbook
  },
  {
    iso: 'IN',
    name: 'India',
    countryCodesInGroup: ['IN'],
    thresholdKind: 'ZERO',
    thresholdCurrency: 'INR',
    thresholdLocalAmount: null,
    evaluationPeriod: 'From first transaction',
    approxUsdFxRate: 83.5, // source: lib/country-config.ts
  },
  {
    iso: 'VN',
    name: 'Vietnam',
    countryCodesInGroup: ['VN'],
    thresholdKind: 'ZERO',
    thresholdCurrency: 'VND',
    thresholdLocalAmount: null,
    evaluationPeriod: 'From first transaction',
    approxUsdFxRate: 25_400, // source: lib/country-config.ts
  },
  {
    iso: 'ZA',
    name: 'South Africa',
    countryCodesInGroup: ['ZA'],
    thresholdKind: 'AMOUNT',
    thresholdCurrency: 'ZAR',
    thresholdLocalAmount: 1_000_000,
    evaluationPeriod: '12 consecutive months turnover',
    approxUsdFxRate: 18.5, // source: lib/country-config.ts
  },
  {
    iso: 'TR',
    name: 'Turkey',
    countryCodesInGroup: ['TR'],
    thresholdKind: 'ZERO',
    thresholdCurrency: 'TRY',
    thresholdLocalAmount: null,
    evaluationPeriod: 'From first transaction',
    // source: lib/country-config.ts -- TRY is historically volatile,
    // this static rate goes stale faster than most others in this table.
    approxUsdFxRate: 32.5,
  },
  {
    iso: 'PK',
    name: 'Pakistan',
    countryCodesInGroup: ['PK'],
    thresholdKind: 'ZERO',
    thresholdCurrency: 'PKR',
    thresholdLocalAmount: null,
    evaluationPeriod: 'From first transaction',
    approxUsdFxRate: 278, // source: lib/country-config.ts
  },
  {
    iso: 'NG',
    name: 'Nigeria',
    countryCodesInGroup: ['NG'],
    thresholdKind: 'AMOUNT', // correction vs. plan doc prose -- see module header
    thresholdCurrency: 'NGN',
    thresholdLocalAmount: 25_000_000,
    evaluationPeriod: 'Rolling 12-month sales',
    // source: lib/country-config.ts -- NGN is volatile, this static rate
    // goes stale faster than most others in this table.
    approxUsdFxRate: 1_500,
  },
  {
    iso: 'AE',
    name: 'United Arab Emirates',
    countryCodesInGroup: ['AE'],
    thresholdKind: 'ZERO',
    thresholdCurrency: 'AED',
    thresholdLocalAmount: null,
    evaluationPeriod: 'From first transaction',
    approxUsdFxRate: 3.67, // source: lib/country-config.ts (pegged, stable)
  },
];

export function getJurisdiction(iso: string): JurisdictionConfig | undefined {
  return JURISDICTIONS.find((j) => j.iso === iso);
}

/**
 * Resolve a raw, possibly-null/free-text country code to its jurisdiction
 * ISO bucket (one of the 17 whitelisted codes, or 'OTHERS'). Pure JS
 * equivalent of `jurisdictionCaseSql()` below, for use once rows have
 * already been fetched (e.g. AffiliateProfile.country, which is a clean,
 * Zod-validated 2-letter code -- no raw SQL needed for that path).
 */
export function resolveJurisdictionIso(
  rawCountry: string | null | undefined
): string {
  if (!rawCountry) return OTHERS_ISO;
  const upper = rawCountry.toUpperCase();
  const match = JURISDICTIONS.find((j) =>
    j.countryCodesInGroup.includes(upper)
  );
  return match?.iso ?? OTHERS_ISO;
}

/**
 * Builds the `CASE WHEN ... END` SQL fragment (spec §2.1) that buckets a
 * country-code column into one of the 17 jurisdiction ISO codes or
 * 'OTHERS'. Returns a plain string for use inside `Prisma.raw()` -- safe
 * because every value here comes from the compile-time JURISDICTIONS
 * table above, never from request input.
 */
export function jurisdictionCaseSql(countryColumnSql: string): string {
  const branches = JURISDICTIONS.map((j) => {
    const codeList = j.countryCodesInGroup.map((c) => `'${c}'`).join(', ');
    return `WHEN UPPER(${countryColumnSql}) IN (${codeList}) THEN '${j.iso}'`;
  }).join('\n    ');

  return `CASE\n    ${branches}\n    ELSE '${OTHERS_ISO}'\n  END`;
}

export interface AlertClassification {
  level: AlertLevel;
  utilizationPct: number | null;
  approxLocalSales: number | null;
}

/**
 * Classifies a jurisdiction's trailing-12-month USD sales against its
 * statutory threshold into the 5-level alert matrix (workbook "Monitoring
 * & Alert Specs" sheet): Level 0 Safe (0-59.9%), Level 1 Warning
 * (60-79.9%), Level 2 Action (80-94.9%), Level 3 Critical (95-99.9%),
 * Active/Mandated Collection (>=100%). Zero-threshold jurisdictions are
 * always ACTIVE_COLLECTING; HK (no regime) is always NOT_APPLICABLE.
 */
export function classifyAlertLevel(
  cfg: JurisdictionConfig,
  trailing12mUsd: number
): AlertClassification {
  if (cfg.thresholdKind === 'NONE') {
    return {
      level: 'NOT_APPLICABLE',
      utilizationPct: null,
      approxLocalSales: null,
    };
  }

  const approxLocalSales = trailing12mUsd * cfg.approxUsdFxRate;

  if (cfg.thresholdKind === 'ZERO') {
    return {
      level: 'ACTIVE_COLLECTING',
      utilizationPct: 100,
      approxLocalSales,
    };
  }

  // AMOUNT
  const threshold = cfg.thresholdLocalAmount ?? 0;
  const utilizationPct =
    threshold > 0 ? (approxLocalSales / threshold) * 100 : 0;

  let level: AlertLevel;
  if (utilizationPct >= 100) level = 'ACTIVE_COLLECTING';
  else if (utilizationPct >= 95) level = 'LEVEL_3_CRITICAL';
  else if (utilizationPct >= 80) level = 'LEVEL_2_ACTION';
  else if (utilizationPct >= 60) level = 'LEVEL_1_WARN';
  else level = 'LEVEL_0_SAFE';

  return { level, utilizationPct, approxLocalSales };
}

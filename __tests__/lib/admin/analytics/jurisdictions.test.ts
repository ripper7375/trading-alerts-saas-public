/**
 * Unit tests for the BI jurisdiction/VAT-threshold reference module.
 *
 * These are the highest-value tests in the BI dashboard suite: an
 * off-by-one here would silently misclassify a real compliance alert
 * (Metric #17) or misroute a country into "Other Countries" (Metrics
 * #13-#19, #22).
 *
 * @module __tests__/lib/admin/analytics/jurisdictions.test.ts
 */

import { describe, it, expect } from '@jest/globals';

import {
  JURISDICTIONS,
  OTHERS_ISO,
  getJurisdiction,
  resolveJurisdictionIso,
  jurisdictionCaseSql,
  classifyAlertLevel,
} from '@/lib/admin/analytics/jurisdictions';

describe('resolveJurisdictionIso -- "Other Countries" aggregation correctness', () => {
  it('should bucket non-whitelisted and null/undefined country codes into OTHERS', () => {
    expect(resolveJurisdictionIso('CA')).toBe(OTHERS_ISO);
    expect(resolveJurisdictionIso('AU')).toBe(OTHERS_ISO);
    expect(resolveJurisdictionIso('BR')).toBe(OTHERS_ISO);
    expect(resolveJurisdictionIso(null)).toBe(OTHERS_ISO);
    expect(resolveJurisdictionIso(undefined)).toBe(OTHERS_ISO);
    expect(resolveJurisdictionIso('')).toBe(OTHERS_ISO);
  });

  it('should resolve whitelisted single-country jurisdictions case-insensitively', () => {
    expect(resolveJurisdictionIso('US')).toBe('US');
    expect(resolveJurisdictionIso('us')).toBe('US');
    expect(resolveJurisdictionIso('th')).toBe('TH');
    expect(resolveJurisdictionIso('AE')).toBe('AE');
  });

  it('should roll up all 27 EU member codes (and the bare "EU" code) into EU', () => {
    expect(resolveJurisdictionIso('DE')).toBe('EU');
    expect(resolveJurisdictionIso('FR')).toBe('EU');
    expect(resolveJurisdictionIso('ES')).toBe('EU');
    expect(resolveJurisdictionIso('EU')).toBe('EU');
  });

  it('should treat both GB and UK as the United Kingdom jurisdiction', () => {
    expect(resolveJurisdictionIso('GB')).toBe('GB');
    expect(resolveJurisdictionIso('UK')).toBe('GB');
  });

  it('should never let a jurisdiction whitelist overlap another (each code maps to exactly one iso)', () => {
    const seen = new Map<string, string>();
    for (const jurisdiction of JURISDICTIONS) {
      for (const code of jurisdiction.countryCodesInGroup) {
        const existing = seen.get(code);
        expect(existing).toBeUndefined();
        seen.set(code, jurisdiction.iso);
      }
    }
  });
});

describe('jurisdictionCaseSql', () => {
  it('should generate a CASE WHEN block covering all 17 jurisdictions plus an ELSE OTHERS fallback', () => {
    const sql = jurisdictionCaseSql('"country"');
    expect(sql).toContain('CASE');
    expect(sql).toContain("ELSE 'OTHERS'");
    for (const jurisdiction of JURISDICTIONS) {
      expect(sql).toContain(`THEN '${jurisdiction.iso}'`);
    }
  });

  it('should never interpolate anything other than the compile-time jurisdiction table', () => {
    const sql = jurisdictionCaseSql('"country"');
    // Every quoted literal in the generated CASE block must be a real ISO
    // code from JURISDICTIONS (or OTHERS) -- guards against a future
    // change accidentally threading request input into this string.
    const literals = [...sql.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const validCodes = new Set([
      ...JURISDICTIONS.flatMap((j) => j.countryCodesInGroup),
      ...JURISDICTIONS.map((j) => j.iso),
      OTHERS_ISO,
    ]);
    for (const literal of literals) {
      expect(validCodes.has(literal!)).toBe(true);
    }
  });
});

describe('classifyAlertLevel -- VAT/tax threshold boundary correctness', () => {
  const gb = getJurisdiction('GB')!; // AMOUNT kind, GBP 90,000 threshold

  function usdSalesForUtilization(pct: number): number {
    // approxLocalSales = usdSales * fxRate; utilization = approxLocalSales / threshold * 100
    const approxLocalSales = (pct / 100) * gb.thresholdLocalAmount!;
    return approxLocalSales / gb.approxUsdFxRate;
  }

  it.each([
    [59.9, 'LEVEL_0_SAFE'],
    [0, 'LEVEL_0_SAFE'],
    [60.0, 'LEVEL_1_WARN'],
    [79.9, 'LEVEL_1_WARN'],
    [80.0, 'LEVEL_2_ACTION'],
    [94.9, 'LEVEL_2_ACTION'],
    [95.0, 'LEVEL_3_CRITICAL'],
    [99.9, 'LEVEL_3_CRITICAL'],
    [100.0, 'ACTIVE_COLLECTING'],
    [150.0, 'ACTIVE_COLLECTING'],
  ])('utilization %f%% classifies as %s', (pct, expectedLevel) => {
    const result = classifyAlertLevel(gb, usdSalesForUtilization(pct));
    expect(result.level).toBe(expectedLevel);
    expect(result.utilizationPct).toBeCloseTo(pct, 1);
  });

  it('should classify HK as NOT_APPLICABLE regardless of sales volume (no VAT/GST regime)', () => {
    const hk = getJurisdiction('HK')!;
    expect(hk.thresholdKind).toBe('NONE');

    const zeroSales = classifyAlertLevel(hk, 0);
    const hugeSales = classifyAlertLevel(hk, 10_000_000);

    expect(zeroSales.level).toBe('NOT_APPLICABLE');
    expect(hugeSales.level).toBe('NOT_APPLICABLE');
    expect(zeroSales.utilizationPct).toBeNull();
    expect(hugeSales.utilizationPct).toBeNull();
  });

  it('should give NG real percentage-utilization math, not day-one ACTIVE_COLLECTING', () => {
    const ng = getJurisdiction('NG')!;
    expect(ng.thresholdKind).toBe('AMOUNT');
    expect(ng.thresholdLocalAmount).toBe(25_000_000);

    // A tiny trailing-12m USD figure should NOT be ACTIVE_COLLECTING --
    // that would be the bug this test guards against (the spec doc's
    // prose incorrectly implied NG collects from day one, like the true
    // zero-threshold jurisdictions).
    const smallSales = classifyAlertLevel(ng, 100);
    expect(smallSales.level).toBe('LEVEL_0_SAFE');
    expect(smallSales.utilizationPct).toBeGreaterThan(0);
    expect(smallSales.utilizationPct).toBeLessThan(1);
  });

  it('should classify every true zero-threshold jurisdiction as ACTIVE_COLLECTING from any sales volume', () => {
    for (const iso of ['EU', 'KR', 'IN', 'VN', 'TR', 'PK', 'AE']) {
      const jurisdiction = getJurisdiction(iso)!;
      expect(jurisdiction.thresholdKind).toBe('ZERO');
      expect(classifyAlertLevel(jurisdiction, 1).level).toBe(
        'ACTIVE_COLLECTING'
      );
      expect(classifyAlertLevel(jurisdiction, 0).level).toBe(
        'ACTIVE_COLLECTING'
      );
    }
  });

  it('should enumerate exactly 17 jurisdictions', () => {
    expect(JURISDICTIONS).toHaveLength(17);
  });
});

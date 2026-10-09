/**
 * @jest-environment node
 */

import * as engine4 from '@/lib/engine4';

describe('the public surface of lib/engine4 (parts 1 and 2)', () => {
  test('exports exactly these values (the database reader is not one of them)', () => {
    expect(Object.keys(engine4).sort()).toEqual(
      [
        'Engine4InputError',
        'PROFILE_BOUNDS',
        'PROFILE_DEFAULTS',
        'RISK_PCT_STEP',
        'RRR_NOTCH',
        'Rational',
        'TRADER_TYPES',
        'TRADING_STYLES',
        'buildScenarios',
        'completeProfile',
        'readDecimal',
        'readNonNegative',
        'readPositive',
        'resolveSymbolSpec',
        'sizeSetup',
        'sizeWithTarget',
        'targetAt',
        'underflowHelp',
        'validateProfile',
        'SENSORS',
        'SR_NAMES',
        'TIMEFRAMES',
        'ZONES_1',
        'badgeContextFromReading',
        'buildStopChoices',
        'compareLevels',
        'decideBadge',
        'decimalOrNull',
        'dedupeLevels',
        'groupStopOptions',
        'isAvailableReading',
        'levelFromStored',
        'levelsFromReadings',
        'nearestLevel',
        'nextOpposingLevel',
        'roomAhead',
        'sameLevel',
        'srLevelsFromContext',
        'stopOptions',
        'targetFitsBefore',
        'toStructure',
        'zoneDisagreement',
        'zoneFromStored',
        'zoneInvalidation',
      ].sort()
    );
  });

  test('loading the barrel does not load the database client', () => {
    // a client component imports the barrel; the reader (and with it Prisma, crypto
    // and zlib) is imported by path from server code only
    jest.isolateModules(() => {
      jest.doMock('@/lib/db/market-prisma', () => {
        throw new Error('the barrel must not load the database client');
      });
      expect(() => require('@/lib/engine4')).not.toThrow();
    });
  });

  test('the barrel reaches a working engine', () => {
    const profile = engine4.validateProfile(engine4.PROFILE_DEFAULTS);
    expect(profile.ok).toBe(true);
    const result = engine4.sizeSetup({
      side: 'BUY',
      entry: '2545.00',
      stopDistance: '15.00',
      equity: '10000',
      riskPct: '1.00',
      maxLeverage: '5',
      commission: '4',
      spec: {
        contractSize: '100',
        volumeMin: '0.01',
        volumeStep: '0.01',
        volumeMax: '100',
        typicalSpread: '0',
        point: '0.01',
      },
    });
    expect(result.status).toBe('OK');
  });
});

/**
 * @jest-environment node
 */

import * as engine4 from '@/lib/engine4';

describe('the public surface of lib/engine4 (parts 1 to 4)', () => {
  test('exports exactly these values (the database readers are not among them)', () => {
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
        'zoneFromEntryRow',
        'utcClock',
        'BLACKOUT_APPROXIMATE_SECONDS',
        'BLACKOUT_EXACT_SECONDS',
        'CALENDAR_LATE_SECONDS',
        'HOLDING_WINDOW_SECONDS',
        'TIER1_KINDS',
        'TIER1_SCHEMA_VERSION',
        'checkBlackout',
        'missingTier1Kinds',
        'parseTier1List',
        'SPECS_FUTURE_TOLERANCE_SECONDS',
        'SPECS_MAX_AGE_SECONDS',
        'readBrokerFigures',
        'NOT_OFFERED_ROW',
        'checkOffer',
        'parseLiveDataStatus',
        'ENTRY_TYPO_FRACTION',
        'M5_SECONDS',
        'checkEntryBound',
        'dayRange',
        'entryBounds',
        'buildModalDefinition',
        'customEntryStopChoices',
        'riskPreset',
        'rrrBounds',
        'VALIDATED_SETUP_SCHEMA',
        'serializeValidatedSetup',
        'validateSetup',
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

  test('loading the barrel does not load the Tier-1 config file', () => {
    jest.isolateModules(() => {
      jest.doMock('@/config/engine4/tier1-events.json', () => {
        throw new Error('the barrel must not load the Tier-1 config');
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

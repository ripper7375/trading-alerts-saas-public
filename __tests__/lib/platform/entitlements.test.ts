/**
 * @jest-environment node
 */

/**
 * The entitlement table and its readers (build step 7 part 6; architecture 7.3, ADR-074, ADR-072).
 * What the table says, how the readers ask it, and that an unknown tier or feature never opens a gap.
 * That a value changed in the table is the value every reader follows is
 * `entitlements-propagation.test.ts`.
 */

import {
  ENTITLEMENTS,
  ENTITLEMENT_FEATURES,
  ENTITLEMENT_TIERS,
  entitlementOf,
  entitlementTierOf,
  isEntitlementFeature,
  makeEntitlementOf,
  type EntitlementFeature,
  type EntitlementTable,
} from '@/config/entitlements';
import {
  canChooseModel,
  canDownloadChart,
  canSendChartToModel,
  canUseAiChat,
  canUseReport2,
  chatHistoryMonths,
  entitlementsOf,
  hasSessionClock,
  quotaModeOf,
  seesRecordedDemo,
} from '@/lib/platform/entitlements';
import { canAccessAiAnalyst } from '@/lib/tier-validation';

/** The table of 7.3, written out again here so a change of the file shows up as a failing test. */
const SECTION_7_3 = {
  ai_chat_and_report1: { FREE: 'RECORDED_DEMO', PRO: 'MONTHLY_UNITS' },
  report2: { FREE: false, PRO: true },
  chart_image_to_model: { FREE: false, PRO: true },
  chart_download: { FREE: false, PRO: true },
  session_clock_and_countdown: { FREE: false, PRO: true },
  model_choice: { FREE: false, PRO: 'PASSED_MODELS' },
  chat_history: { FREE: false, PRO: 'TWELVE_MONTHS' },
} as const;

describe('the table', () => {
  it('is the table of architecture 7.3, value for value', () => {
    expect(ENTITLEMENTS).toEqual(SECTION_7_3);
  });

  it('has the seven features and the two tiers, in the order of 7.3', () => {
    expect([...ENTITLEMENT_FEATURES]).toEqual([
      'ai_chat_and_report1',
      'report2',
      'chart_image_to_model',
      'chart_download',
      'session_clock_and_countdown',
      'model_choice',
      'chat_history',
    ]);
    expect([...ENTITLEMENT_TIERS]).toEqual(['FREE', 'PRO']);
    expect(Object.keys(ENTITLEMENTS)).toEqual([...ENTITLEMENT_FEATURES]);
  });

  it('gives every feature a value for both tiers', () => {
    for (const feature of ENTITLEMENT_FEATURES) {
      expect(Object.keys(ENTITLEMENTS[feature]).sort()).toEqual([
        'FREE',
        'PRO',
      ]);
    }
  });

  it('is frozen: no reader can change a value for the others', () => {
    expect(Object.isFrozen(ENTITLEMENTS)).toBe(true);
    for (const feature of ENTITLEMENT_FEATURES) {
      expect(Object.isFrozen(ENTITLEMENTS[feature])).toBe(true);
    }
    expect(() => {
      (ENTITLEMENTS as unknown as Record<string, unknown>)['report2'] = {
        FREE: true,
        PRO: true,
      };
    }).toThrow();
    expect(() => {
      (ENTITLEMENTS.report2 as unknown as Record<string, unknown>)['FREE'] =
        true;
    }).toThrow();
    expect(entitlementOf('report2', 'FREE')).toBe(false);
  });

  it('keeps Free off everything but the recorded demo (ADR-072)', () => {
    for (const feature of ENTITLEMENT_FEATURES) {
      const value = ENTITLEMENTS[feature].FREE;
      expect(
        feature === 'ai_chat_and_report1'
          ? value === 'RECORDED_DEMO'
          : value === false
      ).toBe(true);
    }
  });
});

describe('entitlementTierOf', () => {
  it('is Pro only for exactly PRO; everything else, a gap or a typo, is Free', () => {
    expect(entitlementTierOf('PRO')).toBe('PRO');
    expect(entitlementTierOf('FREE')).toBe('FREE');
    for (const tier of [
      undefined,
      null,
      '',
      'pro',
      'Pro',
      ' PRO',
      'PRO ',
      'ADMIN',
      'TRIAL',
      7,
      {},
      [],
      true,
    ]) {
      expect(entitlementTierOf(tier)).toBe('FREE');
    }
  });
});

describe('entitlementOf', () => {
  it.each(
    ENTITLEMENT_FEATURES.flatMap((f) =>
      ENTITLEMENT_TIERS.map((t) => [f, t] as const)
    )
  )('%s for %s is the table’s value', (feature, tier) => {
    expect(entitlementOf(feature, tier)).toBe(ENTITLEMENTS[feature][tier]);
  });

  it('reads an unknown tier as Free, never as Pro', () => {
    for (const feature of ENTITLEMENT_FEATURES) {
      for (const tier of [undefined, null, '', 'pro', 'ADMIN', 7]) {
        expect(entitlementOf(feature, tier)).toBe(ENTITLEMENTS[feature].FREE);
      }
    }
  });

  it('refuses a feature it does not know, with an error and not a value', () => {
    for (const feature of [
      '',
      'chat',
      'AI_CHAT_AND_REPORT1',
      'constructor',
      '__proto__',
      'toString',
      7,
      null,
      undefined,
    ]) {
      expect(() => entitlementOf(feature as EntitlementFeature, 'PRO')).toThrow(
        /unknown entitlement feature/
      );
    }
  });

  it('knows the features by name', () => {
    expect(isEntitlementFeature('report2')).toBe(true);
    expect(isEntitlementFeature('constructor')).toBe(false);
    expect(isEntitlementFeature(undefined)).toBe(false);
  });

  it('makeEntitlementOf reads the table it is given, not the shipped one', () => {
    const table: EntitlementTable = {
      ...ENTITLEMENTS,
      report2: { FREE: true, PRO: false },
    };
    const read = makeEntitlementOf(table);
    expect(read('report2', 'FREE')).toBe(true);
    expect(read('report2', 'PRO')).toBe(false);
    expect(read('chart_download', 'PRO')).toBe(true);
    expect(entitlementOf('report2', 'FREE')).toBe(false);
    // and an unknown tier is still Free in a table of its own
    expect(read('report2', 'ADMIN')).toBe(true);
  });
});

describe('the readers', () => {
  it('Pro has the live analyst, Free has the recorded demo and not the analyst', () => {
    expect(canUseAiChat('PRO')).toBe(true);
    expect(canUseAiChat('FREE')).toBe(false);
    expect(seesRecordedDemo('FREE')).toBe(true);
    expect(seesRecordedDemo('PRO')).toBe(false);
  });

  it('counts the analyst against the monthly units for Pro and not at all for Free', () => {
    expect(quotaModeOf('PRO')).toBe('MONTHLY_UNITS');
    expect(quotaModeOf('FREE')).toBe('NONE');
    expect(quotaModeOf(undefined)).toBe('NONE');
  });

  it('the other features are Pro’s', () => {
    for (const tier of ['PRO', 'FREE'] as const) {
      const pro = tier === 'PRO';
      expect(canUseReport2(tier)).toBe(pro);
      expect(canSendChartToModel(tier)).toBe(pro);
      expect(canDownloadChart(tier)).toBe(pro);
      expect(hasSessionClock(tier)).toBe(pro);
      expect(canChooseModel(tier)).toBe(pro);
      expect(chatHistoryMonths(tier)).toBe(pro ? 12 : 0);
    }
  });

  it('an unknown tier gets what Free gets, from every reader', () => {
    for (const tier of [undefined, null, 'pro', 'ADMIN', '']) {
      expect(canUseAiChat(tier)).toBe(false);
      expect(canUseReport2(tier)).toBe(false);
      expect(canSendChartToModel(tier)).toBe(false);
      expect(canDownloadChart(tier)).toBe(false);
      expect(hasSessionClock(tier)).toBe(false);
      expect(canChooseModel(tier)).toBe(false);
      expect(chatHistoryMonths(tier)).toBe(0);
      expect(quotaModeOf(tier)).toBe('NONE');
    }
  });

  it('entitlementsOf gives a tier’s whole row, and says which tier it read', () => {
    expect(entitlementsOf('PRO')).toEqual({
      tier: 'PRO',
      values: {
        ai_chat_and_report1: 'MONTHLY_UNITS',
        report2: true,
        chart_image_to_model: true,
        chart_download: true,
        session_clock_and_countdown: true,
        model_choice: 'PASSED_MODELS',
        chat_history: 'TWELVE_MONTHS',
      },
    });
    expect(entitlementsOf('whatever')).toEqual({
      tier: 'FREE',
      values: {
        ai_chat_and_report1: 'RECORDED_DEMO',
        report2: false,
        chart_image_to_model: false,
        chart_download: false,
        session_clock_and_countdown: false,
        model_choice: false,
        chat_history: false,
      },
    });
  });
});

describe('canAccessAiAnalyst (lib/tier-validation.ts) reads the table', () => {
  it('lets Pro in and keeps Free out, as it did before the table', () => {
    expect(canAccessAiAnalyst('PRO')).toEqual({ allowed: true });
    expect(canAccessAiAnalyst('FREE')).toEqual({
      allowed: false,
      reason: 'The AI analyst is a PRO feature. Upgrade to PRO to access it.',
    });
  });

  it('agrees with the platform reader for every tier', () => {
    for (const tier of ['PRO', 'FREE'] as const) {
      expect(canAccessAiAnalyst(tier).allowed).toBe(canUseAiChat(tier));
    }
  });

  it('is not the Free tier’s recorded demo: RECORDED_DEMO is not the analyst', () => {
    expect(ENTITLEMENTS.ai_chat_and_report1.FREE).toBe('RECORDED_DEMO');
    expect(canAccessAiAnalyst('FREE').allowed).toBe(false);
  });
});

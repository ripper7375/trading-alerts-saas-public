/**
 * @jest-environment node
 */

/**
 * The development preview of Report 2 (build step 5, part 7; plan decision D9 (a)).
 *
 * The preview must be an honest window on the real thing, and must not exist in a
 * production build. So: for every scenario it lists, the world it runs
 * (`app/dev/report2/world.ts`) answers byte for byte as the component tests' stand-in
 * does, which `__tests__/components/report2/api-parity.test.ts` holds to the real
 * routes; and the page, its server actions and its world all refuse under
 * NODE_ENV=production.
 */

import { join } from 'path';

import {
  consentOutcomeOf,
  buildScene,
  offerAnswerOf,
  sizeAnswerOf,
} from '@/app/dev/report2/world';
import { SCENARIOS, scenarioById } from '@/app/dev/report2/scenarios';
import { devConsent, devOffer, devSize } from '@/app/dev/report2/actions';
import { initialStop, stopDistanceFor } from '@/lib/engine4/templates/fields';
import type { SetupRequest } from '@/components/report2/api-client';

import {
  offerAnswer,
  scene as standIn,
  sizeAnswer,
  type Scene,
} from '../components/report2/helpers/engine-api';
import {
  readingOf,
  synthesisOf,
  type SetupOptions,
} from '../lib/engine4/helpers/setup';

jest.mock('@/app/dev/report2/preview-client', () => ({
  PreviewClient: () => null,
}));

/** the stand-in's options for a scenario of the preview */
function optionsOf(id: string): SetupOptions {
  const scenario = scenarioById(id)!;
  const base = standIn({ golden: scenario.golden });
  const slot = base.s.slot;
  const options: SetupOptions = { golden: scenario.golden };
  if (scenario.profile !== undefined)
    options.profile = scenario.profile as never;
  if (scenario.dataStatus !== undefined) {
    options.dataStatus = { status: scenario.dataStatus, dataAsOfSlot: slot };
  }
  if (scenario.price !== undefined) options.price = Number(scenario.price);
  if (scenario.release === 'CPI_IN_5_MIN') {
    options.events = [
      {
        valueId: 'dev-cpi',
        eventId: '900000001',
        eventName: 'TEST US CPI',
        eventTime: slot + 150 + 5 * 60,
        currency: 'USD',
        importance: 'HIGH',
        timeMode: 0,
        capturedAt: slot - 3600,
      },
    ];
  }
  if (scenario.release === 'RETAIL_SALES_IN_3_H') {
    options.events = [
      {
        valueId: 'dev-retail',
        eventId: '700000001',
        eventName: 'TEST US Retail Sales',
        eventTime: slot + 150 + 3 * 3600,
        currency: 'USD',
        importance: 'HIGH',
        timeMode: 1,
        capturedAt: slot - 3600,
      },
    ];
  }
  if (scenario.newer) {
    const pinned = synthesisOf(readingOf(base.s.g).reading, false);
    options.newest = {
      ...pinned,
      cycleSlot: slot + 300,
      bias: pinned.bias === 'LONG' ? 'SHORT' : 'LONG',
    };
  }
  return options;
}

describe('the scenarios', () => {
  test('there is a good spread of them, each with a unique id and a note', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    for (const scenario of SCENARIOS) {
      expect(scenario.label.length).toBeGreaterThan(10);
      expect(scenario.note.length).toBeGreaterThan(10);
    }
  });

  test('the first is the real 18 Sep cycle', () => {
    expect(SCENARIOS[0]!.id).toBe('18sep');
    expect(SCENARIOS[0]!.golden).toBe('01-');
  });
});

describe.each(SCENARIOS.map((s) => [s.id, s.label] as const))(
  '%s: %s',
  (id) => {
    let world: Scene;
    beforeAll(() => {
      world = standIn(optionsOf(id));
    });

    test('the offer is the stand-in’s, byte for byte', () => {
      const ours = offerAnswerOf(buildScene(id));
      const theirs = offerAnswer(world);
      expect(JSON.stringify(ours.modal)).toBe(JSON.stringify(theirs.modal));
      expect(JSON.stringify(ours.offer)).toBe(JSON.stringify(theirs.offer));
      expect(JSON.stringify(ours.blackout)).toBe(
        JSON.stringify(theirs.blackout)
      );
      expect(ours.cycleSlot).toBe(theirs.cycleSlot);
    });

    test('the setup the modal opens on is the stand-in’s, byte for byte', () => {
      const scene = buildScene(id);
      const modal = offerAnswerOf(scene).modal;
      if (modal.status === 'NOT_OFFERED') return;
      const pill = modal.pills.find((p) => !p.invalidated);
      if (pill === undefined) return;
      const start = initialStop(pill.stop);
      const request: SetupRequest = {
        cycleSlot: String(scene.slot),
        side: modal.side,
        zoneId: pill.zoneId,
        entry: pill.price,
        equity: modal.equity,
        riskPct: modal.risk.preset,
        stopDistance: stopDistanceFor(start.selection, pill.stop, start.custom),
        rrr: modal.rrr.preset,
        language: 'en-US',
      };
      const ours = sizeAnswerOf(scene, request);
      const theirs = sizeAnswer(world, {
        side: request.side,
        zoneId: request.zoneId,
        entry: request.entry,
        equity: request.equity,
        riskPct: request.riskPct,
        stopDistance: request.stopDistance,
        rrr: request.rrr,
      });
      expect(JSON.stringify(ours.setup)).toBe(JSON.stringify(theirs.setup));
      expect(ours.setupSha256).toBe(theirs.setupSha256);
      expect(JSON.stringify(ours.badge)).toBe(JSON.stringify(theirs.badge));
    });
  }
);

describe('what the preview shows in the cases that matter', () => {
  test('the real 18 Sep cycle: Z1 and Z2, half risk, no zone passed', () => {
    const modal = offerAnswerOf(buildScene('18sep')).modal;
    if (modal.status === 'NOT_OFFERED') throw new Error('not offered');
    expect(modal.pills.map((p) => p.zoneId)).toEqual(['Z1', 'Z2']);
    expect(modal.pills.map((p) => p.price)).toEqual(['4367.2', '4350.16']);
    expect(modal.risk.halfRisk).toBe(true);
    expect(modal.pills.some((p) => p.invalidated)).toBe(false);
  });

  test('price past Z1’s invalidation marks Z1 and leaves Z2', () => {
    const modal = offerAnswerOf(buildScene('invalidated')).modal;
    if (modal.status === 'NOT_OFFERED') throw new Error('not offered');
    expect(modal.pills.find((p) => p.zoneId === 'Z1')?.invalidated).toBe(true);
  });

  test('the stale and blackout scenarios are not offered, with their reasons', () => {
    const stale = offerAnswerOf(buildScene('stale')).modal;
    expect(stale.status).toBe('NOT_OFFERED');
    if (stale.status === 'NOT_OFFERED')
      expect(stale.reason?.code).toBe('DATA_STALE');
    const blackout = offerAnswerOf(buildScene('blackout'));
    expect(blackout.modal.status).toBe('NOT_OFFERED');
    expect(blackout.blackout.blocks[0]?.eventName).toBe('TEST US CPI');
  });

  test('a newer cycle offers a refresh', () => {
    const modal = offerAnswerOf(buildScene('refresh')).modal;
    expect(modal.status).toBe('REFRESH_OFFERED');
  });
});

describe('a consent in the preview', () => {
  const scene = () => buildScene('18sep');
  const request = (): SetupRequest & {
    action: 'ACCEPT';
    submissionId: string;
    shownSetupSha256: string;
  } => {
    const base: SetupRequest = {
      cycleSlot: String(scene().slot),
      side: 'BUY',
      zoneId: 'Z1',
      entry: '4367.2',
      equity: '10000',
      riskPct: '0.75',
      stopDistance: '16.78',
      rrr: '1.75',
      language: 'en-US',
    };
    return {
      ...base,
      action: 'ACCEPT',
      submissionId: 'dev-test-submission-0001',
      shownSetupSha256: sizeAnswerOf(scene(), base).setupSha256,
    };
  };

  test('is checked the way the route checks it, answers as recorded, and writes nothing', () => {
    const first = consentOutcomeOf(scene(), request());
    expect(first).toMatchObject({
      ok: true,
      duplicate: false,
      action: 'ACCEPT',
    });
    // the same press again is a duplicate, not a second record
    expect(consentOutcomeOf(scene(), request())).toMatchObject({
      ok: true,
      duplicate: true,
    });
  });

  test('refuses a setup that is not the one shown', () => {
    expect(
      consentOutcomeOf(scene(), {
        ...request(),
        shownSetupSha256: 'f'.repeat(64),
      })
    ).toEqual({ ok: false, code: 'SETUP_CHANGED', retryable: false });
  });

  test('refuses an Accept of a setup that failed a check', () => {
    const failing = {
      ...request(),
      riskPct: '2',
      submissionId: 'dev-test-submission-0002',
    };
    failing.shownSetupSha256 = sizeAnswerOf(scene(), failing).setupSha256;
    expect(consentOutcomeOf(scene(), failing)).toEqual({
      ok: false,
      code: 'CONSENT_REFUSED',
      retryable: false,
    });
  });
});

describe('it does not exist in a production build', () => {
  const env = process.env as Record<string, string | undefined>;
  const original = env['NODE_ENV'];
  afterEach(() => {
    env['NODE_ENV'] = original;
  });

  test('the page answers 404', () => {
    const Page = require('@/app/dev/report2/page').default as () => unknown;
    env['NODE_ENV'] = 'production';
    expect(() => Page()).toThrow();
    env['NODE_ENV'] = 'development';
    expect(Page()).toBeTruthy();
  });

  test('the world refuses', () => {
    env['NODE_ENV'] = 'production';
    expect(() => buildScene('18sep')).toThrow(/production/);
  });

  test('so do the server actions', async () => {
    env['NODE_ENV'] = 'production';
    await expect(devOffer('18sep')).rejects.toThrow(/production/);
    await expect(
      devSize('18sep', {
        cycleSlot: '1',
        side: 'BUY',
        entry: '1',
        equity: '1',
        riskPct: '1',
        stopDistance: '1',
        rrr: '1',
        language: 'en-US',
      })
    ).rejects.toThrow(/production/);
    await expect(
      devConsent('18sep', {
        cycleSlot: '1',
        side: 'BUY',
        entry: '1',
        equity: '1',
        riskPct: '1',
        stopDistance: '1',
        rrr: '1',
        language: 'en-US',
        action: 'ACCEPT',
        submissionId: 'x'.repeat(20),
        shownSetupSha256: 'a'.repeat(64),
      })
    ).rejects.toThrow(/production/);
  });

  test('the route is outside the compulsory pages (local-only preview routes are, by rule)', () => {
    const coverage = require(
      join(process.cwd(), 'scripts/i18n-translation-coverage.js')
    ) as {
      compulsoryPages: () => string[];
    };
    expect(
      coverage.compulsoryPages().some((p) => p.startsWith('app/dev/'))
    ).toBe(false);
  });
});

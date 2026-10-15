/**
 * @jest-environment node
 */

/**
 * The chart rule and its reader (build step 7 part 5; architecture 5.3 and 5.11, rule 8, plan
 * decision D9, finding S7-F8). Storage sits behind a port with call counters: the rule is judged
 * by what it sends AND by what it never asks storage for.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CHART_SLOT_SECONDS,
  chartMatchesCycle,
} from '@/lib/storage/chart-keys';
import type { ChartStamp, ChartVariant } from '@/lib/storage/chart-keys';
import { CHART_DECISIONS } from '@/lib/reply/contracts/trace-fields';
import type { PacketIntent } from '@/lib/reply/contracts/intake';
import {
  CHART_CONTENT_TYPES,
  DEFAULT_CHART_VARIANT,
  chartCalledFor,
  chartDecisionBeforeRead,
  readChart,
} from '@/lib/reply/read/chart';
import type {
  ChartImageObject,
  ChartPort,
  ChartRequest,
} from '@/lib/reply/read/chart';

import { INTENTS } from '../report1/helpers/report1-fixtures';

const SLOT = '2026-09-18T20:55Z';
const SLOT_SECONDS = Date.UTC(2026, 8, 18, 20, 55) / 1000;
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);

const stampFor = (
  slot: number,
  variant: ChartVariant = 'overlay'
): ChartStamp => ({
  slot,
  lastClosedBar: slot - CHART_SLOT_SECONDS,
  overlay: 'best_fit_a',
  variant,
});

interface FakeOptions {
  head?: ChartStamp | null | Error;
  image?: ChartImageObject | null | Error;
}

function fakePort(options: FakeOptions = {}): ChartPort & {
  calls: { stamp: ChartVariant[]; image: ChartVariant[] };
} {
  const calls = { stamp: [] as ChartVariant[], image: [] as ChartVariant[] };
  const head = 'head' in options ? options.head : stampFor(SLOT_SECONDS);
  const image =
    'image' in options
      ? options.image
      : { bytes: PNG, contentType: 'image/png', stamp: stampFor(SLOT_SECONDS) };
  return {
    calls,
    async getChartStamp(variant) {
      calls.stamp.push(variant);
      if (head instanceof Error) throw head;
      return head ?? null;
    },
    async getChartImage(variant) {
      calls.image.push(variant);
      if (image instanceof Error) throw image;
      return image ?? null;
    },
  };
}

const request = (patch: Partial<ChartRequest> = {}): ChartRequest => ({
  cycleSlot: SLOT,
  dataAllows: true,
  calledFor: true,
  tierAllows: true,
  modelVision: true,
  ...patch,
});

describe('when a question calls for the chart (decision D9)', () => {
  it('always for the two Panel C instant prompts', () => {
    for (const intent of [
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ] as const) {
      expect(chartCalledFor({ intent, firstOfCycle: true })).toBe(true);
      expect(chartCalledFor({ intent, firstOfCycle: false })).toBe(true);
    }
  });

  it('for a Direction or Entry question only when it is the first of its thread and cycle', () => {
    for (const intent of ['DIRECTION', 'ENTRY_TIMING'] as const) {
      expect(chartCalledFor({ intent, firstOfCycle: true })).toBe(true);
      expect(chartCalledFor({ intent, firstOfCycle: false })).toBe(false);
    }
  });

  it('never for a follow-up nobody asked a chart question in', () => {
    const others: PacketIntent[] = [
      'EXIT_TARGETS',
      'RISK_SIZING',
      'EXPLAIN',
      'NEWS',
      'REPORT_2',
    ];
    for (const intent of others) {
      expect(chartCalledFor({ intent, firstOfCycle: true })).toBe(false);
      expect(chartCalledFor({ intent, firstOfCycle: false })).toBe(false);
    }
  });

  it('is a decision about each of the nine intents', () => {
    expect(
      INTENTS.filter((intent) => chartCalledFor({ intent, firstOfCycle: true }))
    ).toEqual([
      'DIRECTION',
      'ENTRY_TIMING',
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ]);
  });
});

describe('the conditions checked before storage is touched', () => {
  const all = {
    dataAllows: true,
    calledFor: true,
    tierAllows: true,
    modelVision: true,
  };

  it('passes when all four hold', () => {
    expect(chartDecisionBeforeRead(all)).toBeNull();
  });

  it.each([
    ['dataAllows', 'DATA_STATUS'],
    ['calledFor', 'NOT_CALLED_FOR'],
    ['tierAllows', 'TIER'],
    ['modelVision', 'NO_VISION'],
  ] as const)('%s false is %s', (key, decision) => {
    expect(chartDecisionBeforeRead({ ...all, [key]: false })).toBe(decision);
  });

  it('names the first that fails, in the order data, call, tier, vision', () => {
    const none = {
      dataAllows: false,
      calledFor: false,
      tierAllows: false,
      modelVision: false,
    };
    expect(chartDecisionBeforeRead(none)).toBe('DATA_STATUS');
    expect(chartDecisionBeforeRead({ ...none, dataAllows: true })).toBe(
      'NOT_CALLED_FOR'
    );
    expect(
      chartDecisionBeforeRead({ ...none, dataAllows: true, calledFor: true })
    ).toBe('TIER');
    expect(
      chartDecisionBeforeRead({
        ...none,
        dataAllows: true,
        calledFor: true,
        tierAllows: true,
      })
    ).toBe('NO_VISION');
  });
});

describe('a chart of the cycle in hand', () => {
  it('is sent to a vision model, with the image as a data URL and a reference', async () => {
    const port = fakePort();
    const read = await readChart(request(), port);
    expect(read.decision).toBe('SENT');
    expect(read.note).toBeNull();
    expect(read.reason).toBeNull();
    expect(read.stamp).toEqual(stampFor(SLOT_SECONDS));
    expect(read.image).toEqual({
      ref: `chart:overlay:${SLOT_SECONDS}`,
      contentType: 'image/png',
      dataUrl: `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`,
      byteLength: PNG.byteLength,
    });
    expect(port.calls).toEqual({ stamp: ['overlay'], image: ['overlay'] });
  });

  it('is asked for in the variant given, the overlay render by default', async () => {
    expect(DEFAULT_CHART_VARIANT).toBe('overlay');
    const port = fakePort({
      head: stampFor(SLOT_SECONDS, 'standard'),
      image: {
        bytes: PNG,
        contentType: 'image/png',
        stamp: stampFor(SLOT_SECONDS, 'standard'),
      },
    });
    const read = await readChart(request({ variant: 'standard' }), port);
    expect(read.decision).toBe('SENT');
    expect(read.image?.ref).toBe(`chart:standard:${SLOT_SECONDS}`);
    expect(port.calls).toEqual({ stamp: ['standard'], image: ['standard'] });
  });

  it('is dropped for a text-only model without asking storage at all', async () => {
    const port = fakePort();
    const read = await readChart(request({ modelVision: false }), port);
    expect(read).toEqual({
      decision: 'NO_VISION',
      note: null,
      reason: null,
      stamp: null,
      image: null,
    });
    expect(port.calls).toEqual({ stamp: [], image: [] });
  });

  it('accepts the three image types the models take and no other', async () => {
    expect(CHART_CONTENT_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);
    for (const contentType of CHART_CONTENT_TYPES) {
      const read = await readChart(
        request(),
        fakePort({
          image: { bytes: PNG, contentType, stamp: stampFor(SLOT_SECONDS) },
        })
      );
      expect(read.decision).toBe('SENT');
      expect(
        read.image?.dataUrl.startsWith(`data:${contentType};base64,`)
      ).toBe(true);
    }
    for (const contentType of [
      'text/html',
      'image/svg+xml',
      'application/octet-stream',
      '',
    ]) {
      const read = await readChart(
        request(),
        fakePort({
          image: { bytes: PNG, contentType, stamp: stampFor(SLOT_SECONDS) },
        })
      );
      expect(read.decision).toBe('MISSING');
      expect(read.note).toBe('CHART_UNAVAILABLE');
      expect(read.image).toBeNull();
    }
  });

  it('is not sent when the image has no bytes', async () => {
    const read = await readChart(
      request(),
      fakePort({
        image: {
          bytes: new Uint8Array(0),
          contentType: 'image/png',
          stamp: stampFor(SLOT_SECONDS),
        },
      })
    );
    expect(read.decision).toBe('MISSING');
    expect(read.reason).toContain('CHART_BAD_IMAGE');
  });
});

describe('rule 8: a chart from another cycle is dropped, and the reply says so (5.14 item 4)', () => {
  it.each([
    ['the cycle before', SLOT_SECONDS - CHART_SLOT_SECONDS],
    ['an hour before', SLOT_SECONDS - 3600],
    ['the cycle after', SLOT_SECONDS + CHART_SLOT_SECONDS],
  ])('drops the chart of %s without downloading it', async (_name, slot) => {
    const port = fakePort({ head: stampFor(slot) });
    const read = await readChart(request(), port);
    expect(read.decision).toBe('CYCLE_MISMATCH');
    expect(read.note).toBe('CHART_OTHER_CYCLE');
    expect(read.image).toBeNull();
    expect(read.stamp).toEqual(stampFor(slot));
    expect(read.reason).toBe(
      `CHART_SLOT_MISMATCH: chart is for slot ${slot}, the cycle is slot ${SLOT_SECONDS}`
    );
    expect(port.calls.image).toEqual([]); // nothing was downloaded for nothing
  });

  it("judges the object it downloaded by that object's own stamp, not by the HEAD", async () => {
    // the renderer replaced the object between the HEAD and the GET
    const port = fakePort({
      head: stampFor(SLOT_SECONDS),
      image: {
        bytes: PNG,
        contentType: 'image/png',
        stamp: stampFor(SLOT_SECONDS + CHART_SLOT_SECONDS),
      },
    });
    const read = await readChart(request(), port);
    expect(read.decision).toBe('CYCLE_MISMATCH');
    expect(read.note).toBe('CHART_OTHER_CYCLE');
    expect(read.image).toBeNull();
    expect(port.calls).toEqual({ stamp: ['overlay'], image: ['overlay'] });
  });

  it('calls chartMatchesCycle of lib/storage and agrees with it on every slot', async () => {
    for (const offset of [-600, -300, 0, 300, 600]) {
      const stamp = stampFor(SLOT_SECONDS + offset);
      const read = await readChart(
        request(),
        fakePort({
          head: stamp,
          image: { bytes: PNG, contentType: 'image/png', stamp },
        })
      );
      const verdict = chartMatchesCycle(stamp, SLOT_SECONDS);
      expect(read.decision === 'SENT').toBe(verdict.matches);
    }
  });

  it('gives chartMatchesCycle its first caller outside a test (finding S7-F8)', () => {
    const source = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'lib',
        'reply',
        'read',
        'chart.ts'
      ),
      'utf8'
    );
    expect(source).toMatch(/from '@\/lib\/storage\/chart-keys'/);
    expect(
      source.match(/\bchartMatchesCycle\(/g)?.length
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('a chart that cannot be had', () => {
  it('is missing when there is no object or no trustworthy stamp, and the reply says so', async () => {
    const port = fakePort({ head: null });
    const read = await readChart(request(), port);
    expect(read).toEqual({
      decision: 'MISSING',
      note: 'CHART_UNAVAILABLE',
      reason: 'NO_CHART_STAMP',
      stamp: null,
      image: null,
    });
    expect(port.calls.image).toEqual([]);
  });

  it('is missing when storage fails, with the reason, and nothing is thrown', async () => {
    const stamp = await readChart(
      request(),
      fakePort({ head: new Error('R2 is down') })
    );
    expect(stamp.decision).toBe('MISSING');
    expect(stamp.note).toBe('CHART_UNAVAILABLE');
    expect(stamp.reason).toBe('CHART_STORE_ERROR: R2 is down');

    const image = await readChart(
      request(),
      fakePort({ image: new Error('socket hang up') })
    );
    expect(image.decision).toBe('MISSING');
    expect(image.reason).toBe('CHART_STORE_ERROR: socket hang up');
    expect(image.note).toBe('CHART_UNAVAILABLE');
    expect(image.image).toBeNull();
    expect(image.stamp).toEqual(stampFor(SLOT_SECONDS)); // what was judged is still reported

    // something thrown that is not an Error is still a chart that could not be had
    const thrower: ChartPort = {
      getChartStamp: () => Promise.reject('boom'),
      getChartImage: () => Promise.reject('boom'),
    };
    const odd = await readChart(request(), thrower);
    expect(odd.decision).toBe('MISSING');
    expect(odd.reason).toBe('CHART_STORE_ERROR: unknown error');
  });

  it('is missing when the image is gone after its stamp was read', async () => {
    const read = await readChart(request(), fakePort({ image: null }));
    expect(read.decision).toBe('MISSING');
    expect(read.reason).toBe('NO_CHART_IMAGE');
    expect(read.note).toBe('CHART_UNAVAILABLE');
    expect(read.image).toBeNull();
    expect(read.stamp).toEqual(stampFor(SLOT_SECONDS));
  });

  it('is missing when the downloaded object carries no stamp', async () => {
    const read = await readChart(
      request(),
      fakePort({ image: { bytes: PNG, contentType: 'image/png', stamp: null } })
    );
    expect(read.decision).toBe('MISSING');
    expect(read.reason).toBe('NO_CHART_STAMP');
    expect(read.image).toBeNull();
  });

  it('is missing when there is no cycle to compare it with, and storage is not asked', async () => {
    for (const cycleSlot of [null, 'not a slot', '2026-09-18T20:56Z']) {
      const port = fakePort();
      const read = await readChart(request({ cycleSlot }), port);
      expect(read.decision).toBe('MISSING');
      expect(read.note).toBe('CHART_UNAVAILABLE');
      expect(read.reason).toContain('NO_CYCLE');
      expect(port.calls).toEqual({ stamp: [], image: [] });
    }
  });
});

describe('what is never asked of storage, and never mentioned', () => {
  const quiet = [
    [
      'the data status does not allow a chart',
      { dataAllows: false },
      'DATA_STATUS',
    ],
    ['no question called for it', { calledFor: false }, 'NOT_CALLED_FOR'],
    ['the tier does not allow it', { tierAllows: false }, 'TIER'],
    ['the model cannot read it', { modelVision: false }, 'NO_VISION'],
  ] as const;

  it.each(quiet)('%s', async (_why, patch, decision) => {
    const port = fakePort();
    const read = await readChart(request(patch), port);
    expect(read.decision).toBe(decision);
    expect(read.note).toBeNull(); // nobody was promised a chart
    expect(read.image).toBeNull();
    expect(port.calls).toEqual({ stamp: [], image: [] });
  });

  it('answers with a word the trace contract has, in every case', async () => {
    const cases: Partial<ChartRequest>[] = [
      {},
      { modelVision: false },
      { tierAllows: false },
      { calledFor: false },
      { dataAllows: false },
      { cycleSlot: null },
    ];
    for (const patch of cases) {
      const read = await readChart(request(patch), fakePort());
      expect(CHART_DECISIONS).toContain(read.decision);
      // a note exists exactly for a chart that was wanted and could not be used
      expect(read.note !== null).toBe(
        read.decision === 'CYCLE_MISMATCH' || read.decision === 'MISSING'
      );
      // an image exists exactly when it was sent
      expect(read.image !== null).toBe(read.decision === 'SENT');
    }
  });
});

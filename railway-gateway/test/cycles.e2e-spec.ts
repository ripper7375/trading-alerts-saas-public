process.env['API_KEYS'] = 'push_worker_v5_test_key';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';

import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MAX_REASON_LENGTH } from '../src/cycle/active-indicator/channel-sources';
import { slotOf } from '../src/cycle/slot';
import { FakePrisma } from './helpers/fake-cycle-store';
import { REFRESH_SLOT, putCycle } from './helpers/reader-world';

/**
 * GET /api/v1/cycles/current, GET and POST /api/v1/active-indicator, through the
 * real application module (build step 2 part 6, rule 6 and 7).
 *
 * The cycle and the settings of the flip fixtures are laid out in the fake
 * database exactly as test/current-cycle.spec.ts lays them out, so the endpoint's
 * answer can be compared with the contract fixture the monolith's tests read.
 */

const KEY = 'Bearer push_worker_v5_test_key';
const T = REFRESH_SLOT - 2 * 86400 - 9 * 3600; // the slot of the flip fixtures
const SLOT = 300;
const fixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));

function queueMock() {
  return {
    add: jest.fn(),
    getJob: jest.fn().mockResolvedValue(null),
    client: { ping: jest.fn().mockResolvedValue('PONG') },
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    getPausedCount: jest.fn().mockResolvedValue(0),
    process: jest.fn(),
    on: jest.fn(),
  };
}

describe('cycle read and active-indicator endpoints (e2e)', () => {
  let app: INestApplication;
  let prisma: FakePrisma;

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = new FakePrisma();
    Object.assign(prisma, {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    });

    const queue = queueMock();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getQueueToken('market-data-sync'))
      .useValue(queue)
      .overrideProvider(getQueueToken('indicator-statistics-sync'))
      .useValue(queue)
      .overrideProvider(getQueueToken('economic-events-sync'))
      .useValue(queue)
      .overrideProvider(getQueueToken('currency-gold-indices-sync'))
      .useValue(queue)
      .overrideProvider(getQueueToken('cycle-ready'))
      .useValue(queue)
      // The symbol-specs queue (build step 2 part 8) -- same reason.
      .overrideProvider(getQueueToken('symbol-specs-sync'))
      .useValue(queue)
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    prisma.cycles.clear();
    prisma.resetSettings();
    prisma.queryLog = [];
    prisma.seedActiveIndicators();
  });

  const get = (url: string, auth: string | null = KEY) => {
    const req = request(app.getHttpServer()).get(url);
    return auth === null ? req : req.set('Authorization', auth);
  };
  const post = (body: unknown, auth: string | null = KEY) => {
    const req = request(app.getHttpServer()).post('/api/v1/active-indicator');
    if (auth !== null) req.set('Authorization', auth);
    return req.send(body as object);
  };

  /** The flip fixtures' setting, written the way the setter writes it (so id and time match). */
  const layOutFlip = async () => {
    await prisma.activeIndicatorSetting.create({
      data: {
        timeframe: 'M5',
        source: 'cherry_a',
        effective_slot: T,
        set_by: 'admin@example.test',
        reason: 'rehearsal',
      },
    });
  };

  describe('GET /api/v1/cycles/current', () => {
    it('401s without a key, with a wrong key, and with a key that is not a Bearer token', async () => {
      await get('/api/v1/cycles/current', null).expect(401);
      await get('/api/v1/cycles/current', 'Bearer wrong').expect(401);
      await get('/api/v1/cycles/current', 'push_worker_v5_test_key').expect(
        401
      );
    });

    it('answers for an empty database: no cycle, STALE or MARKET_CLOSED, the setting resolved at the wall-clock slot', async () => {
      const res = await get('/api/v1/cycles/current').expect(200);
      expect(res.body.contract).toBe('cycles-current/1');
      expect(res.body.cycle).toBeNull();
      expect(['STALE', 'MARKET_CLOSED']).toContain(res.body.dataStatus.status);
      expect(res.body.activeIndicators).toMatchObject({
        basis: 'WALL_CLOCK',
        resolvedAtSlot: slotOf(res.body.now),
      });
      expect(res.body.activeIndicators.byTimeframe.M5.source).toBe(
        'best_fit_a'
      );
      expect(res.body.activeIndicators.byTimeframe.M15.source).toBe('non_b');
    });

    it('is never cached', async () => {
      const res = await get('/api/v1/cycles/current').expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('serves exactly the contract fixture’s cycle and settings for the cycle AT the flip slot', async () => {
      await layOutFlip();
      putCycle(prisma, T - SLOT);
      putCycle(prisma, T);
      const res = await get('/api/v1/cycles/current').expect(200);
      const expected = fixture('cycles-current-after-flip.json');
      expect(res.body.cycle).toEqual(expected.cycle);
      expect(res.body.activeIndicators).toEqual(expected.activeIndicators);
    });

    it('serves exactly the contract fixture’s cycle and settings for the cycle BEFORE the flip slot', async () => {
      await layOutFlip();
      putCycle(prisma, T - SLOT);
      const res = await get('/api/v1/cycles/current').expect(200);
      const expected = fixture('cycles-current-before-flip.json');
      expect(res.body.cycle).toEqual(expected.cycle);
      expect(res.body.activeIndicators).toEqual(expected.activeIndicators);
    });

    it('the newest READY cycle decides, not a newer PENDING one: the flip waits for a READY cycle at T', async () => {
      await layOutFlip();
      putCycle(prisma, T - SLOT);
      putCycle(prisma, T, {
        state: 'PENDING',
        data_status: null,
        ready_at: null,
      });
      const res = await get('/api/v1/cycles/current').expect(200);
      expect(res.body.cycle.slot).toBe(T - SLOT);
      expect(res.body.activeIndicators.byTimeframe.M5.source).toBe(
        'best_fit_a'
      );
    });

    it('a timeframe with no setting is null, not a default', async () => {
      prisma.settings = [];
      const res = await get('/api/v1/cycles/current').expect(200);
      expect(res.body.activeIndicators.byTimeframe).toEqual({
        M5: null,
        M15: null,
      });
    });

    describe('?slot=: the setting AT the slot the caller is working on (the VPS renderer)', () => {
      it('the renderer’s case: asked for T while the newest READY cycle is T - 300, it gets the setting AT T and the gateway’s own cycle (the contract fixture)', async () => {
        await layOutFlip();
        putCycle(prisma, T - SLOT); // the gateway has not got T READY yet
        const res = await get(`/api/v1/cycles/current?slot=${T}`).expect(200);
        const expected = fixture('cycles-current-renderer-before-ready.json');
        expect(res.body.cycle).toEqual(expected.cycle);
        expect(res.body.activeIndicators).toEqual(expected.activeIndicators);
        expect(res.body.activeIndicators).toMatchObject({
          resolvedAtSlot: T,
          basis: 'REQUESTED_SLOT',
        });
      });

      it('without it the same database answers at the cycle’s slot: the old indicator', async () => {
        await layOutFlip();
        putCycle(prisma, T - SLOT);
        const res = await get('/api/v1/cycles/current').expect(200);
        expect(res.body.activeIndicators.byTimeframe.M5.source).toBe(
          'best_fit_a'
        );
        expect(res.body.activeIndicators.basis).toBe('CYCLE');
      });

      it('a slot before the change gets the old indicator, whatever cycles exist', async () => {
        await layOutFlip();
        putCycle(prisma, T);
        const res = await get(`/api/v1/cycles/current?slot=${T - SLOT}`).expect(
          200
        );
        expect(res.body.activeIndicators.byTimeframe.M5.source).toBe(
          'best_fit_a'
        );
        expect(res.body.cycle.slot).toBe(T);
      });

      it('slot 0 is a request', async () => {
        const res = await get('/api/v1/cycles/current?slot=0').expect(200);
        expect(res.body.activeIndicators).toMatchObject({
          resolvedAtSlot: 0,
          basis: 'REQUESTED_SLOT',
        });
      });

      it('a slot a few minutes ahead of the clock is accepted (clock difference with the VPS)', async () => {
        const ahead = slotOf(Math.floor(Date.now() / 1000)) + 2 * SLOT;
        await get(`/api/v1/cycles/current?slot=${ahead}`).expect(200);
      });

      it.each([
        ['not a number', 'tomorrow'],
        ['empty', ''],
        ['negative', '-300'],
        ['fractional', '300.5'],
        ['not on a boundary', '1789560001'],
        ['in exponent form', '1e9'],
        ['with a plus sign', '+1789560000'],
        ['too long to be a time', '17895600000000'],
      ])(
        '400s a slot that is %s, and answers nothing',
        async (_label, value) => {
          const res = await get(
            `/api/v1/cycles/current?slot=${encodeURIComponent(value)}`
          ).expect(400);
          expect(JSON.stringify(res.body)).toMatch(/slot/);
          expect(res.body.cycle).toBeUndefined();
        }
      );

      it('400s a slot that has not happened (more than ten minutes ahead of the gateway clock)', async () => {
        const far = slotOf(Math.floor(Date.now() / 1000)) + 4 * 3600;
        const res = await get(`/api/v1/cycles/current?slot=${far}`).expect(400);
        expect(JSON.stringify(res.body)).toMatch(/ahead of the gateway clock/);
      });

      it('400s a slot given twice', async () => {
        await get(`/api/v1/cycles/current?slot=${T}&slot=${T - SLOT}`).expect(
          400
        );
      });

      it('still needs the key', async () => {
        await get(`/api/v1/cycles/current?slot=${T}`, null).expect(401);
      });
    });
  });

  describe('GET /api/v1/active-indicator', () => {
    it('401s without a key', async () => {
      await get('/api/v1/active-indicator', null).expect(401);
    });

    it('lists the audit trail and the earliest slot a new setting may name', async () => {
      const before = slotOf(Math.floor(Date.now() / 1000));
      const res = await get('/api/v1/active-indicator').expect(200);
      const after = slotOf(Math.floor(Date.now() / 1000));
      expect(
        res.body.settings.map((s: { source: string }) => s.source).sort()
      ).toEqual(['best_fit_a', 'non_b']);
      expect([before + SLOT, after + SLOT]).toContain(
        res.body.earliestSettableSlot
      );
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('filters by timeframe and honours a limit', async () => {
      await layOutFlip();
      const m5 = await get('/api/v1/active-indicator?timeframe=M5').expect(200);
      expect(m5.body.settings.map((s: { source: string }) => s.source)).toEqual(
        ['cherry_a', 'best_fit_a']
      );
      const one = await get('/api/v1/active-indicator?limit=1').expect(200);
      expect(one.body.settings).toHaveLength(1);
    });

    it('400s a timeframe that does not exist', async () => {
      await get('/api/v1/active-indicator?timeframe=H1').expect(400);
    });
  });

  describe('POST /api/v1/active-indicator', () => {
    const future = () => slotOf(Math.floor(Date.now() / 1000)) + 3 * SLOT;
    const valid = () => ({
      timeframe: 'M5',
      source: 'cherry_a',
      effectiveSlot: future(),
      setBy: 'admin@example.test',
      reason: 'rehearsal',
    });

    it('401s without a key, and checks the key before the body', async () => {
      await post(valid(), null).expect(401);
      await post({ nonsense: true }, 'Bearer wrong').expect(401);
      expect(prisma.settings).toHaveLength(2);
    });

    it('201s a valid setting, appends exactly one row and returns it', async () => {
      const body = valid();
      const res = await post(body).expect(201);
      expect(res.body.status).toBe('SET');
      expect(res.body.setting).toMatchObject({
        timeframe: 'M5',
        source: 'cherry_a',
        effectiveSlot: body.effectiveSlot,
        setBy: 'admin@example.test',
        reason: 'rehearsal',
      });
      expect(prisma.settings).toHaveLength(3);
      // and it is in the audit trail, newest effective slot first
      const list = await get('/api/v1/active-indicator').expect(200);
      expect(list.body.settings[0].settingId).toBe(res.body.setting.settingId);
    });

    it('a setting in the future changes nothing for the cycle that is current', async () => {
      putCycle(prisma, T);
      await post(valid()).expect(201);
      const res = await get('/api/v1/cycles/current').expect(200);
      expect(res.body.activeIndicators.byTimeframe.M5.source).toBe(
        'best_fit_a'
      );
    });

    it('accepts fractal_edt, and a missing reason', async () => {
      const { reason: _unused, ...rest } = valid();
      await post({ ...rest, source: 'fractal_edt' }).expect(201);
    });

    it.each([
      [
        'a field the contract does not have',
        () => ({ ...valid(), extra: 1 }),
        /extra/,
      ],
      [
        'an unknown timeframe',
        () => ({ ...valid(), timeframe: 'H1' }),
        /timeframe/,
      ],
      [
        'a statistics source that is not a channel indicator',
        () => ({ ...valid(), source: 'sr_levels' }),
        /source/,
      ],
      [
        'a typo in the source',
        () => ({ ...valid(), source: 'bestfit_a' }),
        /source/,
      ],
      ['no author', () => ({ ...valid(), setBy: '' }), /setBy/],
      [
        'a missing author',
        () => ({
          timeframe: 'M5',
          source: 'cherry_a',
          effectiveSlot: future(),
        }),
        /setBy/,
      ],
      [
        'a slot that is not a number',
        () => ({ ...valid(), effectiveSlot: 'tomorrow' }),
        /effectiveSlot/,
      ],
      [
        'a fractional slot',
        () => ({ ...valid(), effectiveSlot: future() + 0.5 }),
        /effectiveSlot/,
      ],
      [
        'a reason beyond the limit',
        () => ({ ...valid(), reason: 'x'.repeat(MAX_REASON_LENGTH + 1) }),
        /reason/,
      ],
    ])('400s %s and writes nothing', async (_label, make, mentions) => {
      const res = await post(make()).expect(400);
      expect(JSON.stringify(res.body)).toMatch(mentions);
      expect(prisma.settings).toHaveLength(2);
    });

    it.each([
      [
        'the current slot',
        () => slotOf(Math.floor(Date.now() / 1000)),
        'SLOT_NOT_FUTURE',
      ],
      ['a slot in the past', () => REFRESH_SLOT - 86400, 'SLOT_NOT_FUTURE'],
      [
        'a slot that is not on a boundary',
        () => future() + 7,
        'SLOT_NOT_ON_BOUNDARY',
      ],
      ['a millisecond timestamp', () => 1_790_000_000_100, 'SLOT_TOO_FAR'],
    ])(
      '400s %s with the reason, and writes nothing',
      async (_label, slot, reason) => {
        const res = await post({ ...valid(), effectiveSlot: slot() }).expect(
          400
        );
        expect(res.body).toMatchObject({ status: 'REFUSED', reason });
        expect(typeof res.body.detail).toBe('string');
        expect(prisma.settings).toHaveLength(2);
      }
    );

    it('a newest READY cycle ahead of the clock raises the floor, over HTTP too', async () => {
      putCycle(prisma, future() + 2 * SLOT);
      const res = await post({
        ...valid(),
        effectiveSlot: future() + 2 * SLOT,
      }).expect(400);
      expect(res.body.reason).toBe('SLOT_NOT_FUTURE');
      await post({ ...valid(), effectiveSlot: future() + 3 * SLOT }).expect(
        201
      );
    });
  });
});

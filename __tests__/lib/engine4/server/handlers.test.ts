/**
 * @jest-environment node
 */

/**
 * The handlers called directly (build step 5, part 6), below the front door: what they
 * do when the front door has given them nothing to work with. Through a route a POST
 * always has a body (`runRoute` reads it first), so these guards are reached only here.
 */

import { Engine4HttpError } from '@/lib/engine4/server/errors';
import {
  handleConsent,
  handleOffer,
  handleProfileGet,
  handleProfilePost,
  handleSize,
} from '@/lib/engine4/server/handlers';
import type { RouteContext } from '@/lib/engine4/server/respond';
import { TraceBuilder } from '@/lib/engine4/server/trace';

// The handlers import the stores, the readers, the gateway client and Redis; none is used here.
jest.mock('@/lib/db/market-prisma', () => ({ marketPrisma: {} }));
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    userTradePreferences: { findUnique: jest.fn(async () => null) },
  },
}));
jest.mock('@/lib/active-indicator/gateway-client', () => ({
  fetchCurrentCycle: jest.fn(),
}));
jest.mock('@/lib/redis/client', () => ({ getRedisClient: jest.fn() }));

const context = (body: Record<string, unknown> | null): RouteContext => ({
  caller: { userId: 'u1', tier: 'PRO' },
  trace: new TraceBuilder('size', 'POST', () => 0, 'r'),
  body,
});

describe('a handler given no body', () => {
  test.each([
    ['profile POST', handleProfilePost],
    ['offer', handleOffer],
    ['size', handleSize],
    ['consent', handleConsent],
  ] as const)('%s refuses it as a 400', async (_name, handler) => {
    await expect(handler(context(null))).rejects.toMatchObject({
      name: 'Engine4HttpError',
      code: 'BAD_REQUEST',
      message: 'The body is required.',
    });
    await expect(handler(context(null))).rejects.toBeInstanceOf(
      Engine4HttpError
    );
  });
});

describe('handleProfileGet', () => {
  test('times its read as the stage "profile" and gives the defaults when there is no profile', async () => {
    const c = context(null);
    const out = await handleProfileGet(c);
    expect(out.fields).toMatchObject({
      stored: false,
      snapshotId: null,
      updatedAt: null,
    });
    expect(c.trace.snapshot().timings.stages.map((s) => s.name)).toEqual([
      'profile',
    ]);
  });
});

describe('handleProfilePost', () => {
  test('an invalid profile is refused with its message and every issue', async () => {
    const c = context({ profile: { traderType: 'DAY_TRADER' } });
    await expect(handleProfilePost(c)).rejects.toMatchObject({
      code: 'INVALID_PROFILE',
      message: 'The profile is not valid.',
      details: {
        issues: expect.arrayContaining([
          expect.objectContaining({ field: 'style' }),
        ]),
      },
    });
  });
});

describe('the other refusals say what they mean', () => {
  test('a body that is not usable names the missing field', async () => {
    await expect(handleSize(context({}))).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'cycleSlot is required.',
    });
    await expect(handleConsent(context({}))).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'action must be ACCEPT, MODIFY or DECLINE.',
    });
  });
});

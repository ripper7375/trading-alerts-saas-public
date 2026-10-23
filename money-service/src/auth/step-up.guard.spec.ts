/**
 * CODE-06B: the fresh step-up token in front of every call that moves payout money or changes
 * where payout money goes.
 *
 * The monolith mints a 120-second token (`purpose: 'payout_stepup'`, one audience per kind of
 * action, `sub` = the caller) after a fresh TOTP code (admin) or password (+ TOTP) check. This guard
 * verifies it with `NEXTAUTH_SECRET`, checks the caller is the subject and spends its `jti` in Redis,
 * so one token opens one call.
 *
 * Three groups: the contract (the literals the monolith must share), the guard, and a table of
 * which handlers carry it.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { SignJWT } from 'jose';

import { AffiliateGuard } from '../affiliate/affiliate.guard';
import { DisbursementBatchesController } from '../disbursement/controllers/disbursement-batches.controller';
import type { RedisService } from '../redis/redis.service';
import { WiseBatchesController } from '../wise/controllers/wise-batches.controller';
import { WiseRecipientsController } from '../wise/wise-recipients.controller';

import type { AuthenticatedRequest } from './jwt-auth.guard';
import {
  PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
  PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
  PAYOUT_STEP_UP_HEADER,
  PAYOUT_STEP_UP_ISSUER,
  PAYOUT_STEP_UP_MAX_LIFETIME_SECONDS,
  PAYOUT_STEP_UP_PURPOSE,
  PAYOUT_STEP_UP_USED_TTL_SECONDS,
  RequireStepUp,
  STEP_UP_AUDIENCE_METADATA,
  STEP_UP_REQUIRED_CODE,
  STEP_UP_UNAVAILABLE_CODE,
  StepUpGuard,
  payoutStepUpKeys,
} from './step-up.guard';

const SECRET = 'a-test-secret-of-sufficient-length-0123456789';
const ADMIN_ID = 'admin-1';

class Sample {
  @RequireStepUp(PAYOUT_STEP_UP_AUDIENCE_APPROVAL)
  approve(): void {}

  @RequireStepUp(PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT)
  recipient(): void {}

  // A route someone forgot to decorate: the guard must refuse, not wave it through.
  undecorated(): void {}
}

/** An in-memory stand-in for Redis: SET ... EX ... NX. */
function redisStub(): {
  redis: RedisService;
  set: jest.Mock;
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  const set = jest.fn(
    async (key: string, value: string, ...args: unknown[]) => {
      if (args.includes('NX') && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }
  );
  return {
    redis: { getClient: () => ({ set }) } as unknown as RedisService,
    set,
    store,
  };
}

interface TokenOptions {
  purpose?: string;
  audience?: string;
  issuer?: string;
  subject?: string | null;
  jti?: string | null;
  secret?: string;
  alg?: 'HS256' | 'HS512';
  /** Seconds from now; negative is already expired; null leaves the claim out. */
  expiresIn?: number | null;
  /** Seconds before now the token claims to be issued. */
  issuedAgo?: number;
  /** Leaves the issued-at claim out. */
  noIssuedAt?: boolean;
}

async function mint(options: TokenOptions = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const issuedAt = now - (options.issuedAgo ?? 0);
  let jwt = new SignJWT({ purpose: options.purpose ?? PAYOUT_STEP_UP_PURPOSE })
    .setProtectedHeader({ alg: options.alg ?? 'HS256' })
    .setIssuer(options.issuer ?? PAYOUT_STEP_UP_ISSUER)
    .setAudience(options.audience ?? PAYOUT_STEP_UP_AUDIENCE_APPROVAL);
  if (!options.noIssuedAt) jwt = jwt.setIssuedAt(issuedAt);
  if (options.expiresIn !== null) {
    jwt = jwt.setExpirationTime(issuedAt + (options.expiresIn ?? 120));
  }
  if (options.subject !== null) {
    jwt = jwt.setSubject(options.subject ?? ADMIN_ID);
  }
  if (options.jti !== null) {
    jwt = jwt.setJti(
      options.jti ?? `jti-${Math.random().toString(36).slice(2)}`
    );
  }
  return jwt.sign(new TextEncoder().encode(options.secret ?? SECRET));
}

function contextFor(
  handlerName: 'approve' | 'recipient' | 'undecorated',
  request: Partial<AuthenticatedRequest>
): ExecutionContext {
  return {
    getHandler: () => Sample.prototype[handlerName],
    getClass: () => Sample,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/** `userId` null is a request JwtAuthGuard never saw (no `request.user`). */
function requestWith(
  token: string | undefined,
  userId: string | null = ADMIN_ID
): Partial<AuthenticatedRequest> {
  return {
    headers: token === undefined ? {} : { [PAYOUT_STEP_UP_HEADER]: token },
    user: userId === null ? undefined : ({ id: userId } as never),
  } as Partial<AuthenticatedRequest>;
}

async function refusalOf(attempt: Promise<boolean>): Promise<{
  exception: unknown;
  body: unknown;
}> {
  try {
    await attempt;
  } catch (error) {
    return {
      exception: error,
      body: (error as { getResponse?: () => unknown }).getResponse?.(),
    };
  }
  throw new Error('the guard let the request through');
}

describe('payout step-up: the contract with the monolith', () => {
  it('uses the literals lib/auth/two-factor-token.ts mints with', () => {
    expect(PAYOUT_STEP_UP_PURPOSE).toBe('payout_stepup');
    expect(PAYOUT_STEP_UP_ISSUER).toBe('davintrade-2fa');
    expect(PAYOUT_STEP_UP_AUDIENCE_APPROVAL).toBe(
      'money-service:payout-approval'
    );
    expect(PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT).toBe(
      'money-service:wise-recipient'
    );
    expect(PAYOUT_STEP_UP_HEADER).toBe('x-payout-step-up');
    expect(PAYOUT_STEP_UP_MAX_LIFETIME_SECONDS).toBe(120);
  });

  it('marks a spent token past its own lifetime', () => {
    expect(PAYOUT_STEP_UP_USED_TTL_SECONDS).toBeGreaterThan(
      PAYOUT_STEP_UP_MAX_LIFETIME_SECONDS
    );
    expect(payoutStepUpKeys.used('abc')).toBe('payout-stepup:used:abc');
  });
});

describe('StepUpGuard', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  let redis: ReturnType<typeof redisStub>;
  let guard: StepUpGuard;

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = SECRET;
    redis = redisStub();
    guard = new StepUpGuard(new Reflector(), redis.redis);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    if (originalSecret === undefined) delete process.env['NEXTAUTH_SECRET'];
    else process.env['NEXTAUTH_SECRET'] = originalSecret;
  });

  it('lets a valid token through once and spends its jti', async () => {
    const token = await mint({ jti: 'jti-ok' });

    await expect(
      guard.canActivate(contextFor('approve', requestWith(token)))
    ).resolves.toBe(true);

    expect(redis.set).toHaveBeenCalledWith(
      'payout-stepup:used:jti-ok',
      '1',
      'EX',
      PAYOUT_STEP_UP_USED_TTL_SECONDS,
      'NX'
    );
  });

  it('refuses the same token the second time (403)', async () => {
    const token = await mint({ jti: 'jti-twice' });
    await guard.canActivate(contextFor('approve', requestWith(token)));

    const { exception, body } = await refusalOf(
      guard.canActivate(contextFor('approve', requestWith(token)))
    );

    expect(exception).toBeInstanceOf(ForbiddenException);
    expect(body).toMatchObject({ code: STEP_UP_REQUIRED_CODE });
  });

  it('lets exactly one of two parallel calls with one token through', async () => {
    const token = await mint({ jti: 'jti-race' });

    const results = await Promise.allSettled([
      guard.canActivate(contextFor('approve', requestWith(token))),
      guard.canActivate(contextFor('approve', requestWith(token))),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('refuses a request with no token (403)', async () => {
    const { exception, body } = await refusalOf(
      guard.canActivate(contextFor('approve', requestWith(undefined)))
    );

    expect(exception).toBeInstanceOf(ForbiddenException);
    expect(body).toMatchObject({ code: STEP_UP_REQUIRED_CODE });
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('refuses an expired token (403)', async () => {
    const token = await mint({ issuedAgo: 300, expiresIn: 120 });

    const { exception } = await refusalOf(
      guard.canActivate(contextFor('approve', requestWith(token)))
    );

    expect(exception).toBeInstanceOf(ForbiddenException);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it.each([
    ['another audience', { audience: PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT }],
    ['another purpose', { purpose: '2fa_verified' }],
    ['another issuer', { issuer: 'someone-else' }],
    ['another secret', { secret: 'a-different-secret-0123456789abcdef' }],
    ['another algorithm', { alg: 'HS512' as const }],
    ['no subject', { subject: null }],
    ['no jti', { jti: null }],
    ['an empty jti', { jti: '' }],
    // 600 seconds is not "120 seconds": a token minted with a long life is refused.
    ['a lifetime past 120 seconds', { expiresIn: 600 }],
    // jose accepts a token with no expiry or no issued-at; a step-up token must not be one.
    ['no expiry (a token that never ends)', { expiresIn: null }],
    ['no issued-at', { noIssuedAt: true }],
  ] as const)(
    'refuses a token with %s without spending it',
    async (_label, options) => {
      const token = await mint(options as TokenOptions);

      const { exception, body } = await refusalOf(
        guard.canActivate(contextFor('approve', requestWith(token)))
      );

      expect(exception).toBeInstanceOf(ForbiddenException);
      expect(body).toMatchObject({ code: STEP_UP_REQUIRED_CODE });
      expect(redis.set).not.toHaveBeenCalled();
    }
  );

  it('refuses a token minted for someone else without spending it', async () => {
    const token = await mint({ subject: 'another-admin', jti: 'jti-theirs' });

    const { exception } = await refusalOf(
      guard.canActivate(contextFor('approve', requestWith(token, ADMIN_ID)))
    );

    expect(exception).toBeInstanceOf(ForbiddenException);
    expect(redis.store.has('payout-stepup:used:jti-theirs')).toBe(false);
  });

  it('refuses a garbage token', async () => {
    const { exception } = await refusalOf(
      guard.canActivate(contextFor('approve', requestWith('not-a-token')))
    );

    expect(exception).toBeInstanceOf(ForbiddenException);
  });

  it('accepts a wise-recipient token only on a route decorated for it', async () => {
    const token = await mint({
      audience: PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
      subject: 'affiliate-user-1',
    });

    await expect(
      guard.canActivate(
        contextFor('recipient', requestWith(token, 'affiliate-user-1'))
      )
    ).resolves.toBe(true);
  });

  it('refuses a request with no user (JwtAuthGuard did not run)', async () => {
    const token = await mint();

    const { exception } = await refusalOf(
      guard.canActivate(contextFor('approve', requestWith(token, null)))
    );

    expect(exception).toBeInstanceOf(ForbiddenException);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('refuses a route that has the guard but no audience (never opens)', async () => {
    const token = await mint();

    const { exception } = await refusalOf(
      guard.canActivate(contextFor('undecorated', requestWith(token)))
    );

    expect(exception).toBeInstanceOf(ForbiddenException);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('answers 503 and does not let the call through when Redis is down', async () => {
    const token = await mint({ jti: 'jti-redis-down' });
    redis.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { exception, body } = await refusalOf(
      guard.canActivate(contextFor('approve', requestWith(token)))
    );

    expect(exception).toBeInstanceOf(ServiceUnavailableException);
    expect(body).toMatchObject({ code: STEP_UP_UNAVAILABLE_CODE });
  });

  it('answers 503 when NEXTAUTH_SECRET is not set (fails closed)', async () => {
    const token = await mint();
    delete process.env['NEXTAUTH_SECRET'];

    const { exception } = await refusalOf(
      guard.canActivate(contextFor('approve', requestWith(token)))
    );

    expect(exception).toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('which handlers carry the step-up', () => {
  const guardsOf = (target: object): unknown[] =>
    (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ??
    [];
  const audienceOf = (target: object): unknown =>
    Reflect.getMetadata(STEP_UP_AUDIENCE_METADATA, target);

  const gated: Array<[string, object, string]> = [
    [
      'DisbursementBatchesController.execute',
      DisbursementBatchesController.prototype.execute,
      PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
    ],
    [
      'WiseBatchesController.complete',
      WiseBatchesController.prototype.complete,
      PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
    ],
    [
      'WiseBatchesController.fund',
      WiseBatchesController.prototype.fund,
      PAYOUT_STEP_UP_AUDIENCE_APPROVAL,
    ],
    [
      'WiseRecipientsController.create (POST /wise/recipients)',
      WiseRecipientsController.prototype.create,
      PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
    ],
    [
      'WiseRecipientsController.deactivate (DELETE /wise/recipients/:id)',
      WiseRecipientsController.prototype.deactivate,
      PAYOUT_STEP_UP_AUDIENCE_WISE_RECIPIENT,
    ],
  ];

  it.each(gated)(
    '%s has StepUpGuard and the right audience',
    (_name, handler, audience) => {
      expect(guardsOf(handler)).toContain(StepUpGuard);
      expect(audienceOf(handler)).toBe(audience);
    }
  );

  it('runs the step-up after the role guards, never before', () => {
    // Method-level guards run in the order listed, after the controller's JwtAuthGuard (+ AdminGuard).
    const recipientCreate = guardsOf(WiseRecipientsController.prototype.create);
    expect(recipientCreate.indexOf(AffiliateGuard)).toBeGreaterThanOrEqual(0);
    expect(recipientCreate.indexOf(StepUpGuard)).toBeGreaterThan(
      recipientCreate.indexOf(AffiliateGuard)
    );
    const recipientDelete = guardsOf(
      WiseRecipientsController.prototype.deactivate
    );
    expect(recipientDelete.indexOf(StepUpGuard)).toBeGreaterThan(
      recipientDelete.indexOf(AffiliateGuard)
    );
  });

  it('leaves the reads and the records of what already happened alone', () => {
    const ungated: Array<[string, object]> = [
      ['WiseBatchesController.list', WiseBatchesController.prototype.list],
      ['WiseBatchesController.get', WiseBatchesController.prototype.get],
      [
        'WiseBatchesController.markFunded',
        WiseBatchesController.prototype.markFunded,
      ],
      ['WiseBatchesController.cancel', WiseBatchesController.prototype.cancel],
      [
        'WiseRecipientsController.getMine',
        WiseRecipientsController.prototype.getMine,
      ],
      [
        'WiseRecipientsController.revalidate',
        WiseRecipientsController.prototype.revalidate,
      ],
      [
        'WiseRecipientsController.list',
        WiseRecipientsController.prototype.list,
      ],
    ];
    for (const [name, handler] of ungated) {
      expect({
        name,
        guarded: guardsOf(handler).includes(StepUpGuard),
      }).toEqual({ name, guarded: false });
    }
  });

  it('is a CanActivate guard', () => {
    const instance: CanActivate = new StepUpGuard(
      new Reflector(),
      redisStub().redis
    );
    expect(typeof instance.canActivate).toBe('function');
  });
});

import { readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as ts from 'typescript';

import type { PrismaService } from '../prisma/prisma.service';
import type { RedisService } from '../redis/redis.service';
import { AuthService } from './auth.service';
import type { RefreshTokenService } from './refresh-token.service';

jest.mock('../email/email.util', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail: jest.fn().mockResolvedValue({ success: true }),
}));

/**
 * Sign-in must not depend on columns it does not use.
 *
 * A Prisma call on `User` with no `select` (and every create, update and upsert, which RETURN the
 * row) asks the database for every column of the generated client. On 2026-10-19 `User.deletedAt`
 * was deployed before its migration was applied and sign-in failed with "The column User.deletedAt
 * does not exist". Two kinds of evidence, as in the monolith's `user-select-guard.test.ts`:
 *  1. a source guard over the auth files and the two `UsersService` calls that change a password or
 *     an e-mail address;
 *  2. AuthService run against a database that rejects any `User` call with no `select`.
 */

const SRC = join(__dirname, '..');
const USER_METHODS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'update',
  'upsert',
  'delete',
]);

interface UserCall {
  line: number;
  method: string;
  hasSelect: boolean;
  hasInclude: boolean;
}

function userCalls(fileName: string, text: string): UserCall[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const calls: UserCall[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      USER_METHODS.has(node.expression.name.text) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === 'user'
    ) {
      const arg = node.arguments[0];
      const names =
        arg && ts.isObjectLiteralExpression(arg)
          ? arg.properties.map((p) => p.name?.getText(sf))
          : [];
      calls.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        method: node.expression.name.text,
        hasSelect: names.includes('select'),
        hasInclude: names.includes('include'),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return calls;
}

describe('source guard: the auth files name the User columns they use', () => {
  const authDir = join(SRC, 'auth');
  const guarded = [
    ...readdirSync(authDir)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
      .map((f) => join(authDir, f)),
    join(SRC, 'users', 'users.service.ts'),
    join(SRC, 'realtime', 'realtime.gateway.ts'),
  ];

  it('finds the violation in a snippet that has one (the scanner is not blind)', () => {
    const calls = userCalls(
      'bad.ts',
      `
      await this.prisma.user.findUnique({ where: { email } });
      await this.prisma.user.update({ where: { id }, data: {} });
      await this.prisma.user.findUnique({ where: { id }, include: { x: true } });
      await tx.user.create({ data: {}, select: { id: true } });
    `
    );
    expect(calls.map((c) => [c.method, c.hasSelect, c.hasInclude])).toEqual([
      ['findUnique', false, false],
      ['update', false, false],
      ['findUnique', false, true],
      ['create', true, false],
    ]);
  });

  it('every User call in them has an explicit select and no include', () => {
    const violations: string[] = [];
    let seen = 0;
    for (const file of guarded) {
      for (const call of userCalls(file, readFileSync(file, 'utf8'))) {
        seen += 1;
        const where = `${relative(SRC, file).replace(/\\/g, '/')}:${call.line} user.${call.method}`;
        if (!call.hasSelect) violations.push(`${where}: no select`);
        if (call.hasInclude)
          violations.push(`${where}: include returns every column`);
      }
    }
    expect(seen).toBeGreaterThan(25); // the guard is looking at something
    expect(violations).toEqual([]);
  });
});

// ─── Behaviour ───────────────────────────────────────────────────────────────

const MISSING_COLUMN = 'deletedAt';
const TEST_SECRET = 'test-nextauth-secret-value-not-real';

describe('behaviour: AuthService against a database that lacks a column the code knows about', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const originalEnv = process.env['NODE_ENV'];
  let row: unknown;
  let calls: Array<{
    method: string;
    args: Record<string, unknown> | undefined;
  }>;
  let service: AuthService;
  let refreshTokens: {
    issue: jest.Mock;
    rotate: jest.Mock;
    revokeByRawToken: jest.Mock;
  };

  /** The 2FA completion marks its token used in Redis; every SET succeeds here. */
  const redis = { getClient: () => ({ set: jest.fn(async () => 'OK') }) };

  /** A `User` call fails like Postgres would if it asks for a column that is not there. */
  const strict = (method: string) =>
    jest.fn(async (args?: Record<string, unknown>) => {
      calls.push({ method, args });
      const select = args?.['select'] as Record<string, unknown> | undefined;
      if (!select || MISSING_COLUMN in select) {
        throw new Error(
          `The column User.${MISSING_COLUMN} does not exist in the current database.`
        );
      }
      return row;
    });

  const userRow = async (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    image: null,
    password: await bcrypt.hash('correct-password', 4),
    tier: 'FREE',
    role: 'USER',
    isAffiliate: false,
    isActive: true,
    emailVerified: new Date('2026-01-01'),
    twoFactorEnabled: false,
    resetTokenExpiry: new Date(Date.now() + 60_000),
    updatedAt: new Date(Date.now() - 60_000),
    ...overrides,
  });

  beforeEach(() => {
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    process.env['NODE_ENV'] = 'test';
    calls = [];
    const prisma = {
      user: {
        findUnique: strict('findUnique'),
        findFirst: strict('findFirst'),
        create: strict('create'),
        update: strict('update'),
        upsert: strict('upsert'),
        // CODE-02B: the reset commits together with the session-version bump (updateMany never
        // returns the row, so it needs no select).
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      refreshToken: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      $transaction: async (
        callback: (tx: unknown) => Promise<unknown>
      ): Promise<unknown> => callback(prisma),
    };
    refreshTokens = {
      issue: jest
        .fn()
        .mockResolvedValue({ rawToken: 'raw', expiresAt: new Date() }),
      rotate: jest.fn().mockResolvedValue({
        userId: 'user-1',
        issued: { rawToken: 'new-raw', expiresAt: new Date() },
      }),
      revokeByRawToken: jest.fn(),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      refreshTokens as unknown as RefreshTokenService,
      redis as unknown as RedisService
    );
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
    process.env['NODE_ENV'] = originalEnv;
  });

  it('the strict database really rejects a call with no select (the test can fail)', async () => {
    row = await userRow();
    const bare = new AuthService(
      {
        user: {
          findUnique: jest.fn(async () =>
            Promise.reject(
              new Error(`The column User.${MISSING_COLUMN} does not exist`)
            )
          ),
        },
      } as unknown as PrismaService,
      refreshTokens as unknown as RefreshTokenService,
      redis as unknown as RedisService
    );
    await expect(
      bare.login('alice@example.com', 'correct-password')
    ).rejects.toThrow(/does not exist/);
  });

  it('password login issues tokens', async () => {
    row = await userRow();

    const result = await service.login('alice@example.com', 'correct-password');

    expect(result.user).toMatchObject({
      id: 'user-1',
      email: 'alice@example.com',
    });
    expect(refreshTokens.issue).toHaveBeenCalledTimes(1);
  });

  it('password login still starts the 2FA challenge, and still refuses a deactivated account', async () => {
    row = await userRow({ twoFactorEnabled: true });
    await expect(
      service.login('alice@example.com', 'correct-password')
    ).rejects.toMatchObject({ code: 'TWO_FACTOR_REQUIRED' });

    row = await userRow({ isActive: false });
    await expect(
      service.login('alice@example.com', 'correct-password')
    ).rejects.toMatchObject({ code: 'ACCOUNT_DEACTIVATED' });
  });

  it('2FA completion issues tokens', async () => {
    row = await userRow({ twoFactorEnabled: true });
    const token = jwt.sign(
      { purpose: '2fa_verified', jti: 'jti-1', chal: 'chal-1' },
      TEST_SECRET,
      {
        algorithm: 'HS256',
        issuer: 'davintrade-2fa',
        subject: 'user-1',
        expiresIn: 60,
      }
    );

    const result = await service.login('__2fa_verified__', token);

    expect(result.user.id).toBe('user-1');
  });

  it('refresh issues a new access token', async () => {
    row = await userRow();

    const result = await service.refresh('old-raw');

    expect(result.refreshToken).toBe('new-raw');
  });

  it('register creates the user and gets back what the verification e-mail needs', async () => {
    row = null;
    const findUnique = (
      service as unknown as {
        prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
      }
    ).prisma.user;
    findUnique.findUnique.mockImplementationOnce(
      async (args?: Record<string, unknown>) => {
        calls.push({ method: 'findUnique', args });
        if (!args?.['select']) throw new Error('no select');
        return null;
      }
    );
    findUnique.create.mockImplementationOnce(
      async (args?: Record<string, unknown>) => {
        calls.push({ method: 'create', args });
        if (!args?.['select']) throw new Error('no select');
        return { id: 'user-2', email: 'new@example.com', name: 'New' };
      }
    );

    const result = await service.register(
      'new@example.com',
      'a-password',
      'New'
    );

    expect(result.userId).toBe('user-2');
  });

  it('forgot password, reset password, verify e-mail and resend verification all work', async () => {
    row = await userRow();
    await expect(
      service.forgotPassword('alice@example.com')
    ).resolves.toMatchObject({ success: true });

    row = await userRow();
    await expect(
      service.resetPassword('tok', 'a-new-password')
    ).resolves.toMatchObject({ success: true });

    row = await userRow({ updatedAt: new Date(Date.now() - 60_000) });
    await expect(service.verifyEmail('tok')).resolves.toMatchObject({
      success: true,
    });

    row = await userRow({ emailVerified: null, verificationToken: null });
    await expect(
      service.resendVerification('alice@example.com')
    ).resolves.toMatchObject({ success: true });
  });

  it('every User call it made named its columns, and none named the missing one', async () => {
    row = await userRow();
    await service.login('alice@example.com', 'correct-password');
    await service.refresh('old-raw');
    await service.forgotPassword('alice@example.com');
    await service.resetPassword('tok', 'a-new-password');

    expect(calls.length).toBeGreaterThanOrEqual(6);
    for (const call of calls) {
      const select = call.args?.['select'] as
        | Record<string, unknown>
        | undefined;
      expect(select).toBeDefined();
      expect(Object.keys(select!)).not.toContain(MISSING_COLUMN);
    }
  });
});

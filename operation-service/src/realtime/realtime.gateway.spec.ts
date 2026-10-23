/**
 * Unit tests for RealtimeGateway's own logic (connection auth branching,
 * message delivery routing, disconnect logging, shutdown cleanup) against a
 * mocked Redis/Socket.IO layer. The real end-to-end proof — a genuine
 * socket.io-client authenticating with a real minted JWE against a real
 * in-process gateway and receiving a message published to `alerts:fired` —
 * lives in realtime.gateway.e2e.spec.ts (this session's own Step 7).
 */

import { Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { Server, Socket } from 'socket.io';

import type { AlertFiredMessage } from '../alert-engine/notify-bridge.service';
import { clearUserActiveCache } from '../auth/user-active.util';
import type { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

import { RealtimeGateway, resolveRealtimeCorsOrigin } from './realtime.gateway';

jest.mock('../auth/next-auth-jwt.util', () => ({
  decodeNextAuthToken: jest.fn(),
}));

// eslint-disable-next-line import/order
import { decodeNextAuthToken } from '../auth/next-auth-jwt.util';

const mockDecodeNextAuthToken = decodeNextAuthToken as jest.MockedFunction<
  typeof decodeNextAuthToken
>;

/** The columns the session-state read selects (CODE-02A): what the database says about a user now. */
function stateRow(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    deletedAt: null,
    sessionVersion: 0,
    role: 'USER',
    tier: 'FREE',
    ...overrides,
  };
}

function makeFakeRedis(): jest.Mocked<Redis> {
  const fake = {
    duplicate: jest.fn(),
    on: jest.fn(),
    subscribe: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  } as unknown as jest.Mocked<Redis>;
  fake.duplicate.mockReturnValue(fake);
  return fake;
}

function makeFakeSocket(
  overrides: Partial<{ token: string }> = {}
): jest.Mocked<Socket> {
  return {
    id: 'socket-1',
    handshake: { auth: overrides.token ? { token: overrides.token } : {} },
    data: {},
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  } as unknown as jest.Mocked<Socket>;
}

describe('resolveRealtimeCorsOrigin (F53 fix)', () => {
  const originalAllowedOrigins = process.env['ALLOWED_ORIGINS'];

  afterEach(() => {
    if (originalAllowedOrigins === undefined) {
      delete process.env['ALLOWED_ORIGINS'];
    } else {
      process.env['ALLOWED_ORIGINS'] = originalAllowedOrigins;
    }
  });

  it('returns the bare string "*" when ALLOWED_ORIGINS is unset', () => {
    delete process.env['ALLOWED_ORIGINS'];

    const origin = resolveRealtimeCorsOrigin();

    expect(origin).toBe('*');
    expect(Array.isArray(origin)).toBe(false);
  });

  it('returns the bare string "*" when ALLOWED_ORIGINS is literally "*"', () => {
    process.env['ALLOWED_ORIGINS'] = '*';

    const origin = resolveRealtimeCorsOrigin();

    expect(origin).toBe('*');
    expect(Array.isArray(origin)).toBe(false);
  });

  it('returns the split array for a real explicit comma-separated allow-list', () => {
    process.env['ALLOWED_ORIGINS'] =
      'https://trading-alerts-saas-frontend.vercel.app,https://staging.example.com';

    const origin = resolveRealtimeCorsOrigin();

    expect(origin).toEqual([
      'https://trading-alerts-saas-frontend.vercel.app',
      'https://staging.example.com',
    ]);
  });

  it('returns a single-element array for one explicit origin (not the wildcard)', () => {
    process.env['ALLOWED_ORIGINS'] =
      'https://trading-alerts-saas-frontend.vercel.app';

    const origin = resolveRealtimeCorsOrigin();

    expect(origin).toEqual(['https://trading-alerts-saas-frontend.vercel.app']);
  });
});

describe('RealtimeGateway', () => {
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  let gateway: RealtimeGateway;
  let redisService: jest.Mocked<RedisService>;
  let fakeRedis: jest.Mocked<Redis>;
  let fakeServer: jest.Mocked<Server>;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    process.env['NEXTAUTH_SECRET'] = 'test-secret';
    jest.clearAllMocks();
    clearUserActiveCache();
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(stateRow()) },
    };

    fakeRedis = makeFakeRedis();
    redisService = {
      getClient: jest.fn().mockReturnValue(fakeRedis),
    } as unknown as jest.Mocked<RedisService>;

    fakeServer = {
      adapter: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as jest.Mocked<Server>;

    gateway = new RealtimeGateway(
      redisService,
      prisma as unknown as PrismaService
    );
    gateway.server = fakeServer;
    await gateway.afterInit(fakeServer);
  });

  afterAll(() => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
  });

  describe('afterInit', () => {
    it('attaches the Redis adapter and subscribes to alerts:fired', () => {
      expect(fakeServer.adapter).toHaveBeenCalledTimes(1);
      expect(fakeRedis.subscribe).toHaveBeenCalledWith('alerts:fired');
    });
  });

  describe('handleConnection', () => {
    it('disconnects a socket with no auth token', async () => {
      const socket = makeFakeSocket();
      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Authentication token required',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('disconnects a socket whose token fails NextAuth-JWE verification', async () => {
      mockDecodeNextAuthToken.mockRejectedValueOnce(new Error('bad token'));
      const socket = makeFakeSocket({ token: 'not-a-real-jwe' });

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Invalid or expired token',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('disconnects a socket whose decrypted token is missing required claims', async () => {
      mockDecodeNextAuthToken.mockResolvedValueOnce({
        id: '',
      } as never);
      const socket = makeFakeSocket({ token: 'a-jwe' });

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Token missing required claims',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('joins the user room and emits authenticated on a valid token', async () => {
      mockDecodeNextAuthToken.mockResolvedValueOnce({
        id: 'user-42',
        email: 'a@b.com',
      } as never);
      const socket = makeFakeSocket({ token: 'a-valid-jwe' });

      await gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('user:user-42');
      expect(socket.data.userId).toBe('user-42');
      expect(socket.emit).toHaveBeenCalledWith('authenticated', {
        success: true,
        userId: 'user-42',
      });
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('refuses a socket whose account is deactivated (F21) without joining any room', async () => {
      mockDecodeNextAuthToken.mockResolvedValueOnce({
        id: 'user-42',
        email: 'a@b.com',
      } as never);
      prisma.user.findUnique.mockResolvedValueOnce(
        stateRow({ isActive: false })
      );
      const socket = makeFakeSocket({ token: 'a-valid-jwe' });

      await gateway.handleConnection(socket);

      // CODE-02A: one read answers the account's state, version, role and tier together.
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-42' },
        select: {
          isActive: true,
          deletedAt: true,
          sessionVersion: true,
          role: true,
          tier: true,
        },
      });
      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'ACCOUNT_DEACTIVATED',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('refuses a socket whose token is behind the database sessionVersion (CODE-02A)', async () => {
      mockDecodeNextAuthToken.mockResolvedValueOnce({
        id: 'user-42',
        email: 'a@b.com',
        sessionVersion: 0,
      } as never);
      prisma.user.findUnique.mockResolvedValueOnce(
        stateRow({ sessionVersion: 2 })
      );
      const socket = makeFakeSocket({ token: 'a-valid-jwe' });

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'SESSION_REVOKED',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('accepts a token with no sessionVersion claim while the row is at 0, and one that matches a bumped row', async () => {
      mockDecodeNextAuthToken.mockResolvedValueOnce({ id: 'user-42' } as never);
      await gateway.handleConnection(makeFakeSocket({ token: 'a' }));

      clearUserActiveCache();
      mockDecodeNextAuthToken.mockResolvedValueOnce({
        id: 'user-42',
        sessionVersion: 3,
      } as never);
      prisma.user.findUnique.mockResolvedValueOnce(
        stateRow({ sessionVersion: 3 })
      );
      const socket = makeFakeSocket({ token: 'b' });
      await gateway.handleConnection(socket);

      expect(socket.join).toHaveBeenCalledWith('user:user-42');
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('refuses an ADMIN socket 13 hours after sign-in (CODE-02A, D-5) and keeps a USER socket of the same age', async () => {
      const staleAuthTime = Math.floor(Date.now() / 1000) - 13 * 3600;
      mockDecodeNextAuthToken.mockResolvedValueOnce({
        id: 'admin-1',
        authTime: staleAuthTime,
      } as never);
      prisma.user.findUnique.mockResolvedValueOnce(stateRow({ role: 'ADMIN' }));
      const admin = makeFakeSocket({ token: 'a' });
      await gateway.handleConnection(admin);
      expect(admin.emit).toHaveBeenCalledWith('error', {
        message: 'SESSION_EXPIRED',
      });
      expect(admin.disconnect).toHaveBeenCalledWith(true);

      clearUserActiveCache();
      mockDecodeNextAuthToken.mockResolvedValueOnce({
        id: 'user-1',
        authTime: staleAuthTime,
      } as never);
      const user = makeFakeSocket({ token: 'b' });
      await gateway.handleConnection(user);
      expect(user.join).toHaveBeenCalledWith('user:user-1');
    });

    it('refuses a socket with no row in production and lets one through when the lookup fails', async () => {
      const original = process.env['NODE_ENV'];
      try {
        process.env['NODE_ENV'] = 'production';
        mockDecodeNextAuthToken.mockResolvedValueOnce({ id: 'ghost' } as never);
        prisma.user.findUnique.mockResolvedValueOnce(null);
        const ghost = makeFakeSocket({ token: 'a' });
        await gateway.handleConnection(ghost);
        expect(ghost.emit).toHaveBeenCalledWith('error', {
          message: 'ACCOUNT_DEACTIVATED',
        });

        clearUserActiveCache();
        mockDecodeNextAuthToken.mockResolvedValueOnce({
          id: 'user-9',
        } as never);
        prisma.user.findUnique.mockRejectedValueOnce(new Error('reset'));
        const blip = makeFakeSocket({ token: 'b' });
        await gateway.handleConnection(blip);
        expect(blip.join).toHaveBeenCalledWith('user:user-9');
      } finally {
        process.env['NODE_ENV'] = original;
      }
    });

    it('registers a raw disconnect listener that logs the reason string (F55 diagnostic)', async () => {
      mockDecodeNextAuthToken.mockResolvedValueOnce({
        id: 'user-42',
        email: 'a@b.com',
      } as never);
      const socket = makeFakeSocket({ token: 'a-valid-jwe' });
      const logSpy = jest
        .spyOn(Logger.prototype, 'log')
        .mockImplementation(() => undefined);

      await gateway.handleConnection(socket);

      expect(socket.on).toHaveBeenCalledWith(
        'disconnect',
        expect.any(Function)
      );
      const disconnectHandler = socket.on.mock.calls.find(
        (call) => call[0] === 'disconnect'
      )?.[1] as (reason: string) => void;

      disconnectHandler('ping timeout');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[F55] User user-42 disconnected (socket socket-1) — reason: ping timeout'
        )
      );
      logSpy.mockRestore();
    });

    it('disconnects if NEXTAUTH_SECRET is not configured', async () => {
      delete process.env['NEXTAUTH_SECRET'];
      const socket = makeFakeSocket({ token: 'a-jwe' });

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith('error', {
        message: 'Auth is not configured',
      });
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('deliver', () => {
    it('emits notification and alert_fired to the firing user room', () => {
      const emit = jest.fn();
      fakeServer.to.mockReturnValue({
        emit,
      } as unknown as ReturnType<Server['to']>);

      const msg: AlertFiredMessage = {
        userId: 'user-7',
        notification: {
          id: 'alert_a1_1',
          type: 'ALERT',
          title: 'XAUUSD M5 alert',
          body: 'Price touched channel_top',
          priority: 'HIGH',
          link: '/charts/XAUUSD/M5',
          createdAt: '2026-08-02T00:00:00.000Z',
        },
        marker: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          levelId: 'channel_top',
          levelPrice: 2050,
          touchPrice: 2050.4,
          time: 1717000000,
        },
      };

      gateway.deliver(msg);

      expect(fakeServer.to).toHaveBeenCalledWith('user:user-7');
      expect(emit).toHaveBeenCalledWith('notification', msg.notification);
      expect(emit).toHaveBeenCalledWith('alert_fired', msg.marker);
    });

    it('is invoked by the alerts:fired subscriber on a well-formed message', () => {
      const deliverSpy = jest.spyOn(gateway, 'deliver');
      const onMessageHandler = fakeRedis.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1] as (channel: string, raw: string) => void;

      const msg: AlertFiredMessage = {
        userId: 'user-9',
        notification: {
          id: 'alert_a2_2',
          type: 'ALERT',
          title: 't',
          body: 'b',
          priority: 'HIGH',
          link: '/l',
          createdAt: '2026-08-02T00:00:00.000Z',
        },
        marker: {
          symbol: 'XAUUSD',
          timeframe: 'M5',
          levelId: 'l',
          levelPrice: 1,
          touchPrice: 1,
          time: 1,
        },
      };

      onMessageHandler('alerts:fired', JSON.stringify(msg));

      expect(deliverSpy).toHaveBeenCalledWith(msg);
    });

    it('ignores messages on unrelated channels and malformed payloads', () => {
      const deliverSpy = jest.spyOn(gateway, 'deliver');
      const onMessageHandler = fakeRedis.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1] as (channel: string, raw: string) => void;

      onMessageHandler('some:other:channel', JSON.stringify({}));
      onMessageHandler('alerts:fired', 'not json');

      expect(deliverSpy).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('does not throw for an authenticated or unauthenticated socket', () => {
      const authed = makeFakeSocket();
      authed.data.userId = 'user-1';
      const anon = makeFakeSocket();

      expect(() => gateway.handleDisconnect(authed)).not.toThrow();
      expect(() => gateway.handleDisconnect(anon)).not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('quits every dedicated Redis connection it opened', async () => {
      await gateway.onModuleDestroy();
      // pubClient, subClient, and alertsSubscriber all resolve to the same
      // fakeRedis instance here (duplicate() returns itself) — 3 calls.
      expect(fakeRedis.quit).toHaveBeenCalledTimes(3);
    });
  });
});

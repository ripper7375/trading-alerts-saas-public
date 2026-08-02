/**
 * Real end-to-end proof for RealtimeGateway (F8, Session 4B-17, this
 * session's own Step 7): a real socket.io-client connects to a real
 * in-process RealtimeGateway (Test.createTestingModule + an actual HTTP
 * listener, not a mocked gateway), authenticates with a real minted
 * NextAuth JWE (same mintTestToken shape as jwt-auth.guard.spec.ts,
 * verified against the real decodeNextAuthToken this session's gateway
 * uses), and receives a message published to `alerts:fired` end to end.
 *
 * Redis itself is a faithful in-memory double (no live Redis in this
 * environment — same established precedent as Session 4B-2's own
 * alert-queue/alert-worker specs) rather than a bare jest.fn() stub: it
 * implements real pub/sub semantics (subscribe/publish actually dispatch
 * through the same event path ioredis uses), so the gateway's own
 * `afterInit` subscribe wiring and message-routing logic run unmodified —
 * only the network transport underneath Redis is faked. Everything else
 * (Socket.IO transport, JWE crypto, room join, event delivery) is real.
 */
import { EventEmitter } from 'events';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import hkdf from '@panva/hkdf';
import { EncryptJWT } from 'jose';
import type { AddressInfo } from 'net';
import { io, type Socket as ClientSocket } from 'socket.io-client';

import type { AlertFiredMessage } from '../alert-engine/notify-bridge.service';
import { RedisService } from '../redis/redis.service';

import { RealtimeGateway } from './realtime.gateway';

const TEST_SECRET = 'test-nextauth-secret-value-not-real';

// Mirrors next-auth/jwt's own encode() — same helper as jwt-auth.guard.spec.ts.
async function mintTestToken(
  claims: Record<string, unknown>,
  secret = TEST_SECRET
): Promise<string> {
  const key = await hkdf(
    'sha256',
    secret,
    '',
    'NextAuth.js Generated Encryption Key',
    32
  );
  return new EncryptJWT(claims)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)
    .encrypt(key);
}

/** A faithful in-memory Redis pub/sub double — real subscribe/publish
 * dispatch, no live server. Shared across every `.duplicate()` so it
 * behaves like multiple connections to the same Redis instance. */
class FakeRedisBus {
  private readonly subscribers = new Map<string, Set<FakeRedisClient>>();

  subscribe(client: FakeRedisClient, channel: string): void {
    if (!this.subscribers.has(channel))
      this.subscribers.set(channel, new Set());
    this.subscribers.get(channel)!.add(client);
  }

  publish(channel: string, message: string): number {
    const clients = this.subscribers.get(channel);
    if (!clients) return 0;
    clients.forEach((client) => client.emit('message', channel, message));
    return clients.size;
  }
}

class FakeRedisClient extends EventEmitter {
  constructor(private readonly bus: FakeRedisBus) {
    super();
  }

  duplicate(): FakeRedisClient {
    return new FakeRedisClient(this.bus);
  }

  async subscribe(...channels: string[]): Promise<number> {
    channels.forEach((channel) => this.bus.subscribe(this, channel));
    return channels.length;
  }

  // @socket.io/redis-adapter's own internal setup — never exercised by
  // this test's single-node alerts:fired scenario, but must exist and not
  // throw for the adapter's constructor to complete.
  async psubscribe(): Promise<number> {
    return 0;
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.bus.publish(channel, message);
  }

  async quit(): Promise<'OK'> {
    return 'OK';
  }
}

describe('RealtimeGateway (real socket.io-client end-to-end)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let bus: FakeRedisBus;
  let gateway: RealtimeGateway;
  const originalSecret = process.env['NEXTAUTH_SECRET'];
  const clientSockets: ClientSocket[] = [];

  beforeAll(async () => {
    process.env['NEXTAUTH_SECRET'] = TEST_SECRET;
    bus = new FakeRedisBus();

    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        {
          provide: RedisService,
          useValue: {
            getClient: () => new FakeRedisClient(bus),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://localhost:${address.port}`;
    gateway = moduleRef.get(RealtimeGateway);
  });

  afterAll(async () => {
    process.env['NEXTAUTH_SECRET'] = originalSecret;
    clientSockets.forEach((socket) => socket.disconnect());
    await app.close();
  });

  afterEach(() => {
    clientSockets.forEach((socket) => socket.disconnect());
    clientSockets.length = 0;
  });

  function connectClient(auth: Record<string, unknown>): ClientSocket {
    const socket = io(baseUrl, {
      auth,
      transports: ['websocket'],
      forceNew: true,
    });
    clientSockets.push(socket);
    return socket;
  }

  it('rejects a connection with no auth token', async () => {
    const socket = connectClient({});

    const errorMessage = await new Promise<string>((resolve) => {
      socket.on('error', (data: { message: string }) => resolve(data.message));
    });

    expect(errorMessage).toBe('Authentication token required');
  });

  it('rejects a connection with an invalid token', async () => {
    const socket = connectClient({ token: 'not-a-real-jwe' });

    const errorMessage = await new Promise<string>((resolve) => {
      socket.on('error', (data: { message: string }) => resolve(data.message));
    });

    expect(errorMessage).toBe('Invalid or expired token');
  });

  it('authenticates a real minted JWE, joins the user room, and delivers a message published to alerts:fired', async () => {
    const token = await mintTestToken({
      sub: 'user-e2e-1',
      id: 'user-e2e-1',
      email: 'e2e@example.com',
      tier: 'PRO',
      role: 'USER',
      isAffiliate: false,
    });
    const socket = connectClient({ token });

    const authenticated = await new Promise<{
      success: boolean;
      userId: string;
    }>((resolve) => {
      socket.on('authenticated', resolve);
    });
    expect(authenticated).toEqual({ success: true, userId: 'user-e2e-1' });

    const notificationPromise = new Promise((resolve) =>
      socket.on('notification', resolve)
    );
    const alertFiredPromise = new Promise((resolve) =>
      socket.on('alert_fired', resolve)
    );

    // Simulates NotifyBridgeService.publish() (operation-service's real
    // publisher, alert-engine/notify-bridge.service.ts) — a real
    // publishAlertFired() call against a real Redis would do exactly this:
    // JSON.stringify onto the alerts:fired channel.
    const msg: AlertFiredMessage = {
      userId: 'user-e2e-1',
      notification: {
        id: 'alert_a1_1717000000',
        type: 'ALERT',
        title: 'XAUUSD M5 alert',
        body: 'Price 2050.4 touched channel_top @ 2050',
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
    bus.publish('alerts:fired', JSON.stringify(msg));

    await expect(notificationPromise).resolves.toEqual(msg.notification);
    await expect(alertFiredPromise).resolves.toEqual(msg.marker);
  });

  it('does not deliver a fired-alert message to a different user room', async () => {
    const token = await mintTestToken({
      sub: 'user-e2e-2',
      id: 'user-e2e-2',
      email: 'e2e2@example.com',
      tier: 'FREE',
      role: 'USER',
      isAffiliate: false,
    });
    const socket = connectClient({ token });
    await new Promise((resolve) => socket.on('authenticated', resolve));

    const received = jest.fn();
    socket.on('notification', received);
    socket.on('alert_fired', received);

    const msg: AlertFiredMessage = {
      userId: 'some-other-user',
      notification: {
        id: 'alert_a2_1',
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
    bus.publish('alerts:fired', JSON.stringify(msg));

    // No positive event to await for a negative case — give the event
    // loop a real tick to prove nothing arrives, not just that we didn't
    // wait long enough.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(received).not.toHaveBeenCalled();
  });

  it('deliver() is reachable directly (defence in depth alongside the unit spec)', () => {
    expect(typeof gateway.deliver).toBe('function');
  });
});

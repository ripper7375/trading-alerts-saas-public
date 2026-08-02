import { Logger, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import type { Redis } from 'ioredis';
import type { Server, Socket } from 'socket.io';

import { decodeNextAuthToken } from '../auth/next-auth-jwt.util';
import {
  parseAlertFired,
  type AlertFiredMessage,
} from '../alert-engine/notify-bridge.service';
import { RedisService } from '../redis/redis.service';

const ALERTS_FIRED_CHANNEL = 'alerts:fired';

/**
 * Realtime delivery gateway (F8, Session 4B-17) — the browser-facing half of
 * the alert-fired pipeline. `NotifyBridgeService` (Session 4B-2/3) publishes
 * to Redis `alerts:fired`; this gateway is the subscriber half, re-emitting
 * to the firing user's room. Replaces the monolith's `lib/websocket/server.ts`
 * (retired this session — never actually reachable in production, see this
 * session's order `## Raw facts` #1-#3).
 *
 * Handshake auth reuses `JwtAuthGuard`'s own NextAuth-JWE verification path
 * (`decodeNextAuthToken`) rather than trusting a bare userId, closing the
 * placeholder-auth gap the old server had (order fact #11).
 *
 * @module realtime/realtime.gateway
 */
@WebSocketGateway({
  cors: {
    origin: (process.env['ALLOWED_ORIGINS'] ?? '*').split(','),
    credentials: true,
  },
})
export class RealtimeGateway
  implements
    OnGatewayInit<Server>,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private pubClient?: Redis;
  private subClient?: Redis;
  private alertsSubscriber?: Redis;

  constructor(private readonly redisService: RedisService) {}

  async afterInit(server: Server): Promise<void> {
    // Multi-replica fan-out: route room emits across operation-service
    // instances via Redis — mirrors lib/websocket/server.ts's own precedent
    // and docs/SCALING-BULLMQ-AND-SOCKET-ADAPTER.md §2. Dedicated
    // connections (never the shared RedisService client): pub/sub mode
    // can't run normal commands on the same connection, same rationale as
    // RedisService's own header comment re: AlertWorkerService.
    this.pubClient = this.redisService.getClient().duplicate();
    this.subClient = this.pubClient.duplicate();
    server.adapter(createAdapter(this.pubClient, this.subClient));

    // Subscriber half of the cross-process bridge — NotifyBridgeService
    // (alert-engine/notify-bridge.service.ts) is the publisher half, and has
    // published to this channel, unconsumed, since Session 4B-2/3. A third
    // dedicated connection, separate from the adapter's own pub/sub pair
    // above (different channels, different purpose — don't couple to the
    // redis-adapter library's internal subscriptions).
    this.alertsSubscriber = this.redisService.getClient().duplicate();
    this.alertsSubscriber.on('message', (channel: string, raw: string) => {
      if (channel !== ALERTS_FIRED_CHANNEL) return;
      const msg = parseAlertFired(raw);
      if (!msg) {
        this.logger.warn(`Discarded malformed ${ALERTS_FIRED_CHANNEL} payload`);
        return;
      }
      this.deliver(msg);
    });
    await this.alertsSubscriber.subscribe(ALERTS_FIRED_CHANNEL);
    this.logger.log(`Subscribed to ${ALERTS_FIRED_CHANNEL}`);
  }

  /** Re-emits a fired-alert message to the firing user's room. Exported via
   * instance method (not private-only) so the e2e test can drive it without
   * needing a live NotifyBridgeService publish. */
  deliver(msg: AlertFiredMessage): void {
    const room = `user:${msg.userId}`;
    this.server.to(room).emit('notification', msg.notification);
    this.server.to(room).emit('alert_fired', msg.marker);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.['token'] as string | undefined;
    if (!token) {
      client.emit('error', { message: 'Authentication token required' });
      client.disconnect(true);
      return;
    }

    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) {
      // Misconfiguration, not a client error — but still must not silently
      // let the socket sit in an unauthenticated room-less state.
      client.emit('error', { message: 'Auth is not configured' });
      client.disconnect(true);
      return;
    }

    try {
      const claims = await decodeNextAuthToken(token, secret);
      if (!claims.id) {
        client.emit('error', { message: 'Token missing required claims' });
        client.disconnect(true);
        return;
      }
      client.data.userId = claims.id;
      await client.join(`user:${claims.id}`);
      client.emit('authenticated', { success: true, userId: claims.id });
      this.logger.log(`Client ${client.id} authenticated as user ${claims.id}`);
    } catch {
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId as string | undefined;
    this.logger.log(
      userId
        ? `User ${userId} disconnected (socket ${client.id})`
        : `Unauthenticated client disconnected (socket ${client.id})`
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [this.pubClient, this.subClient, this.alertsSubscriber]
        .filter((client): client is Redis => Boolean(client))
        .map((client) => client.quit())
    );
  }
}

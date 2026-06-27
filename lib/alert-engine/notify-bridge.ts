/**
 * Cross-process alert delivery bridge.
 *
 * The alert worker runs in its own process and cannot reach the web server's
 * Socket.IO connections directly. It publishes a fired-alert message to Redis
 * (`alerts:fired`); the web process subscribes and re-emits to the user's room
 * (notification + a chart-marker event).
 *
 * @module lib/alert-engine/notify-bridge
 */

import Redis from 'ioredis';

import type { FireEvent } from './types';

const CHANNEL = 'alerts:fired';

/** Data the chart uses to draw a "fired here" marker. */
export interface AlertFiredMarker {
  symbol: string;
  timeframe: string;
  levelId: string;
  levelPrice: number;
  touchPrice: number;
  time: number;
}

/** Matches the web server's NotificationPayload shape (structurally). */
export interface AlertNotification {
  id: string;
  type: 'ALERT';
  title: string;
  body: string;
  priority: 'HIGH';
  link: string;
  createdAt: string;
}

export interface AlertFiredMessage {
  userId: string;
  notification: AlertNotification;
  marker: AlertFiredMarker;
}

export function buildAlertFiredMessage(
  fire: FireEvent,
  createdAtIso: string
): AlertFiredMessage {
  const title = `${fire.symbol} ${fire.timeframe} alert`;
  const body = `Price ${fire.touchPrice} touched ${fire.levelId} @ ${fire.levelPrice}`;
  const link = `/charts/${fire.symbol}/${fire.timeframe}`;
  return {
    userId: fire.userId,
    notification: {
      id: `alert_${fire.alertId}_${fire.time}`,
      type: 'ALERT',
      title,
      body,
      priority: 'HIGH',
      link,
      createdAt: createdAtIso,
    },
    marker: {
      symbol: fire.symbol,
      timeframe: fire.timeframe,
      levelId: fire.levelId,
      levelPrice: fire.levelPrice,
      touchPrice: fire.touchPrice,
      time: fire.time,
    },
  };
}

export function parseAlertFired(raw: string): AlertFiredMessage | null {
  try {
    const obj = JSON.parse(raw) as Partial<AlertFiredMessage>;
    if (
      !obj ||
      typeof obj.userId !== 'string' ||
      !obj.notification ||
      !obj.marker
    ) {
      return null;
    }
    return obj as AlertFiredMessage;
  } catch {
    return null;
  }
}

export interface PublisherLike {
  publish(channel: string, message: string): Promise<unknown>;
}

export async function publishAlertFired(
  redis: PublisherLike,
  msg: AlertFiredMessage
): Promise<void> {
  await redis.publish(CHANNEL, JSON.stringify(msg));
}

export interface DeliveryBridgeHandle {
  stop(): Promise<void>;
}

/**
 * Run in the WEB process: subscribe to fired alerts and hand each to `deliver`
 * (which sends the notification + emits the marker). No-op without REDIS_URL.
 */
export async function startAlertDeliveryBridge(opts: {
  redisUrl?: string;
  deliver: (msg: AlertFiredMessage) => void;
}): Promise<DeliveryBridgeHandle | null> {
  const url = opts.redisUrl ?? process.env['REDIS_URL'];
  if (!url) return null;

  const subscriber = new Redis(url);
  await subscriber.subscribe(CHANNEL);
  subscriber.on('message', (_channel: string, raw: string) => {
    const msg = parseAlertFired(raw);
    if (msg) opts.deliver(msg);
  });

  return {
    async stop() {
      await subscriber.quit();
    },
  };
}

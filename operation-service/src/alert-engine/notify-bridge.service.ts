import { Injectable } from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import type { FireEvent } from './types';

/**
 * Cross-process alert delivery bridge — publisher half only.
 *
 * The subscriber half (re-emit to the user's Socket.IO room) STAYS in the
 * monolith web process until Session 4B-17 (F8 realtime decision) — this
 * service only builds and publishes the message.
 *
 * @module alert-engine/notify-bridge.service
 */

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

@Injectable()
export class NotifyBridgeService {
  constructor(private readonly redisService: RedisService) {}

  async publish(fire: FireEvent, createdAtIso: string): Promise<void> {
    const msg = buildAlertFiredMessage(fire, createdAtIso);
    await publishAlertFired(this.redisService.getClient(), msg);
  }
}

/**
 * Fire dispatcher — persists a Notification, updates the Alert, and publishes a
 * cross-process fired-alert message (delivered live by the web process bridge).
 *
 * @module lib/alert-engine/dispatcher
 */

import { prisma } from '@/lib/db/prisma';
import { getRedisClient } from '@/lib/redis/client';

import type { Dispatch } from './evaluator';
import {
  buildAlertFiredMessage,
  publishAlertFired,
  type AlertFiredMessage,
} from './notify-bridge';
import type { FireEvent } from './types';

export type AlertPublisher = (msg: AlertFiredMessage) => Promise<void>;

/** Default publisher: best-effort Redis publish (no-op without REDIS_URL). */
async function defaultPublish(msg: AlertFiredMessage): Promise<void> {
  if (!process.env['REDIS_URL']) return;
  try {
    await publishAlertFired(getRedisClient(), msg);
  } catch (error) {
    console.error('alert publish failed:', error);
  }
}

export function createPrismaDispatcher(
  publish: AlertPublisher = defaultPublish
): Dispatch {
  return async (fire: FireEvent): Promise<void> => {
    const title = `${fire.symbol} ${fire.timeframe} alert`;
    const body = `Price ${fire.touchPrice} touched ${fire.levelId} @ ${fire.levelPrice}`;
    const link = `/charts/${fire.symbol}/${fire.timeframe}`;

    await prisma.$transaction(async (tx) => {
      await tx.notification.create({
        data: {
          userId: fire.userId,
          type: 'ALERT',
          priority: 'HIGH',
          title,
          body,
          link,
        },
      });
      await tx.alert.update({
        where: { id: fire.alertId },
        data: {
          lastTriggered: new Date(),
          triggerCount: { increment: 1 },
          ...(fire.oneShot ? { isActive: false } : {}),
        },
      });
    });

    await publish(buildAlertFiredMessage(fire, new Date().toISOString()));
  };
}

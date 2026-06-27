/**
 * Fire dispatcher — persists a Notification, updates the Alert, and pushes a
 * live notification.
 *
 * Note: live Socket.IO push only reaches the user if this runs in (or shares an
 * adapter with) the web process. In a standalone worker the persisted
 * Notification row is the durable record; cross-process live delivery is a
 * Phase 5 concern (Socket.IO Redis adapter).
 *
 * @module lib/alert-engine/dispatcher
 */

import { prisma } from '@/lib/db/prisma';
import { sendNotificationToUser } from '@/lib/websocket/server';

import type { Dispatch } from './evaluator';
import type { FireEvent } from './types';

export function createPrismaDispatcher(): Dispatch {
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

    try {
      sendNotificationToUser(fire.userId, {
        id: `alert_${fire.alertId}_${fire.time}`,
        type: 'ALERT',
        title,
        body,
        priority: 'HIGH',
        link,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('alert live push failed:', error);
    }
  };
}

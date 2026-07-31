import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { alertEngineLogger, newFireCorrelationId } from './alert-engine.logger';
import { NotifyBridgeService } from './notify-bridge.service';
import type { Dispatch } from './evaluator';
import type { FireEvent } from './types';

/**
 * Fire dispatcher — persists a Notification, updates the Alert, and publishes
 * a cross-process fired-alert message (delivered live by the monolith web
 * process's Socket.IO bridge).
 *
 * @module alert-engine/dispatcher.service
 */
@Injectable()
export class DispatcherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifyBridge: NotifyBridgeService
  ) {}

  dispatch: Dispatch = async (fire: FireEvent): Promise<void> => {
    const correlationId = newFireCorrelationId();
    const log = alertEngineLogger.child({
      correlationId,
      alertId: fire.alertId,
      symbol: fire.symbol,
      timeframe: fire.timeframe,
    });
    log.info('dispatching fire');

    const title = `${fire.symbol} ${fire.timeframe} alert`;
    const body = `Price ${fire.touchPrice} touched ${fire.levelId} @ ${fire.levelPrice}`;
    const link = `/charts/${fire.symbol}/${fire.timeframe}`;

    await this.prisma.$transaction(async (tx) => {
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

    await this.notifyBridge.publish(fire, new Date().toISOString());
    log.info('fire dispatched');
  };
}

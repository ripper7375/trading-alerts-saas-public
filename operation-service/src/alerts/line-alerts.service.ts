import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { getAlertLimit } from '@trading-alerts/types/validations';
import { levelsForMark } from '@trading-alerts/types/geometry';
import type { MarkSnapshot } from '@trading-alerts/types/geometry';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type {
  AttachLineAlertDto as AlertAttachInput,
  UpdateLineAlertDto as AlertUpdateInput,
} from './dto/alert.dto';

const ALERTS_CHANGED_CHANNEL = 'alerts:changed';

interface AlertsChangedPayload {
  symbol: string;
  timeframe: string;
  alertId?: string;
  drawingId?: string;
  reason: string;
}

export interface LineAlertListFilters {
  symbol?: string;
  timeframe?: string;
}

/**
 * Line-touch (drawing-engine) alerts CRUD — ports `app/api/alerts/line/route.ts`
 * (File 3/4) and `app/api/alerts/line/[id]/route.ts` (File 4/4). Session 4B-5.
 *
 * `targetLevel` validity is checked via the SAME shared geometry
 * (`levelsForMark`) the chart uses — the SOURCE's "reject TEXT drawings"
 * invariant is really this more general "the drawing exposes zero alertable
 * levels" check (TEXT drawings just happen to be the type that always
 * returns an empty level list); ported as the general check, not a
 * hardcoded `type === 'TEXT'` comparison, matching the real mechanism.
 *
 * @module alerts/line-alerts.service
 */
@Injectable()
export class LineAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {}

  async list(userId: string, filters: LineAlertListFilters) {
    const alerts = await this.prisma.drawingAlert.findMany({
      where: {
        drawing: {
          userId,
          ...(filters.symbol ? { symbol: filters.symbol } : {}),
          ...(filters.timeframe ? { timeframe: filters.timeframe } : {}),
        },
      },
      include: { alert: true, drawing: true },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, alerts };
  }

  async attach(userId: string, tier: string, input: AlertAttachInput) {
    // V8: drawing-engine line alerts are PRO-exclusive.
    if (tier !== 'PRO') {
      throw new ForbiddenException({
        error: 'Line alerts are a PRO feature',
        message:
          'Drawing-engine line alerts are exclusive to the PRO tier. Upgrade to attach alerts to your chart drawings.',
      });
    }

    const drawing = await this.prisma.drawing.findUnique({
      where: { id: input.drawingId },
    });
    if (!drawing) {
      throw new NotFoundException({ error: 'Drawing not found' });
    }
    if (drawing.userId !== userId) {
      throw new ForbiddenException({ error: 'Forbidden' });
    }

    const snapshot = {
      id: drawing.id,
      type: drawing.type,
      anchors: drawing.anchors,
      style: drawing.style,
    } as unknown as MarkSnapshot;
    const levelIds = levelsForMark(snapshot).map((l) => l.id);

    if (levelIds.length === 0) {
      throw new BadRequestException({
        error: 'Not alertable',
        message: `Drawings of type ${drawing.type} cannot have alerts.`,
      });
    }
    if (!levelIds.includes(input.targetLevel)) {
      throw new BadRequestException({
        error: 'Invalid target level',
        message: `targetLevel must be one of: ${levelIds.join(', ')}`,
      });
    }

    // Alert quota (PRO: 100 — shared with plain price alerts).
    const limit = getAlertLimit('PRO');
    const current = await this.prisma.alert.count({ where: { userId } });
    if (current >= limit) {
      throw new ForbiddenException({
        error: 'Alert limit reached',
        message: `PRO tier allows ${limit} alerts. Delete or pause existing alerts to create new ones.`,
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const alert = await tx.alert.create({
        data: {
          userId,
          name: input.name ?? null,
          symbol: drawing.symbol,
          timeframe: drawing.timeframe,
          alertType: 'PRICE_TOUCH_LINE',
          condition: JSON.stringify({
            targetLevel: input.targetLevel,
            direction: input.direction,
            tolerance: input.tolerance,
            cooldownSec: input.cooldownSec,
            oneShot: input.oneShot,
          }),
          isActive: true,
        },
      });
      return tx.drawingAlert.create({
        data: {
          drawingId: input.drawingId,
          alertId: alert.id,
          targetLevel: input.targetLevel,
          direction: input.direction,
          tolerance: input.tolerance,
          cooldownSec: input.cooldownSec,
          oneShot: input.oneShot,
        },
        include: { alert: true, drawing: true },
      });
    });

    await this.publishAlertsChanged({
      symbol: drawing.symbol,
      timeframe: drawing.timeframe,
      alertId: created.alertId,
      drawingId: drawing.id,
      reason: 'alert_created',
    });

    return { success: true, alert: created };
  }

  async update(
    userId: string,
    tier: string,
    id: string,
    input: AlertUpdateInput
  ) {
    // V8: line alerts are PRO-exclusive — FREE users (e.g. after downgrade)
    // cannot modify or re-enable them; DELETE remains available for cleanup.
    if (tier !== 'PRO') {
      throw new ForbiddenException({
        error: 'Line alerts are a PRO feature',
        message:
          'Your plan cannot modify line alerts. Upgrade to PRO, or delete this alert.',
      });
    }

    const existing = await this.prisma.drawingAlert.findUnique({
      where: { id },
      include: { drawing: true },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Not found' });
    }
    const draw = existing.drawing;
    if (!draw || draw.userId !== userId) {
      throw new ForbiddenException({ error: 'Forbidden' });
    }

    const alert = await this.prisma.$transaction(async (tx) => {
      const drawingAlertData: Prisma.DrawingAlertUpdateInput = {};
      if (input.direction !== undefined)
        drawingAlertData.direction = input.direction;
      if (input.tolerance !== undefined)
        drawingAlertData.tolerance = input.tolerance;
      if (input.cooldownSec !== undefined)
        drawingAlertData.cooldownSec = input.cooldownSec;
      if (input.oneShot !== undefined) drawingAlertData.oneShot = input.oneShot;

      await tx.drawingAlert.update({ where: { id }, data: drawingAlertData });

      if (input.name !== undefined || input.isActive !== undefined) {
        const alertData: Prisma.AlertUpdateInput = {};
        if (input.name !== undefined) alertData.name = input.name;
        if (input.isActive !== undefined) alertData.isActive = input.isActive;
        await tx.alert.update({
          where: { id: existing.alertId },
          data: alertData,
        });
      }

      return tx.drawingAlert.findUnique({
        where: { id },
        include: { alert: true, drawing: true },
      });
    });

    await this.publishAlertsChanged({
      symbol: draw.symbol,
      timeframe: draw.timeframe,
      alertId: existing.alertId,
      drawingId: existing.drawingId,
      reason: 'alert_updated',
    });

    return { success: true, alert };
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.drawingAlert.findUnique({
      where: { id },
      include: { drawing: true },
    });
    if (!existing) {
      throw new NotFoundException({ error: 'Not found' });
    }
    const draw = existing.drawing;
    if (!draw || draw.userId !== userId) {
      throw new ForbiddenException({ error: 'Forbidden' });
    }

    // Deleting the Alert cascades to its DrawingAlert (schema onDelete: Cascade).
    await this.prisma.alert.delete({ where: { id: existing.alertId } });

    await this.publishAlertsChanged({
      symbol: draw.symbol,
      timeframe: draw.timeframe,
      alertId: existing.alertId,
      drawingId: existing.drawingId,
      reason: 'alert_deleted',
    });

    return { success: true };
  }

  // Best-effort, mirrors lib/drawing/invalidate.ts's publishAlertsChanged:
  // never throws — a Redis hiccup must not fail the mutation that already
  // succeeded. Unlike the monolith's version, REDIS_URL is a hard
  // requirement of this service already (RedisModule is @Global()), so
  // there's no "unset -> no-op" branch to preserve here.
  private async publishAlertsChanged(
    payload: AlertsChangedPayload
  ): Promise<void> {
    try {
      await this.redisService
        .getClient()
        .publish(ALERTS_CHANGED_CHANNEL, JSON.stringify(payload));
    } catch (error) {
      console.error(
        'publishAlertsChanged failed:',
        error instanceof Error ? error.message : error
      );
    }
  }
}

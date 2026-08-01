import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePlainAlertInput,
  UpdatePlainAlertInput,
} from './alerts.schemas';

// PRO_TIER_CONFIG.maxAlerts (lib/tier-config.ts). V8: FREE is hard-blocked
// at 0 alerts (Alerts are a PRO-exclusive feature), PRO's real limit is 100
// — verified directly against live SOURCE at CONFIRM. The order's originally
// -cited "FREE: 3 / PRO: 50" numbers did not match live SOURCE and were
// corrected before this file was written (see order Deviations).
const PRO_ALERT_LIMIT = 100;

export interface AlertListFilters {
  status?: string;
  symbol?: string;
}

const ALERT_SELECT = {
  id: true,
  name: true,
  symbol: true,
  timeframe: true,
  condition: true,
  alertType: true,
  isActive: true,
  lastTriggered: true,
  triggerCount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AlertSelect;

/**
 * Plain (price) alerts CRUD — ports `app/api/alerts/route.ts` and
 * `app/api/alerts/[id]/route.ts` verbatim (Session 4B-5, Files 1-2/4).
 * `JwtAuthGuard` already guarantees an authenticated caller before any
 * method here runs, so the SOURCE's own 401 checks are handled at the guard
 * layer, not duplicated here. Uncaught errors fall through to the global
 * `AllExceptionsFilter` (Session 4B-4) as a 500 — the SOURCE's own per-route
 * try/catch-and-500 is redundant with that, not reproduced here (the
 * observable behavior — unexpected error -> 500 — is preserved; only the
 * mechanism differs, per this service's own established convention).
 *
 * Plain alerts do NOT publish to the `alerts:changed` Redis channel — the
 * SOURCE never does (verified directly), and the live `AlertWorkerService`
 * only reloads on `DrawingAlert` rows, not plain `Alert` rows, so there is
 * no consumer for this signal today. See order Deviations.
 *
 * @module alerts/alerts.service
 */
@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filters: AlertListFilters) {
    const where: Prisma.AlertWhereInput = { userId };

    if (filters.status === 'active') {
      where.isActive = true;
    } else if (filters.status === 'paused') {
      where.isActive = false;
      where.lastTriggered = { not: null };
    } else if (filters.status === 'triggered') {
      where.lastTriggered = { not: null };
    }

    if (filters.symbol) {
      where.symbol = filters.symbol;
    }

    const alerts = await this.prisma.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: ALERT_SELECT,
    });

    return { alerts };
  }

  async create(userId: string, tier: string, input: CreatePlainAlertInput) {
    // V8: strict block — alerts are a PRO feature.
    if (tier === 'FREE') {
      throw new ForbiddenException({
        error: 'Alerts are a PRO feature',
        message: `Price alerts are exclusive to the PRO tier. Upgrade to create up to ${PRO_ALERT_LIMIT} alerts on XAUUSD M5/M15, plus drawing-engine line alerts and multi-timeframe visualization.`,
      });
    }

    const currentAlertCount = await this.prisma.alert.count({
      where: { userId, isActive: true },
    });

    if (currentAlertCount >= PRO_ALERT_LIMIT) {
      throw new ForbiddenException({
        error: 'Alert limit exceeded',
        message: `You have reached your PRO tier limit of ${PRO_ALERT_LIMIT} alerts`,
      });
    }

    const condition = JSON.stringify({
      type: input.conditionType,
      targetValue: input.targetValue,
    });

    const alert = await this.prisma.alert.create({
      data: {
        userId,
        symbol: input.symbol,
        timeframe: input.timeframe,
        condition,
        alertType: 'PRICE_ALERT',
        name: input.name || `${input.symbol} ${input.timeframe} Alert`,
        isActive: true,
      },
      select: ALERT_SELECT,
    });

    return { alert, message: 'Alert created successfully' };
  }

  async getById(userId: string, id: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      select: { ...ALERT_SELECT, userId: true },
    });

    if (!alert) {
      throw new NotFoundException({ error: 'Alert not found' });
    }
    if (alert.userId !== userId) {
      throw new ForbiddenException({ error: 'Forbidden' });
    }

    const { userId: _userId, ...alertWithoutUserId } = alert;
    return { alert: alertWithoutUserId };
  }

  async update(
    userId: string,
    tier: string,
    id: string,
    input: UpdatePlainAlertInput
  ) {
    const dbUser = this.prisma.user
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { tier: true },
        })
      : null;
    const effectiveTier = dbUser?.tier || tier || 'FREE';

    // V8: Alerts are PRO-exclusive. FREE users (e.g. after a downgrade)
    // cannot modify or re-enable leftover alerts — only DELETE them.
    if (effectiveTier !== 'PRO') {
      throw new ForbiddenException({
        error: 'Alerts are a PRO feature',
        message:
          'Your plan cannot modify alerts. Upgrade to PRO to manage alerts, or delete this alert.',
      });
    }

    const existingAlert = await this.prisma.alert.findUnique({
      where: { id },
      select: { userId: true, condition: true },
    });

    if (!existingAlert) {
      throw new NotFoundException({ error: 'Alert not found' });
    }
    if (existingAlert.userId !== userId) {
      throw new ForbiddenException({ error: 'Forbidden' });
    }

    const updateData: Prisma.AlertUpdateInput = {};

    if (typeof input.isActive === 'boolean') {
      updateData.isActive = input.isActive;
    }
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.targetValue !== undefined) {
      try {
        const existingCondition: unknown = JSON.parse(existingAlert.condition);
        updateData.condition = JSON.stringify({
          ...(typeof existingCondition === 'object' && existingCondition
            ? existingCondition
            : {}),
          targetValue: input.targetValue,
        });
      } catch {
        updateData.condition = JSON.stringify({
          type: 'price_above',
          targetValue: input.targetValue,
        });
      }
    }

    const updatedAlert = await this.prisma.alert.update({
      where: { id },
      data: updateData,
      select: ALERT_SELECT,
    });

    return { alert: updatedAlert, message: 'Alert updated successfully' };
  }

  async remove(userId: string, id: string) {
    const existingAlert = await this.prisma.alert.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingAlert) {
      throw new NotFoundException({ error: 'Alert not found' });
    }
    if (existingAlert.userId !== userId) {
      throw new ForbiddenException({ error: 'Forbidden' });
    }

    // Hard delete — corrected at CONFIRM against live SOURCE (the route's
    // own JSDoc header and an inline comment both claim "soft delete", the
    // actually-executed statement is prisma.alert.delete()).
    await this.prisma.alert.delete({ where: { id } });

    return { message: 'Alert deleted successfully' };
  }
}

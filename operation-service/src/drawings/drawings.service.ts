import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SYMBOLS, TIMEFRAMES } from '@trading-alerts/types/validations';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { DRAWING_LIMITS } from './drawings.schemas';
import type { CreateDrawingDto, UpdateDrawingDto } from './dto/drawing.dto';

const ALERTS_CHANGED_CHANNEL = 'alerts:changed';

interface AlertsChangedPayload {
  symbol: string;
  timeframe: string;
  drawingId: string;
  reason: string;
}

export interface DrawingListFilters {
  symbol?: string;
  timeframe?: string;
}

/**
 * Chart drawings CRUD — ports `app/api/drawings/route.ts` (159 lines) and
 * `app/api/drawings/[id]/route.ts` (147 lines) verbatim. Session 4B-8.
 *
 * Symbol/timeframe access is re-implemented here using the SAME semantics
 * and SAME reason strings as `lib/tier-validation.ts`'s `canAccessSymbol()`/
 * `validateTimeframeAccess()` — operation-service cannot import monolith
 * `lib/*` code directly (separate deployable, per this migration's own
 * boundary), so the check is replicated locally against the shared
 * `@trading-alerts/types/validations` SYMBOLS/TIMEFRAMES constants (the same
 * source both the monolith's tier-validation.ts and this service's own
 * alerts.schemas.ts already read from) — V8 is tier-independent for both
 * (XAUUSD only, M5/M15 only), so no tier parameter changes the outcome.
 *
 * `JwtAuthGuard` already guarantees an authenticated caller before any
 * method here runs. Uncaught errors fall through to the global
 * `AllExceptionsFilter` (Session 4B-4) as a 500, matching the SOURCE's own
 * per-route try/catch-and-500 (mechanism differs, observable behavior is
 * preserved) — same established convention as `AlertsService`.
 *
 * @module drawings/drawings.service
 */
@Injectable()
export class DrawingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService
  ) {}

  async list(userId: string, filters: DrawingListFilters) {
    const drawings = await this.prisma.drawing.findMany({
      where: {
        userId,
        ...(filters.symbol ? { symbol: filters.symbol } : {}),
        ...(filters.timeframe ? { timeframe: filters.timeframe } : {}),
      },
      include: { alerts: true },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, drawings };
  }

  async create(userId: string, tier: string, dto: CreateDrawingDto) {
    const { symbol, timeframe, type, anchors, style } = dto;

    if (!(SYMBOLS as readonly string[]).includes(symbol.toUpperCase())) {
      throw new ForbiddenException({
        success: false,
        error: 'Symbol access denied',
        message: `Symbol ${symbol} is not available in your ${tier} tier.`,
      });
    }

    if (!(TIMEFRAMES as readonly string[]).includes(timeframe.toUpperCase())) {
      throw new ForbiddenException({
        success: false,
        error: 'Timeframe access denied',
        message: `Timeframe ${timeframe} is not supported. Available timeframes: ${TIMEFRAMES.join(', ')}.`,
      });
    }

    const count = await this.prisma.drawing.count({ where: { userId } });
    const limit = DRAWING_LIMITS[tier as 'FREE' | 'PRO'] ?? DRAWING_LIMITS.FREE;
    if (count >= limit) {
      throw new ForbiddenException({
        success: false,
        error: 'Drawing limit reached',
        message: `${tier} tier allows ${limit} drawings.${
          tier === 'FREE' ? ' Upgrade to PRO for more.' : ''
        }`,
      });
    }

    const drawing = await this.prisma.drawing.create({
      data: {
        userId,
        symbol,
        timeframe,
        type,
        anchors,
        style: style as Prisma.InputJsonValue,
      },
      include: { alerts: true },
    });

    return { success: true, drawing };
  }

  async update(userId: string, id: string, dto: UpdateDrawingDto) {
    const existing = await this.prisma.drawing.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ success: false, error: 'Not found' });
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException({ success: false, error: 'Forbidden' });
    }

    const drawing = await this.prisma.drawing.update({
      where: { id },
      data: {
        ...(dto.anchors ? { anchors: dto.anchors } : {}),
        ...(dto.style ? { style: dto.style as Prisma.InputJsonValue } : {}),
      },
      include: { alerts: true },
    });

    await this.publishAlertsChanged({
      symbol: drawing.symbol,
      timeframe: drawing.timeframe,
      drawingId: drawing.id,
      reason: 'drawing_updated',
    });

    return { success: true, drawing };
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.drawing.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ success: false, error: 'Not found' });
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException({ success: false, error: 'Forbidden' });
    }

    await this.prisma.drawing.delete({ where: { id } });

    await this.publishAlertsChanged({
      symbol: existing.symbol,
      timeframe: existing.timeframe,
      drawingId: existing.id,
      reason: 'drawing_deleted',
    });

    return { success: true };
  }

  // Best-effort, mirrors lib/drawing/invalidate.ts's publishAlertsChanged:
  // never throws — a Redis hiccup must not fail the mutation that already
  // succeeded. REDIS_URL is a hard requirement of this service already
  // (RedisModule is @Global()), so there's no "unset -> no-op" branch to
  // preserve here — matches LineAlertsService's own established convention.
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

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import {
  CENTROID_VARIANTS,
  SYMBOLS,
  TIMEFRAMES,
  type CentroidVariant,
  type Tier,
} from './market-data.schemas';

interface ChannelPoint {
  time: number;
  upper: number | null;
  mid: number | null;
  lower: number | null;
}

/**
 * Ports `app/api/market-data/channel/route.ts` (125 lines) verbatim.
 * Session 4B-12.
 *
 * PRO-exclusive (V8: this specific endpoint is tier-gated — checked
 * directly against the caller's tier, matching SOURCE's own inline check;
 * this route predates the reusable `TierGuard`/`@RequireTier()` built in
 * Session 4B-10, and is the sole handler in this domain, so a guard-level
 * decorator adds no reuse value over the inline check SOURCE already has).
 *
 * `JwtAuthGuard` already guarantees an authenticated caller before this
 * method runs (SOURCE's own `getServerSession(authOptions)` +
 * `session?.user?.id` 401 check). Uncaught errors fall through to the
 * global `AllExceptionsFilter` (Session 4B-4) as a 500, matching SOURCE's
 * own try/catch-and-500 (mechanism differs, observable behavior is
 * preserved) — same established convention as `DrawingsService`/
 * `AlertsService`.
 *
 * @module market-data/market-data.service
 */
@Injectable()
export class MarketDataService {
  constructor(private readonly prisma: PrismaService) {}

  async getChannelData(
    userTier: Tier,
    symbol: string,
    timeframe: string,
    variant: string,
    limit: number
  ) {
    // V8: multi-timeframe visualization is PRO-exclusive.
    if (userTier !== 'PRO') {
      throw new ForbiddenException({
        success: false,
        error: 'Multi-timeframe visualization is a PRO feature',
        message:
          'Upgrade to PRO to overlay M5 channel structure on M15 charts.',
      });
    }

    if (!(SYMBOLS as readonly string[]).includes(symbol)) {
      throw new BadRequestException({
        success: false,
        error: 'Unsupported symbol (XAUUSD only)',
      });
    }

    if (!(TIMEFRAMES as readonly string[]).includes(timeframe)) {
      throw new BadRequestException({
        success: false,
        error: 'Unsupported timeframe (M5, M15 only)',
      });
    }

    if (!(CENTROID_VARIANTS as readonly string[]).includes(variant)) {
      throw new BadRequestException({
        success: false,
        error: `Invalid variant. Available: ${CENTROID_VARIANTS.join(', ')}`,
      });
    }

    const validVariant = variant as CentroidVariant;

    const rows = (await this.prisma.marketDataV6.findMany({
      where: { symbol, timeframe },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })) as unknown as Array<Record<string, unknown>>;

    const points: ChannelPoint[] = rows.reverse().map((row) => ({
      time: row['timestamp'] as number,
      upper: (row[`${validVariant}_uoedt`] as number | null) ?? null,
      mid: (row[`${validVariant}_base_fl`] as number | null) ?? null,
      lower: (row[`${validVariant}_loedt`] as number | null) ?? null,
    }));

    return {
      success: true,
      symbol,
      timeframe,
      variant: validVariant,
      points,
    };
  }
}

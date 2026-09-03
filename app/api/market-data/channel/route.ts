/**
 * Market Data Channel API — V8 (PRO feature: multi-timeframe visualization)
 *
 * GET /api/market-data/channel?timeframe=M5&variant=best_fit_a&limit=300
 *
 * Returns the equal-distance channel lines (upper `uoedt`, mid `base_fl`,
 * lower `loedt`) of a centroid-regression variant from market_data_v6, for
 * overlaying onto another timeframe's chart (e.g. M5 channel on M15 chart).
 *
 * PRO-exclusive: this endpoint powers multi-timeframe visualization. Regular
 * single-timeframe data access remains identical for both tiers elsewhere.
 *
 * @module app/api/market-data/channel/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { marketPrisma } from '@/lib/db/market-prisma';
import { shouldUseOperationServiceForMarketDataChannel } from '@/lib/operation-service/flags';
import {
  forwardRequestToOperationService,
  OperationServiceError,
} from '@/lib/operation-service/write-routes';
import { SYMBOLS, TIMEFRAMES, type Tier } from '@/lib/tier-config';
import { CENTROID_VARIANTS, type CentroidVariant } from '@/types/indicator';

interface ChannelPoint {
  time: number;
  upper: number | null;
  mid: number | null;
  lower: number | null;
}

interface ChannelResponse {
  success: boolean;
  symbol?: string;
  timeframe?: string;
  variant?: CentroidVariant;
  points?: ChannelPoint[];
  error?: string;
  message?: string;
}

const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 1000;

export async function GET(
  request: NextRequest
): Promise<NextResponse<ChannelResponse>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Session 4B-12: when the flag is on, operation-service's
    // MarketDataController (Session 4B-12 PORT) already re-implements the
    // WHOLE handler below (PRO-tier gate, symbol/timeframe/variant
    // membership, channel query) — forward the raw request there instead of
    // running the tier check twice and then diverging.
    if (shouldUseOperationServiceForMarketDataChannel()) {
      const { status: opStatus, body } =
        await forwardRequestToOperationService<ChannelResponse>(
          request,
          `/market-data/channel${new URL(request.url).search}`
        );
      return NextResponse.json(body, { status: opStatus });
    }

    // V8: multi-timeframe visualization is PRO-exclusive.
    if (((session.user.tier as Tier) || 'FREE') !== 'PRO') {
      return NextResponse.json(
        {
          success: false,
          error: 'Multi-timeframe visualization is a PRO feature',
          message:
            'Upgrade to PRO to overlay M5 channel structure on M15 charts.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') ?? 'XAUUSD').toUpperCase();
    const timeframe = (searchParams.get('timeframe') ?? 'M5').toUpperCase();
    const variant = (searchParams.get('variant') ??
      'best_fit_a') as CentroidVariant;
    const limit = Math.min(
      Math.max(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );

    if (!(SYMBOLS as readonly string[]).includes(symbol)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported symbol (XAUUSD only)' },
        { status: 400 }
      );
    }
    if (!(TIMEFRAMES as readonly string[]).includes(timeframe)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported timeframe (M5, M15 only)' },
        { status: 400 }
      );
    }
    if (!CENTROID_VARIANTS.includes(variant)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid variant. Available: ${CENTROID_VARIANTS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const rows = (await marketPrisma.marketDataV6.findMany({
      where: { symbol, timeframe },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })) as unknown as Array<Record<string, unknown>>;

    const points: ChannelPoint[] = rows.reverse().map((row) => ({
      time: row['timestamp'] as number,
      upper: (row[`${variant}_uoedt`] as number | null) ?? null,
      mid: (row[`${variant}_base_fl`] as number | null) ?? null,
      lower: (row[`${variant}_loedt`] as number | null) ?? null,
    }));

    return NextResponse.json(
      { success: true, symbol, timeframe, variant, points },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof OperationServiceError) {
      return NextResponse.json(error.body as ChannelResponse, {
        status: error.status,
      });
    }
    console.error('GET /api/market-data/channel error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch channel data' },
      { status: 500 }
    );
  }
}

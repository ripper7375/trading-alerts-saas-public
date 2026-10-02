/**
 * Market Data Channel API — V8 (PRO feature: multi-timeframe visualization)
 *
 * GET /api/market-data/channel?timeframe=M5&limit=300
 *
 * Returns the equal-distance channel lines (upper `uoedt`, mid `base_fl`,
 * lower `loedt`) of one channel indicator from market_data_v6, for overlaying
 * onto another timeframe's chart (e.g. M5 channel on M15 chart).
 *
 * WHICH INDICATOR (rule 6, ADR-010). When ACTIVE_INDICATOR_FROM_GATEWAY is on,
 * the indicator is the one the active-indicator setting names for the timeframe
 * at the newest READY cycle, asked of the gateway (`GET /api/v1/cycles/current`),
 * so the overlay flips to a new indicator on the same cycle as the sensors and
 * the renderer. A `variant` in the request is then ignored. The answer carries
 * `activeIndicator` (the source, the slot it took effect at, the slot it was
 * resolved at). If the gateway cannot say, the route answers 503 rather than
 * show a different indicator than the sensors use. With the flag off (the
 * default) the variant comes from the query string, defaulting to `best_fit_a`,
 * exactly as before.
 *
 * PRO-exclusive: this endpoint powers multi-timeframe visualization. Regular
 * single-timeframe data access remains identical for both tiers elsewhere.
 *
 * @module app/api/market-data/channel/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { shouldResolveActiveIndicatorFromGateway } from '@/lib/active-indicator/flags';
import { GatewayError } from '@/lib/active-indicator/gateway-client';
import {
  resolveActiveChannel,
  type ResolvedChannel,
} from '@/lib/active-indicator/resolve';
import {
  channelColumns,
  isActiveIndicatorTimeframe,
  type ChannelSource,
} from '@/lib/active-indicator/sources';
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
  variant?: ChannelSource;
  /** Present when the indicator was resolved from the gateway's active-indicator setting. */
  activeIndicator?: {
    source: ChannelSource;
    /** The slot the setting took effect at. */
    effectiveSlot: number;
    /** The slot it was resolved at: the newest READY cycle's (`CYCLE`), else the wall-clock slot. */
    resolvedAtSlot: number;
    basis: 'CYCLE' | 'WALL_CLOCK' | 'REQUESTED_SLOT';
  };
  points?: ChannelPoint[];
  error?: string;
  message?: string;
}

const DEFAULT_LIMIT = 300;
const MAX_LIMIT = 1000;

/**
 * The active channel for a timeframe from the gateway, or the 503 to answer with.
 * `null` active means the flag is off or the timeframe is not one the setting
 * covers (the usual validation answers it).
 */
async function resolveActive(
  timeframe: string
): Promise<
  | { active: ResolvedChannel | null; failure: null }
  | { active: null; failure: NextResponse<ChannelResponse> }
> {
  if (
    !shouldResolveActiveIndicatorFromGateway() ||
    !isActiveIndicatorTimeframe(timeframe)
  ) {
    return { active: null, failure: null };
  }
  try {
    return { active: await resolveActiveChannel(timeframe), failure: null };
  } catch (error) {
    if (!(error instanceof GatewayError)) throw error;
    console.error(
      `GET /api/market-data/channel: active indicator unavailable (${error.kind}): ${error.message}`
    );
    return {
      active: null,
      failure: NextResponse.json(
        {
          success: false,
          error: 'Active indicator unavailable',
          message:
            'The active channel indicator could not be determined right now. Try again shortly.',
        },
        { status: 503 }
      ),
    };
  }
}

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

    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get('symbol') ?? 'XAUUSD').toUpperCase();
    const timeframe = (searchParams.get('timeframe') ?? 'M5').toUpperCase();

    // Session 4B-12: when the flag is on, operation-service's
    // MarketDataController (Session 4B-12 PORT) already re-implements the
    // WHOLE handler below (PRO-tier gate, symbol/timeframe/variant
    // membership, channel query) — forward the raw request there instead of
    // running the tier check twice and then diverging.
    if (shouldUseOperationServiceForMarketDataChannel()) {
      // The active indicator is resolved HERE, before forwarding, and put into
      // the forwarded query as the variant: operation-service stays as it is
      // and still serves exactly the indicator the setting names.
      const { active, failure } = await resolveActive(timeframe);
      if (failure) return failure;
      let search = new URL(request.url).search;
      if (active) {
        const forwarded = new URLSearchParams(search);
        forwarded.set('variant', active.source);
        search = `?${forwarded.toString()}`;
      }
      const { status: opStatus, body } =
        await forwardRequestToOperationService<ChannelResponse>(
          request,
          `/market-data/channel${search}`
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

    // Which indicator: the setting's (flag on) or the request's (flag off).
    const { active, failure } = await resolveActive(timeframe);
    if (failure) return failure;
    let variant: ChannelSource;
    if (active) {
      variant = active.source;
    } else {
      const requested = (searchParams.get('variant') ??
        'best_fit_a') as CentroidVariant;
      if (!CENTROID_VARIANTS.includes(requested)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid variant. Available: ${CENTROID_VARIANTS.join(', ')}`,
          },
          { status: 400 }
        );
      }
      variant = requested;
    }
    const columns = channelColumns(variant);

    const rows = (await marketPrisma.marketDataV6.findMany({
      where: { symbol, timeframe },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })) as unknown as Array<Record<string, unknown>>;

    const points: ChannelPoint[] = rows.reverse().map((row) => ({
      time: row['timestamp'] as number,
      upper: (row[columns.upper] as number | null) ?? null,
      mid: (row[columns.mid] as number | null) ?? null,
      lower: (row[columns.lower] as number | null) ?? null,
    }));

    return NextResponse.json(
      {
        success: true,
        symbol,
        timeframe,
        variant,
        ...(active
          ? {
              activeIndicator: {
                source: active.source,
                effectiveSlot: active.effectiveSlot,
                resolvedAtSlot: active.resolvedAtSlot,
                basis: active.basis,
              },
            }
          : {}),
        points,
      },
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

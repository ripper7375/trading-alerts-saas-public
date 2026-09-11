/**
 * Indicator Containment-Rate API Route
 *
 * GET /api/market/indicator-statistics
 *
 * Serves the terminal's EDT Quality Metrics panel -- currently just the
 * Containment Rate figure per (symbol, timeframe, source). See
 * lib/indicator-statistics/queries.ts for why nothing else from
 * `indicator_statistics` ships yet.
 *
 * @module app/api/market/indicator-statistics/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/prisma';
import { getLatestContainmentRates } from '@/lib/indicator-statistics/queries';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // PRO-gated, matching the panel this feeds -- the same permission
  // /api/market/economic-events already uses for this panel's sibling
  // content.
  //
  // The DB re-check is deliberate and mirrors requireChartDownload() rather
  // than requirePro(). requirePro() trusts the JWT's `tier` claim alone, so
  // a user who has JUST paid for PRO still carries a stale `FREE` claim and
  // would be refused a feature they had already bought.
  if (!hasPermission(session.user, 'multi_timeframe_visualization')) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tier: true },
    });

    if (dbUser?.tier !== 'PRO') {
      return NextResponse.json(
        { error: 'PRO subscription required' },
        { status: 403 }
      );
    }
  }

  const rates = await getLatestContainmentRates();

  return NextResponse.json(
    { rates },
    {
      headers: {
        // Statistics update on the order of minutes at most; a short cache
        // keeps a roomful of open terminals from re-running the same query
        // per second.
        'Cache-Control': 'private, max-age=60',
      },
    }
  );
}

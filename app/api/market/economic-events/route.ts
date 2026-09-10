/**
 * Upcoming High-Impact Economic Events API Route
 *
 * GET /api/market/economic-events
 *
 * Serves the news half of the session banner in the terminal's right-hand
 * panel, and is the query the future Stack D news pillar will reuse.
 *
 * Returns only `event_time` per event, never a precomputed countdown: the
 * browser ticks the clock locally, so no WebSocket and no polling-for-seconds
 * is needed. One fetch gives a countdown that stays accurate.
 *
 * @module app/api/market/economic-events/route
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { hasPermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db/prisma';
import { getUpcomingHighImpactEvents } from '@/lib/economic-events/queries';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // PRO-gated, matching the panel this feeds (seed-code locks that whole panel
  // behind an upgrade wall naming "Session Countdowns" explicitly).
  //
  // The DB re-check is deliberate and mirrors requireChartDownload() rather
  // than requirePro(). requirePro() trusts the JWT's `tier` claim alone, so a
  // user who has JUST paid for PRO still carries a stale `FREE` claim and
  // would be refused a feature they had already bought. Asking the database
  // before refusing costs one indexed lookup on the deny path only.
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

  const events = await getUpcomingHighImpactEvents();

  return NextResponse.json(
    { events },
    {
      headers: {
        // Events move on the order of minutes at most; a short cache keeps a
        // roomful of open terminals from re-running the same query per second.
        'Cache-Control': 'private, max-age=60',
      },
    }
  );
}

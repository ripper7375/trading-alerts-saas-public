/**
 * Public Capabilities API (M1.0)
 *
 * What the product can do today, with the tier snapshot, for davintrade.com:
 * it advertises only what this endpoint reports as `live` (decision Q3). No
 * authentication, no database, no user data, and no dictionary imports (see
 * __tests__/lib/i18n/route-handlers-and-dictionaries.test.ts).
 *
 * A status is a statement about shipped code. Change one only together with
 * the code that makes it true.
 *
 * @module app/api/config/capabilities/route
 */

import { NextResponse } from 'next/server';

import { replyAvailability } from '@/lib/reply/server/flags';
import {
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  SYMBOLS,
  TIMEFRAMES,
  TRIAL_CONFIG,
} from '@/lib/tier-config';

// Read the flags on each request, not once at build time.
export const dynamic = 'force-dynamic';

type CapabilityStatus = 'live' | 'beta' | 'planned';

interface Capability {
  status: CapabilityStatus;
  /** Whether any visitor can use it today */
  available: boolean;
}

function capability(status: CapabilityStatus): Capability {
  return { status, available: status === 'live' };
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      schemaVersion: 1,
      asOf: new Date().toISOString(),
      tiers: {
        symbols: SYMBOLS,
        timeframes: TIMEFRAMES,
        free: { maxActiveAlerts: FREE_TIER_CONFIG.maxAlerts },
        pro: {
          maxActiveAlerts: PRO_TIER_CONFIG.maxAlerts,
          trialDays: TRIAL_CONFIG.DURATION_DAYS,
        },
      },
      capabilities: {
        interactiveAiAnalyst: capability(replyAvailability(process.env)),
        // Marketing text names a dual-model confluence score; nothing computes one.
        dualModelPatternConfluence: capability('planned'),
        priceBreachAlerts: capability('live'),
        multiTimeframeCharts: capability('live'),
        dataExport: capability('planned'),
        prioritySupport: capability('planned'),
      },
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    }
  );
}

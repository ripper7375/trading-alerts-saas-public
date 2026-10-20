/**
 * G8 Currency & Gold Index Suite API Route (Lane 4)
 *
 * GET /api/market/currency-gold-indices
 *
 * Serves the public landing-page Hero widget. Deliberately PUBLIC and
 * UNAUTHENTICATED -- unlike every sibling route under app/api/market/*
 * (economic-events, indicator-statistics, both session + PRO gated), this
 * lane's own purpose per the architecture doc is a marketing/conversion asset
 * for first-time, logged-out visitors, so there is no session check here.
 *
 * Because it is genuinely public, it needs a real cache in front of
 * Postgres that the session-gated siblings don't: an authenticated route's
 * own login requirement already bounds request volume, but this route is one
 * cache miss away from every anonymous visitor hitting the database directly.
 * Cache-aside via lib/cache/cache-manager.ts (60s TTL, matching the
 * architecture doc's §6.3), reusing the same Redis singleton
 * (lib/redis/client.ts) every other cached path in this app already uses --
 * not a new caching layer.
 *
 * @module app/api/market/currency-gold-indices/route
 */

import { NextResponse } from 'next/server';

import {
  getCachedCurrencyGoldIndices,
  cacheCurrencyGoldIndices,
} from '@/lib/cache/cache-manager';
import { singleFlight } from '@/lib/cache/single-flight';
import {
  getCurrencyGoldIndexSnapshots,
  type CurrencyGoldIndexSnapshot,
} from '@/lib/currency-gold-indices/queries';

export const dynamic = 'force-dynamic';

// CDN-cacheable, unlike the sibling routes' `private, max-age=60` -- there is
// no per-user variation here (no session, same response for every visitor),
// so `public` is correct, not an oversight.
const RESPONSE_CACHE_CONTROL = 'public, s-maxage=60, stale-while-revalidate=30';

// One fill per warm process: requests that all miss the cache before any of
// them has written it share a single Postgres read instead of one each
// (lib/cache/single-flight.ts). Nothing is kept once the fill settles.
const SNAPSHOT_FLIGHT_KEY = 'market:currency-gold:snapshot';

async function loadSnapshots(): Promise<CurrencyGoldIndexSnapshot[]> {
  try {
    const cached =
      await getCachedCurrencyGoldIndices<CurrencyGoldIndexSnapshot[]>();
    if (cached) return cached;
  } catch (error) {
    // Redis being unreachable must never break this route -- fall through to
    // Postgres, the same "an absent cache is not an absent answer" principle
    // getCurrencyGoldIndexSnapshots() itself applies to a missing table.
    console.warn(
      '[currency-gold-indices] cache read failed, falling back to Postgres:',
      error
    );
  }

  const indices = await getCurrencyGoldIndexSnapshots();

  // Best-effort: a failed cache write must not fail the response the visitor
  // is actually waiting on.
  try {
    await cacheCurrencyGoldIndices(indices);
  } catch (error) {
    console.warn('[currency-gold-indices] cache write failed:', error);
  }

  return indices;
}

export async function GET(): Promise<NextResponse> {
  const indices = await singleFlight(SNAPSHOT_FLIGHT_KEY, loadSnapshots);

  return NextResponse.json(
    { indices },
    { headers: { 'Cache-Control': RESPONSE_CACHE_CONTROL } }
  );
}

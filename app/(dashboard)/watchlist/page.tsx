/**
 * Watchlist Page (Server Component)
 *
 * Displays user's watchlist with symbol+timeframe combinations.
 * Tier-based limits: FREE: 5 items, PRO: 50 items
 *
 * @module app/(dashboard)/watchlist/page
 */

import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  FREE_TIER_CONFIG,
  PRO_TIER_CONFIG,
  type Tier,
} from '@/lib/tier-config';

import { WatchlistClient } from './watchlist-client';

// Force dynamic rendering since this page uses headers via getSession
export const dynamic = 'force-dynamic';

/**
 * Watchlist Page
 *
 * Server component that fetches initial watchlist data and renders
 * the client-side interactive watchlist management component.
 */
export default async function WatchlistPage(): Promise<React.JSX.Element> {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const tier = (session.user?.tier as Tier) || 'FREE';
  const limit =
    tier === 'PRO'
      ? PRO_TIER_CONFIG.maxWatchlistItems
      : FREE_TIER_CONFIG.maxWatchlistItems;

  // Fetch user's default watchlist with items
  let watchlist = await prisma.watchlist.findFirst({
    where: { userId: session.user.id },
    include: {
      items: {
        orderBy: { order: 'asc' },
      },
    },
  });

  // Create default watchlist if it doesn't exist
  if (!watchlist) {
    watchlist = await prisma.watchlist.create({
      data: {
        userId: session.user.id,
        name: 'My Watchlist',
      },
      include: {
        items: true,
      },
    });
  }

  return (
    <WatchlistClient
      initialItems={watchlist.items}
      watchlistId={watchlist.id}
      userTier={tier}
      limit={limit}
    />
  );
}

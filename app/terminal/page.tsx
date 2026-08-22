import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import type { Tier } from '@/lib/tier-config';

import { TerminalWorkspace } from './terminal-workspace';

export const metadata: Metadata = {
  title: 'Terminal | DavinTrade',
  description: 'Real-Time XAUUSD Quantitative Trading Terminal',
};

/**
 * `/terminal` -- Protected Page #2 (PRO 4-panel workspace).
 *
 * PRO-only, matching `frontend-swap-route-map.md` row 57's own tier gate
 * ("PRO only (4-panel)"). A FREE-tier session is redirected to the
 * equivalent `/free` workspace rather than shown an upgrade landing here --
 * mirrors how `AppHeader`'s own "AI Analyst Workbench" nav link already
 * routes FREE users to `/free` instead of `/terminal`.
 */
export default async function TerminalPage(): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  const tier = (session.user.tier || 'FREE') as Tier;

  if (tier !== 'PRO') {
    redirect('/free');
  }

  return <TerminalWorkspace />;
}

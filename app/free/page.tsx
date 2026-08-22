import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';

import { FreeWorkspace } from './free-workspace';

export const metadata: Metadata = {
  title: 'Free Workspace | DavinTrade',
  description: 'Real-Time XAUUSD Trading Workspace',
};

/**
 * `/free` -- Protected Page #3 (FREE-tier workspace).
 *
 * Any authenticated user (FREE or PRO) can view it -- there is no reason to
 * redirect a PRO user away, mirroring `AppHeader`'s own tier-switcher which
 * lets either tier navigate to either workspace page directly.
 */
export default async function FreePage(): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  return <FreeWorkspace />;
}

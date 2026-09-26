import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth/auth-options';
import { localizedMetadata } from '@/lib/i18n/server-metadata';

import { FreeWorkspace } from './free-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return localizedMetadata(
    { key: 'free.meta_title', fallback: 'Free Workspace | DavinTrade' },
    {
      key: 'free.meta_description',
      fallback: 'Real-Time XAUUSD Trading Workspace',
    }
  );
}

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

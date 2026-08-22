import { redirect } from 'next/navigation';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

import {
  AccountSettingsClient,
  type DeletionStatus,
} from './account-settings-client';

/**
 * Account Settings Page (Row 73, server half)
 *
 * Reads the current user's active account-deletion request (if any)
 * directly via Prisma, mirroring the established direct-read convention
 * (Session 6-5) rather than adding a new API endpoint, since none of the 3
 * real deletion-* routes exposes a side-effect-free status check.
 */

// Force dynamic rendering: reads a fresh session + a live DB row every load.
export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage(): Promise<React.ReactElement> {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const activeDeletionRequest = await prisma.accountDeletionRequest.findFirst({
    where: {
      userId: session.user.id,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { status: true, expiresAt: true, confirmedAt: true },
  });

  const initialDeletionStatus: DeletionStatus | null = activeDeletionRequest
    ? {
        status: activeDeletionRequest.status as 'PENDING' | 'CONFIRMED',
        expiresAt: activeDeletionRequest.expiresAt.toISOString(),
        confirmedAt: activeDeletionRequest.confirmedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <AccountSettingsClient initialDeletionStatus={initialDeletionStatus} />
  );
}

import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

import {
  APPEARANCE_COOKIE_NAME,
  AppearanceSettings,
  DEFAULT_APPEARANCE_SETTINGS,
  sanitizeAppearanceSettings,
} from './types';

export * from './types';

/**
 * Server-side resolution hierarchy for appearance settings, used during SSR
 * (root layout) to eliminate FOUC by resolving theme/accent/chart tokens
 * before the first byte of HTML streams:
 *
 *   1. Authenticated user's database record (`UserAppearance` via Prisma)
 *   2. HTTP cookie (`davintrade-appearance`) — guests / unauthenticated users
 *   3. `DEFAULT_APPEARANCE_SETTINGS`
 */
export async function getServerAppearance(): Promise<AppearanceSettings> {
  try {
    const session = await getSession();
    if (session?.user?.id) {
      const record = await prisma.userAppearance.findUnique({
        where: { userId: session.user.id },
      });
      if (record) {
        return sanitizeAppearanceSettings({
          theme: record.theme,
          accent: record.accent,
          chartUpColor: record.chartUpColor,
          chartDownColor: record.chartDownColor,
          gridOpacity: record.gridOpacity,
        });
      }
    }
  } catch (error) {
    console.error(
      '[getServerAppearance] Failed to resolve database record:',
      error
    );
  }

  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(APPEARANCE_COOKIE_NAME)?.value;
    if (cookieVal) {
      return sanitizeAppearanceSettings(
        JSON.parse(decodeURIComponent(cookieVal))
      );
    }
  } catch (error) {
    console.error('[getServerAppearance] Failed to parse cookie:', error);
  }

  return DEFAULT_APPEARANCE_SETTINGS;
}

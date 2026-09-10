/**
 * Server-side reads of stored user preferences.
 *
 * `app/api/user/preferences/route.ts` already does this for its own GET, but
 * that path also resolves a geo-locale bundle, which is unnecessary work when a
 * caller only needs one stored flag. This reads the JSON blob directly and
 * falls back to `DEFAULT_PREFERENCES`.
 *
 * @module lib/preferences/server-preferences
 */

import { prisma } from '@/lib/db/prisma';

import { DEFAULT_PREFERENCES, type UserPreferences } from './defaults';

/**
 * Whether this user has the PRO M5-on-M15 overlay switched on.
 *
 * This is the single source the chart toggle writes to and the rendered-PNG
 * download reads, so the file a trader downloads matches what is on their
 * screen. Defaults to `false` for a user who has never toggled it, or if the
 * read fails — a download is not worth failing over a preferences lookup.
 */
export async function getM5OnM15Preference(userId: string): Promise<boolean> {
  try {
    const row = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { preferences: true },
    });

    const stored = (row?.preferences ?? {}) as Partial<UserPreferences>;
    return typeof stored.m5OnM15 === 'boolean'
      ? stored.m5OnM15
      : DEFAULT_PREFERENCES.m5OnM15;
  } catch (error) {
    console.error('[preferences] m5OnM15 read failed:', error);
    return DEFAULT_PREFERENCES.m5OnM15;
  }
}

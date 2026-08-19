'use server';

import { cookies } from 'next/headers';

import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  APPEARANCE_COOKIE_NAME,
  AppearanceSettings,
  sanitizeAppearanceSettings,
} from '@/lib/appearance/types';

/**
 * Persists appearance settings (theme, accent, chart candle colors, grid
 * opacity). Always writes the cookie first so guests and unauthenticated
 * visitors get instant SSR/zero-FOUC support; additionally upserts the
 * `UserAppearance` database row when a session is present so the
 * preference follows the user across browsers and devices.
 */
export async function saveAppearanceAction(
  settings: AppearanceSettings
): Promise<{ success: boolean }> {
  const sanitized = sanitizeAppearanceSettings(settings);

  try {
    const cookieStore = await cookies();
    cookieStore.set(APPEARANCE_COOKIE_NAME, JSON.stringify(sanitized), {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      httpOnly: false,
    });

    const session = await getSession();
    if (session?.user?.id) {
      await prisma.userAppearance.upsert({
        where: { userId: session.user.id },
        update: {
          theme: sanitized.theme,
          accent: sanitized.accent,
          chartUpColor: sanitized.chartUpColor,
          chartDownColor: sanitized.chartDownColor,
          gridOpacity: sanitized.gridOpacity,
        },
        create: {
          userId: session.user.id,
          theme: sanitized.theme,
          accent: sanitized.accent,
          chartUpColor: sanitized.chartUpColor,
          chartDownColor: sanitized.chartDownColor,
          gridOpacity: sanitized.gridOpacity,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error(
      '[saveAppearanceAction] Failed to save appearance settings:',
      error
    );
    return { success: false };
  }
}

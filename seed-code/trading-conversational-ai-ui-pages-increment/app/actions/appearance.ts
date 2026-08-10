'use server';

import { cookies } from 'next/headers';
import {
  AppearanceSettings,
  APPEARANCE_COOKIE_NAME,
} from '@/lib/appearance/types';

/**
 * Server Action to persist user appearance settings.
 * Sets HTTP cookie for zero-FOUC SSR rendering and provides
 * an extension point for backend DB persistence.
 */
export async function saveAppearanceAction(settings: AppearanceSettings) {
  try {
    const cookieStore = await cookies();
    const serialized = encodeURIComponent(JSON.stringify(settings));

    cookieStore.set(APPEARANCE_COOKIE_NAME, serialized, {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    // Extension point for future Backend API / Database integration:
    // await saveToDatabase(userId, settings);

    return { success: true, settings };
  } catch (error) {
    console.error('Failed to save appearance settings:', error);
    return { success: false, error: 'Failed to update appearance preferences' };
  }
}

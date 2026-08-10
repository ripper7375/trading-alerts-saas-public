import { cookies } from 'next/headers';
import {
  AppearanceSettings,
  DEFAULT_APPEARANCE_SETTINGS,
  APPEARANCE_COOKIE_NAME,
} from './types';

export * from './types';

/**
 * Server-side helper to retrieve appearance preferences from HTTP cookies.
 * Used during SSR to populate initial state and eliminate FOUC.
 */
export async function getServerAppearance(): Promise<AppearanceSettings> {
  try {
    const cookieStore = await cookies();
    const cookieVal = cookieStore.get(APPEARANCE_COOKIE_NAME)?.value;
    if (cookieVal) {
      const parsed = JSON.parse(decodeURIComponent(cookieVal));
      return {
        ...DEFAULT_APPEARANCE_SETTINGS,
        ...parsed,
      };
    }
  } catch {
    // Return default settings if parsing or cookie retrieval fails
  }
  return DEFAULT_APPEARANCE_SETTINGS;
}

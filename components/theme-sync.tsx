'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppearance } from '@/components/providers/appearance-provider';

/**
 * Applies a `?theme=dark|light` URL override for the current visit (not
 * persisted), then removes the parameter from the address bar. Routed
 * through AppearanceProvider so the page class and every `resolvedTheme`
 * consumer change together.
 */
export function ThemeSync() {
  const { updateSettings } = useAppearance();
  const themeFromUrl = useSearchParams().get('theme');

  useEffect(() => {
    if (themeFromUrl === 'dark' || themeFromUrl === 'light') {
      updateSettings({ theme: themeFromUrl });
      const url = new URL(window.location.href);
      url.searchParams.delete('theme');
      window.history.replaceState({}, '', url.toString());
    }
    // Keyed on the parameter's value only: updateSettings is recreated on
    // every render, so depending on it would re-run this after each update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeFromUrl]);

  return null;
}

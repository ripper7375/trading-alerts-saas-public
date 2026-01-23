'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';

export function ThemeSync() {
  const { setTheme } = useTheme();
  const searchParams = useSearchParams();

  useEffect(() => {
    const themeFromUrl = searchParams.get('theme');
    if (themeFromUrl && (themeFromUrl === 'dark' || themeFromUrl === 'light')) {
      setTheme(themeFromUrl);
      // Clean up URL by removing the theme parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('theme');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, setTheme]);

  return null;
}

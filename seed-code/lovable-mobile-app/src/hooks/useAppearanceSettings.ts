import { useEffect, useState } from 'react';

const STORAGE_KEYS = {
  accentColor: 'app-accent-color',
  fontSize: 'app-font-size',
  chartLineWidth: 'app-chart-line-width',
};

const FONT_SCALES: Record<string, number> = {
  small: 0.875,
  medium: 1,
  large: 1.125,
  xlarge: 1.25,
};

export const useAppearanceSettings = () => {
  const [fontSize, setFontSize] = useState(
    () => localStorage.getItem(STORAGE_KEYS.fontSize) || 'medium'
  );

  useEffect(() => {
    const scale = FONT_SCALES[fontSize] || 1;
    document.documentElement.style.fontSize = `${scale * 16}px`;
  }, [fontSize]);

  // Listen for storage changes (when settings are updated)
  useEffect(() => {
    const handleStorageChange = () => {
      const newFontSize =
        localStorage.getItem(STORAGE_KEYS.fontSize) || 'medium';
      setFontSize(newFontSize);
    };

    window.addEventListener('storage', handleStorageChange);

    // Also check periodically for same-tab updates
    const interval = setInterval(() => {
      const stored = localStorage.getItem(STORAGE_KEYS.fontSize) || 'medium';
      if (stored !== fontSize) {
        setFontSize(stored);
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [fontSize]);

  return { fontSize };
};

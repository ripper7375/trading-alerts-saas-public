'use client';

import { Moon, Sun } from 'lucide-react';

import { useAppearance } from '@/components/providers/appearance-provider';
import { useLocale } from '@/lib/context/locale-context';

/**
 * Public, unauthenticated dark/light toggle for the marketing navbar -- a
 * one-click shortcut so a visitor never has to find their way into the
 * authenticated Settings -> Appearance page just to flip the theme.
 * Unlike the header's Language/Country quick-switchers (session-local only,
 * because their backing endpoint requires auth), `saveAppearanceAction` is
 * guest-safe by design -- it always writes the `davintrade-appearance`
 * cookie and only additionally upserts the DB row when a session exists --
 * so this toggle genuinely persists across a reload for anonymous visitors
 * too, not just for the current tab.
 */
export function ThemeToggleButton({
  className = '',
}: {
  className?: string;
}): React.ReactElement {
  const { t } = useLocale();
  const { resolvedTheme, updateSettings, saveSettings } = useAppearance();
  const isDark = resolvedTheme === 'dark';
  const label = isDark ? t('Switch to light mode') : t('Switch to dark mode');

  const handleToggle = async (): Promise<void> => {
    const next = isDark ? 'light' : 'dark';
    updateSettings({ theme: next });
    // Pass the override directly rather than relying on `settings` having
    // already picked up the update above -- see saveSettings()'s own doc
    // comment for why (a same-handler update+save races React's batching).
    await saveSettings({ theme: next });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-amber-500/40 hover:text-amber-600 focus:outline-none dark:hover:text-amber-400 ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

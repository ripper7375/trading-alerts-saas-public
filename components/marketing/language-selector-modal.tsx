'use client';

import { useMemo } from 'react';
import { Check, Globe } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/lib/context/locale-context';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';

interface LanguageSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Public, unauthenticated language picker for the marketing site -- offers
 * the exact same language set as Settings -> Language & Region
 * (`lib/i18n/languages.ts`) so a first-time visitor never has to find their
 * way into an authenticated settings page just to read the landing page in
 * their own language. Selecting a language applies immediately via
 * `setLocalePreferences()` (same client-side persistence -- localStorage +
 * cookie -- as `app-header.tsx`'s quick country switcher), no login or
 * "Save" step required.
 */
export function LanguageSelectorModal({
  open,
  onOpenChange,
}: LanguageSelectorModalProps): React.ReactElement {
  const { t, language, setLocalePreferences } = useLocale();

  // Sorted for display only -- `SUPPORTED_LANGUAGES`' own insertion order
  // (English variants first) stays intact for Settings -> Language & Region,
  // which isn't long enough yet to need alphabetizing.
  const sortedLanguages = useMemo(
    () => [...SUPPORTED_LANGUAGES].sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  const handleSelect = (code: string): void => {
    setLocalePreferences({ language: code });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            {t('form.display_language', 'Display Language')}
          </DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
          {sortedLanguages.map((lang) => {
            const isActive = language === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                aria-pressed={isActive}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  isActive
                    ? 'border-amber-500/60 bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-300'
                    : 'border-border text-foreground hover:border-amber-500/40 hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{lang.flag}</span>
                  <span>{lang.name}</span>
                </span>
                {isActive && (
                  <Check className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

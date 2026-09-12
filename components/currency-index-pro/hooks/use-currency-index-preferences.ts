'use client';

/**
 * useCurrencyIndexPreferences — fetch-once GET of
 * /api/market/currency-index-pro/preferences, with an immediate local
 * update + debounced PUT on change.
 *
 * The immediate/debounced split matters: spec Section 3.3 explicitly wants
 * the OB/OS override to reach the chart with "0ms server roundtrip" --
 * `setPreferences` applies the new value to local state synchronously (the
 * cockpit re-renders the chart's `corridorOverride` prop on the same tick),
 * while the actual persistence PUT is debounced ~500ms so dragging a
 * slider doesn't fire a request per pixel. Mirrors `useMtfPreference.ts`'s
 * own "optimistic write" spirit, extended with debouncing since this modal
 * has several sliders that can all move in one sitting (that one has a
 * single boolean toggle, which never needed it).
 *
 * @module components/currency-index-pro/hooks/use-currency-index-preferences
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface CurrencyIndexPreferences {
  lookbackDays: number;
  useAutoZones: boolean;
  customObPct: number | null;
  customOsPct: number | null;
  hrmaPeriod: number;
  smmaPeriod: number;
  preferredTf: 'M5' | 'M15';
}

const DEFAULT_PREFERENCES: CurrencyIndexPreferences = {
  lookbackDays: 20,
  useAutoZones: true,
  customObPct: null,
  customOsPct: null,
  hrmaPeriod: 36,
  smmaPeriod: 13,
  preferredTf: 'M15',
};

const PERSIST_DEBOUNCE_MS = 500;

interface UseCurrencyIndexPreferencesResult {
  preferences: CurrencyIndexPreferences;
  /** Applies immediately to local state; persists in the background, debounced. */
  setPreferences: (next: Partial<CurrencyIndexPreferences>) => void;
  isLoading: boolean;
}

export function useCurrencyIndexPreferences(): UseCurrencyIndexPreferencesResult {
  const [preferences, setPreferencesState] =
    useState<CurrencyIndexPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow GET landing after the user has already touched a
  // slider and clobbering their choice with the stale stored value --
  // same guard `useMtfPreference.ts` uses for the identical race.
  const touchedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    void (async (): Promise<void> => {
      try {
        const res = await fetch('/api/market/currency-index-pro/preferences', {
          signal: controller.signal,
        });
        if (!res.ok || touchedRef.current) return;
        const body = await res.json();
        if (body?.preferences) {
          setPreferencesState((prev) => ({ ...prev, ...body.preferences }));
        }
      } catch {
        // A read failure just means the modal starts from schema defaults.
      } finally {
        setIsLoading(false);
      }
    })();

    return (): void => {
      controller.abort();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const setPreferences = useCallback(
    (next: Partial<CurrencyIndexPreferences>): void => {
      touchedRef.current = true;
      setPreferencesState((prev) => {
        const merged = { ...prev, ...next };

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          void fetch('/api/market/currency-index-pro/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(merged),
          }).catch((error) => {
            console.error(
              '[currency-index-pro] failed to persist preferences:',
              error
            );
          });
        }, PERSIST_DEBOUNCE_MS);

        return merged;
      });
    },
    []
  );

  return { preferences, setPreferences, isLoading };
}
